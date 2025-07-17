import { ExpenseModel } from "../models/expense.js";
import { notificationService } from "./notification-service.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";
import { IncomeModel } from "../models/income.js";
import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { expenseHistoryService } from "./expense-history-service.js";
import { TypeNotification } from "../models/notification.js";
import { incomeService } from "./income-service.js";
import { isToday } from "date-fns";

/**
 * Сервис для работы с расходами
 */

class ExpenseService {
  /**
   * Получает все расходы для указанного бюджета
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array>} - Список расходов
   */
  async getBudgetExpenses(userId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;
    const expenses = await ExpenseModel.find({
      budgetId: budget._id.toString(),
    });

    return { expenses, type: "success" };
  }

  async createExpense(expenseData, userId) {
    const {
      title,
      amount,
      comment = "",
      frequency,
      priority = 3,
      scope = "personal",
      date,
    } = expenseData;

    const budget = (await budgetService.getUserBudget(userId)).budget;
    const budgetId = budget._id.toString();
    const budgetAmount = budget?.sum ?? 0;

    // Создание объекта для симуляции
    const allExpenses = await ExpenseModel.find({ budgetId });
    const simulatedExpenses = [...allExpenses, { amount, frequency }];
    const incomes = await IncomeModel.find({ budgetId });

    const isOnce = frequency === "once";

    if ((isOnce || isToday(date)) && budgetAmount - amount < 0) {
      throw new Error("В бюджете нет средств на этот расход");
    }

    const isHealthy = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      simulatedExpenses,
    );

    if (!isHealthy) {
      throw new Error("В бюджете нет средств на этот расход");
    }

    if (isOnce) {
      const response = await expenseHistoryService.create(
        { amount, comment, expenseId: null, priority, scope, frequency, title },
        userId,
      );

      return response;
    }

    const recipientId = notificationService.getRecipeId(budget, userId);

    const expense = await ExpenseModel.create({
      budgetId,
      userId,
      title,
      amount,
      frequency,
      priority,
      scope,
      date: budgetServiceUtils.getNextDateFromFrequency(date, frequency),
      confirmed: recipientId ? false : true,
      createdAt: new Date(),
      comment,
    });

    if (recipientId) {
      await notificationService.create(
        userId,
        recipientId,
        TypeNotification.newExpense,
        `Оппонент хочет добавить новый расход на ${amount}, согласны?`,
        expense._id,
      );
    }

    if (isToday(date)) {
    }

    return {
      type: "success",
      message: recipientId ? "Уведомление отправлено оппоненту" : "",
    };
  }

  async acceptExpense(expenseId) {
    const expense = await ExpenseModel.findById(expenseId);
    await notificationService.delete(expenseId);

    expense.confirmed = true;

    await expense.save();

    return { type: "success" };
  }

  async rejectExpense(expenseId) {
    await ExpenseModel.findByIdAndDelete(expenseId);
    await notificationService.delete(expenseId);

    return { type: "success" };
  }

  async delete(expenseId) {
    await ExpenseModel.findByIdAndDelete(expenseId);

    await notificationService.delete(expenseId);

    return { type: "success" };
  }

  async updateExpense(expenseId, expenseData, userId) {
    const {
      title,
      amount,
      comment = "",
      frequency,
      priority = 3,
      scope = "personal",
      date,
    } = expenseData;

    const expense = await ExpenseModel.findById(expenseId);
    const expenses = (await this.getBudgetExpenses(userId))?.expenses;
    const budget = (await budgetService.getUserBudget(userId))?.budget;
    const incomes = (await incomeService.getBudgetIncomes(userId)).incomes;
    const budgetAmount = budget?.sum ?? 0;

    const budgetId = budget._id.toString();

    if (!expense) {
      throw new Error("Доход не найден");
    }

    if (expense.budgetId.toString() !== budgetId) {
      throw new Error("Нет доступа к изменению бюджета");
    }

    if (frequency === "once") {
      if (budgetAmount - amount < 0) {
        throw new Error("В бюджете нет средств на этот расход");
      }

      const simulatedExpenses = expenses.filter(
        (exp) => exp._id.toString() !== expenseId,
      );

      const isHealthy = budgetServiceUtils.simulateBudgetHealth(
        budget,
        incomes,
        simulatedExpenses,
      );

      if (!isHealthy) {
        throw new Error("В бюджете нет средств на этот расход");
      }

      await expenseHistoryService.create(
        { amount, comment, expenseId, priority, scope, frequency, title },
        userId,
      );

      await notificationService.delete(expenseId);

      await ExpenseModel.findByIdAndDelete(expenseId);

      return {
        type: "success",
      };
    }

    const simulatedExpenses = expenses.map((exp) => {
      if (exp._id.toString() === expenseId) {
        return {
          ...exp,
          date,
          amount,
          frequency,
        };
      }

      return exp;
    });

    const isHealthy = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      simulatedExpenses,
    );

    if (!isHealthy) {
      throw new Error("В бюджете нет средств на этот расход");
    }

    if (isToday(date) || frequency === "daily") {
      if (budgetAmount - amount < 0) {
        throw new Error("В бюджете нет средств на этот расход");
      }

      const lastHistory = await ExpenseHistoryModel.findOne({ expenseId })
        .sort({ date: -1 }) // Последняя по дате
        .lean(); // ускоряет, если не нужно работать с mongoose-документом

      if (!isToday(new Date(lastHistory.date))) {
        await expenseHistoryService.create(
          { amount, comment, expenseId, priority, scope, frequency, title },
          userId,
        );
      }
    }

    await ExpenseModel.findByIdAndUpdate(expense._id, {
      amount,
      comment,
      date: budgetServiceUtils.getNextDateFromFrequency(date, frequency),
      frequency,
      priority,
      scope,
      title,
    });

    return { type: "success" };
  }
}

export const expenseService = new ExpenseService();

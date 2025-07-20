import { ExpenseModel } from "../models/expense.js";
import { notificationService } from "./notification-service.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";
import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { expenseHistoryService } from "./expense-history-service.js";
import { TypeNotification } from "../models/notification.js";
import { incomeService } from "./income-service.js";
import { isToday } from "date-fns";

/**
 * Сервис для работы с расходами
 */

class ExpenseService {
  async getAcceptedExpenses(userId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;
    const expenses =
      (await ExpenseModel.find({
        budgetId: budget._id.toString(),
        confirmed: true,
      })) || [];

    return { expenses, type: "success" };
  }

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

    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(userId);
    const budgetId = budget._id.toString();
    const budgetAmount = budget?.sum ?? 0;

    const simulatedExpenses = [...allExpenses, { amount, frequency, date }];

    const isOnce = frequency === "once";
    const isTodayExpense = isToday(date);

    if ((isOnce || isTodayExpense) && budgetAmount - amount < 0) {
      throw new Error("В бюджете нет средств на этот расход");
    }

    const isHealthy = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      simulatedExpenses
    );

    if (!isHealthy) {
      throw new Error("В бюджете нет средств на этот расход");
    }

    if (isOnce) {
      const response = await expenseHistoryService.create(
        { amount, comment, expenseId: null, priority, scope, frequency, title },
        userId
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
        expense._id
      );
    }

    if (isToday(isTodayExpense)) {
      await expenseHistoryService.create(
        {
          amount,
          comment,
          expenseId: expense._id,
          priority,
          scope,
          frequency,
          title,
        },
        userId
      );
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
    const { budget, allExpenses, goals, incomes } =
      await budgetService.getBudgetDetails(userId);
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

      const simulatedExpenses = allExpenses.filter(
        (exp) => exp._id.toString() !== expenseId
      );

      const isHealthy = budgetServiceUtils.simulateBudgetHealth(
        budget,
        incomes,
        simulatedExpenses
      );

      if (!isHealthy) {
        throw new Error("В бюджете нет средств на этот расход");
      }

      await expenseHistoryService.create(
        { amount, comment, expenseId, priority, scope, frequency, title },
        userId
      );

      await notificationService.delete(expenseId);

      await ExpenseModel.findByIdAndDelete(expenseId);

      return {
        type: "success",
      };
    }

    const simulatedExpenses = [
      allExpenses.map((exp) => {
        if (exp._id.toString() === expenseId) {
          return {
            ...exp,
            date,
            amount,
            frequency,
          };
        }

        return exp;
      }),
      ...goals,
    ];

    const isHealthy = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      simulatedExpenses
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
          userId
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

import { ExpenseModel } from "../models/expense.js";
import { notificationService } from "./notification-service.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";
import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { expenseHistoryService } from "./expense-history-service.js";
import { TypeNotification } from "../models/notification.js";
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
    }).sort({ date: 1 });

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
      category = [],
    } = expenseData;

    let newDate = new Date(date);

    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(userId);
    const budgetId = budget._id.toString();
    const budgetAmount = budget?.sum ?? 0;

    const isOnce = frequency === "once";

    const simulatedExpenses = isOnce
      ? allExpenses
      : [...allExpenses, { amount, frequency, date }];
    const isTodayExpense = isToday(date);

    if ((isOnce || isTodayExpense) && budgetAmount - amount < 0) {
      throw new Error("В бюджете нет средств на этот расход");
    }

    const isHealthy = budgetServiceUtils.isBudgetHealthy(
      isOnce ? budget.sum - amount : budget.sum,
      incomes,
      simulatedExpenses,
    );

    if (!isHealthy) {
      throw new Error("В бюджете нет средств на этот расход");
    }

    if (isOnce) {
      const response = await expenseHistoryService.create(
        {
          amount,
          comment,
          entityId: null,
          priority,
          scope,
          frequency,
          title,
          category,
        },
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
      date: newDate,
      confirmed: recipientId ? false : true,
      createdAt: new Date(),
      comment,
      category,
    });

    if (recipientId) {
      await notificationService.create(
        userId,
        recipientId,
        TypeNotification.newExpense,
        `Оппонент хочет добавить новый расход на ${budgetServiceUtils.formatNumberWithSpaces(
          amount,
        )}, согласны?`,
        expense._id,
      );
    }

    if (isTodayExpense) {
      await expenseHistoryService.create(
        {
          amount,
          comment,
          entityId: expense._id,
          priority,
          scope,
          frequency,
          title,
          category,
        },
        userId,
      );

      expense.date = budgetServiceUtils.getNextDateFromFrequency(
        date,
        frequency,
      );

      await expense.save();
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
      category = [],
    } = expenseData;
    let newDate = new Date(date);

    // Временный код
    if (category.length > 0) {
      await updateExpenseHistoryCategory(expenseId, category);
    }
    // Временный код заканчивается

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
        (exp) => exp._id.toString() !== expenseId,
      );

      const isHealthy = budgetServiceUtils.isBudgetHealthy(
        budget.sum,
        incomes,
        simulatedExpenses,
      );

      if (!isHealthy) {
        throw new Error("В бюджете нет средств на этот расход");
      }

      await expenseHistoryService.create(
        {
          amount,
          comment,
          entityId: expenseId,
          priority,
          scope,
          frequency,
          title,
          category,
        },
        userId,
      );

      await notificationService.delete(expenseId);

      await ExpenseModel.findByIdAndDelete(expenseId);

      const recipientId = notificationService.getRecipeId(budget, userId);

      if (recipientId) {
        notificationService.sendPushNotification(
          recipientId,
          `Пользователь изменил расход "${title}" на сумму ${amount}`,
          "",
        );
      }

      return {
        type: "success",
      };
    }

    const simulatedExpenses = [
      ...allExpenses.map((exp) => {
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

    const isHealthy = budgetServiceUtils.isBudgetHealthy(
      budget.sum,
      incomes,
      simulatedExpenses,
    );

    if (!isHealthy) {
      throw new Error("В бюджете нет средств на этот расход");
    }

    if (isToday(date)) {
      newDate = budgetServiceUtils.getNextDateFromFrequency(date, frequency);
      if (budgetAmount - amount < 0) {
        throw new Error("В бюджете нет средств на этот расход");
      }

      const lastHistory = await ExpenseHistoryModel.findOne({ expenseId })
        .sort({ date: -1 }) // Последняя по дате
        .lean(); // ускоряет, если не нужно работать с mongoose-документом

      if (!isToday(new Date(lastHistory?.date ?? ""))) {
        await expenseHistoryService.create(
          {
            amount,
            comment,
            entityId: expenseId,
            priority,
            scope,
            frequency,
            title,
            category,
          },
          userId,
        );
      }
    }

    await ExpenseModel.findByIdAndUpdate(expense._id, {
      amount,
      comment,
      date: newDate,
      frequency,
      priority,
      scope,
      title,
      category,
    });

    return { type: "success" };
  }
}

// создать временную функцию чтоб обновить историю расходов добавив категорию
async function updateExpenseHistoryCategory(expenseId, category) {
  await ExpenseHistoryModel.updateMany(
    { entityId: expenseId },
    { $set: { category } },
  );
}

export const expenseService = new ExpenseService();

import { isToday } from "date-fns";
import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";

class ExpenseHistoryService {
  async create(expenseData, userId) {
    const {
      amount,
      comment,
      entityId,
      priority,
      scope,
      frequency,
      title,
      date = new Date(),
      type = "expense",
      category = [],
      isConfirmed = false,
    } = expenseData;

    if (entityId) {
      const expenseInHistory = await ExpenseHistoryModel.findOne({
        entityId,
      }).sort({ date: -1 });

      if (expenseInHistory) {
        const date = expenseInHistory.date;

        if (isToday(new Date(date))) {
          return { type: "success" };
        }
      }
    }

    const budget = (await budgetService.getUserBudget(userId)).budget;

    try {
      await ExpenseHistoryModel.create({
        title,
        amount,
        budgetId: budget._id.toString(),
        comment,
        date,
        entityId,
        userId,
        frequency,
        priority,
        scope,
        type,
        category,
        isConfirmed: frequency === 'once' ? true : isConfirmed,
      });

      budget.sum -= amount;

      await budget.save();

      return { type: "success" };
    } catch (error) {
      if (
        error.code === 11000 &&
        error.message.includes("entityId") &&
        error.message.includes("date")
      ) {
        return { type: "success" };
      }

      // иначе пробрасываем ошибку
      throw new Error(error);
    }
  }

  async updateExpenseHistory(userId, expenseData) {
    const { amount, _id } = expenseData;
    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(userId);
    const expenseHistoryItem = await ExpenseHistoryModel.findOne({
      _id: _id,
    });

    if (!expenseHistoryItem) {
      throw new Error("Не найдено транзакция с таким ID");
    }

    if (amount <= expenseHistoryItem.amount) {
      budget.sum += expenseHistoryItem.amount - amount;

      await budget.save();
    } else if (amount > expenseHistoryItem.amount) {
      budget.sum -= amount - expenseHistoryItem.amount;

      if (budget.sum < 0) {
        throw new Error("Недостаточно средств в бюджете");
      }

      const isHealthy = budgetServiceUtils.isBudgetHealthyV2(
        budget.sum,
        incomes,
        allExpenses,
      );

      if (!isHealthy) {
        throw new Error("Бюджет станет отрицательным после изменения");
      }

      await budget.save();
    }

    await ExpenseHistoryModel.updateOne(
      { _id: _id },
      {
        $set: {
          amount,
          isConfirmed: true,
        },
      },
    );

    return { type: "success" };
  }

  async deleteExpenseHistory(entityId) {
    const expenseHistoryItem = await ExpenseHistoryModel.findById(entityId);

    if (!expenseHistoryItem) {
      throw new Error("Не найдена транзакция с таким ID");
    }

    const budget = (
      await budgetService.getUserBudget(expenseHistoryItem.userId)
    ).budget;

    budget.sum += expenseHistoryItem.amount;

    await budget.save();

    await ExpenseHistoryModel.findByIdAndDelete(entityId);

    return { type: "success" };
  }
  async deleteExpenseHistoriesByBudgetId(budgetId) {
    await ExpenseHistoryModel.deleteMany({ budgetId });
  }
  async confirmAllExpenseHistoryItems(userId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;
    await ExpenseHistoryModel.updateMany(
      { budgetId: budget._id, isConfirmed: false },
      { $set: { isConfirmed: true } },
    );

    return { type: "success" };
  }
}
export const expenseHistoryService = new ExpenseHistoryService();

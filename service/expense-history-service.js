import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";

class ExpenseHistoryService {
  async create(expenseData, userId) {
    const { amount, comment, expenseId, priority, scope, frequency, title } =
      expenseData;
    const budget = (await budgetService.getUserBudget(userId)).budget;

    budget.sum -= amount;

    await budget.save();

    await ExpenseHistoryModel.create({
      title,
      amount,
      budgetId: budget._id.toString(),
      comment,
      date: new Date(),
      expenseId: expenseId ?? null,
      userId,
      frequency,
      priority,
      scope,
    });

    return { type: "success" };
  }

  async updateExpenseHistory(userId, expenseData, entityId) {
    const { amount, comment, priority, scope, frequency, title } = expenseData;
    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(userId);
    const expenseHistoryItem = await ExpenseHistoryModel.findOne({
      _id: entityId,
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

      const isHealthy = budgetServiceUtils.simulateBudgetHealth(
        budget,
        incomes,
        allExpenses
      );

      if (!isHealthy) {
        throw new Error("Бюджет станет отрицательным после изменения");
      }

      await budget.save();
    }

    await ExpenseHistoryModel.updateOne(
      { _id: entityId },
      {
        $set: {
          title,
          amount,
          comment,
          priority,
          scope,
          frequency,
        },
      }
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
}
export const expenseHistoryService = new ExpenseHistoryService();

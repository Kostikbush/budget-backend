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
    } = expenseData;
    const budget = (await budgetService.getUserBudget(userId)).budget;

    budget.sum -= amount;

    await budget.save();

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
    });

    return { type: "success" };
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
      console.log(expenseHistoryItem.amount - amount);
      budget.sum += expenseHistoryItem.amount - amount;
      console.log(budget.sum);
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
      { _id: _id },
      {
        $set: {
          amount,
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

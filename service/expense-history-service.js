import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { budgetService } from "./budget-service.js";

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
}

export const expenseHistoryService = new ExpenseHistoryService();

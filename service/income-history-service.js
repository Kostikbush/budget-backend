import { IncomeHistoryModel } from "../models/incomeHistory.js";
import { budgetService } from "./budget-service.js";

class IncomeHistoryService {
  /**
   * Создает новый доход
   * @param {Object} incomeData - Данные о доходе
   * @param {string} budgetId - ID бюджета.
   * @param {string} incomeData.title - Название дохода.
   * @param {number} incomeData.amount - Ожидаемая сумма.
   * @param {string} incomeData.date - Дата зачисления.
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Созданный доход
   */

  async create(incomeData, userId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;

    budget.sum += incomeData.amount;

    await IncomeHistoryModel.create({
      amount: incomeData.amount,
      budgetId: budget._id.toString(),
      date: new Date(),
      userId: userId,
      incomeId: incomeData?.incomeId ?? null,
      frequency: incomeData.frequency,
      title: incomeData.title,
    });

    await budget.save();

    return { type: "success" };
  }
}

export const incomeHistoryService = new IncomeHistoryService();

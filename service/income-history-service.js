import { IncomeHistoryModel } from "../models/incomeHistory.js";
import {BudgetModel} from '../models/budget.js'
import { budgetServiceUtils } from "./budget-service.js";

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

  // нужно добавлять нетолько 
  async createIncome(incomeData, budgetId, userId) {
        // Проверяем, существует ли бюджет и является ли пользователь его участником
        const budget = await BudgetModel.findById(budgetId);

        budgetServiceUtils.isUserBudget(budget, userId);

        await IncomeHistoryModel.create({
          amount: incomeData.amount,
          budgetId: budgetId,
          date: new Date(),
          userId: userId,
          incomeId: incomeData?.incomeId ?? null,
          frequency: incomeData.frequency,
          title: incomeData.title,
        });
  }

}

export const incomeHistoryService = new IncomeHistoryService();
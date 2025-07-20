import { IncomeHistoryModel } from "../models/incomeHistory.js";
import { budgetService } from "./budget-service.js";

class IncomeHistoryService {
  /**
   * Создает новый доход
   * @param {Object} incomeData - Данные о доходе
   * @param {string} incomeData.title - Название дохода.
   * @param {number} incomeData.amount - Ожидаемая сумма.
   * @param {string} incomeData.date - Дата зачисления.
   * @param {string} incomeData.frequency - Частота зачисления.
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

  async updateIncomeHistory(userId, incomeData) {
    const { amount, frequency, title, incomeHistoryId } = incomeData;
    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(userId);
    const incomeHistoryItem = await IncomeHistoryModel.findOne({
      _id: incomeHistoryId,
    });

    if (!incomeHistoryItem) {
      throw new Error("Не найдено транзакция с таким ID");
    }

    if (amount < 0) {
      throw new Error("Сумма дохода не может быть отрицательной");
    }

    if (amount >= incomeHistoryItem.amount) {
      budget.sum += amount - incomeHistoryItem.amount;

      await budget.save();
    } else {
      budget.sum -= incomeHistoryItem.amount - amount;

      if (budget.sum < 0) {
        throw new Error("Недостаточно средств в бюджете");
      }

      const isHealthy = budgetService.simulateBudgetHealth(
        budget,
        incomes,
        allExpenses
      );

      if (!isHealthy) {
        throw new Error("Бюджет станет отрицательным после изменения");
      }

      await budget.save();
    }

    await IncomeHistoryModel.updateOne(
      { _id: incomeHistoryId },
      {
        $set: {
          amount,
          frequency,
          title,
        },
      }
    );

    return { type: "success" };
  }

  async deleteIncomeHistory(incomeHistoryId, userId) {
    const incomeHistoryItem = await IncomeHistoryModel.findOne({
      _id: incomeHistoryId,
    });

    if (!incomeHistoryItem) {
      throw new Error("Не найдено транзакция с таким ID");
    }

    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(userId);

    budget.sum -= incomeHistoryItem.amount;

    if (budget.sum < 0) {
      throw new Error("Недостаточно средств в бюджете");
    }

    const isHealthy = budgetService.simulateBudgetHealth(
      budget,
      incomes,
      allExpenses
    );

    if (!isHealthy) {
      throw new Error("Бюджет станет отрицательным после изменения");
    }

    await budget.save();

    await IncomeHistoryModel.deleteOne({ _id: incomeHistoryId });

    return { type: "success" };
  }
}

export const incomeHistoryService = new IncomeHistoryService();

import { isToday } from "date-fns";
import { IncomeHistoryModel } from "../models/incomeHistory.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";

class IncomeHistoryService {
  /**
   * Создает новый доход
   * @param {Object} incomeData - Данные о доходе
   * @param {string} incomeData.title - Название дохода.
   * @param {number} incomeData.amount - Ожидаемая сумма.
   * @param {string} incomeData.date - Дата зачисления.
   * @param {string} incomeData.frequency - Частота зачисления.
   * @param {string} incomeData.incomeId - ID дохода, если это обновление
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Созданный доход
   */

  async create(incomeData, userId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;
    const {
      title,
      amount,
      frequency,
      date = new Date(),
      incomeId = null,
    } = incomeData;

    if (incomeId) {
      const incomeInHistory = await IncomeHistoryModel.findOne({
        incomeId,
      }).sort({ date: -1 });

      if (incomeInHistory) {
        const date = incomeInHistory.date;

        if (isToday(new Date(date))) {
          return { type: "success" };
        }
      }
    }

    try {
      await IncomeHistoryModel.create({
        amount: amount,
        budgetId: budget._id.toString(),
        date: date,
        userId: userId,
        incomeId: incomeId,
        frequency: frequency,
        title: title,
      });

      budget.sum += amount;
      await budget.save();

      return { type: "success" };
    } catch (error) {
      if (
        error.code === 11000 &&
        error.message.includes("entityId") &&
        error.message.includes("date")
      ) {
        budget.sum -= amount;
        await budget.save();
        return { type: "success" };
      }

      // иначе пробрасываем ошибку
      throw new Error(error);
    }
  }

  async updateIncomeHistory(userId, incomeData) {
    const { amount, _id } = incomeData;
    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(userId);
    const incomeHistoryItem = await IncomeHistoryModel.findOne({
      _id: _id,
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

    await IncomeHistoryModel.updateOne(
      { _id: _id },
      {
        $set: {
          amount,
        },
      },
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

    const isHealthy = budgetServiceUtils.isBudgetHealthyV2(
      budget.sum,
      incomes,
      allExpenses,
    );

    if (!isHealthy) {
      throw new Error("Бюджет станет отрицательным после удаления");
    }

    await budget.save();

    await IncomeHistoryModel.deleteOne({ _id: incomeHistoryId });

    return { type: "success" };
  }
}

export const incomeHistoryService = new IncomeHistoryService();

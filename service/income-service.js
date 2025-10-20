import { IncomeModel } from "../models/income.js";
import { BudgetModel } from "../models/budget.js";
import { incomeHistoryService } from "./income-history-service.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";
import { ExpenseModel } from "../models/expense.js";
import { isToday } from "date-fns";
import { IncomeHistoryModel } from "../models/incomeHistory.js";
import { getNextDateFromFrequency } from "../lib/date.js";

/**
 * Сервис для работы с доходами
 */
class IncomeService {
  /**
   * Создает новый доход
   * @param {Object} incomeData - Данные о доходе
   * @param {string} incomeData.title - Название дохода.
   * @param {number} incomeData.amount - Ожидаемая сумма.
   * @param {string} [incomeData.frequency="once"] - Частота дохода.
   * @param {string} incomeData.date - Дата зачисления.
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Созданный доход
   */
  async createIncome(incomeData, userId) {
    const { title, amount, frequency = "once", date } = incomeData;

    let nextDate = new Date(date);

    const budget = (await budgetService.getUserBudget(userId)).budget;

    const budgetId = budget._id.toString();

    if (frequency === "once") {
      await incomeHistoryService.create(
        {
          title,
          amount,
          frequency,
        },
        userId,
      );

      return { type: "success" };
    }

    if (isToday(date)) {
      await incomeHistoryService.create(
        {
          title,
          amount,
          frequency,
        },
        userId,
      );

      nextDate = getNextDateFromFrequency(date, frequency);
    }

    await IncomeModel.create({
      budgetId,
      userId,
      title,
      amount,
      frequency,
      date: nextDate,
      createdAt: new Date(),
    });

    const incomes = await IncomeModel.find({ budgetId });

    return { incomes, type: "success" };
  }

  async deleteRegularIncome(incomeId) {
    const income = await IncomeModel.findById(incomeId);

    if (!income) {
      throw new Error("Доход не найден");
    }

    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(income.userId.toString());

    if (!budget) throw new Error("Бюджет не найден");

    const newIncomes = incomes.filter(
      (income) => income._id.toString() !== incomeId,
    );

    if (
      !budgetServiceUtils.isBudgetHealthyV2(budget.sum, newIncomes, allExpenses)
    ) {
      throw new Error(
        "Удаляя доход бюджет уйдет в минус через некоторое время!",
      );
    }

    await IncomeModel.deleteOne({ _id: incomeId });

    return { type: "success" };
  }

  /**
   * Возвращает список доходов для бюджета
   * @param {string} userId - ID пользователя
   * @param {string} budgetId - ID бюджета
   * @returns {Promise<{type: string; incomes: Array}>} - Список доходов
   */
  async getBudgetIncomes(userId, budgetId) {
    let budgetIdFormat = budgetId ? budgetId?.toString() : null;

    if (!budgetIdFormat) {
      budgetIdFormat = (
        await budgetService.getUserBudget(userId)
      ).budget?._id?.toString();
    }

    const incomes = await IncomeModel.find({
      budgetId: budgetIdFormat,
    }).sort({ date: 1 }).lean();

    return { incomes, type: "success" };
  }

  /**
   * Обновляет доход
   * @param {string} incomeId - ID дохода
   * @param {Object} incomeData - Данные для обновления
   * @returns {Promise<Object>} - Обновленный доход
   */
  async updateIncome(incomeId, incomeData) {
    const { title, amount, frequency, date } = incomeData;

    // Находим доход
    const income = await IncomeModel.findById(incomeId);
    const budgetId = income.budgetId._id.toString();
    let nextDate = new Date(date);

    if (!income) {
      throw new Error("Доход не найден");
    }

    if (frequency === "once") {
      await this.deleteRegularIncome(income._id.toString());
      await incomeHistoryService.create(
        {
          title,
          frequency,
          amount,
        },
        budgetId,
        income.userId.toString(),
      );

      return {
        type: "success",
      };
    }

    const { budget, allExpenses, incomes } =
      await budgetService.getBudgetDetails(income.userId.toString());

    if (
      !budgetServiceUtils.isBudgetHealthyV2(
        budget.sum,
        incomes.map((inc) => {
          if (inc._id.toString() === incomeId) {
            return {
              ...inc,
              ...incomeData,
            };
          }

          return inc;
        }),
        allExpenses,
      )
    ) {
      throw new Error(
        "Изменяя доход бюджет уйдет в минус через некоторое время!",
      );
    }

    if (isToday(date)) {
      const lastHistoryIncome = await IncomeHistoryModel.findOne({
        incomeId: incomeId,
      }).sort({ createdAt: -1 });

      nextDate = getNextDateFromFrequency(date, frequency);

      if (!isToday(lastHistoryIncome.date)) {
        await incomeHistoryService.create(
          {
            title,
            amount,
            frequency,
          },
          income.userId.toString(),
        );
      }
    }

    // Обновляем доход
    const updatedIncome = await IncomeModel.findByIdAndUpdate(
      incomeId,
      {
        title: title,
        amount: amount,
        frequency: frequency,
        date: nextDate,
      },
      { new: true },
    );

    return { updatedIncome, type: "success" };
  }
  async deleteIncomesByBudgetId(budgetId) {
    await IncomeModel.deleteMany({ budgetId });
  }
}

export const incomeService = new IncomeService();

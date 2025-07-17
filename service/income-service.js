import { IncomeModel } from "../models/income.js";
import { BudgetModel } from "../models/budget.js";
import { incomeHistoryService } from "./income-history-service.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";
import { ExpenseModel } from "../models/expense.js";

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

    await IncomeModel.create({
      budgetId,
      userId,
      title,
      amount,
      frequency,
      date: new Date(date),
      nextDate: budgetServiceUtils.getNextDateFromFrequency(date, frequency),
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

    const budgetId = income.budgetId.toString();

    const [budget, incomes, expenses] = await Promise.all([
      BudgetModel.findById(budgetId),
      IncomeModel.find({ budgetId }),
      ExpenseModel.find({ budgetId }),
    ]);

    if (!budget) throw new Error("Бюджет не найден");

    const newIncomes = incomes.filter(
      (income) => income._id.toString() !== incomeId,
    );

    if (
      !budgetServiceUtils.simulateBudgetHealth(budget, newIncomes, expenses)
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
   * @param {string} budgetId - ID бюджета
   * @param {string} userId - ID пользователя
   * @returns {Promise<{type: string; incomes: Array}>} - Список доходов
   */
  async getBudgetIncomes(userId) {
    const budget = await budgetService.getUserBudget(userId);

    const incomes = await IncomeModel.find({
      budgetId: budget.budget._id.toString(),
    }).sort({
      createdAt: 1,
    });

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

    const [budget, incomes, expenses] = await Promise.all([
      BudgetModel.findById(budgetId),
      IncomeModel.find({ budgetId }),
      ExpenseModel.find({ budgetId }),
    ]);

    if (
      !budgetServiceUtils.simulateBudgetHealth(
        budget,
        incomes.map((inc) => {
          if (inc._id.toString() === incomeId) {
            return {
              ...inc,
              ...incomeData,
            };
          }

          return inc;
        }),
        expenses,
      )
    ) {
      throw new Error(
        "Изменяя доход бюджет уйдет в минус через некоторое время!",
      );
    }

    // Обновляем доход
    const updatedIncome = await IncomeModel.findByIdAndUpdate(
      incomeId,
      {
        title: title,
        amount: amount,
        frequency: frequency,
        date: date,
      },
      { new: true },
    );

    return { updatedIncome, type: "success" };
  }
}

export const incomeService = new IncomeService();

import { IncomeModel } from "../models/income.js";
import { BudgetModel } from "../models/budget.js";
import { notificationService } from "./notification-service.js";
import { incomeHistoryService } from "./income-history-service.js";
import { budgetServiceUtils } from "./budget-service.js";

/**
 * Сервис для работы с доходами
 */
class IncomeService {
  /**
   * Создает новый доход
   * @param {Object} incomeData - Данные о доходе
   * @param {string} budgetId - ID бюджета.
   * @param {string} incomeData.title - Название дохода.
   * @param {number} incomeData.amount - Ожидаемая сумма.
   * @param {string} [incomeData.frequency="once"] - Частота дохода.
   * @param {string} incomeData.date - Дата зачисления.
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Созданный доход
   */
  async createIncome(incomeData, budgetId, userId) {
    const { title, amount, frequency = "once", date } = incomeData;

    // Проверяем, существует ли бюджет и является ли пользователь его участником
    const budget = await BudgetModel.findById(budgetId);

    budgetServiceUtils.isUserBudget(budget, userId);

    if (frequency === "once") {
      budget.sum += amount;

      await incomeHistoryService.createIncome(
        {
          title,
          amount,
          frequency,
        },
        budgetId,
        userId
      );

      await budget.save();

      return { type: "success" };
    }

    await IncomeModel.create({
      budgetId,
      userId,
      title,
      amount,
      frequency,
      date: new Date(date),
      createdAt: new Date(),
    });

    const incomes = await IncomeModel.find({ budgetId });

    return { incomes, type: "success" };
  }

  /**
   * Возвращает список доходов для бюджета
   * @param {string} budgetId - ID бюджета
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array>} - Список доходов
   */
  async getBudgetIncomes(budgetId, userId) {
    const budget = await BudgetModel.findById(budgetId);

    budgetServiceUtils.isUserBudget(budget, userId);

    const incomes = await IncomeModel.find({ budgetId }).sort({
      createdAt: 1,
    });

    return { incomes, type: "success" };
  }

  /**
   * Обновляет доход
   * @param {string} incomeId - ID дохода
   * @param {Object} incomeData - Данные для обновления
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Обновленный доход
   */
  async updateIncome(incomeId, incomeData, userId) {
    const {
      title,
      expectedAmount,
      frequency,
      isSpontaneous,
      nextDate,
      allocations,
    } = incomeData;

    // Находим доход
    const income = await IncomeModel.findById(incomeId);
    if (!income) {
      throw new Error("Доход не найден");
    }

    // Проверяем, имеет ли пользователь доступ к бюджету
    const budget = await BudgetModel.findById(income.budgetId);
    if (!budget.participants.includes(userId)) {
      throw new Error("У вас нет доступа к этому бюджету");
    }

    // Проверяем, не подтвержден ли уже доход
    if (income.confirmed) {
      throw new Error("Невозможно изменить подтвержденный доход");
    }

    // Проверяем, что все доходы распределены
    if (allocations) {
      let totalAllocated = 0;
      allocations.forEach((allocation) => {
        totalAllocated += allocation.amount;
      });

      if (totalAllocated !== (expectedAmount || income.expectedAmount)) {
        throw new Error(
          "Весь доход должен быть распределен на расходы или цели"
        );
      }

      // Удаляем старые распределения
      await AllocationModel.deleteMany({ incomeId });

      // Создаем новые распределения
      const allocationDocs = await Promise.all(
        allocations.map((allocation) =>
          AllocationModel.create({
            incomeId,
            type: allocation.type,
            targetId: allocation.targetId,
            amount: allocation.amount,
          })
        )
      );

      // Обновляем ссылки на распределения в доходе
      await IncomeModel.findByIdAndUpdate(incomeId, {
        allocations: allocationDocs.map((doc) => doc._id),
      });
    }

    // Обновляем доход
    const updatedIncome = await IncomeModel.findByIdAndUpdate(
      incomeId,
      {
        title: title || income.title,
        expectedAmount: expectedAmount || income.expectedAmount,
        frequency: frequency || income.frequency,
        isSpontaneous:
          isSpontaneous !== undefined ? isSpontaneous : income.isSpontaneous,
        nextDate: nextDate || income.nextDate,
      },
      { new: true }
    ).populate({
      path: "allocations",
      model: "Allocation",
    });

    return updatedIncome;
  }

  /**
   * Удаляет доход
   * @param {string} incomeId - ID дохода
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Результат операции
   */
  async deleteIncome(incomeId, userId) {
    // Находим доход
    const income = await IncomeModel.findById(incomeId);
    if (!income) {
      throw new Error("Доход не найден");
    }

    // Проверяем, имеет ли пользователь доступ к бюджету
    const budget = await BudgetModel.findById(income.budgetId);
    if (!budget.participants.includes(userId)) {
      throw new Error("У вас нет доступа к этому бюджету");
    }

    // Проверяем, не подтвержден ли уже доход
    if (income.confirmed) {
      throw new Error("Невозможно удалить подтвержденный доход");
    }

    // Удаляем распределения
    await AllocationModel.deleteMany({ incomeId });

    // Удаляем доход
    await IncomeModel.findByIdAndDelete(incomeId);

    return { message: "Доход успешно удален" };
  }

  /**
   * Рассчитывает следующую дату для повторяющегося дохода
   * @param {Date} currentDate - Текущая дата
   * @param {string} frequency - Частота повторения
   * @returns {Date} - Следующая дата
   * @private
   */
  _calculateNextDate(currentDate, frequency) {
    const date = new Date(currentDate);

    switch (frequency) {
      case "daily":
        date.setDate(date.getDate() + 1);
        break;
      case "weekly":
        date.setDate(date.getDate() + 7);
        break;
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        break;
      case "yearly":
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        // Для разового дохода не меняем дату
        break;
    }

    return date;
  }
}

export const incomeService = new IncomeService();

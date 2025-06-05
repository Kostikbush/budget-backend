import IncomeModel from "../models/income.js";
import BudgetModel from "../models/budget.js";
import AllocationModel from "../models/allocation.js";
import { notificationService } from "./notification-service.js";

/**
 * Сервис для работы с доходами
 */
class IncomeService {
  /**
   * Получает все доходы для указанного бюджета
   * @param {string} budgetId - ID бюджета
   * @returns {Promise<Array>}
   */
  async getBudgetIncomes(budgetId) {
    return await IncomeModel.find({ budgetId });
  }
  /**
   * Создает новый доход
   * @param {Object} incomeData - Данные о доходе
   * @param {string} incomeData.budgetId - ID бюджета.
   * @param {string} incomeData.title - Название дохода.
   * @param {number} incomeData.expectedAmount - Ожидаемая сумма.
   * @param {string} [incomeData.frequency="once"] - Частота дохода.
   * @param {boolean} [incomeData.isSpontaneous=false] - Спонтанный доход
   * @param {Date} incomeData.nextDate - Дата следующего дохода.
   * @param {Array} incomeData.allocations - Распределение дохода.
   * @param {string} incomeData.allocations[].categoryId - ID категории.
   * @param {number} incomeData.allocations[].amount - Сумма.
   * @param {string} incomeData.allocations[].comment - Комментарий.
   * @param {string} incomeData.allocations[].tag - Тег.
   * @param {string} incomeData.allocations[].subcategoryId - ID подкатегории.
   * @param {string} incomeData.allocations[].subcategoryName - Название подкатегории.
   * @param {string} incomeData.allocations[].subcategoryType - Тип подкатегории.
   * @param {string} incomeData.allocations[].subcategoryIcon - Иконка подкатегории.
   * @param {string} incomeData.allocations[].subcategoryColor - Цвет подкатегории.
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Созданный доход
   */
  async createIncome(incomeData, userId) {
    const {
      budgetId,
      title,
      expectedAmount,
      frequency = "once",
      isSpontaneous = false,
      nextDate,
      allocations,
    } = incomeData;

    // Проверяем, существует ли бюджет и является ли пользователь его участником
    const budget = await BudgetModel.findById(budgetId);
    if (!budget) {
      throw new Error("Бюджет не найден");
    }

    if (!budget.participants.includes(userId)) {
      throw new Error("У вас нет доступа к этому бюджету");
    }

    // Проверяем, что все доходы распределены
    let totalAllocated = 0;
    if (allocations) {
      allocations.forEach((allocation) => {
        totalAllocated += allocation.amount;
      });
    }

    if (totalAllocated !== expectedAmount) {
      throw new Error("Весь доход должен быть распределен на расходы или цели");
    }

    // Создаем новый доход
    const income = await IncomeModel.create({
      budgetId,
      userId,
      title,
      expectedAmount,
      frequency,
      isSpontaneous,
      nextDate,
      allocations: [],
    });

    // Создаем распределения для дохода
    if (allocations && allocations.length > 0) {
      const allocationDocs = await Promise.all(
        allocations.map((allocation) =>
          AllocationModel.create({
            incomeId: income._id,
            type: allocation.type,
            targetId: allocation.targetId,
            amount: allocation.amount,
          })
        )
      );

      // Добавляем ссылки на распределения в доход
      await IncomeModel.findByIdAndUpdate(
        income._id,
        {
          $push: {
            allocations: { $each: allocationDocs.map((doc) => doc._id) },
          },
        },
        { new: true }
      );
    }

    // Получаем обновленный доход с распределениями
    const updatedIncome = await IncomeModel.findById(income._id).populate({
      path: "allocations",
      model: "Allocation",
    });

    return updatedIncome;
  }

  /**
   * Возвращает список доходов для бюджета
   * @param {string} budgetId - ID бюджета
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array>} - Список доходов
   */
  async getBudgetIncomes(budgetId, userId) {
    // Проверяем, имеет ли пользователь доступ к бюджету
    const budget = await BudgetModel.findById(budgetId);
    if (!budget) {
      throw new Error("Бюджет не найден");
    }

    if (!budget.participants.includes(userId)) {
      throw new Error("У вас нет доступа к этому бюджету");
    }

    // Получаем доходы для бюджета
    const incomes = await IncomeModel.find({ budgetId })
      .populate({
        path: "allocations",
        model: "Allocation",
      })
      .sort({ nextDate: 1 });

    return incomes;
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
import { BudgetModel } from "../models/budget.js";
import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { IncomeHistoryModel } from "../models/incomeHistory.js";
import { TypeNotification } from "../models/notification.js";
import UserModel from "../models/user.js";
import { notificationService } from "./notification-service.js";
import { Types } from "mongoose";
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isValid,
  parseISO,
  startOfMonth,
  isBefore,
  differenceInMonths,
  startOfDay,
  isAfter,
} from "date-fns";
import goalService from "./goal-service.js";
import { expenseService } from "./expense-service.js";
import { cloneDeep } from "lodash-es";
import { incomeService } from "./income-service.js";

/**
 * @typedef {Object} Budget
 * @property {Types.ObjectId} _id - Уникальный идентификатор бюджета
 * @property {string} name - Название бюджета
 * @property {number} sum - Текущая сумма бюджета
 * @property {Types.ObjectId} owner - ID пользователя-владельца
 * @property {Array<{ user: Types.ObjectId }>} members - Участники бюджета
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата последнего обновления
 */

/**
 * Сервис для работы с бюджетами
 */
class BudgetService {
  async getAvailableSpendingLimits(userId, date, excludeId = null) {
    const { budget, allExpenses, incomes } =
      await this.getBudgetDetails(userId);

    const response = budgetServiceUtils.getAvailableSpendingLimits(
      budget,
      allExpenses,
      incomes,
      { date: new Date(date), excludeId },
    );

    return {
      limits: response,
      type: "success",
    };
  }

  /**
   * Создает новый бюджет
   * @param {string} name - Название бюджета
   * @param {string} userId - ID пользователя-создателя
   * @returns {Promise<Object>} - Созданный бюджет
   */
  async createBudget(name, userId, startSum, memberId) {
    const lastBudget = await BudgetModel.findOne({
      $or: [{ owner: userId }, { "members._id": userId }],
    });

    if (lastBudget) {
      throw new Error("Вы уже состоите в бюджете!");
    }

    const budget = await BudgetModel.create({
      name,
      sum: startSum ?? 0,
      owner: userId,
      members: [],
      createdAt: new Date(),
    });

    // Обновляем пользователя, добавляя новый бюджет
    await UserModel.findByIdAndUpdate(userId, {
      $push: { budgets: budget._id },
    });

    if (memberId) {
      await notificationService.create(
        userId,
        memberId,
        TypeNotification.invitation,
        "Вас приглашают в бюджет",
      );
    }

    return {
      budget,
      message: "Приглашение отправлено пользователю",
      type: "success",
    };
  }
  /**
   * Приглашает пользователя в бюджет
   * @param {string} budgetId - ID бюджета
   * @param {string} inviterId - ID приглашающего
   * @param {string} inviteeEmail - Email приглашаемого
   * @returns {Promise<Object>} - Обновленный бюджет
   */
  async inviteUser(budgetId, inviterId, inviteeEmail) {
    // Проверяем, является ли приглашающий участником бюджета
    const budget = await BudgetModel.findById(budgetId);
    if (!budget) {
      throw new Error("Бюджет не найден");
    }

    if (!budget.participants.includes(inviterId)) {
      throw new Error("У вас нет прав приглашать пользователей в этот бюджет");
    }

    // Находим приглашаемого пользователя
    const invitee = await UserModel.findOne({ email: inviteeEmail });
    if (!invitee) {
      throw new Error("Пользователь не найден");
    }

    // Проверяем, не является ли пользователь уже участником
    if (budget.participants.includes(invitee._id)) {
      throw new Error("Пользователь уже является участником бюджета");
    }

    // Проверяем, не приглашен ли пользователь уже
    if (budget.invited.includes(invitee._id)) {
      throw new Error("Пользователь уже приглашен в бюджет");
    }

    // Добавляем пользователя в список приглашенных
    const updatedBudget = await BudgetModel.findByIdAndUpdate(
      budgetId,
      { $push: { invited: invitee._id } },
      { new: true },
    );

    // Создаем уведомление о приглашении
    await notificationService.createNotification(
      invitee._id,
      "invitation",
      budgetId,
      `Вас пригласили присоединиться к бюджету "${budget.name}"`,
    );

    return { updatedBudget, type: "success" };
  }

  /**
   * Принимает приглашение в бюджет
   * @param {string} ownerId - ID пользователя который дал приглашение
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Обновленный бюджет
   */
  async acceptInvitation(ownerId, userId) {
    const budget = await BudgetModel.findOne({ owner: ownerId });

    if (!budget) {
      throw new Error("Бюджет не найден");
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw new Error("Приглашенный пользователь не найден");
    }

    // Удаляем пользователя из списка приглашенных и добавляем в список участников
    budget.members.push(user._id);

    await budget.save();

    user.budgets.push(budget._id);

    await user.save();

    return { budget, user, type: "success" };
  }

  /**
   * Получает бюджет пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<{budget: Budget, type: string}>} - бюджет
   */
  async getUserBudget(userId) {
    const budget = await BudgetModel.findOne({
      $or: [{ owner: userId }, { "members._id": userId }],
    });

    return { budget: budget || null, type: "success" };
  }

  /**
   * Получает список приглашений пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array>} - Список приглашений
   */
  async getUserInvitations(userId) {
    // Находим бюджеты, куда пользователь приглашен
    const invitations = await BudgetModel.find({ invited: userId }).populate(
      "owner",
      "email name",
    );
    return { invitations, type: "success" };
  }

  /**
   * Получает детальную информацию о бюджете
   * @param {string} userId - ID пользователя, запрашивающего информацию
   * @returns {Promise<{allExpenses,incomes,budget,type,goals}>} - Детальная информация о бюджете
   */
  async getBudgetDetails(userId) {
    const expenses =
      (await expenseService.getBudgetExpenses(userId))?.expenses || [];
    const budget = (await this.getUserBudget(userId))?.budget;
    const incomes =
      (await incomeService.getBudgetIncomes(userId)).incomes || [];
    const goals = ((await goalService.getActiveGoals(userId)).goals || []).map(
      (goal) => {
        return { ...goal._doc, date: goal.dayOfMoneyWriteOff };
      },
    );

    return {
      allExpenses: [...expenses, ...goals],
      incomes,
      budget,
      goals,
      type: "success",
    };
  }

  /**
   * Удаляет пользователя из бюджета
   * @param {string} budgetId - ID бюджета
   * @param {string} userId - ID пользователя, которого нужно удалить
   * @param {string} requesterId - ID пользователя, инициирующего удаление
   * @returns {Promise<Object>} - Обновленный бюджет
   */
  async removeParticipant(budgetId, userId, requesterId) {
    const budget = await BudgetModel.findById(budgetId);
    if (!budget) {
      throw new Error("Бюджет не найден");
    }

    // Проверяем, является ли инициатор владельцем бюджета
    if (budget.owner.toString() !== requesterId && userId !== requesterId) {
      throw new Error("У вас нет прав на удаление участников из этого бюджета");
    }

    // Если удаляется владелец, нужно передать права другому участнику
    if (userId === budget.owner.toString() && budget.participants.length > 1) {
      // Находим нового владельца - первого участника, кроме текущего владельца
      const newOwner = budget.participants.find((p) => p.toString() !== userId);

      // Обновляем владельца бюджета
      budget.owner = newOwner;
    } else if (
      userId === budget.owner.toString() &&
      budget.participants.length === 1
    ) {
      // Если владелец единственный участник, удаляем бюджет
      await BudgetModel.findByIdAndDelete(budgetId);

      // Удаляем бюджет из списка бюджетов пользователя
      await UserModel.findByIdAndUpdate(userId, {
        $pull: { budgets: budgetId },
      });

      return { message: "Бюджет успешно удален", type: "success" };
    }

    // Удаляем пользователя из списка участников
    const updatedBudget = await BudgetModel.findByIdAndUpdate(
      budgetId,
      {
        $pull: { participants: userId },
      },
      { new: true },
    );

    // Удаляем бюджет из списка бюджетов пользователя
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { budgets: budgetId },
    });

    return { updatedBudget, type: "success" };
  }

  async history({ userId, after, limit, type = "all" }) {
    const budget = await BudgetModel.findOne({
      $or: [{ owner: userId }, { "members._id": userId }],
    });

    if (!budget) {
      throw new Error("Бюджет не найден");
    }

    const budgetId = budget._id.toString();
    const dateFilter = after ? { date: { $lt: new Date(after) } } : {};
    const calcLimit = type === "all" ? Math.floor(limit / 2) : limit;

    let incomes = [];
    let expenses = [];
    let hasMore = false;

    if (type === "all" || type === "income") {
      incomes = await IncomeHistoryModel.find({ budgetId, ...dateFilter })
        .sort({ date: -1 })
        .limit(calcLimit + 1); // загружаем на 1 больше
      if (incomes.length > calcLimit) {
        hasMore = true;
        incomes = incomes.slice(0, calcLimit);
      }
    }

    if (type === "all" || type === "expense") {
      expenses = await ExpenseHistoryModel.find({ budgetId, ...dateFilter })
        .sort({ date: -1 })
        .limit(calcLimit + 1);
      if (expenses.length > calcLimit) {
        hasMore = true;
        expenses = expenses.slice(0, calcLimit);
      }
    }

    const combined = [...incomes, ...expenses].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );

    return {
      items: combined,
      hasMore,
      nextCursor: combined.at(-1)?.date ?? null,
      type: "success",
    };
  }
}

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];

class BudgetServiceUtils {
  isUserBudget(budget, userId) {
    if (!budget) {
      throw new Error("Бюджет не найден");
    }

    const itHeBudget =
      budget.owner.toString() === userId ||
      !!budget.members.find((member) => member._id.toString() === userId);

    if (!itHeBudget) {
      throw new Error("У вас нет доступа к этому бюджету");
    }

    return true;
  }

  /**
   * @param {Object} budget - объект бюджета { sum: number }
   * @param {Array} incomes - массив доходов с полями: amount, frequency, date
   * @param {Array} expenses - массив расходов с полями: amount, frequency, date
   * @param {number} years - на сколько лет вперед моделируем
   * @returns {boolean} - true если бюджет не уходит в минус, иначе false
   */
  simulateBudgetHealth(budget, incomes, expenses, years = 5) {
    const today = startOfDay(new Date());
    const end = addYears(today, years);
    // const calcExpenses = excludeId
    //   ? expenses.filter((element) => element._id?.toString() !== excludeId)
    //   : expenses;

    const events = [];

    const collect = (list, sign = 1) => {
      for (const item of list) {
        let currentDate = startOfDay(new Date(item.date));
        if (isBefore(currentDate, today)) currentDate = today;

        while (!isAfter(currentDate, end)) {
          events.push({
            date: currentDate.getTime(),
            amount: item.amount * sign,
          });

          if (item.frequency === "once") break;

          currentDate = this.getNextDateFromFrequency(
            currentDate,
            item.frequency,
          );
        }
      }
    };

    collect(incomes, +1);
    collect(expenses, -1);

    // Сортируем события по дате
    events.sort((a, b) => a.date - b.date);

    let sum = budget.sum;

    for (const event of events) {
      sum += event.amount;
      if (sum < 0) return false;
    }

    return true;
  }

  /**
   * Возвращает следующую дату на основе частоты.
   *
   * @param {Date | string} startDate - Начальная дата (объект Date или строка ISO)
   * @param {"once" | "daily" | "weekly" | "monthly" | "yearly"} frequency - Частота
   * @returns {Date | null} - Следующая дата или null, если once или невалидная дата
   */
  getNextDateFromFrequency(startDate, frequency) {
    const date =
      typeof startDate === "string" ? parseISO(startDate) : startDate;

    if (!isValid(date)) return null;

    switch (frequency) {
      case "daily":
        return addDays(date, 1);
      case "weekly":
        return addWeeks(date, 1);
      case "monthly":
        return addMonths(date, 1);
      case "yearly":
        return addYears(date, 1);
      case "once":
      default:
        return null;
    }
  }

  getAvailableSpendingLimits(
    budget,
    expenses,
    incomes,
    options = { date: new Date(), excludeId: null },
  ) {
    const result = {};
    const MAX_CEIL = 1_000_000;
    const { excludeId, date } = options;

    for (const frequency of FREQUENCIES) {
      let low = 0;
      let high = MAX_CEIL;
      let best = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);

        // Виртуальный расход начинается с переданной даты
        const simulatedExpenses = cloneDeep(
          excludeId
            ? expenses.filter((e) => e._id?.toString() !== excludeId)
            : expenses,
        ).concat([
          {
            amount: mid,
            frequency,
            date, // используется единая дата
          },
        ]);

        const isHealthy = this.simulateBudgetHealth(
          budget,
          incomes.filter((i) => i.frequency !== "once"),
          simulatedExpenses,
        );

        if (isHealthy) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      result[frequency] = best;
    }

    return result;
  }

  formatNumberWithSpaces(num, startStr) {
    const resString = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    return startStr ? `${startStr} ${resString}` : resString;
  }
}

export const budgetService = new BudgetService();
export const budgetServiceUtils = new BudgetServiceUtils();

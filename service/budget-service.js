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
  isBefore,
  startOfDay,
  isAfter,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  compareAsc,
  isEqual,
} from "date-fns";
import goalService from "./goal-service.js";
import { expenseService } from "./expense-service.js";
import {
  sumPlannedIncomes,
  sumPlannedExpenses,
  sumPlannedGoals,
} from "./bars-plan.util.js";
import { cloneDeep } from "lodash-es";
import { incomeService } from "./income-service.js";
import { Frequencies } from "../models/expense.js";

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
  async getUsersInBudget(userId) {
    const budget = (await this.getUserBudget(user)).budget;

    const user = await UserModel.findById(userId);

    const users = [{ nickname: user.nickname, name: user.name }];

    for (const id of budget.members) {
      const findedUser = await UserModel.findById(id.user._id.toString());

      users.push(findedUser);
    }

    return users;
  }

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
  async createBudget(name, userId, startSum, memberNickname) {
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

    if (memberNickname) {
      const member = await UserModel.findOne({ nickname: memberNickname });

      if (!member) {
        throw new Error("Пользователь не найден");
      }

      await notificationService.create(
        userId,
        member._id?.toString(),
        TypeNotification.invitation,
        "Вас приглашают в бюджет",
      );

      return {
        budget,
        message: "Приглашение отправлено пользователю",
        type: "success",
      };
    }

    return {
      budget,
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
      return { type: "success", items: [], hasMore: false, nextCursor: null };
    }

    const budgetId = budget._id.toString();
    const dateFilter = after ? { date: { $lt: new Date(after) } } : {};
    let incomes = [];
    let expenses = [];
    let hasMore = false;

    if (type === "all") {
      incomes = await IncomeHistoryModel.find({ budgetId, ...dateFilter })
        .sort({ date: -1 })
        .limit(limit + 1);
      expenses = await ExpenseHistoryModel.find({ budgetId, ...dateFilter })
        .sort({ date: -1 })
        .limit(limit + 1);

      let combined = [...incomes, ...expenses].sort(
        (a, b) => b.date.getTime() - a.date.getTime(),
      );

      if (combined.length > limit) {
        hasMore = true;
        combined = combined.slice(0, limit);
      }

      return {
        items: combined,
        hasMore,
        nextCursor: combined.at(-1)?.date ?? null,
        type: "success",
      };
    }

    if (type === "income") {
      incomes = await IncomeHistoryModel.find({ budgetId, ...dateFilter })
        .sort({ date: -1 })
        .limit(limit + 1);
      if (incomes.length > limit) {
        hasMore = true;
        incomes = incomes.slice(0, limit);
      }
      return {
        items: incomes,
        hasMore,
        nextCursor: incomes.at(-1)?.date ?? null,
        type: "success",
      };
    }

    if (type === "expense") {
      expenses = await ExpenseHistoryModel.find({ budgetId, ...dateFilter })
        .sort({ date: -1 })
        .limit(limit + 1);
      if (expenses.length > limit) {
        hasMore = true;
        expenses = expenses.slice(0, limit);
      }
      return {
        items: expenses,
        hasMore,
        nextCursor: expenses.at(-1)?.date ?? null,
        type: "success",
      };
    }
  }
  /**
   * @param {Object} input
   * @param {string} input.userId - пользователь
   * @param {Array} input.ranges - массив диапазонов в формате:
   *   { month, year } | { monthFrom, monthTo, year } |
   *   { year } | { yearFrom, yearTo }
   * @param {boolean} [input.withPlans=false] - добавлять ли сведения по текущим планам
   *
   * @returns {Promise<Object{data: Array<{label:string, income:number, expense:number, net:number, [plansIncome]?:number, [plansExpense]?:number, [plansNet]?:number}>, type: "success"}>}
   */
  async getBarsByUser(input) {
    const { ranges, userId, withPlans = false } = input;

    const budget = (await this.getUserBudget(userId)).budget;

    if (!budget) throw new Error("Бюджет не найден");

    const budgetObjId = budget._id;

    const sumByRange = async (
      Model,
      from,
      to,
      match = {},
      dateField = "date",
    ) => {
      const matchStage = { budgetId: budgetObjId, ...match };
      matchStage[dateField] = { $gte: from, $lte: to };

      const res = await Model.aggregate([
        { $match: matchStage },
        { $group: { _id: null, total: { $sum: "$amount" } } },
        { $project: { _id: 0, total: { $ifNull: ["$total", 0] } } },
      ]);

      return res[0]?.total ?? 0;
    };

    const out = [];

    for (const r of ranges) {
      let from, to, label;

      // --- разные форматы ---
      if (r.month && r.year) {
        // один месяц
        from = startOfMonth(new Date(r.year, r.month - 1, 1));
        to = endOfMonth(from);
        label = format(from, "LLLL yyyy");
      } else if (r.monthFrom && r.monthTo && r.year) {
        // диапазон месяцев в году
        from = startOfMonth(new Date(r.year, r.monthFrom - 1, 1));
        to = endOfMonth(new Date(r.year, r.monthTo - 1, 1));
        label = `${format(from, "LLL")}–${format(to, "LLL yyyy")}`;
      } else if (r.year) {
        // один год
        from = startOfYear(new Date(r.year, 0, 1));
        to = endOfYear(from);
        label = `${r.year}`;
      } else if (r.yearFrom && r.yearTo) {
        // диапазон лет
        from = startOfYear(new Date(r.yearFrom, 0, 1));
        to = endOfYear(new Date(r.yearTo, 0, 1));
        label = `${r.yearFrom}–${r.yearTo}`;
      } else {
        throw new Error("Invalid range format: " + JSON.stringify(r));
      }

      const [income, expense] = await Promise.all([
        sumByRange(IncomeHistoryModel, from, to),
        sumByRange(ExpenseHistoryModel, from, to),
      ]);

      const item = {
        label,
        income,
        expense,
        net: income - expense,
      };

      if (withPlans) {
        const [plansIncome, plannedExpenses, plannedGoals] = await Promise.all([
          sumPlannedIncomes(from, to, budgetObjId),
          sumPlannedExpenses(from, to, budgetObjId),
          sumPlannedGoals(from, to, budgetObjId),
        ]);

        const plansExpense = plannedExpenses + plannedGoals;

        item.plansIncome = plansIncome;
        item.plansExpense = plansExpense;
        item.plansNet = plansIncome - plansExpense;
      }

      out.push(item);
    }

    return { data: out, type: "success" };
  }
}

const DAYS_PER_YEAR = 365.2425;
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

const FREQ_TO_DAY_FACTOR = {
  daily: 1,
  every_2_days: 2,
  every_3_days: 3,
  every_4_days: 4,
  every_5_days: 5,
  every_6_days: 6,
  weekly: 7,
  every_2_weeks: 14,
  every_3_weeks: 21,
  every_4_weeks: 28,
  monthly: DAYS_PER_MONTH,
  every_2_months: 2 * DAYS_PER_MONTH,
  every_3_months: 3 * DAYS_PER_MONTH,
  every_4_months: 4 * DAYS_PER_MONTH,
  every_5_months: 5 * DAYS_PER_MONTH,
  every_6_months: 6 * DAYS_PER_MONTH,
  yearly: DAYS_PER_YEAR,
  once: 0,
};

// 1) старт не «сегодня», а со следующего цикла
function ceilToNextOccurrence(date, frequency) {
  switch (frequency) {
    case "daily":
      return addDays(date, 1);
    case "every_2_days":
      return addDays(date, 2);
    case "every_3_days":
      return addDays(date, 3);
    case "every_4_days":
      return addDays(date, 4);
    case "every_5_days":
      return addDays(date, 5);
    case "every_6_days":
      return addDays(date, 6);
    case "weekly":
      return addWeeks(date, 1);
    case "every_2_weeks":
      return addWeeks(date, 2);
    case "every_3_weeks":
      return addWeeks(date, 3);
    case "every_4_weeks":
      return addWeeks(date, 4);
    case "monthly":
      return addMonths(date, 1);
    case "every_2_months":
      return addMonths(date, 2);
    case "every_3_months":
      return addMonths(date, 3);
    case "every_4_months":
      return addMonths(date, 4);
    case "every_5_months":
      return addMonths(date, 5);
    case "every_6_months":
      return addMonths(date, 6);
    case "yearly":
      return addYears(date, 1);
    case "once":
      return date; // одноразовый оставим как есть
    default:
      return addMonths(date, 1);
  }
}

// 2) несколько фаз внутри периода (берём 3 точки)
function getPhaseProbes(baseStart, frequency) {
  if (frequency === "once") return [baseStart];

  const periodDays = Math.max(
    1,
    Math.floor(FREQ_TO_DAY_FACTOR[frequency] ?? DAYS_PER_MONTH),
  );
  const step = Math.max(1, Math.floor(periodDays / 3)); // 3 «пробы»

  return [0, 1, 2].map((i) => addDays(baseStart, i * step));
}

const toDays = (freq) => FREQ_TO_DAY_FACTOR[freq] ?? DAYS_PER_MONTH;

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

  isBudgetHealthy(sum, incomes, expenses, years = 5) {
    const startSum = sum;

    // --- NEW: steady-state guard (регулярные доходы - регулярные расходы >= 0)
    const dailyIn = incomes.reduce((acc, i) => {
      if (i.frequency === "once") return acc;
      const d = toDays(i.frequency);
      return acc + (Number(i.amount) || 0) / d;
    }, 0);

    const dailyOut = expenses.reduce((acc, e) => {
      if (e.frequency === "once") return acc;
      const d = toDays(e.frequency);
      return acc + (Number(e.amount) || 0) / d;
    }, 0);

    if (dailyIn - dailyOut < 0) return false; // тренд убыточный → не здорово

    // --- дальше твой текущий код симуляции событий ---
    const toDate = (d) => (d instanceof Date ? d : new Date(d));
    const start = startOfDay(new Date());
    const end = addYears(start, years);

    const normalizeEvent = (ev, isIncome) => {
      const freq = ev.frequency;
      let nextDate = toDate(ev.date);
      if (isBefore(nextDate, start)) {
        if (freq === "once") {
          nextDate = null;
        } else {
          let guard = 0;
          while (nextDate && isBefore(nextDate, start)) {
            const nd = this.getNextDateFromFrequency(nextDate, freq);
            if (!nd || !isAfter(nd, nextDate)) {
              nextDate = new Date(nextDate.getTime() + 24 * 60 * 60 * 1000);
            } else {
              nextDate = nd;
            }
            if (++guard > 10000) break;
          }
        }
      }
      if (nextDate && isAfter(nextDate, end)) nextDate = null;
      return {
        nextDate,
        amount: Number(ev.amount) || 0,
        frequency: ev.frequency,
        isIncome: !!isIncome,
      };
    };

    const incomeEvents = incomes.map((ev) => normalizeEvent(ev, true));
    const expenseEvents = expenses.map((ev) => normalizeEvent(ev, false));
    const all = incomeEvents.concat(expenseEvents);

    if (all.every((e) => e.nextDate == null)) {
      return sum >= 0 && sum >= startSum;
    }

    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    while (true) {
      let nextTick = null;
      for (const ev of all) {
        if (ev.nextDate && (!nextTick || isBefore(ev.nextDate, nextTick))) {
          nextTick = ev.nextDate;
        }
      }
      if (!nextTick || isAfter(nextTick, end)) break;

      for (const ev of all) {
        if (ev.nextDate && ev.isIncome && sameDay(ev.nextDate, nextTick)) {
          sum += ev.amount;
        }
      }
      for (const ev of all) {
        if (ev.nextDate && !ev.isIncome && sameDay(ev.nextDate, nextTick)) {
          sum -= ev.amount;
          if (sum < 0) return false;
        }
      }
      for (const ev of all) {
        if (ev.nextDate && sameDay(ev.nextDate, nextTick)) {
          if (ev.frequency === "once") {
            ev.nextDate = null;
          } else {
            let nd = this.getNextDateFromFrequency(ev.nextDate, ev.frequency);
            if (!nd || !isAfter(nd, ev.nextDate)) {
              nd = new Date(ev.nextDate.getTime() + 24 * 60 * 60 * 1000);
            }
            ev.nextDate = isAfter(nd, end) ? null : nd;
          }
        }
      }
    }

    return sum >= 0 && sum >= startSum;
  }

  /**
   * @param {Object} budget - объект бюджета { sum: number }
   * @param {Array} incomes - массив доходов с полями: amount, frequency, date
   * @param {Array} expenses - массив расходов с полями: amount, frequency, date
   * @param {number} years - на сколько лет вперед моделируем
   * @returns {boolean} - true если бюджет не уходит в минус, иначе false
   */
  // simulateBudgetHealth(budget, incomes, expenses, years = 5) {
  //   const today = startOfDay(new Date());
  //   const end = addYears(today, years);
  //   const events = [];

  //   const collect = (list, sign = 1) => {
  //     for (const item of list) {
  //       let currentDate = startOfDay(new Date(item.date));
  //       if (isBefore(currentDate, today)) currentDate = today;

  //       while (!isAfter(currentDate, end)) {
  //         events.push({
  //           date: currentDate.getTime(),
  //           amount: item.amount * sign,
  //         });

  //         if (item.frequency === "once") break;

  //         currentDate = this.getNextDateFromFrequency(
  //           currentDate,
  //           item.frequency,
  //         );
  //       }
  //     }
  //   };

  //   collect(incomes, +1);
  //   collect(expenses, -1);

  //   // Сортируем события по дате
  //   events.sort((a, b) => a.date - b.date);

  //   let sum = budget.sum;

  //   for (const event of events) {
  //     sum += event.amount;
  //     if (sum < 0) return false;
  //   }

  //   return true;
  // }

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
      case "every_2_days":
        return addDays(date, 2);
      case "every_3_days":
        return addDays(date, 3);
      case "every_4_days":
        return addDays(date, 4);
      case "every_5_days":
        return addDays(date, 5);
      case "every_6_days":
        return addDays(date, 6);
      case "weekly":
        return addWeeks(date, 1);
      case "every_2_weeks":
        return addWeeks(date, 2);
      case "every_3_weeks":
        return addWeeks(date, 3);
      case "every_4_weeks":
        return addWeeks(date, 4);
      case "monthly":
        return addMonths(date, 1);
      case "every_2_months":
        return addMonths(date, 2);
      case "every_3_months":
        return addMonths(date, 3);
      case "every_4_months":
        return addMonths(date, 4);
      case "every_5_months":
        return addMonths(date, 5);
      case "every_6_months":
        return addMonths(date, 6);
      case "yearly":
        return addYears(date, 1);
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
    const resultRaw = {};
    const MAX_CEIL = 100_000_000;
    const { excludeId, date } = options;

    const filteredIncomes = incomes.filter((i) => i.frequency !== "once");
    const filteredExpenses = excludeId
      ? expenses.filter((e) => e._id?.toString() !== excludeId)
      : expenses;

    // --- NEW: считаем доступный устойчивый поток (в сутки) без новой траты
    const dailyIn = filteredIncomes.reduce(
      (acc, i) => acc + (Number(i.amount) || 0) / toDays(i.frequency),
      0,
    );
    const dailyOutNow = filteredExpenses.reduce((acc, e) => {
      if (e.frequency === "once") return acc;
      return acc + (Number(e.amount) || 0) / toDays(e.frequency);
    }, 0);

    const dailyNet = Math.max(0, dailyIn - dailyOutNow); // сколько в сутки можно добавить без деградации тренда

    // --- Потоковая крышка по всем частотам
    const flowCap = {};
    for (const f of Frequencies) {
      if (f === "once") continue;
      flowCap[f] = Math.floor(dailyNet * toDays(f));
    }
    // для "once": разумно ограничить подушкой и месячной потоковой крышкой
    flowCap.once = Math.min(
      Math.floor(dailyNet * DAYS_PER_MONTH), // эквивалент «месячного тренда»
      Math.max(0, Number(budget.sum) || 0), // и фактическая подушка
    );

    // симуляция на конкретную дату
    const simulateWithAtDate = (frequency, amount, startDate) => {
      const simulatedExpenses = filteredExpenses.concat([
        { amount, frequency, date: startDate },
      ]);
      return this.isBudgetHealthy(
        budget.sum,
        filteredIncomes,
        simulatedExpenses,
      );
    };

    // симуляция, проходящая все фазы периода
    const simulateWith = (frequency, amount) => {
      // --- NEW: ранний отсев по потоковой крышке
      const cap = flowCap[frequency] ?? MAX_CEIL;
      if (amount > cap) return false;

      const baseStart = ceilToNextOccurrence(date, frequency);
      const probes = getPhaseProbes(baseStart, frequency);
      for (const startDate of probes) {
        if (!simulateWithAtDate(frequency, amount, startDate)) return false;
      }
      return true;
    };

    const binSearch = (frequency) => {
      let low = 0;
      // --- NEW: ограничим верх бинпоиска потоковой крышей
      let high = Math.min(MAX_CEIL, flowCap[frequency] ?? MAX_CEIL);
      let best = 0;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (simulateWith(frequency, mid)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return best;
    };

    // 1) базовый дневной
    const baseDaily = binSearch("daily");

    // 2) теоретика из daily (как у тебя)
    const theoreticalFromDaily = {};
    for (const f of Frequencies) {
      if (f === "once") {
        theoreticalFromDaily[f] = Math.floor(baseDaily * DAYS_PER_MONTH);
      } else {
        theoreticalFromDaily[f] = Math.floor(baseDaily * toDays(f));
      }
    }

    // 3) бинпоиск + min со всеми крышами (daily-деривация и поток)
    const result = {};
    for (const f of Frequencies) {
      const raw = binSearch(f);
      resultRaw[f] = raw;
      const caps = [raw, theoreticalFromDaily[f]];
      if (flowCap[f] != null) caps.push(flowCap[f]);
      result[f] = Math.min(...caps);
    }

    // 4) монотонность (как было)
    const cap = (f, capVal) => {
      if (result[f] > capVal) result[f] = capVal;
    };
    cap("weekly", result.daily * 7);
    cap("every_2_weeks", result.weekly * 2);
    cap("every_3_weeks", result.weekly * 3);
    cap("every_4_weeks", result.weekly * 4);
    cap("monthly", Math.floor(result.daily * DAYS_PER_MONTH));
    cap("every_2_months", result.monthly * 2);
    cap("every_3_months", result.monthly * 3);
    cap("every_4_months", result.monthly * 4);
    cap("every_5_months", result.monthly * 5);
    cap("every_6_months", result.monthly * 6);
    cap("yearly", result.monthly * 12);

    return result;
  }

  formatNumberWithSpaces(num, startStr) {
    const resString = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    return startStr ? `${startStr} ${resString}` : resString;
  }
}

export const budgetService = new BudgetService();
export const budgetServiceUtils = new BudgetServiceUtils();

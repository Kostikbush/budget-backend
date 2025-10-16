import { BudgetModel } from "../models/budget.js";
import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { IncomeHistoryModel } from "../models/incomeHistory.js";
import { TypeNotification } from "../models/notification.js";
import UserModel from "../models/user.js";
import { notificationService } from "./notification-service.js";
import { Types } from "mongoose";
import {
  addYears,
  startOfDay,
  isAfter,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  endOfDay,
} from "date-fns";
import goalService from "./goal-service.js";
import { expenseService } from "./expense-service.js";
import {
  sumPlannedIncomes,
  sumPlannedExpenses,
  sumPlannedGoals,
} from "./bars-plan.util.js";
import { incomeService } from "./income-service.js";
import { Frequencies } from "../models/expense.js";
import { getNextDateFromFrequency, sortByDateAsc, toDays } from "../lib/date.js";

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
    const budget = (await this.getUserBudget(userId))?.budget;
    const expenses =
      (await expenseService.getBudgetExpenses(userId, budget?._id))?.expenses ||
      [];
    const incomes =
      (await incomeService.getBudgetIncomes(userId, budget?._id)).incomes || [];
    const goals = (await goalService.getActiveGoals(userId, budget?._id, true))?.goals || [];
  
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

  getEventsFromExpenseAndIncomes(incomes, expenses) {
    return (
      incomes
        .map((item) => ({ ...item, date: startOfDay(new Date(item.date)) }))
        .concat(
          expenses.map((expense) => ({
            ...expense,
            amount: -expense.amount,
            date: endOfDay(new Date(expense.date)),
          })),
        ) || []
    );
  }

  getEventsOnNYearsFuture(events, years = 5) {
    console.log("START -> getEventsOnNYearsFuture")
    const today = startOfDay(new Date());
    const end = addYears(today, years);
    const result = [];

    for (const event of events) {
      console.log("ЦИКЛ FOR getEventsOnNYearsFuture")
      // event.date - тут может быть только today или today+N дата
      // эту гарантию дает middleware который при входе в приложение
      // обновляет все расходы/доходы и таким образом использование
      // isBudgetHealthyV2 происходит только на странице на которую
      // пользователь не может попасть пока не обновиться бюджет через
      // middleware
      let currentDate = event.date;
      let count = 0;
      
      while (!isAfter(currentDate, end)) {
        count += 1;
        if(count === 20000000) {
          console.log("ОЧЕНЬ МНОГО ПОВТОРЕНИЙ", currentDate, end,);
          throw new Error("Ошибка в подсчете бюджета");
        }
        console.log("ЦИКЛ while getEventsOnNYearsFuture")
        result.push({
          date: new Date(currentDate).getTime(),
          amount: event.amount,
        });

        currentDate = getNextDateFromFrequency(
          currentDate,
          event.frequency, // тут могут быть все кроме once - это гарантировано тем
          // что невозможно создать расход с частотой once,
        );
      }
    }

    return result;
  }

  isBudgetHealthyV2(sum = 0, incomes, expenses, years = 3) {
    console.log("СТАРТ isBudgetHealthyV2")
    const perDay = (list) =>
      (list || []).reduce((acc, ev) => {
        const d = toDays(ev.frequency);
        if (!Number.isFinite(d) || d <= 0) return acc;
        const amt = Number(ev.amount) || 0;
        return acc + amt / d;
      }, 0);

    const dailyIn = perDay(incomes);
    const dailyOut = perDay(expenses);
    console.log("ПОДСЧЕТ ШАПКИ")
    if (dailyIn - dailyOut < 0) return false;
    console.log("НАЧАЛО ПРОГНОЗА -> вызов getEventsFromExpenseAndIncomes")
    const events = this.getEventsFromExpenseAndIncomes(incomes, expenses);
    console.log("НАЧАЛО ПРОГНОЗА -> вызов getEventsOnNYearsFuture")
    const allFutureEvents = this.getEventsOnNYearsFuture(events, years);
    console.log("НАЧАЛО ПРОГНОЗА -> вызов sortByDateAsc")
    const sortedEvents = sortByDateAsc(allFutureEvents);
    console.log("ПОДСЧЕТ НА N ЛЕТ")
    // симуляция движения суммы, с провалом при любом отрицательном балансе
    let currentSum = sum;
    for (const ev of sortedEvents) {

      currentSum += ev.amount;
      if (currentSum < 0) return false;
    }
    console.log("RETURN true | false")
    return currentSum >= sum;
  }

  getAvailableSpendingLimits(
    budget,
    expenses,
    incomes,
    options = { date: new Date(), excludeId: null },
  ) {
    console.log("СТАРТ ПОДСЧЕТА")
    const { excludeId, date } = options;
    const startSum = budget?.sum || 0;

    // исключаем редактируемый расход, если нужно
    const baseExpenses = excludeId
      ? (expenses || []).filter(
          (e) => e?._id?.toString?.() !== String(excludeId),
        )
      : expenses || [];

    const result = {};
    const START_HIGH = 10_000_000; // как и хотел — начинаем с 10 млн
    const startDate = new Date(date);

    for (const freq of Frequencies) {
      let low = 0;
      let high = START_HIGH;
      let best = 0;

      if (freq === "once") {
        // верхняя граница — текущая подушка (больше сразу не спишешь)
        high = Math.max(0, Math.floor(startSum));

        while (low <= high) {
          const mid = (low + high) >> 1;
          // одноразовое списание: уменьшаем sum, расходы не трогаем
          console.log("ВЫЗОВ isBudgetHealthyV2 ДЛЯ ONCE")
          const ok = this.isBudgetHealthyV2(
            startSum - mid,
            incomes || [],
            baseExpenses,
          );

          if (ok) {
            best = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        result.once = best;
        continue;
      }

      // recurring частоты
      while (low <= high) {
        
        const mid = (low + high) >> 1;

        const simulatedExpenses = baseExpenses.concat([
          { amount: mid, frequency: freq, date: startDate },
        ]);
        console.log("ВЫЗОВ isBudgetHealthyV2")
        const ok = this.isBudgetHealthyV2(
          startSum,
          incomes || [],
          simulatedExpenses,
        );

        if (ok) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      result[freq] = best;
    }
console.log("ВЕРНУЛ")
    return result;
  }
}

export const budgetService = new BudgetService();
export const budgetServiceUtils = new BudgetServiceUtils();

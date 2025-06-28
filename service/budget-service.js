import { BudgetModel } from "../models/budget.js";
import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { IncomeHistoryModel } from "../models/incomeHistory.js";
import { StatusNotification } from "../models/notification.js";
import UserModel from "../models/user.js";
import { notificationService } from "./notification-service.js";

/**
 * Сервис для работы с бюджетами
 */
class BudgetService {
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
        StatusNotification.invitation,
        "Вас приглашают в бюджет"
      );
    }

    return {
      budget,
      message: "Приглашение отправлено пользователю",
      type: "success",
    };
  }
  // Проверка на покрытие бюджета вперёд на 1-5 лет
  async checkBudgetCoverage(expenseData) {
    // Логика проверки покрытия бюджета
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
      { new: true }
    );

    // Создаем уведомление о приглашении
    await notificationService.createNotification(
      invitee._id,
      "invitation",
      budgetId,
      `Вас пригласили присоединиться к бюджету "${budget.name}"`
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
   * Получает список бюджетов пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array>} - Список бюджетов
   */
  async getUserBudget(userId) {
    const budget = await BudgetModel.findOne({
      $or: [{ owner: userId }, { "members._id": userId }],
    });

    return { budget, type: "success" };
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
      "email name"
    );
    return { invitations, type: "success" };
  }

  /**
   * Получает детальную информацию о бюджете
   * @param {string} budgetId - ID бюджета
   * @param {string} userId - ID пользователя, запрашивающего информацию
   * @returns {Promise<Object>} - Детальная информация о бюджете
   */
  async getBudgetDetails(budgetId, userId) {
    const budget = await BudgetModel.findById(budgetId)
      .populate("owner", "email name")
      .populate("participants", "email name")
      .populate("invited", "email name");

    if (!budget) {
      throw new Error("Бюджет не найден");
    }

    // Проверяем, имеет ли пользователь доступ к бюджету
    if (!budget.participants.some((p) => p._id.toString() === userId)) {
      throw new Error("У вас нет доступа к этому бюджету");
    }

    return budget;
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
      { new: true }
    );

    // Удаляем бюджет из списка бюджетов пользователя
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { budgets: budgetId },
    });

    return { updatedBudget, type: "success" };
  }

  async history({ budgetId, after, limit = 20, type = "all" }) {
    try {
      const dateFilter = after ? { date: { $lt: new Date(after) } } : {};
      const calcLimit = type === "all" ? limit / 2 : limit;

      const [incomes, expenses] = await Promise.all([
        type === "all" || type === "income"
          ? IncomeHistoryModel.find({ budgetId, ...dateFilter })
              .sort({ date: -1 })
              .limit(calcLimit)
          : Promise.resolve([]),
        type === "all" || type === "expense"
          ? ExpenseHistoryModel.find({ budgetId, ...dateFilter })
              .sort({ date: -1 })
              .limit(calcLimit)
          : Promise.resolve([]),
      ]);

      const combined = [...incomes, ...expenses].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );

      return {
        items: combined,
        hasMore: combined.length === limit,
        nextCursor: combined.at(-1)?.date ?? null,
        type: "success",
      };
    } catch (error) {
      return error;
    }
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
}

export const budgetService = new BudgetService();
export const budgetServiceUtils = new BudgetServiceUtils();
import NotificationModel, { TypeNotification } from "../models/notification.js";
import { budgetService } from "./budget-service.js";

/**
 * Сервис для работы с уведомлениями
 */
class NotificationService {
  /**
   * @param {string} ownerId - ID создающего уведомление
   * @param {string} recipientId - ID создающего уведомление
   * @param {TypeNotification} type - Тип уведомления TypeNotification
   * @param {string} message
   * @returns {Promise<Object>} - Созданный бюджет
   */
  async create(ownerId, recipientId, type, message, entityId) {
    await NotificationModel.create({
      ownerId,
      recipientId,
      type,
      message,
      createdAt: new Date(),
      isRead: false,
      entityId: entityId ?? null,
    });
  }

  async delete(entityId) {
    await NotificationModel.findOneAndDelete({ entityId });
  }

  async getUserNotifications(userId) {
    return await NotificationModel.find({ recipientId: userId });
  }

  async acceptInvite(userId) {
    const notification = await NotificationModel.findOne({
      recipientId: userId,
      type: TypeNotification.invitation,
    });

    if (!notification) {
      throw new Error("Уведомление о приглашении не найдено");
    }

    const response = await budgetService.acceptInvitation(
      notification.ownerId,
      notification.recipientId,
    );

    await NotificationModel.deleteOne({ recipientId: userId });

    return response;
  }

  async rejectInvite(userId) {
    const response = await NotificationModel.deleteOne({ recipientId: userId });

    if (!response.acknowledged) {
      throw new Error("Уведомление не найдено");
    }
  }

  getRecipeId(budget, senderId) {
    return budget.owner.toString() === senderId
      ? budget.members[0]?._id.toString()
      : budget.owner.toString();
  }
}

export const notificationService = new NotificationService();

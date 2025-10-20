import NotificationModel, { TypeNotification } from "../models/notification.js";
import { budgetService } from "./budget-service.js";
import { pushService } from "./push-service.js";

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

    void pushService.safeSendToUser(String(recipientId), {
      title:
        type === TypeNotification.newExpense
          ? "Новый расход требует согласования"
          : "Приглашение в бюджет",
      body: message,
      data: { url: "/" },
      actions: [{ action: "open", title: "Открыть" }],
    });
  }

  async sendPushNotification(recipientId, title, message) {
    void pushService.safeSendToUser(String(recipientId), {
      title: title,
      body: message,
      data: { url: "/" },
      actions: [{ action: "open", title: "Открыть" }],
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

  /**
   * const notificationSchema = new mongoose.Schema({
     ownerId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: "User",
       required: true,
     },
     recipientId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: "User",
       required: true,
     },
     type: {
       type: String,
       enum: [TypeNotification.invitation, TypeNotification.newExpense],
       required: true,
     },
     message: { type: String, required: true },
     isRead: { type: Boolean, default: false },
     createdAt: { type: Date, default: Date.now, required: true },
     entityId: { type: mongoose.Schema.Types.ObjectId },
   });
   */
  async deleteNotificationsByBudgetId(userId) {
    // удаляет все уведомления связанные с пользователем в поле ownerId или recipientId
    await NotificationModel.deleteMany({
      $or: [{ ownerId: userId }, { recipientId: userId }],
    });
  }
}
export const notificationService = new NotificationService();

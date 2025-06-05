import NotificationModel, { StatusNotification } from '../models/notification.js'
import { budgetService } from './budget-service.js';

/**
 * Сервис для работы с уведомлениями
 */
class NotificationService {
  async create(ownerId, recipientId, type, message) {
    await NotificationModel.create({
      ownerId,
      recipientId,
      type,
      message,
    });
  }

  async getUserNotifications(userId) {
    return await NotificationModel.find({ recipientId: userId })
  }

  async acceptInvite(userId) {
    const notification = await NotificationModel.findOne(
      { recipientId: userId },
      { type: StatusNotification.invitation}
    );

    if(!notification) {
      throw new Error("Уведомление о приглашении не найдено")
    }

    const response = await budgetService.acceptInvitation(notification.ownerId, notification.recipientId);

    return response;
  }

  async rejectInvite(userId) {
    const response = await NotificationModel.deleteOne({ recipientId: userId });

    if(!response.acknowledged) {
      throw new Error("Уведомление не найдено")
    }
  }
}

export const notificationService = new NotificationService();
import { notificationService } from "../service/notification-service.js";

class NotificationController {
  async getNotifications(req, res) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        return res.json({
          message: "Не передан id пользователя",
          type: "error",
        });
      }

      const notifications = await notificationService.getUserNotifications(
        userId
      );

      res.json(notifications);
    } catch (e) {
      res.json({ message: e?.message ?? "Ошибка получения уведомлений" });
    }
  }
  async acceptInvite(req, res) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        return res.json({
          message: "Не передан id пользователя",
          type: "error",
        });
      }

      const response = await notificationService.acceptInvite(userId);

      res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка при попытке принять приглашение",
        type: "error",
      });
    }
  }

  async rejectInvite(req, res) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        return res.json({
          message: "Не передан id пользователя",
          type: "error",
        });
      }

      await notificationService.rejectInvite(userId);

      res.json({ type: "success" });
    } catch (error) {
      res.json({
        message: e?.message ?? "Ошибка при попытке отменить приглашение",
      });
    }
  }
}

export default new NotificationController();

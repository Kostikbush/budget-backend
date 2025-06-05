import { notificationService } from "../service/notification-service.js";

class NotificationController {
  async getNotifications(req, res) {
    try {
      const { userId } = req.query;

      const users = await notificationService.getUserNotifications(userId);

      res.json(users);
    } catch (e) {
      res.json({ message: e?.message ?? "Ошибка получения уведомлений" });
    }
  }
  async acceptInvite(req, res) {
    try {
      const { userId } = req.query;

      const response = await notificationService.acceptInvite(userId);

      res.json(response);
    } catch (error) {
      res.json({
        message: e?.message ?? "Ошибка при попытке принять приглашение",
      });
    }
  }

  async rejectInvite(req, res) {
    try{
      const { userId } = req.query;

      await notificationService.rejectInvite(userId);

      res.json("ok")
    }catch(error) {
      res.json({
        message: e?.message ?? "Ошибка при попытке отменить приглашение",
      });
    }
  }
}

export default new NotificationController();

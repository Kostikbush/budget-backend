import { notificationService } from "../service/notification-service.js";

export const notificationMiddleware = async (req, res, next) => {
  try {
    const userId = req.query?.userId || req.body?.userId;

    let notifications = []

    if(userId) {
      notifications = await notificationService.getUserNotifications(
        userId
      ) ?? [];
    }

    const originalJson = res.json.bind(res);

    res.json = (data) => {
      // Добавляем уведомления в ответ
      const extendedData =
        typeof data === "object" && data !== null
          ? { ...data, notifications }
          : data;

      return originalJson(extendedData);
    };
  } catch (err) {
    console.log(err)
  }

  next();
};
import webpush from "web-push";
import PushSubscription from "../models/pushSubscription.js";

class PushService {
  async sendToUser(userId, payload) {
    const subs = await PushSubscription.find({ userId }).lean();

    if (!subs.length) return { sent: 0 };

    const json = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys },
            json,
          );
        } catch (e) {
          // 410/404 — подписка устарела/удалена на устройстве → чистим
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await PushSubscription.deleteOne({ endpoint: s.endpoint });
          } else {
            throw e;
          }
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return { sent };
  }

  async safeSendToUser(userId, payload) {
    try {
      return await this.sendToUser(userId, payload);
    } catch (err) {
      console.error("[Push] send error:", err);
      return { sent: 0, error: true };
    }
  }
}

export const pushService = new PushService();

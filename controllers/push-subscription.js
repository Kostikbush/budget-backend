import pushSubscription from "../models/pushSubscription.js";

export const subscribe = async (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth)
    return res.status(400).json({ error: "Bad subscription" });

  const userId = req.user?.sub;

  await pushSubscription.updateOne(
    { endpoint: sub.endpoint },
    { $set: { ...sub, userId } },
    { upsert: true },
  );

  return res.json({
    type: "success",
    message: "Вы успешно подписались на уведомления",
  });
};

export const unsubscribe = async (req, res) => {
  const { endpoint } = req.body || {};
  const userId = req.user?.sub;

  if (endpoint) await pushSubscription.deleteOne({ endpoint });
  else if (userId) await pushSubscription.deleteMany({ userId });
  return res.json({
    type: "success",
    message: "Вы успешно отписались от уведомлений",
  });
};

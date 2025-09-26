import { Schema, model } from 'mongoose';

const PushSubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // если есть авторизация
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: String,
    auth: String,
  },
  createdAt: { type: Date, default: Date.now },
});

export default model('PushSubscription', PushSubscriptionSchema);

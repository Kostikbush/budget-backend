import mongoose from "mongoose";

export const StatusNotification = {
  newExpense: "newExpense",
  invitation: "invitation",
};

const notificationSchema = new mongoose.Schema({
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
    enum: [StatusNotification.invitation, StatusNotification.newExpense],
    required: true,
  },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, required: true },
});

export default mongoose.model("Notification", notificationSchema);

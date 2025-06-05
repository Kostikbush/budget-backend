import mongoose from "mongoose";

const goalSchema = new mongoose.Schema({
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  targetAmount: Number,
  currentAmount: { type: Number, default: 0 },
  targetDate: Date,
  isReserve: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Goal", goalSchema);

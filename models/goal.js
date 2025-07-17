import mongoose from "mongoose";

const goalSchema = new mongoose.Schema({
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String, required: true },
  // сумма до достижении цели
  targetAmount: { type: Number, required: true },
  // фактическая сумма накопления
  currentAmount: { type: Number, default: 0, required: true },
  // расчетная дата накопления исходя из суммы и частоты списания денег с бюджета
  endDate: { type: Date, required: true },
  // частота списания
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly", "yearly"],
    default: "daily",
  },
  // Дата списания денег из бюджета в цель
  dayOfMoneyWriteOff: { type: Date, required: true },
  // Сумма списания
  amount: { type: Number, required: true },
  isCompleted: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const GoalModel = mongoose.model("Goal", goalSchema);

import mongoose from "mongoose";

const incomeHistorySchema = new mongoose.Schema({
  incomeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Income",
    default: null,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  budgetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Budget",
    required: true,
  },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly", "yearly"],
    default: "once",
    required: true,
  },
  title: { type: String, required: true },
});

export const IncomeHistoryModel = mongoose.model(
  "IncomeHistory",
  incomeHistorySchema,
);

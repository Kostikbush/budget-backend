import mongoose from "mongoose";

const incomeSchema = new mongoose.Schema({
  budgetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Budget",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly", "yearly"],
    default: "once",
    required: true,
  },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

export const IncomeModel = mongoose.model("Income", incomeSchema);

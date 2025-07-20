import mongoose from "mongoose";

const expenseHistorySchema = new mongoose.Schema({
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  budgetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Budget",
    required: true,
  },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  comment: { type: String },
  priority: { type: Number, min: 1, max: 3, default: 3 },
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly", "yearly"],
    default: "daily",
  },
  scope: { type: String, enum: ["personal", "shared"], default: "personal" },
  title: { type: String, required: true },
  type: { type: String, enum: ["expense", "goal"], default: "expense" },
});

export const ExpenseHistoryModel = mongoose.model(
  "ExpenseHistory",
  expenseHistorySchema
);

import mongoose from "mongoose";

const expenseHistorySchema = new mongoose.Schema({
  expenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Expense",
    required: true,
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
});

export const ExpenseHistoryModel = mongoose.model(
  "ExpenseHistory",
  expenseHistorySchema
);

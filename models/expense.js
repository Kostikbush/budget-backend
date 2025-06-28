import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String },
  amount: { type: Number },
  confirmed: { type: Boolean, default: false },
  comment: { type: String },
  priority: { type: Number, min: 1, max: 3, default: 3 },
  category: { type: String, enum: ["base", "optional"] },
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly", "yearly"],
    default: "daily",
  },
  scope: { type: String, enum: ["personal", "shared"], default: "personal" },
  startDate: Date,
  nextDate: Date,
  createdAt: { type: Date, default: Date.now },
});

export const ExpenseModel = mongoose.model("Expense", expenseSchema);

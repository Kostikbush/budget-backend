import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String, required: true },
  amount: { type: Number },
  confirmed: { type: Boolean, default: false },
  comment: { type: String },
  priority: { type: Number, min: 1, max: 3, default: 1 },
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly", "yearly"],
    default: "daily",
  },
  scope: { type: String, enum: ["personal", "shared"], default: "personal" },
  date: { type: Date },
  nextDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const ExpenseModel = mongoose.model("Expense", expenseSchema);

import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  expectedAmount: Number,
  actualAmount: Number,
  confirmed: { type: Boolean, default: false },
  comment: String,
  priority: { type: Number, min: 1, max: 5, default: 3 },
  category: { type: String, enum: ["base", "optional"] },
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly", "yearly"],
    default: "daily",
  },
  scope: { type: String, enum: ["personal", "shared"], default: "personal" },
  approvals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Approval" }],
  startDate: Date,
  nextDate: Date,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Expense", expenseSchema);

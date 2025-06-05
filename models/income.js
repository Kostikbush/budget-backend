import mongoose from "mongoose";

const incomeSchema = new mongoose.Schema({
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  expectedAmount: Number,
  actualAmount: Number,
  confirmed: { type: Boolean, default: false },
  comment: String,
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly", "yearly"],
    default: "once",
  },
  isSpontaneous: Boolean,
  nextDate: Date,
  allocations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Allocation" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Income", incomeSchema);

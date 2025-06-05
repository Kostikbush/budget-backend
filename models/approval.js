import mongoose from "mongoose";

const approvalSchema = new mongoose.Schema({
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: "Expense" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approved: { type: Boolean },
  comment: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Approval", approvalSchema);

import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema({
  incomeId: { type: mongoose.Schema.Types.ObjectId, ref: "Income" },
  type: { type: String, enum: ["expense", "goal"] },
  targetId: mongoose.Schema.Types.ObjectId,
  amount: Number,
});

module.exports = mongoose.model("Allocation", allocationSchema);

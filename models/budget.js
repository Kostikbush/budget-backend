import { Schema, model, Types } from "mongoose";

const BudgetSchema = new Schema(
  {
    name: { type: String, required: true },
    sum: { type: Number, required: true },
    owner: { type: Types.ObjectId, ref: "User", required: true },
    members: [
      {
        user: { type: Types.ObjectId, ref: "User" },
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const BudgetModel = model("Budget", BudgetSchema);

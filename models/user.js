import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: { type: String, required: true },
  password: String,
  nickname: { type: String, required: true },
  budgets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Budget" }],
});

userSchema.index(
  { nickname: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export default mongoose.model("User", userSchema);

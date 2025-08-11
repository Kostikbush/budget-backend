import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: String,
  nickname: { type: String, required: true },
  budgets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Budget" }],
});

// Хэширование перед сохранением
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Метод сравнения паролей
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.index(
  { nickname: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export default mongoose.model("User", userSchema);

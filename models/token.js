import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema(
  {
    jti: { type: String, index: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    expiresAt: { type: Date, index: true },
    revokedAt: { type: Date, default: null },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

tokenSchema.index({ userId: 1, revokedAt: 1 });

export default mongoose.model("Token", tokenSchema);

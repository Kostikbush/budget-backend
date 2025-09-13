import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import RefreshToken from "../models/token.js";

export const isProd = process.env.NODE_ENV === "production";

const sameSite = process.env.COOKIE_SAMESITE || "lax";
const secure = sameSite === "none" || process.env.NODE_ENV === "production";

export function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  });
}

export async function issueRefresh(userId, meta = {}) {
  const jti = uuid();
  const refresh = jwt.sign(
    { sub: userId.toString(), jti },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "30d" }
  );

  // вычислим expires из payload
  const { exp } = jwt.decode(refresh);
  const expiresAt = new Date(exp * 1000);

  await RefreshToken.create({
    jti,
    userId,
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  return { refresh, jti, expiresAt };
}

export async function rotateRefresh(oldJti, userId, meta = {}) {
  // помечаем старый токен как отозванный (idempotent)
  await RefreshToken.updateOne(
    { jti: oldJti, userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  // выдаем новый
  return await issueRefresh(userId, meta);
}

export async function isRefreshActive(jti, userId) {
  const doc = await RefreshToken.findOne({ jti, userId });
  return !!doc && !doc.revokedAt && doc.expiresAt > new Date();
}

export async function revokeAllUserRefreshTokens(userId) {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export function setAccessCookie(res, token) {
  res.cookie("at", token, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 1000 * 60 * 15,
  });
}

export function setRefreshCookie(res, token) {
  res.cookie("rt", token, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30 * 12, // 30d
  });
}

export function clearAuthCookies(res) {
  res.clearCookie("at", { path: "/" });
  res.clearCookie("rt", { path: "/" }); 
}
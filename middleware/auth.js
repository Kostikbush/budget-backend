import jwt from "jsonwebtoken";
import {
  clearAuthCookies,
  rotateRefresh,
  setAccessCookie,
  setRefreshCookie,
  signAccess,
  isRefreshActive,
  revokeAllUserRefreshTokens,
} from "../lib/token.js";
import { randomBytes } from "node:crypto";
import { ALLOWED } from "../index.js";

const CSRF_SAMESITE = process.env.CSRF_SAMESITE || "none"; // для кросс-сайта нужно "none"

function getExpSec(token) {
  const d = jwt.decode(token);
  return d && typeof d.exp === "number" ? d.exp : null;
}
const ROTATE_BEFORE_SEC = Number(
  process.env.REFRESH_TOKEN_EXPIRY || 30 * 24 * 60 * 60,
);

export const authMiddleware = async (req, res, next) => {
  if (req.path.startsWith("/api/auth/")) return next();

  try {
    const at = req.cookies?.at;
    if (at) {
      try {
        const decoded = jwt.verify(at, process.env.JWT_ACCESS_SECRET);
        req.user = decoded;
        return next();
      } catch (e) {
        if (e.name !== "TokenExpiredError") {
          clearAuthCookies(res);
          return res
            .status(401)
            .json({ message: "Invalid access token", type: "error" });
        }
        // если истёк — попробуем рефреш ниже
      }
    }
    // нет access или он протух — пробуем refresh
    const rt = req.cookies?.rt;
    console.log("Refresh Token:", rt, req.cookies);
    if (!rt) {
      console.log("AUTH_ERROR:");
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ message: "Нет данных авторизации", type: "error" });
    }

    const r = jwt.verify(rt, process.env.JWT_REFRESH_SECRET); // {sub, jti, exp}
    const ok = await isRefreshActive(r.jti, r.sub);
    console.log("New Refresh Token is Active:", ok);
    if (!ok) {
      clearAuthCookies(res);
      await revokeAllUserRefreshTokens(r.sub);

      return res
        .status(401)
        .json({ message: "Ошибка авторизации", type: "error" });
    }

    // Ротация refresh + выпуск нового access до ответа
    const payload = { sub: r.sub };
    const access = signAccess(payload);
    setAccessCookie(res, access);

    const exp = getExpSec(rt);
    const now = Math.floor(Date.now() / 1000);
    const shouldRotate = exp ? exp - now < ROTATE_BEFORE_SEC : false;

    if (shouldRotate) {
      const meta = { userAgent: req.get("user-agent"), ip: req.ip };
      const { refresh: newRt } = await rotateRefresh(r.jti, r.sub, meta);
      setRefreshCookie(res, newRt);
    }

    req.user = payload;
    return next();
  } catch (err) {
    clearAuthCookies(res);
    await revokeAllUserRefreshTokens(r.sub);
    console.error("Auth error:", err);
    return res
      .status(401)
      .json({ message: "Ошибка авторизации", type: "error" });
  }
};

export function setCsrfCookie(res) {
  const token = randomBytes(24).toString("base64url");
  res.cookie("csrf", token, {
    httpOnly: false,
    secure: true, // <— ВАЖНО
    sameSite: CSRF_SAMESITE, // "none" или "lax"
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  return token;
}

export function csrfGuard(req, res, next) {
  if (req.path.startsWith("/api/auth/")) return next();

  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("Origin");

  if (!ALLOWED.has(origin)) {
    return res
      .status(403)
      .json({ message: "Не известный Origin", type: "error" });
  }

  next();
}

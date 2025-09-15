import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/user.js";
import slugify from "@sindresorhus/slugify";
import genUsername from "unique-username-generator";
import {
  clearAuthCookies,
  issueRefresh,
  revokeAllUserRefreshTokens,
  rotateRefresh,
  setRefreshCookie,
  signAccess,
  isRefreshActive,
  setAccessCookie,
} from "../lib/token.js";

function nicify(name) {
  // аккуратный базовый префикс из имени (опционально)
  return name ? slugify(name, { decamelize: false }) : undefined;
}

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const exists = await User.findOne({ email });

    if (exists) {
      return res.json({
        message: "Пользователь уже существует",
        type: "error",
      });
    }

    let candidate =
      genUsername.generateFromEmail(email, {
        separator: "-",
        maxLength: 20,
        randomDigits: 2, // добавит 2 цифры на случай коллизий
      }) || genUsername.generateUsername("", 2, 12, "-"); // fallback

    // необязательный префикс из имени
    const pref = nicify(name);
    if (pref) {
      candidate = `${pref}-${candidate}`.toLowerCase();
    }

    // 2) проверка уникальности
    let existsNickName = await User.exists({
      nickname: candidate.toLowerCase(),
    });

    let tries = 0;

    while (existsNickName && tries < 5) {
      // добьём ещё цифры
      candidate = genUsername.generateUsername(candidate, 0, 24, "-");
      existsNickName = await User.exists({
        nickname: candidate.toLowerCase(),
      });
      tries++;
    }

    const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
    const salt = await bcrypt.genSalt(rounds);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email,
      password: passwordHash,
      name,
      nickname: candidate,
    });

    const payload = { sub: user._id.toString(), role: user.role };
    const access = signAccess(payload);

    const meta = { userAgent: req.get("user-agent"), ip: req.ip };
    const { refresh } = await issueRefresh(user._id, meta);
    setRefreshCookie(res, refresh);

    const { password: _p, ...publicUser } = user.toObject();

    res.json({ access, user: publicUser, type: "success" });
  } catch (err) {
    res.json({ message: "Ошибка регистрации", type: "error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        message: "Неверный email или пароль",
        type: "error",
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Неверные email или пароль" });
    }

    const payload = { sub: user._id.toString(), role: user.role };
    const access = signAccess(payload);

    setAccessCookie(res, access);

    const meta = { userAgent: req.get("user-agent"), ip: req.ip };
    const { refresh } = await issueRefresh(user._id, meta);
    setRefreshCookie(res, refresh);

    const { password: _p, ...publicUser } = user.toObject();
    console.log("ЛОГ ЧТОБ УВИДЕТЬ ЧТО ПРОИСХОДИТ С ОТВЕТОМ", { res });
    return res.json({ ...publicUser, type: "success" });
  } catch (err) {
    console.log("Ошибка входа", err);
    res.json({ message: "Ошибка входа", type: "error" });
  }
};

export const refresh = async (req, res) => {
  const token = req.cookies?.rt;
  if (!token) {
    return res.status(401).json({ message: "Нет refresh токена" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET); // { sub, jti, exp }
    const userId = decoded.sub;
    const jti = decoded.jti;

    const active = await isRefreshActive(jti, userId);
    if (!active) {
      await revokeAllUserRefreshTokens(userId);
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ message: "Refresh недействителен, выполните вход заново" });
    }

    const payload = { sub: userId };
    const access = signAccess(payload);

    const meta = { userAgent: req.get("user-agent"), ip: req.ip };
    const { refresh: newRefresh } = await rotateRefresh(jti, userId, meta);
    setRefreshCookie(res, newRefresh);

    // НЕ нужно ставить Authorization в ответе
    return res.json({ access, type: "success" });
  } catch (e) {
    clearAuthCookies(res);
    return res
      .status(401)
      .json({ message: "Невалидный refresh", details: e.message });
  }
};

export const logout = async (req, res) => {
  const token = req.cookies?.rt;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      await revokeAllUserRefreshTokens(decoded.sub);
    } catch (_) {}
  }
  clearAuthCookies(res);
  return res.json({ ok: true });
};

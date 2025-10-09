import jwt from "jsonwebtoken";
import tokenModel from "../models/token.js";

/**
 * У меня сейчас запросы никак не защищены - любой кто знает id пользователя и endpoint может изменять данные любого пользователя
 *
 * Мне нужен middleware который будет проверять авторизацию пользователя по системе токенов - напиши его.
 * Правильный ли код снизу?
 */
class TokenService {
  generateTokens(payload) {
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "5m",
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "1d",
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async saveToken(userId, refreshToken) {
    const lastToken = await tokenModel.findOne({ user: userId });

    if (lastToken) {
      lastToken.refreshToken = refreshToken;

      return await lastToken.save();
    }

    const token = await tokenModel.create({ user: userId, refreshToken });

    return token;
  }
}

export const tokenService = new TokenService();

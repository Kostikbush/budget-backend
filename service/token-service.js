import jwt from "jsonwebtoken";
import tokenModel from "../models/token.js";

class TokenService {
  generateTokens(payload) {
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "5m",
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "30d",
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

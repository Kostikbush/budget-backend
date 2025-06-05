import  jwt from 'jsonwebtoken';
import  User from '../models/user.js';
import Token from "../models/token.js";

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

export const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Пользователь уже существует' });

    const user = await User.create({ email, password });
    const { accessToken, refreshToken } = generateTokens(user);

    await Token.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка регистрации' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Неверный email или пароль' });

    const { accessToken, refreshToken } = generateTokens(user);

    await Token.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    console.log("user", user);
    res.json({ accessToken, refreshToken, user });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка входа' });
  }
};

export const refresh = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Нет токена' });

    const savedToken = await Token.findOne({ token });
    if (!savedToken) return res.status(403).json({ message: 'Недействительный refresh токен' });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Пользователь не найден' });

    const { accessToken, refreshToken } = generateTokens(user);

    await Token.deleteOne({ token }); // invalidate old token
    await Token.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(403).json({ message: 'Невалидный refresh токен' });
  }
};

export const logout = async (req, res) => {
  const { token } = req.body;
  await Token.deleteOne({ token });
  res.json({ message: 'Выход выполнен' });
};
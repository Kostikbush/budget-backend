import { UserDto } from "../dtos/user-dto.js";
import pushSubscription from "../models/pushSubscription.js";
import UserModel from "../models/user.js";
import tokenModel from "../models/token.js";
import { budgetService } from "./budget-service.js";
import { mailService } from "./mail-service.js";
import { tokenService } from "./token-service.js";
import bcrypt from "bcrypt";
import { v4 } from "uuid";

class UserService {
  async registration(email, password) {
    const candidate = await UserModel.findOne({ email });

    if (candidate) {
      throw new Error(
        `Пользователь с почтовым адресом ${email} уже существует`,
      );
    }
    const hashPassword = await bcrypt.hash(password, 3);
    const activationLink = v4();

    const res = await mailService.sendActivationMail(
      email,
      `${process.env.API_URL}/api/activate/${activationLink}`,
    );

    if (!res) {
      return "Ошибка отправки почты";
    }

    const user = await UserModel.create({
      email,
      password: hashPassword,
      activationLink,
      isAdmin: false,
      isPaid: false,
    });

    const useDto = new UserDto(user);
    const tokens = tokenService.generateTokens({ ...useDto });

    await tokenService.saveToken(useDto.id, tokens.refreshToken);

    return {
      ...tokens,
      user: useDto,
    };
  }

  async getUsers({ limit, searchQuery }) {
    const query = searchQuery
      ? { email: { $regex: searchQuery, $options: "i" } }
      : {};

    return (
      await UserModel.find({ budgets: { $size: 0 }, ...query })
        .limit(limit)
        .exec()
    ).map((user) => ({
      name: user.name,
      nickname: user.nickname,
    }));
  }
  async getUserById(id) {
    return UserModel.findById(id).select("-password");
  }
  async deleteUser(id) {
    const user = await UserModel.findById(id);

    if (!user) {
      throw new Error("Пользователь не найден");
    }

    if (user.budgets.length > 0) {
      await budgetService.deleteBudgetByUserId(id);
    }

    await pushSubscription.deleteMany({ userId: id });
    await tokenModel.deleteMany({ userId: id });
    await UserModel.findByIdAndDelete(id);

    return { message: "Пользователь успешно удален", type: "success" };
  }
}

export const userService = new UserService();

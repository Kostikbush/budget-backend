import { UserDto } from "../dtos/user-dto.js";
import UserModel from "../models/user.js";
import { mailService } from "./mail-service.js";
import { tokenService } from "./token-service.js";
import bcrypt from "bcrypt";
import { v4 } from "uuid";

class UserService {
  async registration(email, password) {
    const candidate = await UserModel.findOne({ email });

    if (candidate) {
      throw new Error(
        `Пользователь с почтовым адресом ${email} уже существует`
      );
    }
    const hashPassword = await bcrypt.hash(password, 3);
    const activationLink = v4();

    const res = await mailService.sendActivationMail(
      email,
      `${process.env.API_URL}/api/activate/${activationLink}`
    );

    if (!res) {
      return "Ошибка отправки почты";
    }

    const user = await UserModel.create({
      email,
      password: hashPassword,
      activationLink,
    });

    const useDto = new UserDto(user);
    const tokens = tokenService.generateTokens({ ...useDto });

    await tokenService.saveToken(useDto.id, tokens.refreshToken);

    return {
      ...tokens,
      user: useDto,
    };
  }

  async getUsers() {
    return await UserModel.find({ budgets: { $size: 0 } });
  }
}

export const userService = new UserService();

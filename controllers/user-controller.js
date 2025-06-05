import { userService } from "../service/user-service.js";

class UserController {
  async getUsers(_, res) {
    try {
      const users = await userService.getUsers();

      res.json(users);
    } catch (e) {
      res.json({ message: "Ошибка получения пользователей" });
    }
  }
}

export default new UserController();

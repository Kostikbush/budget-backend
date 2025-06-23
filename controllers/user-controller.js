import { userService } from "../service/user-service.js";

class UserController {
  async getUsers(_, res) {
    try {
      const users = await userService.getUsers();
      console.log({ users });
      res.json(users);
    } catch (e) {
      res.json({ message: "Ошибка получения пользователей", type: "error" });
    }
  }
}

export default new UserController();

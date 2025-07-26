import { userService } from "../service/user-service.js";

class UserController {
  async getUsers(req, res) {
    try {
      const { limit = 20, searchQuery } = req.query;

      const users = await userService.getUsers({
        limit: parseInt(limit, 10),
        searchQuery,
      });

      res.json(users);
    } catch (e) {
      res.json({ message: "Ошибка получения пользователей", type: "error" });
    }
  }
}

export default new UserController();

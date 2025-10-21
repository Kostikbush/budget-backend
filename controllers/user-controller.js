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

  async deleteUser(req, res) {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res
          .status(401)
          .json({ message: "Необходима авторизация", type: "error" });
      }

      const response = await userService.deleteUser(userId);
      res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка удаления пользователя",
        type: "error",
      });
    }
  }

  async getUser(req, res) {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res
          .status(401)
          .json({ message: "Необходима авторизация", type: "error" });
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ message: "Пользователь не найден", type: "error" });
      }

      res.json(user);
    } catch (e) {
      res.json({ message: "Ошибка получения пользователя", type: "error" });
    }
  }
}

export default new UserController();

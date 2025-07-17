import { budgetService } from "../service/budget-service.js";
import { Types } from "mongoose";

class BudgetController {
  async create(req, res) {
    try {
      const { startSum, ownerId, memberId } = req.body;

      if (!ownerId) {
        res.json({ message: "Не передан id пользователя", type: "error" });

        return;
      }

      const result = await budgetService.createBudget(
        "Бюджет",
        ownerId,
        startSum,
        memberId,
      );

      res.json(result);
    } catch (e) {
      res.json({
        message: e?.message ?? "Ошибка создания бюджета",
        type: "error",
      });
    }
  }

  async history(req, res) {
    try {
      const { budgetId, after, limit, type } = req.query;

      if (!budgetId) {
        return res.json({ message: "Не передан бюджет", type: "error" });
      }

      const result = await budgetService.history({
        budgetId: budgetId,
        after: after ? new Date(after) : undefined,
        limit: Number(limit) || 20,
        type: type || "all",
      });

      return res.json(result);
    } catch (error) {
      return res.json({
        message: error?.message ?? "Ошибка получения истории",
        type: "error",
      });
    }
  }

  async getBudget(req, res) {
    try {
      const { userId } = req.query;

      if (!userId) {
        res.json({ message: "Не передан id пользователя", type: "error" });
        return;
      }

      if (!Types.ObjectId.isValid(userId)) {
        res.json({ message: "Некорректный ID пользователя", type: "error" });
        return;
      }

      const budget = await budgetService.getUserBudget(userId);

      res.json(budget);
    } catch (e) {
      res.json({ message: "Ошибка получения бюджета", type: "error" });
      return;
    }
  }
}

export default new BudgetController();

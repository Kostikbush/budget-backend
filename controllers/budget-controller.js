import { budgetService } from "../service/budget-service.js";
import { Types } from "mongoose";
import { incomeHistoryService } from "../service/income-history-service.js";
import { expenseHistoryService } from "../service/expense-history-service.js";

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
        memberId
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
      const { userId, after, limit, type } = req.query;

      if (!userId) {
        return res.json({
          message: "Не передан id пользователя",
          type: "error",
        });
      }

      const result = await budgetService.history({
        userId: userId,
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

  async getAvailableSpendingLimits(req, res) {
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

      const limits = await budgetService.getAvailableSpendingLimits(userId);

      res.json(limits);
    } catch (e) {
      res.json({
        message: e?.message ?? "Ошибка получения лимитов",
        type: "error",
      });
    }
  }

  async updateIncomeHistory(req, res) {
    try {
      const { incomeData } = req.body;
      const { userId } = req.query;

      if (!userId || !incomeData) {
        return res.json({ message: "Недостаточно данных", type: "error" });
      }

      const result = await incomeHistoryService.updateIncomeHistory(
        userId,
        incomeData
      );

      return res.json(result);
    } catch (error) {
      return res.json({
        message: error?.message ?? "Ошибка изменения истории доходов",
        type: "error",
      });
    }
  }

  async deleteIncomeHistoryItem(req, res) {
    try {
      const { userId, incomeHistoryId } = req.query;

      if (!userId || !incomeHistoryId) {
        return res.json({ message: "Недостаточно данных", type: "error" });
      }

      const result = await incomeHistoryService.deleteIncomeHistory(
        incomeHistoryId,
        userId
      );

      return res.json(result);
    } catch (error) {
      return res.json({
        message: error?.message ?? "Ошибка удаления элемента истории доходов",
        type: "error",
      });
    }
  }

  async updateExpenseHistory(req, res) {
    try {
      const { expenseData } = req.body;
      const { userId } = req.query;

      if (!userId || !expenseData) {
        return res.json({ message: "Недостаточно данных", type: "error" });
      }

      const result = await expenseHistoryService.updateExpenseHistory(
        userId,
        expenseData
      );

      return res.json(result);
    } catch (error) {
      return res.json({
        message: error?.message ?? "Ошибка изменения истории расходов",
        type: "error",
      });
    }
  }

  async deleteExpenseHistoryItem(req, res) {
    try {
      const { expenseHistoryId } = req.query;

      if (!expenseHistoryId) {
        return res.json({ message: "Недостаточно данных", type: "error" });
      }

      const result = await expenseHistoryService.deleteExpenseHistory(
        expenseHistoryId
      );

      return res.json(result);
    } catch (error) {
      return res.json({
        message: error?.message ?? "Ошибка удаления элемента истории расходов",
        type: "error",
      });
    }
  }
}
export default new BudgetController();

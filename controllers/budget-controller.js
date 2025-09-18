import { budgetService } from "../service/budget-service.js";
import { Types } from "mongoose";
import { incomeHistoryService } from "../service/income-history-service.js";
import { expenseHistoryService } from "../service/expense-history-service.js";

class BudgetController {
  async getUsersInBudget(req, res) {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res.json({
          message: "Не передан id пользователя",
          type: "error",
        });
      }

      const response = await budgetService.getUsersInBudget(userId);

      return res.json(response);
    } catch (e) {
      res.json({
        message: e?.message ?? "Ошибка получения пользователей в бюджете",
        type: "error",
      });
    }
  }
  async create(req, res) {
    try {
      const { startSum, memberNickname } = req.body;
      const userId = req.user?.sub;

      if (!userId) {
        res.json({ message: "Не передан id пользователя", type: "error" });

        return;
      }

      const result = await budgetService.createBudget(
        "Бюджет",
        userId,
        startSum,
        memberNickname
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
      const { after, limit, type } = req.query;

      const userId = req.user?.sub;

      if (!userId) {
        return res.json({
          message: "Не передан id пользователя",
          type: "error",
        });
      }

      const result = await budgetService.history({
        userId: userId,
        after: after ? new Date(after) : undefined,
        limit: limit || 10,
        type: type || "all",
      });

      return res.json(result);
    } catch (error) {
      console.log("Budget history error:", error);
      return res.json({
        message: error?.message ?? "Ошибка получения истории",
        type: "error",
      });
    }
  }

  async getBudget(req, res) {
    try {
      const userId = req.user?.sub;

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
      const { date, excludeId } = req.query;

      const userId = req.user?.sub;

      if (!userId) {
        res.json({ message: "Не передан id пользователя", type: "error" });
        return;
      }

      if (!Types.ObjectId.isValid(userId)) {
        res.json({ message: "Некорректный ID пользователя", type: "error" });
        return;
      }

      const limits = await budgetService.getAvailableSpendingLimits(
        userId,
        date,
        excludeId
      );

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
      const userId = req.user?.sub;

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
      const userId = req.user?.sub;
      const { incomeHistoryId } = req.query;

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
      const userId = req.user?.sub;

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
  async getBarsByUser(req, res) {
    try {
      const { ranges } = req.query;
      const userId = req.user?.sub;

      const array = JSON.parse(ranges || "[]");

      if (!userId) {
        return res.json({ message: "Недостаточно данных", type: "error" });
      }

      if (!array || !array.length) {
        return res.json({ message: "Недостаточно данных", type: "error" });
      }

      const result = await budgetService.getBarsByUser({
        userId,
        ranges: array,
      });

      return res.json(result);
    } catch (error) {
      return res.json({
        message: error?.message ?? "Ошибка получения данных по бюджету",
        type: "error",
      });
    }
  }
}
export default new BudgetController();

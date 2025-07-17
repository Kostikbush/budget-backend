import { expenseService } from "../service/expense-service.js";

class ExpenseController {
  async getBudgetExpenses(req, res) {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.json({
          message: "Не передана информация о пользователе",
          type: "error",
        });
      }

      const expenses = await expenseService.getBudgetExpenses(userId);

      return res.json(expenses);
    } catch (e) {
      res.json({
        message: e?.message ?? "Ошибка получения списка доходов",
        type: "error",
      });
    }
  }

  async createExpense(req, res) {
    try {
      const { userId, expenseData } = req.body;

      if (!userId) {
        return res.json({
          message: "Не передана информация о пользователе",
          type: "error",
        });
      }

      const response = await expenseService.createExpense(expenseData, userId);

      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка создания дохода",
        type: "error",
      });
    }
  }

  async updateExpense(req, res) {
    try {
      const { expenseId, expenseData, userId } = req.body;

      if (!expenseId) {
        return res.json({
          message: "Не передан id дохода",
          type: "error",
        });
      }

      const updateIncome = await expenseService.updateExpense(
        expenseId,
        expenseData,
        userId,
      );

      return res.json(updateIncome);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка обновления дохода",
        type: "error",
      });
    }
  }

  async deleteExpense(req, res) {
    try {
      const { expenseId } = req.body;

      if (!expenseId) {
        return res.json({
          message: "Не передан id расхода",
          type: "error",
        });
      }

      const updateIncome = await expenseService.delete(expenseId);

      return res.json(updateIncome);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка удаления расхода",
        type: "error",
      });
    }
  }

  async acceptExpense(req, res) {
    try {
      const { expenseId } = req.query;

      const response = await expenseService.acceptExpense(expenseId);
      console.log({ response });
      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка подтверждения расхода",
        type: "error",
      });
    }
  }

  async rejectExpense(req, res) {
    try {
      const { expenseId } = req.query;

      const response = await expenseService.rejectExpense(expenseId);
      console.log({ response });
      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка в попытке отменить расход",
        type: "error",
      });
    }
  }
}

export default new ExpenseController();

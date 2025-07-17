import { incomeService } from "../service/income-service.js";

class IncomeController {
  async getBudgetIncomes(req, res) {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.json({
          message: "Не передана информация о пользователе",
          type: "error",
        });
      }

      const incomes = await incomeService.getBudgetIncomes(userId);

      return res.json(incomes);
    } catch (e) {
      res.json({
        message: e?.message ?? "Ошибка получения списка доходов",
        type: "error",
      });
    }
  }

  async createIncome(req, res) {
    try {
      const { userId, incomeData } = req.body;

      if (!userId) {
        return res.json({
          message: "Не передана информация о пользователе и бюджете",
          type: "error",
        });
      }

      const response = await incomeService.createIncome(incomeData, userId);

      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка создания дохода",
        type: "error",
      });
    }
  }

  async updateIncome(req, res) {
    try {
      const { incomeId, incomeData, budgetId } = req.body;

      if (!incomeId) {
        return res.json({
          message: "Не передан id дохода",
          type: "error",
        });
      }

      const updateIncome = await incomeService.updateIncome(
        incomeId,
        incomeData,
        budgetId,
      );

      return res.json(updateIncome);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка обновления дохода",
        type: "error",
      });
    }
  }

  async deleteIncome(req, res) {
    try {
      const { incomeId } = req.body;

      if (!incomeId) {
        return res.json({
          message: "Не передан id дохода",
          type: "error",
        });
      }

      const updateIncome = await incomeService.deleteRegularIncome(incomeId);

      return res.json(updateIncome);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка обновления дохода",
        type: "error",
      });
    }
  }
}

export default new IncomeController();

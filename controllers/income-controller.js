import { incomeService } from "../service/income-service.js";

class IncomeController {
  async getBudgetIncomes(req, res) {
    try {
      const { userId, budgetId } = req.query;

      if (!userId || !budgetId) {
        res.json({
          message: "Не передана информация о пользователе и бюджете",
          type: "error",
        });
      }

      const users = await incomeService.getBudgetIncomes(budgetId, userId);

      return res.json(users);
    } catch (e) {
      res.json({
        message: e?.message ?? "Ошибка получения списка доходов",
        type: "error",
      });
    }
  }

  async createIncome(req, res) {
    try {
      const { userId, budgetId, incomeData } = req.body;

      if (!userId || !budgetId) {
        res.json({
          message: "Не передана информация о пользователе и бюджете",
          type: "error",
        });
      }

      const response = await incomeService.createIncome(
        incomeData,
        budgetId,
        userId
      );

      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка создания дохода",
        type: "error",
      });
    }
  }

  async updateIncome(req, res) {
    try{
      const { incomeId } = req;

      if(!incomeId) {
        res.json({
          message: "Не передан id дохода",
          type: "error",
        });
      }
      
    }catch(error) {
      res.json({
        message: error?.message ?? "Ошибка обновления дохода",
        type: "error",
      });
    }
  }
}

export default new IncomeController();
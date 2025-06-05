import { budgetService } from '../service/budget-service.js'
import { Types } from "mongoose";

class BudgetController {
  async create(req, res) {
    try {
      const { startSum, ownerId, memberId } = req.body;

      if(!ownerId) {
        throw new Error("Не передан id пользователя");
      }

      const result = await budgetService.createBudget(
        "Бюджет",
        ownerId,
        startSum,
        memberId,
      );

      res.json(result);
    } catch (e) {
      res.json({message: 'Ошибка создания бюджета'})
    }
  }

  async getBudget(req, res) {
      try{
        const { userId } = req.query;

        if (!userId) {
          throw new Error("Не передан id пользователя");
        }

        if (!Types.ObjectId.isValid(userId)) {
          throw new Error("Некорректный ID пользователя");
        }

        return await budgetService.getUserBudget(userId)
      }catch(e) {
        res.json({ message: "Ошибка получения бюджета" });
      }
  }
}

export default new BudgetController();

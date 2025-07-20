import goalService from "../service/goal-service";

class GoalController {
  async getGoals(req, res) {
    try {
      const { userId } = req;

      const response = await goalService.getGoals(userId);

      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка получения целей",
        type: "error",
      });
    }
  }

  async createGoal(req, res) {
    try {
      const { userId, goalData } = req;

      const response = await goalService.createGoal(userId, goalData);

      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка создание цели",
        type: "error",
      });
    }
  }
  async updateGoal(req, res) {
    try {
      const { userId, goalData } = req;

      const response = await goalService.updateGoal(userId, goalData);

      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка обновление цели",
        type: "error",
      });
    }
  }
  async deleteADebitGoal(req, res) {
    try {
      const { userId, goalId } = req;

      const response = await goalService.deleteADebitGoal(userId, goalId);

      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка удаления цели",
        type: "error",
      });
    }
  }

  async deductAmountFromGoalToBudget(req, res) {
    try {
      const { goalId, amount } = req;

      const response = await goalService.deductAmountFromGoalToBudget(
        goalId,
        amount
      );

      return res.json(response);
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка удаления цели",
        type: "error",
      });
    }
  }
}

export default new GoalController();

class GoalController {
  async getGoals(req, res) {
    try {
      const { userId } = req;
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
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка обновление цели",
        type: "error",
      });
    }
  }
  async deleteGoals(req, res) {
    try {
      const { userId, goalId } = req;
      
    } catch (error) {
      res.json({
        message: error?.message ?? "Ошибка удаления цели",
        type: "error",
      });
    }
  }
}

export default new GoalController();

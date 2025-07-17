import { isToday } from "date-fns";
import { GoalModel } from "../models/goal";
import { budgetService, budgetServiceUtils } from "./budget-service";
import { expenseService } from "./expense-service";
import { incomeService } from "./income-service";
import { expenseHistoryService } from "./expense-history-service";

class GoalService {
  async getGoals(userId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;
    const goals = await GoalModel.find({ budgetId: budget._id.toString() });

    return { goals, type: "success" };
  }

  async createGoal(userId, goalData) {
    const {
      title,
      targetAmount,
      currentAmount,
      amount,
      frequency,
      dayOfMoneyWriteOff,
    } = goalData;

    const budget = (await budgetService.getUserBudget(userId)).budget;
    const expenses =
      (await expenseService.getBudgetExpenses(userId)).expenses || [];
    const incomes =
      (await incomeService.getBudgetIncomes(userId)).incomes || [];
    const goals = (await this.getGoals(userId)).goals || [];
    const sum = budget.sum;
    const budgetId = budget._id.toJSON();

    const isOnce = frequency === "once";
    const today = isToday(dayOfMoneyWriteOff);

    if ((isOnce || today) && sum - amount < 0) {
      throw new Error("В бюджете нет средств на эту цель");
    }

    if (isOnce) {
      const isHealthy = budgetServiceUtils.simulateBudgetHealth(
        { sum: sum - amount },
        incomes,
        [...expenses, ...goals.filter((goal) => goal.frequency !== "once")]
      );

      if (!isHealthy) {
        throw new Error("При трате на эту цель бюджет уйдет в минус");
      }

      if (targetAmount !== amount) {
        throw new Error("Указанная сумма не покрывает цель");
      }

      await expenseHistoryService.create(
        {
          amount,
          expenseId: null,
          priority: 1,
          scope: "shared",
          frequency,
          title,
          type: "goal",
        },
        userId
      );

      await GoalModel.create({
        amount,
        budgetId,
        createdAt: new Date(),
        title,
        currentAmount,
        dayOfMoneyWriteOff,
        endDate: new Date(),
        frequency,
        isCompleted: true,
        targetAmount,
        userId,
      });

      return { type: "success" };
    }

    const isHealthy = budgetServiceUtils.simulateBudgetHealth(
      { sum },
      incomes,
      [...expenses, ...goals.filter((goal) => goal.frequency !== "once")]
    );

    if (!isHealthy) {
      throw new Error("При трате на эту цель бюджет уйдет в минус");
    }

    const newGoal = await GoalModel.create({
      amount,
      budgetId,
      createdAt: new Date(),
      title,
      currentAmount,
      dayOfMoneyWriteOff,
      endDate: this.calculateGoalEndDate({
        currentAmount,
        targetAmount,
        amountPerStep: amount,
        frequency,
        startDate: dayOfMoneyWriteOff,
      }),
      frequency,
      isCompleted: false,
      targetAmount,
      userId,
    });

    if (today) {
      newGoal.currentAmount += newGoal.amount;

      let minusSum = amount;

      if (newGoal.targetAmount < newGoal.currentAmount) {
        minusSum = newGoal.currentAmount - newGoal.targetAmount;

        newGoal.currentAmount = newGoal.targetAmount;

        newGoal.isCompleted = true;

        await newGoal.save();
      }

      await expenseHistoryService.create(
        {
          amount: minusSum,
          expenseId: null,
          priority: 1,
          scope: "shared",
          frequency,
          title,
          type: "goal",
        },
        userId
      );
    }

    return { type: "success" };
  }
  async updateGoal(userId, goalData) {}
  async deleteGoals(userId, goalId) {}

  calculateGoalEndDate({
    currentAmount,
    targetAmount,
    amountPerStep,
    frequency,
    startDate,
  }) {
    let total = currentAmount;
    let currentDate = new Date(startDate);

    while (total < targetAmount) {
      switch (frequency) {
        case "daily":
          currentDate = addDays(currentDate, 1);
          break;
        case "weekly":
          currentDate = addWeeks(currentDate, 1);
          break;
        case "monthly":
          currentDate = addMonths(currentDate, 1);
          break;
        case "yearly":
          currentDate = addYears(currentDate, 1);
          break;
        case "once":
          total = targetAmount; // если списание однократное — достигнем сразу
          break;
      }

      if (frequency !== "once") {
        total += amountPerStep;
      }
    }

    return currentDate;
  }
}

export default new GoalService();

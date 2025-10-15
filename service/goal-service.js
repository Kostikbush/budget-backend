import { addDays, addMonths, addWeeks, addYears, isToday } from "date-fns";
import { GoalModel } from "../models/goal.js";
import { budgetService, budgetServiceUtils } from "./budget-service.js";
import { expenseHistoryService } from "./expense-history-service.js";
import { incomeHistoryService } from "./income-history-service.js";
import { ExpenseHistoryModel } from "../models/expenseHistory.js";
import { getNextDateFromFrequency } from "../lib/date.js";

class GoalService {
  async getGoals(userId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;
    const goals = await GoalModel.find({ budgetId: budget._id.toString() });

    return { goals, type: "success" };
  }

  async getActiveGoals(userId, budgetId, widthStandardField) {
    let budgetIdFormat = budgetId ? budgetId?.toString() : null;

    if (!budgetIdFormat) {
      budgetIdFormat = (
        await budgetService.getUserBudget(userId)
      ).budget?._id?.toString();
    }

    const goals = (await GoalModel.find({
      budgetId: budgetIdFormat,
      isCompleted: false,
    }).sort({ dayOfMoneyWriteOff: 1 }).lean()) ?? [];

    return {
      goals: widthStandardField
        ? goals.map((goal) => ({ ...goal._doc, date: goal.dayOfMoneyWriteOff }))
        : goals,
      type: "success",
    };
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

    const { allExpenses, budget, incomes } =
      await budgetService.getBudgetDetails(userId);
    const sum = budget.sum;
    const budgetId = budget._id.toJSON();

    const isOnce = frequency === "once";
    const today = isToday(dayOfMoneyWriteOff);

    if ((isOnce || today) && sum - amount < 0) {
      throw new Error("В бюджете нет средств на эту цель");
    }

    if (isOnce) {
      const isHealthy = budgetServiceUtils.isBudgetHealthyV2(
        sum - amount,
        incomes,
        allExpenses,
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
          entityId: null,
          priority: 1,
          scope: "shared",
          frequency,
          title,
          type: "goal",
        },
        userId,
      );

      await GoalModel.create({
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
        isCompleted: true,
        targetAmount,
        userId,
      });

      return { type: "success" };
    }

    const isHealthy = budgetServiceUtils.isBudgetHealthyV2(
      sum,
      incomes,
      allExpenses.concat([{ amount, date: dayOfMoneyWriteOff, frequency }]),
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

      if (newGoal.targetAmount <= newGoal.currentAmount) {
        minusSum = newGoal.currentAmount - newGoal.targetAmount;

        newGoal.currentAmount = newGoal.targetAmount;

        newGoal.isCompleted = true;

        await newGoal.save();
      }

      await expenseHistoryService.create(
        {
          amount: minusSum,
          entityId: null,
          priority: 1,
          scope: "shared",
          frequency,
          title,
          type: "goal",
        },
        userId,
      );

      newGoal.dayOfMoneyWriteOff = getNextDateFromFrequency(
        newGoal.dayOfMoneyWriteOff,
        newGoal.frequency,
      );

      await newGoal.save();
    }

    return { type: "success" };
  }
  async updateGoal(userId, goalId, goalData) {
    const {
      title,
      targetAmount,
      currentAmount,
      amount,
      frequency,
      dayOfMoneyWriteOff,
    } = goalData;

    const { allExpenses, budget, incomes } =
      await budgetService.getBudgetDetails(userId);
    const sum = budget.sum;
    const budgetId = budget._id.toJSON();

    const today = isToday(dayOfMoneyWriteOff);

    if (today && sum - amount < 0) {
      throw new Error("В бюджете нет средств на эту цель");
    }

    const isHealthy = budgetServiceUtils.isBudgetHealthyV2(
      sum,
      incomes,
      allExpenses.map((expense) => {
        if (expense.entityId === goalId) {
          return { ...expense, amount, date: dayOfMoneyWriteOff, frequency };
        }

        return expense;
      }),
    );

    if (!isHealthy) {
      throw new Error("При трате на эту цель бюджет уйдет в минус");
    }

    const updatedGoal = await GoalModel.findByIdAndUpdate(
      goalId,
      {
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
      },
      { new: true },
    );

    if (today) {
      updatedGoal.currentAmount += updatedGoal.amount;

      let minusSum = amount;

      if (updatedGoal.targetAmount < updatedGoal.currentAmount) {
        minusSum = updatedGoal.currentAmount - updatedGoal.targetAmount;

        updatedGoal.currentAmount = updatedGoal.targetAmount;

        updatedGoal.isCompleted = true;

        await updatedGoal.save();
      }

      const lastHistory = await ExpenseHistoryModel.findOne({
        entityId: goalId,
      })
        .sort({ date: -1 }) // Последняя по дате
        .lean(); // ускоряет, если не нужно работать с mongoose-документом

      if (!lastHistory || !isToday(new Date(lastHistory?.date))) {
        await expenseHistoryService.create(
          {
            amount: minusSum,
            entityId: goalId,
            priority: 1,
            scope: "shared",
            frequency,
            title,
            type: "goal",
          },
          userId,
        );

        updatedGoal.dayOfMoneyWriteOff =
          getNextDateFromFrequency(
            updatedGoal.dayOfMoneyWriteOff,
            updatedGoal.frequency,
          );

        await updatedGoal.save();

        return { type: "success" };
      }

      await expenseHistoryService.create(
        {
          amount: minusSum,
          entityId: goalId,
          priority: 1,
          scope: "shared",
          frequency,
          title,
          type: "goal",
        },
        userId,
      );

      updatedGoal.dayOfMoneyWriteOff =
        getNextDateFromFrequency(
          updatedGoal.dayOfMoneyWriteOff,
          updatedGoal.frequency,
        );

      await updatedGoal.save();
    }

    return { type: "success" };
  }
  async deleteADebitGoal(userId, goalId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      throw new Error("Цель не найдена");
    }

    if (goal.budgetId.toString() !== budget._id.toString()) {
      throw new Error("Цель не принадлежит вашему бюджету");
    }

    await GoalModel.findByIdAndDelete(goalId);

    return { type: "success" };
  }

  async deleteGoalReturnMoneyBackToTheBudget(userId, goalId) {
    const budget = (await budgetService.getUserBudget(userId)).budget;
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      throw new Error("Цель не найдена");
    }

    if (goal.budgetId.toString() !== budget._id.toString()) {
      throw new Error("Цель не принадлежит вашему бюджету");
    }

    await incomeHistoryService.create(
      {
        title: goal.title,
        amount: goal.currentAmount,
        date: new Date(),
        incomeId: null,
        frequency: goal.frequency,
      },
      userId,
    );

    await GoalModel.findByIdAndDelete(goalId);

    return { type: "success" };
  }

  async deductAmountFromGoalToBudget(goalId, amount) {
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      throw new Error("Цель не найдена");
    }

    goal.currentAmount -= amount;

    await incomeHistoryService.create(
      {
        title: goal.title,
        amount,
        date: new Date(),
        incomeId: null,
        frequency: goal.frequency,
      },
      goal.userId,
    );

    await goal.save();

    return { type: "success" };
  }

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

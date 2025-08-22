import { isBefore, isSameDay, startOfDay } from "date-fns";
import { BudgetModel } from "../models/budget.js";
import { budgetServiceUtils } from "../service/budget-service.js";
import { IncomeModel } from "../models/income.js";
import { ExpenseModel } from "../models/expense.js";
import { GoalModel } from "../models/goal.js";
import { incomeHistoryService } from "../service/income-history-service.js";
import { expenseHistoryService } from "../service/expense-history-service.js";
import goalService from "../service/goal-service.js";

export async function budgetSyncMiddleware(req, res, next) {
  const { userId } = req.query;
  if (!userId) return next();

  const budget = await BudgetModel.findOne({
    $or: [{ owner: userId }, { "members._id": userId }],
  });

  if (!budget) return next();

  const today = startOfDay(new Date());

  // Если бюджет уже обновлялся сегодня — пропускаем
  if (budget.updatedAt && isSameDay(new Date(budget.updatedAt), today)) {
    return next();
  }

  budget.updatedAt = today;

  await budget.save();

  const [incomes, expenses, goals] = await Promise.all([
    IncomeModel.find({ budgetId: budget._id, frequency: { $ne: "once" } }),
    ExpenseModel.find({ budgetId: budget._id, frequency: { $ne: "once" } }),
    GoalModel.find({ budgetId: budget._id, isCompleted: false }),
  ]);

  console.log({ expenses }, "FINDED_EXPENSEs");
  // Обновляем бюджет

  const operations = [];

  for (const income of incomes) {
    let currentDate = startOfDay(new Date(income.date));

    while (isBefore(currentDate, today) || isSameDay(currentDate, today)) {
      operations.push({
        type: "income",
        data: {
          incomeId: income._id,
          userId: income.userId,
          budgetId: budget._id,
          amount: income.amount,
          date: currentDate,
          frequency: income.frequency,
          title: income.title,
        },
      });

      currentDate = budgetServiceUtils.getNextDateFromFrequency(
        currentDate,
        income.frequency
      );
    }

    if (currentDate > income.date) {
      income.date = currentDate;
      await income.save();
    }
  }

  for (const expense of expenses) {
    let currentDate = startOfDay(new Date(expense.date));

    while (isBefore(currentDate, today) || isSameDay(currentDate, today)) {
      console.log({ expense }, "UPDATE_PUSHES_EXPENSe");
      operations.push({
        type: "expense",
        data: {
          entityId: expense._id,
          userId: expense.userId,
          budgetId: budget._id,
          amount: expense.amount,
          date: currentDate,
          comment: expense.comment,
          priority: expense.priority,
          frequency: expense.frequency,
          scope: expense.scope,
          title: expense.title,
          type: "expense",
        },
      });

      currentDate = budgetServiceUtils.getNextDateFromFrequency(
        currentDate,
        expense.frequency
      );
    }

    if (currentDate > expense.date) {
      expense.date = currentDate;
      await expense.save();
    }
  }

  for (const goal of goals) {
    let currentDate = startOfDay(new Date(goal.dayOfMoneyWriteOff));

    while (
      (isBefore(currentDate, today) || isSameDay(currentDate, today)) &&
      !goal.isCompleted
    ) {
      goal.currentAmount += goal.amount;

      if (goal.currentAmount >= goal.targetAmount) {
        // Сколько "лишнего" зашло сверх цели
        const overflow = goal.currentAmount - goal.targetAmount;

        // Добавим корректную сумму, чтобы цель дошла только до target
        operations.push({
          type: "expense",
          data: {
            entityId: goal._id,
            userId: goal.userId,
            budgetId: budget._id,
            amount: goal.amount - overflow,
            date: currentDate,
            priority: 1,
            frequency: goal.frequency,
            scope: "personal",
            title: goal.title,
            type: "goal",
          },
        });

        goal.currentAmount = goal.targetAmount;
        goal.isCompleted = true;
        break;
      }

      operations.push({
        type: "expense",
        data: {
          entityId: goal._id,
          userId: goal.userId,
          budgetId: budget._id,
          amount: goal.amount,
          date: currentDate,
          priority: 1,
          frequency: goal.frequency,
          scope: "personal",
          title: goal.title,
          type: "goal",
        },
      });

      currentDate = budgetServiceUtils.getNextDateFromFrequency(
        currentDate,
        goal.frequency
      );
    }

    if (!goal.isCompleted) {
      goal.dayOfMoneyWriteOff = currentDate;
      goal.endDate = goalService.calculateGoalEndDate({
        currentAmount: goal.currentAmount,
        targetAmount: goal.targetAmount,
        amountPerStep: goal.amount,
        frequency: goal.frequency,
        startDate: currentDate,
      });
    }

    await goal.save();
  }

  for (const op of operations) {
    if (op.type === "income") {
      await incomeHistoryService.create(op.data, op.data.userId);
    } else if (op.type === "expense" || op.type === "goal") {
      await expenseHistoryService.create(op.data, op.data.userId);
    }
  }

  next();
}

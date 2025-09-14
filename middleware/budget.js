import { isBefore, isSameDay, startOfDay } from "date-fns";
import { BudgetModel } from "../models/budget.js";
import { budgetServiceUtils } from "../service/budget-service.js";
import { IncomeModel } from "../models/income.js";
import { ExpenseModel } from "../models/expense.js";
import { GoalModel } from "../models/goal.js";
import { incomeHistoryService } from "../service/income-history-service.js";
import { expenseHistoryService } from "../service/expense-history-service.js";
import goalService from "../service/goal-service.js";

// --- Простой in-memory лок на один бюджет ---
const locks = new Map();
async function withLock(key, fn) {
  const prev = locks.get(key) ?? Promise.resolve();
  let release;
  const p = new Promise((res) => (release = res));
  locks.set(
    key,
    prev.then(fn).finally(() => {
      release();
      // если в цепочке ещё кто-то ждёт — не удаляем key, он перезапишется
      if (locks.get(key) === p) locks.delete(key);
    })
  );
  return p;
}

export async function budgetSyncMiddleware(req, res, next) {
  console.log(">>> budgetSyncMiddleware");
  try {
    const userId = req.user?.sub;
    if (!userId) return next();

    const budgetIdDoc = await BudgetModel.findOne(
      { $or: [{ owner: userId }, { "members._id": userId }] },
      { _id: 1 }
    ).lean();

    if (!budgetIdDoc?._id) return next();
    const budgetId = budgetIdDoc._id.toString();

    await withLock(`budget:${budgetId}`, async () => {
      const today = startOfDay(new Date());

      // 2) идемпотентно отметим обновление за сегодня
      const budget = await BudgetModel.findOneAndUpdate(
        {
          _id: budgetId,
          $or: [
            { updatedAt: { $exists: false } },
            { updatedAt: { $lt: today } },
          ],
        },
        { $set: { updatedAt: today } },
        { new: true }
      ).lean();

      // если budget === null, значит уже обновляли сегодня — выходим
      if (!budget) return;

      // 3) разовая выборка периодических сущностей
      const [incomes, expenses, goals] = await Promise.all([
        IncomeModel.find({ budgetId, frequency: { $ne: "once" } }).lean(),
        ExpenseModel.find({ budgetId, frequency: { $ne: "once" } }).lean(),
        GoalModel.find({ budgetId, isCompleted: false }).lean(),
      ]);

      const operations = [];

      // 4) INCOMES: сгенерировать операции и сдвинуть date атомарно
      for (const income of incomes) {
        let currentDate = startOfDay(new Date(income.date));

        while (isBefore(currentDate, today) || isSameDay(currentDate, today)) {
          operations.push({
            type: "income",
            data: {
              incomeId: income._id,
              userId: income.userId,
              budgetId: budgetId,
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

        // атомарный сдвиг только вперёд
        await IncomeModel.updateOne(
          { _id: income._id, date: { $lt: currentDate } },
          { $set: { date: currentDate } }
        ).exec();
      }

      // 5) EXPENSES: операции + сдвиг date атомарно
      for (const expense of expenses) {
        let currentDate = startOfDay(new Date(expense.date));

        while (isBefore(currentDate, today) || isSameDay(currentDate, today)) {
          operations.push({
            type: "expense",
            data: {
              entityId: expense._id,
              userId: expense.userId,
              budgetId: budgetId,
              amount: expense.amount,
              date: currentDate,
              comment: expense.comment,
              priority: expense.priority,
              frequency: expense.frequency,
              scope: expense.scope,
              title: expense.title,
              category: expense?.category ?? [],
              type: "expense",
            },
          });

          currentDate = budgetServiceUtils.getNextDateFromFrequency(
            currentDate,
            expense.frequency
          );
        }

        await ExpenseModel.updateOne(
          { _id: expense._id, date: { $lt: currentDate } },
          { $set: { date: currentDate } }
        ).exec();
      }

      // 6) GOALS: операции + апдейт атомарно (currentAmount, isCompleted, dayOfMoneyWriteOff, endDate)
      for (const goal of goals) {
        let currentDate = startOfDay(new Date(goal.dayOfMoneyWriteOff));
        let newCurrent = goal.currentAmount ?? 0;
        let isCompleted = goal.isCompleted;

        while (
          (isBefore(currentDate, today) || isSameDay(currentDate, today)) &&
          !isCompleted
        ) {
          const nextAmount = newCurrent + goal.amount;

          if (nextAmount >= goal.targetAmount) {
            // завершающий платёж: берём только недостающую часть (без переплаты)
            const missing = Math.max(goal.targetAmount - newCurrent, 0);

            operations.push({
              type: "expense",
              data: {
                entityId: goal._id,
                userId: goal.userId,
                budgetId: budgetId,
                amount: missing,
                date: currentDate,
                priority: 1,
                frequency: goal.frequency,
                scope: "personal",
                title: goal.title,
                type: "goal",
              },
            });

            newCurrent = goal.targetAmount;
            isCompleted = true;
            break;
          }

          // обычный платёж
          operations.push({
            type: "expense",
            data: {
              entityId: goal._id,
              userId: goal.userId,
              budgetId: budgetId,
              amount: goal.amount,
              date: currentDate,
              priority: 1,
              frequency: goal.frequency,
              scope: "personal",
              title: goal.title,
              type: "goal",
            },
          });

          newCurrent = nextAmount;
          currentDate = budgetServiceUtils.getNextDateFromFrequency(
            currentDate,
            goal.frequency
          );
        }

        // пересчёт endDate от нового состояния
        const newEndDate = isCompleted
          ? currentDate // сегодня/текущий шаг — цель достигнута
          : goalService.calculateGoalEndDate({
              currentAmount: newCurrent,
              targetAmount: goal.targetAmount,
              amountPerStep: goal.amount,
              frequency: goal.frequency,
              startDate: currentDate,
            });

        await GoalModel.updateOne(
          { _id: goal._id },
          {
            $set: {
              currentAmount: newCurrent,
              isCompleted,
              dayOfMoneyWriteOff: currentDate,
              endDate: newEndDate,
            },
          }
        ).exec();
      }

      // 7) Применяем операции (истории)
      for (const op of operations) {
        if (op.type === "income") {
          await incomeHistoryService.create(op.data, op.data.userId);
        } else {
          await expenseHistoryService.create(op.data, op.data.userId);
        }
      }
    });

    next();
  } catch (err) {
    next(err);
  }
}

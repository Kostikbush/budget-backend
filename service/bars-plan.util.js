import { startOfDay, endOfDay, max as maxDate } from "date-fns";
import {
  countOccurrencesBetween,
  alignStartFromCreated,
} from "./countOccurrencesBetween.js"; // твоя обновлённая версия
import { GoalModel } from "../models/goal.js";
import { ExpenseModel } from "../models/expense.js";
import { IncomeModel } from "../models/income.js";

export function normalizeRange(from, to) {
  return { from: startOfDay(from), to: endOfDay(to) };
}

export function sumPlanned(docs, from, to, getAnchor) {
  let total = 0;

  const fromDay = startOfDay(from);
  const toDay = endOfDay(to);

  for (const doc of docs) {
    const freq = doc.frequency;
    if (!freq || freq === "once") continue; // <- 🔸 пропускаем разовые

    const anchorRaw = getAnchor(doc);
    if (!anchorRaw) continue;

    const created = new Date(doc.createdAt);
    if (created > toDay) continue;

    // Восстанавливаем ближайшую дату расписания ≥ createdAt
    const scheduleStart = alignStartFromCreated(anchorRaw, freq, created);

    const end = doc.endDate ? new Date(doc.endDate) : null;
    let count = countOccurrencesBetween(
      scheduleStart,
      freq,
      fromDay,
      toDay,
      end,
    );

    // Добавляем первое списание в день создания,
    // если оно лежит в окне и ещё не посчитано
    const createdDay = startOfDay(created);
    if (
      createdDay >= fromDay &&
      createdDay <= toDay &&
      createdDay < startOfDay(scheduleStart)
    ) {
      count += 1;
    }

    total += count * (doc.amount || 0);
  }

  return total;
}

const baseWindowMatch = (budgetId, from, to, extra = {}) => ({
  budgetId,
  createdAt: { $lte: to },
  $or: [
    { endDate: { $exists: false } },
    { endDate: null },
    { endDate: { $gte: from } },
  ],
  ...extra,
});

// Доходы (берём все, сдвиг восстановим в sumPlanned)
export async function sumPlannedIncomes(from, to, budgetId) {
  const incomes = await IncomeModel.find(
    baseWindowMatch(budgetId, from, to),
  ).lean();
  return sumPlanned(incomes, from, to, (doc) => doc.date);
}

// Расходы
export async function sumPlannedExpenses(from, to, budgetId) {
  const expenses = await ExpenseModel.find(
    baseWindowMatch(budgetId, from, to),
  ).lean();
  console.log("expenses for sumPlannedExpenses:", expenses);
  return sumPlanned(expenses, from, to, (doc) => doc.date);
}

// Цели: только незавершённые
export async function sumPlannedGoals(from, to, budgetId) {
  const goals = await GoalModel.find(
    baseWindowMatch(budgetId, from, to, { isCompleted: false }),
  ).lean();
  return sumPlanned(
    goals,
    from,
    to,
    (doc) => doc.dayOfMoneyWriteOff || doc.date,
  );
}

import { budgetServiceUtils } from "./budget-service.js";
import { subMonths, addMonths, startOfMonth } from "date-fns";

describe("simulateBudgetHealth", () => {
  const today = startOfMonth(new Date());

  it("should return true if budget stays positive", () => {
    const budget = { sum: 6000 };
    const incomes = [
      { amount: 340000, frequency: "monthly", date: today },
      { amount: 5000, frequency: "weekly", date: today },
    ];
    const expenses = [
      { amount: 55000, frequency: "monthly", date: today },
      { amount: 2000000, frequency: "yearly", date: addMonths(today, 10) },
      { amount: 20000, frequency: "weekly", date: today },
      { amount: 2000, frequency: "monthly", date: today },
      { amount: 2000, frequency: "monthly", date: today },
      { amount: 1000, frequency: "daily", date: today },
    ];

    const result = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      expenses
    );
    expect(result).toBe(true);
  });

  it("should return false if budget goes negative", () => {
    const budget = { sum: 10000 };
    const incomes = [{ amount: 80000, frequency: "monthly", date: today }];
    const expenses = [{ amount: 90000, frequency: "monthly", date: today }];

    const result = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      expenses
    );
    expect(result).toBe(false);
  });

  it("should respect different frequencies", () => {
    const budget = { sum: 0 };
    const incomes = [{ amount: 1200, frequency: "yearly", date: today }];
    const expenses = [{ amount: 100, frequency: "monthly", date: today }];

    const result = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      expenses
    );
    expect(result).toBe(false);
  });

  it("should skip past-dated incomes and expenses before today", () => {
    const budget = { sum: 5000 };
    const incomes = [
      { amount: 10000, frequency: "monthly", date: subMonths(today, 6) },
    ];
    const expenses = [
      { amount: 5000, frequency: "monthly", date: subMonths(today, 6) },
    ];

    // Ожидаем, что прошлые даты не начнут с "-6 месяцев", а стартуют с текущего месяца
    const result = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      expenses
    );
    expect(result).toBe(true);
  });

  it("should defer future incomes and expenses", () => {
    const budget = { sum: 1000 };
    const incomes = [
      { amount: 10000, frequency: "monthly", date: addMonths(today, 2) },
    ];
    const expenses = [{ amount: 2000, frequency: "monthly", date: today }];

    // первые 2 месяца расходов нет покрытия
    const result = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      expenses
    );
    expect(result).toBe(false);
  });
});

describe("getAvailableSpendingLimits", () => {
  const today = startOfMonth(new Date());

  it("returns zero for all frequencies when budget is empty and no income", () => {
    const budget = { sum: 0 };
    const incomes = [];
    const expenses = [];

    const result = budgetServiceUtils.getAvailableSpendingLimits(
      budget,
      expenses,
      incomes
    );
    expect(result).toEqual({
      daily: 0,
      weekly: 0,
      monthly: 0,
      yearly: 0,
    });
  });

  it("returns large limits when income is high and no expenses", () => {
    const budget = { sum: 10000 };
    const incomes = [{ amount: 100_000, frequency: "monthly", date: today }];
    const expenses = [];

    const result = budgetServiceUtils.getAvailableSpendingLimits(
      budget,
      expenses,
      incomes
    );

    // Мы не можем предсказать точное значение, но они должны быть положительными
    for (const key in result) {
      expect(result[key]).toBeGreaterThan(0);
    }
  });

  it("returns zero for all frequencies when expenses exceed income", () => {
    const budget = { sum: 5000 };
    const incomes = [{ amount: 10_000, frequency: "monthly", date: today }];
    const expenses = [{ amount: 12_000, frequency: "monthly", date: today }];

    const result = budgetServiceUtils.getAvailableSpendingLimits(
      budget,
      expenses,
      incomes
    );
    expect(result).toEqual({
      daily: 0,
      weekly: 0,
      monthly: 0,
      yearly: 0,
    });
  });

  it("respects future incomes", () => {
    const budget = { sum: 1000 };
    const incomes = [
      { amount: 20_000, frequency: "monthly", date: addMonths(today, 2) },
    ];
    const expenses = [];

    const result = budgetServiceUtils.getAvailableSpendingLimits(
      budget,
      expenses,
      incomes
    );

    // В первые 2 месяца бюджет должен быть ограничен текущей суммой
    for (const key in result) {
      expect(result[key]).toBeLessThanOrEqual(1000);
    }
  });

  it("handles mixed frequencies and returns appropriate limits", () => {
    const budget = { sum: 10000 };
    const incomes = [
      { amount: 1000, frequency: "daily", date: today },
      { amount: 7000, frequency: "weekly", date: today },
    ];
    const expenses = [{ amount: 3000, frequency: "weekly", date: today }];

    const result = budgetServiceUtils.getAvailableSpendingLimits(
      budget,
      expenses,
      incomes
    );

    expect(result.daily).toBeGreaterThan(0);
    expect(result.weekly).toBeGreaterThan(0);
    expect(result.monthly).toBeGreaterThan(0);
    expect(result.yearly).toBeGreaterThan(0);
  });

  it("handles edge case: income once — should be ignored in limit projections", () => {
    const budget = { sum: 500 };
    const incomes = [{ amount: 5000, frequency: "once", date: today }];
    const expenses = [];

    const result = budgetServiceUtils.getAvailableSpendingLimits(
      budget,
      expenses,
      incomes
    );

    // Даже при one-time доходе нельзя считать его за регулярный
    for (const key in result) {
      expect(result[key]).toBeLessThanOrEqual(500);
    }
  });
});
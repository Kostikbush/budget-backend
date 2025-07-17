import { budgetServiceUtils } from "./budget-service.js";

describe("simulateBudgetHealth", () => {
  it("should return true if budget stays positive", () => {
    const budget = { amount: 6000 };
    const incomes = [
      { amount: 340000, frequency: "monthly" },
      { amount: 5000, frequency: "weekly" },
    ];
    const expenses = [
      { amount: 55000, frequency: "monthly" },
      { amount: 2000000, frequency: "yearly" },
      { amount: 20000, frequency: "weekly" },
      { amount: 2000, frequency: "monthly" },
      { amount: 2000, frequency: "monthly" },
      { amount: 1000, frequency: "daily" },
    ];

    const result = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      expenses,
    );
    expect(result).toBe(true);
  });

  it("should return false if budget goes negative", () => {
    const budget = { amount: 10000 };
    const incomes = [{ amount: 80000, frequency: "monthly" }];
    const expenses = [{ amount: 90000, frequency: "monthly" }];

    const result = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      expenses,
    );
    expect(result).toBe(false);
  });

  it("should respect different frequencies", () => {
    const budget = { amount: 0 };
    const incomes = [{ amount: 1200, frequency: "yearly" }];
    const expenses = [{ amount: 100, frequency: "monthly" }];

    const result = budgetServiceUtils.simulateBudgetHealth(
      budget,
      incomes,
      expenses,
    );
    expect(result).toBe(false);
  });
});

import { Router } from "express";

import userController from "../controllers/user-controller.js";
import budgetController from "../controllers/budget-controller.js";
import notificationController from "../controllers/notification-controller.js";
import incomeController from "../controllers/income-controller.js";
import expenseController from "../controllers/expense-controller.js";
import {
  login,
  logout,
  refresh,
  register,
} from "../controllers/auth-controller.js";
import goalController from "../controllers/goal-controller.js";
import { subscribe, unsubscribe } from "../controllers/push-subscription.js";

const router = new Router();

router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/refresh", refresh);
router.post("/auth/logout", logout);
router.get("/users", userController.getUsers);
router.get("/budget", budgetController.getBudget);
router.post("/createBudget", budgetController.create);
router.get("/notifications", notificationController.getNotifications);
router.put("/acceptInvite", notificationController.acceptInvite);
router.put("/rejectInvite", notificationController.rejectInvite);
router.get("/history", budgetController.history);
router.get("/incomes", incomeController.getBudgetIncomes);
router.post("/createIncome", incomeController.createIncome);
router.put("/income", incomeController.updateIncome);
router.delete("/deleteIncome", incomeController.deleteIncome);
router.get("/expenses", expenseController.getBudgetExpenses);
router.post("/createExpense", expenseController.createExpense);
router.put("/updateExpense", expenseController.updateExpense);
router.delete("/deleteExpense", expenseController.deleteExpense);
router.get("/acceptExpense", expenseController.acceptExpense);
router.get("/rejectExpense", expenseController.rejectExpense);
router.get(
  "/availableSpendingLimits",
  budgetController.getAvailableSpendingLimits,
);
router.get("/goals", goalController.getGoals);
router.post("/createGoal", goalController.createGoal);
router.put("/updateGoal", goalController.updateGoal);
router.delete("/deleteADebitGoal", goalController.deleteADebitGoal);
router.delete(
  "/deleteAndReturnDebit",
  goalController.deleteAmountFromGoalToBudget,
);
router.put(
  "/deductAmountFromGoalToBudget",
  goalController.deductAmountFromGoalToBudget,
);
router.put("/updateIncomeHistory", budgetController.updateIncomeHistory);
router.put("/updateExpenseHistory", budgetController.updateExpenseHistory);
router.delete("/deleteIncomeHistory", budgetController.deleteIncomeHistoryItem);
router.delete(
  "/deleteExpenseHistory",
  budgetController.deleteExpenseHistoryItem,
);
router.get("/getUsersInBudget", budgetController.getUsersInBudget);
router.get("/user", userController.getUser);
router.get("/bars", budgetController.getBarsByUser);
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);
router.delete("/deleteUser", userController.deleteUser);
router.delete("/deleteBudget", budgetController.deleteBudgetByUserId);
router.put(
  "/confirmIncomeHistoryItem",
  budgetController.confirmIncomeHistoryItem,
);
router.put(
  "/confirmExpenseHistoryItem",
  budgetController.confirmExpenseHistoryItem,
);
router.put(
  "/pushAmountFromBudgetToGoal",
  goalController.pushAmountFromBudgetToGoal,
);
router.put(
  "/confirmAllIncomeHistoryItems",
  budgetController.confirmAllIncomeHistoryItems,
);
router.put(
  "/confirmAllExpenseHistoryItems",
  budgetController.confirmAllExpenseHistoryItems,
);
export default router;

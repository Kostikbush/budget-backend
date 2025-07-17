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

// /budgets
// Метод	Путь	Описание
// GET	/	Получить все бюджеты пользователя
// POST	/	Создать бюджет
// POST	/:id/invite	Пригласить пользователя
// POST	/:id/accept	Принять приглашение

// /incomes
// Метод	Путь	Описание
// POST	/	Создать доход
// GET	/budget/:budgetId	Доходы по бюджету
// PATCH	/:id/confirm	Подтвердить доход
// DELETE	/:id	Удалить доход

// /expenses
// Метод	Путь	Описание
// POST	/	Создать расход
// GET	/budget/:budgetId	Получить расходы
// PATCH	/:id/confirm	Подтвердить расход
// POST	/:id/approve	Одобрить общий расход
// DELETE	/:id	Удалить расход

// /goals
// Метод	Путь	Описание
// POST	/	Создать цель
// GET	/budget/:budgetId	Получить цели бюджета
// PATCH	/:id	Обновить цель
// DELETE	/:id	Удалить цель

// /notifications
// Метод	Путь	Описание
// GET	/	Получить все уведомления
// PATCH	/:id/read	Пометить как прочитанное

export default router;

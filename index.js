import mongoose from "mongoose";
import webpush from "web-push";
import app from "./app.js";
import { ExpenseHistoryModel } from "./models/expenseHistory.js";
import { IncomeHistoryModel } from "./models/incomeHistory.js";

let conn;
async function ensureReady() {
  if (!conn) {
    conn = mongoose
      .connect(process.env.DB_URL, {
        dbName: process.env.DB_BASE,
      })
      .catch((err) => {
        conn = undefined; // не кешируем неудачу
        console.error("Mongo connect failed:", err);
        throw err;
      });

    await ExpenseHistoryModel.updateMany({}, [
      { $set: { isConfirmed: { $ifNull: ["$isConfirmed", false] } } },
    ]);
    await IncomeHistoryModel.updateMany({}, [
      { $set: { isConfirmed: { $ifNull: ["$isConfirmed", false] } } },
    ]);
  }
  return conn;
}

export const ALLOWED = new Set([
  "https://budget-chi-vert.vercel.app",
  "http://localhost:3000",
  "https://localhost:3000",
  "https://localhost:3001",
  "https://budget-backend-kappa.vercel.app",
  "http://127.0.0.1:3000",
  "http://192.168.1.116:3000",
  "https://192.168.1.116:3000",
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ||
      "Content-Type,Authorization,X-Requested-With,X-CSRF-Token",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  // preflight не должен трогать БД
  if (req.method === "OPTIONS") {
    setCors(req, res);
    res.status(204).end();
    return;
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    await ensureReady(); // коннектимся только для «реальных» запросов
    return app(req, res); // передаём в Express
  } catch (err) {
    // даже при 500 вернём CORS, чтобы браузер показал тело
    setCors(req, res);
    console.error("Serverless error:", err);
    res
      .status(500)
      .json({ message: "Serverless error", details: err?.message });
  }
}

// index.js (ESM, @vercel/node serverless entry)
import mongoose from "mongoose";
import app from "./app.js";

// кэшируем одно подключение на воркер
let conn;
async function ensureReady() {
  if (!conn) {
    conn = mongoose
      .connect(process.env.DB_URL, {
        dbName: process.env.DB_BASE,
      })
      .catch((err) => {
        // не запоминаем неудачное обещание
        conn = undefined;
        console.error("Mongo connect failed:", err);
        throw err;
      });
  }
  return conn;
}

// быстрый ответ на preflight БЕЗ попытки соединения с БД
function setPreflightHeaders(req, res) {
  const origin = req.headers.origin;
  const allowed = new Set([
    "https://budget-chi-vert.vercel.app",
    "http://localhost:3000",
    "https://localhost:3000",
  ]);
  if (origin && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ||
      "Content-Type,Authorization,X-Requested-With,X-CSRF-Token"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setPreflightHeaders(req, res);
    res.status(204).end();
    return;
  }
  try {
    await ensureReady();
    return app(req, res); // отдаём управление Express
  } catch (err) {
    // чтобы браузер не порезал CORS даже при 500
    setPreflightHeaders(req, res);
    console.error("Serverless error:", err);
    res
      .status(500)
      .json({ message: "Serverless error", details: err?.message });
  }
}

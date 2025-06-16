import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import morgan from "morgan";

import router from "./router/index.js";

import { notificationMiddleware } from "./middleware/notification.js";

dotenv.config();

const PORT = process.env.PORT ?? 5000;
const app = express();

app.use(express.static("public"));

app.use(notificationMiddleware);

app.use(express.json());
app.use(morgan("dev"));

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "GET", "DELETE"].includes(req.method)) {
    console.log(`[BODY] ${req.method} ${req.originalUrl}:`, req.body);
  }
  next();
});

app.use(cookieParser());
app.use(cors());
app.use("/api", router);
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

const start = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);

    app.listen(PORT, () =>
      console.log(`Сервер Запущен на порту = ${PORT}!`)
    );
  } catch (e) {
    console.log(e);
  }
};

start();

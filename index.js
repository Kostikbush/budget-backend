import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import morgan from "morgan";

import router from "./router/index.js";

import { notificationMiddleware } from "./middleware/notification.js";
import { budgetSyncMiddleware } from "./middleware/budget.js";
// import { authMiddleware, csrfGuard, setCsrfCookie } from "./middleware/auth.js";

dotenv.config();

const PORT = process.env.PORT ?? 5000;
const app = express();

// const allowed = new Set([
//   "http://localhost:3000",
//   "http://127.0.0.1:3000",
//   "http://192.168.1.116:3000",
//   "https://localhost:3000",
// ]);

// const corsOptions = {
//   origin(origin, cb) {
//     if (!origin || allowed.has(origin)) return cb(null, true);
//     return cb(new Error(`CORS: origin not allowed: ${origin}`));
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: [
//     "Content-Type",
//     "Authorization",
//     "X-Requested-With",
//     "X-CSRF-Token",
//   ],
//   maxAge: 600,
//   optionsSuccessStatus: 204,
// };

// app.use(cors(corsOptions));
// app.options("*", cors(corsOptions));
// app.use(cookieParser());
// app.use(express.json());
// app.use((req, res, next) => {
//   if (["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.cookies?.csrf)
//     setCsrfCookie(res);
//   next();
// });
// app.get("/api/auth/csrf", (req, res) => {
//   if (!req.cookies?.csrf) setCsrfCookie(res);
//   return res.sendStatus(204); // без тела; кука уже установлена
// });
// app.use(authMiddleware);
// app.use(csrfGuard);

app.use((req, _, next) => {
  if (["POST", "PUT", "PATCH", "GET", "DELETE"].includes(req.method)) {
    console.log(`[BODY] ${req.method} ${req.originalUrl}:`, req.body);
  }
  next();
});

app.use(express.static("public"));
app.use(budgetSyncMiddleware);
app.use(notificationMiddleware);
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(cors());
app.use("/api", router);

const start = async () => {
  try {
    await mongoose.connect(process.env.DB_URL, {
      dbName: process.env.DB_BASE,
    });

    app.listen(PORT, () => console.log(`Сервер Запущен на порту = ${PORT}!`));
  } catch (e) {
    console.log(e);
  }
};

start();

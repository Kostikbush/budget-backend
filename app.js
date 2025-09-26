import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import router from "./router/index.js";

import { notificationMiddleware } from "./middleware/notification.js";
import { budgetSyncMiddleware } from "./middleware/budget.js";
import { authMiddleware, csrfGuard, setCsrfCookie } from "./middleware/auth.js";
import { ALLOWED } from "./index.js";

dotenv.config();

const app = express();

const corsOptions = {
  origin(origin, cb) {
    if (ALLOWED.has(origin) || !origin) return cb(null, true);
    return cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-CSRF-Token",
  ],
  maxAge: 600,
  optionsSuccessStatus: 204,
};

app.set("trust proxy", 1);
app.get("/api/_debug", (req, res) => {
  res.json({
    origin: req.get("Origin") || null,
    cookies: Object.keys(req.cookies || {}),
    has_at: Boolean(req.cookies?.at),
    has_rt: Boolean(req.cookies?.rt),
    user_agent: req.get("user-agent"),
    host: req.get("host"),
  });
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(cookieParser());
app.use(express.json());

app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.cookies?.csrf)
    setCsrfCookie(res);
  next();
});
app.get("/api/auth/csrf", (req, res) => {
  if (!req.cookies?.csrf) setCsrfCookie(res);
  return res.sendStatus(204); // без тела; кука уже установлена
});
app.use(authMiddleware);
app.use(csrfGuard);

app.use(express.static("public"));
app.use("/api/budget", budgetSyncMiddleware);
app.use(notificationMiddleware);
app.use(morgan("dev"));
app.use("/api", router);

app.use((err, req, res, next) => {
  console.log("app.use((err, req, res, next):", { err });
  if (err?.message?.startsWith("CORS:")) {
    if (!res.headersSent) {
      res.set("Vary", "Origin");
      const o = req.get("Origin");
      if (o && allowed.has(o)) {
        res.set("Access-Control-Allow-Origin", o);
        res.set("Access-Control-Allow-Credentials", "true");
      }
    }
    return res.status(403).json({ message: err.message });
  }
  console.log("ECONNRESET_1:", req.method, req.originalUrl);
  if (
    err &&
    (err.code === "ECONNRESET" || /ECONNRESET/i.test(err.message || ""))
  ) {
    console.log("ECONNRESET:", req.method, req.originalUrl);
    return;
  }
  if (res.headersSent) return next(err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
});

export default app;
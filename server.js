import dotenv from "dotenv";
import mongoose from "mongoose";
import webpush from "web-push";
import app from "./app.js";

dotenv.config();
const PORT = process.env.PORT ?? 4000;

const start = async () => {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  await mongoose.connect(process.env.DB_URL, { dbName: process.env.DB_BASE });
  app.listen(PORT, () => console.log(`Local: http://localhost:${PORT}`));
};
start();

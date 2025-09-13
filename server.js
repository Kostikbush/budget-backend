import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app.js";

dotenv.config();
const PORT = process.env.PORT ?? 4000;

const start = async () => {
  await mongoose.connect(process.env.DB_URL, { dbName: process.env.DB_BASE });
  app.listen(PORT, () => console.log(`Local: http://localhost:${PORT}`));
};
start();

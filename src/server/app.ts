import express, { type Express } from "express";
import { createLogger } from "./logger.js";

export function createApp(): Express;
export function createApp(logger: ReturnType<typeof createLogger>): Express;
export function createApp(logger?: ReturnType<typeof createLogger>): Express {
  const app = express();
  const resolvedLogger = logger ?? createLogger(process.env.NODE_ENV ?? "development");
  app.use(express.json());
  app.locals.logger = resolvedLogger;
  return app;
}

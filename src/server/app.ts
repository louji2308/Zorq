import express, { type Express } from "express";
import helmet from "helmet";
import { type ZorqConfig } from "./config.js";
import { buildHealthz } from "./healthz.js";
import { createLogger } from "./logger.js";
import { createErrorHandler, notFoundHandler } from "./middleware/errors.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { createRateLimiters, type RateLimitOverrides } from "./middleware/rateLimit.js";
import { registerRoutes } from "./routes.js";
import { DEFAULT_WEB_DIR, mountStaticWeb, resolveWebDirPath, webIndexPath } from "./staticWeb.js";

export interface CreateAppOptions {
  config?: ZorqConfig;
  rateLimits?: RateLimitOverrides;
  webDir?: string;
}

export function createApp(): Express;
export function createApp(logger: ReturnType<typeof createLogger>): Express;
export function createApp(logger: ReturnType<typeof createLogger>, options: CreateAppOptions): Express;
export function createApp(logger?: ReturnType<typeof createLogger>, options?: CreateAppOptions): Express {
  const app = express();
  const resolvedLogger = logger ?? createLogger(process.env.NODE_ENV ?? "development");
  const config = options?.config;
  const staticEnabled = (config?.nodeEnv ?? process.env.NODE_ENV) === "production";

  app.set("trust proxy", 1);
  app.locals.logger = resolvedLogger;

  app.use(requestIdMiddleware);
  app.use(helmet());

  const limiters = createRateLimiters(options?.rateLimits);
  app.use(limiters.general);
  app.use(limiters.mutating);

  app.use(express.json());

  const webDir = resolveWebDirPath(options?.webDir ?? DEFAULT_WEB_DIR);

  registerRoutes(app, {
    healthz: () =>
      buildHealthz({
        config,
        staticWeb: {
          enabled: staticEnabled,
          indexPath: webIndexPath(webDir)
        }
      })
  });

  if (staticEnabled) {
    mountStaticWeb(app, webDir);
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(resolvedLogger));
  return app;
}

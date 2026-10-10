import express, { type Express } from "express";
import helmet from "helmet";
import { type ZorqConfig } from "./config.js";
import { buildHealthz } from "./healthz.js";
import { createLogger } from "./logger.js";
import { createErrorHandler, notFoundHandler } from "./middleware/errors.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { createRateLimiters, type RateLimitOverrides } from "./middleware/rateLimit.js";
import type { Orchestrator } from "./orchestrator/index.js";
import type { RunStore } from "./persistence/index.js";
import { registerRoutes } from "./routes.js";
import { createEventHub, type EventHub } from "./sse/index.js";
import { DEFAULT_WEB_DIR, mountStaticWeb, resolveWebDirPath, webIndexPath } from "./staticWeb.js";

export interface CreateAppOptions {
  config?: ZorqConfig;
  rateLimits?: RateLimitOverrides;
  webDir?: string;
  orchestrator?: Orchestrator;
  store?: RunStore;
  eventHub?: EventHub;
  sseHeartbeatMs?: number;
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
  const eventHub = options?.eventHub ?? createEventHub();
  app.locals.sseHub = eventHub;

  registerRoutes(app, {
    healthz: () =>
      buildHealthz({
        config,
        staticWeb: {
          enabled: staticEnabled,
          indexPath: webIndexPath(webDir)
        }
      }),
    ...(options?.orchestrator !== undefined ? { orchestrator: options.orchestrator } : {}),
    ...(options?.store !== undefined ? { store: options.store } : {}),
    eventHub,
    ...(options?.sseHeartbeatMs !== undefined ? { sseHeartbeatMs: options.sseHeartbeatMs } : {})
  });

  if (staticEnabled) {
    mountStaticWeb(app, webDir);
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(resolvedLogger));
  return app;
}

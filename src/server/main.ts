import { existsSync } from "node:fs";
import { createApp } from "./app.js";
import { ConfigError, loadConfig, resolvePort, type ZorqConfig } from "./config.js";
import { createLogger } from "./logger.js";

const FALLBACK_PORT = 3000;

function readDotEnv(): void {
  try {
    if (existsSync(".env")) {
      process.loadEnvFile(".env");
    }
  } catch {
    process.stderr.write("warn: .env exists but could not be read; continuing without it\n");
  }
}

function bootstrap(): void {
  readDotEnv();
  let config: ZorqConfig | undefined;
  let configFailure: ConfigError | undefined;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      configFailure = error;
    } else {
      throw error;
    }
  }
  const logger = createLogger(config?.nodeEnv ?? process.env.NODE_ENV ?? "development");
  if (configFailure !== undefined) {
    process.stderr.write(`WARN degraded boot: ${configFailure.message}\n`);
    logger.warn(
      { variables: configFailure.issues.map((issue) => issue.variable) },
      "required configuration absent; /healthz reports 503 until it is fixed"
    );
  }
  const app = createApp(logger, config !== undefined ? { config } : {});
  const port = config !== undefined ? resolvePort(config) : FALLBACK_PORT;
  app.listen(port, () => {
    logger.info(
      { port, degraded: configFailure !== undefined },
      "zorq server listening"
    );
  });
}

bootstrap();

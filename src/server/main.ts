import { existsSync } from "node:fs";
import { createApp } from "./app.js";
import { ConfigError, loadConfig, resolvePort, type ZorqConfig } from "./config.js";
import { createLogger } from "./logger.js";

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
  let config: ZorqConfig;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`FATAL ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
  const logger = createLogger(config.nodeEnv);
  const app = createApp(logger);
  const port = resolvePort(config);
  app.listen(port, () => {
    logger.info({ port, baseUrl: config.appBaseUrl }, "zorq server listening");
  });
}

bootstrap();

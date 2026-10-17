import { existsSync } from "node:fs";
import { createDeepSeekLlmClient } from "./agent/llm.js";
import { createApp } from "./app.js";
import { createLogger } from "./logger.js";
import { ConfigError, loadConfig, resolveListenPort, type ZorqConfig } from "./config.js";
import { createOrchestrator } from "./orchestrator/index.js";
import { createRunStore } from "./persistence/index.js";
import { createQlooGateway, missingQlooConfiguration, type QlooGateway } from "./qloo/index.js";
import { createEventHub } from "./sse/index.js";

function readDotEnv(): void {
  try {
    if (existsSync(".env")) {
      process.loadEnvFile(".env");
    }
  } catch {
    process.stderr.write("warn: .env exists but could not be read; continuing without it\n");
  }
}

function unconfiguredGateway(): QlooGateway {
  const reject = (): Promise<never> =>
    Promise.reject(
      missingQlooConfiguration([
        { path: "env.QLOO_API_KEY", message: "required before the Qloo gateway can be used" }
      ])
    );
  return {
    capabilities: reject,
    search: reject,
    resolveTags: reject,
    insights: reject,
    describe: reject,
    bridge: reject,
    replace: reject,
    triangulate: reject,
    get stats() {
      return { budgetUsed: 0, budgetRemaining: 0, cacheSize: 0, cacheHits: 0 };
    },
    close: async () => {}
  };
}

async function bootstrap(): Promise<void> {
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

  const hub = createEventHub();
  const store = await createRunStore({
    tursoDatabaseUrl: config?.tursoDatabaseUrl,
    tursoAuthToken: config?.tursoAuthToken
  });
  const gateway = config !== undefined ? createQlooGateway({ config }) : unconfiguredGateway();
  const llm = createDeepSeekLlmClient({ apiKey: config?.deepseekApiKey });
  const orchestrator = createOrchestrator({
    store,
    gateway,
    llm,
    eventSink: (event) => {
      hub.publish(event);
    }
  });

  const app = createApp(logger, {
    ...(config !== undefined ? { config } : {}),
    store,
    orchestrator,
    eventHub: hub
  });
  const listenPort = resolveListenPort(process.env, config);
  if (listenPort.invalidWarning !== undefined) {
    process.stderr.write(`WARN ${listenPort.invalidWarning}\n`);
    logger.warn({ port: listenPort.port }, listenPort.invalidWarning);
  }
  app.listen(listenPort.port, () => {
    logger.info(
      { port: listenPort.port, portSource: listenPort.source, degraded: configFailure !== undefined },
      "zorq server listening"
    );
  });
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

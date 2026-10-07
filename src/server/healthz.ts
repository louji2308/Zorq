import { existsSync } from "node:fs";
import { ConfigError, loadConfig, type ZorqConfig } from "./config.js";
import { STATIC_BUILD_MISSING_MESSAGE } from "./staticWeb.js";
import type { HealthzResponse } from "../shared/routes.js";
import { packageVersion } from "./version.js";

export interface HealthzInput {
  config: ZorqConfig | undefined;
  staticWeb: {
    enabled: boolean;
    indexPath: string;
  };
}

export type HealthzResult =
  | { status: 200; body: HealthzResponse }
  | { status: 503; message: string };

const KNOWN_NODE_ENVS: ReadonlySet<string> = new Set(["development", "test", "production"]);

function requiredConfigProblems(config: ZorqConfig | undefined): string[] {
  if (config !== undefined) {
    const problems: string[] = [];
    if (config.appBaseUrl === "") {
      problems.push("APP_BASE_URL");
    }
    if (!KNOWN_NODE_ENVS.has(config.nodeEnv)) {
      problems.push("NODE_ENV");
    }
    return problems;
  }
  try {
    loadConfig(process.env);
    return [];
  } catch (error) {
    if (error instanceof ConfigError) {
      return error.issues.map((issue) => issue.variable);
    }
    throw error;
  }
}

export function buildHealthz(input: HealthzInput): HealthzResult {
  const problems = requiredConfigProblems(input.config);
  if (problems.length > 0) {
    return {
      status: 503,
      message: `Required configuration is absent or invalid: ${problems.join(", ")}. Fix the server environment (see .env.example); no values are reported.`
    };
  }
  const staticBuild = input.staticWeb.enabled
    ? existsSync(input.staticWeb.indexPath)
      ? "ok"
      : "missing"
    : "skipped";
  if (staticBuild === "missing") {
    return {
      status: 503,
      message: STATIC_BUILD_MISSING_MESSAGE
    };
  }
  return {
    status: 200,
    body: {
      status: "ok",
      service: "zorq",
      version: packageVersion(),
      checks: { config: "ok", staticBuild }
    }
  };
}

export type NodeEnv = "development" | "test" | "production";

export interface ZorqConfig {
  nodeEnv: NodeEnv;
  appBaseUrl: string;
  llmBudgetUsd: number;
  maxQlooCalls: number;
  qlooConcurrency: number;
  qlooCacheTtlSec: number;
  persistQlooDerived: boolean;
  qlooApiKey: string | undefined;
  deepseekApiKey: string | undefined;
  tursoDatabaseUrl: string | undefined;
  tursoAuthToken: string | undefined;
  viteMaptilerKey: string | undefined;
}

export interface ConfigIssue {
  variable: string;
  expected: string;
  received?: string;
}

export const LOCK_LLM_BUDGET_USD = 2;
export const LOCK_MAX_QLOO_CALLS = 180;
export const LOCK_QLOO_CONCURRENCY = 8;

export const LOCKED_DEFAULTS = {
  llmBudgetUsd: LOCK_LLM_BUDGET_USD,
  maxQlooCalls: LOCK_MAX_QLOO_CALLS,
  qlooConcurrency: 6,
  qlooCacheTtlSec: 21600,
  persistQlooDerived: false
} as const;

const NODE_ENV_VALUES: readonly NodeEnv[] = ["development", "test", "production"];

export function formatConfigIssues(issues: readonly ConfigIssue[]): string {
  const parts = issues.map((issue) =>
    issue.received === undefined
      ? `${issue.variable}: ${issue.expected}`
      : `${issue.variable}: ${issue.expected} (received ${JSON.stringify(issue.received)})`
  );
  return `invalid configuration: ${parts.join("; ")}`;
}

export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(formatConfigIssues(issues));
    this.name = "ConfigError";
    this.issues = issues;
  }
}

function readString(env: Record<string, string | undefined>, variable: string): string | undefined {
  const raw = env[variable];
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function readNodeEnv(env: Record<string, string | undefined>, issues: ConfigIssue[]): NodeEnv {
  const value = readString(env, "NODE_ENV");
  const accepted = NODE_ENV_VALUES.map((entry) => JSON.stringify(entry)).join(", ");
  if (value === undefined) {
    issues.push({
      variable: "NODE_ENV",
      expected: `required at start; one of ${accepted}`
    });
    return "development";
  }
  if ((NODE_ENV_VALUES as readonly string[]).includes(value)) {
    return value as NodeEnv;
  }
  issues.push({
    variable: "NODE_ENV",
    expected: `one of ${accepted}`,
    received: value
  });
  return "development";
}

function readBaseUrl(env: Record<string, string | undefined>, issues: ConfigIssue[]): string {
  const expected = "an absolute http(s) URL such as http://localhost:3000";
  const value = readString(env, "APP_BASE_URL");
  if (value === undefined) {
    issues.push({ variable: "APP_BASE_URL", expected: `required at start; ${expected}` });
    return "";
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      issues.push({ variable: "APP_BASE_URL", expected, received: value });
      return "";
    }
    return value;
  } catch {
    issues.push({ variable: "APP_BASE_URL", expected, received: value });
    return "";
  }
}

function readBoundedNumber(
  env: Record<string, string | undefined>,
  variable: string,
  options: { ceiling: number; floor: number; fallback: number; qualifier?: string },
  issues: ConfigIssue[]
): number {
  const value = readString(env, variable);
  if (value === undefined) {
    return options.fallback;
  }
  const qualifier = options.qualifier === undefined ? "" : ` (${options.qualifier})`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    issues.push({ variable, expected: `a number ≤ ${options.ceiling}${qualifier}`, received: value });
    return options.fallback;
  }
  if (parsed > options.ceiling) {
    issues.push({
      variable,
      expected: `a number ≤ ${options.ceiling}${qualifier}`,
      received: value
    });
    return options.fallback;
  }
  if (parsed < options.floor) {
    issues.push({ variable, expected: `a number ≥ ${options.floor}`, received: value });
    return options.fallback;
  }
  return parsed;
}

function readBoundedInteger(
  env: Record<string, string | undefined>,
  variable: string,
  options: { ceiling: number | undefined; floor: number; fallback: number; qualifier?: string },
  issues: ConfigIssue[]
): number {
  const value = readString(env, variable);
  if (value === undefined) {
    return options.fallback;
  }
  const qualifier = options.qualifier === undefined ? "" : ` (${options.qualifier})`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    issues.push({
      variable,
      expected: `an integer${options.ceiling === undefined ? "" : ` ≤ ${options.ceiling}`}${qualifier}`,
      received: value
    });
    return options.fallback;
  }
  if (!Number.isInteger(parsed)) {
    issues.push({ variable, expected: `an integer${qualifier}`, received: value });
    return options.fallback;
  }
  if (options.ceiling !== undefined && parsed > options.ceiling) {
    issues.push({
      variable,
      expected: `an integer ≤ ${options.ceiling}${qualifier}`,
      received: value
    });
    return options.fallback;
  }
  if (parsed < options.floor) {
    issues.push({ variable, expected: `an integer ≥ ${options.floor}`, received: value });
    return options.fallback;
  }
  return parsed;
}

function readBoolean(
  env: Record<string, string | undefined>,
  variable: string,
  fallback: boolean,
  issues: ConfigIssue[]
): boolean {
  const value = readString(env, variable);
  if (value === undefined) {
    return fallback;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  issues.push({ variable, expected: 'either "true" or "false"', received: value });
  return fallback;
}

function readOptionalUrl(
  env: Record<string, string | undefined>,
  variable: string,
  issues: ConfigIssue[]
): string | undefined {
  const value = readString(env, variable);
  if (value === undefined) {
    return undefined;
  }
  try {
    new URL(value);
    return value;
  } catch {
    issues.push({ variable, expected: "a valid absolute URL", received: value });
    return undefined;
  }
}

function readOptionalSecret(env: Record<string, string | undefined>, variable: string): string | undefined {
  return readString(env, variable);
}

export function resolvePort(config: ZorqConfig): number {
  const url = new URL(config.appBaseUrl);
  if (url.port !== "") {
    return Number(url.port);
  }
  return 3000;
}

export function loadConfig(env: Record<string, string | undefined>): ZorqConfig {
  const issues: ConfigIssue[] = [];

  const nodeEnv = readNodeEnv(env, issues);
  const appBaseUrl = readBaseUrl(env, issues);
  const llmBudgetUsd = readBoundedNumber(
    env,
    "LLM_BUDGET_USD",
    { ceiling: LOCK_LLM_BUDGET_USD, floor: 0, fallback: LOCKED_DEFAULTS.llmBudgetUsd, qualifier: "locked budget" },
    issues
  );
  const maxQlooCalls = readBoundedInteger(
    env,
    "MAX_QLOO_CALLS",
    { ceiling: LOCK_MAX_QLOO_CALLS, floor: 1, fallback: LOCKED_DEFAULTS.maxQlooCalls, qualifier: "locked call target" },
    issues
  );
  const qlooConcurrency = readBoundedInteger(
    env,
    "QLOO_CONCURRENCY",
    { ceiling: LOCK_QLOO_CONCURRENCY, floor: 1, fallback: LOCKED_DEFAULTS.qlooConcurrency, qualifier: "locked concurrency ceiling" },
    issues
  );
  const qlooCacheTtlSec = readBoundedInteger(
    env,
    "QLOO_CACHE_TTL_SEC",
    { ceiling: undefined, floor: 0, fallback: LOCKED_DEFAULTS.qlooCacheTtlSec },
    issues
  );
  const persistQlooDerived = readBoolean(env, "PERSIST_QLOO_DERIVED", LOCKED_DEFAULTS.persistQlooDerived, issues);
  const tursoDatabaseUrl = readOptionalUrl(env, "TURSO_DATABASE_URL", issues);

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  return Object.freeze({
    nodeEnv,
    appBaseUrl,
    llmBudgetUsd,
    maxQlooCalls,
    qlooConcurrency,
    qlooCacheTtlSec,
    persistQlooDerived,
    qlooApiKey: readOptionalSecret(env, "QLOO_API_KEY"),
    deepseekApiKey: readOptionalSecret(env, "DEEPSEEK_API_KEY"),
    tursoDatabaseUrl,
    tursoAuthToken: readOptionalSecret(env, "TURSO_AUTH_TOKEN"),
    viteMaptilerKey: readOptionalSecret(env, "VITE_MAPTILER_KEY")
  });
}

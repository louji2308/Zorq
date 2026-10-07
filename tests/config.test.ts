import { describe, expect, it } from "vitest";
import {
  ConfigError,
  LOCKED_DEFAULTS,
  LOCK_LLM_BUDGET_USD,
  LOCK_MAX_QLOO_CALLS,
  LOCK_QLOO_CONCURRENCY,
  loadConfig
} from "../src/server/config.js";

const BASE = { NODE_ENV: "development", APP_BASE_URL: "http://localhost:3000" };

describe("loadConfig", () => {
  it("throws a typed ConfigError naming every missing required variable", () => {
    let caught: unknown;
    try {
      loadConfig({});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const configError = caught as ConfigError;
    expect(configError.message).toContain("NODE_ENV");
    expect(configError.message).toContain("APP_BASE_URL");
    expect(configError.message).toContain("required at start");
    expect(configError.message).toContain("http://localhost:3000");
    expect(configError.issues.map((issue) => issue.variable)).toEqual(["NODE_ENV", "APP_BASE_URL"]);
  });

  it("rejects a bad NODE_ENV enum with a clear error", () => {
    let caught: unknown;
    try {
      loadConfig({ ...BASE, NODE_ENV: "staging" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const configError = caught as ConfigError;
    expect(configError.message).toContain("NODE_ENV");
    expect(configError.message).toContain('"development", "test", "production"');
    expect(configError.message).toContain("staging");
  });

  it("rejects a non-URL APP_BASE_URL", () => {
    const env = { NODE_ENV: "development", APP_BASE_URL: "localhost:3000" };
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/APP_BASE_URL/);
  });

  it("rejects budgets above the locked ceilings and names every offender", () => {
    let caught: unknown;
    try {
      loadConfig({
        ...BASE,
        LLM_BUDGET_USD: "5",
        MAX_QLOO_CALLS: "500",
        QLOO_CONCURRENCY: "12"
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const configError = caught as ConfigError;
    expect(configError.issues.map((issue) => issue.variable).sort()).toEqual([
      "LLM_BUDGET_USD",
      "MAX_QLOO_CALLS",
      "QLOO_CONCURRENCY"
    ]);
    expect(configError.message).toContain(`LLM_BUDGET_USD: a number ≤ ${LOCK_LLM_BUDGET_USD}`);
    expect(configError.message).toContain(`MAX_QLOO_CALLS: an integer ≤ ${LOCK_MAX_QLOO_CALLS}`);
    expect(configError.message).toContain(`QLOO_CONCURRENCY: an integer ≤ ${LOCK_QLOO_CONCURRENCY}`);
    expect(configError.message).toContain('"5"');
    expect(configError.message).toContain('"500"');
    expect(configError.message).toContain('"12"');
  });

  it("rejects non-numeric and non-boolean budget values", () => {
    expect(() => loadConfig({ ...BASE, LLM_BUDGET_USD: "plenty" })).toThrow(/LLM_BUDGET_USD: a number/);
    expect(() => loadConfig({ ...BASE, MAX_QLOO_CALLS: "many" })).toThrow(/MAX_QLOO_CALLS: an integer/);
    expect(() => loadConfig({ ...BASE, PERSIST_QLOO_DERIVED: "yes" })).toThrow(
      /PERSIST_QLOO_DERIVED: either "true" or "false"/
    );
  });

  it("collects all offenders in one thrown error", () => {
    let caught: unknown;
    try {
      loadConfig({ LLM_BUDGET_USD: "9", NODE_ENV: "qa" });
    } catch (error) {
      caught = error;
    }
    const configError = caught as ConfigError;
    expect(configError.issues).toHaveLength(3);
    expect(configError.message).toContain("APP_BASE_URL");
    expect(configError.message).toContain("NODE_ENV");
    expect(configError.message).toContain("LLM_BUDGET_USD");
  });

  it("parses a valid set with locked defaults and optional secrets absent", () => {
    const config = loadConfig(BASE);
    expect(config).toEqual({
      nodeEnv: "development",
      appBaseUrl: "http://localhost:3000",
      llmBudgetUsd: LOCKED_DEFAULTS.llmBudgetUsd,
      maxQlooCalls: LOCKED_DEFAULTS.maxQlooCalls,
      qlooConcurrency: LOCKED_DEFAULTS.qlooConcurrency,
      qlooCacheTtlSec: LOCKED_DEFAULTS.qlooCacheTtlSec,
      persistQlooDerived: LOCKED_DEFAULTS.persistQlooDerived,
      qlooApiKey: undefined,
      deepseekApiKey: undefined,
      tursoDatabaseUrl: undefined,
      tursoAuthToken: undefined,
      viteMaptilerKey: undefined
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("keeps secrets optional in Phase 2 but carries them through when present", () => {
    const config = loadConfig({
      ...BASE,
      NODE_ENV: "test",
      QLOO_API_KEY: "test-qloo-key",
      DEEPSEEK_API_KEY: "",
      TURSO_DATABASE_URL: "libsql://zorq.turso.io",
      TURSO_AUTH_TOKEN: "test-token",
      VITE_MAPTILER_KEY: "public-map-key"
    });
    expect(config.nodeEnv).toBe("test");
    expect(config.qlooApiKey).toBe("test-qloo-key");
    expect(config.deepseekApiKey).toBeUndefined();
    expect(config.tursoDatabaseUrl).toBe("libsql://zorq.turso.io");
    expect(config.tursoAuthToken).toBe("test-token");
    expect(config.viteMaptilerKey).toBe("public-map-key");
  });

  it("accepts explicit budget values up to the locks", () => {
    const config = loadConfig({
      ...BASE,
      LLM_BUDGET_USD: "1.25",
      MAX_QLOO_CALLS: "180",
      QLOO_CONCURRENCY: "8",
      QLOO_CACHE_TTL_SEC: "3600",
      PERSIST_QLOO_DERIVED: "true"
    });
    expect(config.llmBudgetUsd).toBe(1.25);
    expect(config.maxQlooCalls).toBe(180);
    expect(config.qlooConcurrency).toBe(8);
    expect(config.qlooCacheTtlSec).toBe(3600);
    expect(config.persistQlooDerived).toBe(true);
  });

  it("rejects a malformed Turso URL when provided", () => {
    expect(() => loadConfig({ ...BASE, TURSO_DATABASE_URL: "not a url" })).toThrow(/TURSO_DATABASE_URL/);
  });
});

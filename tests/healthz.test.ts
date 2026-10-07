import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { loadConfig } from "../src/server/config.js";
import { createLogger } from "../src/server/logger.js";
import { apiErrorBodySchema, healthzResponseSchema } from "../src/shared/index.js";
import { startServer } from "./support/http.js";

const FAKE_SECRETS = [
  "sk-zorq-unit-test-key-0001",
  "hack_test_qloo_key_do_not_leak",
  "turso-auth-token-unit-test-0001",
  "maptiler-unit-test-key-0001"
];

const SECRET_ENV_NAMES = [
  "QLOO_API_KEY",
  "DEEPSEEK_API_KEY",
  "TURSO_AUTH_TOKEN",
  "TURSO_DATABASE_URL",
  "VITE_MAPTILER_KEY"
];

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("GET /healthz (ARCHITECTURE.md 3.1)", () => {
  it("returns 200 with schema-valid checks and provably no key material when config is present", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      APP_BASE_URL: "http://localhost:3000",
      QLOO_API_KEY: FAKE_SECRETS[0],
      DEEPSEEK_API_KEY: FAKE_SECRETS[1],
      TURSO_AUTH_TOKEN: FAKE_SECRETS[2],
      VITE_MAPTILER_KEY: FAKE_SECRETS[3]
    });
    const server = await startServer(createApp(createLogger("test"), { config }));
    try {
      const response = await fetch(`${server.baseUrl}/healthz`);
      expect(response.status).toBe(200);

      const body: unknown = await response.json();
      const parsed = healthzResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe("ok");
        expect(parsed.data.service).toBe("zorq");
        expect(parsed.data.version.length).toBeGreaterThan(0);
        expect(Object.keys(parsed.data.checks).length).toBeGreaterThan(0);
        expect(parsed.data.checks.config).toBe("ok");
      }

      const raw = JSON.stringify(body);
      for (const secret of FAKE_SECRETS) {
        expect(raw).not.toContain(secret);
      }
      expect(raw).not.toContain("sk-");
      expect(raw).not.toContain("hack_");
      for (const name of SECRET_ENV_NAMES) {
        const value = process.env[name];
        if (value !== undefined && value.length >= 4 && raw.includes(value)) {
          throw new Error(`healthz body leaked environment variable ${name}`);
        }
      }
    } finally {
      await server.close();
    }
  });

  it("returns 503 SERVICE_UNAVAILABLE naming the missing variables when config is absent", async () => {
    const app = createApp(createLogger("test"), {});
    const server = await startServer(app);
    const savedEnv: Record<string, string | undefined> = {
      NODE_ENV: process.env.NODE_ENV,
      APP_BASE_URL: process.env.APP_BASE_URL
    };
    try {
      delete process.env.NODE_ENV;
      delete process.env.APP_BASE_URL;

      const response = await fetch(`${server.baseUrl}/healthz`);
      expect(response.status).toBe(503);

      const body: unknown = await response.json();
      expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
      const parsed = body as { error: { code: string; message: string; requestId: string } };
      expect(parsed.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(parsed.error.message).toContain("APP_BASE_URL");
      expect(parsed.error.message).toContain("NODE_ENV");
      expect(parsed.error.requestId.length).toBeGreaterThan(0);
    } finally {
      restoreEnv(savedEnv);
      await server.close();
    }
  });
});

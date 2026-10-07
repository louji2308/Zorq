import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { loadConfig, type ZorqConfig } from "../src/server/config.js";
import { createLogger } from "../src/server/logger.js";
import { createErrorHandler } from "../src/server/middleware/errors.js";
import { requestIdMiddleware } from "../src/server/middleware/requestId.js";
import { validate } from "../src/server/middleware/validate.js";
import { ApiError, apiErrorBodySchema, runIdParamsSchema } from "../src/shared/index.js";
import { startServer, type RunningServer } from "./support/http.js";

function testConfig(): ZorqConfig {
  return loadConfig({ NODE_ENV: "test", APP_BASE_URL: "http://localhost:3000" });
}

const VALID_BRIEF = {
  location: "Lisbon, Portugal",
  objective: "A late-night listening bar that feels local"
};

describe("server HTTP contract (ARCHITECTURE.md 3.0)", () => {
  let shared: RunningServer;

  beforeAll(async () => {
    shared = await startServer(createApp(createLogger("test"), { config: testConfig() }));
  });

  afterAll(async () => {
    await shared.close();
  });

  it("d. sets Helmet security headers on responses", async () => {
    const response = await fetch(`${shared.baseUrl}/healthz`);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("e. rejects an invalid POST /api/runs body with 400 VALIDATION_FAILED and body-prefixed paths", async () => {
    const response = await fetch(`${shared.baseUrl}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    expect(response.status).toBe(400);

    const body: unknown = await response.json();
    expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
    const parsed = body as { error: { code: string; details?: { path: string }[]; requestId: string } };
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
    expect(Array.isArray(parsed.error.details)).toBe(true);
    expect(parsed.error.details?.length).toBeGreaterThan(0);
    expect(parsed.error.details?.[0]?.path.startsWith("body.")).toBe(true);
    expect(parsed.error.requestId.length).toBeGreaterThan(0);
  });

  it("f. accepts a valid brief but answers honestly with 503 naming Phase 5 (no pretend run)", async () => {
    const response = await fetch(`${shared.baseUrl}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_BRIEF)
    });
    expect(response.status).toBe(503);

    const body: unknown = await response.json();
    expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
    const parsed = body as { error: { code: string; message: string; requestId: string }; run?: unknown };
    expect(Object.keys(parsed)).toEqual(["error"]);
    expect(parsed.run).toBeUndefined();
    expect(parsed.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(parsed.error.message).toContain("Phase 5");
    expect(parsed.error).not.toHaveProperty("id");
    expect(JSON.stringify(body)).not.toMatch(/"run"\s*:/);
    expect(JSON.stringify(body)).not.toMatch(/run_[A-Za-z0-9]/);
  });

  it("g. answers an unknown /api/* route with a typed 404 body", async () => {
    // Spec ambiguity flagged for handoff: 3.0 defines no generic route-not-found
    // code, so the implemented mapping is RUN_NOT_FOUND (404). No new codes added.
    const response = await fetch(`${shared.baseUrl}/api/nope`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body: unknown = await response.json();
    expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
    const parsed = body as { error: { code: string; requestId: string } };
    expect(parsed.error.code).toBe("RUN_NOT_FOUND");
    expect(parsed.error.requestId.length).toBeGreaterThan(0);
  });

  it("h. returns 429 RATE_LIMITED once the overridden per-IP limit is exhausted", async () => {
    const server = await startServer(
      createApp(createLogger("test"), {
        config: testConfig(),
        rateLimits: { general: { limit: 2 }, mutating: { limit: 2 } }
      })
    );
    try {
      const first = await fetch(`${server.baseUrl}/healthz`);
      const second = await fetch(`${server.baseUrl}/healthz`);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const third = await fetch(`${server.baseUrl}/healthz`);
      expect(third.status).toBe(429);
      const body: unknown = await third.json();
      expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
      expect((body as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
    } finally {
      await server.close();
    }
  });

  it("j. maps an unexpected handler throw to typed 500 INTERNAL without leaking message or stack", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/boom", () => {
      throw new Error("THROWN_MARKER_must_not_leak");
    });
    app.use(createErrorHandler(createLogger("test")));

    const server = await startServer(app);
    try {
      const response = await fetch(`${server.baseUrl}/boom`);
      expect(response.status).toBe(500);

      const text = await response.text();
      expect(text).not.toContain("THROWN_MARKER_must_not_leak");
      expect(text).not.toContain(".ts:");

      const body = JSON.parse(text) as { error: { code: string; message: string; requestId: string } };
      expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
      expect(body.error.code).toBe("INTERNAL");
      expect(body.error.message).toBe("Internal server error");
      expect(body.error.requestId).toBe(response.headers.get("x-request-id"));
    } finally {
      await server.close();
    }
  });
});

describe("malformed :id (ARCHITECTURE.md 3.3)", () => {
  it("maps an empty id to 400 VALIDATION_FAILED with params-prefixed details at the boundary", () => {
    const handler = validate({ params: runIdParamsSchema });
    let captured: unknown;
    const req = { params: { id: "" } } as unknown as Parameters<typeof handler>[0];
    const res = {} as unknown as Parameters<typeof handler>[1];
    handler(req, res, (error: unknown) => {
      captured = error;
    });

    expect(captured).toBeInstanceOf(ApiError);
    const apiError = captured as ApiError;
    expect(apiError.code).toBe("VALIDATION_FAILED");
    expect(apiError.status).toBe(400);
    expect(apiError.details?.[0]?.path.startsWith("params")).toBe(true);
  });

  it("keeps routable ids permissive until Phase 5 fixes the id format (flagged spec ambiguity)", async () => {
    // runIdParamsSchema is deliberately min(1) because Phase 5 has not fixed the id
    // format. Express 5 requires :id to match at least one character, so an empty id
    // cannot be produced over HTTP (verified empirically) — the 400 path is covered
    // by the boundary test above. A space-only id therefore reaches the honest
    // Phase-5 unimplemented answer rather than a fabricated 404 or a premature 400.
    const server = await startServer(createApp(createLogger("test"), { config: testConfig() }));
    try {
      const response = await fetch(`${server.baseUrl}/api/runs/%20`);
      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(body.error.message).toContain("Phase 5");
    } finally {
      await server.close();
    }
  });
});

describe("production static serving and SPA fallback (ARCHITECTURE.md 3.0 security baseline)", () => {
  let webDir = "";
  let server: RunningServer;

  beforeAll(async () => {
    webDir = mkdtempSync(join(tmpdir(), "zorq-web-"));
    mkdirSync(join(webDir, "assets"));
    writeFileSync(
      join(webDir, "index.html"),
      '<!doctype html><html><body><div id="root"></div><!-- SPA_FIXTURE_MARKER --></body></html>'
    );
    writeFileSync(join(webDir, "assets", "app-abc123.js"), 'console.log("fixture");\n');

    const config = loadConfig({ NODE_ENV: "production", APP_BASE_URL: "http://localhost:3000" });
    server = await startServer(createApp(createLogger("test"), { config, webDir }));
  });

  afterAll(async () => {
    await server.close();
    if (webDir !== "") {
      rmSync(webDir, { recursive: true, force: true });
    }
  });

  it("serves index.html for unknown client routes with a no-cache header", async () => {
    const response = await fetch(`${server.baseUrl}/run/whatever`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toContain("no-cache");
    const html = await response.text();
    expect(html).toContain("SPA_FIXTURE_MARKER");
  });

  it("serves hashed assets with an immutable cache header", async () => {
    const response = await fetch(`${server.baseUrl}/assets/app-abc123.js`);
    expect(response.status).toBe(200);
    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("immutable");
    expect(cacheControl).toContain("max-age=31536000");
  });

  it("never lets the SPA fallback swallow unknown /api/* routes", async () => {
    const response = await fetch(`${server.baseUrl}/api/nope`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    const text = await response.text();
    expect(text).not.toContain("SPA_FIXTURE_MARKER");
    const body = JSON.parse(text) as { error: { code: string } };
    expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
    expect(body.error.code).toBe("RUN_NOT_FOUND");
  });

  it("reports the production static build check as ok in /healthz", async () => {
    const response = await fetch(`${server.baseUrl}/healthz`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { checks: Record<string, string> };
    expect(body.checks.staticBuild).toBe("ok");
  });
});

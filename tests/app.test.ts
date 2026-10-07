import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { loadConfig, resolvePort } from "../src/server/config.js";
import { createLogger } from "../src/server/logger.js";

describe("createApp", () => {
  it("returns an Express app wired with JSON parsing and a logger", () => {
    const app = createApp(createLogger("test"));
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe("function");
    expect(app.locals.logger).toBeDefined();
    expect(typeof app.locals.logger.info).toBe("function");
  });

  it("creates a default logger when none is passed", () => {
    const app = createApp();
    expect(app.locals.logger).toBeDefined();
  });
});

describe("resolvePort", () => {
  it("derives the listen port from APP_BASE_URL", () => {
    const env = (APP_BASE_URL: string) => ({ NODE_ENV: "development", APP_BASE_URL });
    expect(resolvePort(loadConfig(env("http://localhost:3000")))).toBe(3000);
    expect(resolvePort(loadConfig(env("https://zorq.example")))).toBe(3000);
    expect(resolvePort(loadConfig(env("http://localhost:8080")))).toBe(8080);
  });
});

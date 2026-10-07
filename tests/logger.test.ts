import type { DestinationStream } from "pino";
import { describe, expect, it } from "vitest";
import { createLogger, logLevelFor } from "../src/server/logger.js";

function collectStream(): { stream: DestinationStream; chunks: () => string[] } {
  const chunks: string[] = [];
  return {
    stream: {
      write: (chunk: string) => {
        chunks.push(String(chunk));
      }
    },
    chunks: () => chunks
  };
}

describe("createLogger", () => {
  it("derives the level from NODE_ENV", () => {
    expect(logLevelFor("development")).toBe("debug");
    expect(logLevelFor("test")).toBe("silent");
    expect(logLevelFor("production")).toBe("info");
    expect(logLevelFor("unknown")).toBe("debug");
  });

  it("creates a logger at the derived level", () => {
    expect(createLogger("production").level).toBe("info");
    expect(createLogger("development").level).toBe("debug");
    expect(createLogger("test").level).toBe("silent");
  });

  it("redacts key-like fields at the top level and nested", () => {
    const capture = collectStream();
    const logger = createLogger("development", capture.stream);
    logger.info({ apiKey: "qloo-secret-value", nested: { api_key: "deepseek-secret-value" } }, "wiring check");
    const output = capture.chunks().join("");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("qloo-secret-value");
    expect(output).not.toContain("deepseek-secret-value");
    expect(output).toContain("wiring check");
  });

  it("redacts authorization headers", () => {
    const capture = collectStream();
    const logger = createLogger("development", capture.stream);
    logger.info({ req: { headers: { authorization: "Bearer abc123" } } }, "request");
    const output = capture.chunks().join("");
    expect(output).not.toContain("abc123");
    expect(output).toContain("[REDACTED]");
  });
});

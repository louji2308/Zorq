import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { apiErrorBodySchema } from "../src/shared/index.js";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIST_MAIN = join(REPO_ROOT, "dist", "server", "main.js");

// Degraded boot listens on the fixed fallback port 3000 (config is absent, so the
// port cannot be derived from APP_BASE_URL).
const FALLBACK_PORT = 3000;

const STRIPPED_ENV_KEYS = [
  "NODE_ENV",
  "APP_BASE_URL",
  "QLOO_API_KEY",
  "DEEPSEEK_API_KEY",
  "TURSO_AUTH_TOKEN",
  "TURSO_DATABASE_URL",
  "VITE_MAPTILER_KEY"
];

function childEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  for (const key of STRIPPED_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => {
      probe.close(() => resolve(true));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("degraded boot of dist/server/main.js (ARCHITECTURE.md 3.1)", () => {
  it(
    "serves /healthz as 503 naming the missing variables without exiting the process",
    async (ctx) => {
      if (!existsSync(DIST_MAIN)) {
        ctx.skip("dist/server/main.js is missing — run `npm run build` before `npm test`");
      }
      if (!(await isPortFree(FALLBACK_PORT))) {
        ctx.skip("port 3000 is busy — degraded boot uses the fixed fallback port 3000");
      }

      // cwd is a fresh temp directory so no `.env` can be found and config is absent.
      const tempCwd = mkdtempSync(join(tmpdir(), "zorq-degraded-boot-"));
      const stderrChunks: Buffer[] = [];
      const stdoutChunks: Buffer[] = [];
      const child = spawn(process.execPath, [DIST_MAIN], {
        cwd: tempCwd,
        env: childEnv(),
        stdio: ["ignore", "pipe", "pipe"]
      });
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));

      try {
        let response: Response | undefined;
        const deadline = Date.now() + 15_000;
        while (Date.now() < deadline && child.exitCode === null) {
          try {
            response = await fetch(`http://127.0.0.1:${FALLBACK_PORT}/healthz`);
            break;
          } catch {
            await sleep(200);
          }
        }

        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        if (response === undefined) {
          throw new Error(
            `server never became reachable. exitCode=${String(child.exitCode)} stderr=${stderr} stdout=${stdout}`
          );
        }

        expect(response.status).toBe(503);
        const body: unknown = await response.json();
        expect(apiErrorBodySchema.safeParse(body).success).toBe(true);
        const parsed = body as { error: { code: string; message: string; requestId: string } };
        expect(parsed.error.code).toBe("SERVICE_UNAVAILABLE");
        expect(parsed.error.message).toContain("APP_BASE_URL");
        expect(parsed.error.message).toContain("NODE_ENV");
        expect(parsed.error.requestId.length).toBeGreaterThan(0);

        expect(stderr).toContain("degraded boot");
        expect(stderr).toContain("APP_BASE_URL");
        expect(stderr).toContain("NODE_ENV");

        expect(child.exitCode, "degraded boot must keep serving, not exit(1)").toBeNull();
      } finally {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill();
        }
        if (child.exitCode === null) {
          await Promise.race([once(child, "close"), sleep(5_000)]);
          if (child.exitCode === null && child.signalCode === null) {
            child.kill();
          }
        }
        rmSync(tempCwd, { recursive: true, force: true });
      }
    },
    30_000
  );
});

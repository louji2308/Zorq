import { readFileSync } from "node:fs";

let cachedVersion: string | undefined;

function readVersion(): string {
  try {
    const raw = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const version = (parsed as { version?: unknown }).version;
      if (typeof version === "string" && version.length > 0) {
        return version;
      }
    }
  } catch {
    // fall through to the honest unknown marker below
  }
  return "unknown";
}

export function packageVersion(): string {
  if (cachedVersion === undefined) {
    cachedVersion = readVersion();
  }
  return cachedVersion;
}

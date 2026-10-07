import { pino, type DestinationStream, type Logger } from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export function logLevelFor(nodeEnv: string): LogLevel {
  if (nodeEnv === "production") {
    return "info";
  }
  if (nodeEnv === "test") {
    return "silent";
  }
  return "debug";
}

const REDACT_PATHS = [
  "apiKey",
  "api_key",
  "*.apiKey",
  "*.api_key",
  "token",
  "*.token",
  "authToken",
  "*.authToken",
  "authorization",
  "*.authorization",
  "password",
  "*.password",
  "secret",
  "*.secret",
  "req.headers.authorization",
  "req.headers.cookie"
];

export function createLogger(nodeEnv: string, destination?: DestinationStream): Logger {
  const options = {
    level: logLevelFor(nodeEnv),
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]"
    }
  };
  if (destination === undefined) {
    return pino(options);
  }
  return pino(options, destination);
}

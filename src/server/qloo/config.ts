import type { ApiErrorDetail } from "../../shared/errors.js";
import type { ZorqConfig } from "../config.js";
import { missingQlooConfiguration } from "./errors.js";

export const HACKATHON_QLOO_BASE_URL = "https://hackathon.api.qloo.com";

export const QLOO_LIMITS = {
  cacheMaxEntries: 250,
  requestTimeoutMs: 30_000,
  mcpCallTimeoutMs: 90_000,
  mcpConnectTimeoutMs: 60_000
} as const;

export interface QlooSettings {
  baseUrl: string;
  apiKey: string;
  maxCalls: number;
  concurrency: number;
  cacheTtlSec: number;
  cacheMaxEntries: number;
  requestTimeoutMs: number;
  mcpCallTimeoutMs: number;
  mcpConnectTimeoutMs: number;
}

function originOf(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export function qlooConfigurationIssues(config: ZorqConfig): ApiErrorDetail[] {
  const issues: ApiErrorDetail[] = [];
  const apiKey = config.qlooApiKey;
  if (apiKey === undefined || apiKey === "") {
    issues.push({ path: "env.QLOO_API_KEY", message: "required before the Qloo gateway can be used" });
  }
  const baseUrl = config.qlooBaseUrl ?? HACKATHON_QLOO_BASE_URL;
  const trustedBaseUrl = config.qlooTrustedBaseUrl ?? HACKATHON_QLOO_BASE_URL;
  if (baseUrl !== HACKATHON_QLOO_BASE_URL) {
    issues.push({
      path: "env.QLOO_BASE_URL",
      message: `must equal ${HACKATHON_QLOO_BASE_URL} in this build; received origin ${originOf(baseUrl)}`
    });
  }
  if (trustedBaseUrl !== HACKATHON_QLOO_BASE_URL) {
    issues.push({
      path: "env.QLOO_TRUSTED_BASE_URL",
      message: `must equal ${HACKATHON_QLOO_BASE_URL} in this build; received origin ${originOf(trustedBaseUrl)}`
    });
  }
  return issues;
}

export function resolveQlooSettings(config: ZorqConfig): QlooSettings {
  const issues = qlooConfigurationIssues(config);
  if (issues.length > 0) {
    throw missingQlooConfiguration(issues);
  }
  return {
    baseUrl: HACKATHON_QLOO_BASE_URL,
    apiKey: config.qlooApiKey ?? "",
    maxCalls: config.maxQlooCalls,
    concurrency: config.qlooConcurrency,
    cacheTtlSec: config.qlooCacheTtlSec,
    cacheMaxEntries: QLOO_LIMITS.cacheMaxEntries,
    requestTimeoutMs: QLOO_LIMITS.requestTimeoutMs,
    mcpCallTimeoutMs: QLOO_LIMITS.mcpCallTimeoutMs,
    mcpConnectTimeoutMs: QLOO_LIMITS.mcpConnectTimeoutMs
  };
}

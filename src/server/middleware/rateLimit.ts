import type { NextFunction, Request, Response } from "express";
import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";
import { ApiError } from "../../shared/errors.js";

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const GENERAL_RATE_LIMIT_MAX = 300;
export const MUTATING_RATE_LIMIT_MAX = 30;

export interface RateLimitTier {
  limit: number;
  windowMs: number;
}

export interface RateLimitConfig {
  general: RateLimitTier;
  mutating: RateLimitTier;
}

export interface RateLimitOverrides {
  general?: Partial<RateLimitTier>;
  mutating?: Partial<RateLimitTier>;
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  general: { limit: GENERAL_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS },
  mutating: { limit: MUTATING_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS }
};

const MUTATING_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function resolveRateLimits(overrides?: RateLimitOverrides): RateLimitConfig {
  return {
    general: { ...DEFAULT_RATE_LIMITS.general, ...overrides?.general },
    mutating: { ...DEFAULT_RATE_LIMITS.mutating, ...overrides?.mutating }
  };
}

function rateLimitExceededHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError("RATE_LIMITED", "Too many requests for this IP. Please retry later."));
}

export interface RateLimiters {
  general: RateLimitRequestHandler;
  mutating: RateLimitRequestHandler;
}

export function createRateLimiters(overrides?: RateLimitOverrides): RateLimiters {
  const config = resolveRateLimits(overrides);
  const general = rateLimit({
    windowMs: config.general.windowMs,
    limit: config.general.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: rateLimitExceededHandler
  });
  const mutating = rateLimit({
    windowMs: config.mutating.windowMs,
    limit: config.mutating.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: rateLimitExceededHandler,
    skip: (req) => !MUTATING_METHODS.has(req.method)
  });
  return { general, mutating };
}

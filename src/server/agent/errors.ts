import { ApiError, type ApiErrorCode, type ApiErrorDetail } from "../../shared/errors.js";

export function missingDeepSeekConfiguration(): ApiError {
  return new ApiError("SERVICE_UNAVAILABLE", "DeepSeek is not configured for use", [
    { path: "DEEPSEEK_API_KEY", message: "required at first use" }
  ]);
}

export class PriorGenerationError extends ApiError {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super("DEPENDENCY_UNAVAILABLE", message, details);
    this.name = "PriorGenerationError";
  }
}

export class PriorConflictError extends ApiError {
  constructor(message = "Prior is write-once and cannot be replaced") {
    super("CONFLICT", message, [{ path: "prior", message: "already persisted for this run" }]);
    this.name = "PriorConflictError";
  }
}

export type LlmBudgetErrorCode = "LLM_BUDGET_RESERVE" | "LLM_BUDGET_CEILING";

export class LlmBudgetError extends Error {
  readonly code: LlmBudgetErrorCode;
  readonly spentUsd: number;
  readonly ceilingUsd: number;
  readonly essential: boolean;

  constructor(code: LlmBudgetErrorCode, info: { spentUsd: number; ceilingUsd: number; essential: boolean }) {
    super(
      code === "LLM_BUDGET_RESERVE"
        ? `LLM budget reserve reached: $${info.spentUsd.toFixed(4)} of $${info.ceilingUsd.toFixed(2)} spent; non-essential calls are refused at 80% so the last 20% stays for recovery and judge flow`
        : `LLM budget ceiling reached: $${info.spentUsd.toFixed(4)} of the locked $${info.ceilingUsd.toFixed(2)} ceiling spent`
    );
    this.name = "LlmBudgetError";
    this.code = code;
    this.spentUsd = info.spentUsd;
    this.ceilingUsd = info.ceilingUsd;
    this.essential = info.essential;
  }
}

export type AgentToolErrorReason = "unknown_tool" | "invalid_arguments" | "invalid_envelope" | "malformed_call";

export class AgentToolError extends ApiError {
  readonly reason: AgentToolErrorReason;
  readonly toolName: string;

  constructor(reason: AgentToolErrorReason, toolName: string, message: string, details?: ApiErrorDetail[]) {
    super("VALIDATION_FAILED", message, details);
    this.name = "AgentToolError";
    this.reason = reason;
    this.toolName = toolName;
  }
}

export class AgentStateError extends ApiError {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super("CONFLICT", message, details);
    this.name = "AgentStateError";
  }
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : `unexpected error: ${JSON.stringify(error)}`);
}

export function apiError(code: ApiErrorCode, message: string, details?: ApiErrorDetail[]): ApiError {
  return new ApiError(code, message, details);
}

import { z } from "zod";

export const apiErrorCodes = [
  "VALIDATION_FAILED",
  "RUN_NOT_FOUND",
  "SNAPSHOT_EXPIRED",
  "CONFLICT",
  "UNKNOWN_ENTITY",
  "RATE_LIMITED",
  "DEPENDENCY_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "INTERNAL"
] as const;

export const apiErrorCodeSchema = z.enum(apiErrorCodes);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorStatus: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  RUN_NOT_FOUND: 404,
  SNAPSHOT_EXPIRED: 410,
  CONFLICT: 409,
  UNKNOWN_ENTITY: 422,
  RATE_LIMITED: 429,
  DEPENDENCY_UNAVAILABLE: 502,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL: 500
};

export const apiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string()
});

export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.array(apiErrorDetailSchema).optional(),
    requestId: z.string()
  })
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export interface ZodIssueLike {
  path: readonly PropertyKey[];
  message: string;
}

export function zodIssuesToDetails(issues: readonly ZodIssueLike[]): ApiErrorDetail[] {
  return issues.map((issue) => ({
    path: issue.path.map((part) => String(part)).join("."),
    message: issue.message
  }));
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: ApiErrorDetail[] | undefined;

  constructor(code: ApiErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = apiErrorStatus[code];
    this.details = details;
  }

  toBody(requestId: string): ApiErrorBody {
    const body: ApiErrorBody = {
      error: {
        code: this.code,
        message: this.message,
        requestId
      }
    };
    if (this.details !== undefined) {
      body.error.details = this.details;
    }
    return body;
  }
}

export function validationFailed(
  issues: readonly ZodIssueLike[],
  message = "Request validation failed"
): ApiError {
  return new ApiError("VALIDATION_FAILED", message, zodIssuesToDetails(issues));
}

export function toApiErrorBody(err: unknown, requestId: string): ApiErrorBody {
  if (err instanceof ApiError) {
    return err.toBody(requestId);
  }
  return {
    error: {
      code: "INTERNAL",
      message: "Internal server error",
      requestId
    }
  };
}

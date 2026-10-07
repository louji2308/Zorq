import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { ApiError, toApiErrorBody, validationFailed } from "../../shared/errors.js";
import { REQUEST_ID_HEADER, requestIdFrom } from "./requestId.js";

function isZodError(err: unknown): err is ZodError {
  if (err instanceof ZodError) {
    return true;
  }
  if (typeof err !== "object" || err === null) {
    return false;
  }
  const candidate = err as { name?: unknown; issues?: unknown };
  return candidate.name === "ZodError" && Array.isArray(candidate.issues);
}

interface BodyParserClientError {
  type: string;
  status: number;
}

const BODY_PARSER_MESSAGES: Record<string, string> = {
  "entity.parse.failed": "Request body is not valid JSON.",
  "entity.too.large": "Request body exceeds the size limit."
};

function asBodyParserClientError(err: unknown): BodyParserClientError | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  const candidate = err as { type?: unknown; status?: unknown };
  if (
    typeof candidate.type === "string" &&
    typeof candidate.status === "number" &&
    candidate.status >= 400 &&
    candidate.status < 500
  ) {
    return { type: candidate.type, status: candidate.status };
  }
  return undefined;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  const isApiPath = req.path === "/api" || req.path.startsWith("/api/");
  const message = isApiPath
    ? `Unknown API route: ${req.method} ${req.path}`
    : `Not found: ${req.method} ${req.path}`;
  next(new ApiError("RUN_NOT_FOUND", message));
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const requestId = requestIdFrom(res);
    res.setHeader(REQUEST_ID_HEADER, requestId);

    let apiError: ApiError;
    if (err instanceof ApiError) {
      apiError = err;
      logger.warn(
        { requestId, code: apiError.code, status: apiError.status, method: req.method, path: req.path },
        "request rejected"
      );
    } else if (isZodError(err)) {
      apiError = validationFailed(err.issues);
      logger.warn(
        { requestId, code: "VALIDATION_FAILED", method: req.method, path: req.path, issueCount: err.issues.length },
        "request schema validation failed"
      );
    } else {
      const bodyError = asBodyParserClientError(err);
      if (bodyError !== undefined) {
        apiError = new ApiError(
          "VALIDATION_FAILED",
          BODY_PARSER_MESSAGES[bodyError.type] ?? "Request body could not be read.",
          [{ path: "body", message: `invalid body: ${bodyError.type}` }]
        );
        logger.warn(
          { requestId, code: "VALIDATION_FAILED", method: req.method, path: req.path, bodyErrorType: bodyError.type },
          "request body rejected"
        );
      } else {
        const errorName = err instanceof Error ? err.name : typeof err;
        const errorMessage = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        apiError = new ApiError("INTERNAL", "Internal server error");
        logger.error(
          {
            requestId,
            method: req.method,
            path: req.path,
            errName: errorName,
            errMessage: errorMessage.slice(0, 500),
            stack
          },
          "unhandled request error"
        );
      }
    }

    res.status(apiError.status).json(toApiErrorBody(apiError, requestId));
  };
}

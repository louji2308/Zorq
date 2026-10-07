import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";
import { validationFailed, type ZodIssueLike } from "../../shared/errors.js";

export interface ValidateOptions {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
  request?: { schema: ZodType; select: (req: Request) => unknown };
}

export function validate(options: ValidateOptions): RequestHandler {
  return (req, _res, next) => {
    const issues: ZodIssueLike[] = [];
    const check = (prefix: string, schema: ZodType, value: unknown): void => {
      const result = schema.safeParse(value);
      if (result.success) {
        return;
      }
      for (const issue of result.error.issues) {
        issues.push({
          path: prefix === "" ? issue.path : [prefix, ...issue.path],
          message: issue.message
        });
      }
    };
    if (options.params !== undefined) {
      check("params", options.params, req.params);
    }
    if (options.query !== undefined) {
      check("query", options.query, req.query);
    }
    if (options.body !== undefined) {
      check("body", options.body, req.body ?? {});
    }
    if (options.request !== undefined) {
      check("", options.request.schema, options.request.select(req));
    }
    if (issues.length > 0) {
      next(validationFailed(issues));
      return;
    }
    next();
  };
}

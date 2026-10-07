import { randomUUID } from "node:crypto";
import type { RequestHandler, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function isSafeRequestId(value: string): boolean {
  return SAFE_REQUEST_ID.test(value);
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const inbound = req.header(REQUEST_ID_HEADER);
  const requestId = inbound !== undefined && isSafeRequestId(inbound) ? inbound : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

export function requestIdFrom(res: Response): string {
  const id: unknown = res.locals.requestId;
  return typeof id === "string" && id.length > 0 ? id : randomUUID();
}

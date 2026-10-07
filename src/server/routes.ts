import type { Express, NextFunction, Request, Response } from "express";
import {
  ApiError,
  blueprintQuerySchema,
  challengeRequestSchema,
  eventsRequestSchema,
  postRunsRequestSchema,
  recomputeRequestSchema,
  replaceRequestSchema,
  runIdParamsSchema,
  stopRunRequestSchema,
  unpinAnchorRequestSchema
} from "../shared/index.js";
import type { HealthzResult } from "./healthz.js";
import { validate } from "./middleware/validate.js";

export const UNIMPLEMENTED_MESSAGES = {
  createRun: "Run creation is not implemented yet; it lands in Phase 5 (durable Run state).",
  getRun: "Reading run state is not implemented yet; it lands in Phase 5 (durable Run state).",
  runEvents: "SSE event streaming is not implemented yet; it lands in Phase 5 (SSE and recovery).",
  stopRun: "Stopping a run is not implemented yet; it lands in Phase 5 (stop and cancellation).",
  unpinAnchor:
    "Unpinning an anchor is not implemented yet; it lands with the agent core (Phase 3) and durable run state (Phase 5).",
  replaceComponent: "Role-preserving replacement is not implemented yet; it lands in Phase 7 (Replace).",
  challenge: "Challenge the Plan is not implemented yet; it lands in Phase 8 (S4 Challenge).",
  recompute:
    "Recompute is not implemented yet; it lands in Phase 8 (constraint engine) on Phase 5 run state.",
  blueprint: "The Place Blueprint endpoint is not implemented yet; it lands in Phase 8 (S5 Blueprint).",
  method: "The method content endpoint is not implemented yet; it lands in Phase 9 (/method documentation)."
} as const;

function unimplemented(message: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next(new ApiError("SERVICE_UNAVAILABLE", message));
  };
}

export interface RouteDependencies {
  healthz: () => HealthzResult;
}

export function registerRoutes(app: Express, dependencies: RouteDependencies): void {
  app.get("/healthz", (_req, res, next) => {
    const result = dependencies.healthz();
    if (result.status === 200) {
      res.status(200).json(result.body);
      return;
    }
    next(new ApiError("SERVICE_UNAVAILABLE", result.message));
  });

  app.post("/api/runs", validate({ body: postRunsRequestSchema }), unimplemented(UNIMPLEMENTED_MESSAGES.createRun));

  app.get("/api/runs/:id", validate({ params: runIdParamsSchema }), unimplemented(UNIMPLEMENTED_MESSAGES.getRun));

  app.get(
    "/api/runs/:id/events",
    validate({
      request: {
        schema: eventsRequestSchema,
        select: (req) => ({
          params: { id: req.params.id },
          headers: { "last-event-id": req.header("last-event-id") }
        })
      }
    }),
    unimplemented(UNIMPLEMENTED_MESSAGES.runEvents)
  );

  app.post(
    "/api/runs/:id/stop",
    validate({ params: runIdParamsSchema, body: stopRunRequestSchema }),
    unimplemented(UNIMPLEMENTED_MESSAGES.stopRun)
  );

  app.post(
    "/api/runs/:id/unpin-anchor",
    validate({ params: runIdParamsSchema, body: unpinAnchorRequestSchema }),
    unimplemented(UNIMPLEMENTED_MESSAGES.unpinAnchor)
  );

  app.post(
    "/api/runs/:id/replace",
    validate({ params: runIdParamsSchema, body: replaceRequestSchema }),
    unimplemented(UNIMPLEMENTED_MESSAGES.replaceComponent)
  );

  app.post(
    "/api/runs/:id/challenge",
    validate({ params: runIdParamsSchema, body: challengeRequestSchema }),
    unimplemented(UNIMPLEMENTED_MESSAGES.challenge)
  );

  app.post(
    "/api/runs/:id/recompute",
    validate({ params: runIdParamsSchema, body: recomputeRequestSchema }),
    unimplemented(UNIMPLEMENTED_MESSAGES.recompute)
  );

  app.get(
    "/api/runs/:id/blueprint",
    validate({ params: runIdParamsSchema, query: blueprintQuerySchema }),
    unimplemented(UNIMPLEMENTED_MESSAGES.blueprint)
  );

  app.get("/api/method", unimplemented(UNIMPLEMENTED_MESSAGES.method));
}

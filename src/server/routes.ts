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
  runStateSchema,
  stopRunRequestSchema,
  unpinAnchorRequestSchema,
  type ReplaceRequest
} from "../shared/index.js";
import type { HealthzResult } from "./healthz.js";
import { validate } from "./middleware/validate.js";
import type { Orchestrator } from "./orchestrator/index.js";
import { RunNotFound, RunStoreError, type RunStore } from "./persistence/index.js";
import { createRunEventsHandler, type EventHub } from "./sse/index.js";

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

export function mapRouteError(error: unknown): unknown {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof RunNotFound) {
    return new ApiError("RUN_NOT_FOUND", error.message);
  }
  if (error instanceof RunStoreError) {
    return new ApiError("CONFLICT", error.message);
  }
  return error;
}

function readRunId(req: Request): string {
  const id: unknown = req.params.id;
  return typeof id === "string" ? id : "";
}

export interface RouteDependencies {
  healthz: () => HealthzResult;
  orchestrator?: Orchestrator;
  store?: RunStore;
  eventHub?: EventHub;
  sseHeartbeatMs?: number;
}

export function registerRoutes(app: Express, dependencies: RouteDependencies): void {
  const { orchestrator, store, eventHub } = dependencies;

  app.get("/healthz", (_req, res, next) => {
    const result = dependencies.healthz();
    if (result.status === 200) {
      res.status(200).json(result.body);
      return;
    }
    next(new ApiError("SERVICE_UNAVAILABLE", result.message));
  });

  app.post("/api/runs", validate({ body: postRunsRequestSchema }), (req, res, next) => {
    if (orchestrator === undefined || store === undefined) {
      unimplemented(UNIMPLEMENTED_MESSAGES.createRun)(req, res, next);
      return;
    }
    void orchestrator
      .startRun({ brief: req.body })
      .then((run) => {
        res.status(201).json({ run });
      })
      .catch((error: unknown) => {
        next(mapRouteError(error));
      });
  });

  app.get("/api/runs/:id", validate({ params: runIdParamsSchema }), (req, res, next) => {
    if (store === undefined) {
      unimplemented(UNIMPLEMENTED_MESSAGES.getRun)(req, res, next);
      return;
    }
    void (async () => {
      const runId = readRunId(req);
      const stored = await store.loadRun(runId);
      if (stored === null) {
        throw new ApiError("RUN_NOT_FOUND", `run not found: ${runId}`);
      }
      const evidence = await store.listEvidence(stored.id);
      const projected = {
        ...stored.state,
        evidence: evidence.map((record) => ({
          id: record.id,
          kind: record.operation,
          summary: record.claim
        }))
      };
      return { run: runStateSchema.parse(projected) };
    })()
      .then((body) => {
        res.status(200).json(body);
      })
      .catch((error: unknown) => {
        next(mapRouteError(error));
      });
  });

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
    (req, res, next) => {
      if (orchestrator === undefined || store === undefined || eventHub === undefined) {
        unimplemented(UNIMPLEMENTED_MESSAGES.runEvents)(req, res, next);
        return;
      }
      const handler = createRunEventsHandler({
        store,
        hub: eventHub,
        ...(dependencies.sseHeartbeatMs !== undefined ? { heartbeatMs: dependencies.sseHeartbeatMs } : {})
      });
      void handler(req, res, next);
    }
  );

  app.post(
    "/api/runs/:id/stop",
    validate({ params: runIdParamsSchema, body: stopRunRequestSchema }),
    (req, res, next) => {
      if (orchestrator === undefined || store === undefined) {
        unimplemented(UNIMPLEMENTED_MESSAGES.stopRun)(req, res, next);
        return;
      }
      const reason = (req.body as { reason?: string } | undefined)?.reason;
      void orchestrator
        .stopRun(readRunId(req), reason)
        .then((run) => {
          res.status(200).json({ run });
        })
        .catch((error: unknown) => {
          next(mapRouteError(error));
        });
    }
  );

  app.post(
    "/api/runs/:id/unpin-anchor",
    validate({ params: runIdParamsSchema, body: unpinAnchorRequestSchema }),
    unimplemented(UNIMPLEMENTED_MESSAGES.unpinAnchor)
  );

  app.post(
    "/api/runs/:id/replace",
    validate({ params: runIdParamsSchema, body: replaceRequestSchema }),
    (req, res, next) => {
      if (orchestrator === undefined || store === undefined) {
        unimplemented(UNIMPLEMENTED_MESSAGES.replaceComponent)(req, res, next);
        return;
      }
      void orchestrator
        .replaceComponent(readRunId(req), req.body as ReplaceRequest)
        .then((body) => {
          res.status(200).json(body);
        })
        .catch((error: unknown) => {
          next(mapRouteError(error));
        });
    }
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

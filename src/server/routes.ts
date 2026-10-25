import type { Express, NextFunction, Request, Response } from "express";
import {
  ApiError,
  blueprintQuerySchema,
  challengeRequestSchema,
  eventsRequestSchema,
  methodResponseSchema,
  postRunsRequestSchema,
  recomputeRequestSchema,
  replaceRequestSchema,
  runIdParamsSchema,
  runStateSchema,
  qlooTagSuggestionsRequestSchema,
  qlooTagSuggestionsResponseSchema,
  stopRunRequestSchema,
  unpinAnchorRequestSchema,
  type ChallengeRequest,
  type ReplaceRequest
} from "../shared/index.js";
import type { HealthzResult } from "./healthz.js";
import { validate } from "./middleware/validate.js";
import { methodContent } from "./method.js";
import type { Orchestrator } from "./orchestrator/index.js";
import { RunNotFound, RunStoreError, type RunStore } from "./persistence/index.js";
import { buildQlooTagSuggestions } from "./qloo/tagSuggestions.js";
import type { QlooGateway } from "./qloo/gateway.js";
import { createRunEventsHandler, type EventHub } from "./sse/index.js";

// Honest unavailable answers for routes registered without their runtime
// dependencies (a partially wired app) and for the two endpoints that ship as
// typed 503 stubs in this build. Copy names the missing dependency or states
// current unavailability — never internal build-phase language (Phase 9 W-9.1).
export const UNIMPLEMENTED_MESSAGES = {
  createRun:
    "Run creation is unavailable because this server is running without its run store and orchestrator. See /healthz for configuration status.",
  getRun:
    "Reading run state is unavailable because this server is running without its run store. See /healthz for configuration status.",
  runEvents:
    "Live event streaming is unavailable because this server is running without its run store and event hub. See /healthz for configuration status.",
  stopRun:
    "Stopping a run is unavailable because this server is running without its run store and orchestrator. See /healthz for configuration status.",
  unpinAnchor:
    "Unpinning an anchor is not part of this build. The agent's anchor selections are shown in the Agent Ledger; start a new brief to investigate with different anchors.",
  replaceComponent:
    "Role-preserving replacement is unavailable because this server is running without its run store and orchestrator. See /healthz for configuration status.",
  challenge:
    "Challenge the Plan is unavailable because this server is running without its run store and orchestrator. See /healthz for configuration status.",
  recompute:
    "Recomputing fit for changed constraints is not available as a standalone endpoint in this build. Start a new brief with the updated constraints; constraint fit is applied when the Place Blueprint is built.",
  blueprint:
    "The Place Blueprint is unavailable because this server is running without its run store and orchestrator. See /healthz for configuration status.",
  qlooTags:
    "Qloo-driven tags are unavailable because this server is running without its Qloo gateway. See /healthz for configuration status."
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
  qloo?: QlooGateway;
  eventHub?: EventHub;
  sseHeartbeatMs?: number;
}

export function registerRoutes(app: Express, dependencies: RouteDependencies): void {
  const { orchestrator, store, qloo, eventHub } = dependencies;

  app.get("/healthz", (_req, res, next) => {
    const result = dependencies.healthz();
    if (result.status === 200) {
      res.status(200).json(result.body);
      return;
    }
    next(new ApiError("SERVICE_UNAVAILABLE", result.message));
  });

  app.post("/api/qloo/tags", validate({ body: qlooTagSuggestionsRequestSchema }), (req, res, next) => {
    if (qloo === undefined) {
      unimplemented(UNIMPLEMENTED_MESSAGES.qlooTags)(req, res, next);
      return;
    }
    const request = qlooTagSuggestionsRequestSchema.parse(req.body);
    void buildQlooTagSuggestions(qloo, request)
      .then((body) => {
        res.status(200).json(qlooTagSuggestionsResponseSchema.parse(body));
      })
      .catch((error: unknown) => {
        next(mapRouteError(error));
      });
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
    (req, res, next) => {
      if (orchestrator === undefined || store === undefined) {
        unimplemented(UNIMPLEMENTED_MESSAGES.challenge)(req, res, next);
        return;
      }
      void orchestrator
        .challengeRun(readRunId(req), req.body as ChallengeRequest)
        .then((body) => {
          res.status(200).json(body);
        })
        .catch((error: unknown) => {
          next(mapRouteError(error));
        });
    }
  );

  app.post(
    "/api/runs/:id/recompute",
    validate({ params: runIdParamsSchema, body: recomputeRequestSchema }),
    unimplemented(UNIMPLEMENTED_MESSAGES.recompute)
  );

  app.get(
    "/api/runs/:id/blueprint",
    validate({ params: runIdParamsSchema, query: blueprintQuerySchema }),
    (req, res, next) => {
      if (orchestrator === undefined || store === undefined) {
        unimplemented(UNIMPLEMENTED_MESSAGES.blueprint)(req, res, next);
        return;
      }
      const query = blueprintQuerySchema.parse(req.query);
      void orchestrator
        .buildBlueprint(readRunId(req), query)
        .then((body) => {
          res.status(200).json(body);
        })
        .catch((error: unknown) => {
          next(mapRouteError(error));
        });
    }
  );

  // The method content is authored in src/server/method.ts (the single source) and served
  // validated, so a content edit that breaks the published contract fails loudly here.
  app.get("/api/method", (_req, res) => {
    res.status(200).json(methodResponseSchema.parse({ method: methodContent }));
  });
}

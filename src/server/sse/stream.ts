import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../shared/errors.js";
import { runStateSchema } from "../../shared/run.js";
import { requestIdFrom } from "../middleware/requestId.js";
import { isResumableStatus } from "../orchestrator/index.js";
import type { RunStore } from "../persistence/index.js";
import { HEARTBEAT_COMMENT, parseLastEventId, serializeFrame } from "./frames.js";
import type { EventHub, StreamFrame } from "./hub.js";

export const DEFAULT_HEARTBEAT_MS = 15_000;

export interface RunEventsOptions {
  store: RunStore;
  hub: EventHub;
  heartbeatMs?: number;
}

function isTerminalStateFrame(frame: StreamFrame): boolean {
  if (frame.event !== "state") {
    return false;
  }
  const parsed = runStateSchema.safeParse(frame.data);
  return parsed.success && !isResumableStatus(parsed.data.status);
}

export function createRunEventsHandler(options: RunEventsOptions) {
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;

  return async function runEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    const runId = typeof req.params.id === "string" ? req.params.id : "";
    const requestId = requestIdFrom(res);

    let stored;
    try {
      stored = await options.store.loadRun(runId);
    } catch (error) {
      next(error);
      return;
    }
    if (stored === null) {
      next(new ApiError("RUN_NOT_FOUND", `run not found: ${runId}`));
      return;
    }
    const projection = runStateSchema.safeParse(stored.state);
    if (!projection.success) {
      next(new ApiError("INTERNAL", `stored state for run ${runId} is not a projection-safe RunState`));
      return;
    }

    const lastEventId = parseLastEventId(req.header("last-event-id"));
    const terminal = !isResumableStatus(projection.data.status);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;
    const close = (): void => {
      if (closed) {
        return;
      }
      closed = true;
      if (heartbeat !== undefined) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }
      unsubscribe?.();
      unsubscribe = undefined;
    };
    res.on("close", close);

    const write = (frame: StreamFrame): void => {
      if (closed || res.writableEnded) {
        return;
      }
      res.write(serializeFrame(frame, requestId));
    };

    const writeEnd = (): void => {
      write({ event: "end", id: options.hub.nextId(runId), data: {} });
      res.end();
      close();
    };

    const deliver = (frame: StreamFrame): void => {
      if (closed || res.writableEnded) {
        return;
      }
      write(frame);
      if (isTerminalStateFrame(frame)) {
        writeEnd();
      }
    };

    const pending: StreamFrame[] = [];
    let ready = false;
    let lastReplayedSeq = 0;

    if (!terminal) {
      unsubscribe = options.hub.subscribe(runId, (frame) => {
        if (!ready) {
          pending.push(frame);
          return;
        }
        if (frame.event === "ledger" && Number(frame.id) <= lastReplayedSeq) {
          return;
        }
        deliver(frame);
      });
    }

    let entries: Awaited<ReturnType<RunStore["listLedgerEvents"]>>;
    try {
      entries = await options.store.listLedgerEvents(runId);
    } catch {
      write({
        event: "error",
        id: options.hub.nextId(runId),
        data: { code: "INTERNAL", message: "event stream failed while reading the durable ledger" }
      });
      res.end();
      close();
      return;
    }

    const maxSequence = entries.length > 0 ? (entries[entries.length - 1]?.sequence ?? 0) : 0;
    options.hub.seed(runId, maxSequence);
    write({ event: "state", id: options.hub.nextId(runId), data: projection.data });

    const replayAfter = lastEventId ?? 0;
    if (replayAfter < maxSequence) {
      const missed = entries.filter((entry) => entry.sequence > replayAfter);
      for (const entry of missed) {
        write({ event: "ledger", id: String(entry.sequence), data: entry.event });
        lastReplayedSeq = entry.sequence;
      }
    }

    if (terminal) {
      writeEnd();
      return;
    }

    ready = true;
    for (const frame of pending) {
      if (frame.event === "ledger" && Number(frame.id) <= lastReplayedSeq) {
        continue;
      }
      deliver(frame);
      if (closed || res.writableEnded) {
        break;
      }
    }
    pending.length = 0;

    heartbeat = setInterval(() => {
      if (closed || res.writableEnded) {
        return;
      }
      res.write(HEARTBEAT_COMMENT);
    }, heartbeatMs);
    heartbeat.unref?.();
  };
}

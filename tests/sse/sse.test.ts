import { afterEach, describe, expect, it } from "vitest";
import type { LedgerEntry } from "../../src/server/agent/ledger.js";
import { createApp } from "../../src/server/app.js";
import { loadConfig } from "../../src/server/config.js";
import { createLogger } from "../../src/server/logger.js";
import { createOrchestrator } from "../../src/server/orchestrator/index.js";
import { createMemoryStore, type RunStore } from "../../src/server/persistence/index.js";
import { createEventHub, type EventHub } from "../../src/server/sse/index.js";
import type { LedgerEvent } from "../../src/shared/index.js";
import { TEST_BRIEF, TEST_NOW, TEST_PRIOR, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import { FINAL_TURN, PRIOR_RESPONSE, TURN_ONE } from "../orchestrator/support.js";
import { startServer } from "../support/http.js";

const TEST_CONFIG = loadConfig({ NODE_ENV: "test", APP_BASE_URL: "http://localhost:3000" });

interface ParsedFrame {
  event?: string;
  id?: string;
  data?: string;
  comment?: string;
}

interface TestStack {
  baseUrl: string;
  store: RunStore;
  hub: EventHub;
  heartbeatMs?: number;
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

async function createStack(options: { heartbeatMs?: number } = {}): Promise<TestStack> {
  const store = createMemoryStore();
  const hub = createEventHub();
  const llm = fakeLlm([{ content: PRIOR_RESPONSE }, TURN_ONE, FINAL_TURN]);
  const gateway = fakeGateway();
  const orchestrator = createOrchestrator({
    store,
    gateway: gateway.gateway,
    llm: llm.client,
    now: () => TEST_NOW,
    eventSink: (event) => hub.publish(event)
  });
  const app = createApp(createLogger("test"), {
    config: TEST_CONFIG,
    orchestrator,
    store,
    eventHub: hub,
    ...(options.heartbeatMs !== undefined ? { sseHeartbeatMs: options.heartbeatMs } : {})
  });
  const server = await startServer(app);
  cleanups.push(server.close);
  return { baseUrl: server.baseUrl, store, hub, ...(options.heartbeatMs !== undefined ? { heartbeatMs: options.heartbeatMs } : {}) };
}

function ledgerEvent(label: string): LedgerEvent {
  return { kind: "Compute", label, summary: `summary for ${label}`, duration: 0, cacheState: "n/a", resultCount: 0 };
}

function entry(sequence: number, label: string): LedgerEntry {
  return { id: `ledger-${sequence}`, sequence, event: ledgerEvent(label) };
}

async function seedRun(
  store: RunStore,
  options: { id: string; status: string; entries?: LedgerEntry[] }
): Promise<void> {
  const phase = options.status === "investigating" ? "investigation" : "measurement";
  await store.createRun({
    id: options.id,
    state: { id: options.id, status: options.status, phase, brief: TEST_BRIEF, prior: TEST_PRIOR }
  });
  for (const ledgerEntry of options.entries ?? []) {
    await store.appendLedgerEvent(options.id, ledgerEntry);
  }
}

function parseBlock(block: string): ParsedFrame {
  const frame: ParsedFrame = {};
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) {
      frame.comment = line.slice(1).trim();
      continue;
    }
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") {
      frame.event = value;
    } else if (field === "id") {
      frame.id = value;
    } else if (field === "data") {
      frame.data = value;
    }
  }
  return frame;
}

async function readFrames(
  response: Response,
  options: { until?: (frames: ParsedFrame[]) => boolean; timeoutMs?: number } = {}
): Promise<ParsedFrame[]> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new Error("sse response has no readable body");
  }
  const decoder = new TextDecoder();
  const frames: ParsedFrame[] = [];
  let buffer = "";
  const timer = setTimeout(() => {
    reader.cancel().catch(() => undefined);
  }, options.timeoutMs ?? 3000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (block.trim() !== "") {
          frames.push(parseBlock(block));
          if (options.until?.(frames) === true) {
            return frames;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return frames;
}

function dataOf(frame: ParsedFrame | undefined): Record<string, unknown> | undefined {
  if (frame?.data === undefined) {
    return undefined;
  }
  return JSON.parse(frame.data) as Record<string, unknown>;
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (predicate()) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error("condition was not met within the timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe("GET /api/runs/:id/events (SSE)", () => {
  const runId = "55555555-5555-4555-8555-555555555555";

  it("answers 404 RUN_NOT_FOUND for an unknown run id", async () => {
    const { baseUrl } = await createStack();

    const response = await fetch(`${baseUrl}/api/runs/66666666-6666-4666-8666-666666666666/events`);

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RUN_NOT_FOUND");
  });

  it("replays terminal state and durable history before closing with an end frame", async () => {
    const { baseUrl, store } = await createStack();
    await seedRun(store, { id: runId, status: "complete", entries: [entry(1, "one"), entry(2, "two")] });

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream" }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");

    const frames = await readFrames(response);
    expect(frames.length).toBeGreaterThanOrEqual(1);
    expect(frames[0]?.event).toBe("state");
    const state = dataOf(frames[0]);
    expect(state?.id).toBe(runId);
    expect(state?.status).toBe("complete");
    const ledgerFrames = frames.filter((frame) => frame.event === "ledger");
    expect(ledgerFrames.map((frame) => frame.id)).toEqual(["1", "2"]);
    expect(dataOf(ledgerFrames[0])?.label).toBe("one");
    expect(dataOf(ledgerFrames[1])?.label).toBe("two");
    expect(frames[0]?.id).toBeDefined();
    expect(frames.at(-1)?.event).toBe("end");
    expect(frames.at(-1)?.data).toBe("{}");
  });

  it("replays durable ledger history on a fresh resumable connection and then streams live frames", async () => {
    const { baseUrl, store } = await createStack();
    await seedRun(store, {
      id: runId,
      status: "investigating",
      entries: [entry(1, "one"), entry(2, "two")]
    });
    const controller = new AbortController();

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal
    });

    const frames = await readFrames(response, {
      until: (collected) => collected.filter((frame) => frame.event === "ledger").length >= 2
    });
    controller.abort();

    expect(frames[0]?.event).toBe("state");
    expect(frames.filter((frame) => frame.event === "ledger").map((frame) => frame.id)).toEqual(["1", "2"]);
  });

  it("replays contiguous ledger events after Last-Event-ID and never duplicates them", async () => {
    const { baseUrl, store } = await createStack();
    await seedRun(store, {
      id: runId,
      status: "complete",
      entries: [entry(1, "one"), entry(2, "two"), entry(3, "three")]
    });

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream", "last-event-id": "1" }
    });

    const frames = await readFrames(response);
    expect(frames[0]?.event).toBe("state");
    const ledgerFrames = frames.filter((frame) => frame.event === "ledger");
    expect(ledgerFrames.map((frame) => frame.id)).toEqual(["2", "3"]);
    expect(dataOf(ledgerFrames[0])?.label).toBe("two");
    expect(dataOf(ledgerFrames[1])?.label).toBe("three");
    expect(frames.at(-1)?.event).toBe("end");
  });

  it("replays available ledger events after a durable gap instead of dropping the whole tail", async () => {
    const { baseUrl, store } = await createStack();
    await seedRun(store, {
      id: runId,
      status: "complete",
      entries: [entry(1, "one"), entry(3, "three")]
    });

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream", "last-event-id": "1" }
    });

    const frames = await readFrames(response);
    expect(frames[0]?.event).toBe("state");
    expect(dataOf(frames[0])?.id).toBe(runId);
    const ledgerFrames = frames.filter((frame) => frame.event === "ledger");
    expect(ledgerFrames.map((frame) => frame.id)).toEqual(["3"]);
    expect(dataOf(ledgerFrames[0])?.label).toBe("three");
    expect(frames.at(-1)?.event).toBe("end");
  });

  it("sends state and end when Last-Event-ID is at or beyond the newest ledger sequence", async () => {
    const { baseUrl, store } = await createStack();
    await seedRun(store, {
      id: runId,
      status: "complete",
      entries: [entry(1, "one"), entry(2, "two")]
    });

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream", "last-event-id": "99" }
    });

    const frames = await readFrames(response);
    expect(frames[0]?.event).toBe("state");
    expect(frames.filter((frame) => frame.event === "ledger")).toHaveLength(0);
    expect(frames.at(-1)?.event).toBe("end");
  });

  it("treats a non-numeric Last-Event-ID as absent and replays durable history", async () => {
    const { baseUrl, store } = await createStack();
    await seedRun(store, { id: runId, status: "complete", entries: [entry(1, "one")] });

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream", "last-event-id": "cursor-not-a-number" }
    });

    const frames = await readFrames(response);
    expect(frames[0]?.event).toBe("state");
    const ledgerFrames = frames.filter((frame) => frame.event === "ledger");
    expect(ledgerFrames.map((frame) => frame.id)).toEqual(["1"]);
    expect(frames.at(-1)?.event).toBe("end");
  });

  it("ends a live terminal state and releases the hub subscriber", async () => {
    const { baseUrl, store, hub } = await createStack();
    await seedRun(store, { id: runId, status: "investigating" });
    const controller = new AbortController();

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal
    });
    const reading = readFrames(response, {
      until: (collected) => collected.some((frame) => frame.event === "end"),
      timeoutMs: 3000
    });
    await waitFor(() => hub.subscriberCount(runId) === 1);
    const stored = await store.loadRun(runId);
    if (stored === null) {
      throw new Error("seeded run was not found");
    }

    hub.publish({
      type: "state",
      runId,
      payload: { ...stored.state, status: "complete" }
    });

    const frames = await reading;
    expect(frames.filter((frame) => frame.event === "state")).toHaveLength(2);
    expect(frames.at(-1)?.event).toBe("end");
    await waitFor(() => hub.subscriberCount(runId) === 0);
    controller.abort();
  });

  it("keeps an idle resumable connection alive with periodic heartbeat comments", async () => {
    const { baseUrl, store } = await createStack({ heartbeatMs: 30 });
    await seedRun(store, { id: runId, status: "investigating" });
    const controller = new AbortController();

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal
    });

    expect(response.status).toBe(200);
    const frames = await readFrames(response, {
      until: (collected) => collected.some((frame) => frame.comment === "heartbeat"),
      timeoutMs: 3000
    });
    expect(frames[0]?.event).toBe("state");
    expect(frames.some((frame) => frame.comment === "heartbeat")).toBe(true);
    controller.abort();
  });

  it("removes the subscriber from the hub when the client disconnects", async () => {
    const { baseUrl, store, hub } = await createStack();
    await seedRun(store, { id: runId, status: "investigating" });
    const controller = new AbortController();

    const response = await fetch(`${baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal
    });

    expect(hub.subscriberCount(runId)).toBe(1);
    const frames = await readFrames(response, { until: (collected) => collected.length >= 1 });
    expect(frames[0]?.event).toBe("state");

    controller.abort();
    await waitFor(() => hub.subscriberCount(runId) === 0);
    expect(hub.subscriberCount(runId)).toBe(0);
  });
});

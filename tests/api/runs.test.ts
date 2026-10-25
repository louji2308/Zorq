import { afterEach, describe, expect, it } from "vitest";
import {
  postRunsResponseSchema,
  runResponseSchema,
  runStateSchema,
  type RunState
} from "../../src/shared/index.js";
import { createApp } from "../../src/server/app.js";
import { loadConfig } from "../../src/server/config.js";
import { createLogger } from "../../src/server/logger.js";
import { createOrchestrator } from "../../src/server/orchestrator/index.js";
import { createMemoryStore, type RunStore } from "../../src/server/persistence/index.js";
import { createEventHub, type EventHub } from "../../src/server/sse/index.js";
import { TEST_BRIEF, TEST_NOW, TEST_PRIOR, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import { FINAL_TURN, PRIOR_RESPONSE, TURN_ONE } from "../orchestrator/support.js";
import { startServer } from "../support/http.js";

const TEST_CONFIG = loadConfig({ NODE_ENV: "test", APP_BASE_URL: "http://localhost:3000" });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TestStack {
  baseUrl: string;
  store: RunStore;
  hub: EventHub;
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

async function createStack(options: { priorContent?: string } = {}): Promise<TestStack> {
  const store = createMemoryStore();
  const hub = createEventHub();
  const llm = fakeLlm([{ content: options.priorContent ?? PRIOR_RESPONSE }, TURN_ONE, FINAL_TURN]);
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
    eventHub: hub
  });
  const server = await startServer(app);
  cleanups.push(server.close);
  return { baseUrl: server.baseUrl, store, hub };
}

async function postBrief(baseUrl: string, body: unknown = TEST_BRIEF): Promise<Response> {
  return fetch(`${baseUrl}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function postStop(baseUrl: string, runId: string, body: unknown = {}): Promise<Response> {
  return fetch(`${baseUrl}/api/runs/${runId}/stop`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function postRetry(baseUrl: string, runId: string): Promise<Response> {
  return fetch(`${baseUrl}/api/runs/${runId}/retry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
}

describe("POST /api/runs", () => {
  it("creates a run, executes the pipeline, and returns the terminal run with a frozen Prior", async () => {
    const { baseUrl } = await createStack();

    const response = await postBrief(baseUrl);

    expect(response.status).toBe(201);
    const body: unknown = await response.json();
    const parsed = postRunsResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    const run = parsed.data.run;
    expect(run.id).toMatch(UUID_RE);
    expect(run.brief).toEqual(TEST_BRIEF);
    expect(run.prior).toBeDefined();
    expect(run.prior?.qlooUsed).toBe(false);
    expect(run.prior?.generatedAt).toBe(new Date(TEST_NOW).toISOString());
    expect(["complete", "partial", "failed"]).toContain(run.status);
  });

  it("rejects a brief that fails schema validation with 400 VALIDATION_FAILED", async () => {
    const { baseUrl } = await createStack();

    const response = await postBrief(baseUrl, { location: "", objective: "" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.requestId).toMatch(/.+/);
  });

  it("carries the LLM-only Without-Qloo polish on the frozen Prior through POST and GET", async () => {
    const polish =
      "Given only this brief, Zorq would lead with a coffee anchor and live music in the evening — stated before any cultural evidence.";
    const { baseUrl } = await createStack({
      priorContent: JSON.stringify({
        composition: { thesis: "daytime cultural corner", members: [{ role: "Anchor", name: "coffee roastery" }] },
        rationale: "from the brief only",
        polish
      })
    });

    const created = await postBrief(baseUrl);

    expect(created.status).toBe(201);
    const createdParsed = postRunsResponseSchema.safeParse(await created.json());
    expect(createdParsed.success).toBe(true);
    if (!createdParsed.success) {
      return;
    }
    expect(createdParsed.data.run.prior?.polish).toBe(polish);
    expect(createdParsed.data.run.prior?.qlooUsed).toBe(false);

    const runId = createdParsed.data.run.id;
    const fetched = await fetch(`${baseUrl}/api/runs/${runId}`);
    expect(fetched.status).toBe(200);
    const fetchedParsed = runResponseSchema.safeParse(await fetched.json());
    expect(fetchedParsed.success).toBe(true);
    if (!fetchedParsed.success) {
      return;
    }
    expect(fetchedParsed.data.run.prior?.polish).toBe(polish);
  });

  it("starts honestly without polish when the model response carries none", async () => {
    const { baseUrl } = await createStack();

    const created = await postBrief(baseUrl);

    expect(created.status).toBe(201);
    const parsed = postRunsResponseSchema.safeParse(await created.json());
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.run.prior?.polish).toBeUndefined();
    expect(parsed.data.run.prior?.qlooUsed).toBe(false);
  });
});

describe("GET /api/runs/:id", () => {
  it("round-trips the persisted run, projects evidence, and strips stray fields", async () => {
    const { baseUrl, store } = await createStack();
    const created = await postBrief(baseUrl);
    const createdBody = (await created.json()) as { run: { id: string } };
    const runId = createdBody.run.id;

    const stored = await store.loadRun(runId);
    expect(stored).not.toBeNull();
    if (stored === null) {
      return;
    }
    const tainted = { ...stored.state, apiKey: "should-not-appear-in-the-response" } as unknown as RunState;
    await store.saveRunState(runId, tainted);

    const response = await fetch(`${baseUrl}/api/runs/${runId}`);

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const parsed = runResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    const raw = body as { run: Record<string, unknown> & { apiKey?: string } };
    expect(raw.run.apiKey).toBeUndefined();
    expect(raw.run.evidence).toEqual([
      { id: expect.any(String), kind: "search", summary: expect.any(String) }
    ]);
  });

  it("answers 404 RUN_NOT_FOUND for an unknown run id", async () => {
    const { baseUrl } = await createStack();

    const response = await fetch(`${baseUrl}/api/runs/11111111-1111-4111-8111-111111111111`);

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("RUN_NOT_FOUND");
    expect(body.error.message).toContain("run not found");
  });
});

describe("POST /api/runs/:id/stop", () => {
  const runId = "22222222-2222-4222-8222-222222222222";

  async function seedInvestigating(store: RunStore): Promise<void> {
    await store.createRun({
      id: runId,
      state: { id: runId, status: "investigating", phase: "investigation", brief: TEST_BRIEF, prior: TEST_PRIOR }
    });
  }

  it("stops a resumable run and stays idempotent on a second stop", async () => {
    const { baseUrl, store } = await createStack();
    await seedInvestigating(store);

    const first = await postStop(baseUrl, runId, { reason: "operator asked" });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { run: { id: string; status: string } };
    expect(firstBody.run.id).toBe(runId);
    expect(firstBody.run.status).toBe("stopped");

    const second = await postStop(baseUrl, runId, { reason: "operator asked again" });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { run: { id: string; status: string } };
    expect(secondBody.run.id).toBe(runId);
    expect(secondBody.run.status).toBe("stopped");

    const stored = await store.loadRun(runId);
    expect(stored?.state.status).toBe("stopped");
  });

  it("answers 404 RUN_NOT_FOUND for an unknown run id", async () => {
    const { baseUrl } = await createStack();

    const response = await postStop(baseUrl, "33333333-3333-4333-8333-333333333333");

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RUN_NOT_FOUND");
  });
});

describe("POST /api/runs/:id/retry", () => {
  const runId = "44444444-4444-4444-8444-444444444444";

  it("re-enters a stopped run through the existing orchestrator retry capability", async () => {
    const { baseUrl, store } = await createStack();
    await store.createRun({
      id: runId,
      state: { id: runId, status: "stopped", phase: "investigation", brief: TEST_BRIEF, prior: TEST_PRIOR }
    });

    const response = await postRetry(baseUrl, runId);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { run: { id: string; status: string; prior?: unknown } };
    expect(body.run.id).toBe(runId);
    expect(["complete", "partial", "failed"]).toContain(body.run.status);
    expect(body.run.prior).toEqual(TEST_PRIOR);
  });

  it("answers 404 RUN_NOT_FOUND for an unknown run id", async () => {
    const { baseUrl } = await createStack();

    const response = await postRetry(baseUrl, "55555555-5555-4555-8555-555555555555");

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RUN_NOT_FOUND");
  });
});

describe("runStateSchema (expanded tree)", () => {
  const TEST_SITE_READ = {
    anchors: [
      {
        id: "urn:entity:place-blue-note",
        label: "Blue Note Corner",
        letter: "A",
        lat: 40.7144,
        lon: -73.9614,
        evidenceId: "ev-1"
      }
    ],
    heat: [{ lat: 40.715, lon: -73.962, weight: 0.42 }]
  };
  const TEST_CULTURAL_DNA = {
    artists: [{ name: "Alice Coltrane", local: 0.86, city: 0.31 }],
    films: [{ name: "Paris, Texas", local: 74, city: 40 }]
  };
  const TEST_POOL = [
    {
      id: "comp-anchor",
      role: "Anchor",
      tags: ["urn:tag:coffee"],
      exemplars: [{ id: "urn:entity:place-devocion", name: "Devoción" }],
      provenancePath: {
        anchorPlace: "Williamsburg, Brooklyn, NY",
        qlooSignal: "coffee",
        resolvedCategory: "urn:tag:coffee",
        exemplarSet: "specialty coffee roasteries",
        tasteNeighborhood: "daytime coffee culture"
      },
      evidenceState: "measured"
    }
  ];
  const TEST_GRAPH = { nodes: ["comp-anchor"], edges: [] };
  const TEST_COMPOSITIONS = {
    family: {
      poolSize: 1,
      size: 0,
      requiredRoles: [],
      totalCandidates: 0,
      totalValid: 0,
      coherenceDistribution: [],
      reason: "fewer than 2 pool components; no composition can be measured from this pool"
    },
    ranked: [],
    excluded: [],
    triangulation: [],
    rivalFlips: [],
    prior: { state: "not measured", reason: "the run carries no persisted Prior" }
  };
  const TEST_REVISION = {
    rev: 1,
    replacedMember: "comp-anchor",
    newMember: "urn:entity:place-devocion",
    role: "Anchor" as const,
    membersBefore: ["comp-anchor", "comp-social"],
    membersAfter: ["urn:entity:place-devocion", "comp-social"],
    coherenceBefore: 0.72,
    coherenceAfter: 0.75,
    percentileBefore: 81.4,
    percentileAfter: 84.2,
    custom: false
  };

  it("keeps evidence and the expanded node fields through a parse and strips stray keys", () => {
    const evidence = [
      { id: "ev-1", kind: "search", label: "jazz cafe", summary: "one measured anchor", grade: "A" }
    ];
    const parsed = runStateSchema.parse({
      id: "44444444-4444-4444-8444-444444444444",
      status: "complete",
      phase: "measurement",
      brief: TEST_BRIEF,
      prior: TEST_PRIOR,
      evidence,
      siteRead: TEST_SITE_READ,
      culturalDna: TEST_CULTURAL_DNA,
      candidatePool: TEST_POOL,
      graph: TEST_GRAPH,
      compositions: TEST_COMPOSITIONS,
      revisions: [TEST_REVISION],
      apiKey: "should-not-survive"
    });

    expect(parsed.evidence).toEqual(evidence);
    expect(parsed.siteRead).toEqual(TEST_SITE_READ);
    expect(parsed.culturalDna).toEqual(TEST_CULTURAL_DNA);
    expect(parsed.candidatePool).toEqual(TEST_POOL);
    expect(parsed.graph).toEqual(TEST_GRAPH);
    expect(parsed.compositions).toEqual(TEST_COMPOSITIONS);
    expect(parsed.revisions).toEqual([TEST_REVISION]);
    expect((parsed as Record<string, unknown>).apiKey).toBeUndefined();
  });

  it("round-trips the typed nodes through a JSON serialize and re-parse", () => {
    const parsed = runStateSchema.parse({
      id: "44444444-4444-4444-8444-444444444444",
      status: "complete",
      phase: "measurement",
      siteRead: TEST_SITE_READ,
      culturalDna: TEST_CULTURAL_DNA,
      candidatePool: TEST_POOL
    });

    const reloaded = runStateSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(reloaded.siteRead).toEqual(TEST_SITE_READ);
    expect(reloaded.culturalDna).toEqual(TEST_CULTURAL_DNA);
    expect(reloaded.candidatePool).toEqual(TEST_POOL);
  });

  it("rejects unknown keys inside siteRead and pool components, and strips unknown DNA domains", () => {
    expect(() =>
      runStateSchema.parse({
        id: "run-1",
        status: "complete",
        phase: "measurement",
        siteRead: { footprint: "narrow corner" }
      })
    ).toThrow();

    expect(() =>
      runStateSchema.parse({
        id: "run-1",
        status: "complete",
        phase: "measurement",
        candidatePool: [
          {
            ...TEST_POOL[0],
            mood: "sunny"
          }
        ]
      })
    ).toThrow();

    const stripped = runStateSchema.parse({
      id: "run-1",
      status: "investigating",
      phase: "investigation",
      culturalDna: { ...TEST_CULTURAL_DNA, jazz: [{ name: "x", local: 0.5, city: 0.5 }] }
    });
    expect(stripped.culturalDna).toEqual(TEST_CULTURAL_DNA);
  });
});

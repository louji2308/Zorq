import { describe, expect, it } from "vitest";
import { candidatePoolSchema, runStateSchema, type RunState } from "../../src/shared/run.js";
import { validatePool } from "../../src/server/engine/index.js";
import { createOrchestrator } from "../../src/server/orchestrator/index.js";
import { createMemoryStore } from "../../src/server/persistence/index.js";
import { anchorsFromRun, heatFromRun, parseCulturalDna } from "../../src/web/screens/s1/s1Model.js";
import { TEST_BRIEF, TEST_NOW, fakeGateway, fakeLlm, okEnvelope } from "../agent/support/fakes.js";
import { PRIOR_RESPONSE, waitForTerminalRun } from "./support.js";

const DEVOCION = {
  entityId: "urn:entity:place-devocion",
  name: "Devoción",
  type: "place",
  location: { lat: 40.717, lon: -73.958 },
  tags: [{ id: "tag-coffee-1", name: "coffee" }]
};

const NITEHAWK = {
  entityId: "urn:entity:place-nitehawk",
  name: "Nitehawk Cinema",
  type: "place",
  location: { lat: 40.7181, lon: -73.9556 },
  tags: [{ id: "tag-film-1", name: "independent film" }]
};

const SONIC_YOUTH = { entityId: "urn:entity:artist-sonic-youth", name: "Sonic Youth", type: "artist" };

const TAG_RESULTS = {
  tags: [
    { id: "tag-coffee-1", name: "coffee" },
    { id: "tag-film-1", name: "independent film" }
  ]
};

const SEARCH_RESULTS = { entities: [DEVOCION, NITEHAWK, SONIC_YOUTH] };

const HEAT_RESULTS = {
  heatmap: [
    { latitude: 40.715, longitude: -73.962, affinity: 0.8 },
    { latitude: 40.716, longitude: -73.961, affinity: 0.55 }
  ]
};

const POOL_DRAFT = {
  components: [
    {
      id: "comp-anchor",
      role: "Anchor",
      tags: ["coffee"],
      exemplars: [{ id: DEVOCION.entityId, name: DEVOCION.name }],
      provenancePath: {
        anchorPlace: "Williamsburg, Brooklyn, NY",
        qlooSignal: "coffee",
        resolvedCategory: "urn:tag:coffee",
        exemplarSet: "specialty coffee roasteries",
        tasteNeighborhood: "daytime coffee culture"
      },
      evidenceState: "measured"
    },
    {
      id: "comp-discovery",
      role: "Discovery",
      tags: ["independent film"],
      exemplars: [{ id: NITEHAWK.entityId, name: NITEHAWK.name }],
      provenancePath: {
        anchorPlace: "Williamsburg, Brooklyn, NY",
        qlooSignal: "independent film",
        resolvedCategory: "urn:tag:film",
        exemplarSet: "neighborhood cinemas",
        tasteNeighborhood: "film-led discovery"
      },
      evidenceState: "incomplete"
    }
  ]
};

function scriptedGateway() {
  return fakeGateway({
    onCall: (call) => {
      if (call.operation === "resolveTags") {
        return okEnvelope("resolveTags", { results: TAG_RESULTS, resultCount: 2 });
      }
      if (call.operation === "search") {
        return okEnvelope("search", { results: SEARCH_RESULTS, resultCount: 3 });
      }
      if (call.operation === "insights") {
        return okEnvelope("insights", { results: HEAT_RESULTS, resultCount: 2 });
      }
      return okEnvelope(call.operation);
    }
  });
}

const TURN_ONE = {
  content: "resolving tags and searching anchors",
  toolCalls: [
    { id: "call_1", name: "qloo_resolve_tags", arguments: '{"query": "coffee"}' },
    { id: "call_2", name: "qloo_search", arguments: '{"query": "jazz cafe", "take": 5}' }
  ]
};

const TURN_TWO = {
  content: "reading local heat, then proposing the pool",
  toolCalls: [
    {
      id: "call_3",
      name: "qloo_insights",
      arguments: '{"filterType": "heatmap", "location": {"point": {"lat": 40.7144, "lon": -73.9614}}}'
    },
    { id: "call_4", name: "propose_candidate_pool", arguments: JSON.stringify(POOL_DRAFT) }
  ]
};

const FINAL_TURN = { content: "Two grounded components proposed; everything else remains unproven." };

async function runScripted(
  responses: Parameters<typeof fakeLlm>[0]
): Promise<{ state: RunState; runId: string; store: ReturnType<typeof createMemoryStore> }> {
  const store = createMemoryStore();
  const llm = fakeLlm(responses);
  const gateway = scriptedGateway();
  const orchestrator = createOrchestrator({
    store,
    gateway: gateway.gateway,
    llm: llm.client,
    now: () => TEST_NOW
  });
  const created = await orchestrator.startRun({ brief: TEST_BRIEF });
  const state = await waitForTerminalRun(store, created.id);
  return { state, runId: created.id, store };
}

describe("W-7.1 investigation capture (scripted LLM + fake gateway)", () => {
  it("persists a typed siteRead and engine-validated candidatePool while culturalDna stays absent", async () => {
    const { state, runId, store } = await runScripted([
      { content: PRIOR_RESPONSE },
      TURN_ONE,
      TURN_TWO,
      FINAL_TURN
    ]);

    expect(state.status).toBe("complete");
    expect(state.phase).toBe("measurement");
    expect(runStateSchema.safeParse(state).success).toBe(true);

    expect(state.siteRead).toEqual({
      anchors: [
        {
          id: DEVOCION.entityId,
          label: DEVOCION.name,
          letter: "A",
          lat: 40.717,
          lon: -73.958,
          evidenceId: expect.any(String)
        },
        {
          id: NITEHAWK.entityId,
          label: NITEHAWK.name,
          letter: "B",
          lat: 40.7181,
          lon: -73.9556,
          evidenceId: expect.any(String)
        }
      ],
      heat: [
        { lat: 40.715, lon: -73.962, weight: 0.8 },
        { lat: 40.716, lon: -73.961, weight: 0.55 }
      ]
    });

    expect(state.candidatePool).toBeDefined();
    expect(validatePool(state.candidatePool)).toEqual(state.candidatePool);
    expect(candidatePoolSchema.parse(state.candidatePool)).toEqual(state.candidatePool);
    expect(state.candidatePool?.map((component) => component.role)).toEqual(["Anchor", "Discovery"]);

    expect(state.culturalDna).toBeUndefined();

    expect(anchorsFromRun(state)).toEqual([
      { lat: 40.717, lon: -73.958, letter: "A" },
      { lat: 40.7181, lon: -73.9556, letter: "B" }
    ]);
    expect(heatFromRun(state)).toEqual([
      { lat: 40.715, lon: -73.962, weight: 0.8 },
      { lat: 40.716, lon: -73.961, weight: 0.55 }
    ]);
    expect(parseCulturalDna(state.culturalDna)).toEqual([]);

    const evidence = await store.listEvidence(runId);
    const evidenceIds = new Set(evidence.map((record) => record.id));
    for (const anchor of state.siteRead?.anchors ?? []) {
      expect(evidenceIds.has(anchor.evidenceId)).toBe(true);
    }

    const stored = await store.loadRun(runId);
    expect(stored).not.toBeNull();
    const reloaded = runStateSchema.parse(stored?.state);
    expect(reloaded.siteRead).toEqual(state.siteRead);
    expect(reloaded.candidatePool).toEqual(state.candidatePool);
    expect(reloaded.culturalDna).toBeUndefined();

    const ledger = await store.listLedgerEvents(runId);
    const labels = ledger.map((entry) => entry.event.label);
    expect(labels).toContain("agent.candidate_pool");
    expect(labels).toContain("investigate:capture");
    expect(labels.at(-1)).toBe("measure.compose");
    expect(labels.indexOf("agent.candidate_pool")).toBeLessThan(labels.indexOf("investigate:capture"));
    expect(labels.indexOf("investigate:capture")).toBeLessThan(labels.indexOf("measure.compose"));

    const poolEvent = ledger.find((entry) => entry.event.label === "agent.candidate_pool");
    expect(poolEvent?.event.kind).toBe("Compute");
    expect(poolEvent?.event.resultCount).toBe(2);
    expect(poolEvent?.event.summary).toContain("validated by the engine");

    const captureEvent = ledger.find((entry) => entry.event.label === "investigate:capture");
    expect(captureEvent?.event.kind).toBe("Compute");
    expect(captureEvent?.event.summary).toContain("2 anchor(s)");
    expect(captureEvent?.event.summary).toContain("2 heat cell(s)");
    expect(captureEvent?.event.summary).toContain("2 component(s)");
  });

  it("keeps the pool unformed and records an honest rejection when an exemplar is fabricated", async () => {
    const fabricated = {
      components: [
        {
          ...POOL_DRAFT.components[0],
          exemplars: [{ id: "urn:entity:place-imaginary", name: "Imaginary Cafe" }]
        }
      ]
    };
    const { state, runId, store } = await runScripted([
      { content: PRIOR_RESPONSE },
      TURN_ONE,
      {
        content: "proposing anyway",
        toolCalls: [{ id: "call_3", name: "propose_candidate_pool", arguments: JSON.stringify(fabricated) }]
      },
      FINAL_TURN
    ]);

    expect(state.status).toBe("complete");
    expect(state.candidatePool).toBeUndefined();
    expect(state.siteRead?.anchors).toHaveLength(2);
    expect(state.culturalDna).toBeUndefined();

    const ledger = await store.listLedgerEvents(runId);
    const rejection = ledger.find((entry) => entry.event.label === "agent.candidate_pool");
    expect(rejection?.event.summary).toContain("candidate pool rejected");
    expect(rejection?.event.summary).toContain("never observed");
    const capture = ledger.find((entry) => entry.event.label === "investigate:capture");
    expect(capture?.event.summary).toContain("2 anchor(s)");
    expect(capture?.event.summary).toContain("0 component(s)");

    const stored = await store.loadRun(runId);
    expect(stored).not.toBeNull();
    expect(runStateSchema.parse(stored?.state).candidatePool).toBeUndefined();
  });

  it("refuses a second pool proposal and keeps the first accepted pool", async () => {
    const { state } = await runScripted([
      { content: PRIOR_RESPONSE },
      TURN_ONE,
      TURN_TWO,
      {
        content: "proposing again",
        toolCalls: [
          { id: "call_5", name: "propose_candidate_pool", arguments: JSON.stringify(POOL_DRAFT) }
        ]
      }
    ]);

    expect(state.candidatePool?.map((component) => component.id)).toEqual([
      "comp-anchor",
      "comp-discovery"
    ]);
  });

  it("captures only what was observed when the run never proposes a pool", async () => {
    const { state, runId, store } = await runScripted([
      { content: PRIOR_RESPONSE },
      TURN_ONE,
      FINAL_TURN
    ]);

    expect(state.status).toBe("complete");
    expect(state.candidatePool).toBeUndefined();
    expect(state.culturalDna).toBeUndefined();
    expect(state.siteRead?.anchors).toHaveLength(2);
    expect(state.siteRead?.heat).toBeUndefined();

    const ledger = await store.listLedgerEvents(runId);
    const capture = ledger.find((entry) => entry.event.label === "investigate:capture");
    expect(capture?.event.summary).toContain("2 anchor(s)");
    expect(capture?.event.summary).toContain("0 heat cell(s)");
    expect(capture?.event.summary).toContain("0 component(s)");
  });
});

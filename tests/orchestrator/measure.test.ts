import { describe, expect, it } from "vitest";
import type { LedgerEvent } from "../../src/shared/events.js";
import { runStateSchema, type RunState } from "../../src/shared/run.js";
import { createLedger, type Ledger } from "../../src/server/agent/ledger.js";
import { localityLadder, runMeasurement } from "../../src/server/orchestrator/measure.js";
import type { QlooEnvelope, QlooOperation } from "../../src/server/qloo/index.js";
import { makeComponent } from "../engine/fixtures.js";
import { fakeGateway, okEnvelope, TEST_BRIEF, TEST_NOW, TEST_PRIOR } from "../agent/support/fakes.js";

interface InsightsRequest {
  filterType?: string;
  signalEntities?: string[];
  signalLocation?: string;
  filterTags?: string[];
  location?: { point: { lat: number; lon: number }; radiusM: number };
  take?: number;
}

interface FakeEntity {
  entityId: string;
  name?: string;
  type?: string;
  affinity?: number;
  popularity?: number;
}

function entitiesEnvelope(entities: FakeEntity[]): QlooEnvelope<unknown> {
  return okEnvelope("insights", {
    results: { entities, heatmap: [] },
    resultCount: entities.length
  });
}

function stateWithPool(pool: unknown[], overrides: Partial<RunState> = {}): RunState {
  const state: RunState = {
    id: "run-measure",
    status: "measuring",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: pool as RunState["candidatePool"],
    ...overrides
  };
  return runStateSchema.parse(state);
}

function labels(ledger: Ledger): string[] {
  return ledger.list().map((entry) => entry.event.label);
}

function stripEvidenceIds(neighborhoods: RunState["neighborhoods"]): unknown {
  if (neighborhoods === undefined) {
    return undefined;
  }
  return {
    components: neighborhoods.components,
    city: neighborhoods.city,
    sources: neighborhoods.sources.map((source) => ({
      componentId: source.componentId,
      domain: source.domain,
      scope: source.scope
    }))
  };
}

const COMPONENT_ENTITIES: Record<string, Record<string, FakeEntity[]>> = {
  coffee: {
    artist: [
      { entityId: "urn:entity:artist-alice", name: "Alice Coltrane", type: "artist", affinity: 0.9 },
      { entityId: "urn:entity:artist-sun", name: "Sun Ra", type: "artist", affinity: 0.7 },
      { entityId: "urn:entity:artist-bill", name: "Bill Evans", type: "artist", affinity: 0.6 },
      { entityId: "urn:entity:artist-mary", name: "Mary Lou Williams", type: "artist", affinity: 0.5 },
      { entityId: "urn:entity:artist-thelonious", name: "Thelonious Monk", type: "artist", affinity: 0.4 }
    ],
    movie: [
      { entityId: "urn:entity:film-paris-texas", name: "Paris, Texas", type: "movie", affinity: 0.8 },
      { entityId: "urn:entity:film-stalker", name: "Stalker", type: "movie", affinity: 0.6 }
    ],
    brand: [
      { entityId: "urn:entity:brand-seesaw", name: "Seesaw Coffee", type: "brand", affinity: 0.7 }
    ]
  },
  cinema: {
    artist: [
      { entityId: "urn:entity:artist-miles", name: "Miles Davis", type: "artist", affinity: 0.9 },
      { entityId: "urn:entity:artist-coltrane", name: "John Coltrane", type: "artist", affinity: 0.8 },
      { entityId: "urn:entity:artist-park", name: "Charlie Parker", type: "artist", affinity: 0.55 },
      { entityId: "urn:entity:artist-duke", name: "Duke Ellington", type: "artist", affinity: 0.45 },
      { entityId: "urn:entity:artist-ella", name: "Ella Fitzgerald", type: "artist", affinity: 0.35 }
    ],
    movie: [
      { entityId: "urn:entity:film-in-the-mood", name: "In the Mood for Love", type: "movie", affinity: 0.85 },
      { entityId: "urn:entity:film-chungking", name: "Chungking Express", type: "movie", affinity: 0.75 }
    ],
    brand: [
      { entityId: "urn:entity:brand-nitehawk", name: "Nitehawk", type: "brand", affinity: 0.65 }
    ]
  },
  books: {
    artist: [
      { entityId: "urn:entity:artist-fela", name: "Fela Kuti", type: "artist", affinity: 0.88 },
      { entityId: "urn:entity:artist-miriam", name: "Miriam Makeba", type: "artist", affinity: 0.72 },
      { entityId: "urn:entity:artist-brian", name: "Brian Eno", type: "artist", affinity: 0.6 },
      { entityId: "urn:entity:artist-sster", name: "Sister Rosetta Tharpe", type: "artist", affinity: 0.5 },
      { entityId: "urn:entity:artist-sun", name: "Sun Ra", type: "artist", affinity: 0.3 }
    ],
    movie: [
      { entityId: "urn:entity:film-wings-of-desire", name: "Wings of Desire", type: "movie", affinity: 0.7 },
      { entityId: "urn:entity:film-blur", name: "Blow-Up", type: "movie", affinity: 0.55 }
    ],
    brand: [
      { entityId: "urn:entity:brand-mcnally", name: "McNally Jackson", type: "brand", affinity: 0.8 }
    ]
  }
};

function sharedSignalGateway(request: InsightsRequest): QlooEnvelope<unknown> | undefined {
  const signals = request.signalEntities ?? [];
  const matching = Object.keys(COMPONENT_ENTITIES).filter((key) =>
    signals.includes(`urn:entity:place-${key}`)
  );
  if (matching.length === 0 || request.filterTags !== undefined) {
    return undefined;
  }
  const domain = request.filterType ?? "artist";
  const entities = matching.flatMap((key) => COMPONENT_ENTITIES[key]?.[domain] ?? []);
  const deduped = [...new Map(entities.map((entity) => [entity.entityId, entity])).values()];
  const limited = request.signalLocation !== undefined ? deduped.slice(0, 4) : deduped;
  return entitiesEnvelope(limited);
}

function measure(
  state: RunState,
  onCall?: (request: InsightsRequest, operation: QlooOperation) => QlooEnvelope<unknown> | undefined,
  options: { shouldStop?: () => boolean; budgetRemainingAfter?: number } = {}
) {
  const ledger = createLedger();
  const fake = fakeGateway({
    onCall: (call) => {
      if (call.operation === "insights") {
        const response = onCall?.(call.request as InsightsRequest, "insights");
        if (response !== undefined) {
          return response;
        }
      }
      if (call.operation === "resolveTags") {
        return okEnvelope("resolveTags", {
          results: { tags: [{ id: "urn:tag:cuisine:qloo:coffee", name: "coffee", type: "Interest" }] },
          resultCount: 1
        });
      }
      return okEnvelope(call.operation);
    }
  });
  const gateway =
    options.budgetRemainingAfter === undefined
      ? fake.gateway
      : ({
          capabilities: fake.gateway.capabilities,
          search: fake.gateway.search,
          resolveTags: fake.gateway.resolveTags,
          insights: fake.gateway.insights,
          describe: fake.gateway.describe,
          bridge: fake.gateway.bridge,
          replace: fake.gateway.replace,
          triangulate: fake.gateway.triangulate,
          close: fake.gateway.close,
          get stats() {
            return {
              budgetUsed: 180 - options.budgetRemainingAfter!,
              budgetRemaining: options.budgetRemainingAfter!,
              cacheSize: 0,
              cacheHits: 0
            };
          }
        } as typeof fake.gateway);
  return {
    ledger,
    fake,
    gateway,
    run: () =>
      runMeasurement({
        state,
        gateway,
        ledger,
        now: () => TEST_NOW,
        shouldStop: options.shouldStop ?? (() => false)
      })
  };
}

const POOL = [
  makeComponent({
    id: "coffee",
    role: "Anchor",
    tags: ["coffee"],
    exemplars: [{ id: "urn:entity:place-coffee", name: "Devoción" }]
  }),
  makeComponent({
    id: "cinema",
    role: "Discovery",
    tags: ["cinema"],
    exemplars: [{ id: "urn:entity:place-cinema", name: "Nitehawk" }]
  }),
  makeComponent({
    id: "books",
    role: "Community",
    tags: ["books"],
    exemplars: [{ id: "urn:entity:place-books", name: "McNally Jackson" }]
  })
];

describe("localityLadder", () => {
  it("keeps a single attempt when the location has no broader form", () => {
    expect(localityLadder("Williamsburg")).toEqual(["Williamsburg"]);
  });

  it("adds the last two comma-trimmed segments as a broader attempt", () => {
    expect(localityLadder("Williamsburg, Brooklyn, NY")).toEqual(["Williamsburg, Brooklyn, NY", "Brooklyn, NY"]);
  });

  it("does not duplicate a two-segment location", () => {
    expect(localityLadder("Brooklyn, NY")).toEqual(["Brooklyn, NY"]);
  });
});

describe("runMeasurement", () => {
  it("returns the input state untouched when the pool is missing or empty", async () => {
    const noPool = stateWithPool([], {});
    const missingPool = runStateSchema.parse({
      id: "run-x",
      status: "measuring",
      phase: "measurement",
      brief: TEST_BRIEF
    });
    const a = measure(noPool);
    const b = measure(missingPool);
    const resultA = await a.run();
    const resultB = await b.run();
    expect(resultA.state).toEqual(noPool);
    expect(resultA.evidence).toEqual([]);
    expect(resultA.degraded).toBe(false);
    expect(resultB.state).toEqual(missingPool);
    expect(a.fake.calls).toHaveLength(0);
    expect(b.fake.calls).toHaveLength(0);
  });

  it("builds neighborhoods, a graph, compositions, DNA, and emits ordered ledger events with linked evidence", async () => {
    const harness = measure(stateWithPool(POOL), sharedSignalGateway);
    const result = await harness.run();

    expect(result.state.neighborhoods).toBeDefined();
    expect(result.state.neighborhoods?.components).toHaveLength(3);
    expect(result.state.neighborhoods?.city).toHaveLength(3);
    expect(result.state.neighborhoods?.sources.length).toBeGreaterThan(0);
    expect(result.state.neighborhoods?.sources.every((source) => source.evidenceId !== "")).toBe(true);

    expect(result.state.graph?.nodes).toEqual(["books", "cinema", "coffee"]);
    expect(result.state.graph?.edges.length).toBe(3);

    expect(result.state.compositions).toBeDefined();
    expect(result.state.compositions?.prior?.state).toBe("not measured");
    expect(result.state.compositions?.ranked.length).toBeGreaterThan(0);

    expect(result.state.culturalDna?.artists?.length).toBeGreaterThan(0);
    expect(result.state.culturalDna?.artists?.[0]?.name).toBe("Alice Coltrane");
    for (const group of [
      result.state.culturalDna?.artists,
      result.state.culturalDna?.films,
      result.state.culturalDna?.brands
    ]) {
      for (const entity of group ?? []) {
        expect(entity.local).toBeGreaterThanOrEqual(0);
        expect(entity.local).toBeLessThanOrEqual(100);
        expect(entity.city).toBeGreaterThanOrEqual(0);
        expect(entity.city).toBeLessThanOrEqual(100);
      }
    }
    expect(result.state.culturalDna?.artists?.[0]?.local).toBeLessThan(100);

    const eventLabels = labels(harness.ledger);
    expect(eventLabels).toContain("measure.neighborhoods");
    expect(eventLabels).toContain("measure.graph");
    expect(eventLabels).toContain("measure.compositions");
    expect(eventLabels).toContain("measure.dna");
    expect(eventLabels).toContain("measure.neighborhood_fetch");

    const evidenceIds = new Set(result.evidence.map((record) => record.id));
    expect(result.evidence.length).toBeGreaterThan(0);
    for (const source of result.state.neighborhoods?.sources ?? []) {
      expect(evidenceIds.has(source.evidenceId)).toBe(true);
    }

    const evidenceEventIds = new Set(result.evidence.map((record) => record.ledgerEventId));
    const ledgerIds = new Set(harness.ledger.list().map((entry) => entry.id));
    for (const id of evidenceEventIds) {
      expect(ledgerIds.has(id)).toBe(true);
    }

    expect(runStateSchema.parse(result.state)).toEqual(result.state);
  });

  it("is deterministic across two identical runs", async () => {
    const first = await measure(stateWithPool(POOL), sharedSignalGateway).run();
    const second = await measure(stateWithPool(POOL), sharedSignalGateway).run();
    expect(stripEvidenceIds(first.state.neighborhoods)).toEqual(stripEvidenceIds(second.state.neighborhoods));
    expect(first.state.graph).toEqual(second.state.graph);
    expect(first.state.compositions).toEqual(second.state.compositions);
    expect(first.state.culturalDna).toEqual(second.state.culturalDna);
  });

  it("stops initiating fetches when the budget reserve is reached and reports degraded without fabricating results", async () => {
    const harness = measure(stateWithPool(POOL), sharedSignalGateway, { budgetRemainingAfter: 0 });
    const result = await harness.run();
    expect(result.degraded).toBe(true);
    expect(result.evidence).toEqual([]);
    expect(result.state.neighborhoods).toBeDefined();
    expect(harness.fake.calls.filter((call) => call.operation === "insights")).toHaveLength(0);
  });

  it("degrades to an empty-family reason when the pool has fewer than two components", async () => {
    const single = [POOL[0]!];
    const harness = measure(stateWithPool(single), sharedSignalGateway);
    const result = await harness.run();
    expect(result.degraded).toBe(false);
    expect(result.state.compositions?.family.totalValid).toBe(0);
    expect(result.state.compositions?.family.reason).toContain("fewer than 2 pool components");
    expect(result.state.compositions?.ranked).toEqual([]);
  });

  it("respects shouldStop between fetches", async () => {
    let calls = 0;
    const harness = measure(
      stateWithPool(POOL),
      (request) => {
        calls += 1;
        return sharedSignalGateway(request);
      },
      { shouldStop: () => calls >= 1 }
    );
    const result = await harness.run();
    expect(result.degraded).toBe(true);
    expect(calls).toBeLessThan(6);
  });

  it("stops the run after two consecutive gateway failures", async () => {
    const harness = measure(stateWithPool(POOL), () => {
      throw new Error("simulated outage");
    });
    const result = await harness.run();
    expect(result.degraded).toBe(true);
    expect(harness.fake.calls.filter((call) => call.operation === "insights").length).toBeLessThanOrEqual(2);
    const failureEvents = harness.ledger
      .list()
      .filter((entry) => entry.event.label === "measure.neighborhood_fetch" && entry.event.summary.includes("call failed"));
    expect(failureEvents.length).toBeGreaterThan(0);
  });

  it("grades finalist compositions without inventing triangulation evidence", async () => {
    const harness = measure(stateWithPool(POOL), sharedSignalGateway);
    const result = await harness.run();
    const ranked = result.state.compositions?.ranked ?? [];
    expect(ranked.length).toBeGreaterThan(0);
    for (const composition of ranked) {
      expect(["A", "B", "C"]).toContain(composition.grade);
      expect(composition.size).toBe(composition.members.length);
    }
    expect(result.state.compositions?.family.requiredRoles).toEqual(["Anchor"]);
  });

  it("never reports a confirmed triangulation when route-2 probes return no usable results", async () => {
    const harness = measure(
      stateWithPool(POOL),
      (request) => {
        if (request.filterTags !== undefined) {
          return entitiesEnvelope([]);
        }
        return sharedSignalGateway(request);
      },
      {}
    );
    const result = await harness.run();
    const classifications = result.state.compositions?.triangulation ?? [];
    expect(classifications.length).toBeGreaterThan(0);
    expect(classifications.every((entry) => entry.state !== "confirmed")).toBe(true);
  });

  it("grades finalist compositions at B when triangulation fails rather than vacuous A", async () => {
    const harness = measure(
      stateWithPool(POOL),
      (request) => {
        if (request.filterTags !== undefined) {
          return entitiesEnvelope([]);
        }
        return sharedSignalGateway(request);
      },
      {}
    );
    const result = await harness.run();
    const ranked = result.state.compositions?.ranked ?? [];
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((composition) => composition.grade === "B")).toBe(true);
  });

  it("resolves a Prior marker when at least two members resolve against the pool", async () => {
    const state = stateWithPool(POOL, {
      prior: {
        ...TEST_PRIOR,
        composition: {
          thesis: "test",
          members: [
            { role: "Anchor", name: "Devoción", why: "a" },
            { role: "Discovery", name: "Nitehawk", why: "b" }
          ]
        }
      }
    });
    const harness = measure(state, sharedSignalGateway);
    const result = await harness.run();
    const prior = result.state.compositions?.prior;
    expect(prior?.state).toBe("measured");
    if (prior?.state === "measured") {
      expect(prior.members).toEqual(["cinema", "coffee"]);
      expect(prior.coherence).toBeGreaterThanOrEqual(0);
      expect(prior.coherence).toBeLessThanOrEqual(1);
    }
  });

  it("reports a not-measured Prior marker when no member resolves against the pool", async () => {
    const state = stateWithPool(POOL, {
      prior: {
        ...TEST_PRIOR,
        composition: {
          thesis: "test",
          members: [
            { role: "Anchor", name: "Nonexistent Roastery", why: "a" },
            { role: "Discovery", name: "Nonexistent Cinema", why: "b" }
          ]
        }
      }
    });
    const harness = measure(state, sharedSignalGateway);
    const result = await harness.run();
    const prior = result.state.compositions?.prior;
    expect(prior?.state).toBe("not measured");
    if (prior?.state === "not measured") {
      expect(prior.reason).toContain("Prior");
    }
  });

  it("uses the unlocalized city baseline and never sends signalLocation for the city scope", async () => {
    const locations: Array<string | undefined> = [];
    const harness = measure(stateWithPool(POOL), (request) => {
      locations.push(request.signalLocation);
      return sharedSignalGateway(request);
    });
    await harness.run();
    expect(locations.some((location) => location !== undefined)).toBe(true);
    const siteCalls = harness.fake.calls
      .filter((call) => call.operation === "insights")
      .map((call) => call.request as InsightsRequest)
      .filter((request) => request.signalLocation !== undefined);
    expect(siteCalls.length).toBeGreaterThan(0);
    expect(siteCalls.every((request) => request.signalLocation === TEST_BRIEF.location || request.signalLocation === "Brooklyn, NY")).toBe(true);
  });

  it("emits a failed-call ledger event without creating evidence for failed calls", async () => {
    const harness = measure(stateWithPool(POOL), (request) => {
      if (request.signalLocation === TEST_BRIEF.location) {
        throw new Error("upstream boom");
      }
      return sharedSignalGateway(request);
    });
    const result = await harness.run();
    const failed = harness.ledger
      .list()
      .filter((entry) => entry.event.summary.includes("boom") || entry.event.summary.includes("call failed"));
    expect(failed.length).toBeGreaterThan(0);
    expect(result.evidence.every((record) => !record.claim.includes("boom"))).toBe(true);
  });
});

describe("ledger event kinds", () => {
  it("uses Qloo-kind events for gateway observations and Compute-kind events for local arithmetic", async () => {
    const harness = measure(stateWithPool(POOL), sharedSignalGateway);
    await harness.run();
    const events = harness.ledger.list().map((entry) => entry.event);
    const computeLabels = events.filter((event: LedgerEvent) => event.kind === "Compute").map((event) => event.label);
    const qlooLabels = events.filter((event: LedgerEvent) => event.kind === "Qloo").map((event) => event.label);
    expect(computeLabels).toContain("measure.neighborhoods");
    expect(computeLabels).toContain("measure.graph");
    expect(computeLabels).toContain("measure.compositions");
    expect(qlooLabels).toContain("measure.neighborhood_fetch");
  });
});

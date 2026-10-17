import { describe, expect, it } from "vitest";
import type { ChallengeRequest } from "../../src/shared/routes.js";
import {
  runStateSchema,
  type ChallengeReport,
  type RunGraphEdge,
  type RunNeighborhoods,
  type RunRankedComposition,
  type RunState
} from "../../src/shared/run.js";
import { LlmBudget } from "../../src/server/agent/budget.js";
import type { LlmClient } from "../../src/server/agent/llm.js";
import { createLedger, type Ledger } from "../../src/server/agent/ledger.js";
import { resolveVerdict, runChallenge, type ChallengeOutcome } from "../../src/server/orchestrator/challenge.js";
import { OrchestratorStateError, RunBusyError, createOrchestrator } from "../../src/server/orchestrator/index.js";
import type { QlooGateway } from "../../src/server/qloo/index.js";
import { RunNotFound, createMemoryStore } from "../../src/server/persistence/index.js";
import { makeComponent } from "../engine/fixtures.js";
import {
  TEST_BRIEF,
  TEST_NOW,
  TEST_PRIOR,
  fakeGateway,
  fakeLlm,
  okEnvelope,
  outageError
} from "../agent/support/fakes.js";
import { FINAL_TURN, PRIOR_RESPONSE, completion, deferred } from "./support.js";

function edgesOf(pairs: ReadonlyArray<readonly [string, string, number]>): RunGraphEdge[] {
  return pairs.map(([a, b, value]) => ({ a, b, value, band: "typical", state: "measured" }));
}

function rankedEntry(
  members: string[],
  coherence: number,
  distinctivenessMean: number,
  percentile: number,
  rankScore: number,
  weakestLink: { a: string; b: string; value: number }
): RunRankedComposition {
  return {
    members,
    size: members.length,
    coherence,
    percentile,
    distinctivenessMean,
    weakestLink,
    rankScore,
    grade: "B",
    gradeReasons: ["fixture ranking"]
  };
}

function disjointNeighborhoods(ids: readonly string[]): RunNeighborhoods {
  return {
    components: ids.map((id) => ({
      componentId: id,
      domains: {
        artist: [{ entityId: `urn:entity:artist-site-${id}`, rank: 1, weight: 1, affinityUsed: true }],
        movie: [],
        brand: []
      },
      state: "measured" as const
    })),
    city: ids.map((id) => ({
      componentId: id,
      domains: {
        artist: [{ entityId: `urn:entity:artist-city-${id}`, rank: 1, weight: 1, affinityUsed: true }],
        movie: [],
        brand: []
      },
      state: "measured" as const
    })),
    sources: []
  };
}

function emptyBridgeGateway(): QlooGateway {
  return fakeGateway({
    onCall: (call) =>
      call.operation === "bridge"
        ? okEnvelope("bridge", { results: { entities: [] }, resultCount: 0 })
        : okEnvelope(call.operation)
  }).gateway;
}

function bridgeFixtureGateway(): QlooGateway {
  return fakeGateway({
    onCall: (call) => {
      if (call.operation === "bridge") {
        return okEnvelope("bridge", {
          results: {
            entities: [
              {
                entityId: "urn:entity:bridge-listening-bar",
                name: "Listening Bar",
                type: "place",
                affinity: 0.9,
                popularity: 0.7
              },
              {
                entityId: "urn:entity:bridge-static-age",
                name: "Static Age",
                type: "place",
                affinity: 0.8,
                popularity: 0.6
              }
            ]
          },
          resultCount: 2
        });
      }
      if (call.operation === "insights") {
        const request = (call.request ?? {}) as { signalLocation?: string };
        const site = typeof request.signalLocation === "string" && request.signalLocation !== "";
        const entity = site
          ? { entityId: "urn:entity:artist-site-shared", name: "Shared Site Artist", affinity: 0.9 }
          : { entityId: "urn:entity:artist-city-z", name: "Bridge City Artist", affinity: 0.8 };
        return okEnvelope("insights", {
          results: { entities: [{ ...entity, type: "artist" }] },
          resultCount: 1
        });
      }
      return okEnvelope(call.operation);
    }
  }).gateway;
}

const FIVE_POOL = [
  makeComponent({ id: "anchor", role: "Anchor", tags: ["coffee"] }),
  makeComponent({ id: "cinema", role: "Discovery", tags: ["cinema"] }),
  makeComponent({ id: "cafe", role: "Social", tags: ["cafe"] }),
  makeComponent({ id: "books", role: "Community", tags: ["books"] }),
  makeComponent({ id: "music", role: "Discovery", tags: ["vinyl"] })
];

const C_POOL = [
  makeComponent({ id: "anchor", role: "Anchor", tags: ["coffee"] }),
  makeComponent({ id: "cinema", role: "Discovery", tags: ["cinema"] }),
  makeComponent({ id: "cafe", role: "Social", tags: ["cafe"] }),
  makeComponent({ id: "night", role: "Night", tags: ["bar"] }),
  makeComponent({ id: "stage", role: "Experience", tags: ["gallery"] })
];

function fixtureA(overrides: Partial<RunState> = {}): RunState {
  return runStateSchema.parse({
    id: "run-challenge-survived",
    status: "complete",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: FIVE_POOL,
    graph: {
      nodes: ["anchor", "books", "cafe", "cinema", "music"],
      edges: edgesOf([
        ["anchor", "books", 0.3],
        ["anchor", "cafe", 0.3],
        ["anchor", "cinema", 0.3],
        ["anchor", "music", 0.3],
        ["books", "cafe", 0.3],
        ["books", "cinema", 0.3],
        ["books", "music", 0.3],
        ["cafe", "cinema", 0.3],
        ["cafe", "music", 0.3],
        ["cinema", "music", 0.3]
      ])
    },
    compositions: {
      ranked: [
        rankedEntry(["anchor", "cinema", "cafe"], 0.3, 0.5, 66, 0.45, { a: "anchor", b: "cafe", value: 0.3 }),
        rankedEntry(["anchor", "cinema", "music"], 0.3, 0.5, 66, 0.44, { a: "anchor", b: "music", value: 0.3 }),
        rankedEntry(["anchor", "cafe", "books"], 0.3, 0.5, 66, 0.43, { a: "anchor", b: "books", value: 0.3 })
      ],
      excluded: [],
      triangulation: [],
      rivalFlips: [],
      family: {
        poolSize: 5,
        size: 3,
        requiredRoles: ["Anchor"],
        totalCandidates: 10,
        totalValid: 6,
        coherenceDistribution: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3]
      },
      prior: { state: "not measured", reason: "fixture prior has no measured counterpart" }
    },
    ...overrides
  });
}

function fixtureB(): RunState {
  return runStateSchema.parse({
    id: "run-challenge-revised-twice",
    status: "complete",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: FIVE_POOL,
    graph: {
      nodes: ["anchor", "books", "cafe", "cinema", "music"],
      edges: edgesOf([
        ["anchor", "books", 0.5],
        ["anchor", "cafe", 0.52],
        ["anchor", "cinema", 0.52],
        ["anchor", "music", 0.57],
        ["books", "cafe", 0.5],
        ["books", "cinema", 0.5],
        ["books", "music", 0.5],
        ["cafe", "cinema", 0.52],
        ["cafe", "music", 0.56],
        ["cinema", "music", 0.5]
      ])
    },
    neighborhoods: disjointNeighborhoods(["anchor", "books", "cafe", "cinema", "music"]),
    compositions: {
      ranked: [
        rankedEntry(["anchor", "cinema", "cafe"], 0.52, 0.6, 66, 0.6, { a: "anchor", b: "cafe", value: 0.52 }),
        rankedEntry(["anchor", "music", "cafe"], 0.55, 0.58, 80, 0.545, { a: "anchor", b: "cafe", value: 0.52 }),
        rankedEntry(["anchor", "cinema", "music"], 0.53, 0.56, 60, 0.51, { a: "cinema", b: "music", value: 0.5 }),
        rankedEntry(["anchor", "books", "cafe"], 0.5066666666666667, 0.54, 20, 0.5, { a: "anchor", b: "books", value: 0.5 }),
        rankedEntry(["anchor", "books", "music"], 0.5233333333333333, 0.55, 40, 0.49, { a: "anchor", b: "books", value: 0.5 })
      ],
      excluded: [],
      triangulation: [],
      rivalFlips: [],
      family: {
        poolSize: 5,
        size: 3,
        requiredRoles: ["Anchor"],
        totalCandidates: 10,
        totalValid: 6,
        coherenceDistribution: [
          0.5066666666666667,
          0.5066666666666667,
          0.52,
          0.5233333333333333,
          0.53,
          0.55
        ]
      },
      prior: { state: "not measured", reason: "fixture prior has no measured counterpart" }
    }
  });
}

function fixtureC(): RunState {
  return runStateSchema.parse({
    id: "run-challenge-revised-drop",
    status: "complete",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: C_POOL,
    graph: {
      nodes: ["anchor", "cafe", "cinema", "night", "stage"],
      edges: edgesOf([
        ["anchor", "cafe", 0.5],
        ["anchor", "cinema", 0.5],
        ["anchor", "night", 0.45],
        ["anchor", "stage", 0.46],
        ["cafe", "cinema", 0.6],
        ["cafe", "night", 0.45],
        ["cafe", "stage", 0.46],
        ["cinema", "night", 0.45],
        ["cinema", "stage", 0.46],
        ["night", "stage", 0.45]
      ])
    },
    neighborhoods: disjointNeighborhoods(["anchor", "cafe", "cinema", "night", "stage"]),
    compositions: {
      ranked: [
        rankedEntry(
          ["anchor", "cinema", "cafe"],
          0.5333333333333333,
          0.59,
          100,
          0.58,
          { a: "anchor", b: "cinema", value: 0.5 }
        ),
        rankedEntry(["cinema", "cafe", "night"], 0.5, 0.5, 40, 0.52, { a: "cinema", b: "night", value: 0.45 }),
        rankedEntry(["anchor", "cafe", "stage"], 0.4733333333333333, 0.55, 50, 0.44, { a: "anchor", b: "stage", value: 0.46 })
      ],
      excluded: [],
      triangulation: [],
      rivalFlips: [{ index: 1, weight: 0.7, from: ["anchor", "cinema", "cafe"], to: ["cinema", "cafe", "night"] }],
      family: {
        poolSize: 5,
        size: 3,
        requiredRoles: ["Anchor"],
        totalCandidates: 10,
        totalValid: 6,
        coherenceDistribution: [
          0.4533333333333333,
          0.4666666666666667,
          0.4666666666666667,
          0.4733333333333333,
          0.4733333333333333,
          0.5333333333333333
        ]
      },
      prior: { state: "not measured", reason: "fixture prior has no measured counterpart" }
    }
  });
}

function fixtureD(): RunState {
  return runStateSchema.parse({
    id: "run-challenge-replaced",
    status: "complete",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: [
      makeComponent({ id: "social-a", role: "Social", tags: ["social"] }),
      makeComponent({ id: "disc-a", role: "Discovery", tags: ["discovery"] }),
      makeComponent({ id: "night", role: "Night", tags: ["night"] }),
      makeComponent({ id: "social-b", role: "Social", tags: ["social"] }),
      makeComponent({ id: "disc-b", role: "Discovery", tags: ["discovery"] })
    ],
    graph: {
      nodes: ["disc-a", "disc-b", "night", "social-a", "social-b"],
      edges: edgesOf([
        ["social-a", "disc-a", 0.5],
        ["social-a", "night", 0.5],
        ["disc-a", "night", 0.5],
        ["social-b", "disc-a", 0.8],
        ["social-b", "night", 0.8],
        ["social-b", "disc-b", 0.9],
        ["disc-b", "night", 0.9],
        ["social-a", "social-b", 0.5],
        ["disc-a", "disc-b", 0.5],
        ["social-a", "disc-b", 0.5]
      ])
    },
    neighborhoods: disjointNeighborhoods(["social-a", "disc-a", "night", "social-b", "disc-b"]),
    compositions: {
      ranked: [
        rankedEntry(["social-a", "disc-a", "night"], 0.5, 1, 50, 0.5, {
          a: "social-a",
          b: "disc-a",
          value: 0.5
        })
      ],
      excluded: [],
      triangulation: [],
      rivalFlips: [],
      family: {
        poolSize: 5,
        size: 3,
        requiredRoles: [],
        totalCandidates: 10,
        totalValid: 10,
        coherenceDistribution: [0.5]
      },
      prior: { state: "not measured", reason: "fixture prior has no measured counterpart" }
    }
  });
}

function fixtureE(): RunState {
  const site = (id: string, entities: readonly string[]): RunNeighborhoods["components"][number] => ({
    componentId: id,
    domains: {
      artist: entities.map((entityId, index) => ({ entityId, rank: index + 1, weight: 1, affinityUsed: true })),
      movie: [],
      brand: []
    },
    state: "measured"
  });
  const neighborhoods: RunNeighborhoods = {
    components: [
      site("anchor", ["urn:entity:artist-site-shared", "urn:entity:artist-site-anchor"]),
      site("cinema", ["urn:entity:artist-site-shared"]),
      site("cafe", ["urn:entity:artist-site-shared"]),
      site("books", ["urn:entity:artist-site-books"]),
      site("music", ["urn:entity:artist-site-music"])
    ],
    city: disjointNeighborhoods(["anchor", "cinema", "cafe", "books", "music"]).city,
    sources: []
  };
  return runStateSchema.parse({
    id: "run-challenge-bridge-insert",
    status: "complete",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: FIVE_POOL,
    graph: {
      nodes: ["anchor", "books", "cafe", "cinema", "music"],
      edges: edgesOf([
        ["anchor", "books", 0.4],
        ["anchor", "cafe", 0.4],
        ["anchor", "cinema", 0.4],
        ["anchor", "music", 0.4],
        ["books", "cafe", 0.4],
        ["books", "cinema", 0.4],
        ["books", "music", 0.4],
        ["cafe", "cinema", 0.4],
        ["cafe", "music", 0.4],
        ["cinema", "music", 0.4]
      ])
    },
    neighborhoods,
    compositions: {
      ranked: [
        rankedEntry(["anchor", "cinema", "cafe"], 0.4, 1, 66, 0.45, {
          a: "anchor",
          b: "cafe",
          value: 0.3
        })
      ],
      excluded: [],
      triangulation: [],
      rivalFlips: [],
      family: {
        poolSize: 5,
        size: 3,
        requiredRoles: ["Anchor"],
        totalCandidates: 10,
        totalValid: 6,
        coherenceDistribution: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4]
      },
      prior: { state: "not measured", reason: "fixture prior has no measured counterpart" }
    }
  });
}

interface ChallengeRunOptions {
  request?: ChallengeRequest;
  gateway?: QlooGateway;
  llm?: LlmClient;
  budget?: LlmBudget;
}

async function challengeOn(
  state: RunState,
  options: ChallengeRunOptions = {}
): Promise<{ outcome: ChallengeOutcome; ledger: Ledger }> {
  const ledger = createLedger();
  const outcome = await runChallenge({
    state,
    request: options.request ?? {},
    gateway: options.gateway ?? fakeGateway().gateway,
    ledger,
    now: () => TEST_NOW,
    ...(options.llm !== undefined ? { llm: options.llm } : {}),
    ...(options.budget !== undefined ? { budget: options.budget } : {})
  });
  return { outcome, ledger };
}

function labelsOf(ledger: Ledger): string[] {
  return ledger.list().map((entry) => entry.event.label);
}

function canonicalReport(report: ChallengeReport): string {
  return JSON.stringify(report, (key, value) => (key === "evidenceId" ? undefined : value));
}

function attackOf(report: ChallengeReport, kind: string) {
  const attack = report.attacks.find((entry) => entry.kind === kind);
  if (attack === undefined) {
    throw new Error(`fixture report is missing the ${kind} attack`);
  }
  return attack;
}

function gatedLlm(gate: Promise<void>, onInvestigate?: () => void): LlmClient {
  return {
    async complete(request) {
      if (request.label.startsWith("prior")) {
        return completion(PRIOR_RESPONSE);
      }
      onInvestigate?.();
      await gate;
      return completion(FINAL_TURN.content);
    }
  };
}

describe("resolveVerdict", () => {
  const before = {
    members: ["a", "b", "c"],
    coherence: 0.5,
    percentile: 50,
    distinctivenessMean: 0.5,
    weakestLink: { a: "a", b: "b", value: 0.4 }
  };

  it("reports Survived when no mutation changed the leader", () => {
    expect(resolveVerdict(before, before, [])).toEqual({ verdict: "Survived" });
  });

  it("reports Revised when exactly one member was exchanged", () => {
    const after = { ...before, members: ["a", "b", "d"], coherence: 0.55 };
    const result = resolveVerdict(before, after, [
      { operator: "swap", round: 1, memberOut: "c", memberIn: "d", coherenceBefore: 0.5, coherenceAfter: 0.55 }
    ]);
    expect(result).toEqual({ verdict: "Revised" });
  });

  it("reports Replaced with the rival members when most of the leader turned over", () => {
    const after = { ...before, members: ["d", "e", "f"], coherence: 0.6 };
    const result = resolveVerdict(before, after, [
      { operator: "swap", round: 1, memberOut: "c", memberIn: "d", coherenceBefore: 0.5, coherenceAfter: 0.6 },
      { operator: "swap", round: 2, memberOut: "b", memberIn: "e", coherenceBefore: 0.6, coherenceAfter: 0.6 }
    ]);
    expect(result).toEqual({ verdict: "Replaced", verdictRival: ["d", "e", "f"] });
  });
});

describe("runChallenge verdict and mutation loop", () => {
  it("survives five attacks on a no-gain graph with a diagnostic bridge-first order, evidence-linked bridge, and no mutation", async () => {
    const { outcome, ledger } = await challengeOn(fixtureA());
    const report = outcome.report;

    expect(report.kind).toBe("challenge");
    expect(report.verdict).toBe("Survived");
    expect(report.verdictRival).toBeUndefined();
    expect(report.rounds).toBe(1);
    expect(report.mutations).toEqual([]);
    expect(report.gradeCap).toBe("A");
    expect(report.attackOrderSource).toBe("diagnostic");
    expect(report.attackOrder).toEqual([
      "bridge",
      "ablation",
      "substitution",
      "catchment",
      "rival"
    ]);
    expect(report.reason).toBe(
      "The leader held against 4 measured attacks, 1 skipped. No member could be removed without cost. One member could be substituted without loss, so nothing was changed."
    );
    expect(report.leaderBefore).toEqual(report.leaderAfter);
    expect(report.leaderBefore.members).toEqual(["anchor", "cinema", "cafe"]);
    expect(report.leaderBefore.coherence).toBeCloseTo(0.3, 10);

    expect(report.attacks.map((attack) => attack.kind)).toEqual([
      "ablation",
      "substitution",
      "bridge",
      "catchment",
      "rival"
    ]);
    expect(attackOf(report, "ablation").status).toBe("measured");
    expect(attackOf(report, "substitution").status).toBe("measured");
    expect(attackOf(report, "catchment").status).toBe("skipped");
    expect(attackOf(report, "rival").status).toBe("measured");
    expect(attackOf(report, "rival").summary).toContain("the leader holds rank 1 of 3");
    expect(attackOf(report, "rival").detail).toContain("no rival takes the lead across the dial sweep");

    const bridge = attackOf(report, "bridge");
    expect(bridge.status).toBe("measured");
    expect(bridge.evidenceId).toBeDefined();
    expect(bridge.detail).toContain("no measured taste neighborhoods");
    expect(bridge.detail).toContain("Blue Note Corner");
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0]!.id).toBe(bridge.evidenceId);

    expect(outcome.state.challengeReport).toEqual(report);

    const ledgerLabels = labelsOf(ledger);
    expect(ledgerLabels).toContain("challenge.order");
    expect(ledgerLabels).toContain("challenge.bridge_probe");
    expect(ledgerLabels).toContain("challenge.stress");
    expect(ledgerLabels).toContain("challenge.verdict");
    expect(ledgerLabels).not.toContain("challenge.mutation");
  });

  it("is deterministic across two identical challenge runs", async () => {
    const first = await challengeOn(fixtureA());
    const second = await challengeOn(fixtureA());
    expect(canonicalReport(second.outcome.report)).toBe(canonicalReport(first.outcome.report));
    expect(labelsOf(second.ledger)).toEqual(labelsOf(first.ledger));
  });

  it("applies swap then drop across three stress rounds, stops at the two-mutation bound, and reports Revised", async () => {
    const { outcome, ledger } = await challengeOn(fixtureB(), { gateway: emptyBridgeGateway() });
    const report = outcome.report;

    expect(report.verdict).toBe("Revised");
    expect(report.rounds).toBe(3);
    expect(report.mutations).toHaveLength(2);
    expect(report.gradeCap).toBe("A");
    expect(report.attackOrder).toEqual([
      "ablation",
      "substitution",
      "bridge",
      "catchment",
      "rival"
    ]);

    const [swap, drop] = report.mutations;
    expect(swap).toMatchObject({
      operator: "swap",
      round: 1,
      memberOut: "cinema",
      memberIn: "music"
    });
    expect(swap!.coherenceBefore).toBeCloseTo(0.52, 10);
    expect(swap!.coherenceAfter).toBeCloseTo(0.55, 10);
    expect(drop).toMatchObject({
      operator: "drop",
      round: 2,
      memberOut: "cafe",
      memberIn: null
    });
    expect(drop!.coherenceBefore).toBeCloseTo(0.55, 10);
    expect(drop!.coherenceAfter).toBeCloseTo(0.57, 10);

    expect(report.leaderBefore.members).toEqual(["anchor", "cinema", "cafe"]);
    expect(report.leaderAfter.members).toEqual(["anchor", "music"]);
    expect(report.leaderAfter.coherence).toBeCloseTo(0.57, 10);
    expect(report.leaderAfter.percentile).toBe(75);
    expect(report.leaderAfter.distinctivenessMean).toBe(1);
    expect(report.leaderAfter.weakestLink).toEqual({ a: "anchor", b: "music", value: 0.57 });

    expect(report.reason).toContain(
      "2 mutations applied: 1·swapped Exemplar cinema for Exemplar music; 2·dropped Exemplar cafe."
    );
    expect(report.reason).toContain("+0.0500 to 0.5700");

    const finalAttacks = report.attacks;
    expect(finalAttacks.map((attack) => attack.kind)).toEqual([
      "ablation",
      "substitution",
      "bridge",
      "catchment",
      "rival"
    ]);
    expect(attackOf(report, "ablation").status).toBe("skipped");
    expect(attackOf(report, "substitution").status).toBe("measured");
    expect(attackOf(report, "substitution").detail).toContain("-0.0500");
    expect(attackOf(report, "bridge").status).toBe("measured");
    expect(attackOf(report, "catchment").status).toBe("measured");
    expect(attackOf(report, "catchment").detail).toContain("depends on the site catchment");
    expect(attackOf(report, "rival").summary).toContain("the mutated leader is not a family entry");

    expect(outcome.evidence).toHaveLength(3);
    expect(attackOf(report, "bridge").evidenceId).toBe(outcome.evidence[2]!.id);

    const ledgerLabels = labelsOf(ledger);
    expect(ledgerLabels.filter((label) => label === "challenge.stress")).toHaveLength(3);
    expect(ledgerLabels.filter((label) => label === "challenge.mutation")).toHaveLength(2);
    expect(ledgerLabels).toContain("challenge.verdict");
  });

  it("applies a single drop mutation when unique roles block substitution, then stops with rounds two", async () => {
    const { outcome, ledger } = await challengeOn(fixtureC(), { gateway: emptyBridgeGateway() });
    const report = outcome.report;

    expect(report.verdict).toBe("Revised");
    expect(report.rounds).toBe(2);
    expect(report.mutations).toHaveLength(1);
    expect(report.gradeCap).toBe("A");
    expect(report.attackOrder).toEqual([
      "rival",
      "ablation",
      "substitution",
      "bridge",
      "catchment"
    ]);
    expect(report.attackOrderSource).toBe("diagnostic");

    const drop = report.mutations[0];
    expect(drop).toMatchObject({ operator: "drop", round: 1, memberOut: "anchor", memberIn: null });
    expect(drop!.coherenceBefore).toBeCloseTo(0.5333333333333333, 10);
    expect(drop!.coherenceAfter).toBeCloseTo(0.6, 10);

    expect(report.leaderAfter.members).toEqual(["cinema", "cafe"]);
    expect(report.leaderAfter.coherence).toBeCloseTo(0.6, 10);
    expect(report.leaderAfter.percentile).toBe(100);
    expect(report.leaderAfter.weakestLink).toEqual({ a: "cafe", b: "cinema", value: 0.6 });

    expect(report.reason).toContain("1 mutation applied: 1·dropped Exemplar anchor.");
    expect(report.reason).toContain("+0.0667 to 0.6000");

    expect(attackOf(report, "ablation").status).toBe("skipped");
    expect(attackOf(report, "substitution").status).toBe("skipped");
    expect(attackOf(report, "bridge").status).toBe("measured");
    expect(attackOf(report, "catchment").status).toBe("measured");
    expect(attackOf(report, "rival").status).toBe("measured");

    expect(outcome.evidence).toHaveLength(2);
    expect(labelsOf(ledger).filter((label) => label === "challenge.mutation")).toHaveLength(1);
  });
});

describe("runChallenge bridge probe honesty", () => {
  it("grades the challenge at B when the bridge probe fails, records the failed call, and creates no evidence", async () => {
    const fake = fakeGateway({
      onCall: (call) =>
        call.operation === "bridge" ? Promise.reject(outageError()) : Promise.resolve(okEnvelope(call.operation))
    });
    const { outcome, ledger } = await challengeOn(fixtureA(), { gateway: fake.gateway });
    const report = outcome.report;

    expect(report.verdict).toBe("Survived");
    expect(report.gradeCap).toBe("B");
    expect(report.reason).not.toContain("all five attacks");
    expect(report.reason).toMatch(/The leader held against \d+ measured attacks/);
    expect(report.reason).toContain("not completed");
    const bridge = attackOf(report, "bridge");
    expect(bridge.status).toBe("not completed");
    expect(bridge.evidenceId).toBeUndefined();
    expect(bridge.detail).toContain("Qloo is unreachable");
    expect(outcome.evidence).toHaveLength(0);
    expect(labelsOf(ledger)).toContain("challenge.bridge_probe");
  });

  it("reports an honest measured attack when Qloo finds no connecting category", async () => {
    const fake = fakeGateway({
      onCall: (call) =>
        call.operation === "bridge"
          ? Promise.resolve(okEnvelope("bridge", { results: { entities: [] }, resultCount: 0 }))
          : Promise.resolve(okEnvelope(call.operation))
    });
    const { outcome } = await challengeOn(fixtureA(), { gateway: fake.gateway });
    const bridge = attackOf(outcome.report, "bridge");
    expect(bridge.status).toBe("measured");
    expect(bridge.detail).toContain("no connecting category");
    expect(bridge.evidenceId).toBeDefined();
    expect(outcome.report.gradeCap).toBe("A");
  });

  it("skips the bridge probe honestly when the gateway reports no remaining budget, without calling Qloo", async () => {
    const lean = fakeGateway();
    const gateway: QlooGateway = {
      ...lean.gateway,
      get stats() {
        return { budgetUsed: 180, budgetRemaining: 0, cacheSize: 0, cacheHits: 0 };
      }
    };
    const { outcome } = await challengeOn(fixtureA(), { gateway });
    expect(lean.calls).toHaveLength(0);
    const bridge = attackOf(outcome.report, "bridge");
    expect(bridge.status).toBe("not completed");
    expect(bridge.detail).toContain("no remaining call budget");
    expect(outcome.report.gradeCap).toBe("B");
  });
});

describe("runChallenge bridge insertion and outright replacement", () => {
  it("replaces the leader outright when two swaps turn over most of its members", async () => {
    const { outcome, ledger } = await challengeOn(fixtureD(), { gateway: emptyBridgeGateway() });
    const report = outcome.report;

    expect(report.attackOrderSource).toBe("diagnostic");
    expect(report.attackOrder).toEqual(["ablation", "substitution", "bridge", "catchment", "rival"]);
    expect(report.verdict).toBe("Replaced");
    expect(report.verdictRival).toEqual(["social-b", "disc-b", "night"]);
    expect(report.rounds).toBe(3);
    expect(report.mutations).toHaveLength(2);
    expect(report.gradeCap).toBe("A");

    expect(report.mutations[0]).toMatchObject({
      operator: "swap",
      round: 1,
      memberOut: "social-a",
      memberIn: "social-b"
    });
    expect(report.mutations[1]).toMatchObject({
      operator: "swap",
      round: 2,
      memberOut: "disc-a",
      memberIn: "disc-b"
    });

    expect(report.leaderBefore.members).toEqual(["social-a", "disc-a", "night"]);
    expect(report.leaderAfter.members).toEqual(["social-b", "disc-b", "night"]);
    expect(report.leaderAfter.coherence).toBeCloseTo(0.8666666666666667, 10);

    expect(report.reason).toContain("Replaced by Exemplar social-b + Exemplar disc-b + Exemplar night.");
    expect(report.reason).toContain(
      "2 mutations applied: 1·swapped Exemplar social-a for Exemplar social-b; 2·swapped Exemplar disc-a for Exemplar disc-b."
    );

    expect(attackOf(report, "rival").summary).toContain("not a family entry");
    expect(attackOf(report, "bridge").status).toBe("measured");
    expect(outcome.evidence).toHaveLength(3);
    expect(labelsOf(ledger).filter((label) => label === "challenge.mutation")).toHaveLength(2);
    expect(labelsOf(ledger)).toContain("challenge.verdict");
  });

  it("inserts a measured bridge component, applies it as a mutation, and keeps measured artifacts untouched", async () => {
    const state = fixtureE();
    const { outcome, ledger } = await challengeOn(fixtureE(), { gateway: bridgeFixtureGateway() });
    const report = outcome.report;

    expect(report.attackOrderSource).toBe("diagnostic");
    expect(report.attackOrder).toEqual(["bridge", "ablation", "substitution", "catchment", "rival"]);
    expect(report.verdict).toBe("Revised");
    expect(report.gradeCap).toBe("A");
    expect(report.rounds).toBe(3);
    expect(report.mutations).toHaveLength(2);

    const [bridgeMutation, dropMutation] = report.mutations;
    const bridgeMemberIn = bridgeMutation!.memberIn ?? "";
    expect(bridgeMutation).toMatchObject({ operator: "bridge", round: 1, memberOut: null });
    expect(bridgeMemberIn).toMatch(/^comp-bridge-/);
    expect(dropMutation).toMatchObject({ operator: "drop", round: 2, memberOut: "anchor", memberIn: null });

    expect(report.leaderBefore.members).toEqual(["anchor", "cinema", "cafe"]);
    expect(report.leaderAfter.members).toEqual(["cinema", "cafe", bridgeMemberIn]);
    expect(report.leaderAfter.coherence).toBeCloseTo(1, 10);
    expect(report.leaderAfter.weakestLink).toEqual({ a: "cafe", b: "cinema", value: 1 });
    expect(report.reason).toContain("1·bridged Listening Bar beside the weakest link");
    expect(report.reason).toContain("2·dropped Exemplar anchor");

    expect(outcome.evidence).toHaveLength(4);
    expect(attackOf(report, "bridge").status).toBe("skipped");
    expect(attackOf(report, "bridge").detail).toContain("recorded bridge probe");

    const ledgerLabels = labelsOf(ledger);
    expect(ledgerLabels).toContain("challenge.bridge_probe");
    expect(ledgerLabels).toContain("challenge.bridge_resolve_tag");
    expect(ledgerLabels).toContain("challenge.bridge_site_fetch");
    expect(ledgerLabels).toContain("challenge.bridge_city_fetch");
    expect(ledgerLabels).toContain("challenge.bridge_measure");
    expect(ledgerLabels.filter((label) => label === "challenge.mutation")).toHaveLength(2);

    expect(outcome.state.candidatePool).toEqual(state.candidatePool);
    expect((outcome.state.candidatePool ?? []).some((component) => component.id.startsWith("comp-bridge-"))).toBe(
      false
    );
    expect(outcome.state.compositions).toEqual(state.compositions);
    expect(outcome.state.graph).toEqual(state.graph);
    expect(outcome.state.neighborhoods).toEqual(state.neighborhoods);
  });

  it("refuses to start bridge measurement it cannot finish and grades the challenge at B", async () => {
    const lean = fakeGateway();
    const gateway: QlooGateway = {
      ...lean.gateway,
      get stats() {
        return { budgetUsed: 179, budgetRemaining: 1, cacheSize: 0, cacheHits: 0 };
      }
    };
    const { outcome } = await challengeOn(fixtureB(), { gateway });
    const report = outcome.report;

    expect(report.gradeCap).toBe("B");
    const bridge = attackOf(report, "bridge");
    expect(bridge.status).toBe("not completed");
    expect(bridge.detail).toContain("measuring a connecting component needs 3 Qloo calls");
    expect(bridge.evidenceId).toBeDefined();
    expect(lean.calls).toHaveLength(3);
  });

  it("records an honest measured bridge when category resolution returns no tag", async () => {
    const fake = fakeGateway({
      onCall: (call) =>
        call.operation === "resolveTags"
          ? okEnvelope("resolveTags", { results: { tags: [] }, resultCount: 0 })
          : okEnvelope(call.operation)
    });
    const { outcome, ledger } = await challengeOn(fixtureB(), { gateway: fake.gateway });

    expect(outcome.report.gradeCap).toBe("A");
    const bridge = attackOf(outcome.report, "bridge");
    expect(bridge.status).toBe("skipped");
    expect(bridge.detail).toContain("recorded bridge probe");
    expect(outcome.evidence).toHaveLength(2);
    expect(labelsOf(ledger)).toContain("challenge.bridge_resolve_tag");
    expect(labelsOf(ledger)).toContain("challenge.bridge_probe");
    expect(labelsOf(ledger)).not.toContain("challenge.bridge_site_fetch");
  });

  it("grades the challenge at B when the bridge site audience fetch fails, recording the failed call", async () => {
    const fake = fakeGateway({
      onCall: (call) => (call.operation === "insights" ? Promise.reject(outageError()) : okEnvelope(call.operation))
    });
    const { outcome, ledger } = await challengeOn(fixtureB(), { gateway: fake.gateway });
    const report = outcome.report;

    expect(report.gradeCap).toBe("B");
    const bridge = attackOf(report, "bridge");
    expect(bridge.status).toBe("not completed");
    expect(bridge.detail).toContain("Qloo is unreachable");
    expect(labelsOf(ledger)).toContain("challenge.bridge_site_fetch");
    expect(outcome.evidence).toHaveLength(6);
  });
});

describe("runChallenge attack order", () => {
  const order = ["catchment", "rival", "bridge", "substitution", "ablation"];

  it("uses the LLM order when the bounded turn returns a usable JSON order", async () => {
    const scripted = fakeLlm([
      { content: "```json\n" + JSON.stringify({ order }) + "\n```" }
    ]);
    const budget = new LlmBudget({ ceilingUsd: 1, now: () => TEST_NOW });
    const { outcome, ledger } = await challengeOn(fixtureA(), {
      llm: scripted.client,
      budget
    });

    expect(outcome.report.attackOrderSource).toBe("llm");
    expect(outcome.report.attackOrder).toEqual(order);
    expect(scripted.calls).toHaveLength(1);
    expect(scripted.calls[0]!.label).toBe("challenge.attack_order");
    expect(labelsOf(ledger)).toContain("challenge.attack_order");
    expect(labelsOf(ledger)).not.toContain("challenge.order_fallback");
  });

  it("pads a partial LLM order with the remaining attack kinds in diagnostic order", async () => {
    const scripted = fakeLlm([{ content: JSON.stringify({ order: ["bridge"] }) }]);
    const budget = new LlmBudget({ ceilingUsd: 1, now: () => TEST_NOW });
    const { outcome } = await challengeOn(fixtureA(), { llm: scripted.client, budget });

    expect(outcome.report.attackOrderSource).toBe("llm");
    expect(outcome.report.attackOrder).toEqual([
      "bridge",
      "ablation",
      "substitution",
      "catchment",
      "rival"
    ]);
    expect(new Set(outcome.report.attackOrder).size).toBe(5);
  });

  it("falls back to the diagnostic order when the attack-order turn returns unusable text", async () => {
    const scripted = fakeLlm([{ content: "I would start with the rival, probably." }]);
    const budget = new LlmBudget({ ceilingUsd: 1, now: () => TEST_NOW });
    const { outcome, ledger } = await challengeOn(fixtureA(), { llm: scripted.client, budget });

    expect(outcome.report.attackOrderSource).toBe("diagnostic");
    expect(outcome.report.attackOrder).toEqual([
      "bridge",
      "ablation",
      "substitution",
      "catchment",
      "rival"
    ]);
    expect(labelsOf(ledger)).toContain("challenge.order_fallback");
    expect(labelsOf(ledger)).toContain("challenge.attack_order");
  });

  it("falls back to the diagnostic order when the LLM fails, without blocking the challenge", async () => {
    const scripted = fakeLlm([
      () => {
        throw new Error("deepseek unavailable");
      }
    ]);
    const budget = new LlmBudget({ ceilingUsd: 1, now: () => TEST_NOW });
    const { outcome, ledger } = await challengeOn(fixtureA(), { llm: scripted.client, budget });

    expect(outcome.report.attackOrderSource).toBe("diagnostic");
    expect(outcome.report.verdict).toBe("Survived");
    const fallback = ledger.list().find((entry) => entry.event.label === "challenge.order_fallback");
    expect(fallback).toBeDefined();
    expect(fallback?.event.summary).toContain("deepseek unavailable");
  });

  it("moves a requested focus to the front of the attack order", async () => {
    const { outcome } = await challengeOn(fixtureA(), { request: { focus: "rival" } });
    expect(outcome.report.attackOrder[0]).toBe("rival");
    expect(outcome.report.attackOrder).toEqual([
      "rival",
      "bridge",
      "ablation",
      "substitution",
      "catchment"
    ]);
    expect(outcome.report.attackOrderSource).toBe("diagnostic");
  });
});

describe("runChallenge state guards", () => {
  it("refuses resumable and stopped runs before any other work", async () => {
    await expect(challengeOn(fixtureA({ status: "investigating" }))).rejects.toThrow(OrchestratorStateError);
    await expect(challengeOn(fixtureA({ status: "stopped" }))).rejects.toThrow(OrchestratorStateError);
  });

  it("refuses a run without a measured candidate pool", async () => {
    await expect(challengeOn(fixtureA({ candidatePool: undefined }))).rejects.toThrow(
      "carries no measured candidate pool"
    );
  });

  it("refuses a run without a measured composition family", async () => {
    await expect(challengeOn(fixtureA({ compositions: undefined }))).rejects.toThrow(
      "carries no measured compositions"
    );
  });

  it("refuses a run whose family has no ranked leader", async () => {
    const state = fixtureA();
    const broken = runStateSchema.parse({
      ...state,
      compositions: { ...state.compositions!, ranked: [] }
    });
    await expect(challengeOn(broken)).rejects.toThrow("no ranked composition");
  });
});

describe("orchestrator.challengeRun", () => {
  it("rejects unknown runs with RunNotFound", async () => {
    const store = createMemoryStore();
    const orchestrator = createOrchestrator({
      store,
      gateway: fakeGateway().gateway,
      llm: fakeLlm([completion("unused")]).client,
      now: () => TEST_NOW
    });
    await expect(orchestrator.challengeRun("run-missing", {})).rejects.toThrow(RunNotFound);
  });

  it("persists the challenge report, bridge evidence, and ledger events through the store", async () => {
    const state = fixtureB();
    const store = createMemoryStore();
    await store.createRun({ id: state.id, state });
    const scripted = fakeLlm([
      { content: JSON.stringify({ order: ["ablation", "substitution", "bridge", "catchment", "rival"] }) }
    ]);
    const orchestrator = createOrchestrator({
      store,
      gateway: emptyBridgeGateway(),
      llm: scripted.client,
      now: () => TEST_NOW
    });

    const response = await orchestrator.challengeRun(state.id, {});

    expect(response.report.verdict).toBe("Revised");
    expect(response.report.attackOrderSource).toBe("llm");
    expect(response.run.challengeReport).toEqual(response.report);
    expect(response.run.revisions).toBeUndefined();

    const stored = await store.loadRun(state.id);
    expect(stored?.state.challengeReport?.verdict).toBe("Revised");
    expect(stored?.state.challengeReport).toEqual(response.report);

    const evidence = await store.listEvidence(state.id);
    expect(evidence).toHaveLength(3);

    const ledgerLabels = (await store.listLedgerEvents(state.id)).map((entry) => entry.event.label);
    expect(ledgerLabels).toContain("challenge.order");
    expect(ledgerLabels).toContain("challenge.attack_order");
    expect(ledgerLabels).toContain("challenge.mutation");
    expect(ledgerLabels).toContain("challenge.verdict");
  });

  it("rejects a challenge while a pass is running", async () => {
    const store = createMemoryStore();
    const gate = deferred();
    const reached = deferred();
    const llm = gatedLlm(gate.promise, reached.resolve);
    const firstStateDeferred = deferred<RunState>();
    const orchestrator = createOrchestrator({
      store,
      gateway: fakeGateway().gateway,
      llm,
      now: () => TEST_NOW,
      eventSink: (event) => {
        if (event.type === "state") firstStateDeferred.resolve(event.payload as RunState);
      }
    });

    const runPromise = orchestrator.startRun({ brief: TEST_BRIEF });
    const started = await firstStateDeferred.promise;
    await reached.promise;

    await expect(orchestrator.challengeRun(started.id, {})).rejects.toThrow(RunBusyError);

    gate.resolve();
    await runPromise;
  });
});

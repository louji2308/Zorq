// Phase 4 exit gate (ARCHITECTURE §6): "A controlled candidate pool can produce a
// complete graph, ranked role-valid compositions, percentile, distinctiveness,
// weakest links and evidence classifications without LLM-generated numbers."
// Every step below is a pure function over controlled fixtures: no network, no LLM.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildCompositions,
  buildGraph,
  buildNeighborhoods,
  classifyTriangulation,
  computeDistinctivenessMap,
  computeIdf,
  gradeEvidence,
  rankCompositions,
  rankCompositionSet,
  route1FromGraph,
  type CandidateComponent,
  type CultureGraph,
  type NeighborhoodSignalInput,
  type WeightedEntity
} from "../../src/server/engine/index.js";
import {
  EvidenceError,
  createEvidenceRecord,
  resolveClaimEvidence
} from "../../src/server/evidence/index.js";
import { makeComponent } from "./fixtures.js";

const POOL_IDS = ["c1", "c2", "c3", "c4", "c5", "c6"] as const;
const ROLES = ["Anchor", "Social", "Discovery"] as const;

function buildPool(): CandidateComponent[] {
  return [
    makeComponent({ id: "c1", role: "Anchor" }),
    makeComponent({ id: "c2", role: "Social" }),
    makeComponent({ id: "c3", role: "Discovery" }),
    makeComponent({ id: "c4", role: "Anchor" }),
    makeComponent({ id: "c5", role: "Social" }),
    makeComponent({ id: "c6", role: "Night" })
  ];
}

function signalInputs(): NeighborhoodSignalInput[] {
  const artist: Record<string, string[]> = {
    c1: ["s1", "s2", "a1"],
    c2: ["s1", "s3", "a2"],
    c3: ["s2", "s3", "a3"],
    c4: ["s1", "s2", "s5", "a4"],
    c5: ["s1", "s3", "s5", "a5"],
    c6: ["s4", "a6", "a7"]
  };
  const inputs: NeighborhoodSignalInput[] = [];
  for (const id of POOL_IDS) {
    inputs.push({
      componentId: id,
      domain: "artist",
      signals: artist[id].map((entityId, index) => ({ entityId, rank: index + 1 }))
    });
    inputs.push({
      componentId: id,
      domain: "movie",
      signals: [{ entityId: `m-${id}`, rank: 1 }]
    });
    inputs.push({
      componentId: id,
      domain: "brand",
      signals: [{ entityId: `b-${id}`, rank: 1 }]
    });
  }
  return inputs;
}

function cityVector(id: string): WeightedEntity[] {
  if (id === "c6") {
    return [{ entityId: "s4", weight: 1 }];
  }
  return [
    { entityId: "s1", weight: 0.4 },
    { entityId: `city-${id}`, weight: 1 }
  ];
}

function fullPipeline(): {
  pool: CandidateComponent[];
  graph: CultureGraph;
  distinctiveness: Readonly<Record<string, number | null>>;
  ranking: ReturnType<typeof rankCompositions>;
} {
  const pool = buildPool();
  const neighborhoods = buildNeighborhoods(pool, signalInputs());
  const graph = buildGraph(pool, neighborhoods, computeIdf(pool, neighborhoods));
  const cityVectors = Object.fromEntries(POOL_IDS.map((id) => [id, cityVector(id)]));
  const distinctiveness = computeDistinctivenessMap(neighborhoods, cityVectors);
  const ranking = rankCompositions({
    pool,
    graph,
    size: 3,
    requiredRoles: ROLES,
    distinctiveness
  });
  return { pool, graph, distinctiveness, ranking };
}

describe("Phase 4 exit gate — controlled candidate pool, no LLM-generated numbers", () => {
  it("produces a complete measured graph from one controlled pool", () => {
    const { graph } = fullPipeline();
    expect(graph.nodes).toEqual([...POOL_IDS].sort());
    expect(graph.edges).toHaveLength(15);
    for (const edge of graph.edges) {
      expect(edge.state).toBe("measured");
      expect(edge.value).not.toBeNull();
    }
  });

  it("enumerates exactly the role-valid compositions with honest percentiles and weakest links", () => {
    const { pool, graph, distinctiveness } = fullPipeline();
    const family = buildCompositions({
      pool,
      graph,
      size: 3,
      requiredRoles: ROLES,
      distinctiveness
    });
    expect(family.totalCandidates).toBe(20);
    expect(family.totalValid).toBe(4);
    const coherences = family.compositions.map((composition) => composition.coherence);
    const percentiles = family.compositions.map((composition) => composition.percentile);
    expect(new Set(percentiles)).toEqual(new Set([0, 25, 50, 75]));
    const sortedCoherences = [...coherences].sort((left, right) => left - right);
    const sortedPercentiles = [...percentiles].sort((left, right) => (left ?? 0) - (right ?? 0));
    expect(sortedPercentiles).toEqual(sortedCoherences.map((_, index) => index * 25));
    const edgeValue = (a: string, b: string): number => {
      const edge = graph.edges.find(
        (candidate) =>
          (candidate.a === a && candidate.b === b) || (candidate.a === b && candidate.b === a)
      );
      expect(edge).toBeDefined();
      return edge?.value ?? Number.NaN;
    };
    for (const composition of family.compositions) {
      const [first, second, third] = composition.members;
      const values = [
        edgeValue(first, second),
        edgeValue(first, third),
        edgeValue(second, third)
      ];
      expect(composition.coherence).toBeCloseTo(
        (values[0] + values[1] + values[2]) / 3,
        12
      );
      expect(composition.weakestLink.value).toBe(Math.min(...values));
      expect(composition.distinctivenessMean).not.toBeNull();
      expect(composition.distinctivenessMean).toBeGreaterThanOrEqual(0);
      expect(composition.distinctivenessMean).toBeLessThanOrEqual(1);
    }
  });

  it("ranks the family and sweeps 101 rival weights without dropping evidence", () => {
    const { ranking } = fullPipeline();
    expect(ranking.ranked).toHaveLength(4);
    expect(ranking.excluded).toEqual([]);
    expect(ranking.sweep.points).toHaveLength(101);
    expect(ranking.sweep.points[0]?.weight).toBe(0);
    expect(ranking.sweep.points[100]?.weight).toBe(1);
    for (const point of ranking.sweep.points) {
      expect(point.leader === null || point.leader.length === 3).toBe(true);
    }
    for (let index = 1; index < ranking.ranked.length; index += 1) {
      expect(ranking.ranked[index - 1].rankScore).toBeGreaterThanOrEqual(
        ranking.ranked[index].rankScore
      );
    }
  });

  it("reports honest exclusion when distinctiveness is unavailable", () => {
    const pool = buildPool();
    const neighborhoods = buildNeighborhoods(pool, signalInputs());
    const graph = buildGraph(pool, neighborhoods, computeIdf(pool, neighborhoods));
    const cityVectors = Object.fromEntries(
      POOL_IDS.filter((id) => id !== "c3").map((id) => [id, cityVector(id)])
    );
    const distinctiveness = computeDistinctivenessMap(neighborhoods, cityVectors);
    expect(distinctiveness.c3).toBeNull();
    const family = buildCompositions({
      pool,
      graph,
      size: 3,
      requiredRoles: ROLES,
      distinctiveness
    });
    const outcome = rankCompositionSet(family.compositions);
    expect(outcome.ranked).toEqual([]);
    expect(outcome.excluded).toHaveLength(4);
    for (const exclusion of outcome.excluded) {
      expect(exclusion.reason).toBe("distinctiveness_unavailable");
      expect(exclusion.members).toContain("c3");
    }
  });

  it("classifies finalist-edge triangulation and grades A, B, and C honestly", () => {
    const { pool, graph, ranking } = fullPipeline();
    const leader = ranking.ranked[0].members;
    const [first, second, third] = leader;
    const pairInputs = [
      { a: first, b: second, route2: { resultCount: 8, focalInTopHalf: true } },
      { a: first, b: third, route2: { resultCount: 8, focalInTopHalf: false } },
      { a: second, b: third, route2: { resultCount: 2, focalInTopHalf: true } }
    ];
    const classified = pairInputs.map((pair) =>
      classifyTriangulation({
        a: pair.a,
        b: pair.b,
        route1: route1FromGraph(graph, pair.a, pair.b),
        route2: pair.route2
      })
    );
    expect(classified.map((entry) => entry.state)).toEqual(["confirmed", "contested", "thin"]);
    const mixed = gradeEvidence({
      members: leader,
      pool,
      edges: classified.map((entry) => ({ a: entry.a, b: entry.b, state: entry.state }))
    });
    expect(mixed.grade).toBe("B");
    expect(mixed.reasons).toEqual([
      `edge ${first}|${third} state=contested`,
      `edge ${second}|${third} state=thin`
    ]);
    const confirmedOnly = gradeEvidence({
      members: leader,
      pool,
      edges: classified.map((entry) => ({ a: entry.a, b: entry.b, state: "confirmed" as const }))
    });
    expect(confirmedOnly.grade).toBe("A");
    expect(confirmedOnly.reasons).toEqual([]);
    const unmeasuredPool = pool.map((component) =>
      component.id === "c3" ? { ...component, evidenceState: "unavailable" as const } : component
    );
    const capped = gradeEvidence({
      members: leader,
      pool: unmeasuredPool,
      edges: classified.map((entry) => ({ a: entry.a, b: entry.b, state: "confirmed" as const }))
    });
    expect(capped.grade).toBe("C");
    expect(capped.reasons).toContain("member c3 evidenceState=unavailable");
  });

  it("resolves claim citations and rejects unknown evidence ids as unconfirmed", () => {
    const provenance = {
      transport: "rest",
      operation: "search",
      endpoint: "https://hackathon.api.qloo.com/v2/search",
      durationMs: 42,
      cacheState: "live",
      resultCount: 3
    } as const;
    const first = createEvidenceRecord({
      operation: "search",
      claim: "route-2 probe observation",
      provenance,
      createdAt: "2026-10-08T12:00:00.000Z",
      ledgerEventId: randomUUID()
    });
    const second = createEvidenceRecord({
      operation: "search",
      claim: "locality-anchor probe observation",
      provenance,
      createdAt: "2026-10-08T12:00:01.000Z",
      ledgerEventId: randomUUID()
    });
    const resolved = resolveClaimEvidence(
      { text: "triangulation agreed on both routes", evidenceIds: [first.id, second.id, first.id] },
      [first, second]
    );
    expect(resolved).toEqual([first, second]);
    expect(() =>
      resolveClaimEvidence(
        { text: "claims an observation that does not exist", evidenceIds: [randomUUID()] },
        [first, second]
      )
    ).toThrow(EvidenceError);
  });

  it("is deterministic: the full pipeline is byte-identical across reruns", () => {
    const left = fullPipeline();
    const right = fullPipeline();
    expect(JSON.stringify(right.graph)).toBe(JSON.stringify(left.graph));
    expect(JSON.stringify(right.distinctiveness)).toBe(JSON.stringify(left.distinctiveness));
    expect(JSON.stringify(right.ranking)).toBe(JSON.stringify(left.ranking));
  });
});

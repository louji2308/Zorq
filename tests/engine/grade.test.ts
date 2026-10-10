import { describe, expect, it } from "vitest";
import { gradeEvidence } from "../../src/server/engine/grades.js";
import type { ClassifiedTriangulationEdge } from "../../src/server/engine/grades.js";
import { EngineError } from "../../src/server/engine/types.js";
import type {
  CandidateComponent,
  ComponentEvidenceState
} from "../../src/server/engine/types.js";

function expectEngineError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(EngineError);
  expect((caught as EngineError).code).toBe(code);
  expect((caught as EngineError).message).not.toBe("");
}

function makeComponent(
  overrides: Partial<CandidateComponent> & { id: string }
): CandidateComponent {
  return {
    role: "Anchor",
    tags: ["coffee"],
    exemplars: [{ id: `ex-${overrides.id}`, name: `Exemplar ${overrides.id}` }],
    provenancePath: {
      anchorPlace: `anchor-${overrides.id}`,
      qlooSignal: `tag:coffee-${overrides.id}`,
      resolvedCategory: `category-${overrides.id}`,
      exemplarSet: `exemplar-${overrides.id}`,
      tasteNeighborhood: `signal-${overrides.id}`
    },
    evidenceState: "measured",
    ...overrides
  };
}

function makePool(
  entries: readonly { id: string; evidenceState?: ComponentEvidenceState }[]
): CandidateComponent[] {
  return entries.map((entry) =>
    makeComponent({
      id: entry.id,
      ...(entry.evidenceState !== undefined ? { evidenceState: entry.evidenceState } : {})
    })
  );
}

function confirmedTriplet(): ClassifiedTriangulationEdge[] {
  return [
    { a: "m1", b: "m2", state: "confirmed" },
    { a: "m1", b: "m3", state: "confirmed" },
    { a: "m2", b: "m3", state: "confirmed" }
  ];
}

describe("gradeEvidence", () => {
  it("grades A when every member is measured and every internal edge is confirmed", () => {
    const result = gradeEvidence({
      members: ["m1", "m2", "m3"],
      pool: makePool([{ id: "m1" }, { id: "m2" }, { id: "m3" }]),
      edges: confirmedTriplet()
    });
    expect(result.grade).toBe("A");
    expect(result.reasons).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasons)).toBe(true);
  });

  it("grades B on a contested edge and names the exact edge", () => {
    const edges = confirmedTriplet();
    edges[2] = { a: "m2", b: "m3", state: "contested" };
    const result = gradeEvidence({
      members: ["m1", "m2", "m3"],
      pool: makePool([{ id: "m1" }, { id: "m2" }, { id: "m3" }]),
      edges
    });
    expect(result.grade).toBe("B");
    expect(result.reasons).toEqual(["edge m2|m3 state=contested"]);
  });

  it("grades B on a thin edge and names the exact edge", () => {
    const edges = confirmedTriplet();
    edges[0] = { a: "m1", b: "m2", state: "thin" };
    const result = gradeEvidence({
      members: ["m1", "m2", "m3"],
      pool: makePool([{ id: "m1" }, { id: "m2" }, { id: "m3" }]),
      edges
    });
    expect(result.grade).toBe("B");
    expect(result.reasons).toEqual(["edge m1|m2 state=thin"]);
  });

  it("grades B on a failed edge and names the exact edge", () => {
    const edges = confirmedTriplet();
    edges[1] = { a: "m1", b: "m3", state: "failed" };
    const result = gradeEvidence({
      members: ["m1", "m2", "m3"],
      pool: makePool([{ id: "m1" }, { id: "m2" }, { id: "m3" }]),
      edges
    });
    expect(result.grade).toBe("B");
    expect(result.reasons).toEqual(["edge m1|m3 state=failed"]);
  });

  it("grades C when any member is unmeasured even with all edges confirmed", () => {
    // ProductSpec §12: "C: any leader member unmeasured."
    const result = gradeEvidence({
      members: ["m1", "m2", "m3"],
      pool: makePool([
        { id: "m1" },
        { id: "m2" },
        { id: "m3", evidenceState: "not measured" }
      ]),
      edges: confirmedTriplet()
    });
    expect(result.grade).toBe("C");
    expect(result.reasons).toEqual(["member m3 evidenceState=not measured"]);
  });

  it("grades C over B when both an unmeasured member and a contested edge exist", () => {
    const edges = confirmedTriplet();
    edges[2] = { a: "m2", b: "m3", state: "contested" };
    const result = gradeEvidence({
      members: ["m1", "m2", "m3"],
      pool: makePool([
        { id: "m1" },
        { id: "m2" },
        { id: "m3", evidenceState: "incomplete" }
      ]),
      edges
    });
    expect(result.grade).toBe("C");
    expect(result.reasons).toEqual([
      "member m3 evidenceState=incomplete",
      "edge m2|m3 state=contested"
    ]);
  });

  it("grades B when an internal edge has no classification supplied (honest gap)", () => {
    const result = gradeEvidence({
      members: ["m1", "m2", "m3"],
      pool: makePool([{ id: "m1" }, { id: "m2" }, { id: "m3" }]),
      edges: [{ a: "m1", b: "m2", state: "confirmed" }]
    });
    expect(result.grade).toBe("B");
    expect(result.reasons).toEqual([
      "edge m1|m3 state=failed",
      "edge m2|m3 state=failed"
    ]);
  });

  it("grades B when no classifications are supplied at all", () => {
    const result = gradeEvidence({
      members: ["m1", "m2"],
      pool: makePool([{ id: "m1" }, { id: "m2" }]),
      edges: []
    });
    expect(result.grade).toBe("B");
    expect(result.reasons).toEqual(["edge m1|m2 state=failed"]);
  });

  it("normalizes edge orientation before matching pairs", () => {
    const result = gradeEvidence({
      members: ["m1", "m2", "m3"],
      pool: makePool([{ id: "m1" }, { id: "m2" }, { id: "m3" }]),
      edges: [
        { a: "m2", b: "m1", state: "confirmed" },
        { a: "m3", b: "m1", state: "confirmed" },
        { a: "m3", b: "m2", state: "confirmed" }
      ]
    });
    expect(result.grade).toBe("A");
    expect(result.reasons).toEqual([]);
  });

  it("rejects unknown member ids", () => {
    expectEngineError(
      () =>
        gradeEvidence({
          members: ["m1", "ghost"],
          pool: makePool([{ id: "m1" }]),
          edges: []
        }),
      "INVALID_COMPONENT"
    );
  });

  it("rejects duplicate members and compositions smaller than two", () => {
    expectEngineError(
      () =>
        gradeEvidence({
          members: ["m1", "m1"],
          pool: makePool([{ id: "m1" }]),
          edges: []
        }),
      "INVALID_COMPONENT"
    );
    expectEngineError(
      () => gradeEvidence({ members: ["m1"], pool: makePool([{ id: "m1" }]), edges: [] }),
      "INVALID_COMPONENT"
    );
  });

  it("rejects edges that reference ids outside the composition", () => {
    expectEngineError(
      () =>
        gradeEvidence({
          members: ["m1", "m2"],
          pool: makePool([{ id: "m1" }, { id: "m2" }, { id: "m3" }]),
          edges: [{ a: "m1", b: "m3", state: "confirmed" }]
        }),
      "INVALID_COMPONENT"
    );
    expectEngineError(
      () =>
        gradeEvidence({
          members: ["m1", "m2"],
          pool: makePool([{ id: "m1" }, { id: "m2" }]),
          edges: [{ a: "m1", b: "ghost", state: "confirmed" }]
        }),
      "INVALID_COMPONENT"
    );
  });

  it("rejects malformed, duplicate and self-referential classifications", () => {
    const pool = makePool([{ id: "m1" }, { id: "m2" }]);
    expectEngineError(
      () =>
        gradeEvidence({
          members: ["m1", "m2"],
          pool,
          edges: [
            { a: "m1", b: "m2", state: "confirmed" },
            { a: "m2", b: "m1", state: "contested" }
          ]
        }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        gradeEvidence({
          members: ["m1", "m2"],
          pool,
          edges: [{ a: "m1", b: "m1", state: "confirmed" }]
        }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        gradeEvidence({
          members: ["m1", "m2"],
          pool,
          edges: [{ a: "m1", b: "m2", state: "suspect" as ClassifiedTriangulationEdge["state"] }]
        }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        gradeEvidence({
          members: ["m1", "m2"],
          pool,
          edges: "nope" as unknown as ClassifiedTriangulationEdge[]
        }),
      "INVALID_GRAPH_INPUT"
    );
  });

  it("is deterministic: identical inputs produce deep-equal frozen outputs", () => {
    const input = {
      members: ["m1", "m2", "m3"],
      pool: makePool([
        { id: "m1" },
        { id: "m2" },
        { id: "m3", evidenceState: "unavailable" as ComponentEvidenceState }
      ]),
      edges: confirmedTriplet()
    };
    const first = gradeEvidence(input);
    const second = gradeEvidence({ ...input, members: [...input.members] });
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(Object.isFrozen(second.reasons)).toBe(true);
  });
});

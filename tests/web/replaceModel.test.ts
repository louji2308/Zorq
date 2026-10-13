import { describe, expect, it } from "vitest";
import { runStateSchema, type RunRevision, type RunState } from "../../src/shared/run.js";
import { makeComponent } from "../engine/fixtures.js";
import { TEST_BRIEF, TEST_PRIOR } from "../agent/support/fakes.js";
import {
  REPLACE_ALTERNATIVE_CAP,
  buildReplaceModel,
  findBefore,
  readReplaceSuccess,
  sameMembers,
  signedDelta
} from "../../src/web/screens/s3/replaceModel.js";

function rankedEntry(
  members: string[],
  coherence: number,
  distinctivenessMean: number,
  percentile: number | null
) {
  return {
    members,
    size: members.length,
    coherence,
    percentile,
    distinctivenessMean,
    weakestLink: { a: members[0]!, b: members[1]!, value: 0.4 },
    rankScore: coherence,
    grade: "B" as const,
    gradeReasons: ["fixture"]
  };
}

function fixtureState(overrides: Partial<RunState> = {}): RunState {
  const pool = [
    makeComponent({ id: "anchor", role: "Anchor", tags: ["coffee"], exemplars: [{ id: "urn:entity:place-coffee", name: "Devoción" }] }),
    makeComponent({ id: "discovery", role: "Discovery", tags: ["cinema"], exemplars: [{ id: "urn:entity:place-cinema", name: "Nitehawk" }] }),
    makeComponent({ id: "community", role: "Community", tags: ["books"], exemplars: [{ id: "urn:entity:place-books", name: "McNally Jackson" }] }),
    makeComponent({ id: "tea", role: "Community", tags: ["tea"], exemplars: [{ id: "urn:entity:place-tea", name: "T Gallery" }] }),
    makeComponent({ id: "extra", role: "Community", tags: ["print"], exemplars: [{ id: "urn:entity:place-print", name: "Printed Matter" }] })
  ];
  return runStateSchema.parse({
    id: "run-web",
    status: "complete",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: pool,
    compositions: {
      ranked: [
        rankedEntry(["anchor", "discovery", "community"], 0.72, 0.61, 88.2),
        rankedEntry(["anchor", "discovery", "tea"], 0.68, 0.55, 71.6)
      ],
      excluded: [],
      triangulation: [],
      rivalFlips: [],
      family: {
        poolSize: 5,
        size: 3,
        requiredRoles: ["Anchor"],
        totalCandidates: 10,
        totalValid: 2,
        coherenceDistribution: [0.68, 0.72]
      },
      prior: { state: "not measured", reason: "fixture" }
    },
    ...overrides
  });
}

describe("signedDelta", () => {
  it("renders a plus sign for positive and zero values and two decimals", () => {
    expect(signedDelta(0.125)).toBe("+0.13");
    expect(signedDelta(-0.25)).toBe("-0.25");
    expect(signedDelta(0)).toBe("+0.00");
  });
});

describe("sameMembers", () => {
  it("compares sets regardless of order and rejects different sizes", () => {
    expect(sameMembers(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameMembers(["a", "b"], ["a", "c"])).toBe(false);
    expect(sameMembers(["a"], ["a", "b"])).toBe(false);
  });
});

describe("findBefore", () => {
  it("returns the first ranked composition that contains the member", () => {
    const run = fixtureState();
    const before = findBefore(run, "tea");
    expect(before?.members).toEqual(["anchor", "discovery", "tea"]);
    expect(findBefore(run, "ghost")).toBeNull();
  });

  it("resolves the keyed composition with normalized delimiters and nulls for unknown keys or non-members", () => {
    const run = fixtureState();
    const keyed = findBefore(run, "community", "anchor+discovery+community");
    expect(keyed?.members).toEqual(["anchor", "discovery", "community"]);
    const delimited = findBefore(run, "community", " anchor|discovery+community ");
    expect(delimited?.members).toEqual(["anchor", "discovery", "community"]);
    expect(findBefore(run, "community", "anchor+discovery+ghost")).toBeNull();
    expect(findBefore(run, "community", "anchor+discovery+tea")).toBeNull();
  });
});

describe("buildReplaceModel", () => {
  it("refuses a null run, an empty pool, an unknown member, missing ranked compositions, and an off-ranked member", () => {
    expect(buildReplaceModel(null, "community")).toEqual({
      ok: false,
      reason: "This run has not loaded yet, so there is nothing to replace."
    });
    const empty = fixtureState({ candidatePool: [] });
    expect(buildReplaceModel(empty, "community").ok).toBe(false);
    expect(buildReplaceModel(fixtureState(), "ghost").ok).toBe(false);
    const noRanked = fixtureState();
    expect(
      buildReplaceModel({ ...noRanked, compositions: undefined }, "community")
    ).toMatchObject({ ok: false });
    const offRanked = fixtureState();
    expect(buildReplaceModel(offRanked, "extra")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("not part of a ranked composition")
    });
  });

  it("lists same-role alternatives outside the composition with server-truth deltas, measurable first", () => {
    const result = buildReplaceModel(fixtureState(), "community");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const { model } = result;
    expect(model.memberName).toBe("McNally Jackson");
    expect(model.role).toBe("Community");
    expect(model.coherenceBefore).toBe(0.72);
    expect(model.percentileBefore).toBe(88.2);
    expect(model.emptyReason).toBeNull();
    expect(model.alternatives.map((alternative) => alternative.id)).toEqual(["tea", "extra"]);
    const tea = model.alternatives[0]!;
    expect(tea.measurable).toBe(true);
    expect(tea.deltaCoherence).toBeCloseTo(0.68 - 0.72, 10);
    expect(tea.deltaDistinctiveness).toBeCloseTo(0.55 - 0.61, 10);
    const extra = model.alternatives[1]!;
    expect(extra.measurable).toBe(false);
    expect(extra.blockedNote).toContain("no measured reading");
    expect(model.barCoherenceMax).toBeCloseTo(0.04, 10);
    expect(model.barDistinctivenessMax).toBeCloseTo(0.06, 10);
    expect(model.customBlockedReason).toBeNull();
    expect(model.revisions).toEqual([]);
  });

  it("sorts measurable alternatives by descending delta coherence and caps the list", () => {
    const pool = [
      makeComponent({ id: "anchor", role: "Anchor" }),
      makeComponent({ id: "discovery", role: "Discovery" }),
      makeComponent({ id: "community", role: "Community" }),
      ...Array.from({ length: 7 }, (_, index) =>
        makeComponent({ id: `alt-${index}`, role: "Community" })
      )
    ];
    const ranked = [
      rankedEntry(["anchor", "discovery", "community"], 0.5, 0.5, 50),
      rankedEntry(["anchor", "discovery", "alt-0"], 0.9, 0.5, 90),
      rankedEntry(["anchor", "discovery", "alt-1"], 0.7, 0.5, 70),
      rankedEntry(["anchor", "discovery", "alt-2"], 0.6, 0.5, 60)
    ];
    const run = runStateSchema.parse({
      id: "run-sort",
      status: "complete",
      phase: "measurement",
      brief: TEST_BRIEF,
      candidatePool: pool,
      compositions: {
        ranked,
        excluded: [],
        triangulation: [],
        rivalFlips: [],
        family: {
          poolSize: pool.length,
          size: 3,
          requiredRoles: ["Anchor"],
          totalCandidates: 0,
          totalValid: ranked.length,
          coherenceDistribution: [0.5, 0.6, 0.7, 0.9]
        },
        prior: { state: "not measured", reason: "fixture" }
      }
    });
    const result = buildReplaceModel(run, "community");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const ids = result.model.alternatives.map((alternative) => alternative.id);
    expect(ids).toHaveLength(REPLACE_ALTERNATIVE_CAP);
    expect(ids.slice(0, 3)).toEqual(["alt-0", "alt-1", "alt-2"]);
    expect(ids.every((id) => id.startsWith("alt-"))).toBe(true);
    expect(result.model.barCoherenceMax).toBeCloseTo(0.4, 10);
  });

  it("states the empty alternative list honestly when no same-role candidates exist", () => {
    const run = fixtureState();
    const trimmed = {
      ...run,
      candidatePool: (run.candidatePool ?? []).filter((component) => component.id !== "tea" && component.id !== "extra")
    };
    const result = buildReplaceModel(trimmed, "community");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.model.alternatives).toEqual([]);
    expect(result.model.emptyReason).toBe("No other Community candidates in this pool.");
  });

  it("refuses a keyed composition that is no longer ranked or lacks the member, with distinct honest reasons", () => {
    const run = fixtureState();
    expect(buildReplaceModel(run, "community", "anchor+discovery+ghost")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("no longer part of the ranked family")
    });
    expect(buildReplaceModel(run, "community", "anchor+discovery+tea")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("not a member of the selected composition")
    });
    const keyed = buildReplaceModel(run, "community", "anchor+discovery+community");
    expect(keyed.ok).toBe(true);
    if (keyed.ok) {
      expect(keyed.model.coherenceBefore).toBe(0.72);
      expect(keyed.model.percentileBefore).toBe(88.2);
    }
  });

  it("blocks custom replacement when the pool sits at capacity or the brief is missing", () => {
    const full = fixtureState();
    const tenPool = [
      ...(full.candidatePool ?? []),
      makeComponent({ id: "print-1", role: "Discovery" }),
      makeComponent({ id: "print-2", role: "Anchor" }),
      makeComponent({ id: "print-3", role: "Discovery" }),
      makeComponent({ id: "print-4", role: "Anchor" }),
      makeComponent({ id: "print-5", role: "Discovery" })
    ];
    const capped = buildReplaceModel({ ...full, candidatePool: tenPool }, "community");
    expect(capped.ok).toBe(true);
    if (capped.ok) {
      expect(capped.model.customBlockedReason).toContain("cap");
    }
    const noBrief = buildReplaceModel({ ...full, brief: undefined }, "community");
    expect(noBrief.ok).toBe(true);
    if (noBrief.ok) {
      expect(noBrief.model.customBlockedReason).toContain("no brief");
    }
  });

  it("projects stored revisions into display rows with pool names and a prettified fallback", () => {
    const revision: RunRevision = {
      rev: 1,
      replacedMember: "community",
      newMember: "tea",
      role: "Community",
      membersBefore: ["anchor", "discovery", "community"],
      membersAfter: ["anchor", "discovery", "tea"],
      coherenceBefore: 0.72,
      coherenceAfter: 0.68,
      percentileBefore: 88.2,
      percentileAfter: 71.6,
      custom: false
    };
    const customRevision: RunRevision = {
      ...revision,
      rev: 2,
      replacedMember: "tea",
      newMember: "comp-ambient-jazz",
      custom: true
    };
    const result = buildReplaceModel(fixtureState({ revisions: [revision, customRevision] }), "community");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.model.revisions).toHaveLength(2);
    const first = result.model.revisions[0]!;
    expect(first).toMatchObject({
      rev: 1,
      replacedName: "McNally Jackson",
      newName: "T Gallery",
      role: "Community",
      custom: false
    });
    expect(first.deltaCoherence).toBeCloseTo(0.68 - 0.72, 10);
    const second = result.model.revisions[1]!;
    expect(second).toMatchObject({
      rev: 2,
      replacedName: "T Gallery",
      newName: "Comp ambient jazz",
      role: "Community",
      custom: true
    });
  });
});

describe("readReplaceSuccess", () => {
  it("reads a mini-stress report into verdict, reason, and attack rows", () => {
    const run = fixtureState({
      stressReport: {
        kind: "mini",
        trigger: "replace",
        rev: 1,
        verdict: "Survived",
        reason: "the replacement holds or improves coherence",
        attacks: [
          { kind: "ablation", status: "measured", summary: "drop-one", detail: "removing books moves coherence by +0.01" },
          { kind: "rival", status: "measured", summary: "rank 1 of 2", detail: "percentile 90.00" }
        ]
      }
    });
    expect(readReplaceSuccess(run)).toEqual({
      verdict: "Survived",
      reason: "the replacement holds or improves coherence",
      rows: [
        { kind: "ablation", status: "measured", summary: "drop-one", detail: "removing books moves coherence by +0.01" },
        { kind: "rival", status: "measured", summary: "rank 1 of 2", detail: "percentile 90.00" }
      ]
    });
  });

  it("returns null when no mini report exists", () => {
    expect(readReplaceSuccess(fixtureState())).toBeNull();
    expect(readReplaceSuccess(fixtureState({ stressReport: { kind: "full" } }))).toBeNull();
    expect(readReplaceSuccess(fixtureState({ stressReport: "garbage" }))).toBeNull();
  });
});

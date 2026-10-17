import { describe, expect, it } from "vitest";
import {
  challengeReportSchema,
  runCompositionsSchema,
  runRankedCompositionSchema,
  runStateSchema,
  type ChallengeReport,
  type RunState
} from "../../src/shared/run.js";
import {
  PRE_VERDICT_QUESTION,
  S4_ATTACK_ORDER,
  buildS4Model
} from "../../src/web/screens/s4/s4Model.js";

function ranked(members: string[]) {
  return runRankedCompositionSchema.parse({
    members,
    size: members.length,
    coherence: 0.7,
    percentile: 80,
    distinctivenessMean: 0.5,
    weakestLink: { a: members[0], b: members[1], value: 0.4 },
    rankScore: 1.2,
    grade: "A",
    gradeReasons: ["all members measured"]
  });
}

function compositionsFixture(rankedCompositions: unknown) {
  return runCompositionsSchema.parse({
    family: {
      poolSize: 8,
      size: 3,
      requiredRoles: ["Anchor", "Social"],
      totalCandidates: 16,
      totalValid: 10,
      coherenceDistribution: [0.5, 0.7]
    },
    ranked: rankedCompositions,
    excluded: [],
    triangulation: [],
    rivalFlips: [],
    prior: {
      state: "measured",
      members: ["coffee", "cinema"],
      coherence: 0.6,
      percentile: 70
    }
  });
}

function runFixture(overrides: Partial<RunState>): RunState {
  return runStateSchema.parse({
    id: "run-1",
    status: "complete",
    phase: "complete",
    ...overrides
  });
}

function leader(members: string[], coherence = 0.7) {
  return {
    members,
    coherence,
    percentile: 80,
    distinctivenessMean: 0.5,
    weakestLink: { a: members[0], b: members[1], value: 0.4 }
  };
}

function reportFixture(overrides: Partial<ChallengeReport>): ChallengeReport {
  return challengeReportSchema.parse({
    kind: "challenge",
    verdict: "Survived",
    reason: "the leader held against all five attacks",
    attackOrder: ["ablation", "substitution", "bridge", "catchment", "rival"],
    attackOrderSource: "diagnostic",
    rounds: 2,
    leaderBefore: leader(["coffee", "cinema"]),
    leaderAfter: leader(["coffee", "cinema"]),
    mutations: [],
    attacks: [
      { kind: "ablation", status: "measured", summary: "held without cinema", detail: "coherence stayed 0.68" },
      { kind: "substitution", status: "measured", summary: "no same-role alternative", detail: "pool had no fit" },
      { kind: "bridge", status: "measured", summary: "no bridge candidate", detail: "empty intersection" },
      { kind: "catchment", status: "not completed", summary: "catchment sweep timed out", detail: "budget hit" },
      { kind: "rival", status: "skipped", summary: "skipped after gate", detail: "rival never formed" }
    ],
    gradeCap: "A",
    generatedAt: "2026-10-15T00:00:00.000Z",
    ...overrides
  });
}

describe("buildS4Model", () => {
  it("returns null when the run has not loaded", () => {
    expect(buildS4Model(null)).toBeNull();
  });

  it("pre-verdict: no report keeps the honest question and never invents a verdict", () => {
    const model = buildS4Model(runFixture({ status: "investigating", phase: "composition" }));
    expect(model).not.toBeNull();
    expect(model?.hasVerdict).toBe(false);
    expect(model?.verdictWord).toBeNull();
    expect(model?.verdictSquare).toBeNull();
    expect(PRE_VERDICT_QUESTION).toBe("Can the leader be broken?");
    expect(model?.attacks).toEqual([]);
    expect(model?.leaderRows).toEqual([]);
    expect(model?.gradeCap).toBeNull();
    expect(model?.attackOrderSource).toBeNull();
  });

  it("mirrors the server gate: investigating is not challengeable", () => {
    const model = buildS4Model(runFixture({ status: "investigating", phase: "composition" }));
    expect(model?.challengeReady).toBe(false);
    expect(model?.blockedReason).toBe(
      "Measurement must finish before the plan can be challenged."
    );
  });

  it("mirrors the server gate: a stopped run no longer accepts a challenge", () => {
    const model = buildS4Model(runFixture({ status: "stopped" }));
    expect(model?.challengeReady).toBe(false);
    expect(model?.blockedReason).toBe(
      "A stopped or failed run no longer accepts a challenge."
    );
  });

  it("mirrors the ranked guard: complete but with no ranked compositions is blocked", () => {
    const model = buildS4Model(
      runFixture({ compositions: compositionsFixture([]) })
    );
    expect(model?.challengeReady).toBe(false);
    expect(model?.blockedReason).toBe("There is no ranked leader to challenge yet.");
  });

  it("a complete run with a ranked leader is challengeable", () => {
    const model = buildS4Model(
      runFixture({ compositions: compositionsFixture([ranked(["coffee", "cinema"])]) })
    );
    expect(model?.challengeReady).toBe(true);
    expect(model?.blockedReason).toBeNull();
    expect(model?.hasVerdict).toBe(false);
  });

  it("Survived: solid square, server reason verbatim, no rival label", () => {
    const model = buildS4Model(
      runFixture({
        compositions: compositionsFixture([ranked(["coffee", "cinema"])]),
        challengeReport: reportFixture({ verdict: "Survived" })
      })
    );
    expect(model?.hasVerdict).toBe(true);
    expect(model?.verdictWord).toBe("Survived");
    expect(model?.verdictSquare).toBe("solid");
    expect(model?.verdictSentence).toBe("the leader held against all five attacks");
    expect(model?.rivalLabel).toBeNull();
    expect(model?.rounds).toBe(2);
    expect(model?.mutationCount).toBe(0);
    expect(model?.gradeCap).toBe("A");
    expect(model?.attackOrderSource).toBe("diagnostic");
  });

  it("Replaced: the verdict sentence names the rival members", () => {
    const model = buildS4Model(
      runFixture({
        compositions: compositionsFixture([ranked(["coffee", "cinema"])]),
        challengeReport: reportFixture({
          verdict: "Replaced",
          verdictRival: ["vinyl", "gallery"],
          reason: "the rival outranked the leader on coherence"
        })
      })
    );
    expect(model?.verdictSquare).toBe("crossed");
    expect(model?.rivalLabel).toBe("vinyl, gallery");
    expect(model?.verdictSentence).toBe("the rival outranked the leader on coherence");
  });

  it("attacks render in spec order with circles mapped from status", () => {
    const report = reportFixture({
      attacks: [
        { kind: "rival", status: "skipped", summary: "skipped after gate", detail: "rival never formed" },
        { kind: "catchment", status: "not completed", summary: "sweep timed out", detail: "budget hit" },
        { kind: "bridge", status: "measured", summary: "no bridge", detail: "empty intersection" },
        { kind: "ablation", status: "measured", summary: "held", detail: "0.68" },
        { kind: "substitution", status: "measured", summary: "no fit", detail: "pool empty" }
      ]
    });
    const model = buildS4Model(
      runFixture({
        compositions: compositionsFixture([ranked(["coffee", "cinema"])]),
        challengeReport: report
      })
    );
    expect(model?.attacks.map((attack) => attack.kind)).toEqual([...S4_ATTACK_ORDER]);
    expect(model?.attacks.map((attack) => attack.circle)).toEqual([
      "filled",
      "filled",
      "filled",
      "crossed",
      "empty"
    ]);
    expect(model?.attacks[0]?.name).toBe("Remove a member");
    expect(model?.attacks.every((attack) => attack.name.length > 0)).toBe(true);
  });

  it("leader rows strike swaps with a replacement and mark additions", () => {
    const report = reportFixture({
      verdict: "Revised",
      leaderBefore: leader(["coffee", "cinema", "vinyl"]),
      leaderAfter: leader(["coffee", "cinema", "gallery"]),
      mutations: [
        {
          operator: "swap",
          round: 1,
          memberOut: "vinyl",
          memberIn: "gallery",
          coherenceBefore: 0.7,
          coherenceAfter: 0.74
        }
      ]
    });
    const model = buildS4Model(
      runFixture({
        compositions: compositionsFixture([ranked(["coffee", "cinema"])]),
        challengeReport: report
      })
    );
    expect(model?.verdictSquare).toBe("half-hatched");
    expect(model?.mutationCount).toBe(1);
    expect(model?.leaderRows).toEqual([
      { key: "before:coffee", name: "coffee", struck: false, replacement: null, added: false },
      { key: "before:cinema", name: "cinema", struck: false, replacement: null, added: false },
      { key: "before:vinyl", name: "vinyl", struck: true, replacement: "gallery", added: false }
    ]);
  });

  it("a dropped member strikes without a replacement; a bridge insert adds a row", () => {
    const report = reportFixture({
      verdict: "Revised",
      leaderBefore: leader(["coffee", "cinema", "vinyl"]),
      leaderAfter: leader(["coffee", "cinema", "books"]),
      mutations: [
        {
          operator: "drop",
          round: 1,
          memberOut: "vinyl",
          memberIn: null,
          coherenceBefore: 0.7,
          coherenceAfter: 0.66
        },
        {
          operator: "bridge",
          round: 2,
          memberOut: null,
          memberIn: "books",
          coherenceBefore: 0.66,
          coherenceAfter: 0.72
        }
      ]
    });
    const model = buildS4Model(
      runFixture({
        compositions: compositionsFixture([ranked(["coffee", "cinema"])]),
        challengeReport: report
      })
    );
    expect(model?.leaderRows).toEqual([
      { key: "before:coffee", name: "coffee", struck: false, replacement: null, added: false },
      { key: "before:cinema", name: "cinema", struck: false, replacement: null, added: false },
      { key: "before:vinyl", name: "vinyl", struck: true, replacement: null, added: false },
      { key: "after:books", name: "books", struck: false, replacement: null, added: true }
    ]);
    expect(model?.mutationCount).toBe(2);
  });

  it("an invalid challengeReport fails the shared schema at the boundary", () => {
    expect(() =>
      runStateSchema.parse({
        id: "run-1",
        status: "complete",
        phase: "complete",
        compositions: compositionsFixture([ranked(["coffee", "cinema"])]),
        challengeReport: {
          kind: "challenge",
          verdict: "Survived",
          reason: "held",
          attackOrder: ["ablation"],
          attackOrderSource: "diagnostic",
          rounds: 0,
          leaderBefore: leader(["coffee", "cinema"]),
          leaderAfter: leader(["coffee", "cinema"]),
          mutations: [],
          attacks: [],
          gradeCap: "A",
          generatedAt: "2026-10-15T00:00:00.000Z"
        }
      })
    ).toThrow();
  });
});

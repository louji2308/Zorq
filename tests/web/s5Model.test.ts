import { describe, expect, it } from "vitest";
import { briefSchema } from "../../src/shared/brief.js";
import { blueprintSchema, type Blueprint } from "../../src/shared/routes.js";
import { runStateSchema, type RunState } from "../../src/shared/run.js";
import {
  blueprintToMarkdown,
  buildRationaleSegments,
  buildS5Model,
  compareState
} from "../../src/web/screens/s5/s5Model.js";

function fixtureBlueprint(overrides?: Partial<Blueprint>): Blueprint {
  return blueprintSchema.parse({
    title: "Cinema corner",
    rationale:
      "A micro-screening anchor [ev-anchor] beside the station [ev-station]. Unknown [ev-ghost] stays dropped.",
    narrativeSource: "llm",
    compositionByRole: [
      {
        role: "Anchor",
        members: [
          {
            memberId: "comp-cinema",
            name: "Micro-cinema",
            role: "Anchor",
            format: {
              typeDisplayName: "cinema",
              formatName: "micro-screening",
              footprintSqFtMin: 900,
              footprintSqFtMax: 1200,
              noiseClass: "quiet",
              open: "14:00",
              close: "23:00",
              downshiftedFrom: "cinema"
            },
            receipts: [
              { kind: "path", text: "anchor → coffee → café", evidenceIds: ["ev-anchor"] },
              { kind: "shared-entities", text: "shared: station entity", evidenceIds: ["ev-station"] }
            ]
          }
        ]
      },
      {
        role: "Social",
        members: [
          {
            memberId: "comp-cafe",
            name: "Late café",
            role: "Social",
            receipts: [{ kind: "path", text: "anchor → café", evidenceIds: ["ev-cafe"] }]
          }
        ]
      }
    ],
    fitToSite: {
      footprint: {
        areaSqFt: 5000,
        usableSqFt: 4250,
        totalFootprintSqFt: 3400,
        withinUsable: true,
        rule: "85% circulation rule"
      },
      hours: {
        timeline: [
          { memberId: "comp-cinema", name: "Micro-cinema", open: "14:00", close: "23:00" },
          { memberId: "comp-cafe", name: "Late café", open: "20:00", close: "02:00" },
          { memberId: "comp-broken", name: "Broken hours", open: "noonish", close: "late" }
        ],
        constraintReads: [{ key: "lateNight", source: "from the brief" }]
      },
      downshifts: [
        { memberId: "comp-cinema", name: "Micro-cinema", sentence: "cinema becomes micro-screening" }
      ]
    },
    whatQlooChanged: {
      kept: [{ member: "Late café", evidenceIds: ["ev-cafe"] }],
      added: [{ member: "Gallery annex", evidenceIds: ["ev-gal"] }],
      removed: [{ member: "Vinyl corner", evidenceIds: ["ev-vinyl"] }],
      reformatted: [{ member: "Micro-cinema", evidenceIds: ["ev-anchor"] }]
    },
    risks: [{ kind: "weakest-edge", text: "The café edge is thin.", evidenceIds: ["ev-cafe"] }],
    evidenceGrade: {
      grade: "B",
      reasons: ["one member thin"],
      rule: "worst-of challenge cap and engine grade"
    },
    revisionHistory: [
      {
        rev: 1,
        replacedMember: "Vinyl corner",
        newMember: "Late café",
        role: "Social",
        membersBefore: ["Micro-cinema", "Vinyl corner"],
        membersAfter: ["Micro-cinema", "Late café"],
        coherenceBefore: 0.62,
        coherenceAfter: 0.71,
        percentileBefore: 60,
        percentileAfter: 80,
        custom: false
      }
    ],
    methodUrl: "/method",
    shareUrl: "http://localhost:3000/run/run-1/blueprint?share=abc",
    generatedAt: "2026-10-12T00:00:00.000Z",
    expiresAt: "2026-11-11T00:00:00.000Z",
    ...overrides
  });
}

function fixtureRun(overrides?: Partial<RunState>): RunState {
  return runStateSchema.parse({
    id: "run-1",
    status: "complete",
    phase: "complete",
    brief: briefSchema.parse({
      location: "Broadway & 7th, Los Angeles",
      objective: "Late-night cinema bar",
      areaSqFt: 5000,
      constraints: ["no large nightclub"]
    }),
    prior: {
      composition: {
        thesis: "A micro-screening anchor beside a quiet social edge",
        members: [
          { role: "Anchor", name: "micro-cinema" },
          { role: "Social", name: "late café" }
        ]
      },
      generatedAt: "2026-10-11T00:00:00.000Z",
      model: "deepseek-chat",
      qlooUsed: false,
      polish: "A late-night cinema bar anchors the block with a quiet social edge."
    },
    ...overrides
  });
}

describe("buildRationaleSegments", () => {
  it("maps known citation tokens to receipt refs and drops unknown ones", () => {
    const byEvidence = new Map([
      ["ev-anchor", 1],
      ["ev-station", 2]
    ]);
    const segments = buildRationaleSegments(
      "A micro-screening anchor [ev-anchor] beside the station [ev-station]. Unknown [ev-ghost] stays dropped.",
      byEvidence
    );
    expect(segments).toEqual([
      { kind: "text", text: "A micro-screening anchor " },
      { kind: "ref", ref: 1 },
      { kind: "text", text: " beside the station " },
      { kind: "ref", ref: 2 },
      { kind: "text", text: ". Unknown " },
      { kind: "text", text: " stays dropped." }
    ]);
  });

  it("an empty rationale yields no segments", () => {
    expect(buildRationaleSegments("", new Map())).toEqual([]);
  });
});

describe("compareState", () => {
  it("changed when anything was added, removed, or reformatted", () => {
    expect(compareState(fixtureBlueprint())).toBe("changed");
  });

  it("neutral only when kept members exist and nothing else moved", () => {
    const bp = fixtureBlueprint({
      whatQlooChanged: {
        kept: [{ member: "Late café", evidenceIds: ["ev-cafe"] }],
        added: [],
        removed: [],
        reformatted: []
      }
    });
    expect(compareState(bp)).toBe("neutral");
  });

  it("an all-empty diff is honest no-prior, never false confidence", () => {
    const bp = fixtureBlueprint({
      whatQlooChanged: { kept: [], added: [], removed: [], reformatted: [] }
    });
    expect(compareState(bp)).toBe("no-prior");
  });
});

describe("buildS5Model", () => {
  it("returns null until a blueprint exists", () => {
    expect(buildS5Model(fixtureRun(), null)).toBeNull();
  });

  it("titles and title block come from brief + blueprint, never invented", () => {
    const model = buildS5Model(fixtureRun(), fixtureBlueprint());
    expect(model?.title).toBe("Cinema corner");
    expect(model?.titleBlock).toEqual({
      project: "Late-night cinema bar",
      site: "Broadway & 7th, Los Angeles",
      area: "5,000 sq ft",
      constraints: "no large nightclub",
      grade: "B",
      revision: "Rev 1",
      date: "2026-10-12T00:00:00.000Z",
      runId: "run-1"
    });
  });

  it("receipts number globally in order and members point at their indexes", () => {
    const model = buildS5Model(fixtureRun(), fixtureBlueprint());
    expect(model?.receipts.map((receipt) => receipt.index)).toEqual([1, 2, 3]);
    expect(model?.receipts.map((receipt) => receipt.memberName)).toEqual([
      "Micro-cinema",
      "Micro-cinema",
      "Late café"
    ]);
    const cinema = model?.memberRows.find((row) => row.name === "Micro-cinema");
    expect(cinema?.receiptIndexes).toEqual([1, 2]);
    const cafe = model?.memberRows.find((row) => row.name === "Late café");
    expect(cafe?.receiptIndexes).toEqual([3]);
  });

  it("member rows carry format, footprint fraction against usable area, and downshift copy", () => {
    const model = buildS5Model(fixtureRun(), fixtureBlueprint());
    const cinema = model?.memberRows.find((row) => row.name === "Micro-cinema");
    expect(cinema?.formatLabel).toBe("micro-screening · cinema");
    expect(cinema?.footprintLabel).toBe("900–1,200 sq ft");
    expect(cinema?.footprintFraction).toBeCloseTo(1200 / 5000, 5);
    expect(cinema?.hoursLabel).toBe("14:00–23:00");
    expect(cinema?.downshiftSentence).toBe("cinema becomes micro-screening.");
    const cafe = model?.memberRows.find((row) => row.name === "Late café");
    expect(cafe?.formatLabel).toBeNull();
    expect(cafe?.footprintFraction).toBeNull();
    expect(cafe?.downshiftSentence).toBeNull();
  });

  it("overnight hours wrap into two segments; unparseable hours are omitted honestly", () => {
    const model = buildS5Model(fixtureRun(), fixtureBlueprint());
    expect(model?.fit.hoursRows).toEqual([
      { name: "Micro-cinema", segments: [{ from: 14, to: 23 }] },
      { name: "Late café", segments: [{ from: 0, to: 2 }, { from: 20, to: 24 }] }
    ]);
  });

  it("constraint reads and downshift sentences project the server arrays", () => {
    const model = buildS5Model(fixtureRun(), fixtureBlueprint());
    expect(model?.fit.constraintReads).toEqual([
      { label: "lateNight", source: "from the brief" }
    ]);
    expect(model?.fit.downshiftSentences).toEqual(["cinema becomes micro-screening"]);
    expect(model?.fit.withinUsable).toBe(true);
    expect(model?.fit.rule).toBe("85% circulation rule");
  });

  it("slope pairs: kept/reformatted on both sides, removed prior-only, added final-only", () => {
    const model = buildS5Model(fixtureRun(), fixtureBlueprint());
    expect(model?.slope).toEqual([
      { member: "Late café", kind: "kept", onPrior: true, onFinal: true },
      { member: "Micro-cinema", kind: "reformatted", onPrior: true, onFinal: true },
      { member: "Vinyl corner", kind: "removed", onPrior: true, onFinal: false },
      { member: "Gallery annex", kind: "added", onPrior: false, onFinal: true }
    ]);
    expect(model?.diffSentence).toBe(
      "Qloo kept 1, reformatted 1, removed 1, and added 1."
    );
  });

  it("compare model: polish from the frozen Prior, members only — never structural keys", () => {
    const model = buildS5Model(fixtureRun(), fixtureBlueprint());
    expect(model?.compare.state).toBe("changed");
    expect(model?.compare.polish).toBe(
      "A late-night cinema bar anchors the block with a quiet social edge."
    );
    expect(model?.compare.priorMembers).toEqual([
      { name: "micro-cinema", changed: true },
      { name: "late café", changed: false }
    ]);
    const priorLabels = model?.compare.priorMembers.map((member) => member.name) ?? [];
    expect(priorLabels).not.toContain("thesis");
    expect(priorLabels).not.toContain("members");
    expect(model?.compare.finalMembers).toEqual([
      { name: "Micro-cinema", changed: true },
      { name: "Late café", changed: false }
    ]);
  });

  it("compare model without polish on the Prior reports null, not a fabrication", () => {
    const run = fixtureRun();
    const model = buildS5Model(
      runStateSchema.parse({
        ...run,
        prior: {
          composition: run.prior?.composition,
          generatedAt: run.prior?.generatedAt ?? "2026-10-11T00:00:00.000Z",
          model: run.prior?.model ?? "deepseek-chat",
          qlooUsed: false
        }
      }),
      fixtureBlueprint()
    );
    expect(model?.compare.polish).toBeNull();
  });

  it("neutral compare state carries the exact honest line", () => {
    const bp = fixtureBlueprint({
      whatQlooChanged: {
        kept: [{ member: "Late café", evidenceIds: ["ev-cafe"] }],
        added: [],
        removed: [],
        reformatted: []
      }
    });
    const model = buildS5Model(fixtureRun(), bp);
    expect(model?.compare.state).toBe("neutral");
    expect(model?.compare.neutralLine).toBe("Here, the evidence changed nothing.");
  });

  it("revision sentences report both coherence percentages and the swap words", () => {
    const bp = fixtureBlueprint({
      revisionHistory: [
        {
          rev: 1,
          replacedMember: "Vinyl corner",
          newMember: "Late café",
          role: "Social",
          coherenceBefore: 0.62,
          coherenceAfter: 0.71,
          custom: false
        },
        {
          rev: 2,
          replacedMember: "Gallery annex",
          newMember: "Micro-cinema",
          role: "Anchor",
          coherenceBefore: 0.71,
          coherenceAfter: 0.82,
          custom: true
        }
      ]
    });
    const model = buildS5Model(fixtureRun(), bp);
    expect(model?.revisions).toEqual([
      {
        rev: 1,
        sentence:
          "Rev 1. Swapped Vinyl corner with Late café. Coherence moved from 62% to 71%."
      },
      {
        rev: 2,
        sentence:
          "Rev 2. Replaced Gallery annex with Micro-cinema. Coherence moved from 71% to 82%."
      }
    ]);
  });

  it("risks and grade project the server arrays verbatim", () => {
    const model = buildS5Model(fixtureRun(), fixtureBlueprint());
    expect(model?.risks).toEqual([
      {
        kind: "weakest-edge",
        text: "The café edge is thin.",
        evidenceIds: ["ev-cafe"]
      }
    ]);
    expect(model?.evidenceGrade).toEqual({
      grade: "B",
      rule: "worst-of challenge cap and engine grade",
      reasons: ["one member thin"]
    });
    expect(model?.methodUrl).toBe("/method");
    expect(model?.shareUrl).toBe("http://localhost:3000/run/run-1/blueprint?share=abc");
  });

  it("title block falls back to honest Not recorded / None recorded copy", () => {
    const model = buildS5Model(
      runStateSchema.parse({ id: "run-1", status: "complete", phase: "complete" }),
      fixtureBlueprint({ revisionHistory: [] })
    );
    expect(model?.titleBlock.project).toBe("Not recorded");
    expect(model?.titleBlock.site).toBe("Not recorded");
    expect(model?.titleBlock.area).toBe("Not recorded");
    expect(model?.titleBlock.constraints).toBe("None recorded");
    expect(model?.titleBlock.revision).toBe("Rev 0");
    expect(model?.titleBlock.runId).toBe("run-1");
  });
});

describe("blueprintToMarkdown", () => {
  it("exports every section with the neutral line only in the neutral case", () => {
    const md = blueprintToMarkdown(fixtureBlueprint(), "run-1");
    expect(md).toContain("# Cinema corner");
    expect(md).toContain("Evidence grade: B");
    expect(md).toContain("## Rationale");
    expect(md).toContain("## Composition by role");
    expect(md).toContain("- Anchor: Micro-cinema — micro-screening (cinema)");
    expect(md).toContain("## Fit to site");
    expect(md).toContain("- cinema becomes micro-screening");
    expect(md).toContain("## What Qloo changed");
    expect(md).toContain("- Kept: Late café");
    expect(md).toContain("## Risks");
    expect(md).toContain("## Revisions");
    expect(md).toContain("Rev 1. Swapped Vinyl corner with Late café.");
    expect(md).toContain("Share: http://localhost:3000/run/run-1/blueprint?share=abc");
    expect(md).not.toContain("Here, the evidence changed nothing.");
  });

  it("neutral case includes the honest no-change line and empty risks are explicit", () => {
    const bp = fixtureBlueprint({
      whatQlooChanged: {
        kept: [{ member: "Late café", evidenceIds: ["ev-cafe"] }],
        added: [],
        removed: [],
        reformatted: []
      },
      risks: []
    });
    const md = blueprintToMarkdown(bp, "run-1");
    expect(md).toContain("Here, the evidence changed nothing.");
    expect(md).toContain("- No risks were flagged.");
  });
});

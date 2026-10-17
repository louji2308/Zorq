import { describe, expect, it } from "vitest";
import { blueprintResponseSchema } from "../../src/shared/routes.js";
import {
  runStateSchema,
  type ChallengeReport,
  type PoolComponent,
  type RunState
} from "../../src/shared/run.js";
import { LlmBudget } from "../../src/server/agent/budget.js";
import { createLedger, type Ledger } from "../../src/server/agent/ledger.js";
import type { LlmClient, LlmCompletionRequest } from "../../src/server/agent/llm.js";
import {
  BLUEPRINT_TTL_MS,
  blueprintFingerprint,
  composeBlueprint
} from "../../src/server/orchestrator/blueprint.js";
import { OrchestratorStateError } from "../../src/server/orchestrator/index.js";
import { makeComponent } from "../engine/fixtures.js";
import { TEST_NOW, fakeLlm, type FakeLlm } from "../agent/support/fakes.js";

const POOL: PoolComponent[] = [
  makeComponent({
    id: "comp-anchor",
    role: "Anchor",
    tags: ["coffee"],
    exemplars: [{ id: "ex-anchor", name: "Devoción" }],
    provenancePath: {
      anchorPlace: "Williamsburg corner",
      qlooSignal: "coffee",
      resolvedCategory: "urn:tag:coffee-1",
      exemplarSet: "specialty coffee roasters",
      tasteNeighborhood: "daytime coffee culture"
    }
  }),
  makeComponent({ id: "comp-night", role: "Night", tags: ["jazz"] }),
  makeComponent({ id: "comp-social", role: "Social", tags: ["cafe"] })
];

const LEADER = ["comp-anchor", "comp-night", "comp-social"];

const BRIEF = {
  location: "Williamsburg, Brooklyn, NY",
  objective: "A daytime cultural corner",
  constraints: ["Ground-floor only"],
  areaSqFt: 8000
};

const PRIOR = {
  composition: {
    members: [
      { role: "Night", name: "Exemplar comp-night" },
      { role: "Anchor", name: "Devoción" },
      { name: "Vanishing Diner" }
    ]
  },
  generatedAt: "2026-10-08T12:00:00.000Z",
  model: "deepseek-flash",
  qlooUsed: false as const
};

function reportFixture(overrides: Partial<ChallengeReport> = {}): ChallengeReport {
  const leader = {
    members: LEADER,
    coherence: 0.52,
    percentile: 72,
    distinctivenessMean: 0.6,
    weakestLink: { a: "comp-anchor", b: "comp-social", value: 0.35 }
  };
  return {
    kind: "challenge",
    verdict: "Survived",
    reason: "fixture report",
    attackOrder: ["ablation", "substitution", "bridge", "catchment", "rival"],
    attackOrderSource: "diagnostic",
    rounds: 1,
    leaderBefore: leader,
    leaderAfter: leader,
    mutations: [],
    attacks: [
      { kind: "ablation", status: "measured", summary: "drop-one", detail: "leader holds" },
      { kind: "substitution", status: "measured", summary: "same-role", detail: "no improvement" },
      { kind: "bridge", status: "measured", summary: "bridge", detail: "shared entities", evidenceId: "ev-attack-bridge" },
      { kind: "catchment", status: "skipped", summary: "catchment skipped", detail: "no city neighborhoods" },
      { kind: "rival", status: "measured", summary: "rival sweep", detail: "leader holds rank 1" }
    ],
    gradeCap: "A",
    generatedAt: "2026-10-08T12:05:00.000Z",
    ...overrides
  };
}

function blueprintState(overrides: Partial<RunState> = {}): RunState {
  return runStateSchema.parse({
    id: "run-blueprint-unit",
    status: "complete",
    phase: "blueprint",
    brief: BRIEF,
    prior: PRIOR,
    evidence: [
      { id: "ev-a-site", label: "site signal for Devoción" },
      { id: "ev-a-site2", label: "second site signal" },
      { id: "ev-n-site", label: "site signal for jazz" },
      { id: "ev-n-city", label: "city signal for jazz" }
    ],
    candidatePool: POOL,
    neighborhoods: {
      components: [],
      city: [],
      sources: [
        { componentId: "comp-anchor", domain: "artist", scope: "site", evidenceId: "ev-a-site" },
        { componentId: "comp-anchor", domain: "movie", scope: "site", evidenceId: "ev-a-site2" },
        { componentId: "comp-night", domain: "artist", scope: "site", evidenceId: "ev-n-site" },
        { componentId: "comp-night", domain: "artist", scope: "city", evidenceId: "ev-n-city" }
      ]
    },
    graph: {
      nodes: LEADER,
      edges: [
        {
          a: "comp-anchor",
          b: "comp-night",
          value: 0.42,
          band: "typical",
          state: "measured",
          sharedEntities: [
            {
              entityId: "urn:entity:artist-alice-coltrane",
              domain: "artist",
              aWeight: 0.9,
              bWeight: 0.8,
              idf: 1.2,
              dotContribution: 0.11,
              name: "Alice Coltrane"
            }
          ]
        },
        { a: "comp-anchor", b: "comp-social", value: 0.35, band: "weak", state: "measured" },
        { a: "comp-night", b: "comp-social", value: 0.4, band: "typical", state: "measured" }
      ]
    },
    compositions: {
      family: {
        poolSize: 3,
        size: 3,
        requiredRoles: ["Anchor"],
        totalCandidates: 1,
        totalValid: 1,
        coherenceDistribution: [0.52]
      },
      ranked: [
        {
          members: LEADER,
          size: 3,
          coherence: 0.52,
          percentile: 72,
          distinctivenessMean: 0.6,
          weakestLink: { a: "comp-anchor", b: "comp-social", value: 0.35 },
          rankScore: 0.55,
          grade: "A",
          gradeReasons: ["fixture ranking"]
        }
      ],
      excluded: [],
      triangulation: [
        { a: "comp-anchor", b: "comp-night", state: "confirmed", route1State: "measured", route1Value: 0.42, resultCount: 8, focalInTopHalf: true },
        { a: "comp-anchor", b: "comp-social", state: "confirmed", route1State: "measured", route1Value: 0.35, resultCount: 8, focalInTopHalf: true },
        { a: "comp-night", b: "comp-social", state: "confirmed", route1State: "measured", route1Value: 0.4, resultCount: 8, focalInTopHalf: true }
      ],
      rivalFlips: [],
      prior: { state: "not measured", reason: "fixture prior has no measured counterpart" }
    },
    revisions: [
      {
        rev: 1,
        replacedMember: "comp-old",
        newMember: "comp-anchor",
        role: "Anchor",
        membersBefore: ["comp-old", "comp-night", "comp-social"],
        membersAfter: LEADER,
        coherenceBefore: 0.41,
        coherenceAfter: 0.52,
        percentileBefore: 55,
        percentileAfter: 72,
        custom: false
      }
    ],
    ...overrides
  });
}

function narrativeLlm(): FakeLlm {
  return fakeLlm([
    (request: LlmCompletionRequest) => {
      const text = request.messages
        .map((message) => (typeof message.content === "string" ? message.content : ""))
        .join("\n");
      const cited = text.match(/"allowedEvidenceIds":\["([^"]+)"/)?.[1] ?? "missing-evidence-id";
      return {
        content: JSON.stringify({
          title: "Coffee Jazz Corner",
          rationale: `Devoción anchors the corner while jazz spills outward [${cited}] beside a ghost claim [bogus-citation].`
        })
      };
    }
  ]);
}

async function runCompose(
  state: RunState,
  llm: LlmClient = narrativeLlm().client
): Promise<{ ledger: Ledger; blueprint: Awaited<ReturnType<typeof composeBlueprint>> }> {
  const ledger = createLedger();
  const blueprint = await composeBlueprint({
    state,
    shareToken: "tok_unit_1",
    storedEvidenceIds: new Set(["ev-a-site", "ev-a-site2", "ev-n-site", "ev-n-city"]),
    llm,
    budget: new LlmBudget({ ceilingUsd: 1, now: () => TEST_NOW }),
    ledger,
    now: TEST_NOW
  });
  return { ledger, blueprint };
}

function labels(ledger: Ledger): string[] {
  return ledger.list().map((entry) => entry.event.label);
}

describe("W-8.3 Place Blueprint composition (unit)", () => {
  it("assembles the full blueprint contract with validated citations, role groups, receipts, fit, diff, risks, grade, and revisions", async () => {
    const { ledger, blueprint } = await runCompose(blueprintState());

    const parsed = blueprintResponseSchema.safeParse({ blueprint });
    expect(parsed.success).toBe(true);

    expect(blueprint.narrativeSource).toBe("llm");
    expect(blueprint.title).toBe("Coffee Jazz Corner");
    expect(blueprint.rationale).toContain("ghost claim .");
    expect(blueprint.rationale).not.toContain("bogus-citation");

    expect(blueprint.compositionByRole.map((group) => group.role)).toEqual(["Anchor", "Social", "Night"]);
    const anchorGroup = blueprint.compositionByRole[0]!;
    expect(anchorGroup.members[0]!.name).toBe("Devoción");
    const pathReceipt = anchorGroup.members[0]!.receipts[0]!;
    expect(pathReceipt.kind).toBe("path");
    expect(pathReceipt.text).toContain("Williamsburg corner");
    expect(pathReceipt.evidenceIds).toEqual(["ev-a-site", "ev-a-site2"]);

    const nightGroup = blueprint.compositionByRole.find((group) => group.role === "Night")!;
    const nightMember = nightGroup.members[0]!;
    expect(nightMember.memberId).toBe("comp-night");
    expect(nightMember.receipts.length).toBeGreaterThanOrEqual(2);
    const sharedReceipt = nightMember.receipts.find((receipt) => receipt.kind === "shared-entities")!;
    expect(sharedReceipt.text).toContain("Alice Coltrane");
    expect(sharedReceipt.text).toContain("Devoción");
    expect(sharedReceipt.evidenceIds).toEqual(["ev-n-site", "ev-n-city", "ev-a-site", "ev-a-site2"]);

    expect(blueprint.fitToSite.footprint.areaSqFt).toBe(8000);
    expect(blueprint.fitToSite.footprint.usableSqFt).toBe(6800);
    expect(blueprint.fitToSite.footprint.totalFootprintSqFt).toBe(5050);
    expect(blueprint.fitToSite.footprint.withinUsable).toBe(true);
    expect(blueprint.fitToSite.footprint.rule).toContain("85%");
    expect(blueprint.fitToSite.hours.timeline).toHaveLength(3);
    expect(blueprint.fitToSite.hours.constraintReads).toEqual([
      { key: "raw", source: "Ground-floor only" }
    ]);
    expect(blueprint.fitToSite.downshifts).toEqual([]);

    expect(blueprint.whatQlooChanged.kept.map((item) => item.member)).toEqual([
      "Exemplar comp-night",
      "Devoción"
    ]);
    expect(blueprint.whatQlooChanged.added.map((item) => item.member)).toEqual(["Exemplar comp-social"]);
    expect(blueprint.whatQlooChanged.removed.map((item) => item.member)).toEqual(["Vanishing Diner"]);
    expect(blueprint.whatQlooChanged.reformatted).toEqual([]);

    expect(blueprint.risks).toHaveLength(1);
    expect(blueprint.risks[0]).toMatchObject({ kind: "weakest-edge" });
    expect(blueprint.risks[0]!.text).toContain("Devoción");
    expect(blueprint.risks[0]!.evidenceIds).toEqual(["ev-a-site", "ev-a-site2"]);

    expect(blueprint.evidenceGrade).toEqual({
      grade: "A",
      reasons: [],
      rule: "A: all leader edges confirmed. B: any contested, thin, or failed probe. C: any leader member unmeasured."
    });

    expect(blueprint.revisionHistory).toHaveLength(1);
    expect(blueprint.revisionHistory[0]).toMatchObject({
      rev: 1,
      replacedMember: "comp-old",
      newMember: "Devoción",
      role: "Anchor",
      custom: false
    });

    expect(blueprint.methodUrl).toBe("/method");
    expect(blueprint.shareUrl).toBe("/run/run-blueprint-unit/blueprint?share=tok_unit_1");
    expect(blueprint.generatedAt).toBe(new Date(TEST_NOW).toISOString());
    expect(Date.parse(blueprint.expiresAt) - Date.parse(blueprint.generatedAt)).toBe(BLUEPRINT_TTL_MS);

    expect(labels(ledger)).toContain("blueprint.compose");
    expect(labels(ledger)).not.toContain("blueprint.compose_fallback");
  });

  it("downshifts a late-closing format when the site area forces it and reports the member as reformatted rather than kept", async () => {
    const state = blueprintState({ brief: { ...BRIEF, areaSqFt: 5000 } });
    const { blueprint } = await runCompose(state);

    expect(blueprint.fitToSite.footprint.totalFootprintSqFt).toBe(3500);
    expect(blueprint.fitToSite.downshifts).toHaveLength(1);
    expect(blueprint.fitToSite.downshifts[0]).toMatchObject({
      memberId: "comp-night",
      sentence: expect.stringContaining("becomes") as unknown as string
    });

    const nightGroup = blueprint.compositionByRole.find((group) => group.role === "Night")!;
    expect(nightGroup.members[0]!.format).toMatchObject({
      formatName: "Stage-and-bar",
      downshiftedFrom: "Music venue"
    });

    expect(blueprint.whatQlooChanged.reformatted.map((item) => item.member)).toEqual(["Exemplar comp-night"]);
    expect(blueprint.whatQlooChanged.kept.map((item) => item.member)).toEqual(["Devoción"]);
    expect(blueprint.whatQlooChanged.added.map((item) => item.member)).toEqual(["Exemplar comp-social"]);
    expect(blueprint.whatQlooChanged.removed.map((item) => item.member)).toEqual(["Vanishing Diner"]);
    expect(blueprint.fitToSite.footprint.withinUsable).toBe(true);
  });

  it("caps the grade at the challenge gradeCap so a stress-probe gap cannot read as clean A", async () => {
    const state = blueprintState({ challengeReport: reportFixture({ gradeCap: "B" }) });
    const { blueprint } = await runCompose(state);

    expect(blueprint.evidenceGrade.grade).toBe("B");
    expect(blueprint.evidenceGrade.reasons).toEqual([
      "a stress probe did not complete; the plan grade cannot exceed B"
    ]);
  });

  it("grades C and surfaces a thin-component risk when a leader member is unmeasured", async () => {
    const thinPool = POOL.map((component) =>
      component.id === "comp-social" ? { ...component, evidenceState: "not measured" as const } : component
    );
    const state = blueprintState({ candidatePool: thinPool });
    const { blueprint } = await runCompose(state);

    expect(blueprint.evidenceGrade.grade).toBe("C");
    expect(blueprint.evidenceGrade.reasons).toContain("member comp-social evidenceState=not measured");
    const thin = blueprint.risks.find((risk) => risk.kind === "thin-component");
    expect(thin?.text).toBe("Exemplar comp-social is not measured");
  });

  it("resolves a challenge-inserted bridge component from the report when it is absent from the stored pool", async () => {
    const bridge = makeComponent({
      id: "comp-bridge",
      role: "Discovery",
      tags: ["books"],
      exemplars: [{ id: "ex-bridge", name: "Bridge Reading Room" }]
    });
    const report = reportFixture({
      verdict: "Revised",
      leaderAfter: {
        members: ["comp-anchor", "comp-night", "comp-bridge"],
        coherence: 0.55,
        percentile: 74,
        distinctivenessMean: 0.61,
        weakestLink: { a: "comp-anchor", b: "comp-bridge", value: 0.33 }
      },
      mutations: [
        {
          operator: "bridge",
          round: 1,
          memberOut: "comp-social",
          memberIn: "comp-bridge",
          coherenceBefore: 0.52,
          coherenceAfter: 0.55,
          component: bridge
        }
      ]
    });
    const state = blueprintState({ challengeReport: report });
    const { blueprint } = await runCompose(state);

    const discovery = blueprint.compositionByRole.find((group) => group.role === "Discovery");
    expect(discovery?.members.map((member) => member.name)).toEqual(["Bridge Reading Room"]);
    expect(blueprint.whatQlooChanged.added.map((item) => item.member)).toContain("Bridge Reading Room");
    expect(blueprint.evidenceGrade.grade).toBe("B");
    expect(blueprint.evidenceGrade.reasons.join(" ")).toContain("state=failed");
  });

  it("falls back to the deterministic narrative when the LLM turn throws, recording the honest fallback event", async () => {
    const broken = fakeLlm([
      () => {
        throw new Error("deepseek exploded");
      }
    ]);
    const { ledger, blueprint } = await runCompose(blueprintState(), broken.client);

    expect(blueprint.narrativeSource).toBe("deterministic");
    expect(blueprint.title).toBe("A daytime cultural corner — Williamsburg, Brooklyn, NY");
    expect(blueprint.rationale).toContain("Coherence 0.52");
    expect(blueprint.rationale).toContain("[ev-a-site]");
    expect(labels(ledger)).toContain("blueprint.compose_fallback");
    expect(labels(ledger)).not.toContain("blueprint.compose");
  });

  it("rejects an LLM narrative that cites no known evidence id", async () => {
    const ghost = fakeLlm([
      {
        content: JSON.stringify({ title: "Ghost Plan", rationale: "Everything is fine [ghost-id-9999]." })
      }
    ]);
    const { ledger, blueprint } = await runCompose(blueprintState(), ghost.client);

    expect(blueprint.narrativeSource).toBe("deterministic");
    expect(labels(ledger)).toContain("blueprint.compose_fallback");
    const fallback = ledger
      .list()
      .find((entry) => entry.event.label === "blueprint.compose_fallback");
    expect(fallback?.event.summary).toContain("cited no known evidence id");
  });

  it("refuses to blueprint a run missing brief, prior, pool, compositions, or a leader member", async () => {
    await expect(runCompose(blueprintState({ brief: undefined }))).rejects.toThrow(OrchestratorStateError);
    await expect(runCompose(blueprintState({ prior: undefined }))).rejects.toThrow(/Prior/);
    await expect(runCompose(blueprintState({ candidatePool: undefined }))).rejects.toThrow(/candidate pool/);
    await expect(runCompose(blueprintState({ compositions: undefined }))).rejects.toThrow(/ranked composition/);
    await expect(
      runCompose(blueprintState({ candidatePool: POOL.filter((c) => c.id !== "comp-social") }))
    ).rejects.toThrow(/comp-social/);
  });

  it("fingerprints the content basis, not incidental status", async () => {
    const state = blueprintState();
    const base = blueprintFingerprint(state);
    expect(blueprintFingerprint({ ...state, status: "stopped" })).toBe(base);
    expect(blueprintFingerprint({ ...state, phase: "challenge" })).toBe(base);
    expect(
      blueprintFingerprint({ ...state, brief: { ...BRIEF, objective: "A different objective" } })
    ).not.toBe(base);
    expect(blueprintFingerprint(blueprintState({ brief: { ...BRIEF, areaSqFt: 5000 } }))).not.toBe(base);
  });

  it("refuses an LLM narrative that states numbers the artifact owns, falling back to the deterministic narrative", async () => {
    const numeric = fakeLlm([
      {
        content: JSON.stringify({
          title: "Coffee Jazz Corner",
          rationale: "Founded in 1996, the roastery anchors the corner [ev-a-site]."
        })
      }
    ]);
    const { ledger, blueprint } = await runCompose(blueprintState(), numeric.client);

    expect(blueprint.narrativeSource).toBe("deterministic");
    expect(labels(ledger)).toContain("blueprint.compose_fallback");
    expect(labels(ledger)).not.toContain("blueprint.compose");
    const fallback = ledger
      .list()
      .find((entry) => entry.event.label === "blueprint.compose_fallback");
    expect(fallback?.event.summary).toContain("numeric content");
  });

  it("accepts an LLM narrative whose only digits sit inside kept evidence citations", async () => {
    const cited = fakeLlm([
      {
        content: JSON.stringify({
          title: "Coffee Jazz Corner",
          rationale: "The site edge binds the anchor to the corner [ev-a-site2]."
        })
      }
    ]);
    const { ledger, blueprint } = await runCompose(blueprintState(), cited.client);

    expect(blueprint.narrativeSource).toBe("llm");
    expect(labels(ledger)).toContain("blueprint.compose");
    expect(blueprint.rationale).toContain("[ev-a-site2]");
  });

  it("follows the ranked leader when a revision landed after the challenge report, and the report leader otherwise", async () => {
    const reportLeaderAfter = {
      members: ["comp-night", "comp-social"],
      coherence: 0.4,
      percentile: 40,
      distinctivenessMean: 0.5,
      weakestLink: { a: "comp-night", b: "comp-social", value: 0.3 }
    };
    const namesOf = (blueprint: Awaited<ReturnType<typeof composeBlueprint>>): string[] =>
      blueprint.compositionByRole.flatMap((group) => group.members.map((member) => member.name));

    const fresh = await runCompose(
      blueprintState({ challengeReport: reportFixture({ leaderAfter: reportLeaderAfter }) })
    );
    expect(namesOf(fresh.blueprint)).not.toContain("Devoción");
    expect(namesOf(fresh.blueprint)).toContain("Exemplar comp-night");

    const stale = await runCompose(
      blueprintState({
        challengeReport: reportFixture({ leaderAfter: reportLeaderAfter }),
        revisions: [
          {
            rev: 1,
            replacedMember: "comp-anchor",
            newMember: "comp-night",
            role: "Anchor",
            membersBefore: LEADER,
            membersAfter: ["comp-night", "comp-social"],
            coherenceBefore: 0.52,
            coherenceAfter: 0.4,
            percentileBefore: 72,
            percentileAfter: 40,
            custom: false,
            at: Date.parse("2026-10-08T12:10:00.000Z")
          }
        ]
      })
    );
    expect(stale.blueprint.revisionHistory[0]).toMatchObject({
      replacedMember: "Devoción",
      newMember: "Exemplar comp-night"
    });
    expect(namesOf(stale.blueprint)).toContain("Devoción");
    expect(namesOf(stale.blueprint)).toContain("Exemplar comp-social");
  });

  it("keeps a constraint drop visible on a feasible fit as a risk and a dropped member", async () => {
    const club = makeComponent({ id: "comp-club", role: "Night", tags: ["nightclub"] });
    const state = blueprintState({
      brief: { ...BRIEF, constraints: ["active after 10 PM restricted"], areaSqFt: 6000 },
      candidatePool: [...POOL, club],
      challengeReport: reportFixture({
        leaderAfter: {
          members: ["comp-club", "comp-anchor", "comp-social"],
          coherence: 0.45,
          percentile: 60,
          distinctivenessMean: 0.55,
          weakestLink: { a: "comp-anchor", b: "comp-social", value: 0.35 }
        }
      })
    });
    const { blueprint } = await runCompose(state);

    expect(blueprint.fitToSite.footprint.withinUsable).toBe(true);
    const dropRisks = blueprint.risks.filter((risk) => risk.kind === "constraint-conflict");
    expect(dropRisks.length).toBeGreaterThanOrEqual(1);
    const night = blueprint.compositionByRole.find((group) => group.role === "Night")!;
    expect(night.members[0]?.name).toBe("Exemplar comp-club");
    expect(night.members[0]?.constraintDropped).toBeTruthy();
    expect(blueprintResponseSchema.safeParse({ blueprint }).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { challengeResponseSchema, runResponseSchema } from "../../src/shared/index.js";
import { startJudgeFixtureServer, type JudgeFixtureServer } from "../support/judgePipeline.js";

async function createMeasuredFixture(): Promise<{ fixture: JudgeFixtureServer; run: Record<string, unknown> }> {
  const fixture = await startJudgeFixtureServer();
  const response = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}`);
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  const parsed = runResponseSchema.safeParse(body);
  if (!parsed.success) {
    await fixture.close();
    throw new Error("run response failed schema validation");
  }
  return { fixture, run: parsed.data.run as unknown as Record<string, unknown> };
}

describe("S4 challenge over real HTTP (scripted LLM + fake gateway)", () => {
  it("challenges a measured run with all five attacks, persists the report, and leaves measured artifacts intact", async () => {
    const { fixture, run } = await createMeasuredFixture();
    try {
      const evidenceBefore = (await fixture.store.listEvidence(fixture.runId)).length;

      const response = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}/challenge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      const parsed = challengeResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (!parsed.success) {
        throw new Error("challenge response failed schema validation");
      }
      const { run: challenged, report } = parsed.data;

      expect(report.verdict).toBe("Revised");
      expect(report.rounds).toBe(3);
      expect(report.mutations).toHaveLength(2);
      expect(report.mutations[0]).toMatchObject({
        operator: "drop",
        round: 1,
        memberOut: "comp-court-tree",
        memberIn: null
      });
      expect(report.mutations[0]!.coherenceAfter).toBeCloseTo(0.10453303064548077, 10);
      expect(report.mutations[1]).toMatchObject({
        operator: "drop",
        round: 2,
        memberOut: "comp-clay",
        memberIn: null
      });
      expect(report.mutations[1]!.coherenceAfter).toBeCloseTo(0.14652787121143274, 10);
      expect(report.reason).toContain("2 mutations applied: 1·dropped Court Tree Roasters; 2·dropped Clay Collective.");
      expect(report.reason).toContain("A further drop Blue Note Corner (Δ +0.0860) remained at the two-round stop.");
      expect(report.leaderAfter.members).toEqual(["comp-blue-note", "comp-rooftop", "comp-sunset-vinyl"]);
      expect(report.leaderAfter.coherence).toBeCloseTo(0.14652787121143274, 10);
      const bridge = report.attacks.find((attack) => attack.kind === "bridge");
      expect(bridge?.status).toBe("skipped");
      expect(bridge?.detail).toContain("recorded bridge probe");

      expect(report.attacks.map((attack) => attack.kind)).toEqual([
        "ablation",
        "substitution",
        "bridge",
        "catchment",
        "rival"
      ]);
      expect(new Set(report.attackOrder).size).toBe(5);
      expect(report.attackOrderSource).toBe("diagnostic");
      expect(report.rounds).toBeGreaterThanOrEqual(1);
      expect(report.rounds).toBeLessThanOrEqual(3);
      expect(report.mutations.length).toBeLessThanOrEqual(2);
      expect(report.gradeCap).toBe("A");
      expect(challenged.challengeReport).toEqual(report);

      expect(challenged.status).toBe("complete");
      expect(challenged.prior).toEqual(run.prior);
      expect(challenged.compositions).toEqual(run.compositions);
      expect(challenged.graph).toEqual(run.graph);
      expect(challenged.candidatePool).toEqual(run.candidatePool);
      const { evidence: _ignoredEvidence, ...runWithoutEvidence } = run;
      void _ignoredEvidence;
      expect(challenged.revisions).toEqual(run.revisions ?? undefined);
      expect(challenged).toEqual({ ...runWithoutEvidence, challengeReport: report });

      const evidenceAfter = (await fixture.store.listEvidence(fixture.runId)).length;
      const probes = evidenceAfter - evidenceBefore;
      expect(probes).toBe(4);

      const labels = (await fixture.store.listLedgerEvents(fixture.runId)).map((entry) => entry.event.label);
      expect(labels).toContain("challenge.order");
      expect(labels).toContain("challenge.order_fallback");
      expect(labels).toContain("challenge.stress");
      expect(labels).toContain("challenge.verdict");
      expect(labels).toContain("challenge.bridge_probe");
      expect(labels).toContain("challenge.bridge_measure");
      expect(labels).toContain("challenge.mutation");

      const reread = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}`);
      const rereadBody = (await reread.json()) as { run: { challengeReport?: unknown } };
      expect(rereadBody.run.challengeReport).toEqual(report);
    } finally {
      await fixture.close();
    }
  });
});

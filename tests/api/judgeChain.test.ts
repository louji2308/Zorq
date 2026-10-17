import { describe, expect, it } from "vitest";
import {
  blueprintResponseSchema,
  challengeResponseSchema,
  replaceResponseSchema,
  runResponseSchema
} from "../../src/shared/index.js";
import {
  JUDGE_ATTACK_ORDER,
  JUDGE_COMPOSE_TITLE,
  JUDGE_INVENTED_CITATION,
  judgeChallengeAndCompose,
  startJudgeFixtureServer,
  type JudgeFixtureServer
} from "../support/judgePipeline.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function createMeasuredRun(): Promise<{ fixture: JudgeFixtureServer; run: Record<string, unknown> }> {
  const fixture = await startJudgeFixtureServer();
  const response = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}`);
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  const parsed = runResponseSchema.safeParse(body);
  expect(parsed.success).toBe(true);
  if (!parsed.success) {
    await fixture.close();
    throw new Error("run response failed schema validation");
  }
  return { fixture, run: parsed.data.run as unknown as Record<string, unknown> };
}

interface GraphEdge {
  a: string;
  b: string;
  value: number | null;
  state: string;
  sharedEntities?: Array<{
    entityId: string;
    domain: string;
    aWeight: number;
    bWeight: number;
    idf: number;
    dotContribution: number;
    name?: string;
  }>;
}

interface RankedComposition {
  members: string[];
  coherence: number;
  percentile: number;
  distinctivenessMean: number;
  grade: string;
  gradeReasons: string[];
}

describe("Judge chain over real HTTP (scripted LLM + fake gateway)", () => {
  it("serves the edge-inspection chain: measured graph, evidence with ledger links, triangulation, and prior", async () => {
    const { fixture, run } = await createMeasuredRun();
    try {
      expect(String(run.id)).toMatch(UUID_RE);
      expect(run.status).toBe("complete");

      const siteRead = run.siteRead as { anchors?: Array<{ letter: string; evidenceId: string }>; heat?: unknown[] };
      expect(siteRead.anchors?.length).toBe(5);
      expect(siteRead.anchors?.every((anchor) => anchor.letter.length === 1)).toBe(true);
      expect(siteRead.anchors?.every((anchor) => anchor.evidenceId.length > 0)).toBe(true);
      expect((siteRead.heat ?? []).length).toBeGreaterThan(0);

      const pool = run.candidatePool as Array<{ id: string; role: string; evidenceState: string }>;
      expect(pool.length).toBe(8);
      expect(pool.every((component) => component.evidenceState === "measured")).toBe(true);

      const neighborhoods = run.neighborhoods as {
        components: Array<{ state: string }>;
        city: Array<{ state: string }>;
      };
      expect(neighborhoods.components.map((entry) => entry.state)).toEqual(Array(8).fill("measured"));
      expect(neighborhoods.city.map((entry) => entry.state)).toEqual(Array(8).fill("measured"));

      const dna = run.culturalDna as Record<string, Array<{ name: string; local: number; city: number }>>;
      expect(Object.keys(dna).sort()).toEqual(["artists", "brands", "films"]);
      expect(dna.artists?.length).toBeGreaterThan(0);
      expect(dna.artists?.every((entry) => typeof entry.name === "string" && entry.name !== "")).toBe(true);

      const graph = run.graph as { nodes: string[]; edges: GraphEdge[] };
      expect(graph.nodes.length).toBe(8);
      expect(graph.edges.length).toBe(28);
      expect(graph.edges.every((edge) => edge.state === "measured")).toBe(true);
      expect(graph.edges.every((edge) => typeof edge.value === "number")).toBe(true);
      const withShared = graph.edges.filter((edge) => (edge.sharedEntities ?? []).length > 0);
      expect(withShared.length).toBeGreaterThanOrEqual(10);

      const inspected = graph.edges.find(
        (edge) =>
          new Set([edge.a, edge.b]).has("comp-devocion") && new Set([edge.a, edge.b]).has("comp-court-tree")
      );
      expect(inspected).toBeDefined();
      const shared = inspected?.sharedEntities ?? [];
      expect(shared.length).toBeGreaterThan(0);
      expect(shared.every((entry) => entry.idf > 0 && entry.dotContribution > 0)).toBe(true);
      expect(shared.some((entry) => entry.entityId === "urn:entity:artist-kim-gordon")).toBe(true);
      expect(shared.some((entry) => entry.entityId === "urn:entity:brand-la-colombe")).toBe(true);
      expect(shared.every((entry) => typeof entry.name === "string" && entry.name.trim() !== "")).toBe(true);
      expect(shared.find((entry) => entry.entityId === "urn:entity:artist-kim-gordon")?.name).toBe("Kim Gordon");
      expect(shared.find((entry) => entry.entityId === "urn:entity:brand-la-colombe")?.name).toBe("La Colombe");

      const evidence = await fixture.store.listEvidence(fixture.runId);
      expect(evidence.length).toBe(fixture.gatewayCalls);
      expect(evidence.every((record) => record.ledgerEventId.length > 0)).toBe(true);
      const ledger = await fixture.store.listLedgerEvents(fixture.runId);
      const ledgerIds = new Set(ledger.map((entry) => entry.id));
      expect(evidence.every((record) => ledgerIds.has(record.ledgerEventId))).toBe(true);
      expect(ledger.map((entry) => entry.event.label)).toContain("measure.graph");
      expect(ledger.map((entry) => entry.event.label)).toContain("measure.triangulate");

      const compositions = run.compositions as {
        family: { poolSize: number; size: number; totalCandidates: number; totalValid: number };
        ranked: RankedComposition[];
        triangulation: Array<{ a: string; b: string; state: string }>;
        prior: { state: string; percentile?: number | null };
      };
      expect(compositions.family.poolSize).toBe(8);
      expect(compositions.family.size).toBe(5);
      expect(compositions.family.totalCandidates).toBe(56);
      expect(compositions.family.totalValid).toBe(50);
      expect(compositions.ranked.length).toBe(50);
      for (const entry of compositions.ranked.slice(0, 5)) {
        expect(entry.members.length).toBe(5);
        expect(entry.coherence).toBeGreaterThan(0);
        expect(entry.percentile).toBeGreaterThanOrEqual(0);
        expect(entry.percentile).toBeLessThanOrEqual(100);
        expect(entry.distinctivenessMean).toBeGreaterThanOrEqual(0);
        expect(["A", "B", "C"]).toContain(entry.grade);
        expect(entry.gradeReasons.length).toBeGreaterThan(0);
      }
      expect(compositions.triangulation.length).toBeGreaterThan(0);
      expect(
        compositions.triangulation.every((entry) => ["confirmed", "contested", "thin", "failed"].includes(entry.state))
      ).toBe(true);
      expect(
        ["confirmed", "contested", "thin"].some((state) =>
          compositions.triangulation.some((entry) => entry.state === state)
        )
      ).toBe(true);
      expect(compositions.prior.state).toBe("measured");
      expect(compositions.prior.percentile).not.toBeNull();

      const runEvidence = run.evidence as Array<{ id: string; kind: string; summary: string }>;
      expect(runEvidence.length).toBe(fixture.gatewayCalls);
      expect(runEvidence.some((record) => record.kind === "insights")).toBe(true);
      expect(runEvidence.every((record) => record.summary.length > 0)).toBe(true);

      expect(fixture.gatewayCalls).toBeLessThanOrEqual(180);
    } finally {
      await fixture.close();
    }
  });

  it("replaces a member through the keyed HTTP route with zero Qloo calls and persists the revision", async () => {
    const { fixture, run } = await createMeasuredRun();
    try {
      const beforeCalls = fixture.gatewayCalls;
      const compositions = run.compositions as { ranked: RankedComposition[] };
      const target = compositions.ranked[0];
      expect(target.members.length).toBe(5);
      const compositionKey = target.members.join("+");
      const targetMember = target.members.includes("comp-court-tree") ? "comp-court-tree" : target.members[0];

      const response = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}/replace`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetComponentId: targetMember, candidateId: "comp-devocion", compositionKey })
      });
      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      const parsed = replaceResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (!parsed.success) {
        throw new Error("replace response failed schema validation");
      }
      const { run: replaced, delta, weakestLink } = parsed.data;
      expect(delta.coherence).toBeGreaterThanOrEqual(-1);
      expect(delta.coherence).toBeLessThanOrEqual(1);
      expect(delta.distinctiveness).toBeGreaterThanOrEqual(-1);
      expect(delta.distinctiveness).toBeLessThanOrEqual(1);
      expect(typeof weakestLink.a).toBe("string");
      expect(typeof weakestLink.b).toBe("string");
      expect(weakestLink.a.length).toBeGreaterThan(0);
      expect(weakestLink.b.length).toBeGreaterThan(0);
      expect(weakestLink.a).not.toBe(weakestLink.b);
      expect(weakestLink.value).toBeGreaterThanOrEqual(0);
      expect(weakestLink.value).toBeLessThanOrEqual(1);

      expect(fixture.gatewayCalls).toBe(beforeCalls);
      expect(replaced.status).toBe("complete");
      expect((replaced.graph as { nodes: string[] }).nodes.length).toBe(8);

      const revisions = replaced.revisions as Array<{
        rev: number;
        replacedMember: string;
        newMember: string;
        role: string;
        membersBefore: string[];
        membersAfter: string[];
      }>;
      expect(revisions.length).toBe(1);
      expect(revisions[0].rev).toBe(1);
      expect(revisions[0].replacedMember).toBe(targetMember);
      expect(revisions[0].newMember).toBe("comp-devocion");
      expect(revisions[0].role).toBe("Anchor");
      expect(revisions[0].membersBefore).toEqual(target.members);
      expect(revisions[0].membersAfter).not.toContain(targetMember);
      expect(revisions[0].membersAfter).toContain("comp-devocion");
      expect(revisions[0].membersAfter).toContain(weakestLink.a);
      expect(revisions[0].membersAfter).toContain(weakestLink.b);

      const stress = replaced.stressReport as { kind?: string; verdict?: string } | undefined;
      expect(stress?.kind).toBe("mini");
      expect(["Survived", "Revised"]).toContain(String(stress?.verdict));

      const after = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}`);
      const afterBody = (await after.json()) as { run: { revisions?: unknown[] } };
      expect(afterBody.run.revisions?.length).toBe(1);
      expect(fixture.gatewayCalls).toBe(beforeCalls);
    } finally {
      await fixture.close();
    }
  });

  it("produces an identical graph and ranking across two independent fixture runs", async () => {
    const first = await createMeasuredRun();
    const second = await createMeasuredRun();
    try {
      expect(second.run.graph).toEqual(first.run.graph);
      expect(second.run.compositions).toEqual(first.run.compositions);
      expect(second.run.culturalDna).toEqual(first.run.culturalDna);
      expect(first.fixture.gatewayCalls).toBe(second.fixture.gatewayCalls);
      expect(first.fixture.gatewayCalls).toBeLessThanOrEqual(180);
    } finally {
      await first.fixture.close();
      await second.fixture.close();
    }
  });

  it("challenges then builds a blueprint whose narrative cites stored evidence and strips the invented id", async () => {
    const fixture = await startJudgeFixtureServer({
      labelLlmResponses: {
        "challenge.attack_order": [judgeChallengeAndCompose],
        "blueprint:compose": [judgeChallengeAndCompose]
      }
    });
    try {
      const challengeResponse = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}/challenge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      expect(challengeResponse.status).toBe(200);
      const challengeBody: unknown = await challengeResponse.json();
      const challenge = challengeResponseSchema.safeParse(challengeBody);
      expect(challenge.success).toBe(true);
      if (!challenge.success) {
        throw new Error("challenge response failed schema validation");
      }
      const { report } = challenge.data;
      expect(report.attackOrderSource).toBe("llm");
      expect(report.attackOrder).toEqual([...JUDGE_ATTACK_ORDER]);
      expect(new Set(report.attacks.map((attack) => attack.kind))).toEqual(
        new Set(["ablation", "substitution", "bridge", "catchment", "rival"])
      );
      expect(report.attacks.every((attack) => attack.detail.length > 0)).toBe(true);
      expect(report.verdict).toBe("Revised");
      expect(report.gradeCap).toBe("A");
      expect(report.attacks.map((attack) => attack.status)).toEqual([
        "measured",
        "skipped",
        "skipped",
        "measured",
        "measured"
      ]);

      const blueprintResponse = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}/blueprint`);
      expect(blueprintResponse.status).toBe(200);
      const blueprintBody: unknown = await blueprintResponse.json();
      const blueprint = blueprintResponseSchema.safeParse(blueprintBody);
      expect(blueprint.success).toBe(true);
      if (!blueprint.success) {
        throw new Error("blueprint response failed schema validation");
      }
      const { blueprint: document } = blueprint.data;
      expect(document.narrativeSource).toBe("llm");
      expect(document.title).toBe(JUDGE_COMPOSE_TITLE);
      expect(document.rationale).not.toContain(JUDGE_INVENTED_CITATION);
      const cited = [...document.rationale.matchAll(/\[([^[\]]{1,100})\]/g)].map((match) => match[1] ?? "");
      expect(cited.length).toBeGreaterThanOrEqual(1);
      const stored = new Set((await fixture.store.listEvidence(fixture.runId)).map((record) => record.id));
      for (const id of cited) {
        expect(stored.has(id)).toBe(true);
      }
      expect(document.evidenceGrade.rule.length).toBeGreaterThan(0);
      expect(document.evidenceGrade.grade === "A" || document.evidenceGrade.grade === "B").toBe(true);
      expect(document.methodUrl).toBe("/method");
      expect(document.shareUrl).toContain(`/run/${fixture.runId}/blueprint?share=`);
      expect(document.expiresAt.length).toBeGreaterThan(0);
    } finally {
      await fixture.close();
    }
  });
});

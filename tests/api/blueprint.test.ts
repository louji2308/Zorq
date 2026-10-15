import { describe, expect, it } from "vitest";
import { apiErrorBodySchema } from "../../src/shared/errors.js";
import { blueprintResponseSchema, runResponseSchema, type Blueprint } from "../../src/shared/routes.js";
import { poolComponentRoles } from "../../src/shared/run.js";
import { TEST_NOW } from "../agent/support/fakes.js";
import { startJudgeFixtureServer, type JudgeFixtureServer, type JudgeLlmResponse } from "../support/judgePipeline.js";

const blueprintNarration: JudgeLlmResponse = (request) => {
  const text = request.messages
    .map((message) => (typeof message.content === "string" ? message.content : ""))
    .join("\n");
  const cited = text.match(/"allowedEvidenceIds":\["([^"]+)"/)?.[1] ?? "missing-evidence-id";
  return {
    content: JSON.stringify({
      title: "The Measured Corner",
      rationale: `Coffee, jazz and film hold the corner together [${cited}] while a rooftop edge stays thin [ghost-id-not-real].`
    })
  };
};

async function readBlueprint(
  fixture: JudgeFixtureServer,
  query = ""
): Promise<{ status: number; blueprint: Blueprint }> {
  const response = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}/blueprint${query}`);
  const body: unknown = await response.json();
  if (response.status !== 200) {
    return { status: response.status, blueprint: body as unknown as Blueprint };
  }
  const parsed = blueprintResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`blueprint response failed schema validation: ${parsed.error.message}`);
  }
  return { status: 200, blueprint: parsed.data.blueprint };
}

function collectCitationIds(blueprint: Blueprint): string[] {
  const ids: string[] = [];
  for (const group of blueprint.compositionByRole) {
    for (const member of group.members) {
      for (const receipt of member.receipts) {
        ids.push(...receipt.evidenceIds);
      }
    }
  }
  for (const key of ["kept", "added", "removed", "reformatted"] as const) {
    for (const item of blueprint.whatQlooChanged[key]) {
      ids.push(...item.evidenceIds);
    }
  }
  for (const risk of blueprint.risks) {
    ids.push(...risk.evidenceIds);
  }
  return ids;
}

async function fixtureWithNarration(count = 1): Promise<JudgeFixtureServer> {
  return startJudgeFixtureServer({
    extraLlmResponses: Array.from({ length: count }, () => blueprintNarration)
  });
}

describe("S5 Place Blueprint over real HTTP (scripted LLM + fake gateway)", () => {
  it("serves an evidence-bound blueprint whose every citation resolves to a stored evidence record", async () => {
    const fixture = await fixtureWithNarration();
    try {
      const storedIds = new Set(
        (await fixture.store.listEvidence(fixture.runId)).map((record) => record.id)
      );
      expect(storedIds.size).toBeGreaterThan(0);

      const { status, blueprint } = await readBlueprint(fixture);
      expect(status).toBe(200);
      expect(blueprint.narrativeSource).toBe("llm");
      expect(blueprint.title).toBe("The Measured Corner");
      expect(blueprint.rationale).not.toContain("ghost-id-not-real");

      const narrativeCitations = [...blueprint.rationale.matchAll(/\[([^[\]]{1,100})\]/g)].map(
        (match) => match[1] ?? ""
      );
      expect(narrativeCitations.length).toBeGreaterThanOrEqual(1);
      for (const id of narrativeCitations) {
        expect(storedIds.has(id)).toBe(true);
      }
      for (const id of collectCitationIds(blueprint)) {
        expect(storedIds.has(id)).toBe(true);
      }

      const roleIndex = blueprint.compositionByRole.map((group) => poolComponentRoles.indexOf(group.role));
      expect(roleIndex.length).toBeGreaterThanOrEqual(1);
      expect(roleIndex).toEqual([...roleIndex].sort((left, right) => left - right));

      expect(blueprint.whatQlooChanged.removed.map((item) => item.member)).toContain("Devoción");
      expect(blueprint.whatQlooChanged.added.length).toBeGreaterThanOrEqual(1);
      expect(blueprint.revisionHistory).toHaveLength(0);

      const runResponse = await fetch(`${fixture.baseUrl}/api/runs/${fixture.runId}`);
      const runBody = runResponseSchema.safeParse(await runResponse.json());
      expect(runBody.success).toBe(true);
      if (!runBody.success) {
        throw new Error("run response failed schema validation");
      }
      const rankedTop = runBody.data.run.compositions?.ranked[0];
      expect(rankedTop).toBeDefined();
      expect(blueprint.evidenceGrade.grade).toBe(rankedTop?.grade);

      expect(Date.parse(blueprint.expiresAt) - Date.parse(blueprint.generatedAt)).toBe(
        30 * 24 * 60 * 60 * 1000
      );
      expect(blueprint.methodUrl).toBe("/method");
      expect(blueprint.shareUrl).toContain(`/run/${fixture.runId}/blueprint?share=`);

      const labels = (await fixture.store.listLedgerEvents(fixture.runId)).map(
        (entry) => entry.event.label
      );
      expect(labels.filter((label) => label === "blueprint.compose")).toHaveLength(1);
      expect(labels).toContain("blueprint:compose");
      expect(labels).not.toContain("blueprint.compose_fallback");
    } finally {
      await fixture.close();
    }
  });

  it("caches the composed snapshot so repeat reads are byte-stable and the narrative turn runs once", async () => {
    const fixture = await fixtureWithNarration();
    try {
      const first = await readBlueprint(fixture);
      expect(first.status).toBe(200);
      const second = await readBlueprint(fixture);
      expect(second.status).toBe(200);
      expect(JSON.stringify(second.blueprint)).toBe(JSON.stringify(first.blueprint));

      const labels = (await fixture.store.listLedgerEvents(fixture.runId)).map(
        (entry) => entry.event.label
      );
      expect(labels.filter((label) => label === "blueprint.compose")).toHaveLength(1);
      expect(labels.filter((label) => label === "blueprint:compose")).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  it("serves share links read-only, fails unknown links as 404 and expired snapshots as 410, then rebuilds honestly", async () => {
    const fixture = await fixtureWithNarration(2);
    try {
      const owner = await readBlueprint(fixture);
      expect(owner.status).toBe(200);
      const shareUrl = new URL(owner.blueprint.shareUrl, fixture.baseUrl);
      const token = shareUrl.searchParams.get("share");
      expect(token).not.toBeNull();

      const shared = await readBlueprint(fixture, `?share=${encodeURIComponent(token ?? "")}`);
      expect(shared.status).toBe(200);
      expect(JSON.stringify(shared.blueprint)).toBe(JSON.stringify(owner.blueprint));

      const composeCount = async (): Promise<number> => {
        const labels = (await fixture.store.listLedgerEvents(fixture.runId)).map(
          (entry) => entry.event.label
        );
        return labels.filter((label) => label === "blueprint.compose").length;
      };
      expect(await composeCount()).toBe(1);

      const unknown = await fetch(
        `${fixture.baseUrl}/api/runs/${fixture.runId}/blueprint?share=not-a-real-token`
      );
      expect(unknown.status).toBe(404);
      const unknownBody = apiErrorBodySchema.safeParse(await unknown.json());
      expect(unknownBody.success).toBe(true);
      if (unknownBody.success) {
        expect(unknownBody.data.error.code).toBe("RUN_NOT_FOUND");
      }

      const snapshot = await fixture.store.findBlueprintSnapshot(fixture.runId);
      expect(snapshot).not.toBeNull();
      if (snapshot === null) {
        return;
      }
      await fixture.store.saveBlueprintSnapshot({
        ...snapshot,
        createdAt: new Date(TEST_NOW - 60 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(TEST_NOW - 60 * 1000).toISOString()
      });

      const expired = await fetch(
        `${fixture.baseUrl}/api/runs/${fixture.runId}/blueprint?share=${encodeURIComponent(token ?? "")}`
      );
      expect(expired.status).toBe(410);
      const expiredBody = apiErrorBodySchema.safeParse(await expired.json());
      expect(expiredBody.success).toBe(true);
      if (expiredBody.success) {
        expect(expiredBody.data.error.code).toBe("SNAPSHOT_EXPIRED");
      }

      const rebuilt = await readBlueprint(fixture);
      expect(rebuilt.status).toBe(200);
      expect(rebuilt.blueprint.narrativeSource).toBe("llm");
      expect(rebuilt.blueprint.shareUrl).toContain(`share=${token}`);
      expect(await composeCount()).toBe(2);
    } finally {
      await fixture.close();
    }
  });

  it("answers an unknown run with 404 instead of inventing a blueprint", async () => {
    const fixture = await fixtureWithNarration();
    try {
      const response = await fetch(`${fixture.baseUrl}/api/runs/run_does_not_exist/blueprint`);
      expect(response.status).toBe(404);
      const body = apiErrorBodySchema.safeParse(await response.json());
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data.error.code).toBe("RUN_NOT_FOUND");
      }
    } finally {
      await fixture.close();
    }
  });
});

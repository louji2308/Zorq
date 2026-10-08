import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";
import { createQlooGateway, type QlooGateway } from "../../src/server/qloo/gateway.js";
import { runInvestigation } from "../../src/server/agent/index.js";
import { DEEPSEEK_MODEL } from "../../src/server/agent/llm.js";
import { fakeLlm, TEST_BRIEF } from "../agent/support/fakes.js";

const enabled = process.env.LIVE_QLOO === "1" && Boolean(process.env.QLOO_API_KEY);

describe.skipIf(!enabled)(
  "Phase 3 exit gate against a live Qloo gateway (LIVE_QLOO=1; LLM scripted — real DeepSeek deferred until balance)",
  () => {
    let gateway: QlooGateway | undefined;

    function liveGateway(): QlooGateway {
      if (gateway === undefined) {
        const config = loadConfig({
          ...process.env,
          NODE_ENV: process.env.NODE_ENV ?? "test",
          APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000"
        });
        gateway = createQlooGateway({ config });
      }
      return gateway;
    }

    afterAll(async () => {
      await gateway?.close();
    });

    it(
      "real brief → persisted LLM-only Prior → real Qloo observation → validated mutation → ledger event → evidence record",
      async () => {
        const priorDraft = {
          composition: {
            thesis: "Daytime cultural corner anchored by coffee and film",
            members: [{ role: "Anchor", name: "Coffee roastery", why: "matches morning footfall" }]
          },
          rationale: "Grounded only in the brief; no external data consulted."
        };
        const llm = fakeLlm([
          { content: JSON.stringify(priorDraft) },
          {
            toolCalls: [
              {
                id: "call_exit_gate_1",
                name: "qloo_search",
                arguments: JSON.stringify({ query: "coffee", types: ["place"], take: 3 })
              }
            ]
          },
          { content: "Real Qloo evidence observed for coffee places near the site; nothing further needed." }
        ]);

        const result = await runInvestigation({
          brief: TEST_BRIEF,
          gateway: liveGateway(),
          llm: llm.client
        });

        expect(result.error).toBeUndefined();
        expect(result.stopReason).toBe("llm_final");

        expect(result.prior).toBeDefined();
        expect(result.prior?.qlooUsed).toBe(false);
        expect(result.prior?.model).toBe(DEEPSEEK_MODEL);
        expect(Object.isFrozen(result.prior)).toBe(true);
        expect(result.run.prior).toBe(result.prior);

        expect(result.run.status).toBe("complete");
        expect(result.run.phase).toBe("investigation");

        expect(result.observations).toBeGreaterThanOrEqual(1);
        expect(result.turns).toBe(2);

        const kinds = result.ledger.map((entry) => entry.event.kind);
        expect(kinds).toEqual(["LLM", "LLM", "Qloo", "LLM"]);

        const qlooEntry = result.ledger.find((entry) => entry.event.kind === "Qloo");
        expect(qlooEntry).toBeDefined();

        expect(result.evidence.length).toBeGreaterThanOrEqual(1);
        const evidence = result.evidence[0];
        expect(evidence).toBeDefined();
        expect(evidence?.ledgerEventId).toBe(qlooEntry?.id);
        expect(["mcp", "rest"]).toContain(evidence?.provenance.transport);
        expect(evidence?.provenance.endpoint.length).toBeGreaterThan(0);
        expect(evidence?.provenance.durationMs).toBeGreaterThanOrEqual(0);
        expect(evidence?.provenance.cacheState).toMatch(/live|cached/);
        expect(evidence?.provenance.resultCount).toBeGreaterThanOrEqual(1);
        expect(evidence?.provenance.operation).toBe("search");
      },
      180_000
    );
  }
);

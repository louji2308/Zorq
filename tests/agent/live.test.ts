import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";
import { ApiError } from "../../src/shared/errors.js";
import { LlmBudget } from "../../src/server/agent/budget.js";
import { createDeepSeekLlmClient } from "../../src/server/agent/llm.js";
import { createLedger } from "../../src/server/agent/ledger.js";
import { generatePrior } from "../../src/server/agent/prior.js";
import { TEST_BRIEF } from "./support/fakes.js";

const enabled = process.env.LIVE_DEEPSEEK === "1" && Boolean(process.env.DEEPSEEK_API_KEY);

describe.skipIf(!enabled)("live DeepSeek prior (LIVE_DEEPSEEK=1 with DEEPSEEK_API_KEY set)", () => {
  it("generates a real Prior or surfaces a typed DeepSeek failure", async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? "test",
      APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000"
    });
    const llm = createDeepSeekLlmClient({ apiKey: config.deepseekApiKey });
    const budget = new LlmBudget({ ceilingUsd: config.llmBudgetUsd });
    const ledger = createLedger();

    const outcome = await generatePrior({ brief: TEST_BRIEF, llm, budget, ledger }).then(
      (prior) => ({ kind: "ok" as const, prior }),
      (error: unknown) => ({ kind: "error" as const, error })
    );

    if (outcome.kind === "error") {
      expect(outcome.error).toBeInstanceOf(ApiError);
      const apiError = outcome.error as ApiError;
      expect(["DEPENDENCY_UNAVAILABLE", "SERVICE_UNAVAILABLE", "RATE_LIMITED"]).toContain(apiError.code);
      const key = config.deepseekApiKey ?? "";
      if (key.length >= 8) {
        expect(apiError.message.includes(key)).toBe(false);
      }
      return;
    }

    const prior = outcome.prior;
    expect(prior.qlooUsed).toBe(false);
    expect(prior.model).toBe("deepseek-flash");
    expect(Object.keys(prior.composition as Record<string, unknown>).length).toBeGreaterThan(0);
    expect(budget.spentUsd).toBeGreaterThan(0);
    expect(ledger.size()).toBe(1);
    expect(ledger.list()[0]?.event.kind).toBe("LLM");
    expect(ledger.list()[0]?.event.cacheState).toBe("n/a");
  }, 60_000);
});

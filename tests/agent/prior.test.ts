import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/shared/errors.js";
import { priorSchema, type Prior } from "../../src/shared/run.js";
import { LlmBudget } from "../../src/server/agent/budget.js";
import { LlmBudgetError, PriorConflictError, PriorGenerationError } from "../../src/server/agent/errors.js";
import { createDeepSeekLlmClient } from "../../src/server/agent/llm.js";
import { createLedger } from "../../src/server/agent/ledger.js";
import { generatePrior, persistPrior } from "../../src/server/agent/prior.js";
import { createInitialRun } from "../../src/server/agent/state.js";
import { TEST_BRIEF, TEST_NOW, TEST_PRIOR, fakeLlm } from "./support/fakes.js";

function context(responses: Parameters<typeof fakeLlm>[0]) {
  const llm = fakeLlm(responses);
  const budget = new LlmBudget({ ceilingUsd: 2, now: () => TEST_NOW });
  const ledger = createLedger();
  return { llm, budget, ledger };
}

const VALID_DRAFT = JSON.stringify({
  composition: {
    thesis: "daytime cultural corner",
    members: [{ role: "Anchor", name: "coffee roastery" }]
  },
  rationale: "grounded in the brief only"
});

describe("generatePrior", () => {
  it("produces a priorSchema-valid, LLM-only prior in one bounded call", async () => {
    const { llm, budget, ledger } = context([{ content: VALID_DRAFT }]);

    const prior = await generatePrior({
      brief: TEST_BRIEF,
      llm: llm.client,
      budget,
      ledger,
      now: () => TEST_NOW
    });

    expect(prior).toEqual({
      composition: { thesis: "daytime cultural corner", members: [{ role: "Anchor", name: "coffee roastery" }] },
      generatedAt: new Date(TEST_NOW).toISOString(),
      model: "deepseek-flash",
      qlooUsed: false
    });
    expect(priorSchema.parse(prior)).toEqual(prior);
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]?.label).toBe("prior:generate attempt 1");
    expect(llm.calls[0]?.messages[0]?.role).toBe("system");
    expect(budget.spentUsd).toBeGreaterThan(0);
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0]?.event.kind).toBe("LLM");
    expect(ledger.list()[0]?.event.cacheState).toBe("n/a");
  });

  it("enforces qlooUsed=false, model and clock even when the model echoes other values", async () => {
    const { llm, budget, ledger } = context([
      {
        content: JSON.stringify({
          composition: { thesis: "echo attempt" },
          qlooUsed: true,
          model: "some-other-model",
          generatedAt: "2000-01-01T00:00:00.000Z"
        })
      }
    ]);

    const prior = await generatePrior({
      brief: TEST_BRIEF,
      llm: llm.client,
      budget,
      ledger,
      now: () => TEST_NOW
    });

    expect(prior.qlooUsed).toBe(false);
    expect(prior.model).toBe("deepseek-flash");
    expect(prior.generatedAt).toBe(new Date(TEST_NOW).toISOString());
  });

  it("repairs malformed output once by re-asking with the validation error", async () => {
    const { llm, budget, ledger } = context([{ content: "this is not JSON" }, { content: VALID_DRAFT }]);

    const prior = await generatePrior({
      brief: TEST_BRIEF,
      llm: llm.client,
      budget,
      ledger,
      now: () => TEST_NOW
    });

    expect(prior.qlooUsed).toBe(false);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]?.label).toBe("prior:generate attempt 2");
    const repairTurn = llm.calls[1]?.messages.at(-1);
    expect(repairTurn?.role).toBe("user");
    expect(repairTurn && "content" in repairTurn ? repairTurn.content : "").toContain(
      "rejected by schema validation"
    );
    expect(ledger.list()).toHaveLength(2);
    expect(ledger.list().every((entry) => entry.event.kind === "LLM")).toBe(true);
  });

  it("fails with a typed error after a second malformed response and never fabricates a fallback", async () => {
    const { llm, budget, ledger } = context([{ content: "garbage" }, { content: '{"composition": {}}' }]);

    let caught: unknown;
    try {
      await generatePrior({ brief: TEST_BRIEF, llm: llm.client, budget, ledger, now: () => TEST_NOW });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PriorGenerationError);
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("DEPENDENCY_UNAVAILABLE");
    expect((caught as ApiError).message).toContain("composition must be a non-empty object");
    expect(llm.calls).toHaveLength(2);
    expect(ledger.list()).toHaveLength(2);
    expect(budget.spentUsd).toBeGreaterThan(0);
  });

  it("fails typed when the DeepSeek key is missing instead of crashing", async () => {
    const llm = createDeepSeekLlmClient({ apiKey: undefined });
    const budget = new LlmBudget({ ceilingUsd: 2, now: () => TEST_NOW });
    const ledger = createLedger();

    let caught: unknown;
    try {
      await generatePrior({ brief: TEST_BRIEF, llm, budget, ledger, now: () => TEST_NOW });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("SERVICE_UNAVAILABLE");
    expect(ledger.list()).toHaveLength(0);
    expect(budget.spentUsd).toBe(0);
  });

  it("propagates a typed budget refusal without calling the model", async () => {
    const { llm, ledger } = context([]);
    const exhausted = new LlmBudget({ ceilingUsd: 1, now: () => TEST_NOW });
    exhausted.charge({ promptTokens: 1_000_000, completionTokens: 500_000 });
    exhausted.charge({ promptTokens: 1_000_000, completionTokens: 500_000 });

    await expect(
      generatePrior({ brief: TEST_BRIEF, llm: llm.client, budget: exhausted, ledger, now: () => TEST_NOW })
    ).rejects.toBeInstanceOf(LlmBudgetError);
    expect(llm.calls).toHaveLength(0);
    expect(ledger.list()).toHaveLength(0);
  });
});

describe("persistPrior", () => {
  it("persists once, freezes the stored prior, and rejects any overwrite", () => {
    const run = createInitialRun(TEST_BRIEF);
    const prior: Prior = { ...TEST_PRIOR };

    const stored = persistPrior(run, prior);
    expect(run.prior).toBeUndefined();
    expect(stored.prior).toEqual(prior);
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.prior)).toBe(true);

    expect(Reflect.set(stored.prior as object, "qlooUsed", true)).toBe(false);
    expect(Reflect.set(stored.prior as object, "model", "other")).toBe(false);
    expect(stored.prior?.qlooUsed).toBe(false);
    expect(stored.prior?.model).toBe("deepseek-flash");

    const overwrite = { ...TEST_PRIOR, composition: { thesis: "second guess" } };
    expect(() => persistPrior(stored, overwrite)).toThrow(PriorConflictError);
    expect(stored.prior?.composition).toEqual(prior.composition);
    expect(priorSchema.parse(stored.prior)).toEqual(stored.prior);
  });

  it("rejects a prior that does not satisfy priorSchema", () => {
    const run = createInitialRun(TEST_BRIEF);
    expect(() =>
      persistPrior(run, { composition: {}, generatedAt: "", model: "deepseek-flash", qlooUsed: true } as unknown as Prior)
    ).toThrow();
    expect(run.prior).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  DEEPSEEK_FLASH_PRICING,
  LLM_SPEND_LIMIT_FRACTION,
  LlmBudget,
  isDeepSeekPeakWindow,
  usageCostUsd
} from "../../src/server/agent/budget.js";
import { LlmBudgetError } from "../../src/server/agent/errors.js";
import { LOCK_LLM_BUDGET_USD } from "../../src/server/config.js";

const OFF_PEAK = new Date("2026-10-08T12:00:00.000Z");
const PEAK_NIGHT = new Date("2026-10-08T02:00:00.000Z");
const PEAK_MORNING = new Date("2026-10-08T07:30:00.000Z");

function budgetWith(clockIso: string, ceilingUsd: number): LlmBudget {
  const at = Date.parse(clockIso);
  return new LlmBudget({ ceilingUsd, now: () => at });
}

describe("deepseek-flash pricing windows", () => {
  it("treats weekday 01:00-04:00 and 06:00-10:00 UTC as peak and everything else off-peak", () => {
    expect(isDeepSeekPeakWindow(new Date("2026-10-08T00:59:00Z"))).toBe(false);
    expect(isDeepSeekPeakWindow(new Date("2026-10-08T01:00:00Z"))).toBe(true);
    expect(isDeepSeekPeakWindow(new Date("2026-10-08T03:59:00Z"))).toBe(true);
    expect(isDeepSeekPeakWindow(new Date("2026-10-08T04:00:00Z"))).toBe(false);
    expect(isDeepSeekPeakWindow(new Date("2026-10-08T05:59:00Z"))).toBe(false);
    expect(isDeepSeekPeakWindow(new Date("2026-10-08T06:00:00Z"))).toBe(true);
    expect(isDeepSeekPeakWindow(new Date("2026-10-08T09:59:00Z"))).toBe(true);
    expect(isDeepSeekPeakWindow(new Date("2026-10-08T10:00:00Z"))).toBe(false);
    expect(isDeepSeekPeakWindow(new Date("2026-10-10T02:00:00Z"))).toBe(false);
    expect(isDeepSeekPeakWindow(new Date("2026-10-11T07:00:00Z"))).toBe(false);
  });

  it("reproduces the official illustrative off-peak economics", () => {
    expect(usageCostUsd({ promptTokens: 1_000_000, completionTokens: 500_000 }, OFF_PEAK)).toBe(0.45);
    expect(usageCostUsd({ promptTokens: 2_000_000, completionTokens: 1_000_000 }, OFF_PEAK)).toBe(0.9);
  });

  it("doubles the rate during peak windows", () => {
    expect(usageCostUsd({ promptTokens: 1_000_000, completionTokens: 500_000 }, PEAK_NIGHT)).toBe(0.9);
    expect(usageCostUsd({ promptTokens: 1_000_000, completionTokens: 500_000 }, PEAK_MORNING)).toBe(0.9);
    expect(DEEPSEEK_FLASH_PRICING.peak.inputCacheMissUsdPerMTok).toBe(
      DEEPSEEK_FLASH_PRICING.offPeak.inputCacheMissUsdPerMTok * 2
    );
  });

  it("prices the reported cached-token portion at the cache-hit rate and falls back conservatively", () => {
    const withCache = usageCostUsd(
      { promptTokens: 1_000_000, completionTokens: 200_000, cachedPromptTokens: 400_000 },
      OFF_PEAK
    );
    expect(withCache).toBeCloseTo(0.09 + 0.0012 + 0.12, 9);
    const withoutCache = usageCostUsd({ promptTokens: 1_000_000, completionTokens: 200_000 }, OFF_PEAK);
    expect(withoutCache).toBe(0.27);
    expect(withoutCache).toBeGreaterThan(withCache);
  });

  it("clamps nonsensical cached counts instead of under-charging", () => {
    const overReported = usageCostUsd(
      { promptTokens: 100, completionTokens: 0, cachedPromptTokens: 10_000 },
      OFF_PEAK
    );
    const allCached = usageCostUsd({ promptTokens: 100, completionTokens: 0, cachedPromptTokens: 100 }, OFF_PEAK);
    expect(overReported).toBe(allCached);
    expect(allCached).toBeLessThan(usageCostUsd({ promptTokens: 100, completionTokens: 0 }, OFF_PEAK));
  });
});

describe("LlmBudget", () => {
  it("locks the ceiling at the configured maximum even when a higher value is passed", () => {
    expect(new LlmBudget({ ceilingUsd: 5 }).ceilingUsd).toBe(LOCK_LLM_BUDGET_USD);
    expect(new LlmBudget({ ceilingUsd: 2 }).ceilingUsd).toBe(LOCK_LLM_BUDGET_USD);
    expect(new LlmBudget({ ceilingUsd: 0.5 }).ceilingUsd).toBe(0.5);
    expect(new LlmBudget({ ceilingUsd: -1 }).ceilingUsd).toBe(0);
  });

  it("accumulates charged usage against the ceiling", () => {
    const budget = budgetWith("2026-10-08T12:00:00.000Z", 1);
    const first = budget.charge({ promptTokens: 1_000_000, completionTokens: 500_000 });
    expect(first).toBe(0.45);
    budget.charge({ promptTokens: 1_000_000, completionTokens: 500_000 });
    expect(budget.spentUsd).toBe(0.9);
    expect(budget.remainingUsd).toBe(0.1);
    expect(budget.snapshot()).toMatchObject({ ceilingUsd: 1, spentUsd: 0.9, remainingUsd: 0.1 });
  });

  it("refuses non-essential calls at 80% while essential recovery calls continue", () => {
    expect(LLM_SPEND_LIMIT_FRACTION).toBe(0.8);
    const budget = budgetWith("2026-10-08T12:00:00.000Z", 1);
    budget.charge({ promptTokens: 1_000_000, completionTokens: 500_000 });
    budget.charge({ promptTokens: 1_000_000, completionTokens: 500_000 });
    expect(budget.spentFraction).toBeCloseTo(0.9, 6);

    let caught: unknown;
    try {
      budget.assertCanSpend({ essential: false });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LlmBudgetError);
    expect((caught as LlmBudgetError).code).toBe("LLM_BUDGET_RESERVE");
    expect((caught as LlmBudgetError).essential).toBe(false);
    expect(() => budget.assertCanSpend({ essential: true })).not.toThrow();
  });

  it("trips the reserve exactly at the 80% boundary", () => {
    const budget = budgetWith("2026-10-08T12:00:00.000Z", 0.5625);
    budget.charge({ promptTokens: 1_000_000, completionTokens: 500_000 });
    expect(budget.spentFraction).toBeCloseTo(0.8, 9);
    expect(() => budget.assertCanSpend({ essential: false })).toThrow(LlmBudgetError);
    expect(() => budget.assertCanSpend({ essential: true })).not.toThrow();
  });

  it("refuses every call, essential included, once the ceiling is reached", () => {
    const budget = budgetWith("2026-10-08T12:00:00.000Z", 1);
    budget.charge({ promptTokens: 1_000_000, completionTokens: 1_000_000 });
    budget.charge({ promptTokens: 1_000_000, completionTokens: 500_000 });
    expect(budget.spentUsd).toBeGreaterThan(1);

    for (const essential of [false, true]) {
      let caught: unknown;
      try {
        budget.assertCanSpend({ essential });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(LlmBudgetError);
      expect((caught as LlmBudgetError).code).toBe("LLM_BUDGET_CEILING");
      expect((caught as LlmBudgetError).essential).toBe(essential);
    }
  });

  it("refuses everything when the ceiling is zero", () => {
    const budget = budgetWith("2026-10-08T12:00:00.000Z", 0);
    expect(budget.spentFraction).toBe(1);
    expect(() => budget.assertCanSpend({ essential: true })).toThrow(LlmBudgetError);
  });
});

import { LOCK_LLM_BUDGET_USD } from "../config.js";
import { LlmBudgetError } from "./errors.js";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens?: number | undefined;
}

export interface DeepSeekFlashRate {
  inputCacheMissUsdPerMTok: number;
  inputCacheHitUsdPerMTok: number;
  outputUsdPerMTok: number;
}

export const DEEPSEEK_FLASH_PRICING: { peak: DeepSeekFlashRate; offPeak: DeepSeekFlashRate } = {
  peak: {
    inputCacheMissUsdPerMTok: 0.3,
    inputCacheHitUsdPerMTok: 0.006,
    outputUsdPerMTok: 1.2
  },
  offPeak: {
    inputCacheMissUsdPerMTok: 0.15,
    inputCacheHitUsdPerMTok: 0.003,
    outputUsdPerMTok: 0.6
  }
};

export const LLM_RESERVE_FRACTION = 0.2;
export const LLM_SPEND_LIMIT_FRACTION = 1 - LLM_RESERVE_FRACTION;

export function isDeepSeekPeakWindow(at: Date): boolean {
  const day = at.getUTCDay();
  if (day === 0 || day === 6) {
    return false;
  }
  const hour = at.getUTCHours();
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}

function roundUsd(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function usageCostUsd(usage: TokenUsage, at: Date): number {
  const rates = isDeepSeekPeakWindow(at) ? DEEPSEEK_FLASH_PRICING.peak : DEEPSEEK_FLASH_PRICING.offPeak;
  const prompt = Math.max(0, usage.promptTokens);
  const completion = Math.max(0, usage.completionTokens);
  const reportedCached = usage.cachedPromptTokens;
  const cached =
    reportedCached !== undefined && Number.isFinite(reportedCached)
      ? Math.min(Math.max(0, reportedCached), prompt)
      : 0;
  const miss = prompt - cached;
  const usd =
    (miss * rates.inputCacheMissUsdPerMTok +
      cached * rates.inputCacheHitUsdPerMTok +
      completion * rates.outputUsdPerMTok) /
    1_000_000;
  return roundUsd(usd);
}

export interface LlmBudgetOptions {
  ceilingUsd: number;
  now?: () => number;
}

export interface LlmBudgetSnapshot {
  ceilingUsd: number;
  spentUsd: number;
  remainingUsd: number;
  spentFraction: number;
}

export class LlmBudget {
  readonly ceilingUsd: number;
  readonly #now: () => number;
  #spentUsd = 0;

  constructor(options: LlmBudgetOptions) {
    this.ceilingUsd = Math.min(Math.max(0, options.ceilingUsd), LOCK_LLM_BUDGET_USD);
    this.#now = options.now ?? Date.now;
  }

  get spentUsd(): number {
    return this.#spentUsd;
  }

  get remainingUsd(): number {
    return roundUsd(Math.max(0, this.ceilingUsd - this.#spentUsd));
  }

  get spentFraction(): number {
    if (this.ceilingUsd <= 0) {
      return 1;
    }
    return this.#spentUsd / this.ceilingUsd;
  }

  assertCanSpend(options: { essential: boolean }): void {
    const fraction = this.spentFraction;
    const info = { spentUsd: this.#spentUsd, ceilingUsd: this.ceilingUsd, essential: options.essential };
    if (fraction >= 1) {
      throw new LlmBudgetError("LLM_BUDGET_CEILING", info);
    }
    if (!options.essential && fraction >= LLM_SPEND_LIMIT_FRACTION) {
      throw new LlmBudgetError("LLM_BUDGET_RESERVE", info);
    }
  }

  charge(usage: TokenUsage): number {
    const cost = usageCostUsd(usage, new Date(this.#now()));
    this.#spentUsd = roundUsd(this.#spentUsd + cost);
    return cost;
  }

  snapshot(): LlmBudgetSnapshot {
    return {
      ceilingUsd: this.ceilingUsd,
      spentUsd: this.spentUsd,
      remainingUsd: this.remainingUsd,
      spentFraction: this.spentFraction
    };
  }
}

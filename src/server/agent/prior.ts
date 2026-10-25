import { z } from "zod";
import { briefSchema, type Brief } from "../../shared/brief.js";
import { priorPolishTextSchema, priorSchema, type Prior, type RunState } from "../../shared/run.js";
import type { LlmBudget } from "./budget.js";
import { PriorConflictError, PriorGenerationError } from "./errors.js";
import { completeBounded, RAPIDROUTER_MODEL, formatZodIssues, type LlmClient, type LlmMessage } from "./llm.js";
import type { Ledger } from "./ledger.js";

export const MAX_PRIOR_ATTEMPTS = 2;

export const PRIOR_SYSTEM_PROMPT = [
  "You are the Prior model of Zorq, cultural composition intelligence for physical places.",
  "Zorq designs what should exist together on a physical site. You produce the frozen Prior:",
  "an evidence-free initial guess at the site's cultural composition, committed before any",
  "external cultural data is consulted. You have no measurements yet, so never present numbers",
  "as findings and never invent entities, statistics, or provenance.",
  'Respond with exactly one JSON object and no other text: {"composition": {...}, "rationale": "...", "polish": "..."}.',
  '"composition" must be a non-empty JSON object describing your proposed composition: a thesis',
  "plus members grouped by roles such as Anchor, Social, Discovery, Experience, Night, Community,",
  "each with a short rationale grounded only in the brief.",
  '"polish" must be one paragraph (max 1200 characters) presenting the same recommendation as a',
  "standalone statement for a reader who has no cultural evidence: what Zorq would advise for this",
  "site given the brief. No numbers, no invented entities, no evidence claims."
].join(" ");

const priorDraftSchema = z.object({
  composition: z
    .record(z.string(), z.unknown())
    .refine((value) => Object.keys(value).length > 0, { message: "composition must be a non-empty object" }),
  rationale: z.string().optional(),
  polish: z.unknown().optional()
});

export interface GeneratePriorOptions {
  brief: Brief;
  llm: LlmClient;
  budget: LlmBudget;
  ledger: Ledger;
  now?: () => number;
}

function parsePriorDraft(content: string | null): z.infer<typeof priorDraftSchema> {
  if (content === null || content.trim() === "") {
    throw new PriorGenerationError("Rapid Router returned an empty Prior response");
  }
  const trimmed = content.trim();
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
    if (fenced?.[1] !== undefined) {
      try {
        raw = JSON.parse(fenced[1]);
      } catch {
        throw new PriorGenerationError("Prior response was not valid JSON");
      }
    } else {
      throw new PriorGenerationError("Prior response was not valid JSON");
    }
  }
  return priorDraftSchema.parse(raw);
}

function normalizePolish(value: unknown, ledger: Ledger): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = priorPolishTextSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  ledger.append({
    kind: "Compute",
    label: "prior.polish_unavailable",
    summary:
      "the LLM-only polish failed validation; the Without-Qloo column will show the frozen Prior alone",
    duration: 0,
    cacheState: "n/a",
    resultCount: 0
  });
  return undefined;
}

export async function generatePrior(options: GeneratePriorOptions): Promise<Prior> {
  const brief = briefSchema.parse(options.brief);
  const now = options.now ?? Date.now;
  const messages: LlmMessage[] = [
    { role: "system", content: PRIOR_SYSTEM_PROMPT },
    { role: "user", content: `Brief:\n${JSON.stringify(brief)}` }
  ];
  let lastProblem = "unknown validation failure";

  for (let attempt = 1; attempt <= MAX_PRIOR_ATTEMPTS; attempt += 1) {
    const result = await completeBounded({
      llm: options.llm,
      budget: options.budget,
      ledger: options.ledger,
      request: {
        label: `prior:generate attempt ${attempt}`,
        messages: [...messages]
      }
    });
    try {
      const draft = parsePriorDraft(result.content);
      const polish = normalizePolish(draft.polish, options.ledger);
      const prior = priorSchema.parse({
        composition: draft.composition,
        generatedAt: new Date(now()).toISOString(),
        model: RAPIDROUTER_MODEL,
        qlooUsed: false,
        ...(polish !== undefined ? { polish } : {})
      });
      return prior;
    } catch (error) {
      lastProblem = error instanceof PriorGenerationError ? error.message : formatZodIssues(error);
      messages.push({ role: "assistant", content: result.content ?? "" });
      messages.push({
        role: "user",
        content:
          `Your Prior was rejected by schema validation: ${lastProblem}. ` +
          'Respond again with exactly one corrected JSON object: {"composition": {...}, "rationale": "..."} and nothing else.'
      });
    }
  }

  throw new PriorGenerationError(
    `Rapid Router produced an unusable Prior after ${MAX_PRIOR_ATTEMPTS} attempts: ${lastProblem}`,
    [{ path: "prior", message: lastProblem }]
  );
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Object.isFrozen(value)) {
    return;
  }
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

export function persistPrior(state: RunState, prior: Prior): RunState {
  if (state.prior !== undefined) {
    throw new PriorConflictError();
  }
  const validated = priorSchema.parse(prior);
  const next: RunState = { ...state, prior: validated };
  deepFreeze(next.prior);
  return Object.freeze(next);
}

import { z } from "zod";
import { briefSchema } from "./brief.js";

export const priorSchema = z.object({
  composition: z.unknown(),
  generatedAt: z.string(),
  model: z.string(),
  qlooUsed: z.literal(false)
});

export type Prior = z.infer<typeof priorSchema>;

export const runEvidenceNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1).optional(),
  label: z.string().optional(),
  summary: z.string().optional(),
  grade: z.string().optional()
});

export type RunEvidenceNode = z.infer<typeof runEvidenceNodeSchema>;

export const runStateSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  phase: z.string().min(1),
  brief: briefSchema.optional(),
  prior: priorSchema.optional(),
  evidence: z.array(runEvidenceNodeSchema).optional(),
  siteRead: z.unknown().optional(),
  culturalDna: z.unknown().optional(),
  candidatePool: z.unknown().optional(),
  neighborhoods: z.unknown().optional(),
  graph: z.unknown().optional(),
  compositions: z.unknown().optional(),
  stressReport: z.unknown().optional(),
  constraintFit: z.unknown().optional(),
  revisions: z.unknown().optional()
});

export type RunState = z.infer<typeof runStateSchema>;

export const runResponseSchema = z.object({
  run: runStateSchema
});

export type RunResponse = z.infer<typeof runResponseSchema>;

export const createdRunSchema = runStateSchema.extend({
  brief: briefSchema,
  prior: priorSchema
});

export const runIdParamsSchema = z.object({
  id: z.string().min(1)
});

export type RunIdParams = z.infer<typeof runIdParamsSchema>;

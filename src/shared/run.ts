import { z } from "zod";
import { briefSchema } from "./brief.js";

export const priorSchema = z.object({
  composition: z.unknown(),
  generatedAt: z.string(),
  model: z.string(),
  qlooUsed: z.literal(false)
});

export type Prior = z.infer<typeof priorSchema>;

export const runStateSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  phase: z.string().min(1),
  brief: briefSchema.optional(),
  prior: priorSchema.optional()
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

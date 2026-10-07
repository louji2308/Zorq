import { z } from "zod";
import { briefSchema } from "./brief.js";
import { eventsRequestSchema, sseFrameSchema } from "./events.js";
import { createdRunSchema, runIdParamsSchema, runResponseSchema, runStateSchema } from "./run.js";

export const healthzResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("zorq"),
  version: z.string(),
  checks: z.record(z.string(), z.string())
});

export type HealthzResponse = z.infer<typeof healthzResponseSchema>;

export const postRunsRequestSchema = briefSchema;

export const postRunsResponseSchema = z.object({
  run: createdRunSchema
});

export type PostRunsResponse = z.infer<typeof postRunsResponseSchema>;

export const getRunRequestSchema = z.object({
  params: runIdParamsSchema
});

export { eventsRequestSchema, sseFrameSchema };

export const stopRunRequestSchema = z.object({
  reason: z.string().max(200).optional()
});

export type StopRunRequest = z.infer<typeof stopRunRequestSchema>;

export const unpinAnchorRequestSchema = z.object({
  anchorId: z.string().min(1)
});

export type UnpinAnchorRequest = z.infer<typeof unpinAnchorRequestSchema>;

export const replaceRequestSchema = z
  .object({
    targetComponentId: z.string().min(1),
    candidateId: z.string().min(1).optional(),
    customQuery: z.string().min(1).optional()
  })
  .refine(
    (value) => (value.candidateId !== undefined) !== (value.customQuery !== undefined),
    "exactly one of candidateId or customQuery is required"
  );

export type ReplaceRequest = z.infer<typeof replaceRequestSchema>;

export const replaceResponseSchema = z.object({
  run: runStateSchema,
  delta: z.object({
    coherence: z.number(),
    distinctiveness: z.number()
  }),
  weakestLink: z.record(z.string(), z.unknown())
});

export type ReplaceResponse = z.infer<typeof replaceResponseSchema>;

export const attackKinds = ["ablation", "substitution", "bridge", "catchment", "rival"] as const;

export const attackKindSchema = z.enum(attackKinds);

export const challengeRequestSchema = z.object({
  focus: attackKindSchema.optional()
});

export type ChallengeRequest = z.infer<typeof challengeRequestSchema>;

export const challengeResponseSchema = z.object({
  runId: z.string().min(1),
  status: z.literal("running"),
  stress: z.object({
    attacks: z.array(
      z.object({
        kind: attackKindSchema,
        status: z.string().min(1)
      })
    )
  })
});

export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;

export const recomputeRequestSchema = z
  .object({
    changes: z.object({
      areaSqFt: z.number().optional(),
      objective: z.string().max(200).optional(),
      constraints: z.array(z.string()).optional()
    })
  })
  .refine(
    (value) =>
      value.changes.areaSqFt !== undefined ||
      value.changes.objective !== undefined ||
      value.changes.constraints !== undefined,
    "at least one change is required"
  );

export type RecomputeRequest = z.infer<typeof recomputeRequestSchema>;

export const recomputeResponseSchema = z.object({
  run: runStateSchema,
  priorUnchanged: z.literal(true)
});

export type RecomputeResponse = z.infer<typeof recomputeResponseSchema>;

export const blueprintQuerySchema = z.object({
  snapshot: z.string().optional(),
  share: z.string().optional()
});

export type BlueprintQuery = z.infer<typeof blueprintQuerySchema>;

export const blueprintSchema = z.object({
  title: z.string(),
  rationale: z.string(),
  compositionByRole: z.array(z.unknown()),
  fitToSite: z.object({
    footprint: z.unknown(),
    hours: z.unknown(),
    downshifts: z.unknown()
  }),
  whatQlooChanged: z.object({
    kept: z.array(z.unknown()),
    added: z.array(z.unknown()),
    removed: z.array(z.unknown()),
    reformatted: z.array(z.unknown())
  }),
  risks: z.array(z.unknown()),
  evidenceGrade: z.string(),
  revisionHistory: z.array(z.unknown()),
  methodUrl: z.string(),
  shareUrl: z.string(),
  generatedAt: z.string(),
  expiresAt: z.string()
});

export type Blueprint = z.infer<typeof blueprintSchema>;

export const blueprintResponseSchema = z.object({
  blueprint: blueprintSchema
});

export type BlueprintResponse = z.infer<typeof blueprintResponseSchema>;

export const methodResponseSchema = z.object({
  method: z.object({
    whatQlooMeasures: z.array(z.string()),
    whatZorqComputes: z.array(z.string()),
    whatTheLlmGenerates: z.array(z.string()),
    heuristics: z.array(z.record(z.string(), z.unknown())),
    formulas: z.array(z.string()),
    examples: z.array(z.string()),
    knownLimits: z.array(z.string()),
    setupSummary: z.string(),
    evidenceVsInference: z.unknown()
  })
});

export type MethodResponse = z.infer<typeof methodResponseSchema>;

export { runResponseSchema };

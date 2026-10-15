import { z } from "zod";
import { briefSchema } from "./brief.js";
import { eventsRequestSchema, sseFrameSchema } from "./events.js";
import {
  attackKindSchema,
  challengeReportSchema,
  createdRunSchema,
  poolComponentRoles,
  runIdParamsSchema,
  runResponseSchema,
  runStateSchema,
  runWeakestLinkSchema
} from "./run.js";

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
    customQuery: z.string().min(1).optional(),
    compositionKey: z.string().trim().min(1).max(300).optional()
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
  weakestLink: runWeakestLinkSchema
});

export type ReplaceResponse = z.infer<typeof replaceResponseSchema>;

export const challengeRequestSchema = z.object({
  focus: attackKindSchema.optional()
});

export type ChallengeRequest = z.infer<typeof challengeRequestSchema>;

export const challengeResponseSchema = z.object({
  run: runStateSchema,
  report: challengeReportSchema
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
  share: z.string().trim().min(1).max(200).optional()
});

export type BlueprintQuery = z.infer<typeof blueprintQuerySchema>;

export const blueprintRiskKinds = ["weakest-edge", "thin-component", "triangulation", "constraint-conflict"] as const;

export type BlueprintRiskKind = (typeof blueprintRiskKinds)[number];

export const blueprintConstraintKeys = ["lateNight", "quiet", "noLargeNightclub", "raw"] as const;

export type BlueprintConstraintKey = (typeof blueprintConstraintKeys)[number];

export const blueprintNoiseClasses = ["quiet", "moderate", "loud"] as const;

export type BlueprintNoiseClass = (typeof blueprintNoiseClasses)[number];

export const blueprintReceiptSchema = z.object({
  kind: z.enum(["path", "shared-entities"]),
  text: z.string().trim().min(1).max(300),
  evidenceIds: z.array(z.string().min(1)).max(6)
});

export type BlueprintReceipt = z.infer<typeof blueprintReceiptSchema>;

export const blueprintMemberFormatSchema = z.object({
  typeDisplayName: z.string().trim().min(1).max(80),
  formatName: z.string().trim().min(1).max(80),
  footprintSqFtMin: z.number().int().min(0),
  footprintSqFtMax: z.number().int().min(0),
  noiseClass: z.enum(blueprintNoiseClasses),
  open: z.string().trim().min(1).max(20),
  close: z.string().trim().min(1).max(20),
  downshiftedFrom: z.string().trim().min(1).max(80).nullable()
});

export type BlueprintMemberFormat = z.infer<typeof blueprintMemberFormatSchema>;

export const blueprintMemberSchema = z.object({
  memberId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  role: z.enum(poolComponentRoles),
  format: blueprintMemberFormatSchema.optional(),
  receipts: z.array(blueprintReceiptSchema).max(3)
});

export type BlueprintMember = z.infer<typeof blueprintMemberSchema>;

export const blueprintRoleGroupSchema = z.object({
  role: z.enum(poolComponentRoles),
  members: z.array(blueprintMemberSchema).min(1)
});

export type BlueprintRoleGroup = z.infer<typeof blueprintRoleGroupSchema>;

export const blueprintDiffItemSchema = z.object({
  member: z.string().trim().min(1).max(200),
  role: z.enum(poolComponentRoles).optional(),
  evidenceIds: z.array(z.string().min(1)).max(6)
});

export type BlueprintDiffItem = z.infer<typeof blueprintDiffItemSchema>;

export const blueprintRiskSchema = z.object({
  kind: z.enum(blueprintRiskKinds),
  text: z.string().trim().min(1).max(300),
  evidenceIds: z.array(z.string().min(1)).max(6)
});

export type BlueprintRisk = z.infer<typeof blueprintRiskSchema>;

export const blueprintSchema = z.object({
  title: z.string().trim().min(1).max(200),
  rationale: z.string().trim().min(1).max(1200),
  narrativeSource: z.enum(["llm", "deterministic"]),
  compositionByRole: z.array(blueprintRoleGroupSchema).min(1).max(6),
  fitToSite: z.object({
    footprint: z.object({
      areaSqFt: z.number().finite().nullable(),
      usableSqFt: z.number().finite().nullable(),
      totalFootprintSqFt: z.number().finite().nullable(),
      withinUsable: z.boolean(),
      rule: z.string().trim().min(1).max(200)
    }),
    hours: z.object({
      timeline: z
        .array(
          z.object({
            memberId: z.string().trim().min(1).max(200),
            name: z.string().trim().min(1).max(200),
            open: z.string().trim().min(1).max(20),
            close: z.string().trim().min(1).max(20)
          })
        )
        .max(10),
      constraintReads: z
        .array(
          z.object({
            key: z.enum(blueprintConstraintKeys),
            source: z.string().trim().min(1).max(200)
          })
        )
        .max(12)
    }),
    downshifts: z
      .array(
        z.object({
          memberId: z.string().trim().min(1).max(200),
          name: z.string().trim().min(1).max(200),
          sentence: z.string().trim().min(1).max(300)
        })
      )
      .max(10)
  }),
  whatQlooChanged: z.object({
    kept: z.array(blueprintDiffItemSchema).max(20),
    added: z.array(blueprintDiffItemSchema).max(20),
    removed: z.array(blueprintDiffItemSchema).max(20),
    reformatted: z.array(blueprintDiffItemSchema).max(20)
  }),
  risks: z.array(blueprintRiskSchema).max(20),
  evidenceGrade: z.object({
    grade: z.enum(["A", "B", "C"]),
    reasons: z.array(z.string().trim().min(1).max(200)).max(30),
    rule: z.string().trim().min(1).max(300)
  }),
  revisionHistory: z
    .array(
      z.object({
        rev: z.number().int().min(1),
        replacedMember: z.string().trim().min(1).max(200),
        newMember: z.string().trim().min(1).max(200),
        role: z.enum(poolComponentRoles),
        coherenceBefore: z.number().finite().min(0).max(1),
        coherenceAfter: z.number().finite().min(0).max(1),
        custom: z.boolean()
      })
    )
    .max(100),
  methodUrl: z.string().trim().min(1).max(300),
  shareUrl: z.string().trim().min(1).max(500),
  generatedAt: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1)
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

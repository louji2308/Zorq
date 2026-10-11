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

export const siteAnchorLetters = ["A", "B", "C", "D", "E"] as const;

export type SiteAnchorLetter = (typeof siteAnchorLetters)[number];

export const siteAnchorSchema = z.strictObject({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  letter: z.enum(siteAnchorLetters),
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  evidenceId: z.string().min(1)
});

export type SiteAnchor = z.infer<typeof siteAnchorSchema>;

export const siteHeatCellSchema = z.strictObject({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  weight: z.number().finite().min(0).max(100)
});

export type SiteHeatCell = z.infer<typeof siteHeatCellSchema>;

export const siteReadSchema = z.strictObject({
  anchors: z.array(siteAnchorSchema).max(5).optional(),
  heat: z.array(siteHeatCellSchema).max(200).optional()
});

export type SiteRead = z.infer<typeof siteReadSchema>;

export const culturalDnaEntitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  local: z.number().finite().min(0).max(100),
  city: z.number().finite().min(0).max(100)
});

export type CulturalDnaEntity = z.infer<typeof culturalDnaEntitySchema>;

export const culturalDnaSchema = z.object({
  artists: z.array(culturalDnaEntitySchema).max(30).optional(),
  films: z.array(culturalDnaEntitySchema).max(30).optional(),
  brands: z.array(culturalDnaEntitySchema).max(30).optional()
});

export type CulturalDna = z.infer<typeof culturalDnaSchema>;

export const poolComponentRoles = [
  "Anchor",
  "Social",
  "Discovery",
  "Experience",
  "Night",
  "Community"
] as const;

export type PoolComponentRole = (typeof poolComponentRoles)[number];

export const poolComponentEvidenceStates = [
  "measured",
  "not measured",
  "incomplete",
  "unavailable"
] as const;

export type PoolComponentEvidenceState = (typeof poolComponentEvidenceStates)[number];

export const poolExemplarSchema = z.strictObject({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200)
});

export type PoolExemplar = z.infer<typeof poolExemplarSchema>;

export const poolProvenancePathSchema = z.strictObject({
  anchorPlace: z.string().trim().min(1).max(300),
  qlooSignal: z.string().trim().min(1).max(300),
  resolvedCategory: z.string().trim().min(1).max(300),
  exemplarSet: z.string().trim().min(1).max(300),
  tasteNeighborhood: z.string().trim().min(1).max(300)
});

export type PoolProvenancePath = z.infer<typeof poolProvenancePathSchema>;

export const poolComponentSchema = z.strictObject({
  id: z.string().trim().min(1).max(200),
  role: z.enum(poolComponentRoles),
  tags: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
  exemplars: z.array(poolExemplarSchema).min(1).max(5),
  provenancePath: poolProvenancePathSchema,
  evidenceState: z.enum(poolComponentEvidenceStates)
});

export type PoolComponent = z.infer<typeof poolComponentSchema>;

export const candidatePoolSchema = z.array(poolComponentSchema);

export type CandidatePool = z.infer<typeof candidatePoolSchema>;

export const runStateSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  phase: z.string().min(1),
  brief: briefSchema.optional(),
  prior: priorSchema.optional(),
  evidence: z.array(runEvidenceNodeSchema).optional(),
  siteRead: siteReadSchema.optional(),
  culturalDna: culturalDnaSchema.optional(),
  candidatePool: candidatePoolSchema.optional(),
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

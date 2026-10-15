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

export const runRevisionSchema = z.strictObject({
  rev: z.number().int().min(1),
  replacedMember: z.string().trim().min(1).max(200),
  newMember: z.string().trim().min(1).max(200),
  role: z.enum(poolComponentRoles),
  membersBefore: z.array(z.string().trim().min(1).max(200)).min(2),
  membersAfter: z.array(z.string().trim().min(1).max(200)).min(2),
  coherenceBefore: z.number().finite().min(0).max(1),
  coherenceAfter: z.number().finite().min(0).max(1),
  percentileBefore: z.number().finite().min(0).max(100).nullable(),
  percentileAfter: z.number().finite().min(0).max(100).nullable(),
  custom: z.boolean()
});

export type RunRevision = z.infer<typeof runRevisionSchema>;

export const runNeighborhoodDomains = ["artist", "movie", "brand"] as const;

export type RunNeighborhoodDomain = (typeof runNeighborhoodDomains)[number];

export const runNeighborhoodScopes = ["site", "city"] as const;

export type RunNeighborhoodScope = (typeof runNeighborhoodScopes)[number];

export const runNeighborhoodStates = ["measured", "not measured", "incomplete"] as const;

export type RunNeighborhoodState = (typeof runNeighborhoodStates)[number];

export const runNeighborhoodEntrySchema = z.strictObject({
  entityId: z.string().trim().min(1).max(200),
  rank: z.number().int().min(1),
  weight: z.number().finite().positive(),
  affinityUsed: z.boolean(),
  name: z.string().trim().min(1).max(200).optional()
});

export type RunNeighborhoodEntry = z.infer<typeof runNeighborhoodEntrySchema>;

export const runTasteNeighborhoodSchema = z.strictObject({
  componentId: z.string().trim().min(1).max(200),
  domains: z.strictObject({
    artist: z.array(runNeighborhoodEntrySchema).max(30),
    movie: z.array(runNeighborhoodEntrySchema).max(30),
    brand: z.array(runNeighborhoodEntrySchema).max(30)
  }),
  state: z.enum(runNeighborhoodStates)
});

export type RunTasteNeighborhood = z.infer<typeof runTasteNeighborhoodSchema>;

export const runNeighborhoodSourceSchema = z.strictObject({
  componentId: z.string().trim().min(1).max(200),
  domain: z.enum(runNeighborhoodDomains),
  scope: z.enum(runNeighborhoodScopes),
  evidenceId: z.string().min(1)
});

export type RunNeighborhoodSource = z.infer<typeof runNeighborhoodSourceSchema>;

export const runNeighborhoodsSchema = z.strictObject({
  components: z.array(runTasteNeighborhoodSchema).max(10),
  city: z.array(runTasteNeighborhoodSchema).max(10),
  sources: z.array(runNeighborhoodSourceSchema).max(120)
});

export type RunNeighborhoods = z.infer<typeof runNeighborhoodsSchema>;

export const runEdgeBands = ["strong", "typical", "weak"] as const;

export type RunEdgeBand = (typeof runEdgeBands)[number];

export const runEdgeStates = ["measured", "unmeasured"] as const;

export type RunEdgeState = (typeof runEdgeStates)[number];

export const runSharedEntitySchema = z.strictObject({
  entityId: z.string().trim().min(1).max(200),
  domain: z.enum(runNeighborhoodDomains),
  aWeight: z.number().finite().min(0).max(1),
  bWeight: z.number().finite().min(0).max(1),
  idf: z.number().finite().min(0),
  dotContribution: z.number().finite().min(0),
  name: z.string().trim().min(1).max(200).optional()
});

export type RunSharedEntity = z.infer<typeof runSharedEntitySchema>;

export const runGraphEdgeSchema = z.strictObject({
  a: z.string().trim().min(1),
  b: z.string().trim().min(1),
  value: z.number().finite().min(0).max(1).nullable(),
  band: z.enum(runEdgeBands).nullable(),
  state: z.enum(runEdgeStates),
  sharedEntities: z.array(runSharedEntitySchema).max(8).optional()
});

export type RunGraphEdge = z.infer<typeof runGraphEdgeSchema>;

export const runGraphSchema = z.strictObject({
  nodes: z.array(z.string().trim().min(1)).max(10),
  edges: z.array(runGraphEdgeSchema).max(45)
});

export type RunGraph = z.infer<typeof runGraphSchema>;

export const runWeakestLinkSchema = z.strictObject({
  a: z.string().trim().min(1),
  b: z.string().trim().min(1),
  value: z.number().finite().min(0).max(1)
});

export type RunWeakestLink = z.infer<typeof runWeakestLinkSchema>;

export const runEvidenceGrades = ["A", "B", "C"] as const;

export type RunEvidenceGrade = (typeof runEvidenceGrades)[number];

export const runRankedCompositionSchema = z
  .strictObject({
    members: z.array(z.string().trim().min(1)).min(2),
    size: z.number().int().min(2),
    coherence: z.number().finite().min(0).max(1),
    percentile: z.number().finite().min(0).max(100).nullable(),
    distinctivenessMean: z.number().finite().min(0).max(1),
    weakestLink: runWeakestLinkSchema,
    rankScore: z.number().finite(),
    grade: z.enum(runEvidenceGrades),
    gradeReasons: z.array(z.string()).max(60)
  })
  .refine((composition) => composition.size === composition.members.length, {
    message: "size must equal members.length"
  });

export type RunRankedComposition = z.infer<typeof runRankedCompositionSchema>;

export const runExcludedCompositionSchema = z.strictObject({
  members: z.array(z.string().trim().min(1)).min(2),
  reason: z.enum(["distinctiveness_unavailable"])
});

export type RunExcludedComposition = z.infer<typeof runExcludedCompositionSchema>;

export const runTriangulationStates = ["confirmed", "contested", "thin", "failed"] as const;

export type RunTriangulationState = (typeof runTriangulationStates)[number];

export const runTriangulationClassificationSchema = z.strictObject({
  a: z.string().trim().min(1),
  b: z.string().trim().min(1),
  state: z.enum(runTriangulationStates),
  route1State: z.enum(runEdgeStates),
  route1Value: z.number().finite().min(0).max(1).nullable(),
  resultCount: z.number().int().min(0),
  focalInTopHalf: z.boolean().nullable()
});

export type RunTriangulationClassification = z.infer<typeof runTriangulationClassificationSchema>;

export const runSweepFlipSchema = z.strictObject({
  index: z.number().int().min(1),
  weight: z.number().finite().min(0).max(1),
  from: z.array(z.string().trim().min(1)).nullable(),
  to: z.array(z.string().trim().min(1)).nullable()
});

export type RunSweepFlip = z.infer<typeof runSweepFlipSchema>;

export const runCompositionFamilySchema = z.strictObject({
  poolSize: z.number().int().min(0),
  size: z.number().int().min(0),
  requiredRoles: z.array(z.enum(poolComponentRoles)),
  totalCandidates: z.number().int().min(0),
  totalValid: z.number().int().min(0),
  coherenceDistribution: z.array(z.number().finite().min(0).max(1)).max(252),
  reason: z.string().max(300).optional()
});

export type RunCompositionFamily = z.infer<typeof runCompositionFamilySchema>;

export const runPriorMarkerSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("measured"),
    members: z.array(z.string().trim().min(1)).min(2),
    coherence: z.number().finite().min(0).max(1),
    percentile: z.number().finite().min(0).max(100).nullable()
  }),
  z.strictObject({
    state: z.literal("not measured"),
    reason: z.string().trim().min(1).max(300)
  })
]);

export type RunPriorMarker = z.infer<typeof runPriorMarkerSchema>;

export const runCompositionsSchema = z.strictObject({
  family: runCompositionFamilySchema,
  ranked: z.array(runRankedCompositionSchema).max(252),
  excluded: z.array(runExcludedCompositionSchema).max(252),
  triangulation: z.array(runTriangulationClassificationSchema).max(45),
  rivalFlips: z.array(runSweepFlipSchema).max(100),
  prior: runPriorMarkerSchema
});

export type RunCompositions = z.infer<typeof runCompositionsSchema>;

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

export const attackKinds = ["ablation", "substitution", "bridge", "catchment", "rival"] as const;

export type AttackKind = (typeof attackKinds)[number];

export const attackKindSchema = z.enum(attackKinds);

export const challengeAttackStatuses = ["measured", "skipped", "not completed"] as const;

export type ChallengeAttackStatus = (typeof challengeAttackStatuses)[number];

export const challengeAttackSchema = z.strictObject({
  kind: attackKindSchema,
  status: z.enum(challengeAttackStatuses),
  summary: z.string().trim().min(1).max(300),
  detail: z.string().trim().min(1).max(500),
  evidenceId: z.string().min(1).optional()
});

export type ChallengeAttack = z.infer<typeof challengeAttackSchema>;

export const challengeVerdicts = ["Survived", "Revised", "Replaced"] as const;

export type ChallengeVerdict = (typeof challengeVerdicts)[number];

export const challengeLeaderSchema = z.strictObject({
  members: z.array(z.string().trim().min(1)).min(2),
  coherence: z.number().finite().min(0).max(1),
  percentile: z.number().finite().min(0).max(100).nullable(),
  distinctivenessMean: z.number().finite().min(0).max(1),
  weakestLink: runWeakestLinkSchema
});

export type ChallengeLeader = z.infer<typeof challengeLeaderSchema>;

export const challengeMutationOperators = ["bridge", "swap", "drop", "shift-scale"] as const;

export type ChallengeMutationOperator = (typeof challengeMutationOperators)[number];

export const challengeMutationSchema = z.strictObject({
  operator: z.enum(challengeMutationOperators),
  round: z.number().int().min(1).max(3),
  memberOut: z.string().trim().min(1).max(200).nullable(),
  memberIn: z.string().trim().min(1).max(200).nullable(),
  coherenceBefore: z.number().finite().min(0).max(1),
  coherenceAfter: z.number().finite().min(0).max(1)
});

export type ChallengeMutation = z.infer<typeof challengeMutationSchema>;

export const challengeReportSchema = z.strictObject({
  kind: z.literal("challenge"),
  verdict: z.enum(challengeVerdicts),
  verdictRival: z.array(z.string().trim().min(1)).min(2).optional(),
  reason: z.string().trim().min(1).max(500),
  attackOrder: z.array(attackKindSchema).min(5).max(5),
  attackOrderSource: z.enum(["llm", "diagnostic"]),
  rounds: z.number().int().min(1).max(3),
  leaderBefore: challengeLeaderSchema,
  leaderAfter: challengeLeaderSchema,
  mutations: z.array(challengeMutationSchema).max(2),
  attacks: z.array(challengeAttackSchema).min(5).max(5),
  gradeCap: z.enum(["A", "B"]),
  generatedAt: z.string().min(1)
});

export type ChallengeReport = z.infer<typeof challengeReportSchema>;

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
  neighborhoods: runNeighborhoodsSchema.optional(),
  graph: runGraphSchema.optional(),
  compositions: runCompositionsSchema.optional(),
  stressReport: z.unknown().optional(),
  constraintFit: z.unknown().optional(),
  challengeReport: challengeReportSchema.optional(),
  revisions: z.array(runRevisionSchema).max(100).optional()
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

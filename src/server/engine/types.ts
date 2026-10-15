import { z } from "zod";

export const componentRoles = [
  "Anchor",
  "Social",
  "Discovery",
  "Experience",
  "Night",
  "Community"
] as const;

export type ComponentRole = (typeof componentRoles)[number];

export const componentEvidenceStates = [
  "measured",
  "not measured",
  "incomplete",
  "unavailable"
] as const;

export type ComponentEvidenceState = (typeof componentEvidenceStates)[number];

export const neighborhoodDomains = ["artist", "movie", "brand"] as const;

export type NeighborhoodDomain = (typeof neighborhoodDomains)[number];

export const neighborhoodStates = ["measured", "not measured", "incomplete"] as const;

export type NeighborhoodState = (typeof neighborhoodStates)[number];

export const edgeStates = ["measured", "unmeasured"] as const;

export type EdgeState = (typeof edgeStates)[number];

export const edgeBands = ["strong", "typical", "weak"] as const;

export type EdgeBand = (typeof edgeBands)[number];

export type EngineErrorCode =
  | "INVALID_COMPONENT"
  | "INVALID_NEIGHBORHOOD_SIGNAL"
  | "INVALID_GRAPH_INPUT";

export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export const exemplarSchema = z.strictObject({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200)
});

export type Exemplar = z.infer<typeof exemplarSchema>;

export const provenancePathSchema = z.strictObject({
  anchorPlace: z.string().trim().min(1).max(300),
  qlooSignal: z.string().trim().min(1).max(300),
  resolvedCategory: z.string().trim().min(1).max(300),
  exemplarSet: z.string().trim().min(1).max(300),
  tasteNeighborhood: z.string().trim().min(1).max(300)
});

export type ProvenancePath = z.infer<typeof provenancePathSchema>;

export const candidateComponentSchema = z.strictObject({
  id: z.string().trim().min(1).max(200),
  role: z.enum(componentRoles),
  tags: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
  exemplars: z.array(exemplarSchema).min(1).max(5),
  provenancePath: provenancePathSchema,
  evidenceState: z.enum(componentEvidenceStates)
});

export type CandidateComponent = z.infer<typeof candidateComponentSchema>;

export function parseCandidateComponent(value: unknown): CandidateComponent {
  const parsed = candidateComponentSchema.safeParse(value);
  if (!parsed.success) {
    throw new EngineError(
      "INVALID_COMPONENT",
      `candidate component is invalid: ${describeIssues(parsed.error)}`
    );
  }
  return parsed.data;
}

export function validatePool(value: unknown): CandidateComponent[] {
  if (!Array.isArray(value)) {
    throw new EngineError("INVALID_COMPONENT", "candidate pool must be an array");
  }
  const pool = value.map((entry) => parseCandidateComponent(entry));
  const seen = new Set<string>();
  for (const component of pool) {
    if (seen.has(component.id)) {
      throw new EngineError("INVALID_COMPONENT", `duplicate component id "${component.id}"`);
    }
    seen.add(component.id);
  }
  return pool;
}

export interface RawNeighborhoodSignal {
  entityId: string;
  rank: number;
  affinity?: number;
  name?: string;
}

export interface NeighborhoodSignalInput {
  componentId: string;
  domain: NeighborhoodDomain;
  signals: readonly RawNeighborhoodSignal[];
}

export const neighborhoodEntrySchema = z.strictObject({
  entityId: z.string().trim().min(1).max(200),
  rank: z.number().int().min(1),
  weight: z.number().finite().positive(),
  affinityUsed: z.boolean(),
  name: z.string().trim().min(1).max(200).optional()
});

export type NeighborhoodEntry = z.infer<typeof neighborhoodEntrySchema>;

export const tasteNeighborhoodSchema = z.strictObject({
  componentId: z.string().trim().min(1).max(200),
  domains: z.strictObject({
    artist: z.array(neighborhoodEntrySchema).max(30),
    movie: z.array(neighborhoodEntrySchema).max(30),
    brand: z.array(neighborhoodEntrySchema).max(30)
  }),
  state: z.enum(neighborhoodStates)
});

export type TasteNeighborhood = z.infer<typeof tasteNeighborhoodSchema>;

export const graphEdgeSchema = z.strictObject({
  a: z.string().trim().min(1),
  b: z.string().trim().min(1),
  value: z.number().finite().min(0).max(1).nullable(),
  band: z.enum(edgeBands).nullable(),
  state: z.enum(edgeStates)
});

export type GraphEdge = z.infer<typeof graphEdgeSchema>;

export const graphSchema = z.strictObject({
  nodes: z.array(z.string().trim().min(1)),
  edges: z.array(graphEdgeSchema)
});

export type CultureGraph = z.infer<typeof graphSchema>;

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { qlooOperations, qlooTransportKinds } from "../qloo/index.js";

export const evidenceCacheStates = ["live", "cached"] as const;
export type EvidenceCacheState = (typeof evidenceCacheStates)[number];

export const evidenceProvenanceSchema = z.strictObject({
  transport: z.enum(qlooTransportKinds),
  operation: z.enum(qlooOperations),
  endpoint: z.string().trim().min(1),
  durationMs: z.number().finite().nonnegative(),
  cacheState: z.enum(evidenceCacheStates),
  resultCount: z.number().int().nonnegative()
});

export type EvidenceProvenance = z.infer<typeof evidenceProvenanceSchema>;

export const evidenceRecordSchema = z.object({
  id: z.uuid(),
  operation: z.enum(qlooOperations),
  claim: z.string().trim().min(1),
  provenance: evidenceProvenanceSchema,
  createdAt: z.string().min(1),
  ledgerEventId: z.uuid()
});

export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;

export type EvidenceErrorCode =
  | "UNKNOWN_PROVENANCE"
  | "INVALID_RECORD"
  | "UNKNOWN_EVIDENCE_ID";

export class EvidenceError extends Error {
  readonly code: EvidenceErrorCode;

  constructor(code: EvidenceErrorCode, message: string) {
    super(message);
    this.name = "EvidenceError";
    this.code = code;
  }
}

export interface CreateEvidenceRecordInput {
  operation: string;
  claim: string;
  provenance: unknown;
  createdAt: string;
  ledgerEventId: string;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export function createEvidenceRecord(input: CreateEvidenceRecordInput): EvidenceRecord {
  const provenance = evidenceProvenanceSchema.safeParse(input.provenance);
  if (!provenance.success) {
    throw new EvidenceError(
      "UNKNOWN_PROVENANCE",
      `evidence provenance is missing or unrecognised: ${describeIssues(provenance.error)}`
    );
  }
  if (input.operation !== provenance.data.operation) {
    throw new EvidenceError(
      "INVALID_RECORD",
      `evidence operation "${input.operation}" does not match provenance operation "${provenance.data.operation}"`
    );
  }
  const record = evidenceRecordSchema.safeParse({
    id: randomUUID(),
    operation: input.operation,
    claim: input.claim,
    provenance: provenance.data,
    createdAt: input.createdAt,
    ledgerEventId: input.ledgerEventId
  });
  if (!record.success) {
    throw new EvidenceError("INVALID_RECORD", `evidence record is invalid: ${describeIssues(record.error)}`);
  }
  return Object.freeze(record.data);
}

export function isEvidenceRecord(value: unknown): value is EvidenceRecord {
  return evidenceRecordSchema.safeParse(value).success;
}

export interface EvidenceClaim {
  text: string;
  evidenceIds: string[];
}

function normalizeClaim(value: unknown): { text: string; evidenceIds: string[] } {
  if (typeof value !== "object" || value === null) {
    throw new EvidenceError("INVALID_RECORD", "claim must be an object with text and evidenceIds");
  }
  const candidate = value as { text?: unknown; evidenceIds?: unknown };
  if (typeof candidate.text !== "string" || candidate.text.trim() === "") {
    throw new EvidenceError("INVALID_RECORD", "claim text must be a non-empty string");
  }
  if (!Array.isArray(candidate.evidenceIds)) {
    throw new EvidenceError("INVALID_RECORD", "claim evidenceIds must be an array");
  }
  const evidenceIds = candidate.evidenceIds.map((id: unknown, index: number): string => {
    if (typeof id !== "string" || id.trim() === "") {
      throw new EvidenceError(
        "INVALID_RECORD",
        `claim evidenceIds[${index}] must be a non-empty string`
      );
    }
    return id;
  });
  return { text: candidate.text, evidenceIds };
}

export function resolveClaimEvidence(
  claim: EvidenceClaim,
  records: readonly EvidenceRecord[]
): EvidenceRecord[] {
  const normalized = normalizeClaim(claim);
  if (!Array.isArray(records)) {
    throw new EvidenceError("INVALID_RECORD", "evidence records must be an array");
  }
  const byId = new Map<string, EvidenceRecord>();
  for (const record of records) {
    if (!isEvidenceRecord(record)) {
      throw new EvidenceError("INVALID_RECORD", "evidence records contain an invalid record");
    }
    if (!byId.has(record.id)) {
      byId.set(record.id, record);
    }
  }
  const seen = new Set<string>();
  const missing: string[] = [];
  const resolved: EvidenceRecord[] = [];
  for (const id of normalized.evidenceIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const record = byId.get(id);
    if (record === undefined) {
      missing.push(id);
      continue;
    }
    resolved.push(record);
  }
  if (missing.length > 0) {
    throw new EvidenceError(
      "UNKNOWN_EVIDENCE_ID",
      `claim references unknown evidence id(s): ${missing.join(", ")}`
    );
  }
  return resolved;
}

export function isResolvableClaim(
  claim: EvidenceClaim,
  records: readonly EvidenceRecord[]
): boolean {
  try {
    resolveClaimEvidence(claim, records);
    return true;
  } catch {
    return false;
  }
}

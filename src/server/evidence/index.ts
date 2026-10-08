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

export type EvidenceErrorCode = "UNKNOWN_PROVENANCE" | "INVALID_RECORD";

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

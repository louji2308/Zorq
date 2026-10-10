import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  EvidenceError,
  createEvidenceRecord,
  evidenceRecordSchema,
  isEvidenceRecord,
  isResolvableClaim,
  resolveClaimEvidence
} from "../../src/server/evidence/index.js";
import type { EvidenceClaim, EvidenceRecord } from "../../src/server/evidence/index.js";

const VALID_PROVENANCE = {
  transport: "rest",
  operation: "search",
  endpoint: "https://hackathon.api.qloo.com/v2/search",
  durationMs: 143,
  cacheState: "live",
  resultCount: 3
} as const;

function recordInput(overrides: Partial<Parameters<typeof createEvidenceRecord>[0]> = {}) {
  return {
    operation: "search",
    claim: "Qloo search observation via qloo_search",
    provenance: VALID_PROVENANCE,
    createdAt: "2026-10-08T12:00:00.000Z",
    ledgerEventId: randomUUID(),
    ...overrides
  };
}

function makeRecord(): EvidenceRecord {
  return createEvidenceRecord(recordInput());
}

function expectEvidenceError(fn: () => unknown, code: string): EvidenceError | undefined {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(EvidenceError);
  expect((caught as EvidenceError).code).toBe(code);
  expect((caught as EvidenceError).message).not.toBe("");
  return caught as EvidenceError;
}

describe("resolveClaimEvidence", () => {
  it("resolves cited records in the claim's id order", () => {
    const first = makeRecord();
    const second = makeRecord();
    const claim: EvidenceClaim = {
      text: "Places of this type rank in the top half for the other audience.",
      evidenceIds: [second.id, first.id]
    };
    const resolved = resolveClaimEvidence(claim, [first, second]);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toBe(second);
    expect(resolved[1]).toBe(first);
  });

  it("deduplicates repeated ids deterministically in first-occurrence order", () => {
    const first = makeRecord();
    const second = makeRecord();
    const claim: EvidenceClaim = {
      text: "Cited twice.",
      evidenceIds: [first.id, second.id, first.id]
    };
    const resolved = resolveClaimEvidence(claim, [first, second]);
    expect(resolved.map((record) => record.id)).toEqual([first.id, second.id]);
  });

  it("throws UNKNOWN_EVIDENCE_ID naming the missing id", () => {
    const known = makeRecord();
    const missingId = randomUUID();
    const error = expectEvidenceError(
      () =>
        resolveClaimEvidence(
          { text: "A claim with a dangling citation.", evidenceIds: [known.id, missingId] },
          [known]
        ),
      "UNKNOWN_EVIDENCE_ID"
    );
    expect(error?.message).toContain(missingId);
  });

  it("throws UNKNOWN_EVIDENCE_ID naming every missing id", () => {
    const missingOne = randomUUID();
    const missingTwo = randomUUID();
    const error = expectEvidenceError(
      () =>
        resolveClaimEvidence(
          { text: "A claim with two dangling citations.", evidenceIds: [missingOne, missingTwo] },
          []
        ),
      "UNKNOWN_EVIDENCE_ID"
    );
    expect(error?.message).toContain(missingOne);
    expect(error?.message).toContain(missingTwo);
  });

  it("accepts a claim with no citations and returns an empty list", () => {
    expect(resolveClaimEvidence({ text: "Uncited claim.", evidenceIds: [] }, [])).toEqual([]);
  });

  it("rejects invalid claim shapes with INVALID_RECORD", () => {
    expectEvidenceError(
      () => resolveClaimEvidence({ text: "", evidenceIds: [] }, []),
      "INVALID_RECORD"
    );
    expectEvidenceError(
      () => resolveClaimEvidence({ text: "   ", evidenceIds: [] }, []),
      "INVALID_RECORD"
    );
    expectEvidenceError(
      () =>
        resolveClaimEvidence(
          { text: "Claim.", evidenceIds: "not-an-array" } as unknown as EvidenceClaim,
          []
        ),
      "INVALID_RECORD"
    );
    expectEvidenceError(
      () => resolveClaimEvidence(null as unknown as EvidenceClaim, []),
      "INVALID_RECORD"
    );
    expectEvidenceError(
      () =>
        resolveClaimEvidence(
          { text: "Claim.", evidenceIds: [42] } as unknown as EvidenceClaim,
          []
        ),
      "INVALID_RECORD"
    );
    expectEvidenceError(
      () =>
        resolveClaimEvidence(
          { text: "Claim.", evidenceIds: ["  "] } as unknown as EvidenceClaim,
          []
        ),
      "INVALID_RECORD"
    );
  });

  it("rejects malformed records instead of resolving them as citations", () => {
    const valid = makeRecord();
    expectEvidenceError(
      () =>
        resolveClaimEvidence(
          { text: "Claim.", evidenceIds: [valid.id] },
          [{ id: valid.id } as unknown as EvidenceRecord]
        ),
      "INVALID_RECORD"
    );
    expectEvidenceError(
      () =>
        resolveClaimEvidence({ text: "Claim.", evidenceIds: [] }, "nope" as unknown as EvidenceRecord[]),
      "INVALID_RECORD"
    );
  });
});

describe("isResolvableClaim", () => {
  it("returns true only when every citation resolves to a real record", () => {
    const record = makeRecord();
    expect(isResolvableClaim({ text: "Cited.", evidenceIds: [record.id] }, [record])).toBe(true);
    expect(isResolvableClaim({ text: "Cited.", evidenceIds: [randomUUID()] }, [record])).toBe(
      false
    );
    expect(isResolvableClaim({ text: "", evidenceIds: [] }, [record])).toBe(false);
  });
});

describe("existing evidence API", () => {
  it("still mints frozen records with copied provenance", () => {
    const record = createEvidenceRecord(recordInput());
    expect(Object.isFrozen(record)).toBe(true);
    expect(record.provenance).toEqual(VALID_PROVENANCE);
    expect(evidenceRecordSchema.parse(record)).toEqual(record);
    expect(isEvidenceRecord(record)).toBe(true);
  });

  it("still rejects unknown provenance with UNKNOWN_PROVENANCE", () => {
    expectEvidenceError(
      () => createEvidenceRecord(recordInput({ provenance: undefined })),
      "UNKNOWN_PROVENANCE"
    );
    expectEvidenceError(
      () => createEvidenceRecord(recordInput({ claim: "" })),
      "INVALID_RECORD"
    );
  });
});

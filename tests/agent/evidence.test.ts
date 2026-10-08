import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  EvidenceError,
  createEvidenceRecord,
  evidenceRecordSchema,
  isEvidenceRecord
} from "../../src/server/evidence/index.js";

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

function expectEvidenceError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(EvidenceError);
  expect((caught as EvidenceError).code).toBe(code);
  expect((caught as EvidenceError).message).not.toBe("");
}

describe("evidence records", () => {
  it("mints a real random uuid and copies provenance exactly", () => {
    const first = createEvidenceRecord(recordInput());
    const second = createEvidenceRecord(recordInput());

    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(second.id).not.toBe(first.id);
    expect(evidenceRecordSchema.parse(first)).toEqual(first);
    expect(isEvidenceRecord(first)).toBe(true);
    expect(first.provenance).toEqual(VALID_PROVENANCE);
    expect(first.operation).toBe("search");
    expect(first.claim).toBe("Qloo search observation via qloo_search");
    expect(first.createdAt).toBe("2026-10-08T12:00:00.000Z");
    expect(first.ledgerEventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("keeps the ledger link it was given", () => {
    const ledgerEventId = randomUUID();
    const record = createEvidenceRecord(recordInput({ ledgerEventId }));
    expect(record.ledgerEventId).toBe(ledgerEventId);
  });

  it("rejects absent, unknown, or extra provenance with a typed error", () => {
    expectEvidenceError(() => createEvidenceRecord(recordInput({ provenance: undefined })), "UNKNOWN_PROVENANCE");
    expectEvidenceError(() => createEvidenceRecord(recordInput({ provenance: {} })), "UNKNOWN_PROVENANCE");
    expectEvidenceError(
      () => createEvidenceRecord(recordInput({ provenance: { ...VALID_PROVENANCE, transport: "carrier-pigeon" } })),
      "UNKNOWN_PROVENANCE"
    );
    expectEvidenceError(
      () => createEvidenceRecord(recordInput({ provenance: { ...VALID_PROVENANCE, operation: "divinate" } })),
      "UNKNOWN_PROVENANCE"
    );
    expectEvidenceError(
      () => createEvidenceRecord(recordInput({ provenance: { ...VALID_PROVENANCE, cacheState: "stale" } })),
      "UNKNOWN_PROVENANCE"
    );
    const missingEndpoint = {
      transport: VALID_PROVENANCE.transport,
      operation: VALID_PROVENANCE.operation,
      durationMs: VALID_PROVENANCE.durationMs,
      cacheState: VALID_PROVENANCE.cacheState,
      resultCount: VALID_PROVENANCE.resultCount
    };
    expectEvidenceError(() => createEvidenceRecord(recordInput({ provenance: missingEndpoint })), "UNKNOWN_PROVENANCE");
    expectEvidenceError(
      () => createEvidenceRecord(recordInput({ provenance: { ...VALID_PROVENANCE, correlationId: "extra" } })),
      "UNKNOWN_PROVENANCE"
    );
    expectEvidenceError(() => createEvidenceRecord(recordInput({ provenance: "rest/search" })), "UNKNOWN_PROVENANCE");
  });

  it("rejects records with missing or malformed fields", () => {
    expectEvidenceError(() => createEvidenceRecord(recordInput({ claim: "" })), "INVALID_RECORD");
    expectEvidenceError(() => createEvidenceRecord(recordInput({ createdAt: "" })), "INVALID_RECORD");
    expectEvidenceError(() => createEvidenceRecord(recordInput({ ledgerEventId: "not-a-uuid" })), "INVALID_RECORD");
    expectEvidenceError(() => createEvidenceRecord(recordInput({ operation: "divinate" })), "INVALID_RECORD");
    expectEvidenceError(
      () => createEvidenceRecord(recordInput({ operation: "insights" })),
      "INVALID_RECORD"
    );
  });

  it("never validates invented records as evidence", () => {
    expect(isEvidenceRecord({ id: "evidence-1", operation: "search" })).toBe(false);
    expect(isEvidenceRecord(null)).toBe(false);
    expect(
      isEvidenceRecord({
        id: randomUUID(),
        operation: "search",
        claim: "made up",
        provenance: { ...VALID_PROVENANCE },
        createdAt: "2026-10-08T12:00:00.000Z",
        ledgerEventId: randomUUID()
      })
    ).toBe(true);
  });
});

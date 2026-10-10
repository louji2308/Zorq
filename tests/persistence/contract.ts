import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "../../src/server/agent/ledger.js";
import type { RunStore } from "../../src/server/persistence/index.js";
import {
  EvidenceConflict,
  LedgerEventConflict,
  RunConflict,
  RunNotFound
} from "../../src/server/persistence/index.js";
import { sampleEntry, sampleEvidence, sampleState } from "./fixtures.js";

export interface ContractStoreFactory {
  label: string;
  create(): Promise<RunStore>;
  dispose?(store: RunStore): Promise<void>;
}

function expectRunStoreError(
  error: unknown,
  errorClass: abstract new (...args: never[]) => Error,
  name: string,
  code: string
): void {
  expect(error).toBeInstanceOf(errorClass);
  expect((error as Error).name).toBe(name);
  expect((error as { code?: string }).code).toBe(code);
  expect((error as Error).message).not.toBe("");
}

async function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the operation to throw, but it resolved");
}

export function runContract(factory: ContractStoreFactory): void {
  describe(`RunStore contract: ${factory.label}`, () => {
    it("round-trips a created run with deep state equality", async () => {
      const store = await factory.create();
      const id = randomUUID();
      const state = sampleState(id);
      await store.createRun({ id, state });
      const loaded = await store.loadRun(id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(id);
      expect(loaded?.status).toBe(state.status);
      expect(loaded?.phase).toBe(state.phase);
      expect(loaded?.state).toEqual(state);
      expect(loaded?.ledger).toEqual([]);
      expect(loaded?.evidence).toEqual([]);
      expect(typeof loaded?.createdAt).toBe("string");
      expect(typeof loaded?.updatedAt).toBe("string");
      expect(Number.isNaN(Date.parse(loaded?.createdAt ?? ""))).toBe(false);
      expect(Number.isNaN(Date.parse(loaded?.updatedAt ?? ""))).toBe(false);
      await factory.dispose?.(store);
    });

    it("loads an unknown run as null", async () => {
      const store = await factory.create();
      expect(await store.loadRun(randomUUID())).toBeNull();
      await factory.dispose?.(store);
    });

    it("rejects a duplicate run id with RunConflict", async () => {
      const store = await factory.create();
      const id = randomUUID();
      await store.createRun({ id, state: sampleState(id) });
      const error = await captureError(() => store.createRun({ id, state: sampleState(id) }));
      expectRunStoreError(error, RunConflict, "RunConflict", "RUN_CONFLICT");
      await factory.dispose?.(store);
    });

    it("updates status, phase, and state through saveRunState", async () => {
      const store = await factory.create();
      const id = randomUUID();
      await store.createRun({ id, state: sampleState(id, "created", "intake") });
      const next = sampleState(id, "running", "prior_lock");
      next.brief = {
        location: "Porto, Portugal",
        objective: "Updated objective after lock",
        constraints: ["no outdoor seating"]
      };
      await store.saveRunState(id, next);
      const loaded = await store.loadRun(id);
      expect(loaded?.status).toBe("running");
      expect(loaded?.phase).toBe("prior_lock");
      expect(loaded?.state).toEqual(next);
      await factory.dispose?.(store);
    });

    it("rejects saveRunState for an unknown run with RunNotFound", async () => {
      const store = await factory.create();
      const id = randomUUID();
      const error = await captureError(() => store.saveRunState(id, sampleState(id)));
      expectRunStoreError(error, RunNotFound, "RunNotFound", "RUN_NOT_FOUND");
      await factory.dispose?.(store);
    });

    it("stores caller-supplied ledger sequences and lists them ordered, with afterSequence filtering", async () => {
      const store = await factory.create();
      const id = randomUUID();
      await store.createRun({ id, state: sampleState(id) });
      const third: LedgerEntry = sampleEntry(3);
      const first: LedgerEntry = sampleEntry(1);
      const second: LedgerEntry = sampleEntry(2);
      await store.appendLedgerEvent(id, third);
      await store.appendLedgerEvent(id, first);
      await store.appendLedgerEvent(id, second);
      const all = await store.listLedgerEvents(id);
      expect(all.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
      expect(all.map((entry) => entry.id)).toEqual([first.id, second.id, third.id]);
      expect(all[0].event).toEqual(first.event);
      const afterFirst = await store.listLedgerEvents(id, 1);
      expect(afterFirst.map((entry) => entry.sequence)).toEqual([2, 3]);
      const afterLast = await store.listLedgerEvents(id, 3);
      expect(afterLast).toEqual([]);
      await factory.dispose?.(store);
    });

    it("rejects a duplicate ledger event id with LedgerEventConflict", async () => {
      const store = await factory.create();
      const id = randomUUID();
      await store.createRun({ id, state: sampleState(id) });
      const entry = sampleEntry(1);
      await store.appendLedgerEvent(id, entry);
      const error = await captureError(() => store.appendLedgerEvent(id, { ...entry, sequence: 2 }));
      expectRunStoreError(error, LedgerEventConflict, "LedgerEventConflict", "LEDGER_EVENT_CONFLICT");
      await factory.dispose?.(store);
    });

    it("rejects ledger appends for an unknown run with RunNotFound", async () => {
      const store = await factory.create();
      const error = await captureError(() => store.appendLedgerEvent(randomUUID(), sampleEntry(1)));
      expectRunStoreError(error, RunNotFound, "RunNotFound", "RUN_NOT_FOUND");
      await factory.dispose?.(store);
    });

    it("appends and lists evidence records", async () => {
      const store = await factory.create();
      const id = randomUUID();
      await store.createRun({ id, state: sampleState(id) });
      const first = sampleEvidence();
      const second = sampleEvidence();
      await store.appendEvidence(id, first);
      await store.appendEvidence(id, second);
      const listed = await store.listEvidence(id);
      expect(listed).toHaveLength(2);
      expect(listed.map((record) => record.id).sort()).toEqual([first.id, second.id].sort());
      expect(listed.find((record) => record.id === first.id)).toEqual(first);
      await factory.dispose?.(store);
    });

    it("rejects a duplicate evidence id with EvidenceConflict", async () => {
      const store = await factory.create();
      const id = randomUUID();
      await store.createRun({ id, state: sampleState(id) });
      const record = sampleEvidence();
      await store.appendEvidence(id, record);
      const error = await captureError(() => store.appendEvidence(id, record));
      expectRunStoreError(error, EvidenceConflict, "EvidenceConflict", "EVIDENCE_CONFLICT");
      await factory.dispose?.(store);
    });

    it("rejects evidence appends for an unknown run with RunNotFound", async () => {
      const store = await factory.create();
      const error = await captureError(() => store.appendEvidence(randomUUID(), sampleEvidence()));
      expectRunStoreError(error, RunNotFound, "RunNotFound", "RUN_NOT_FOUND");
      await factory.dispose?.(store);
    });

    it("returns an empty ledger and evidence list for an unknown run", async () => {
      const store = await factory.create();
      const id = randomUUID();
      expect(await store.listLedgerEvents(id)).toEqual([]);
      expect(await store.listEvidence(id)).toEqual([]);
      await factory.dispose?.(store);
    });

    it("loads the full snapshot with ledger and evidence after appends", async () => {
      const store = await factory.create();
      const id = randomUUID();
      const state = sampleState(id);
      await store.createRun({ id, state });
      const second: LedgerEntry = sampleEntry(2);
      const first: LedgerEntry = sampleEntry(1);
      await store.appendLedgerEvent(id, second);
      await store.appendLedgerEvent(id, first);
      const evidence = sampleEvidence();
      await store.appendEvidence(id, evidence);
      const loaded = await store.loadRun(id);
      expect(loaded?.state).toEqual(state);
      expect(loaded?.ledger.map((entry) => entry.sequence)).toEqual([1, 2]);
      expect(loaded?.evidence).toEqual([evidence]);
      await factory.dispose?.(store);
    });
  });
}

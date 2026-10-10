import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../src/server/persistence/index.js";
import { sampleEntry, sampleEvidence, sampleState } from "./fixtures.js";

describe("createMemoryStore isolation", () => {
  it("does not let callers mutate stored state through the createRun input", async () => {
    const store = createMemoryStore();
    const id = randomUUID();
    const state = sampleState(id);
    await store.createRun({ id, state });
    state.status = "mutated";
    if (state.brief !== undefined) {
      state.brief.location = "Mutated City";
    }
    if (state.prior !== undefined) {
      state.prior.model = "mutated-model";
    }
    const loaded = await store.loadRun(id);
    expect(loaded?.state.status).toBe("created");
    expect(loaded?.state.brief?.location).toBe("Lisbon, Portugal");
    expect(loaded?.state.prior?.model).toBe("deepseek-chat");
  });

  it("does not let callers mutate stored state through the loadRun result", async () => {
    const store = createMemoryStore();
    const id = randomUUID();
    await store.createRun({ id, state: sampleState(id) });
    const first = await store.loadRun(id);
    expect(first).not.toBeNull();
    if (first?.state.brief !== undefined) {
      first.state.brief.location = "Hacked City";
    }
    first!.state.status = "hacked";
    const second = await store.loadRun(id);
    expect(second?.state.status).toBe("created");
    expect(second?.state.brief?.location).toBe("Lisbon, Portugal");
  });

  it("does not share ledger entry object graphs across appends and reads", async () => {
    const store = createMemoryStore();
    const id = randomUUID();
    await store.createRun({ id, state: sampleState(id) });
    const entry = sampleEntry(1);
    const label = entry.event.label;
    await store.appendLedgerEvent(id, entry);
    entry.event.label = "mutated-after-append";
    const listed = await store.listLedgerEvents(id);
    expect(listed[0]?.event.label).toBe(label);
    listed[0]!.event.label = "mutated-after-list";
    const relisted = await store.listLedgerEvents(id);
    expect(relisted[0]?.event.label).toBe(label);
  });

  it("does not share evidence record object graphs across appends and reads", async () => {
    const store = createMemoryStore();
    const id = randomUUID();
    await store.createRun({ id, state: sampleState(id) });
    const record = sampleEvidence();
    const claim = record.claim;
    await store.appendEvidence(id, record);
    record.claim = "mutated-after-append";
    const listed = await store.listEvidence(id);
    expect(listed[0]?.claim).toBe(claim);
    listed[0]!.claim = "mutated-after-list";
    const relisted = await store.listEvidence(id);
    expect(relisted[0]?.claim).toBe(claim);
  });
});

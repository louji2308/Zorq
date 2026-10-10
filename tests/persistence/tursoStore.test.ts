import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createTursoStore } from "../../src/server/persistence/index.js";
import type { RunStore } from "../../src/server/persistence/index.js";
import { runContract } from "./contract.js";
import { sampleEntry, sampleState } from "./fixtures.js";

const tempDir = mkdtempSync(join(tmpdir(), "zorq-turso-"));
const openStores: RunStore[] = [];

function tempDbUrl(name: string): string {
  return pathToFileURL(join(tempDir, `${name}-${randomUUID()}.db`)).href;
}

async function createFileStore(name: string): Promise<RunStore> {
  const store = await createTursoStore({ url: tempDbUrl(name) });
  openStores.push(store);
  return store;
}

runContract({
  label: "turso(file)",
  create: () => createFileStore("contract")
});

describe("createTursoStore file persistence", () => {
  it("recovers runs from disk after the store is closed and reopened", async () => {
    const url = tempDbUrl("durable");
    const id = randomUUID();
    const first = await createTursoStore({ url });
    await first.createRun({ id, state: sampleState(id, "running", "evidence") });
    await first.appendLedgerEvent(id, sampleEntry(1));
    await first.appendLedgerEvent(id, sampleEntry(2));
    await first.close?.();
    const second = await createTursoStore({ url });
    const loaded = await second.loadRun(id);
    expect(loaded?.status).toBe("running");
    expect(loaded?.phase).toBe("evidence");
    expect(loaded?.ledger.map((entry) => entry.sequence)).toEqual([1, 2]);
    await second.close?.();
  });
});

afterAll(async () => {
  for (const store of openStores) {
    try {
      await store.close?.();
    } catch {
      // already closed by the contract suite's dispose
    }
  }
  try {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // native libsql handles can linger on Windows; tmpdir cleanup is best-effort
  }
});

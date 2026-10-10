import { describe, expect, it } from "vitest";
import { createMemoryStore, createRunStore, createTursoStore } from "../../src/server/persistence/index.js";
import { runContract } from "./contract.js";

runContract({
  label: "memory",
  create: async () => createMemoryStore()
});

runContract({
  label: "turso(:memory:)",
  create: async () => createTursoStore({ url: ":memory:" })
});

describe("createRunStore factory", () => {
  it("returns the in-memory adapter when no turso url is configured", async () => {
    const store = await createRunStore({});
    expect(store.kind).toBe("memory");
  });

  it("returns the turso adapter when a turso url is configured", async () => {
    const store = await createRunStore({ tursoDatabaseUrl: ":memory:" });
    expect(store.kind).toBe("turso");
    await store.close?.();
  });
});

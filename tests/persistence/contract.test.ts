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

  it("falls back to memory when development explicitly allows an unavailable Turso store", async () => {
    const store = await createRunStore(
      { tursoDatabaseUrl: "libsql://offline.example", allowMemoryFallback: true },
      { tursoFactory: async () => Promise.reject(new Error("fetch failed")) }
    );
    expect(store.kind).toBe("memory");
  });

  it("still fails fast when Turso is unavailable and fallback is not allowed", async () => {
    await expect(
      createRunStore(
        { tursoDatabaseUrl: "libsql://offline.example" },
        { tursoFactory: async () => Promise.reject(new Error("fetch failed")) }
      )
    ).rejects.toThrow("fetch failed");
  });
});

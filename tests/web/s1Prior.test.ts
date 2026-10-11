/*
 * S1 Prior card — view-model tests. Fixtures are shaped EXACTLY like the
 * shared schemas and Zod-parsed (priorSchema / runStateSchema) to prove
 * shape fidelity: the model consumes what the server can actually persist.
 * The card must refuse to exist without a persisted Prior (honest loading,
 * never a fabricated prior — AGENTS §12).
 */
import { describe, expect, it } from "vitest";
import { briefSchema } from "../../src/shared/brief.js";
import { priorSchema, runStateSchema, type RunState } from "../../src/shared/run.js";
import { buildPriorModel, extractPriorComponents } from "../../src/web/screens/s1/s1Model.js";

/** Realistic DeepSeek Prior draft per PRIOR_SYSTEM_PROMPT (src/server/agent/prior.ts):
 *  a thesis plus members grouped by roles, each with a short rationale. */
const REAL_COMPOSITION = {
  thesis: "A ground-floor hub where downtown locals and visitors both feel they belong.",
  Anchor: {
    name: "Independent bookstore",
    rationale: "A quiet draw that gives people a reason to linger."
  },
  Social: [
    { name: "Wine bar", rationale: "Low-key social anchor for evenings." },
    { name: "Cafe counter", rationale: "Daytime glue between the other roles." }
  ],
  Discovery: [{ name: "Record shop" }],
  Experience: "A small listening room for weekend sets"
};

function priorFixture() {
  return priorSchema.parse({
    composition: REAL_COMPOSITION,
    generatedAt: "2026-10-10T18:02:11.000Z",
    model: "deepseek-chat",
    qlooUsed: false
  });
}

function runWithPrior(): RunState {
  const brief = briefSchema.parse({
    location: "Crosby Street, Manhattan, New York 10012, United States",
    coordinates: { lat: 40.72466201611901, lon: -73.9963011816144 },
    radius: 400,
    objective: "A ground-floor place where downtown locals and visitors both feel they belong."
  });
  return runStateSchema.parse({
    id: "run-prior-1",
    status: "investigating",
    phase: "investigation",
    brief,
    prior: priorFixture()
  });
}

describe("extractPriorComponents", () => {
  it("extracts thesis, named roles and array members from a real-shaped composition", () => {
    const components = extractPriorComponents(REAL_COMPOSITION);
    const labels = components.map((component) => component.label);

    expect(labels).toContain("thesis");
    expect(labels).toContain("Anchor");
    expect(labels).toContain("Independent bookstore");
    expect(labels).toContain("Wine bar");
    expect(labels).toContain("Record shop");
    expect(labels).toContain("Experience");
  });

  it("keeps rationales as details and never invents components for junk input", () => {
    const components = extractPriorComponents(REAL_COMPOSITION);
    const anchor = components.find((component) => component.label === "Anchor");
    expect(anchor?.detail).toBe("A quiet draw that gives people a reason to linger.");

    expect(extractPriorComponents(null)).toEqual([]);
    expect(extractPriorComponents("just a string")).toEqual([]);
    expect(extractPriorComponents(42)).toEqual([]);
    expect(extractPriorComponents({})).toEqual([]);
  });

  it("caps the component list and clips long details deterministically", () => {
    const wide: Record<string, unknown> = {};
    for (let i = 0; i < 20; i += 1) {
      wide[`Role${i}`] = { name: `Place ${i}`, rationale: "x".repeat(500) };
    }
    const components = extractPriorComponents(wide);
    expect(components.length).toBeLessThanOrEqual(12);
    for (const component of components) {
      if (component.detail !== null) {
        expect(component.detail.length).toBeLessThanOrEqual(240);
      }
    }
  });
});

describe("buildPriorModel", () => {
  it("builds the Prior reveal from a real-shaped persisted prior", () => {
    const model = buildPriorModel(runWithPrior());

    expect(model).not.toBeNull();
    expect(model?.heading).toBe("Before looking");
    expect(model?.lockedAtIso).toBe("2026-10-10T18:02:11.000Z");
    expect(model?.lockedAtLabel).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(model?.footer).toBe("No cultural data used.");
    expect(model?.model).toBe("deepseek-chat");
    expect(model?.components.map((component) => component.label)).toContain("Wine bar");
  });

  it("returns null without a persisted Prior — the route shows honest loading, not a card", () => {
    expect(buildPriorModel(null)).toBeNull();

    const priorless = runStateSchema.parse({
      id: "run-priorless",
      status: "prior_pending",
      phase: "prior"
    });
    expect(buildPriorModel(priorless)).toBeNull();
  });
});

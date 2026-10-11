/*
 * S1 Cultural DNA strip — parser + render tests.
 *
 * parseCulturalDna consumes the real RunState.culturalDna placeholder
 * (D-5.4: z.unknown() until the engine persists a shape) and either accepts
 * a recognisable { artists|films|brands: [{ name, local, city }] } shape or
 * returns [] — an honest empty strip, never invented entities (AGENTS §12/§13).
 * Render tests use react-dom/server so the node vitest environment can prove
 * what the strip actually puts on screen.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runStateSchema, type RunState } from "../../src/shared/run.js";
import { DnaStrip } from "../../src/web/screens/s1/DnaStrip.js";
import { parseCulturalDna } from "../../src/web/screens/s1/s1Model.js";

const REAL_DNA = {
  artists: [
    { name: "Alice Coltrane", local: 0.86, city: 0.31 },
    { name: "Sonic Youth", local: 0.62, city: 0.55 }
  ],
  films: [{ name: "Paris, Texas", local: 0.74, city: 0.4 }],
  brands: [{ name: "Muji", local: 0.2, city: 0.66 }]
};

function runWithDna(value: unknown): RunState {
  return runStateSchema.parse({
    id: "run-dna-1",
    status: "investigating",
    phase: "investigation",
    culturalDna: value
  });
}

describe("parseCulturalDna", () => {
  it("accepts the recognisable per-domain shape from a schema-parsed run", () => {
    const groups = parseCulturalDna(runWithDna(REAL_DNA).culturalDna);

    expect(groups.map((group) => group.domain)).toEqual(["Artists", "Films", "Brands"]);
    expect(groups[0]?.entities).toEqual([
      { name: "Alice Coltrane", local: 0.86, city: 0.31 },
      { name: "Sonic Youth", local: 0.62, city: 0.55 }
    ]);
    expect(groups[2]?.entities).toEqual([{ name: "Muji", local: 0.2, city: 0.66 }]);
  });

  it("scales 0..100 values onto the 0..1 track without inventing numbers", () => {
    const groups = parseCulturalDna({ artists: [{ name: "Can", local: 80, city: 25 }] });

    expect(groups).toEqual([{ domain: "Artists", entities: [{ name: "Can", local: 0.8, city: 0.25 }] }]);
  });

  it("returns [] for absent or unrecognisable data — the strip degrades honestly", () => {
    expect(parseCulturalDna(undefined)).toEqual([]);
    expect(parseCulturalDna(null)).toEqual([]);
    expect(parseCulturalDna("dense")).toEqual([]);
    expect(parseCulturalDna(runWithDna(undefined).culturalDna)).toEqual([]);
    expect(parseCulturalDna({ artists: "not-an-array" })).toEqual([]);
    expect(parseCulturalDna({ movies: [{ name: "X", local: 0.5, city: 0.5 }] })).toEqual([]);
  });

  it("drops malformed entities and never coerces them", () => {
    const groups = parseCulturalDna({
      artists: [
        { name: "Valid", local: 0.5, city: 0.5 },
        { name: "", local: 0.5, city: 0.5 },
        { local: 0.4, city: 0.4 },
        { name: "Negative", local: -1, city: 0.5 },
        { name: "Huge", local: 400, city: 0.5 },
        "plain string",
        42
      ]
    });

    expect(groups).toEqual([{ domain: "Artists", entities: [{ name: "Valid", local: 0.5, city: 0.5 }] }]);
  });

  it("caps each domain at six entities, keeping order", () => {
    const artists = Array.from({ length: 9 }, (_, index) => ({
      name: `Artist ${index}`,
      local: 0.1 * index,
      city: 0.05 * index
    }));
    const groups = parseCulturalDna({ artists });

    expect(groups[0]?.entities).toHaveLength(6);
    expect(groups[0]?.entities[0]?.name).toBe("Artist 0");
    expect(groups[0]?.entities[5]?.name).toBe("Artist 5");
  });
});

describe("DnaStrip rendering", () => {
  it("renders the honest empty state when nothing has been measured", () => {
    const html = renderToStaticMarkup(
      createElement(DnaStrip, { groups: [], collapsed: false, onToggle: () => {} })
    );

    expect(html).toContain("Cultural DNA");
    expect(html).toContain("Nothing has arrived yet.");
    expect(html).toContain("aria-expanded=\"true\"");
  });

  it("renders each real entity with its dumbbell and local/city percentages", () => {
    const groups = parseCulturalDna(runWithDna(REAL_DNA).culturalDna);
    const html = renderToStaticMarkup(
      createElement(DnaStrip, { groups, collapsed: false, onToggle: () => {} })
    );

    expect(html).toContain("Artists");
    expect(html).toContain("Films");
    expect(html).toContain("Brands");
    expect(html).toContain("Alice Coltrane");
    expect(html).toContain("86 / 31");
    expect(html).toContain("Muji");
    expect(html).toContain("20 / 66");
    expect(html).not.toContain("Nothing has arrived yet.");
  });

  it("hides the body when collapsed and exposes the toggle state", () => {
    const groups = parseCulturalDna(runWithDna(REAL_DNA).culturalDna);
    const html = renderToStaticMarkup(
      createElement(DnaStrip, { groups, collapsed: true, onToggle: () => {} })
    );

    expect(html).toContain("Show DNA");
    expect(html).toContain("aria-expanded=\"false\"");
    expect(html).not.toContain("Alice Coltrane");
  });
});

import type { CandidateComponent } from "../../src/server/engine/index.js";

export function makeComponent(
  overrides: Partial<CandidateComponent> & { id: string }
): CandidateComponent {
  return {
    role: "Anchor",
    tags: ["coffee"],
    exemplars: [{ id: `ex-${overrides.id}`, name: `Exemplar ${overrides.id}` }],
    provenancePath: {
      anchorPlace: `anchor-${overrides.id}`,
      qlooSignal: `tag:coffee-${overrides.id}`,
      resolvedCategory: `category-${overrides.id}`,
      exemplarSet: `ex-${overrides.id}`,
      tasteNeighborhood: `signal-${overrides.id}`
    },
    evidenceState: "measured",
    ...overrides
  };
}

export function makePool(ids: readonly string[]): CandidateComponent[] {
  return ids.map((id) => makeComponent({ id }));
}

import {
  type CandidateComponent,
  type TasteNeighborhood,
  neighborhoodDomains
} from "./types.js";

export type IdfLookup = Readonly<Record<string, number>>;

export function computeIdf(
  components: readonly CandidateComponent[],
  neighborhoods: readonly TasteNeighborhood[]
): IdfLookup {
  const componentIds = new Set(components.map((component) => component.id));
  const counts = new Map<string, number>();
  for (const neighborhood of neighborhoods) {
    if (!componentIds.has(neighborhood.componentId)) {
      continue;
    }
    const present = new Set<string>();
    for (const domain of neighborhoodDomains) {
      for (const entry of neighborhood.domains[domain]) {
        present.add(entry.entityId);
      }
    }
    for (const entityId of present) {
      counts.set(entityId, (counts.get(entityId) ?? 0) + 1);
    }
  }
  const k = components.length;
  const entityIds = [...counts.keys()].sort();
  const lookup: Record<string, number> = {};
  for (const entityId of entityIds) {
    const count = counts.get(entityId) ?? 0;
    lookup[entityId] = Math.max(0, Math.log(k / (1 + count)));
  }
  return lookup;
}

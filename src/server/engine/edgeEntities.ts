import { neighborhoodDomains, type NeighborhoodDomain, type TasteNeighborhood } from "./types.js";
import type { IdfLookup } from "./idf.js";

export const DEFAULT_EDGE_SHARED_ENTITY_CAP = 8;

export interface EdgeSharedEntity {
  entityId: string;
  domain: NeighborhoodDomain;
  aWeight: number;
  bWeight: number;
  idf: number;
  dotContribution: number;
}

export function sharedEntitiesForEdge(
  a: TasteNeighborhood,
  b: TasteNeighborhood,
  idf: IdfLookup,
  cap: number = DEFAULT_EDGE_SHARED_ENTITY_CAP
): EdgeSharedEntity[] {
  const contributions: EdgeSharedEntity[] = [];
  for (const domain of neighborhoodDomains) {
    const aWeights = new Map(a.domains[domain].map((entry) => [entry.entityId, entry.weight]));
    for (const entry of b.domains[domain]) {
      const aWeight = aWeights.get(entry.entityId);
      if (aWeight === undefined) {
        continue;
      }
      const idfValue = idf[entry.entityId] ?? 0;
      contributions.push({
        entityId: entry.entityId,
        domain,
        aWeight,
        bWeight: entry.weight,
        idf: idfValue,
        dotContribution: aWeight * idfValue * entry.weight * idfValue
      });
    }
  }
  contributions.sort((left, right) => {
    if (right.dotContribution !== left.dotContribution) {
      return right.dotContribution - left.dotContribution;
    }
    if (left.entityId !== right.entityId) {
      return left.entityId < right.entityId ? -1 : 1;
    }
    return left.domain < right.domain ? -1 : left.domain > right.domain ? 1 : 0;
  });
  const resolvedCap = Number.isFinite(cap) && cap >= 0 ? Math.floor(cap) : DEFAULT_EDGE_SHARED_ENTITY_CAP;
  return contributions.slice(0, resolvedCap);
}

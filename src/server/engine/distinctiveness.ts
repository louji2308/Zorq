import { z } from "zod";
import { EngineError, type TasteNeighborhood } from "./types.js";
import { cosineSimilarity } from "./graph.js";

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export interface WeightedEntity {
  entityId: string;
  weight: number;
}

const weightedEntitySchema = z.object({
  entityId: z.string().trim().min(1).max(200),
  weight: z.number().finite().positive()
});

function parseVector(vector: readonly WeightedEntity[], context: string): WeightedEntity[] {
  if (!Array.isArray(vector)) {
    throw new EngineError("INVALID_NEIGHBORHOOD_SIGNAL", `${context} must be an array`);
  }
  const parsed: WeightedEntity[] = [];
  const seen = new Set<string>();
  vector.forEach((entry, index) => {
    const result = weightedEntitySchema.safeParse(entry);
    if (!result.success) {
      throw new EngineError(
        "INVALID_NEIGHBORHOOD_SIGNAL",
        `${context} entry ${index} is invalid: ${describeIssues(result.error)}`
      );
    }
    if (seen.has(result.data.entityId)) {
      throw new EngineError(
        "INVALID_NEIGHBORHOOD_SIGNAL",
        `${context} contains duplicate entity "${result.data.entityId}"`
      );
    }
    seen.add(result.data.entityId);
    parsed.push(result.data);
  });
  return parsed;
}

export function computeDistinctiveness(
  site: readonly WeightedEntity[],
  city: readonly WeightedEntity[] | null | undefined
): number | null {
  if (city === null || city === undefined) {
    return null;
  }
  const siteEntries = parseVector(site, "site distinctiveness vector");
  const cityEntries = parseVector(city, "city distinctiveness vector");
  const entityIds = [
    ...new Set([
      ...siteEntries.map((entry) => entry.entityId),
      ...cityEntries.map((entry) => entry.entityId)
    ])
  ].sort();
  const siteWeights = new Map(siteEntries.map((entry) => [entry.entityId, entry.weight]));
  const cityWeights = new Map(cityEntries.map((entry) => [entry.entityId, entry.weight]));
  const siteVector = entityIds.map((entityId) => siteWeights.get(entityId) ?? 0);
  const cityVector = entityIds.map((entityId) => cityWeights.get(entityId) ?? 0);
  const cosine = cosineSimilarity(siteVector, cityVector);
  if (cosine === null) {
    return null;
  }
  return Math.min(1, Math.max(0, 1 - cosine));
}

export function computeDistinctivenessMap(
  neighborhoods: readonly TasteNeighborhood[],
  cityVectors: Readonly<Record<string, readonly WeightedEntity[] | null | undefined>>
): Readonly<Record<string, number | null>> {
  const sorted = [...neighborhoods].sort((left, right) =>
    left.componentId < right.componentId ? -1 : left.componentId > right.componentId ? 1 : 0
  );
  const result: Record<string, number | null> = {};
  const seen = new Set<string>();
  for (const neighborhood of sorted) {
    if (seen.has(neighborhood.componentId)) {
      throw new EngineError(
        "INVALID_NEIGHBORHOOD_SIGNAL",
        `duplicate neighborhood for component "${neighborhood.componentId}"`
      );
    }
    seen.add(neighborhood.componentId);
    const city = Object.hasOwn(cityVectors, neighborhood.componentId)
      ? cityVectors[neighborhood.componentId]
      : null;
    result[neighborhood.componentId] = computeDistinctiveness(
      neighborhood.domains.artist,
      city
    );
  }
  return Object.freeze(result);
}

import type {
  QlooTagSuggestionsRequest,
  QlooTagSuggestionsResponse
} from "../../shared/routes.js";
import type { QlooGateway } from "./gateway.js";

const EMPTY_MESSAGE = "Qloo found no cultural signals for this goal yet.";
const DEGRADED_MESSAGE = "Qloo could not complete the tag read. You can continue without adaptive tags.";
const MAX_OBJECTIVE_TAG_QUERIES = 4;
const OBJECTIVE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "because",
  "both",
  "by",
  "can",
  "does",
  "exist",
  "feel",
  "for",
  "from",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "should",
  "so",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "together",
  "want",
  "where",
  "while",
  "with",
  "would"
]);

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value !== ""))];
}

function buildObjectiveTagQueries(objective: string): string[] {
  const normalizedObjective = objective.trim().replace(/\s+/g, " ");
  if (normalizedObjective === "") return [];

  const queries = [normalizedObjective];
  const fragments = normalizedObjective
    .split(/[,;:!?]+|\b(?:and|or|with|where|while|because|so|that)\b/gi)
    .map((fragment) => fragment.trim().replace(/^(?:a|an|the)\s+/i, ""))
    .filter((fragment) => fragment !== "" && fragment !== normalizedObjective);
  queries.push(...fragments);

  const contentWords = normalizedObjective
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !OBJECTIVE_STOP_WORDS.has(word.toLocaleLowerCase()));
  queries.push(...contentWords);

  return unique(queries).slice(0, MAX_OBJECTIVE_TAG_QUERIES);
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export async function buildQlooTagSuggestions(
  gateway: QlooGateway,
  request: QlooTagSuggestionsRequest
): Promise<QlooTagSuggestionsResponse> {
  // Measured live before this change: the objective queries ran one after
  // another (~0.6-0.8 s each, 2-4 of them), so the preview spent ~2.5-3 s
  // resolving signals before it could even ask for insights. They are
  // independent reads of the same objective, so they run together now and are
  // merged in query order below — same dedupe, same cap, same envelope as the
  // sequential loop, one upstream round trip instead of up to four.
  const queries = buildObjectiveTagQueries(request.objective);
  const resolutions = await Promise.all(
    queries.map((query) => gateway.resolveTags({ query, take: 6 }, { transport: "rest" }))
  );

  const objectiveSignalIds: string[] = [];
  let resolutionDegraded = false;
  for (const resolved of resolutions) {
    if (resolved.status === "degraded" || resolved.status === "needs_input" || resolved.status === "partial") {
      resolutionDegraded = true;
    }
    for (const tag of resolved.results.tags) {
      const id = tag.id.trim();
      if (id !== "" && !objectiveSignalIds.includes(id)) {
        objectiveSignalIds.push(id);
      }
    }
    if (objectiveSignalIds.length >= 10) break;
  }
  const signalTags = [...new Set([...request.selectedTagIds, ...objectiveSignalIds])].slice(0, 10);

  if (signalTags.length === 0) {
    if (resolutionDegraded && request.selectedTagIds.length === 0) {
      return { status: "degraded", tags: [], message: DEGRADED_MESSAGE };
    }
    return { status: "empty", tags: [], message: EMPTY_MESSAGE };
  }

  const insights = await gateway.insights(
    {
      filterType: "tag",
      signalTags,
      signalLocation: request.location,
      take: 8,
      explainability: true
    },
    { transport: "rest" }
  );

  if (insights.status === "degraded" || insights.status === "needs_input" || insights.status === "partial") {
    return { status: "degraded", tags: [], message: DEGRADED_MESSAGE };
  }

  const selectedIds = new Set(request.selectedTagIds);
  const seenLabels = new Set<string>();
  const tags = (insights.results.tags ?? [])
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag }) => tag.name !== undefined && !selectedIds.has(tag.id))
    .sort((left, right) => {
      const leftScore = left.tag.score ?? Number.NEGATIVE_INFINITY;
      const rightScore = right.tag.score ?? Number.NEGATIVE_INFINITY;
      return rightScore - leftScore || left.index - right.index;
    })
    .filter(({ tag }) => {
      const label = normalized(tag.name ?? "");
      if (label === "" || seenLabels.has(label)) return false;
      seenLabels.add(label);
      return true;
    })
    .slice(0, 8)
    .map(({ tag }) => ({
      id: tag.id,
      label: tag.name!,
      score: tag.score ?? null,
      source: "qloo" as const
    }));

  return tags.length > 0 ? { status: "ok", tags } : { status: "empty", tags: [], message: EMPTY_MESSAGE };
}

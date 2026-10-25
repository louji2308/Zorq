import type {
  QlooTagSuggestionsRequest,
  QlooTagSuggestionsResponse
} from "../../shared/routes.js";
import type { QlooGateway } from "./gateway.js";

const EMPTY_MESSAGE = "Qloo found no cultural signals for this goal yet.";
const DEGRADED_MESSAGE = "Qloo could not complete the tag read. You can continue without adaptive tags.";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export async function buildQlooTagSuggestions(
  gateway: QlooGateway,
  request: QlooTagSuggestionsRequest
): Promise<QlooTagSuggestionsResponse> {
  const resolved = await gateway.resolveTags(
    { query: request.objective, take: 6 },
    { transport: "rest" }
  );
  const objectiveSignalIds = resolved.results.tags.map((tag) => tag.id).filter((id) => id.trim() !== "");
  const signalTags = [...new Set([...request.selectedTagIds, ...objectiveSignalIds])].slice(0, 10);

  if (signalTags.length === 0) {
    return { status: "empty", tags: [], message: EMPTY_MESSAGE };
  }

  if (resolved.status === "degraded" || resolved.status === "needs_input") {
    if (request.selectedTagIds.length === 0) {
      return { status: "degraded", tags: [], message: DEGRADED_MESSAGE };
    }
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

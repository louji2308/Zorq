import type { Brief } from "../../../src/shared/brief.js";
import type { Prior } from "../../../src/shared/run.js";
import { QlooUpstreamError } from "../../../src/server/qloo/index.js";
import type {
  QlooEnvelope,
  QlooGateway,
  QlooOperation
} from "../../../src/server/qloo/index.js";
import { DEEPSEEK_MODEL } from "../../../src/server/agent/llm.js";
import type {
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmToolCall,
  LlmUsage
} from "../../../src/server/agent/llm.js";

export const TEST_NOW = Date.parse("2026-10-08T12:00:00.000Z");

export const TEST_BRIEF: Brief = {
  location: "Williamsburg, Brooklyn, NY",
  coordinates: { lat: 40.7144, lon: -73.9614 },
  objective: "Design what should exist together on a narrow mixed-use corner site",
  constraints: ["No late night", "Ground-floor only"],
  admiredPlaces: ["Devoción", "Nitehawk Cinema"]
};

export const TEST_PRIOR: Prior = {
  composition: {
    thesis: "A daytime cultural corner anchored by coffee and film",
    members: [
      { role: "Anchor", name: "Coffee roastery", why: "matches the brief's morning footfall" },
      { role: "Discovery", name: "Micro-cinema", why: "adds a distinct cultural reason to visit" }
    ]
  },
  generatedAt: "2026-10-08T12:00:00.000Z",
  model: DEEPSEEK_MODEL,
  qlooUsed: false
};

export const TEST_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FakeLlmResponse {
  content?: string | null;
  toolCalls?: LlmToolCall[];
  usage?: LlmUsage;
  durationMs?: number;
}

export interface FakeLlm {
  client: LlmClient;
  calls: LlmCompletionRequest[];
}

export function fakeLlm(responses: Array<FakeLlmResponse | ((request: LlmCompletionRequest) => FakeLlmResponse)>): FakeLlm {
  const calls: LlmCompletionRequest[] = [];
  const client: LlmClient = {
    async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
      const index = calls.length;
      calls.push({ ...request, messages: [...request.messages] });
      const scripted = responses[index];
      if (scripted === undefined) {
        throw new Error(`fake llm: unexpected call #${index + 1} ("${request.label}") with no scripted response`);
      }
      const response = typeof scripted === "function" ? scripted(request) : scripted;
      const toolCalls = response.toolCalls ?? [];
      return {
        model: DEEPSEEK_MODEL,
        content: response.content ?? null,
        toolCalls,
        usage: response.usage ?? { promptTokens: 1200, completionTokens: 480, totalTokens: 1680 },
        durationMs: response.durationMs ?? 12,
        finishReason: toolCalls.length > 0 ? "tool_calls" : "stop"
      };
    }
  };
  return { client, calls };
}

export interface FakeGatewayCall {
  operation: QlooOperation;
  request: unknown;
}

export interface FakeGateway {
  gateway: QlooGateway;
  calls: FakeGatewayCall[];
}

export interface FakeGatewayOptions {
  onCall?: (call: FakeGatewayCall) => QlooEnvelope<unknown> | Promise<QlooEnvelope<unknown>>;
}

const ENTITY = {
  entityId: "urn:entity:place-blue-note",
  name: "Blue Note Corner",
  type: "place",
  affinity: 0.87,
  popularity: 0.61
};

const TAG = { id: "tag-jazz-1", name: "jazz", type: "Interest", popularity: 0.72 };

function defaultResults(operation: QlooOperation): { results: unknown; resultCount: number } {
  switch (operation) {
    case "resolveTags":
      return { results: { tags: [TAG] }, resultCount: 1 };
    case "capabilities":
      return {
        results: { transport: "rest", endpoint: "fake://qloo", ready: true, supportedOperationIds: [] },
        resultCount: 1
      };
    case "triangulate":
      return {
        results: { tags: [TAG], a: [TAG], b: [TAG], matchEntities: [ENTITY] },
        resultCount: 1
      };
    case "insights":
      return { results: { entities: [ENTITY], heatmap: [] }, resultCount: 1 };
    default:
      return { results: { entities: [ENTITY] }, resultCount: 1 };
  }
}

export function okEnvelope(
  operation: QlooOperation,
  overrides: Partial<QlooEnvelope<unknown>> = {}
): QlooEnvelope<unknown> {
  const base = defaultResults(operation);
  return {
    status: "ok",
    operation,
    transport: "rest",
    cache: "live",
    ...base,
    provenance: {
      transport: "rest",
      operation,
      endpoint: "https://hackathon.api.qloo.com/fake",
      durationMs: 42,
      correlationId: "fake-correlation"
    },
    warnings: [],
    ...overrides
  };
}

export function fakeGateway(options: FakeGatewayOptions = {}): FakeGateway {
  const calls: FakeGatewayCall[] = [];

  async function record<TReq, TRes>(operation: QlooOperation, request: TReq): Promise<QlooEnvelope<TRes>> {
    const call: FakeGatewayCall = { operation, request };
    calls.push(call);
    const envelope =
      options.onCall !== undefined ? await options.onCall(call) : okEnvelope(operation);
    return envelope as QlooEnvelope<TRes>;
  }

  const gateway: QlooGateway = {
    capabilities: () => record("capabilities", {}),
    search: (request) => record("search", request),
    resolveTags: (request) => record("resolveTags", request),
    insights: (request) => record("insights", request),
    describe: (request) => record("describe", request),
    bridge: (request) => record("bridge", request),
    replace: (request) => record("replace", request),
    triangulate: (request) => record("triangulate", request),
    get stats() {
      return { budgetUsed: calls.length, budgetRemaining: Math.max(0, 180 - calls.length), cacheSize: 0, cacheHits: 0 };
    },
    close: async () => {}
  };

  return { gateway, calls };
}

export function outageError(): QlooUpstreamError {
  return new QlooUpstreamError("DEPENDENCY_UNAVAILABLE", "Qloo is unreachable (simulated outage)", {
    retryable: false
  });
}

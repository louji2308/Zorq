import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "../../shared/errors.js";
import {
  QlooUpstreamError,
  malformedResponse,
  scrubSecrets,
  truncateText,
  upstreamDetail
} from "./errors.js";
import { guardMessage } from "./guards.js";
import type { QlooTransport, QlooTransportCall, TransportResponse } from "./transport.js";
import { asNumber, asRecord, asString, asStringArray, upstreamResultCount } from "./transport.js";
import type { BridgeRequest, DescribeRequest, QlooOperation, ReplaceRequest, ResolveTagsRequest, TriangulateRequest } from "./types.js";

export const EXPECTED_QLOO_CONTRACT_CHECKSUM =
  "sha256:762bdcc5e14ff797b6de739d2658a83f78af35e68d7a5a3449455be6046924f5";

export const MCP_ENDPOINT_LABEL = "stdio:@qloo/qloo-harness/dist/mcp.js";

const HARNESS_ENTRY_URL = new URL("../../../node_modules/@qloo/qloo-harness/dist/bin.js", import.meta.url);
const HARNESS_MCP_URL = new URL("mcp.js", HARNESS_ENTRY_URL);

const envelopeSchema = {
  status: ["ok", "empty", "needs_input", "partial", "degraded", "error"]
} as const;

interface McpToolCall {
  name: string;
  args: Record<string, unknown>;
}

export function buildMcpToolCall(operation: QlooOperation, request: unknown): McpToolCall {
  switch (operation) {
    case "capabilities":
      return { name: "qloo_capabilities", args: {} };
    case "resolveTags": {
      const typed = request as ResolveTagsRequest;
      return {
        name: "qloo_find_tags",
        args: { query: typed.query, ...(typed.take !== undefined ? { limit: typed.take } : {}) }
      };
    }
    case "describe": {
      const typed = request as DescribeRequest;
      return {
        name: "qloo_describe",
        args: { entity: typed.entity, ...(typed.type !== undefined ? { type: typed.type } : {}) }
      };
    }
    case "bridge": {
      const typed = request as BridgeRequest;
      return {
        name: "qloo_recommend",
        args: {
          target_type: typed.targetType,
          ...(typed.signals !== undefined ? { signals: [...typed.signals] } : {}),
          ...(typed.signalTags !== undefined ? { signal_tags: [...typed.signalTags] } : {}),
          ...(typed.signalLocation !== undefined ? { signal_location: typed.signalLocation } : {}),
          ...(typed.filterLocation !== undefined ? { filter_location: typed.filterLocation } : {}),
          ...(typed.demographic !== undefined ? { demographic: typed.demographic } : {}),
          ...(typed.includeTags !== undefined ? { include_tags: [...typed.includeTags] } : {}),
          ...(typed.excludeTags !== undefined ? { exclude_tags: [...typed.excludeTags] } : {}),
          ...(typed.limit !== undefined ? { limit: typed.limit } : {})
        }
      };
    }
    case "replace": {
      const typed = request as ReplaceRequest;
      return {
        name: "qloo_rank",
        args: {
          options: [...typed.options],
          option_type: typed.optionType,
          ...(typed.signals !== undefined ? { signals: [...typed.signals] } : {}),
          ...(typed.signalLocation !== undefined ? { signal_location: typed.signalLocation } : {}),
          ...(typed.demographic !== undefined ? { demographic: typed.demographic } : {}),
          ...(typed.includeTags !== undefined ? { include_tags: [...typed.includeTags] } : {}),
          ...(typed.excludeTags !== undefined ? { exclude_tags: [...typed.excludeTags] } : {})
        }
      };
    }
    case "triangulate": {
      const typed = request as TriangulateRequest;
      return {
        name: "qloo_compare_audiences",
        args: {
          group_a: [...typed.groupA],
          group_b: [...typed.groupB],
          ...(typed.targetType !== undefined ? { target_type: typed.targetType } : {}),
          ...(typed.limit !== undefined ? { limit: typed.limit } : {})
        }
      };
    }
    case "search":
    case "insights":
      throw guardMessage(`operation ${operation} is only available over the rest transport`);
  }
}

function harnessEntry(): string {
  return fileURLToPath(HARNESS_ENTRY_URL);
}

export interface HarnessMcpLaunch {
  entry: string;
  command: string;
  args: string[];
}

export function harnessMcpLaunch(): HarnessMcpLaunch {
  const fastEntry = fileURLToPath(HARNESS_MCP_URL);
  if (existsSync(fastEntry)) {
    const bootstrap = `import { runQlooMcp } from ${JSON.stringify(HARNESS_MCP_URL.href)}; runQlooMcp([]);`;
    return {
      entry: fastEntry,
      command: process.execPath,
      args: ["--input-type=module", "-e", bootstrap]
    };
  }
  const entry = harnessEntry();
  return { entry, command: process.execPath, args: [entry, "mcp"] };
}

function extractToolPayload(result: unknown, path: string, secrets: ReadonlyArray<string | undefined>): unknown {
  const record = asRecord(result);
  const structured = record?.structuredContent;
  if (structured !== undefined && structured !== null) {
    return structured;
  }
  const content = record?.content;
  if (Array.isArray(content)) {
    for (const entry of content) {
      const item = asRecord(entry);
      if (item?.type === "text" && typeof item.text === "string") {
        try {
          return JSON.parse(item.text);
        } catch {
          throw malformedResponse(path, "MCP tool text content was not valid JSON", secrets);
        }
      }
    }
  }
  throw malformedResponse(path, "MCP tool result carried no structured payload", secrets);
}

function mcpFailure(operation: string, error: unknown, secrets: ReadonlyArray<string | undefined>): QlooUpstreamError {
  const raw = error instanceof Error ? error.message : String(error);
  const detail = scrubSecrets(truncateText(raw), secrets);
  const retryable = /timeout|timed out|RequestTimeout|EPIPE|closed|terminated|not connected/i.test(raw);
  return new QlooUpstreamError(
    "DEPENDENCY_UNAVAILABLE",
    `Qloo MCP ${operation} failed: ${detail}`,
    { retryable },
    upstreamDetail(detail)
  );
}

export function normalizeMcpPayload(
  operation: QlooOperation,
  toolName: string,
  payload: unknown,
  durationMs: number,
  secrets: ReadonlyArray<string | undefined> = []
): TransportResponse {
  const path = `tools/call ${toolName}`;
  const envelope = asRecord(payload);
  if (envelope === undefined) {
    throw malformedResponse(path, "MCP envelope was not an object", secrets);
  }

  if (
    operation === "capabilities" &&
    asString(envelope.capabilities_tool) === "qloo_capabilities" &&
    asRecord(envelope.adapter) !== undefined
  ) {
    const adapter = asRecord(envelope.adapter);
    const ready =
      typeof envelope.ready === "boolean"
        ? envelope.ready
        : typeof adapter?.ready === "boolean"
          ? adapter.ready
          : undefined;
    const supported = asStringArray(adapter?.supported_operation_ids) ?? asStringArray(envelope.supported_operation_ids);
    const contractChecksum = asString(envelope.contract_checksum);
    const response: TransportResponse = {
      payload,
      durationMs,
      endpoint: MCP_ENDPOINT_LABEL,
      requests: [{ method: "POST", path: "tools/call", params: { tool: toolName } }],
      upstreamStatus: ready === false ? "degraded" : "ok"
    };
    if (supported !== undefined) {
      response.upstreamResultCount = supported.length;
    }
    if (contractChecksum !== undefined) {
      response.contractChecksum = contractChecksum;
      response.contractChecksumChanged = contractChecksum !== EXPECTED_QLOO_CONTRACT_CHECKSUM;
    }
    return response;
  }

  const status = envelope.status as string | undefined;
  if (typeof status !== "string" || !(envelopeSchema.status as readonly string[]).includes(status)) {
    throw malformedResponse(path, "MCP envelope was missing a valid status", secrets);
  }
  if (status === "error") {
    const errorRecord = asRecord(envelope.error);
    const code = asString(errorRecord?.code) ?? "QLOO_ERROR";
    const summary = asString(envelope.summary);
    const recovery = asString(errorRecord?.recovery);
    const detail = scrubSecrets(
      truncateText(`Qloo MCP ${operation} failed (${code})${summary === undefined ? "" : `: ${summary}`}`),
      secrets
    );
    throw new QlooUpstreamError(
      "DEPENDENCY_UNAVAILABLE",
      detail,
      { retryable: errorRecord?.retryable === true },
      upstreamDetail(recovery ?? code)
    );
  }

  const execution = asRecord(envelope.execution);
  const correlationId = asString(execution?.correlation_id);
  const contractChecksum = asString(envelope.contract_checksum);
  const resultCount = asNumber(envelope.result_count) ?? upstreamResultCount(payload, "results");
  const warnings = asStringArray(envelope.warnings);
  const explainability = envelope.explainability;

  const response: TransportResponse = {
    payload,
    durationMs,
    endpoint: MCP_ENDPOINT_LABEL,
    requests: [{ method: "POST", path: "tools/call", params: { tool: toolName } }],
    upstreamStatus: status as TransportResponse["upstreamStatus"],
    upstreamResultCount: resultCount
  };
  if (correlationId !== undefined) {
    response.correlationId = correlationId;
  }
  if (contractChecksum !== undefined) {
    response.contractChecksum = contractChecksum;
    response.contractChecksumChanged = contractChecksum !== EXPECTED_QLOO_CONTRACT_CHECKSUM;
  }
  if (envelope.interpretation !== undefined) {
    response.interpretation = envelope.interpretation;
  }
  if (envelope.resolution !== undefined) {
    response.resolution = envelope.resolution;
  }
  if (warnings !== undefined) {
    response.warnings = warnings;
  }
  if (explainability !== undefined) {
    response.explainability = explainability;
  }
  return response;
}

export class McpTransport implements QlooTransport {
  #client: Client | undefined;
  #connecting: Promise<void> | undefined;
  #closed = false;

  async #ensureClient(settings: QlooTransportCall["settings"]): Promise<Client> {
    if (this.#closed) {
      throw new QlooUpstreamError("SERVICE_UNAVAILABLE", "Qloo MCP transport is closed", { retryable: false });
    }
    if (this.#client !== undefined) {
      return this.#client;
    }
    if (this.#connecting === undefined) {
      this.#connecting = this.#connect(settings);
    }
    try {
      await this.#connecting;
    } catch (error) {
      this.#connecting = undefined;
      throw error;
    }
    this.#connecting = undefined;
    if (this.#client === undefined) {
      throw new QlooUpstreamError("DEPENDENCY_UNAVAILABLE", "Qloo MCP transport did not start", { retryable: true });
    }
    return this.#client;
  }

  async #connect(settings: QlooTransportCall["settings"]): Promise<void> {
    const launch = harnessMcpLaunch();
    if (!existsSync(launch.entry)) {
      throw new ApiError(
        "SERVICE_UNAVAILABLE",
        "Qloo MCP harness entry point is missing; reinstall @qloo/qloo-harness",
        [{ path: "qloo.mcp", message: launch.entry }]
      );
    }
    const transport = new StdioClientTransport({
      command: launch.command,
      args: launch.args,
      env: {
        QLOO_BASE_URL: settings.baseUrl,
        QLOO_TRUSTED_BASE_URL: settings.baseUrl,
        QLOO_API_KEY: settings.apiKey
      }
    });
    transport.onclose = () => {
      this.#client = undefined;
      this.#connecting = undefined;
    };
    const client = new Client({ name: "zorq-qloo-gateway", version: "0.1.0" });
    try {
      await client.connect(transport, { timeout: settings.mcpConnectTimeoutMs });
    } catch (error) {
      await client.close().catch(() => undefined);
      throw mcpFailure("initialize", error, [settings.apiKey]);
    }
    this.#client = client;
  }

  #reset(): void {
    const client = this.#client;
    this.#client = undefined;
    this.#connecting = undefined;
    if (client !== undefined) {
      void client.close().catch(() => undefined);
    }
  }

  async call(input: QlooTransportCall): Promise<TransportResponse> {
    const { operation, request, settings } = input;
    const secrets: ReadonlyArray<string | undefined> = [settings.apiKey];
    const toolCall = buildMcpToolCall(operation, request);
    const client = await this.#ensureClient(settings);
    const startedAt = Date.now();

    let result: unknown;
    try {
      result = await client.callTool({ name: toolCall.name, arguments: toolCall.args }, undefined, {
        timeout: settings.mcpCallTimeoutMs
      });
    } catch (error) {
      if (/not connected|EPIPE|closed|terminated/i.test(error instanceof Error ? error.message : String(error))) {
        this.#reset();
      }
      throw mcpFailure(operation, error, secrets);
    }

    const payload = extractToolPayload(result, `tools/call ${toolCall.name}`, secrets);
    return normalizeMcpPayload(operation, toolCall.name, payload, Date.now() - startedAt, secrets);
  }

  async close(): Promise<void> {
    this.#closed = true;
    const client = this.#client;
    this.#client = undefined;
    this.#connecting = undefined;
    if (client !== undefined) {
      await client.close().catch(() => undefined);
    }
  }
}

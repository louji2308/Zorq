import { describe, expect, it } from "vitest";
import { QlooUpstreamError } from "../../src/server/qloo/index.js";
import {
  EXPECTED_QLOO_CONTRACT_CHECKSUM,
  MCP_ENDPOINT_LABEL,
  harnessMcpLaunch,
  normalizeMcpPayload
} from "../../src/server/qloo/mcpTransport.js";

const CAPABILITIES_MANIFEST = {
  manifest_schema_version: "1.1",
  contract_version: "1.0.0",
  capabilities_tool: "qloo_capabilities",
  result_schema_version: "1.0-preview.1",
  operations: [{ id: "recommend" }, { id: "rank" }],
  upstream: { documentation_url: "https://docs.example" },
  contract_checksum: EXPECTED_QLOO_CONTRACT_CHECKSUM,
  adapter: {
    ready: true,
    compatibility: "compatible",
    supported_operation_ids: ["recommend", "rank"]
  }
};

describe("MCP harness launch", () => {
  it("starts the canonical MCP server directly instead of importing the heavy CLI router", () => {
    const launch = harnessMcpLaunch();

    expect(launch.entry.endsWith("mcp.js")).toBe(true);
    expect(launch.command).toBe(process.execPath);
    expect(launch.args[0]).toBe("--input-type=module");
    expect(launch.args.join(" ")).toContain("runQlooMcp");
  });
});

describe("MCP payload normalization", () => {
  it("accepts the capabilities manifest instead of requiring a result envelope status", () => {
    const response = normalizeMcpPayload("capabilities", "qloo_capabilities", CAPABILITIES_MANIFEST, 42);

    expect(response.payload).toBe(CAPABILITIES_MANIFEST);
    expect(response.endpoint).toBe(MCP_ENDPOINT_LABEL);
    expect(response.durationMs).toBe(42);
    expect(response.upstreamStatus).toBe("ok");
    expect(response.upstreamResultCount).toBe(2);
    expect(response.contractChecksum).toBe(EXPECTED_QLOO_CONTRACT_CHECKSUM);
    expect(response.contractChecksumChanged).toBe(false);
    expect(response.requests).toEqual([{ method: "POST", path: "tools/call", params: { tool: "qloo_capabilities" } }]);
  });

  it("reports a manifest that is present but not ready as degraded", () => {
    const response = normalizeMcpPayload(
      "capabilities",
      "qloo_capabilities",
      { ...CAPABILITIES_MANIFEST, adapter: { ...CAPABILITIES_MANIFEST.adapter, ready: false } },
      1
    );

    expect(response.upstreamStatus).toBe("degraded");
  });

  it("keeps rejecting a non-capabilities payload without a valid status", () => {
    let caught: unknown;
    try {
      normalizeMcpPayload("search", "qloo_search", { results: { entities: [] } }, 1);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(QlooUpstreamError);
    expect((caught as QlooUpstreamError).message).toMatch(/unexpected response/);
    expect((caught as QlooUpstreamError).details?.[0]?.message).toMatch(/missing a valid status/);
  });

  it("still projects a normal result envelope", () => {
    const response = normalizeMcpPayload(
      "search",
      "qloo_search",
      {
        status: "ok",
        result_count: 1,
        execution: { correlation_id: "corr-1" },
        contract_checksum: "sha256:abc",
        warnings: ["thin data"]
      },
      7
    );

    expect(response.upstreamStatus).toBe("ok");
    expect(response.upstreamResultCount).toBe(1);
    expect(response.correlationId).toBe("corr-1");
    expect(response.contractChecksumChanged).toBe(true);
    expect(response.warnings).toEqual(["thin data"]);
  });

  it("turns an error envelope into a QlooUpstreamError", () => {
    expect(() =>
      normalizeMcpPayload(
        "search",
        "qloo_search",
        {
          status: "error",
          error: { code: "RATE_LIMITED", retryable: true, recovery: "retry later" },
          summary: "too many requests"
        },
        1
      )
    ).toThrow(/RATE_LIMITED/);
  });
});

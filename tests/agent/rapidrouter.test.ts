import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";
import {
  RAPIDROUTER_BASE_URL,
  RAPIDROUTER_MODEL,
  createRapidRouterLlmClient
} from "../../src/server/agent/llm.js";

describe("Rapid Router LLM boundary", () => {
  it("loads only the Rapid Router server key from configuration", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      APP_BASE_URL: "http://localhost:3000",
      RAPIDROUTER_API_KEY: "rapid-router-test-key"
    });

    expect(config.rapidRouterApiKey).toBe("rapid-router-test-key");
  });

  it("sends every completion to Rapid Router with the locked Qwen model", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const client = createRapidRouterLlmClient({
      apiKey: "rapid-router-test-key",
      fetch: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(
          JSON.stringify({
            model: RAPIDROUTER_MODEL,
            choices: [{ message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
      now: () => 1_000
    });

    const result = await client.complete({
      label: "test",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(requestUrl).toBe(`${RAPIDROUTER_BASE_URL}/chat/completions`);
    expect(new Headers(requestInit?.headers).get("authorization")).toBe("Bearer rapid-router-test-key");
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      model: "qwen/qwen3.7-flash-2026-07-15",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 4096
    });
    expect(result.content).toBe("hello");
    expect(result.model).toBe(RAPIDROUTER_MODEL);
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";
import { HACKATHON_QLOO_BASE_URL } from "../../src/server/qloo/config.js";
import { createQlooGateway, type QlooGateway } from "../../src/server/qloo/gateway.js";

const enabled = process.env.LIVE_QLOO === "1" && Boolean(process.env.QLOO_API_KEY);

function makeGateway(): QlooGateway {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "test",
    APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000"
  });
  return createQlooGateway({ config });
}

describe.skipIf(!enabled)("live Qloo gateway (LIVE_QLOO=1 with QLOO_API_KEY set)", () => {
  const open: QlooGateway[] = [];

  function liveGateway(): QlooGateway {
    const gateway = makeGateway();
    open.push(gateway);
    return gateway;
  }

  afterAll(async () => {
    await Promise.all(open.map((gateway) => gateway.close()));
  });

  it("serves REST capabilities locally without contacting Qloo", async () => {
    const envelope = await liveGateway().capabilities({ transport: "rest" });
    expect(envelope.status).toBe("ok");
    expect(envelope.transport).toBe("rest");
    expect(envelope.results).toMatchObject({ transport: "rest", ready: true, endpoint: HACKATHON_QLOO_BASE_URL });
    expect(envelope.resultCount).toBe(1);
  }, 30_000);

  it("resolves real tags over the MCP harness", async () => {
    const envelope = await liveGateway().resolveTags({ query: "jazz", take: 5 });
    expect(envelope.transport).toBe("mcp");
    expect(envelope.status).toBe("ok");
    expect(envelope.results.tags.length).toBeGreaterThan(0);
    expect(envelope.resultCount).toBe(envelope.results.tags.length);
    expect(envelope.results.tags[0]?.id).toBeTruthy();
  }, 120_000);

  it("searches real entities over REST", async () => {
    const envelope = await liveGateway().search({ query: "coffee", types: ["place"], take: 3 });
    expect(envelope.transport).toBe("rest");
    expect(envelope.status).toBe("ok");
    expect(envelope.results.entities.length).toBeGreaterThan(0);
    expect(envelope.results.entities.every((entity) => entity.entityId.length > 0)).toBe(true);
    expect(envelope.provenance.endpoint).toBe(HACKATHON_QLOO_BASE_URL);
  }, 60_000);
});

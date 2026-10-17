/* GET /api/method — Phase 9 route (Product Specification §14, §17; Tools & Requirements §10-11).
 * The endpoint serves static in-repo content with no orchestrator, store or gateway — so
 * a judge can always read /method, even when none of the run machinery is configured.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { methodResponseSchema } from "../../src/shared/index.js";
import { createApp } from "../../src/server/app.js";
import { createLogger } from "../../src/server/logger.js";
import { METHOD_TITLE, methodContent } from "../../src/server/method.js";
import { startServer, type RunningServer } from "../support/http.js";

describe("GET /api/method", () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startServer(createApp(createLogger("test")));
  });

  afterAll(async () => {
    await server.close();
  });

  it("answers 200 with the validated canonical method content", async () => {
    const response = await fetch(`${server.baseUrl}/api/method`);
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const parsed = methodResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);

    const content = (body as { method: Record<string, unknown> }).method;
    expect(content.title).toBe(METHOD_TITLE);
    expect((content.whatQlooMeasures as string[]).length).toBeGreaterThan(0);
    expect((content.whatZorqComputes as string[]).length).toBeGreaterThan(0);
    expect((content.whatTheLlmGenerates as string[]).length).toBeGreaterThan(0);
    expect(
      (content.heuristics as Array<{ editable: boolean }>).some((entry) => entry.editable)
    ).toBe(true);
    expect((content.workedExample as { steps: string[] }).steps.length).toBeGreaterThan(2);
    expect((content.knownLimits as string[]).length).toBeGreaterThan(3);
    // W-9.4 clause pins: triangulation is a first-class formula and the worked
    // example walks triangulation + evidence grade; the type note is two
    // sentences on the Bricolage/bricoleur idea (Final Design §7.7 items 3–4).
    expect((content.formulas as string[]).some((f) => /triangulat/i.test(f))).toBe(true);
    const steps = (content.workedExample as { steps: string[] }).steps.join(" ");
    expect(steps).toMatch(/triangulat/i);
    expect(steps).toMatch(/evidence grade/i);
    expect(typeof content.typeNote).toBe("string");
    expect((content.typeNote as string).length).toBeGreaterThan(40);
    expect(content.evidenceVsInference).toEqual(
      expect.objectContaining({
        badges: expect.arrayContaining([
          expect.objectContaining({ badge: "[Qloo]" }),
          expect.objectContaining({ badge: "[Zorq heuristic]" }),
          expect.objectContaining({ badge: "[LLM]" })
        ])
      })
    );

    // The served body is the canonical content, field-for-field (single source of truth).
    const original = methodResponseSchema.parse({ method: methodContent });
    expect(content).toEqual(original.method);
  });
});

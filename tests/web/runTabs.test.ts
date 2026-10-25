import { describe, expect, it } from "vitest";
import { getRunTabReadiness } from "../../src/web/routes/runTabs.js";

describe("getRunTabReadiness", () => {
  it("keeps downstream tabs unavailable for a stopped partial run", () => {
    expect(
      getRunTabReadiness({
        hasCompositions: false,
        hasConnections: false,
        challengeReady: false,
        hasChallengeReport: false
      })
    ).toEqual({
      compositions: false,
      connections: false,
      challenge: false,
      blueprint: false
    });
  });

  it("opens Challenge only after a ranked composition exists", () => {
    expect(
      getRunTabReadiness({
        hasCompositions: true,
        hasConnections: true,
        challengeReady: true,
        hasChallengeReport: false
      })
    ).toEqual({
      compositions: true,
      connections: true,
      challenge: true,
      blueprint: false
    });
  });

  it("opens Blueprint only after the challenge report is persisted", () => {
    expect(
      getRunTabReadiness({
        hasCompositions: true,
        hasConnections: true,
        challengeReady: true,
        hasChallengeReport: true
      }).blueprint
    ).toBe(true);
  });
});

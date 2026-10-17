import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  blueprintQuerySchema,
  blueprintResponseSchema,
  challengeRequestSchema,
  challengeResponseSchema,
  eventsRequestSchema,
  getRunRequestSchema,
  healthzResponseSchema,
  methodResponseSchema,
  postRunsRequestSchema,
  postRunsResponseSchema,
  recomputeRequestSchema,
  recomputeResponseSchema,
  replaceRequestSchema,
  replaceResponseSchema,
  runResponseSchema,
  sseFrameSchema,
  stopRunRequestSchema,
  unpinAnchorRequestSchema
} from "../src/shared/routes.js";

const brief = {
  location: "Lisbon, Portugal",
  coordinates: { lat: 38.7223, lon: -9.1393 },
  radius: 1500,
  areaSqFt: 4500,
  objective: "A late-night listening bar that feels local",
  constraints: ["capacity 80", "open until 02:00"],
  admiredPlaces: ["Lovers in Lisbon"],
  presetId: "preset-listening-bar"
};

const run = {
  id: "run_01",
  status: "running",
  phase: "investigate"
};

const prior = {
  composition: "A listening bar weighted toward fado-adjacent late culture",
  generatedAt: "2026-10-07T10:00:00.000Z",
  model: "deepseek-chat",
  qlooUsed: false
};

const ledgerFrame = {
  event: "ledger",
  id: "12",
  data: {
    kind: "Qloo",
    label: "anchor discovery",
    summary: "6 anchors returned",
    duration: 812,
    cacheState: "fresh",
    resultCount: 6
  }
};

interface SchemaCase {
  route: string;
  request?: { schema: z.ZodType; valid: unknown; invalid: unknown };
  response: { schema: z.ZodType; valid: unknown; invalid: unknown };
}

const cases: SchemaCase[] = [
  {
    route: "GET /healthz",
    response: {
      schema: healthzResponseSchema,
      valid: { status: "ok", service: "zorq", version: "0.1.0", checks: { config: "ok" } },
      invalid: { status: "degraded", service: "zorq", version: "0.1.0", checks: {} }
    }
  },
  {
    route: "POST /api/runs",
    request: {
      schema: postRunsRequestSchema,
      valid: brief,
      invalid: { objective: "missing location" }
    },
    response: {
      schema: postRunsResponseSchema,
      valid: { run: { ...run, brief, prior } },
      invalid: { run: { ...run, brief, prior: { ...prior, qlooUsed: true } } }
    }
  },
  {
    route: "GET /api/runs/:id",
    request: {
      schema: getRunRequestSchema,
      valid: { params: { id: "run_01" } },
      invalid: { params: { id: "" } }
    },
    response: {
      schema: runResponseSchema,
      valid: { run },
      invalid: { run: { id: "", status: "running", phase: "investigate" } }
    }
  },
  {
    route: "GET /api/runs/:id/events",
    request: {
      schema: eventsRequestSchema,
      valid: { params: { id: "run_01" }, headers: { "last-event-id": "11" } },
      invalid: { params: { id: "" }, headers: {} }
    },
    response: {
      schema: sseFrameSchema,
      valid: { event: "state", id: "11", data: run },
      invalid: { event: "sparkle", id: "11", data: {} }
    }
  },
  {
    route: "POST /api/runs/:id/stop",
    request: {
      schema: stopRunRequestSchema,
      valid: { reason: "user pressed stop" },
      invalid: { reason: "x".repeat(201) }
    },
    response: {
      schema: runResponseSchema,
      valid: { run },
      invalid: { run: { id: "run_01", status: "running" } }
    }
  },
  {
    route: "POST /api/runs/:id/unpin-anchor",
    request: {
      schema: unpinAnchorRequestSchema,
      valid: { anchorId: "entity:qloo:abc123" },
      invalid: { anchorId: "" }
    },
    response: {
      schema: runResponseSchema,
      valid: { run },
      invalid: { run: { id: "run_01", status: 123, phase: "investigate" } }
    }
  },
  {
    route: "POST /api/runs/:id/replace",
    request: {
      schema: replaceRequestSchema,
      valid: { targetComponentId: "comp_anchor_1", candidateId: "cand_02", compositionKey: "comp_anchor_1+cand_02" },
      invalid: {
        targetComponentId: "comp_anchor_1",
        candidateId: "cand_02",
        customQuery: "jazz bars"
      }
    },
    response: {
      schema: replaceResponseSchema,
      valid: {
        run,
        delta: { coherence: 0.12, distinctiveness: -0.04 },
        weakestLink: { a: "comp_anchor_1", b: "comp_discovery_3", value: 0.31 }
      },
      invalid: { run, delta: { coherence: 0.12 }, weakestLink: {} }
    }
  },
  {
    route: "POST /api/runs/:id/challenge",
    request: {
      schema: challengeRequestSchema,
      valid: { focus: "bridge" },
      invalid: { focus: "meltdown" }
    },
    response: {
      schema: challengeResponseSchema,
      valid: {
        run,
        report: {
          kind: "challenge",
          verdict: "Survived",
          reason: "The leader held against all five attacks.",
          attackOrder: ["ablation", "substitution", "bridge", "catchment", "rival"],
          attackOrderSource: "diagnostic",
          rounds: 1,
          leaderBefore: {
            members: ["comp_anchor_1", "comp_discovery_3", "comp_social_2"],
            coherence: 0.72,
            percentile: 88.2,
            distinctivenessMean: 0.61,
            weakestLink: { a: "comp_anchor_1", b: "comp_discovery_3", value: 0.31 }
          },
          leaderAfter: {
            members: ["comp_anchor_1", "comp_discovery_3", "comp_social_2"],
            coherence: 0.72,
            percentile: 88.2,
            distinctivenessMean: 0.61,
            weakestLink: { a: "comp_anchor_1", b: "comp_discovery_3", value: 0.31 }
          },
          mutations: [],
          attacks: [
            { kind: "ablation", status: "measured", summary: "drop-one ablation over 3 members", detail: "no member could be removed without loss" },
            { kind: "substitution", status: "measured", summary: "same-role substitution over 2 alternative(s)", detail: "no substitute improves the leader" },
            { kind: "bridge", status: "measured", summary: "bridge candidate on a – b: Blue Note Corner", detail: "what both audiences love: Blue Note Corner", evidenceId: "ev_01" },
            { kind: "catchment", status: "skipped", summary: "catchment shift skipped", detail: "no stored city-scale neighborhoods exist" },
            { kind: "rival", status: "measured", summary: "the leader holds rank 1 of 3", detail: "no rival takes the lead across the dial sweep" }
          ],
          gradeCap: "A",
          generatedAt: "2026-10-08T12:00:00.000Z"
        }
      },
      invalid: {
        run,
        report: {
          kind: "challenge",
          verdict: "Shattered",
          reason: "",
          attackOrder: ["ablation"],
          attackOrderSource: "psychic",
          rounds: 9,
          leaderBefore: {},
          leaderAfter: {},
          mutations: [],
          attacks: [],
          gradeCap: "S",
          generatedAt: "2026-10-08T12:00:00.000Z"
        }
      }
    }
  },
  {
    route: "POST /api/runs/:id/recompute",
    request: {
      schema: recomputeRequestSchema,
      valid: { changes: { areaSqFt: 5200, objective: "Dinner-first venue" } },
      invalid: { changes: {} }
    },
    response: {
      schema: recomputeResponseSchema,
      valid: { run, priorUnchanged: true },
      invalid: { run, priorUnchanged: false }
    }
  },
  {
    route: "GET /api/runs/:id/blueprint",
    request: {
      schema: blueprintQuerySchema,
      valid: { share: "sh_01" },
      invalid: { share: 7 }
    },
    response: {
      schema: blueprintResponseSchema,
      valid: {
        blueprint: {
          title: "The Late Room",
          rationale: "Anchored in measured fado-adjacent late culture. [ev_01]",
          narrativeSource: "deterministic",
          compositionByRole: [
            {
              role: "Anchor",
              members: [
                { memberId: "comp_late_1", name: "The Late Room", role: "Anchor", receipts: [] }
              ]
            }
          ],
          fitToSite: {
            footprint: {
              areaSqFt: 4500,
              usableSqFt: 3825,
              totalFootprintSqFt: 3600,
              withinUsable: true,
              rule: "total footprint ≤ 85% of available area [Zorq heuristic]"
            },
            hours: {
              timeline: [{ memberId: "comp_late_1", name: "The Late Room", open: "18:00", close: "02:00" }],
              constraintReads: [{ key: "raw", source: "capacity 80" }]
            },
            downshifts: []
          },
          whatQlooChanged: { kept: [], added: [], removed: [], reformatted: [] },
          risks: [
            { kind: "weakest-edge", text: "weakest link: The Late Room + The Late Hour", evidenceIds: [] }
          ],
          evidenceGrade: {
            grade: "B",
            reasons: ["edge comp_a|comp_b state=failed"],
            rule: "A: all leader edges confirmed. B: any contested, thin, or failed probe. C: any leader member unmeasured."
          },
          revisionHistory: [],
          methodUrl: "/method",
          shareUrl: "/run/run_01/blueprint?share=sh_01",
          generatedAt: "2026-10-07T11:00:00.000Z",
          expiresAt: "2026-11-06T11:00:00.000Z"
        }
      },
      invalid: {
        blueprint: {
          title: "The Late Room",
          rationale: "Anchored in measured fado-adjacent late culture.",
          narrativeSource: "deterministic",
          compositionByRole: [],
          fitToSite: {
            footprint: {
              areaSqFt: 4500,
              usableSqFt: 3825,
              totalFootprintSqFt: 3600,
              withinUsable: true,
              rule: "total footprint ≤ 85% of available area [Zorq heuristic]"
            },
            hours: { timeline: [], constraintReads: [] },
            downshifts: []
          },
          whatQlooChanged: { kept: [], added: [], removed: [], reformatted: [] },
          risks: ["Catchment thins after midnight"],
          evidenceGrade: "B",
          revisionHistory: [],
          methodUrl: "/method",
          shareUrl: "/run/run_01/blueprint?share=sh_01",
          generatedAt: "2026-10-07T11:00:00.000Z",
          expiresAt: "2026-11-06T11:00:00.000Z"
        }
      }
    }
  },
  {
    route: "GET /api/method",
    response: {
      schema: methodResponseSchema,
      valid: {
        method: {
          title: "How Zorq measures",
          updated: "2026-10-17",
          whatQlooMeasures: ["entity affinities"],
          whatZorqComputes: ["coherence percentile"],
          whatTheLlmGenerates: ["prior composition"],
          heuristics: [
            {
              name: "role map",
              detail: "roles every valid composition covers",
              editable: true,
              note: "[Zorq heuristic]"
            }
          ],
          formulas: ["weakest link = min(edge weights)"],
          workedExample: {
            title: "Schematic example of the arithmetic",
            intro: "Placeholders only; real values come from measured Qloo results.",
            steps: ["weight each entity, apply IDF, take the cosine"]
          },
          knownLimits: ["thin evidence caps grade at B"],
          typeNote: "The agent assembles; the code calculates.",
          setupSummary: "Qloo via MCP, DeepSeek for interpretation.",
          evidenceVsInference: {
            badges: [{ badge: "[Qloo]", meaning: "directly measured" }],
            rule: "Every claim cites an evidence ID."
          }
        }
      },
      invalid: {
        method: {
          title: "How Zorq measures",
          updated: "2026-10-17",
          whatQlooMeasures: "not-an-array",
          whatZorqComputes: ["coherence percentile"],
          whatTheLlmGenerates: ["prior composition"],
          heuristics: [
            {
              name: "role map",
              detail: "roles every valid composition covers",
              editable: true,
              note: "[Zorq heuristic]"
            }
          ],
          formulas: ["weakest link = min(edge weights)"],
          workedExample: {
            title: "Schematic example of the arithmetic",
            intro: "Placeholders only; real values come from measured Qloo results.",
            steps: ["weight each entity, apply IDF, take the cosine"]
          },
          knownLimits: ["thin evidence caps grade at B"],
          setupSummary: "Qloo via MCP, DeepSeek for interpretation.",
          evidenceVsInference: "y"
        }
      }
    }
  }
];

describe("route schemas (ARCHITECTURE.md §3)", () => {
  it("covers all 11 documented routes", () => {
    expect(cases).toHaveLength(11);
    expect(new Set(cases.map((entry) => entry.route)).size).toBe(11);
  });

  for (const testCase of cases) {
    it(`${testCase.route} request accepts a representative valid payload and rejects an invalid one`, () => {
      if (testCase.request) {
        const accepted = testCase.request.schema.safeParse(testCase.request.valid);
        expect(accepted.success).toBe(true);
        const rejected = testCase.request.schema.safeParse(testCase.request.invalid);
        expect(rejected.success).toBe(false);
      } else {
        expect(testCase.request).toBeUndefined();
      }
    });

    it(`${testCase.route} response accepts a representative valid payload and rejects an invalid one`, () => {
      const accepted = testCase.response.schema.safeParse(testCase.response.valid);
      expect(accepted.success).toBe(true);
      const rejected = testCase.response.schema.safeParse(testCase.response.invalid);
      expect(rejected.success).toBe(false);
    });
  }

  it("ledger frames carry the documented §3.4 fields", () => {
    const parsed = sseFrameSchema.safeParse(ledgerFrame);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.event === "ledger") {
      expect(Object.keys(parsed.data.data).sort()).toEqual([
        "cacheState",
        "duration",
        "kind",
        "label",
        "resultCount",
        "summary"
      ]);
    }
  });
});

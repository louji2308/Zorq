import { randomUUID } from "node:crypto";
import type { LedgerEntry } from "../../src/server/agent/ledger.js";
import type { LedgerEvent } from "../../src/shared/events.js";
import type { EvidenceRecord } from "../../src/server/evidence/index.js";
import type { RunState } from "../../src/shared/run.js";

export function sampleState(id: string, status = "created", phase = "intake"): RunState {
  return {
    id,
    status,
    phase,
    brief: {
      location: "Lisbon, Portugal",
      coordinates: { lat: 38.7223, lon: -9.1393 },
      radius: 2500,
      objective: "A cafe with cultural coherence for remote workers",
      constraints: ["independent brands only"],
      presetId: "cafe"
    },
    prior: {
      composition: {
        units: [
          { name: "counter", weight: 0.6 },
          { name: "seating", weight: 0.4 }
        ]
      },
      generatedAt: "2026-10-09T12:00:00.000Z",
      model: "deepseek-chat",
      qlooUsed: false
    }
  };
}

export function sampleEvent(): LedgerEvent {
  return {
    kind: "Compute",
    label: "graph.coherence",
    summary: "computed coherence across composition units",
    duration: 12.5,
    cacheState: "live",
    resultCount: 4
  };
}

export function sampleEntry(sequence: number): LedgerEntry {
  return {
    id: randomUUID(),
    sequence,
    event: sampleEvent()
  };
}

export function sampleEvidence(): EvidenceRecord {
  return {
    id: randomUUID(),
    operation: "search",
    claim: "Qloo search links this district to independent cafe culture",
    provenance: {
      transport: "rest",
      operation: "search",
      endpoint: "https://hackathon.api.qloo.com/v2/search",
      durationMs: 143,
      cacheState: "live",
      resultCount: 3
    },
    createdAt: "2026-10-09T12:01:00.000Z",
    ledgerEventId: randomUUID()
  };
}

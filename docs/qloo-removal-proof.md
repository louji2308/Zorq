# Qloo-removal proof

Governing requirement: the hackathon's "would this work the same without Qloo?" test
(Hackathon_details §33; Implementation Plan Phase 9). The claim to prove: removing Qloo
materially removes information Zorq depends on — shared-culture edges, local-vs-city
distinctiveness, candidate provenance, and the reason the Prior changed — and Zorq says so
honestly rather than manufacturing divergence.

## 1. The mechanism is in the architecture, not a trick bolted on at the end

| Step | Owner | What it guarantees without Qloo |
|---|---|---|
| Frozen Prior | `src/server/agent/prior.ts` | The first guess exists (LLM-only, `qlooUsed=false`) and is write-once before any Qloo call, so "what the agent believed before looking" is always available without Qloo. |
| LLM-only polish | `src/server/agent/prior.ts` | Generated in the same call as the Prior, before any Qloo evidence exists, so the Without-Qloo column is a fair LLM-only basis. An invalid polish is dropped honestly (`prior.polish_unavailable` ledger event) instead of being faked. |
| Measurement needs Qloo | `src/server/engine/*`, `src/server/orchestrator/*` | Neighborhoods, edges, percentiles and distinctiveness exist only from measured Qloo inputs; an unmeasured candidate can never become a finalist. With Qloo absent, run creation answers the typed `DEPENDENCY_UNAVAILABLE` envelope instead of inventing a run. |
| S5 compare modal | `src/web/screens/s5/CompareModal.tsx`, `src/web/screens/s5/s5Model.ts` | Left column: frozen Prior + LLM-only polish; right column: Final. When they match, the modal states the confident-empty case ("here, the evidence changed nothing") rather than staging a diff. |

## 2. What is test-proven today

| Claim | Evidence source |
|---|---|
| The polish is requested in the Prior contract and stored in the frozen Prior | `tests/agent/prior.test.ts` ("asks for the Without-Qloo polish…", "extracts a valid LLM-only polish…") |
| An invalid polish is dropped and recorded, never fabricated | `tests/agent/prior.test.ts` ("drops a present-but-invalid polish honestly…", asserting `prior.polish_unavailable`) |
| S5 shows only frozen-Prior members and the honest compare path | `e2e/judge-flow.spec.ts` (S5 blueprint + compare assertions) |
| Run creation without keys answers a typed dependency-failure envelope | `e2e/smoke.spec.ts` ("POST /api/runs answers 201 with a run or a typed dependency failure envelope") |

## 3. The live A/B record (pending live evidence)

Because fabricated live evidence is worse than documented absence, the live record is produced
from real runs at submission freeze with real keys, by this exact procedure:

1. `LIVE_QLOO=1 npm test` (live Qloo gateway contract) and one real preset run through the
   deployed app with real `QLOO_API_KEY` and `DEEPSEEK_API_KEY`.
2. On two preset briefs — one likely Qloo-divergent, one control — capture:
   the frozen Prior card, the S5 compare modal ("With Qloo" final vs "Without Qloo" Prior+polish),
   and the ledger row count from Qloo (`Qloo` kind rows in S1).
3. Record per preset: which members changed, which edge changed rank, and whether the control
   preset *confirmed* rather than redirected the Prior (the control case is evidence too).
4. Paste the three per-preset receipts (Prior, diff, verdict) into the section below, each with
   the run ID and date. Runs' identity: URL `/run/<id>/blueprint`.

**Result table (to be filled at freeze — never claimed before that):**

| Preset | Condition A final | Condition B (Prior + polish) | What changed | Run ID |
|---|---|---|---|---|
| divergent-1 | _pending live run_ | _pending_ | _pending_ | _pending_ |
| divergent-2 | _pending live run_ | _pending_ | _pending_ | _pending_ |

| control | _pending live run_ | _pending_ | _pending_ (expected: confirmed) | _pending_ |

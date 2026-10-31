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
| Measurement needs Qloo | `src/server/engine/*`, `src/server/orchestrator/*` | Neighborhoods, edges, percentiles and distinctiveness exist only from measured Qloo inputs; an unmeasured candidate can never become a finalist. With Qloo absent nothing is invented: run creation answers 201 because the Prior is LLM-only, and the run then lands in an honest typed failure state naming the missing dependency (an unconfigured Qloo gateway raises a typed `SERVICE_UNAVAILABLE` envelope, "Qloo gateway is not configured for use" — `src/server/qloo/errors.ts:147`). A fully unwired runtime answers run creation with a typed `SERVICE_UNAVAILABLE` and no pretend run (`tests/serverHttp.test.ts` "no pretend run"). |
| S5 compare modal | `src/web/screens/s5/CompareModal.tsx`, `src/web/screens/s5/s5Model.ts` | Left column: frozen Prior + LLM-only polish; right column: Final. When they match, the modal states the confident-empty case ("here, the evidence changed nothing") rather than staging a diff. |

## 2. What is test-proven today

| Claim | Evidence source |
|---|---|
| The polish is requested in the Prior contract and stored in the frozen Prior | `tests/agent/prior.test.ts` ("asks for the Without-Qloo polish…", "extracts a valid LLM-only polish…") |
| An invalid polish is dropped and recorded, never fabricated | `tests/agent/prior.test.ts` ("drops a present-but-invalid polish honestly…", asserting `prior.polish_unavailable`) |
| S5 shows only frozen-Prior members and the honest compare path | `tests/web/s5Model.test.ts` + `tests/api/blueprint.test.ts` (S5 blueprint + compare assertions); browser rendering verified by the 2026-10-27 live Chrome walk of Nashville `4564a1cb…` (Blueprint grade B with the Without-Qloo section, zero console errors). The former `e2e/judge-flow.spec.ts` Playwright suite recorded the same assertions (historical; suite removed 2026-10-30). |
| Run creation without keys answers a typed envelope — never a pretend run | Missing Rapid Router key: `tests/agent/prior.test.ts` ("fails typed when the Rapid Router key is missing…") + `tests/agent/investigation.test.ts` ("keeps the gateway untouched when the Rapid Router key is missing" — typed `SERVICE_UNAVAILABLE`) + `src/server/agent/errors.ts:3`; the Prior is generated and persisted before run creation, so `POST /api/runs` answers the typed error, no run (`src/server/orchestrator/orchestrator.ts:346-367`; `tests/serverHttp.test.ts` "no pretend run" for an unwired runtime). Missing Qloo key: the gateway rejects every call as typed `SERVICE_UNAVAILABLE` naming `env.QLOO_API_KEY` (`src/server/main.ts` `unconfiguredGateway`, `src/server/qloo/errors.ts:147`); creation still answers 201 (the Prior is LLM-only) and the run honestly degrades instead of manufacturing results. |
| Qloo outage mid-run yields an honest partial with a typed dependency-failure envelope | `tests/orchestrator/lifecycle.test.ts` + `tests/agent/controller.test.ts` (unavailable Qloo → typed `DEPENDENCY_UNAVAILABLE`) |

## 3. The live A/B record (pending live evidence)

Status 2026-10-31: real funded runs now exist and complete (Chennai
`d30b7047-df2c-4f65-bf72-4d7db6c60525`, Nashville `4564a1cb-f4fc-4a0c-b23d-45f929bbd976`
— Blueprint grade B with real Without-Qloo sections, per `IMPLEMENTATION_STATE.md`
2026-10-27/28), but those were single-condition runs, not the controlled A/B below. The
receipt table stays unfilled until A/B runs are recorded; the completed runs must never be
retrofitted as receipts.

The live record is produced from real runs with real keys, by this exact procedure:

1. `LIVE_QLOO=1 npm test` (live Qloo gateway contract) and real A/B-conditioned runs through
   the deployed app with real `QLOO_API_KEY` and `RAPIDROUTER_API_KEY`.
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

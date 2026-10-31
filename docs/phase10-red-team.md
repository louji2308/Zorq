# Phase 10 — Red Team, Exceptional Handling & Final Verification

Recorded 2026-10-18. Governing spec: `ProjectSpec/IMPLEMENTATION_PLAN.md` L899–1317.

> **Update 2026-10-31 (stale-claim correction):** this record's 2026-10-18 offline audits
> stand as dated historical evidence. The B-02 (formerly the unfunded DeepSeek direct key,
> today Rapid Router `deepseek/deepseek-v4-flash`) blocker is **superseded**: real funded runs now
> complete — Chennai `d30b7047-df2c-4f65-bf72-4d7db6c60525` (pool 5, ranked grade B,
> Challenge `Revised`, Blueprint grade B) and Nashville
> `4564a1cb-f4fc-4a0c-b23d-45f929bbd976` (complete, 45 evidence, Challenge `Revised`
> with 3 measured attacks, Blueprint grade B with a real Without-Qloo diff), per
> `IMPLEMENTATION_STATE.md` 2026-10-27/28. The Render deploy is live at
> https://zorq-12dk.onrender.com with `/healthz` 200 (re-verified 2026-10-31). Current
> suite basis: typecheck 0, lint 0, unit 831 passed / 6 skipped, build PASS
> (2026-10-30 audit run). The `e2e/*` Playwright suites and `playwright.config.ts` were
> removed by user decision on 2026-10-30 — e2e citations below are historical dated
> records; judge-path evidence is now the API/integration suites plus manual browser
> verification. Without-Qloo A/B receipts remain pending (`docs/qloo-removal-proof.md` §3).

This phase adds **no features** (Plan L902). Every row below is an executed audit with observed
evidence or an honest "pending live evidence" flag as recorded at the time — nothing is claimed
from fixtures where a real service was required; the update banner above tracks what the live
services later proved. Companions: `docs/release-audit.md` (Phase 9 repository/secret
audit), `docs/qloo-removal-proof.md` (A/B mechanism), `IMPLEMENTATION_STATE.md` (build state).

## 10.1 Repository integrity — PASS (no production defects)

| Check | Observed |
|---|---|
| Anti-pattern grep over 129 `src/**` files (`TODO|FIXME|mock|fake|stub|placeholder|dummy|hardcod|bypass|secret`) | 69 hits, **all benign**: secret-redaction code (`scrubSecrets`, `readOptionalSecret`), HTML `placeholder=` attributes, honest copy (`method.ts` "named placeholders"), `s1Model.ts` sensitive-key regex. **0** `TODO`/`FIXME`/`mock`/`fake`/`dummy` in production. |
| `unimplemented(...)` occurrences (11) | Unwired-dependency fallback in `routes.ts`; production `src/server/main.ts` wires `createRunStore` + `createOrchestrator` + `createEventHub`, so real handlers run. Two routes ship as honest typed-503 by design (see 10.3). |
| Fixtures imported into production | `git grep 'tests/\|fixtures\|/tmp/' src` → only test-file **doc comments**, no imports. |
| Duplicate critical paths | None; single Qloo gateway, single engine barrel, single RunStore port with two adapters. |

## 10.2 Hardcode audit — PASS for what is test-provable offline

| Claim | Evidence |
|---|---|
| Qloo data comes from Qloo transport | Single gateway (`src/server/qloo/`) MCP primary + REST fallback; no `urn:tag:`/`urn:entity:` literals in `src/web` (grep 0 hits) — the UI never invents tags. |
| Rapid Router output comes from Rapid Router | `src/server/agent/llm.ts` is the only LLM client; agent authors prose/choices, never numbers. |
| Map data comes from MapTiler | `src/web/lib/map.ts` (MapLibre) + build-inlined `VITE_MAPTILER_KEY`; no basemap baked into source. |
| Deterministic metrics are computed, not canned | `src/server/engine/` has **zero** `Math.random`/`Date.now`/`randomUUID`; all metrics derive from normalized inputs. |
| No preset-specific answers | Presets render brief text; Prior is generated per run by the LLM, not stored. |

## 10.3 Route audit — full route surface, all validated

The original locked 11-route surface has since grown by two validated additions:
`POST /api/runs/:id/retry` (wired through the orchestrator retry capability) and
`POST /api/qloo/tags` (bounded Phase 9 deviation, recorded in `IMPLEMENTATION_STATE.md`
2026-10-25 — a run-scoped Qloo tag preview, never a run or evidence source).

| Route | Validation | Coverage |
|---|---|---|
| `GET /healthz` | — | `tests/serverHttp.test.ts`; formerly `e2e/smoke.spec.ts` (historical, suite removed) |
| `POST /api/runs` | `postRunsRequestSchema` | `tests/api/*`; formerly `e2e/smoke` (historical) |
| `GET /api/runs/:id` | `runIdParamsSchema` | `tests/api/*` |
| `GET /api/runs/:id/events` | `eventsRequestSchema` | `tests/sse/*`, `tests/orchestrator/exitGate.test.ts` |
| `POST /api/runs/:id/stop` | `stopRunRequestSchema` | `tests/api/*` |
| `POST /api/runs/:id/retry` | — | `tests/api/runs.test.ts` |
| `POST /api/runs/:id/unpin-anchor` | `unpinAnchorRequestSchema` | **honest typed 503 in this build** (documented; see gap below) |
| `POST /api/runs/:id/replace` | `replaceRequestSchema` | `tests/api/runs.test.ts`, `tests/orchestrator/replace.test.ts`; formerly `e2e/judge-flow` (historical) |
| `POST /api/runs/:id/challenge` | `challengeRequestSchema` | `tests/api/challenge.test.ts`, `tests/orchestrator/challenge.test.ts`; formerly `e2e/judge-flow` (historical) — plus live proof: Nashville `4564a1cb…` returned `Revised` (2026-10-27) |
| `POST /api/runs/:id/recompute` | `recomputeRequestSchema` | **honest typed 503 in this build** (documented) |
| `GET /api/runs/:id/blueprint` | `blueprintQuerySchema` | `tests/orchestrator/*`, `tests/api/blueprint.test.ts`; formerly `e2e/judge-flow` (historical) — plus live proof: Nashville/Chennai blueprints grade B (2026-10-27/28) |
| `GET /api/method` | — | `tests/api/method.test.ts`; formerly `e2e/smoke.spec.ts` (historical) |
| `POST /api/qloo/tags` (2026-10-30 read) | `qlooTagSuggestionsRequestSchema` | `tests/serverHttp.test.ts` — answers 200 with Qloo-projected tags or an in-band degraded envelope (never a key leak) |

The `e2e/*` Playwright citations record passes against the then-current production build
(dated 2026-10-18); those suites were removed by user decision on 2026-10-30. Judge-path
confidence now rests on the API/integration suites plus manual browser verification.

**Honest gap (not a fabrication):** `unpin-anchor` and `recompute` return a typed
`SERVICE_UNAVAILABLE` naming the real reason ("not part of this build" / "not available as a
standalone endpoint in this build"). These are the two ProductSpec §8 correction affordances that
are deliberately out of the locked scope; recorded as a known limitation, never faked.

## 10.4 Qloo audit — gateway proven; full failure matrix pending live run

Gateway contract suites cover caching, budget, zero-result and invalid-combination semantics
(`tests/qloo/*`). Real funded runs through the live path exist (Nashville 2026-10-27, Chennai
2026-10-28 — 45 evidence records on Nashville), so the mainline live gateway contract has been
exercised; the standalone `LIVE_QLOO=1` contract pass and the full failure matrix
(429/5xx, `urn:heatmap`, explainability) have not been separately executed. **Honest status:
gateway code proven by suites and by complete live runs; the dedicated live failure matrix
remains unexecuted.**

## 10.5 Agent behavior audit — bounded controller proven; real adaptive runs complete

Observation→diagnosis→tool loop, turn/budget caps and Prior-Lock preservation are unit/integration
proven (`tests/agent/*`, `tests/orchestrator/*`). The former B-02 blocker (Rapid Router balance)
is superseded: real funded runs now complete — Nashville `4564a1cb-f4fc-4a0c-b23d-45f929bbd976`
(2026-10-27, complete under the 300s wall-clock cap, all five tabs browser-walked in Chrome with
zero console errors) and Chennai `d30b7047-df2c-4f65-bf72-4d7db6c60525` (2026-10-28, pool 5,
Challenge `Revised` with 2 drop mutations, Blueprint grade B). The Without-Qloo A/B receipt
record (`docs/qloo-removal-proof.md` §3) remains outstanding — it must be produced from recorded
runs, not inferred from these.

## 10.6 Deterministic reproducibility — PASS

Full-pipeline byte-identical replay is test-proven:

| Proof | Test |
|---|---|
| Full pipeline byte-identical across reruns | `tests/engine/exitGate.test.ts:284` |
| Identical graph + ranking across two independent runs | `tests/api/judgeChain.test.ts:232` |
| Measurement, replace and challenge deterministic across two runs | `tests/orchestrator/{measure,replace,challenge}.test.ts` |
| Deep-equal repeated input; byte-identical family/ranking/idf serialization | `tests/engine/{determinism,composition,ranking,idf,grade,triangulation}.test.ts` |

Focused rerun 2026-10-18: `npx vitest run tests/engine/exitGate tests/orchestrator/exitGate tests/api/judgeChain tests/engine/determinism` → **4 files / 23 tests passed**.

## 10.7 Chaos / recovery audit — proven in-suite; live cold-start/interrupt matrix unexecuted

| Interruption | Where proven |
|---|---|
| SSE refresh / reconnect / non-contiguous gap → state fallback | `tests/orchestrator/exitGate.test.ts`, `tests/sse/sse.test.ts` |
| Degraded boot (missing config → typed 503) | `tests/degradedBoot.test.ts`, `tests/serverHttp.test.ts` |
| Qloo outage mid-run → honest partial, no fake completion | `tests/orchestrator/*`, `tests/qloo/*` |
| Budget exhaustion → honest stop at best-so-far | `tests/agent/budget.test.ts` |
| No duplicate phase effects / revisions | idempotency guards in `tests/orchestrator/*` |

A standalone live cold-start and real-provider interrupt pass has not been separately executed;
per the update banner, nothing claims it from fixtures.

## 10.8 UI truth audit — PASS (fixture-browser walk + unit suites; e2e historical)

Provenance badges (`[Qloo]`/`[Zorq heuristic]`/`[LLM]`), unknown-evidence-ID handling, honest
empty/uncertainty states, narrow-viewport S3 fallback, and reduced-motion equivalents are
covered by the `tests/web/*` unit suites + the Phase 8 fixture-browser walk
(`tmp/phase8-walk.json`, zero console errors) + manual browser verification of the live runs
(2026-10-27/28, zero console/page errors). The as-recorded 2026-10-18 cover was the
`e2e/judge-flow.spec.ts` Playwright suite ("drops the invented id"), which is historical —
the suite was removed 2026-10-30 and the judge path is now verified by manual + API test
evidence. Secrets in the browser bundle: **0** (see 10.9).

## 10.9 Security audit — PASS (repository-provable)

| Check | Observed |
|---|---|
| Keys server-side only | `git grep 'QLOO_API_KEY=\|RAPIDROUTER_API_KEY=\|TURSO_*='` → only the deploy tool's selftest literal; `src/web` bundle has **0** secret names/values |
| `.env` untracked | `git ls-files .env` → empty; `.gitignore` ignores `.env*` except `.env.example` |
| Browser bundle clean | `dist/web/**` grep for secret names + value prefixes → **0** hits (only the documented-public MapTiler key) |
| Helmet active | `src/server/app.ts:39` |
| Rate limiting active | `src/server/middleware/rateLimit.ts`, wired `app.ts:53` |
| Logs redacted | `scrubSecrets` in Qloo/LLM error paths; Pino redact list (`logger.ts`) |
| Untrusted output | Qloo/MCP/LLM output validated at the boundary; markdown sanitized |

## 10.10 Performance / budget audit — constants locked; live p50/p90 not yet measured

Locked in `src/server/config.ts`: `LOCK_LLM_BUDGET_USD = 2`, `LOCK_MAX_QLOO_CALLS = 180`,
`qlooConcurrency = 6`. Real funded runs complete, but aggregate p50/p90 latency, per-run call
count and cache-hit measurements have not been formally collected; they remain pending until
measured, never estimated from one run.

## 10.11 Full public-path browser suite — local PASS (historical e2e); deployed leg live-verified

*Historical (2026-10-18):* `npm run test:e2e` → **11 passed / 4 skipped** (gallery-only) against
the then-current real production build. The `e2e/*` Playwright suites and `playwright.config.ts`
were removed by user decision (2026-10-30); this row cannot be re-run today. Current evidence:
unit/lint/typecheck/build green (831/6, 2026-10-30 audit run) and the deployed path verified by
live runs (Nashville 2026-10-27 browser-walked end-to-end with zero console/page errors) and
`/healthz` 200 on https://zorq-12dk.onrender.com (re-verified 2026-10-31).

## 10.12 Final submission surfaces — PRESENT

| Surface | State |
|---|---|
| Public repo | `github.com/louji2308/Zorq` (PUBLIC) |
| `LICENSE` | MIT at root |
| README | 173 lines (2026-10-31 count; 152 at the 2026-10-18 record): problem, solution, live URL, screenshot, setup, Qloo, why-Qloo, architecture, run, deploy, method, limits, security, license |
| `/method` | built (formulas, heuristics, grades, limits, type note) |
| `.env.example` | placeholders only |
| Deployment | Render Docker service live (https://zorq-12dk.onrender.com); `npm run deploy` reproducible |
| Screenshots | `assets/*` (S0 brief, /method — moved from `docs/screenshots/` 2026-10-30); live-run gallery pending |
| No login / free | yes (public URL) |
| `/healthz` | 200 on the deployed URL (re-verified 2026-10-31) |

## 10.13 Final release gate — one honest gap: A/B receipts not yet recorded

| Group | Status |
|---|---|
| Product (composition not recommender, Prior Lock, Challenge, Without-Qloo, corrections) | ✅ built; Without-Qloo A/B receipts pending (`docs/qloo-removal-proof.md` §3) |
| Qloo (meaningful, traceable, removal weakens, no fabrication) | ✅ mechanism + gateway + complete live runs; A/B receipts pending |
| Agent (observes/adapts, bounded, failures=state, budgets) | ✅ architecture proven; real adaptive runs complete (Chennai `d30b7047…`, Nashville `4564a1cb…`) |
| Determinism (reproducible numbers, graph math, fit, grades) | ✅ |
| UX (self-teaching, no narration, no dead ends, design system, a11y) | ✅ |
| Reliability (refresh/resume, SSE reconnect, partial failure, honest outage/budget, best-so-far) | ✅ in-suite; live cold-start/spin-down cycle not separately executed |
| Engineering (typecheck, lint, unit, integration, build, deploy, health; e2e historical) | ✅ all green (831/6, 2026-10-30) + deploy live (`/healthz` 200, re-verified 2026-10-31) |
| Repository (no dupes, no mocks, no canned answers, no secrets, no debug, truthful history) | ✅ |

Formerly the single blocker was B-02 (the DeepSeek/Rapid Router balance); that is superseded —
real funded runs complete (see 10.5). The remaining honest gap is the Without-Qloo A/B receipt
record, which must be produced from real recorded runs (`docs/qloo-removal-proof.md` §3), plus
the live Qloo failure matrix and cold-start cycle. No fixture-based substitute may claim them.

# Phase 10 — Red Team, Exceptional Handling & Final Verification

Recorded 2026-10-18. Governing spec: `ProjectSpec/IMPLEMENTATION_PLAN.md` L899–1317.

This phase adds **no features** (Plan L902). Every row below is an executed audit with observed
evidence or an honest "pending live evidence (B-02)" flag — nothing is claimed from fixtures
where a real service was required. Companions: `docs/release-audit.md` (Phase 9 repository/secret
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
| DeepSeek output comes from DeepSeek | `src/server/agent/llm.ts` is the only LLM client; agent authors prose/choices, never numbers. |
| Map data comes from MapTiler | `src/web/lib/map.ts` (MapLibre) + build-inlined `VITE_MAPTILER_KEY`; no basemap baked into source. |
| Deterministic metrics are computed, not canned | `src/server/engine/` has **zero** `Math.random`/`Date.now`/`randomUUID`; all metrics derive from normalized inputs. |
| No preset-specific answers | Presets render brief text; Prior is generated per run by the LLM, not stored. |

## 10.3 Route audit — 11-route surface, all validated

| Route | Validation | Coverage |
|---|---|---|
| `GET /healthz` | — | `e2e/smoke.spec.ts`, `tests/serverHttp.test.ts` |
| `POST /api/runs` | `postRunsRequestSchema` | `tests/api/*`, `e2e/smoke` |
| `GET /api/runs/:id` | `runIdParamsSchema` | `tests/api/*` |
| `GET /api/runs/:id/events` | `eventsRequestSchema` | `tests/sse/*`, `tests/orchestrator/exitGate.test.ts` |
| `POST /api/runs/:id/stop` | `stopRunRequestSchema` | `tests/api/*` |
| `POST /api/runs/:id/unpin-anchor` | `unpinAnchorRequestSchema` | **honest typed 503 in this build** (documented; see gap below) |
| `POST /api/runs/:id/replace` | `replaceRequestSchema` | `tests/orchestrator/replace.test.ts`, `e2e/judge-flow` |
| `POST /api/runs/:id/challenge` | `challengeRequestSchema` | `tests/orchestrator/challenge.test.ts`, `e2e/judge-flow` |
| `POST /api/runs/:id/recompute` | `recomputeRequestSchema` | **honest typed 503 in this build** (documented) |
| `GET /api/runs/:id/blueprint` | `blueprintQuerySchema` | `tests/orchestrator/*`, `e2e/judge-flow` |
| `GET /api/method` | — | `e2e/smoke.spec.ts`, `tests/api/method` |

**Honest gap (not a fabrication):** `unpin-anchor` and `recompute` return a typed
`SERVICE_UNAVAILABLE` naming the real reason ("not part of this build" / "not available as a
standalone endpoint in this build"). These are the two ProductSpec §8 correction affordances that
are deliberately out of the locked scope; recorded as a known limitation, never faked.

## 10.4 Qloo audit — gateway proven; full failure matrix pending live run

Gateway contract suites cover caching, budget, zero-result and invalid-combination semantics
(`tests/qloo/*`). Live gateway contract run (`LIVE_QLOO=1`) and the full failure matrix
(429/5xx, `urn:heatmap`, explainability) execute at freeze against real keys. **Honest status:
gateway code proven; end-to-end live matrix deferred to the B-02 unblock.**

## 10.5 Agent behavior audit — bounded controller proven; adaptive live run pending B-02

Observation→diagnosis→tool loop, turn/budget caps and Prior-Lock preservation are unit/integration
proven (`tests/agent/*`, `tests/orchestrator/*`). The **real-LLM adaptive run** that shows course
changes on live evidence is deferred — it needs a funded DeepSeek balance (B-02). Not claimed from
fixtures.

## 10.6 Deterministic reproducibility — PASS

Full-pipeline byte-identical replay is test-proven:

| Proof | Test |
|---|---|
| Full pipeline byte-identical across reruns | `tests/engine/exitGate.test.ts:284` |
| Identical graph + ranking across two independent runs | `tests/api/judgeChain.test.ts:232` |
| Measurement, replace and challenge deterministic across two runs | `tests/orchestrator/{measure,replace,challenge}.test.ts` |
| Deep-equal repeated input; byte-identical family/ranking/idf serialization | `tests/engine/{determinism,composition,ranking,idf,grade,triangulation}.test.ts` |

Focused rerun 2026-10-18: `npx vitest run tests/engine/exitGate tests/orchestrator/exitGate tests/api/judgeChain tests/engine/determinism` → **4 files / 23 tests passed**.

## 10.7 Chaos / recovery audit — proven in-suite; live cold-start/interrupt matrix at freeze

| Interruption | Where proven |
|---|---|
| SSE refresh / reconnect / non-contiguous gap → state fallback | `tests/orchestrator/exitGate.test.ts`, `tests/sse/sse.test.ts` |
| Degraded boot (missing config → typed 503) | `tests/degradedBoot.test.ts`, `tests/serverHttp.test.ts` |
| Qloo outage mid-run → honest partial, no fake completion | `tests/orchestrator/*`, `tests/qloo/*` |
| Budget exhaustion → honest stop at best-so-far | `tests/agent/budget.test.ts` |
| No duplicate phase effects / revisions | idempotency guards in `tests/orchestrator/*` |

Live cold-start and real-provider interrupt runs execute at freeze.

## 10.8 UI truth audit — PASS (fixture-browser walk + e2e)

Provenance badges (`[Qloo]`/`[Zorq heuristic]`/`[LLM]`), unknown-evidence-ID handling ("drops the
invented id" e2e), honest empty/uncertainty states, narrow-viewport S3 fallback, and reduced-motion
equivalents are covered by `e2e/judge-flow.spec.ts` + the Phase 8 fixture-browser walk
(`tmp/phase8-walk.json`, zero console errors). Secrets in the browser bundle: **0** (see 10.9).

## 10.9 Security audit — PASS (repository-provable)

| Check | Observed |
|---|---|
| Keys server-side only | `git grep 'QLOO_API_KEY=\|DEEPSEEK_API_KEY=\|TURSO_*='` → only the deploy tool's selftest literal; `src/web` bundle has **0** secret names/values |
| `.env` untracked | `git ls-files .env` → empty; `.gitignore` ignores `.env*` except `.env.example` |
| Browser bundle clean | `dist/web/**` grep for secret names + value prefixes → **0** hits (only the documented-public MapTiler key) |
| Helmet active | `src/server/app.ts:39` |
| Rate limiting active | `src/server/middleware/rateLimit.ts`, wired `app.ts:53` |
| Logs redacted | `scrubSecrets` in Qloo/LLM error paths; Pino redact list (`logger.ts`) |
| Untrusted output | Qloo/MCP/LLM output validated at the boundary; markdown sanitized |

## 10.10 Performance / budget audit — constants locked; live p50/p90 pending B-02

Locked in `src/server/config.ts`: `LOCK_LLM_BUDGET_USD = 2`, `LOCK_MAX_QLOO_CALLS = 180`,
`qlooConcurrency = 6`. Real p50/p90 latency, call count and cache-hit measurements are produced by
the first live funded run (B-02).

## 10.11 Full public-path browser suite — local PASS; deployed leg pending B-02

`npm run test:e2e` → **11 passed / 4 skipped** (gallery-only) against the real production build.
The deployed-URL pass and the run-dependent steps need a funded DeepSeek balance (B-02).

## 10.12 Final submission surfaces — PRESENT

| Surface | State |
|---|---|
| Public repo | `github.com/louji2308/Zorq` (PUBLIC) |
| `LICENSE` | MIT at root |
| README | 152 lines; problem, solution, live URL, screenshot, setup, Qloo, why-Qloo, architecture, run, deploy, method, limits, security, license |
| `/method` | built (formulas, heuristics, grades, limits, type note) |
| `.env.example` | placeholders only |
| Deployment | Render Docker service live; `npm run deploy` reproducible |
| Screenshots | `docs/screenshots/*` (S0, method; live-run gallery at freeze) |
| No login / free | yes (public URL) |
| `/healthz` | 200 on the deployed URL |

## 10.13 Final release gate — NOT YET MET (B-02)

| Group | Status |
|---|---|
| Product (composition not recommender, Prior Lock, Challenge, Without-Qloo, corrections) | ✅ built; Without-Qloo live A/B pending B-02 |
| Qloo (meaningful, traceable, removal weakens, no fabrication) | ✅ mechanism + gateway; live A/B pending B-02 |
| Agent (observes/adapts, bounded, failures=state, budgets) | ✅ architecture proven; live adaptive run pending B-02 |
| Determinism (reproducible numbers, graph math, fit, grades) | ✅ |
| UX (self-teaching, no narration, no dead ends, design system, a11y) | ✅ |
| Reliability (refresh/resume, SSE reconnect, partial failure, honest outage/budget, best-so-far) | ✅ in-suite; live cold-start at freeze |
| Engineering (typecheck, lint, unit, integration, e2e, build, deploy, health) | ✅ all green + live |
| Repository (no dupes, no mocks, no canned answers, no secrets, no debug, truthful history) | ✅ |

**Single blocker:** every "pending B-02" row is the DeepSeek balance (`$0.00`), which prevents the
Prior and therefore any live run. All fixture/offline audits are PASS; the remaining work is
proof-under-real-services, not capability.

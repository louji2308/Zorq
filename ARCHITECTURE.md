# ZORQ — Repository Execution Contract (`ARCHITECTURE.md`)

**Status:** Phase 1 deliverable — LOCKED for Phase 2+ build.
**Purpose:** one implementation path, one ownership map, one API/state/UI contract, visible blockers, defined phase gates.
**Authority:** this file is a *contract/index*. Where it paraphrases, the named ProjectSpec source wins (see §8 Source Register). It never overrides `AGENTS.md` §13 invariants or `ProjectSpec/IMPLEMENTATION_PLAN.md` budgets.
**Required by:** `ProjectSpec/Architecture.md` §27 (public delivery contract) and `ProjectSpec/IMPLEMENTATION_PLAN.md` Phase 1 ("Establish these contracts").

**What Zorq is (no ambiguity):** cultural composition intelligence for physical places — Brief → frozen LLM Prior → Qloo investigation → evidence → deterministic cultural measurement → competing compositions → self-challenge → constraint/format fit → evidence-bound Place Blueprint → honest Without-Qloo comparison. `Qloo = cultural measurement · Zorq code = all numeric truth · agent = interpretation/probe selection/mutation/explanation`. Never `LLM → Qloo → recommendations` (AGENTS.md §1, `ProjectSpec/IMPLEMENTATION_PLAN.md` §1).

---

## 1. Repository Map / Ownership

Eleven responsibility domains (named verbatim by `IMPLEMENTATION_PLAN.md` Phase 1, "Repository map"), each with exactly one owning directory. Proposed layout for the Phase 2 monorepo root:

```text
/
├─ src/
│  ├─ web/                     [frontend]  React + Vite + TypeScript SPA. Presentation, interaction,
│  │  │                                    client-only reranking, accessibility. Never holds API keys,
│  │  │                                    never calls Qloo, never owns authoritative scoring.
│  │  ├─ routes/                          the 4 locked UI routes (§5)
│  │  ├─ screens/                         S0 Brief · S1 Investigate · S2 Compositions · S3 Graph ·
│  │  │                                   S4 Challenge · S5 Blueprint (+ Overlays)
│  │  ├─ components/                      Agent Ledger, Field, graph, Evidence drawer, Replace panel,
│  │  │                                   Without-Qloo modal, provenance badges
│  │  └─ state/                           Zustand projection of `Run` (a view, not a source of truth)
│  ├─ server/                  [backend]   Express + TypeScript API host: app wiring, middleware
│  │  │                                    (Helmet, per-IP rate limit, Zod validation, typed errors),
│  │  │                                    route registration for exactly the 11 routes (§3), Pino logs.
│  │  ├─ routes/                          one module per §3 route — HTTP shape only, no domain logic
│  │  ├─ agent/         [agent]           one bounded DeepSeek tool-calling controller: Prior, anchor
│  │  │                                    selection, probe/mutation choice, stress emphasis, naming,
│  │  │                                    rationale. Never authors numeric truth (AGENTS.md §13).
│  │  ├─ qloo/           [qloo]           QlooGateway: transport-agnostic Qloo boundary (MCP primary,
│  │  │                                    DirectQlooTransport diagnostic fallback), capability check,
│  │  │                                    field projection, caching, budgets, retry/backoff. The only
│  │  │                                    code permitted to talk to Qloo.
│  │  ├─ engine/        [engine]          deterministic cultural measurement: neighborhoods, graph
│  │  │                                    edges, coherence, null-model percentile, distinctiveness,
│  │  │                                    weakest link, constraint fit, Prior→Final diff, budgets.
│  │  ├─ evidence/     [evidence]         EvidenceRecord creation, evidence IDs, provenance badges,
│  │  │                                    claim→evidence validation, citation eligibility. Never
│  │  │                                    invents evidence or interpretation.
│  │  ├─ orchestrator/ [orchestrator]     Run phase sequencing, bounded tool loop, SSE emission,
│  │  │                                    retries, stop/cancel, recovery, idempotent resume.
│  │  └─ persistence/ [persistence]       Turso/libSQL client, `runs` / `ledger_events` / `evidence`
│  │                                     tables, LRU cache state, sanitized blueprint snapshots.
│  └─ shared/                             [backend+frontend] Zod contracts shared across the wire:
│                                         Brief, Run state, the 11 request/response schemas, error
│                                         model, evidence/ledger event schemas. Single definition site.
├─ tests/                    [tests]      Vitest unit/integration + Playwright judge-path E2E; live
│                                         Qloo diagnostics stay out of the default suite (isolated).
├─ deployment/               [deployment] Dockerfile, Render service config, GitHub Actions
│                                         (CI + scheduled /healthz warm-up), environment contract.
├─ docs/                     [docs]       README, architecture diagram, Qloo integration table,
│                                         setup/deployment instructions, limitations, security notes,
│                                         judge path; `/method` content mirrored here (Tools §17).
├─ ARCHITECTURE.md                        this contract (repo root, required by Architecture §27)
├─ IMPLEMENTATION_STATE.md                mutable phase/progress record (not owned by this file)
├─ HACKATHON_TRACKER.md                   competition constraints record
├─ .env.example                           placeholders only — never a real key
└─ ProjectSpec/                           read-only supplied authorities; never edited
```

**Phase scoping**

| Directory | Phase that first makes it real |
|---|---|
| `src/web/routes`, `src/web/state`, `src/server/routes`, `src/shared`, `tests/`, `deployment/`, `docs/` | **Phase 2** (foundation; `GET /healthz` real) |
| `src/server/qloo`, plus capability probes | **Phase 3** (real Qloo + DeepSeek agent core) |
| `src/server/engine`, `src/server/evidence` | **Phase 4** (deterministic measurement) |
| `src/server/orchestrator`, `src/server/persistence` | **Phase 5** (durable state, SSE, recovery) |
| `src/web/screens` S0/S1 | **Phase 6** · S2/S3 **Phase 7** · S4/S5 **Phase 8** |
| full-tree integration, deployment hardening | **Phases 9–10** |

Rules: existing-file-first (AGENTS.md §3) — one owner per responsibility, no `thing2.ts` duplicates; no second API family, no second state store, no second Qloo gateway. Frontend state is a projection of `Run`, never a competing source (`ProjectSpec/Architecture.md` §17).

---

## 2. Canonical Run State

Reproduced exactly as locked by `ProjectSpec/IMPLEMENTATION_PLAN.md` Phase 1 → "Canonical Run state" (13 top-level children under `Run`). Field-level detail lives in `ProjectSpec/Architecture.md` §6 and is not duplicated here.

```text
Run
├─ Brief
├─ Prior [WRITE-ONCE]
├─ SiteRead
├─ CulturalDNA
├─ CandidatePool
├─ Neighborhoods
├─ Graph
├─ Compositions
├─ StressReport
├─ ConstraintFit
├─ Revisions
├─ Evidence
└─ LedgerEvents
```

**Node ownership (single writer per node)**

| Node | Written by (component) | One-line rule |
|---|---|---|
| `Run` header (`id/status/phase`) | orchestrator | Only the orchestrator advances `status`/`phase`; every phase is idempotent and resumable (Architecture §6). |
| `Brief` | backend route `POST /api/runs` → orchestrator | Zod-validated user input; never mutated by the agent. |
| `Prior` | agent (LLM-only), persisted by orchestrator | **WRITE-ONCE.** Created at run start before the first Qloo call, `qlooUsed=false`, immutable for the run's life; every later change is attributed to evidence (Prior Lock, AGENTS.md §13; Architecture §6). |
| `SiteRead` | qloo gateway output, orchestrator persists | Locality/heatmap signals; selected/unpinned anchors recorded as state, not prose. |
| `CulturalDNA` | engine computes, agent selects anchors | Local-vs-city over-index comparison computed deterministically from Qloo measurements — never an LLM label (Architecture §10). |
| `CandidatePool` | agent forms, engine/evidence validate | Each component keeps its provenance path anchor → entity → category; unresolved concepts use exemplar clustering, never invented tags (Architecture §10). |
| `Neighborhoods` | engine | Weighted artist/movie/brand vectors built from Qloo-returned neighborhoods (Architecture §11.1). |
| `Graph` | engine | Edges and weakest links are deterministic from normalized inputs (AGENTS.md §13). |
| `Compositions` | engine computes readings; agent names | Coherence percentile, distinctiveness, weakest link, evidence grade are Zorq arithmetic only (Architecture §11.3–11.5). |
| `StressReport` | orchestrator executes; agent chooses attacks; engine classifies | Five attacks, `Survived / Revised / Replaced`, mutation rounds ≤ 2 (Architecture §7, §13). |
| `ConstraintFit` | engine | Format/footprint/hours fit is deterministic and documented on `/method` (Product Spec §12). |
| `Revisions` | orchestrator, from user actions | Append-only history of unpin/replace/recompute effects. |
| `Evidence` | evidence layer | EvidenceRecords are created only from real observations; unknown IDs never render as confirmed evidence (Architecture §15.1). |
| `LedgerEvents` | orchestrator | Append-only `Qloo / Compute / LLM` activity log; the S1 Agent Ledger is a view of it. |

**Recovery vs visibility invariant:** the **database is the recovery source of truth**; **SSE is progressive visibility only**. The client tolerates reconnects and replays current `Run` state rather than assuming every event was received (`ProjectSpec/Architecture.md` §17, "Frontend/Backend Interaction"). Stale client state must never override server truth (Implementation Plan Phase 10 → 10.8).

---

## 3. API Surface

**Exactly one API family: the 11 routes below** (locked by `ProjectSpec/IMPLEMENTATION_PLAN.md` Phase 1 → "API surface", repeated verbatim at Phase 10 → 10.3). No other HTTP endpoint exists or may be added without amending the plan.

### 3.0 Shared error model (applies to every route)

Phase 2 implements this as the "typed error model" (`IMPLEMENTATION_PLAN.md` Phase 2). Every non-2xx response body:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "human-readable, no secrets",
             "details": [{ "path": "brief.areaSqFt", "message": "expected number" }],
             "requestId": "…" } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Zod rejected the request body/params. |
| `RUN_NOT_FOUND` | 404 | Unknown or malformed `:id`. |
| `SNAPSHOT_EXPIRED` | 410 | Shared blueprint past TTL — body offers same-brief rerun (Product Spec §15). |
| `CONFLICT` | 409 | Action not legal in current run state (e.g. edit after terminal phase, mutation rounds exhausted). |
| `UNKNOWN_ENTITY` | 422 | Model-supplied entity/tag rejected before display (Architecture §19). |
| `RATE_LIMITED` | 429 | Per-IP or budget rate limit. |
| `DEPENDENCY_UNAVAILABLE` | 502 | Upstream (LLM/Qloo) failed before any state was persisted. |
| `SERVICE_UNAVAILABLE` | 503 | Required configuration absent / dependency check failed (Phase 2 gate: "fails clearly when required configuration is absent"). |
| `INTERNAL` | 500 | Unexpected; logged with `requestId`, never leaks secrets. |

Security baseline for **all** routes: Helmet; per-IP `express-rate-limit` (numeric limits are Phase 2 config recorded in `IMPLEMENTATION_STATE.md`; mutating routes use the stricter class); Zod validation at the boundary; `QLOO_API_KEY`/`DEEPSEEK_API_KEY`/Turso credentials server-side only; **Qloo is never called from the browser**; responses and SSE events never contain keys or raw Qloo payloads (field projection first) — `ProjectSpec/Architecture.md` §21, `Tools_and_Requirements.md` §12.

---

### 3.1 `GET /healthz`

| Field | Contract |
|---|---|
| Request | None (no body, no params). |
| Response `200` | `{ "status": "ok", "service": "zorq", "version": "…", "checks": { "config": "ok", … } }` — no secrets, no provider credentials, no run data. |
| Errors | `503 SERVICE_UNAVAILABLE` with the shared error body when required configuration is absent or a critical dependency check fails. |
| Security | Public (scheduled GitHub Actions warm-up pings it every ~10 min: Tools §18, Architecture §22); still rate-limited; payload must be provably free of key material. |
| Tests | Returns 200 with empty checks when config present; returns 503 (and clear message) with a required env var removed; assertion that no value from `.env` appears in the body; CI smoke against the deployed app (Phase 2 gate). |

### 3.2 `POST /api/runs`

| Field | Contract |
|---|---|
| Request | Brief (Zod, from `src/shared`): `{ location: string (required), coordinates?: { lat: number, lon: number }, radius?: number, areaSqFt?: number, objective: string (≤200 chars), constraints?: string[] (constraint chips), admiredPlaces?: string[] (≤3, canonical place names/IDs), presetId?: "…" }` — fields per Product Spec §7 S0 (presets seed briefs only, never final answers: Plan Phase 10 → 10.2). |
| Response `201` | `{ run: { id, status, phase, brief, prior } }`. `prior` is `{ composition, generatedAt, model, qlooUsed: false }` and is locked **before** the response returns (LLM-only, ~3 s: Product Spec §5). If the Prior cannot be produced, no `Run` row is persisted. |
| Errors | `400 VALIDATION_FAILED` (missing `location`, objective > 200 chars, >3 admired places); `429 RATE_LIMITED`; `502 DEPENDENCY_UNAVAILABLE` (LLM unreachable — honest failure, client offers Retry); `503` config missing. |
| Security | Strict rate limit class; Zod validation; **no Qloo cultural call occurs before the Prior is locked** (Prior-before-Qloo, Plan Phase 1 / Architecture §16); presets must not inject canned evidence; response carries no keys. |
| Tests | 201 round-trip returns the persisted brief; `prior.qlooUsed === false`; ordering assertion: Prior timestamp precedes the first Qloo ledger event; validation rejections return `400` with `details`; rate-limit returns `429`; no-key-leak assertion on the body. |

### 3.3 `GET /api/runs/:id`

| Field | Contract |
|---|---|
| Request | Path param `id` (validated run identifier). |
| Response `200` | `{ run: RunState }` — the full canonical tree of §2 as a typed projection (Sanitized: no raw Qloo payloads; cached vs live status preserved on ledger rows). This is the authoritative replay source after SSE reconnect. |
| Errors | `400` malformed id; `404 RUN_NOT_FOUND`. |
| Security | Per-IP rate limit; Zod path validation; output filtered through the shared `RunState` schema so unknown/uncast fields cannot leak through; no secrets. |
| Tests | Round-trip equals persisted state after each phase transition; unknown id → 404; schema-strip test (inject a stray `apiKey` field server-side, assert it is absent from the response); Prior unchanged after later mutations. |

### 3.4 `GET /api/runs/:id/events` — SSE

| Field | Contract |
|---|---|
| Request | Path `id`; standard SSE negotiation (`Accept: text/event-stream`); optional `Last-Event-ID` header. |
| Response `200` | `Content-Type: text/event-stream`. On connect the server first emits a `state` event carrying the current authoritative `Run` snapshot, then streams incremental events: `phase`, `ledger` (kind `Qloo`/`Compute`/`LLM`, label, summary, duration, cacheState, resultCount), `evidence`, `dna`, `compositions`, `stress`, `blueprint`, `error`, plus periodic heartbeat comments. Monotonic `id:` per run. |
| Reconnect / replay | **Database authoritative.** Phase 2–4: any reconnect re-sends the full `state` event (client reconciles from `GET /api/runs/:id`). Phase 5+: missed events replayed from the durable `ledger_events` log; if the replay gap cannot be proven complete, the server falls back to a fresh `state` event. The client must never assume every event arrived (Architecture §17). |
| Errors | `404 RUN_NOT_FOUND`; `429` connection-rate limit; mid-stream `error` events use the shared error shape. |
| Security | Same-origin production target; per-IP and per-run connection limits; event payloads are projected summaries only — endpoint/parameter display has the key redacted; **no raw Qloo response bodies and no secrets ever cross the stream**. |
| Tests | Connect → first frame is `state`; event ordering monotonic; drop the connection (Playwright) → reconnect → client state matches server truth; replay does not duplicate side effects; heartbeat keeps idle connections alive; key-redaction assertion on `ledger` frames. |

### 3.5 `POST /api/runs/:id/stop`

| Field | Contract |
|---|---|
| Request | `{}` or optional `{ "reason": string (≤200) }`. |
| Response `200` | `{ run: RunState }` with `status: "stopped"` and an explicit incomplete/best-so-far marker — a stopped run returns the **best defensible state, never fabricated completion** (Architecture §7, §19). |
| Errors | `404`; `429`. Idempotent: calling again on a terminal run returns `200` with current state, not an error. |
| Security | Rate-limited mutation class; Zod-validated body; no Qloo calls triggered by stopping. |
| Tests | Stop mid-phase → persisted status `stopped`, partial state intact, no duplicate phase effects; double-stop idempotency; SSE emits terminal event then closes cleanly; resuming/refetching after stop returns the same state (no corruption). |

### 3.6 `POST /api/runs/:id/unpin-anchor`

| Field | Contract |
|---|---|
| Request | `{ "anchorId": string }` — an entity ID already present in `SiteRead.selectedAnchors`. |
| Response `200` | `{ run: RunState }` — anchor removed, `SiteRead` updated, `CulturalDNA` recomputed from remaining anchors, `Revisions`/`LedgerEvents` appended; affected DNA nodes flagged for the UI diff flash (Product Spec §8: 1–3 insight calls). |
| Errors | `400 VALIDATION_FAILED` (missing/unknown `anchorId`); `404`; `409 CONFLICT` if anchors are no longer editable in the current terminal state; `429`. |
| Security | Zod validation against live run state (never trust the client's ID); the agent may only re-select from real Qloo-returned anchors; no key exposure; Qloo calls made inside this route count against `MAX_QLOO_CALLS`. |
| Tests | Unpin removes exactly that anchor; DNA recompute is deterministic given the same remaining anchors; ledger records the action; ≤3 Qloo calls for the recompute; unknown anchor → 400; terminal run → 409. |

### 3.7 `POST /api/runs/:id/replace`

| Field | Contract |
|---|---|
| Request | `{ "targetComponentId": string, "candidateId"?: string, "customQuery"?: string }` — exactly one of `candidateId` (role-preserving alternative from the pool) or `customQuery` (free text → tag resolve + probe, **≤ 4 calls**: Product Spec §7 Overlays). |
| Response `200` | `{ run: RunState, delta: { coherence: number, distinctiveness: number }, weakestLink: { … } }` — Δ values produced by the engine, relative bands only; a revision row is appended; a mini-stress pass runs (Product Spec §7 Overlays). |
| Errors | `400` (both or neither candidate, or candidate does not preserve the target role); `404`; `409 CONFLICT` (run terminal / mutation budget exhausted); `422 UNKNOWN_ENTITY` (custom resolve produced an unresolvable entity — rejected before display: Architecture §19); `429`. |
| Security | Rate-limited; Zod validation; custom resolution goes through the gateway (browser never calls Qloo); replacement candidates must carry a valid provenance path; no fabricated entities. |
| Tests | Role preservation enforced (replacing an Anchor with a Discovery → 400); Δ recomputed deterministically from the same pool; ≤4 Qloo calls for `customQuery`; revision appended exactly once; unknown entity → 422 and never reaches UI; mini-stress recorded in `StressReport`. |

### 3.8 `POST /api/runs/:id/challenge`

| Field | Contract |
|---|---|
| Request | `{}` (agent chooses attack emphasis from graph diagnostics) or `{ "focus"?: "ablation" | "substitution" | "bridge" | "catchment" | "rival" }`. |
| Response `202` | `{ runId, status: "running", stress: { attacks: [ { kind, status } … five kinds ] } }` — long-running; progress streams on `…/events`, completion lands in `StressReport` and is readable via `GET /api/runs/:id`. Verdict shape: `Survived / Revised (with diff) / Replaced by {rival}` **plus reason** (Product Spec §7 S4). |
| Errors | `400` invalid `focus`; `404`; `409 CONFLICT` when mutation rounds ≥ 2 (locked cap) or a challenge is already running; `429`. |
| Security | Rate-limited; agent runs within locked budgets (`planner turns ≤ 3/phase`, `mutation rounds ≤ 2`, Qloo budget with ~30% stress reserve); a failed probe stays visibly failed and caps the evidence grade at B — failures are state, not hidden exceptions (Architecture §19). |
| Tests | All five attacks appear with statuses; ≤2 mutation rounds enforced; failed probe → evidence grade capped at B; verdict always carries a reason; budget exhaustion returns best-so-far with explicit incomplete status; concurrency test proves no overlapping challenges on one run. |

### 3.9 `POST /api/runs/:id/recompute`

| Field | Contract |
|---|---|
| Request | `{ "changes": { "areaSqFt"?: number, "objective"?: string (≤200), "constraints"?: string[] } }` — at least one field; no new `location`. |
| Response `200` | `{ run: RunState, priorUnchanged: true }` — constraint/format fit re-run and compositions re-ranked; **the Prior is never regenerated** (changed sq ft → re-fit formats only; changed goal → keep Prior, re-weight: Product Spec §8). |
| Errors | `400` (empty `changes`, objective > 200 chars, invalid constraint); `404`; `409 CONFLICT` (run terminal); `429`. |
| Security | Rate-limited; Zod validation; a sq-ft-only recompute performs **zero Qloo calls** (asserted by test); no Qloo key exposure. |
| Tests | Prior object byte-identical before/after (write-once invariant); deterministic re-fit — same input → same `ConstraintFit`; sq-ft-only path emits no Qloo ledger events; constraint infeasibility triggers documented downshift, not silent failure. |

### 3.10 `GET /api/runs/:id/blueprint`

| Field | Contract |
|---|---|
| Request | Path `id`; optional snapshot/share query params handled by the same route. |
| Response `200` | `{ blueprint: { title, rationale ([LLM], cites evidence IDs), compositionByRole[], fitToSite { footprint, hours, downshifts }, whatQlooChanged { kept[], added[], removed[], reformatted[] }, risks[], evidenceGrade, revisionHistory[], methodUrl, shareUrl, generatedAt, expiresAt } }` — sanitized snapshot; every cited evidence ID must exist (Architecture §15.1). |
| Errors | `404` unknown run; `410 SNAPSHOT_EXPIRED` with body offering a same-brief rerun (Product Spec §15); `500` (logged, `requestId` only). |
| Security | Read-only, shareable, no auth (free judge path); sanitized — no raw Qloo payloads, no keys, no personal data; rationale markdown/HTML sanitized before render (Architecture §21). |
| Tests | Snapshot equals the persisted final state; citation test: every evidence ID in the rationale resolves; expired → 410 + rerun affordance; no-key/no-raw-payload assertion; markdown sanitization test on model-authored text. |

### 3.11 `GET /api/method`

| Field | Contract |
|---|---|
| Request | None. |
| Response `200` | `{ method: { whatQlooMeasures[], whatZorqComputes[], whatTheLlmGenerates[], heuristics[] (format library / role map, marked editable), formulas[], examples[], knownLimits[], setupSummary, evidenceVsInference } }` — the content contract for the `/method` route (Product Spec §7 Overlays, §17; Architecture §16). |
| Errors | `500 INTERNAL` only (static content; failure is a build defect). |
| Security | Public, rate-limited, static; must not contain secrets or any claim that Qloo computes a Zorq metric. |
| Tests | Schema validation; required sections present; content assertion that `whatQlooMeasures` and `whatZorqComputes` are disjoint lists (guards the numeric-truth boundary); CI check that docs mirror stays in sync (Tools §17). |

---

## 4. Qloo Contract

### 4.1 Capability list → proven transport mapping

Capability list from `IMPLEMENTATION_PLAN.md` Phase 1 → "Qloo contract". Endpoint/provenance column is the **actual evidence** from the 10 live calls recorded in `IMPLEMENTATION_STATE.md` (Gate A REST path, 2026-10-06) plus explicitly-marked unproven items.

| # | Capability | Mapped route / tool | Evidence status |
|---|---|---|---|
| 1 | capabilities/startup | MCP `qloo mcp` + `qloo_capabilities` (primary); REST base `https://hackathon.api.qloo.com` + `X-Api-Key` (fallback/diagnostics) | **MCP transport PROVEN live (W-1.2 + independent orchestrator re-run, 2026-10-06): verdict `USABLE-WITH-CONDITIONS`** — stdio JSON-RPC, 10 tools, `qloo_capabilities` → contract v1.0.0 / canonical / 9 operation_ids. Conditions in §4.3. REST auth also proven live. |
| 2 | entity/place search | `GET /search?query=…&type=urn:entity:…` | Proven (A1 movie 200; A4 place 200 with address/geocode/hours). |
| 3 | tag resolution | `GET /v2/tags?filter.query=…` | Proven (A3 200; bare `query=` → 400, A2 — param enumeration captured). |
| 4 | locality/heatmap | `GET /v2/insights` with `filter.location=POINT(lon lat)` + `filter.location.radius`, or `filter.location.query`; heatmap via `filter.type=urn:heatmap` | Locality proven live (C1 all 5 results inside radius; C2 fuzzy named-locality works). `urn:heatmap` documented in Product Spec §0, **not yet exercised by us**. |
| 5 | anchor discovery | `/v2/insights` place-scoped queries near target | Proven (B1: place tag accepted as signal). |
| 6 | place → culture | `signal.interests.entities=<place id>` → artists/movies/brands | Proven (B2/B3 200, 377 KB, numeric `query.affinity`). |
| 7 | culture → place | cultural entity/tag signals → `filter.type=urn:entity:place` candidate places | Documented (Product Spec §0: place-entity-as-signal verified elsewhere); **not yet in our 10 calls**. |
| 8 | candidate validation | site-scale vs city-scale `/v2/insights` place queries with resolved category tags | Partially proven (C1/C3 scale+radius pattern); category-tag half pending. |
| 9 | taste neighborhoods | `/v2/insights` entity neighborhoods (top 30 per domain, Architecture §11.1) | Pending live proof. |
| 10 | bridge | MCP `qloo_recommend` / combined audience signals (Tools §5) | Tool `qloo_recommend` present in `tools/list`; bridge behaviour itself pending Phase 3 exercise. |
| 11 | replace | MCP `qloo_rank` shortlist of role-preserving alternatives | Tool `qloo_rank` present in `tools/list`; behaviour pending Phase 3 exercise. |
| 12 | triangulation | independent second route over finalist edges; optional `qloo_compare_audiences` (Tools §5) | Tool `qloo_compare_audiences` present in `tools/list`; behaviour pending Phase 3 exercise. |
| 13 | explainability where supported | `feature.explainability=true` on `/v2/insights` | Documented (Product Spec §0, verified by other repos); **not exercised in our 10 calls** — rank-only fallback is the required degraded mode (Gate E). |

**Transport rule:** production abstraction is `QlooGateway`, transport-agnostic; official `qloo mcp` is the primary deployed transport, `DirectQlooTransport` is the diagnostic/fallback path (Tools §5 "Low-level fallback"). **The gateway hides transport from everything above it** — engine, evidence and orchestrator consume typed results, never HTTP/MCP details.

### 4.2 MCP transport — proven verdict and binding conditions (2026-10-06)

Verdict `USABLE-WITH-CONDITIONS` (W-1.2 reconnaissance; independently re-run and confirmed by the Orchestrator the same day). Evidence: stdio newline-delimited JSON-RPC; `initialize` → `qloo-harness 0.1.26`, protocol `2024-11-05`; `tools/list` = 10 tools (`qloo_capabilities`, `qloo_recommend`, `qloo_rank`, `qloo_describe`, `qloo_where_popular`, `qloo_compare_audiences`, `qloo_entity_tags`, `qloo_audience_demographics`, `qloo_trends`, `qloo_find_tags`); live `qloo_find_tags {query:"jazz"}` → ok in ~1.6 s; `qloo doctor --network` → "accepted the configured credential". No LLM/model credential needed for MCP mode. Spike artifacts live only in the OS temp dir (never committed).

Binding conditions for Phase 3 gateway config:
1. **Trusted base URL:** both `QLOO_BASE_URL` and `QLOO_TRUSTED_BASE_URL` must be set to `https://hackathon.api.qloo.com`; otherwise boot throws `Custom Qloo base URL is not trusted`. Default base is production `https://api.qloo.com`.
2. **Envelope ≠ raw REST:** MCP results arrive as a normalized envelope (`schema_version, operation, status ∈ ok/empty/needs_input/partial/degraded/error, interpretation, results, result_count, provenance, query_intent, execution`) — the gateway's mapping layer targets this shape; `contract_checksum` (`sha256:762bd…924f5`) must be recorded and change-detected (clients may cache `tools/list`).
3. **Capability gaps require the REST fallback — demonstrated, not hypothetical:** the canonical 9 operations do **not** expose entity/place search, heatmap (`urn:heatmap`), taste neighborhoods, or `feature.explainability` (rows 2, 4, 9, 13) → `DirectQlooTransport` stays a required path, exactly as Tools §5 mandates.
4. **Process model:** long-lived child process, ~2.5 s startup, 142 npm packages — consistent with the Render/no-serverless constraint (Tools §5); no 429 observed in probe (quota numbers still unknown, unchanged).

### 4.3 Fixed truths (do not re-litigate)

- **Qloo = cultural measurement only.** Qloo never computes a Zorq metric: coherence, null-model percentile, distinctiveness, weakest link, constraint fit, Prior→Final diff and budgets are Zorq deterministic code (AGENTS.md §13; Architecture §5, §11).
- **Field projection is mandatory.** Payloads measured at **0.2–1.0 MB per call with no server-side field filtering** → the gateway must project fields before anything crosses SSE or reaches the database (`IMPLEMENTATION_STATE.md` Gate A evidence).
- **Affinity band is compressed** (measured range 0.0357 over 50 results) → deltas must be normalized and shown as relative bands; never present raw affinity gaps as meaningful magnitudes, and never as demand/probability/individual identity (Architecture §15.3, §21).
- **`take > 50` returns 400**; reject oversized `take` client-side (Product Spec §0).
- **Location filter + artist/brand/movie types returns 200 with zero results, not an error** → invalid combinations must be rejected in the gateway *before* calling Qloo (Product Spec §0).
- **POST bodies are required** for `signal.interests.entities.query` and `filter.exclude.entities.query` (JSON-body params) in addition to GET (`IMPLEMENTATION_STATE.md` Active Work).
- **Budgets (locked):** `MAX_QLOO_CALLS=180` target, ≈200 hard ceiling until measured otherwise; concurrency ≤ 8 (default 6) via `p-limit`; planner turns ≤ 3/phase; mutation rounds ≤ 2; stress reserve ≈30%; `LLM_BUDGET_USD=2.00` (Architecture §20; AGENTS.md §13).
- **Cache/policy:** in-memory LRU, TTL ≈6 h, smallest useful result only, cache key = endpoint + normalized params, ledger shows `live` vs `cached`, no bulk extraction, `PERSIST_QLOO_DERIVED=false` until a private storage owner exists; never store Qloo responses in a public repository (Tools §13; D-0.7/D-0.10).
- **Honest failure:** 429/5xx → bounded backoff with a visible ledger state; zero-useful-results → reformulate once, then `not measured`; Qloo outage → stop at Prior/partial state with honest explanation and Retry (Architecture §19).

---

## 5. UI Contract

### 5.1 Locked routes

From `IMPLEMENTATION_PLAN.md` Phase 1 → "UI contract" and `Product Specification.md` §6:

| Route | Screen(s) | Contract |
|---|---|---|
| `/` | S0 Brief | One-click entry: presets (2 Qloo-divergent + 1 honest control), brief card (address/place, sq ft, goal ≤200 chars, constraint chips, up to 3 admired places), CTA "Investigate this site". **No Qloo cultural calls before the Prior** — autocomplete `/search` only (Product Spec §7 S0; Architecture §16). |
| `/run/:id` | views `investigate` \| `compositions` \| `graph` \| `stress` \| `blueprint` (S1–S5) | Single workspace; tabs unlock as phases complete; browser back returns to previous view while the run continues; no dead ends — every view has a forward action and "New brief" (Product Spec §6). |
| `/run/:id/blueprint` | read-only shareable snapshot | Stands alone as a decision artifact with the same provenance/evidence language; expired → honest "snapshot expired" + same-brief rerun (Architecture §16; Product Spec §15). |
| `/method` | method page | Exactly what Qloo measures, what Zorq computes, what the LLM generates, heuristics, formulas, examples, known limits, evidence vs inference (Architecture §16; served by §3.11). |

### 5.2 Locked behaviors

| Behavior | Contract (source) |
|---|---|
| **Prior-before-Qloo** | The frozen LLM-only Prior is visible before any investigation; all later change is attributed to evidence; write-once for the run (Plan Phase 1; Product Spec §5). |
| **Agent Ledger** | Streaming rows with kind pill `Qloo`/`Compute`/`LLM`, label, result summary, duration; row expands to endpoint, parameters (**key redacted**), result count, `live` vs `cached` — this is the proof-of-integration view (Product Spec §7 S1; Final Design §7.1). |
| **Provenance badges** | `[Qloo]` measured · `[Zorq heuristic]` deterministic rule · `[LLM]` interpretation — a sentence must not imply more certainty than its weakest layer (Architecture §15.2). |
| **Evidence drawer** | claim → source badge → entities (name, domain, rank) → one-line "how computed" → links to ledger rows; opens from edges, DNA chips and receipts (Product Spec §7 Overlays). |
| **Field** | S2 hero: one shared histogram of all valid combinations with Prior + A/B/C markers on a common scale; percentile ticks, no absolute numbers; Familiar ↔ Distinctive dial re-ranks **client-side from cached deterministic metrics** (Final Design §7.2; Architecture §16 S2). |
| **Graph evidence** | Edge click → shared entities (IDF-weighted) + triangulation line + ledger links; hatched = unmeasured, never filled with guesses; narrow-screen/accessibility fallback = sorted edge list (Product Spec §7 S3; Architecture §16 S3). |
| **Challenge** | Five attacks (ablation, substitution, bridge, catchment shift, rival check) with statuses; verdict `Survived/Revised/Replaced` always with reason; failed probe stays visible and caps evidence grade at B (Product Spec §7 S4). |
| **Blueprint** | Title + rationale with evidence receipts, composition by role, fit-to-site, "What Qloo changed" (Kept/Added/Removed/Reformatted), risks, evidence grade, revision history, share/copy/print (Product Spec §7 S5). |
| **Without-Qloo comparison** | Modal: frozen Prior + LLM-only polish (generated at run start, same constraints, no tools) vs Final, differences highlighted — honest even when Qloo confirms rather than redirects (Product Spec §7 S5; Plan §1). |
| **Correctability** | Unpin anchor, Replace member, Stop-and-show-best-so-far, dial, re-run — each writes state, not just UI (Product Spec §8). |
| **Responsive fallbacks** | Graph → sorted edge list; S1 map/ledger re-flow; distance-chart equivalent view; 8 px grid (Final Design §10.2). |
| **Accessibility** | Raleway for UI text (weight floor, size floor) and Bricolage Grotesque for display only; **lining tabular numerals everywhere numbers appear** (`font-variant-numeric: lining-nums tabular-nums`, `lnum`/`tnum`); ink greys on white; **no shadows, no blur/glass, no gradients, no purple-neon AI aesthetic**; AA contrast; keyboard focus visible; reduced-motion equivalent (Final Design §4.2, §5.5, §10). |
| **No magical score** | Never a single headline ecosystem number; three defined readings + percentile + evidence grade only; calibrated wording ("places this above 91% of valid combinations in this pool"), never "Qloo rates this 91/100" (Architecture §15.3; Product Spec §1). |
| **Uncertainty stays visible** | thin / contested / not measured / incomplete states render as themselves; no averaging away, no confident prose over missing data (AGENTS.md §13). |

---

## 6. Phase Gates

Exit gates from `ProjectSpec/IMPLEMENTATION_PLAN.md`; near-verbatim.

**Phase 0 — Reconnaissance & build control** (recorded in `IMPLEMENTATION_STATE.md`, signed off 2026-10-06; no gate text in the plan itself): repository state reconstructed, all Project Spec sources read, toolchain verified, blockers assigned, user decisions (D-0.5…D-0.10) received, public MIT repository live, Qloo key issued and proven with real diagnostic evidence, and no secrets in tracked files. Hand-off item: write the Phase 1 contract.

**Phase 1 — Contract, Reconnaissance & Build Control:** "The repo has one implementation path, clear responsibility owners, defined API/state contracts, visible unresolved blockers, defined phase gates, and no plausible ambiguity about what Zorq is." (This file is its principal artifact.)

**Phase 2 — Repository Foundation & Typed Runtime:** "A fresh checkout installs, typechecks, lints, tests, builds, starts, responds to `/healthz`, and fails clearly when required configuration is absent."

**Phase 3 — Real Qloo + DeepSeek Agent Core:** "A real brief produces a Prior, at least one real Qloo observation, a validated state mutation, a ledger event and an evidence record. Qloo outage yields an honest partial state."

**Phase 4 — Deterministic Cultural Measurement Engine:** "A controlled candidate pool can produce a complete graph, ranked role-valid compositions, percentile, distinctiveness, weakest links and evidence classifications without LLM-generated numbers."

**Phase 5 — Orchestrator, Durable State, SSE & Recovery:** "A run can be stopped, refreshed, disconnected, reconnected, retried or resumed without corrupting state, duplicating effects or fabricating completion."

**Phase 6 — Frontend S0/S1: Brief, Prior & Investigation:** "A judge can land, choose a preset, see the Prior, watch real investigation, and understand what Qloo is doing without reading the source code."

**Phase 7 — S2/S3: Compositions, Field, Graph & Evidence:** "A judge can answer *why do these components belong together?* by inspecting an edge rather than trusting an unsupported narrative."

**Phase 8 — S4/S5: Challenge, Constraint Fit & Blueprint:** "A complete run produces a professional Blueprint understandable without watching the agent work."

**Phase 9 — Full-System Integration, Deployment & Judge Readiness:** "A fresh judge can open the public URL and reach a meaningful result without login, private credentials, hidden developer intervention or a fabricated data layer."

**Phase 10 — Red Team, Exceptional Handling & Final Verification:** the final release gate (Plan §10.13) — the project may be called **judge-ready** only when Product, Qloo, Agent, Determinism, UX, Reliability, Engineering and Repository sections all pass: Prior Lock real, Challenge real, Without-Qloo honest, Qloo removal materially weakens the system, numeric outputs reproducible, refresh/SSE/partial-failure recovery honest, typecheck/lint/unit/integration/E2E/build green, deployment live, no secrets, no production mocks, no hardcoded answers, professional truthful Git history.

---

## 7. Unresolved Blockers

Visible, owned, tracked (full register in `IMPLEMENTATION_STATE.md` §Known Risks / Blockers):

| ID | Blocker | Impact | Owner | Source |
|---|---|---|---|---|
| B-02 | DeepSeek API key + balance not yet available | Blocks Prior Lock, agent controller, every LLM-backed run; mitigated by Qloo-first sequencing (D-0.8) | **User** | `IMPLEMENTATION_STATE.md` §Known Risks |
| Gate A (MCP half) | ~~`qloo mcp` + `qloo_capabilities` not yet proven~~ **PROVEN 2026-10-06** (W-1.2 + orchestrator re-run; `USABLE-WITH-CONDITIONS`, §4.2) | Gate A now fully open in the positive sense: REST path + MCP path both live. Remaining Phase 3 work: build `QlooGateway` on the proven MCP path with REST fallback for the four demonstrated capability gaps | **Closed — evidence in §4.2** | `IMPLEMENTATION_STATE.md` Gate A evidence; `Tools_and_Requirements.md` §19 Gate A |
| B-06 | MapTiler key and Turso database not provisioned | Blocks map/geocoding (S0/S1) and durable Run state (Phase 5); not needed for Phases 1–2 | **User** | `IMPLEMENTATION_STATE.md` §Known Risks |
| Quota | Organizer clarification on event quota / rate limits still pending — ask via **#api-help** on Discord if Spike 3/5 shows need; exact numbers currently measured empirically | Caps confidence in `MAX_QLOO_CALLS=180/≈200` and concurrency defaults until measured | **Orchestrator** | `Tools_and_Requirements.md` §13 (blocking prerequisite); `HACKATHON_TRACKER.md` quota row |
| D-0.6 | Docker not installed locally | Local container tests skipped; Dockerfile validated on Render only — accepted dev-time risk, revisit if container build fails late | **User (accepted)** | `IMPLEMENTATION_STATE.md` D-0.6 |
| Devpost | Devpost registration/submission fields (text description, custom fields, live URL, truthful start date) not started | Submission-day pass/fail requirements (R3, R8) | **User** | `HACKATHON_TRACKER.md` requirement rows |

---

## 8. Source Register

Which supplied file is authoritative for which section of this contract (contract hierarchy: official Qloo/Devpost rules → Product Specification → Architecture → Tools & Requirements → Final Design → Idea → Implementation Plan procedure → AGENTS.md → local judgment):

| § This file | Authoritative source |
|---|---|
| §1 Repository map / ownership | `ProjectSpec/IMPLEMENTATION_PLAN.md` Phase 1 → Repository map (domain names, locked); `ProjectSpec/Tools_and_Requirements.md` §2, §15–§18 (stack, scripts, env, repo/CI); `ProjectSpec/Architecture.md` §5, §27 |
| §2 Canonical Run state | `ProjectSpec/IMPLEMENTATION_PLAN.md` Phase 1 → Canonical Run state (tree, verbatim); `ProjectSpec/Architecture.md` §6 (field detail), §17 (SSE vs database), §19 (failure semantics) |
| §3 API surface | `ProjectSpec/IMPLEMENTATION_PLAN.md` Phase 1 → API surface (the 11 routes) and Phase 10 → 10.3 (re-verification); `ProjectSpec/Product Specification.md` §6–§8 (request/response semantics from screens & interaction matrix); `ProjectSpec/Architecture.md` §15, §17, §19, §21; `ProjectSpec/Tools_and_Requirements.md` §12, §14 (error/failure behavior) |
| §4 Qloo contract | `ProjectSpec/IMPLEMENTATION_PLAN.md` Phase 1 → Qloo contract (capability list); `ProjectSpec/Product Specification.md` §0, §3, §10 (verified endpoint facts); `ProjectSpec/Tools_and_Requirements.md` §5, §7, §13, §19; `ProjectSpec/Architecture.md` §5, §9, §11, §20; live-call evidence in `IMPLEMENTATION_STATE.md` |
| §5 UI contract | `ProjectSpec/IMPLEMENTATION_PLAN.md` Phase 1 → UI contract (locked routes); `ProjectSpec/Product Specification.md` §5–§8, §14–§15; `ProjectSpec/Architecture.md` §15–§16; `ProjectSpec/Final_design.md` §4–§7, §10 |
| §6 Phase gates | `ProjectSpec/IMPLEMENTATION_PLAN.md` Phases 1–10 exit gates (+ §10.13); Phase 0 from `IMPLEMENTATION_STATE.md` |
| §7 Blockers | `IMPLEMENTATION_STATE.md` §Known Risks / Blockers + D-0.6; `HACKATHON_TRACKER.md` (Devpost, Discord #api-help); `ProjectSpec/Tools_and_Requirements.md` §13, §19 |
| Invariants & budgets (throughout) | `AGENTS.md` §13; `ProjectSpec/IMPLEMENTATION_PLAN.md` §1, §2.2, §8 |

**Deliberately pending (not decided here):** numeric rate-limit thresholds and heartbeat interval (Phase 2 config); exact SSE event names beyond those required by behavior (Phase 5 hardens replay); organizer quota numbers (Spike 3 / #api-help); Qloo capabilities not yet exercised by us (heatmap, taste neighborhoods, explainability — see §4.1 evidence column); any endpoint, metric, or Qloo parameter not proven above — nothing in this file invents one. *MCP transport verdict: no longer pending — proven `USABLE-WITH-CONDITIONS`, §4.2.*

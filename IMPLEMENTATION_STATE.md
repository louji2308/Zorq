# ZORQ — Implementation State (mutable)

> Canonical implementation-state record. Contract: `AGENTS.md` + `ProjectSpec/IMPLEMENTATION_PLAN.md`.
> Read-only authorities live in `ProjectSpec/`. Do not duplicate them here.
> `SESSION_HANDOFF.md` deleted 2026-10-08 — its briefing is fully absorbed by this
> file and the git history; this file wins on any conflict.

## Current Phase

**PHASE 5 — Orchestrator, Durable State, SSE & Recovery**. Status: **CLOSED 2026-10-09 — exit gate PASSED** (HEAD `7f11d7f`, tree clean, 386 pass / 5 gated-live skips, e2e 3/3).
Phase 4 closed 2026-10-08 with exit gate PASSED (HEAD `9e91da0`, tree clean, 293 pass /
5 gated-live skips). Boundary refresh completed 2026-10-09 (all 7 ProjectSpec sources
+ AGENTS + this file re-read at the boundary). Phase 5 contract written below before
any delegation.

## Current Objective

Execute Phase 5 through its exit gate: "A run can be stopped, refreshed, disconnected,
reconnected, retried or resumed without corrupting state, duplicating effects or
fabricating completion." (Plan line 597.) Sequential workers W-5.1 → W-5.4; orchestrator
reviews and commits each verified increment (AGENTS §17). B-06 (Turso not provisioned)
is mitigated by a persistence port with an in-memory adapter — Turso adapter is
env-gated and activates when credentials appear, with zero code change.

**RESULT:** All four workers delivered; independent §17 reviews at each commit; full
gates (typecheck, lint, 386 unit / 5 gated-live skips, build, e2e 3/3) green on
`7f11d7f`. Exit-gate clause map is in the Phase 5 Exit-Gate Status section below.

### PHASE 5 CONTRACT (written 2026-10-09, before delegation)

```text
PHASE:        5 — Orchestrator, Durable State, SSE & Recovery
MISSION:      Turn the intelligence core into a resilient autonomous runtime that can
              stop, resume and recover. (Plan §Phase 5, verbatim.)
WHY:          Phases 6–8 (screens, challenge, blueprint) all depend on a Run that
              survives disconnects and process restarts. An assumed recovery model
              discovered late invalidates SSE, judge UX and the final judge path
              simultaneously. ARCH §1 names orchestrator/ + persistence/ as first
              made real here; ARCH §2 makes the DB the recovery source of truth and
              SSE progressive visibility only.
CURRENT-STATE ASSUMPTIONS:
              Phase 4 closed 2026-10-08 (HEAD 9e91da0, tree clean; 293 unit + 5 gated
              live + 3 e2e green). src/server/agent/ holds a working in-memory run
              state machine (prior_pending → investigating → complete/partial/failed;
              Prior Lock write-once; bounded controller ≤3 turns). src/server/qloo/
              holds a working gateway (MCP+REST, cache TTL 6h, budget 180 calls,
              p-limit concurrency). src/server/engine/ holds the frozen measurement
              kernel. src/shared/events.ts defines SSE frame schemas (state/ledger/
              error + TBD payloads) and Last-Event-ID header; routes.ts registers all
              11 routes as honest 503 stubs. No src/server/orchestrator/ and no
              src/server/persistence/ exist yet. Turso not provisioned (B-06);
              DeepSeek balance unpaid (B-02). Docker absent (D-0.6).
IN-SCOPE:     NEW dirs (ARCH §1):
              - src/server/persistence/: RunStore port (create/load/save run, append
                ledger events, append evidence, idempotent write guards), in-memory
                adapter (tests + degraded boot), Turso/libSQL adapter gated on
                TURSO_DATABASE_URL+TURSO_AUTH_TOKEN (schema: runs / ledger_events /
                evidence), config wiring so absence of Turso degrades cleanly (same
                pattern as QLOO/DEEPSEEK), PERSIST_QLOO_DERIVED respected.
              - src/server/orchestrator/: run lifecycle driver that sequences
                prior → investigation → measurement (engine) → terminal; idempotency
                keys; resume from durable state; stop/cancel (new "stopped" status
                added to agent state machine without breaking existing transitions);
                bounded retries; wall-clock cap; best-so-far; wires agent controller
                + gateway + engine + persistence; emits typed events for SSE.
              - Shared RunState expansion (src/shared/run.ts) toward the 13-node
                canonical tree — only the fields Phase 5 needs (SiteRead, CulturalDNA,
                CandidatePool, Neighborhoods, Graph, Compositions, Evidence,
                LedgerEvents as typed optional nodes; StressReport/ConstraintFit/
                Revisions deferred to Phases 7–8).
              - Real route handlers for POST /api/runs, GET /api/runs/:id,
                GET /api/runs/:id/events (SSE: first frame = state, heartbeat,
                Last-Event-ID replay from ledger_events, gap → fresh state),
                POST /api/runs/:id/stop. Other routes stay honest 503.
              - Tests: port contract suite (both adapters), orchestration lifecycle,
                SSE ordering/replay/reconnect, stop idempotency, resume-after-
                interruption, Qloo-outage mid-run → honest partial, no-key-leak.
INVARIANTS:   AGENTS §13 + ARCH §2 recovery-vs-visibility: the database (or in-memory
              adapter standing in for it) is the recovery source of truth; SSE is
              progressive visibility only — the client tolerates missing events and
              reconciles from authoritative Run state. Prior Lock survives rehydrate
              (frozen after load). No Qloo call before stored Prior. LLM never authors
              numeric truth. No fabricated completion — a stopped/failed/interrupted
              run returns the best defensible state with explicit incomplete marker.
              Budgets locked (≤3 turns, ≤180 calls, ≤8 concurrency, ≤$2). No secrets
              in tracked files / logs / SSE frames. Exactly one API family (the 11
              routes). ProjectSpec/ read-only. Fixture/canned data isolated from
              production paths. Field projection before any persistence/SSE.
DEPENDENCIES: Phase 3 gateway + agent controller; Phase 4 engine (measurement phase
              consumes engine barrel). B-06 Turso NOT required to open the phase
              (in-memory adapter is the default and the test double); Turso adapter
              is complete and env-gated so B-06 unblocks it without code change.
              B-02 DeepSeek balance blocks only the live-Prior path (unit tests use
              a fake LlmClient). Docker absent (D-0.6, unchanged).
NON-GOALS:    Challenge/stress operator execution (Phase 8), bridge/replace search
              (Phases 7–8), constraint/format library + footprint fit (Phase 8),
              frontend screens beyond what e2e needs to drive the runtime (Phase 6),
              live Qloo/DeepSeek calls in the default suite, MapTiler, deployment
              changes, rate-limit number tuning, multi-agent runtime, chat UI.
RISK HOTSPOTS:SSE reconnect correctness (Last-Event-ID gap detection must never claim
              completeness it cannot prove — fall back to fresh state); Prior Lock
              lost or mutable across rehydrate; status machine drift when adding
              "stopped" (must not break Phase 3 transition tests); double-effects on
              resume (idempotency keys required on every phase transition); Turso
              schema drift between adapters (one shared contract suite); event
              payload leaking keys or raw Qloo bodies; wall-clock cap racing a phase
              transition; heartbeat missing so idle SSE connections die behind
              proxies; POST /api/runs returning before Prior is persisted.
ACCEPTANCE:   A real (or fake-LLM) brief creates a run with a frozen Prior; the
              orchestrator advances prior → investigation → measurement against
              fake/fixture tools; the run is durable across a simulated process
              restart (reload from store → identical state, Prior still frozen);
              stop mid-phase yields status "stopped" with best-so-far state and an
              explicit incomplete marker, idempotent on double-stop; SSE delivers a
              first state frame, monotonic ids, heartbeats, and on reconnect replays
              missed ledger events from the store — or falls back to a fresh state
              event when the gap cannot be proven complete; a Qloo outage mid-run
              preserves prior + partial ledger/evidence and marks the run partial/
              failed honestly; no fabricated completion anywhere; full suite green
              (typecheck/lint/unit/build/e2e) with live tests still gated.
VERIFY:       Orchestrator reviews every worker diff (AGENTS §17); independently re-runs
              typecheck/lint/test/build/e2e; hand-traces one run through stop → reload
              → resume; asserts Prior reference-equality and frozenness after rehydrate;
              asserts SSE replay does not re-execute side effects; secret grep scan on
              changed files; confirms in-memory adapter is the only store used by the
              default suite (no accidental Turso dependency in tests).
EXIT GATE:    "A run can be stopped, refreshed, disconnected, reconnected, retried or
              resumed without corrupting state, duplicating effects or fabricating
              completion." (Plan §Phase 5, quoted in ARCHITECTURE.md §6.)
COMMIT EXPECT:5 coherent commits, plan-suggested boundaries:
              docs: open Phase 5 and record the durable-runtime contract.
              feat: add durable Run persistence behind a Turso-ready port.
              feat: implement resumable run orchestration with stop and recovery.
              feat: stream authoritative Run state over SSE with reconnect replay.
              test: cover resume, interruption and partial-failure recovery.
```

### PHASE 4 CONTRACT (ARCHIVED — written 2026-10-08, closed same date)

```text
PHASE:        4 — Deterministic Cultural Measurement Engine
MISSION:      Turn Qloo-derived observations into reproducible cultural composition
              mathematics. (Plan §Phase 4, verbatim.)
WHY:          This is the product's numeric-truth boundary: tracker P4, hackathon rule 9
              and AGENTS §13 all require every metric to be deterministic code. Phases
              5–8 (durable state, screens S2–S5) render these numbers; a formula
              assumed or fudged late invalidates graph, compositions, challenge and
              blueprint simultaneously.
CURRENT-STATE ASSUMPTIONS:
              Phase 3 signed off 2026-10-08 (HEAD 62f29af, tree clean; 153 unit + 5
              gated live + 3 e2e green). QlooGateway returns typed projected results
              (src/server/qloo/types.ts: ProjectedEntity/ProjectedCandidate/
              QlooInsightsResults/QlooTagResults + provenance envelope). evidence/
              minimal owner exists (D-3.1: EvidenceRecord with envelope provenance +
              ledgerEventId). No src/server/engine/ yet (ARCHITECTURE §1: Phase 4 first
              makes it real). Canonical Run tree (§2) reserves CulturalDNA/CandidatePool/
              Neighborhoods/Graph/Compositions — engine owns their math; persistence of
              those nodes is Phase 5. Turso absent (B-06) → fixtures in-memory; DeepSeek
              balance unpaid (B-02) → irrelevant, Phase 4 admits no LLM numbers.
IN-SCOPE:     `src/server/engine/` (new; sole owner of numeric truth) + extending
              `src/server/evidence/` (claim→measurement validation, classifications):
              - candidate pool model: K≈8–10 components, each role, tags, ≤5 local
                exemplars, provenance path, evidence state; required path local anchor
                → Qloo entity/tag signal → resolved category/role → exemplar set →
                taste neighborhood; missing evidence ⇒ unmeasured, never a finalist.
              - taste neighborhoods: artist/movie/brand, top 30 per domain; weight =
                returned affinity when present else 1/rank; deterministic normalization.
              - IDF suppression: IDF_e = ln(K / (1 + component_count_containing_e)),
                floored at zero.
              - shared-culture edges: edge(j,k) = cosine(IDF·N_j, IDF·N_k); complete
                graph over measured components; relative bands within the pool (never
                absolute truth claims).
              - composition mathematics: mean pairwise coherence; exact percentile over
                ALL equal-size role-valid subsets enumerated exactly (no sampling, no
                Qloo calls; K≈10 size 5 ≤252 sets); weakest link = minimum edge, named;
                distinctiveness d(k) = 1 − cosine(N_k^site, N_k^city) on the artist
                domain; deterministic Familiar↔Distinctive reranking
                rank = z(C)·(1−w) + z(D̄)·w (default w=0.5, visible dial), tie-break by
                weakest link, rival sweep w∈[0,1] reporting leadership flips; hard
                role-coverage filter before ranking.
              - triangulation of finalist edges → confirmed / contested / thin /
                failed-unmeasured; evidence grades A / B / C with grade caps.
              - evidence extension: classification states attached to evidence;
                claim → evidence ID → ledger event → measurement input validation
                (tracker P3 completion for engine-consumed claims); unknown evidence
                IDs rejected, never rendered as confirmed.
              Tests: hand-worked unit case per formula plus edge conditions (K=1, empty
              neighborhood, zero vector, zero-variance z, duplicate entities, ties);
              deterministic double-run identity; fixture isolation.
INVARIANTS:   AGENTS §13 determinism — graph edges, coherence, null-model percentile,
              distinctiveness, weakest link reproducible byte-identical from identical
              normalized inputs; LLM never authors numeric truth; Zorq code owns all
              numbers (Qloo = measurement only, never computes a Zorq metric); no
              hardcoded scores/percentiles/canned answers; no fabricated evidence IDs;
              unknown evidence IDs never render as confirmed; uncertainty states
              (confirmed/contested/thin/not measured/failed) preserved, never averaged
              away; no magical 0–100 ecosystem score (relative ranking only); exact
              enumeration, never sampling; budgets/turns unchanged; fixture/canned data
              isolated from production execution (AGENTS §12); ProjectSpec/ read-only;
              no secrets; do-not-drift list applies.
DEPENDENCIES: Phase 3 gateway projected shapes + evidence/ minimal record. No network,
              no Turso (B-06), no DeepSeek balance (B-02), Docker absent (D-0.6).
              Optional gated live Qloo exercises (taste neighborhoods/explainability,
              ARCH §4.1 rows 9/13) are NOT required for the gate.
NON-GOALS:    Challenge/stress operator execution, bridge/replacement search (Plan
              Phases 7–8), constraint/format library + footprint fit (Phase 8), durable
              Run persistence / SSE streaming (Phase 5), frontend rendering of graph/
              compositions (Phases 6–7), API route changes (routes stay honest
              unimplemented), live Qloo calls in the default suite, any LLM involvement
              in numeric output.
RISK HOTSPOTS:percentile definition drifting (role-valid = hard role-coverage filter
              applied before enumeration); cosine with zero vectors → NaN; IDF floor
              edge cases; z-score zero variance; nondeterministic ordering (float ties,
              Map iteration, unsorted output); rounding embedded in comparisons instead
              of presentation; fixture pool leaking into production paths;
              distinctiveness city-scale vector invented instead of Qloo-derived;
              evidence grades computed without links back to evidence IDs;
              triangulation classified from fabricated probe output.
ACCEPTANCE:   A controlled candidate pool (fixture, isolated from production execution)
              produces: a complete edge graph; ranked role-valid compositions; an exact
              percentile hand-verified against the enumerated subsets; distinctiveness
              per component; named weakest links; triangulation classifications and
              evidence grades A/B/C — with ZERO LLM-generated numbers; identical
              normalized inputs rerun byte-identical; every engine-derived rendered
              claim resolvable to evidence ID → ledger event → measurement input; full
              suite green (typecheck/lint/unit/build/e2e) with live tests still gated.
VERIFY:       Orchestrator reviews every worker diff (AGENTS §17); independently re-runs
              typecheck/lint/test/build/e2e; hand-checks ≥1 percentile case and 1 edge
              case against the formula; runs the determinism double-run test; confirms
              fixture isolation (no production import of fixture data); secret grep
              scan; spot-checks that no LLM path can write engine outputs.
EXIT GATE:    "A controlled candidate pool can produce a complete graph, ranked
              role-valid compositions, percentile, distinctiveness, weakest links and
              evidence classifications without LLM-generated numbers." (Plan §Phase 4,
              quoted in ARCHITECTURE.md §6.)
COMMIT EXPECT:3–5 coherent commits, plan-suggested boundaries:
              feat: implement deterministic cultural neighborhood construction.
              feat: add IDF-weighted shared-culture graph scoring.
              feat: implement exact null-model composition percentiles.
              feat: add distinctiveness ranking and triangulation logic.
              test: prove deterministic scoring and edge-case behavior.
```

### PHASE 3 CONTRACT (ARCHIVED — written 2026-10-07, signed off 2026-10-08)

```text
PHASE:        3 — Real Qloo + DeepSeek Agent Core
MISSION:      Prove the highest-risk intelligence path against the real services before
              the rest of the product depends on assumptions. (Plan §Phase 3, verbatim.)
WHY:          Phases 4–8 consume gateway evidence, agent state, and Prior Lock behavior;
              an assumed Qloo/LLM contract discovered late invalidates engine, SSE, and
              all six screens simultaneously.
CURRENT-STATE ASSUMPTIONS:
              Phases 0–2 signed off 2026-10-06 (HEAD 1a5c993, tree clean); Phase 2
              runtime green (62 unit + 3 e2e, degraded boot + rate limits + error model
              §3.0 verified on a fresh clone); Gate A fully open — REST (10 live calls)
              AND MCP (`USABLE-WITH-CONDITIONS`, 4 binding conditions, §4.2); Qloo key
              in gitignored .env; DeepSeek key ABSENT → B-02 blocks LLM-dependent work
              (D-0.8: gateway proceeds first); MCP spike artifacts in OS temp dir only
              (`%TEMP%\qloo-mcp-spike`); canonical owners from §1: qloo/ and agent/.
IN-SCOPE:     QlooGateway in `src/server/qloo/` (typed, transport-agnostic; MCP primary
              per §4.2 conditions, DirectQlooTransport REST fallback for the 4 proven
              capability gaps — rows 2/4/9/13: entity+place search, urn:heatmap, taste
              neighborhoods, feature.explainability); capability surfaces only as needed
              by the run (startup, search, tags, insights/locality, describe, rank/
              recommend, bridge, replacement, triangulation); known-failure guards
              (take>50 rejected client-side, zero-result 200 → failure, invalid
              combinations pre-rejected, POST-body params for signal.interests.entities
              .query / filter.exclude.entities.query, 429/5xx bounded backoff with
              visible state); mandatory field projection before any persistence/SSE;
              in-memory LRU cache TTL≈6h, smallest useful result, live/cached state;
              budgets from config (target 180 calls, concurrency ≤8 default 6,
              p-limit); ledger/evidence-shaped typed results. Later (W-3.2, after
              B-02): one bounded DeepSeek tool-calling controller (no LangChain/
              CrewAI/AutoGen/Mastra/swarm), write-once Prior Lock (Brief → LLM-only
              Prior → persist once → qlooUsed=false → immutable), autonomous probe
              adaptations (thin→widen scale, weak→bridge, uncertain→triangulate,
              unresolved→tag/entity resolve, replace→role-preserving, budget→reserve
              calls), bounded ≤3 planner turns. Tests: gateway contract + failure
              guards; live-Qloo diagnostics isolated from default suite; malformed
              model output rejected.
INVARIANTS:   Qloo = cultural measurement only — never computes a Zorq metric (§4.3,
              AGENTS §13); NO Qloo call before stored Prior exists; Prior write-once /
              immutable; LLM never authors numeric truth; budgets locked — config
              rejects above-lock values (≤3 turns, ≤180/≈200 calls, ≤8 conc, ≤2
              mutation rounds, ≤$2); no fabricated evidence IDs, no canned Qloo data,
              no hardcoded scores; error model §3.0 exact; API = the 11 routes only;
              gateway hides transport (no HTTP/MCP details above it); field projection
              mandatory; no secrets in tracked files / logs; client never receives
              Qloo key; ProjectSpec/ read-only; do-not-drift list applies.
DEPENDENCIES: .env Qloo key (available); npm registry; B-02 DeepSeek key (blocks W-3.2
              only); B-06 Turso/MapTiler NOT required (in-memory cache suffices);
              Docker absent (D-0.6, unchanged).
NON-GOALS:    Measurement engine math (Phase 4), durable Turso state / SSE / recovery
              (Phase 5), screens beyond API-level proof (Phase 6+), deployment changes,
              rate-limit number tuning, multi-agent runtime, chat UI, trends claims.
RISK HOTSPOTS:MCP envelope ↔ raw REST mapping mistakes; capability-gap fallback
              silently never exercised; caching violating conservative policy;
              field projection skipped (0.2–1.0 MB payloads cross the boundary);
              budget config drift; Prior accidentally overwritten; controller looping
              past turn caps; live-Qloo tests flaking the default suite; key leakage
              via logs/errors.
ACCEPTANCE:   A real brief → stored immutable Prior (qlooUsed=false) → ≥1 live Qloo
              observation → validated state mutation → ledger event → evidence record;
              Qloo outage → honest partial state with typed error (never fake data);
              gateway contract tests green incl. all failure guards; controller
              bounded ≤3 turns, malformed output rejected; budgets enforced by config;
              full suite green (typecheck/lint/unit/build/e2e) with live-Qloo tests
              gated/isolated so the default suite stays deterministic.
VERIFY:       Orchestrator reviews every worker diff (AGENTS §17); independently re-runs
              typecheck/lint/test/build/e2e; traces ONE real live observation end-to-end
              (evidence record + ledger row → Qloo result path); secret grep scan;
              failure-path spot check (bad key/network off → honest typed state).
EXIT GATE:    "A real brief produces a Prior, at least one real Qloo observation, a
              validated state mutation, a ledger event and an evidence record. Qloo
              outage yields an honest partial state." (Plan §Phase 3, quoted in
              ARCHITECTURE.md §6.)
COMMIT EXPECT:3–5 coherent commits, plan-suggested boundaries:
              feat: connect the production Qloo gateway through MCP.
              feat: add the bounded DeepSeek tool-calling controller.
              feat: enforce write-once Prior Lock and validated agent state.
              test: cover live Qloo failures and malformed model output.
```

### PHASE 2 CONTRACT (ARCHIVED — written 2026-10-06, closed same date)

```text
PHASE:        2 — Repository Foundation & Typed Runtime
MISSION:      Build the smallest real executable foundation that supports every later
              phase without architectural rework (Plan Phase 2 mission, verbatim intent).
WHY:          Phases 3–10 all land inside this skeleton; a wrong boundary now multiplies
              rework across Qloo gateway, engine, SSE, and all six screens.
CURRENT-STATE ASSUMPTIONS:
              Phase 0+1 signed off; ARCHITECTURE.md LOCKED (ownership map §1, error model
              §3.0, 11-route API §3, phase gates §6); git clean on `main`, public remote
              live; toolchain verified (Node 24, npm 11.6.2, Chrome present, Docker absent
              → D-0.6); no product code exists anywhere yet; .env holds the Qloo key but
              Phase 2 runtime must not require it to boot (health works without Qloo).
IN-SCOPE:     React + Vite + TypeScript web app; Node 22.19+ Express + TypeScript API;
              shared Zod contracts in `src/shared` (single definition site per §1);
              configuration loader (fail-clear when required config absent); Pino logging;
              typed error model per ARCHITECTURE.md §3.0; Helmet + per-IP rate limiting;
              route registration wired for exactly the 11 §3 routes (stubs that fail
              clearly where downstream capability does not exist yet — never fake data);
              npm scripts; Vitest; Playwright (channel "chrome"); Dockerfile +
              deployment/ env contract; production build path (same-origin: Express serves
              React build per Plan §Phase 2 production target); real `GET /healthz`;
              `tests/` bootstrap + health tests; docs/ setup instructions so README run
              commands become real and R2 flips to satisfied.
INVARIANTS:   ARCHITECTURE.md §1 ownership map (one dir per domain — no duplicate owners);
              §3.0 error model exact; API family = exactly the 11 routes, no phantom
              routes (incl. no /api/qloo/proxy); no secrets in tracked files; no fabricated
              business logic just to fill the tree (Plan §Phase 2 "Agent behavior");
              budgets/limits not tuned (AGENTS §13); web never holds API keys or calls
              Qloo; Prior remains write-once (not yet implemented, not violated);
              ProjectSpec/ never edited; Plan do-not-drift list applies (no auth,
              payments, chat-first UI, magic 0–100 score).
DEPENDENCIES: npm registry (verified); Chrome for Playwright; .env.example placeholders.
              Not required: DeepSeek key (B-02), MapTiler/Turso (B-06), Docker (D-0.6).
NON-GOALS:    Qloo calls, agent controller, Prior Lock, engine math, SSE, Turso, screens
              beyond a minimal shell, UI polish, extra features, Devpost work.
RISK HOTSPOTS:wrong package topology (npm workspaces vs flat) forcing rework; error-model
              drift from §3.0; stub routes accidentally shipping fake success; rate
              limiting breaking Playwright; config loader either too lax (silent missing
              config) or too strict (blocks health endpoint); README again claiming
              commands that fail on fresh checkout.
ACCEPTANCE:   Fresh clone → `npm ci` (or documented install) → typecheck → lint → unit
              tests → build → start → `GET /healthz` 200 with typed body; missing
              required config produces a clear typed failure, not a stack trace or a
              silent default; all 11 routes registered with Zod-validated stubs that
              return honest "not implemented" typed errors per §3.0; Playwright smoke
              boots app + hits /healthz; no secret in tracked files; README run
              instructions verified truthful; tracker R2 → 🟢.
VERIFY:       Orchestrator independently runs the full exit-gate command sequence on a
              fresh-clone equivalent (clean worktree or temp clone); git grep secret
              scan; diff review of every worker (AGENTS §17); phantom-route grep = 0.
EXIT GATE:    "A fresh checkout installs, typechecks, lints, tests, builds, starts,
              responds to `/healthz`, and fails clearly when required configuration is
              absent." (Plan §Phase 2, quoted in ARCHITECTURE.md §6.)
COMMIT EXPECT:2–5 coherent commits, plan-suggested boundaries:
              feat: establish the typed full-stack runtime foundation.
              feat: add shared Zod contracts and server error boundaries.
              test: verify repository bootstrap and health endpoint behavior.
```

### PHASE 1 CONTRACT (ARCHIVED — written 2026-10-06, completed same date)

```text
PHASE:        1 — Contract, Reconnaissance & Build Control
MISSION:      One implementation path; ownership map; locked state/API/Qloo/UI contracts;
              highest-risk unknowns tested, not assumed.
WHY:          Phase 2+ builds against these contracts; ambiguity here multiplies rework.
IN-SCOPE:     ARCHITECTURE.md (repo map, Run state tree, 11-route API contract with
              request/response schemas + error semantics + security + tests, Qloo
              capability contract, UI contract, phase gates, blockers); Qloo MCP
              transport reconnaissance against the real key; README.md skeleton with
              honest current status (no false run instructions).
INVARIANTS:   Canonical Run state tree exactly as IMPLEMENTATION_PLAN.md Phase 1 locks it;
              API family = the plan's /api/runs routes (single API family — the
              /api/qloo/proxy family referenced in earlier notes does NOT exist in any
              spec; stale note corrected 2026-10-06); Prior write-once; no fabricated
              Qloo data; no secrets in tracked files; no product features (plan's
              do-not-drift list applies).
DEPENDENCIES: .env Qloo key (available); npm registry (verified).
NON-GOALS:    Product code, UI polish, auth, extra features, package scaffolding
              (Phase 2 owns the executable foundation).
RISK HOTSPOTS:MCP transport (Gate A open half); harness install side-effects on repo;
              accidental secret leakage; README claiming unimplemented commands.
ACCEPTANCE:   ARCHITECTURE.md covers all 11 ownership domains + every route contract +
              Run state tree verbatim; MCP verdict recorded with evidence (usable /
              not usable / degraded) in Verified Tests; no secrets in git; tracker +
              state updated.
VERIFY:       Orchestrator re-reads ARCHITECTURE.md against plan §Phase 1 checklist;
              git grep secret scan; independent MCP re-check of key findings.
EXIT GATE:    Repo has one implementation path, clear responsibility owners, defined
              API/state contracts, visible unresolved blockers, defined phase gates,
              no plausible ambiguity about what Zorq is.
COMMIT EXPECT:2–4 coherent `docs:` commits (plan-suggested boundaries).
```

## Completed Capabilities

- [x] Read all 7 Project Spec sources in full (Idea, Product Specification, Architecture,
      Tools & Requirements, Final Design, Hackathon Details, Implementation Plan).
- [x] Read `AGENTS.md` operating contract; source-of-truth hierarchy applied.
- [x] Repository inspection: `ProjectSpec/` + `AGENTS.md` only. **No git, no `package.json`,
      no `src/`, no `.env*`, no `README`, no `LICENSE`.** Empty build surface confirmed.
- [x] Local toolchain verified (evidence below).
- [x] Phase 0 artifacts created: `IMPLEMENTATION_STATE.md`, `HACKATHON_TRACKER.md`.
- [x] Git initialized on `main`; MIT `LICENSE`, `.gitignore`, `.env.example` committed in
      root commit `00e0e6d` (13 files, 7969 insertions). Working tree clean; `.env`
      confirmed ignored via `git check-ignore` (`.gitignore:2`).
- [x] User decisions received for all Phase 0 open questions (D-0.5 … D-0.10).
- [x] **Official Qloo developer guide retrieved** (docs.qloo.com, updated 2026-10-06): key-request
      form URL, base URL, auth header, GET-only insights, supported `filter.type` URNs, legacy
      endpoint ban, silent-invalid-param behaviour, cache/storage policy, key expiry, quota policy.
- [x] **Public repository created and pushed**: https://github.com/louji2308/zorq (PUBLIC, `main`),
      About description + topics set, GitHub detects **MIT License** → submission R2/R5 satisfied.
- [x] **Qloo API key received** (user), stored only in gitignored `.env`; verified absent from all
      tracked files.
- [x] **10 live Qloo calls executed** → Gate A REST path proven, locality + affinity + popularity
      behaviour measured (see Verified Tests / Evidence).

### Toolchain evidence (2026-10-06, local Windows)

| Check | Result | Spec requirement | Verdict |
|---|---|---|---|
| Node.js | v24.13.0 | 22.19+ | PASS (major above locked minimum) |
| npm | 11.6.2 | npm | PASS |
| Git | 2.53.0.windows.2 | Git | PASS |
| Chrome (Playwright) | `C:\Program Files\Google\Chrome\Application\chrome.exe` | Chrome/Chromium | PASS (use `channel: "chrome"`) |
| npm registry | `npm ping` → PONG 533ms | network | PASS |
| Docker | **not installed** | Docker Desktop/Engine | ACCEPTED RISK (D-0.6: local container tests skipped; Dockerfile validated on Render) |
| `.git` | initialized on `main`, root commit `00e0e6d` | version control | PASS (public GitHub mirror still outstanding — B-04) |

## Active Work

- **PHASE 5 CLOSED 2026-10-09 — exit gate PASSED** (HEAD `7f11d7f`, tree clean,
  386 pass / 5 gated-live skips, e2e 3/3). See "Phase 5 Exit-Gate Status" below for
  the clause-by-clause proof map. Landed: W-5.1 persistence (`d912ebb`), W-5.2
  orchestration (`5fb61c0`), W-5.3 SSE + API (`6ec2531`), W-5.4 recovery suite
  (`7f11d7f`), plus state-record commits (`7989d16`, `b3c38f1`, this file).
- **W-4.1b DONE 2026-10-08 — reviewed (AGENTS §17), committed `ac63f63`.**
  `src/server/engine/` (types/neighborhoods/idf/graph/index) + `tests/engine/` (6 files,
  40 tests): pool validation, provenance path, affinity-vs-1/rank weights, top-30 cap,
  IDF floor, complete cosine graph, band terciles, unmeasured/zero-vector honesty,
  byte-identical determinism + shuffle independence. First spawn (W-4.1) stalled with an
  empty result before writing anything (provider-level stall, tree clean) → fresh
  W-4.1b succeeded. Independent orchestrator verification: typecheck 0, lint 0,
  **193 pass / 5 gated-live skips** (was 153 → +40 engine tests, no pre-existing test
  touched), zero comments/hardcodes/Date.now/Math.random in engine src, fixtures only
  under `tests/engine/`. Decisions D-4.1…D-4.4 recorded.
- **W-4.2 DONE 2026-10-08 — reviewed (AGENTS §17), independently re-verified, committed
  `3eb298b`.** `src/server/engine/` (+`compositions.ts`, `distinctiveness.ts`,
  `ranking.ts`, append-only `index.ts` +38/-0) + `tests/engine/` (+4 files, 55 tests):
  exact subset enumeration (C(n,k) safety cap 10,000), role+measurement validity gating,
  coherence = mean pairwise edge, strictly-less percentile over the valid family,
  per-member distinctiveness mean (null → excluded from ranking with honest reason),
  population z-scores (σ=0 → all z=0), `rank = z(C)·(1−w) + z(D̄)·w` (default w=0.5,
  tie-break weakest link → members lex), rival sweep over 101 weights (w=0.00…1.00 step
  0.01) with leader-flip reporting. Independent orchestrator verification: typecheck 0,
  lint 0, **248 pass / 5 gated-live skips** (was 193 → +55); `index.ts` diff append-only;
  hand-worked z (±√1.5) and flip-at-index-50 assertions inspected in source. Decisions
  D-4.5…D-4.8 recorded.
- **W-4.3 DONE 2026-10-08 — reviewed (AGENTS §17), independently re-verified, committed
  `04e8d3a`; orchestrator integration committed `b759e83`.** `src/server/engine/`
  (+`triangulation.ts`, `grades.ts`), `src/server/evidence/index.ts` (additive:
  `resolveClaimEvidence`, `isResolvableClaim`, code `UNKNOWN_EVIDENCE_ID`),
  `tests/engine/` (+`triangulation.test.ts`, `grade.test.ts`, `exitGate.test.ts`),
  `tests/evidence/claimCitations.test.ts` (new dir). Triangulation precedence
  failed > thin > confirmed > contested (exactly 5 results = usable); grade precedence
  C > B > A (cap, worst wins); unclassified finalist edge counts as failed → B
  (honest gap — no vacuous A). Barrel exports wired by orchestrator. Independent
  orchestrator verification: typecheck 0, lint 0, **286 pass / 5 gated-live skips**
  (+38) at worker handoff; after integration **293 pass / 5 skips** (+7 exit-gate
  tests); build PASS; **e2e 3/3 PASS**; evidence diff verified additive-only; existing
  `tests/agent/evidence.test.ts` untouched. Decisions D-4.9…D-4.11 recorded.
- **PHASE 4 EXIT GATE PASSED 2026-10-08** — see "Phase 4 Exit-Gate Status" below.
  One controlled K=6 pool drives the full chain (neighborhoods → IDF → complete graph →
  4 role-valid compositions → percentiles {0,25,50,75} → distinctiveness → ranking +
  101-point rival sweep → triangulation classes → grades A/B/C → claim-citation
  rejection of unknown ids) with zero LLM/Qloo/network involvement; full pipeline
  byte-identical across reruns. `SESSION_HANDOFF.md` deleted.
- **PHASE 3 SIGNED OFF 2026-10-08 — exit gate PASSED with live Qloo evidence** (checklist at
  "Phase 3 Exit-Gate Status"; evidence in Verified Tests). Landed this phase: gateway
  (`8a4c367` + budget fix `e41d89a`), agent controller + Prior Lock (`7e69523`), assembler
  Prior-reference fix (`8d5b422`), live exit-gate proof (`62f29af`), contract docs
  (`edc9a62`, `b7a1de4`), review records (`c59fdeb`). Real-LLM Prior generation is the one
  deferred verification (B-02 balance; `LIVE_DEEPSEEK=1` gated test ready).
- **Remaining work outstanding from users:** DeepSeek balance top-up (B-02), MapTiler +
  Turso (B-06), Devpost registration; optional low-priority Qloo capability exercises
  (taste neighborhoods / explainability / heatmap, ARCH §4.1 rows 9/13).

## Worker Status

| Worker | Contract | Scope | Status |
|---|---|---|---|
| W-1.1 | Contract authoring | Create `ARCHITECTURE.md` only (repo ownership map, locked Run state tree, 11-route API contract, Qloo capability contract, UI contract, phase gates, blockers) | **DONE 2026-10-06 — reviewed & accepted.** 398-line contract; all 8 sections; 11/11 route contract blocks; Run tree byte-matches plan; phantom-route grep = 0 hits; no secrets. 6 spec ambiguities surfaced (error model undefined in specs → worker defined canonical §3.0 contract; Prior-failure semantics; challenge async shape; Phase 0 gate text sourced from state; Phase 7 gate mojibake normalized; SSE replay staged Phase 2–4 vs 5). |
| W-1.2 | Reconnaissance | Install `@qloo/qloo-harness` **outside the repo tree** (temp dir), prove/disprove `qloo mcp` + `qloo_capabilities` against the real key, report verdict + evidence | **DONE 2026-10-06 — reviewed, independently re-run, accepted.** Verdict `USABLE-WITH-CONDITIONS`; Gate A MCP half now proven. Conditions recorded in `ARCHITECTURE.md` §4.2. |
| W-2.1 | Foundation scaffold | Root package (ESM, dual tsconfig), React+Vite shell with 4 locked UI routes, Express app skeleton, config loader + Pino, shared Zod contracts (errors/brief/run/events/routes), Vitest bootstrap | **DONE 2026-10-06 — reviewed; committed `73f0e9d`.** First spawn stalled (0 files) → retry succeeded. 47 tests green at handoff. One contract deviation corrected by orchestrator (silent `NODE_ENV` default → required at start). |
| W-2.2 | Server runtime | Security baseline (helmet, request-id, 2-tier rate limits), Zod validation, typed error middleware, 11-route registration, healthz, static/SPA serving, degraded boot | **DONE 2026-10-06 — reviewed; committed `197f8cb` + `704af3a`.** Spawn stalled mid-task with substantial partial code on disk → continuation worker **W-2.2b** reviewed/fixed (1 security defect: config error message echoed raw Turso URL value → dropped), wrote 15 tests, all gates green. Orchestrator independently re-ran all gates + live boot checks. |
| W-2.3 | Harness/deploy/docs | Playwright smoke (`channel: chrome`), `deployment/Dockerfile` + `render.yaml` + root `.dockerignore`, README run instructions | **DONE 2026-10-06 — reviewed; committed `4a143d3` + `6eb397f`.** 3/3 e2e green (orchestrator re-ran); Docker recipe COPY-targets all verified; README commands executed; one README claim corrected by orchestrator (dev server does not serve the SPA — production static only). |
| W-3.1 | QlooGateway (first spawn) | `src/server/qloo/` foundation: types, guards, errors, config, cache, budget + deps (`@qloo/qloo-harness` 0.1.26, `@modelcontextprotocol/sdk`, `p-limit`) | **STALLED 2026-10-08 after substantial partial work.** 6 foundation files + dependency install completed; no transports/gateway/tests. Registry spike answered: harness IS on public npm (0.1.26) — no temp-dir dependency. Disk state preserved. |
| W-3.1b | QlooGateway (continuation) | Finish gateway: config fields, `project.ts`, `transport.ts`, `restTransport.ts`, `mcpTransport.ts`, `gateway.ts`, `index.ts`, `tests/qloo/*` | **DONE 2026-10-08 — reviewed, independently re-verified, committed `8a4c367`.** All gates green at handoff (typecheck/lint/105 unit/build); live suite correctly gated. Two earlier spawn attempts failed on provider errors (API connect, rate limit) before any write — third succeeded. |
| W-3.2 | DeepSeek controller + Prior Lock | `src/server/agent/` (9 modules: llm, budget, prior, tools, controller, state, ledger, errors, index) + `src/server/evidence/` (minimal canonical owner) + `tests/agent/` (8 files) + `openai@7.30.1` dep | **DONE 2026-10-08 — reviewed file-by-file, independently re-verified, committed `7e69523`.** All gates green at handoff (typecheck/lint/153 unit/4 gated skips/build/e2e 3/3); no contract deviations; fake LLM only in tests; live `LIVE_DEEPSEEK=1` test written but expected 402 until balance (user-approved exception). |
| W-4.1 | Engine core (first spawn) | `src/server/engine/` + `tests/engine/` | **STALLED 2026-10-08** — returned an empty result, wrote zero files (provider-level stall; tree clean, nothing lost). |
| W-4.1b | Engine core (fresh spawn) | `src/server/engine/` (types, neighborhoods, idf, graph, index) + `tests/engine/` (fixtures + 5 test files) | **DONE 2026-10-08 — reviewed (§17), independently re-verified, committed `ac63f63`.** typecheck/lint green; **193 pass / 5 gated skips** (+40 tests); byte-identical determinism + shuffle tests; decisions D-4.1…D-4.4 recorded. |
| W-4.2 | Composition mathematics | `src/server/engine/` (+`compositions.ts`, `distinctiveness.ts`, `ranking.ts`, `index.ts` append-only) + `tests/engine/` (+4 test files) | **DONE 2026-10-08 — reviewed (§17), independently re-verified, committed `3eb298b`.** typecheck 0, lint 0; **248 pass / 5 gated skips** (+55 tests); barrel append-only confirmed (`git diff` zero deletions); decisions D-4.5…D-4.8 recorded. |
| W-4.3 | Triangulation + evidence grades + claim→citation validation | NEW: `src/server/engine/` (+`triangulation.ts`, `grades.ts`) + `tests/engine/` (+2) + `tests/evidence/` (new dir); EDIT: `src/server/evidence/index.ts` (additive); barrel wired by orchestrator | **DONE 2026-10-08 — reviewed (§17), independently re-verified, committed `04e8d3a`** (+ integration `b759e83`). First spawn interrupted at dispatch (no writes, tree clean) → re-spawn succeeded. typecheck 0, lint 0; **286 pass / 5 gated skips** (+38); evidence diff additive-only (verified via `git diff`); decisions D-4.9…D-4.11 recorded. |
| W-5.1 | Persistence port + adapters | NEW: `src/server/persistence/` (RunStore interface, in-memory adapter, Turso adapter env-gated, schema, config wiring, healthz check) + `tests/persistence/` | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `d912ebb`.** typecheck 0, lint 0; **339 pass / 5 gated-live skips** (+46); build PASS; e2e 3/3; secret scan clean; package.json only adds `@libsql/client`. Turso adapter testable via `:memory:`/file URL (B-06 mitigation). |
| W-5.2 | Orchestration core | NEW: `src/server/orchestrator/` (status machine, rehydrate, write-through ledger, start/resume/stop/retry, wall-clock, event sink) + `tests/orchestrator/` | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `5fb61c0`.** typecheck 0, lint 0; **354 pass / 5 gated-live skips** (+15); build PASS; e2e 3/3; secret scan clean; zero edits to agent/ (stop stays orchestrator-local). |
| W-5.3 | SSE + API routes | EDIT: `src/shared/run.ts` (13-node expansion), `src/server/routes.ts` (real handlers), SSE emitter + replay + `src/server/app.ts` wiring + `tests/` | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `6ec2531`.** typecheck 0, lint 0; **369 pass / 5 gated-live skips** (+15); build PASS; e2e 3/3; secret scan clean; 4 Phase 5 routes real, other 7 still 503. First two spawns stalled with zero writes (provider) → third succeeded. |
| W-5.4 | Recovery + exit-gate suite | NEW: `tests/orchestrator/recovery.test.ts` + `tests/orchestrator/exitGate.test.ts` + exit-gate proof | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `7f11d7f`.** typecheck 0, lint 0; **386 pass / 5 gated-live skips** (+17); build PASS; e2e 3/3; secret scan clean; no src changes needed. First two spawns stalled with zero writes (provider) → third succeeded. |

**Orchestrator integration review (AGENTS §17):** both diffs inspected; W-1.1 touched only `ARCHITECTURE.md`;
W-1.2 touched only temp-dir files (repo `git status` shows no spike artifacts); key never echoed; worker claims
independently re-verified by orchestrator re-run of `mcp-probe2.js` (identical contract checksum) and by grep
scans (no key material, no phantom routes, 11 route sections present). Contract updated by orchestrator with the
MCP verdict + 4 binding conditions. No duplicated responsibility; no hidden mocks.

**W-3.2 orchestrator review (AGENTS §17):** diff scope = 2 manifest files + 3 new dirs, contract-exact.
Implementation read file-by-file (prior, state, controller, budget, evidence, index, llm key paths, tools
envelope mapping): Prior-before-Qloo structural (`prior.ts` imports zero qloo modules; `transitionRun` and
`runController` both refuse `investigating` without a persisted Prior); write-once + deep-freeze verified;
turn cap clamped at 3 in code; official DeepSeek pricing table encoded with conservative cache-miss default
and ceiling clamped to `LOCK_LLM_BUDGET_USD`; key redaction confirmed (`redact(raw, secrets)`); envelope
`cache`→evidence `cacheState` mapping correct. Gates independently re-run: typecheck, lint, **153 pass /
5 gated skips**, build, **e2e 3/3**; secret scan clean. **Review catch → fixed in `8d5b422`:** assembler
returned the pre-persist Prior object (unfrozen, separate object from the persisted zod clone) — now returns
`run.prior` (the frozen persisted reference), test tightened to reference equality. Exit gate proven live
(`62f29af`).

## Verified Tests / Evidence

### Phase 5 — persistence + orchestrator + SSE/API + recovery exit gate (2026-10-09, commits `d912ebb`/`5fb61c0`/`6ec2531`/`7f11d7f`)

- **W-5.1 (`d912ebb`):** typecheck 0; lint 0; Vitest **339 pass /
  5 gated-live skips** (+46 vs Phase 4's 293). RunStore contract suite runs against
  both in-memory and Turso (`:memory:` / file URL) adapters; structuredClone isolation
  proven both directions; close/reopen durability proven on file-backed libsql.
- **W-5.2 (`5fb61c0`, orchestrator independently re-ran all five):** typecheck 0;
  lint 0; Vitest **354 pass / 5 gated-live skips** (+15). Stop idempotency, wall-clock
  cap → partial, resume-from-investigation, RunBusyError on concurrent resume/retry,
  zero agent/ edits (stop is orchestrator-local status).
- **W-5.3 (`6ec2531`, first two spawns stalled → third succeeded):** typecheck 0;
  lint 0; Vitest **369 pass / 5 gated-live skips** (+15: 7 API + 8 SSE). Four Phase 5
  routes real (POST create 201, GET state+evidence 200, POST stop 200, GET SSE);
  other seven still honest 503. SSE first frame always `state`; Last-Event-ID replays
  contiguous ledger only; non-contiguous gap → state-only fallback (no silent miss);
  terminal run → state frame then `res.end()`; heartbeat injectable (default 15 s).
- **W-5.4 (`7f11d7f`, first two spawns stalled → third succeeded):** typecheck 0;
  lint 0; Vitest **386 pass / 5 gated-live skips** (+17: 7 recovery + 10 exit-gate).
  Exit-gate file maps each clause of the gate sentence to a named test: stop ✓,
  refresh ✓, disconnect ✓, reconnect ✓, retry ✓, resume ✓, no corruption ✓,
  no duplicate effects ✓, no fabricated completion ✓, gap fallback ✓. Suite uses
  real createOrchestrator + createMemoryStore + fake LLM/gateway over real HTTP
  (createApp + startServer) — no store mocks. Zero src changes were needed.
- **Full gates independently re-run at every worker commit:** typecheck 0, lint 0,
  build PASS, e2e 3/3; secret scan clean at each boundary.

### Phase 4 — engine core + composition math + triangulation/grades + exit gate (2026-10-08, commits `ac63f63`/`3eb298b`/`04e8d3a`/`b759e83`)

- **W-4.1b (`ac63f63`):** typecheck (dual tsconfig) 0; eslint 0; Vitest **193 pass /
  5 gated-live skips** (+40 engine tests vs Phase 3's 153); byte-identical determinism +
  shuffle-independence tests; zero `Date.now`/`Math.random`/comments/hardcodes in engine
  src (grep); fixtures live only under `tests/engine/`.
- **W-4.2 (`3eb298b`, orchestrator independently re-ran all three):** typecheck 0;
  lint 0; Vitest **248 pass / 5 gated-live skips** (+55 composition/ranking/distinctiveness
  tests). Hand-worked arithmetic inspected in source: population z = ±√1.5 for
  `[1,2,3]`; rival-sweep leadership flip exactly at index 50 (w=0.5); `index.ts` diff is
  append-only (+38/−0).
- **W-4.3 (`04e8d3a`):** typecheck 0; lint 0; Vitest **286 pass / 5 gated-live skips**
  (+38 triangulation/grade/claim-citation tests); evidence diff additive-only; existing
  `tests/agent/evidence.test.ts` untouched and green.
- **Integration (`b759e83`, orchestrator):** barrel exports wired; exit-gate demonstration
  `tests/engine/exitGate.test.ts` (7 tests) green; full gates re-run: typecheck 0,
  lint 0, **293 pass / 5 gated-live skips**, build PASS, **e2e 3/3 PASS**.

### Phase 3 — agent controller + Prior Lock + exit gate (2026-10-08, commits `7e69523`/`8d5b422`/`62f29af`)

- **Unit suite at sign-off:** typecheck (dual tsconfig) PASS; eslint 0 warnings; Vitest
  **153 passed / 5 skipped** (158; skips = 3 gated live Qloo + 1 gated `LIVE_DEEPSEEK=1` +
  1 gated exit-gate run); `npm run build` PASS; **e2e 3/3 PASS**.
- **Exit gate LIVE run (orchestrator, `LIVE_QLOO=1`):** `tests/agent/exit-gate.live.test.ts`
  **1/1 PASSED against real Qloo** — real brief → persisted frozen Prior (`qlooUsed=false`,
  deep-frozen, referenced by identity from run state) → **real `qloo_search` observation**
  → validated mutation (`prior_pending → investigating → complete`) → ledger sequence
  `LLM, LLM, Qloo, LLM` → evidence record linked by `ledgerEventId` to the Qloo ledger
  entry, provenance = real envelope (transport/endpoint/durationMs/cacheState/resultCount).
  LLM side scripted (fake) — real-LLM Prior generation deferred per user exception (B-02:
  valid key, zero balance, 402). Real Qloo outage mid-loop covered by unit test
  (honest partial state: prior + partial ledger/evidence preserved, no fabricated fields).
- **Prior Lock proof:** write-once conflict throws; frozen prior resists `Reflect.set`;
  gateway spy asserts **0 calls** until Prior persisted; `prior.ts` grep = zero qloo imports.
- **Budget proof:** peak/off-peak rate selection (fixed clocks), cache-miss conservative math,
  80% reserve refusal (`LLM_BUDGET_RESERVE`), 100% ceiling (`LLM_BUDGET_CEILING`), constructor
  clamp to `LOCK_LLM_BUDGET_USD = 2`.
- **Pricing source:** official https://api-docs.deepseek.com/quick_start/pricing fetched
  2026-10-08 (`deepseek-flash`: in miss $0.15/$0.30 off/peak, hit $0.003/$0.006, out
  $0.60/$1.20; peak = 01–04 & 06–10 UTC Mon–Fri) — reproduces the spec's $0.45/$0.90 examples.

### Phase 3 — Qloo gateway (2026-10-08, commit `8a4c367`)

- **Vitest: 105 passed / 3 skipped across 12 files** (orchestrator independent re-run
  post-review) — incl. `tests/qloo/`: fake-transport gateway contract (guards before
  spend, POST-body path for `signal.interests.entities.query`, cache hit/TTL, budget
  exhaustion → RATE_LIMITED, ≤2 retries on retryable errors, 400 → no retry, malformed
  → DEPENDENCY_UNAVAILABLE, empty → `status:'empty'`, secret scrub on every thrown
  error), projection stripping, REST transport plan/serialization tests, config
  QLOO base-URL cases. 3 skipped = gated live suite.
- **LIVE Qloo: 3/3 passed (real service, orchestrator-run, `LIVE_QLOO=1`)** — REST
  capabilities readiness; **MCP path**: real `@qloo/qloo-harness` child process over
  stdio → `qloo_find_tags {query:"jazz"}` → `status:ok`, tags projected; **REST path**:
  `/search?query=coffee&type=urn:entity:place&take=3` → projected entities with
  provenance endpoint = hackathon host. Total 48.3 s.
- Gates independently re-run by orchestrator: `typecheck` (dual tsconfig) ✅, `lint` ✅,
  `build` ✅, `test:e2e` 3/3 ✅ (SPA + healthz unaffected by gateway additions).
- Verification extras: full `EXPECTED_QLOO_CONTRACT_CHECKSUM` sha256 matches
  `node_modules/@qloo/qloo-harness/dist/router.js` (source not fabricated); MCP SDK
  `StdioClientTransport` merges `getDefaultEnvironment()` (child gets PATH);
  `git diff` secret scan clean; no canned/fixture data anywhere in `src/`.

### Phase 2 — automated suites (2026-10-06)

- **Vitest: 62/62 passing across 8 files** (`npm test`) — shared error model (§3.0 parity:
  all 9 codes/statuses/body shape), config loader (lock bounds, required vars, URL checks,
  no-value echo), logger redaction, route schemas, healthz (200 schema + 503 naming removed
  vars + no-secrets-in-body), HTTP behavior (helmet, 400 validation with path details, honest
  503 on unimplemented routes, 404 typed, 429 rate limit, 500 INTERNAL without stack leak),
  static/SPA (fallback, immutable hashed assets, `/api` never swallowed), and a **degraded-boot
  integration test spawning real `dist/server/main.js`** (503 + named vars + process alive).
- **Playwright: 3/3 passing** (`npm run test:e2e`, system Chrome `channel: "chrome"`, real
  production build via webServer) — `/healthz` 200, SPA mounts on `/`, SPA fallback on
  unknown client route.
- **Gates green on orchestrator re-run:** `typecheck` (dual tsconfig), `lint`, `test`,
  `build`, `test:e2e` — then **fresh-checkout exit gate**: local clone → `npm ci` (250 pkgs)
  → all gates → start **without `.env`** → `/healthz` 503 naming `NODE_ENV`+`APP_BASE_URL`,
  WARN in stderr, process stays alive (degraded) → copy `.env.example` → `/healthz` 200
  `{"status":"ok",…}` → 3/3 e2e → port 3000 clean → temp clone removed.
- **Secret hygiene:** scans of changed files → 0 key-material hits; `.env` never read by
  orchestrator or tests (degraded test strips env vars; e2e injects its own deterministic env).

### Gate A — live Qloo diagnostics (Phase 0/1 evidence, retained)

**Live Qloo diagnostics — Gate A (REST path), 2026-10-06, 10 real calls against `https://hackathon.api.qloo.com` with `X-Api-Key`:**

| Probe | Request | Result |
|---|---|---|
| A1 | `GET /search?query=cinema&type=urn:entity:movie` | **200**, 210 KB → `results[].entity_id`, `types`, `properties.image.url`, `tags[].tag_id` |
| A2 | `GET /v2/tags?query=cinema` | **400** — error enumerates real params: `filter.results.tags, filter.tags, filter.parents.types, filter.tag.types, filter.query, filter.popularity.min/max` |
| A3 | `GET /v2/tags?filter.query=cinema` | **200**, 5.3 KB → tags carry `id` (URN), `type`, `parents[].type` (**includes `urn:entity:place`**), `popularity` |
| A4 | `GET /search?query=Williamsburg&type=urn:entity:place` | **200**, 347 KB → `address`, `geocode`, per-weekday `hours`, `business_rating`, `external.google_place` |
| B1 | `/v2/insights?filter.type=urn:entity:place&signal.interests.tags=<place tag>` | **200**, 309 KB — **accepted** a place-scoped tag as signal |
| B2/B3 | `/v2/insights?...&signal.interests.entities=<place id>` | **200**, 377 KB (take=20) → `results.entities[]` with `location{lat,lon,geohash}`, `popularity`, **`query.affinity` (numeric)**, `query.measurements.audience_growth` |
| C1 | `+ filter.location=POINT(-73.958 40.718)&filter.location.radius=2500&sort_by=affinity&take=5` | **200** — all 5 results inside the Brooklyn radius |
| C2 | `+ filter.location.query=Williamsburg, Brooklyn` | **200** — fuzzy named-locality filter works |
| C3 | same as C1 with `take=50` | **200**, 982 KB → statistics below |

**C3 statistics (50 results, Brooklyn 2.5 km):**
```
affinity    min 0.8051  max 0.8408  mean 0.8131  range 0.0357   ← compressed band
popularity  min 0.0394  max 0.9992  mean 0.6697  range 0.9598   ← wide
exact rank-position agreement (affinity vs popularity): 1 / 50  ← independent
cities returned: all "New York"                                    ← locality filter real
```

**Gate A — MCP transport path, 2026-10-06 (W-1.2 reconnaissance + independent orchestrator re-run):**

| Probe | Request | Result |
|---|---|---|
| M1 | `node dist/bin.js mcp` (`@qloo/qloo-harness` 0.1.26, temp dir, `QLOO_BASE_URL` + `QLOO_TRUSTED_BASE_URL` = hackathon host) | **Boots on stdio** newline-delimited JSON-RPC 2.0, no TTY, no LLM credential required |
| M2 | JSON-RPC `initialize` → `tools/list` | `serverInfo: qloo-harness 0.1.26`, protocol `2024-11-05`, capabilities `{tools, resources}`, boot→init 1544 ms; **10 tools** (`qloo_capabilities, qloo_recommend, qloo_rank, qloo_describe, qloo_where_popular, qloo_compare_audiences, qloo_entity_tags, qloo_audience_demographics, qloo_trends, qloo_find_tags`) |
| M3 | `qloo_capabilities` | 63 ms, `status ok` → contract v1.0.0, checksum `sha256:762bdcc5…924f5`, adapter `qloo_harness_mcp` canonical, `ready: true`, 9 `supported_operation_ids` |
| M4 | `tools/call qloo_find_tags {query:"jazz", limit:1}` | **Live 200-equivalent**: `status:"ok"`, `result_count:1`, `duration_ms:1618`, envelope has `interpretation/provenance/execution` |
| M5 | `qloo doctor --network --json` | `qloo-network: ok — accepted the configured credential`; `qloo-endpoint-trust: ok` for the hackathon base URL |
| M6 | Orchestrator independent re-run of `mcp-probe2.js` | **Identical contract checksum + 9 operation_ids** — worker claim reproduced, not trusted |

**MCP verdict: `USABLE-WITH-CONDITIONS` → Gate A REST + MCP paths BOTH PROVEN.** Four binding conditions
(trusted-base-URL env pair, normalized envelope ≠ raw REST, four demonstrated capability gaps needing the
REST fallback, long-lived child-process model) recorded in `ARCHITECTURE.md` §4.2. Tool-inventory details
(10 tools + input params) also live there. Artifacts stayed in OS temp dir — repo untouched.

**What this proves (and what it does not):**
- ✅ Auth, base URL, `/search`, `/v2/tags`, `/v2/insights` all live and typed (Gate A **REST** path).
- ✅ **`qloo mcp` + `qloo_capabilities` live and typed (Gate A MCP path) — Gate A now fully proven.**
- ✅ Numeric `affinity` **and** `popularity` are both real Qloo outputs (Gate E numeric source).
- ✅ Locality can be forced via `filter.location` / `filter.location.query` + radius (Spike 1 prerequisite).
- ✅ Affinity ordering is **not** popularity ordering (1/50 agreement) → non-popularity differentiation is
  possible; low-population/high-affinity candidates exist (Spike 1 / Gate C preliminary).
- ⚠️ **Affinity is compressed** (range 0.036): deltas must be normalized, never presented as large raw gaps.
- ⚠️ **Payloads are enormous** (0.2–1.0 MB per call; no server-side field filtering) → gateway must project
  fields before anything crosses SSE/DB.
- ❌ **Not yet proven:** shared-culture edge between two places; ≥80% concept→tag resolution (Spike 2);
  concurrency/latency (Spike 3); rank stability (Spike 4); presets (Spike 5); heatmap `urn:heatmap`,
  taste neighborhoods, explainability feature (not exercised in our calls).

**Secret hygiene verified:** `.env` → `.gitignore:2`; `tmp/insights_sample.json` → `.gitignore:37`;
`git grep` finds no key material; no raw Qloo response is tracked (official Qloo rule: never store
response data in a public repository — only aggregate statistics appear above).

## Decisions

| # | Decision | Rationale | Reversible? |
|---|---|---|---|
| D-0.1 | Use `IMPLEMENTATION_STATE.md` as the single mutable progress file (per `IMPLEMENTATION_PLAN` §6), not a second `progress.md`. | Avoid competing truth sources (AGENTS.md §6). | Yes, migrate once if needed. |
| D-0.2 | Keep `HACKATHON_TRACKER.md` as a separate file for competition constraints only. | Different responsibility (external contract vs internal state); user explicitly requires standing hackathon tracking. | Yes. |
| D-0.3 | Node 24 locally accepted as satisfying "Node.js 22.19+". | Node 24 > 22.19 floor; no downgrade needed for local dev. Render base image will be pinned separately and must match a supported LTS. | Yes. |
| D-0.4 | No product code until Phase 0 blockers are answered. | Coding before understanding is AGENTS.md §23 anti-pattern; credentials determine transport architecture. | Yes. |
| D-0.5 | Initialize git on `main` with MIT `LICENSE`, `.gitignore`, `.env.example`; single root commit `00e0e6d`. | User approved; public repo + visible license are hard submission requirements (R2/R5), and clean history must exist before Qloo work starts. | No (history is evidence; do not rewrite). |
| D-0.6 | Skip Docker locally; validate the Dockerfile on Render only. | User approved. Render builds remotely; Qloo MCP needs a long-lived process only in production. Accepted dev-time risk. | Yes — revisit if container build fails late. |
| D-0.7 | Qloo key validity + cache/storage policy now sourced from the **official developer guide**, not assumption. | Guide (retrieved 2026-10-06): keys active through end of judging; private server-side caching permitted with no time limit; Qloo responses must never enter a public repo. `PERSIST_QLOO_DERIVED` stays `false` until server-side storage has an owner (Phase 5), then may be enabled **privately**. | Yes if Qloo contradicts. |
| D-0.8 | Sequence Qloo work ahead of agent work: DeepSeek key not yet available. | Real evidence (Gate A, Spikes 1–3) beats speculation; DeepSeek-dependent work (Prior Lock, agent loop) is deferred to Phase 3. | Yes. |
| D-0.9 | Publish to https://github.com/louji2308/zorq immediately with MIT + About description. | User supplied the URL; R2/R5 are hard pass/fail requirements and history must exist before Qloo work. Verified: `visibility: PUBLIC`, `licenseInfo: mit`. | No (history is evidence). |
| D-0.10 | Store raw Qloo responses only in gitignored `tmp/`; commit aggregate statistics and parameter findings, never response bodies or entity lists. | Official Qloo rule: do not store Qloo response data in a public repository. Keeps evidence auditable without violating terms. | No (compliance). |
| D-2.1 | Phase 2 workers run **sequentially in one checkout**; workers never commit (orchestrator reviews + commits). | Shared lockfile/node_modules made parallel merge surfaces unsafe; foundation is small enough that parallelism bought nothing. Recovered both worker stalls without lost work. | Yes — revisit with worktrees if Phase 3 parallelizes. |
| D-2.2 | **Degraded boot** on missing required config: WARN naming variables + `/healthz` 503 typed body, process keeps serving — **supersedes the initial exit(1) reading** of "fails clearly". | `ARCHITECTURE.md` §3.1 (higher authority than plan wording): "503 SERVICE_UNAVAILABLE with the shared error body when required configuration is absent" + its mandated test. Verified live (fresh clone, no `.env`). | No (locked contract). |
| D-2.3 | Repository topology: single root package, ESM, dual tsconfig (`tsconfig.json` bundler-resolution for typecheck over src+tests+configs; `tsconfig.build.json` NodeNext emit → `dist/`); server/shared imports carry explicit `.js` extensions. | One install, one lockfile, Vite+tsx+Node each get correct resolution without workspaces. `tsconfig.build` `include` stays `src/server`+`src/shared` (keeps Docker build immune to new test dirs). | Yes. |
| D-2.4 | Unknown `/api/*` → 404 `RUN_NOT_FOUND` typed body; unimplemented routes → `SERVICE_UNAVAILABLE` with phase-naming messages; `runIdParamsSchema` stays permissive (`min(1)`) until Phase 5 fixes the id format. | §3.0 defines no generic route-not-found code and no id format yet — flag, don't invent codes/policies (AGENTS §2). Both flagged for revisit: id schema when Phase 5 lands. | Yes — revisit in Phases 3/5. |
| D-2.5 | Rate limits locked at **general 300 / 15 min per IP, mutating (POST/PUT/PATCH/DELETE) 30 / 15 min per IP**, express-rate-limit draft-7 headers, `trust proxy = 1`, typed 429 `RATE_LIMITED`. | Deployed behind Render's proxy (client IP arrives via `X-Forwarded-For`); tiers match the plan's intent and are overridable via factory options for tests. | Yes — tune only from measured evidence. |
| D-2.6 | CI smoke against the **deployed** app (ARCHITECTURE line 163) deferred to deployment phase (8/9); Phase 2 gate = local fresh-checkout + Playwright against a real production build. | No deployed instance exists in Phase 2; plan's Phase 2 implement list has no deploy step. Smallest safe interpretation, recorded here (AGENTS §2). | Yes. |
| D-3.1 | `src/server/evidence/` made real in **Phase 3** with the minimal `EvidenceRecord` (id, claim, envelope provenance, `ledgerEventId` link) instead of waiting for Phase 4. | The Plan Phase 3 exit gate (line 466) explicitly requires "an evidence record"; ARCHITECTURE §1 makes `evidence/` the canonical owner (dir created, not duplicated). Phase 4 extends claim→citation validation. | Yes — Phase 4 owns evolution. |
| D-3.2 | **Live real-LLM verification deferred** (user-approved 2026-10-08): DeepSeek key valid but balance 0 (HTTP 402). Exit gate run with scripted LLM + real Qloo; `LIVE_DEEPSEEK=1` test written and gated for later. | No spec weakened — only the verification medium substituted, with the exception recorded by the user's explicit instruction. All numeric/budget/controller behavior proven with fakes + real Qloo. | Yes — run the gated suite when balance is paid. |
| D-3.3 | `runInvestigation` returns the **persisted frozen Prior reference** (`run.prior`), not the pre-persist object. | Orchestrator review catch (`8d5b422`): `priorSchema.parse` clones, so the pre-persist object was a mutable alias of persisted data — consumers must hold the real frozen artifact. | No (invariant). |
| D-3.4 | Peak/off-peak pricing ignores Chinese public holidays (holiday hours inside peak windows price at peak). | Conservative direction: never undercounts spend against the locked $2 ceiling. Implementing a holiday table adds complexity for zero budget risk. | Yes if a holiday run matters. |
| D-4.1 | Engine neighborhood normalization = **per-domain sum-normalization** (weights sum to 1 within each artist/movie/brand block; sum accumulated in sorted order for float determinism; zero/non-finite total ⇒ domain empty). | Plan says only "normalize deterministically"; scheme left open (AGENTS §2). Cosine is scale-invariant so edges are unaffected; choice keeps weights interpretable + reproducible. | Yes if Qloo affinity scale evidence contradicts. |
| D-4.2 | Edge **band rule**: over measured edges only — sort value desc (tie: `a` asc, `b` asc); `s = floor(m/3)`; first `s` → strong, last `s` → weak, remainder → typical; `m < 3` ⇒ all typical. Pure function, exported as `assignEdgeBands`. | Spec mandates relative bands within pool (ProductSpec §12) but not the split rule; deterministic floor-tercile is the smallest defensible reading. | Yes — UI may re-render bands, engine rule stays the source. |
| D-4.3 | Neighborhood `state` heuristic at this layer: all 3 domains filled → measured; some → incomplete; none → not measured. Graph gating uses **component** `evidenceState`, not neighborhood state. Triangulation states (confirmed/contested/thin) reserved for W-4.3. | Spec silent on neighborhood-level state; needed honest mid-states without erasing uncertainty (AGENTS §13). | Yes — W-4.3 may refine with triangulation evidence. |
| D-4.4 | **K≤2 pools are degenerate by formula**: every shared entity has count ≥ K ⇒ all IDF floor to 0 ⇒ all edges unmeasured. Accepted as mathematically faithful (ProductSpec §12 IDF), tested; non-degenerate graphs require K≥3 (unique entities) / K≥4 (shared-entity edges survive). | Never weaken a spec formula to make a toy case pass (AGENTS §16). Phase 4 pool spec is K≈8–10 where the formula behaves. | No (formula is spec-locked). |
| D-4.5 | **Percentile tie rule**: percentile = strictly-less count ÷ family size × 100; a composition is always in its own denominator; ties do not count as "below"; empty family → `null`. | Spec says "percentile of pool" without tie semantics (ProductSpec §12); strictly-less is the smallest reading that never overstates a composition's standing. | Yes if judge testing shows misread percentiles. |
| D-4.6 | **Population z-scores with σ=0 → all z=0** (not NaN, not ±∞); rank weight `w ∈ [0,1]` validated; sweep granularity `SWEEP_POINT_COUNT = 101` (w = 0.00…1.00 step 0.01); rank tie-break: score → weakest link → members lex (total order, deterministic). | Spec gives the formula but no degenerate-σ or sweep-granularity rule; the zero-σ fallback keeps rankScore finite and honest; fixed 101 points make flip indices reproducible. | Yes if measured pools show degenerate σ in practice. |
| D-4.7 | **Two validity notions**: *coherence-valid* (all members measured + all internal edges measured + required roles present) = percentile domain; *rankable* = coherence-valid AND distinctiveness mean non-null = ranking domain. Rankable-but-excluded compositions are reported via `excluded: [{members, reason: "distinctiveness_unavailable"}]`, never silently dropped. | Percentile is a statement about the graph alone; ranking additionally requires D̄. Honest partial states required (AGENTS §13) — exclusion must be visible, not erased. | No (both notions are spec-necessary). |
| D-4.8 | W-4.2 reused existing `EngineError` codes (no new `INVALID_COMPOSITION_INPUT`) because `types.ts` is frozen after W-4.1b — composition-input errors surface as `INVALID_GRAPH_INPUT`/`INVALID_COMPONENT`. Accepted as a **limitation**: error-code granularity is coarser than ideal on the composition surface. | Frozen-file boundary (contract) outranks error-taxonomy aesthetics (AGENTS §2). | Yes — fold a dedicated code into `types.ts` only if a higher phase needs it. |
| D-4.9 | **Triangulation precedence (exact):** `failed` (route1 ≠ measured OR `focalInTopHalf === null`) → `thin` (resultCount < 5) → `confirmed` (≥5 + top-half) → `contested` (≥5 + not top-half). Exactly 5 results counts as usable/strong. Structurally invalid route2 input **throws** `INVALID_GRAPH_INPUT`; present-but-undeterminable classifies as `failed`. Duplicate classification for the same pair → throw (never last-wins). | Spec fixes the four states and the <5 threshold (ProductSpec §12, Architecture §11.6) but not the precedence edge cases; this mapping is the smallest reading that never overstates evidence. | No (spec-locked states; precedence is defensive only). |
| D-4.10 | **Grade honest-gap rule:** a finalist member-pair with NO supplied classification is scored `failed` → B. Reasons enumerate ALL detected failures (every non-measured member, every non-confirmed edge) — member reasons in input order, then edge reasons in sorted-pair order — not only the cap-level ones. Grade is a CAP: C > B > A, never an average. | Zero-evidence compositions must never earn A (AGENTS §13 honesty); full reason lists let the UI "show these states rather than average them away" (Architecture §11.6). | No. |
| D-4.11 | Evidence module gained exactly one additive error code `UNKNOWN_EVIDENCE_ID`; `resolveClaimEvidence` dedups in first-occurrence claim order and throws naming ALL missing ids; malformed lookup records → `INVALID_RECORD`; `isResolvableClaim` converts any `EvidenceError` to `false`. Existing exports/schemas/provenance validation untouched (diff verified + existing tests green unmodified). | D-3.1 reserved claim→citation validation for Phase 4; frozen existing behavior (W-3.2) must not regress (AGENTS §17). | No. |
| D-5.1 | **Persistence port, not a concrete DB binding.** `RunStore` interface + in-memory adapter (default) + Turso adapter (env-gated on `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`). Tests run the same contract suite against both. | B-06 (Turso not provisioned) must not block Phase 5. ARCH §2 makes the DB the recovery source of truth; a port lets the memory adapter serve as a proven stand-in until credentials appear, with zero code change on provisioning. Turso adapter is still real `@libsql/client` code, exercised via `:memory:`/file URL. | Yes — swap adapter via env when Turso is provisioned. |
| D-5.2 | **Stop is orchestrator-local; `agent/` untouched.** Cooperative stop is implemented by the orchestrator flipping local status to `stopped` and refusing further phase advancement; the agent's own state machine (`agent/state.ts`) is not modified. | Keeps Phase 3's agent controller stable; stop semantics live at the layer that owns run lifecycle and persistence. Matches Plan §Phase 5 ("the orchestrator, not the agent, owns stop"); the agent will learn about stop only if a later phase introduces a need for mid-turn cancellation. | Yes — if mid-turn cancellation is ever needed, teach the agent about stop without changing the orchestrator contract. |
| D-5.3 | **SSE first frame is always the full authoritative `state`; ledger frames are additive, not load-bearing.** On connect (with or without `Last-Event-ID`) the server sends the current RunState; subsequent `event.*` frames append to it. A non-contiguous `Last-Event-ID` gap falls back to state-only rather than attempting partial replay. | DB is recovery truth; SSE is progressive visibility (ARCH §2). A client that misses frames can always resynchronize from state; a client that trusts partial ledger replay could render a corrupted view. State-first also makes the "refreshed" clause trivially true. | No (invariant — D-5.3 is a recovery-safety invariant). |
| D-5.4 | **`RunState` expanded additively; nine Phase 6–7 fields are `z.unknown()` placeholders.** `evidence` is a typed array; the remaining future fields (`priorDiff`, `challenge`, `blueprint`, …) are optional unknown keys that survive parse/rehydrate without schema churn. | Zod v4 strips unknown keys on parse; fields must be declared to survive round-trips. Freezing their shape now would over-constrain Phase 6–7 before their product contracts exist; leaving them `unknown()` preserves forward-compatibility without fabrication. | Yes — Phase 6–7 replaces each placeholder with a real schema when its product contract exists. |
| D-5.5 | **Four real Phase 5 routes; remaining seven stay honest 503.** Only `POST /api/runs`, `GET /api/runs/:id` (with evidence), `POST /api/runs/:id/stop`, and `GET /api/runs/:id/events` (SSE) are wired to the orchestrator; the other seven Phase 3 routes continue returning `NOT_YET_WIRED` 503. | Plan §Phase 5 names exactly these four; wiring the rest before their owning phases exist would create dead code and fake-looking surfaces. Honest 503 is the established contract from Phases 3–4 and is a judge-visible signal of deliberate sequencing. | Yes — wire the remaining seven as their owning phases land. |

## Deviations from contract

- **`git diff --check` flags trailing whitespace in `ProjectSpec/*.md` (markdown hard line breaks).**
  Committed unchanged rather than editing supplied read-only source. Our authored files
  (`.gitignore`, `.env.example`, `LICENSE`, `AGENTS.md`, both trackers) pass the check
  (`exit=0`). Rationale recorded here per AGENTS.md §2; no higher-order source altered.
- **"Fails clearly when configuration is absent" implemented as degraded boot (D-2.2), not
  `exit(1)`** — the plan's exit-gate wording is ambiguous, resolved in favor of the more
  specific `ARCHITECTURE.md` §3.1 contract (503 + named vars). Observable behavior proven
  live; no product requirement weakened.
- **W-2.1 deviated by silently defaulting `NODE_ENV`** → orchestrator corrective patch made
  it required at start (matches `.env.example` + §3.1). Contract deviation, not a spec one.
- **W-2.2 deviated by echoing raw URL values in config-error messages** (potential credential
  leak for `TURSO_DATABASE_URL`) → fixed by W-2.2b with a 1-line diff; test updated.
- **Phase 9 open item recorded, not fixed (scope boundary):** runtime derives listen port from
  `APP_BASE_URL` and does not yet honor platform-injected `PORT` (Render). Documented in
  `deployment/render.yaml` + Dockerfile comments; `src/**` was outside W-2.3's scope.

## Known Risks / Blockers

| ID | Severity | Blocker | Impact | Owner |
|---|---|---|---|---|
| B-01 | ~~Qloo key not issued~~ | **Closed 2026-10-06**: key received from user, stored in gitignored `.env`, authenticated successfully against `hackathon.api.qloo.com`. | Gate A REST path unblocked; MCP path also proven same day (see Verified Tests M1–M6). | — |
| B-02 | **Critical → PARTIALLY CLEARED 2026-10-08** | DeepSeek key **delivered and proven valid**: `/models` 200 → `deepseek-flash`, `deepseek-v4-pro`; completion → **HTTP 402 (unpaid, not 401)** — key recognized, **balance = 0** (user topping up later). | **Implementation UNBLOCKED** (fake-LLM tests + gated live suite). Live LLM verification (real Prior generation, `LIVE_DEEPSEEK=1`) deferred until balance is topped up; key stored only in gitignored `.env`. | User (payment) |
| B-03 | ~~Docker not installed~~ | **Closed by D-0.6** (accepted risk). | Local container tests skipped; Dockerfile validated on Render. | — |
| B-04 | ~~No public GitHub repo~~ | **Closed by D-0.9**: https://github.com/louji2308/zorq is PUBLIC, pushed, MIT detected, About set. | R2/R5 satisfied. | — |
| B-05 | ~~Cache/storage + key-lifetime terms unconfirmed~~ | **Closed 2026-10-06 from the official developer guide**: private server-side caching allowed with no time limit; never store Qloo output publicly; keys valid through end of judging. | `PERSIST_QLOO_DERIVED` remains `false` until Phase 5 gives storage a private owner. | — |
| B-06 | Medium | MapTiler key, Turso database not provisioned. | Map/geocoding (S0/S1) and durable Run state. **Non-blocking for Phase 5** — in-memory adapter is the default; Turso adapter is env-gated and activates when credentials appear. MapTiler becomes a hard requirement at Phase 6 (S0/S1 screens). | User |
| B-07 | Medium | Deadline Oct 30 2026 23:45 EDT; internal freeze Oct 28. **21 days from today.** | Schedule pressure; see `HACKATHON_TRACKER.md`. Phase 5 closed on time with buffer remaining. | Orchestrator |
| B-08 | Medium | Qloo `qloo mcp` needs Node 22.19+ and a long-lived backend; serverless unsupported. | Constrains hosting to Render Free (locked). | Locked, no action |

## Last Verified Commit

`7f11d7f` — *test: prove the Phase 5 exit gate over stop, resume, retry and SSE recovery.*
(suite **386 pass / 5 gated-live skips**). Preceded by `6ec2531` (W-5.3 SSE + API),
`7989d16`/`b3c38f1` (state records), `5fb61c0` (W-5.2 orchestration core),
`d912ebb` (W-5.1 persistence), `aeea073` (Phase 5 contract), `9e91da0` (Phase 4
close). All gates green on current head: typecheck, lint, **386 unit + 5 gated live
skips**, build, **3 e2e**. Push target: **https://github.com/louji2308/zorq**
(`main`, PUBLIC, MIT).

## Next Highest-Value Action

**Open Phase 6 — S0 Brief + S1 Investigate Screens (Plan line 607)** via the full
AGENTS §5/§26 phase-start protocol: inspect git + structure + this file, re-read
ALL 7 ProjectSpec sources in full at the boundary, write the Phase 6 contract (AGENTS §7)
before any delegation, then delegate per worker contracts (§8). Phase 5 deliverables
(`src/server/persistence/` + `src/server/orchestrator/` + `src/server/sse/` + the four
real Phase 5 routes) are the durable runtime Phase 6 will drive; do not re-implement
them. Protect: AGENTS §13 evidence/provenance boundaries; SSE is progressive visibility
only (DB is recovery truth); the four real routes must keep working under the new
screens. User-side (non-blocking): DeepSeek balance (enables `LIVE_DEEPSEEK=1`),
MapTiler key (S0/S1 map), Turso (optional — memory adapter is the default until
provisioned), Devpost registration. Deadline context: Oct 30 2026, internal freeze Oct 28.

## Phase 5 Exit-Gate Status (PASSED 2026-10-09)

Gate text (ARCHITECTURE §6 / Plan line 597): *"A run can be stopped, refreshed,
disconnected, reconnected, retried or resumed without corrupting state, duplicating
effects or fabricating completion."*

Proof: `tests/orchestrator/exitGate.test.ts` (commit `7f11d7f`), 10/10 green, orchestrator-
authored over the four workers' landed APIs; suite at sign-off **386 pass / 5 gated
skips**, typecheck 0, lint 0, build PASS, e2e 3/3.

- [x] **Stopped** — cooperative stop mid-investigation lands exactly one `run.stopped`
  marker; the gated pass settles as `stopped`; Prior stays frozen; phase stays
  `investigation` (not upgraded).
- [x] **Refreshed** — a fresh SSE client mid-run always receives the authoritative
  `state` frame first, with zero ledger replay (no stale assumptions).
- [x] **Disconnected** — aborting the SSE client removes the hub subscriber
  (`subscriberCount` → 0) and leaves durable run state intact.
- [x] **Reconnected** — `Last-Event-ID` replays only the missed contiguous ledger
  window; the already-seen prefix is never re-sent; a non-contiguous gap falls back
  to state-only (no silent partial replay).
- [x] **Retried** — retry after stop re-enters investigation and reaches a terminal
  `complete` run with real observations; `measure.compose` appears after the stop
  marker in ledger order.
- [x] **Resumed** — resuming a terminal run is a no-op with **zero new LLM spend**
  (call counter unchanged) and zero ledger growth.
- [x] **No corruption** — durable store matches the final orchestrator state; Prior
  rehydrates frozen; ledger sequences strictly increasing and unique; the pre-stop
  ledger prefix is byte-identical after retry.
- [x] **No duplicate effects** — one `run.stopped`, one `measure.compose`, Qloo probe
  count equals evidence-record count, each counted once per real attempt.
- [x] **No fabricated completion** — the stopped pass that finished its turns was not
  upgraded to complete; completion required real observations (`evidenceCount > 0`
  and post-stop Qloo probes present).

## Phase 4 Exit-Gate Status (PASSED 2026-10-08)

Gate text (ARCHITECTURE §6): *"A controlled candidate pool can produce a complete
graph, ranked role-valid compositions, percentile, distinctiveness, weakest links and
evidence classifications without LLM-generated numbers."*

Proof: `tests/engine/exitGate.test.ts` (commit `b759e83`), 7/7 green, orchestrator-
authored over the three workers' landed APIs; suite at sign-off **293 pass / 5 gated
skips**, typecheck 0, lint 0, build PASS, e2e 3/3.

- [x] **One controlled pool** (K=6, roles Anchor/Social/Discovery/Anchor/Social/Night)
  — pure fixtures, no Qloo, no LLM, no network, no `Date.now`/`Math.random` in any
  measurement path (grep-verified across `src/server/engine/` + `src/server/evidence/`).
- [x] **Complete graph**: 6 nodes, C(6,2)=15 edges, every edge `measured` with finite
  value (shared entities survive the IDF floor at K=6 — consistent with D-4.4).
- [x] **Role-valid compositions**: exact enumeration C(6,3)=20 candidates → exactly 4
  valid (one Anchor + one Social + the Discovery, all members measured, all internal
  edges measured); no sampling.
- [x] **Percentile**: family percentiles are exactly {0, 25, 50, 75} under the
  strictly-less rule (D-4.5); monotone with coherence; hand-checked weakest link =
  min internal edge and coherence = mean internal edge against the graph itself.
- [x] **Distinctiveness**: per-member d̄ ∈ [0,1] attached to every composition;
  honest exclusion proven — removing c3's city vector nulls all 4 d̄ → ranked empty +
  4 exclusions with reason `distinctiveness_unavailable` (never silently dropped, D-4.7).
- [x] **Ranking + rival sweep**: rank scores non-increasing; sweep = 101 points
  (w = 0.00…1.00); every leader is a 3-member composition or null on empty input.
- [x] **Evidence classifications**: route pair classified `confirmed`/`contested`/`thin`
  exactly per D-4.9; grades `B` (mixed), `A` (all confirmed), `C` (member unmeasured
  even with all-confirmed edges) exactly per D-4.10.
- [x] **Unknown evidence ids never render as confirmed**: `resolveClaimEvidence` throws
  `UNKNOWN_EVIDENCE_ID` for a missing id (D-4.11).
- [x] **Determinism**: the full pipeline (graph + distinctiveness + ranking incl. sweep)
  is byte-identical across two independent reruns (JSON stringify compare).

No LLM-generated number exists anywhere in this chain: every numeric output descends
from fixture inputs through Zorq's pure arithmetic.

## Phase 3 Exit-Gate Status (PASSED 2026-10-08)

Gate text (ARCHITECTURE §6): *"A real brief produces a Prior, at least one real Qloo
observation, a validated state mutation, a ledger event and an evidence record. Qloo
outage yields an honest partial state."*

- [x] **Real brief** → `runInvestigation` validates it (typed validation error on malformed)
- [x] **Prior** → LLM-only generation (scripted LLM in the live run; real-LLM path gated
      `LIVE_DEEPSEEK=1`, deferred per D-3.2/B-02) → `priorSchema` enforced → **persisted
      exactly once** (write-once conflict test) → deep-frozen, `qlooUsed=false` literal
- [x] **≥1 real Qloo observation** → live run `LIVE_QLOO=1`: real `qloo_search` via gateway
      (REST/MCP real envelope) — the same suite independently proven 3/3 this phase
- [x] **Validated state mutation** → `prior_pending → investigating → complete` through the
      guarded transition table (illegal transitions + phase regression + prior-less
      investigation all throw; shared `runStateSchema` validated at every step)
- [x] **Ledger event** → live sequence `LLM, LLM, Qloo, LLM` against `ledgerEventSchema`
- [x] **Evidence record** → created, `ledgerEventId` links to the Qloo ledger entry,
      provenance = real envelope (transport/endpoint/durationMs/cacheState/resultCount);
      unknown provenance → typed `EvidenceError`, never rendered as confirmed
- [x] **Qloo outage → honest partial state** → unit-proven: prior + partial ledger/evidence
      preserved, typed error, run lands `partial`, zero fabricated fields
- [x] **Bounds:** planner turns ≤3 (clamped in code, test with `maxTurns:99`), LLM budget
      ≤$2 ceiling (constructor clamp, 80% reserve, official pricing), Qloo budget per
      attempt ≤180 (from gateway review), no orchestration frameworks
- [x] **Intelligence boundary preserved:** LLM never authors numeric truth (budget/validation/
      caps deterministic in Zorq code); no fabricated ids/results anywhere (`src/` scan clean)
- [x] **Worker results reviewed** (AGENTS §17): both workers' diffs read file-by-file; 1
      assembler defect caught and fixed (`8d5b422`); claims independently re-verified
- [x] **All gates green at sign-off:** typecheck, lint, 153 unit + 5 gated live, build, 3 e2e
- [x] **Secrets clean:** key only in gitignored `.env`; diff scans (sk-/hack_/eyJ) = 0 hits
- [x] **4 coherent commits for the phase's agent half** (+2 gateway +2 docs earlier)
- [x] **Progress recorded; Phase 4 identified as the next highest-value action**

## Phase 2 Exit-Gate Status

- [x] Fresh checkout **installs** — local clone → `npm ci` (250 packages, 0 vulnerabilities)
- [x] **Typechecks** — dual tsconfig clean
- [x] **Lints** — eslint clean, zero suppressions added
- [x] **Tests** — Vitest 62/62 (incl. real degraded-boot subprocess) + Playwright 3/3 on
      system Chrome against a real production build
- [x] **Builds** — `dist/server` + `dist/web` produced
- [x] **Starts** and **responds to `/healthz`** — 200 `{"status":"ok",…}` with config present
      (proven twice: repo checkout and fresh clone with placeholder env)
- [x] **Fails clearly when required configuration is absent** — no `.env`: WARN names
      `NODE_ENV` + `APP_BASE_URL`, `/healthz` answers 503 typed `SERVICE_UNAVAILABLE`, process
      stays alive (D-2.2, §3.1)
- [x] Contract implement list complete: React+Vite+TS, Node/Express+TS, shared Zod, config
      loader, Pino, typed errors §3.0, Helmet + rate limiting, route registration (exactly
      the 11 routes, honest unimplemented), npm scripts, Vitest, Playwright, Docker,
      environment contract, production build path
- [x] Worker results reviewed (AGENTS §17): every diff read, 1 security defect + 2 contract
      deviations caught and corrected, claims independently re-verified
- [x] Exit-gate verified on a **real fresh checkout**, not just the working tree
- [x] No secrets in tracked files; no fake business logic; numeric truth still owned by
      future deterministic engine (nothing fake added to pretend otherwise)
- [x] Progress recorded; 6 coherent commits; tracker updated (R2 satisfied)

## Phase 1 Exit-Gate Status

- [x] One implementation path (ARCHITECTURE.md §1: single ownership map, one API family, one
      state store, one Qloo gateway)
- [x] Clear responsibility owners (all 11 plan-named domains placed in the `src/` tree)
- [x] Defined API/state contracts (11/11 routes with schema + errors + security + tests;
      Run state tree 13 nodes byte-matched to the plan, single-writer table per node)
- [x] Visible unresolved blockers (§7: B-02, B-06, quota, Docker-accepted, Devpost)
- [x] Defined phase gates (§6: Phases 0–10 exit gates recorded)
- [x] No plausible ambiguity about what Zorq is (header statement + §4.3 fixed truths)
- [x] High-risk unknown resolved with evidence: **Qloo MCP transport proven**
      (`USABLE-WITH-CONDITIONS`, orchestrator independently re-ran; Gate A ✅ in tracker)
- [x] Worker results reviewed (AGENTS §17): diffs inspected, claims re-verified, scope confirmed
- [x] No secrets in tracked files (key-leak grep = 0 across all changed files)
- [x] Deviation recorded where needed (phase-boundary reading method; §3.0 error model defined
      by W-1.1 because no spec defines it — contract, not product behavior, so within AGENTS §2)

## Phase 0 Exit-Gate Status

- [x] Repository state reconstructed
- [x] All Project Spec files read at phase boundary
- [x] Current-state model written
- [x] Blockers and risks identified and assigned (B-01, B-04, B-05 closed with evidence)
- [x] Decisions received from user (D-0.5 … D-0.9)
- [x] Public repository + visible license (R2/R5)
- [x] **Qloo API key issued, stored safely, and proven to authenticate** (B-01)
- [x] Real-service diagnostic evidence recorded (10 calls)
- [x] All Phase 0 exit items closed. **Hand-off item → Phase 1 gate:** write the Phase 1 contract
      (first action of the next phase, tracked there, not here).

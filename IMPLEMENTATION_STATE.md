# ZORQ — Implementation State (mutable)

> Canonical implementation-state record. Contract: `AGENTS.md` + `ProjectSpec/IMPLEMENTATION_PLAN.md`.
> Read-only authorities live in `ProjectSpec/`. Do not duplicate them here.

## Current Phase

**PHASE 2 — Repository Foundation & Typed Runtime**. Status: **OPENED 2026-10-06**
(Phases 0 and 1 signed off same date.)

## Current Objective

Build the smallest real executable foundation that supports every later phase without
architectural rework: typed full-stack runtime (React+Vite+TS · Express+TS · shared Zod
contracts), config loader that fails clearly, Pino, typed error model, Helmet + rate
limiting, route registration, npm scripts, Vitest, Playwright, Docker, environment
contract, production build path, and a real `GET /healthz`.

### PHASE 2 CONTRACT (written 2026-10-06, before delegation)

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

- **Phase 2 opened 2026-10-06.** Phase-boundary refresh executed per AGENTS §5/§26:
  `AGENTS.md` + all 7 ProjectSpec sources re-read in full at this boundary (Final_design
  and Hackathon_details read across capped ranges to completion; Idea re-read in full).
  Phase 2 contract written above, before any delegation (AGENTS §7).
- Worker decomposition decided (AGENTS §9 — by responsibility, dependency-ordered):
  `W-2.1 foundation → W-2.2 server runtime → W-2.3 harness/Docker/docs`. Workers run
  **sequentially in one checkout** (decision D-2.1: parallel workers rejected for this
  phase — shared lockfile/node_modules would make merge surfaces unsafe without worktree
  overhead that a small foundation does not justify).
- Convention carried from Phase 1: workers do **not** commit; orchestrator reviews every
  diff (AGENTS §17), independently re-runs the exit gate, then commits coherent increments.
- Carried constraint (provenance for `ARCHITECTURE.md` §4): gateway must support **POST**
  for `signal.interests.entities.query` / `filter.exclude.entities.query` (JSON-body params)
  in addition to GET — Phase 3 scope, not Phase 2.
- Phase 1 completed same date: `ARCHITECTURE.md` locked, Gate A fully proven (REST + MCP),
  README honest, phantom-route note corrected (sole API family = the 11 `/api/runs`
  routes), all Phase 1 commits pushed.

## Worker Status

| Worker | Contract | Scope | Status |
|---|---|---|---|
| W-1.1 | Contract authoring | Create `ARCHITECTURE.md` only (repo ownership map, locked Run state tree, 11-route API contract, Qloo capability contract, UI contract, phase gates, blockers) | **DONE 2026-10-06 — reviewed & accepted.** 398-line contract; all 8 sections; 11/11 route contract blocks; Run tree byte-matches plan; phantom-route grep = 0 hits; no secrets. 6 spec ambiguities surfaced (error model undefined in specs → worker defined canonical §3.0 contract; Prior-failure semantics; challenge async shape; Phase 0 gate text sourced from state; Phase 7 gate mojibake normalized; SSE replay staged Phase 2–4 vs 5). |
| W-1.2 | Reconnaissance | Install `@qloo/qloo-harness` **outside the repo tree** (temp dir), prove/disprove `qloo mcp` + `qloo_capabilities` against the real key, report verdict + evidence | **DONE 2026-10-06 — reviewed, independently re-run, accepted.** Verdict `USABLE-WITH-CONDITIONS`; Gate A MCP half now proven. Conditions recorded in `ARCHITECTURE.md` §4.2. |

**Orchestrator integration review (AGENTS §17):** both diffs inspected; W-1.1 touched only `ARCHITECTURE.md`;
W-1.2 touched only temp-dir files (repo `git status` shows no spike artifacts); key never echoed; worker claims
independently re-verified by orchestrator re-run of `mcp-probe2.js` (identical contract checksum) and by grep
scans (no key material, no phantom routes, 11 route sections present). Contract updated by orchestrator with the
MCP verdict + 4 binding conditions. No duplicated responsibility; no hidden mocks.

## Verified Tests / Evidence

No unit/integration tests exist yet (no code). **Live Qloo diagnostics — Gate A (REST path), 2026-10-06, 10 real calls against `https://hackathon.api.qloo.com` with `X-Api-Key`:**

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

## Deviations from contract

- **`git diff --check` flags trailing whitespace in `ProjectSpec/*.md` (markdown hard line breaks).**
  Committed unchanged rather than editing supplied read-only source. Our authored files
  (`.gitignore`, `.env.example`, `LICENSE`, `AGENTS.md`, both trackers) pass the check
  (`exit=0`). Rationale recorded here per AGENTS.md §2; no higher-order source altered.

## Known Risks / Blockers

| ID | Severity | Blocker | Impact | Owner |
|---|---|---|---|---|
| B-01 | ~~Qloo key not issued~~ | **Closed 2026-10-06**: key received from user, stored in gitignored `.env`, authenticated successfully against `hackathon.api.qloo.com`. | Gate A REST path unblocked; MCP path also proven same day (see Verified Tests M1–M6). | — |
| B-02 | **Critical** | DeepSeek API key + balance not yet available. | Blocks Prior Lock, agent controller, every LLM-backed run. Qloo-first sequencing (D-0.8) limits schedule damage. | User |
| B-03 | ~~Docker not installed~~ | **Closed by D-0.6** (accepted risk). | Local container tests skipped; Dockerfile validated on Render. | — |
| B-04 | ~~No public GitHub repo~~ | **Closed by D-0.9**: https://github.com/louji2308/zorq is PUBLIC, pushed, MIT detected, About set. | R2/R5 satisfied. | — |
| B-05 | ~~Cache/storage + key-lifetime terms unconfirmed~~ | **Closed 2026-10-06 from the official developer guide**: private server-side caching allowed with no time limit; never store Qloo output publicly; keys valid through end of judging. | `PERSIST_QLOO_DERIVED` remains `false` until Phase 5 gives storage a private owner. | — |
| B-06 | Medium | MapTiler key, Turso database not provisioned. | Map/geocoding (S0/S1) and durable Run state (Phase 5). Not needed for Phase 1–2. | User |
| B-07 | Medium | Deadline Oct 30 2026 23:45 EDT; internal freeze Oct 28. **24 days from today.** | Schedule pressure; see `HACKATHON_TRACKER.md`. | Orchestrator |
| B-08 | Medium | Qloo `qloo mcp` needs Node 22.19+ and a long-lived backend; serverless unsupported. | Constrains hosting to Render Free (locked). | Locked, no action |

## Last Verified Commit

`bc0ccbf` — *docs: record Phase 1 contracts, worker evidence and Gate A MCP proof.*
Preceded by `239c7df` (honest README) and `8ee0c91` (`ARCHITECTURE.md` execution contract).
All three pushed to **https://github.com/louji2308/zorq** (`main`, PUBLIC, MIT detected);
`git status -sb` → in sync with `origin/main`. Working tree clean.
Earlier: `10d86a6` Phase 0 sign-off; root `00e0e6d` holds contract + spec bundle.

## Next Highest-Value Action

**Phase 2 — Repository Foundation & Typed Runtime**: scaffold Vite/TS frontend + Express/TS
backend, shared Zod contracts, config loader, Pino, typed error model (per `ARCHITECTURE.md` §3.0),
Helmet + rate limiting, Vitest, Playwright, Dockerfile, real `GET /healthz`. Exit gate: fresh
checkout installs/typechecks/lints/tests/builds/starts and answers `/healthz`, and fails clearly
when required config is absent.
Still outstanding from user: **DeepSeek key (B-02, critical for Phase 3)**, MapTiler + Turso (B-06),
Devpost registration. MCP spike artifacts remain in OS temp dir (`%TEMP%\qloo-mcp-spike`) for
Phase 3 reference — outside the repo by design.

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

# ZORQ — Implementation State (mutable)

> Canonical implementation-state record. Contract: `AGENTS.md` + `ProjectSpec/IMPLEMENTATION_PLAN.md`.
> Read-only authorities live in `ProjectSpec/`. Do not duplicate them here.

## Current Phase

**PHASE 0 — Reconstruction & Groundwork** (pre-contract). Status: **COMPLETE — signed off 2026-10-06**.
Next: `PHASE 1 — Contract, Reconnaissance & Build Control` (opens with the Phase 1 contract).

## Current Objective

Establish verified ground truth before any product code: repository state, toolchain,
credentials, competition constraints, and the highest-risk unknowns (Qloo transport,
quota, cache/storage terms, DeepSeek tool calling).

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

- Phase 0 evidence gathering is complete; **Phase 1 contract not yet written**.
- Open engineering question decided by evidence, not assumption: the gateway must support
  **POST** for `signal.interests.entities.query` / `filter.exclude.entities.query`
  (JSON-body params), in addition to GET.

## Worker Status

No workers spawned. Phase 0 is Orchestrator-owned reconnaissance; no substantive
implementation exists to delegate yet.

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

**What this proves (and what it does not):**
- ✅ Auth, base URL, `/search`, `/v2/tags`, `/v2/insights` all live and typed (Gate A **REST** path).
- ✅ Numeric `affinity` **and** `popularity` are both real Qloo outputs (Gate E numeric source).
- ✅ Locality can be forced via `filter.location` / `filter.location.query` + radius (Spike 1 prerequisite).
- ✅ Affinity ordering is **not** popularity ordering (1/50 agreement) → non-popularity differentiation is
  possible; low-population/high-affinity candidates exist (Spike 1 / Gate C preliminary).
- ⚠️ **Affinity is compressed** (range 0.036): deltas must be normalized, never presented as large raw gaps.
- ⚠️ **Payloads are enormous** (0.2–1.0 MB per call; no server-side field filtering) → gateway must project
  fields before anything crosses SSE/DB.
- ❌ **Not yet proven:** MCP transport (`qloo mcp` + `qloo_capabilities`) — Gate A formally still open;
  shared-culture edge between two places; ≥80% concept→tag resolution (Spike 2); concurrency/latency
  (Spike 3); rank stability (Spike 4); presets (Spike 5).

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
| B-01 | ~~Qloo key not issued~~ | **Closed 2026-10-06**: key received from user, stored in gitignored `.env`, authenticated successfully against `hackathon.api.qloo.com`. | Gate A REST path unblocked; MCP path still open. | — |
| B-02 | **Critical** | DeepSeek API key + balance not yet available. | Blocks Prior Lock, agent controller, every LLM-backed run. Qloo-first sequencing (D-0.8) limits schedule damage. | User |
| B-03 | ~~Docker not installed~~ | **Closed by D-0.6** (accepted risk). | Local container tests skipped; Dockerfile validated on Render. | — |
| B-04 | ~~No public GitHub repo~~ | **Closed by D-0.9**: https://github.com/louji2308/zorq is PUBLIC, pushed, MIT detected, About set. | R2/R5 satisfied. | — |
| B-05 | ~~Cache/storage + key-lifetime terms unconfirmed~~ | **Closed 2026-10-06 from the official developer guide**: private server-side caching allowed with no time limit; never store Qloo output publicly; keys valid through end of judging. | `PERSIST_QLOO_DERIVED` remains `false` until Phase 5 gives storage a private owner. | — |
| B-06 | Medium | MapTiler key, Turso database not provisioned. | Map/geocoding (S0/S1) and durable Run state (Phase 5). Not needed for Phase 1–2. | User |
| B-07 | Medium | Deadline Oct 30 2026 23:45 EDT; internal freeze Oct 28. **24 days from today.** | Schedule pressure; see `HACKATHON_TRACKER.md`. | Orchestrator |
| B-08 | Medium | Qloo `qloo mcp` needs Node 22.19+ and a long-lived backend; serverless unsupported. | Constrains hosting to Render Free (locked). | Locked, no action |

## Last Verified Commit

`122053d` — *docs: record Phase 0 reconnaissance, toolchain evidence and build decisions.*
Pushed to **https://github.com/louji2308/zorq** (`main`, PUBLIC, MIT detected, About set).
Root commit `00e0e6d` holds the contract, spec bundle and scaffolding. Working tree clean.

## Next Highest-Value Action

Write the **Phase 1 contract**, then scaffold the monorepo (Vite/TS frontend + Express/TS backend,
strict TS, Vitest, `npm run typecheck/lint/test/build`) with a typed Qloo gateway that reproduces the
proven calls — including `filter.location` locality handling and field projection for the 0.2–1.0 MB
payloads. **Highest-risk unknown after that: the MCP transport** (`qloo mcp`, `qloo_capabilities`),
because Gate A formally requires it and the spec mandates MCP as the primary route with direct
`/v2/insights` as degraded fallback. Also outstanding: DeepSeek key (B-02), MapTiler + Turso (B-06).

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

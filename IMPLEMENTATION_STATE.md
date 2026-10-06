# ZORQ — Implementation State (mutable)

> Canonical implementation-state record. Contract: `AGENTS.md` + `ProjectSpec/IMPLEMENTATION_PLAN.md`.
> Read-only authorities live in `ProjectSpec/`. Do not duplicate them here.

## Current Phase

**PHASE 0 — Reconstruction & Groundwork** (pre-contract). Status: `IN PROGRESS`.
Next: `PHASE 1 — Contract, Reconnaissance & Build Control`.

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
- [x] User decisions received for all Phase 0 open questions (D-0.5 … D-0.8).

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

- Awaiting delivery of the **Qloo API key** into `.env` — sole remaining Phase 0 blocker
  for a real transport diagnostic.

## Worker Status

No workers spawned. Phase 0 is Orchestrator-owned reconnaissance; no substantive
implementation exists to delegate yet.

## Verified Tests / Evidence

None. No code exists, therefore no tests exist. Do not report test status until
Phase 2 establishes the Vitest/Playwright harness.

## Decisions

| # | Decision | Rationale | Reversible? |
|---|---|---|---|
| D-0.1 | Use `IMPLEMENTATION_STATE.md` as the single mutable progress file (per `IMPLEMENTATION_PLAN` §6), not a second `progress.md`. | Avoid competing truth sources (AGENTS.md §6). | Yes, migrate once if needed. |
| D-0.2 | Keep `HACKATHON_TRACKER.md` as a separate file for competition constraints only. | Different responsibility (external contract vs internal state); user explicitly requires standing hackathon tracking. | Yes. |
| D-0.3 | Node 24 locally accepted as satisfying "Node.js 22.19+". | Node 24 > 22.19 floor; no downgrade needed for local dev. Render base image will be pinned separately and must match a supported LTS. | Yes. |
| D-0.4 | No product code until Phase 0 blockers are answered. | Coding before understanding is AGENTS.md §23 anti-pattern; credentials determine transport architecture. | Yes. |
| D-0.5 | Initialize git on `main` with MIT `LICENSE`, `.gitignore`, `.env.example`; single root commit `00e0e6d`. | User approved; public repo + visible license are hard submission requirements (R2/R5), and clean history must exist before Qloo work starts. | No (history is evidence; do not rewrite). |
| D-0.6 | Skip Docker locally; validate the Dockerfile on Render only. | User approved. Render builds remotely; Qloo MCP needs a long-lived process only in production. Accepted dev-time risk. | Yes — revisit if container build fails late. |
| D-0.7 | Qloo API key is asserted valid through the judging period; caching/storage terms remain unanswered. | User confirmation closes key-lifetime risk. Storage terms still open ⇒ conservative mode stays: in-memory cache only, `PERSIST_QLOO_DERIVED=false`. | Yes if organizer contradicts. |
| D-0.8 | Sequence Qloo work ahead of agent work: only the Qloo key exists at Phase 0 close. | Real evidence (Gate A, Spikes 1–3) beats speculation; DeepSeek-dependent work (Prior Lock, agent loop) is deferred to Phase 3. | Yes. |

## Deviations from contract

- **`git diff --check` flags trailing whitespace in `ProjectSpec/*.md` (markdown hard line breaks).**
  Committed unchanged rather than editing supplied read-only source. Our authored files
  (`.gitignore`, `.env.example`, `LICENSE`, `AGENTS.md`, both trackers) pass the check
  (`exit=0`). Rationale recorded here per AGENTS.md §2; no higher-order source altered.

## Known Risks / Blockers

| ID | Severity | Blocker | Impact | Owner |
|---|---|---|---|---|
| B-01 | **Critical** | Qloo key exists (user-confirmed) but has **not been delivered to the agent** — no `.env`, no env var. | Blocks Spikes 1–6, Gate A (transport), all Qloo work, Phase 3. Highest-value action is to receive it. | User |
| B-02 | **Critical** | DeepSeek API key + balance not yet available. | Blocks Prior Lock, agent controller, every LLM-backed run. Qloo-first sequencing (D-0.8) limits schedule damage. | User |
| B-03 | ~~Docker not installed~~ | **Closed by D-0.6** (accepted risk). | Local container tests skipped; Dockerfile validated on Render. | — |
| B-04 | High | Local git done; **public GitHub repo not yet created** (needs name/visibility/`gh` auth decision). | Mandatory submission requirement R2 + license visibility R5. | User |
| B-05 | High | Qloo **cache/storage terms** unconfirmed with organizer (key-lifetime half closed by D-0.7). | Determines `PERSIST_QLOO_DERIVED` and preset warm-up. Conservative in-memory default until answered. | Organizer |
| B-06 | Medium | MapTiler key, Turso database not provisioned. | Map/geocoding (S0/S1) and durable Run state (Phase 5). Not needed for Phase 1–2. | User |
| B-07 | Medium | Deadline Oct 30 2026 23:45 EDT; internal freeze Oct 28. **24 days from today.** | Schedule pressure; see `HACKATHON_TRACKER.md`. | Orchestrator |
| B-08 | Medium | Qloo `qloo mcp` needs Node 22.19+ and a long-lived backend; serverless unsupported. | Constrains hosting to Render Free (locked). | Locked, no action |

## Last Verified Commit

`00e0e6d` — *docs: establish the Zorq implementation contract and hackathon requirements tracker.*
(13 files: `AGENTS.md`, 7× `ProjectSpec/`, both trackers, `LICENSE`, `.gitignore`, `.env.example`.
Working tree clean.) No prior commit exists; this is the root commit.

## Next Highest-Value Action

Receive B-01 (Qloo key into `.env`) → run the **smallest real diagnostic**: auth handshake,
`/search`, `/v2/tags` against `https://hackathon.api.qloo.com`. That single observation
resolves Gate A and most of Spike 2, and converts transport assumptions into typed facts.
Parallel credential-independent work: write the Phase 1 contract, scaffold the monorepo
(Vite/TS frontend + Express/TS backend), public GitHub repo (B-04).

## Phase 0 Exit-Gate Status

- [x] Repository state reconstructed
- [x] All Project Spec files read at phase boundary
- [x] Current-state model written
- [x] Blockers and risks identified and assigned
- [x] Decisions received from user (D-0.5 … D-0.8)
- [ ] **Qloo API key delivered into `.env`** (B-01) — last gate item
- [ ] Phase 1 contract written (first action of next phase)

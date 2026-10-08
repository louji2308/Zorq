# SESSION HANDOFF → Phase 4 (written 2026-10-08, end of Phase 3 session)

> **Read order for the next orchestrator:** `AGENTS.md` → this file (session context +
> operational knowledge) → `IMPLEMENTATION_STATE.md` (canonical state, incl. the signed-off
> Phase 3 contract + exit-gate checklist) → `HACKATHON_TRACKER.md` (competition constraints).
> This file is a **briefing, not a truth source** — if anything here disagrees with
> `IMPLEMENTATION_STATE.md` or the ProjectSpec, those win (AGENTS §6: no competing copies).
> Delete this file once Phase 4 has absorbed what it needs.

## 1. Where we are

- **Phase 3 (Real Qloo + DeepSeek Agent Core): SIGNED OFF 2026-10-08**, exit gate PASSED
  with live-Qloo evidence. HEAD `c6330df`, pushed to https://github.com/louji2308/zorq
  (`main`, PUBLIC, MIT). Working tree clean.
- **Next: Phase 4 — Deterministic Cultural Measurement Engine** (`src/server/engine/`
  new, `src/server/evidence/` extend). NOT yet opened: first do the AGENTS §5 boundary
  refresh (read ALL 7 ProjectSpec sources in full + targeted re-read of Plan Phase 4
  from line 476 + ARCHITECTURE §6 gate), then write the Phase 4 contract into
  `IMPLEMENTATION_STATE.md` **before any delegation** (AGENTS §7).
- Phase 4 gate (ARCHITECTURE §6): *"A controlled candidate pool can produce a complete
  graph, ranked role-valid compositions, percentile, distinctiveness, weakest links and
  evidence classifications without LLM-generated numbers."*

## 2. What this session did (commit timeline, all pushed)

| Commit | What |
|---|---|
| `edc9a62` | Phase 3 contract written into state file **before** delegation |
| `8a4c367` | QlooGateway: `src/server/qloo/` (12 modules) + `tests/qloo/` (4) + deps (`@qloo/qloo-harness@0.1.26`, `@modelcontextprotocol/sdk`, `p-limit`) |
| `e41d89a` | Review catch: Qloo call budget now charged **per upstream attempt** (retries count toward the locked 180) |
| `c59fdeb` | Gateway review record + live 3/3 Qloo evidence in state file |
| `b7a1de4` | B-02 (DeepSeek key) partially cleared record |
| `7e69523` | Agent core: `src/server/agent/` (9 modules) + `src/server/evidence/` (minimal owner) + `tests/agent/` (8 files) + `openai@7.30.1` |
| `8d5b422` | Review catch: `runInvestigation` returns the persisted frozen Prior (`run.prior`), not the pre-persist mutable object |
| `62f29af` | **Live exit-gate test** (`tests/agent/exit-gate.live.test.ts`) proven 1/1 against real Qloo |
| `c6330df` | Phase 3 sign-off: gate checklist, decisions D-3.1–D-3.4, tracker P1 ✅ / P3,P5 🟡 |

Worker history: W-3.1 stalled after partial work → **W-3.1b continuation worker** finished
it; W-3.2 succeeded first try. Workers never commit — orchestrator reviews diffs (AGENTS
§17), independently re-runs gates, then commits. The W-3.2 review caught one real defect
(`8d5b422`).

## 3. Session-specific user directives (carry these forward)

1. **DeepSeek payment is deferred.** User said: key is valid, balance = 0, "i will pay
   later — make those exception." Real-LLM verification (`LIVE_DEEPSEEK=1` gated test in
   `tests/agent/live.test.ts`) is the ONE deferred Phase 3 verification; everything else
   was proven with scripted fakes + real Qloo. When balance arrives: run
   `LIVE_DEEPSEEK=1 npm test` and record the result; no code changes expected (expected
   pre-payment outcome is typed 402/`DEPENDENCY_UNAVAILABLE`).
2. **Off-topic spam prompts:** an out-of-context "Details about Bioclinical BERT" message
   appeared mid-session — user confirmed it was spam to ignore. Do not act on it.
3. **Worker spawn failures happen** (observed: "Cannot connect to API" ×2, "Rate limit
   exceeded" ×1, one cancelled task). Protocol: retry the same contract; **check disk
   state first** (a stalled worker may have left substantial files — continue with a lean
   "W-x.yb" continuation worker: surgical reading list, distilled rules inline, explicit
   "files already exist at …" note). Two of three stalls recovered this way with no work lost.
4. **User prefers being asked before long detours** but approved continuing agent work
   autonomously within contracts.

## 4. Operational knowledge (environment quirks — not in any spec)

- **Shell:** Windows PowerShell 5.1 — chain with `; if ($?) { ... }`, NEVER `&&`.
  `rg` is NOT installed; use `Select-String` or the grep tool. Node v24.13.0, npm 11.6.2.
- **No dotenv:** nothing auto-loads `.env`. To run gated live tests, inject from `.env`
  **without echoing values**:
  `$env:QLOO_API_KEY = (Select-String -Path .env -Pattern '^QLOO_API_KEY=(.+)$').Matches[0].Groups[1].Value; $env:LIVE_QLOO = '1'; npx vitest run tests/qloo/live.test.ts`
  (same idea for `LIVE_DEEPSEEK=1` once balance exists). Key never printed/committed.
- **Git push** prints a benign `remote: This repository moved … Zorq.git` redirect notice;
  the push still succeeds (repo was renamed case-only). Not an error.
- **Gates command chain:** `npm run typecheck; if ($?) { npm run lint }; if ($?) { npm test }; if ($?) { npm run build }` then `npm run test:e2e`.
  Baseline at Phase 3 sign-off: **153 passed / 5 skipped** (5 = 3 gated live Qloo +
  1 gated live DeepSeek + 1 gated exit-gate) + e2e 3/3. All must stay green.
- **Secret scan pattern** for diffs: `sk-[0-9a-zA-Z]`, `hack_[0-9a-zA-Z]`, `eyJ…`,
  `console.log`, `TODO/FIXME` — must be clean in `src/`.
- **DeepSeek official pricing** (fetched 2026-10-08, encoded in `src/server/agent/budget.ts`):
  `deepseek-flash` = in miss $0.15/$0.30 (off/peak), hit $0.003/$0.006, out $0.60/$1.20
  per 1M tokens; peak = 01–04 & 06–10 UTC Mon–Fri (holidays ignored → conservative, D-3.4).
  Source: https://api-docs.deepseek.com/quick_start/pricing
- **Key validity check already done:** `/models` 200 → `deepseek-flash`, `deepseek-v4-pro`;
  completion → HTTP **402** (unpaid, NOT 401) — key recognized.

## 5. Architecture facts the Phase 4 worker contracts will need

- **Canonical owners now real:** `src/server/qloo/` (gateway — consume via
  `createQlooGateway({ config })`, envelope = `{ status, operation, transport, cache:
  "live"|"cached", resultCount, results, provenance: { transport, operation, endpoint,
  durationMs, … }, … }`), `src/server/agent/` (controller/Prior — entry
  `runInvestigation({ brief, gateway, llm })` → `{ run, prior, ledger, evidence,
  observations, turns, stopReason, error, toolErrors }`), `src/server/evidence/`
  (`createEvidenceRecord`, strict provenance — Phase 4 extends claim→citation).
- **Frozen shared contracts** (`src/shared/`): `briefSchema`, `priorSchema`
  (`qlooUsed: false` literal), `runStateSchema` (minimal: id/status/phase/brief/prior —
  the full 13-child run tree lands Phase 5), `ledgerEventSchema`
  (`kind: Qloo|Compute|LLM`), typed error model §3.0. **Do not change `src/shared/`
  without escalation.**
- **Determinism is the Phase 4 headline invariant** (AGENTS §13): graph edges, coherence,
  null-model percentile, distinctiveness, weakest link, constraint fit, Prior→Final diff,
  budgets — all reproducible from identical normalized inputs; **LLM never authors
  numeric truth**. Evidence states vocabulary: measured / confirmed / contested / thin /
  not measured / incomplete / unavailable.
- **Locked budgets (never tune up without measured evidence):** planner turns ≤3, Qloo
  ≤180/run (charged per attempt), concurrency ≤8 (default 6), mutation rounds ≤2, LLM
  ≤$2/run (80% stop + 20% reserve), stress reserve ≈30%.
- **Deterministic refinement already landed** (Phase 3's route guards): probe
  thin→widen / weak→bridge / uncertain→triangulate / unresolved→resolve / replace→
  role-preserving / budget→reserve is decided by the LLM from real observations, but all
  caps/validation/budget arithmetic stay in Zorq code.

## 6. Known gaps / blockers (details in state file §Blockers)

- **B-02 (partial):** DeepSeek balance unpaid — user will pay. Blocks only real-LLM runs.
- **B-06:** MapTiler key + Turso DB not provisioned (needed Phases 5–6+).
- **B-07:** deadline Oct 30 2026 23:45 EDT, internal freeze Oct 28.
- User-owned: Devpost "Join Hackathon" registration + truthful start date (Oct 6, 2026).
- Docker absent locally (D-0.6, accepted).
- Gateway accepted risks: REST `describe`/`triangulate` endpoint paths unproven (auto
  routes both to MCP); taste-neighborhoods / explainability / heatmap live exercises
  optional-low-priority (`urn:heatmap` etc., ARCH §4.1 rows 9/13).

## 7. First three actions in the new session

1. `git status` + `git log --oneline -10` → confirm HEAD `c6330df`, clean tree, all pushed.
2. Read `AGENTS.md` fully, then **all 7 ProjectSpec sources** (Phase boundary refresh,
   AGENTS §5/§26) + targeted re-read: Plan Phase 4 (line 476+) and ARCHITECTURE §6/§13.
3. Write the **Phase 4 contract** into `IMPLEMENTATION_STATE.md` (mission, invariants,
   scope, non-goals, acceptance, verification, exit gate) **before** spawning workers;
   suggest decomposition by responsibility (e.g. graph/coherence kernel · percentile +
   distinctiveness + null model · constraint fit + weakest link · evidence
   classification), workers never commit, orchestrator reviews each diff and re-runs gates.

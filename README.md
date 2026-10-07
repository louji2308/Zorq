# Zorq

**Cultural composition intelligence for physical places.**

Zorq is an autonomous cultural composition agent: it takes a brief for a site, freezes an
LLM-only Prior, investigates the locality with Qloo's taste and locality intelligence,
measures cultural relationships deterministically, assembles competing compositions,
stress-tests its own recommendation, and produces an evidence-bound **Place Blueprint** —
plus an honest *Without-Qloo* comparison showing what Qloo changed.

> Zorq does not use Qloo to find a place; it uses Qloo to measure the cultural relationships
> that let an agent decide what should exist together — and it leaves the evidence trail
> showing why the plan changed.

**Status: in active build for the [Qloo Agentic Hackathon 2026](https://qloo.devpost.com/).**
Started 2026-10-06. This README grows with the build; where a command does not exist yet,
it is not printed here.

## What works today

- **Repository contract:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — repository ownership map,
  canonical Run state, the 11-route API contract, Qloo capability contract, UI contract,
  phase gates and open blockers.
- **Proven Qloo integration (live, real key, real calls):**
  - REST path: `/search`, `/v2/tags`, `/v2/insights` verified against `hackathon.api.qloo.com`
    (locality filters, numeric `affinity` and `popularity`, POST-body query params).
  - MCP path: the official `qloo mcp` server (stdio) boots, lists 10 tools, serves
    `qloo_capabilities` (contract v1.0.0, canonical) and executes live tool calls.
  - Verdict and binding conditions: [`ARCHITECTURE.md` §4.2](./ARCHITECTURE.md).
- **Competition tracking:** [`HACKATHON_TRACKER.md`](./HACKATHON_TRACKER.md) (requirements,
  build gates, spikes, submission checklist).
- **Build state / decisions / evidence:** [`IMPLEMENTATION_STATE.md`](./IMPLEMENTATION_STATE.md).

## What is not built yet

Application code. Phases 2–10 of the
[implementation plan](./ProjectSpec/IMPLEMENTATION_PLAN.md) cover the typed runtime, the real
Qloo + DeepSeek agent core, the deterministic measurement engine, SSE/durable state, the five
screens, integration, deployment and red-team verification. Each phase has an explicit exit
gate; run/install commands appear here only once they actually work on a fresh checkout.

## Architecture in one diagram

```text
USER BRIEF → FROZEN LLM PRIOR → QLOO SITE READ → CULTURAL DNA
  → EVIDENCE-BEARING CANDIDATE POOL → DETERMINISTIC SHARED-CULTURE GRAPH
  → EXACT COMPOSITION SEARCH + NULL MODEL → PRIOR + THREE RIVALS
  → TRIANGULATION + CHALLENGE-THE-PLAN → CONSTRAINT / FORMAT FIT
  → EVIDENCE-BOUND BLUEPRINT → WITHOUT-QLOO PROOF + USER REVISION
```

Separation of powers (non-negotiable):

| Layer | Owns |
|---|---|
| **Qloo** (MCP primary, REST fallback) | cultural measurement / external evidence |
| **Zorq code** | validation, arithmetic, graph, search, constraints, budgets — *all numeric truth* |
| **LLM (DeepSeek)** | interpretation, probe selection, mutation, explanation — never numeric truth |

## Stack (locked)

React + Vite + TypeScript · Node.js 22.19+ + Express + TypeScript · shared Zod contracts ·
DeepSeek (`deepseek-flash`, OpenAI-compatible) · Qloo official MCP harness · MapLibre + MapTiler ·
Turso/libSQL · Vitest + Playwright · Docker on Render Free · $0-cost ceiling (≤ $2 LLM/run).

## Setup

Not applicable yet — the executable foundation lands with Phase 2. Requirements meanwhile:
Node.js ≥ 22.19, npm, Git. Secrets (`.env`) are required only by the diagnostic scripts and are
never committed; see [`.env.example`](./.env.example) for the variable contract.

## Limitations (honest, current)

- No runnable application yet; no hosted demo URL yet (Phase 9).
- Qloo quota / rate-limit numbers are not yet published by the organizers; call budgets
  (≤ 180 target, ≈ 200 ceiling, concurrency ≤ 8) are engineering defaults pending measurement.
- Measured constraints: Qloo responses are 0.2–1.0 MB (field projection is mandatory), and the
  affinity band is compressed (range 0.036 over 50 results) — deltas are normalized, never
  presented as raw gaps.
- Four capabilities the canonical MCP tools do not expose (entity search, heatmap, taste
  neighborhoods, explainability) require the REST fallback path.
- Docker is not available in the local dev environment; container builds are validated on Render.

## Security notes

- Qloo and DeepSeek keys live only in server-side environment variables; never in the browser
  bundle, Git, logs, screenshots, or this README.
- Qloo is never called from the browser.
- Qloo response data is never stored in this public repository (official Qloo rule); only
  aggregate statistics and parameter findings are recorded.

## License

[MIT](./LICENSE)

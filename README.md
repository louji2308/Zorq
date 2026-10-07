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
- **Typed runtime (Phase 2):** Express server with the security baseline (Helmet, per-IP rate
  limiting, Zod validation, typed error model), `GET /healthz` (200 `{"status":"ok",…}` when
  configured; 503 typed error naming the missing variables when not), SPA static serving with
  client-route fallback, shared Zod contracts in [`src/shared`](./src/shared).
- **Test suites:** Vitest unit/integration (`npm test`) covering health, errors, degraded boot
  and config; Playwright E2E smoke (`npm run test:e2e`) driving your installed system Chrome
  against a real production build — `/healthz`, SPA mount, and SPA fallback on an unknown route.
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

The product itself: the Qloo + DeepSeek agent core (Phase 3), the deterministic measurement
engine (Phase 4), durable run state / SSE / recovery (Phase 5), the five judge-facing screens
(Phases 6–8), and deployment (Phase 9). There is **no hosted URL yet**: `deployment/Dockerfile`
and `deployment/render.yaml` exist as a reviewed-but-unbuilt contract (Docker is not available in
the local dev environment, so the image is validated on Render when deployment lands). Each phase
of the [implementation plan](./ProjectSpec/IMPLEMENTATION_PLAN.md) has an explicit exit gate;
commands appear here only once they actually work on a fresh checkout.

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

## Run it

**Prerequisites:** Node.js ≥ 22.19 + npm, Git, and Google Chrome (the E2E suite launches your
installed system Chrome via Playwright's `channel: "chrome"` — it never downloads a browser).

Install exactly as a fresh checkout would:

```bash
npm ci
```

**Configuration.** Copy the placeholder contract and fill values *locally*:

```powershell
Copy-Item .env.example .env
```

Required at start: `NODE_ENV` and `APP_BASE_URL`. The remaining variables in
[`.env.example`](./.env.example) (Qloo / DeepSeek / Turso / MapTiler) are unused by the runtime
so far. Never paste real values into commits, docs, issues, or screenshots; `.env` is git-ignored.

**Production-style run** (this is also what the E2E suite executes):

```bash
npm run build
npm start
```

Verify the health contract:

```bash
curl http://localhost:3000/healthz
# → 200 {"status":"ok","service":"zorq","version":"…","checks":{…}}
```

With `NODE_ENV`/`APP_BASE_URL` absent the server still boots, and `/healthz` answers 503 with a
typed error naming the missing variables — that degraded-boot behavior is the documented
contract, not a crash.

**Development mode** (two terminals):

```bash
npm run dev:server   # Express API (incl. /healthz) on http://localhost:3000 (tsx watch)
npm run dev:web      # Vite dev server for the frontend shell on http://localhost:5173
```

The built SPA is served by `npm start` (production mode) only; in development the frontend
shell lives on the Vite dev server. No API proxy is wired into Vite yet (front-end screens
land in Phase 6).

**Quality gates** (all must stay green):

```bash
npm run typecheck
npm run lint
npm test           # Vitest unit/integration
npm run test:e2e   # Playwright smoke: builds, starts, tests against system Chrome
```

## Limitations (honest, current)

- No hosted demo URL yet — deployment lands in Phase 9 (`deployment/` holds the reviewed
  Dockerfile + Render config; no image has been built, so there is nothing deployed today).
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

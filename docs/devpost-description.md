# Zorq — Devpost submission description (draft)

> Draft for the Devpost "text description" field (hard requirement **R3**).
> Structure follows `ProjectSpec/Hackathon_details.md` §30. Paste into Devpost before submitting,
> then delete the two `[FREEZE]` notes after the funded live run fills them in.
> Nothing here is invented: every claim maps to a shipped surface (`README.md`, `ARCHITECTURE.md`,
> `/method`). Anchored on one persona (mixed-use placemaking team) per §30.

## One-line hook

**Design what should exist together on a site — not just what is nearby.**

## Problem

A mixed-use placemaking team is handed a site brief — the space, the city, the ambition, the
constraints — and must decide the *combination* of cultural components that should coexist there:
which anchors, which supporting acts, which formats. Today that decision is made from intuition,
prior portfolios, and proximity. "What is nearby" is not the same as "what belongs together," and
the difference is exactly where tenant-mix plans quietly fail.

## Why existing AI fails

A generic LLM, asked the same question, produces a plausible *median* answer: the obvious
categories, ranked by familiarity, with no way to measure how their audiences actually relate to
each other **in this locality**. It cannot see shared culture between a record bar and a film
archive, cannot tell local distinctiveness from national popularity, and cannot show its reasoning
as evidence. The output reads confident and is culturally blind.

## What Zorq does

Zorq is an autonomous cultural composition agent. One run:

```text
Brief
  → Frozen LLM Prior        (the model's LLM-only first guess, frozen before any data)
  → Qloo investigation      (locality, place→culture, culture→place, taste neighborhoods)
  → Cultural DNA            (heartbeat entities + provenance paths behind each candidate)
  → Deterministic graph     (IDF-weighted shared-culture edges, null-model percentile)
  → Competing compositions  (Prior + three rivals, exact search, distinctiveness, weakest link)
  → Challenge the Plan      (Zorq attacks its own recommendation, five ways, on the record)
  → Constraint / format fit (Cinema → micro-screening; role preserved, evidence unchanged)
  → Evidence-bound Place Blueprint
  → Without-Qloo comparison (what the evidence actually changed)
```

The Protected Loop is the point: the Prior is frozen *first*, then Qloo is allowed to change it —
or to honestly confirm it. On a control site Zorq says plainly that the evidence confirmed the
first guess; it never manufactures divergence.

## Why Qloo matters

Qloo is Zorq's external cultural-measurement layer — not a recommendation endpoint. Zorq uses:

- **`qloo_capabilities`** (MCP startup) — credential/runtime check before a run.
- **Entity / place search** — resolve admired places and site names to canonical IDs.
- **Tag search / resolution** — never hardcode category URNs; resolve per category at runtime.
- **Locality / heat (`urn:heatmap`)** — where taste concentrates near the site (S1 map + anchors).
- **Place insights at site *and* city scale** — the two-scale read behind local distinctiveness.
- **Place → culture** — the artists/films/brands around the anchors (Cultural DNA).
- **Culture → place** — candidate components with a defensible provenance path.
- **Taste neighborhoods** (entities as signals) — per-component structure used for the graph.
- **Second route on finalist edges** — triangulation: confirmed / contested / thin.
- **Bridge / replace probes** — repair weak edges; role-preserving alternatives.
- **Explainability where returned** — which entities influenced a result.

Remove Qloo and Zorq loses the shared-culture edges (the graph has nothing to draw), the
local-vs-city contrast that resists the popularity trap, the evidence path behind every candidate,
and the reason the Prior changed.

## What the agent does

A single bounded Rapid Router controller using Qwen (`qwen/qwen3.7-flash-2026-07-15`) — not a swarm — runs an
observation → diagnosis → tool-selection loop with hard limits (≤ 3 planner turns per phase,
≤ 2 mutation rounds). It chooses which Qloo probes to run from what it observes, selects the
anchor set, then turns on its own output in **Challenge the Plan**: it names the strongest
alternative, the weakest link, the popularity risk, the format risk, and the honest
confirmation case — and returns `Survived / Revised / Replaced`. The LLM authors the words; it
never authors a number or an evidence ID. Every numeric metric is deterministic Zorq code.

## Proof of difference

The Prior → Final diff is computed from the frozen Prior and the measured final set, so the change
is reproducible from the same inputs. Two honest outcomes are possible, and both are shown:

- **Divergence** — Qloo's shared-culture edges and local distinctiveness push the composition away
  from the LLM's median guess (the Prior's obvious anchors drop or change role).
- **Confirmation** — the evidence agrees; the Blueprint states that the LLM-only Prior survived
  contact with data.

`[FREEZE]` Paste one real Prior → Final change from the funded live run here (anchor + component
that moved, and the measured reading that moved it). Do not hand-write numbers.

## Technical implementation

- **Stack:** React + Vite SPA and an Express API on one Render origin; shared Zod contracts;
  TypeScript end-to-end; Node ≥ 22.
- **Qloo access:** official `qloo mcp` as primary transport with a REST fallback; per-attempt
  budget (target ≤ 180 calls, ≈ 200 ceiling, concurrency 6), responses projected (payloads are
  0.2–1.0 MB), never called from the browser.
- **Deterministic measurement engine** (`src/server/engine/`): taste neighborhoods, IDF-weighted
  edges, mean composition coherence, exact percentile over role-valid subsets vs a null model,
  local-vs-city distinctiveness, weakest-link, triangulation classification, evidence grades,
  constraint/format fit, Prior→Final diff, budgets. Byte-identical across reruns.
- **Agent:** bounded Rapid Router controller, write-once Prior Lock, price-derived LLM budget
  (≤ $2/run).
- **State & reliability:** durable RunStore (in-memory + Turso), SSE with Last-Event-ID replay,
  stop/resume/recovery; provider outage → typed honest partial state, not a fake success.
- **Evidence & trust:** every UI claim carries `[Qloo]`, `[Zorq heuristic]` or `[LLM]`; every
  `[Qloo]` claim opens claim → evidence ID → ledger event → measurement input.
- **Ops:** single-origin Docker image on Render Free, `/healthz` with a typed 503 degraded boot,
  CI gates and a scheduled warm ping.

## Trust / limitations

- Qloo **measures**; Zorq **computes**; the LLM **interprets**. The LLM authors no numbers.
- The Qloo catalog is not a census — small or informal venues can be missing.
- Edges describe shared culture between audiences *within the measured pool* — never demand,
  revenue, or success probability.
- Format footprints / hours profiles are labelled `[Zorq heuristic]` planning ranges.
- Coherence and percentiles are relative to the measured pool; there is no ground truth for "the
  right mix."
- Qloo quota/rate-limit numbers are unpublished by the organizers; our call budgets are
  engineering defaults pending measurement.

## Impact

**Anchor persona: a mixed-use placemaking team** deciding a real site's cultural mix — the people
who must defend a combination to a board, not just name a category.

The delivered artifact is a **Place Blueprint**: a standalone, evidence-bound decision document
(shareable, read-only) that names the composition, shows the shared-culture graph behind it,
records what Zorq challenged and how it answered, and states honestly what the evidence changed
versus the LLM-only first guess. Adjacent users — mall/high-street operators, venue groups, and
cultural-district planners — run the same loop; the placemaking team is the demo's anchor.

`[FREEZE]` Add the funding/status line and the live demo URL
(`https://zorq-12dk.onrender.com`) just before submitting.

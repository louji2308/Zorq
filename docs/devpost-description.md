<!--
Devpost "text description" field (hard requirement R3, Hackathon_details §30).
Submission-final. Live app: https://zorq-12dk.onrender.com
-->

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

## Core features

- **Prior Lock** — the LLM's first guess is frozen and timestamped before any cultural data; you can see both halves of the story.
- **Live agent workspace** — a real-time ledger of every Qloo, Compute and LLM step, a map of where taste concentrates near the site, and the site's Cultural DNA.
- **Composition Field** — the Prior and three engine-built rivals ranked with coherence percentiles, local distinctiveness, weakest link and per-card evidence grades.
- **Map of meaning** — components as nodes, shared culture as edges; every edge opens an Evidence drawer tracing the claim.
- **Challenge the Plan** — five recorded attacks (ablation, substitution, bridge, catchment, rival) with Survived / Revised / Replaced verdicts.
- **Place Blueprint** — the final shareable, evidence-bound decision document, with Share link, copy-as-Markdown and print.
- **Without-Qloo comparison** — a built-in control showing exactly what the cultural evidence changed versus the LLM-only path.
- **Durable runs** — progress is persisted server-side; refresh, disconnect and reconnect recover over server-sent events.

## How you use it

Judges can try live at **https://zorq-12dk.onrender.com** — no login, no setup.

1. **Brief (S0).** Pick one of three preset sites (Crosby Street, SoHo; Lower Broadway, Nashville; Reading Terminal Market, Philadelphia) or place your own site on the map. As you type the Goal, a grey **Qloo-driven tags** rail suggests relevant cultural tags in context (served by a small Qloo preview; picking none still works).
2. **Run created → Investigation (S1).** Submitting the brief freezes the Prior before any data and opens the live workspace: the frozen Prior card ("No cultural data used."), the **Agent Ledger** streaming every Qloo / Compute / LLM step, a map with the site ring, anchor pins and heat, and **Cultural DNA** — the local vs. city cultural profile of the site filling in as Qloo measures.
3. **Compositions (S2).** The measured compositions appear: the Prior rendered next to engine-generated rivals A/B/C over a histogram ("the Field"), each with role structure, coherence percentile, local-vs-city distinctiveness, weakest link and an evidence grade. A dial re-ranks using the cached deterministic metrics.
4. **Connections (S3).** Components become nodes; shared culture becomes edges (distance from edge strength). Click any edge to open the **Evidence drawer**: the shared entities, the measurement route, triangulation status and ledger links — the answer to "why do these belong together?" is inspectable, not narrated.
5. **Challenge the Plan (S4).** Zorq attacks its own leader five ways; verdict rows show each attack measured, and the leader is revised or replaced on the record.
6. **Place Blueprint (S5).** The final artifact: composition with per-role receipts and superscripts linking to evidence, fit-to-site bars, risks, the prior→final slope **What Qloo changed**, revision history and the evidence grade — shareable by link, copyable as Markdown, printable.
7. **Without-Qloo comparison.** One click opens the side-by-side control: frozen LLM-only path versus the evidence-driven final. Here you see exactly what Qloo's measurements added — or the honest sentence "Here, the evidence changed nothing."
8. **Recovery.** Refresh mid-run: the page reconnects over server-sent events and replays the ledger; the run state is durable server-side.

## Why Qloo matters

Qloo is Zorq's external cultural-measurement layer — not a recommendation endpoint. Zorq uses:

- **`qloo_capabilities`** — a diagnostic probe the agent runs when a Qloo transport error
  occurs, verifying gateway readiness and supported operations.
- **Entity / place search** — resolve admired places and site names to canonical IDs.
- **Tag search / resolution** — never hardcode category URNs; resolve per category at runtime.
- **Locality / heat (`urn:heatmap`)** — where taste concentrates near the site (S1 map + anchors).
- **Place insights at site *and* city scale** — the two-scale read behind local distinctiveness.
- **Place → culture** — the artists/films/brands around the anchors (Cultural DNA).
- **Culture → place** — candidate components with a defensible provenance path.
- **Taste neighborhoods** (entities as signals) — per-component structure used for the graph.
- **Second route on finalist edges** — triangulation: confirmed / contested / thin.
- **Bridge / replace probes** — repair weak edges; role-preserving alternatives.

Remove Qloo and Zorq materially loses information: the shared-culture edges disappear (the graph
has nothing to draw), the local-vs-city contrast that resists the popularity trap disappears, the
evidence path behind every candidate disappears, and the Prior→Final comparison loses the reason
anything changed. That dependency is why Zorq ships a Without-Qloo comparison panel as a real
surface — the "delete test" is a built-in feature, not a thought experiment.

## What the agent does

A single bounded LLM controller routed through Rapid Router (DeepSeek-backed
`deepseek/deepseek-v4-flash`) — not a swarm — runs an observation → diagnosis → tool-selection
loop with hard limits (≤ 3 planner turns per phase, ≤ 2 mutation rounds). It chooses which Qloo
probes to run from what it observes, selects the anchor set, then turns on its own output in
**Challenge the Plan**: it names the strongest alternative, the weakest link, the popularity risk,
the format risk, and the honest confirmation case — and the verdict (`Survived / Revised /
Replaced`) is decided by deterministic code. The LLM authors the words; it never authors a number
or an evidence ID. Every numeric metric is deterministic Zorq code.

## Proof of difference

The Prior → Final diff is computed from the frozen Prior and the measured final set, so the change
is reproducible from the same inputs. Two honest outcomes are possible, and both are shown:

- **Divergence** — Qloo's shared-culture edges and local distinctiveness push the composition away
  from the LLM's median guess (the Prior's obvious anchors drop or change role).
- **Confirmation** — the evidence agrees; the Blueprint states that the LLM-only Prior survived
  contact with data.

Both outcomes have been observed on real runs through the deployed app:

- **Nashville (Lower Broadway preset):** the run completed through the full pipeline — an
  evidence grade-B ranked composition, **Challenge the Plan returned `Revised`** with two
  mutations across three measured attacks, and the Blueprint carried a real Without-Qloo diff.
- **Chennai:** a rerun completed with a five-component pool and **Challenge `Revised`**
  (two drop mutations); the Blueprint was issued at **evidence grade B**, with "What Qloo changed"
  naming all three final leader members and their evidence IDs.

In both cases the Without-Qloo panel shows exactly what the cultural evidence changed — no number
is invented, and a control site would state plainly that the evidence confirmed the Prior.

## Technical implementation

- **Stack:** React + Vite SPA and an Express API on one Render origin; shared Zod contracts;
  TypeScript end-to-end; Node ≥ 22.19.
- **Qloo access:** official `qloo mcp` is the primary transport for readiness, tag, describe,
  bridge, replace and triangulation calls, with a direct Qloo REST fallback; entity search and
  insights run over the Qloo REST API. Per-attempt budget (locked ≤ 180 calls, concurrency 6),
  responses projected to typed shapes before persistence, never called from the browser.
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

## Transparency

Zorq is built to be audited, and these points stay visible in the product:

- Qloo **measures**; Zorq **computes**; the LLM **interprets**. The LLM authors no numbers.
- The Qloo catalog is not a census — small or informal venues can be missing; evidence states like
  *contested / thin / not measured* are rendered as-is rather than averaged away.
- Edges describe shared culture between audiences *within the measured pool* — never demand,
  revenue, or success probability. Format footprints / hours profiles are labelled planning ranges.
- Coherence and percentiles are relative to the measured pool; the `/method` page in the app shows
  every formula, worked example and editable heuristic, so the math is checkable by anyone.

## Impact

**Anchor persona: a mixed-use placemaking team** deciding a real site's cultural mix — the people
who must defend a combination to a board, not just name a category.

The delivered artifact is a **Place Blueprint**: a standalone, evidence-bound decision document
(shareable, read-only) that names the composition, shows the shared-culture graph behind it,
records what Zorq challenged and how it answered, and states honestly what the evidence changed
versus the LLM-only first guess. Adjacent users — mall/high-street operators, venue groups, and
cultural-district planners — run the same loop; the placemaking team is the demo's anchor.

**Try it now — no login, no setup:** https://zorq-12dk.onrender.com

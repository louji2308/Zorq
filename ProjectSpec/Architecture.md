# ZORQ — System Architecture

**Purpose:** implementation-grade architecture for Zorq, an autonomous cultural composition agent for physical places. This document translates the final concept, Product Specification, Final Design, Hackathon Intelligence, and Tools & Requirements into one coherent runtime and UX architecture.

**Source authority:** Product Specification v1 is the behavioral/source-of-truth contract. Tools & Requirements locks the implementation stack and operational boundaries. Final Design governs visual/interaction language. Idea.md supplies the product thesis and conceptual workflow. Hackathon_details.md governs competition-facing constraints and proof requirements.

## 1. Architecture Thesis

Zorq is not a place recommender. It is a **cultural composition system**: a brief becomes a frozen LLM prior, Qloo investigates the place, Zorq measures relationships between candidate components, the agent generates competing compositions, attacks its leader, fits it to physical/operating constraints, and emits a receipt-backed Place Blueprint.

The central architectural rule is:

> **Qloo measures. Zorq computes. The agent interprets and decides. The Blueprint proves.**

The hackathon test is structural, not cosmetic: removing Qloo must remove locality/cultural relationships, distinctiveness, evidence paths, and the resulting Prior→Final change. Zorq must therefore never reduce to `LLM → Qloo → recommendations`.

## 2. Winning Constraints

- **Technological Implementation:** real Qloo tooling across locality, entity/tag resolution, cross-domain cultural signals, candidate validation, evidence, triangulation, and agent probes.
- **Design:** the application teaches itself; every stage is inspectable without narration or a required video.
- **Potential Impact:** output is a professional planning artifact for owners, operators, developers, venues, and placemaking teams—not a recommendation feed.
- **Quality of Idea:** the primitive is the **set + relationships + evidence**, not an individual business.
- **Trust:** no fabricated Qloo facts, no LLM-authored numeric metrics, no magical confidence score, no hidden state mutation.
- **Reliability:** a judge can run a preset in one click, observe real work, recover from partial failure, and reach a usable Blueprint.

## 3. Expert-Decision Architecture

The architecture intentionally closes several gaps between probabilistic language-model behavior and strong expert decision processes. This is an engineering pattern, not a claim that an LLM literally reasons like a human.

1. **Generate a plausible first move:** the agent creates a Prior before Qloo evidence, then freezes it. This mirrors expert decision patterns in which a plausible course of action can be generated early and evaluated through simulation. [[Klein/RPD](https://www.gary-klein.com/rpd)]
2. **Generate alternatives before polishing:** graph search produces multiple role-valid compositions instead of one seductive answer.
3. **Run mental-simulation analogues:** stress operations simulate ablation, substitution, bridge insertion, catchment changes, and rival weighting.
4. **Seek disconfirmation:** `Challenge the Plan` is a first-class control loop, not a final UI flourish.
5. **Compare against a reference distribution:** exact null-model percentiles prevent arbitrary scores and expose whether coherence is exceptional within the candidate pool.
6. **Separate intuition from arithmetic:** model judgment chooses probes and mutations; deterministic code owns every metric and filter.
7. **Preserve decision history:** Prior, ledger, evidence IDs, revisions, and final diff remain immutable/auditable.
8. **Expose uncertainty and correctability:** thin/contested/unmeasured evidence is visible; users can unpin anchors, replace members, stop a run, or rerun.
9. **Bound autonomy:** call, turn, concurrency, mutation, and wall-clock limits prevent runaway agent behavior.
10. **Use progressive disclosure:** the primary workflow is readable; technical evidence expands only when inspected.

Microsoft's validated human-AI interaction guidance reinforces the architecture's emphasis on capability/precision matching, correction, graceful behavior under uncertainty, and explanations of why the system acted. [[Microsoft HAX](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/)]

## 4. System Context

```text
┌──────────────────────────────── USER ────────────────────────────────┐
│ Brief → watches investigation → compares compositions → challenges  │
│ → edits/owns result → receives shareable Place Blueprint             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS + SSE
                                ▼
┌────────────────────────── ZORQ WEB APP ──────────────────────────────┐
│ React + Vite + TypeScript                                            │
│ Routes: / · /run/:id · /run/:id/blueprint · /method                 │
│ Zustand run state · MapLibre map · controlled SVG composition graph │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ same-origin API
                                ▼
┌──────────────────────────── ZORQ SERVER ─────────────────────────────┐
│ Express + TypeScript                                                 │
│                                                                      │
│ Run Orchestrator                                                     │
│   ├─ phase state / idempotency / resume / stop                       │
│   ├─ event ledger / SSE                                              │
│   └─ budgets / concurrency / retries                                 │
│                                                                      │
│ Agent Controller                                                     │
│   ├─ DeepSeek tool-calling planner/challenger                        │
│   ├─ observation → decision → tool → observation loop               │
│   └─ structured outputs validated by Zod                             │
│                                                                      │
│ Qloo Gateway                                                         │
│   ├─ official qloo mcp + @qloo/qloo-harness                         │
│   ├─ @modelcontextprotocol/sdk                                       │
│   └─ transport-agnostic DirectQlooTransport fallback                │
│                                                                      │
│ Deterministic Zorq Engine                                            │
│   ├─ candidate/provenance builder                                    │
│   ├─ taste neighborhoods                                              │
│   ├─ IDF-weighted graph                                               │
│   ├─ exact null model / percentile                                   │
│   ├─ local-vs-city distinctiveness                                   │
│   ├─ triangulation                                                     │
│   ├─ composition search                                               │
│   ├─ stress diagnostics                                               │
│   ├─ constraint/format fit                                            │
│   └─ Prior→Final diff                                                 │
│                                                                      │
│ Evidence / Trust Boundary                                            │
│   ├─ evidence IDs                                                     │
│   ├─ provenance validation                                            │
│   ├─ model-output sanitization                                        │
│   └─ Qloo claim vs Zorq inference separation                         │
└──────────────┬─────────────────────┬─────────────────────────────────┘
               │                     │
               ▼                     ▼
        Qloo Cultural Intel      Turso/libSQL
        Qloo MCP/API             sanitized run state
               │
               └─────────────────────────────────────────────────────┐
                                                                      │
Browser map: MapLibre GL JS ───────────────► MapTiler Free             │
└─────────────────────────────────────────────────────────────────────┘
```

## 5. Responsibility Boundaries

| Layer | Owns | Must never own |
|---|---|---|
| **Qloo** | Cultural/locality measurement, entity/tag resolution, affinity/relationships, locality evidence, explainability where available | Zorq's composition score, causal claims, business certainty |
| **DeepSeek agent** | Prior generation, anchor selection, probe selection, candidate interpretation, mutation choice, stress emphasis, naming, rationale | Numeric truth, evidence creation, raw API semantics, final unsupported claims |
| **Deterministic engine** | Normalization, validation, graph edges, percentiles, distinctiveness, triangulation classification, constraints, ranking, diff, budgets | Subjective prose or invented cultural meaning |
| **Orchestrator** | Phase sequencing, bounded tool loop, event streaming, persistence, retries, cancellation, recovery | Domain conclusions that should come from Qloo/code/agent layers |
| **Evidence layer** | Evidence IDs, provenance paths, claim validation, citation eligibility, raw-reference policy | New evidence or interpretation |
| **Frontend** | Presentation, interaction, client-only reranking, selection, accessibility | API keys, Qloo calls, authoritative scoring |
| **Blueprint** | Final decision artifact and revision history | Untraceable prose detached from evidence |

This separation is the core technical credibility mechanism: the LLM cannot simply describe a desired answer and make it true.

## 6. Canonical Run State

`Run` is the durable state machine and the unit of recovery. Each phase is idempotent and resumable.

```text
Run
├─ id, createdAt, updatedAt, status, phase
├─ Brief
│  ├─ location / coordinates / radius
│  ├─ areaSqFt
│  ├─ objective
│  ├─ constraints
│  └─ admiredPlaces[]
├─ Prior [WRITE-ONCE]
│  ├─ composition
│  ├─ generatedAt
│  ├─ model
│  └─ qlooUsed=false
├─ SiteRead
│  ├─ heat/locality signals
│  └─ selected/unpinned anchors
├─ CulturalDNA
│  ├─ local over-indexed entities
│  └─ local-vs-city comparisons
├─ CandidatePool
│  └─ Component[K≈8–10]
│     ├─ role / tags
│     ├─ ≤5 local exemplars
│     └─ provenance path: anchor → entity → category
├─ Neighborhoods
│  └─ weighted artist/movie/brand entity vectors
├─ Graph
│  ├─ edges
│  └─ weakest links
├─ Compositions
│  ├─ Prior + A/B/C hypotheses
│  ├─ coherence percentile
│  ├─ distinctiveness
│  ├─ weakest link
│  └─ evidence grade
├─ StressReport
│  ├─ ablation
│  ├─ substitution
│  ├─ bridge
│  ├─ catchment shift
│  └─ rival check
├─ ConstraintFit
├─ Revisions[]
├─ Evidence[]
└─ LedgerEvents[]
```

## 7. End-to-End Control Flow

```text
S0 BRIEF
  → validate/resolve site
  → create Run
  → LLM-only Prior
  → WRITE Prior once

S1 INVESTIGATE
  → Qloo locality/heatmap
  → agent selects anchors
  → Qloo anchor enrichment
  → build Cultural DNA
  → Qloo place→culture→place bridge
  → resolve candidate tags/categories
  → build K≈8–10 candidate components
  → measure site + city neighborhoods
  → emit ledger/evidence continuously

S2 COMPOSITIONS
  → deterministic graph
  → exact role-valid subset enumeration
  → rank by coherence/distinctiveness
  → present Prior + 3 alternatives

S3 CONNECTIONS
  → inspect selected graph
  → expose shared cultural entities per edge
  → triangulate finalist edges
  → replace weak members when requested

S4 CHALLENGE
  → agent chooses high-value attacks from diagnostics
  → ablate / substitute / bridge / shift catchment / rival sweep
  → mutate leader at most two rounds
  → classify Survived / Revised / Replaced

S5 BLUEPRINT
  → constraint-fit formats
  → generate evidence-bound rationale
  → generate Prior→Final diff
  → attach risks + evidence grade
  → persist sanitized snapshot
  → share/print/copy
```

The run stops when the leader survives stress and no allowed mutation improves coherence by more than `ε`, or after two mutation rounds, or when the budget/wall-clock cap is reached. A stopped run returns the best defensible state rather than fabricating completion.

## 8. Agent Architecture

### 8.1 One bounded agent, not a swarm

The server runs one DeepSeek tool-calling agent controller. No LangChain/CrewAI/AutoGen/Mastra or multi-agent swarm is part of the MVP. Complexity must exist in the reasoning/evidence model, not in framework count.

### 8.2 Agent loop

```text
OBSERVATION
  ↓
STATE DIAGNOSIS
  ↓
NEXT-PROBE DECISION
  ↓
TOOL CALL
  ├─ Qloo MCP
  ├─ deterministic Zorq tool
  └─ geocode / format lookup
  ↓
VALIDATE RESULT
  ↓
UPDATE RUN + LEDGER + EVIDENCE
  ↓
NEW OBSERVATION
  ↺ bounded until phase stop rule
```

The agent must make consequential evidence-dependent choices: representative anchors, weakest edge, stress priority, bridge acceptance, catchment widening, or member replacement. A fixed script with an LLM narrator is not sufficient.

### 8.3 Local tool surface

`geocode` · `qloo_capabilities` · `qloo_*` via MCP · `format_lookup` · `score_pool` · `search_compositions` · `stress` · `fit_constraints` · `diff` · `llm_only_baseline`.

Every tool input/output is Zod-validated. Unknown entities, tags, evidence IDs, or unsupported operations are rejected before they reach the UI.

## 9. Qloo Investigation Architecture

Qloo should create value at multiple distinct points:

1. **Startup:** capability/credential check.
2. **Brief:** canonical entity/place resolution.
3. **Site read:** locality/heatmap and local anchor discovery.
4. **Cultural DNA:** anchor places → cross-domain artists/films/brands.
5. **Candidate formation:** cultural entities → place categories/tags.
6. **Candidate validation:** site-scale vs city-scale queries.
7. **Taste neighborhoods:** component exemplar signals → entity neighborhoods.
8. **Graph evidence:** pairwise shared cultural entities computed from Qloo outputs.
9. **Triangulation:** independent measurement route for finalist edges.
10. **Bridge:** combined audience/cultural signals to repair weak relationships.
11. **Replace:** role-preserving alternatives under the current cultural evidence.
12. **Stress:** additional Qloo probes only where they can change a decision.

Qloo is therefore not an external lookup at the end; it is the measurement substrate inside the agent loop.

## 10. Cultural DNA and Candidate Provenance

**Cultural DNA is not an LLM personality label.** It is a local-vs-city evidence view: what cultural entities/categories over-index around the target site relative to the broader city context.

Every candidate component requires a defensible path:

```text
local anchor place
      ↓
Qloo cultural entity/tag signal
      ↓
resolved category/role
      ↓
component exemplar set
      ↓
taste neighborhood
```

If a concept cannot resolve cleanly to a defensible Qloo tag/entity, use exemplar clustering rather than inventing a tag. Components with missing evidence remain unmeasured and cannot become finalists.

## 11. Deterministic Cultural Measurement Engine

### 11.1 Taste neighborhood
For component `k`, build `N_k` from Qloo-returned artist/movie/brand entities, top 30 per domain. Use returned affinity when available; otherwise use `1/rank`. Affinity comparability is treated conservatively and validated by the integration spike.

### 11.2 Shared-culture edge
Suppress ubiquitous entities with:

```text
IDF(e) = ln(K / (1 + count_components_containing(e)))
IDF(e) = max(0, IDF(e))
edge(j,k) = cosine(IDF·N_j, IDF·N_k)
```

This is a **relative cultural relationship within the current pool**, not demand, causality, probability, or a Qloo score.

### 11.3 Composition coherence
For equal-size composition `S`:

```text
C(S) = mean(edge(j,k)) over all j<k in S
```

Then enumerate **all** role-valid subsets of the same size and compute the exact percentile. For `K≈10`, five-member sets require at most 252 combinations before filters.

UI language:

> “More coherent than 91% of valid combinations from this pool.”

Never present a fabricated absolute 0–100 ecosystem score.

### 11.4 Distinctiveness
For component `k`:

```text
d(k) = 1 - cosine(N_k^site, N_k^city)
```

Use this to resist the popularity trap: a popular category is not automatically distinctive to the target place.

### 11.5 Ranking
Apply hard role/constraint filters first. Then use:

```text
rank = z(C)·(1-w) + z(D̄)·w
```

`w` is the visible Familiar ↔ Distinctive dial, default `0.5`. Tie-break by weakest link. Rival check sweeps `w ∈ [0,1]` and reports leadership flips.

### 11.6 Triangulation
Finalist edges receive an independent second-route check:

- `confirmed` — both routes strong;
- `contested` — routes disagree;
- `thin` — fewer than five usable results;
- `failed/unmeasured` — no defensible measurement.

Evidence grade:

- **A:** all leader edges confirmed;
- **B:** any contested/thin/failed finalist probe;
- **C:** any leader member unmeasured.

The UI must show these states rather than average them away.

## 12. Composition Search

The composer receives a small evidence-bearing pool and searches **sets**, not businesses.

Each valid composition must satisfy:

- required role coverage;
- physical/operating constraints;
- candidate evidence availability;
- fixed composition size where the scenario defines one.

The output is **Prior + three competing hypotheses** when the pool supports them. If fewer than three distinct valid compositions exist, show the available set count rather than manufacturing options.

The agent names/narrates the hypotheses; the engine owns the ranking.

## 13. Challenge-the-Plan Engine

The leading composition is never treated as final until it survives bounded attacks.

| Attack | Test | Possible action |
|---|---|---|
| **Ablation** | Remove one member. Does coherence/role coverage materially degrade? | Identify load-bearing members. |
| **Substitution** | Swap a member for a plausible same-role candidate. | Test whether the member is uniquely valuable. |
| **Bridge** | Find a culturally connecting component for the weakest edge. | Insert a bridge only when evidence supports it. |
| **Catchment shift** | Widen/narrow spatial scope. | Test geographic robustness. |
| **Rival check** | Sweep `w` from familiar to distinctive. | Detect preference-sensitive leadership flips. |

The agent chooses attack order from observed weakness; deterministic tools execute the arithmetic. The outcome is `Survived`, `Revised`, or `Replaced` with an evidence-bound reason.

## 14. Constraint / Format Engine

Cultural fit is necessary, not sufficient.

The format library contains approximately 25 component types × 2–3 plausible formats. Each format carries:

`role · footprint_range · hours_profile · noise_class · notes`

Fit rules:

1. hard-filter impossible role/constraint combinations;
2. keep total footprint ≤85% of available area by default, preserving circulation allowance;
3. apply hours/noise constraints;
4. downshift a format before dropping a role;
5. if still infeasible, drop the least load-bearing member and rerank;
6. mark footprint/hours assumptions `[Zorq heuristic]` and expose them as editable on `/method`.

Example:

> `Cinema → Micro-screening; role preserved: Anchor.`

This keeps Qloo cultural insight and physical feasibility in separate, inspectable layers.

## 15. Evidence, Provenance and Trust Boundary

### 15.1 EvidenceRecord

```text
EvidenceRecord
├─ id
├─ qlooEndpoint / tool
├─ requestSummary
├─ inputEntityIds
├─ resultEntityIds
├─ resultCount
├─ explainabilityMetadata (when available)
├─ timestamp
├─ cacheState
├─ status
└─ permittedRawReference
```

Every evidence-backed claim must point to an existing `EvidenceRecord.id`. The writer layer cannot invent IDs. Claims without evidence are `[LLM]`, never `[Qloo]`.

### 15.2 Provenance badges

- `[Qloo]` — directly measured/returned evidence;
- `[Zorq heuristic]` — deterministic product rule or planning assumption;
- `[LLM]` — interpretation, naming, rationale, or narrative.

A single sentence should not visually imply more certainty than its weakest provenance layer.

### 15.3 Calibrated explanation

Use plain language and relative bands. Never say:

> “Qloo rates this ecosystem 91/100.”

Say:

> “Zorq's defined coherence calculation places this composition above 91% of valid combinations in this pool.”

Never claim affinity means an individual identity, causal demand, probability of success, or guaranteed commercial performance.

## 16. UX Architecture: the Judge Can Learn the System Alone

The absence of a required demo video makes the product itself the narrator. The interface should make one coherent emotional/technical arc:

```text
uncertainty
   ↓
curiosity: “What was the first guess?”
   ↓
surprise: “What did cultural evidence change?”
   ↓
trust: “The agent tried to break its own plan.”
   ↓
ownership: “I can replace/dial/rerun/share the result.”
```

### S0 — Brief

Purpose: one-click entry. Inputs: address/place, optional sq ft, goal, constraints, optional admired places. Three presets: two Qloo-divergent, one honest control. No Qloo cultural calls before the Prior.

### S1 — Investigate

Persistent map + Agent Ledger + Cultural DNA + frozen Prior. Ledger shows `Qloo / Compute / LLM`, specific work, result summary, endpoint/request summary, timing, and live/cached status. User may stop and show best-so-far or unpin an unrepresentative anchor.

### S2 — Compositions

Prior + A/B/C cards. Show coherence percentile, distinctiveness, weakest link, evidence grade. Visible Familiar ↔ Distinctive dial reranks from cached deterministic metrics. No magic headline score.

### S3 — Connections

Controlled semantic graph: nodes are components, edges are shared culture. Edge inspection reveals shared entities, measurement route, triangulation, and ledger links. No generic force-graph hairball. Provide sorted edge-list fallback on narrow screens/accessibility mode.

### S4 — Challenge

Five attack statuses; live leader mutation; final `Survived / Revised / Replaced` verdict with reason. A failed probe stays visibly failed and caps the evidence grade.

### S5 — Blueprint

A professional, printable decision artifact: title block, rationale, role-based composition, receipts, fit-to-site, hours/noise, Qloo-changed diff, risks/weak links, evidence grade, revision history, method link, and share/copy/print actions.

### `/run/:id/blueprint`

Read-only shareable snapshot. It must stand alone as a decision artifact and preserve the same provenance/evidence language.

### `/method`

Explains exactly what Qloo measures, what Zorq computes, what the LLM generates, heuristics, formulas, examples, known limits, open-source setup, and the difference between evidence and inference.

## 17. Frontend/Backend Interaction

```text
Browser                           Server
  │                                 │
  ├─ POST create run ──────────────►│
  │                                 ├─ lock Prior
  │                                 ├─ persist Run
  │◄──────────── SSE events ────────┤
  │     phase/ledger/evidence        │
  │     DNA/composition/stress       │
  │                                 │
  ├─ user action ----------------──►│
  │   unpin / replace / challenge    │
  │                                 ├─ bounded incremental probes
  │◄──────────── SSE/result ─────────┤
  │                                 │
  └─ GET blueprint ────────────────►│
                                    └─ sanitized snapshot
```

SSE is for progressive visibility; the database remains the source of recovery truth. The client must tolerate reconnects and replay current Run state rather than assume every event was received.

Client state via Zustand should be a projection of `Run`, not a second source of truth. Client-only reranking is allowed because all underlying metrics are already deterministic and stored in the run snapshot.

## 18. Persistence, Cache and Data Policy

Persist only Zorq-owned run state and sanitized blueprint metadata. Do not make long-term raw Qloo responses a product dependency.

Default until Qloo gives written guidance:

- in-memory LRU only;
- short TTL (about 6h unless stricter guidance applies);
- cache the smallest useful result;
- normalized endpoint/parameter cache key;
- show `live` vs `cached` in the ledger;
- reserve calls for finalists and user mutations;
- never bulk-download/reconstruct Qloo data;
- allow `PERSIST_QLOO_DERIVED=false` as an immediate conservative switch.

Blocking compliance questions: permitted cache duration/type, permitted persistence of derived output/entity IDs, event quota/rate limits, and API-key validity through judging.

## 19. Reliability and Failure Semantics

Every phase is idempotent; every failure becomes state, not a hidden exception.

| Failure | Required behavior |
|---|---|
| Ambiguous address | Map picker; preserve brief. |
| Thin local Qloo data | Widen catchment; show the decision; evidence grade ≤B. |
| Missing component evidence | Hatched/unmeasured; never finalist. |
| Contradictory measurements | Mark contested; never average away. |
| HTTP 200 with zero useful results | Reformulate once; then `not measured`. |
| Qloo 429/5xx | Bounded backoff/retry; emit ledger state. |
| Unknown entity/tag from model | Reject before display. |
| Qloo outage | Stop at Prior/partial state; honest explanation; Retry. |
| Agent budget/wall-clock exhausted | Stop with best defensible state and explicit incomplete status. |
| Render cold start | Judge-safe loading state; health endpoint and warm-up workflow. |
| Snapshot expired | Say so; offer same-brief rerun. |

No silent fallback may manufacture evidence.

## 20. Resource Budgets and Runtime Controls

```text
LLM_BUDGET_USD = 2.00
MAX_QLOO_CALLS = 180 target; ≈200 hard ceiling until quota spike proves otherwise
QLOO_CONCURRENCY = 6–8 (default 6)
Planner turns per phase = ≤3
Mutation rounds = ≤2
Stress reserve = ≈30% of Qloo budget
Cache TTL = ≈6h, subject to Qloo guidance
```

Use `p-limit` for Qloo concurrency, an in-process token bucket for rate control, and bounded retries. Stop non-essential LLM work around 80% of the budget and preserve the final 20% for recovery/judge-path operations.

## 21. Security and Compliance Boundary

- Qloo and DeepSeek keys exist only in server secrets.
- Never expose credentials in frontend bundles, Git, logs, screenshots, MCP config, or README.
- Never call Qloo directly from the browser.
- Treat Qloo, MCP, DeepSeek, and user input as untrusted data.
- Validate all tool/state/result contracts with Zod.
- Sanitize model-authored Markdown/HTML before rendering.
- Redact secrets from Pino logs.
- Apply per-IP Express rate limiting.
- Do not send names, emails, device IDs, account IDs, location histories, or other personal data to Qloo.
- Do not use cultural affinity as an individual-level or high-impact decision mechanism.

## 22. Deployment Architecture

**Primary:** one Render Free Docker web service serving the built React application and Express API. This keeps frontend/backend same-origin and provides the long-lived Node process required by the Qloo MCP runtime.

```text
Render Web Service
├─ Node 22.19+
├─ Express API
├─ React/Vite static build
├─ DeepSeek client
├─ MCP SDK + qloo mcp
├─ QlooGateway
├─ Zorq deterministic engine
└─ Turso client
```

Map rendering is browser-side: `MapLibre GL JS → MapTiler Free`.

Do not move Qloo MCP into a serverless-only backend. Use Render health checks plus a public GitHub Actions scheduled `GET /healthz` warm-up as a best-effort reliability measure.

## 23. Testing Architecture

### Unit / deterministic tests

Test every formula and invariant independently:

- IDF suppression;
- cosine edges;
- coherence;
- exact percentile enumeration;
- distinctiveness;
- ranking/dial monotonicity;
- weakest-link selection;
- triangulation classification;
- evidence grade caps;
- constraint fit/downshift;
- Prior immutability;
- diff correctness;
- budget accounting.

### Integration tests

- Qloo MCP startup/capabilities;
- tag/entity resolution;
- representative end-to-end Qloo chain;
- explainability/rank fallback;
- 429/5xx behavior;
- zero-result behavior;
- cache policy;
- persistence-disabled mode.

### E2E / judge-path tests

Playwright must verify:

```text
landing → preset → Prior → S1 ledger → DNA → S2 → graph evidence
→ Challenge → Blueprint → Without-Qloo → share/print
```

Also test mobile graph fallback, browser refresh/resume, server reconnect, and failure-state honesty.

## 24. Build Gates Before UI Polish

A build gate failing means the corresponding product claim must not be shipped.

- **Gate A — Transport:** official Qloo MCP connects and one complete tool chain returns structured data.
- **Gate B — Resolution:** ≥80% of intended concepts resolve cleanly; otherwise switch to exemplar clustering.
- **Gate C — Edge quality:** graph relationships vary meaningfully and are not primarily popularity.
- **Gate D — Runtime:** real 6–8 concurrency run has acceptable p50/p90 and useful early output.
- **Gate E — Evidence:** affinity/explainability behavior is known; rank fallback works.
- **Gate F — Presets:** two genuinely divergent cases + one honest control.
- **Gate G — Compliance:** written Qloo guidance or conservative no-persist mode is active.

## 25. Judge-Proof Product Invariants

These are acceptance criteria, not aspirations:

1. **Prior Lock is real:** no Qloo evidence can mutate the stored Prior.
2. **Qloo changes behavior or honestly confirms:** the product never manufactures divergence.
3. **Every Qloo-backed claim is traceable:** UI claim → evidence ID → ledger event → measurement input.
4. **Every numeric metric is reproducible:** same Run state produces the same deterministic result.
5. **Agent choices are observable:** at least some decisions depend on preceding observations.
6. **The composition is a set:** role coverage and inter-component relationships are first-class.
7. **The graph has receipts:** shared entities, route, triangulation, and status are inspectable.
8. **The leader is challenged:** stress results can revise/replace it.
9. **Constraints change the format, not the evidence:** downshifts are explicit and preserve roles when possible.
10. **Uncertainty is visible:** thin/contested/unmeasured states are not hidden.
11. **The Blueprint stands alone:** a decision-maker can understand the output without the live run.
12. **Qloo removal test passes:** the app is materially weaker/different without Qloo cultural measurements.
13. **Fresh-clone reproducibility:** public repository setup/build/test instructions work from a clean checkout.
14. **Judge accessibility:** live app is externally hosted, free to test, no required account, and usable through the judging period.

## 26. Scope Protection

Do **not** add to the MVP merely for visual or technical spectacle:

- chat as the primary UI;
- authentication/accounts;
- payments/subscriptions;
- financial forecasting or success probabilities;
- listings marketplace/feed;
- general web-search layer;
- general-purpose vector database;
- second place database;
- multi-agent swarm;
- invented Qloo combination-scoring endpoint;
- Qloo trend claims unless explicitly revalidated and brought into scope;
- magical 0–100 ecosystem score.

The architecture should stay narrow enough that its evidence chain is stronger than its feature count.

## 27. Repository / Delivery Contract

Public repository must contain at minimum:

```text
README.md
ARCHITECTURE.md
LICENSE
.env.example
package.json
src/
tests/
method/ or /method implementation
architecture diagram
Qloo integration table
setup + deployment instructions
limitations
security notes
screenshots
judge path
```

CI on push: install → typecheck → lint → unit tests → build → E2E/smoke where appropriate. Scheduled public workflow: health-check `/healthz` without exposing secrets.

## 28. Final Architecture Statement

```text
USER BRIEF
   ↓
FROZEN LLM PRIOR
   ↓
QLOO SITE READ
   ↓
CULTURAL DNA
   ↓
EVIDENCE-BEARING CANDIDATE POOL
   ↓
DETERMINISTIC SHARED-CULTURE GRAPH
   ↓
EXACT COMPOSITION SEARCH + NULL MODEL
   ↓
PRIOR + THREE RIVALS
   ↓
TRIANGULATION + CHALLENGE-THE-PLAN
   ↓
CONSTRAINT / FORMAT FIT
   ↓
EVIDENCE-BOUND BLUEPRINT
   ↓
WITHOUT-QLOO PROOF + USER REVISION
```

**One sentence that protects the architecture:**

> **Zorq does not use Qloo to find a place; it uses Qloo to measure the cultural relationships that let an agent decide what should exist together—and it leaves the evidence trail showing why the plan changed.**

## 29. Source Register

- `Product Specification(4).md` — behavioral contract, measurements, screens, trust model, run state, interaction matrix.
- `Tools_and_Requirements.md` — locked stack, Qloo/MCP integration, budgets, persistence, reliability, security, deployment, CI.
- `Final_design(4).md` — visual grammar, UX staging, evidence presentation, accessibility, responsive behavior, judge experience.
- `Idea(4).md` — problem, Cultural Composition Engine, Qloo-centered workflow, Challenge the Plan, Blueprint concept.
- `Hackathon_details(2).md` — official requirements, judging model, Qloo dependency test, competition strategy, compliance and judge-facing proof.
- External decision-design context: Gary Klein's Recognition-Primed Decision model; Microsoft Research's 18 Human-AI Interaction Guidelines.

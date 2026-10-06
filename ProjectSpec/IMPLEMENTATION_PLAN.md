# ZORQ — Implementation Plan & Engineering Contract
**Document status:** LOCKED EXECUTION CONTRACT  
**Project:** Zorq — autonomous cultural composition agent for physical places  
**Contract version:** 1.0  
**Prepared:** 6 October 2026  
---
## 0. Purpose
This file is the **implementation contract for the entire Zorq build**. It is not a tutorial or a generic checklist. It defines the boundaries, execution behavior, phase outcomes, verification gates, and release conditions that every implementation agent must respect.
The implementation agent must use this contract together with the six supplied project documents:
1. `Product Specification(5).md` — behavioral/product source of truth.
2. `Architecture(2).md` — runtime architecture, ownership, state and recovery.
3. `Tools_and_Requirements(1).md` — locked stack, Qloo usage, limits, deployment and security.
4. `Final_design(5).md` — visual and interaction language.
5. `Hackathon_details(3).md` — competition rules, judging expectations and Qloo-indispensability standard.
6. `Idea(5).md` — product thesis and conceptual intent.
The source documents define **what Zorq is**. This file defines **how the implementation work is executed**.
### Contract hierarchy
When decisions appear to conflict, use this order:
1. Official Qloo/Devpost rules, legal and platform constraints.
2. Product Specification for product behavior.
3. Architecture for runtime boundaries and state ownership.
4. Tools & Requirements for stack and operations.
5. Final Design for visual/interaction behavior.
6. Idea for thesis and conceptual framing.
7. Local implementation judgment for details not specified above.
A deviation is allowed only when a real blocker exists. The agent must choose the smallest safe deviation, record why, preserve the product promise, and re-run the affected phase gate.
---
# 1. Product Contract
Zorq is **not a place recommendation feed**. It is:
> **Cultural composition intelligence for physical places.**
The unit of value is:
> **a set of components + the cultural relationships between them + evidence that the set belongs together here.**
The protected runtime flow is:
```text
Brief
  ↓
Frozen LLM Prior
  ↓
Qloo investigation
  ↓
Evidence
  ↓
Measured inter-component relationships
  ↓
Competing compositions
  ↓
Self-challenge
  ↓
Constraint adaptation
  ↓
Place Blueprint
```
The architectural truth is:
```text
Qloo      = cultural measurement
Zorq code = arithmetic, validation, graph/search, constraints, trust boundaries
Agent     = interpretation, probe selection, mutation and language
Blueprint = evidence-bearing decision artifact
```
The project must never collapse into:
```text
LLM → Qloo → recommendations
```
Removing Qloo must materially remove locality/cultural relationships, evidence paths, distinctiveness, or the Prior→Final change for the main judge story. An honest control case may show that Qloo confirms rather than redirects a prior.
---
# 2. Agent Operating Doctrine
The implementing AI is expected to operate like a highly capable senior engineering team: autonomous inside the contract, selective about actions, evidence-driven, and accountable for verification.
The preferred execution loop is:
```text
OBSERVE
  ↓
BUILD CURRENT-STATE MODEL
  ↓
FORM LOCAL PLAN / HYPOTHESIS
  ↓
EXECUTE HIGHEST-VALUE NEXT ACTION
  ↓
INSPECT RESULT
  ↓
VERIFY AGAINST CONTRACT
  ↓
CORRECT / REFINE
  ↓
COMMIT COHERENT INCREMENT
  ↓
REASSESS
```
Do not turn the implementation into a rigid script of microscopic instructions. The phase mission and exit gate are fixed; the internal route is adaptive.
## 2.1 Autonomous decisions expected
Inside the locked boundaries, the agent should autonomously decide:
- module/file decomposition;
- exact implementation technique;
- safe internal abstractions;
- ordering of independent work;
- which test gives the highest information value;
- which failure should be investigated first;
- whether an existing abstraction is sufficient;
- whether a refactor is justified;
- how to recover from recoverable failures;
- when to stop exploring an unproductive path;
- when the phase is actually ready to gate.
## 2.2 Decisions the agent may not redefine
The agent must not silently redefine:
- Zorq's product category;
- Qloo's role;
- the locked stack without a documented blocker;
- Prior Lock;
- deterministic ownership of numeric truth;
- provenance and evidence rules;
- Run state ownership;
- security boundaries;
- S0–S5 product journey;
- Challenge the Plan;
- Without-Qloo comparison;
- Place Blueprint;
- the free/public judge path;
- the Qloo-removal requirement.
---
# 3. Repository Mutation Contract
## 3.1 Existing-file-first
Before creating a file, search the repository for an existing owner of that responsibility. Before changing a file, understand its callers and current role.
Never create duplicate implementations merely because a new filename is convenient.
Forbidden pattern:
```text
component.ts
component2.ts
component-final.ts
component-final-v2.ts
```
when one canonical component can own the responsibility.
## 3.2 One source of truth
There must be one authoritative implementation for each major responsibility:
- Run state;
- Qloo gateway;
- deterministic measurement;
- evidence normalization;
- API contract;
- frontend projection of Run state;
- format library;
- environment configuration;
- phase state.
## 3.3 No fake production intelligence
Production paths may not depend on:
- hardcoded Qloo outputs;
- fake cultural entities;
- fabricated evidence IDs;
- canned final compositions;
- hardcoded scores/percentiles;
- preset-specific hidden answers;
- fake tool transcripts;
- fake delays used to imply work.
Test fixtures may use controlled data only when isolated from production execution.
## 3.4 No secrets in source
Never place Qloo, DeepSeek, Turso or other credentials in frontend code, Git, screenshots, logs, committed MCP configuration, or README files. `.env.example` contains placeholders only.
---
# 4. Global Engineering Rules
## 4.1 Deterministic truth boundary
The LLM may interpret data but cannot invent numeric truth.
### Code owns
- normalization and validation;
- graph edges;
- coherence;
- exact percentile;
- distinctiveness;
- ranking;
- weakest-link calculations;
- triangulation classification;
- constraint fit;
- budgets;
- Prior→Final diff.
### Agent owns
- Prior generation;
- anchor selection;
- probe selection;
- candidate interpretation;
- attack prioritization;
- mutation choice;
- bridge acceptance;
- constraint downshift wording;
- naming and narrative.
## 4.2 Evidence contract
Every Qloo-backed claim must trace through:
```text
UI claim
  ↓
Evidence ID
  ↓
Ledger event
  ↓
Measurement inputs
  ↓
Qloo tool/result path
```
Provenance badges:
```text
[Qloo]            direct Qloo-derived evidence
[Zorq heuristic]  deterministic product heuristic
[LLM]             interpretation, naming or summarization
```
Unknown evidence IDs never render as `[Qloo]`.
## 4.3 Uncertainty contract
Supported states include:
```text
measured
confirmed
contested
thin
not measured
incomplete
unavailable
```
Contradictory evidence is not averaged away. Thin evidence remains thin. Failed probes remain visible.
## 4.4 Bounded autonomy
Initial runtime limits are:
```text
Planner turns per phase: ≤3
Qloo target: ≤180 calls/run
Qloo hard ceiling: ≈200 until quota spike validates otherwise
Qloo concurrency: 6–8; default 6
Mutation rounds: ≤2
Stress reserve: ≈30% of Qloo budget
LLM budget: $2.00/run ceiling
Stop non-essential LLM work: ~80% budget
Wall-clock: bounded; return best defensible state
```
Only measured integration evidence may justify tuning these values.
## 4.5 Recovery
Every phase must be idempotent and resumable. A failure becomes visible state, not a hidden exception.
---
# 5. Global Git Contract
Git history is part of the engineering evidence.
## 5.1 Commit format
Use a Conventional Commit-style prefix and keep the message to one clear sentence.
Examples:
```text
feat: add the production Qloo gateway boundary.
feat: implement exact composition percentile scoring.
fix: replay authoritative Run state after SSE reconnect.
test: cover contradictory evidence grading.
refactor: isolate deterministic measurement kernels.
docs: establish the implementation contract.
chore: harden the public deployment health check.
```
Avoid vague messages such as `update`, `changes`, `final`, `done`, or `stuff`.
## 5.2 Commit cadence
Each phase should normally produce **2–6 meaningful commits**, depending on complexity. Commit after a coherent verified increment, not after arbitrary file edits.
Do not create meaningless commits merely to inflate history. Do not commit a broken state unless it is an intentionally scoped documentation/infrastructure checkpoint.
Before every commit, verify scope, tests, build state, accidental file changes, and contract alignment.
---
# 6. Universal Phase Execution Protocol
For every phase:
```text
1. Reconstruct current repository state.
2. Read the phase contract and affected source documents.
3. Identify the highest-risk/highest-value missing capability.
4. Implement a coherent vertical slice.
5. Validate it locally.
6. Inspect integration effects.
7. Commit the coherent increment.
8. Reassess remaining uncertainty.
9. Repeat until the exit gate passes.
10. Record phase state without rewriting this contract.
```
Mutable progress belongs in `IMPLEMENTATION_STATE.md`.
---
# PHASE 1 — CONTRACT, RECONNAISSANCE & BUILD CONTROL
## Mission
Convert the supplied project documents into a repository-level execution contract before substantial product coding begins.
## Agent work
Inspect the real repository and determine what already exists. Do not assume an empty repository and do not recreate existing work.
Create/update only what is necessary, especially:
```text
IMPLEMENTATION_PLAN.md     ← locked contract
AGENTS.md                  ← concise agent operating rules
IMPLEMENTATION_STATE.md    ← mutable progress and decisions
```
## Establish these contracts
### Repository map
Define ownership for:
```text
frontend
backend
agent
qloo
engine
evidence
orchestrator
persistence
tests
deployment
docs
```
### Canonical Run state
Lock the state tree:
```text
Run
├─ Brief
├─ Prior [WRITE-ONCE]
├─ SiteRead
├─ CulturalDNA
├─ CandidatePool
├─ Neighborhoods
├─ Graph
├─ Compositions
├─ StressReport
├─ ConstraintFit
├─ Revisions
├─ Evidence
└─ LedgerEvents
```
### API surface
Define one canonical endpoint contract for at least:
```text
GET  /healthz
POST /api/runs
GET  /api/runs/:id
GET  /api/runs/:id/events
POST /api/runs/:id/stop
POST /api/runs/:id/unpin-anchor
POST /api/runs/:id/replace
POST /api/runs/:id/challenge
POST /api/runs/:id/recompute
GET  /api/runs/:id/blueprint
GET  /api/method
```
If the existing repository uses an equivalent route contract, preserve it rather than creating a second API family.
Every route needs a request schema, response schema, error semantics, security boundary and tests.
### Qloo contract
Record the real capabilities required:
- capabilities/startup;
- entity/place search;
- tag resolution;
- locality/heatmap;
- anchor discovery;
- place→culture;
- culture→place;
- candidate validation;
- taste neighborhoods;
- bridge;
- replace;
- triangulation;
- explainability where supported.
### UI contract
Lock:
```text
/
/run/:id        investigate | compositions | graph | stress | blueprint
/run/:id/blueprint
/method
```
Lock Prior-before-Qloo, Agent Ledger, provenance badges, Field, graph evidence, Challenge, Blueprint, Without-Qloo, responsive fallbacks and accessibility behavior.
## Resolve high-risk unknowns early
Prioritize investigation of:
- actual Qloo MCP behavior;
- authentication and credential lifetime;
- returned field shapes;
- quota/rate limits;
- cache/storage rules;
- DeepSeek tool calling;
- deployment constraints.
Do not spend the phase polishing low-risk details while high-risk integration assumptions remain unknown.
## Exit gate
The repo has one implementation path, clear responsibility owners, defined API/state contracts, visible unresolved blockers, defined phase gates, and no plausible ambiguity about what Zorq is.
## Suggested commits
```text
docs: establish the Zorq implementation contract.
docs: define runtime, API, state and repository boundaries.
docs: record implementation risks and phase exit gates.
```
## Do not drift into
UI polish, extra product features, authentication, payments, generic search, multi-agent frameworks, financial systems or unrelated infrastructure.
---
# PHASE 2 — REPOSITORY FOUNDATION & TYPED RUNTIME
## Mission
Build the smallest real executable foundation that supports every later phase without architectural rework.
## Implement
- React + Vite + TypeScript;
- Node.js 22.19+;
- Express + TypeScript;
- shared Zod contracts;
- configuration loader;
- Pino logging;
- typed error model;
- Helmet and rate limiting;
- route registration;
- npm scripts;
- Vitest;
- Playwright;
- Docker;
- environment contract;
- production build path.
Implement a real:
```text
GET /healthz
```
Keep the same-origin production target:
```text
Render Node service
├── Express API
├── React build
├── agent controller
├── Qloo MCP runtime
├── deterministic engine
└── Turso client
```
## Agent behavior
Do not create fake business logic just to make the folder tree look complete. Create real boundaries and fail clearly where downstream capability has not yet been implemented.
## Exit gate
A fresh checkout installs, typechecks, lints, tests, builds, starts, responds to `/healthz`, and fails clearly when required configuration is absent.
## Suggested commits
```text
feat: establish the typed full-stack runtime foundation.
feat: add shared Zod contracts and server error boundaries.
test: verify repository bootstrap and health endpoint behavior.
```
---
# PHASE 3 — REAL QLOO + DEEPSEEK AGENT CORE
## Mission
Prove the highest-risk intelligence path against the real services before the rest of the product depends on assumptions.
## Qloo gateway
Implement `QlooGateway` using the official Qloo MCP/harness path and MCP SDK, with the transport-agnostic fallback retained for diagnostics.
The gateway must guard known failure cases and hide raw transport details from the rest of the application.
Required surfaces include the capabilities needed for startup, search, tags, insights, describe/entity inspection, ranking/recommendation, bridge, replacement and triangulation. Only expose what the current run genuinely needs.
## DeepSeek agent
Implement one bounded tool-calling controller:
```text
OBSERVATION
↓
STATE DIAGNOSIS
↓
NEXT ACTION
↓
TOOL CALL
↓
VALIDATE RESULT
↓
UPDATE RUN + LEDGER + EVIDENCE
↓
OBSERVATION
↺ bounded
```
No LangChain, CrewAI, AutoGen, Mastra or multi-agent swarm unless a proven blocker makes the locked architecture impossible.
## Prior Lock
Implement:
```text
Brief
 ↓
LLM-only Prior
 ↓
Persist once
 ↓
qlooUsed=false
 ↓
immutable original Prior
```
No Qloo call may occur before the stored Prior exists.
## Autonomous probe behavior
The agent should adapt based on observations:
- thin site data → widen scale;
- weak edge → consider bridge;
- uncertain evidence → triangulate;
- unresolved concept → tag/entity resolution;
- replacement → role-preserving search;
- budget pressure → reserve calls for decision-critical probes.
This behavior must be real, not a fixed script with an LLM narrator.
## Exit gate
A real brief produces a Prior, at least one real Qloo observation, a validated state mutation, a ledger event and an evidence record. Qloo outage yields an honest partial state.
## Suggested commits
```text
feat: connect the production Qloo gateway through MCP.
feat: add the bounded DeepSeek tool-calling controller.
feat: enforce write-once Prior Lock and validated agent state.
test: cover live Qloo failures and malformed model output.
```
---
# PHASE 4 — DETERMINISTIC CULTURAL MEASUREMENT ENGINE
## Mission
Turn Qloo-derived observations into reproducible cultural composition mathematics.
## Implement
### Candidate pool
Approximately 8–10 components, each with:
```text
role
tags
≤5 local exemplars
provenance path
evidence state
```
Required provenance path:
```text
local anchor
↓
Qloo entity/tag signal
↓
resolved category/role
↓
exemplar set
↓
taste neighborhood
```
### Taste neighborhoods
Build artist/movie/brand neighborhoods, using returned affinity when available and `1/rank` as fallback where necessary. Normalize deterministically.
### IDF suppression
Implement:
```text
IDF_e = ln(K / (1 + component_count_containing_e))
```
floored at zero.
### Shared-culture edge
Implement:
```text
edge(j,k) = cosine(IDF · N_j, IDF · N_k)
```
Internal decimals are not presented as universal truth; UI uses relative bands.
### Composition mathematics
Implement:
- mean pairwise coherence;
- exact percentile over all valid equal-size role-valid subsets;
- weakest link as minimum edge;
- local-vs-city distinctiveness;
- deterministic `Familiar ↔ Distinctive` reranking;
- finalist triangulation: confirmed/contested/thin;
- evidence grade caps.
Do not calculate any of these with the LLM.
## Verification
Unit-test each formula with hand-worked cases and edge conditions. Prove deterministic repeatability from identical normalized inputs.
## Exit gate
A controlled candidate pool can produce a complete graph, ranked role-valid compositions, percentile, distinctiveness, weakest links and evidence classifications without LLM-generated numbers.
## Suggested commits
```text
feat: implement deterministic cultural neighborhood construction.
feat: add IDF-weighted shared-culture graph scoring.
feat: implement exact null-model composition percentiles.
feat: add distinctiveness ranking and triangulation logic.
test: prove deterministic scoring and edge-case behavior.
```
---
# PHASE 5 — ORCHESTRATOR, DURABLE STATE, SSE & RECOVERY
## Mission
Turn the intelligence core into a resilient autonomous runtime that can stop, resume and recover.
## Implement
### Durable Run state
Persist Zorq-owned application state in Turso. Do not make raw Qloo persistence a product dependency.
### Orchestration
Implement:
- phase sequencing;
- idempotency;
- resume;
- stop/cancellation;
- bounded retries;
- call budgets;
- concurrency control;
- wall-clock cap;
- best-so-far state.
### Ledger
Every meaningful operation should yield enough information to make work inspectable:
```text
Qloo / Compute / LLM
action
plain-language summary
request/endpoint summary
timing
live/cached status
result count
status
evidence references
```
Never use “AI is thinking…” as a substitute for actual work.
### SSE
The pattern is:
```text
POST create run
→ SSE events
→ durable Run state
→ reconnect
→ replay current state
```
The client must tolerate missing individual events and reconstruct truth from authoritative Run state.
### Cache and quota
Implement normalized cache keys, conservative in-memory TTL, live/cached visibility and finalist call reservation. Honor any stricter written Qloo guidance immediately.
### Failure states
Implement explicit behavior for:
- ambiguous address;
- thin data;
- missing evidence;
- contradiction;
- HTTP 200 with zero useful results;
- 429;
- 5xx;
- unknown entity/tag;
- LLM budget exhaustion;
- Qloo outage;
- Render cold start;
- snapshot expiry;
- interrupted run.
## Exit gate
A run can be stopped, refreshed, disconnected, reconnected, retried or resumed without corrupting state, duplicating effects or fabricating completion.
## Suggested commits
```text
feat: add durable Run orchestration with resumable phases.
feat: stream real ledger and evidence events over SSE.
feat: add bounded retries, budgets and cancellation semantics.
fix: replay authoritative Run state after SSE reconnects.
test: cover resume, interruption and partial failure recovery.
```
---
# PHASE 6 — FRONTEND S0/S1: BRIEF, PRIOR & INVESTIGATION
## Mission
Build the first half of the judge experience so the product explains itself immediately.
## S0
Implement:
- address/place search;
- MapLibre map;
- area sq ft;
- objective;
- constraints;
- admired places;
- three presets;
- “Investigate this site”;
- `/method` entry.
Presets are input briefs only. Two should demonstrate genuine Qloo divergence and one should honestly confirm the Prior.
## Prior reveal
After submission:
```text
create Run
→ generate LLM-only Prior
→ store/lock Prior
→ reveal Prior
→ begin Qloo investigation
```
The first visual question for the judge should be: **will evidence change the guess?**
## S1
Build:
- persistent map;
- heat/locality layer where available;
- site marker and radius;
- anchor pins;
- Agent Ledger;
- Cultural DNA;
- frozen Prior card.
The ledger uses specific work descriptions, never generic progress text.
## Visual contract
Preserve the Final Design language:
- black ink on white;
- architectural drawing grammar;
- real evidence imagery only;
- evidence colour only for real cultural evidence;
- no decorative gradients or neon SaaS chrome;
- accessible focus states;
- reduced-motion equivalent;
- no color-only meaning.
## Exit gate
A judge can land, choose a preset, see the Prior, watch real investigation, and understand what Qloo is doing without reading the source code.
## Suggested commits
```text
feat: build the Zorq brief and site-entry experience.
feat: reveal the immutable pre-Qloo Prior in the live workspace.
feat: build the evidence-driven investigation ledger and map.
test: cover judge-path entry and degraded S1 states.
```
---
# PHASE 7 — S2/S3: COMPOSITIONS, FIELD, GRAPH & EVIDENCE
## Mission
Make the cultural composition engine technically inspectable and visually memorable.
## S2
Show:
```text
Prior
Composition A
Composition B
Composition C
```
Expose:
- role structure;
- coherence percentile;
- distinctiveness;
- weakest link;
- evidence grade.
Never show a magical 0–100 ecosystem score.
Use the Field/percentile visualization from Final Design to make the relative ranking understandable.
## Re-inking
Use the product's signature motion:
```text
dashed Prior
→ evidence arrives
→ lines re-ink
→ additions draw in
→ removals are struck
```
Reduced motion must show the same result statically.
## S3
Build a controlled semantic graph:
```text
nodes = components
edges = shared culture
```
Edge inspection exposes:
- two components;
- shared cultural entities;
- measurement route;
- triangulation status;
- ledger references.
Provide the sorted edge-list fallback when the viewport is narrow or the graph would become a hairball.
## Evidence drawer
Implement:
```text
claim
→ provenance badge
→ entities
→ measurement route
→ computation summary
→ ledger links
```
## Replace
Implement role-preserving replacement with:
- alternatives;
- coherence effect;
- distinctiveness effect;
- weakest-link effect;
- optional custom candidate;
- bounded Qloo calls;
- revision history.
## Exit gate
A judge can answer **“why do these components belong together?”** by inspecting an edge rather than trusting an unsupported narrative.
## Suggested commits
```text
feat: build composition comparison and percentile Field.
feat: add semantic composition graph with evidence inspection.
feat: implement role-preserving replacement and revisions.
feat: add evidence drawer with ledger-linked provenance.
test: verify composition ranking, graph evidence and replacement flows.
```
---
# PHASE 8 — S4/S5: CHALLENGE, CONSTRAINT FIT & BLUEPRINT
## Mission
Complete Zorq's decisive trust loop and deliver the professional decision artifact.
## S4 — Challenge the Plan
The agent chooses attack order from current diagnostics.
Available attack families:
```text
ablation
substitution
bridge insertion
catchment shift
rival composition sweep
```
Spend scarce Qloo calls where they can change a decision.
Final verdict must be one of:
```text
Survived
Revised
Replaced
```
A failed probe stays visible and can cap evidence quality.
## Mutation
Allowed operators:
```text
Bridge
Swap
Drop
Shift-scale
```
Maximum two mutation rounds.
Stop when the leader survives and no mutation improves coherence by more than ε, or when mutation/resource limits are reached. Return the best defensible state.
## Constraint engine
Implement the format library and rules:
```text
total footprint ≤85% of available area by default
apply hours/noise constraints
downshift format before dropping a role when practical
preserve role explicitly
```
Example:
```text
Cinema → Micro-screening
role preserved: Anchor
```
Footprint/hour rules are `[Zorq heuristic]` and must remain documented/editable in `/method`.
## S5 — Blueprint
The final artifact contains:
1. title;
2. rationale;
3. role-based composition;
4. evidence receipts;
5. site fit;
6. hours/noise fit;
7. What Qloo changed;
8. risks;
9. weak links;
10. evidence grade;
11. revision history;
12. method link;
13. share;
14. Copy as Markdown;
15. print/save PDF.
## Without-Qloo
Compare:
```text
Frozen Prior + LLM-only polish
vs
Final
```
Differences must be real. If there is no difference:
> “Here, the evidence changed nothing.”
Do not manufacture divergence.
## Shareable Blueprint
`/run/:id/blueprint` is a read-only snapshot that stands alone as a decision artifact.
## Exit gate
A complete run produces a professional Blueprint understandable without watching the agent work.
## Suggested commits
```text
feat: implement autonomous Challenge the Plan stress testing.
feat: add deterministic constraint fitting and format downshifts.
feat: build the evidence-backed Place Blueprint.
feat: add honest Without-Qloo comparison and shareable snapshots.
test: verify stress verdicts, constraints and blueprint provenance.
```
---
# PHASE 9 — FULL-SYSTEM INTEGRATION, DEPLOYMENT & JUDGE READINESS
## Mission
Turn the implementation into a public, reliable, self-explanatory submission candidate.
## Full path
```text
Landing
→ preset
→ Prior
→ S1 investigation
→ DNA
→ S2 compositions
→ S3 graph evidence
→ S4 Challenge
→ S5 Blueprint
→ Without-Qloo
→ Share / Print
```
## Deployment
Primary:
```text
Render Free Docker web service
```
Use one same-origin service for React + Express + agent + Qloo MCP + deterministic engine, with Turso persistence.
Do not move the Qloo MCP runtime into a serverless-only backend.
## CI
On push:
```text
install
→ typecheck
→ lint
→ unit tests
→ build
→ browser smoke where appropriate
```
For judge readiness, maintain a scheduled public `/healthz` check without exposing secrets.
## README
Above the fold must communicate:
- problem;
- solution;
- live URL;
- screenshot;
- setup;
- Qloo integration;
- why Qloo is indispensable;
- architecture;
- local run;
- deployment;
- method;
- limitations;
- security;
- license;
- judge path.
## `/method`
Document exactly:
- what Qloo measures;
- what Zorq computes;
- what the agent decides;
- formulas;
- heuristics;
- evidence grades;
- known limitations;
- open-source setup.
## Qloo-removal proof
Run the same brief under:
```text
A = Zorq + Qloo
B = Zorq without Qloo cultural evidence
```
Compare component membership, ordering, graph relationships, rationale, evidence and final blueprint.
Do not maximize divergence artificially. Demonstrate genuine dependency.
## Exit gate
A fresh judge can open the public URL and reach a meaningful result without login, private credentials, hidden developer intervention or a fabricated data layer.
## Suggested commits
```text
chore: harden production deployment and health checks.
docs: complete judge-facing README and method documentation.
test: add the complete public-path browser smoke suite.
chore: verify repository and submission surfaces.
```
---
# PHASE 10 — RED TEAM, EXCEPTIONAL HANDLING & FINAL VERIFICATION
## Mission
This phase is the final release gate. The goal is not to add features. The goal is to prove that the built system is real, coherent, resilient, reproducible, non-fabricated and judge-ready.
**No feature enters this phase unless it directly fixes a release-blocking defect.**
## 10.1 Repository integrity
Search the entire repository for:
```text
TODO
FIXME
mock
fake
stub
placeholder
dummy
hardcoded
bypass
debug
secret
```
Classify every result. Remove or isolate production defects.
## 10.2 Hardcode audit
Prove that:
- Qloo data comes from Qloo transport;
- DeepSeek output comes from DeepSeek;
- map data comes from the configured provider;
- compositions are computed from current Run data;
- graph edges are deterministic;
- percentiles are calculated from the actual candidate pool;
- evidence IDs come from actual evidence;
- Prior is generated at run start;
- Without-Qloo is truly tool-free;
- presets seed briefs rather than final answers.
A production path that succeeds when all external providers are unavailable is suspicious and must be investigated.
## 10.3 API verification
For **every** endpoint:
```text
request validation
→ security boundary
→ business logic
→ persistence
→ response schema
→ error schema
→ idempotency where relevant
→ logging
→ no secret leakage
```
Verify at minimum:
```text
GET  /healthz
POST /api/runs
GET  /api/runs/:id
GET  /api/runs/:id/events
POST /api/runs/:id/stop
POST /api/runs/:id/unpin-anchor
POST /api/runs/:id/replace
POST /api/runs/:id/challenge
POST /api/runs/:id/recompute
GET  /api/runs/:id/blueprint
GET  /api/method
```
A route is not complete merely because the frontend invokes it once.
## 10.4 Qloo verification
Exercise the real capability chain and known failure cases, including:
- MCP startup;
- credentials;
- search/tag resolution;
- locality;
- place→culture;
- culture→place;
- candidate validation;
- neighborhoods;
- bridge;
- replacement;
- triangulation;
- explainability fallback;
- zero useful results;
- `take > 50` protection;
- invalid location/type combinations;
- 429 and 5xx.
The interface must tell the truth for every failure.
## 10.5 Agent behavior audit
Run multiple representative briefs and inspect whether the agent:
- selects tools appropriately;
- responds to observations;
- changes course when evidence changes;
- identifies weak edges;
- selects useful attacks;
- respects budgets;
- avoids recursive loops;
- rejects unknown entities;
- preserves Prior Lock;
- never fabricates evidence;
- returns best-so-far on resource exhaustion.
The tool sequence should be observation-dependent, not a fixed script.
## 10.6 Deterministic reproducibility
For identical saved Run inputs and normalized Qloo-derived measurement inputs:
```text
graph = same
coherence = same
percentile = same
distinctiveness = same
weakest link = same
constraint fit = same
diff = same
```
Any unexpected nondeterminism must be explained and, where possible, removed.
## 10.7 Chaos/recovery audit
Intentionally interrupt:
- Qloo call;
- DeepSeek call;
- SSE stream;
- browser tab;
- server process;
- database write;
- cold start;
- stress probe;
- candidate enrichment;
- final evidence call.
Verify:
```text
no corrupted Run
no duplicate phase effects
no duplicate revisions
no lost Prior
no broken evidence references
no fake completion
no hidden failure
```
Resume from durable state.
## 10.8 UI truth audit
Inspect every screen for:
- correct provenance badge;
- no unsupported Qloo claim;
- no fake score;
- correct uncertainty semantics;
- accessible focus;
- reduced-motion equivalent;
- narrow-screen graph fallback;
- readable evidence;
- working browser-back behavior;
- no dead-end loading;
- no stale client state overriding server truth.
## 10.9 Security audit
Verify:
- Qloo key server-side only;
- DeepSeek key server-side only;
- no secrets in Git;
- no secrets in browser source;
- logs redacted;
- Helmet active;
- rate limiting active;
- model output sanitized;
- user input validated;
- Qloo/MCP/model output treated as untrusted;
- no unnecessary personal data sent to Qloo.
## 10.10 Performance and budget audit
Measure real:
- Qloo p50/p90;
- time to Prior;
- time to first useful evidence;
- time to compositions;
- Qloo call count;
- concurrency;
- LLM usage;
- cache hit rate;
- retry frequency.
Verify:
```text
LLM budget ≤ $2.00
Qloo target ≤180
Qloo hard ceiling ≈200
concurrency ≤8
planner turns ≤3/phase
mutation rounds ≤2
```
Useful partial progress must appear before full completion.
## 10.11 Public judge-path audit
Run Playwright against the deployed application:
```text
landing
→ preset
→ submit
→ Prior
→ investigation
→ DNA
→ compositions
→ graph
→ evidence
→ Challenge
→ Blueprint
→ Without-Qloo
→ share
→ refresh
→ resume
```
Also test:
```text
mobile width
keyboard navigation
reduced motion
slow network
reconnect
cold start
Qloo failure
DeepSeek failure
```
## 10.12 Final submission audit
Verify:
```text
public repo
public live URL
LICENSE
README
architecture
method
setup instructions
deployment instructions
screenshots
limitations
security notes
working /healthz
working judge path
no login
no secrets
truthful Git history
```
## 10.13 Final release gate
The project may be called **judge-ready** only when all of the following are true:
### Product
- Zorq is clearly cultural composition intelligence.
- Place Blueprint is the output.
- Prior Lock is real.
- Challenge is real.
- Without-Qloo is honest.
- user corrections work.
### Qloo
- Qloo is used meaningfully throughout the workflow.
- Qloo evidence is real and traceable.
- Qloo removal materially weakens the system.
- no fabricated Qloo behavior exists.
### Agent
- the agent observes and adapts;
- tool choice can change with state;
- autonomy is bounded;
- failures become state;
- budgets are respected.
### Determinism
- numeric outputs are reproducible;
- graph mathematics is deterministic;
- constraint fitting is deterministic;
- evidence grades obey their rules.
### UX
- the product teaches itself;
- no required narration;
- no dead-end loading states;
- visual system matches the final design;
- accessibility fallbacks work.
### Reliability
- refresh/resume works;
- SSE reconnect works;
- partial failure works;
- Qloo outage is honest;
- budget exhaustion is honest;
- best-so-far state is usable.
### Engineering
- typecheck passes;
- lint passes;
- unit tests pass;
- integration tests pass;
- E2E passes;
- production build passes;
- deployment is live;
- health check is healthy.
### Repository
- no unexplained duplicates;
- no production mocks;
- no hardcoded final answers;
- no secrets;
- no debug artifacts;
- no accidental duplicate critical paths;
- Git history is professional and truthful.
---
# 7. Global Definition of Done
A task is not done because code exists.
It is done when:
```text
IMPLEMENTED
+
INTEGRATED
+
VALIDATED
+
OBSERVED IN REAL RUNTIME
+
TRACEABLE
+
DOCUMENTED WHERE NECESSARY
+
COMMITTED
```
A phase is not done because its files exist. The **exit gate** must pass.
The project is not done because the happy path works. It is done when unhappy paths are trustworthy.
---
# 8. Global Do-Not-Drift Rules
Do not add to MVP scope:
- authentication;
- payments or subscriptions;
- financial forecasting;
- real-estate listings feeds;
- generic web-search infrastructure;
- general-purpose vector database;
- multi-agent swarm;
- unnecessary orchestration frameworks;
- success probabilities;
- magical 0–100 ecosystem scores;
- trend claims;
- a second place database;
- decorative AI features;
- fake data systems;
- unnecessary service separation.
A feature should enter only when it materially strengthens:
```text
cultural evidence
→ composition
→ relationship measurement
→ challenge
→ blueprint
```
Anything outside that chain is presumed out of scope until proven necessary.
---
# 9. Ambiguity / Decision Framework
When an implementation decision is not explicitly specified:
1. Identify the user/product problem being solved.
2. Determine which source owns the decision.
3. Choose the smallest change that preserves the architecture.
4. Prefer a real spike/test/runtime observation over assumption.
5. Continue independent work when the uncertainty is peripheral.
6. Prefer reversible changes when uncertainty remains.
7. Define how the change will be verified before calling it complete.
The agent should not ask for clarification merely because a reasonable engineering choice exists inside the contract. It should make the decision, record material deviations, and continue.
---
# 10. Research-Informed Agent Principles
The execution model is intentionally based on current agent-engineering patterns:
### Reasoning + action
Interleaving reasoning with tool actions allows the agent to update its plan from observations rather than committing to one speculative plan up front.
### Feedback-driven refinement
Reflection is valuable when grounded in concrete feedback. Zorq's feedback signals are failed probes, weak links, stress results, evidence disagreements, test failures and runtime traces.
### Simple composable systems
Keep the agent architecture simple and explicit. Complexity should live in Zorq's evidence/measurement model, not in framework count.
### Evaluation during development
Use representative traces, deterministic graders, unit tests, integration tests and browser-path tests during construction rather than treating evaluation as a final ceremony.
### Traceability
The Agent Ledger, Evidence IDs, Run state, decisions and Git history are the project's operational memory.
### Guarded autonomy
The agent chooses the next useful action within boundaries established by schemas, budgets, state ownership, security controls and phase gates.
---
# 11. Final Operating Principle
> **Autonomy inside a contract, intelligence inside evidence, arithmetic inside deterministic code, and every important decision observable enough to verify.**
The agent should not behave like a typist waiting for the next instruction. It should behave like the engineer accountable for the phase:
```text
understand the system
→ identify the real bottleneck
→ make the smallest high-value change
→ test it
→ inspect what changed
→ challenge the result
→ commit the coherent increment
→ continue until the phase gate is genuinely satisfied
```
Never confuse activity with progress.
Never confuse confidence with evidence.
Never confuse a plausible implementation with a verified implementation.
Never confuse a working happy path with a finished system.
---
# 12. Phase Completion Record
At the end of each phase, update `IMPLEMENTATION_STATE.md`:
```text
Phase:
Status:
Completed capabilities:
Tests passing:
Known limitations:
Decisions made:
Deviations from contract:
Next phase readiness:
Last verified commit:
```
Do not rewrite this contract merely to make the implementation appear compliant.
---
# 13. Final Release Declaration
The final release candidate is the following chain proven in real runtime:
```text
REAL QLOO
+
REAL DEEPSEEK
+
REAL DETERMINISTIC MEASUREMENT
+
REAL AGENT ADAPTATION
+
REAL DURABLE RUN STATE
+
REAL SSE
+
REAL RECOVERY
+
REAL FRONTEND
+
REAL BLUEPRINT
+
REAL PUBLIC DEPLOYMENT
+
REAL TESTS
+
REAL EVIDENCE
=
ZORQ
```
No component in that equation may be replaced by a visually convincing imitation.

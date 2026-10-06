# ZORQ — Tools & Requirements Master Build Sheet

**Purpose:** lock the practical stack, services, packages, operational requirements, Qloo usage, cost ceiling, and judge-period reliability plan for Zorq.

**Decision priority:** (1) $0 + no credit card + fit, (2) $0 tier + no card + survives judging, (3) paid only when necessary, maximum **$2** out-of-pocket.  
**LLM:** DeepSeek V4-family API only, with `deepseek-flash` as the preferred current model name.

## 1. Non-negotiable product/hackathon requirements

Zorq must be a working, externally hosted, free-to-test agentic application using Qloo. The judging criteria are equally weighted across Technological Implementation, Design, Potential Impact, and Quality of Idea. Submission requires a functional demo, public repository, open-source license, and text description. The live project must remain accessible free of charge through the judging period.

Zorq's protected abstraction is **cultural composition intelligence**, not place recommendation: brief → frozen LLM prior → Qloo investigation → evidence → measured inter-component relationships → competing compositions → self-challenge → constraint fit → Place Blueprint.

Product source of truth: Product Specification v1. The design system is intentionally monochrome architectural-drawing language; evidence colour is reserved for real cultural evidence. The Idea file is the conceptual foundation; where it conflicts with the Product Specification, the specification wins.

## 2. Final stack decision

| Area | Locked choice | Cost | Why |
|---|---|---:|---|
| Frontend | **React + Vite + TypeScript** | $0 | Fast, transparent, easy static build; no framework/server coupling |
| Backend | **Node.js 22.19+ + Express + TypeScript** | $0 | Matches Qloo MCP requirement; simple SSE and same-origin API |
| Qloo integration | **Official `@qloo/qloo-harness` + `qloo mcp` + `@modelcontextprotocol/sdk`** | $0 | Official event path; exposes validated Qloo workflows to the agent |
| LLM | **DeepSeek `deepseek-flash`** | small paid | Current V4.1-Flash; legacy V4-Flash routes here; current V4-Pro requests also route to V4.1-Flash at Flash rates |
| LLM SDK | **OpenAI Node SDK configured for DeepSeek** | $0 | DeepSeek is OpenAI-compatible; avoids a second framework |
| Validation | **Zod** | $0 | Typed tool/state/result contracts |
| State | **Zustand** | $0 | Small client state layer; avoids Redux complexity |
| Map | **MapLibre GL JS + MapTiler Free** | $0 | Open map renderer + one provider for vector tiles and geocoding |
| Graph | **Custom SVG + CSS** | $0 | Avoids a generic graph library and prevents force-graph hairballs |
| Database | **Turso/libSQL Free** | $0 | Persistent run/blueprint metadata without introducing a full backend platform |
| Cache | **`lru-cache` + in-process token bucket** | $0 | Simple, fast; preserves Qloo quota |
| Concurrency | **`p-limit`** | $0 | Cap Qloo concurrency around 6–8 without queue-framework overhead |
| Logging | **Pino** | $0 | Structured server logs; Render logs are enough for judging |
| Security | **Helmet + `express-rate-limit`** | $0 | Minimal production hardening |
| Testing | **Vitest + Playwright** | $0 | Unit/scoring tests + judge-path browser tests |
| Quality | **ESLint + Prettier + TypeScript strict** | $0 | Prevent drift and regressions |
| CI | **GitHub Actions** | $0 for public repo | Tests, build checks, scheduled health ping |
| Hosting | **Render Free Web Service, Docker** | $0 | Long-lived Node/container backend compatible with Qloo MCP; no credit card required |
| License | **MIT** | $0 | Simple and clearly detectable on GitHub |

## 3. Why Render is the primary host

Qloo's current official hackathon kit says the canonical `qloo mcp` server runs as a local/backend process, requires Node.js 22.19+ and `QLOO_API_KEY`, and explicitly says serverless functions are not a supported deployment route. Therefore **do not put the Qloo MCP runtime on Cloudflare Workers, Vercel Functions, Netlify Functions, or another serverless-only backend**.

Render Free supports normal Node web services and Docker. Free services receive 750 instance-hours per workspace per calendar month and spin down after 15 minutes without traffic, taking about a minute to wake. The free tier does not require a credit card. Starting the service on **20 Oct 2026** gives 288 hours in October and 384 hours in Nov 1–16: both are below 750. Even starting on Oct 6 remains below the monthly October allowance.

Reliability tactic: add a public-repository GitHub Actions scheduled health ping every 10 minutes to `/healthz`. Public-repository standard runners are free; scheduled workflows support intervals as short as five minutes. Treat this as a best-effort warm-up, not a guarantee against infrastructure incidents.

## 4. Database decision

Use Turso only for **our own application state and sanitized blueprint snapshots**. Do not store raw Qloo responses unless Qloo explicitly permits it.

Recommended tables:

- `runs`: id, brief, status, prior_json, final_json, evidence_grade, created_at, expires_at
- `ledger_events`: run_id, event_id, kind, label, summary, duration_ms, qloo_tool_name, cache_state, result_count
- `evidence`: evidence_id, run_id, claim_type, entity_ids, summary, computation_ref

Design the persistence layer so `PERSIST_QLOO_DERIVED=false` can disable storage immediately if organizer guidance is restrictive. Never make the product depend on long-term raw-response storage.

## 5. Qloo: use it everywhere that creates genuine value

### Core Qloo surface

1. **Startup:** `qloo_capabilities` — verify the MCP runtime and credential before a run.
2. **Brief autocomplete:** Qloo search — resolve admired places/entities to canonical IDs.
3. **Category semantics:** `qloo_find_tags` → confirm with `qloo_describe`/entity inspection. Never invent tag URNs.
4. **Site read:** locality/heatmap queries → identify cultural concentration and local anchors.
5. **Anchor discovery:** place insights near the target.
6. **Place → culture:** use local place entity IDs as taste signals to retrieve artists, movies and brands.
7. **Culture → place:** use discovered cultural entities as signals to retrieve candidate place categories.
8. **Candidate validation:** place queries with resolved category tags at site scale and city scale.
9. **Exemplar enrichment:** resolve returned entities and request only the metadata needed for evidence cards.
10. **Evidence imagery:** where supported, use `filter.exists=properties.image`; display image only when returned and legally/contractually usable. If unavailable, fall back to real entity names and typographic evidence; never fabricate images.
11. **Taste neighborhoods:** retrieve top artist/movie/brand neighborhoods for each component exemplar set.
12. **Shared-Culture Graph:** compute edges locally from Qloo-returned neighborhoods; do not ask Qloo to invent a Zorq score.
13. **Replace:** `qloo_rank` a shortlist of role-preserving alternatives under the current cultural signals.
14. **Bridge:** `qloo_recommend` / combined audience signals to find a connector between weakly linked components.
15. **Triangulation:** finalist edges are re-checked through an independent Qloo route; where useful, add `qloo_compare_audiences` as a second qualitative audience-difference check.
16. **Local opportunity:** `qloo_where_popular` where it gives a cleaner locality read than a raw place query.
17. **Audience context:** `qloo_audience_demographics` may enrich the Blueprint as context only; never turn it into an individual or high-impact decision.
18. **Evidence detail:** `qloo_entity_tags` / `qloo_describe` can power the Evidence drawer and explain what a discovered entity represents.
19. **Method page:** document the Qloo primitives actually used and the limits of their outputs.

### Intentionally NOT core

- `qloo_trends` / temporal trend claims: keep disabled because the product specification explicitly removes trend claims from the MVP.
- Full audience-demographic scoring: explanatory only, never the ranking objective.
- Qloo heatmaps as the product itself: map/heatmap is an input to composition, not the novel product.
- Generic `qloo_recommend` as the final experience: recommendations are inputs to composition reasoning, not the product output.

### Low-level fallback

Maintain a small `DirectQlooTransport` implementation for Day-1 diagnostics and any MCP capability gap, but keep the production abstraction `QlooGateway` transport-agnostic. The primary deployed transport remains official `qloo mcp`.

## 6. Agent architecture requirements

The backend owns one bounded tool-calling agent loop using DeepSeek. Do not add LangChain, CrewAI, AutoGen, Mastra, multi-agent swarms, or a workflow platform unless a real blocker appears.

**Agent decides:** anchor selection, candidate pruning, attack order, bridge acceptance, interpretation of weak evidence, wording of constraint downshifts.  
**Deterministic code decides:** every numeric metric, graph edge, percentile, filter, constraint fit, null model, diff, and budget calculation.

Local tools exposed to the model:

`geocode` · `qloo_*` tools via MCP · `format_lookup` · `score_pool` · `search_compositions` · `stress` · `fit_constraints` · `diff` · `llm_only_baseline`.

Bound the loop:

- max 3 planner turns per phase;
- target ≤180 Qloo calls, hard ceiling ≈200 until the real quota spike says otherwise;
- Qloo concurrency 6–8;
- reserve ~30% of the call budget for stress/finalist probes;
- wall-clock cap with “best so far”;
- retry Qloo only when the error is retryable;
- no infinite tool recursion;
- stop after the leader survives stress and further mutation improvement is ≤ε, or after two mutation rounds.

## 7. DeepSeek configuration

Preferred model: **`deepseek-flash`**. DeepSeek's current V4.1-Flash release retired V4-Flash; `deepseek-v4-flash` remains a compatibility alias. Current V4-Pro requests are routed to V4.1-Flash at Flash rates until a future V4.1-Pro release.

Use the model in two modes:

- **Planner / challenger:** high reasoning effort, tool use enabled.
- **Narrator / formatter:** lower reasoning effort, short structured outputs.

Keep one model provider. Use the OpenAI SDK with `baseURL=https://api.deepseek.com`.

### Cost guard

Set `LLM_BUDGET_USD=2.00`. Track actual token usage from every response. Stop non-essential calls at 80% of budget and reserve the last 20% for recovery/judge flow. Prefer off-peak DeepSeek usage where practical; current Flash pricing is far below older V4 pricing.

Illustrative off-peak Flash economics from the current price table: 1M input tokens (cache miss) + 500k output tokens is about **$0.45**; 2M input + 1M output is about **$0.90**. These are usage examples, not a guaranteed total project bill.

Do not assume the DeepSeek API is an always-free service: current official docs describe usage billed against granted/topped-up balance.

## 8. Map and geocoding

Use **MapLibre GL JS** for the renderer and **MapTiler Free** for vector tiles + search/geocoding.

Rules:

- white/grayscale basemap only;
- site marker + radius ring + anchor pins + Qloo-derived heat layer;
- map persists through S1–S4 as required by the design;
- MapTiler attribution remains visible;
- use the Free plan only within its current testing/PoC/non-commercial terms;
- if the project later becomes commercial, replace/upgrade the map provider before commercialization.

No Google Maps/Places dependency. Qloo is already the cultural/place intelligence layer; adding another places database would dilute both novelty and implementation focus.

## 9. Frontend implementation requirements

Required screens/routes:

`/` → brief  
`/run/:id` → investigate · compositions · graph · stress · blueprint  
`/run/:id/blueprint` → read-only shareable view  
`/method` → exact measurements, provenance, limits

Visual requirements from Final Design:

- black/white interface;
- architectural drawing grammar;
- real entity names everywhere possible;
- evidence imagery only when real and returned/authorized;
- no decorative gradients, stock hero art, generic “AI dashboard” styling, or purple neon chrome;
- the prior is visible before Qloo work finishes;
- Agent Ledger shows specific work, not “Processing…”;
- provenance badges: `[Qloo]`, `[Zorq heuristic]`, `[LLM]`;
- evidence drawer links claims to ledger evidence IDs;
- graph is a controlled semantic composition, not a force-directed hairball;
- no headline magical 0–100 score.

## 10. Deterministic measurement engine

Implement exactly from Product Specification:

- K ≈ 8–10 candidate components;
- each component has tags, ≤5 local exemplars, and a provenance path;
- taste neighborhood from artist/movie/brand results;
- IDF suppression of globally ubiquitous entities;
- cosine-based shared-culture edges;
- coherence = mean pairwise edge;
- exact percentile among all role-valid equal-size subsets;
- weakest link = minimum edge;
- local-vs-city distinctiveness;
- finalist triangulation: confirmed / contested / thin;
- evidence grades A/B/C;
- ranking with distinctiveness dial `w`, hard filters first;
- exact local null-model enumeration, not Monte Carlo sampling.

No numeric result should be authored by the LLM.

## 11. Constraint engine

Format library: ~25 component types × 2–3 plausible formats.

Each format stores:

`role · footprint_range · hours_profile · noise_class · notes`

Rules:

- total footprint ≤85% of available sq ft by default;
- apply hours/noise constraints;
- downshift format before dropping a role;
- preserve role explicitly, e.g. `Cinema → Micro-screening; role preserved: Anchor`;
- every footprint/hours number is labelled `[Zorq heuristic]` and editable on `/method`.

## 12. Security, privacy and compliance requirements

- Qloo API key exists only in backend secrets.
- DeepSeek key exists only in backend secrets.
- Never place credentials in frontend source, browser bundle, Git, MCP config committed to Git, screenshots, recordings, or README.
- No login/accounts are needed for the hackathon demo.
- Do not send names, email addresses, device IDs, account IDs, location histories, or other personal data to Qloo.
- Treat Qloo/MCP/model output as untrusted input.
- Sanitize markdown/HTML before rendering model-authored text.
- Redact secrets from logs.
- Add per-IP rate limiting.
- Do not call Qloo from the browser.
- Keep Qloo claims separate from product interpretation.
- Never describe affinity as individual identity, causality, probability, or guaranteed demand.

## 13. Caching and quota policy

Default:

- cache only the smallest useful Qloo result;
- in-memory LRU TTL ≈6h unless organizer guidance requires shorter;
- no raw-response persistence by default;
- cache key must include endpoint + normalized relevant parameters;
- expose `live` vs `cached` in the ledger;
- reserve calls for finalists;
- no scraping/bulk extraction/reconstruction of a Qloo database.

**Blocking prerequisite:** obtain written clarification from Qloo/organizers on event quota, rate limit, credential expiration through judging, and the permitted duration/type of cached or persisted Qloo-derived data.

## 14. Reliability requirements

Every phase must be idempotent and resumable from the `Run` object.

Required failure behavior:

- ambiguous address → map picker;
- sparse Qloo → widen geographic scale and grade evidence B or worse;
- missing component evidence → hatched/unmeasured, never finalist;
- contradictory evidence → contested, never averaged away;
- HTTP 200 with zero useful results → reformulate once, then record as unmeasured;
- 429/5xx → bounded backoff/retry;
- LLM creates an unknown entity/tag → reject it before display;
- Qloo outage → stop at Prior, explain honestly, allow Retry;
- Render wake-up → `/healthz` + judge-safe loading state;
- share-link snapshot expiry → show snapshot expired and offer same-brief rerun.

## 15. Development requirements

Local machine:

- Node.js 22.19+;
- npm;
- Docker Desktop/Engine;
- Git;
- Chrome/Chromium for Playwright;
- Qloo harness ≥0.1.26;
- Qloo event credential;
- DeepSeek API key + small balance;
- MapTiler account/key;
- Turso account/database;
- GitHub repository.

Recommended scripts:

`npm run dev`  
`npm run typecheck`  
`npm run lint`  
`npm run test`  
`npm run test:e2e`  
`npm run build`  
`npm run smoke:qloo`

## 16. Environment variables

Server-only:

`QLOO_API_KEY`  
`DEEPSEEK_API_KEY`  
`TURSO_DATABASE_URL`  
`TURSO_AUTH_TOKEN`  
`APP_BASE_URL`  
`LLM_BUDGET_USD=2.00`  
`MAX_QLOO_CALLS=180`  
`QLOO_CONCURRENCY=6`  
`QLOO_CACHE_TTL_SEC=21600`  
`PERSIST_QLOO_DERIVED=false`

Frontend-visible configuration should contain only non-secret map configuration required by the chosen renderer/provider.

## 17. Repository requirements

Public GitHub repository with:

`README.md` · `LICENSE` · `.env.example` with placeholders only · architecture diagram · Qloo integration table · setup instructions · deployment instructions · `/method` mirrored in documentation · limitations · test instructions · screenshots · judge path · security notes.

Keep the Git history clean and truthful. If Zorq is an existing project receiving the Qloo integration during the submission period, preserve the real timeline of Qloo-specific work.

## 18. CI/CD requirements

On every push:

1. install dependencies;
2. typecheck;
3. lint;
4. unit tests;
5. build frontend/backend;
6. Playwright smoke path on the deployed app when appropriate.

Scheduled public-repo workflow:

- `GET /healthz` every ~10 min from Oct 20 through the end of judging;
- fail loudly if status is not healthy;
- do not send or expose secrets.

## 19. Build gates before polishing UI

**Gate A — Qloo transport:** MCP connects, `qloo_capabilities` is ready, one full tool chain returns structured output.  
**Gate B — category resolution:** ≥80% of target component concepts resolve to defensible Qloo tags/entities; otherwise use exemplar clustering.  
**Gate C — edge quality:** shared-culture edges show meaningful variation and are not merely popularity.  
**Gate D — rate/latency:** real 6–8 concurrency test completes inside the chosen UX budget with acceptable p50/p90.  
**Gate E — evidence:** explainability/affinity behavior is known; rank-only fallback works.  
**Gate F — presets:** two Qloo-divergent presets + one honest control preset.  
**Gate G — compliance:** written answer from Qloo on cache/storage/key lifetime or conservative no-persist mode enabled.

## 20. What NOT to add

Do not add authentication, payment, subscriptions, financial forecasting, listings feeds, a general web-search layer, a general-purpose vector database, a multi-agent swarm, LangChain-style orchestration, success probabilities, a magical ecosystem score, or trend claims to the MVP.

Do not add a second place database just to make the system look larger.

Do not build a separate frontend and backend host unless Render proves inadequate. One Render service serving the built React app + Express API is the default.

## 21. Free-first fallback tree

**Primary:** Render Free + Turso Free + MapTiler Free + MapLibre + Qloo MCP + DeepSeek Flash.

**Backend fallback:** a small paid/alternative container VM capped at $2 only if Render cannot reliably run `qloo mcp` or the free service becomes unusable. Do not pre-spend.

**Storage fallback:** remove persistence entirely and use read-only run snapshots only if Qloo terms prohibit storing derived Qloo output.

**Map fallback:** MapLibre + another compatible non-commercial OSM-based tile/geocoder stack if MapTiler terms/quotas stop fitting the hackathon use.

**Qloo fallback:** official CLI/API transport for diagnostics; the production product should still visibly depend on Qloo.

**LLM fallback:** none inside product scope. DeepSeek is the locked provider preference.

## 22. Final locked architecture

```text
React/Vite browser
      │
      ▼
Single Render Node service
      │
      ├── Express API + SSE
      ├── DeepSeek tool-calling agent
      ├── @modelcontextprotocol/sdk
      │       └── qloo mcp (official harness)
      ├── Deterministic Zorq engine
      │       ├── graph
      │       ├── null model
      │       ├── stress
      │       ├── constraints
      │       └── diff
      └── Turso (sanitized app state)

Browser map:
MapLibre GL JS → MapTiler Free
```

**Responsibility split:**

**Qloo = cultural measurement.**  
**Code = arithmetic, validation, graph search, constraints and trust boundaries.**  
**DeepSeek = interpretation, probe selection, mutation and language.**  
**Zorq = the composition product and the evidence-bearing Blueprint.**

## 23. Judge-period operating target

Internal freeze: **Oct 28, 2026**.  
Submission hard freeze: **Oct 29**.  
Official submission deadline: **Oct 30, 2026, 11:45 PM EDT / Oct 31, 2026, 9:15 AM IST**.  
Judging ends: **Nov 16, 2026, 11:45 PM EST / Nov 17, 2026, 10:15 AM IST**.

From Oct 20 to Nov 16, the free Render compute budget is sufficient on a calendar-month basis if the service stays within the free-instance allowance; the larger risk is cold starts, not hours.

## 24. Source-of-truth references

- Qloo Agentic Hackathon rules: https://qloo.devpost.com/rules
- Qloo Agentic Hackathon: https://qloo.devpost.com/
- Qloo public docs/OpenAPI: https://github.com/qloo/docs-public
- Qloo Hackathon Kit: https://github.com/qloo/qloo-hackathon-kit
- Qloo MCP starter: https://github.com/qloo/qloo-hackathon-kit/tree/main/starter/mcp-client
- DeepSeek API docs: https://api-docs.deepseek.com/
- Render free deployment: https://render.com/docs/free
- Turso pricing: https://turso.tech/pricing
- MapTiler pricing: https://www.maptiler.com/cloud/pricing/
- MapLibre GL JS: https://maplibre.org/projects/gl-js/
- GitHub Actions: https://docs.github.com/en/actions/

## 25. Final product rule

**Never let the stack become more complicated than the proof.** The proof is that a strong agent makes a culturally grounded composition, Qloo materially changes or validates it, the graph measures why components belong together, the agent attacks its own answer, and the Blueprint exposes the receipts.

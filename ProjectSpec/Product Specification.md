# ZORQ — Product Specification v1

*Autonomous cultural composition agent for physical places. Built for the Qloo Agentic Hackathon.*

**Evidence legend.** `VERIFIED` = seen on a page I fetched, or in 2+ independent public hackathon repos. `INFERRED` = follows from verified facts but must be tested. `SPECULATIVE` = idea only; do not build on it until a spike passes. `[Qloo]` `[Zorq heuristic]` `[LLM]` = the three provenance badges used in the UI.

**Limit of this research.** `docs.qloo.com` blocks automated fetching, so Qloo parameters below are verified from public repos built against the hackathon API plus Qloo's own marketing pages, not from the reference docs. The first engineering task is a spike against your real key (Section 18).

---

## 0. Hard facts that shape the build

| Fact | Status | Consequence |
| --- | --- | --- |
| Deadline Oct 30, 2026, 11:45pm EDT. Today is Oct 6. About 24 days. | VERIFIED (devpost) | Submit at least 48h early. |
| Must submit: live hosted demo, public repo, text description, open-source license visible in repo About. **Demo video is not required.** | VERIFIED | The draft's timestamped demo script is irrelevant. The product must explain itself to a judge who clicks around alone. |
| Judging: Technological Implementation, Design, Potential Impact, Quality of Idea (equal). | VERIFIED |  |
| Judges include Live Nation's EVP Strategic Initiatives, Eldridge's CEO, Qloo's CTO, an angel investor, an OpenAI board member, Cedric the Entertainer. | VERIFIED titles; fit is INFERRED | Lead with a venue/entertainment-district brief, not "another café". Venue and real-estate people will grasp the problem instantly. |
| Base URL `https://hackathon.api.qloo.com`, header `X-Api-Key`. Endpoints `/search`, `/v2/tags`, `/v2/audiences`, `/v2/insights`. | VERIFIED (several repos) |  |
| `/v2/insights` accepts `filter.type=urn:entity:place`, `filter.location.query` or `filter.location=POINT(lon lat)` + `filter.location.radius`, `filter.tags`, `operator.filter.tags=union`, `signal.interests.entities`, `signal.interests.tags`, `feature.explainability=true`, `filter.results.entities`. `take` above 50 returns 400. | VERIFIED |  |
| `filter.type=urn:heatmap` returns affinity by map cell. `urn:tag` returns tags describing the taste of an entity set. `urn:demographics` returns age/gender affinity. | VERIFIED (1–2 repos each) | Heatmap and tag analysis are not unique to us. Others use them. |
| Location filter combined with artist/brand/movie types returns **200 with zero results**, not an error. | VERIFIED (one repo, learned from failed runs) | Wrap the API client so invalid combos are rejected before calling. Use location only on place queries. |
| A place entity ID can be used as a taste signal to pull artists, brands, films. | VERIFIED (several repos) | This is our "place → culture" bridge. |
| Qloo already sells single-site lease evaluation: what entities and cuisines correlate to a prospective lease location within a radius. | VERIFIED (qloo.com) | Zorq's step up is composing *multiple* components and testing their relationships. |
| At least six place-oriented Qloo projects are already public (TasteBridge, TasteTable, TasteRoute, Unstuck, Newcomer, Hayy). All are demand-side "find places for a person" or single-venue tools. | VERIFIED | "Place + Qloo" alone is not novel. Composition is the differentiator. |
| Hackathon terms on storing/caching Qloo output are not known to me. One repo author reads the terms as "no persisting or bulk download". | INFERRED | Cache in memory with short TTL. Store only IDs and our own computed metrics in saved runs. Ask the organizers ([ian@qloo.com](mailto:ian@qloo.com)) about caching and **whether your key stays valid through judging**. |

---

## 1. Verdict on the draft

**Keep:** the Place Blueprint as the deliverable. Hypotheses that compete. "Challenge the Plan". "What would the AI have done without Qloo?". The graph as the visual. Constraint adaptation (cinema becomes micro-screening).

**Change:**

| Draft says | Problem | Spec does |
| --- | --- | --- |
| "Composition testing sends the combination back through Qloo" | Qloo has no endpoint that scores a combination. Claiming it does is a technical misstatement a Qloo CTO will catch. | Measure relationships between components with two independent Qloo routes (Section 14), then compute coherence ourselves. |
| One Ecosystem Score (87) with six sub-scores | Numbers with no definition are invented precision. | Three defined readings, a null-model percentile, and a letter evidence grade. No headline 0–100. |
| Cultural DNA as labelled bars ("Creative intensity 9/10") | Looks like LLM vibes. | DNA = what *over-indexes locally versus the city*, with real entity names. |
| Analogs "derived from Qloo relationships" | No primitive exists. | Analogs are a stretch feature, defined concretely in Section 12. |
| Backtest reconstructs a known place | Circular: Qloo's locality signal already encodes where people go. | Held-out category recovery against a popularity baseline, labelled a sanity check (stretch). |
| Trend validation, geographic validation in the capability list | Not verified as available. | Excluded. |
| Demo narrative with timestamps | Videos aren't required. | Presets, a self-narrating agent ledger, and a built-in "Without Qloo" view. |

**Cut:** chat as the primary UI, any "success probability", financial pro-formas, accounts, real-estate listing feeds, multi-agent swarms.

**Add (new, from the Grandmaster pass):**

1. **Prior Lock.** The agent commits an LLM-only composition before its first Qloo call. Every later change is attributed to evidence. The "Without Qloo" view is then automatic and honest, and if Qloo changes nothing the app says so.
2. **Shared-Culture Graph.** Edges between components are the culture their audiences share, with the shared entities as the receipt.
3. **Triangulation.** Every finalist edge is re-measured through a second, independent Qloo route.
4. **Null-model percentile.** Coherence is compared against every other valid combination from the same pool.
5. **Bridge search.** When two members are weakly linked, the agent asks Qloo what *both* audiences love and proposes a connecting component.
6. **Local-vs-city distinctiveness**, to defeat the popularity trap (Section 2).

---

## 2. Product thesis, problem, innovation

**Thesis.** Zorq is an autonomous agent that designs the *mix* of cultural components a place should hold, then proves each choice with Qloo evidence it gathered, challenged and attributed.

**Core human problem.** An owner, operator or placemaker is about to commit years of leasing to a mix. The fear is regret: the mix ends up generic, or it clashes with the neighborhood. Tenant-mix planning is an established discipline with its own practitioner guides (ICSC's guide for commercial district practitioners) and live competitions, for example a Montréal mall retail-street challenge that asks teams for a tenant-mix and placemaking concept. Today the work runs on broker intuition, foot-traffic counts and demographics. None of those tell you whether *these categories belong together here*.

**The hidden variable** is shared culture between the audiences of different place types: do the people who love a neighborhood's independent cinema also love its record shops, and which in-between category connects them?

**Why generic AI fails.** An LLM produces the median plausible mix (café, boutique, restaurant, coworking). It has no local measurement and cannot say *why here*.

**The popularity trap (design constraint).** Naively, cafés and restaurants will look "coherent" everywhere because they are everywhere. A composition engine that ignores this reproduces the LLM answer with extra steps. Distinctiveness (what over-indexes here versus the city) is therefore a first-class measurement, not a garnish.

---

## 3. Why Qloo is indispensable (Generic-LLM Removal Test)

Rebuild with LLM + web search + a database. What disappears:

| Disappears | Why it cannot be replaced |
| --- | --- |
| The *edges*: which categories share an audience here | Requires taste-graph overlap between exemplar places' audiences across music, film and brands. Web search returns reviews, not audience overlap. |
| Local vs city distinctiveness | Requires the same measurement at two geographic scales. |
| Provenance of each component | Every candidate carries a path: local anchor place → artists/films/brands → place category. A search-based agent can only assert. |
| The Prior → Final diff being non-empty | Without evidence the agent has nothing to change its mind with. |

If the removal test shows the Final equals the Prior on a given brief, Zorq says so. That honesty is a feature.

---

## 4. Human + Agent + Qloo loop

```
BRIEF ─► PRIOR LOCK (LLM only, frozen)
   │
   ▼
SITE READ ─ Qloo: heatmap, local anchor places ─► agent picks anchors
   │
   ▼
DNA ─ Qloo: anchors → cross-domain entities ─► agent reads over-indexes
   │
   ▼
CANDIDATE POOL ─ Qloo: entities → place categories (tag-resolved) ─► pool of K components, each with a path
   │
   ▼
MEASURE ─ Qloo: per-component taste neighborhood (site & city) ─► code builds graph, scores subsets
   │
   ▼
HYPOTHESES ─ code searches graph; agent names and narrates 3 + Prior
   │
   ▼
STRESS ─ agent selects weakest edge/member ─► Qloo bridge / triangulation / catchment probes ─► verdict
   │
   ▼
CONSTRAIN ─ code fits formats to sq ft, hours; agent explains downshifts
   │
   ▼
BLUEPRINT + DIFF ─► user acts: Replace / dial / re-run / share ─► (loop back to MEASURE for new members only)
```

**Qloo = measurement.** **Code = arithmetic** (graph, scores, constraints, null model). **LLM = interpretation**: choosing the next probe, naming clusters, adapting formats, writing receipts that may cite only evidence IDs the ledger contains.

---

## 5. Behavioral journey

1. **Land.** One sentence: "Design what should exist together on a site." Three preset sites. One click starts a run.
2. **Prior appears at once** (about 3 seconds, LLM-only). The user sees the agent's naive guess before any evidence. This creates the *question*: will Qloo change it?
3. **Watch the agent work.** Ledger streams. Map heat appears. DNA fills in with real names ("people around X also over-index on Y").
4. **Four compositions** appear: Prior plus three graph-derived. The user sees where Qloo diverged.
5. **Graph.** Weakest link is highlighted. User clicks an edge and sees the shared entities.
6. **Stress.** The agent attacks its leader. Verdict arrives: survived, revised or replaced.
7. **Blueprint** with receipts and **What Qloo changed**. User moves the Distinctiveness dial or replaces a component. Then shares the link.

**Emotional arc:** uncertainty → curiosity (prior vs evidence) → surprise (a component the Prior never contained, with a path) → trust (the agent tried to break its own answer) → ownership (user replaces or dials).

---

## 6. Information architecture and navigation graph

**Routes:** `/` brief · `/run/:id` workspace (views: `investigate`, `compositions`, `graph`, `stress`, `blueprint`) · `/run/:id/blueprint` read-only shareable · `/method` (how Zorq measures; formulas, limits).

**Persistent:** top bar (logo, run title, view tabs, "New brief"), provenance legend. **Contextual drawers:** Evidence, Replace. **Modal:** Without-Qloo compare. **Background:** all Qloo and LLM work, streamed by SSE.

| Current | Action | System response | Destination | Preserved | Qloo? | Agent reasons? |
| --- | --- | --- | --- | --- | --- | --- |
| S0 | Click preset / submit custom | Create run, lock Prior | S1 | Brief | Yes (after Prior) | Yes |
| S1 | Run finishes a phase | Unlock the view tab | same | All | — | — |
| S1 | Click ledger row | Expand raw request summary | same | — | No | No |
| S2 | Click composition card | Select it | S3 graph, member subset highlighted | Selection | No | No |
| S2 | Move dial | Re-rank client-side | same | — | No | No |
| S3 | Click edge | Open Evidence drawer | same + drawer | — | No (cached) | No |
| S3 | Click node → Replace | Open Replace panel | same + panel | — | Maybe (new candidate only) | Yes |
| S4 | "Challenge the plan" | Run stress ops | S4 | Selection | Yes | Yes |
| S4 | Verdict ready | Offer "Open blueprint" | S5 | Final | — | — |
| S5 | "Without Qloo" | Open compare modal | modal | — | No (Prior stored; LLM-only polish pre-run) | — |
| S5 | Replace member | Recompute C/D, stress mini-pass | S5 | Run history | Yes (≤ few calls) | Yes |
| any | Browser back | Previous view; run continues | prev | All | — | — |
| any | "New brief" | Confirm if run in progress | S0 | Brief prefilled | — | — |

No dead ends: every view has a forward action and "New brief".

---

## 7. Screens

### S0 — Brief

- **Purpose:** get a site, a goal and constraints with minimal effort. **User state:** curious, unsure the tool is real. **Question:** "What will it do with my site?"
- **Layout:** left, full-height map (MapLibre). Right, brief card. Above the card, one line: "Zorq designs what should exist *together* on a site."
- **Brief card:** address/place search · sq ft (number) · goal (free text, 200 chars) · constraints chips (No late night · No loud venue · Ground-floor only · Custom) · optional "Places we admire" (autocomplete via `/search`, up to 3; used as extra anchors).
- **Presets (three cards above the form):** chosen from Day-1 spike data (Section 18): two where Qloo diverges most from the Prior, one *control* where it confirms the Prior.
- **Primary CTA:** "Investigate this site". **Secondary:** presets; "How it measures" → `/method`.
- **After CTA:** run created, Prior locked, route to S1.
- **Agent/Qloo here:** none until submit (autocomplete uses `/search`).
- **Stored:** brief. **Loading:** autocomplete skeleton. **Empty:** none. **Error:** geocode fails → "We couldn't place that address. Pick a point on the map." Qloo `/search` down → autocomplete disabled with a note; the run still works.
- **Adaptive:** constraint chips reorder by site type once the address resolves (e.g., "Historic frontage").
- **Exists because:** the first meaningful action must be one click, not a form.

### S1 — Investigate (live workspace)

- **Layout:** left, map (heat layer, site marker, radius ring, anchor pins). Right, **Agent Ledger**. Bottom strip: **Cultural DNA**, filling as data arrives. Top-left floating card: **Prior** (frozen, with lock time).
- **Ledger rows** (kind badge: `Qloo` / `Compute` / `LLM`): label, one-line result summary, duration. Click expands: endpoint, parameters with key redacted, result count, cache hit or live. This is the proof-of-integration for technical judges.
- **Decision cards** interleave: "Question → Evidence → Chose → Rejected". Example: "Weakest link between A and B → bridge search → chose C."
- **DNA strip:** top over-indexed entities by domain (artists, films, brands) with a bar showing local vs city (Section 14). Each entity chip opens Evidence.
- **Primary CTA while running:** none (the agent is working); a "Stop and show best so far" link. **On finish:** "See compositions".
- **Agent:** plans probes, picks anchors from the heatmap and anchor list, interprets DNA. **Qloo:** heatmap, anchor places, cross-domain entities.
- **Stored:** ledger, anchors, DNA, pool. **Learned:** which anchors the agent selected (shown, correctable).
- **Correctable:** user can unpin an anchor ("not representative") → agent re-runs DNA from remaining anchors. This is the user's first chance to correct the evidence.
- **Loading:** streaming rows. **Empty:** none. **Error:** Qloo 429 → ledger row turns amber "rate-limited, retrying (n/3)". Heatmap empty → "Thin data here; widening to neighborhood scale" (a visible agent decision, not a silent fallback). Hard fail → S1 error state with partial results and "Retry".
- **Exists because:** agency must be visible as actions and decisions, not chat.

### S2 — Compositions

- **Purpose:** show competing hypotheses. **Question:** "What are my realistic options and where did Qloo disagree with the agent's first guess?"
- **Layout:** four cards in a row: **P (Prior)**, **A, B, C** (graph-derived). Each card: name (LLM-named, 2–3 words), members grouped by role, three readings (below), evidence grade chip, weakest link text.
- **Three readings per card:** Coherence percentile ("more coherent than 91% of 252 valid combinations from this pool"), Distinctiveness ("4 of 5 members over-index locally"), Weakest link ("Café ↔ Cinema, weak"). Never a single combined score.
- **Dial:** "Familiar ↔ Distinctive" slider re-ranks cards client-side from cached numbers.
- **Prior card** shows its *measured* readings too, because its components get measured like everything else. If the Prior ranks high, the app says so.
- **CTAs:** primary "Show the graph" (selected composition). Secondary: "Challenge the leader".
- **Stored:** compositions, dial position. **Error:** if fewer than 3 distinct compositions are valid (small pool), show the available ones plus a note "Only N valid combinations from this pool."

### S3 — Graph

- **Layout:** force layout; nodes = components (icon, name, role color); edge thickness = shared-culture strength (relative bands: strong/typical/weak). Selected composition is bolded; others dim. Weakest link pulses once.
- **Click edge → Evidence drawer:** "Audiences of {exemplar places for A} and {exemplar places for B} both over-index on" + top shared entities (IDF-weighted), plus a triangulation line: "Direct check: places of type B rank {top half/bottom half} for A's audience: agrees/disagrees."
- **Click node:** exemplars (real local places Qloo returned), path provenance, Replace button.
- **Hatched edges** = unmeasured (never filled with guesses).
- **Mobile:** graph becomes a sorted edge list with chips.
- **Exists because:** "relationships between components, not ranking businesses" must be visible.

### S4 — Stress test ("Challenge the plan")

- **Layout:** a checklist of five attacks, each with a status and result: Ablation, Substitution, Bridge, Catchment shift, Rival check. Running indicator on the active one. Right, the leader composition with changes animating in place.
- **Verdict banner:** `Survived` / `Revised` (with diff) / `Replaced by {Rival}`. Always with the reason.
- **CTA:** "Open blueprint".
- **Agent:** chooses which attacks to emphasize from graph diagnostics; may run a second round (max 2). **Qloo:** probes for bridge, triangulation, catchment.
- **Error:** a probe fails → that attack shows "not completed" and caps the evidence grade at B.

### S5 — Blueprint

- **Sections, top to bottom:**
  1. **Title and one-paragraph rationale** `[LLM]`, citing evidence IDs.
  2. **Composition by role** (Anchor, Social, Discovery, Experience, Night, Community). Each member card: chosen *format* `[Zorq heuristic]` with footprint range, hours profile, "Why here" with 2–3 receipts `[Qloo]` (path + shared entities), and a Replace button.
  3. **Fit to site:** stacked bar of footprint against available sq ft; hours timeline; each downshift written as "Cinema → Micro-screening. Role preserved: Anchor."
  4. **What Qloo changed:** Prior vs Final, as Kept / Added / Removed / Reformatted, each with its evidence link. "Without Qloo" button opens the compare modal.
  5. **Risks:** weakest edge, thin-evidence components, triangulation disagreements, constraint conflicts.
  6. **Evidence grade and method link.**
- **CTAs:** primary "Share blueprint" (copies URL). Secondary: "Copy as Markdown", "Print / save PDF" (print stylesheet), "Replace…".
- **Without-Qloo modal:** two columns. Left: the frozen Prior plus an LLM-only *polish* (same constraints, no tools; generated at run start so the comparison is fair). Right: the Final. Differences are highlighted. Header: "What the agent would have recommended with no cultural evidence."
- **Stored:** final, diff, readings. **Exists because:** the deliverable a board or investor could actually read.

### Overlays

- **Evidence drawer:** claim → source badge → entities (with names, domain, rank) → how computed (one line) → link to ledger rows.
- **Replace panel:** alternatives from pool with the same role, ranked by effect on coherence and distinctiveness, with ΔC/ΔD and "weakest link becomes…". Free-text "something else" resolves a tag and probes (≤ 4 calls), then is added to the pool with a path. Confirming triggers a mini-stress pass.
- **/method page:** the formulas of Section 14, the list of heuristics (format library, role map) marked editable, limits (Section 17).

---

## 8. Interaction matrix

| User action | Agent behavior | Qloo behavior | Interface response | Next state |
| --- | --- | --- | --- | --- |
| Submit brief | LLM-only Prior, frozen | none | Prior card appears | S1 running |
| Unpin anchor | Re-select anchors, rerun DNA | 1–3 insight calls | DNA recomputes, diff flash | S1 |
| Move dial | none | none | Cards re-rank | S2 |
| Click edge | none | none (cached) | Evidence drawer | S3 |
| Challenge | Choose attack order from diagnostics | triangulation, bridge, catchment probes | Checklist fills, verdict | S4 → S5 |
| Replace member | Explain alternatives, optional custom resolve | up to \~4 calls for custom | ΔC/ΔD preview, confirm | S5 updated |
| Without Qloo | none | none | Compare modal | modal |
| Re-run with changed sq ft | Re-fit formats only | none | Blueprint updates | S5 |
| Re-run with changed goal | New Prior? No: keep Prior, new weighting | none for weights; new probes if goal adds anchors | Updated rankings | S2 |

---

## 9. Adaptive personalization

Taste is not a profile here; the *site* is the subject. What adapts:

- **Anchors** the user unpins reshape DNA and therefore the pool.
- **Dial** weights distinctiveness against coherence.
- **Replace** choices teach the system what the user considers role-equivalent. These persist in the run and bias alternatives (a replaced "bookstore → gallery" makes "publishing" outrank "café" next time within the run).
- **Question order:** the agent's next probe depends on the last result (weakest edge → bridge search; thin evidence → widen scale). That is policy driven by Qloo output, not a fixed script.
- **Explanation depth:** receipts show 2 entities by default; "show all" expands.

---

## 10. Qloo integration map

| # | Step | Endpoint and key params | Why | Status |
| --- | --- | --- | --- | --- |
| 1 | Resolve admired places/entities | `GET /search?query=&types=` | Extra anchors, place names → IDs | VERIFIED |
| 2 | Resolve component categories | `GET /v2/tags?filter.query=` | Never hardcode tag URNs; resolve per category | VERIFIED call; exact place-category tag URNs SPECULATIVE |
| 3 | Where taste concentrates | `GET /v2/insights?filter.type=urn:heatmap&filter.location.query=&signal.interests.*` | Choose site-relevant cells and scale | VERIFIED |
| 4 | Local anchors | \`GET /v2/insights?filter.type=urn:entity:place&filter.location.query | POINT+radius&take≤50\` | Top local places as taste anchors |
| 5 | Place → culture | \`GET /v2/insights?filter.type=urn:entity:{artist | movie | brand}&signal.interests.entities=\` (no location param) |
| 6 | Culture → place categories | `…filter.type=urn:entity:place&signal.interests.entities=<entities from #5>&filter.location…` | Candidate components with path provenance | VERIFIED pattern |
| 7 | Exemplars per component | `…place&filter.tags=<component tags>&filter.location…` at site and city scale | Exemplar places E_k; city baseline | VERIFIED |
| 8 | Taste neighborhood N_k | \`…artist | movie | brand&signal.interests.entities=\<E_k IDs>\` |
| 9 | Triangulation | `…place&filter.tags=T_k&signal.interests.entities=E_j` | Independent edge check | VERIFIED pattern |
| 10 | Bridge search | `…place&signal.interests.entities=E_j ∪ E_k`, exclude both components' tags via `filter.exclude.tags` | Find connecting category | VERIFIED params; outcome INFERRED |
| 11 | Explainability | `feature.explainability=true` on selected calls | Optional extra receipt text | VERIFIED param; response shape to be checked |
| 12 | Locality as direct signal | `signal.location.query` for non-place types | Possible shortcut for DNA | SPECULATIVE (one repo reports location behaves only on place queries). Not required. |

**Client rules (from public failure reports):** reject location filters on non-place types; cap `take` at 50; retry only on 429/5xx; cache 6h in memory; per-run call budget; per-IP rate limit; key server-side only.

---

## 11. Agent architecture

- **Orchestrator:** a tool-calling LLM loop with a typed state object (Run). Model-agnostic. The loop is bounded: max 3 LLM planning turns per phase, max \~200 Qloo calls per run (tune after the rate-limit spike), wall-clock cap with "best so far".
- **Tools:** `geocode`, `qloo_search`, `qloo_tags`, `qloo_insights` (guarded wrapper), `format_lookup`, `score_pool` (deterministic), `search_compositions` (deterministic), `stress` (deterministic + probes), `fit_constraints` (deterministic), `diff` (deterministic), `llm_only_baseline` (no tools).
- **Where the agent decides, not code:** anchor selection, candidate pruning, which attack runs first, which bridge to accept, how to word a downshift, when evidence is too thin.
- **Where code decides, not the agent:** all numbers.
- **Verification:** the writer step may cite only evidence IDs in the ledger. Unknown IDs and unknown entities are dropped before display. A claim with no ID renders with the `[LLM]` badge, never `[Qloo]`.
- **Memory:** the Run object. Prior is write-once.
- **Recovery:** each phase is idempotent and resumable from the Run; failed probes are retried once, then recorded as "not measured".
- **Stop rule:** stop when the leader survives stress and no mutation raises coherence by more than ε, or after 2 mutation rounds.
- **Mutation operators:** Bridge (insert), Swap (same-role replacement), Drop (ablate), Shift-scale (catchment).

---

## 12. Measurements (exact definitions)

**Pool.** K ≈ 8–10 components. Each has tags T_k, exemplar places E_k (≤5 local places Qloo returned), and a **path**: anchor place → entity → category.

**Taste neighborhood.** N_k = weighted vector over entities returned for signal E_k, domains artist/movie/brand (top 30 each). Weight = returned affinity if present, else 1/rank. `INFERRED:` affinity scale comparability. Rank fallback if absent.

**Shared-culture edge.** `IDF_e = ln(K / (1 + #{components whose N contains e}))`, floored at 0, so entities that appear around every component (popular everywhere) carry no weight. `edge(j,k) = cosine(IDF·N_j, IDF·N_k)`. Displayed as relative bands within this pool; no absolute numbers.

**Coherence of a set S.** Mean edge over pairs. **Percentile:** rank among *all* role-valid subsets of equal size, enumerated exactly (for K=10, size 5 that is at most 252 subsets). No sampling, no Qloo calls.

**Weakest link.** Minimum edge in S, named.

**Distinctiveness d(k).** `1 − cosine(N_k^site, N_k^city)` using artist domain: how differently the local audience of category k behaves from the city's audience of the same category. High means this category *means something different here*.

**Triangulation (finalists only).** Route 2 for pair (j,k): query place type k with signal E_j and compare k-places' rank to the same query under the locality-anchor signal. Agreement = k-places sit in the top half. Edge is **confirmed** (both routes strong), **contested** (disagree) or **thin** (\<5 results).

**Evidence grade.** A: all leader edges confirmed. B: any contested, thin, or failed probe. C: any leader member unmeasured.

**Ranking.** Hard filters first (role coverage, constraint fit). Then `z(C) · (1−w) + z(D̄) · w`; tie-break by weakest link. `w` is the dial (default 0.5), visible in the UI. Rival check sweeps `w` from 0 to 1 and reports where leadership flips.

**Format library `[Zorq heuristic]`.** About 25 component types × 2–3 formats, each with footprint range, hours profile, noise class and role. Footprints are planning ranges to be validated with someone in the field; the /method page labels them editable. Fit rule: sum ≤ 85% of sq ft (circulation allowance, heuristic); hours/noise filters from constraint chips; if infeasible, downshift formats, then drop the least load-bearing member.

---

## 13. Wow moments

1. **Prior vs evidence.** A card showing what the agent believed *before* looking, then a diff showing what evidence changed. Possible only because of Prior Lock.
2. **A component the Prior never contained, with a path** (local anchor → three real artists/films → category) that makes immediate sense.
3. **The graph's weakest link is the agent's own favorite.** The agent then attacks it and either repairs it with a bridge or concedes.
4. **"More coherent than N% of all valid combinations."** A numerate judge feels this is science, not vibes.
5. **Format downshift preserving role** (cinema → micro-screening).
6. **Honest control case.** One preset where Qloo mostly *confirms* the Prior, and the app says so. This is the moment that makes every other claim credible.

---

## 14. Trust and explanation system

- Every claim carries `[Qloo]`, `[Zorq heuristic]` or `[LLM]`.
- Every `[Qloo]` claim opens an Evidence drawer; every drawer links to ledger rows with call summaries.
- "What you can correct": anchors (S1), format library (method page), dial (S2), replacements (S5).
- Cache indicator on each call: live or cached with age.
- No invented confidence. Grades are rule-based and the rule is written next to them.

---

## 15. Edge cases

| Case | Behavior |
| --- | --- |
| Ambiguous address | Map pin picker; no run until resolved. |
| Sparse Qloo data at site scale | Agent widens to neighborhood, shows the decision, caps evidence grade at B. |
| Component with no exemplars | Stays in pool as "unmeasured" with hatched edges; cannot enter a leader composition. |
| Contradictory signals | Surfaced as a contested edge, never averaged away. |
| Zero results with HTTP 200 | Treated as a failed probe, reformulated once (drop one filter), then recorded. |
| 429 | Backoff (max 3) with visible ledger state; call budget reserved for finalists. |
| All of Qloo down | Run stops at S1 with the Prior, a plain explanation, and "Retry". It never fabricates evidence. |
| LLM invents a component or entity | Unknown tag/entity dropped; row shows "removed: not in Qloo results". |
| Tiny site (e.g., 3,000 sq ft) | Fit step downshifts formats; may reduce to 3 members and says why. |
| Non-US site | Allowed, but the heatmap/anchor read may be thin; grade reflects it. Presets stay in well-covered cities. |
| Judge opens shared link after TTL | Read-only blueprint says "snapshot expired" with a one-click re-run of the same brief. |

---

## 16. MVP / Stretch / Delete

**MVP (must be flawless):** S0 with presets · Prior Lock · site read, anchors, DNA · candidate pool with paths · shared-culture graph · graph-derived compositions with null-model percentile · stress (ablation, substitution, bridge, rival check, catchment shift for finalists) · constraint fit with format library · blueprint with receipts · Without-Qloo diff · run inspector ledger · shareable read-only blueprint · /method page · README, license, hosted deploy.

**Stretch (in this order):** Replace with custom component · Distinctiveness dial · triangulation for all pairs · analogs (compare the site's top-entity vector to 4–6 districts the agent proposes, each validated by Qloo; the agent uses analog category sets as extra hypothesis seeds) · held-out category recovery test on 3 known districts versus a popularity baseline · supply-gap flag (labelled "Qloo-catalogued places only").

**Delete:** chat box as main UI, a single 0–100 score, accounts, listings feeds, financial modeling, trend claims, any success-rate number.

---

## 17. Known limits (state these on /method)

- Qloo's place catalog is not a census of businesses; small venues may be missing.
- Edges describe shared culture between audiences, not demand, rent or revenue.
- Format footprints and hours profiles are heuristics.
- Coherence is relative within a pool; a bad pool yields a "best of bad options".
- No ground truth exists for "the right mix". The held-out test is a sanity check, not validation.

---

## 18. Build plan (24 days) and Day-1 spikes

**Spikes (finish in 2 days; each has a pass/fail and a fallback):**

| # | Test | Pass | Fallback |
| --- | --- | --- | --- |
| 1 | For 8 sites, build N_k for 8 categories and compute edges. Are edges non-degenerate, not just popularity? | IDF-weighted edges show real spread and make intuitive sense; city vs site differ | Use triangulation route as primary edge (O(K²) calls) |
| 2 | Place-category tags: can `/v2/tags` resolve "independent cinema", "listening bar", "design shop", "gallery" to usable place tags? | ≥ 80% of target categories resolve | Use entity-exemplar clustering instead of tags |
| 3 | Rate limit and latency under concurrency 6–8 | Run completes in a duration you're willing to show live | Reduce K to 8, domains to artist+movie |
| 4 | Does affinity appear in responses, and is rank stable between repeated calls? | Yes | Rank-only weighting |
| 5 | Which 8 candidate sites produce the largest Prior-vs-Final differences, and which produces a confirmation? | Pick 2 divergent + 1 control as presets | — |
| 6 | Caching/storage terms and key lifetime | Written answer from organizers | In-memory cache only; no saved runs |

**Schedule:** Days 1–2 spikes · 3–7 headless engine with tests (no UI) · 8–13 S0–S3 · 14–18 S4–S5 and diff · 19–21 stretch (Replace, dial) · 22–23 hardening: cache warm-up for presets, error states, /method, README, license · 24 buffer. Submit by Oct 28.

**Stack (suggestion, not a dependency):** TypeScript end to end; a server runtime with SSE (Cloudflare Workers or a small Node host); MapLibre for the map; Canvas/D3 for the graph; Qloo client with LRU cache, token bucket, retry rules; key stored as a server secret only.

---

## 19. Judge simulation (my estimates, not measurements)

| Criterion | Read | Biggest risk |
| --- | --- | --- |
| Technological Implementation | Strong if edges survive Spike 1: multi-hop pipeline, two independent measurement routes, guarded API wrapper, visible call trace | Rate limits make the live run slow or flaky |
| Design | Strong: workspace that shows work, one central object (the graph), three-way provenance | Visual density; S1 can overwhelm if the ledger competes with the map |
| Potential Impact | Medium-strong: a recognizable professional workflow with live practitioner guides and competitions, and a stated Qloo commercial use at single-site level | No real user validation inside 24 days |
| Quality of Idea | Strong: composition rather than recommendation, falsification built in, honest control case | Judges skimming may read it as "another place recommender" unless S2's Prior-vs-evidence moment lands in the first minute |

**Fifteen-minute test.** 0–30s: "design what belongs together on a site", one preset click. 30–90s: Prior appears, ledger runs, DNA fills. 2–5min: Prior vs compositions, then the graph and an evidence drawer. 5–10min: stress verdict, blueprint receipts. 10–15min: Without-Qloo diff; control preset. **Memory after 30 projects:** "the one that showed what the AI believed before and after the evidence."

---

## 20. Competitor / cliché test

A competent weekend builder ships: address in, LLM + Qloo `place` call, list of cafés and restaurants with a justification paragraph. Structural differences here: the unit of output is a *set* with measured inter-component relationships; the agent commits to a prior and is audited against it; every number is defined; the agent tries to break its answer; and a control case shows Qloo can agree with the LLM.

---

## 21. "Would I build this?" (brutal version)

**Yes, conditionally.** It is the strongest of the options I considered because it moves the unit of value from "item" to "combination", uses Qloo for something an LLM cannot fake (audience overlap between categories), and carries a built-in way to be wrong visibly.

**It fails if:** Spike 1 shows edges that merely track popularity (fallback: triangulation as primary, and weaker claims); category-to-tag resolution is poor (fallback: exemplar clustering); the live run is too slow to feel agentic (fallback: smaller pool, streamed ledger, warmed presets).

**Remaining weaknesses I can't fix by design:** no ground truth for "the right mix"; Qloo's place coverage is uneven; the format library is our own heuristic; no real placemaker has used it. Say each of these on /method before a judge finds it.

**Single sentence to protect:** *Zorq shows what the agent believed before it looked, what Qloo changed, and what happened when it tried to break its own answer.*
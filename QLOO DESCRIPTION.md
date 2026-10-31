# Zorq: Cultural Composition Intelligence Powered by Qloo

> **"What combination of people, culture, and belonging should this place host, and why?"**

**Zorq** is an autonomous cultural composition agent and deterministic mathematical measurement system built on top of **Qloo’s Cultural Intelligence Platform**. Deployed live at **[https://zorq-12dk.onrender.com](https://zorq-12dk.onrender.com)**, Zorq transforms physical placemaking, commercial real estate development, urban planning, and mixed-use venue curation from subjective guesswork into an empirical, mathematically verifiable science.

> **Comprehensive Project Description:** See **[`PROJECT DESCRIPTION.md`](./PROJECT%20DESCRIPTION.md)**  
> **Repository Setup & Quickstart:** See **[`README.md`](./README.md)**

---

## 1. Executive Thesis: Why Qloo is the Missing Link in Physical Placemaking

### The Crisis in Traditional Placemaking & Generic AI
Every year, billions of dollars in commercial real estate, retail leases, and municipal revitalization projects are programmed using broken heuristics:
1. **Raw Geographic Proximity:** Assuming that because two businesses are near each other, their audiences are compatible—leading directly to audience cannibalization or jarring tenant friction.
2. **Demographic & Foot-Traffic Counting:** Measuring how many people walk past a corner without knowing *who* they are culturally, *what* they value, or whether the audience of a specialty coffee roaster will actually cross-pollinate with an adjacent independent cinema or analog listening bar.
3. **The Generic LLM Popularity Trap:** When an unassisted Large Language Model is asked to program a physical site, it regurgitates median internet tropes (*"an artisanal sourdough bakery, a craft cocktail lounge, and a modern coworking hub"*). Unassisted LLMs are **culturally blind at the neighborhood level**, incapable of measuring cross-domain audience overlap, unable to distinguish local subcultural identity from national popularity, and unable to produce an auditable chain of empirical evidence.

### How Qloo Transforms the Paradigm
**Qloo** is the world's premier AI-powered cultural and taste intelligence engine, mapping privacy-first consumer affinities across Music, Film, TV, Dining, Nightlife, Brands, Literature, Travel, and Physical Places.

Zorq harnesses Qloo to execute a fundamental paradigm shift in spatial and cultural computing:
- **From Isolated Item Recommendation:** $\text{Venue } A \text{ vs. Venue } B \text{ vs. Venue } C$
- **To Multi-Domain Ecosystem Composition:** $\text{Venue } A + \text{Venue } B + \text{Venue } C + \text{Venue } D \longrightarrow \text{Does this cultural ecosystem belong together at these exact coordinates?}$

In Zorq, **Qloo is not a post-processing filter or a decorative API call**. Qloo is the **empirical sensory nervous system** of the entire application. Every graph edge, every local distinctiveness vector, every subcultural bridge, every self-falsification probe, and every provenance receipt in Zorq is powered by live Qloo data.

---

## 2. Exhaustive Map of Qloo’s Role Across the Zorq Architecture

Zorq orchestrates **9 distinct Qloo intelligence modalities** across a bounded, high-concurrency execution loop (`MAX_QLOO_CALLS=180`, hard ceiling `200`, concurrency `6`). Below is the complete technical breakdown of every place Qloo is used, how its payload is processed, and why it is irreplaceable.

### 2.1 Runtime Gateway Verification (`qloo_capabilities`)
- **Where Used:** Backend startup, `/healthz` diagnostics, and **Stage 1 (`S1`) Live Agent Ledger** initialization.
- **How Zorq Uses Qloo:** Before executing a site investigation, Zorq dispatches a runtime diagnostic probe to Qloo to verify API gateway readiness, supported entity domains, active taxonomy contracts, and schema checksums.
- **Why It Matters:** Guarantees deterministic reliability and surfaces live contract verification directly to the user in the streaming SSE Agent Ledger.

### 2.2 Real-Time Canonical Cultural Tag Resolution (`urn:tag` / Tag Search)
- **Where Used:** **Stage 0 (`S0`) Interactive Qloo Tag Rail** (`src/web/screens/s0/`) and **Stage 1 (`S1`) Brief Grounding**.
- **How Zorq Uses Qloo:** As an operator types a natural-language operational goal in `S0` (e.g., *"day-to-night creative third place with independent print and acoustic music"*), Zorq queries Qloo’s canonical tag taxonomy in real time, surfacing verified Qloo cultural tags in an interactive rail.
- **Why It Matters:** Eliminates vague prompt engineering by translating human intent directly into Qloo’s structured ontological tag space before the run even begins.

### 2.3 Admired Entity & Anchor Venue Resolution (Entity & Place Search)
- **Where Used:** **Stage 0 (`S0`) "Places We Admire" Input** and **Stage 1 (`S1`) Local Catchment Anchor Discovery**.
- **How Zorq Uses Qloo:**
  1. In `S0`, users can input up to 3 admired reference venues or cultural touchstones anywhere in the world. Zorq resolves these strings into canonical Qloo Entity IDs (`urn:entity:place`), extracting their taste signatures as aspiration anchors.
  2. In `S1`, Zorq queries Qloo around the target latitude/longitude to discover existing high-signal physical anchor venues (`A` through `E`) within the site's geographic catchment radius.
- **Why It Matters:** Grounds the composition in real-world physical anchors rather than hallucinated venue archetypes, and empowers the user to interactively **unpin** any non-representative local anchor on the `S1` map to trigger an instant Qloo re-calculation.

### 2.4 Spatial Taste Concentration & Locality Heatmaps (`urn:heatmap`)
- **Where Used:** **Stage 1 (`S1`) Site Cultural Read Map** (`src/web/screens/s1/`).
- **How Zorq Uses Qloo:** Zorq queries Qloo’s geospatial heatmap endpoint (`urn:heatmap`) using the site’s coordinates and resolved cultural tags/anchors. The returned spatial affinity grid is rendered on a high-contrast MapLibre GL drafting canvas as monochrome halftone dots of varying density.
- **Why It Matters:** Visualizes *where* cultural taste actually concentrates around a block—revealing micro-neighborhood pockets of cultural energy that raw census tracts or foot-traffic counters completely miss.

### 2.5 Bidirectional Place $\leftrightarrow$ Culture Cross-Domain Reads
- **Where Used:** **Stage 1 (`S1`) Cultural DNA Strip** and **Stage 2 (`S2`) Candidate Pool Generation**.
- **How Zorq Uses Qloo:** Zorq executes a two-way cross-domain traversal through Qloo's taste graph:
  - **Direction 1 ($\text{Physical Place} \longrightarrow \text{Cross-Domain Culture}$):** Starting from the resolved local anchor venues (`A`–`E`) and site coordinates, Zorq queries Qloo for over-indexing affinities across **Music Artists**, **Films**, **Brands**, **Literature**, and **Dining** categories.
  - **Direction 2 ($\text{Discovered Culture} \longrightarrow \text{Candidate Venue Concepts}$):** Using the discovered cultural entities as seed signals, Zorq queries Qloo back into the physical place and category domain to nominate a pool of $N=10$ high-affinity venue candidates across 6 functional placemaking roles (*Anchor*, *Social*, *Discovery*, *Experience*, *Night*, *Community*).
- **Why It Matters:** This bidirectional loop is the core creative engine of Zorq. It answers: *"Given the specific films, musicians, and brands that people in this exact neighborhood love, what physical venue concepts naturally belong in their world?"*

### 2.6 Multi-Scale Taste Vectors: Site vs. City Baseline ($N_k^{\text{site}}$ vs. $N_k^{\text{city}}$)
- **Where Used:** **Stage 1 (`S1`) Cultural DNA Cleveland Dumbbell Plots** and **Stage 2 (`S2`) Local Distinctiveness Scoring**.
- **How Zorq Uses Qloo:** For every cultural signal and candidate component $k$, Zorq queries Qloo at **two distinct geographic scales**:
  1. **Micro-Site Scale ($N_k^{\text{site}}$):** High-resolution taste affinity within the immediate walking catchment of the project address.
  2. **Macro-City Scale ($N_k^{\text{city}}$):** The broader metropolitan baseline affinity for the same entities.
- **Mathematical Integration:** Zorq computes the **Local Distinctiveness ($d_k$)** of each component via cosine divergence between the site-scale Qloo vector and the city-scale Qloo vector:
  $$d_k = 1 - \cos\left(\mathbf{V}_{\text{site}}, \mathbf{V}_{\text{city}}\right) = 1 - \frac{\mathbf{V}_{\text{site}} \cdot \mathbf{V}_{\text{city}}}{\|\mathbf{V}_{\text{site}}\| \|\mathbf{V}_{\text{city}}\|}$$
- **Why It Matters:** Without Qloo’s multi-scale spatial resolution, an system cannot tell whether an affinity is genuinely unique to *Crosby Street in SoHo* versus simply popular across all of *New York City*. In `S1`, this surfaces as Cleveland dumbbell dot plots comparing local affinity (solid dot) against city baseline (hollow dot).

### 2.7 Multi-Domain Taste Neighborhoods ($N_k$) & IDF-Weighted Graph Construction
- **Where Used:** **Stage 2 (`S2`) Competing Compositions** and **Stage 3 (`S3`) Map of Meaning & Evidence Drawer**.
- **How Zorq Uses Qloo:** For each of the 10 candidate venue concepts in the pool, Zorq extracts a rich multi-domain **Taste Neighborhood vector ($N_k$)** from Qloo—comprising hundreds of associated cultural entities $e$ with Qloo affinity weights $w_e$.
- **Mathematical Integration (Suppressing Mainstream Noise via IDF):** Even in specialized queries, popular global entities (e.g., *Taylor Swift*, *Starbucks*, *Nike*) can appear across multiple taste neighborhoods. To prevent mainstream ubiquity from inflating compatibility scores, Zorq’s deterministic engine weights every Qloo entity $e$ by its **Inverse Document Frequency ($\text{idf}$)** across the candidate pool:
  $$\text{idf}(e) = \ln\left(\frac{1 + |P|}{1 + \text{df}(e)}\right) + 1$$
  $$\text{weight}_A(e) = w_{A,e} \times \text{idf}(e)$$
  The cultural compatibility edge between Component $A$ and Component $B$ is then computed as the exact cosine similarity of their IDF-weighted Qloo taste vectors:
  $$\text{EdgeStrength}(A, B) = \frac{\sum_{e \in N_A \cap N_B} \text{weight}_A(e) \cdot \text{weight}_B(e)}{\sqrt{\sum_{e \in N_A} \text{weight}_A(e)^2} \cdot \sqrt{\sum_{e \in N_B} \text{weight}_B(e)^2}}$$
- **Why It Matters:** Clicking any edge in `S3` opens the **Evidence Drawer**, which displays the exact shared Qloo cultural entities (specific indie directors, niche record labels, specialty roasters, literary imprints) that bind those two venue concepts together, ranked by their IDF-adjusted Qloo contribution.

### 2.8 Second-Route Triangulation & Evidence Grading
- **Where Used:** **Stage 3 (`S3`) Calibrated Line Fluency** and **Stage 5 (`S5`) Blueprint Evidence Grades (`A`, `B`, `C`)**.
- **How Zorq Uses Qloo:** Zorq never trusts a single query path. Once a leading composition is identified, Zorq executes **Second-Route Triangulation** via Qloo:
  - *Route 1 (Entity Overlap):* Measures shared cultural entities in the candidates' Qloo taste neighborhoods ($N_A \cap N_B$).
  - *Route 2 (Direct Cross-Seeded Probe):* Executes an independent Qloo query seeding Candidate $A$'s canonical tags and anchor entities directly against Candidate $B$'s domain within the locality to verify whether Qloo independently confirms the affinity.
- **How It Surfaces:**
  - **Heavy Solid Line (`Confirmed`):** Both Qloo routes independently confirm strong overlap.
  - **Medium Solid Line (`Typical`):** Standard confirmed affinity.
  - **Dashed Line (`Contested`):** Route 1 and Route 2 diverge in strength.
  - **Dotted Line (`Thin`):** Sparse Qloo entity overlap.
  - **Break-Marks ($\vdash\dashv$):** Highlights the **Weakest Link** (lowest-affinity pair) in the composition.
  - **Conservative Cap Rule ("Worst Wins"):** A composition only earns **Evidence Grade A** in `S5` if *every single finalist edge* is independently confirmed by second-route Qloo triangulation.

### 2.9 Popperian Self-Falsification, Weakest-Link Bridging & Live Node Replacement
- **Where Used:** **Stage 3 (`S3`) Interactive Replace Panel** and **Stage 4 (`S4`) Challenge the Plan**.
- **How Zorq Uses Qloo:**
  1. **Bridge the Weakest Link (`S4` Attack #3):** Zorq identifies the lowest-scoring pair $(u, v)$ in the leading composition and queries Qloo for intersectional cultural entities or hybrid venue formats that simultaneously share high affinity with both $u$ and $v$ in that locality.
  2. **Catchment Shift Sensitivity (`S4` Attack #4):** Zorq re-queries Qloo with tightened and expanded geographic radii around the site coordinates to test whether the cultural composition collapses if the walking catchment shifts by a few blocks.
  3. **Role-Preserving Substitution (`S3` & `S4` Attack #2):** Queries Qloo for alternative candidates within the exact same functional role (e.g., swapping one *Night* concept for another) and computes real-time $\Delta\text{Coherence}$ and weakest-link repairs before the user commits.

### 2.10 End-to-End Provenance Receipts & The "Without-Qloo" Proof
- **Where Used:** **Stage 5 (`S5`) Tufte Margin Receipts, Slope Chart, and Without-Qloo Compare Modal**.
- **How Zorq Uses Qloo:**
  - **3-Dot Provenance Receipts:** Every narrative claim in the final Place Blueprint carries a superscript receipt number linking to an auditable 3-dot Qloo chain in the margin:
    $$\text{Local Anchor Venue (Qloo ID)} \longrightarrow \text{Shared Cultural Entity (Qloo ID)} \longrightarrow \text{Recommended Venue Concept (Qloo Tag/ID)}$$
  - **The Pre-Registered Prior vs. Qloo Reality:** Because Zorq freezes an unassisted LLM hypothesis (`Frozen Prior`) at $t=0$ before any Qloo call is made, Stage 5 (`S5`) provides an empirical side-by-side comparison proving exactly which components Qloo **Kept**, **Reformatted**, **Removed**, or **Added**—or honestly reporting (*"Here, the evidence changed nothing"*) on control sites like Reading Terminal Market where Qloo empirically validates the baseline intuition.

---

## 3. Summary Matrix: Qloo’s End-to-End Integration Across Zorq

| Stage | Qloo Endpoint / Capability | Input Seed Sent to Qloo | Deterministic Engine Operation | Product Surface / UI Artifact |
| :--- | :--- | :--- | :--- | :--- |
| **Startup / `S1`** | `qloo_capabilities` | Gateway contract & domain check | Validates schema checksums & active endpoints | **Live Agent Ledger** diagnostic badge |
| **`S0` Brief** | Canonical Tag Search (`urn:tag`) | Real-time user goal keystrokes | Ranks & filters canonical Qloo tag matches | **Interactive Qloo Tag Rail** |
| **`S0` Brief** | Entity Search (`urn:entity:place`) | User's "Places we admire" (up to 3) | Resolves strings to canonical Qloo Entity IDs | **Resolved Anchor Chips** with Qloo IDs |
| **`S1` Investigate** | Locality Heatmap (`urn:heatmap`) | Site `(lat, lng)` + resolved tags/anchors | Projects spatial taste density onto vector grid | **Halftone Heat Dots** on MapLibre canvas |
| **`S1` Investigate** | Local Anchor Discovery | Site `(lat, lng)` + catchment radius | Selects top 5 local anchors (`A`–`E`) | **Interactive Pin Map** (with live unpinning) |
| **`S1` Investigate** | Multi-Scale Read ($N_k^{\text{site}}$, $N_k^{\text{city}}$) | Local anchors + site vs. city boundary | Computes local over-indexing across Music/Film/Brands | **Cultural DNA Strip** (Cleveland dumbbell plots) |
| **`S2` Compose** | Culture $\rightarrow$ Place Discovery | Over-indexing local cultural entities | Nominates $N=10$ candidates across 6 roles | **Candidate Pool & 4 Competing Composition Cards** |
| **`S2` Compose** | Taste Neighborhoods ($N_k$) | All 10 candidate Qloo IDs/tags | Enumerates all $\binom{10}{5}$ role-valid subsets; computes exact null-model percentile & $d_k$ | **The Field Histogram**, Triad Metrics & **Dynamic Balance Dial ($w \in [0,1]$)** |
| **`S3` Meaning** | Multi-Domain Entity Overlap | Pairwise candidate taste vectors | Computes $\text{weight}(e) = w_e \times \text{idf}(e)$ & MDS node coordinates | **Map of Meaning MDS Canvas** & **IDF Evidence Drawer** |
| **`S3` / `S5`** | Second-Route Triangulation | Direct cross-seeded Qloo verification | Grades edges (`Confirmed`, `Typical`, `Contested`, `Thin`) & caps overall Blueprint Grade | **Calibrated Line Fluency** & **Evidence Grade (`A`/`B`/`C`)** |
| **`S4` Challenge** | Bridging & Radius Shift Probes | Weakest pair $(u,v)$ + tighter/wider radii | Executes 5 Popperian self-falsification attacks | **Challenge Verdict (`Survived`, `Revised`, `Replaced`)** |
| **`S5` Blueprint** | Full Evidence Ledger Store | All Qloo Evidence IDs from the run | Binds every rationale claim to a 3-dot Qloo receipt & compares against Frozen Prior | **Tufte Margin Receipts**, **Slope Chart** & **Without-Qloo Modal** |

---

## 4. Why Zorq is the Best: Alignment with the 4 Evaluation Pillars

### Pillar 1: Technological Implementation
> *How thoroughly and skillfully does the project use Qloo? Does the code demonstrate genuine effort and a working, non-trivial implementation?*

1. **Deepest Possible Qloo Integration (9 Capabilities in a Closed Loop):** Zorq does not merely fetch a list of recommendations from Qloo and display them. It uses Qloo for **ontological tag grounding**, **spatial heatmap projection**, **bidirectional cross-domain traversal** ($\text{Place} \rightarrow \text{Music/Film/Brands} \rightarrow \text{Place}$), **dual-scale spatial comparison** (neighborhood vs. city), **IDF-weighted taste vector construction**, **second-route triangulation**, and **self-falsification bridging**.
2. **Strict Tripartite Architecture (Zero Hallucinated Math):**
   - **Layer 1 — Qloo Empirical Layer:** Supplies all cultural entities, taste weights, spatial heatmaps, and multi-scale vectors.
   - **Layer 2 — Zorq Deterministic Engine (`src/server/engine/` in TypeScript):** Computes all graph edges, IDF weights, exact combinatorial null-model percentiles, cosine distinctiveness, MDS coordinates, constraint downshifts, and triangulation grades. **An LLM is never allowed to invent a score.**
   - **Layer 3 — Bounded Agent Controller (`Rapid Router -> Qwen 3.7 Flash`):** Formulates the pre-registered prior, selects probes within strict turn limits ($\le 3$ planner turns, $\le 2$ mutation rounds), and authors narrative rationales strictly bound to verified Qloo Evidence IDs.
3. **Production-Hardened Engineering:** Features a dedicated `QlooCallBudget` manager (target $\le 180$ calls, hard ceiling $200$, concurrency $6$, TTL caching), `LlmBudget` cost enforcement ($\le \$2.00/\text{run}$), automatic secret redaction across logs and SSE envelopes, durable `TursoStore` (`libSQL`/SQLite) persistence with zero-config `MemoryStore` fallback, and comprehensive Vitest test coverage.

---

### Pillar 2: Design
> *Does the project deliver a complete, coherent product experience rather than just a technical proof of concept?*

1. **Bespoke "Ink on Paper" Architectural Drafting Aesthetic:** Instead of a generic dark-mode SaaS dashboard or a chatbot wrapper, Zorq is designed as an **architectural drafting table and urban design instrument**. Its typography, monochrome halftone maps, and drafting title blocks speak the native visual language of architects, urban planners, and real estate investment committees.
2. **Masterclass in Scientific Information Design:**
   - **Cleveland Dumbbell Dot Plots (`S1`):** Instantly communicates local neighborhood taste over-indexing against the city baseline across Artists, Films, and Brands.
   - **The Field Null-Model Histogram (`S2`):** Shows operators where their chosen composition sits against the entire universe of $252$ valid combinations.
   - **Multidimensional Scaling (MDS) & Calibrated Line Fluency (`S3`):** Canvas distance directly equals cultural distance ($1 - \text{edge strength}$), and line strokes visually encode Qloo triangulation certainty.
   - **Edward Tufte-Style Margin Provenance Receipts (`S5`):** Produces a board-ready, print-formatted architectural blueprint where every claim is footnoted to a 3-dot Qloo provenance chain in the margin.
3. **Radical Operational Transparency:** Replaces opaque loading spinners with a live Server-Sent Events (SSE) **Agent Ledger** that streams every `[Qloo]`, `[Compute]`, and `[LLM]` operation, call duration, result count, and budget consumption in real time.

---

### Pillar 3: Potential Impact
> *Does it make a credible, specific case for solving a real problem for a real audience? Does the demonstrated solution actually address that problem?*

1. **Solving a Multi-Billion-Dollar Commercial Real Estate Problem:** Commercial developers, REITs, municipal placemaking authorities, and mixed-use operators commit capital to $5\text{--}15\text{ year}$ commercial leases. A single mismatched anchor tenant can depress foot traffic across an entire development and trigger millions in vacancy write-downs. Zorq replaces broker intuition with empirical, cross-domain audience compatibility powered by Qloo.
2. **Preserving Neighborhood Identity Against Homogenization:** Cities worldwide suffer from "placelessness"—every neighborhood being programmed with the same generic national chains. By computing **Local Distinctiveness ($d_k = 1 - \cos(\mathbf{V}_{\text{site}}, \mathbf{V}_{\text{city}})$)** via Qloo's multi-scale insights, Zorq mathematically rewards venue concepts that reflect a neighborhood's authentic subcultural DNA.
3. **Bridging Cultural Intelligence and Physical Architecture:** Zorq doesn't stop at abstract cultural concepts. In Stage 5 (`S5`), it translates the Qloo-verified composition into physical square-footage allocations (with an $85\%$ circulation allowance) and executes **Role-Preserving Downshifts** when footprint or noise constraints require it (e.g., automatically downshifting an *Independent Cinema* into a *Micro-Screening Room* while preserving its *Anchor* role and Qloo taste neighborhood).

---

### Pillar 4: Quality of the Idea
> *Is it a creative, non-obvious use of Qloo? Does the team demonstrate genuine understanding of the problem space?*

1. **Non-Obvious Leap: Using Qloo for Combinatorial Ecosystem Design:** Most applications use recommendation APIs to rank individual items for a single user (*"Which restaurant should I visit tonight?"*). Zorq pioneers a completely novel paradigm: using Qloo's cross-domain taste graph as a **combinatorial physics engine** to measure how *multiple different physical venues* will interact as a living ecosystem over years.
2. **Pre-Registered Priors & The Scientific Method in AI:** Zorq introduces formal scientific pre-registration to AI agents. By freezing the unassisted LLM Prior at the start of every run (`"No cultural data used"`) and comparing it against the Qloo-grounded blueprint at the end, Zorq turns every single user session into a controlled empirical experiment proving the value of Qloo.
3. **Popperian Self-Falsification (`S4: Challenge the Plan`):** Rather than acting as a sycophantic pitchbot that defends its first answer, Zorq actively tries to *falsify and break* its own leading composition across 5 structured stress tests (Ablation, Substitution, Weakest-Link Qloo Bridging, Catchment Radius Shift, and Rival Weight Sweeps)—only graduating a blueprint after it survives or adapts to empirical scrutiny.

---

## 5. Deep-Dive: The 6-Stage Protected User Journey

```text
SITE BRIEF (S0)
  ──► FROZEN LLM PRIOR + LIVE QLOO INVESTIGATION (S1)
  ──► COMBINATORIAL FIELD & COMPETING COMPOSITIONS (S2)
  ──► MDS MAP OF MEANING & IDF EVIDENCE DRAWER (S3)
  ──► POPPERIAN SELF-FALSIFICATION & QLOO BRIDGING (S4)
  ──► TUFTE PLACE BLUEPRINT & WITHOUT-QLOO PROOF (S5)
```

1. **`S0` — Site Brief (`src/web/screens/s0/`):** Instant evaluation presets (**Crosby Street, SoHo, NYC**; **Lower Broadway, Nashville**; **Reading Terminal Market, Philadelphia**) alongside a custom brief builder with MapTiler geocoding, usable square footage, operational constraints, admired Qloo entity resolution, and the live Qloo Tag Rail.
2. **`S1` — Investigation & Prior Lock (`src/web/screens/s1/`):** Locks the write-once `Frozen Prior`, streams the real-time SSE Agent Ledger, projects Qloo `urn:heatmap` taste density onto the interactive catchment map with unpinnable local anchors (`A`–`E`), and renders the multi-scale Cultural DNA Strip.
3. **`S2` — Cultural Graph & Compositions (`src/web/screens/s2/`):** Displays **The Field** histogram across all role-valid subsets, pits the Frozen Prior (`P`) against three engine-built Qloo compositions (`A`, `B`, `C`), exposes the Auditable Triad Metrics (*Coherence Percentile*, *Distinctiveness*, *Weakest Link*), and provides the interactive Familiar-vs-Distinctive balance dial ($w \in [0, 1]$).
4. **`S3` — Connections & Map of Meaning (`src/web/screens/s3/`):** Renders the MDS network canvas where spatial distance reflects cultural proximity, encodes second-route Qloo triangulation into line strokes, exposes shared Qloo entities in the IDF-weighted **Evidence Drawer**, and enables live role-preserving node replacements.
5. **`S4` — Challenge the Plan (`src/web/screens/s4/`):** Subjects the leading plan to 5 automated falsification attacks powered by Qloo bridging and spatial sensitivity probes, emitting a deterministic code verdict (**Survived**, **Revised**, or **Replaced**).
6. **`S5` — Place Blueprint & Without-Qloo Comparison (`src/web/screens/s5/`):** Produces the printable Tufte-style architectural blueprint with square-footage budgets, role-preserving downshifts, 3-dot Qloo margin receipts, the Prior-to-Final slope chart, and the side-by-side **Without-Qloo Compare Modal**.

---

## 6. Complete Local Setup, Production Deployment & License

For quick-start terminal commands, see **[`README.md`](./README.md)**.

### Quick Verification Commands
```bash
git clone https://github.com/louji2308/zorq.git
cd zorq
npm ci
cp .env.example .env
# Add QLOO_API_KEY and RAPIDROUTER_API_KEY to .env
npm run typecheck && npm run lint && npm test
npm run build && npm start
```

### Production Infrastructure Summary
- **Live URL:** [https://zorq-12dk.onrender.com](https://zorq-12dk.onrender.com)
- **Containerization:** Two-stage Docker build (`deployment/Dockerfile`) on `node:22-slim` running as non-root `UID 1000` with zero baked secrets.
- **Persistence:** Durable `TursoStore` (`@libsql/client`) for runs, append-only SSE ledger events, Qloo evidence records, and shareable blueprint snapshots, paired with automatic in-memory fallback (`MemoryStore`).
- **Continuous Availability:** Automated CI verification (`.github/workflows/ci.yml`) and 10-minute health keep-alive pings (`.github/workflows/health-ping.yml`) against `/healthz`.
- **License:** Open-source under the **[MIT License](./LICENSE)** — Copyright (c) 2026 Zorq contributors.
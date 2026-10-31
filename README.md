# Zorq: Cultural Composition Intelligence for Physical Places

[![Live Deployment](https://img.shields.io/badge/Live_Deployment-zorq--12dk.onrender.com-000000?style=for-the-badge&logo=render&logoColor=white)](https://zorq-12dk.onrender.com)
[![Node Version](https://img.shields.io/badge/Node.js-%E2%89%A522.19.0-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Engine-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Powered by Qloo](https://img.shields.io/badge/Cultural_Intelligence-Qloo_API-FF5A5F?style=for-the-badge)](https://www.qloo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F7DF1E?style=for-the-badge)](./LICENSE)

> **"What combination of people, culture, and belonging should this place host, and why?"**

**Zorq** is an autonomous cultural composition agent and deterministic mathematical measurement system engineered for physical placemaking, commercial development, urban planning, and venue curation. 

- **Live Production Application:** [https://zorq-12dk.onrender.com](https://zorq-12dk.onrender.com)
- **Comprehensive Project Description:** For a crystal-clear, deep-dive breakdown of our thesis, mathematical proofs, and evaluation alignment, see **[`PROJECT DESCRIPTION.md`](./PROJECT%20DESCRIPTION.md)**.
- **Exhaustive Qloo Intelligence Architecture:** For a complete technical breakdown of all 9 Qloo capabilities, taste vectors, and Without-Qloo proofs, see **[`QLOO DESCRIPTION.md`](./QLOO%20DESCRIPTION.md)**.

---

## 1. What is Zorq & What Problem Does It Solve?

### The Placemaking Problem
When commercial developers, REITs, venue operators, and municipal planning teams program a mixed-use physical space, they traditionally operate in disconnected silos (*"We need a café, a bookstore, a boutique, and an evening venue"*). Decisions are routinely driven by three flawed inputs:
1. **Raw Proximity ("What is nearby"):** Assumes neighboring businesses are culturally compatible, frequently triggering audience cannibalization or jarring tenant friction.
2. **Census Demographics & Raw Foot-Traffic:** Counts bodies moving past a window without measuring whether those audiences share taste overlap or dwell compatibility.
3. **Broker Intuition & Portfolio Replay:** Copy-pastes tenant mixes from other markets that fail to resonate with the specific neighborhood's cultural fabric.

Meanwhile, **generic LLMs fail at placemaking** because they fall into the *popularity trap*: they recommend median, homogenized concepts (e.g., artisanal sourdough bakery, craft cocktail bar, generic coworking hub) with zero neighborhood-level awareness, zero cross-domain audience verification, and zero auditable evidence.

### The Zorq Solution: Ecosystem Composition
A physical place is not a collection of isolated leases—it is an interconnected cultural ecosystem where a specialty coffee shop shapes the foot traffic of an adjacent bookstore, and an independent cinema transforms the evening dining audience.

Zorq shifts the fundamental unit of spatial intelligence:
- **From Isolated Item Recommendation:** $\text{Candidate } A \text{ vs. Candidate } B \text{ vs. Candidate } C$
- **To Ecosystem Composition:** $\text{Candidate } A + B + C + D \longrightarrow \text{Does this cultural combination belong together in this exact locality?}$

Every single metric in Zorq is computed by a deterministic TypeScript mathematical engine backed by empirical cultural data from **Qloo**. No score is ever hallucinated or authored by an LLM.

---

## 2. Step-by-Step Installation & Local Setup Guide

Zorq is architected for zero-friction developer onboarding and deterministic verification. Follow the steps below to run the full stack locally.

### Prerequisites
- **Node.js:** Version $\ge 22.19.0$ (includes `npm`)
- **Git:** Installed and configured
- **API Keys:**
  - `QLOO_API_KEY`: Required for live empirical cultural intelligence and taste neighborhood reads.
  - `RAPIDROUTER_API_KEY`: Required for the LLM agent controller (`Qwen 3.7 Flash`).
  - `VITE_MAPTILER_KEY`: Public key for interactive vector map tiles and real-time address geocoding.
  - `TURSO_DATABASE_URL` & `TURSO_AUTH_TOKEN`: Optional credentials for persistent `libSQL`/SQLite storage (automatically utilizes the built-in high-performance `MemoryStore` when omitted).

### Step 1: Clone the Repository & Install Dependencies
Open your terminal and execute a clean lockfile installation:

```bash
git clone https://github.com/louji2308/zorq.git
cd zorq
npm ci
```

### Step 2: Configure Environment Variables
Duplicate the provided environment template:

```bash
cp .env.example .env
```

Open `.env` in your editor and configure your keys:

```ini
# --- Required for Live Cultural Intelligence & Agent Controller ---
QLOO_API_KEY=your_qloo_api_key_here
RAPIDROUTER_API_KEY=your_rapidrouter_api_key_here

# --- Frontend Interactive Map & Geocoding Key ---
VITE_MAPTILER_KEY=your_maptiler_key_here

# --- Optional Durable Persistence (Turso libSQL) ---
# Automatically defaults to high-speed in-memory store if left blank
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# --- Runtime Configuration ---
APP_BASE_URL=http://localhost:3000
NODE_ENV=development

# --- Operational Bounds & Safety Defaults ---
LLM_BUDGET_USD=2.00
MAX_QLOO_CALLS=180
QLOO_CONCURRENCY=6
QLOO_CACHE_TTL_SEC=21600
PERSIST_QLOO_DERIVED=false
```

### Step 3: Verify Type-Safety, Code Quality & Test Suite
Run Zorq's verification pipeline to confirm strict TypeScript compilation, linting rules, and unit/integration test suites:

```bash
# Verify full-stack TypeScript compilation
npm run typecheck

# Validate code style and architectural rules
npm run lint

# Execute the automated Vitest verification suite
npm test
```

### Step 4: Launch in Development Mode (Hot-Reloading)
Run the backend Express/Agent server and the Vite React frontend concurrently across two terminal tabs:

**Terminal 1 — Backend API, Qloo Transport & Agent Controller:**
```bash
npm run dev:server
# Starts Express API & SSE stream server at http://localhost:3000
```

**Terminal 2 — Frontend Architectural Drafting Client:**
```bash
npm run dev:web
# Starts Vite dev server at http://localhost:5173 (proxied to :3000)
```
Navigate to `http://localhost:5173` in your browser to launch Zorq.

### Step 5: Verify Production Single-Origin Build Locally
To test the exact unified production container bundle on your machine:

```bash
npm run build
npm start
```

Verify the live health endpoint in a separate terminal:
```bash
curl http://localhost:3000/healthz
# Returns HTTP 200 OK: {"status":"ok","version":"0.1.0",...}
```
Open `http://localhost:3000` in your browser.

---

## 3. The Central Role & Importance of Qloo

Qloo is the empirical foundation of Zorq. Rather than treating Qloo as a superficial lookup at the end of a prompt chain, Zorq embeds Qloo across every stage of its autonomous investigation, graph construction, triangulation, and self-falsification loop.

| Qloo Capability | How Zorq Utilizes It | Where It Surfaces in the Product |
| :--- | :--- | :--- |
| **`qloo_capabilities` Probe** | Executes runtime diagnostic checks confirming gateway readiness, supported operations, and contract checksums. | **S1 Live Agent Ledger** diagnostic verification receipts. |
| **Locality & Heatmap (`urn:heatmap`)** | Quantifies exact geographic taste concentration and cultural density around the target site coordinates. | **S1 Site Cultural Read Map** rendered as monochrome halftone heat dots. |
| **Entity & Place Search** | Discovers candidate local venues and resolves user-submitted "Places we admire" into canonical Qloo entity IDs. | **S0 Brief Resolution** & **S1 Anchor Candidate Discovery**. |
| **Canonical Tag Resolution** | Translates natural-language operational goals into canonical Qloo cultural tags in real time as the user types. | **S0 Interactive Tag Rail**, component metadata, and provenance chains. |
| **Place $\leftrightarrow$ Culture Bidirectional Reads** | Extracts cultural taste signatures from local anchor venues and maps discovered affinities back into physical venue concepts. | **S1 Cultural DNA Strip** & **S2 Candidate Pool Generation**. |
| **Multi-Scale Place Insights** | Queries taste vectors at both the immediate neighborhood scale ($N_k^{\text{site}}$) and the macro city baseline ($N_k^{\text{city}}$). | **S1 Cleveland Dumbbell Plots** & **S2 Local Distinctiveness ($1 - \cos$)** metrics. |
| **Taste Neighborhoods ($N_k$)** | Extracts multi-domain affinity vectors (Music, Film, Dining, Brands, Literature) for every candidate component. | **S2 & S3 Inter-Component Graph Edge Construction** via IDF-weighted cosine similarity. |
| **Second-Route Triangulation** | Runs independent verification queries across finalist pairs to grade relationships as *Confirmed*, *Typical*, *Contested*, or *Thin*. | **S3 Calibrated Line Fluency**, **Evidence Drawers**, and **S5 Evidence Grades**. |
| **Bridge & Replacement Probes** | Queries Qloo for shared subcultural entities that bridge weak component pairs and retrieves role-preserving alternatives. | **S3 Interactive Replace Panel** & **S4 Popperian Self-Falsification Attacks**. |

### The "Without-Qloo" Architectural Proof
Zorq directly proves the indispensable value of Qloo on every run:
1. **Immutable Pre-Registered Baseline:** Before a single Qloo API call is made, Zorq forces the LLM to commit an unassisted hypothesis (`Frozen Prior`) stamped *"No cultural data used."*
2. **Empirical Delta Measurement:** In **S5 (What Qloo Changed)**, a slope chart and side-by-side comparison modal contrast the unassisted LLM Prior against the Qloo-grounded blueprint—highlighting every component Kept, Reformatted, Removed, or Added based on Qloo evidence, or confirming when a strong baseline hypothesis (such as Philadelphia's Reading Terminal Market) is empirically validated by Qloo.

---

## 4. How Zorq Works: The 6-Stage Protected Workflow

Zorq guides operators through an auditable, six-stage workflow styled in a high-contrast **"ink on paper" architectural drafting aesthetic**:

```text
[S0: Site Brief] ──► [S1: Investigate & Prior Lock] ──► [S2: Compositions & Field]
                                                                  │
[S5: Place Blueprint & Without-Qloo] ◄── [S4: Challenge the Plan] ◄── [S3: Map of Meaning]
```

### `S0` — Site Brief (`src/web/screens/s0/`)
- **Instant Evaluation Presets:** Launch curated evaluations immediately across **Crosby Street (SoHo, NYC)**, **Lower Broadway (Nashville)**, or **Reading Terminal Market (Philadelphia)**.
- **Custom Brief & Geocoding:** Enter any address with MapTiler autocomplete, square-footage footprint, operational goals, physical/noise constraints (*No late night*, *No loud venue*, *Ground-floor only*), and up to 3 admired anchor places resolved via Qloo.
- **Real-Time Qloo Tag Rail:** Dynamically suggests canonical Qloo tags as the operator types their vision.

### `S1` — Investigation & Prior Lock (`src/web/screens/s1/`)
- **Frozen Prior Card:** Locks the unassisted LLM baseline composition into memory with an immutable timestamp before external lookups begin.
- **Live Agent Ledger (SSE):** Streams every real-time action tagged as `[Qloo]`, `[Compute]`, or `[LLM]` with millisecond durations, result counts, and call budget tracking (`47 of ~180 lookups`).
- **Site Cultural Read Map:** Visualizes Qloo `urn:heatmap` density as halftone dots alongside interactive anchor pins (`A`–`E`) that users can unpin to trigger an instant recalculation.
- **Cultural DNA Strip:** Cleveland dumbbell dot plots contrasting neighborhood affinity (solid dot) against city-wide baselines (hollow dot) across Artists, Films, and Brands.

### `S2` — Cultural Graph & Competing Compositions (`src/web/screens/s2/`)
- **The Field Histogram:** Enumerates the complete universe of role-valid combinations (e.g., all $252$ valid $K=5$ subsets from a $10$-candidate pool) ranked by exact mathematical coherence.
- **Four Competing Cards:** Pits `P` (Frozen Prior) against three engine-built compositions (`A`, `B`, `C`) across three auditable metrics: **Coherence Percentile**, **Local Distinctiveness**, and **Weakest Link**.
- **Dynamic Balance Dial:** A client-side slider ($w \in [0, 1]$) allowing real-time re-ranking between *Familiar Coherence* and *Local Distinctiveness*.

### `S3` — Connections & Map of Meaning (`src/web/screens/s3/`)
- **Multidimensional Scaling (MDS) Canvas:** Positions components spatially using MDS of $(1 - \text{edge strength})$ so canvas distance directly mirrors cultural affinity.
- **Calibrated Line Fluency:** Encodes Qloo triangulation certainty directly into line geometry: heavy solid (*confirmed*), medium solid (*typical*), dashed (*contested*), dotted (*thin*), and break-marks ($\vdash\dashv$) on the weakest link.
- **IDF Evidence Drawer & Live Node Replacement:** Clicking any edge reveals shared Qloo entities weighted by Inverse Document Frequency (suppressing mainstream ubiquity like Starbucks or Taylor Swift to surface authentic subcultural overlap). Operators can swap nodes with live $\Delta\text{Coherence}$ previews.

### `S4` — Challenge the Plan (`src/web/screens/s4/`)
- **Popperian Self-Falsification:** The agent actively attempts to break its own winning recommendation across five structured stress tests:
  1. **Ablation:** Removes the primary anchor to test ecosystem resilience.
  2. **Substitution:** Tests alternative Qloo candidates for superior coherence.
  3. **Bridge the Weakest Link:** Queries Qloo for a shared cultural concept that bridges the lowest-affinity pair.
  4. **Catchment Shift:** Expands and tightens the geographic radius to verify spatial stability.
  5. **Rival Check:** Sweeps $w \in [0, 1]$ to identify exact leadership crossover points.
- **Deterministic Verdicts:** Emits an auditable code verdict—**Survived**, **Revised**, or **Replaced**.

### `S5` — Place Blueprint & Without-Qloo Comparison (`src/web/screens/s5/`)
- **Tufte-Style Architectural Blueprint:** Generates a print-ready decision artifact featuring an architectural title block, role assignments (*Anchor*, *Social*, *Discovery*, *Experience*, *Night*, *Community*), and square-footage allocations with an $85\%$ circulation allowance.
- **Role-Preserving Downshifts:** Automatically adapts venue formats to fit physical or operational constraints while preserving cultural roles (e.g., *"Cinema downshifts to Micro-Screening Room — Role Preserved: Anchor"*).
- **Margin Provenance Receipts:** Every claim carries a superscript receipt linking to a 3-dot provenance chain ($\text{Anchor Place} \rightarrow \text{Qloo Cultural Entity} \rightarrow \text{Venue Category}$) and raw Qloo evidence IDs.

---

## 5. Why Zorq Stands Out: Excellence Across the 4 Core Pillars

> For a deep dive into these pillars and the complete mathematical specification, see **[`PROJECT DESCRIPTION.md`](./PROJECT%20DESCRIPTION.md)** and **[`QLOO DESCRIPTION.md`](./QLOO%20DESCRIPTION.md)**.

### 1. Technological Implementation
- **Deep, Multi-Modal Qloo Integration:** Orchestrates 9 distinct Qloo capabilities across spatial heatmaps, entity resolution, bidirectional place-culture reads, multi-scale neighborhood vectors, second-route triangulation, and bridging probes.
- **Strict Tripartite Separation of Concerns:** Cleanly isolates the **Qloo Empirical Layer**, the **Deterministic TypeScript Compute Engine** (`src/server/engine/`), and the **Bounded Agent Controller** (`Rapid Router -> Qwen 3.7 Flash`).
- **Exact Mathematical Kernels:** Replaces arbitrary AI scoring with **IDF-Weighted Cosine Similarity** ($\text{weight}(e) = w_e \times \text{idf}(e)$), **Exact Combinatorial Null-Model Percentiles** across the full family of valid subsets, and **Cosine Divergence Distinctiveness** ($d_k = 1 - \cos(V_{\text{site}}, V_{\text{city}})$).
- **Production-Grade Engineering:** Enforces strict call budgets (`QlooCallBudget` capped at $180$ target / $200$ ceiling with concurrency $6$), token cost ceilings (`LlmBudget` $\le \$2.00/\text{run}$), automatic secret scrubbing, and full Vitest coverage.

### 2. Design
- **Cohesive "Ink on Paper" Architectural Aesthetic:** Purpose-built for urban planners, architects, and real estate executives rather than generic chat interfaces.
- **High-Craft Information Visualization:** Integrates Edward Tufte-inspired margin receipts, Cleveland dumbbell dot plots, Multidimensional Scaling (MDS) network topologies, calibrated edge fluency, and slope charts.
- **Zero-Black-Box Transparency:** Replaces opaque spinners with a streaming Server-Sent Events (SSE) **Live Agent Ledger**, exposing every Qloo query, compute step, and latency metric in real time.

### 3. Potential Impact
- **De-Risking Multi-Year Capital Commitments:** Commercial real estate leases span $5\text{--}15\text{ years}$, where tenant mismatches cause multi-million-dollar vacancy write-downs. Zorq replaces broker guesswork with empirical audience compatibility.
- **Protecting Urban Cultural Fabric:** Combats urban homogenization ("placelessness") by mathematically surfacing neighborhood-specific taste over-indexing and independent subcultural anchors.
- **Immediate Actionability:** Bridges the gap between abstract cultural data and physical architecture by outputting square-footage budgets, circulation allowances, and constraint-aware format downshifts.

### 4. Quality of the Idea
- **From Item Filtering to Ecosystem Composition:** Pioneers the use of Qloo not to recommend a single movie, song, or restaurant to an individual user, but to compose a **multi-venue physical ecosystem** where diverse cross-domain audiences coexist and cross-pollinate.
- **Scientific Rigor via Pre-Registration & Falsification:** Introduces scientific methodology to AI agents through the **Frozen LLM Prior** (pre-registered baseline) and **Stage 4 Popperian Self-Falsification** (actively trying to disprove the leading plan via Qloo bridging and ablation).

---

## 6. System Architecture & Mathematical Engine

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. QLOO CULTURAL INTELLIGENCE LAYER                                     │
│    Locality heat (urn:heatmap), place ↔ culture reads, multi-scale      │
│    taste vectors (site vs. city), second-route triangulation, bridges   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ 2. ZORQ DETERMINISTIC ENGINE (TypeScript — src/server/engine/)          │
│    IDF-weighted graph edges, exact combinatorial null-model percentiles,│
│    cosine distinctiveness, weakest-link detection, evidence grading,    │
│    footprint & circulation allocation, role-preserving downshifts       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ 3. AGENT CONTROLLER (Rapid Router → Qwen 3.7 Flash)                     │
│    Write-once Frozen Prior formulation, probe selection, anchor         │
│    nomination, falsification strategy, evidence-bound narrative         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Mathematical Formulations

1. **IDF-Weighted Edge Strength:**
   $$\text{weight}(e) = w_e \times \text{idf}(e)$$
   $$\text{EdgeStrength}(A, B) = \frac{\sum_{e \in A \cap B} \text{weight}_A(e) \cdot \text{weight}_B(e)}{\|\mathbf{w}_A\| \|\mathbf{w}_B\|}$$

2. **Exact Null-Model Coherence Percentile:**
   $$\text{Percentile}(C_{\text{target}}) = \frac{100 \times \left|\{C \in \mathcal{F} : \text{coherence}(C) < \text{coherence}(C_{\text{target}})\}\right|}{|\mathcal{F}|}$$
   *(Where $\mathcal{F}$ is the complete enumerated family of role-valid subsets of size $K$.)*

3. **Local Distinctiveness ($d_k$):**
   $$d_k = 1 - \cos\left(\mathbf{V}_{\text{site}}, \mathbf{V}_{\text{city}}\right)$$

---

## 7. Production Deployment & Operational Architecture

Zorq is deployed live at **[https://zorq-12dk.onrender.com](https://zorq-12dk.onrender.com)** as a unified single-origin container serving the React SPA, Express API, SSE stream ledger, and Qloo transport layer.

- **Multi-Stage Docker Build (`deployment/Dockerfile`):**
  - *Build Stage (`node:22-slim`):* Installs clean dependencies (`npm ci`), compiles backend TypeScript (`tsc -p tsconfig.build.json`), bundles the Vite frontend client, and prunes dev dependencies.
  - *Runtime Stage (`node:22-slim`):* Executes under a non-root user (`UID 1000`) with only compiled `dist/` artifacts and production modules. Zero secrets are baked into the image.
- **Render Blueprint & Automation (`deployment/render.yaml` & `deployment/render-deploy.mjs`):** Declarative infrastructure-as-code paired with an idempotent deployment script that syncs environment variables, triggers container builds, and smoke-tests `/healthz`.
- **Resilient Persistence (`TursoStore` & `MemoryStore`):** Persists runs, append-only ledger events, Qloo evidence receipts, and shareable blueprint snapshots via `@libsql/client`, with automatic zero-config fallback to `MemoryStore` for instant local execution.
- **High Availability & CI/CD (`.github/workflows/`):**
  - `ci.yml`: Validates every push and PR across lockfile integrity, typechecking, linting, Vitest suites, and production builds.
  - `health-ping.yml`: Pings `/healthz` every $10\text{ minutes}$ to guarantee zero cold-start latency during live evaluations.

---

## 8. License & Open-Source Governance

Zorq is released as open-source software under the **[MIT License](./LICENSE)**.

- **Copyright:** Copyright (c) 2026 Zorq contributors.
- **Permissions:** Commercial use, modification, distribution, sublicensing, and private deployment are freely permitted provided the copyright and license notices are retained.
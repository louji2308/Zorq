# ZORQ — Implementation State (mutable)

> Canonical implementation-state record. Contract: `AGENTS.md` + `ProjectSpec/IMPLEMENTATION_PLAN.md`.
> Read-only authorities live in `ProjectSpec/`. Do not duplicate them here.
> `SESSION_HANDOFF.md` deleted 2026-10-08 — its briefing is fully absorbed by this
> file and the git history; this file wins on any conflict.

## Current Phase

**PHASE 8 — S4/S5: Challenge, Constraint Fit & Blueprint.** Status: **CLOSED
2026-10-17 — exit gate PASSED** on the user-approved fixture judge path (clause
map in `Phase 8 Exit-Gate Status` below). Landed: W-8.1 `0c8ba6f`, W-8.2a
`f786607`, W-8.2b `6903c25`, W-8.3 `ff54a0d`, W-8.4 `99510fc`, W-8.5 `424cf76`,
W-8.6 `cce7b87`, exit-gate e2e `0f3620a` + `d4edc90`, compare-modal fix
`8d71f49`, independent-review fix wave `90bcf13` (fix) + `f8b2172` (test), plus
docs commits. The one deferred clause — full judge path **under real services** —
waits on B-02 (user-side DeepSeek top-up) and runs as the first live action of
Phase 9; recorded in the clause map, not hidden.
**PHASE 9 — Full-System Integration, Deployment & Judge Readiness: CONTRACT
WRITTEN 2026-10-17 at the phase boundary (full seven-source spec re-read; see
`PHASE 9 CONTRACT` above); implementation next** (W-9.1 port/health → W-9.2
Render deploy → W-9.3 CI/health workflows → W-9.4 /method content → W-9.5
README/repo surfaces → W-9.6 full-path e2e → W-9.7 live Qloo-removal A/B).
Parallel user-side: top up DeepSeek (B-02), Turso (B-06). Phase 6 remains OPEN
on B-02 only. Deadline Oct 30 2026 23:45 EDT; internal freeze Oct 28.

## Current Objective

Open Phase 9 under the contract written at its boundary: prove the FULL locked
path end-to-end (Landing → preset → Prior → S1 → S2 → S3 → S4 → S5 →
Without-Qloo → Share/Print) on a real deployment, then ship judge readiness —
Render Docker deploy, CI on push, `/method` content page (formulas, editable
heuristics, limits), and the one live-services judge pass gated on B-02.
Deviations to carry: B-09 SSE history gap, B-10 GET-only evidence, /method route,
deferred review polish B-11, S5 in-place Replace (D-8.16). Deadline Oct 30 2026
23:45 EDT; internal freeze Oct 28.

### PHASE 9 CONTRACT (WRITTEN 2026-10-17 — at the phase boundary, after full
### seven-source spec re-read: plan section read direct, other six sources
### briefed via four parallel read-only spec agents; orchestrator-direct)

```text
PHASE:        9 — Full-System Integration, Deployment & Judge Readiness
MISSION:      (Plan 819) Turn the implementation into a public, reliable,
              self-explanatory submission candidate.
WHY:          Phases 0–8 built and proved the product on fixtures; nothing yet
              exists that a fresh judge can reach without us in the room. This
              phase closes the four remaining submission surfaces — full
              public path, hosted deployment, CI + health, judge-facing
              documentation (README + /method) — plus the honest Qloo-removal
              A/B proof that makes the Qloo integration undeniable. It is the
              only phase between the closed Phase 8 gate and the Phase 10
              red-team gate (Plan 899+: "no feature enters unless it fixes a
              release-blocking defect").

CURRENT-STATE ASSUMPTIONS (verified at boundary 2026-10-17):
  - Phase 8 CLOSED (`e238db3`); gates green: typecheck 0, lint 0, 746 pass /
    5 gated-live skips, Playwright 10/10, build PASS; fixture-browser walk
    proven (`tmp/phase8-walk.json`, zero console errors).
  - S0–S5 screens, share route, and the /method frontend route exist;
    GET /api/method belongs to the locked route surface as a stub; the fixture
    judge pipeline proves the full chain API-level (challenge → blueprint →
    without-Qloo → share).
  - `deployment/Dockerfile` + `deployment/render.yaml` exist (Phase 2,
    review-only — D-0.6: Docker absent locally; image never built; render.yaml
    documents the known PORT gap).
  - `.github/` does NOT exist — no CI workflows yet.
  - `README.md` exists (158 lines) but is unaudited against the Plan's 14
    above-fold items (Plan 855–870) + T&R 301–303 repository contents.
  - Live-services judge path AND the Qloo-removal A/B run wait on B-02
    (user-side DeepSeek top-up); everything else proceeds on fixtures.
  - Carried deviations: B-09 SSE history gap, B-10 GET-only evidence, B-11
    (7 items incl. shift-scale operator gap), D-8.16 S5 in-place Replace,
    /method stub, listen-port derived from APP_BASE_URL (Phase 2 open item —
    NOW in scope: Render injects PORT).
  - Gate G / T&R 237 organizer clarification (cache/persistence/key lifetime
    through judging) still unverified — persistence stays conservative
    (`PERSIST_QLOO_DERIVED=false` default); do not relax it in this phase.
  - Dates: internal freeze Oct 28, hard freeze Oct 29, deadline Oct 30 11:45
    PM EDT, judging through Nov 16. Render Free: 750 instance-hours/month —
    start ~Oct 20 (288 h Oct + 384 h Nov 1–16 fits); 15-min spin-down, ~1 min
    wake; scheduled health ping every ~10 min is best-effort warm-up only
    (T&R 46), never an uptime claim.

IN-SCOPE CAPABILITIES (ordered by dependency):
  W-9.1 Production boot + health hardening [smallest first]
       - honor platform-injected `PORT` (fix the recorded Phase 2 item:
         resolve config reads `PORT` first, falls back to APP_BASE_URL-derived
         3000) with local-dev behavior unchanged.
       - production-build smoke: `npm ci && npm run build && npm start` under
         `NODE_ENV=production` → /healthz healthy with zero secrets in the
         response; degraded boot (503 + named vars, D-2.2) preserved.
  W-9.2 Render deploy (Plan 836–842)
       - validate `deployment/Dockerfile` + `render.yaml` against a real
         Render Free Docker web service: one same-origin service serving
         React static + Express API + agent + Qloo MCP + deterministic engine,
         Turso persistence; **Qloo MCP never serverless-only** (T&R 42).
       - operator checklist: dashboard-managed env vars
         (`QLOO_API_KEY`, `DEEPSEEK_API_KEY`, `TURSO_*`, `APP_BASE_URL`,
         `NODE_ENV`, budget vars) — names only in git (render.yaml `sync:false`).
       - first live boot evidence: healthy /healthz on the public URL, static
         assets served, SSE through the public URL, Turso write/read
         round-trip, share snapshot reachable, zero browser console errors.
  W-9.3 CI + scheduled health (Plan 843–853 / T&R §18)
       - `.github/workflows/ci.yml` on push: install → typecheck → lint →
         unit tests → build → Playwright smoke where appropriate (no secrets
         anywhere in the workflow).
       - `.github/workflows/health.yml`: scheduled `GET /healthz` every ~10 min
         from Oct 20 through judging end (T&R 318–322), loud failure, no
         secret exposure; explicitly best-effort, not a guarantee.
  W-9.4 /method content (Plan 871–880 / FD §7.7 690–699 / PS 234)
       - replace the stub with the full page: what Qloo measures · what Zorq
         computes · what the agent decides · formulas with WORKED EXAMPLES on
         real preset entities (IDF edge, null-model percentile,
         distinctiveness, triangulation, evidence grade) · heuristics listed
         and marked editable (`[Zorq heuristic]`: format library, role map,
         85% rule) · evidence grades · the five known limits (PS 374–380) ·
         open-source setup · two-sentence type note · "How Zorq can be wrong".
       - evidence-drawer / blueprint "How this was computed" anchors resolve to
         real page anchors; NO new API routes (11-route surface stays locked).
  W-9.5 README + repository surfaces (Plan 854–870 / T&R 301–303)
       - README above the fold: problem · solution · live URL · screenshot ·
         setup · Qloo integration · why Qloo is indispensable · architecture ·
         local run · deployment · method · limitations · security · license ·
         judge path (audit current 158-line README, rewrite to clause).
       - repo surfaces: `.env.example` placeholders only, architecture diagram,
         Qloo integration table, test instructions, screenshots, /method
         mirrored in docs, truthful git timeline (T&R 305).
  W-9.6 Full public-path browser suite (Plan 822–835)
       - extend the fixture e2e to the COMPLETE path on production dist:
         Landing → preset → Prior → S1 + DNA → S2 → S3 → S4 → S5 →
         Without-Qloo → Share/Print, one journey with honest state at each
         step; re-run post-deploy against the public URL where fixtures allow.
  W-9.7 Qloo-removal A/B proof (Plan 881–888)
       - same brief: A = Zorq + Qloo evidence, B = without Qloo cultural
         evidence; compare membership, ordering, graph relationships,
         rationale, evidence, final blueprint. Document genuine dependency;
         NEVER maximize divergence artificially. Requires real services
         (B-02) for A; record honestly if still blocked, as Phase 8 did.

REQUIRED INVARIANTS:
  - One same-origin Render service; Qloo MCP not serverless-only.
  - Keys server-only: no secrets in CI logs, README, screenshots, /healthz.
  - Prior write-once; no fallback manufactures evidence; unknown evidence IDs
    never render; all Phase 8 honesty floors stay green (746-test baseline).
  - Route surface stays locked at 11; /method adds no endpoints.
  - Budgets untuned: Qloo ≤180 target/≈200 ceiling, concurrency 6, ≤3 turns,
    ≤2 mutation rounds, $2 LLM cap.
  - Fixture fakes remain test-only; public path under live services uses real
    Qloo + real DeepSeek (AGENTS §12).
  - Conservative Qloo cache/persistence posture stays until Gate G answers.

DEPENDENCIES:  W-9.1 → W-9.2 → live checks; W-9.3 parallel with W-9.4/W-9.5;
               W-9.6 extends existing e2e (needs W-9.1–9.2 for the deployed
               leg); W-9.7 last (needs B-02).
NON-GOALS:     Phase 10 red-team audits (hardcode audit, per-endpoint API
               verification, chaos/recovery, agent behavior audit);
               S5 in-place Replace (D-8.16); B-11 polish items unless a
               judge-blocking defect surfaces; any NEW feature (Plan 902);
               paid infra (no pre-spend; fallback host only if Render fails,
               T&R 346); video (not required — Hackathon L95).
RISK HOTSPOTS: Docker build observable only on Render (no local Docker,
               D-0.6); Render spin-down/cold-start during judging; PORT fix
               regressions on local dev; free-runner CI minutes; README/method
               accuracy (no claim beyond evidence, forbidden-claims list);
               B-02 blocking the live A/B + fresh-judge live proof; screenshot
               freshness for gallery images (FD §11).
ACCEPTANCE:    typecheck 0 · lint 0 · unit green (≥746 baseline) · build PASS ·
               full-path e2e green on production dist · CI workflows green on
               push · public URL healthy (/healthz 200, no secrets) · fresh
               browser pass on the public URL, zero console errors · README +
               /method audited clause-by-clause against Plan 854–880 · A/B
               Qloo-removal comparison recorded live, or honestly deferred with
               user decision (never faked).
VERIFICATION:  focused test per fix → full ladder on dist → CI green on
               GitHub → deployed smoke (health, static, SSE, Turso, share) →
               clause map vs Plan 819–890 + T&R §17–18 + Architecture §22/§27.
ARTIFACTS:     `.github/workflows/{ci,health}.yml`; PORT-aware listen config;
               README.md rewrite; /method page content (frontend only);
               deployment operator checklist; A/B comparison evidence entry.
COMMIT SCOPE:  3–6 coherent commits (boot/health hardening; CI workflows;
               method content; README + repo surfaces; full-path e2e;
               docs close).
EXIT GATE:     (Plan 890) A fresh judge can open the public URL and reach a
               meaningful result without login, private credentials, hidden
               developer intervention or a fabricated data layer. Clause map vs
               Plan 819–890 + T&R §17–18 + Architecture §22/§27; live A/B
               proof recorded or honestly deferred with the user's decision
               (same disposition discipline as Phase 8's fixture close).
```

### PHASE 8 CONTRACT (ARCHIVED 2026-10-17 — phase CLOSED, exit-gate PASSED;
### clause map in `Phase 8 Exit-Gate Status` below. Written 2026-10-15.)

```text
PHASE:        8 — S4/S5: Challenge, Constraint Fit & Blueprint
MISSION:      (Plan 734) Make the autonomous loop visibly defend and finalize a
              plan: stress the leader, adapt it to physical constraints, and hand
              the user an evidence-bound Place Blueprint plus an honest
              without-Qloo comparison.
WHY:          The protected Zorq loop is Brief → Prior → Qloo → evidence →
              deterministic measurement → compositions → SELF-CHALLENGE →
              constraint fit → Blueprint → Without-Qloo. Phases 5-7 shipped the
              left half (measurement, compositions, replace, graph, evidence).
              S4/S5 are the payoff the judge screens: challenge = the product's
              differentiator; Blueprint = the deliverable; Without-Qloo = the
              honesty control. Without this phase the app ends at a dashboard.

CURRENT-STATE ASSUMPTIONS (verified at boundary):
  - Pipeline proven through S3: prior lock, investigation, measurement kernel,
    compositions + null-model percentile, triangulation, rival sweep, replace
    (mini-stress, revisions), evidence drawer, SSE + recovery, fixture e2e.
  - `runStateSchema.stressReport`/`constraintFit` are `z.unknown()`; blueprint
    does NOT exist on RunState (routes.ts blueprintSchema is a separate response
    shape with z.unknown internals).
  - Challenge/recompute/blueprint routes are honest 503 stubs
    (routes.ts `unimplemented`); /method is a Phase 9 stub.
  - Mini-stress (replace.ts) already computes ablation + rival deterministically
    over pool/graph/ranked; its kernels are reusable.
  - SSE hub already declares `stress` and `blueprint` frame events (z.unknown).
  - RunRoute has views investigate|compositions|connections only; no S4/S5 view.
  - briefSchema carries areaSqFt, objective, constraints[] — the constraint
    engine's raw inputs; no format library exists anywhere.
  - Engine exports: buildCompositions, rankCompositionSet, rivalSweep,
    measureComposition, buildGraph, computeIdf, distinctiveness, triangulation.
  - Gateway: insights/tags/search/bridge probe capability exists (Phase 6 tool
    surface); Qloo call budget enforced per-run.

IN-SCOPE CAPABILITIES (ordered by dependency):
  W-8.1 Constraint/format engine [deterministic kernel]
       - Format library `[Zorq heuristic]`: ~25 component types × 2-3 formats
         (footprint range sqft, hours profile, noise class, role). Pure data +
         pure functions; every export carries the heuristic marker for /method.
       - fitConstraints(): sum footprint ≤ 85% of areaSqFt (circulation);
         hours/noise filters from brief constraints chips; if infeasible,
         downshift formats (preserve role: "Cinema → micro-screening. Role
         preserved: Anchor.") then drop least load-bearing member (weakest edge);
         emit structured FitResult {footprintBar, hoursBars, downshifts[], drops[],
         feasible, reasons}.
       - Recompute path: re-fit formats only, Prior untouched (routes.ts
         recomputeRequestSchema already typed).
  W-8.2 S4 challenge engine [server pass]
       - POST /api/runs/:id/challenge → orchestrator challengePass.
       - Five attacks in spec order: ablation (reuse replace.ts kernel),
         substitution (same-role swap probe over pool alternatives), bridge
         (weakest-link insertion via gateway bridge search + re-measure),
         catchment (shift-scale: heatmap/city-baseline re-read, honest
         "not measured" if gateway refuses), rival (rank + sweep flip).
       - Verdicts: Survived / Revised (with diff) / Replaced by {rival}.
       - Agent role: choose attack emphasis order from diagnostics (bounded LLM
         turn, ≤3 planner turns; if LLM unavailable, deterministic diagnostic
         order — never fabricate an agent transcript).
       - Mutation: Bridge/Swap/Drop/Shift-scale, max 2 rounds; stop when leader
         survives AND no mutation raises coherence by > ε (ε=1e-6 deterministic).
       - Failed probe → attack row "not completed" + evidence grade capped at B.
       - Persist full stressReport {kind:"challenge", ...} WITHOUT clobbering
         the replace mini report — D-7.16 resolution: mini reports move to
         `stressReport.mini` slot or challenge supersedes only after confirm;
         choose the smallest reversible schema change and record it.
       - Evidence: every probe appends ledger event + evidence record.
       - Qloo budget: challenge reuses per-run budget; hard-fail honest when
         exhausted (attack marked not completed).
  W-8.3 S5 Blueprint [server + route]
       - buildBlueprint(state) → blueprintSchema (title, rationale [LLM-cited
         evidence IDs only], compositionByRole, fitToSite from W-8.1,
         whatQlooChanged {kept/added/removed/reformatted} = Prior→Final diff,
         risks (weakest edge, thin components, contested edges, constraint
         conflicts), evidenceGrade (A/B/C per spec §12 incl. failed-probe cap
         from W-8.2), revisionHistory, methodUrl, shareUrl, generatedAt,
         expiresAt).
       - GET /api/runs/:id/blueprint (+ ?share= token for read-only snapshot).
       - Share: opaque token → Turso-persisted snapshot, read-only, no auth.
       - Copy as Markdown renderer (client-side, deterministic from blueprint).
       - Print stylesheet (grayscale, landscape, endnote receipts).
  W-8.4 Without-Qloo comparison
       - Left column: frozen Prior + LLM-only polish (same constraints, no
         tools) — if polish does not exist at run start, add it during prior
         generation with budget accounting; if it cannot be generated, the
         left column honestly shows Prior alone and says so.
       - Right: final composition. Diff highlighted. "Here, the evidence
         changed nothing." confident-empty case.
  W-8.5 S4/S5 UI
       - RunRoute gains views "challenge" (S4) + "blueprint" (S5) with tab
         underline slide; Open blueprint CTA; verdict banner with square
         (solid/half-hatched/crossed); five attack rows (●/◐/○); leader-as-
         drawn column with in-place strike/slide mutations.
       - BlueprintRoute: title block, rationale + superscripts, composition
         rows + receipts margin, fit-to-site bars, What Qloo changed slope,
         risks, grade + /method link, revision block, Share/Copy/Print.
       - Without-Qloo compare modal (960px, Esc + Close).
       - Evidence-state honesty: unknown evidence IDs never render as Qloo.

REQUIRED INVARIANTS:
  - Prior write-once; challenge/constraint/blueprint never mutate Prior.
  - All numbers deterministic from normalized inputs; LLM never authors
    numeric truth (verdict wording may be LLM; the verdict itself and all
    metrics are code).
  - UI claim → Evidence ID → ledger → Qloo path; unmeasurable = honest
    "not measured"/"not completed".
  - Challenge and replace coexist: a replace after challenge must not silently
    erase the challenge verdict (D-7.16 resolved explicitly).
  - Autonomy: ≤3 planner turns, Qloo ≤180/run target, mutation rounds ≤2.
  - No fake data, no fabricated probes, no silent fallbacks.

DEPENDENCIES:  W-8.1 → W-8.3; W-8.2 → W-8.3 (grade cap, risks, verdict feed
               blueprint); W-8.4 needs prior + final (both exist); W-8.5 last.
NON-GOALS:     /method full content page (Phase 9); re-inking motion (deferred
               in Phase 7); FD-684 ledger-history replay (B-09 stays escalated);
               auth/payments; multi-agent runtime; tuning budget constants.
RISK HOTSPOTS: challengePass orchestration correctness; stressReport schema
               evolution (D-7.16); share-token snapshot durability; Without-
               Qloo polish generation cost; blueprint schema z.unknown → typed
               without breaking SSE unknown-frame tolerance; e2e surface growth.
ACCEPTANCE:    typecheck 0 · lint 0 · unit green · build PASS · e2e covers
               challenge → blueprint → without-Qloo on fixture pipeline ·
               secret scan 0 hits · browser walk on production dist with zero
               console errors · honest refusal paths unit-tested (busy run,
               exhausted budget, unmeasurable state).
VERIFICATION:  focused unit per kernel → orchestrator integration tests →
               api route tests → fixture-pipeline e2e → full ladder → browser.
ARTIFACTS:     src/server/engine/formats.ts, fit.ts; src/server/orchestrator/
               challenge.ts; src/server/blueprint/*; shared schemas typed;
               web/screens/s4/*, s5/*; routes wired; tests per module.
COMMIT SCOPE:  3-6 coherent commits (constraint kernel; challenge engine;
               blueprint+share; without-qloo; UI; docs close).
EXIT GATE:     full judge path honest under real services; clause map vs Plan
               734-808 + ProductSpec S4/S5 + Final Design 7.4-7.5; every
               worker (self) diff reviewed; no fake production behavior.
```

### PHASE 7 CONTRACT (ARCHIVED 2026-10-15 — phase closed; exit-gate clause map in
### `Phase 7 Exit-Gate Status` below. Written 2026-10-11, before delegation.)

```text
PHASE:        7 — S2/S3: Compositions, Field, Graph & Evidence
MISSION:      Make the cultural composition engine technically inspectable and
              visually memorable. (Plan §Phase 7, verbatim.)
WHY:          Phases 4–5 built and persisted the measurement kernel, but no production
              code path ever calls it: the orchestrator's "measurement" pass is a
              placeholder ledger event, RunState's S2/S3 nodes are z.unknown()
              placeholders, and RunRoute honestly withholds "See compositions".
              Without server-side measurement wiring plus S2/S3, the judge can never
              answer the exit-gate question from an edge — the deterministic core
              stays invisible and the story collapses back into prose.
CURRENT-STATE ASSUMPTIONS:
              Phases 0–5 closed; Phase 6 OPEN only on the B-02 live click-through
              (user-directed 2026-10-11: Phase 7 starts while that box waits).
              src/server/engine/ is complete and test-proven (neighborhoods, idf,
              graph, compositions, ranking, distinctiveness, triangulation, grades)
              but imported ONLY by its own tests — no production caller exists.
              Orchestrator pass "measurement" emits a placeholder ledger event and
              fabricates no numbers. src/server/agent/controller.ts runs ≤3 LLM
              turns, forms no candidate pool, captures no siteRead. src/shared/run.ts
              still carries z.unknown() for siteRead, culturalDna, candidatePool,
              neighborhoods, graph, compositions, stressReport, constraintFit,
              revisions (D-5.4). shared/routes.ts already declares typed
              replace/challenge/recompute/blueprint request+response schemas; the
              replace route returns honest 503 "lands in Phase 7". SSE frame kinds
              (state/ledger/phase/evidence/dna/compositions/stress/blueprint) exist;
              state frames are authoritative (D-5.3). Gateway has proven search,
              resolveTags, insights, describe, bridge, replace, triangulate.
              graphSchema edges carry {a,b,value,band,state} only — no shared-entity
              list. Prior.composition is a loose role-grouped record already parsed
              by buildPriorModel. S1's parseCulturalDna expects per-domain
              {name,local,city} arrays; hasCompositions keys the "See compositions"
              button; anchorsFromRun/heatFromRun read run.siteRead defensively.
              Baseline: 498 pass / 5 gated-live skips, e2e 4/4, HEAD 64bba88 clean.
IN-SCOPE:     SERVER (orchestrator/agent wiring + shared schema upgrades):
              - W-7.1: typed shared/run.ts schemas for siteRead, culturalDna,
                candidatePool (shapes matched to the existing S1 readers); capture
                of selected anchors/heat into siteRead during investigation;
                candidate pool formation (agent proposes structure, engine
                validatePool validates, exemplars from real search results) with
                provenance paths (anchor → entity → category) — mechanism chosen
                inside the contract, respecting the locked ≤3-turn budget.
              - W-7.2: real measurement pass — taste neighborhoods (local + city via
                gateway insights) → buildNeighborhoods → computeIdf → buildGraph →
                buildCompositions → measureComposition/percentile/rank →
                computeDistinctiveness → triangulation for finalist edges → grades;
                persist typed neighborhoods/graph/compositions (+revisions typed as
                needed); CulturalDNA from the same local-vs-city data in the
                S1 DnaStrip shape; ledger Compute events; honest partial states;
                additive deterministic shared-entities-per-edge helper for edge
                inspection; budget ≤180 Qloo calls/run.
              - W-7.3: web workspace shell (investigate | compositions | graph views
                unlocking as phases complete) + S2 Field histogram + Prior/A/B/C
                cards (role structure, coherence percentile, distinctiveness,
                weakest link, evidence grade; NEVER a 0–100 ecosystem score) + dial
                re-rank from cached deterministic metrics + re-ink motion
                (dashed Prior → re-ink → additions draw → removals strike) with
                reduced-motion static fallback + "Only N valid combinations" honest
                error state.
              - W-7.4: S3 Map of meaning (deterministic stable layout from
                1−edge strength) + distance chart + edge/cell inspection → Evidence
                drawer (claim → provenance badge → entities → measurement route →
                computation summary → ledger links) + sorted edge-list fallback for
                narrow viewports/hairballs + weakest-link break mark (single pulse).
              - W-7.5: POST /api/runs/:id/replace wired per the existing shared
                schema (role preservation, custom candidate ≤4 Qloo calls, engine
                delta coherence/distinctiveness/weakestLink, revision rows,
                mini-stress slot) + Replace panel (alternatives, diverging effect
                previews, free-text candidate) + revision history UI.
              - e2e specs for the compositions/graph/replace judge flow; clause map
                + fixture-browser review (orchestrator-owned).
INVARIANTS:   AGENTS §13 — numeric truth ONLY from the engine; the agent names and
              explains compositions but authors no numbers; every S2/S3 claim traces
              claim → evidence ID → ledger event → measurement inputs → Qloo result
              path; unknown evidence IDs never render as confirmed; uncertainty
              states (measured/confirmed/contested/thin/not measured/incomplete/
              unavailable) render honestly, never averaged away; graph/percentile/
              ranking/distinctiveness/weakest-link remain deterministic from
              identical normalized inputs; Prior immutable before evidence; Qloo
              ≤180 calls/run (≈200 hard), concurrency ≤8/default 6, planner turns
              ≤3, mutation rounds ≤2, LLM ≤$2/run; no fabricated Qloo data or canned
              compositions; fixtures only in tests/tmp, never src/**; design
              language (black ink, L1–L5, shapes over colour, no gradients/neon/
              box-shadow, reduced-motion honoured, visible focus, no console.* in
              shipped code); ProjectSpec/ read-only; no new runtime deps without
              orchestrator approval; SSE progressive visibility (state-first,
              D-5.3); shared/run.ts changes stay additive so D-5.4 round-trips hold.
DEPENDENCIES: Phase 4 engine (landed), Phase 5 orchestrator/persistence/SSE
              (landed), Phase 6 S1 run route (landed), gateway replace/triangulate
              (proven), shared replace schema (landed). B-02 still blocks real-LLM
              runs → verify with scripted-LLM + fake-gateway harnesses + fixture
              browser passes; live pass deferred (same posture as Phase 6).
NON-GOALS:    Challenge/recompute/blueprint routes and stress view (Phase 8);
              /method page; unpin-anchor UX; constraintFit/PriorDiff/Blueprint
              typing; auth, payments, deployment changes, rate-limit tuning, vector
              DB, multi-agent runtime; new SSE event kinds; new npm dependencies;
              closing Phase 6's B-02 box (user-side).
RISK HOTSPOTS:server persisting anything the engine did not compute; dial re-rank
              drifting from the deterministic formula; Prior percentile asked of a
              graph its loose members cannot resolve (must fall back to "not
              measured", never a guessed number); shared-entity helper duplicating
              engine logic in the web layer; layout jitter across SSE frames;
              Replace blowing the Qloo budget or silently changing roles;
              z.unknown()→typed migration breaking S1 readers or D-5.4 round-trip;
              measurement fetches duplicated between workers; single-worker size
              creep → continuation workers per the D-2.1 stall rule.
ACCEPTANCE:   After a run reaches measurement: GET /api/runs/:id returns typed
              siteRead/culturalDna/candidatePool/neighborhoods/graph/compositions;
              S1's "See compositions" appears only then; S2 shows Prior vs A/B/C with
              role structure, coherence percentile, distinctiveness, weakest link
              and evidence grade over a Field histogram, with dial re-ranking and
              re-ink motion (static under reduced motion); S3 draws components as
              nodes and shared culture as edges, and clicking an edge opens the
              Evidence drawer answering "why do these belong together" with two
              components, shared entities, measurement route, triangulation status
              and ledger links; narrow viewport shows the sorted edge-list
              fallback; Replace computes alternatives with coherence/
              distinctiveness/weakest-link effects, bounded calls and revision
              history; honest partial/empty states throughout; full suite green;
              bundle secret scan clean.
VERIFY:       §17 review of every worker diff; independent re-run of typecheck,
              lint, unit, build, e2e; server integration test over real HTTP with
              fake LLM + fake gateway proving the edge-inspection chain
              end-to-end; deterministic replay (same fixture inputs → identical
              graph/percentiles); fixture-browser pass of S2/S3/Evidence drawer
              (extended tmp fixture, deleted before commit); when B-02 clears, one
              real browser judge pass; grep dist/web for key prefixes.
EXIT GATE:    A judge can answer "why do these components belong together?" by
              inspecting an edge rather than trusting an unsupported narrative.
              (Plan line 724 / ARCHITECTURE §6 line 368, verbatim.)
COMMIT EXPECT:5 coherent commits (Plan lines 727–731, verbatim):
              feat: build composition comparison and percentile Field.
              feat: add semantic composition graph with evidence inspection.
              feat: implement role-preserving replacement and revisions.
              feat: add evidence drawer with ledger-linked provenance.
              test: verify composition ranking, graph evidence and replacement flows.
DECOMPOSITION:sequential in one checkout (D-2.1); workers never commit:
              W-7.1 server capture+schemas → W-7.2 server measurement → W-7.3 web
              S2 → W-7.4 web S3+Evidence → W-7.5 Replace server+web. Orchestrator
              owns integration, e2e, clause map and commits (§17).
```

### PHASE 6 CONTRACT (written 2026-10-09, before delegation; build complete, gate open on B-02)

```text
PHASE:        6 — Frontend S0/S1: Brief, Prior & Investigation
MISSION:      Build the first half of the judge experience so the product explains
              itself immediately. (Plan §Phase 6, verbatim.)
WHY:          The judge path is the hackathon gate that decides whether all prior
              engineering is visible. A working backend with no S0/S1 screens cannot
              prove Prior Lock, live Qloo investigation, or evidence provenance to a
              judge who never reads source. ARCHITECTURE §6 makes this the first
              user-visible surface; Product Spec §7 S0/S1 and Final Design §7.0/§7.1
              define the exact layouts and states.
CURRENT-STATE ASSUMPTIONS:
              Phase 5 closed 2026-10-09 (HEAD e8a83a6, tree clean; 386 unit + 5 gated
              live + 3 e2e green). Four real routes live (POST /api/runs 201, GET
              /api/runs/:id 200, POST /api/runs/:id/stop 200, GET /api/runs/:id/events
              SSE); seven stay honest 503. Orchestrator drives prior → investigation →
              measurement with Prior Lock, stop/resume, SSE Last-Event-ID replay.
              src/web/ is four placeholder routes plus App.tsx/main.tsx; no design
              system, no MapLibre, no API client, no state store. package.json has
              react/react-router/zod but NOT zustand, NOT maplibre-gl, NOT maptiler.
              vite.config.ts roots at ./src/web, port 5173, no proxy to Express.
              Express serves dist/web only in production via staticWeb.ts SPA
              fallback. .env has VITE_MAPTILER_KEY=<EMPTY> (B-06); QLOO_API_KEY and
              DEEPSEEK_API_KEY set; TURSO_* empty (memory adapter default).
IN-SCOPE:     src/web/ only (S0 HomeRoute + S1 RunRoute Investigate tab) + minimal
              client utilities (api client, run-state projection, MapLibre wrapper)
              + adding zustand and maplibre-gl as the two justified new deps + Vite
              env wiring for VITE_MAPTILER_KEY + e2e specs for judge-path entry and
              degraded S1 states. Prior reveal: POST /api/runs → 201 (brief+prior) →
              /run/:id → GET /api/runs/:id → EventSource /events → first frame `state`
              → ledger frames stream as orchestrator runs. Extend src/shared/run.ts
              placeholder fields ONLY when a typed client projection is required.
INVARIANTS:   AGENTS §13 — no fabricated Qloo data, no LLM-authored numbers, unknown
              evidence IDs never render as confirmed. Prior card shows frozen state
              from server with lock time and "No cultural data used." SSE is
              progressive visibility only; client reconciles from GET. MapTiler key
              is VITE_ only (public, non-secret); QLOO/DEEPSEEK keys never in frontend.
              Design language: black ink on white, L1–L5 weights, solid/dashed/dotted/
              hatch, circle/square/pill shape language, no colour-only meaning,
              accessible focus, reduced-motion, no gradients or neon. ProjectSpec/
              read-only. No new API routes — consume the four real Phase 5 routes only.
              PROTECTED: src/server/{orchestrator,persistence,sse,engine,qloo,agent}/
              — Phase 6 consumes, does not modify.
DEPENDENCIES: Phase 5 routes + Prior Lock + SSE replay (landed). MapTiler Free key
              must be supplied by user into .env VITE_MAPTILER_KEY before map tiles/
              geocoding can be verified live (B-06, non-optional for Phase 6 exit).
              Zustand + maplibre-gl must be added to package.json. DeepSeek balance
              unpaid (B-02) blocks only LIVE_DEEPSEEK=1, not the UI build. Turso
              unprovisioned — in-memory adapter is sufficient for Phase 6 e2e.
NON-GOALS:    S2–S5 screens (Phases 7–8), Challenge/Replace/Blueprint routes, full
              /method page, unpin-anchor UX, MapTiler billing beyond free key,
              deployment changes, rate-limit tuning, multi-agent runtime, auth,
              payments, vector DB, new API routes, Phase 5 internals.
RISK HOTSPOTS:SSE client double-apply of frames; Prior card showing a client guess
              instead of server-frozen state; design-language drift (gradients, neon,
              colour-coded statuses); VITE_MAPTILER_KEY leaked in bundle/screenshots;
              maplibre bundle size vs S0 first-paint; e2e hang when map tiles fail;
              missing zustand/maplibre-gl breaking the build.
ACCEPTANCE:   A judge can land on S0, see three presets and "Design what belongs
              together on a site", click a preset, land on S1, see the frozen Prior
              card with lock time and "No cultural data used.", watch Agent Ledger
              rows stream with specific work and Qloo/Compute/LLM pills and durations,
              see the map (site marker/radius/anchor pins/heat), see Cultural DNA
              filling, and understand what Qloo is doing without reading source.
              Degraded paths: S0 geocode fail → map-picker fallback; S1 rate-limit →
              dashed retry row; S1 hard fail → partial results + Retry. Full suite
              green. No fabricated Qloo data in the render path.
VERIFY:       Orchestrator reviews every worker diff (§17); independently re-runs
              typecheck/lint/test/build/e2e; opens S0 in a real browser and confirms
              presets + landing line match Final Design §7.0; clicks a preset and
              confirms navigation to /run/:id; confirms Prior card is server-frozen;
              confirms EventSource delivers `state` then ledger frames; greps
              dist/web/assets for key prefixes; confirms degraded-path copy matches
              Final Design §14; confirms reduced-motion and keyboard focus on CTA.
EXIT GATE:    "A judge can land, choose a preset, see the Prior, watch real
              investigation, and understand what Qloo is doing without reading the
              source code." (Plan line 653 / ARCHITECTURE §6, verbatim.)
COMMIT EXPECT:4 coherent commits:
              feat: build the Zorq brief and site-entry experience.
              feat: reveal the immutable pre-Qloo Prior in the live workspace.
              feat: build the evidence-driven investigation ledger and map.
              test: cover judge-path entry and degraded S1 states.
```

### PHASE 5 CONTRACT (ARCHIVED — written 2026-10-09, closed same date)

```text
PHASE:        5 — Orchestrator, Durable State, SSE & Recovery
MISSION:      Turn the intelligence core into a resilient autonomous runtime that can
              stop, resume and recover. (Plan §Phase 5, verbatim.)
WHY:          Phases 6–8 (screens, challenge, blueprint) all depend on a Run that
              survives disconnects and process restarts. An assumed recovery model
              discovered late invalidates SSE, judge UX and the final judge path
              simultaneously. ARCH §1 names orchestrator/ + persistence/ as first
              made real here; ARCH §2 makes the DB the recovery source of truth and
              SSE progressive visibility only.
CURRENT-STATE ASSUMPTIONS:
              Phase 4 closed 2026-10-08 (HEAD 9e91da0, tree clean; 293 unit + 5 gated
              live + 3 e2e green). src/server/agent/ holds a working in-memory run
              state machine (prior_pending → investigating → complete/partial/failed;
              Prior Lock write-once; bounded controller ≤3 turns). src/server/qloo/
              holds a working gateway (MCP+REST, cache TTL 6h, budget 180 calls,
              p-limit concurrency). src/server/engine/ holds the frozen measurement
              kernel. src/shared/events.ts defines SSE frame schemas (state/ledger/
              error + TBD payloads) and Last-Event-ID header; routes.ts registers all
              11 routes as honest 503 stubs. No src/server/orchestrator/ and no
              src/server/persistence/ exist yet. Turso not provisioned (B-06);
              DeepSeek balance unpaid (B-02). Docker absent (D-0.6).
IN-SCOPE:     NEW dirs (ARCH §1):
              - src/server/persistence/: RunStore port (create/load/save run, append
                ledger events, append evidence, idempotent write guards), in-memory
                adapter (tests + degraded boot), Turso/libSQL adapter gated on
                TURSO_DATABASE_URL+TURSO_AUTH_TOKEN (schema: runs / ledger_events /
                evidence), config wiring so absence of Turso degrades cleanly (same
                pattern as QLOO/DEEPSEEK), PERSIST_QLOO_DERIVED respected.
              - src/server/orchestrator/: run lifecycle driver that sequences
                prior → investigation → measurement (engine) → terminal; idempotency
                keys; resume from durable state; stop/cancel (new "stopped" status
                added to agent state machine without breaking existing transitions);
                bounded retries; wall-clock cap; best-so-far; wires agent controller
                + gateway + engine + persistence; emits typed events for SSE.
              - Shared RunState expansion (src/shared/run.ts) toward the 13-node
                canonical tree — only the fields Phase 5 needs (SiteRead, CulturalDNA,
                CandidatePool, Neighborhoods, Graph, Compositions, Evidence,
                LedgerEvents as typed optional nodes; StressReport/ConstraintFit/
                Revisions deferred to Phases 7–8).
              - Real route handlers for POST /api/runs, GET /api/runs/:id,
                GET /api/runs/:id/events (SSE: first frame = state, heartbeat,
                Last-Event-ID replay from ledger_events, gap → fresh state),
                POST /api/runs/:id/stop. Other routes stay honest 503.
              - Tests: port contract suite (both adapters), orchestration lifecycle,
                SSE ordering/replay/reconnect, stop idempotency, resume-after-
                interruption, Qloo-outage mid-run → honest partial, no-key-leak.
INVARIANTS:   AGENTS §13 + ARCH §2 recovery-vs-visibility: the database (or in-memory
              adapter standing in for it) is the recovery source of truth; SSE is
              progressive visibility only — the client tolerates missing events and
              reconciles from authoritative Run state. Prior Lock survives rehydrate
              (frozen after load). No Qloo call before stored Prior. LLM never authors
              numeric truth. No fabricated completion — a stopped/failed/interrupted
              run returns the best defensible state with explicit incomplete marker.
              Budgets locked (≤3 turns, ≤180 calls, ≤8 concurrency, ≤$2). No secrets
              in tracked files / logs / SSE frames. Exactly one API family (the 11
              routes). ProjectSpec/ read-only. Fixture/canned data isolated from
              production paths. Field projection before any persistence/SSE.
DEPENDENCIES: Phase 3 gateway + agent controller; Phase 4 engine (measurement phase
              consumes engine barrel). B-06 Turso NOT required to open the phase
              (in-memory adapter is the default and the test double); Turso adapter
              is complete and env-gated so B-06 unblocks it without code change.
              B-02 DeepSeek balance blocks only the live-Prior path (unit tests use
              a fake LlmClient). Docker absent (D-0.6, unchanged).
NON-GOALS:    Challenge/stress operator execution (Phase 8), bridge/replace search
              (Phases 7–8), constraint/format library + footprint fit (Phase 8),
              frontend screens beyond what e2e needs to drive the runtime (Phase 6),
              live Qloo/DeepSeek calls in the default suite, MapTiler, deployment
              changes, rate-limit number tuning, multi-agent runtime, chat UI.
RISK HOTSPOTS:SSE reconnect correctness (Last-Event-ID gap detection must never claim
              completeness it cannot prove — fall back to fresh state); Prior Lock
              lost or mutable across rehydrate; status machine drift when adding
              "stopped" (must not break Phase 3 transition tests); double-effects on
              resume (idempotency keys required on every phase transition); Turso
              schema drift between adapters (one shared contract suite); event
              payload leaking keys or raw Qloo bodies; wall-clock cap racing a phase
              transition; heartbeat missing so idle SSE connections die behind
              proxies; POST /api/runs returning before Prior is persisted.
ACCEPTANCE:   A real (or fake-LLM) brief creates a run with a frozen Prior; the
              orchestrator advances prior → investigation → measurement against
              fake/fixture tools; the run is durable across a simulated process
              restart (reload from store → identical state, Prior still frozen);
              stop mid-phase yields status "stopped" with best-so-far state and an
              explicit incomplete marker, idempotent on double-stop; SSE delivers a
              first state frame, monotonic ids, heartbeats, and on reconnect replays
              missed ledger events from the store — or falls back to a fresh state
              event when the gap cannot be proven complete; a Qloo outage mid-run
              preserves prior + partial ledger/evidence and marks the run partial/
              failed honestly; no fabricated completion anywhere; full suite green
              (typecheck/lint/unit/build/e2e) with live tests still gated.
VERIFY:       Orchestrator reviews every worker diff (AGENTS §17); independently re-runs
              typecheck/lint/test/build/e2e; hand-traces one run through stop → reload
              → resume; asserts Prior reference-equality and frozenness after rehydrate;
              asserts SSE replay does not re-execute side effects; secret grep scan on
              changed files; confirms in-memory adapter is the only store used by the
              default suite (no accidental Turso dependency in tests).
EXIT GATE:    "A run can be stopped, refreshed, disconnected, reconnected, retried or
              resumed without corrupting state, duplicating effects or fabricating
              completion." (Plan §Phase 5, quoted in ARCHITECTURE.md §6.)
COMMIT EXPECT:5 coherent commits, plan-suggested boundaries:
              docs: open Phase 5 and record the durable-runtime contract.
              feat: add durable Run persistence behind a Turso-ready port.
              feat: implement resumable run orchestration with stop and recovery.
              feat: stream authoritative Run state over SSE with reconnect replay.
              test: cover resume, interruption and partial-failure recovery.
```

### PHASE 4 CONTRACT (ARCHIVED — written 2026-10-08, closed same date)

```text
PHASE:        4 — Deterministic Cultural Measurement Engine
MISSION:      Turn Qloo-derived observations into reproducible cultural composition
              mathematics. (Plan §Phase 4, verbatim.)
WHY:          This is the product's numeric-truth boundary: tracker P4, hackathon rule 9
              and AGENTS §13 all require every metric to be deterministic code. Phases
              5–8 (durable state, screens S2–S5) render these numbers; a formula
              assumed or fudged late invalidates graph, compositions, challenge and
              blueprint simultaneously.
CURRENT-STATE ASSUMPTIONS:
              Phase 3 signed off 2026-10-08 (HEAD 62f29af, tree clean; 153 unit + 5
              gated live + 3 e2e green). QlooGateway returns typed projected results
              (src/server/qloo/types.ts: ProjectedEntity/ProjectedCandidate/
              QlooInsightsResults/QlooTagResults + provenance envelope). evidence/
              minimal owner exists (D-3.1: EvidenceRecord with envelope provenance +
              ledgerEventId). No src/server/engine/ yet (ARCHITECTURE §1: Phase 4 first
              makes it real). Canonical Run tree (§2) reserves CulturalDNA/CandidatePool/
              Neighborhoods/Graph/Compositions — engine owns their math; persistence of
              those nodes is Phase 5. Turso absent (B-06) → fixtures in-memory; DeepSeek
              balance unpaid (B-02) → irrelevant, Phase 4 admits no LLM numbers.
IN-SCOPE:     `src/server/engine/` (new; sole owner of numeric truth) + extending
              `src/server/evidence/` (claim→measurement validation, classifications):
              - candidate pool model: K≈8–10 components, each role, tags, ≤5 local
                exemplars, provenance path, evidence state; required path local anchor
                → Qloo entity/tag signal → resolved category/role → exemplar set →
                taste neighborhood; missing evidence ⇒ unmeasured, never a finalist.
              - taste neighborhoods: artist/movie/brand, top 30 per domain; weight =
                returned affinity when present else 1/rank; deterministic normalization.
              - IDF suppression: IDF_e = ln(K / (1 + component_count_containing_e)),
                floored at zero.
              - shared-culture edges: edge(j,k) = cosine(IDF·N_j, IDF·N_k); complete
                graph over measured components; relative bands within the pool (never
                absolute truth claims).
              - composition mathematics: mean pairwise coherence; exact percentile over
                ALL equal-size role-valid subsets enumerated exactly (no sampling, no
                Qloo calls; K≈10 size 5 ≤252 sets); weakest link = minimum edge, named;
                distinctiveness d(k) = 1 − cosine(N_k^site, N_k^city) on the artist
                domain; deterministic Familiar↔Distinctive reranking
                rank = z(C)·(1−w) + z(D̄)·w (default w=0.5, visible dial), tie-break by
                weakest link, rival sweep w∈[0,1] reporting leadership flips; hard
                role-coverage filter before ranking.
              - triangulation of finalist edges → confirmed / contested / thin /
                failed-unmeasured; evidence grades A / B / C with grade caps.
              - evidence extension: classification states attached to evidence;
                claim → evidence ID → ledger event → measurement input validation
                (tracker P3 completion for engine-consumed claims); unknown evidence
                IDs rejected, never rendered as confirmed.
              Tests: hand-worked unit case per formula plus edge conditions (K=1, empty
              neighborhood, zero vector, zero-variance z, duplicate entities, ties);
              deterministic double-run identity; fixture isolation.
INVARIANTS:   AGENTS §13 determinism — graph edges, coherence, null-model percentile,
              distinctiveness, weakest link reproducible byte-identical from identical
              normalized inputs; LLM never authors numeric truth; Zorq code owns all
              numbers (Qloo = measurement only, never computes a Zorq metric); no
              hardcoded scores/percentiles/canned answers; no fabricated evidence IDs;
              unknown evidence IDs never render as confirmed; uncertainty states
              (confirmed/contested/thin/not measured/failed) preserved, never averaged
              away; no magical 0–100 ecosystem score (relative ranking only); exact
              enumeration, never sampling; budgets/turns unchanged; fixture/canned data
              isolated from production execution (AGENTS §12); ProjectSpec/ read-only;
              no secrets; do-not-drift list applies.
DEPENDENCIES: Phase 3 gateway projected shapes + evidence/ minimal record. No network,
              no Turso (B-06), no DeepSeek balance (B-02), Docker absent (D-0.6).
              Optional gated live Qloo exercises (taste neighborhoods/explainability,
              ARCH §4.1 rows 9/13) are NOT required for the gate.
NON-GOALS:    Challenge/stress operator execution, bridge/replacement search (Plan
              Phases 7–8), constraint/format library + footprint fit (Phase 8), durable
              Run persistence / SSE streaming (Phase 5), frontend rendering of graph/
              compositions (Phases 6–7), API route changes (routes stay honest
              unimplemented), live Qloo calls in the default suite, any LLM involvement
              in numeric output.
RISK HOTSPOTS:percentile definition drifting (role-valid = hard role-coverage filter
              applied before enumeration); cosine with zero vectors → NaN; IDF floor
              edge cases; z-score zero variance; nondeterministic ordering (float ties,
              Map iteration, unsorted output); rounding embedded in comparisons instead
              of presentation; fixture pool leaking into production paths;
              distinctiveness city-scale vector invented instead of Qloo-derived;
              evidence grades computed without links back to evidence IDs;
              triangulation classified from fabricated probe output.
ACCEPTANCE:   A controlled candidate pool (fixture, isolated from production execution)
              produces: a complete edge graph; ranked role-valid compositions; an exact
              percentile hand-verified against the enumerated subsets; distinctiveness
              per component; named weakest links; triangulation classifications and
              evidence grades A/B/C — with ZERO LLM-generated numbers; identical
              normalized inputs rerun byte-identical; every engine-derived rendered
              claim resolvable to evidence ID → ledger event → measurement input; full
              suite green (typecheck/lint/unit/build/e2e) with live tests still gated.
VERIFY:       Orchestrator reviews every worker diff (AGENTS §17); independently re-runs
              typecheck/lint/test/build/e2e; hand-checks ≥1 percentile case and 1 edge
              case against the formula; runs the determinism double-run test; confirms
              fixture isolation (no production import of fixture data); secret grep
              scan; spot-checks that no LLM path can write engine outputs.
EXIT GATE:    "A controlled candidate pool can produce a complete graph, ranked
              role-valid compositions, percentile, distinctiveness, weakest links and
              evidence classifications without LLM-generated numbers." (Plan §Phase 4,
              quoted in ARCHITECTURE.md §6.)
COMMIT EXPECT:3–5 coherent commits, plan-suggested boundaries:
              feat: implement deterministic cultural neighborhood construction.
              feat: add IDF-weighted shared-culture graph scoring.
              feat: implement exact null-model composition percentiles.
              feat: add distinctiveness ranking and triangulation logic.
              test: prove deterministic scoring and edge-case behavior.
```

### PHASE 3 CONTRACT (ARCHIVED — written 2026-10-07, signed off 2026-10-08)

```text
PHASE:        3 — Real Qloo + DeepSeek Agent Core
MISSION:      Prove the highest-risk intelligence path against the real services before
              the rest of the product depends on assumptions. (Plan §Phase 3, verbatim.)
WHY:          Phases 4–8 consume gateway evidence, agent state, and Prior Lock behavior;
              an assumed Qloo/LLM contract discovered late invalidates engine, SSE, and
              all six screens simultaneously.
CURRENT-STATE ASSUMPTIONS:
              Phases 0–2 signed off 2026-10-06 (HEAD 1a5c993, tree clean); Phase 2
              runtime green (62 unit + 3 e2e, degraded boot + rate limits + error model
              §3.0 verified on a fresh clone); Gate A fully open — REST (10 live calls)
              AND MCP (`USABLE-WITH-CONDITIONS`, 4 binding conditions, §4.2); Qloo key
              in gitignored .env; DeepSeek key ABSENT → B-02 blocks LLM-dependent work
              (D-0.8: gateway proceeds first); MCP spike artifacts in OS temp dir only
              (`%TEMP%\qloo-mcp-spike`); canonical owners from §1: qloo/ and agent/.
IN-SCOPE:     QlooGateway in `src/server/qloo/` (typed, transport-agnostic; MCP primary
              per §4.2 conditions, DirectQlooTransport REST fallback for the 4 proven
              capability gaps — rows 2/4/9/13: entity+place search, urn:heatmap, taste
              neighborhoods, feature.explainability); capability surfaces only as needed
              by the run (startup, search, tags, insights/locality, describe, rank/
              recommend, bridge, replacement, triangulation); known-failure guards
              (take>50 rejected client-side, zero-result 200 → failure, invalid
              combinations pre-rejected, POST-body params for signal.interests.entities
              .query / filter.exclude.entities.query, 429/5xx bounded backoff with
              visible state); mandatory field projection before any persistence/SSE;
              in-memory LRU cache TTL≈6h, smallest useful result, live/cached state;
              budgets from config (target 180 calls, concurrency ≤8 default 6,
              p-limit); ledger/evidence-shaped typed results. Later (W-3.2, after
              B-02): one bounded DeepSeek tool-calling controller (no LangChain/
              CrewAI/AutoGen/Mastra/swarm), write-once Prior Lock (Brief → LLM-only
              Prior → persist once → qlooUsed=false → immutable), autonomous probe
              adaptations (thin→widen scale, weak→bridge, uncertain→triangulate,
              unresolved→tag/entity resolve, replace→role-preserving, budget→reserve
              calls), bounded ≤3 planner turns. Tests: gateway contract + failure
              guards; live-Qloo diagnostics isolated from default suite; malformed
              model output rejected.
INVARIANTS:   Qloo = cultural measurement only — never computes a Zorq metric (§4.3,
              AGENTS §13); NO Qloo call before stored Prior exists; Prior write-once /
              immutable; LLM never authors numeric truth; budgets locked — config
              rejects above-lock values (≤3 turns, ≤180/≈200 calls, ≤8 conc, ≤2
              mutation rounds, ≤$2); no fabricated evidence IDs, no canned Qloo data,
              no hardcoded scores; error model §3.0 exact; API = the 11 routes only;
              gateway hides transport (no HTTP/MCP details above it); field projection
              mandatory; no secrets in tracked files / logs; client never receives
              Qloo key; ProjectSpec/ read-only; do-not-drift list applies.
DEPENDENCIES: .env Qloo key (available); npm registry; B-02 DeepSeek key (blocks W-3.2
              only); B-06 Turso/MapTiler NOT required (in-memory cache suffices);
              Docker absent (D-0.6, unchanged).
NON-GOALS:    Measurement engine math (Phase 4), durable Turso state / SSE / recovery
              (Phase 5), screens beyond API-level proof (Phase 6+), deployment changes,
              rate-limit number tuning, multi-agent runtime, chat UI, trends claims.
RISK HOTSPOTS:MCP envelope ↔ raw REST mapping mistakes; capability-gap fallback
              silently never exercised; caching violating conservative policy;
              field projection skipped (0.2–1.0 MB payloads cross the boundary);
              budget config drift; Prior accidentally overwritten; controller looping
              past turn caps; live-Qloo tests flaking the default suite; key leakage
              via logs/errors.
ACCEPTANCE:   A real brief → stored immutable Prior (qlooUsed=false) → ≥1 live Qloo
              observation → validated state mutation → ledger event → evidence record;
              Qloo outage → honest partial state with typed error (never fake data);
              gateway contract tests green incl. all failure guards; controller
              bounded ≤3 turns, malformed output rejected; budgets enforced by config;
              full suite green (typecheck/lint/unit/build/e2e) with live-Qloo tests
              gated/isolated so the default suite stays deterministic.
VERIFY:       Orchestrator reviews every worker diff (AGENTS §17); independently re-runs
              typecheck/lint/test/build/e2e; traces ONE real live observation end-to-end
              (evidence record + ledger row → Qloo result path); secret grep scan;
              failure-path spot check (bad key/network off → honest typed state).
EXIT GATE:    "A real brief produces a Prior, at least one real Qloo observation, a
              validated state mutation, a ledger event and an evidence record. Qloo
              outage yields an honest partial state." (Plan §Phase 3, quoted in
              ARCHITECTURE.md §6.)
COMMIT EXPECT:3–5 coherent commits, plan-suggested boundaries:
              feat: connect the production Qloo gateway through MCP.
              feat: add the bounded DeepSeek tool-calling controller.
              feat: enforce write-once Prior Lock and validated agent state.
              test: cover live Qloo failures and malformed model output.
```

### PHASE 2 CONTRACT (ARCHIVED — written 2026-10-06, closed same date)

```text
PHASE:        2 — Repository Foundation & Typed Runtime
MISSION:      Build the smallest real executable foundation that supports every later
              phase without architectural rework (Plan Phase 2 mission, verbatim intent).
WHY:          Phases 3–10 all land inside this skeleton; a wrong boundary now multiplies
              rework across Qloo gateway, engine, SSE, and all six screens.
CURRENT-STATE ASSUMPTIONS:
              Phase 0+1 signed off; ARCHITECTURE.md LOCKED (ownership map §1, error model
              §3.0, 11-route API §3, phase gates §6); git clean on `main`, public remote
              live; toolchain verified (Node 24, npm 11.6.2, Chrome present, Docker absent
              → D-0.6); no product code exists anywhere yet; .env holds the Qloo key but
              Phase 2 runtime must not require it to boot (health works without Qloo).
IN-SCOPE:     React + Vite + TypeScript web app; Node 22.19+ Express + TypeScript API;
              shared Zod contracts in `src/shared` (single definition site per §1);
              configuration loader (fail-clear when required config absent); Pino logging;
              typed error model per ARCHITECTURE.md §3.0; Helmet + per-IP rate limiting;
              route registration wired for exactly the 11 §3 routes (stubs that fail
              clearly where downstream capability does not exist yet — never fake data);
              npm scripts; Vitest; Playwright (channel "chrome"); Dockerfile +
              deployment/ env contract; production build path (same-origin: Express serves
              React build per Plan §Phase 2 production target); real `GET /healthz`;
              `tests/` bootstrap + health tests; docs/ setup instructions so README run
              commands become real and R2 flips to satisfied.
INVARIANTS:   ARCHITECTURE.md §1 ownership map (one dir per domain — no duplicate owners);
              §3.0 error model exact; API family = exactly the 11 routes, no phantom
              routes (incl. no /api/qloo/proxy); no secrets in tracked files; no fabricated
              business logic just to fill the tree (Plan §Phase 2 "Agent behavior");
              budgets/limits not tuned (AGENTS §13); web never holds API keys or calls
              Qloo; Prior remains write-once (not yet implemented, not violated);
              ProjectSpec/ never edited; Plan do-not-drift list applies (no auth,
              payments, chat-first UI, magic 0–100 score).
DEPENDENCIES: npm registry (verified); Chrome for Playwright; .env.example placeholders.
              Not required: DeepSeek key (B-02), MapTiler/Turso (B-06), Docker (D-0.6).
NON-GOALS:    Qloo calls, agent controller, Prior Lock, engine math, SSE, Turso, screens
              beyond a minimal shell, UI polish, extra features, Devpost work.
RISK HOTSPOTS:wrong package topology (npm workspaces vs flat) forcing rework; error-model
              drift from §3.0; stub routes accidentally shipping fake success; rate
              limiting breaking Playwright; config loader either too lax (silent missing
              config) or too strict (blocks health endpoint); README again claiming
              commands that fail on fresh checkout.
ACCEPTANCE:   Fresh clone → `npm ci` (or documented install) → typecheck → lint → unit
              tests → build → start → `GET /healthz` 200 with typed body; missing
              required config produces a clear typed failure, not a stack trace or a
              silent default; all 11 routes registered with Zod-validated stubs that
              return honest "not implemented" typed errors per §3.0; Playwright smoke
              boots app + hits /healthz; no secret in tracked files; README run
              instructions verified truthful; tracker R2 → 🟢.
VERIFY:       Orchestrator independently runs the full exit-gate command sequence on a
              fresh-clone equivalent (clean worktree or temp clone); git grep secret
              scan; diff review of every worker (AGENTS §17); phantom-route grep = 0.
EXIT GATE:    "A fresh checkout installs, typechecks, lints, tests, builds, starts,
              responds to `/healthz`, and fails clearly when required configuration is
              absent." (Plan §Phase 2, quoted in ARCHITECTURE.md §6.)
COMMIT EXPECT:2–5 coherent commits, plan-suggested boundaries:
              feat: establish the typed full-stack runtime foundation.
              feat: add shared Zod contracts and server error boundaries.
              test: verify repository bootstrap and health endpoint behavior.
```

### PHASE 1 CONTRACT (ARCHIVED — written 2026-10-06, completed same date)

```text
PHASE:        1 — Contract, Reconnaissance & Build Control
MISSION:      One implementation path; ownership map; locked state/API/Qloo/UI contracts;
              highest-risk unknowns tested, not assumed.
WHY:          Phase 2+ builds against these contracts; ambiguity here multiplies rework.
IN-SCOPE:     ARCHITECTURE.md (repo map, Run state tree, 11-route API contract with
              request/response schemas + error semantics + security + tests, Qloo
              capability contract, UI contract, phase gates, blockers); Qloo MCP
              transport reconnaissance against the real key; README.md skeleton with
              honest current status (no false run instructions).
INVARIANTS:   Canonical Run state tree exactly as IMPLEMENTATION_PLAN.md Phase 1 locks it;
              API family = the plan's /api/runs routes (single API family — the
              /api/qloo/proxy family referenced in earlier notes does NOT exist in any
              spec; stale note corrected 2026-10-06); Prior write-once; no fabricated
              Qloo data; no secrets in tracked files; no product features (plan's
              do-not-drift list applies).
DEPENDENCIES: .env Qloo key (available); npm registry (verified).
NON-GOALS:    Product code, UI polish, auth, extra features, package scaffolding
              (Phase 2 owns the executable foundation).
RISK HOTSPOTS:MCP transport (Gate A open half); harness install side-effects on repo;
              accidental secret leakage; README claiming unimplemented commands.
ACCEPTANCE:   ARCHITECTURE.md covers all 11 ownership domains + every route contract +
              Run state tree verbatim; MCP verdict recorded with evidence (usable /
              not usable / degraded) in Verified Tests; no secrets in git; tracker +
              state updated.
VERIFY:       Orchestrator re-reads ARCHITECTURE.md against plan §Phase 1 checklist;
              git grep secret scan; independent MCP re-check of key findings.
EXIT GATE:    Repo has one implementation path, clear responsibility owners, defined
              API/state contracts, visible unresolved blockers, defined phase gates,
              no plausible ambiguity about what Zorq is.
COMMIT EXPECT:2–4 coherent `docs:` commits (plan-suggested boundaries).
```

## Completed Capabilities

- [x] Read all 7 Project Spec sources in full (Idea, Product Specification, Architecture,
      Tools & Requirements, Final Design, Hackathon Details, Implementation Plan).
- [x] Read `AGENTS.md` operating contract; source-of-truth hierarchy applied.
- [x] Repository inspection: `ProjectSpec/` + `AGENTS.md` only. **No git, no `package.json`,
      no `src/`, no `.env*`, no `README`, no `LICENSE`.** Empty build surface confirmed.
- [x] Local toolchain verified (evidence below).
- [x] Phase 0 artifacts created: `IMPLEMENTATION_STATE.md`, `HACKATHON_TRACKER.md`.
- [x] Git initialized on `main`; MIT `LICENSE`, `.gitignore`, `.env.example` committed in
      root commit `00e0e6d` (13 files, 7969 insertions). Working tree clean; `.env`
      confirmed ignored via `git check-ignore` (`.gitignore:2`).
- [x] User decisions received for all Phase 0 open questions (D-0.5 … D-0.10).
- [x] **Official Qloo developer guide retrieved** (docs.qloo.com, updated 2026-10-06): key-request
      form URL, base URL, auth header, GET-only insights, supported `filter.type` URNs, legacy
      endpoint ban, silent-invalid-param behaviour, cache/storage policy, key expiry, quota policy.
- [x] **Public repository created and pushed**: https://github.com/louji2308/zorq (PUBLIC, `main`),
      About description + topics set, GitHub detects **MIT License** → submission R2/R5 satisfied.
- [x] **Qloo API key received** (user), stored only in gitignored `.env`; verified absent from all
      tracked files.
- [x] **10 live Qloo calls executed** → Gate A REST path proven, locality + affinity + popularity
      behaviour measured (see Verified Tests / Evidence).

### Toolchain evidence (2026-10-06, local Windows)

| Check | Result | Spec requirement | Verdict |
|---|---|---|---|
| Node.js | v24.13.0 | 22.19+ | PASS (major above locked minimum) |
| npm | 11.6.2 | npm | PASS |
| Git | 2.53.0.windows.2 | Git | PASS |
| Chrome (Playwright) | `C:\Program Files\Google\Chrome\Application\chrome.exe` | Chrome/Chromium | PASS (use `channel: "chrome"`) |
| npm registry | `npm ping` → PONG 533ms | network | PASS |
| Docker | **not installed** | Docker Desktop/Engine | ACCEPTED RISK (D-0.6: local container tests skipped; Dockerfile validated on Render) |
| `.git` | initialized on `main`, root commit `00e0e6d` | version control | PASS (public GitHub mirror still outstanding — B-04) |

## Active Work

- **PHASE 8 CLOSED 2026-10-17 — exit gate PASSED** (contract `c81bfbb`; all
  workers committed; close-out `8d71f49` compare-modal fix, `d4edc90` e2e
  assertions, `90bcf13` review-fix wave, `f8b2172` test pins). The remaining
  exit work completed this session: **independent adversarial review** (separate
  general-agent, read-only, range `c81bfbb..HEAD` → 15 findings, 6 HIGH / 5 MED /
  4 LOW; all HIGH verified against source by the orchestrator before any edit),
  the **fix wave** (commits `90bcf13` + `f8b2172`), and a re-run
  **fixture-browser walk** on production dist proving: S4 verdict reason + attack
  details + leader rows show **display names, zero `comp-*` ids**
  (`s4ShowsNoComponentIds=true`), S5 fit line reads `not measured (no floor area
  supplied)` for the area-less judge fixture, **two constraint drops visible**
  with engine reasons, compare modal shows only frozen-Prior members, share view
  read-only, **zero console/page errors**. Gates at sign-off: typecheck 0, lint 0,
  **746 pass / 5 gated-live skips** (742 + 4 new review-coverage tests), Playwright
  **10/10**, build PASS, `git diff --check` clean, diff secret scan clean.
  Six findings + the `shift-scale` operator gap deferred to Phase 9 as B-11 with
  rationale (#8 rounds history, #9 bridge evidence provenance, #10 deep challenge
  block schema, #11 `state.evidence` dead field, #13 downshift ordering in copy,
  #15 fallback positional citations, #16 `Shift-scale` ships only as the
  catchment attack re-measure).
  See "Phase 8 Exit-Gate Status" below for the clause map.
- **PHASE 8 BUILD RECORD (contract `c81bfbb`) — W-8.1 DONE (`0c8ba6f`); W-8.2a DONE
  (`f786607`); W-8.2b DONE (`6903c25`); W-8.3 DONE (`ff54a0d`); W-8.4 DONE
  (`99510fc`); W-8.5 DONE (`424cf76`); W-8.6 DONE (`cce7b87`). Exit-gate e2e DONE
  (`0f3620a`).** The exit-gate e2e added browser proof for the two Phase 8 surfaces:
  the S4 test drives the real challenge click (pre-verdict question → five attack rows
  with distinct names and a real state class → `chosen by the agent` banner → order
  starts with `JUDGE_ATTACK_ORDER[0]`), and the S5 test drives the blueprint reading
  screen (scripted title, LLM source pill, invented citation absent from the rendered
  rationale, receipt superscripts non-empty, honest grade label, `/method` link), the
  Without-Qloo compare modal (`Without Qloo` heading + `With no cultural evidence`
  column, Escape closes), and the share route read-only in a fresh context. Two of my
  own assertions were written wrong and corrected from evidence: the compare heading is
  the literal `Without Qloo`, and Share only writes to the clipboard — the share view
  is reached from the persisted `findBlueprintSnapshot().shareToken`. W-8.6 was the
  API-level full chain: `fakeLlm` gained a per-label fallback queue (positional stays
  authoritative, so no existing call-ordered test moved — proven by re-running
  `challenge.test.ts`, which fails if the label queue takes precedence), the fixture
  scripts challenge order + blueprint narrative by label, and the chain test asserts
  `attackOrderSource "llm"`, the observed fixture attack statuses, `narrativeSource
  "llm"`, and every rationale citation resolving to stored evidence with the invented
  id stripped. Phase boundary
  reconstructed from all seven ProjectSpec
  sources + AGENTS.md; spawn channel 5/5 cancelled → orchestrator-direct (D-7.7
  lineage). W-8.1: `engine/formats.ts` (FORMAT_TYPES ≈25 types × 2-3 formats, every
  entry marked `[Zorq heuristic]`, longest-keyword match + role fallback) + `engine/fit.ts`
  (`fitConstraints`: 85% circulation rule, late-night/quiet/nightclub chips, format
  downshift preserving the Anchor role before weakest-edge member drop, honest
  infeasibility with structured `FitResult`) + 12 unit tests. W-8.2a: full S4 server
  pass — `challenge.ts` (five attacks, LLM order with diagnostic fallback, ≤2 mutations
  across ≤3 stress rounds, code-authored verdicts), typed `challengeReport` on RunState
  (D-8.1), `POST /api/runs/:id/challenge` real end-to-end (decisions D-8.1…D-8.7).
  W-8.2b: `measure.ts` `rebuildChain` extraction (one canonical owner for idf → graph →
  runGraph → distinctiveness → requiredRoles → family/ranking rebuild, consumed by
  replace.ts and challenge.ts — zero duplication), bridge-insertion mutation operator
  (site+city insights → `buildNeighborhoods` → temp-pool `rebuildChain` →
  `measureComposition` → gain-gated candidate carried on a `ScratchState` applied
  without touching persisted state), and Replaced proven end-to-end by the real path
  (fixture D: two swaps → `verdictRival` = rival family, `6903c25`).
  W-8.3: S5 Place Blueprint server path — `orchestrator/blueprint.ts` (composeBlueprint:
  guards → leader resolution from challengeReport/ranked → evidence index filtered to
  stored evidence records → fit-to-site from `fitConstraints` → receipts capped 3 →
  role groups in canonical order → What Qloo changed via `extractPriorMemberEntries`
  matching → risks (weakest edge/thin/triangulation non-confirmed/constraint conflict)
  → evidence grade (engine vs challengeReport.gradeCap worst-of) → fit/sight diffs →
  deterministic fallback narrative OR one `blueprint:compose` LLM turn with fence-strip
  + citation strip-unknown-keep-known + fallback event `blueprint.compose_fallback` on
  any failure) + share snapshots (opaque token, 30-day TTL, fingerprint cache-hit, read
  share path `?share=`, 404 unknown / 410 expired), persistence layer (BlueprintSnapshot
  in memory + Turso `blueprint_snapshots` table), `GET /api/runs/:id/blueprint` real
  route wired, `challengeMutationSchema` extended with optional embedded `component`
  (bridge-resolved members survive pool-less reads, D-8.14), and 13 new tests (9 unit
  + 4 HTTP over the judge fixture). Verified at `ff54a0d`: typecheck 0, lint 0,
  **695 pass / 5 gated-live skips**, **build PASS**; secret scan clean. Decisions
  D-8.10…D-8.14 recorded.
  W-8.4: Without-Qloo polish — the Prior's own completion now also demands a
  standalone `polish` paragraph (same single bounded call, budget-accounted),
  extracted best-effort into the additive `priorSchema.polish` field on the frozen
  Prior (valid → carried; present-but-invalid → Compute ledger
  `prior.polish_unavailable` + honest absence; absent → absence with no event,
  D-8.15); judge fixture `JUDGE_PRIOR` carries a polish paragraph; POST → GET
  round-trip proven over real HTTP. Verified at `99510fc`: typecheck 0, lint 0,
  **702 pass / 5 gated-live skips**, **build PASS**. Decision D-8.15 recorded.
  W-8.5: S4/S5 UI — five-view run tab bar (Investigate/Compositions/Connections/
  Challenge/Blueprint, ref-measured sliding underline, unavailable views honestly
  disabled); S4 challenge panel in the right 480px column (pre-verdict question +
  server-mirrored gate copy, five attack circles measured→filled /
  not-completed→crossed / skipped→empty, leader column with strike/replacement/added
  rows, Replaced verdict names the rival members); S5 blueprint reading screen
  (`.s1.is-reading` full-width grid; receipts-only citation superscripts with unknown
  tokens dropped; footprint/hours/downshifts from the server fit; slope diff; grade;
  revisions; Copy as Markdown / Print / Share); Without-Qloo compare modal (left =
  frozen Prior + polish or the honest "Prior alone" note, right = final members with
  added/reformatted tagged; neutral/no-prior/changed derived only from diff arrays);
  read-only `/run/:id/blueprint?share=` share route with expired-snapshot honesty;
  `challengeRun`/`getBlueprint` zod-validated clients. Verified at `424cf76`:
  typecheck 0, lint 0, **741 pass / 5 gated-live skips**, **build PASS**. Decision
  D-8.16 recorded. Next: **Phase 8 exit gate** (the full-chain e2e contract is now
  unblocked). Deadline Oct 30 2026 (internal freeze Oct 28).
- **PHASE 7 CLOSED 2026-10-15 — exit gate PASSED** (contract `ee3bddd`; W-7.1 DONE
  (`99b53bd`); W-7.2 DONE (`7180387`); W-7.3 DONE (`f8717d7`); W-7.4 DONE (`3591f75`);
  W-7.5 DONE (`bd1cb20`); exit-gate `b1f276e`/`0d9344b`/`1acb896`). See "Phase 7
  Exit-Gate Status" below for the clause-by-clause proof map.
  Replace is live end-to-end: `POST /api/runs/:id/replace` is real (guardMutationState →
  revision cap 100 → XOR candidate/custom → role preservation → keyed/default `before`
  resolution → pool-alternative = swap within the unchanged ranked family with **zero
  Qloo calls** (deltas from stored `measureComposition`), custom = ≤4 calls (resolveTags →
  exemplar insights → site artist → city artist, budget-gated first) that grows the pool
  and rebuilds idf/graph/family/ranking/prior honestly, refused at `POOL_CAPACITY=10`);
  persistence via the write-through ledger + `saveRunState` + `emitState` (RunBusyError
  during a pass); responses carry engine-true `{delta, weakestLink}` + revision row +
  mini-stress report (`kind:"mini"`, two ledger-style attack rows: ablation + rival).
  Web: `ReplacePanel` (440 px, focus trap/Esc/aria-live, 1600 ms auto-close on success,
  honest failure copy, alternatives sorted ΔC desc → ΔD desc → id with signed diverging
  bars, custom gated by `customBlockedReason`, revision rows) + `replaceModel.ts`
  projection + `onReplace` threaded NodeSheet → EvidenceDrawer → ConnectionsPanel →
  RunRoute with the **selected composition key** (D-7.11). Orchestrator §17 correctives
  on the adopted spawn: (a) custom path re-derives triangulation route1 against the
  rebuilt graph, carrying stored probes (D-7.18); (b) custom family size pinned to the
  run's measured family size — spawn used `min(5, poolAfter)` which jumped a 3-pool run
  to quadruples so no swap could ever match (D-7.17, found via debug reproduction);
  (c) pool-cap guard reordered before brief/neighborhood/budget (structural refusals
  first); (d) compositionKey added to `replaceRequestSchema` (spawn skipped it).
  Delegation: 5th consecutive spawn cancelled mid-flight — spawn left 17 files (5 new)
  untested and never ran gates; orchestrator adopted, reviewed line-by-line, fixed, ran
  the full ladder. Verified: typecheck 0, lint 0, **631 pass / 5 skips** (+33; 5 skips =
  gated-live, degradedBoot ran with the port free), build PASS, e2e 4/4 fresh dist,
  secret scan 0 hits. Next: **Phase 7 exit-gate work** — clause map + fixture-browser
  review of the judge question.
- **PHASE 5 CLOSED 2026-10-09 — exit gate PASSED** (HEAD `7f11d7f`, tree clean,
  386 pass / 5 gated-live skips, e2e 3/3). See "Phase 5 Exit-Gate Status" below for
  the clause-by-clause proof map. Landed: W-5.1 persistence (`d912ebb`), W-5.2
  orchestration (`5fb61c0`), W-5.3 SSE + API (`6ec2531`), W-5.4 recovery suite
  (`7f11d7f`), plus state-record commits (`7989d16`, `b3c38f1`, this file).
- **W-4.1b DONE 2026-10-08 — reviewed (AGENTS §17), committed `ac63f63`.**
  `src/server/engine/` (types/neighborhoods/idf/graph/index) + `tests/engine/` (6 files,
  40 tests): pool validation, provenance path, affinity-vs-1/rank weights, top-30 cap,
  IDF floor, complete cosine graph, band terciles, unmeasured/zero-vector honesty,
  byte-identical determinism + shuffle independence. First spawn (W-4.1) stalled with an
  empty result before writing anything (provider-level stall, tree clean) → fresh
  W-4.1b succeeded. Independent orchestrator verification: typecheck 0, lint 0,
  **193 pass / 5 gated-live skips** (was 153 → +40 engine tests, no pre-existing test
  touched), zero comments/hardcodes/Date.now/Math.random in engine src, fixtures only
  under `tests/engine/`. Decisions D-4.1…D-4.4 recorded.
- **W-4.2 DONE 2026-10-08 — reviewed (AGENTS §17), independently re-verified, committed
  `3eb298b`.** `src/server/engine/` (+`compositions.ts`, `distinctiveness.ts`,
  `ranking.ts`, append-only `index.ts` +38/-0) + `tests/engine/` (+4 files, 55 tests):
  exact subset enumeration (C(n,k) safety cap 10,000), role+measurement validity gating,
  coherence = mean pairwise edge, strictly-less percentile over the valid family,
  per-member distinctiveness mean (null → excluded from ranking with honest reason),
  population z-scores (σ=0 → all z=0), `rank = z(C)·(1−w) + z(D̄)·w` (default w=0.5,
  tie-break weakest link → members lex), rival sweep over 101 weights (w=0.00…1.00 step
  0.01) with leader-flip reporting. Independent orchestrator verification: typecheck 0,
  lint 0, **248 pass / 5 gated-live skips** (was 193 → +55); `index.ts` diff append-only;
  hand-worked z (±√1.5) and flip-at-index-50 assertions inspected in source. Decisions
  D-4.5…D-4.8 recorded.
- **W-4.3 DONE 2026-10-08 — reviewed (AGENTS §17), independently re-verified, committed
  `04e8d3a`; orchestrator integration committed `b759e83`.** `src/server/engine/`
  (+`triangulation.ts`, `grades.ts`), `src/server/evidence/index.ts` (additive:
  `resolveClaimEvidence`, `isResolvableClaim`, code `UNKNOWN_EVIDENCE_ID`),
  `tests/engine/` (+`triangulation.test.ts`, `grade.test.ts`, `exitGate.test.ts`),
  `tests/evidence/claimCitations.test.ts` (new dir). Triangulation precedence
  failed > thin > confirmed > contested (exactly 5 results = usable); grade precedence
  C > B > A (cap, worst wins); unclassified finalist edge counts as failed → B
  (honest gap — no vacuous A). Barrel exports wired by orchestrator. Independent
  orchestrator verification: typecheck 0, lint 0, **286 pass / 5 gated-live skips**
  (+38) at worker handoff; after integration **293 pass / 5 skips** (+7 exit-gate
  tests); build PASS; **e2e 3/3 PASS**; evidence diff verified additive-only; existing
  `tests/agent/evidence.test.ts` untouched. Decisions D-4.9…D-4.11 recorded.
- **PHASE 4 EXIT GATE PASSED 2026-10-08** — see "Phase 4 Exit-Gate Status" below.
  One controlled K=6 pool drives the full chain (neighborhoods → IDF → complete graph →
  4 role-valid compositions → percentiles {0,25,50,75} → distinctiveness → ranking +
  101-point rival sweep → triangulation classes → grades A/B/C → claim-citation
  rejection of unknown ids) with zero LLM/Qloo/network involvement; full pipeline
  byte-identical across reruns. `SESSION_HANDOFF.md` deleted.
- **PHASE 3 SIGNED OFF 2026-10-08 — exit gate PASSED with live Qloo evidence** (checklist at
  "Phase 3 Exit-Gate Status"; evidence in Verified Tests). Landed this phase: gateway
  (`8a4c367` + budget fix `e41d89a`), agent controller + Prior Lock (`7e69523`), assembler
  Prior-reference fix (`8d5b422`), live exit-gate proof (`62f29af`), contract docs
  (`edc9a62`, `b7a1de4`), review records (`c59fdeb`). Real-LLM Prior generation is the one
  deferred verification (B-02 balance; `LIVE_DEEPSEEK=1` gated test ready).
- **Remaining work outstanding from users:** DeepSeek balance top-up (B-02), MapTiler +
  Turso (B-06), Devpost registration; optional low-priority Qloo capability exercises
  (taste neighborhoods / explainability / heatmap, ARCH §4.1 rows 9/13).

## Worker Status

| Worker | Contract | Scope | Status |
|---|---|---|---|
| W-1.1 | Contract authoring | Create `ARCHITECTURE.md` only (repo ownership map, locked Run state tree, 11-route API contract, Qloo capability contract, UI contract, phase gates, blockers) | **DONE 2026-10-06 — reviewed & accepted.** 398-line contract; all 8 sections; 11/11 route contract blocks; Run tree byte-matches plan; phantom-route grep = 0 hits; no secrets. 6 spec ambiguities surfaced (error model undefined in specs → worker defined canonical §3.0 contract; Prior-failure semantics; challenge async shape; Phase 0 gate text sourced from state; Phase 7 gate mojibake normalized; SSE replay staged Phase 2–4 vs 5). |
| W-1.2 | Reconnaissance | Install `@qloo/qloo-harness` **outside the repo tree** (temp dir), prove/disprove `qloo mcp` + `qloo_capabilities` against the real key, report verdict + evidence | **DONE 2026-10-06 — reviewed, independently re-run, accepted.** Verdict `USABLE-WITH-CONDITIONS`; Gate A MCP half now proven. Conditions recorded in `ARCHITECTURE.md` §4.2. |
| W-2.1 | Foundation scaffold | Root package (ESM, dual tsconfig), React+Vite shell with 4 locked UI routes, Express app skeleton, config loader + Pino, shared Zod contracts (errors/brief/run/events/routes), Vitest bootstrap | **DONE 2026-10-06 — reviewed; committed `73f0e9d`.** First spawn stalled (0 files) → retry succeeded. 47 tests green at handoff. One contract deviation corrected by orchestrator (silent `NODE_ENV` default → required at start). |
| W-2.2 | Server runtime | Security baseline (helmet, request-id, 2-tier rate limits), Zod validation, typed error middleware, 11-route registration, healthz, static/SPA serving, degraded boot | **DONE 2026-10-06 — reviewed; committed `197f8cb` + `704af3a`.** Spawn stalled mid-task with substantial partial code on disk → continuation worker **W-2.2b** reviewed/fixed (1 security defect: config error message echoed raw Turso URL value → dropped), wrote 15 tests, all gates green. Orchestrator independently re-ran all gates + live boot checks. |
| W-2.3 | Harness/deploy/docs | Playwright smoke (`channel: chrome`), `deployment/Dockerfile` + `render.yaml` + root `.dockerignore`, README run instructions | **DONE 2026-10-06 — reviewed; committed `4a143d3` + `6eb397f`.** 3/3 e2e green (orchestrator re-ran); Docker recipe COPY-targets all verified; README commands executed; one README claim corrected by orchestrator (dev server does not serve the SPA — production static only). |
| W-3.1 | QlooGateway (first spawn) | `src/server/qloo/` foundation: types, guards, errors, config, cache, budget + deps (`@qloo/qloo-harness` 0.1.26, `@modelcontextprotocol/sdk`, `p-limit`) | **STALLED 2026-10-08 after substantial partial work.** 6 foundation files + dependency install completed; no transports/gateway/tests. Registry spike answered: harness IS on public npm (0.1.26) — no temp-dir dependency. Disk state preserved. |
| W-3.1b | QlooGateway (continuation) | Finish gateway: config fields, `project.ts`, `transport.ts`, `restTransport.ts`, `mcpTransport.ts`, `gateway.ts`, `index.ts`, `tests/qloo/*` | **DONE 2026-10-08 — reviewed, independently re-verified, committed `8a4c367`.** All gates green at handoff (typecheck/lint/105 unit/build); live suite correctly gated. Two earlier spawn attempts failed on provider errors (API connect, rate limit) before any write — third succeeded. |
| W-3.2 | DeepSeek controller + Prior Lock | `src/server/agent/` (9 modules: llm, budget, prior, tools, controller, state, ledger, errors, index) + `src/server/evidence/` (minimal canonical owner) + `tests/agent/` (8 files) + `openai@7.30.1` dep | **DONE 2026-10-08 — reviewed file-by-file, independently re-verified, committed `7e69523`.** All gates green at handoff (typecheck/lint/153 unit/4 gated skips/build/e2e 3/3); no contract deviations; fake LLM only in tests; live `LIVE_DEEPSEEK=1` test written but expected 402 until balance (user-approved exception). |
| W-4.1 | Engine core (first spawn) | `src/server/engine/` + `tests/engine/` | **STALLED 2026-10-08** — returned an empty result, wrote zero files (provider-level stall; tree clean, nothing lost). |
| W-4.1b | Engine core (fresh spawn) | `src/server/engine/` (types, neighborhoods, idf, graph, index) + `tests/engine/` (fixtures + 5 test files) | **DONE 2026-10-08 — reviewed (§17), independently re-verified, committed `ac63f63`.** typecheck/lint green; **193 pass / 5 gated skips** (+40 tests); byte-identical determinism + shuffle tests; decisions D-4.1…D-4.4 recorded. |
| W-4.2 | Composition mathematics | `src/server/engine/` (+`compositions.ts`, `distinctiveness.ts`, `ranking.ts`, `index.ts` append-only) + `tests/engine/` (+4 test files) | **DONE 2026-10-08 — reviewed (§17), independently re-verified, committed `3eb298b`.** typecheck 0, lint 0; **248 pass / 5 gated skips** (+55 tests); barrel append-only confirmed (`git diff` zero deletions); decisions D-4.5…D-4.8 recorded. |
| W-4.3 | Triangulation + evidence grades + claim→citation validation | NEW: `src/server/engine/` (+`triangulation.ts`, `grades.ts`) + `tests/engine/` (+2) + `tests/evidence/` (new dir); EDIT: `src/server/evidence/index.ts` (additive); barrel wired by orchestrator | **DONE 2026-10-08 — reviewed (§17), independently re-verified, committed `04e8d3a`** (+ integration `b759e83`). First spawn interrupted at dispatch (no writes, tree clean) → re-spawn succeeded. typecheck 0, lint 0; **286 pass / 5 gated skips** (+38); evidence diff additive-only (verified via `git diff`); decisions D-4.9…D-4.11 recorded. |
| W-5.1 | Persistence port + adapters | NEW: `src/server/persistence/` (RunStore interface, in-memory adapter, Turso adapter env-gated, schema, config wiring, healthz check) + `tests/persistence/` | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `d912ebb`.** typecheck 0, lint 0; **339 pass / 5 gated-live skips** (+46); build PASS; e2e 3/3; secret scan clean; package.json only adds `@libsql/client`. Turso adapter testable via `:memory:`/file URL (B-06 mitigation). |
| W-5.2 | Orchestration core | NEW: `src/server/orchestrator/` (status machine, rehydrate, write-through ledger, start/resume/stop/retry, wall-clock, event sink) + `tests/orchestrator/` | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `5fb61c0`.** typecheck 0, lint 0; **354 pass / 5 gated-live skips** (+15); build PASS; e2e 3/3; secret scan clean; zero edits to agent/ (stop stays orchestrator-local). |
| W-5.3 | SSE + API routes | EDIT: `src/shared/run.ts` (13-node expansion), `src/server/routes.ts` (real handlers), SSE emitter + replay + `src/server/app.ts` wiring + `tests/` | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `6ec2531`.** typecheck 0, lint 0; **369 pass / 5 gated-live skips** (+15); build PASS; e2e 3/3; secret scan clean; 4 Phase 5 routes real, other 7 still 503. First two spawns stalled with zero writes (provider) → third succeeded. |
| W-5.4 | Recovery + exit-gate suite | NEW: `tests/orchestrator/recovery.test.ts` + `tests/orchestrator/exitGate.test.ts` + exit-gate proof | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `7f11d7f`.** typecheck 0, lint 0; **386 pass / 5 gated-live skips** (+17); build PASS; e2e 3/3; secret scan clean; no src changes needed. First two spawns stalled with zero writes (provider) → third succeeded. |
| W-6.1 | Web foundation (tokens, API client, SSE client, run store) | NEW: `src/web/styles/` (tokens/base/index.css), `src/web/lib/` (api.ts, sse.ts), `src/web/store/runStore.ts`, `tests/web/`; EDIT: `main.tsx` (+1 CSS import), `index.html` (+meta) | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `579b23e`.** typecheck 0, lint 0; **418 pass / 5 gated-live skips** (+32); build PASS; e2e 3/3 (placeholders intact); secret grep clean; zero edits to src/server, src/shared, ProjectSpec, e2e. SSE frame policy (state=replace, ledger contiguity + suspend-on-gap) matches D-5.3; Zustand store is projection-only per ARCH §17. |
| W-6.2b | S0 Brief screen (presets, address search, site map) | EDIT: `src/web/routes/HomeRoute.tsx`; NEW: `src/web/screens/s0/` (MapPanel, AddressSearch, BriefForm, briefFormState, PresetCard, runFailure, s0.css), `src/web/lib/map.ts`, `src/web/lib/geocode.ts`, `src/web/presets.ts`, `src/web/env.d.ts`, `tests/web/s0{Brief,Geocode,Presets,RunFailure}`; orchestrator: `src/server/app.ts` CSP fix (D-6.3), `e2e/smoke.spec.ts` S0 assertions | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `7f5380c` (screen) + `e85fdde` (CSP) + `c130166` (state).** typecheck 0, lint 0; **455 pass / 5 gated-live skips** (+37); build PASS; e2e 3/3 (S0 assertions); secret scan clean; live browser proof: real MapTiler vector tiles + preset dots render, console clean (no CSP violations). First spawn interrupted (no commits) → continuation worker completed on the same tree; orchestrator diagnosed the pre-existing tile failure (default helmet CSP vs MapLibre module worker) and verified the fix end-to-end. |
| W-6.3 | S1 Investigate screen (Frozen Prior card, live Agent Ledger, Cultural DNA strip, site map) | EDIT: `src/web/routes/RunRoute.tsx`, `src/web/lib/map.ts`; NEW: `src/web/screens/s1/` (PriorCard, LedgerPanel, DnaStrip, InvestigateMap, s1Model, stopAction, s1.css) + `tests/web/s1{Dna,Ledger,Prior,Stop,Stream}`; orchestrator: `e2e/smoke.spec.ts` RUN_NOT_FOUND assertions | **DONE 2026-10-09 — reviewed (§17), independently re-verified, committed `b71dd00` (screen) + `7dfb688` (e2e).** typecheck 0, lint 0; **498 pass / 5 gated-live skips** (+43); build PASS; e2e 3/3; §17 live-browser review caught 4 defects (string `symbol-sort-key`, MapTiler `" "` Town-labels image warning, Prior card covering the DNA strip, status pill stuck on "Opening…") → orchestrator corrective patches → final render verified with **zero console messages**. First spawn failed at provider after partial disk work → continuation worker completed on the same tree. |
| W-6.4 | Judge-path/degraded e2e + exit-gate clause map (**orchestrator-executed** — `e2e/**` and `playwright.config.ts` are orchestrator-owned by contract) | EDIT: `e2e/smoke.spec.ts` (console-clean gate + typed run-creation contract), `IMPLEMENTATION_STATE.md` (clause map); audits: bundle secret scan, reduced-motion, geocode-fallback, degraded S1 states | **DONE 2026-10-09 — committed `91c6788` (e2e).** typecheck 0, lint 0; **498 pass / 5 gated-live skips**; build PASS; **e2e 4/4** (healthz, console-clean S0 landing, typed `POST /api/runs` 201-or-DEPENDENCY_UNAVAILABLE, RUN_NOT_FOUND recovery). `dist/web` secret scan **0 hits** (Qloo/DeepSeek/Turso values + env names). Clause map below; gate stays OPEN on the B-02 live click-through only. |
| W-7.1 | Investigation-output capture + typed run-state schemas | EDIT: `src/shared/run.ts` (typed `siteRead`/`culturalDna`/`candidatePool` replacing `z.unknown()`), `src/server/agent/{controller,tools,index}.ts`, `src/server/orchestrator/orchestrator.ts`; NEW: `src/server/agent/pool.ts`, `tests/agent/pool.test.ts`, `tests/orchestrator/capture.test.ts` | **DONE 2026-10-11 — reviewed (§17), independently re-verified, committed `99b53bd`** (contract `ee3bddd`). Mechanism: new `propose_candidate_pool` LLM tool (agent proposes inside the locked ≤3 turns) → engine `validatePool` → grounding checks against an observation index (every exemplar id+name and every tag must appear in a real tool result; rejection returns an honest tool error, never repaired). Orchestrator persists `siteRead` (lettered anchors A–E + heat from observed located entities/heatmap cells with evidenceIds) + validated pool via a `investigate:capture` Compute ledger event; `culturalDna` typed but only ever set by W-7.2. Shared↔engine shape conformance proven by tests (role/evidence-state vocabularies byte-equal; cross-parse equal). **Orchestrator corrective:** pool cap 24 → **10** (spec K ≈ 8–10, ProductSpec §12 / Final Design 45-edge math / engine 10k enumeration cap) + description nudge + boundary tests (10 accept / 11 reject). Gates independently re-run: typecheck 0, lint 0, **516 pass / 6 skips** (clean rerun; one transient vitest worker crash on `persistence/contract.test.ts` reproduced zero times — passes in isolation 28/28), build PASS, **e2e 4/4** against fresh dist, `dist/web` secret scan 0 hits. Known limitations: anchor selection is deterministic first-5-located-observed (spec assigns anchor selection to the agent — revisit when unpin/replace anchor identity lands); outputs not applied on stop/wall-clock-cap return paths (honest absence; resume re-derives). |
| W-7.2 | Deterministic measurement chain (neighborhoods → graph → compositions → CulturalDNA → triangulation → grades → typed persistence) | EDIT: `src/shared/run.ts` (+193 — typed `neighborhoods`/`graph`/`compositions` replacing `z.unknown()`, `runSharedEntitySchema`), `src/server/orchestrator/{index,orchestrator}.ts`, `src/server/engine/index.ts` (append-only barrel +5), `tests/api/runs.test.ts` (+25); NEW: `src/server/orchestrator/measure.ts` (827 lines), `src/server/engine/edgeEntities.ts`, `tests/orchestrator/measure.test.ts` (18), `tests/engine/edgeEntities.test.ts` (5) | **DONE 2026-10-12 — reviewed (§17), independently re-verified, committed `7180387`** (contract `ee3bddd`). Mechanism: `runMeasurement` iterates the validated pool × artist/movie/brand × site/city scopes — site via locality-ladder `signalLocation` (brief.location then last-two-segment broader form), city **unlocalized** (D-7.3) — take-30 `insights` per call, one evidence record per call with `ledgerEventId`; engine `buildNeighborhoods` → `computeIdf` → `buildGraph` (+ per-edge `sharedEntitiesForEdge`, cap 8, Evidence-drawer input) → `buildCompositions` (requiredRoles `["Anchor"]` when present, size `min(5, poolSize)`, D-7.6) → `rankCompositionSet` + `rivalSweep` → top-3 finalists → route-2 probe per unique pair (≤24, radius 400→5000m ladder, D-7.5) → `classifyTriangulation` → `gradeEvidence`; Prior marker resolves members against the pool by id/exemplar-name/tag (role-constrained) or honestly reports `not measured`; ledger Qloo `measure.neighborhood_fetch`/`resolve_tag`/`triangulate_probe` + Compute `measure.neighborhoods`/`graph`/`compositions`/`triangulate`/`dna` + boundary `measure.compose`; budget stop at reserve 54 (~30%), consecutive-failure stop at 2, degraded→partial in `drivePass`. **Orchestrator correctives:** DNA per-side-max → share-of-total (D-7.4, regression guard `local < 100`); `graph as never` removed (`resolvePriorMarker` typed `CultureGraph`). Gates independently re-run: typecheck 0, lint 0, **539 pass / 6 skips** (+23), build PASS, **e2e 4/4** fresh dist (production server restarted), `dist/web` secret scan **0 hits**. Known limitations: route-2 is a single signal-E_j place query (spec's dual-query anchor comparison deferred, D-7.5); **`state.graph` must never be fed back into engine constructors** (engine `graphEdgeSchema` is strict, `sharedEntities` is RunGraph-only — W-7.4/W-7.5 must rebuild from neighborhoods or strip the field); wall-clock 120s may truncate very slow Qloo rounds → honest partial, never fabricated compositions. |
| W-7.3 | S2 Compositions workspace (Field histogram, Prior/A/B/C cards, dial re-rank, re-ink motion) | EDIT: `src/web/routes/RunRoute.tsx` (+36/−20 — S1↔S2 view switch, enabled dock button); NEW: `src/web/screens/s2/` (`s2Model.ts`, `CompositionsPanel.tsx`, `CompositionCard.tsx`, `Field.tsx`, `Dial.tsx`, `Marks.tsx`, `s2.css`), `tests/web/s2Model.test.ts` (29); InvestigateMap + runStore **untouched** (map persists because it stays mounted outside the view conditional) | **DONE 2026-10-12 — orchestrator-executed after 3 cancelled worker spawns (D-7.7), reviewed §17-style line-by-line, committed `f8717d7`** (contract `ee3bddd`). Mechanism: `buildS2Model(run)` (pure, 520 lines) projects persisted `run.compositions`/`neighborhoods`/`candidatePool` into the panel — Field = 12-bin histogram of `coherenceDistribution` + A/B/C marks for the top-3 + dashed prior mark; cards = Prior + finalists with role-grouped member rows (canonical pool-role order), over-index squares (site>city artist weight-sum, both neighborhoods "measured", else hollow/"not measured" — D-7.8), three locked readings in fixed order (percentile sentence from stored values with null honesty, "{k} of {n} over-index locally", weakest-link sentence with break mark), grade letters + up to 6 gradeReasons; dial (0..1 step 0.01) re-ranks `rankedAll` via population z + engine-matching tie-break (score desc → weakest desc → members lex), w=0.5 order proven identical to stored rank order in tests; FLIP re-ink in `useLayoutEffect` with `prefers-reduced-motion` guard; honest empty-family (`family.reason`), thin-pool note, not-measured prior verbatim; card `onEdgeClick` extension point left for W-7.4. Design locks held (no shadow/radius/gradient in s2.css; letter+mark grading; keyboard-reachable controls; aria on squares/field summary). Delegation deviation: first three `task` spawns were cancelled (two before any write, one left the uncommitted s2 sources with zero tests) → orchestrator adopted, reviewed, completed, and verified the increment. Gates independently run: typecheck 0, lint 0, **569 pass / 5 skips** (+30), build PASS, **e2e 4/4** fresh dist (server restarted), secret scan **0 hits**. Known limitation: Field marks always reflect stored-order finalists while the rail letters follow the dial (letters can swap under a moved dial — stored marks stay keyed by member set). |
| W-7.4 | S3 Connections workspace (Map of meaning MDS, Distance chart, Evidence drawer, node sheet) | EDIT: `src/web/routes/RunRoute.tsx` (+34/−5 — "connections" view, s3Key/s3Pair state, S2↔S3 wiring, map persists, PriorCard hidden on S3), `src/web/screens/s2/{CompositionsPanel.tsx (+19/−1), s2.css (+5)}` (Show-the-graph CTA + weakest-link `onEdgeClick` navigation); NEW: `src/web/screens/s3/` (`s3Model.ts` (1115), `ConnectionsPanel.tsx`, `MapOfMeaning.tsx`, `DistanceChart.tsx`, `EvidenceDrawer.tsx`, `NodeSheet.tsx`, `s3.css`), `tests/web/s3Model.test.ts` (30) | **DONE 2026-10-12 — 4th spawn cancelled mid-write (D-7.9), orchestrator adopted the 5-file partial, reviewed line-by-line, completed panel/CSS/tests, committed `3591f75`** (contract `ee3bddd`). Mechanism: `buildS3Model(run, key)` — deterministic classical MDS (double-centered `1 − edge.value` dissimilarities, power iteration with index-derived starts + canonicalized eigenvectors, LRU-cached by graph signature, index-derived jitter fallback) + Kruskal-style stress with distorted-pair counting (locked sentences, high-stress ≥0.25 points to View B); per-pair state = triangulation state → band fallback, empty/absent `sharedEntities` → unmeasured; options A/B/C(+P when prior measured), default leader, unknown key falls back honestly; Evidence drawer claim locks ProductSpec line 203 wording with pool-resolved exemplar names, tiles sorted by `dotContribution` (fraction vs edge max), triangulation sentences per `focalInTopHalf`/`resultCount` (agrees/disagrees/thin-count/failed-no-returns/not-recorded), ledger links = term-matched `run.evidence` first then `kind:"insights"` fallback, cap 4, honest "recorded in the full ledger" fallback; node sheet = pool role/exemplars/5-step provenance/evidenceState with honest empty state; Distance chart = triangular matrix (SVG `<pattern>` hatch — no CSS gradients), band-sized dots (solid/hollow), selected L3 outline, break mark, sorted pair-list twin (sole view <768 px); Map = lines only for selected members, non-members hollow `ink-350`, hit-overlay buttons (keyboard + aria-labels), one-shot 600 ms pulse with reduced-motion guard; `onReplace`/`onChallenge` optional and not yet passed (W-7.5/Phase 8 hooks). **Orchestrator correctives:** removed 3 unused symbols (TS6133/6196), lint `let maxExtent`→`const`, `findWeakestReason` now falls through to band when a confirmed grade reason yields no sentence. Design locks verified by grep (no shadow/radius/gradient, no `console.*`, no comments, no `Math.random`/`Date.now`). Gates independently run: typecheck 0, lint 0, **598 pass / 6 skips** (+29; 6th = degradedBoot port skip with server up), build PASS, **e2e 4/4** fresh dist (server restarted), secret scan **0 hits**. Known limitations: `onOpenLedger` returns to the S1 ledger view without row-level highlight (LedgerPanel has no filter prop — deferred); `state.graph` display-only, never re-ingested. |
| W-7.5 | Replace route + Replace panel + revisions | EDIT: `src/server/orchestrator/{measure.ts (+203/−95 — faithful extraction of `projectRunGraph`/`projectCompositionsNode` + exported helpers), orchestrator.ts (+47 `replaceComponent`), types.ts}`, `src/server/routes.ts` (real handler), `src/shared/{routes,run}.ts` (`compositionKey` + `runRevisionSchema`), `src/web/{lib/api.ts, routes/RunRoute.tsx, screens/s3/ConnectionsPanel.tsx, screens/s3/s3.css (+242)}`, `tests/{api/runs,routes}.test.ts`; NEW: `src/server/orchestrator/replace.ts`, `src/web/screens/s3/{ReplacePanel.tsx, replaceModel.ts}`, `tests/orchestrator/replace.test.ts` (19), `tests/web/replaceModel.test.ts` (14) | **DONE 2026-10-13 — 5th spawn cancelled after writing 17 files with zero tests and zero gates run; orchestrator adopted, reviewed line-by-line, fixed 4 defects, ran the full ladder, committed `bd1cb20`** (contract `ee3bddd`). Mechanism: `applyReplacement` — state guards (resumable/stopped/failed refuse; revision cap 100) → XOR candidate/custom → role preservation → `before` = keyed composition when `compositionKey` present (normalized delimiters, honest refusals) else first ranked containing target → pool path: swapped set must exist in ranked (refuse, never guess), zero Qloo, state untouched → custom path: cap→brief→neighborhood→budget guards then 4 probes → new component with full provenance → idf/graph/family/ranking/prior rebuild → after must be ranked → mini stress (ablation over `stressPool` + rival sweep over `stressRanked`, verdict Survived/Revised) → revision appended. **§17 correctives:** family size pinned to stored `family.size` (D-7.17 — spawn's `min(5, poolAfter)` produced one size-4 composition so no size-3 swap ever matched, proven by `tmp/debug-replace.ts` reproduction); triangulation re-derived from `graphAfter` with stored probes (D-7.18); cap guard moved ahead of brief/neighborhoods (spawn's own test expected it); `compositionKey` threaded schema→server→model→panel→ConnectionsPanel→RunRoute (D-7.11). Gates independently re-run: typecheck 0, lint 0, **631 pass / 5 skips** (+33), build PASS, **e2e 4/4** fresh dist, secret scan **0 hits**. Known limitation: a replace issued after an S4 challenge would overwrite `stressReport` (D-7.16 Phase 8 note). |
| W-8.1 | Constraint/format engine (deterministic kernel) | NEW: `src/server/engine/{formats,fit}.ts` (413 + 343), `tests/engine/formats.test.ts` (159); EDIT: `src/server/engine/index.ts` (barrel +25) | **DONE 2026-10-15 — committed `0c8ba6f`.** typecheck 0, lint 0; 12 tests (keyword/role format resolution, 85% circulation rule, constraint-chip parsing, downshift-before-drop with Anchor preserved, honest infeasibility reasons). Every export carries the `[Zorq heuristic]` marker per contract; no orchestrator/route wiring (recompute path lands with W-8.5). |
| W-8.2a | S4 challenge engine [server pass] | NEW: `src/server/orchestrator/challenge.ts` (887), `tests/orchestrator/challenge.test.ts` (22), `tests/api/challenge.test.ts`; EDIT: `src/shared/{run,routes}.ts` (challenge schemas + `challengeReport` on RunState; `attackKindSchema` moved to run.ts as canonical owner), `src/server/orchestrator/{types,orchestrator}.ts` (`challengeRun`), `src/server/routes.ts` (real handler), `measure.ts` (+`projectExemplars` moved from replace.ts), `replace.ts` (export `sameMembers`/`guardMutationState`, generic mutation wording), `tests/routes.test.ts` (strict `{run, report}` fixtures), `tests/support/judgePipeline.ts` (+bridge operation) | **DONE 2026-10-15 — committed `f786607`.** typecheck 0, lint 0, build PASS; **677 pass / 5 skips** (+23). Mechanism: guards (status/compositions/ranked) → bounded LLM attack-order turn (fence-stripped zod parse, dedupe) or diagnostic fallback → up to 3 stress rounds × 5 attacks in `attackOrder` (ablation re-measures rest subsets against size-n−1 coherences; substitution same-role pool alts; bridge ≤3 evidence-linked probes with budget/outage/empty honesty; catchment deterministic city re-measure; rival rank-margin + flip), best-gain swap/drop mutation (ε=1e-6, swap preferred on tie) applied ≤2 → `resolveVerdict` (no change → Survived, member shared with prior leader → Revised, else Replaced + `verdictRival`) → `gradeCap` B on any "not completed" → `runStateSchema.parse({…state, challengeReport})` persisted via write-through ledger + `saveRunState` + `emitState`. Ledger events: `challenge.order(.fallback)`, `challenge.stress`, `challenge.mutation`, `challenge.verdict`, `challenge.bridge_probe`. |
| W-8.2b | Bridge insertion + shared rebuild owner + Replaced proof | EDIT: `src/server/orchestrator/measure.ts` (+`RebuildChainResult`/`rebuildChain`), `replace.ts` (rebuild block → `rebuildChain`, export `firstTag`, import prune), `challenge.ts` (+404: bridge measurement flow, `ScratchState`, effective-context wiring, `bridgeComponentId`/`bridgeRole`, stopNote bridge branch), `tests/orchestrator/challenge.test.ts` (+5 tests, +`emptyBridgeGateway`/`bridgeFixtureGateway`, fixture D/E, gateway hardening on B/C/persistence), `tests/api/challenge.test.ts` (pinned verdict/mutations/evidence=4), `tests/support/judgePipeline.ts` (+`urn:entity:artist-sonic-youth` site entity, "Sonic Youth" → `tag-noise-rock-1`) | **DONE 2026-10-15 — committed `6903c25`.** typecheck 0, lint 0, build PASS; **682 pass / 5 skips** (+5). Mechanism: bridge probe entities → guards (brief/neighborhoods missing → honest "measured"; budget < 3 calls → "not completed", `found` NOT set so a later round may retry) → `resolveTags` (failure → `challenge.bridge_resolve_tag` failed-call event; empty tag → honest "measured") → site insights with `localityLadder[0]` signalLocation → city insights unlocalized → `buildNeighborhoods` on both → temp pool + `rebuildChain` → `measureComposition` on `[...leader, component]` → gain > ε candidate with `ScratchState` (pool/graph/neighborhoods/distinctiveness/familyCoherences) → `applyCandidate` installs scratch so rounds 2–3 attack the bridged pool while persisted state stays untouched; `bridgeRecorded.found` limits measurement to one successful terminal probe per challenge (later rounds skip citing "recorded probe stands"; D-8.9). Replaced proven by fixture D (two swaps, `verdictRival` = rival family) through the real `runChallenge` path. Judge fixture bridge measured end-to-end (evidence = probe+tag+site+city = 4) but scored no gain → drops applied → verdict Revised, gradeCap A — bridge first in diagnostic order (weakest link 0 < 0.35). |
| W-8.3 | S5 evidence-bound Place Blueprint (server + share route) | NEW: `src/server/orchestrator/blueprint.ts` (~740), `tests/orchestrator/blueprint.test.ts` (9), `tests/api/blueprint.test.ts` (4); EDIT: `src/shared/{routes,run}.ts` (typed blueprint contract; `challengeMutationSchema` + optional `component`; `componentDisplayName` helper), `src/server/persistence/{index,memoryStore,store,tursoStore}.ts` (BlueprintSnapshot + `blueprint_snapshots` table + share index), `src/server/orchestrator/{orchestrator,types,measure,challenge}.ts` (`buildBlueprint` w/ share fast-path + fingerprint cache; `extractPriorMemberEntries` export; `applyCandidate` embeds bridge component), `src/server/routes.ts` (GET blueprint handler), `tests/{routes,support/judgePipeline}.test.ts` (fixtures + `extraLlmResponses`) | **DONE 2026-10-15 — committed `ff54a0d`.** typecheck 0, lint 0, build PASS; **695 pass / 5 skips** (+13: 9 unit + 4 HTTP). Mechanism: guards (brief/prior/pool/compositions/leader-in-pool) → leader = `challengeReport.leaderAfter ?? ranked[0]` → evidence index = state vocabulary **∩ stored evidence records** (unknown IDs can never render) → fit from `fitConstraints` (footprint/hours/downshifts) → receipts ≤3 (path ≤300 + top-2 shared-entities by value) → role groups in `poolComponentRoles` order → What Qloo changed via prior-member name/id/exemplar matching (downshift → reformatted) → risks (weakest edge, thin component, triangulation non-confirmed, constraint conflict; ≤20) → grade = worst-of(challengeReport.gradeCap, computed engine grade) → deterministic narrative (title/rationale + first-3 citation IDs) or one `blueprint:compose` LLM turn (fence-strip → zod parse → **strip ALL bracketed tokens not in the stored-evidence vocabulary**, zero kept → honest fallback with reason) → `blueprintSchema.parse` → share snapshot (opaque 24-byte token, 30-day TTL, sha256 fingerprint over state excluding status/phase → cache-hit skips LLM; share fast-path 404 unknown / 410 expired; expired non-share path recomposes reusing the stored token). `challengeMutationSchema.component` lets a bridge member resolve by name when the bridge was never persisted to the pool (D-8.14). Decisions D-8.10…D-8.14 recorded. |
| W-8.4 | Without-Qloo polish on the frozen Prior | EDIT: `src/shared/run.ts` (`priorPolishTextSchema` + additive optional `priorSchema.polish`), `src/server/agent/prior.ts` (prompt demands the `polish` paragraph; `priorDraftSchema.polish` `z.unknown().optional()`; `normalizePolish` best-effort extraction → Compute `prior.polish_unavailable` on present-but-invalid), `tests/support/judgePipeline.ts` (`JUDGE_PRIOR` gains a polish paragraph), `tests/{agent/prior,api/runs}.test.ts` (+7 tests) | **DONE 2026-10-15 — committed `99510fc`.** typecheck 0, lint 0, build PASS; **702 pass / 5 gated-live skips** (+7: 5 unit + 2 HTTP). Polish rides the Prior's own single completion and lives INSIDE the frozen Prior (D-8.15): zero `generatePrior` signature ripple, deep-freeze covers it, no fixture call-queue displacement, no new route (11-route surface locked). Honest degradation chain: valid → `prior.polish` carried (POST 201 + GET round-trip proven); present-but-invalid → dropped + fixed-summary `prior.polish_unavailable` ledger event, Prior unaffected; absent → field absent with NO event (old fixtures' ledger counts unchanged) so W-8.5's modal can honestly say "Prior alone". |
| W-8.5 | S4/S5 UI: run tabs, challenge view, Blueprint document, Without-Qloo compare | EDIT: `src/web/lib/api.ts` (`challengeRun` + `getBlueprint`, zod-validated), `src/web/routes/RunRoute.tsx` (five-view tab bar with ref-measured sliding underline; challenge POST action applies response state then best-effort evidence refetch; blueprint view via `.s1.is-reading` single-column grid, map/DNA strip hidden; Compositions/Connections tabs disabled with honest titles until measured; PriorCard shown on the investigate view), `src/web/routes/BlueprintRoute.tsx` (read-only share view hydrating the run, no tabs), `src/web/screens/s1/s1.css` (tab styles + `.s1.is-reading` grid-area variant), `tests/web/api.test.ts` (+7); NEW: `src/web/screens/s4/{s4Model.ts,ChallengePanel.tsx,s4.css}`, `src/web/screens/s5/{s5Model.ts,BlueprintPanel.tsx,CompareModal.tsx,s5.css}`, `tests/web/{s4Model,s5Model}.test.ts` | **DONE 2026-10-16 - committed `424cf76`.** typecheck 0, lint 0, build PASS; **741 pass / 5 gated-live skips** (+39: 12 s4 + 20 s5 + 7 HTTP). `buildS4Model` is a pure projection of `run.challengeReport` (no report → honest pre-verdict "Can the leader be broken?"; gate mirrors `guardMutationState` + the ranked guard with the exact refusal copy; Replaced sentence names `verdictRival`; attacks sorted to spec order; circles measured→filled / not completed→crossed / skipped→empty; leader rows strike swaps with a replacement, strike drops, add bridge inserts). `buildS5Model` never recomputes numbers (AGENTS §13): receipts-only citation superscripts (unknown `[id]` tokens dropped client-side, mirroring D-8.11), globally numbered receipts, footprint fraction vs brief area, overnight hours wrap, slope pairs from the four diff arrays, compareState 3-way from diffs only (kept ∧ untouched → neutral; all-empty → honest no-prior), polish from `run.prior.polish` (null → honest "Prior alone"), revision sentences with both coherence %. `BlueprintPanel` owns the fetch with loading / unknown-run / expired ("This snapshot has expired. Re-run the same brief." + new-run link) / error states plus Copy as Markdown / Print / Share; `CompareModal` renders prior vs final with added+reformatted tagged. Deferrals recorded in D-8.16 (S5 row-level Replace, S1/S2 Challenge CTAs). |
| W-8.6 | S4/S5 full-chain contract test + judge-fixture label queue | NEW: `tests/orchestrator/judgeChain.test.ts`; EDIT: `tests/support/judgePipeline.ts`, `tests/agent/support/fakes.ts` (queued `fakeLlm` responses by label, D-8.17) | **DONE 2026-10-16 — committed `cce7b87`.** Proves challenge → stressReport → blueprint → without-Qloo as one deterministic chain on the fixture pipeline (742 pass / 5 skips at the time); scripted LLM at the label boundary + fake gateway at the transport boundary only — production code untouched. Design note D-8.17 (label queue) recorded with rationale. |
| W-8.7 | Exit-gate e2e, independent review + fix wave | NEW: `e2e/judge-flow.spec.ts` (`0f3620a` + `d4edc90`); EDIT: `src/web/screens/s5/CompareModal.tsx` (`8d71f49`), review-fix wave `90bcf13` (fix) + `f8b2172` (test) across `challenge.ts`, `blueprint.ts`, the blueprint route surface, `s4Model`/`ChallengePanel`, `s5Model`/`BlueprintPanel`, `run.ts`/`routes.ts` schemas | **DONE 2026-10-17 — commits `0f3620a`, `d4edc90`, `8d71f49`, `90bcf13`, `f8b2172`.** 10/10 Playwright; independent adversarial review of `c81bfbb..f8b2172` (15 findings, all triaged, D-8.23); browser walk `tmp/phase8-walk.json` zero console errors; gates 746 pass / 5 skips, build PASS, diff secret scan 0 hits. Scope: judge-facing prose id→name, revision `at`, drops-always + tri-state fit, numeric-prose guard, stale-leader fallback, attack-detail render. |

**Orchestrator integration review (AGENTS §17):** both diffs inspected; W-1.1 touched only `ARCHITECTURE.md`;
W-1.2 touched only temp-dir files (repo `git status` shows no spike artifacts); key never echoed; worker claims
independently re-verified by orchestrator re-run of `mcp-probe2.js` (identical contract checksum) and by grep
scans (no key material, no phantom routes, 11 route sections present). Contract updated by orchestrator with the
MCP verdict + 4 binding conditions. No duplicated responsibility; no hidden mocks.

**W-3.2 orchestrator review (AGENTS §17):** diff scope = 2 manifest files + 3 new dirs, contract-exact.
Implementation read file-by-file (prior, state, controller, budget, evidence, index, llm key paths, tools
envelope mapping): Prior-before-Qloo structural (`prior.ts` imports zero qloo modules; `transitionRun` and
`runController` both refuse `investigating` without a persisted Prior); write-once + deep-freeze verified;
turn cap clamped at 3 in code; official DeepSeek pricing table encoded with conservative cache-miss default
and ceiling clamped to `LOCK_LLM_BUDGET_USD`; key redaction confirmed (`redact(raw, secrets)`); envelope
`cache`→evidence `cacheState` mapping correct. Gates independently re-run: typecheck, lint, **153 pass /
5 gated skips**, build, **e2e 3/3**; secret scan clean. **Review catch → fixed in `8d5b422`:** assembler
returned the pre-persist Prior object (unfrozen, separate object from the persisted zod clone) — now returns
`run.prior` (the frozen persisted reference), test tightened to reference equality. Exit gate proven live
(`62f29af`).

## Verified Tests / Evidence

### Phase 8 — independent review, fix wave, and browser walk (2026-10-17, commits `90bcf13` + `f8b2172`)

- **Independent review (AGENTS §17):** a separate general agent (read-only,
  authored none of the code) attacked the Phase 8 diff range `c81bfbb..HEAD` and
  returned **15 findings — 6 HIGH, 5 MEDIUM, 4 LOW**. Every HIGH was verified
  against source by the orchestrator before edits: #1 Survived reason claimed
  "all five attacks" even with a skipped/failed probe (`challenge.ts` buildReason);
  #2 `whatQlooChanged` mixed raw ids (kept/reformatted/added) with names (removed);
  #3 no floor area still rendered `withinUsable: true`; #4 fit drops gated behind
  `!fit.feasible` so a feasible-but-constrained fit hid its drops, and dropped
  members rendered with no explanation; #5 compose LLM received numeric truth
  (`challengeReason`, `fit.reasons`) with no digit validation; #6
  `report.leaderAfter` preferred unconditionally — a replace AFTER the challenge
  left the blueprint showing the pre-replace leader (replace.ts never touches
  `challengeReport`). MED/LOW confirmed: #7 double "Replaced by" + ids, #8a
  `attack.detail` never rendered, #10a grade-cap-B reason absent when cap not
  binding, #12 deterministicNarrative ids + "After the survived challenge" phrasing,
  #14 tautological verdict/gradeCap asserts in judgeChain.
- **Fix wave (`90bcf13`, 11 files, +214/−64):** `componentDisplayName` resolution
  threaded through challenge reasons/summaries/attack details/rival flips
  (`AttackContext.nameOf`), blueprint diff entries, deterministic narrative,
  revision history, and S4 leader rows/rival label — **ids stay in data fields**
  (keys, `memberId`, `evidenceIds`); `runRevisionSchema` gained optional `at` and
  replace stamps it, so the blueprint falls back to `ranked[0]` when a revision
  postdates the report (F6); fit drops surfaced on every fit with per-member
  `constraintDropped` risk text + `constraint-conflict` risks (F4); `withinUsable`
  became `boolean | null` with honest "not measured (no floor area supplied)" copy
  in panel + Markdown (F3); `hasNumericProse()` rejects LLM title/rationale digits
  outside kept `[evidence-id]` citations → deterministic fallback +
  `blueprint.compose_fallback` (F5); grade-cap-B reason now emitted whenever cap
  B binds regardless of engine grade (F10a); `ChallengePanel` renders the
  `attack.detail` line (F8a) with `.s4-attack-detail` styling. **New this
  clause-map pass:** the Plan's `Shift-scale` mutation operator is confirmed
  implemented only as the catchment attack re-measure — recorded as B-11 #16
  instead of being claimed (see the map's Mutation block).
- **Test pins (`f8b2172`, 6 files, +137/−26):** 11 expectations corrected to the
  review-corrected behavior (display-name reason strings; honest
  "4 measured attacks, 1 skipped" lead — the old exact "all five" pin was itself
  the false claim; revision `at: TEST_NOW`; S4 verdictSentence = server reason
  verbatim; judgeChain pins `verdict "Revised"` + `gradeCap "A"` instead of
  membership tautologies) + **4 new tests**: LLM numeric prose rejected (fallback
  + ledger reason), digits inside kept citations accepted, stale-vs-fresh leader
  selection both directions, feasible-fit drops surfaced (risks +
  `constraintDropped` + schema-valid). Plus F1 honesty asserts on the
  bridge-outage reason (`not.toContain("all five attacks")`, measured-count
  regex, contains
  "not completed").
- **Gates re-run after the wave:** typecheck 0 (dual tsconfig), lint 0, Vitest
  **746 pass / 5 gated-live skips**, Playwright **10/10** (judge-flow + smoke
  against fresh dist), **build PASS**, `git diff --check` clean (exit 0), diff
  secret scan 0 hits. One post-wave fallout caught by the full suite
  (`tests/api/challenge.test.ts` pinned id prose) and corrected to display names —
  full suite green before commit.
- **Browser walk (production dist, `tmp/phase8-walk.ts`, fixture judge pipeline):**
  server + Chromium in one process; findings in `tmp/phase8-walk.json`
  (UTF-16 via PowerShell redirect), screenshots `tmp/phase8-01…06.png`.
  Verified live: pre-verdict question banner; after challenge → verdict `Revised`,
  reason = `2 mutations applied: 1·dropped Court Tree Roasters; 2·dropped Clay
  Collective…` (names, no ids); five attack rows with **rendered detail lines**
  (`removing Blue Note Corner is the least costly cut…`,
  `…leadership moves to Blue Note Corner + Clay Collective + …`) and
  `s4ShowsNoComponentIds=true`; leader rows show names + REMOVED strikes; S5
  title `The Williamsburg corner plan` + `LLM` pill + honest grade `B`; fit line
  `not measured (no floor area supplied)`; **2 constraint-drop rows visible**
  (`no format of Music venue satisfies the site constraints`, same for Bar);
  compare modal left column = frozen-Prior names only; share view read-only in a
  fresh context; invented citation absent; no `undefined` anywhere;
  `consoleErrors=[]`, `pageErrors=[]`.

### Phase 8 — exit-gate e2e: S4 + S5 browser coverage (2026-10-16, commit `0f3620a`)

- **Orchestrator gate run:** typecheck 0 (both tsconfigs), lint 0 (`npx eslint .`),
  Vitest **742 pass / 5 gated-live skips** (unchanged from the W-8.6 tree), Playwright
  **10 pass** (6 judge-flow + 4 smoke), **build PASS**. `git diff --check` clean; diff
  secret scan clean (one `shareToken` local-name hit in my own assertion, no key
  material).
- **New coverage — `e2e/judge-flow.spec.ts`, S4 test:** pre-challenge banner reads
  `Can the leader be broken?`, the attack list is empty and the `.s4-empty` placeholder
  is visible; after the click the banner changes, five `.s4-attack` rows render with
  five distinct `.s4-attack-name` values, the first row carries a real
  `is-(measured|skipped|not-completed)` state class, `.s4-banner-meta` records
  `chosen by the agent` (the `attackOrderSource === "llm"` path), the rendered order
  starts with `JUDGE_ATTACK_ORDER[0]`, and the honest-text guard passes.
- **New coverage — S5 test:** blueprint title equals `JUDGE_COMPOSE_TITLE`, source pill
  reads `LLM`, the rationale carries the scripted sentence, the invented citation
  `JUDGE_INVENTED_CITATION` (and its `ev-`-stripped stem) is **absent** from the
  rendered rationale, `.s5-rationale sup.s5-sup` refs and `.s5-receipt-list li`
  receipts are non-empty, the grade square has an honest A/B/C `aria-label` and
  `.s5-method-link` points at `/method`. The Without-Qloo modal opens with heading
  `Without Qloo` and the `With no cultural evidence` column, then closes on Escape.
  A fresh browser context loads the share route read-only (title renders, no
  `Challenge the plan` button, no `.s1-tab` nav).
- **Two assertions I wrote wrong, found by evidence not inference:** (1) I first
  asserted the compare modal contained the prose `Without Qloo comparison` — the real
  heading is the literal `Without Qloo` (`CompareModal.tsx:44`) and the column is
  labelled `With no cultural evidence`. (2) I first read the share URL from
  `window.location.href` after clicking Share — wrong: `Share blueprint` only writes
  `blueprint.shareUrl` to the **clipboard** (`BlueprintPanel.tsx:86`) and never
  rewrites the route. The share view is now reached from the token the server actually
  persisted (`store.findBlueprintSnapshot(runId).shareToken`), which is the real read
  path (`findBlueprintSnapshotByShare`).
- **Fixture plumbing:** `withFixture` in the spec gained an optional `JudgeLlmOptions`
  second argument, so the two new tests opt into `labelLlmResponses` for
  `challenge.attack_order` and `blueprint:compose` while every existing test keeps the
  default four-turn positional fixture untouched.
- **Order-dependence note (not a defect):** during the first full-suite run, the
  pre-existing `S3 replacement records R1` test failed with an empty
  `.s3-replace-attack-kind` list, then passed both in isolation and on the subsequent
  full run. My diff touches only this spec file (adding two tests) and the S3 failure
  mode is unrelated to the S4/S5 paths I added; recorded as observed, not diagnosed.

### Phase 8 — W-8.6 S4/S5 full-chain contract test (2026-10-16, commit `cce7b87`)

- **Orchestrator gate run:** typecheck 0 (both tsconfigs), lint 0 (`npx eslint .`),
  Vitest **742 pass / 5 gated-live skips** (747 total — +1 over the W-8.5 tree: the
  full-chain judge test), **build PASS** (dist/web regenerated). `git diff --check`
  clean (LF/CRLF notices only); diff secret scan clean (3 files, no key material).
- **Root cause found by evidence, not inference:** the fake LLM queue is strictly
  positional (`responses[calls.length]`), so a label-keyed responder placed at index 4
  was consumed as call #5 and the blueprint compose turn (#6) fell through to the
  deterministic fallback. The first assertion of `narrativeSource === "llm"` failed with
  `"deterministic"`, and the ledger event `blueprint.compose_fallback` carried
  `fake llm: unexpected call #6 ("blueprint:compose") with no scripted response` — that
  summary was the evidence, not a guess.
- **Fixture fix (`tests/agent/support/fakes.ts`):** `fakeLlm` gained an optional
  per-label queue consulted **only after** the positional queue is exhausted, so every
  existing call-ordered test keeps its exact prior behaviour and a test can script
  just the post-completion turns without counting the unscripted turns between them.
  Missing from both queues still throws the original honest error. No label takes
  precedence over a scripted positional slot.
- **Verified regression check:** with a fixture-wide label queue wired in, `tests/api/challenge.test.ts`
  failed with `attackOrderSource "llm"` where it scripts no order and expects
  `"diagnostic"`. Reverted to opt-in `labelLlmResponses`; that suite is green again.
- **New coverage — `tests/api/judgeChain.test.ts` (4th test in the file):** POST
  `/challenge` → 200, `challengeResponseSchema` parse, `attackOrderSource "llm"`, the
  five kinds in `JUDGE_ATTACK_ORDER` order, and the **observed** fixture statuses
  (`measured, skipped, skipped, measured, measured` — written from a captured run, not
  assumed); then GET `/blueprint` → 200, `blueprintResponseSchema` parse,
  `narrativeSource "llm"` (proves the compose turn now runs for real),
  `title === JUDGE_COMPOSE_TITLE`, the invented citation `JUDGE_INVENTED_CITATION`
  absent from the rationale, every remaining `[id]` present in
  `fixture.store.listEvidence(runId)`, `evidenceGrade.rule` non-empty, honest
  `gradeCap`/`verdict` enum membership, `methodUrl "/method"`, a share URL carrying
  `?share=`, and a non-empty `expiresAt`.
- **Contract assertion that was corrected mid-work:** an early version asserted
  `document.evidenceGrade.grade === report.gradeCap`. That conflates two distinct
  fields — `evidenceGrade.grade` is evidence quality (A/B/C) and `gradeCap` is the
  post-challenge cap (A/B). The chain is the authoritative source; the test now asserts
  each against its own contract. Both were `B`/`Revised` in the observed run.
- **Design note (D-8.17):** `fakeLlm`'s label queue is a **test-infra** affordance. It
  does not weaken production code, does not fabricate Qloo/DeepSeek data, and does not
  alter any production label. The fixture's compose turn cites one real stored evidence
  id and one invented id precisely so the strip-unknown rule is proven against a real
  HTTP response rather than asserted.
- **Remaining for the exit gate:** e2e (Playwright) over the W-8.5 UI, the
  fixture-browser walk, the independent review, and the clause map.

### Phase 8 — W-8.5 S4/S5 UI (2026-10-16, commit `424cf76`)

- **Orchestrator gate run:** typecheck 0 (both tsconfigs), lint 0 (`npx eslint .`),
  Vitest **741 pass / 5 gated-live skips** (746 total — +39 over the W-8.4 tree: 12 s4
  + 20 s5 + 7 HTTP), **build PASS** (dist/web regenerated). e2e + fixture-browser walk
  deferred to the Phase 8 exit gate, which is now unblocked (the full-chain contract
  needs the W-8.5 UI). `git diff --check` clean (LF/CRLF notices only); diff secret
  scan clean (14 files, no key material).
- **New coverage — `tests/web/s4Model.test.ts` (12):** null run → null; no report →
  honest pre-verdict with no invented verdict/attacks/grade; gate mirrors the server
  (investigating / stopped / empty-ranked blocked with the exact refusal copy, ready
  when a ranked leader exists); Survived = solid square + verbatim reason; Replaced =
  crossed square + "Replaced by …" rival sentence; attacks sorted to spec order with
  circles measured→filled / not completed→crossed / skipped→empty; leader rows strike
  swaps with a replacement, strike drops without one, and add bridge inserts; an
  invalid report fails the shared schema at the boundary.
- **New coverage — `tests/web/s5Model.test.ts` (20):** citation segments map known
  tokens to receipt numbers and drop unknown tokens (never render as confirmed);
  compareState 3-way (changed / neutral only when kept ∧ nothing moved / all-empty =
  honest no-prior); receipts numbered globally with members pointing at their indexes;
  footprint fraction against the brief's area; overnight hours wrap into two segments
  while unparseable hours are omitted; constraint reads and downshifts verbatim; slope
  pairs (kept+reformatted on both sides, removed prior-only, added final-only);
  diffSentence exact; polish null-vs-present from the frozen Prior; revision sentences
  carry both coherence percentages; honest "Not recorded"/"None recorded" fallbacks;
  markdown export contains every section, the neutral line only in the neutral case,
  and "No risks were flagged." when risks are empty.
- **New coverage — `tests/web/api.test.ts` (+7):** challengeRun POST contract (url,
  method, headers, `{}` body, `{focus:"bridge"}`, run-id encoding); typed CONFLICT 409
  guard refusal surfaces the server's honest message; INVALID_RESPONSE on a non-contract
  2xx; getBlueprint fetch + `?share=` query encoding + SNAPSHOT_EXPIRED 410 mapping.

### Phase 8 — W-8.4 Without-Qloo polish on the frozen Prior (2026-10-15, commit `99510fc`)

- **Orchestrator gate run:** typecheck 0 (both tsconfigs), lint 0 (`npx eslint .`),
  Vitest **702 pass / 5 gated-live skips** (707 total — +7 over the W-8.3 tree: 5 unit
  + 2 HTTP), **build PASS** (vite 170 modules, dist/web regenerated). e2e +
  fixture-browser walk deferred to the Phase 8 exit gate (full-chain e2e contract
  needs W-8.5). `git diff --check` clean (LF/CRLF notices only); diff secret scan
  clean (5 files, no key material).
- **New coverage — `tests/agent/prior.test.ts` (+5):** system prompt demands the
  `"polish"` field with no-evidence framing (`contains('"polish"')` +
  `contains("no cultural evidence")`); valid polish extracted into the frozen Prior in
  the SAME single call (`llm.calls` 1, ledger = 1 LLM event, `priorSchema.parse`
  idempotent); present-but-invalid polish (1300 chars) → `prior.polish` undefined +
  Compute ledger `prior.polish_unavailable` whose summary promises "the frozen Prior
  alone", Prior itself unaffected; non-string polish object → same honest drop;
  model omits polish → `Object.hasOwn(prior, "polish")` false with ZERO extra ledger
  events (pre-W-8.4 fixture ledger counts provably unchanged).
- **New coverage — `tests/api/runs.test.ts` (+2):** POST /api/runs with a polished
  prior fixture → 201 carrying `run.prior.polish` byte-exact + `qlooUsed:false`, then
  `GET /api/runs/:id` round-trips the same polish (declared `priorSchema` field
  survives persist/load/reparse); default stack (no polish in the fixture) → 201 with
  `polish` honestly undefined.
- **Design note (D-8.15):** polish rides the Prior's own completion and is stored
  inside `priorSchema` — `generatePrior` still returns `Prior` (zero call-site
  ripple across orchestrator/agent/live tests), the Prior deep-freeze covers it,
  no dedicated route (ARCHITECTURE §3 locks the 11-route surface; the compare modal
  is a client projection over `run.prior` + blueprint in W-8.5), and
  `priorDraftSchema.polish` is `z.unknown().optional()` so a malformed polish can
  never fail the Prior.

### Phase 8 — W-8.3 S5 Place Blueprint + share snapshots (2026-10-15, commit `ff54a0d`)

- **Orchestrator gate run (post-review):** typecheck 0 (both tsconfigs), lint 0
  (`npx eslint .`), Vitest **695 pass / 5 gated-live skips** (700 total — +13 over the
  W-8.2b tree: 9 unit + 4 HTTP), **build PASS** (vite 170 modules, dist/web
  regenerated). e2e + fixture-browser walk deferred to the Phase 8 exit gate (no web
  surface changed in W-8.3; the e2e contract requires challenge→blueprint→without-Qloo,
  which needs W-8.4/W-8.5). `git diff --check` clean (LF/CRLF notices only).
- **New coverage — `tests/orchestrator/blueprint.test.ts` (9):** happy contract (LLM
  narrative with a known citation kept and a bogus citation stripped, role order
  `["Anchor","Social","Night"]`, receipts carrying exact evidenceIds, fit numbers
  8000/6800/5050 exact, What Qloo changed kept=[night,anchor] / added=[social] /
  removed=[Vanishing Diner], risks length 1, grade A, shareUrl + 30-day TTL diff,
  `blueprint.compose` ledger label); downshift + reformatted scenario (area 5000 →
  total 3500, `Stage-and-bar`, night member → reformatted); gradeCap B cap from a
  stress probe; grade C when a leader member is unmeasured + thin-component risk;
  bridge component resolved from an embedded `challengeMutation.component` (Discovery
  group, grade B from failed edges); LLM-throw → deterministic fallback +
  `blueprint.compose_fallback` and NO `blueprint.compose`; ghost-citation rejection
  (narrative cites nothing known → fallback reason "cited no known evidence id");
  guard refusals (brief/prior/pool/compositions/missing leader member); fingerprint
  stability (status/phase flips do not change the fingerprint, brief change does).
- **New coverage — `tests/api/blueprint.test.ts` (4, real HTTP over the judge fixture
  with `extraLlmResponses`):** 200 + strict `blueprintResponseSchema` parse, narrative
  `"llm"` with a stored-record citation kept and `[ghost-id-not-real]` stripped, EVERY
  citation (narrative + receipts + diff + risks) asserted ⊆ `store.listEvidence` ids,
  role groups sorted in canonical pool order, `whatQlooChanged.removed` contains
  "Devoción", evidence grade byte-equal to `ranked[0].grade`, 30-day TTL, shareUrl;
  cache: second GET byte-identical with `blueprint.compose` count **1** and
  `blueprint:compose` count **1** (one LLM turn); share round-trip
  `?share=token` → same body, unknown share → **404 RUN_NOT_FOUND**, expired snapshot
  (overwritten with `TEST_NOW`-past `expiresAt`) → **410 SNAPSHOT_EXPIRED**, then
  non-share rebuild → 200 `"llm"` with the SAME token and `blueprint.compose` count 2;
  unknown run → 404 RUN_NOT_FOUND.
- **Fixture/review notes:** the judge fixture's clock is frozen at `TEST_NOW`
  (2026-10-08) — expiry tests must set `expiresAt` relative to `TEST_NOW`, not
  `Date.now()` (found by a failing 410 assertion, fixed). The rebuild after expiry
  consumes a second scripted LLM response (`extraLlmResponses` length 2) or honestly
  falls back to `"deterministic"` (first observed, then pinned to `"llm"` with the
  second response). `routes.test.ts` valid blueprint fixture gained the required
  member `role` field after the tightened `blueprintMemberSchema` rejected it.
- **Schema seam:** `blueprintResponseSchema`/`blueprintQuerySchema` now typed; the
  GET handler re-parses `req.query` (Zod middleware validates but does not replace
  it) so `?share=7` still fails with `VALIDATION_FAILED`.

### Phase 8 — W-8.1 format/fit + W-8.2a challenge engine (2026-10-15, commits `0c8ba6f`, `f786607`)

- **Orchestrator gate run (post-review):** typecheck 0 (both tsconfigs), lint 0
  (`npx eslint .`), Vitest **677 pass / 5 gated-live skips** (682 total — +12 W-8.1,
  +23 W-8.2a over the 642 Phase 7 close), **build PASS** (vite 170 modules, dist/web
  regenerated). e2e + fixture-browser walk deferred to the Phase 8 exit gate (no web
  surface changed in W-8.1/W-8.2a; the e2e contract requires challenge→blueprint→
  without-Qloo, which needs W-8.3/W-8.4). `git diff --check` clean (LF/CRLF notices
  only, repo-wide pre-existing).
- **New coverage:** `tests/engine/formats.test.ts` (12 — format resolution, 85%
  circulation rule, chip parsing, downshift-before-drop with Anchor preserved,
  infeasibility honesty); `tests/orchestrator/challenge.test.ts` (22 — `resolveVerdict`
  3-way incl. Replaced; Survived fixture: diagnostic order, evidence-linked bridge,
  exact reason copy; swap-then-drop fixture stops at the 2-mutation bound with rounds 3;
  drop-only fixture rounds 2 (unique roles block substitution); deterministic double-run
  via canonical report + ledger labels (evidence ids stripped — `randomUUID`);
  bridge outage / empty-entities / budget-exhaustion honesty with **zero** gateway
  calls at budget 0; LLM order fenced-JSON success, partial-order padding, garbage and
  throw fallbacks each emitting `challenge.order_fallback`; focus-first ordering;
  status/pool/compositions/ranked guards; orchestrator-level RunNotFound, persisted
  `challengeReport` round-trip, RunBusyError via gated llm); `tests/api/challenge.test.ts`
  (1 — POST challenge over the real judge fixture server: strict `{run, report}` schema
  validation, attacks in spec order, `attackOrderSource` diagnostic, gradeCap A,
  prior/compositions/graph/candidatePool byte-equal after challenge, 1–3 probe evidence
  delta, ledger labels, persisted re-read via GET). `tests/routes.test.ts` challenge
  fixtures upgraded to the strict contract (invalid fixture proves verdict `Shattered`
  and gradeCap `S` rejection); `judgePipeline` fixture gateway gained a `bridge`
  operation (Sonic Youth / Yo La Tengo entities) so the HTTP path can reach cap A —
  same extension pattern as its existing search/insights branches.

### Phase 8 — W-8.2b bridge insertion + shared rebuild chain (2026-10-15, commit `6903c25`)

- **Orchestrator gate run (post-review):** typecheck 0 (both tsconfigs), lint 0
  (`npx eslint .`), Vitest **682 pass / 5 gated-live skips** (687 total — +5 over the
  W-8.2a tree), **build PASS** (vite 170 modules, dist/web regenerated). `git diff
  --check` clean (LF/CRLF notices only) and diff secret scan clean (patterns
  api_key/secret/password/token/Bearer/sk- → 0 hits in the 6-file diff). Scope
  contract-exact: 3 server files + 3 test files, nothing else.
- **Review posture:** orchestrator-executed (spawn channel 5/5 cancelled, D-7.7
  lineage); AGENTS §17 adversarial self-review of both server diffs before commit —
  extraction from replace.ts verified verbatim-equivalent (same inputs, order,
  try/catch, error text; `replace.test.ts` 19/19 as the regression canary);
  challenge.ts reviewed for: scratch/pool/graph always paired (temp pool never
  persisted), found-flag semantics (true only on terminal "measured", false on
  budget/failure so an honest retry survives), failed calls emit ledger events
  without evidence records, `buildReason` stopNote null-`memberOut` branch,
  detail/summary ≤300/500 slices, only one bridge mutation possible per run.
- **New coverage:** `tests/orchestrator/challenge.test.ts` 27 tests (+5): fixture D
  proves **Replaced through the real path** (two swap mutations, `verdictRival` =
  `["social-b","disc-b","night"]`, leaderAfter coherence 0.8667, reason copy with the
  pending third drop); fixture E proves **bridge insertion end-to-end** (weakest link
  0.3 < 0.35 → bridge first in diagnostic order; applied round 1, ablation drop anchor
  round 2, verdict Revised, `comp-bridge-*` member in leaderAfter, 4 evidence records,
  final-round bridge row "skipped"/"recorded probe stands", candidatePool/compositions/
  graph/neighborhoods byte-equal to the fixture — scratch never leaks into persisted
  state); honesty trio — budget `remaining=1` → "not completed" + `measuring a
  connecting component needs 3 Qloo calls` with exactly the 3 pre-probe gateway calls;
  resolveTags empty → honest "measured" round-1 with evidence exactly 2 (probe+tag)
  and no site fetch; site insights outage → gradeCap B + `challenge.bridge_site_fetch`
  failed-call ledger row with evidence exactly 6. Existing B/C/persistence fixtures
  hardened with `emptyBridgeGateway()` so the default gateway's bridge measurement
  cannot silently alter their evidence counts; fixture A asserts the no-neighborhoods
  guard copy. `tests/api/challenge.test.ts` evidence delta pinned to **exactly 4**
  (probe+tag+site+city — the judge fixture measures the bridge chain for real) with
  verdict/rounds/mutations/coherences/reason/leaderAfter pinned from observed output;
  ledger labels now assert `challenge.bridge_probe`, `challenge.bridge_measure`,
  `challenge.mutation`. `tests/support/judgePipeline.ts` gained the
  `urn:entity:artist-sonic-youth` site entity (overlapping artist signals so the
  rebuilt bridge graph gets real edges) and the "Sonic Youth" → `tag-noise-rock-1`
  resolveTags entry; city baseline table derives the new key automatically.
- **Behavioral pins:** judge-fixture challenge outcome observed and pinned —
  diagnostic order (weakest link 0 < 0.35 → bridge first), bridge measured in round 1
  (4 evidence) but scored no gain → drops applied rounds 1–2 → verdict **Revised**,
  rounds 3, gradeCap **A**, leaderAfter `["comp-blue-note","comp-rooftop",
  "comp-sunset-vinyl"]` coherence 0.1465, stop note cites the pending
  `drop comp-blue-note`.

### Phase 7 — W-7.5 Replace + revisions (2026-10-13, commit `bd1cb20`)

- **Orchestrator gate run (post-review):** typecheck 0 (both tsconfigs), lint 0, Vitest
  **631 pass / 5 skips** (636 total; +33 new; the 5 skips are the gated-live suite —
  degradedBoot ran because the port was free), build PASS, **e2e 4/4** on a freshly
  restarted production server serving the fresh dist, `dist/web` secret scan
  **0 hits / 5 files**.
- **New coverage:** `tests/orchestrator/replace.test.ts` (19 — pool swap with zero Qloo
  + engine-true deltas + exact revision row + mini-stress shape + ledger label order;
  double-run determinism; sequential revision numbering; refusal matrix (unknown
  candidate / already-in-composition / role mismatch / off-ranked swap / unknown target /
  off-ranked target / XOR violations) all with zero calls; compositionKey happy path with
  delimiter normalization proving `membersBefore` targets the *selected* composition;
  unknown-key and wrong-member refusals with zero calls; state guards (resumable/stopped/
  failed, revision cap 100); custom path exactly-4-call request-shape assertions, pool
  growth, provenance, evidence count, ledger sequence; **triangulation re-derivation**
  (stale `route1Value 0.99` → equals rebuilt graph edge value, probes `resultCount 9` /
  `focalInTopHalf` carried forward); no-tag → `UNKNOWN_ENTITY` + untouched state; pool-cap
  refusal without calls; budget refusal; empty query; orchestrator-level RunNotFound /
  store persistence / RunBusyError mid-pass) + `tests/web/replaceModel.test.ts` (14 —
  signedDelta, sameMembers, findBefore default + keyed + normalization, refusal reasons,
  alternative listing/sort/cap/bars, custom-block reasons, revision-row projection,
  readReplaceSuccess incl. `kind:"full"`/garbage → null) + `tests/routes.test.ts` valid
  fixture now carries `compositionKey`. Fixture extended with a 5th ranked composition so
  the keyed swap lands inside the family.
- **§17 review of adopted spawn files (17 files, 5 new):** `measure.ts` diff verified a
  faithful extraction (helpers moved verbatim, then exported); `replace.ts` validation and
  probe budget read line-by-line; `ReplacePanel` focus/Esc/aria-live/honest-failure copy;
  s3.css design locks (SVG-pattern hatching, no shadow/radius/gradient); grep sweep of
  the whole surface = 0 hits for `console.*` / forbidden CSS / `Math.random` / `Date.now(`
  and zero authored comments in the three main new files.
- **Debug evidence:** spawn's custom path was never executed before handoff; failure
  ("swapped composition is not ranked") root-caused with `tmp/debug-replace.ts` +
  instrumented error output → family built as ONE size-4 composition (`min(5, poolAfter)`)
  while the swap is size-3; fixed by pinning `size = min(stored family.size, poolAfter.length)`
  (D-7.17).

### Phase 7 — W-7.4 S3 Connections + Evidence drawer (2026-10-12, commit `3591f75`)

- **Orchestrator gate run (post-review):** typecheck 0 (both tsconfigs), lint 0, Vitest
  **598 pass / 6 skips** (604 total; +30 new, +1 environmental flip — degradedBoot port
  skip reappeared because the production server was up), build PASS, **e2e 4/4** on the
  restarted production server serving the fresh dist, `dist/web` secret scan
  **0 hits / 5 files**.
- **New coverage:** `tests/web/s3Model.test.ts` (30 — pairKey orientation,
  composition-key delimiter normalization, `pairStateFor` unmeasured/tri/band branches,
  `lineStyleFor` weights+dashes, stress sentence (clean / distorted-count / singular
  "1 pair" / high-stress pointer / jitter), buildS3Model null guards, MDS determinism
  across rebuilds AND edge-order shuffles, unit-box containment, scale-note lock,
  options A/B/C + measured-prior P, default-leader selection, requested/unknown key,
  map-lines-only-members (exactly 3 of 10 pairs), chart/list completeness (10 unique
  keys each way), unmeasured-last sort, weakest headline + band fallback reason +
  unmeasured-weakest honesty, measured-but-empty-sharedEntities → unmeasured,
  drawer claim sentence with pool-resolved names + sorted tiles + fraction + howComputed
  lock, triangulation sentences for confirmed/contested/thin(count)/failed(0-results)/
  missing, unmeasured drawer verbatim `UNMEASURED_COPY`, ledger-link priority+cap+drop,
  no-evidence fallback, node-sheet provenance chain + unknown-id honesty, full-model
  JSON determinism). Fixtures parsed through `runStateSchema`.
- **§17 review of adopted partial files:** all 5 spawn-written files read line-by-line;
  MDS/stress math verified deterministic (no `Math.random`/`Date.now`, index-derived
  starts, canonicalized eigenvectors); SVG-pattern hatching instead of CSS gradients;
  drawer never invents names (pool-resolved or entityId verbatim); `state.graph`
  consumed display-only; design locks grep-verified; `onReplace`/`onChallenge` gated
  behind optional props (RunRoute passes neither — no dead buttons rendered).
- **Orchestrator correctives recorded:** unused-symbol removals, lint fix,
  `findWeakestReason` fall-through (reason now "Shared culture between them is strong."
  instead of `null` for confirmed-with-band pairs — regression covered by the weakest
  test).

### Phase 7 — W-7.3 S2 Compositions workspace (2026-10-12, commit `f8717d7`)

- **Orchestrator gate run (post-review):** typecheck 0 (both tsconfigs), lint 0, Vitest
  **569 pass / 5 skips** (+30 vs W-7.2's 539; 5 skips = gated-live, the degradedBoot
  port skip flipped to a run because the production server was up), build PASS, **e2e 4/4**
  against a restarted production server on the fresh dist, `dist/web` secret scan
  **0 hits / 5 files**.
- **New coverage:** `tests/web/s2Model.test.ts` (29 — binDistribution spread/single/empty,
  buildField A/B/C + dashed prior marks, empty-family reason + null field, percentile
  sentence incl. null + rounding, over-index projection (over/equal/unmeasured/
  unavailable), population z zero-sigma + known vector, dial w=0.5 ≡ stored order,
  w=0/w=1 monotonicity, tie-break chain (weakest desc → members lex), clamp, null-run /
  no-compositions guards, full model conformance via `runStateSchema.parse`, three-
  readings order, not-measured prior verbatim, measured prior card, thin-pool note,
  canonical role grouping, determinism across rebuilds, prettifyMemberId). Fixtures are
  parsed through `runStateSchema` so schema conformance is proven, never fetched.
- **§17 review of the cancelled-spawn sources:** all 7 s2 files read line-by-line;
  model formulas cross-checked against `src/server/engine/ranking.ts` (population z,
  tie-break order identical); CSS tokens (`--zq-motion-dial`, `--zq-ease-out`, `--zq-l5`)
  verified present in `tokens.css`; InvestigateMap and runStore confirmed untouched;
  no `console.*`, no comments, no new deps; design locks held (grep clean of
  shadow/radius/gradient in s2.css).

### Phase 7 — W-7.2 deterministic measurement chain (2026-10-12, commit `7180387`)

- **Independent orchestrator re-run (post-correction):** typecheck 0 (both tsconfigs),
  lint 0, Vitest **539 pass / 6 skips** (6 = 5 gated-live + 1 degradedBoot port-3000 skip;
  +23 vs W-7.1's 516), build PASS (server + web), **e2e 4/4** against a restarted
  production server on the fresh dist, `dist/web` secret scan **0 hits / 5 files**.
- **New coverage:** `tests/orchestrator/measure.test.ts` (18 — locality-ladder forms,
  empty/missing-pool no-op, full-chain happy path with evidence↔ledger linkage +
  `runStateSchema` round-trip, byte-identical determinism across runs, budget-reserve
  stop with zero fetches, empty-family honest reason, `shouldStop` between fetches,
  two-consecutive-failure stop, A/B/C grade honesty, never-confirmed-without-route-2,
  grade-B-when-triangulation-fails, Prior marker measured / not-measured, unlocalized
  city baseline (site calls carry `signalLocation`, city never does), failed calls emit
  ledger events without evidence, DNA share bounds + top-local `< 100` guard, Qloo-vs-
  Compute event-kind split), `tests/engine/edgeEntities.test.ts` (5 — dot-contribution
  ordering, cap honored, cross-domain intersection, deterministic tie-breaks);
  `tests/api/runs.test.ts` (+2 — JSON round-trip + strict assertions for the three new
  nodes incl. optional `sharedEntities`).
- **§17 review findings corrected pre-commit:** (1) DNA mapping per-side-max →
  share-of-total per side (D-7.4) — Architecture §10 / ProductSpec line 40 define DNA
  as over-index *versus the city*; (2) `graph as never` cast removed — `resolvePriorMarker`
  now typed to engine `CultureGraph`; (3) `sharedEntities` re-ingestion constraint
  recorded for W-7.4/W-7.5 (engine `graphEdgeSchema` is strict).

### Phase 7 — W-7.1 typed investigation outputs (2026-10-11, commit `99b53bd`)

- **Independent orchestrator re-run (post-correction):** typecheck 0 (`tsc -p
  tsconfig.json` + `tsconfig.build.json`), lint 0, Vitest **516 pass / 6 skips**
  (6 = 5 gated-live + 1 degradedBoot port-3000 skip), build PASS (server + web),
  **e2e 4/4** against a restarted production server on the fresh dist,
  `dist/web` secret scan **0 hits / 5 files**. One earlier full-suite run showed a
  transient vitest worker crash (0xC0000005) on `tests/persistence/contract.test.ts`;
  file passes in isolation (28/28) and the clean re-run reproduced nothing.
- **New coverage:** `tests/agent/pool.test.ts` (13 — tool JSON-schema contract,
  lettered-anchor/heat derivation incl. caps/dedup/no-synthetic, exemplar/tag
  grounding rejections, engine-without-repair rejection, cap boundary 10/11,
  shared↔engine vocabulary + cross-parse conformance), `tests/orchestrator/capture.test.ts`
  (4 — scripted LLM + fake gateway end-to-end: typed siteRead+pool persisted,
  `validatePool` re-acceptance, S1 readers `anchorsFromRun`/`heatFromRun`/
  `parseCulturalDna` accept the shapes, evidenceId↔store linkage, ledger ordering
  agent.candidate_pool → investigate:capture → measure.compose, fabrication
  rejection, single-proposal rule, no-pool honest capture), `tests/api/runs.test.ts`
  (+2 — JSON round-trip + strict/strip assertions for the new nodes).

### Phase 6 — W-6.1 web foundation + W-6.2b S0 Brief + W-6.3 S1 Investigate (2026-10-09, commits `579b23e`/`7f5380c`/`e85fdde`/`b71dd00`/`7dfb688`)

- **W-6.3 (`b71dd00`, orchestrator independently re-ran all gates):** typecheck 0;
  lint 0; Vitest **498 pass / 5 gated-live skips** (+43: dna/prior/ledger/stop/stream
  suites); build PASS; e2e 3/3 (`7dfb688` updated `/run/does-not-exist` assertions to
  the honest RUN_NOT_FOUND recovery copy + "Start a new investigation" link).
- **§17 live visual review (fixture-injected browser run against the built dist):**
  first screenshot caught 4 defects — string `symbol-sort-key` (map.ts), missing `" "`
  style image (MapTiler Town-labels quirk), Prior card overflowing into the DNA strip,
  status pill stuck on "Opening…" — all fixed as orchestrator corrective patches, then
  re-verified: final render shows **zero console messages**, Prior scrolls inside the
  map bounds, DNA Artists column unobstructed, RUN_NOT_FOUND shows "Unavailable".
- **Real Qloo live tests (2026-10-09, `LIVE_QLOO=1` with `.env` exported):**
  `tests/qloo/live.test.ts` **3/3** (local capabilities, real MCP tag resolution, real
  REST entity search) + `tests/agent/exit-gate.live.test.ts` **1/1** (full Phase 3 exit
  gate against live Qloo, scripted LLM per B-02) — **4/4 in 50.7s**, first time these
  gates ran with the key exported into the process.
- **Known limitation:** B-02 (DeepSeek HTTP 402) still blocks real-Prior runs
  (`POST /api/runs` → 503/502 DEPENDENCY_UNAVAILABLE); the S1 live-browser proof used
  the gitignored diagnostic fixture (client-side fetch/EventSource patches only — never
  imported by `src/**`, production paths stay real).

### Phase 5 — persistence + orchestrator + SSE/API + recovery exit gate (2026-10-09, commits `d912ebb`/`5fb61c0`/`6ec2531`/`7f11d7f`)

- **W-5.1 (`d912ebb`):** typecheck 0; lint 0; Vitest **339 pass /
  5 gated-live skips** (+46 vs Phase 4's 293). RunStore contract suite runs against
  both in-memory and Turso (`:memory:` / file URL) adapters; structuredClone isolation
  proven both directions; close/reopen durability proven on file-backed libsql.
- **W-5.2 (`5fb61c0`, orchestrator independently re-ran all five):** typecheck 0;
  lint 0; Vitest **354 pass / 5 gated-live skips** (+15). Stop idempotency, wall-clock
  cap → partial, resume-from-investigation, RunBusyError on concurrent resume/retry,
  zero agent/ edits (stop is orchestrator-local status).
- **W-5.3 (`6ec2531`, first two spawns stalled → third succeeded):** typecheck 0;
  lint 0; Vitest **369 pass / 5 gated-live skips** (+15: 7 API + 8 SSE). Four Phase 5
  routes real (POST create 201, GET state+evidence 200, POST stop 200, GET SSE);
  other seven still honest 503. SSE first frame always `state`; Last-Event-ID replays
  contiguous ledger only; non-contiguous gap → state-only fallback (no silent miss);
  terminal run → state frame then `res.end()`; heartbeat injectable (default 15 s).
- **W-5.4 (`7f11d7f`, first two spawns stalled → third succeeded):** typecheck 0;
  lint 0; Vitest **386 pass / 5 gated-live skips** (+17: 7 recovery + 10 exit-gate).
  Exit-gate file maps each clause of the gate sentence to a named test: stop ✓,
  refresh ✓, disconnect ✓, reconnect ✓, retry ✓, resume ✓, no corruption ✓,
  no duplicate effects ✓, no fabricated completion ✓, gap fallback ✓. Suite uses
  real createOrchestrator + createMemoryStore + fake LLM/gateway over real HTTP
  (createApp + startServer) — no store mocks. Zero src changes were needed.
- **Full gates independently re-run at every worker commit:** typecheck 0, lint 0,
  build PASS, e2e 3/3; secret scan clean at each boundary.

### Phase 4 — engine core + composition math + triangulation/grades + exit gate (2026-10-08, commits `ac63f63`/`3eb298b`/`04e8d3a`/`b759e83`)

- **W-4.1b (`ac63f63`):** typecheck (dual tsconfig) 0; eslint 0; Vitest **193 pass /
  5 gated-live skips** (+40 engine tests vs Phase 3's 153); byte-identical determinism +
  shuffle-independence tests; zero `Date.now`/`Math.random`/comments/hardcodes in engine
  src (grep); fixtures live only under `tests/engine/`.
- **W-4.2 (`3eb298b`, orchestrator independently re-ran all three):** typecheck 0;
  lint 0; Vitest **248 pass / 5 gated-live skips** (+55 composition/ranking/distinctiveness
  tests). Hand-worked arithmetic inspected in source: population z = ±√1.5 for
  `[1,2,3]`; rival-sweep leadership flip exactly at index 50 (w=0.5); `index.ts` diff is
  append-only (+38/−0).
- **W-4.3 (`04e8d3a`):** typecheck 0; lint 0; Vitest **286 pass / 5 gated-live skips**
  (+38 triangulation/grade/claim-citation tests); evidence diff additive-only; existing
  `tests/agent/evidence.test.ts` untouched and green.
- **Integration (`b759e83`, orchestrator):** barrel exports wired; exit-gate demonstration
  `tests/engine/exitGate.test.ts` (7 tests) green; full gates re-run: typecheck 0,
  lint 0, **293 pass / 5 gated-live skips**, build PASS, **e2e 3/3 PASS**.

### Phase 3 — agent controller + Prior Lock + exit gate (2026-10-08, commits `7e69523`/`8d5b422`/`62f29af`)

- **Unit suite at sign-off:** typecheck (dual tsconfig) PASS; eslint 0 warnings; Vitest
  **153 passed / 5 skipped** (158; skips = 3 gated live Qloo + 1 gated `LIVE_DEEPSEEK=1` +
  1 gated exit-gate run); `npm run build` PASS; **e2e 3/3 PASS**.
- **Exit gate LIVE run (orchestrator, `LIVE_QLOO=1`):** `tests/agent/exit-gate.live.test.ts`
  **1/1 PASSED against real Qloo** — real brief → persisted frozen Prior (`qlooUsed=false`,
  deep-frozen, referenced by identity from run state) → **real `qloo_search` observation**
  → validated mutation (`prior_pending → investigating → complete`) → ledger sequence
  `LLM, LLM, Qloo, LLM` → evidence record linked by `ledgerEventId` to the Qloo ledger
  entry, provenance = real envelope (transport/endpoint/durationMs/cacheState/resultCount).
  LLM side scripted (fake) — real-LLM Prior generation deferred per user exception (B-02:
  valid key, zero balance, 402). Real Qloo outage mid-loop covered by unit test
  (honest partial state: prior + partial ledger/evidence preserved, no fabricated fields).
- **Prior Lock proof:** write-once conflict throws; frozen prior resists `Reflect.set`;
  gateway spy asserts **0 calls** until Prior persisted; `prior.ts` grep = zero qloo imports.
- **Budget proof:** peak/off-peak rate selection (fixed clocks), cache-miss conservative math,
  80% reserve refusal (`LLM_BUDGET_RESERVE`), 100% ceiling (`LLM_BUDGET_CEILING`), constructor
  clamp to `LOCK_LLM_BUDGET_USD = 2`.
- **Pricing source:** official https://api-docs.deepseek.com/quick_start/pricing fetched
  2026-10-08 (`deepseek-flash`: in miss $0.15/$0.30 off/peak, hit $0.003/$0.006, out
  $0.60/$1.20; peak = 01–04 & 06–10 UTC Mon–Fri) — reproduces the spec's $0.45/$0.90 examples.

### Phase 3 — Qloo gateway (2026-10-08, commit `8a4c367`)

- **Vitest: 105 passed / 3 skipped across 12 files** (orchestrator independent re-run
  post-review) — incl. `tests/qloo/`: fake-transport gateway contract (guards before
  spend, POST-body path for `signal.interests.entities.query`, cache hit/TTL, budget
  exhaustion → RATE_LIMITED, ≤2 retries on retryable errors, 400 → no retry, malformed
  → DEPENDENCY_UNAVAILABLE, empty → `status:'empty'`, secret scrub on every thrown
  error), projection stripping, REST transport plan/serialization tests, config
  QLOO base-URL cases. 3 skipped = gated live suite.
- **LIVE Qloo: 3/3 passed (real service, orchestrator-run, `LIVE_QLOO=1`)** — REST
  capabilities readiness; **MCP path**: real `@qloo/qloo-harness` child process over
  stdio → `qloo_find_tags {query:"jazz"}` → `status:ok`, tags projected; **REST path**:
  `/search?query=coffee&type=urn:entity:place&take=3` → projected entities with
  provenance endpoint = hackathon host. Total 48.3 s.
- Gates independently re-run by orchestrator: `typecheck` (dual tsconfig) ✅, `lint` ✅,
  `build` ✅, `test:e2e` 3/3 ✅ (SPA + healthz unaffected by gateway additions).
- Verification extras: full `EXPECTED_QLOO_CONTRACT_CHECKSUM` sha256 matches
  `node_modules/@qloo/qloo-harness/dist/router.js` (source not fabricated); MCP SDK
  `StdioClientTransport` merges `getDefaultEnvironment()` (child gets PATH);
  `git diff` secret scan clean; no canned/fixture data anywhere in `src/`.

### Phase 2 — automated suites (2026-10-06)

- **Vitest: 62/62 passing across 8 files** (`npm test`) — shared error model (§3.0 parity:
  all 9 codes/statuses/body shape), config loader (lock bounds, required vars, URL checks,
  no-value echo), logger redaction, route schemas, healthz (200 schema + 503 naming removed
  vars + no-secrets-in-body), HTTP behavior (helmet, 400 validation with path details, honest
  503 on unimplemented routes, 404 typed, 429 rate limit, 500 INTERNAL without stack leak),
  static/SPA (fallback, immutable hashed assets, `/api` never swallowed), and a **degraded-boot
  integration test spawning real `dist/server/main.js`** (503 + named vars + process alive).
- **Playwright: 3/3 passing** (`npm run test:e2e`, system Chrome `channel: "chrome"`, real
  production build via webServer) — `/healthz` 200, SPA mounts on `/`, SPA fallback on
  unknown client route.
- **Gates green on orchestrator re-run:** `typecheck` (dual tsconfig), `lint`, `test`,
  `build`, `test:e2e` — then **fresh-checkout exit gate**: local clone → `npm ci` (250 pkgs)
  → all gates → start **without `.env`** → `/healthz` 503 naming `NODE_ENV`+`APP_BASE_URL`,
  WARN in stderr, process stays alive (degraded) → copy `.env.example` → `/healthz` 200
  `{"status":"ok",…}` → 3/3 e2e → port 3000 clean → temp clone removed.
- **Secret hygiene:** scans of changed files → 0 key-material hits; `.env` never read by
  orchestrator or tests (degraded test strips env vars; e2e injects its own deterministic env).

### Gate A — live Qloo diagnostics (Phase 0/1 evidence, retained)

**Live Qloo diagnostics — Gate A (REST path), 2026-10-06, 10 real calls against `https://hackathon.api.qloo.com` with `X-Api-Key`:**

| Probe | Request | Result |
|---|---|---|
| A1 | `GET /search?query=cinema&type=urn:entity:movie` | **200**, 210 KB → `results[].entity_id`, `types`, `properties.image.url`, `tags[].tag_id` |
| A2 | `GET /v2/tags?query=cinema` | **400** — error enumerates real params: `filter.results.tags, filter.tags, filter.parents.types, filter.tag.types, filter.query, filter.popularity.min/max` |
| A3 | `GET /v2/tags?filter.query=cinema` | **200**, 5.3 KB → tags carry `id` (URN), `type`, `parents[].type` (**includes `urn:entity:place`**), `popularity` |
| A4 | `GET /search?query=Williamsburg&type=urn:entity:place` | **200**, 347 KB → `address`, `geocode`, per-weekday `hours`, `business_rating`, `external.google_place` |
| B1 | `/v2/insights?filter.type=urn:entity:place&signal.interests.tags=<place tag>` | **200**, 309 KB — **accepted** a place-scoped tag as signal |
| B2/B3 | `/v2/insights?...&signal.interests.entities=<place id>` | **200**, 377 KB (take=20) → `results.entities[]` with `location{lat,lon,geohash}`, `popularity`, **`query.affinity` (numeric)**, `query.measurements.audience_growth` |
| C1 | `+ filter.location=POINT(-73.958 40.718)&filter.location.radius=2500&sort_by=affinity&take=5` | **200** — all 5 results inside the Brooklyn radius |
| C2 | `+ filter.location.query=Williamsburg, Brooklyn` | **200** — fuzzy named-locality filter works |
| C3 | same as C1 with `take=50` | **200**, 982 KB → statistics below |

**C3 statistics (50 results, Brooklyn 2.5 km):**
```
affinity    min 0.8051  max 0.8408  mean 0.8131  range 0.0357   ← compressed band
popularity  min 0.0394  max 0.9992  mean 0.6697  range 0.9598   ← wide
exact rank-position agreement (affinity vs popularity): 1 / 50  ← independent
cities returned: all "New York"                                    ← locality filter real
```

**Gate A — MCP transport path, 2026-10-06 (W-1.2 reconnaissance + independent orchestrator re-run):**

| Probe | Request | Result |
|---|---|---|
| M1 | `node dist/bin.js mcp` (`@qloo/qloo-harness` 0.1.26, temp dir, `QLOO_BASE_URL` + `QLOO_TRUSTED_BASE_URL` = hackathon host) | **Boots on stdio** newline-delimited JSON-RPC 2.0, no TTY, no LLM credential required |
| M2 | JSON-RPC `initialize` → `tools/list` | `serverInfo: qloo-harness 0.1.26`, protocol `2024-11-05`, capabilities `{tools, resources}`, boot→init 1544 ms; **10 tools** (`qloo_capabilities, qloo_recommend, qloo_rank, qloo_describe, qloo_where_popular, qloo_compare_audiences, qloo_entity_tags, qloo_audience_demographics, qloo_trends, qloo_find_tags`) |
| M3 | `qloo_capabilities` | 63 ms, `status ok` → contract v1.0.0, checksum `sha256:762bdcc5…924f5`, adapter `qloo_harness_mcp` canonical, `ready: true`, 9 `supported_operation_ids` |
| M4 | `tools/call qloo_find_tags {query:"jazz", limit:1}` | **Live 200-equivalent**: `status:"ok"`, `result_count:1`, `duration_ms:1618`, envelope has `interpretation/provenance/execution` |
| M5 | `qloo doctor --network --json` | `qloo-network: ok — accepted the configured credential`; `qloo-endpoint-trust: ok` for the hackathon base URL |
| M6 | Orchestrator independent re-run of `mcp-probe2.js` | **Identical contract checksum + 9 operation_ids** — worker claim reproduced, not trusted |

**MCP verdict: `USABLE-WITH-CONDITIONS` → Gate A REST + MCP paths BOTH PROVEN.** Four binding conditions
(trusted-base-URL env pair, normalized envelope ≠ raw REST, four demonstrated capability gaps needing the
REST fallback, long-lived child-process model) recorded in `ARCHITECTURE.md` §4.2. Tool-inventory details
(10 tools + input params) also live there. Artifacts stayed in OS temp dir — repo untouched.

**What this proves (and what it does not):**
- ✅ Auth, base URL, `/search`, `/v2/tags`, `/v2/insights` all live and typed (Gate A **REST** path).
- ✅ **`qloo mcp` + `qloo_capabilities` live and typed (Gate A MCP path) — Gate A now fully proven.**
- ✅ Numeric `affinity` **and** `popularity` are both real Qloo outputs (Gate E numeric source).
- ✅ Locality can be forced via `filter.location` / `filter.location.query` + radius (Spike 1 prerequisite).
- ✅ Affinity ordering is **not** popularity ordering (1/50 agreement) → non-popularity differentiation is
  possible; low-population/high-affinity candidates exist (Spike 1 / Gate C preliminary).
- ⚠️ **Affinity is compressed** (range 0.036): deltas must be normalized, never presented as large raw gaps.
- ⚠️ **Payloads are enormous** (0.2–1.0 MB per call; no server-side field filtering) → gateway must project
  fields before anything crosses SSE/DB.
- ❌ **Not yet proven:** shared-culture edge between two places; ≥80% concept→tag resolution (Spike 2);
  concurrency/latency (Spike 3); rank stability (Spike 4); presets (Spike 5); heatmap `urn:heatmap`,
  taste neighborhoods, explainability feature (not exercised in our calls).

**Secret hygiene verified:** `.env` → `.gitignore:2`; `tmp/insights_sample.json` → `.gitignore:37`;
`git grep` finds no key material; no raw Qloo response is tracked (official Qloo rule: never store
response data in a public repository — only aggregate statistics appear above).

**Phase 7 exit-gate verification (2026-10-15, orchestrator-run, current tree at `1acb896`):**

| Gate | Result |
|---|---|
| typecheck | 0 errors (dual tsconfig) |
| lint | 0 errors (`eslint .`) |
| unit | **642 pass / 5 gated-live skips** (62 files; +4 this session for `buildWeakestLine`) |
| build | PASS (vite → `dist/`) |
| e2e | **8/8** (smoke 4 + judge-flow 4; Playwright, production build, fresh server) |
| `dist/web` secret scan | **0 hits** across 5 files (Qloo/DeepSeek/Turso values + env-name literals) |
| fixture-browser review | S1 → S2 → S3 pair drawer → component sheet → Replace → success sheet walked live on the production build; **zero console errors/warnings**; screenshots `tmp/phase7-s2-compositions.png`, `tmp/phase7-s3-pair-drawer.png`, `tmp/phase7-s3-replace-success.png` |

Browser-walk highlights: S2 Field reads "50 valid combinations … 0.04–0.10" with grade-B
cards (percentile sentences 98/92/38/50%, weakest-link buttons); S3 pair drawer shows the
claim ("Audiences of Devoción and Nitehawk Cinema both over-index on Paris, Texas, Bill
Evans."), the **Qloo pill**, ranked named entities (#1 Paris, Texas, #2 Bill Evans), the
direct-check disagreement line, how-computed, and four ledger-reference buttons; Replace
panel renders "Keeps the role: Anchor.", ΔC/ΔD alternative rows and the custom query;
success sheet rendered "Weakest link becomes: Clay Collective and Hallen Biergarten."
with both mini-challenge attack rows after a real in-browser replace.

## Decisions

| # | Decision | Rationale | Reversible? |
|---|---|---|---|
| D-0.1 | Use `IMPLEMENTATION_STATE.md` as the single mutable progress file (per `IMPLEMENTATION_PLAN` §6), not a second `progress.md`. | Avoid competing truth sources (AGENTS.md §6). | Yes, migrate once if needed. |
| D-0.2 | Keep `HACKATHON_TRACKER.md` as a separate file for competition constraints only. | Different responsibility (external contract vs internal state); user explicitly requires standing hackathon tracking. | Yes. |
| D-0.3 | Node 24 locally accepted as satisfying "Node.js 22.19+". | Node 24 > 22.19 floor; no downgrade needed for local dev. Render base image will be pinned separately and must match a supported LTS. | Yes. |
| D-0.4 | No product code until Phase 0 blockers are answered. | Coding before understanding is AGENTS.md §23 anti-pattern; credentials determine transport architecture. | Yes. |
| D-0.5 | Initialize git on `main` with MIT `LICENSE`, `.gitignore`, `.env.example`; single root commit `00e0e6d`. | User approved; public repo + visible license are hard submission requirements (R2/R5), and clean history must exist before Qloo work starts. | No (history is evidence; do not rewrite). |
| D-0.6 | Skip Docker locally; validate the Dockerfile on Render only. | User approved. Render builds remotely; Qloo MCP needs a long-lived process only in production. Accepted dev-time risk. | Yes — revisit if container build fails late. |
| D-0.7 | Qloo key validity + cache/storage policy now sourced from the **official developer guide**, not assumption. | Guide (retrieved 2026-10-06): keys active through end of judging; private server-side caching permitted with no time limit; Qloo responses must never enter a public repo. `PERSIST_QLOO_DERIVED` stays `false` until server-side storage has an owner (Phase 5), then may be enabled **privately**. | Yes if Qloo contradicts. |
| D-0.8 | Sequence Qloo work ahead of agent work: DeepSeek key not yet available. | Real evidence (Gate A, Spikes 1–3) beats speculation; DeepSeek-dependent work (Prior Lock, agent loop) is deferred to Phase 3. | Yes. |
| D-0.9 | Publish to https://github.com/louji2308/zorq immediately with MIT + About description. | User supplied the URL; R2/R5 are hard pass/fail requirements and history must exist before Qloo work. Verified: `visibility: PUBLIC`, `licenseInfo: mit`. | No (history is evidence). |
| D-0.10 | Store raw Qloo responses only in gitignored `tmp/`; commit aggregate statistics and parameter findings, never response bodies or entity lists. | Official Qloo rule: do not store Qloo response data in a public repository. Keeps evidence auditable without violating terms. | No (compliance). |
| D-2.1 | Phase 2 workers run **sequentially in one checkout**; workers never commit (orchestrator reviews + commits). | Shared lockfile/node_modules made parallel merge surfaces unsafe; foundation is small enough that parallelism bought nothing. Recovered both worker stalls without lost work. | Yes — revisit with worktrees if Phase 3 parallelizes. |
| D-2.2 | **Degraded boot** on missing required config: WARN naming variables + `/healthz` 503 typed body, process keeps serving — **supersedes the initial exit(1) reading** of "fails clearly". | `ARCHITECTURE.md` §3.1 (higher authority than plan wording): "503 SERVICE_UNAVAILABLE with the shared error body when required configuration is absent" + its mandated test. Verified live (fresh clone, no `.env`). | No (locked contract). |
| D-2.3 | Repository topology: single root package, ESM, dual tsconfig (`tsconfig.json` bundler-resolution for typecheck over src+tests+configs; `tsconfig.build.json` NodeNext emit → `dist/`); server/shared imports carry explicit `.js` extensions. | One install, one lockfile, Vite+tsx+Node each get correct resolution without workspaces. `tsconfig.build` `include` stays `src/server`+`src/shared` (keeps Docker build immune to new test dirs). | Yes. |
| D-2.4 | Unknown `/api/*` → 404 `RUN_NOT_FOUND` typed body; unimplemented routes → `SERVICE_UNAVAILABLE` with phase-naming messages; `runIdParamsSchema` stays permissive (`min(1)`) until Phase 5 fixes the id format. | §3.0 defines no generic route-not-found code and no id format yet — flag, don't invent codes/policies (AGENTS §2). Both flagged for revisit: id schema when Phase 5 lands. | Yes — revisit in Phases 3/5. |
| D-2.5 | Rate limits locked at **general 300 / 15 min per IP, mutating (POST/PUT/PATCH/DELETE) 30 / 15 min per IP**, express-rate-limit draft-7 headers, `trust proxy = 1`, typed 429 `RATE_LIMITED`. | Deployed behind Render's proxy (client IP arrives via `X-Forwarded-For`); tiers match the plan's intent and are overridable via factory options for tests. | Yes — tune only from measured evidence. |
| D-2.6 | CI smoke against the **deployed** app (ARCHITECTURE line 163) deferred to deployment phase (8/9); Phase 2 gate = local fresh-checkout + Playwright against a real production build. | No deployed instance exists in Phase 2; plan's Phase 2 implement list has no deploy step. Smallest safe interpretation, recorded here (AGENTS §2). | Yes. |
| D-3.1 | `src/server/evidence/` made real in **Phase 3** with the minimal `EvidenceRecord` (id, claim, envelope provenance, `ledgerEventId` link) instead of waiting for Phase 4. | The Plan Phase 3 exit gate (line 466) explicitly requires "an evidence record"; ARCHITECTURE §1 makes `evidence/` the canonical owner (dir created, not duplicated). Phase 4 extends claim→citation validation. | Yes — Phase 4 owns evolution. |
| D-3.2 | **Live real-LLM verification deferred** (user-approved 2026-10-08): DeepSeek key valid but balance 0 (HTTP 402). Exit gate run with scripted LLM + real Qloo; `LIVE_DEEPSEEK=1` test written and gated for later. | No spec weakened — only the verification medium substituted, with the exception recorded by the user's explicit instruction. All numeric/budget/controller behavior proven with fakes + real Qloo. | Yes — run the gated suite when balance is paid. |
| D-3.3 | `runInvestigation` returns the **persisted frozen Prior reference** (`run.prior`), not the pre-persist object. | Orchestrator review catch (`8d5b422`): `priorSchema.parse` clones, so the pre-persist object was a mutable alias of persisted data — consumers must hold the real frozen artifact. | No (invariant). |
| D-3.4 | Peak/off-peak pricing ignores Chinese public holidays (holiday hours inside peak windows price at peak). | Conservative direction: never undercounts spend against the locked $2 ceiling. Implementing a holiday table adds complexity for zero budget risk. | Yes if a holiday run matters. |
| D-4.1 | Engine neighborhood normalization = **per-domain sum-normalization** (weights sum to 1 within each artist/movie/brand block; sum accumulated in sorted order for float determinism; zero/non-finite total ⇒ domain empty). | Plan says only "normalize deterministically"; scheme left open (AGENTS §2). Cosine is scale-invariant so edges are unaffected; choice keeps weights interpretable + reproducible. | Yes if Qloo affinity scale evidence contradicts. |
| D-4.2 | Edge **band rule**: over measured edges only — sort value desc (tie: `a` asc, `b` asc); `s = floor(m/3)`; first `s` → strong, last `s` → weak, remainder → typical; `m < 3` ⇒ all typical. Pure function, exported as `assignEdgeBands`. | Spec mandates relative bands within pool (ProductSpec §12) but not the split rule; deterministic floor-tercile is the smallest defensible reading. | Yes — UI may re-render bands, engine rule stays the source. |
| D-4.3 | Neighborhood `state` heuristic at this layer: all 3 domains filled → measured; some → incomplete; none → not measured. Graph gating uses **component** `evidenceState`, not neighborhood state. Triangulation states (confirmed/contested/thin) reserved for W-4.3. | Spec silent on neighborhood-level state; needed honest mid-states without erasing uncertainty (AGENTS §13). | Yes — W-4.3 may refine with triangulation evidence. |
| D-4.4 | **K≤2 pools are degenerate by formula**: every shared entity has count ≥ K ⇒ all IDF floor to 0 ⇒ all edges unmeasured. Accepted as mathematically faithful (ProductSpec §12 IDF), tested; non-degenerate graphs require K≥3 (unique entities) / K≥4 (shared-entity edges survive). | Never weaken a spec formula to make a toy case pass (AGENTS §16). Phase 4 pool spec is K≈8–10 where the formula behaves. | No (formula is spec-locked). |
| D-4.5 | **Percentile tie rule**: percentile = strictly-less count ÷ family size × 100; a composition is always in its own denominator; ties do not count as "below"; empty family → `null`. | Spec says "percentile of pool" without tie semantics (ProductSpec §12); strictly-less is the smallest reading that never overstates a composition's standing. | Yes if judge testing shows misread percentiles. |
| D-4.6 | **Population z-scores with σ=0 → all z=0** (not NaN, not ±∞); rank weight `w ∈ [0,1]` validated; sweep granularity `SWEEP_POINT_COUNT = 101` (w = 0.00…1.00 step 0.01); rank tie-break: score → weakest link → members lex (total order, deterministic). | Spec gives the formula but no degenerate-σ or sweep-granularity rule; the zero-σ fallback keeps rankScore finite and honest; fixed 101 points make flip indices reproducible. | Yes if measured pools show degenerate σ in practice. |
| D-4.7 | **Two validity notions**: *coherence-valid* (all members measured + all internal edges measured + required roles present) = percentile domain; *rankable* = coherence-valid AND distinctiveness mean non-null = ranking domain. Rankable-but-excluded compositions are reported via `excluded: [{members, reason: "distinctiveness_unavailable"}]`, never silently dropped. | Percentile is a statement about the graph alone; ranking additionally requires D̄. Honest partial states required (AGENTS §13) — exclusion must be visible, not erased. | No (both notions are spec-necessary). |
| D-4.8 | W-4.2 reused existing `EngineError` codes (no new `INVALID_COMPOSITION_INPUT`) because `types.ts` is frozen after W-4.1b — composition-input errors surface as `INVALID_GRAPH_INPUT`/`INVALID_COMPONENT`. Accepted as a **limitation**: error-code granularity is coarser than ideal on the composition surface. | Frozen-file boundary (contract) outranks error-taxonomy aesthetics (AGENTS §2). | Yes — fold a dedicated code into `types.ts` only if a higher phase needs it. |
| D-4.9 | **Triangulation precedence (exact):** `failed` (route1 ≠ measured OR `focalInTopHalf === null`) → `thin` (resultCount < 5) → `confirmed` (≥5 + top-half) → `contested` (≥5 + not top-half). Exactly 5 results counts as usable/strong. Structurally invalid route2 input **throws** `INVALID_GRAPH_INPUT`; present-but-undeterminable classifies as `failed`. Duplicate classification for the same pair → throw (never last-wins). | Spec fixes the four states and the <5 threshold (ProductSpec §12, Architecture §11.6) but not the precedence edge cases; this mapping is the smallest reading that never overstates evidence. | No (spec-locked states; precedence is defensive only). |
| D-4.10 | **Grade honest-gap rule:** a finalist member-pair with NO supplied classification is scored `failed` → B. Reasons enumerate ALL detected failures (every non-measured member, every non-confirmed edge) — member reasons in input order, then edge reasons in sorted-pair order — not only the cap-level ones. Grade is a CAP: C > B > A, never an average. | Zero-evidence compositions must never earn A (AGENTS §13 honesty); full reason lists let the UI "show these states rather than average them away" (Architecture §11.6). | No. |
| D-4.11 | Evidence module gained exactly one additive error code `UNKNOWN_EVIDENCE_ID`; `resolveClaimEvidence` dedups in first-occurrence claim order and throws naming ALL missing ids; malformed lookup records → `INVALID_RECORD`; `isResolvableClaim` converts any `EvidenceError` to `false`. Existing exports/schemas/provenance validation untouched (diff verified + existing tests green unmodified). | D-3.1 reserved claim→citation validation for Phase 4; frozen existing behavior (W-3.2) must not regress (AGENTS §17). | No. |
| D-5.1 | **Persistence port, not a concrete DB binding.** `RunStore` interface + in-memory adapter (default) + Turso adapter (env-gated on `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`). Tests run the same contract suite against both. | B-06 (Turso not provisioned) must not block Phase 5. ARCH §2 makes the DB the recovery source of truth; a port lets the memory adapter serve as a proven stand-in until credentials appear, with zero code change on provisioning. Turso adapter is still real `@libsql/client` code, exercised via `:memory:`/file URL. | Yes — swap adapter via env when Turso is provisioned. |
| D-5.2 | **Stop is orchestrator-local; `agent/` untouched.** Cooperative stop is implemented by the orchestrator flipping local status to `stopped` and refusing further phase advancement; the agent's own state machine (`agent/state.ts`) is not modified. | Keeps Phase 3's agent controller stable; stop semantics live at the layer that owns run lifecycle and persistence. Matches Plan §Phase 5 ("the orchestrator, not the agent, owns stop"); the agent will learn about stop only if a later phase introduces a need for mid-turn cancellation. | Yes — if mid-turn cancellation is ever needed, teach the agent about stop without changing the orchestrator contract. |
| D-5.3 | **SSE first frame is always the full authoritative `state`; ledger frames are additive, not load-bearing.** On connect (with or without `Last-Event-ID`) the server sends the current RunState; subsequent `event.*` frames append to it. A non-contiguous `Last-Event-ID` gap falls back to state-only rather than attempting partial replay. | DB is recovery truth; SSE is progressive visibility (ARCH §2). A client that misses frames can always resynchronize from state; a client that trusts partial ledger replay could render a corrupted view. State-first also makes the "refreshed" clause trivially true. | No (invariant — D-5.3 is a recovery-safety invariant). |
| D-5.4 | **`RunState` expanded additively; nine Phase 6–7 fields are `z.unknown()` placeholders.** `evidence` is a typed array; the remaining future fields (`priorDiff`, `challenge`, `blueprint`, …) are optional unknown keys that survive parse/rehydrate without schema churn. | Zod v4 strips unknown keys on parse; fields must be declared to survive round-trips. Freezing their shape now would over-constrain Phase 6–7 before their product contracts exist; leaving them `unknown()` preserves forward-compatibility without fabrication. | Yes — Phase 6–7 replaces each placeholder with a real schema when its product contract exists. |
| D-5.5 | **Four real Phase 5 routes; remaining seven stay honest 503.** Only `POST /api/runs`, `GET /api/runs/:id` (with evidence), `POST /api/runs/:id/stop`, and `GET /api/runs/:id/events` (SSE) are wired to the orchestrator; the other seven Phase 3 routes continue returning `NOT_YET_WIRED` 503. | Plan §Phase 5 names exactly these four; wiring the rest before their owning phases exist would create dead code and fake-looking surfaces. Honest 503 is the established contract from Phases 3–4 and is a judge-visible signal of deliberate sequencing. | Yes — wire the remaining seven as their owning phases land. |
| D-6.1 | **Add `zustand@5` + `maplibre-gl@6` (user-approved 2026-10-09).** State and map renderer per Tools §2 lock ("Zustand", "MapLibre GL JS + MapTiler Free"). MapTiler integration via public tile/style URLs keyed with `VITE_MAPTILER_KEY` (client-visible by design); no `@maptiler/*` SDK needed — MapLibre consumes MapTiler endpoints directly. | Locked-stack choices, not new inventions (Tools §2); user approval obtained in-session. Avoiding the MapTiler SDK keeps the dependency surface minimal (AGENTS §3). | No (stack-locked). |
| D-6.2 | **Vite glue: `envDir` set to repo root + dev proxy for `/api` and `/healthz` → `:3000`.** `root` is `./src/web`, and Vite's `envDir` defaults to `root`, so repo-root `.env` (where `VITE_MAPTILER_KEY` lives) would otherwise be invisible; dev server now proxies API/SSE to Express. | Minimal integration glue (AGENTS §4.1 allows orchestrator-owned glue). Production path unaffected — Express serves the built SPA same-origin; proxy only serves `npm run dev:web`. | Yes. |
| D-6.3 | **Widen helmet CSP for the MapTiler/MapLibre browser surface:** `connect-src`/`img-src`/`font-src` += `https://api.maptiler.com`; `worker-src`/`child-src` += `blob:`; every other directive stays on helmet defaults. | Default helmet policy has no `connect-src`, so `default-src 'self'` blocks MapLibre's **module-worker** tile fetches: main-thread style/sprite/tiles.json load, but every vector tile fails pre-network with `AJAXError(0)` (proven live — a control `fetch` of the identical URL inside the same worker returned 200 only under the patched policy). MapTiler is the locked tile provider (Tools §2) and the key is public-by-design (D-6.1). **Operational trap recorded:** hashed assets are served `Cache-Control: immutable` for 1 year (`staticWeb.ts`), so this header change stayed invisible in browsers until the cached worker response was purged — the stale cache masked the fix during diagnosis. | No — smallest safe deviation from helmet defaults; required by the locked stack. |
| D-7.1 | **Candidate pool draft cap = 10 components** (`POOL_DRAFT_COMPONENT_CAP`, orchestrator corrective during W-7.1 review); min stays 1 (honest thin-evidence pools allowed); tool description states the K≈8–10 design target. | Worker shipped 24; spec locks **K ≈ 8–10** (ProductSpec §12, Architecture line 145, Plan line 481, Tools line 178) and Final Design's 45-edge math assumes ≤10; engine exact-enumeration safety cap (10,000) breaks at C(16,8). The enforcement point is the tool schema the LLM sees. Lower bound kept at 1 rather than 8 so thin evidence can never force fabrication (AGENTS §13). | No (spec-locked ceiling). |
| D-7.2 | **Interim `siteRead.anchors` derivation:** first 5 located observed entities in observation order (letters A–E, each carrying its `evidenceId`); heat = observed projected heatmap cells (cap 200). Agent-chosen anchor *selection* deferred to the unpin/replace anchor-identity work (routes 3.6/3.7). | ProductSpec line 291 assigns anchor selection to the agent, but no anchor-selection tool or pin identity exists yet; the deterministic capture is real observed data with provenance (never synthetic) and unblocks S1 rendering + W-7.2 provenance. Revisit when routes 3.6/3.7 define anchor identity. | Yes — revisit with unpin/replace. |
| D-7.3 | **City baseline for neighborhoods/distinctiveness = unlocalized Qloo audience** (city-scope fetches send no `signalLocation`); site scope uses the locality ladder (`brief.location`, then last-two-segment broader form). Ledger copy names the baseline explicitly ("city baseline (unlocalized Qloo audience)"). | Qloo exposes no dedicated city-audience signal; W-7.2's live-shape research showed district-level `signalLocation` strings systematically return empty artist/brand results while broad strings work — but a broad-string city baseline degenerates to site==city whenever `brief.location` is already broad (distinctiveness → 0 everywhere, silently). Unlocalized is always defined and always contrasts. The spec's "city audience" (ProductSpec §12 d(k)) is proxied by the unlocalized/global audience — honest approximation, recorded not hidden. | Yes — revisit if Qloo ships a city-scoped audience signal. |
| D-7.4 | **Cultural DNA values = share-of-total per side × 100** (orchestrator corrective during W-7.2 review): each side's aggregated domain weights normalized by that side's total mass; `local > city` means the entity's *share* of local taste exceeds its share of city taste — true over-index. Regression guard: top local entity must be `< 100` in a multi-entity domain. | Worker shipped per-side-max scaling (`weight / maxSide * 100`); Architecture §10 + ProductSpec line 40 define DNA as what *over-indexes locally versus the city*; max-scaling makes a near-equal entity look locally dominant whenever the two sides' maxima belong to different entities. Share-normalization keeps 0..100 bounds (S1 `parseCulturalDna` accepts), preserves sort order, keeps determinism (pure arithmetic). Ledger copy updated to name the share semantics. | No (corrective restoring spec-faithful mapping). |
| D-7.5 | **Route-2 triangulation = single `insights` place query** (signal = type-component exemplars, `filterTags` = resolved partner-component tag, `location` = site point with radius ladder default `brief.radius`/400m → ≤5000m, take 10); agreement = focal exemplars in the top half. The spec's second query under the locality-anchor signal is deferred. | ProductSpec §12 line 315 is ambiguous about which ranking "top half" names; the single-query form matches the literal "k-places sit in the top half" clause, feeds the engine's unchanged `{resultCount, focalInTopHalf}` input contract (D-4.9), and avoids doubling probes (24 pairs × 2 = 48 calls would blow the 54-call measurement reserve). Honest limitation recorded rather than silently claiming dual-query parity. | Yes — revisit dual-query route if budget headroom or judge feedback warrants. |
| D-7.6 | **Composition family `requiredRoles = ["Anchor"]`** when the pool contains an Anchor component, else `[]`; `size = min(5, poolSize)`. | The spec locks size-5 worked examples and role coverage as a hard filter but never enumerates a mandatory role *set* for compositions (Final Design shows role mix, not all-six-mandatory); requiring all six roles would empty most honest 8–10-component pools. Anchor-only is the minimal defensible reading: every composition must include the site's anchor. Engine contract unchanged (`requiredRoles` is an input, D-4.5). | Yes — revisit if a role-coverage contract is specified later. |
| D-7.7 | **W-7.3 executed orchestrator-direct after three consecutive `task`-spawn cancellations** (two aborted before any write; one left uncommitted S2 sources with zero tests). The orchestrator reviewed the partial sources line-by-line, completed the test suite, and ran the full gate ladder itself. | The delegation channel failed at the provider level (tool-execution aborts, not contract ambiguity). Precedent exists (W-6.4 orchestrator-executed). Per AGENTS §4.1 the orchestrator may implement a corrective patch directly when delegation is unavailable; the work was still reviewed, tested, and committed under the same contract. Revisit: retry spawned workers for W-7.4/W-7.5; if the channel is still broken, continue orchestrator-direct and record it per worker. | Yes — retry spawn for next workers. |
| D-7.8 | **S2 over-index projection formula:** per component, sum site-neighborhood artist weights vs sum city-neighborhood artist weights; over-index iff `siteSum > citySum` **and both neighborhoods are "measured"** (else hollow mark + "not measured"). | ProductSpec line 194 requires "k of n over-index locally" as the middle reading; the Cultural DNA share semantics (D-7.4) already own the DNA strip, so the card reading uses a distinct, simpler signal (raw artist weight sums, not shares) that stays deterministic and honest under incomplete neighborhoods. Revisit if a shared over-index definition is later specified. | Yes. |
| D-7.9 | **W-7.4 executed orchestrator-direct after a 4th consecutive spawn cancellation** (provider aborted mid-write, leaving 5 of 7 S3 files). Orchestrator adopted, reviewed line-by-line, completed `ConnectionsPanel.tsx` + `s3.css` + the test suite, applied three small correctives, and ran the full gate ladder itself. | Same channel failure mode as D-7.7 (tool-execution aborts at the provider level, not contract ambiguity); AGENTS §4.1 permits orchestrator implementation when delegation is unavailable, and the review/test/commit discipline is unchanged. | Yes — channel re-tested per worker; if still broken, continue orchestrator-direct and record per worker. |
| D-7.10 | **Evidence-drawer ledger links resolve from `run.evidence` records (id/label/summary term match, then `kind:"insights"` fallback, cap 4), and `onOpenLedger` navigates back to the S1 ledger view without row-level highlight.** | `runEvidenceNodeSchema` does not expose `ledgerEventId` (stripped at the shared boundary), and `LedgerPanel` accepts no filter/highlight prop; adding either would cross the W-7.4 file scope into S1/server ownership. The drawer still shows claim → entities → triangulation → how-computed → link path, with an honest "recorded in the full ledger" fallback. | Yes — row-level highlight/expansion from a drawer link is a Phase 9 polish candidate. |
| D-7.11 | **Replace requests may carry `compositionKey` (zod `trim().min(1).max(300).optional()`), which resolves `before` against that composition's members instead of the default (first ranked containing the target). Server normalizes delimiters (`+` or `\|`), refuses unknown keys (`badRequest("compositionKey")`) and non-member targets (`badRequest("targetComponentId")`) with distinct honest messages; the panel threads the selected key from `ConnectionsPanel` → `RunRoute` state.** | Plan's Replace spec says "replace X in the selected composition" but the original schema had no way to name the selection — with multiple size-5 compositions sharing members, a default resolution silently targets a *different* family than the one the judge is looking at. Keyed resolution is the smallest addition that makes the promise true; normalization mirrors the client's `normalizeCompositionKey`. Revises the spawn's original D-7.11 note (schema gap found in §17 review). | Yes — drop the field if a later phase redesigns composition identity. |
| D-7.12 | **Custom (free-text) replacement = pool growth with ≤4 Qloo calls (resolveTags → exemplar insights → site artist → city artist), budget-checked before any call, refused at `POOL_CAPACITY=10` (`pool_full`); the structural guard order is cap → brief → neighborhoods → budget (cheap refusals first).** | Spec locks "≤4 Qloo calls" and role-preserving growth (ProductSpec line 233); the cap-first order lets a full pool refuse without touching brief/neighborhood inputs (the spawn's own test expected it, implementation had budget last). Never partially applies: any failure leaves state untouched. | No (spec-locked call budget). |
| D-7.13 | **Alternative preview (diverging ΔC/ΔD bars) is a pure client projection from the stored `ranked` family — no preview endpoint, no engine re-run.** | The ranked family already stores each composition's coherence, distinctiveness and weakest link; a same-family swap's after-values are exactly the swapped composition's stored values. A server preview round-trip would double the surface for identical numbers and invite stale-computation bugs. Custom candidates are previewed only after the real replace (honest: their numbers don't exist before the calls). | Yes if preview must include cross-family effects. |
| D-7.14 | **G12/PS260 ordering-bias mitigation deferred: revisions persist as a durable record (rev, members before/after, deltas) but no post-challenge re-ranking pass is wired; S4 must handle ordering when it lands.** | The spec's ordering-bias clause sits in the challenge/second-pass area (Phase 8 ownership), and building a re-rank pass now would guess at S4's contract. The revision record is the substrate Phase 8 needs either way. | Yes — Phase 8 owns the mitigation. |
| D-7.15 | **Pool-alternative ordering: ΔC desc → ΔD desc → member id asc, display cap 5.** | Spec says "ranked by coherence/distinctiveness" without a tie rule or count; the three-key order is total (deterministic, no `Math.random`/timestamp) and 5 shows breadth without the 440 px panel scrolling past the primary action. | Yes if judges want all pool options. |
| D-7.16 | **Mini challenge pass persisted as `stressReport` with `kind:"mini"` (ablation verdict over the run's `stressPool` + rival sweep over `stressRanked`, Survived/Revised). Phase 8 integration note: S4 must distinguish `kind==="mini"` from a full challenge report, and a post-S4 replace would overwrite an S4-authored `stressReport` — resolve in Phase 8.** | ProductSpec line 233 requires the mini pass after a replace; `stressReport` was the existing slot and marking the kind is the honest way to keep provenance without inventing a new field before S4 exists. Overwrite risk recorded now, not discovered later. | Yes — Phase 8 may move mini reports to a dedicated slot. |
| D-7.17 | **Custom-path family size = `min(stored family.size, poolAfter.length)` (never `min(5, poolAfter)`): after pool growth the family must keep the run's measured size so the swapped composition stays comparable.** | Orchestrator §17 corrective: the spawn sized the rebuilt family at 5, producing ONE size-4 composition while the swap is size 3 — nothing size-3 was ever ranked, so every custom replace failed with "swapped composition is not ranked" (reproduced in `tmp/debug-replace.ts`). Pinning to the stored size preserves the family contract (D-7.6) across pool growth. | No (corrective restoring family continuity). |
| D-7.18 | **Custom path re-derives triangulation route1 from the rebuilt graph (stored probes `resultCount`/`focalInTopHalf` carried forward) and updates ledger wording to say triangulation is re-derived; never passes stale route1 values through.** | The spawn copied the old graph's route1 (a pre-pool-growth value) onto entries whose edges had just been recomputed — numeric truth must come from the engine's current graph (AGENTS §13), and probes are independent of the graph so they legitimately carry forward. Ledger copy follows the actual behavior. | No (invariant). |
| D-8.1 | **D-7.16 FINAL RESOLUTION: full S4 challenge reports persist to a typed `runStateSchema.challengeReport` (`kind:"challenge"`); `stressReport` stays `z.unknown()` and keeps owning the replace mini pass.** | Zod strips undeclared keys, so the report must be a declared field to survive parse/rehydrate/SSE; a dedicated field is the recorded promise that a post-S4 replace can no longer clobber the S4 verdict, and neither report masquerades as the other's shape. Smallest reversible schema change that makes both artifacts durable. | Yes — merge slots only if a higher-order source demands it. |
| D-8.2 | **Catchment attack = deterministic city re-measure (`computeIdf` → `buildGraph` → `measureComposition` over stored city neighborhoods), zero new Qloo calls; Δ ≥ −0.005 (`CATCHMENT_HOLD_EPSILON`) → "holds", else "depends on the site catchment"; no stored neighborhoods or engine throw → status "skipped" (no grade cap).** | The shift-scale mutation re-reads the city baseline the measurement chain already captured — a second heatmap fetch would spend budget re-learning known numbers, and heatmap is not a locked Phase 8 capability (AGENTS §2 no-invention). Epsilon keeps float noise from flipping the verdict; skipped is an honest evidence state. | Yes — replace with a real heatmap probe only if a higher-order source locks that capability. |
| D-8.3 | **Bridge-insertion mutation operator and the production Replaced path deferred to W-8.2b (shift-scale operator deferred with it).** | Replaced requires rebuilding idf/graph/family/ranking/prior after inserting a bridge member; that rebuild block is currently inline in `replace.ts` and must first be extracted to one canonical owner (existing-file-first, no duplicate mutation engine). Verdict logic and Replaced semantics are already implemented and unit-proven via fixtures. | Yes — W-8.2b is the recorded next action. |
| D-8.4 | **`rounds` counts stress/attack passes (1–3); the autonomy cap is `mutations ≤ 2` (schema mutation `round` 1..3).** | The contract's stop rule (leader survives AND no mutation gains > ε) can legitimately need a third verification pass after the second mutation; the spec-locked bound is on mutation rounds, so the report counts passes honestly instead of capping fieldwork at 2. | No (the ≤2 mutation bound is spec-locked). |
| D-8.5 | **`BRIDGE_PROBE_LIMIT = 3` bridge probes per challenge run; budget-exhausted or thrown probe → attack row "not completed" + reason, `challenge.bridge_probe` failed-call ledger event, grade capped at B, and no evidence record; success → evidence via `observationEvent` + `createEvidenceRecord` + provenance + `projectExemplars`.** | The failed-probe rule needs a concrete per-run bound; 3 keeps challenge inside the 180/run target even under a 3-round loop (tested: loop stops calling the gateway once the limit is hit). Never fabricating evidence on failure keeps the UI claim → Evidence ID → ledger chain intact. | Yes — tune only from measured budget evidence (AGENTS §13). |
| D-8.6 | **Attack order = bounded non-essential LLM turn (`challenge.attack_order`, ≤300 output tokens) with code-fence stripping + zod enum parse + dedupe; unusable output or thrown LLM → `challenge.order_fallback` compute event + deterministic diagnostic order (weakest link < 0.35 → bridge first, else rivalFlips non-empty → rival first, remainder spec order); report carries `attackOrderSource` = "llm" or "diagnostic" and `attacks[]` is always sorted to spec order.** | The spec assigns emphasis choice to the agent but forbids fabricated transcripts; a labeled fallback keeps the agent's role real without letting garbage text steer the run, the source field makes any substitution judge-visible, and sorted attacks let blueprint/UI parse a stable shape regardless of execution order. | Yes — improve parsing only; never remove the fallback or the label. |
| D-8.7 | **Challenge response shape = `{run: runStateSchema, report: challengeReportSchema}`, replacing the placeholder `{runId, status:"running", stress}`; the response `run` carries no `evidence` projection — GET /api/runs/:id remains the single projecting read (B-10 posture).** | Challenge is synchronous like replace (worst case = 3 local re-measures + ≤3 bridge probes); the "running" status was placeholder text. Evidence rows live in the store and are projected only by GET, so the mutation endpoints share one honest contract instead of each re-implementing projection. | Yes — revisit with B-10 unification. |
| D-8.8 | **Bridge component role = first role in canonical `poolComponentRoles` order that is neither "Anchor" nor already held by a leader member; fallback "Community".** | The bridging component represents the shared interest between the weakest-link pair, so it must not silently re-label an existing leader role (which would corrupt role-preservation checks and substitution's same-role lookup); the deterministic first-free-role rule keeps the operator reproducible from identical inputs with zero LLM involvement. | Yes — revisit only if a higher-order source assigns bridge semantics to a specific role. |
| D-8.9 | **Exactly one successful bridge measurement per challenge run: `bridgeRecorded.found` flips true only on a terminal "measured" bridge outcome (entities found and the flow reached a no-insertion conclusion or a completed measurement); later rounds skip with "the recorded bridge probe stands". Budget-refusal and failed-call outcomes do NOT flip it, so an honest retry remains possible on a later round.** | Re-measuring the same pair would re-spend Qloo budget re-learning identical inputs (bridge needs 3 calls: tag + site + city) for no new information, and the spec bounds challenge Qloo spend; keeping the flag false on failures preserves honesty — the loop may retry what it never actually learned, bounded by the ≤3-round loop anyway. | Yes — tune only from measured budget evidence (AGENTS §13). |
| D-8.10 | **Blueprint share = a `BlueprintSnapshot` row on the RunStore port (memory + Turso `blueprint_snapshots` table with `runs.run_id` FK + unique `share_token` index), keyed by `run_id`, carrying the whole `blueprintSchema` value + `shareToken` + `createdAt`/`expiresAt` (30-day TTL from `BLUEPRINT_TTL_MS`). The share token is `randomBytes(18).base64url` minted once per run and reused across recompositions; a sha256 fingerprint over the state inputs (brief/prior/evidence/siteRead/pool/neighborhoods/graph/compositions/challengeReport/revisions — status/phase excluded) lets an unchanged run serve the cached snapshot without an LLM turn.** | Architecture §16 makes `/run/:id/blueprint` a read-only shareable snapshot; the fingerprint keeps repeat reads byte-stable and cheap while ensuring any real state change invalidates the cache (never serves stale truth). Status/phase excluded so a state-machine transition cannot orphan a valid blueprint. Token reuse keeps a share link alive across honest recompositions. | Yes — TTL/token format revisitable; the invalidation rule (fingerprint) is not. |
| D-8.11 | **Blueprint narrative = exactly one LLM turn (`blueprint:compose`, bounded) with code-fence stripping → JSON parse → title/rationale extraction → citation validation that STRIPS every bracketed token not in the stored-evidence vocabulary (keep-known-only), plus a deterministic fallback path. ANY failure (LLM throw, malformed JSON, zero kept citations, no allowed ids) → deterministic narrative (title from objective+location, rationale from measured leader numbers) + ledger `blueprint.compose_fallback` carrying an honest reason; never a retry, never fabricated citations.** | ProductSpec S5 allows an LLM rationale but AGENTS §13 forbids unknown evidence IDs rendering as confirmed; strip-unknown-keep-known yields an honest prose that cites only real records while still surfacing the model's reasoning. Single attempt (no retry) keeps the $2/run budget safe and avoids retry loops over a poisoned prompt; the labeled fallback event makes any substitution judge-visible, mirroring the D-8.6 challenge-order pattern. | Yes — improve parsing only; never remove the fallback or its label. |
| D-8.12 | **`componentDisplayName(component) = exemplars[0]?.name ?? id` lives in `src/shared/run.ts` as the canonical owner (server blueprint + future web renderer share it); composition-by-role groups iterate `poolComponentRoles` canonical order; receipts = ≤1 `path` receipt (deterministic node/path sentence, ≤300) + ≤2 `shared-entities` receipts (top-2 partner edges by value among leader members, entity names ≤2); shared-entities edge lists are site-first then city.** | One display-name rule must not fork between server and client (existing-file-first); canonical role ordering makes the blueprint's row order deterministic and matches the S2 card convention; receipts are the "why this member" margin evidence and the caps keep the print/Markdown renderer within the layout budget; site-first ordering matches the DNA strip's local-over-city reading. | Yes if a later design pass widens receipt counts. |
| D-8.13 | **What Qloo changed = `extractPriorMemberEntries` matching prior composition members to the current leader by normalized name, then id, then exemplar name (first match wins, each current member consumed once); a member whose fit downshifted a format appears under `reformatted` with the shift sentence; a prior member matched by name but absent from the leader → `removed`; unmatched leader members → `added`.** | The spec's four arrays are a Prior→Final identity diff, but prior markers and pool members use different key spaces (loose role-grouped record vs measured pool) — the three-key cascade is the smallest deterministic matching that never fabricates a link; downshifted members genuinely changed format (not membership), so `reformatted` is the honest bucket rather than removed+added churn. | Yes — revisit only if Prior and pool adopt a shared stable member id. |
| D-8.14 | **A challenge bridge mutation persists its inserted `PoolComponent` inside `ChallengeMutation.component` (optional field on `challengeMutationSchema`); `applyCandidate` embeds the component only when `memberIn` is NOT already in the stored pool (bridge-only — swaps/drops resolve normally). The pool/graph are deliberately NOT mutated by challenge; a later replace re-derives from the real pool.** | The bridge component is measured on a `ScratchState` that must never leak into persisted pool/graph (W-8.2b invariant), yet the blueprint must resolve a bridge member's role/format/receipts by name after the run — embedding the component on the mutation is the smallest additive schema change that carries the identity without reopening the pool question. Replacing a bridge member later (it is not in the pool) is a **known limitation deferred** to the replace/blueprint integration pass. | Yes — if bridge members must become first-class pool entries, move them into the pool at mutation time and re-run the fingerprint. |
| D-8.15 | **Without-Qloo polish rides the Prior's own single completion and lives INSIDE the frozen Prior as an additive optional `priorSchema.polish` (`priorPolishTextSchema` = trimmed 1–1200 chars). The prior prompt now also demands a standalone `polish` paragraph (no numbers, no invented entities, no evidence claims); `priorDraftSchema.polish` is `z.unknown().optional()` so a bad polish can never fail the Prior. Extraction: valid → carried; present-but-invalid → dropped with a fixed-summary Compute ledger `prior.polish_unavailable` (never raw model text); absent → field absent with NO ledger event. No dedicated without-Qloo route (11-route API surface locked) — the compare modal is a client projection over `run.prior` + blueprint (`compositionByRole`, `whatQlooChanged`), with confident-empty = kept covers all prior members AND added/removed/reformatted empty; modal rendering lands W-8.5.** | The Phase 8 contract places polish "during prior generation with budget accounting" — riding the existing completion satisfies that literally at zero extra budget/queue pressure and zero fixture-call-queue displacement (≈15 positional `fakeLlm` fixtures would cascade if a second call were inserted). Storing polish on `priorSchema` means it flows through every existing persist/SSE/read path untouched and is covered by the Prior's write-once deep-freeze, while the unknown-typed draft extraction preserves the invariant that the Prior itself never fails for a cosmetic field. Absence-without-event keeps pre-W-8.4 ledger counts unchanged — the honest signal is the field's absence ("the left column honestly shows Prior alone and says so"); a 12th route would violate ARCHITECTURE §3. | Yes — revisit only if a higher-order source demands a separate polish generation call or a dedicated endpoint. |
| D-8.16 | **S4 renders in the right 480px ledger column as a vertical stack and S5 as a full-width reading screen via a `.s1.is-reading` grid-area variant (no map / no DNA strip); the five-view tab bar lives in the run top bar with a ref-measured sliding underline, and Compositions/Connections tabs are honestly disabled until measured; S5 member rows carry NO Replace button (Replace stays reachable from Compositions/Connections); S1/S2 docked "Challenge" CTAs are deferred (the Challenge tab is the single trigger); citation superscripts map ONLY to stored receipts — an unknown `[id]` token is dropped client-side; compare-modal changed tags mark added+reformatted names only (kept members did not change).** | Final Design §7.4 places S4 on the right of the map; §7.5/§6.4 give S5 a wide-margin reading layout and the five tabs. A second Replace entry on S5 would duplicate the S2/S3 owner (existing-file-first) while S5 is a read artifact; receipts-only superscripts preserve the AGENTS §13 "unknown evidence IDs never render as confirmed" invariant at the client boundary, mirroring the D-8.11 server strip; changed=added+reformatted matches the server's What Qloo changed semantics. | Yes — a later design pass can add S5 in-place Replace or S1/S2 Challenge CTAs; the receipts-only citation rule and diff-derived compare states are not. |
| D-8.18 | **Without-Qloo compare modal left column lists ONLY frozen-Prior composition members (resolved through `extractPriorMemberEntries` / the prior's own member list), never candidatePool members; right column keeps server diff arrays.** | Review of the D-8.16-era modal (fixed `8d71f49`): the left column was rendering pool members, so "what the agent would have recommended with no cultural evidence" showed Qloo-derived pool entities — manufactured divergence against Plan 805 ("Do not manufacture divergence") and PS 227 (left = frozen Prior + polish). The Prior is the only pool-free artifact, so it is the only honest left column. E2E pinned: left column contains `Devoción`, not thesis/members scaffolding. | No (invariant — the compare control must stay pool-free). |
| D-8.19 | **Every judge-facing prose surface resolves member ids through `componentDisplayName` (pool exemplars + `ChallengeMutation.component` fallback): challenge reason/stop-note, mutation summaries, attack details incl. ablation remainder + rival flip lists (`AttackContext.nameOf`), blueprint `whatQlooChanged` kept/reformatted/added, revision history, deterministic narrative, S4 leader rows/rival label; S4 `verdictSentence` is now the server-authored `report.reason` verbatim (client prepend removed). Data fields (keys, `memberId`, `evidenceIds`, `membersAfter`) keep raw ids.** | Independent-review HIGHs #1/#2/#7/#12 + walk evidence (`phase8-03-s4-post.png` showed `comp-*` ids in the verdict sentence). One display-name rule already had a canonical owner (`componentDisplayName`, D-8.12) — extending it beats forking per-surface naming; ids remain in data so the API contract and receipt links are untouched; server owns the sentence so reason prose cannot double-render. | Yes — revisit only if a display-name surface needs different resolution; the id-in-data rule is not. |
| D-8.20 | **`runRevisionSchema` gains optional `at` (epoch ms, stamped by replace via its `now` clock); blueprint leader selection = `challengeReport.leaderAfter` UNLESS any revision has `at > Date.parse(report.generatedAt)`, in which case `ranked[0]` wins; default fixture revisions without `at` stay fresh (NaN comparison = false).** | Review HIGH #6: replace never touches `challengeReport`, so a post-challenge replace left the blueprint rendering the pre-replace leader with a contradictory revision row below it (silent stale state beats authoritative state). Timestamp is the smallest additive signal that distinguishes "report is current" from "report predates a revision"; optional field keeps old persisted runs parseable; falling back to `ranked[0]` uses the engine's current truth rather than guessing a merge. Both directions unit-tested (fresh report leader vs stale ranked leader). | Yes — if replace ever writes `leaderAfter` directly, the fallback can retire; the stale-detection rule itself is an invariant. |
| D-8.21 | **Fit honesty: (a) `fit.drops` are surfaced on EVERY fit, not only infeasible ones — each dropped composition member carries `constraintDropped` (engine reason) in the blueprint member row + a `constraint-conflict` risk; (b) `withinUsable` becomes `boolean \| null` — `null` whenever `areaSqFt` is absent, rendered as "not measured (no floor area supplied)" in the panel and Markdown (no "Not recorded of Not recorded" compound).** | Review HIGHs #3/#4: `fit.feasible` defaults true when no area exists (fit.ts `withinFootprint = usableSqFt === null \|\| …`) so the blueprint claimed "within usable area" for an unmeasured footprint — a positive claim over missing data (AGENTS §13); drops were gated behind `!fit.feasible`, so a feasible fit constrained by hours/noise hid the very members it excluded while rendering them bare (no format, no reason). Tri-state + always-surface matches fit.ts's own honest `not measured` reason text. Unit tests: area-less brief → `null`; 6000 sqft + nightclub constraint → feasible true AND drop risk + `constraintDropped` visible. | Yes — tri-state and drops-always are honesty floors, not styling choices. |
| D-8.22 | **`blueprint:compose` narrative guard: after citation-strip, `hasNumericProse(title) \|\| hasNumericProse(rationale)` (digits outside `[evidence-id]` brackets, after stripping citations) → honest failure "the narrative stated numeric content the artifact owns" → existing deterministic fallback + `blueprint.compose_fallback` ledger event (single attempt, no retry). Digits inside kept citations (`[ev-a-site2]`) are allowed.** | Review HIGH #5: the compose prompt already forbade numbers and the system prompt carries no numeric truth, but nothing *enforced* it — an LLM could still author "holds 3 anchors" and the blueprint would ship it as rationale next to deterministic measurements, blurring the AGENTS §13 intelligence boundary. Cheap deterministic check beats prompt faith; reusing the D-8.11 fallback path adds zero new failure modes. Both directions tested (1996-in-prose → fallback; digit only inside citation → llm source). | Yes — can widen to reject percent-shaped prose later; removing the guard is not. |
| D-8.23 | **Phase 8 gate disposition: fixture judge path closes Phase 8 NOW (user approval "Yeah approved continue"); the one live-services clause runs as Phase 9's first live action once B-02 clears. Of the 15 review findings, 9 accepted-and-fixed (#1–#8a, #10a, #12, #14 family incl. #7/#12 across surfaces), 6 deferred as B-11 (#8 rounds persistence, #9 bridge evidence provenance, #10 deep challenge block absent from share, #11 `state.evidence` dead field, #13 downshift ordering in copy, #15 fallback positional citations), plus the clause-map-found `Shift-scale` operator gap (#16: catchment re-measure only, challenge.ts:83) making B-11 carry 7 items, with rationale: each is judge-visible polish, state hygiene, or a bounded operator gap — none falsifies evidence, numeric truth, or the protected loop.** | User explicitly approved closing on fixtures while B-02 (DeepSeek balance) is user-side; the fixture pipeline exercises the same server/UI code the live path uses (scripted LLM + fake gateway at the transport boundary only). Deferring low-severity findings with rationale beats either silently dropping them (AGENTS §20) or blocking the freeze-adjacent schedule (B-07) on polish. | Yes — B-11 items are Phase 9 backlog; reopen any finding if judge feedback touches it. |

## Deviations from contract

- **W-7.3 orchestrator-executed (D-7.7):** three consecutive `task` spawns for the S2
  worker were cancelled at the provider level; one left uncommitted sources. The
  orchestrator reviewed, completed, verified, and committed the increment under the
  original W-7.3 contract. No spec or architecture deviation — only the
  AGENTS §4.1/§8 worker-contract execution channel changed.
- **W-7.4 orchestrator-executed (D-7.9):** the spawn retry mandated by D-7.7 failed a
  4th time (cancelled mid-write after 5 of 7 files). Same deviation class as W-7.3 —
  adoption + review + completion under the original contract. Channel re-test planned
  for W-7.5.
- **W-7.5 orchestrator-executed (5th consecutive spawn cancellation):** the W-7.5 spawn
  was cancelled after writing all 17 files but before running any test or gate (the only
  spawn to leave a *complete* file set). The orchestrator adopted it, reviewed every file
  line-by-line, found and fixed four defects (family-size bug D-7.17, stale triangulation
  D-7.18, missing `compositionKey` threading D-7.11, guard order D-7.12), ran the full
  verification ladder independently, and committed `bd1cb20`. Same deviation class as
  D-7.7/D-7.9 (AGENTS §4.1 execution-channel substitution; no spec or architecture
  deviation). Channel failure now at 5/5 — remaining Phase 7/8 work defaults to
  orchestrator-direct unless the user restores delegation.
- **`git diff --check` flags trailing whitespace in `ProjectSpec/*.md` (markdown hard line breaks).**
  Committed unchanged rather than editing supplied read-only source. Our authored files
  (`.gitignore`, `.env.example`, `LICENSE`, `AGENTS.md`, both trackers) pass the check
  (`exit=0`). Rationale recorded here per AGENTS.md §2; no higher-order source altered.
- **"Fails clearly when configuration is absent" implemented as degraded boot (D-2.2), not
  `exit(1)`** — the plan's exit-gate wording is ambiguous, resolved in favor of the more
  specific `ARCHITECTURE.md` §3.1 contract (503 + named vars). Observable behavior proven
  live; no product requirement weakened.
- **W-2.1 deviated by silently defaulting `NODE_ENV`** → orchestrator corrective patch made
  it required at start (matches `.env.example` + §3.1). Contract deviation, not a spec one.
- **W-2.2 deviated by echoing raw URL values in config-error messages** (potential credential
  leak for `TURSO_DATABASE_URL`) → fixed by W-2.2b with a 1-line diff; test updated.
- **Phase 9 open item recorded, not fixed (scope boundary):** runtime derives listen port from
  `APP_BASE_URL` and does not yet honor platform-injected `PORT` (Render). Documented in
  `deployment/render.yaml` + Dockerfile comments; `src/**` was outside W-2.3's scope.
- **Phase 7 opened 2026-10-11 while Phase 6's exit gate still waits on the B-02 live
  click-through** (explicit user direction). Normally a phase closes before the next opens;
  the only missing Phase 6 evidence needs a user-side payment, so idling would waste the
  working window. Phase 6 stays OPEN with its clause map intact — its two boxes tick only
  after the real DeepSeek pass.
- **FD 684 "See the lookups → matching ledger rows" not fully implementable as written
  (escalated, not silently resolved).** The Architecture-locked SSE contract (§5/D-5.3;
  `tests/sse/sse.test.ts`, `tests/orchestrator/exitGate.test.ts`) delivers a fresh
  connection as state-only — no ledger history replay except via Last-Event-ID — so a
  browser reload leaves "See the lookups" links navigating to an empty ledger section.
  The evidence-drawer chain itself (claim → pill → entities → route → computation →
  links) is complete and e2e-proven within a live session. Smallest safe posture:
  links stay real and honest; no fake rows, no SSE history invented. **User/spec-owner
  decision pending:** FD amendment (wording), SSE state-frame history replay, or a
  client-side ledger replay route (the "12th route" option). Recorded as known risk
  B-09.
- **S2 re-inking "additions draw in / removals are struck" stroke-dashoffset keyframes
  (FD 536/709/719) deferred.** FLIP rail re-ink on dial re-rank exists with a
  prefers-reduced-motion guard (W-7.3); the draw-in/strike motion polish was judged
  judge-irrelevant content-wise (all readings are static text) and not built in
  Phase 7. Reduced-motion requirement is trivially satisfied (no motion states exist).
  Re-open if a later design pass wants the full signature motion.
- **FD 686 per-alternative "Weakest link becomes: …" preview line deferred; the
  Plan-719 weakest-link bullet is satisfied by the post-replace success-sheet line**
  (`buildWeakestLine` + e2e assert, `0d9344b`). Per-alternative preview would need
  per-candidate weakest-link computation client-side — recorded as design follow-up,
  not a spec deviation of the Plan bullet.
- **Provenance pill set at 16px (FD 758) against the 13px type-scale step (FD 221)**
  — kept FD 758's explicit pill size; the tension is noted here for a future design
  reconciliation pass. No behaviour impact.
- **Custom-candidate replace can add ≤4 evidence records the client slot does not
  reseed** (the terminal refetch re-syncs; a mid-flight custom replace's brand-new
  records may lag until the next full get). Accepted: links only navigate to the
  ledger view; no unknown ID is ever rendered as confirmed evidence.
- **GET-only evidence projection (server contract inconsistency, deferred).** GET
  /api/runs/:id injects the evidence projection (`routes.ts`); SSE state frames and
  replace/stop responses carry RunState without it. The client evidence slot +
  terminal-refetch bridge keeps the UI correct (this session), but the server-side
  projection should be unified before Phase 8's challenge/blueprint responses add
  more state-only surfaces. Recorded as known risk B-10.

## Known Risks / Blockers

| ID | Severity | Blocker | Impact | Owner |
|---|---|---|---|---|
| B-01 | ~~Qloo key not issued~~ | **Closed 2026-10-06**: key received from user, stored in gitignored `.env`, authenticated successfully against `hackathon.api.qloo.com`. | Gate A REST path unblocked; MCP path also proven same day (see Verified Tests M1–M6). | — |
| B-02 | **Critical → PARTIALLY CLEARED 2026-10-08** | DeepSeek key **delivered and proven valid**: `/models` 200 → `deepseek-flash`, `deepseek-v4-pro`; completion → **HTTP 402 (unpaid, not 401)** — key recognized, **balance = 0** (user topping up later). | **Implementation UNBLOCKED** (fake-LLM tests + gated live suite). Live LLM verification (real Prior generation, `LIVE_DEEPSEEK=1`) deferred until balance is topped up; key stored only in gitignored `.env`. | User (payment) |
| B-03 | ~~Docker not installed~~ | **Closed by D-0.6** (accepted risk). | Local container tests skipped; Dockerfile validated on Render. | — |
| B-04 | ~~No public GitHub repo~~ | **Closed by D-0.9**: https://github.com/louji2308/zorq is PUBLIC, pushed, MIT detected, About set. | R2/R5 satisfied. | — |
| B-05 | ~~Cache/storage + key-lifetime terms unconfirmed~~ | **Closed 2026-10-06 from the official developer guide**: private server-side caching allowed with no time limit; never store Qloo output publicly; keys valid through end of judging. | `PERSIST_QLOO_DERIVED` remains `false` until Phase 5 gives storage a private owner. | — |
| B-06 | **PARTIALLY CLEARED 2026-10-09** | **MapTiler key DELIVERED** (`VITE_MAPTILER_KEY` set in gitignored `.env`, build verified). Turso database still not provisioned. | Map/geocoding (S0/S1) unblocked — public Vite client key, safe in bundle by design. Turso still optional — in-memory adapter is default. | MapTiler: **closed**. Turso: User |
| B-07 | Medium | Deadline Oct 30 2026 23:45 EDT; internal freeze Oct 28. **21 days from today.** | Schedule pressure; see `HACKATHON_TRACKER.md`. Phase 5 closed on time with buffer remaining. | Orchestrator |
| B-08 | Medium | Qloo `qloo mcp` needs Node 22.19+ and a long-lived backend; serverless unsupported. | Constrains hosting to Render Free (locked). | Locked, no action |
| B-09 | Medium | **FD 684 vs locked SSE contract (escalated 2026-10-15):** "See the lookups → matching ledger rows" cannot survive a fresh reload under state-only SSE; the drawer chain is complete within a live session. | Judge-visible gap only on reload; links stay honest. Needs spec-owner decision: FD amendment vs SSE history replay vs client replay route. | User / spec owner |
| B-10 | Low | **GET-only evidence projection:** only `GET /api/runs/:id` injects evidence; SSE/replace/stop responses carry RunState without it. Client evidence slot + terminal refetch bridge the gap (`b1f276e`). | Server-side unification deferred; Phase 8 challenge/blueprint surfaces did NOT add more state-only projections (challenge/blueprint responses stay report/blueprint-shaped; D-8.7 posture held). | Orchestrator (Phase 9) |
| B-11 | Low | **Phase 8 deferred review polish** (from the 15-finding independent review, D-8.23): #8 rounds history not persisted per report (detail lines now render, `rounds` exists, but full per-round mutation history is not modeled); #9 bridge evidence provenance not attached to the blueprint's bridge-member receipts; #10 deep challenge block (full report) absent from the standalone share blueprint — share shows the composed artifact only; #11 `state.evidence` field is dead code alongside the projecting GET; #13 format-downshift ordering in fit copy vs spec's "downshift before dropping a role when practical"; #15 deterministic-fallback rationale cites positional indices without per-citation attribution; #16 mutation operator `Shift-scale` from the Plan's operator list exists only as the catchment attack's city-scale re-measure (challenge.ts:83 union = swap/drop/bridge), never as a mutation candidate producer. | None falsifies evidence, numeric truth, or the protected loop (verified during triage); each is judge-visible polish, state hygiene, or a bounded operator gap. Backlog for Phase 9 alongside `/method`. | Orchestrator (Phase 9) |

## Last Verified Commit

`f8b2172` — *test: pin display-name prose, honest fit states, and the narrative
numeric guard.* Preceded by `90bcf13` (fix: speak member names and honest fit
states across the judge-facing blueprint — the independent-review fix wave),
`d4edc90` (test: e2e challenge order + compare members), `8d71f49` (fix: compare
modal shows only frozen Prior members), `656f53d`/`0f3620a` (e2e evidence docs),
`7893e56` (docs: W-8.6 + D-8.17), `cce7b87`, `424cf76`, `f02f6b9`/`99510fc`,
`02093c5`/`ff54a0d`, `b938cbe`/`6903c25`, `f3f90a4`/`f786607`/`0c8ba6f`,
`c81bfbb` (Phase 8 contract).
Gates green on the tree at sign-off: typecheck 0, lint 0, **746 pass / 5
gated-live skips**, **Playwright 10/10**, **build PASS**; `git diff --check`
exit 0, diff secret scan 0 hits; fixture-browser walk green
(`tmp/phase8-walk.json`, `s4ShowsNoComponentIds=true`, zero console/page errors).
Pushed: `d4edc90..f8b2172 main -> main` on
**https://github.com/louji2308/zorq** (repo-moved redirect informational only).
Next: Phase 9 contract at the boundary; clause map + closure recorded below.

## Next Highest-Value Action

**Write the Phase 9 contract at the boundary (read all seven ProjectSpec sources
fresh), then execute Phase 9's full-path proof:** one scripted fixture run walked
Landing → preset → Prior → S1 → S2 → S3 → S4 → S5 → Without-Qloo → Share/Print
in a browser on production dist (extending `tmp/phase8-walk.ts` past S4/S5), then
the deployment/CI/`/method` work of Plan 819+. Highest-value live action once
user-side B-02 clears: one real-services judge pass (real DeepSeek + real Qloo
end-to-end) — closes Phase 6's live clause and Phase 8's deferred live clause in
one run. Carry into the Phase 9 contract: B-09, B-10, B-11, /method route,
D-8.16 (S5 in-place Replace), deadline Oct 30 2026 / internal freeze Oct 28.

## Phase 8 Exit-Gate Status (PASSED 2026-10-17 — fixture judge path per user approval D-8.23; live-services clause deferred to Phase 9 / B-02)

Gate text (Plan 809): *"A complete run produces a professional Blueprint
understandable without watching the agent work."*
Contract exit gate (this file, line 169): *"full judge path honest under real
services; clause map vs Plan 734–808 + ProductSpec S4/S5 + Final Design 7.4–7.5;
every worker diff reviewed; no fake production behavior."*

Evidence: W-8.1 `0c8ba6f`, W-8.2a `f786607`, W-8.2b `6903c25`, W-8.3 `ff54a0d`,
W-8.4 `99510fc`, W-8.5 `424cf76`, W-8.6 `cce7b87`, exit-gate e2e `0f3620a` +
`d4edc90`, compare-modal `8d71f49`, review fix wave `90bcf13` (fix) + `f8b2172`
(test). Gates at sign-off: typecheck 0, lint 0, **746 pass / 5 gated-live
skips**, **Playwright 10/10**, build PASS, `git diff --check` exit 0, diff secret
scan 0 hits, fixture-browser walk `tmp/phase8-walk.json` with **zero console/page
errors** (6 screenshots `tmp/phase8-01…06.png`). Proof basis: fixture judge
pipeline — scripted LLM at the label boundary + fake gateway at the transport
boundary only; server, engine, and UI code are the production paths
(D-8.17/D-8.23). Every worker diff inspected against its contract; the full
range additionally received an independent adversarial review (15 findings,
all triaged — D-8.23).

**S4 Challenge (Plan 738–754):**
- [x] **agent chooses attack order from current diagnostics** — bounded LLM
  turn with deterministic fallback (D-8.6); walk `bannerMeta = "3 stress rounds ·
  2 mutations · attack order chosen by the agent"` + `expectedAttackOrder`
  recorded; e2e agent-order banner assert.
- [x] **five attack families present** — walk `attackNames` = ablation `Remove a
  member`, substitution `Substitute a member`, bridge insertion `Bridge the
  weakest link`, catchment shift `Shift the catchment`, rival composition sweep
  `Check the rival` (5/5); W-8.2a unit matrix.
- [x] **Qloo spend where it changes decisions** — one connecting category per
  challenge (walk attack detail); catchment re-reads stored city neighborhoods at
  zero extra call count (D-8.2); per-run budget hard-fails honestly (unit).
- [x] **verdict ∈ {Survived, Revised, Replaced}** — `resolveVerdict` unit covers
  all three; Replaced chain via fixture D (`6903c25`); walk observed `Revised`.
- [x] **failed probe stays visible and can cap evidence quality** —
  bridge-outage test: row `not completed` rendered, `gradeCap B`, F1 honesty
  asserts (`not.toContain("all five attacks")`, `toMatch(/held against \d+
  measured attacks/)`, `toContain("not completed")`); cross-circle row class
  unit-proven (`is-measured`/`is-skipped` — walk rows
  `[measured, skipped, skipped, measured, measured]`). Judge fixture itself has
  no failed probe — that exact path is unit-level proven, not walked.
- [x] **verdict banner always states a reason (FD 618)** — walk `verdictReason`
  = server reason verbatim with display names, `Δ +0.0860` deltas, stop note;
  `attack.detail` sentence per row rendered (`.s4-attack-detail`, F8a).
- [x] **running indicator (PS 211)** — challenge is synchronous (D-8.7): CTA
  disabled while `challenging` + `aria-live` status region; per-row spinners
  need streaming we deliberately do not have.
- [x] **CTA "Open blueprint" (PS 213 / FD 621)** — `.s4-primary` renders with a
  verdict.
- [x] **leader-as-drawn legible with strikes (FD 618)** — walk `leaderRowTexts`
  incl. `Clay Collective\nREMOVED`; names, zero `comp-*` ids
  (`s4ShowsNoComponentIds = True`).

**Mutation (Plan 755–764):**
- [x] **operators Bridge / Swap / Drop** — `mutation.operator ∈ {swap, drop,
  bridge}` (challenge.ts:83); verdictReason shows two real drops applied.
- [ ] **operator `Shift-scale`** — catchment shift ships as an *attack*
  (city-scale re-measure + Δ, walk detail `Δ -0.0035`) per contract line 90–91
  ("shift-scale: heatmap/city-baseline re-read"), but **no mutation candidate
  emits `shift-scale`** — honest gap against the Plan's operator list; recorded
  in B-11 #16 for Phase 9, not silently claimed.
- [x] **max two mutation rounds** — banner `2 mutations` at stop; stop-at-two
  unit tests.
- [x] **stop rule + best defensible state (764)** — leader-survives + ε
  (1e-6) stop-note unit tests; `A further drop … remained at the two-round
  stop` (walk).

**Constraint engine (Plan 766–778):**
- [x] **format library + footprint ≤85%** — `formats.ts`/`fit.ts` W-8.1 tests;
  `withinFootprint = usableSqFt === null || sum ≤ 0.85·usable`.
- [x] **hours/noise constraints** — constraint chips from brief + fit reasons;
  walk `droppedRows` = `no format of Music venue satisfies the site constraints`,
  `no format of Bar satisfies the site constraints` rendered with reason on the
  member rows (D-8.21).
- [x] **downshift before dropping; role preserved** — asserted verbatim in
  formats tests: `Cinema becomes micro-screening. Role preserved: Anchor.`
- [x] **honest unmeasured fit** — area-less brief → `withinUsable: null` → walk
  `fitLine = not measured (no floor area supplied)` (D-8.21).
- [ ] **heuristics documented/editable in `/method` (778)** — deferred to Phase 9
  (contract NON-GOALS, line 150): `.s5-method-link` routes `/method` (walk
  `methodHref`), every heuristic export still carries `[Zorq heuristic]`; page
  content is Phase 9.

**S5 Blueprint — the 15 artifacts (Plan 780–795):**
- [x] 1 title — walk `The Williamsburg corner plan` + `LLM` source pill.
- [x] 2 rationale — walk: 1 superscript, cited receipt resolves, invented
  citation absent (`inventedCitationVisible = False`), numeric guard (D-8.22).
- [x] 3 role-based composition — role-grouped member rows (`.s5-member-role`).
- [x] 4 evidence receipts — walk `receiptCount = 9` in the margin column.
- [x] 5 site fit — `.s5-fit` block with honest null line.
- [x] 6 hours/noise fit — per-member hours bars + constraint chips (dropped
  reasons above).
- [x] 7 What Qloo changed — walk `diffSentence = Qloo kept 1, reformatted 0,
  removed 4, and added 2.` (names, not ids — D-8.19).
- [x] 8 risks — four kinds incl. new `constraint-conflict`
  (`blueprintRiskKinds`, routes.ts:119) + feasible-fit test.
- [x] 9 weak links — `weakest-edge` risk + `buildWeakestLine` chain (Phase 7
  owner reused).
- [x] 10 evidence grade — walk `Evidence grade B`; grade-cap-B reason emitted
  when cap binds (F10a test).
- [x] 11 revision history — `revisionHistory` unit; revisions stamped `at`
  (D-8.20) so stale leaders cannot render.
- [x] 12 method link — walk `methodHref = /method`.
- [x] 13 share — `shareTokenLen = 24`; read-only walk in a fresh context
  (`shareTabCount = 0`, `shareChallengeBtn = 0`).
- [x] 14 Copy as Markdown — `s5Model` markdown tests (incl. honest Footprint
  line).
- [x] 15 print/save PDF — real `@media print` stylesheet (landscape sheet,
  actions/modal hidden); W-8.5.
- [ ] **member-card Replace button (PS 221 / FD 660)** — deferred by recorded
  D-8.16: S2/S3 own Replace; S5 stays a read artifact. Deviation, not a gap.

**Without-Qloo (Plan 796–805 / PS 227):**
- [x] **Frozen Prior + LLM-only polish vs Final, diff highlighted** — walk modal:
  heading `WITHOUT QLOO` context, `comparePolish = 1`, right column from server
  diff arrays.
- [x] **do not manufacture divergence (805)** — D-8.18 fix `8d71f49`: left
  column = frozen-Prior members only (walk `priorColumnNames` = 5 names incl.
  `Devoción`, zero pool scaffolding); e2e left-column pin.
- [x] **confident-empty case ("evidence changed nothing")** — neutral compare
  state unit-tested (s5Model derives only from diff arrays).

**Shareable Blueprint (Plan 806–807):**
- [x] **`/run/:id/blueprint` stands alone** — walk: `shareTitle` renders,
  zero tabs, zero challenge controls, zero `undefined` in body.

**Exit gate (Plan 809):**
- [x] **professional Blueprint understandable without watching the agent work** —
  walk screenshots 01–06: every claim on S4/S5 carries its reason, delta,
  receipt, risk, or grade inside the artifact; no console errors.

**ProductSpec S4/S5 (209–237) & Final Design 7.4–7.5 extras:**
- [x] FD 658 title block — `.s5-titleblock` renders all eight fields (Project /
  Site / Area / Constraints / Grade / Revision / Date / Run, source-verified).
- [x] FD verdict square solid/half-hatched/crossed — `verdictSquare` unit test.
- [x] PS 232 stored blueprint (final state + diff + readings) — blueprint
  snapshot response + ledger receipts.
- [ ] FD 7.5 receipt **colour thumbnails** — not built (text receipts + pills);
  FD's "one place colour appears" is polish-only, honesty unaffected.
- [ ] FD 7.5 hours **hatched forbidden band** — not built (bars + chips + rule
  line); visual polish only.
- [x] PS 234 /method content clause — **Phase 9 by contract** (line 150/60);
  stub route + heuristic markers already in place.

**Contract acceptance (lines 157–161):** all met on the fixture path —
typecheck 0, lint 0, unit green, build PASS, e2e covers challenge → blueprint →
without-Qloo, secret scan 0 hits, browser walk with zero console errors, honest
refusal paths (busy run / exhausted budget / unmeasurable) unit-tested.
No fake production behavior: fakes exist only at the scripted-LLM label and fake
transport boundaries, isolated from production execution (AGENTS §12).

**Honest deferrals carried forward:** live-services judge pass (→ B-02, first
live action of Phase 9 — the one unfinished contract clause); `/method` content
(Phase 9); S5 in-place Replace (D-8.16); six review findings + `shift-scale`
operator (B-11); FD thumbnail/hatch polish (this list). None falsifies evidence,
numeric truth, or the protected loop.

## Phase 7 Exit-Gate Status (PASSED 2026-10-15 — one escalated deviation, B-09)

Gate text (Plan line 724 / ARCHITECTURE §6): *"A judge can answer 'why do these
components belong together?' by inspecting an edge rather than trusting an unsupported
narrative."*

Evidence: W-7.1 `99b53bd`, W-7.2 `7180387`, W-7.3 `f8717d7`, W-7.4 `3591f75`,
W-7.5 `bd1cb20`, exit-gate `b1f276e` (evidence slot + names + typed weakest-link),
`0d9344b` (weakest-link success line), `1acb896` (judge pipeline + chain + e2e).
Gates at sign-off: typecheck 0, lint 0, **642 pass / 5 gated-live skips**, build PASS,
**e2e 8/8**, `dist/web` secret scan **0 hits**, fixture-browser walk with **zero
console errors** (screenshots `tmp/phase7-*.png`).

**S2 (Plan 666–680):**
- [x] **Prior + Composition A/B/C** — `CompositionsPanel` renders the Prior card
  ("No cultural data used at lock time.") plus ranked A/B/C; e2e test 1 (dial
  re-rank without new measurement); browser pass.
- [x] **role structure / coherence percentile / distinctiveness / weakest link /
  evidence grade** — `CompositionCard` role-grouped rows, percentile sentences
  ("More coherent than 98% of 50 valid combinations…"), distinctiveness counts,
  weakest-link break-mark buttons, grade letters + reasons; browser pass.
- [x] **Never a magical 0–100 ecosystem score** — e2e `expectHonestRenderedText`
  forbids `/ecosystem/i`; only percentiles, grades and raw readings render.
- [x] **Field/percentile visualization (FD)** — 12-bin Field histogram + A/B/C
  marks + dashed Prior mark; browser pass ("all 50 valid combinations … 0.04–0.10").

**Re-inking (Plan 681–690):**
- [x] **dashed Prior → lines re-ink** — FLIP rail re-ink on dial re-rank with a
  `prefers-reduced-motion` guard (W-7.3); unit-proven order identity.
- [ ] **additions draw in / removals are struck** — stroke-dashoffset keyframes
  (FD 536/709/719) **deferred** (recorded deviation; motion polish only — all
  readings remain static text, reduced-motion state trivially satisfied).

**S3 (Plan 691–703):**
- [x] **nodes = components, edges = shared culture** — `ConnectionsPanel` map +
  sorted edge list; e2e 3; browser pass.
- [x] **edge inspection: two components / shared cultural entities / measurement
  route / triangulation status / ledger references** — pair drawer renders the
  claim, ranked named entities (Paris, Texas #1, Bill Evans #2), how-computed
  route, direct-check (triangulation) disagreement line, and four "See the
  lookups" ledger-reference buttons; e2e test 2; browser pass.
- [x] **sorted edge-list fallback when narrow** — <1200px switches to the distance
  chart; e2e test 3.

**Evidence drawer (Plan 704–713):**
- [x] **claim → provenance badge → entities → measurement route → computation
  summary → ledger links** — `EvidenceDrawer` + `s3Model` (Qloo pill only when
  `evidence.claim !== null`); e2e 2; browser pass.
- [x] **evidence survives replaces and state frames** — client evidence slot
  mirrors `ledgerRows` (`b1f276e`); unit test + e2e 4.
- [ ] **FD 684 "See the lookups → matching ledger rows" across a reload** —
  **not implementable under the locked SSE contract** (fresh connect = state
  only; `exitGate.test`); links navigate to the ledger section but a reload
  leaves it empty. **Escalated to the user/spec owner (B-09).** No fake rows,
  no invented history.

**Replace (Plan 714–722):**
- [x] **alternatives** — cap-5 list with measurable/blocked states; browser pass.
- [x] **coherence effect** — ΔC diverging bars; e2e 4; browser pass.
- [x] **distinctiveness effect** — ΔD diverging bars; e2e 4; browser pass.
- [x] **weakest-link effect** — success-sheet line "Weakest link becomes: Clay
  Collective and Hallen Biergarten." (`0d9344b`); unit 4/4 + e2e assert; browser
  pass. (FD 686's *per-alternative* preview line deferred — recorded deviation;
  the Plan bullet is the post-replace effect.)
- [x] **optional custom candidate** — custom Qloo query input + honest
  blocked-reason; browser pass.
- [x] **bounded Qloo calls** — server-side pool/alternative caps +
  `customBlockedReason`; replaceResponseSchema; judgeChain test.
- [x] **revision history** — "Revisions on this run" list; e2e R1 row
  ("R1: Court Tree Roasters → Devoción (Anchor) · ΔC -0.02"); browser pass.
- [x] **role-preserving** — "Keeps the role: Anchor." + sameMembers family
  invariance (W-7.5, reviewed); browser pass.

**Exit gate (Plan 724):**
- [x] **The judge question is answerable by inspecting an edge** — browser walk:
  click the Devoción↔Nitehawk edge → claim, shared entities with ranked names,
  triangulation disagreement, measurement route, ledger refs; then replace a
  member → role kept, honest ΔC/ΔD, mini challenge, revision row.
- [x] **No honest-503 or placeholder surface is reachable on the Phase 7 path**
  — `tests/api/judgeChain.test.ts` drives the real orchestrator pipeline end to
  end (fake gateway/LLM only at the transport boundary); replace route returns a
  measured response, never the Phase-7-era 503.
- [x] **No fabricated intelligence** — fixtures live only under `tests/`+`e2e/`
  and are never imported by `src/**`; zero console messages in the browser walk;
  secret scan 0 hits.

**One-line verdict:** every Plan-7 clause has an observable, tested surface except
the two recorded deferrals (re-inking motion polish; FD per-alternative weakest
preview) and the one escalated architecture conflict (B-09, FD 684 ledger rows on
reload). The exit-gate question is answerable by clicking an edge today.

## Phase 6 Exit-Gate Status (OPEN 2026-10-09 — every clause proven except the B-02 live click-through)

Gate text (Plan line 653 / ARCHITECTURE §6): *"A judge can land, choose a preset, see
the Prior, watch real investigation, and understand what Qloo is doing without reading
the source code."*

Evidence: W-6.1 `579b23e`, W-6.2b `7f5380c` + `e85fdde`, W-6.3 `b71dd00` + `7dfb688`,
W-6.4 `91c6788`. Gates at sign-off: typecheck 0, lint 0, **498 pass / 5 gated-live
skips**, build PASS, **e2e 4/4**, live `LIVE_QLOO=1` **4/4** (50.7s against real Qloo).

- [x] **Land** — `GET /` renders S0 (landing line, three presets, four steps) in e2e
  and in the live browser; the landing test now also asserts **zero page errors and
  zero console errors** (only `Failed to load resource` noise is filtered).
- [x] **Choose a preset** — preset selection, address search and geocode-failure →
  map-point-pick fallback unit-tested (`s0Brief/s0Geocode/s0Presets`); the
  run-creation contract e2e asserts **201-with-run-or-typed-DEPENDENCY_UNAVAILABLE**
  — today a typed 502 envelope with `requestId` + `details`, never an untyped failure;
  after B-02 top-up the same test accepts 201 without edits.
- [ ] **See the Prior (real run)** — S1 Frozen Prior card (lock time, roles, "No
  cultural data used.") unit-tested (`s1Prior`) and rendered in a live browser
  through the real `RunRoute`/`getRun` path via the client-side diagnostic fixture;
  server-side Prior-before-Qloo proven at the Phase 3 exit gate (live Qloo, deep
  frozen, identity-referenced). *Real click-through pending B-02: `POST /api/runs`
  → typed 502 `DeepSeek balance is insufficient`.*
- [ ] **Watch real investigation (in browser)** — the real `EventSource` client,
  ledger streaming (contiguity + suspend-on-gap), expandable rows and stop control
  verified live through the fixture; the server-side real investigation is proven by
  the Phase 3 exit gate and today's live Qloo 4/4. *Real in-browser run pending B-02.*
- [x] **Understand what Qloo is doing** — ledger rows carry Qloo/Compute/LLM pills,
  durations and expandable Call/Result/Results/Source/Duration details; the site map
  shows crosshair, dashed radius ring, lettered anchor pins and heat dots; the DNA
  strip shows local/city dumbbells — all rendered live with **zero console
  messages** in the final §17 screenshot; Qloo row semantics match real gateway
  envelopes (live 4/4).
- [x] **Degraded paths** — S0 geocode fail → map picker + honest copy (unit); S1
  load failure → banner + `describeLoadFailure` + "Unavailable" status (e2e proves
  RUN_NOT_FOUND recovery); rate-limit events → dashed rows with an honest note and
  **no invented retry counters** (gateway retries internally — deviation recorded in
  `s1Model.ts`); SSE stall → reconnect notice; stream error → banner.
- [x] **No fabricated data** — fixtures never imported by `src/**` (red-flag scans +
  §17 review); `dist/web` secret scan **0 hits** across all 5 output files (Qloo /
  DeepSeek / Turso values and env-name literals); `VITE_MAPTILER_KEY` is public by
  design (D-6.x).
- [x] **Design language** — reduced-motion honored (`tokens.css`, `base.css`,
  `map.ts`); no gradients/radius/shadows in s1; shape+words carry state, never
  colour alone; 44px+ targets; keyboard-focusable controls (§17 screenshots).

**Flip condition:** top up DeepSeek (B-02) → one real browser pass (click preset →
201 → `/run/:id` → frozen server Prior → live Qloo ledger rows → DNA strip) → re-run
the full suite → mark the two boxes `[x]` and close the phase.

## Phase 5 Exit-Gate Status (PASSED 2026-10-09)

Gate text (ARCHITECTURE §6 / Plan line 597): *"A run can be stopped, refreshed,
disconnected, reconnected, retried or resumed without corrupting state, duplicating
effects or fabricating completion."*

Proof: `tests/orchestrator/exitGate.test.ts` (commit `7f11d7f`), 10/10 green, orchestrator-
authored over the four workers' landed APIs; suite at sign-off **386 pass / 5 gated
skips**, typecheck 0, lint 0, build PASS, e2e 3/3.

- [x] **Stopped** — cooperative stop mid-investigation lands exactly one `run.stopped`
  marker; the gated pass settles as `stopped`; Prior stays frozen; phase stays
  `investigation` (not upgraded).
- [x] **Refreshed** — a fresh SSE client mid-run always receives the authoritative
  `state` frame first, with zero ledger replay (no stale assumptions).
- [x] **Disconnected** — aborting the SSE client removes the hub subscriber
  (`subscriberCount` → 0) and leaves durable run state intact.
- [x] **Reconnected** — `Last-Event-ID` replays only the missed contiguous ledger
  window; the already-seen prefix is never re-sent; a non-contiguous gap falls back
  to state-only (no silent partial replay).
- [x] **Retried** — retry after stop re-enters investigation and reaches a terminal
  `complete` run with real observations; `measure.compose` appears after the stop
  marker in ledger order.
- [x] **Resumed** — resuming a terminal run is a no-op with **zero new LLM spend**
  (call counter unchanged) and zero ledger growth.
- [x] **No corruption** — durable store matches the final orchestrator state; Prior
  rehydrates frozen; ledger sequences strictly increasing and unique; the pre-stop
  ledger prefix is byte-identical after retry.
- [x] **No duplicate effects** — one `run.stopped`, one `measure.compose`, Qloo probe
  count equals evidence-record count, each counted once per real attempt.
- [x] **No fabricated completion** — the stopped pass that finished its turns was not
  upgraded to complete; completion required real observations (`evidenceCount > 0`
  and post-stop Qloo probes present).

## Phase 4 Exit-Gate Status (PASSED 2026-10-08)

Gate text (ARCHITECTURE §6): *"A controlled candidate pool can produce a complete
graph, ranked role-valid compositions, percentile, distinctiveness, weakest links and
evidence classifications without LLM-generated numbers."*

Proof: `tests/engine/exitGate.test.ts` (commit `b759e83`), 7/7 green, orchestrator-
authored over the three workers' landed APIs; suite at sign-off **293 pass / 5 gated
skips**, typecheck 0, lint 0, build PASS, e2e 3/3.

- [x] **One controlled pool** (K=6, roles Anchor/Social/Discovery/Anchor/Social/Night)
  — pure fixtures, no Qloo, no LLM, no network, no `Date.now`/`Math.random` in any
  measurement path (grep-verified across `src/server/engine/` + `src/server/evidence/`).
- [x] **Complete graph**: 6 nodes, C(6,2)=15 edges, every edge `measured` with finite
  value (shared entities survive the IDF floor at K=6 — consistent with D-4.4).
- [x] **Role-valid compositions**: exact enumeration C(6,3)=20 candidates → exactly 4
  valid (one Anchor + one Social + the Discovery, all members measured, all internal
  edges measured); no sampling.
- [x] **Percentile**: family percentiles are exactly {0, 25, 50, 75} under the
  strictly-less rule (D-4.5); monotone with coherence; hand-checked weakest link =
  min internal edge and coherence = mean internal edge against the graph itself.
- [x] **Distinctiveness**: per-member d̄ ∈ [0,1] attached to every composition;
  honest exclusion proven — removing c3's city vector nulls all 4 d̄ → ranked empty +
  4 exclusions with reason `distinctiveness_unavailable` (never silently dropped, D-4.7).
- [x] **Ranking + rival sweep**: rank scores non-increasing; sweep = 101 points
  (w = 0.00…1.00); every leader is a 3-member composition or null on empty input.
- [x] **Evidence classifications**: route pair classified `confirmed`/`contested`/`thin`
  exactly per D-4.9; grades `B` (mixed), `A` (all confirmed), `C` (member unmeasured
  even with all-confirmed edges) exactly per D-4.10.
- [x] **Unknown evidence ids never render as confirmed**: `resolveClaimEvidence` throws
  `UNKNOWN_EVIDENCE_ID` for a missing id (D-4.11).
- [x] **Determinism**: the full pipeline (graph + distinctiveness + ranking incl. sweep)
  is byte-identical across two independent reruns (JSON stringify compare).

No LLM-generated number exists anywhere in this chain: every numeric output descends
from fixture inputs through Zorq's pure arithmetic.

## Phase 3 Exit-Gate Status (PASSED 2026-10-08)

Gate text (ARCHITECTURE §6): *"A real brief produces a Prior, at least one real Qloo
observation, a validated state mutation, a ledger event and an evidence record. Qloo
outage yields an honest partial state."*

- [x] **Real brief** → `runInvestigation` validates it (typed validation error on malformed)
- [x] **Prior** → LLM-only generation (scripted LLM in the live run; real-LLM path gated
      `LIVE_DEEPSEEK=1`, deferred per D-3.2/B-02) → `priorSchema` enforced → **persisted
      exactly once** (write-once conflict test) → deep-frozen, `qlooUsed=false` literal
- [x] **≥1 real Qloo observation** → live run `LIVE_QLOO=1`: real `qloo_search` via gateway
      (REST/MCP real envelope) — the same suite independently proven 3/3 this phase
- [x] **Validated state mutation** → `prior_pending → investigating → complete` through the
      guarded transition table (illegal transitions + phase regression + prior-less
      investigation all throw; shared `runStateSchema` validated at every step)
- [x] **Ledger event** → live sequence `LLM, LLM, Qloo, LLM` against `ledgerEventSchema`
- [x] **Evidence record** → created, `ledgerEventId` links to the Qloo ledger entry,
      provenance = real envelope (transport/endpoint/durationMs/cacheState/resultCount);
      unknown provenance → typed `EvidenceError`, never rendered as confirmed
- [x] **Qloo outage → honest partial state** → unit-proven: prior + partial ledger/evidence
      preserved, typed error, run lands `partial`, zero fabricated fields
- [x] **Bounds:** planner turns ≤3 (clamped in code, test with `maxTurns:99`), LLM budget
      ≤$2 ceiling (constructor clamp, 80% reserve, official pricing), Qloo budget per
      attempt ≤180 (from gateway review), no orchestration frameworks
- [x] **Intelligence boundary preserved:** LLM never authors numeric truth (budget/validation/
      caps deterministic in Zorq code); no fabricated ids/results anywhere (`src/` scan clean)
- [x] **Worker results reviewed** (AGENTS §17): both workers' diffs read file-by-file; 1
      assembler defect caught and fixed (`8d5b422`); claims independently re-verified
- [x] **All gates green at sign-off:** typecheck, lint, 153 unit + 5 gated live, build, 3 e2e
- [x] **Secrets clean:** key only in gitignored `.env`; diff scans (sk-/hack_/eyJ) = 0 hits
- [x] **4 coherent commits for the phase's agent half** (+2 gateway +2 docs earlier)
- [x] **Progress recorded; Phase 4 identified as the next highest-value action**

## Phase 2 Exit-Gate Status

- [x] Fresh checkout **installs** — local clone → `npm ci` (250 packages, 0 vulnerabilities)
- [x] **Typechecks** — dual tsconfig clean
- [x] **Lints** — eslint clean, zero suppressions added
- [x] **Tests** — Vitest 62/62 (incl. real degraded-boot subprocess) + Playwright 3/3 on
      system Chrome against a real production build
- [x] **Builds** — `dist/server` + `dist/web` produced
- [x] **Starts** and **responds to `/healthz`** — 200 `{"status":"ok",…}` with config present
      (proven twice: repo checkout and fresh clone with placeholder env)
- [x] **Fails clearly when required configuration is absent** — no `.env`: WARN names
      `NODE_ENV` + `APP_BASE_URL`, `/healthz` answers 503 typed `SERVICE_UNAVAILABLE`, process
      stays alive (D-2.2, §3.1)
- [x] Contract implement list complete: React+Vite+TS, Node/Express+TS, shared Zod, config
      loader, Pino, typed errors §3.0, Helmet + rate limiting, route registration (exactly
      the 11 routes, honest unimplemented), npm scripts, Vitest, Playwright, Docker,
      environment contract, production build path
- [x] Worker results reviewed (AGENTS §17): every diff read, 1 security defect + 2 contract
      deviations caught and corrected, claims independently re-verified
- [x] Exit-gate verified on a **real fresh checkout**, not just the working tree
- [x] No secrets in tracked files; no fake business logic; numeric truth still owned by
      future deterministic engine (nothing fake added to pretend otherwise)
- [x] Progress recorded; 6 coherent commits; tracker updated (R2 satisfied)

## Phase 1 Exit-Gate Status

- [x] One implementation path (ARCHITECTURE.md §1: single ownership map, one API family, one
      state store, one Qloo gateway)
- [x] Clear responsibility owners (all 11 plan-named domains placed in the `src/` tree)
- [x] Defined API/state contracts (11/11 routes with schema + errors + security + tests;
      Run state tree 13 nodes byte-matched to the plan, single-writer table per node)
- [x] Visible unresolved blockers (§7: B-02, B-06, quota, Docker-accepted, Devpost)
- [x] Defined phase gates (§6: Phases 0–10 exit gates recorded)
- [x] No plausible ambiguity about what Zorq is (header statement + §4.3 fixed truths)
- [x] High-risk unknown resolved with evidence: **Qloo MCP transport proven**
      (`USABLE-WITH-CONDITIONS`, orchestrator independently re-ran; Gate A ✅ in tracker)
- [x] Worker results reviewed (AGENTS §17): diffs inspected, claims re-verified, scope confirmed
- [x] No secrets in tracked files (key-leak grep = 0 across all changed files)
- [x] Deviation recorded where needed (phase-boundary reading method; §3.0 error model defined
      by W-1.1 because no spec defines it — contract, not product behavior, so within AGENTS §2)

## Phase 0 Exit-Gate Status

- [x] Repository state reconstructed
- [x] All Project Spec files read at phase boundary
- [x] Current-state model written
- [x] Blockers and risks identified and assigned (B-01, B-04, B-05 closed with evidence)
- [x] Decisions received from user (D-0.5 … D-0.9)
- [x] Public repository + visible license (R2/R5)
- [x] **Qloo API key issued, stored safely, and proven to authenticate** (B-01)
- [x] Real-service diagnostic evidence recorded (10 calls)
- [x] All Phase 0 exit items closed. **Hand-off item → Phase 1 gate:** write the Phase 1 contract
      (first action of the next phase, tracked there, not here).

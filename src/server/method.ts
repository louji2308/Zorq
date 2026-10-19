/*
 * The /method content — one canonical source (AGENTS.md §3.2: one authoritative
 * implementation per responsibility). GET /api/method serves it verbatim and the
 * /method screen renders it verbatim, so the two can never drift.
 *
 * Honesty rules for this content (Product Specification §12–§14, §17; Final Design §7.7):
 *  - It describes exactly what the implemented engine does (src/server/engine, src/server/qloo);
 *    no capability is claimed that has no owner.
 *  - Every number that is a product choice is marked editable and [Zorq heuristic].
 *  - The worked example is schematic arithmetic of the formulas (named placeholders, not
 *    real entity data), so nothing here fabricates a Qloo measurement.
 */
import type { MethodContent } from "../shared/routes.js";

export const METHOD_TITLE = "How Zorq measures";
export const METHOD_UPDATED = "2026-10-17";

export const methodContent: MethodContent = {
  title: METHOD_TITLE,
  updated: METHOD_UPDATED,
  whatQlooMeasures: [
    "Locality and heat: where cultural taste concentrates around a site, at the radius the brief defines.",
    "Places: the real places in the Qloo catalog near the site — the taste anchors for this locality.",
    "Place to culture: the artists, films and brands whose audiences align with those local anchor places.",
    "Culture to place: which place categories and tags rank for a given set of cultural entities, used to form candidate components.",
    "Site vs city measurement: the same category read at two geographic scales, which is where distinctiveness comes from.",
    "Entity and tag resolution: mapping a human phrase (\"independent cinema\") to resolvable Qloo tags and entity identifiers.",
    "Explainability metadata where the API returns it: which input entities influenced a result, with influence values.",
    "Audience context (demographics) on selected calls: qualitative context only, never an input to scoring."
  ],
  whatZorqComputes: [
    "Normalization and validation of every Qloo response before it may enter a measurement.",
    "The candidate pool: each component carries a resolved tag, at most five local exemplar places, and a provenance path (anchor place → cultural signal → category → exemplars).",
    "Taste neighborhoods: for each component, the top artist, film and brand entities of its exemplar set (top 30 per domain), weighted by returned affinity when present and by 1/rank when not.",
    "IDF suppression: entities that appear around every component in the pool are down-weighted to zero, so ubiquity cannot masquerade as a relationship.",
    "Shared-culture edges: the cosine similarity of the IDF-weighted neighborhoods of two components.",
    "Coherence of a composition: the mean pairwise edge across its members.",
    "The exact percentile of that coherence among all role-valid subsets of the same size from the pool — enumerated exactly, never sampled.",
    "The weakest link: minimum edge inside the composition, always named in the UI.",
    "Distinctiveness per component: one minus the cosine of its site-scale and city-scale neighborhoods — how differently this category behaves here.",
    "Ranking and the Familiar ↔ Distinctive dial: hard role and constraint filters first, then the z-scored blend of coherence and distinctiveness.",
    "Triangulation classification for finalist edges (confirmed / contested / thin) from an independent second query route.",
    "Evidence grades A/B/C by rule, applied consistently and never averaged away.",
    "Adaptive preference input: the interface starts with common local suggestions and derives related phrases deterministically; Qloo resolves and measures submitted phrases during the run, while the LLM interprets evidence and chooses probes.",
    "Constraint fit: footprint sums, hours and noise rules, format downshifts, and the Prior → Final diff.",
    "Budget accounting: Qloo call budgets, concurrency, planner turns, mutation rounds — every number deterministic."
  ],
  whatTheLlmGenerates: [
    "The Prior: the first composition guess, created before any Qloo call and frozen write-once.",
    "Investigation choices: which anchors to keep, which probes to run next, and when evidence is too thin to act on.",
    "Stress decisions: which attack runs first (ablation, substitution, bridge, catchment shift, rival check) and which bridge candidates are worth accepting.",
    "Naming and narrative: composition names, rationale text, and the plain-language framing of downshifts.",
    "The Without-Qloo polish: an LLM-only interpretation of the frozen Prior so the comparison is fair on both sides.",
    "Model-authored claims carry the [LLM] badge and may cite only evidence identifiers that exist in the run's ledger."
  ],
  heuristics: [
    {
      name: "Footprint cap",
      detail: "Total member footprint is limited to 85% of the available area; the remaining 15% is a circulation allowance.",
      editable: true,
      note: "[Zorq heuristic] A planning default, not a physical law. Editable here; changing it changes only the constraint fit, never any Qloo evidence."
    },
    {
      name: "Format library",
      detail: "About 25 component types, each with 2–3 plausible formats carrying role, footprint range, hours profile and noise class.",
      editable: true,
      note: "[Zorq heuristic] Footprints are planning ranges, not measured building data. Editable here."
    },
    {
      name: "Hours and noise classes",
      detail: "Constraint chips (no late night, no loud venue, ground floor only) filter or downshift formats by declared hours/noise class.",
      editable: true,
      note: "[Zorq heuristic] The class assignments are product rules."
    },
    {
      name: "Role map",
      detail: "Components are grouped into roles (Anchor, Social, Discovery, Experience, Night, Community) which every valid composition must cover.",
      editable: true,
      note: "[Zorq heuristic] The role taxonomy drives which subsets count as valid."
    },
    {
      name: "Dial default",
      detail: "The Familiar ↔ Distinctive weighting w defaults to 0.5, giving coherence and distinctiveness equal rank weight.",
      editable: true,
      note: "[Zorq heuristic] The dial is user-facing; the default is documented so the reading is reproducible."
    },
    {
      name: "Neighborhood fallback weighting",
      detail: "When a Qloo response carries no numeric affinity, taste-neighborhood weights fall back to 1/rank over the returned entities.",
      editable: false,
      note: "[Zorq heuristic] The fallback is fixed by the measurement contract so the same inputs always produce the same graph."
    }
  ],
  formulas: [
    "IDF(e) = max(0, ln(K / (1 + components containing e))) — ubiquity inside the pool is suppressed, never penalized below zero.",
    "edge(j,k) = cosine(IDF·N_j, IDF·N_k) — shared culture between two components within this pool; never demand, rent or success probability.",
    "C(S) = mean(edge(j,k)) over all pairs j < k in S — the coherence of a composition.",
    "Percentile(S) = rank of C(S) among ALL role-valid subsets of the same size, enumerated exactly (no sampling). At pool size 10 with 5-member sets that is at most 252 subsets before filtering.",
    "weakest link(S) = the pair with the minimum edge in S; it is always displayed with a name, never hidden in an average.",
    "d(k) = 1 − cosine(N_k^site, N_k^city) — how differently this category behaves at the site scale versus the city scale.",
    "Triangulation(pair j,k): query place type k with the taste signal of exemplars E_j and compare the rank of returned k-places to the same query under the locality-anchor signal. Agreement (k-places in the top half on both routes) classifies the edge confirmed; disagreement classifies it contested; fewer than 5 results classifies it thin.",
    "rank(S) = z(C(S))·(1−w) + z(mean distinctiveness(S))·w, after hard filters; tie-break by weakest link. Rival checks sweep w ∈ [0,1] and report leadership flips.",
    "Evidence grade: A when every leader edge is triangulated as confirmed; B when any finalist probe is contested, thin or failed; C when any leader member is unmeasured. Grades are caps, not averages."
  ],
  workedExample: {
    title: "Schematic example of the arithmetic",
    intro:
      "The steps below show how a component's neighborhood becomes an edge and a percentile. The entities are named placeholders — the real values always come from measured Qloo results on a live run, never from this page.",
    steps: [
      "Say the pool has K = 8 components. Component A's neighborhood (site scale) contains artist_a (rank 1), artist_b (rank 3), film_a (rank 2); component B contains artist_a (rank 2), film_a (rank 1), brand_a (rank 4).",
      "Suppose artist_a appears in 6 of the 8 neighborhoods and film_a in 4: IDF(artist_a) = max(0, ln(8/7)) ≈ 0.133 — nearly suppressed. IDF(film_a) = max(0, ln(8/5)) ≈ 0.470. An entity unique to A and B would get ln(8/3) ≈ 0.981.",
      "Weight each entity by its neighborhood weight (affinity if returned, else 1/rank), multiply by IDF, and take the cosine of A's and B's weight vectors. That cosine is the edge.",
      "For a 5-member composition the coherence is the mean of its ten edges; the percentile is its rank among all role-valid 5-member subsets of the pool — enumerated exactly.",
      "Distinctiveness compares the site-scale and city-scale neighborhoods of the same component: their cosine's complement, d(k), is how much this category means something different here.",
      "Triangulation re-checks one finalist edge through the second route: if B-places rank in the top half for A's audience under both the exemplar signal and the locality-anchor signal, the edge is confirmed; if the two routes disagree it is contested; if either query returns fewer than 5 results it is thin.",
      "The evidence grade follows from those classifications by rule: A when every leader edge is confirmed; B when any finalist edge is contested, thin or probed-but-failed; C when any leader member is unmeasured. The grade is a cap, never an average."
    ]
  },
  knownLimits: [
    "The Qloo place catalog is not a census: small venues, community spaces and informal places may be missing, so the pool is drawn from what is catalogued.",
    "Edges describe shared culture between audiences within the current pool. They are not demand, revenue, foot traffic or any probability of success — never presented as those.",
    "Format footprints and hours profiles are planning heuristics, labelled editable above; they are not surveyed building data.",
    "Coherence and percentiles are relative to the measured pool. A poor pool yields an honest \"best of a bad set\" reading, not a hidden upgrade.",
    "No ground truth exists for \"the correct mix\". Zorq's falsification (Challenge the Plan, triangulation, percentiles, control cases) tests internal consistency, and the Without-Qloo view tests what evidence contributed — it cannot validate against an unmeasured real world.",
    "Sparse or contradictory measurement is surfaced as thin or contested and caps the evidence grade; it is never averaged away into confidence.",
    "Adaptive preference suggestions are local interaction scaffolding, not Qloo evidence or LLM-authored recommendations. A selected phrase becomes measured only if Qloo can resolve and return it during the run."
  ],
  typeNote:
    "The interface sets the results of assembly in Bricolage and the explanations in Raleway: the agent is a bricoleur, assembling a place from the cultural fragments Qloo returns, while the code is the engineer, measuring those fragments from first principles. The pairing makes that boundary visible wherever the product speaks.",
  setupSummary:
    "Zorq runs from a public checkout: Node.js 22.19+, npm ci, configuration copied from .env.example (Qloo and DeepSeek keys are server-side only), `npm run build` and `npm start`, or `npm run dev:server` and `npm run dev:web` in development. Quality gates: npm run typecheck, npm run lint, npm test and npm run test:e2e. The Qloo integration runs through the official qloo MCP harness with a direct REST fallback for diagnostics; no keys, endpoints or credentials are embedded in source, and no Qloo responses are committed.",
  evidenceVsInference: {
    badges: [
      { badge: "[Qloo]", meaning: "Directly measured or returned by Qloo. Every [Qloo] claim traces to an evidence ID and ledger rows in the run." },
      { badge: "[Zorq heuristic]", meaning: "A deterministic product rule owned by Zorq's arithmetic — reproducible from the same normalized inputs, and documented above." },
      { badge: "[LLM]", meaning: "Model-authored interpretation, naming or narrative. It may cite only evidence IDs that exist in the run; it can create no numbers." }
    ],
    rule:
      "Evidence is measured; inference is argued. A sentence never carries more certainty than its weakest provenance layer, and a claim without an evidence ID always renders as [LLM], never [Qloo]."
  }
};

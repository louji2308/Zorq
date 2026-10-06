# ZORQ — Qloo Agentic Hackathon 2026
## Master Hackathon Intelligence, Requirements, Winner Strategy & Execution Specification
**Research cut-off:** 6 October 2026, 17:35 IST  
**Hackathon:** Qloo Agentic Hackathon  
**Official page:** https://qloo.devpost.com/  
**Primary purpose of this file:** establish the exact competition requirements, the lessons from the 2025 winners, the strategic standard Zorq should target, and a complete before/during/after execution system designed around a first-place outcome.
---
## 0. How to read this document
This file deliberately separates four kinds of information:
- **OFFICIAL** — directly verified from the current 2026 Qloo Devpost page/rules/submission configuration or current Qloo documentation.
- **WINNER EVIDENCE** — observed from the 2025 winning/honored project pages or Qloo's own winner announcement. These are facts about what those projects say they built, not objective proof that one feature caused them to win.
- **STRATEGY** — recommendation for Zorq based on the official criteria, competition evidence, and the supplied product/design specifications.
- **ASK / UNVERIFIED** — something important that should not be guessed and should be confirmed with Qloo/Devpost.
The goal is not to produce a motivational document. The goal is to make the project difficult to disqualify, difficult to misunderstand, technically difficult to dismiss, and easy for a judge to remember.
---
# 1. Executive verdict
## 1.1 What the current hackathon actually rewards
The 2026 Qloo Agentic Hackathon is not primarily asking for a pretty application that happens to call Qloo. The official challenge asks for a working software application that uses Qloo to give an agent real cultural grounding, and explicitly says that the project is wrong if it would work the same without Qloo.
The four official judging dimensions are equally weighted:
1. **Technological Implementation** — depth and skill of Qloo usage plus genuine, non-trivial implementation.
2. **Design** — complete, coherent product experience rather than a technical proof of concept.
3. **Potential Impact** — a credible real problem, real audience, and demonstrated ability to address it.
4. **Quality of the Idea** — creative, non-obvious Qloo use plus real understanding of the problem space.
There is also a **Stage One pass/fail viability gate** before the scored judging stage: the project must reasonably fit the theme and reasonably apply the required APIs/SDKs.
**STRATEGY:** Zorq should therefore be engineered as four simultaneous products:
- a serious Qloo integration;
- a finished professional product;
- a believable business workflow;
- an unmistakably non-generic use of cultural intelligence.
A technically brilliant but confusing Zorq can lose. A beautiful but shallow Zorq can lose. A clever idea without a real live Qloo dependency can lose. A complete application with a generic “location → recommendations” pattern can lose.
The winning target is **5/5 quality across all four dimensions**, not “one spectacular feature and three acceptable ones.”
---
# 2. Current 2026 hackathon facts — OFFICIAL
## 2.1 Schedule
Current official schedule:
| Event | Official time | India time (IST) |
|---|---:|---:|
| Submission period opens | Sep 30, 2026 | Sep 30, 2026 |
| Submission deadline | **Oct 30, 2026, 11:45 PM EDT** | **Oct 31, 2026, 9:15 AM IST** |
| Judging starts | Nov 2, 2026, 12:00 PM EST | Nov 2, 2026, 10:30 PM IST |
| Judging ends | Nov 16, 2026, 11:45 PM EST | Nov 17, 2026, 10:15 AM IST |
| Winners announced | around Nov 23, 2026, 3:00 PM EST | around Nov 24, 2026, 1:30 AM IST |
**Critical operational rule:** the official submission deadline is not the Zorq deadline. The Zorq internal target should be materially earlier.
**Recommended internal deadline:** Oct 28.  
**Recommended hard freeze:** Oct 29.  
**Oct 30 should be an emergency-only submission day, not the planned build day.**
Sources:
- https://qloo.devpost.com/details/dates
- https://qloo.devpost.com/rules
### Important date discrepancy found during research
The live Devpost schedule page currently shows submissions starting at **9:30 AM EDT**, while the formal rules say **9:00 AM Eastern Time** on September 30. The closing deadline is consistent at October 30, 11:45 PM Eastern. Since the opening date has already passed, this does not affect the current build plan, but it is a useful reminder that formal rules control over promotional/schedule surfaces.
---
## 2.2 Competition format
**OFFICIAL:**
- Online and public.
- $25,000 total official cash prize pool.
- First Place: $15,000, one winner.
- Second Place: $6,000, one winner.
- Third Place: $4,000, one winner.
- The current prize list contains no separate official “honorable mention” prize tier.
- Each project is eligible to win only one prize.
Source: https://qloo.devpost.com/ and https://qloo.devpost.com/rules
**Competition size:** the live Devpost page currently displays roughly **583 participants**. This is a live participant counter, not a reliable prediction of final submissions, and it can change.
That number should not be treated as the 2025 field size. Qloo's official 2025 winner announcement said **2,893 participants**.
---
# 3. The 2026 official challenge — what Qloo is actually asking for
Qloo's current challenge statement is unusually useful because it exposes the sponsor's central test:
> Build an agentic tool, an agent-powered app, or wire Qloo into an agent already built.
The key expected relationship is:
**Agent capability + Qloo cultural intelligence = an outcome materially better than generic AI.**
The hackathon description specifically positions the problem as agents being able to reason/plan/execute while remaining culturally blind. Qloo's role is to give them grounded cultural intelligence across music, film, dining, fashion, travel, and related domains.
The official submission description also says:
> If the submission would work the same without Qloo, it is the wrong project.
**STRATEGY FOR ZORQ:** never describe Zorq as “an AI place recommender.” That language collapses the project back into the exact category the hackathon is trying to move beyond.
The category Zorq should own is:
**Cultural composition intelligence for physical places.**
The unit of value is not one business.
It is:
**a set of components + the cultural relationships between them + evidence that the set belongs together here.**
---
# 4. Current submission requirements — OFFICIAL
The current 2026 submission requires all of the following:
### Required
**1. Functional demo application**
The judge needs a working application that can be used end-to-end.
**2. Public code repository**
GitHub, GitLab, or Bitbucket. It must be public and include the source code, assets, and instructions necessary for the project to run.
**3. Text description**
The submission must explain what the project does and what makes it Qloo-powered.
**4. External hosting / fully published project**
The project cannot be only local or require private access. A live web app is the lowest-friction choice for Zorq.
**5. Open-source license**
A license file must be visible/detectable in the repository, including in the repository About surface.
### Not required
**Demo video: NOT REQUIRED.**
**ZIP file: NOT required by the current submission configuration.**
**Website flag: the Devpost submission schema does not mark “website” as a mandatory deliverable because alternative hosted platforms are allowed; however, the actual rules still require a functional externally hosted demo. For Zorq, a web application remains the safest and easiest-to-test format.**
Sources:
- https://qloo.devpost.com/
- https://qloo.devpost.com/rules
### Current custom submission fields
The live Devpost submission configuration currently asks for:
| Field | Required? | Correct approach for Zorq |
|---|---|---|
| When did you begin your project? | Yes | Give the truthful project start date. Never backdate it to make the project look older/newer. |
| The public URL to your project | Yes | Live, judge-accessible Zorq URL. |
| Link to your PUBLIC code repo | Yes | Public repo with complete source + setup instructions. |
| If this was an existing project, how did you significantly upgrade/improve it to work with Qloo? | No | Leave blank if new. If existing, accurately explain the Qloo-driven transformation. |
**Important:** the exact current submission form is the authority for what is actually requested at submission time.
---
# 5. Current eligibility and rule constraints — OFFICIAL
## 5.1 Eligibility
The current rules say the hackathon is open to individuals who are at least the age of majority where they reside, teams of eligible individuals, and qualifying organizations.
The rules list geographic/other exclusions, including Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea and comprehensively sanctioned jurisdictions, plus conflicts involving sponsor/admin/judges and certain related persons or organizations.
Team participation is allowed. A team must designate an authorized representative.
Source: https://qloo.devpost.com/rules
## 5.2 New vs existing projects
The 2026 rules are different from the 2025 rules.
2026 allows:
- a newly created project; or
- a project that existed before the submission period **if it received the required Qloo integration after the start of the submission period and the entrant explains the significant update**.
This means Zorq must keep an auditable project timeline if it was based on prior work.
**STRATEGY:** maintain clean Git history from the moment the Qloo-specific work starts. The timeline should tell a believable story without manufactured commits.
## 5.3 Third-party tools/data
Third-party SDKs, APIs and datasets are permitted only when you are authorized to use them and comply with their terms/licensing.
For Zorq, maintain a clear inventory of:
- Qloo;
- LLM provider;
- map provider;
- image sources;
- UI libraries;
- fonts;
- chart/graph libraries;
- hosting provider;
- any optional search service.
Do not use assets from the internet simply because a browser can display them.
## 5.4 Intellectual property
The submission must be your/team's original work and must not violate third-party IP, privacy or other rights. Open-source components are allowed when their license conditions are followed.
The submission itself remains the entrant's IP, while the rules grant Qloo/Devpost certain rights for judging and publicity.
## 5.5 Testing requirement
The project must be available for judging and testing, free of charge and without restrictions, through the judging period.
If the site is private, login credentials must be provided. Zorq should avoid this entirely.
**STRATEGY:** assume a judge will open the link once, without contacting you, and may never retry it.
## 5.6 Judges are not obligated to fully test the application
The rules explicitly say judges are not required to test the project and may judge from the supplied materials.
This has a massive strategic implication:
**The live app must be strong, but the submission page, screenshots, copy, and README must independently communicate the winning idea.**
This is one of the strongest reasons not to treat documentation as an afterthought.
## 5.7 Post-deadline modifications
The rules restrict material changes after the submission deadline except for permitted situations/with permission.
Therefore:
**Do not submit a half-finished application assuming it can be “fixed later.”**
Submit only after the judge-facing state is frozen and reproducible.
## 5.8 Rules can change
The official rules reserve the ability to amend the rules. They also explicitly advise entrants to request written clarification if a term is ambiguous.
For anything affecting eligibility, IP, caching/storage, API-key use or submission mechanics, do not rely on assumptions.
Official hackathon manager contact listed on the current page: **ian@qloo.com**.
---
# 6. Current Qloo platform facts that materially change Zorq's build
The supplied Zorq Product Specification was written when `docs.qloo.com` could not be automatically fetched and therefore relied heavily on public hackathon repositories. Current research found an important update:
## The Qloo documentation is now publicly available in `qloo/docs-public`
The repository says it contains public Qloo API documentation plus the complete OpenAPI 3.1 specification for Qloo API v2.
Repository:
https://github.com/qloo/docs-public
This matters because the engineering team can now check current parameter behavior against Qloo's own published specification instead of relying only on old public hackathon repositories.
**Action:** make current Qloo OpenAPI the Day-1 engineering authority and re-run the existing Zorq API spike against it.
Source: https://github.com/qloo/docs-public
---
# 7. Qloo capabilities that Zorq should exploit deeply
Current Qloo documentation and product pages expose a much broader system than “search for a place.” Relevant capabilities include:
### 7.1 Entity search / resolution
Turn human concepts or entity names into valid Qloo IDs/tags that can become signals.
### 7.2 Taste intelligence
Combine entities/interests and observe the cultural relationships implied by the combination. Qloo explicitly states that changing the combination can change rankings rather than producing a fixed popularity list.
### 7.3 Locality intelligence
Read cultural character at different geographic scales, including point/block/neighborhood/city-style contexts, and connect taste to location.
### 7.4 Heatmaps / geographic affinity
Useful for the site-read phase and visual context, but not distinctive enough to be Zorq's main idea. Qloo itself demonstrates locality/heatmap-style experiences.
### 7.5 Explainability
The current public Insights API documentation says `feature.explainability=true` can return explanation metadata for recommendations and the overall result set, including which input entities contributed to a result with normalized influence values when explainability can be computed.
This is valuable for Zorq because the product is built around receipts rather than unsupported prose.
### 7.6 Supporting lookup and analysis APIs
The current public docs describe entity search, entity search by ID, audience lookup, tag search, tag types, analysis, comparison, trending information and other supporting routes around the core Insights API.
Sources:
- https://github.com/qloo/docs-public
- https://github.com/qloo/docs-public/blob/main/reference/api-overview.md
- https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md
- https://www.qloo.com/capabilities
---
# 8. One major competitive warning: Qloo itself already demonstrates combinations and locality
Qloo's current public site demonstrates:
- combining multiple tastes and observing the resulting cultural context;
- locality intelligence and map-based cultural concentration;
- cross-domain cultural enrichment;
- agent/LLM grounding.
Therefore Zorq cannot win merely by showing:
- “enter a location”;
- “see a heatmap”;
- “get cultural tags”;
- “show cross-domain recommendations.”
Those are useful building blocks, but they do not define the novel product.
**The Zorq differentiator must remain one abstraction above those primitives:**
> **Design, test and revise a culturally coherent composition of multiple place components, with a visible pre-Qloo hypothesis, measured relationships, falsification, constraints and evidence receipts.**
Source: https://www.qloo.com/
---
# 9. What your three Zorq files already establish
The supplied files form a coherent product direction, with a few important corrections that this master file preserves.
## From Idea.md
The core problem is not “find one good place/business.” It is the composition problem:
**A + B + C + D → does the ecosystem make cultural sense here?**
The product output is a **Place Blueprint**.
The intended architecture is:
**Agent hypothesis → Qloo investigation → evidence → evaluation → hypothesis mutation → Qloo investigation → final composition**
not:
**LLM → Qloo → list of recommendations.**
## From Product Specification v1
The stronger version introduces:
- Prior Lock;
- Shared-Culture Graph;
- triangulation;
- a null-model percentile;
- local-vs-city distinctiveness;
- Challenge the Plan;
- Without-Qloo comparison;
- explicit provenance badges;
- constraint adaptation;
- a Blueprint as the final deliverable;
- a robust error/recovery model.
It also correctly removes or downgrades several risky ideas from the earlier draft:
- no fake Qloo “combination score”;
- no single magical 0–100 score;
- no pretending Qloo directly scores a combination when the application actually computes the combination metric;
- no trend claims unless actually supported;
- analogs/backtesting only as stretch features.
## From Final_design.md
The design system is intentionally unlike the common dark/purple AI dashboard:
- black ink on white;
- architectural-drawing grammar;
- colour reserved for evidence imagery;
- line/shape/contrast semantics for confidence/status;
- an Agent Ledger that exposes specific work;
- a prior-to-final “re-inking” moment;
- a blueprint that reads like a professional artifact.
The design file's central sentence is essentially:
**Colour means real. Line weight means how sure. The first guess is never hidden.**
These are not hackathon rules; they are Zorq's product/design strategy.
File-grounded references:
- Product Specification hard facts: `Product Specification(1).md` lines 15–25.
- Zorq problem definition: `Idea(1).md` lines 5–19.
- Zorq output: `Idea(1).md` lines 43–47.
- Design concept: `Final_design(1).md` lines 11–17.
---
# 10. 2025 Qloo LLM Hackathon — what actually won
The 2025 event is the best available historical signal because it is the immediate predecessor and had the same sponsor, same cultural-intelligence foundation and a similar judging ecosystem.
## Official 2025 winner announcement
Qloo's official announcement reported **2,893 participants** and highlighted four recognized projects:
- **1st place — GeoTaste — $10,000**
- **Honorable Mention — Alloy — $5,000**
- **Honorable Mention — Resonance AI — $5,000**
- **Honorable Mention — Zesty — $5,000**
Source: Qloo's official LinkedIn announcement  
https://www.linkedin.com/posts/qloo_hackathon-culturalintelligence-aiinnovation-activity-7370873373666549760-4W2g
The 2025 Devpost page shows a slightly different live participant count (around 2,855–2,851 depending on the Devpost surface crawled). The sponsor's official announcement is the stronger source for the 2,893 figure.
---
# 11. Winner #1 — GeoTaste
**Position:** 2025 Grand Prize winner.
**Problem:** location-driven business intelligence. The product framed an AI agent as a business consultant that could turn location context into market/business insights.
**Qloo's role:** cultural/business location intelligence was central to the product rather than a cosmetic recommendation call.
**Product characteristics observed from its Devpost page:**
- React + Vite frontend;
- Flask/Python backend;
- Qloo;
- GPT-4/OpenAI;
- Mapbox location search;
- Railway deployment;
- many visualizations (the project page claims 13+ Plotly charts);
- business-oriented analysis rather than a toy recommendation list;
- explicit handling of production issues, caching, loading/error states and deployment.
The project also provided a live URL and public GitHub repository.
**Why it matters for Zorq:**
GeoTaste proves that the winning bar is not simply “we called Qloo.” The product must turn Qloo into useful business intelligence and present that intelligence in a complete interface.
**What Zorq should take:**
- real-world business framing;
- map/context as useful input, not decoration;
- multiple evidence views;
- a complete deployed application.
**What Zorq should not copy:**
- generic business dashboard structure;
- “location → charts” as the core novelty.
Source: https://devpost.com/software/geotaste-your-agentic-qloo-taste-business-consultant
---
# 12. Winner #2 — Alloy
**Position:** 2025 Honorable Mention.
**Problem:** cultural due diligence for mergers/acquisitions. The project argued that financial transactions can fail because of cultural/audience mismatch.
**Agent pattern:** a ReAct-style loop:
**Reason → Act → Observe → continue reasoning.**
**Qloo integration:** the page describes multiple Qloo strategies, including cultural proxy analysis for broad brands and fallback behavior when queries return weak data.
**Productization:**
- compatibility scoring;
- culture-clash report;
- synergy analysis;
- audience expansion analysis;
- chat;
- professional PDF reports;
- responsive UI;
- backend/frontend separation;
- database;
- deployment.
**Key lesson:** Alloy did not stop at a model answer. It turned the Qloo/LLM system into a professional decision product.
**What Zorq should take:**
- real stakes;
- iterative agent behavior;
- Qloo-specific resilience;
- professional final artifact;
- transparent architecture.
**What Zorq should improve on:**
Zorq should avoid a single headline score unless that score is extremely defensible. The current Product Specification's relative readings + evidence-grade model is stronger and more honest.
Source: https://devpost.com/software/axiom-2bn391
---
# 13. Winner #3 — Resonance AI / Resonance Engine
**Position:** 2025 Honorable Mention.
**Problem:** cultural intelligence for political/campaign strategy and audience connection.
**Observed implementation patterns:**
- Qloo wrapper;
- LLM/agent layer;
- geographic targeting/heatmap functionality;
- streamed UI behavior;
- error/fallback handling;
- deployment to hosted services;
- emphasis on cultural fit rather than purely generic generation.
The project page explicitly discusses the difficulty of obtaining a Qloo API key, streaming model output and building a feature-rich application under time pressure.
**Key lesson:** a constrained builder can still produce a recognized project if the technical core, Qloo integration and user-facing story are coherent.
**What Zorq should take:**
- explicit streaming/progress;
- robust error handling;
- real cultural inference rather than a Qloo badge;
- complete workflow.
Source: https://devpost.com/software/resonance-engine and https://devpost.com/software/resonance-ai-1hjbf0
---
# 14. Winner #4 — Zesty
**Position:** 2025 Honorable Mention.
**Problem:** recommendation systems reinforce taste bubbles. Zesty created an “Unrecommendation Engine” designed to move users toward culturally distant choices.
**Qloo role:** it was used to find taste-space alternatives/opposites instead of simply more of the same.
**Product characteristics:**
- short taste journey/onboarding;
- distinct product concept;
- React + Tailwind + Next.js;
- Supabase;
- Gemini;
- Qloo;
- simple/playful interface;
- explicit attempt to solve a psychological problem rather than merely retrieve entities.
**Key lesson:** Qloo becomes memorable when the application uses it to change the meaning of the task, not merely improve ranking.
Zesty is a strong argument for Zorq's “composition rather than recommendation” leap.
Source: https://devpost.com/software/zesty-flwi5e
---
# 15. The common pattern across the 2025 recognized projects
These projects are different, but several structural patterns repeat.
## Pattern A — high-stakes or highly understandable user problem
- GeoTaste: business/location decisions.
- Alloy: M&A cultural risk.
- Resonance AI: campaign intelligence.
- Zesty: recommendation fatigue / discovery.
**Zorq implication:** use a believable placemaking/venue/tenant-mix decision, not “AI generates cool places.”
## Pattern B — Qloo changes the actual task
The strongest projects do not merely append Qloo after an LLM response. Qloo changes what the agent can know or what the product is able to decide.
**Zorq implication:** make the absence test explicit.
## Pattern C — complete product surface
Recognized projects tend to have:
- working frontend;
- backend or substantial processing layer;
- deployment;
- clear onboarding/entry point;
- results;
- error handling;
- some share/export/report mechanism.
**Zorq implication:** a notebook, one chat panel or one API call is nowhere near the desired bar.
## Pattern D — memorable framing
“Business consultant.”  
“Cultural due diligence engine.”  
“Unrecommendation engine.”  
“Cultural resonance.”
**Zorq implication:** the product category and phrase must be obvious.
## Pattern E — agentic behavior is visible or structural
Reason/action loops, intermediary steps, dynamic query planning, or an explicit process help distinguish an agent from a static recommender.
**Zorq implication:** the Agent Ledger must show meaningful decisions, and the LLM must actually choose or mutate some probes rather than simply narrate fixed code.
## Pattern F — the technical details are not hidden
The winning/honored project pages explain tech architecture, challenges and implementation.
**Zorq implication:** README + `/method` + ledger are competitive assets, not documentation chores.
---
# 16. Where Zorq is already stronger than a generic Qloo project
Zorq has a strategically strong abstraction:
### Generic Qloo project
**Person/location → recommended things**
### Zorq
**Place → cultural structure → component candidates → inter-component relationships → competing compositions → stress tests → blueprint**
This is a meaningful jump because the output is a **system of relationships**, not a ranked list.
The strongest internal sentence is:
> **Zorq shows what the agent believed before it looked, what Qloo changed, and what happened when it tried to break its own answer.**
That sentence should survive every future redesign.
---
# 17. The exact Zorq “winner architecture”
The recommended production architecture should remain:
```text
USER BRIEF
   ↓
PRIOR LOCK (LLM only, frozen)
   ↓
SITE READ
   ├─ Qloo locality / geographic signals
   └─ Qloo anchor discovery
   ↓
CULTURAL DNA
   ├─ local signals
   ├─ cross-domain entities
   └─ local vs city comparison
   ↓
CANDIDATE POOL
   ├─ place categories / tags
   ├─ exemplar places
   └─ provenance path
   ↓
MEASUREMENT ENGINE
   ├─ per-component taste neighborhoods
   ├─ shared-culture edges
   ├─ popularity suppression / IDF weighting
   └─ distinctiveness
   ↓
COMPOSITION SEARCH
   ├─ role-valid subsets
   ├─ exact null-model percentile
   └─ Prior + 3 competing hypotheses
   ↓
STRESS TEST
   ├─ ablation
   ├─ substitution
   ├─ bridge
   ├─ catchment shift
   └─ rival check
   ↓
CONSTRAINT FIT
   ├─ area
   ├─ operating hours
   ├─ noise
   └─ role-preserving format downshift
   ↓
BLUEPRINT
   ├─ rationale
   ├─ composition
   ├─ receipts
   ├─ risks
   ├─ Prior → Final diff
   └─ Without-Qloo proof
```
The intended responsibility split is:
### Qloo = measurement / cultural grounding
### Code = arithmetic / validation / constraint mechanics
### LLM = interpretation / probe selection / mutation / explanation
This division is important. Letting the LLM invent numerical scores or “evidence” weakens Technical Implementation and can undermine credibility with a technical judge.
---
# 18. What must be proven before serious UI work begins
Do not spend the first several days polishing screens before answering these six technical questions.
## Spike 1 — Are shared-culture edges non-degenerate?
Take approximately 8 sites and approximately 8 component categories.
Build the taste neighborhoods and calculate relationships.
**PASS:**
- edges have useful variation;
- different sites produce meaningfully different relationships;
- local vs city reads differ;
- the relationship structure is not explained almost entirely by popularity.
**FAIL:**
If every component becomes strongly connected simply because cafés, restaurants, artists or films are popular, the current edge model is not defensible.
**Fallback:** make the triangulation route the primary evidence path, reduce claims, and use a more conservative graph representation.
## Spike 2 — Can target place concepts resolve cleanly?
Test categories such as:
- independent cinema;
- listening room/listening bar;
- design shop;
- gallery;
- bookstore;
- workshop/maker space.
**PASS:** approximately 80% usable resolution or better.
**FAIL:** use entity/exemplar clustering rather than pretending natural-language category tags map cleanly.
## Spike 3 — Can the full run complete at an acceptable latency?
Measure real live runs, not local mock timing.
Test with concurrency in the intended range and record:
- p50 latency;
- p90 latency;
- Qloo call count;
- LLM call count;
- rate-limit events;
- retries;
- time to first meaningful artifact.
**Target:** first useful visible artifact quickly, followed by progressive enrichment.
The design file uses the classic response-time idea that past roughly 10 seconds without meaningful feedback attention degrades. Treat this as UX guidance, not an official hackathon threshold.
## Spike 4 — Does Qloo return usable affinity/explainability signals?
Test:
- affinity presence;
- rank stability;
- explanation metadata when requested;
- repeated-call consistency.
If raw affinity is absent or not comparable, the system needs an explicit rank-based fallback.
## Spike 5 — Can you produce two divergent presets and one honest control?
This is critical.
You want:
- **Preset A:** Qloo materially changes the prior.
- **Preset B:** Qloo materially changes the prior in a different way.
- **Preset C:** Qloo largely confirms the prior.
The third preset is not weaker. It is essential evidence that Zorq does not manufacture divergence just to create a flashy before/after.
## Spike 6 — Storage/caching/key-lifetime rules
This is currently the most important item that should **not** be guessed.
Get written clarification on:
- whether Qloo output may be cached;
- for how long;
- whether raw responses may be persisted;
- whether entity IDs may be stored;
- whether derived metrics may be stored;
- whether preset evidence can be pre-warmed;
- whether the hackathon API key remains valid during judging after submission.
Until clarified, the conservative architecture is:
- short-lived in-memory cache;
- store minimal derived Zorq run state;
- avoid bulk persistence of raw Qloo output;
- never expose the API key client-side.
This is a **precaution, not a claim about the final allowed policy**.
---
# 19. Technical requirements for a first-place-quality implementation
## 19.1 Real agent behavior
The agent should make at least some decisions based on observations.
Examples:
- choose which anchor places are representative;
- identify the weakest graph edge;
- choose which stress attack is most valuable;
- decide whether to search for a bridge component;
- decide when to widen catchment;
- decide whether a candidate should be replaced.
A static pipeline wrapped in “agent” language is weaker than a genuine observation → decision → tool → observation loop.
## 19.2 Prior Lock must be write-once
Before any Qloo cultural evidence is available, the system stores:
- the initial brief;
- the LLM-only prior composition;
- generation time;
- model identifier;
- “no Qloo data used” status.
Never overwrite it.
The final comparison becomes scientifically meaningful only if the prior is genuinely frozen.
## 19.3 Every evidence-backed claim needs an evidence ID
Recommended object model:
```text
EvidenceRecord
- id
- qloo_endpoint
- request_summary
- input_entity_ids
- result_entity_ids
- raw_result_reference / permitted cache reference
- result_count
- explainability metadata when available
- timestamp
- cache_state
- status
```
Then every generated explanation references these IDs.
The writer layer must not invent an evidence ID that is absent from the run.
## 19.4 No fabricated Qloo confidence
Bad:
> “Qloo rates this ecosystem 91/100.”
Good:
> “Zorq's coherence reading places this composition above 91% of valid combinations in this candidate pool, based on the defined graph calculation.”
Bad:
> “Qloo recommends a cinema + café + gallery.”
Good:
> “Qloo evidence contributed these locality/taste relationships; Zorq's reasoning layer assembled them into this composition.”
## 19.5 Shared-culture graph
A candidate component is represented through its taste neighborhood.
The proposed model is:
- build a weighted entity vector for each component;
- down-weight entities that appear around nearly everything in the candidate pool;
- calculate pairwise similarity;
- interpret the resulting similarity as a relative cultural relationship, not an absolute demand score.
The current Product Specification uses IDF-weighted cosine similarity for this purpose.
## 19.6 Exact null model
For a pool of K components, enumerate all role-valid subsets of the same size.
For K≈10 and 5-member compositions, this is manageable: at most 252 subsets before role/constraint filtering.
Then say:
> “This composition is more coherent than X% of valid combinations from this pool.”
This is stronger than an arbitrary 0–100 score because the reference distribution is explicit.
## 19.7 Distinctiveness
A coherent composition can still be generic.
Measure the difference between local and city taste neighborhoods for each component.
This addresses the popularity trap.
The product should be able to say, in effect:
> “This is not merely popular. This component behaves unusually in this place.”
## 19.8 Triangulation
Do not depend on one Qloo measurement route for the strongest graph edges.
For finalist relationships, use an independent route and classify the result:
- confirmed;
- contested;
- thin;
- failed/unmeasured.
This makes the graph more defensible.
## 19.9 Stress testing
The leader should have to survive attacks.
### Ablation
Remove one component.
Question:
> Does the composition materially degrade?
### Substitution
Replace one component with a plausible same-role candidate.
Question:
> Is the current member uniquely valuable, or merely adequate?
### Bridge
Find a component whose audience can connect two weakly linked members.
Question:
> Can the weak relationship be repaired by inserting a cultural bridge?
### Catchment shift
Widen/narrow the spatial scope.
Question:
> Does the composition remain coherent when the geographic assumption changes?
### Rival check
Vary the familiar-vs-distinctive preference weight.
Question:
> Does another composition become the leader under a reasonable alternative preference weighting?
A mature system should be able to say that it is fragile.
That is better than fake certainty.
---
# 20. Product requirements by screen
## S0 — Brief
The screen must immediately communicate:
**“Zorq designs what should exist together on a site.”**
Input:
- address/place;
- optional site area;
- goal/objective;
- constraints;
- optional places the user admires.
Presets should be prominent because a judge must be able to understand the product in one click.
## S1 — Investigate
Hero elements:
- map/site context;
- frozen Prior;
- Agent Ledger;
- Cultural DNA.
Ledger row should expose:
- Qloo / Compute / LLM role;
- what happened;
- useful result summary;
- endpoint/request summary;
- cache/live status;
- timing;
- expandable technical detail.
Never write:
> “AI is thinking…”
Prefer:
> “Testing whether the local cinema audience shares stronger affinity with independent music than the city baseline.”
The work itself becomes the explanation.
## S2 — Compositions
Show:
- frozen Prior;
- three competing compositions;
- coherence percentile;
- distinctiveness;
- weakest link;
- evidence grade.
Do not show a fake combined score.
The “Familiar ↔ Distinctive” dial is an optional but valuable interaction if time permits.
## S3 — Graph
The graph should answer:
> Why do these components belong together?
Clicking an edge should expose:
- the two components;
- the shared cultural entities;
- the measurement route;
- whether triangulation agrees;
- the relevant ledger calls.
If the graph becomes visually dense, provide the distance/edge-list fallback from the design spec.
## S4 — Challenge the Plan
This is one of the most strategically valuable Zorq screens.
The agent attacks its own leader.
The verdict must be one of:
- Survived;
- Revised;
- Replaced.
Never hide a failed attack. Mark it as not measured and downgrade the evidence grade accordingly.
## S5 — Blueprint
The final artifact should contain:
1. Title + rationale.
2. Component composition by role.
3. Evidence receipts.
4. Area/hours/operating fit.
5. What Qloo changed.
6. Risks and weak links.
7. Evidence grade.
8. Method link.
9. Share/copy/print options.
The Blueprint is not an “AI summary.” It is the product's actual decision artifact.
---
# 21. The most important visual proof: Without Qloo
Zorq's highest-value single comparison should be:
### Prior
What the agent believed before cultural evidence.
### Final
What it chose after measurement and stress.
### Why it changed
Specific evidence-backed mutations.
The comparison must be honest.
If Qloo does not change the composition for a control case, show:
> “Qloo confirmed rather than redirected the prior.”
This is much more credible than designing the system to force a flashy difference.
This also directly operationalizes the hackathon's “would this work the same without Qloo?” requirement.
---
# 22. Design strategy for the judge experience
The supplied design research correctly identified the consequence of the no-video requirement: the application itself has to teach the judge.
Current official rules allow judges to rely on submission materials rather than fully testing, so Zorq should target a self-explanatory first minute.
## The first 60 seconds should feel like this
**0–5 seconds**
The landing composition is already fully formed. No distracting skeleton. No giant blank loading state.
**5–15 seconds**
The judge understands:
- this is about designing what belongs together;
- it is for a real place;
- the map and presets make it obvious how to begin.
**15–30 seconds**
A preset is clicked. The Prior appears quickly.
The judge now has a question:
> “Is the AI going to change its mind?”
**30–60 seconds**
The ledger fills with specific Qloo/agent actions, the map becomes evidence-rich, and real cultural entities appear.
The product now has an observable plot.
---
# 23. What the 2025 winner pattern says about Zorq's demo
The old 2025 event required a sub-three-minute video. The current 2026 event does not.
This distinction matters.
**Do not optimize Zorq around a video requirement that no longer exists.**
However, a short private/public optional video is still useful as a judge-acceleration asset and social proof.
It should be treated as:
**Bonus asset, not eligibility requirement.**
There is no official evidence that the 2026 hackathon awards bonus points for making a video.
---
# 24. Optional demo video — recommended “winner cut”
## Target duration
**2:30–2:50** is recommended.
Do not state that 2:50 is an official requirement. It is a strategic recommendation based on the fact that the 2025 event capped video attention at three minutes and on the practical advantage of a judge being able to understand the product rapidly.
## Video structure
### 0:00–0:08 — The problem
Visual: a site/blank map + mixed-use brief.
Voiceover/text:
> “Most planning tools can tell you what places exist here. Zorq asks what should exist here together.”
### 0:08–0:20 — Start the run
Show a real preset.
One click.
### 0:20–0:35 — Prior Lock
Show the first composition before Qloo.
Make “No cultural evidence used” visible.
### 0:35–1:00 — Qloo investigation
Show:
- locality read;
- anchors;
- DNA;
- ledger.
Do not montage everything. Show two or three specific decisions.
### 1:00–1:25 — The change
Reveal:
**Prior → Final**
Show one unexpected added component and one removed/reformatted component.
### 1:25–1:45 — Why the components belong together
Open an edge.
Show shared cultural entities and Qloo provenance.
### 1:45–2:10 — Challenge the Plan
Run at least one strong attack.
The best outcome is not always “survived.” A revision can be more impressive because it shows the agent actually changed.
### 2:10–2:30 — Blueprint
Show:
- final composition;
- evidence receipts;
- constraints;
- risk;
- evidence grade.
### 2:30–2:50 — Without Qloo
Open the comparison.
Show the counterfactual.
Close with:
> **“Zorq doesn't ask what should go here. It asks what should exist here together.”**
## Video production rules — safest approach
- Use only assets you have permission to use.
- Avoid unlicensed copyrighted music.
- Do not include third-party proprietary media merely for atmosphere.
- Keep narration focused on the product.
- Never stage a fake Qloo response and present it as live evidence.
- If a result is cached, label it honestly.
- If a part of the video uses a preset rather than a fresh query, make that clear in the accompanying documentation if relevant.
The 2025 rules explicitly restricted copyrighted music/trademarks in videos. The current 2026 rules contain broader IP requirements, so the conservative production practice is still the correct one.
Historical source: https://qloo-hackathon.devpost.com/rules
---
# 25. “Bonuses” that are actually useful
There is **no verified official bonus-point feature list** in the current 2026 hackathon materials.
Therefore, the word “bonus” here means **strategic judge delight**, not official scoring bonus.
## Bonus 1 — Honest control case
Most builders show only “AI changed everything.”
Zorq should also show:
> “Qloo confirmed the original hypothesis here.”
This demonstrates scientific honesty.
## Bonus 2 — Judge-verifiable preset
Create one preset in a location/cultural context that an experienced judge is likely to recognize.
The goal is not celebrity geography. The goal is:
> “I have an intuition about this place, and the product gives me something I can inspect.”
This is a strategy recommendation, not an official judging requirement.
## Bonus 3 — Evidence drawer with real provenance
A judge should be able to go from:
**claim → Qloo evidence → entity → calculation → ledger row.**
## Bonus 4 — Method page
A serious technical judge should be able to see:
- definitions;
- equations;
- fallback rules;
- known limitations;
- what is Qloo vs Zorq vs LLM;
- what is heuristic.
## Bonus 5 — Fresh-clone repo test
An untouched machine should be able to clone the repository, install, configure environment variables and run the project from the README.
## Bonus 6 — Shareable Blueprint
A judge can see a finished artifact without rerunning the entire process.
## Bonus 7 — Print-quality Blueprint
This fits the architectural drawing language and creates a tangible “artifact” feeling.
## Bonus 8 — Held-out backtest
As a stretch feature, hide one known category in several successful districts, let Zorq infer the missing role/category, and compare against a popularity baseline.
Do not invent a success percentage in advance. Let the test produce the result.
---
# 26. Features to resist even if they look impressive
The supplied Product Specification is right to remove these unless they become essential:
## Do not make chat the main interface
Chat is easy to build and easy to forget.
## Do not use one “magic” 0–100 score
It creates invented precision.
## Do not add accounts
They add friction and attack surface without helping the judging criteria.
## Do not build a listings marketplace
It pulls Zorq back toward generic place discovery.
## Do not build financial pro-formas
Lease economics are outside what Qloo can truthfully support in this hackathon concept.
## Do not claim trends unless supported
Current Qloo docs have trend/analysis capabilities, but a trend claim should exist only if the data path and semantics have actually been implemented and tested.
## Do not build a multi-agent swarm just to say “multi-agent”
A clean single orchestrator with meaningful tool decisions is stronger than decorative agent proliferation.
---
# 27. Technical anti-cheating / anti-hallucination rules for Zorq
These are product-quality rules, not organizer rules.
### Rule 1
Unknown Qloo entity → never display as a confirmed entity.
### Rule 2
No evidence ID → never show `[Qloo]` provenance.
### Rule 3
Failed Qloo call → record failure; do not synthesize evidence.
### Rule 4
Sparse dataset → downgrade the evidence grade.
### Rule 5
Conflicting routes → show “contested”; do not average away the conflict.
### Rule 6
Qloo outage → preserve the Prior, explain the failure, provide retry.
### Rule 7
Zero-result 200 response → treat it as a query failure condition, not success.
### Rule 8
Client must never receive the Qloo API key.
### Rule 9
Numerical metrics are deterministic code, not LLM prose.
### Rule 10
The LLM may explain only what the run evidence permits it to explain.
---
# 28. Red-team test suite before submission
Run all of these against the deployed app.
| Test | Expected behavior |
|---|---|
| Ambiguous address | Require map selection; do not fabricate location. |
| No Qloo result | Explain that evidence is thin/absent. |
| Qloo 429 | Retry with visible status; reserve calls for finalists. |
| Qloo timeout | Recover or show partial run. |
| Qloo outage | Stop safely with Prior + explanation. |
| Component unresolved | Mark unmeasured; do not let it win. |
| Contradictory evidence | Show contested state. |
| Very small site | Downshift formats; preserve role where possible. |
| Very large site | Ensure candidate composition does not become meaningless. |
| User unpins anchor | Recompute affected cultural read. |
| User replaces a member | Recalculate composition metrics; run a mini-stress. |
| Browser refresh | Run state remains coherent/resumable. |
| Browser back | No dead end. |
| Share URL | Read-only state works or clearly explains expiry. |
| Mobile 360 px | Layout remains usable. |
| Keyboard-only | Core path remains usable. |
| 200% zoom | Core distinctions remain readable. |
| Slow network | No catastrophic blank screen. |
| LLM returns invented tag | Strip/flag it. |
| Preset is rerun repeatedly | Does not exhaust quota unexpectedly. |
| Fresh clone | README is sufficient to run locally. |
| Incognito | Demo works without prior browser state. |
| No cookies/localStorage | Core preset flow still works. |
| Different timezone | No date/time logic breaks. |
| Old cached run | Cache state is clearly represented. |
---
# 29. Submission-page strategy
The Devpost page must answer four questions in the first few lines:
### 1. What problem is being solved?
Not “real estate is hard.”
Use a concrete decision:
> Developers and placemakers can list businesses that fit a site individually, but they lack a way to test whether the *combination* of cultural components belongs together in the local audience context.
### 2. What does Zorq do?
> Zorq is an autonomous cultural composition agent that uses Qloo's cultural and locality intelligence to build, measure, challenge and revise a place's proposed ecosystem.
### 3. What makes Qloo indispensable?
State exactly what disappears without Qloo:
- cultural relationship edges;
- local-vs-city distinctiveness;
- evidence-grounded component provenance;
- meaningful Prior → Final divergence.
### 4. What is the product output?
**A tested Place Blueprint.**
Do not bury the output under implementation details.
---
# 30. Recommended Devpost description structure
Use this structure when writing the final submission:
## One-line hook
**Design what should exist together on a site — not just what is nearby.**
## Problem
Describe tenant-mix/placemaking uncertainty.
## Why existing AI fails
Generic LLMs produce plausible median categories and cannot measure local shared culture.
## What Zorq does
Prior Lock → Qloo investigation → Cultural DNA → candidate pool → composition search → stress test → Blueprint.
## Why Qloo matters
Explain the actual Qloo calls/measurements used.
## What the agent does
Describe adaptive probe selection and self-challenge.
## Proof of difference
Include a concrete Prior vs Final change.
## Technical implementation
List the actual architecture and Qloo interaction.
## Trust / limitations
State what is Qloo, what is Zorq-computed, and what remains heuristic.
## Impact
Name the real buyer/user:
- placemaking team;
- mixed-use developer;
- mall/high-street operator;
- venue group;
- cultural district planner.
Do not make all of them the primary customer in the opening paragraph. Choose one anchor persona for the demo.
---
# 31. README requirements for a winning-level repository
The repository README should contain:
## Above the fold
- Zorq name;
- one-line problem;
- one-line solution;
- live demo link;
- screenshot/GIF if useful;
- setup status;
- license.
## Product
- what it does;
- target user;
- core workflow.
## Why Qloo
A concrete “without Qloo” section.
## Architecture
Simple diagram:
```text
Brief
  ↓
Prior Lock
  ↓
Qloo tools
  ↓
Measurement engine
  ↓
Agent reasoning
  ↓
Stress tests
  ↓
Blueprint
```
## Qloo integration table
| Capability | Zorq use | Evidence surfaced |
|---|---|---|
| Entity resolution | Resolve component/entity inputs | Qloo ID/path |
| Locality | Build site context | locality/heatmap result |
| Taste intelligence | Build cultural neighborhoods | entity relationships |
| Insights | Measure candidate relevance | ranking/affinity |
| Explainability | Receipt-level explanation | influence/provenance when available |
| Supporting lookup | Search tags/entities | resolved IDs |
## Local run
- prerequisites;
- environment variables;
- install;
- run;
- test;
- troubleshooting.
## Deployment
- hosted URL;
- environment configuration;
- health check;
- fallback mode.
## Method
Link to the `/method` page and/or reproduce the essential formulas.
## Limitations
Be direct:
- catalog coverage;
- heuristic formats;
- relative coherence;
- no claim of demand/revenue;
- no ground truth for “correct mix.”
## License
Keep the license file at the repository root.
---
# 32. Evidence and provenance model in the UI
Use three provenance badges:
### `[Qloo]`
The claim is derived directly from a Qloo result.
### `[Zorq heuristic]`
The claim comes from deterministic product heuristics such as footprint ranges, operating hours profiles or role classification.
### `[LLM]`
The claim is interpretation, naming, summarization or reasoning by the language model.
This three-way split is powerful because it lets a judge ask:
> “Which part of this statement is measured?”
and get an answer without opening the source code.
---
# 33. The “Qloo is indispensable” test that every Zorq build must pass
Run the same brief through two controlled conditions:
### Condition A — Zorq + Qloo
Full workflow.
### Condition B — Zorq without Qloo
Same initial brief.
No cultural evidence.
Then compare:
- component membership;
- ordering;
- graph relationships;
- rationale;
- evidence coverage;
- final blueprint.
The goal is not to maximize divergence.
The goal is to demonstrate that Qloo provides information the rest of the system genuinely cannot generate on its own.
If Condition A and B are identical for a preset, that is a signal to use a different preset for the main story — while retaining the identical/control case somewhere else.
---
# 34. Internal measurement dashboard — STRATEGY, not official scoring
Before submission, maintain an internal scorecard.
| Internal metric | Target |
|---|---:|
| Qloo-dependent final members | As high as honestly justified |
| Final member evidence coverage | ~100% measured/identified or explicitly marked heuristic |
| Final edge evidence coverage | High; finalists triangulated where feasible |
| Qloo removal produces meaningful difference on main preset | Yes |
| Control preset remains reasonably stable | Yes |
| Unknown entities displayed as confirmed | 0 |
| Fake evidence IDs | 0 |
| Secret exposure | 0 |
| Live demo access failures | 0 |
| Fresh-clone setup failures | 0 |
| Critical browser console errors | 0 |
| Submission-field omissions | 0 |
For the four official judging dimensions, perform an internal 1–5 simulation.
### Technological Implementation
Ask:
- Is Qloo used deeply?
- Is the integration multi-step/non-trivial?
- Is the code resilient?
- Is Qloo evidence visible?
- Can a Qloo engineer trace the call path?
### Design
Ask:
- Does every screen have a purpose?
- Is the first minute understandable without narration?
- Are error states designed?
- Does the product look intentional rather than generated?
### Potential Impact
Ask:
- Can a real user be named?
- Is the workflow a real professional decision?
- Would the result change a real choice?
- Is there a believable path beyond the hackathon?
### Quality of Idea
Ask:
- Is the core abstraction clearly non-obvious?
- Would another team naturally think “location → restaurants”? If so, Zorq must make its composition layer more explicit.
- Does Qloo change the nature of the task?
---
# 35. Exact timeline from October 6 to October 30
This is the recommended schedule, not the official schedule.
## October 6 — Day 1: compliance + Qloo truth
Finish immediately:
- register if not already registered;
- confirm eligibility;
- obtain Qloo key;
- read current rules;
- clone current Qloo hackathon kit;
- inspect current public Qloo OpenAPI;
- create public repository;
- add license;
- create `.env.example` without secrets;
- establish project start date honestly;
- create issue list;
- send organizer clarification on caching/storage/key lifetime if needed.
Start Spike 1–6.
## October 7 — Day 2: kill/continue decisions
Do not “keep coding because it feels productive.”
Decide:
- edge model passes or falls back;
- category resolution passes or changes strategy;
- latency acceptable or pool shrinks;
- affinity usable or rank fallback;
- three presets found or not;
- caching policy clarified or conservative mode used.
At the end of Day 2, write a short engineering decision memo.
## October 8–12 — Headless engine
No major UI polish.
Build:
- orchestrator;
- Qloo client;
- evidence records;
- cache/rate limiting;
- Prior Lock;
- DNA;
- candidate pool;
- measurement engine;
- graph;
- null model;
- stress operations;
- constraint fit.
Unit-test the calculations.
## October 13–18 — Product core
Build S0–S3:
- brief;
- investigation workspace;
- ledger;
- compositions;
- graph;
- evidence drawer.
Run design tests as soon as S2 exists.
## October 19–22 — Final workflow
Build S4–S5:
- Challenge the Plan;
- verdict state;
- Blueprint;
- Prior-vs-Final diff;
- Without-Qloo view;
- shareable blueprint.
## October 23–25 — High-value stretch only
Prioritize:
1. Replace interaction;
2. distinctiveness dial;
3. stronger triangulation;
4. carefully validated analogs;
5. held-out test.
Do not add anything that risks the MVP.
## October 26–28 — Hardening
Freeze feature development.
Complete:
- deployment;
- error states;
- README;
- `/method`;
- license visibility;
- screenshots;
- optional video;
- clean-browser testing;
- mobile testing;
- fresh-clone testing;
- API rate-limit test;
- secret scan;
- Devpost draft.
## October 29 — Submission freeze
Perform the final judge simulation.
Open the project exactly as a stranger would.
Do not use your browser's old cached state.
Do not explain anything manually to yourself.
Ask:
> “Could a judge discover the story without me?”
If not, fix the story.
## October 30 — Emergency buffer
Use only for:
- broken deployment;
- final Devpost correction;
- required rule adjustment;
- critical bug.
Do not start new features.
---
# 36. What to test with real people
The design file recommends very cheap usability tests. Keep them.
## Five-second test
Show S0 for five seconds.
Ask:
> “What does this product do?”
Target:
At least four of five people should identify it as a tool for deciding what belongs together on a site.
## S2 test
Show compositions for five seconds.
Ask:
> “What changed from the first guess?”
If they cannot see the answer, the Prior-vs-Final representation is failing.
## Method test
Give a stranger `/method` for two minutes.
Ask:
> “What does a Zorq edge mean?”
They should be able to answer in ordinary language.
## Print test
Print the Blueprint in black-and-white.
All meaningful distinctions should survive.
---
# 37. Submission-day exact checklist
## Devpost
- [ ] project name final;
- [ ] tagline final;
- [ ] description final;
- [ ] public live URL works;
- [ ] public repo URL works;
- [ ] truthful project start date entered;
- [ ] optional existing-project answer correct if applicable;
- [ ] project is publicly accessible;
- [ ] no login required unless unavoidable and credentials are supplied;
- [ ] project is free to use;
- [ ] open-source license visible;
- [ ] Qloo integration explained;
- [ ] all submission fields answered;
- [ ] submission confirmed before internal cutoff.
## Live demo
- [ ] home page loads from incognito;
- [ ] preset starts;
- [ ] Prior appears;
- [ ] Qloo evidence appears;
- [ ] graph/compositions complete;
- [ ] stress test completes;
- [ ] Blueprint opens;
- [ ] Without-Qloo view works;
- [ ] share link works;
- [ ] refresh does not destroy state;
- [ ] mobile does not break;
- [ ] no secrets exposed in browser source/network payloads;
- [ ] Qloo failure path works.
## Repository
- [ ] public;
- [ ] LICENSE at root;
- [ ] README complete;
- [ ] `.env.example` present;
- [ ] real keys removed;
- [ ] setup commands tested from clean clone;
- [ ] no private URLs;
- [ ] no private credentials;
- [ ] no unauthorized copyrighted assets;
- [ ] no large raw Qloo dump unless explicitly allowed;
- [ ] architecture documented;
- [ ] known limitations documented.
---
# 38. What to do immediately after submission
The work is not finished when the Devpost button says submitted.
## 38.1 Freeze the exact submitted state
Tag/record the commit that corresponds to the submission.
Save:
- commit hash;
- deployed version;
- environment version;
- final screenshots;
- final video if used;
- final Devpost copy.
## 38.2 Keep the live project available
The testing requirement extends through judging.
Do not:
- turn off the hosting;
- remove the Qloo key without understanding judging impact;
- add authentication;
- let billing expire;
- replace the final deployed application with a different prototype.
## 38.3 Monitor the live service
Have a minimal health check.
Watch:
- HTTP failures;
- Qloo 429/5xx;
- LLM failures;
- broken environment variables;
- map/API outages;
- memory or rate-limit exhaustion.
## 38.4 Prepare a judge support package
Keep ready:
- live URL;
- repo URL;
- test preset names;
- fallback instructions;
- concise architecture diagram;
- `/method` URL;
- one paragraph explaining the Qloo dependency.
Do not make this package a substitute for the product; it is insurance.
---
# 39. How to think about the judges — inference, not official preference
The current listed judges span:
- Qloo technical leadership;
- technology/AI leadership;
- investing;
- entertainment;
- live entertainment strategy.
You should **not** claim that a specific judge prefers a particular UI style unless they have explicitly said so.
However, the diversity of judge backgrounds suggests a useful strategic requirement:
### Technical judge must see
- Qloo depth;
- architecture;
- provenance;
- robustness;
- genuine agent behavior.
### Product/investor judge must see
- real problem;
- clear buyer/user;
- useful output;
- believable product surface;
- limitations that have been considered.
### Entertainment/venue judge must see
- recognizable physical-place logic;
- cultural context;
- composition rather than generic directory search;
- a result that feels actionable.
### General audience / broad judge must see
- the product is understandable quickly;
- the output is memorable;
- the “aha” does not require reading the source code.
The same product must communicate all four views without becoming cluttered.
Current judges listed by Devpost:
- Jason Calacanis;
- Mike Diolosa — CTO, Qloo;
- Nicole Seligman — OpenAI board member;
- Todd Boehly — Eldridge Industries CEO;
- Cedric the Entertainer;
- Michael Abrams — EVP Strategic Initiatives, Live Nation Entertainment.
Source: https://qloo.devpost.com/
---
# 40. Zorq's strongest possible competitive positioning
The winning story should not be:
> “We use Qloo to recommend businesses for a location.”
That is too close to existing Qloo/locality projects and to capabilities Qloo already demonstrates directly.
The story should be:
> “A place is an ecosystem, not a list. Zorq uses Qloo to measure the cultural relationships between possible components, compares competing compositions, attacks the leader, adapts the result to physical constraints, and leaves a receipt-backed blueprint. The system keeps the original AI guess visible so you can see exactly what Qloo changed.”
This language makes the abstraction explicit.
---
# 41. The five features that deserve disproportionate effort
Do not distribute engineering effort evenly.
## 1. Cultural DNA
It must feel like the system discovered something about the place that generic AI would not know.
## 2. Cultural Composition Engine
The output must be a composition, not a list.
## 3. Challenge the Plan
The system must visibly attempt to falsify its own answer.
## 4. Without-Qloo Proof
A judge must be able to see why Qloo matters.
## 5. Blueprint + receipts
The final result must be worth handing to a real decision-maker.
Everything else supports those five.
---
# 42. The main risks and their mitigation
| Risk | Severity | Mitigation |
|---|---|---|
| Qloo edges reduce to popularity | Critical | IDF weighting; site-vs-city distinctiveness; spike early; fallback triangulation. |
| Qloo query semantics change | High | Use current public OpenAPI; encapsulate client; integration tests. |
| API rate limit | High | Token bucket, retries, caching where allowed, small candidate pool, preset warm-up only if permitted. |
| Live demo fails | Critical | External health checks, deterministic presets, error recovery, emergency backup deployment. |
| Agent looks like scripted workflow | High | Make probe selection and stress choices evidence-dependent and visible. |
| Qloo integration looks shallow | Critical | Multiple Qloo routes, explainability, locality + cross-domain + measurement + provenance. |
| Design becomes dashboard clutter | High | One hero object per step; strict visual hierarchy. |
| Judge misunderstands idea | Critical | Put “what belongs together” sentence on S0 and in submission headline. |
| False precision | High | Relative bands, percentiles, evidence grades, no magic 0–100 score. |
| No convincing impact | High | One concrete placemaking persona + realistic workflow + board-readable Blueprint. |
| Qloo unavailable during judging | Critical | Confirm key lifetime; have graceful failure state; ask organizer in writing. |
| Unauthorized assets | High | Asset/license inventory; use original/permissioned visuals. |
| Repository incomplete | Critical | Fresh-clone test. |
| Existing-project eligibility questioned | High | Preserve timeline + accurately document Qloo integration date and scope. |
| Cached Qloo data violates terms | Critical | Ask Qloo; use conservative in-memory caching until clarified. |
---
# 43. What should be said on `/method`
The method page should include:
## Measured by Qloo
- locality signals;
- entity resolution;
- cross-domain relationships;
- recommendation/affinity evidence;
- explainability metadata when available.
## Computed by Zorq
- taste neighborhoods;
- IDF weighting;
- graph edges;
- coherence;
- percentile;
- distinctiveness;
- stress diagnostics;
- constraint fit.
## Generated by the LLM
- initial Prior;
- probe selection;
- naming;
- narrative;
- challenge interpretation;
- format adaptation explanations.
## Limitations
Explicitly state:
- Qloo's catalog is not a census of every real business;
- small venues may be missing;
- cultural affinity is not revenue/demand/rent;
- format footprints are heuristics;
- coherence is relative to the candidate pool;
- no ground truth exists for the one “correct” tenant mix;
- the backtest, if implemented, is a sanity check rather than proof of real-world correctness.
This is an advantage, not a weakness, because the sponsor is judging whether the team understands the technology.
---
# 44. What must never be claimed in front of the Qloo CTO
Avoid these formulations unless you can prove them precisely:
- “Qloo scored our ecosystem 92.”
- “Qloo knows which businesses will make more money.”
- “Qloo predicts revenue.”
- “Qloo knows the perfect tenant mix.”
- “Qloo directly evaluates our combination score.”
- “Qloo found the cultural analog” as though “Cultural Analog” were an official Qloo primitive.
- “Our AI is 93% accurate” without a validated benchmark.
- “We validated demand” when you actually measured affinity.
Use:
- affinity;
- cultural relationship;
- locality signal;
- evidence;
- relative coherence;
- distinctiveness;
- hypothesis;
- stress test;
- heuristic;
- sanity check.
Precision in vocabulary increases credibility.
---
# 45. Official vs inferred vs speculative — final truth table
| Item | Status | Build decision |
|---|---|---|
| Live externally hosted application required | OFFICIAL | Mandatory. |
| Public source repository required | OFFICIAL | Mandatory. |
| Text description required | OFFICIAL | Mandatory. |
| Open-source license visible in repo About | OFFICIAL | Mandatory. |
| Demo video required | **NOT OFFICIAL / explicitly not required** | Optional only. |
| Qloo integration required | OFFICIAL | Mandatory. |
| Agentic tool/framework/existing-agent integration accepted | OFFICIAL | Zorq should demonstrate genuine agent behavior. |
| Four equal judging categories | OFFICIAL | Build against all four. |
| Stage One viability/Qloo fit gate | OFFICIAL | Do not risk disqualification. |
| $15k first prize | OFFICIAL | Current listed first prize. |
| One project can win only one prize | OFFICIAL | Official rule. |
| Qloo 250M+ entity statement | OFFICIAL hackathon wording | Use this language when describing the event. |
| Qloo currently publishes broader platform metrics | CURRENT COMPANY CONTEXT | Useful background, not necessary in submission. |
| Qloo docs publicly available in `docs-public` | OFFICIAL/current public source | Use as engineering authority. |
| Explainability metadata available | OFFICIAL/current public docs | Strong candidate for evidence drawer. |
| Composition-level Qloo score endpoint exists | **Not established** | Do not claim it. Compute Zorq metrics from evidence. |
| Qloo caching/storage allowance | ASK / UNVERIFIED | Obtain written answer. |
| Qloo API key valid throughout judging | ASK / UNVERIFIED | Obtain written answer. |
| Official bonus points for video | **No evidence** | Do not optimize around it. |
| Official bonus points for extra features | **No evidence** | Do not assume them. |
| “Judges will prefer X UI” | Inference | Use only as strategy, never as fact. |
---
# 46. The strongest possible final demo state
Imagine a judge opens Zorq with no explanation.
They see a real site brief.
They click a preset.
A first guess appears:
> Café + boutique retail + restaurant + coworking.
Then the system visibly investigates.
The map changes.
The ledger fills.
Cultural DNA emerges.
An unexpected relationship appears:
> independent film ↔ design ↔ listening culture.
A new composition appears.
The prior is still visible.
The judge clicks the graph edge.
The shared entities appear.
The judge clicks “Challenge the Plan.”
The system attacks its weakest link.
It revises one component.
The final Blueprint explains:
- what changed;
- why it changed;
- what evidence supports it;
- what remains weak;
- how the site constraints affected the format.
Then the judge clicks:
**Without Qloo.**
The generic composition is visible.
The current composition is materially different.
That is the story.
---
# 47. The standard Zorq should hold itself to
Do not ask:
> “Is the app complete?”
Ask:
> “Could a strong Qloo engineer attack the methodology?”
> “Could a placemaking professional understand the deliverable?”
> “Could an investor name the buyer?”
> “Could a judge understand the differentiator in 30 seconds?”
> “Could a stranger run the product without us?”
> “Could we prove which parts came from Qloo?”
> “Would the answer be materially worse if Qloo disappeared?”
> “Can the agent visibly change its mind?”
A first-place-quality project should survive all eight.
---
# 48. Final master checklist
## Before build
- [ ] Current Devpost rules read.
- [ ] Eligibility confirmed.
- [ ] Qloo key active.
- [ ] Current Qloo public OpenAPI reviewed.
- [ ] Current Qloo hackathon kit reviewed.
- [ ] Public repository created.
- [ ] License added.
- [ ] Project start date recorded truthfully.
- [ ] Third-party asset/tool inventory created.
- [ ] Qloo caching/storage question sent to organizer if unresolved.
- [ ] Key-lifetime question sent to organizer if unresolved.
- [ ] Six technical spikes completed.
- [ ] Edge model either passes or has a documented fallback.
- [ ] Three presets identified: divergent A, divergent B, control C.
## During build
- [ ] Prior Lock is genuinely frozen.
- [ ] Qloo is used in multiple meaningful stages.
- [ ] Agent decisions depend on observations.
- [ ] Qloo evidence IDs are tracked.
- [ ] No Qloo evidence is fabricated.
- [ ] Shared-culture graph works.
- [ ] Null-model percentile works.
- [ ] Distinctiveness works or is clearly marked stretch.
- [ ] Stress testing works.
- [ ] Constraint adaptation works.
- [ ] Blueprint is complete.
- [ ] Without-Qloo comparison works.
- [ ] Error states are explicit.
- [ ] Rate-limit behavior is resilient.
- [ ] UI teaches itself.
- [ ] `/method` explains formulas and limits.
- [ ] README stays synchronized with implementation.
## Before submission
- [ ] External deployment works in incognito.
- [ ] Preset works from first click.
- [ ] Custom run works.
- [ ] Qloo evidence visibly appears.
- [ ] Share link works.
- [ ] Fresh clone works.
- [ ] License visible in repo About.
- [ ] No secret exposure.
- [ ] No unauthorized content.
- [ ] Devpost text explains Qloo dependency.
- [ ] All custom fields complete.
- [ ] Final screenshots prepared.
- [ ] Optional video ready if used.
- [ ] Submission frozen by Oct 29 target.
## After submission
- [ ] Preserve exact submitted commit/deployment.
- [ ] Keep app online and free for judging.
- [ ] Monitor uptime/errors.
- [ ] Do not make risky changes.
- [ ] Keep a concise technical explanation ready.
- [ ] Watch for organizer announcements/rule updates.
---
# 49. Source register
## Current official hackathon
1. Qloo Agentic Hackathon — main page  
   https://qloo.devpost.com/
2. Qloo Agentic Hackathon — official rules  
   https://qloo.devpost.com/rules
3. Qloo Agentic Hackathon — schedule  
   https://qloo.devpost.com/details/dates
## Current Qloo technical documentation
4. Qloo public API documentation + OpenAPI repository  
   https://github.com/qloo/docs-public
5. Qloo API overview  
   https://github.com/qloo/docs-public/blob/main/reference/api-overview.md
6. Qloo Insights API Deep Dive / parameter reference  
   https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md
7. Qloo capabilities  
   https://www.qloo.com/capabilities
8. Qloo main platform page  
   https://www.qloo.com/
## 2025 Qloo LLM Hackathon historical sources
9. Qloo official winner announcement  
   https://www.linkedin.com/posts/qloo_hackathon-culturalintelligence-aiinnovation-activity-7370873373666549760-4W2g
10. 2025 official rules  
    https://qloo-hackathon.devpost.com/rules
11. GeoTaste winner page  
    https://devpost.com/software/geotaste-your-agentic-qloo-taste-business-consultant
12. Alloy page  
    https://devpost.com/software/axiom-2bn391
13. Resonance Engine page  
    https://devpost.com/software/resonance-engine
14. Resonance AI page  
    https://devpost.com/software/resonance-ai-1hjbf0
15. Zesty page  
    https://devpost.com/software/zesty-flwi5e
## Supplied Zorq documents used as product/design source material
16. `Idea(1).md` — Zorq concept and product rationale.
17. `Product Specification(1).md` — Zorq technical/product specification.
18. `Final_design(1).md` — Zorq design rationale and judge-facing visual system.
---
# 50. Final strategic conclusion
The current competition does **not** demand the largest codebase, the most agents, the most screens, or the most impressive-looking AI animation.
The challenge is narrower and harder:
**Can Zorq demonstrate that cultural intelligence changes an agent's decision in a way that is useful, measurable, inspectable and materially better than generic AI?**
The supplied Zorq concept already has the right foundation.
The biggest danger is not that the idea is too small.
The danger is that the implementation accidentally collapses it into a conventional Qloo recommender.
Therefore the build should protect five things above everything else:
### Cultural DNA
Discover what is culturally distinctive about the site.
### Cultural Composition
Treat the answer as a set, not isolated recommendations.
### Qloo-grounded measurement
Use Qloo as evidence, not decoration.
### Challenge the Plan
Force the system to test and potentially revise itself.
### Without-Qloo Proof
Make the sponsor's own central test visible in the product.
The final product should make one idea unforgettable:
> **The difference is not that Zorq knows more places. The difference is that Zorq can reason about what should exist together — and show what cultural evidence made it change its mind.**
That is the standard this project should be built against.

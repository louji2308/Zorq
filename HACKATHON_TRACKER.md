# ZORQ — Hackathon Requirements Tracker (standing)

> Source: `ProjectSpec/Hackathon_details.md` (research cut-off 2026-10-06) + `ProjectSpec/Tools_and_Requirements.md`.
> Official authority: https://qloo.devpost.com/ and https://qloo.devpost.com/rules — re-verify before submission.
> This file tracks **external competition obligations only.** Internal build state → `IMPLEMENTATION_STATE.md`.

## 1. Key dates

| Milestone | Official | IST | Zorq internal |
|---|---|---|---|
| Submissions opened | Sep 30, 2026 | — | done |
| **Submission deadline** | **Oct 30, 2026, 11:45 PM EDT** | Oct 31, 9:15 AM | **Freeze Oct 28, hard freeze Oct 29** |
| Judging starts | Nov 2, 2026, 12:00 PM EST | Nov 2, 10:30 PM | app must be live + free |
| Judging ends | Nov 16, 2026, 11:45 PM EST | Nov 17, 10:15 AM | keep online through this date |
| Winners announced | ~Nov 23, 2026 | ~Nov 24 | — |

**Today: Oct 6, 2026 → 24 days to deadline, 14 days to internal freeze.**

## 2. Hard submission requirements (OFFICIAL) — pass/fail

| # | Requirement | Status | Evidence needed |
|---|---|---|---|
| R1 | Functional demo app, usable end-to-end | ❌ not started | live URL |
| R2 | Public code repository (GitHub/GitLab/Bitbucket) with source + run instructions | ❌ not started | repo URL |
| R3 | Text description of what it does + what makes it Qloo-powered | ❌ not started | Devpost field |
| R4 | External hosting / fully published, free to test, no login | ❌ not started | live URL |
| R5 | Open-source license visible in repo + repo About | ❌ not started | `LICENSE` (MIT locked) |
| R6 | Qloo integration actually used | ❌ not started | Gate A |
| R7 | Truthful project start date | ⚠️ pending | enter Oct 6, 2026 (do not backdate) |
| R8 | All Devpost custom fields answered | ⚠️ pending | submission-day checklist |

**Explicitly NOT required:** demo video, ZIP file. (Video = optional judge-acceleration asset only.)

## 3. Stage One viability gate (pass/fail before scored judging)

- [ ] Reasonably fits the theme (agentic tool using Qloo).
- [ ] Reasonably applies the required APIs/SDKs (Qloo).
- Risk if collapsed into `LLM → Qloo → recommendations` = disqualification-adjacent failure.

## 4. Judging dimensions (equal weight — build against all four)

| Dimension | Target evidence | Status |
|---|---|---|
| Technological Implementation | deep multi-stage Qloo usage, guarded gateway, visible call trace, resilient code | ❌ |
| Design | complete self-teaching product, no video/narration required | ❌ |
| Potential Impact | real placemaking/tenant-mix workflow, named buyer, board-readable Blueprint | ❌ |
| Quality of Idea | composition-not-recommendation abstraction; Prior→Final; self-challenge | ❌ concept locked |

## 5. Mandatory product invariants (judge-proof acceptance criteria)

| # | Invariant | Status |
|---|---|---|
| P1 | Prior Lock is write-once, generated before any Qloo call | ❌ |
| P2 | Qloo changes the result **or** honestly confirms it (control case; never manufacture divergence) | ❌ |
| P3 | Every `[Qloo]` claim → evidence ID → ledger event → measurement input | ❌ |
| P4 | Every numeric metric deterministic and reproducible (LLM authors no numbers) | ❌ |
| P5 | Agent decisions are observation-dependent, not a fixed script | ❌ |
| P6 | Output is a **set** with measured inter-component relationships (graph, not list) | ❌ |
| P7 | Graph edges have receipts: shared entities, route, triangulation, status | ❌ |
| P8 | Challenge the Plan is real → `Survived / Revised / Replaced` | ❌ |
| P9 | Constraints change format, not evidence (`Cinema → Micro-screening; role preserved: Anchor`) | ❌ |
| P10 | Uncertainty visible: measured / confirmed / contested / thin / not measured / incomplete / unavailable | ❌ |
| P11 | Place Blueprint stands alone as a decision artifact | ❌ |
| P12 | Qloo-removal test: without Qloo the app is materially weaker | ❌ |
| P13 | Fresh-clone reproducibility (README sufficient from clean checkout) | ❌ |
| P14 | Live, externally hosted, free, no account, usable through Nov 16 | ❌ |

## 6. Locked runtime budgets (do not tune without measured evidence)

```
LLM_BUDGET_USD      = 2.00/run      (stop non-essential at 80%)
MAX_QLOO_CALLS      = 180 target, ~200 hard ceiling
QLOO_CONCURRENCY    = 6–8 (default 6)
Planner turns       = ≤3 per phase
Mutation rounds     = ≤2
Stress reserve      ≈30% of Qloo budget
Cache TTL           ≈6h in-memory; PERSIST_QLOO_DERIVED=false by default
```

## 7. Build gates (must pass before UI polish)

| Gate | Question | Status |
|---|---|---|
| A — Transport | Qloo MCP connects, `qloo_capabilities` ready, one full tool chain returns structured output | ❌ blocked on B-01 |
| B — Resolution | ≥80% of component concepts resolve to defensible Qloo tags/entities | ❌ |
| C — Edge quality | shared-culture edges vary meaningfully, not just popularity | ❌ |
| D — Rate/latency | 6–8 concurrency run completes in an acceptable UX budget | ❌ |
| E — Evidence | explainability/affinity behavior known; rank-only fallback works | ❌ |
| F — Presets | 2 genuinely Qloo-divergent presets + 1 honest control | ❌ |
| G — Compliance | written Qloo answer on cache/storage/key lifetime, or no-persist mode active | ⚠️ conservative default on; written answer outstanding |

## 8. Day-1 / spike register (spec §18 + §35)

| # | Spike | Pass | Fallback | Status |
|---|---|---|---|---|
| 1 | 8 sites × 8 categories → edges non-degenerate, not popularity | real spread, site≠city | triangulation route as primary edge | ❌ |
| 2 | `/v2/tags` resolves independent cinema, listening bar, design shop, gallery… | ≥80% | exemplar clustering | ❌ |
| 3 | rate limit + latency at concurrency 6–8 | acceptable live duration | shrink K to 8, domains artist+movie | ❌ |
| 4 | affinity present + rank stable across repeats | yes | rank-only weighting | ❌ |
| 5 | 8 candidate sites → pick 2 divergent + 1 control presets | 3 presets chosen | — | ❌ |
| 6 | caching/storage/key-lifetime terms | written organizer answer | in-memory only, no saved runs | ❌ email not sent |
| D1 | image URLs returned + displayable under terms | images for most entities | specimen tiles (typographic) | ❌ |
| D2 | Raleway `lnum`/`tnum`, Bricolage axes, no layout shift | all render | numbers in Bricolage | ❌ |

## 9. Security / compliance (standing rules)

- [ ] Qloo + DeepSeek keys exist only in server secrets; never in frontend, Git, logs, screenshots, README, committed MCP config.
- [ ] `.env.example` contains placeholders only.
- [ ] No personal data (names, emails, device/location history) sent to Qloo.
- [ ] Qloo/MCP/model output treated as untrusted; markdown sanitized before render.
- [ ] Per-IP rate limiting + Helmet active.
- [ ] No scraping/bulk extraction of Qloo data; no raw-response persistence by default.
- [ ] Never claim: "Qloo scored this 92", "Qloo predicts revenue", "93% accurate", invented trend claims, magical 0–100 score.
- [ ] Third-party asset/license inventory maintained (fonts, map, images, libraries).

## 10. Submission-day checklist (Oct 28–29 target)

**Devpost:** name · tagline · description · live URL · public repo URL · truthful start date
(Oct 6, 2026) · no login · free to use · license visible · Qloo integration explained ·
all fields answered · submitted before internal cutoff.

**Live demo (incognito):** home loads → preset → Prior appears → Qloo evidence → compositions →
graph evidence → Challenge → Blueprint → Without-Qloo → share link works → refresh preserves state →
mobile does not break → no secrets in network payloads → Qloo failure path honest.

**Repository:** public · `LICENSE` at root · complete README · `.env.example` · no real keys ·
clean-clone setup verified · no private URLs/assets · architecture documented · limitations documented.

**After submission:** tag the exact commit · keep app online and free through Nov 16 · monitor
`/healthz` (GitHub Actions every ~10 min) · no risky changes · watch organizer announcements.

## 11. Open questions for organizers (ian@qloo.com) — NOT YET SENT

1. May Qloo output be cached, for how long, and in what form (raw / derived / entity IDs)?
2. Is the hackathon API key valid through the judging period (Nov 16)?
3. What are the event quota and rate limits?
4. May preset evidence be pre-warmed?

Conservative mode active until answered: in-memory cache only, `PERSIST_QLOO_DERIVED=false`.

## 12. Change log

| Date | Change |
|---|---|
| 2026-10-06 | Tracker created from `Hackathon_details.md` + `Tools_and_Requirements.md`. All requirements unmet (empty repository). |

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
| R2 | Public code repository (GitHub/GitLab/Bitbucket) with source + run instructions | ✅ https://github.com/louji2308/zorq (PUBLIC, `main`, pushed `122053d`) | repo URL |
| R3 | Text description of what it does + what makes it Qloo-powered | ❌ not started | Devpost field |
| R4 | External hosting / fully published, free to test, no login | ❌ not started | live URL |
| R5 | Open-source license visible in repo + repo About | ✅ `LICENSE` (MIT) at root; GitHub reports `licenseInfo: mit`; About description set | `LICENSE` (MIT locked) |
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
| A — Transport | Qloo MCP connects, `qloo_capabilities` ready, one full tool chain returns structured output | 🟡 **REST path proven 2026-10-06** (10 live calls: `/search`, `/v2/tags`, `/v2/insights` all 200; auth, base URL and error shapes known). **MCP path untested → gate not yet passed.** |
| B — Resolution | ≥80% of component concepts resolve to defensible Qloo tags/entities | 🟡 1/8 concepts verified (`cinema` → `urn:tag:nearby_attraction:qloo:cinema` + `urn:tag:setting:qloo:cinema`, parents include `urn:entity:place`) |
| C — Edge quality | shared-culture edges vary meaningfully, not just popularity | 🟡 preliminary: 50 local results show affinity-vs-popularity rank agreement **1/50** (independent) but affinity range only **0.036**. Pairwise shared-culture edge test still to run. |
| D — Rate/latency | 6–8 concurrency run completes in an acceptable UX budget | ❌ not run. Known risk: responses are **0.2–1.0 MB** per call (no server-side field filtering). |
| E — Evidence | explainability/affinity behavior known; rank-only fallback works | 🟡 **`query.affinity` numeric on every entity** (plus `popularity`); no separate explainability field observed. Affinity band is compressed → normalize before display. |
| F — Presets | 2 genuinely Qloo-divergent presets + 1 honest control | ❌ |
| G — Compliance | written Qloo answer on cache/storage/key lifetime, or no-persist mode active | ✅ **answered from official docs** (developer guide, retrieved 2026-10-06): private server-side caching permitted with **no time limit**; never store Qloo responses in a public repo; keys active through end of judging period |

## 8. Day-1 / spike register (spec §18 + §35)

| # | Spike | Pass | Fallback | Status |
|---|---|---|---|---|
| 1 | 8 sites × 8 categories → edges non-degenerate, not popularity | real spread, site≠city | triangulation route as primary edge | 🟡 partial: locality filter (`filter.location` / `filter.location.query` + radius) proven; affinity independent of popularity (1/50 rank agreement); affinity band compressed (range 0.036). 8×8 matrix not yet run. |
| 2 | `/v2/tags` resolves independent cinema, listening bar, design shop, gallery… | ≥80% | exemplar clustering | 🟡 1/8 verified (`cinema`, place-scoped parents present) |
| 3 | rate limit + latency at concurrency 6–8 | acceptable live duration | shrink K to 8, domains artist+movie | ❌ not run; payload size (up to ~1 MB/call) is the flagged risk |
| 4 | affinity present + rank stable across repeats | yes | rank-only weighting | 🟡 affinity present and numeric; **stability across repeats not yet measured** |
| 5 | 8 candidate sites → pick 2 divergent + 1 control presets | 3 presets chosen | — | ❌ |
| 6 | caching/storage/key-lifetime terms | written organizer answer | in-memory only, no saved runs | ✅ **closed from official developer guide (2026-10-06):** cache privately, any duration; no public storage of Qloo output; key valid through judging |
| D1 | image URLs returned + displayable under terms | images for most entities | specimen tiles (typographic) | 🟡 images confirmed present (`properties.image.url` on search, `properties.images[]` on insights); display/licensing path not yet exercised |
| D2 | Raleway `lnum`/`tnum`, Bricolage axes, no layout shift | all render | numbers in Bricolage | ❌ |

## 9. Security / compliance (standing rules)

- [ ] Qloo + DeepSeek keys exist only in server secrets; never in frontend, Git, logs, screenshots, README, committed MCP config.
- [ ] **Never store Qloo response data in a public repository** (official Qloo rule, developer guide).
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

## 11. Qloo official answers + API key acquisition (retrieved 2026-10-06)

Source: **Qloo Agentic Hackathon Developer Guide** — https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide

| Question | Official answer | Impact |
|---|---|---|
| How to get a key | Submit the **API key request form**: https://forms.gle/zz12orkLHTAneLGz6 → key emailed; **"typically issued within a few business days"** (manual provisioning). Check spam; resubmit if >few days. | **Do this today** — lead time is the schedule risk (B-01). |
| Key validity period | **"Keys remain active through the end of the judging period"**, deactivated after the hackathon closes. | Q4 of the organizer email is answered; key-lifetime risk closed. |
| Caching / storage | **"Private server-side caching is fine and there is no time limit."** Do **not** store Qloo response data in a public repository. | Q1 answered; B-05 closed. `PERSIST_QLOO_DERIVED` stays `false` until server-side storage has a real owner (Phase 5), then may be enabled privately. |
| Quota / rate limits | "set high enough to support typical hackathon projects"; raise via **#api-help** on Discord (https://discord.gg/rF9PKsD5Q7) | Q3 answered qualitatively; exact numbers measured empirically in Spike 3. |
| Base URL | `https://hackathon.api.qloo.com` **only** (not staging/production) → otherwise 401 | Locked in gateway. |
| Auth header | `X-Api-Key: <key>` (not `Authorization: Bearer`, not query param) | Locked in gateway. |
| Method | `/v2/insights` is **GET**, params in query string (POST+JSON body fails) | Locked in gateway. |
| Insights entity types | `urn:entity:{artist, book, brand, destination, movie, person, place, podcast, tv_show, video_game}`; 403 = unsupported type | Locked validator. |
| Legacy endpoints | **Do not use `/recommendations` or `/recs`** — unsupported | Gateway must never call them. |
| Silent invalid params | Unsupported params are **ignored, not errored** → 200 with empty `entities` | Gateway/tests must treat empty results as a param bug first, not data absence. |
| Field filtering | Not supported — full response returned; extract client-side | Gateway must select/shape fields. |
| **Locality filtering** | `filter.location` = WKT `POINT(lon lat)` **or** locality Qloo ID; `filter.location.radius` = metres (`0` = strict boundary); `filter.location.query` = fuzzy named locality (400 if no match); also `filter.geocode.name/admin1_region/country_code`. `signal.location[+radius]` for geospatial signals. | **Verified live 2026-10-06** — Brooklyn point + 2500 m returned only New York results. This is how Zorq enforces place locality. |
| Result control | `take` default **20**, max **50**; `page` (preferred) or `offset`; `sort_by` = `affinity` \| `distance` \| `rating` \| `quality`; `diversify.by=properties.geocode.city` + `diversify.take` | Caps candidate sets per call → iterate pages when K > 50. |
| Popularity control | `filter.popularity.min/max` = float 0–1 percentile | Direct input for Spike 1 (distinctiveness vs popularity). |
| POST-only params | `signal.interests.entities.query`, `filter.exclude.entities.query` (JSON body) | Gateway must support POST as well as GET. |
| Open organizer items | project-specific quota bump; preset evidence pre-warm | Ask in #api-help only if Spike 3/5 shows need. |

## 11b. Remaining organizer contact

Only if needed: quota headroom and preset pre-warming, via **#api-help on Discord** (faster than email).

## 12. Change log

| Date | Change |
|---|---|
| 2026-10-06 | Tracker created from `Hackathon_details.md` + `Tools_and_Requirements.md`. All requirements unmet (empty repository). |
| 2026-10-06 | Phase 0: git init + MIT `LICENSE` + `.env.example` committed (`00e0e6d`) → R2/R5 partial. Key-lifetime question closed by user (D-0.7); storage/caching, quota and warm-up questions remain. |
| 2026-10-06 | Public repo https://github.com/louji2308/zorq created, pushed, About + topics set, GitHub detects MIT → **R2 ✅ R5 ✅**. Official developer guide retrieved → **Gate G ✅, Spike 6 ✅** (cache policy, key expiry, base URL, auth header, supported types, legacy-endpoint ban). B-01 reduced to "submit key request form" (few business days lead time). |
| 2026-10-06 | **Qloo key received and used**: 10 live calls, zero failures after param correction. **B-01 ✅**, Gates A/B/C/E → 🟡, Spikes 1/2/4/D1 → 🟡. Locality filters verified live; affinity+popularity both numeric and independent (1/50 rank agreement); affinity band compressed (range 0.036); payloads 0.2–1.0 MB. Full evidence in `IMPLEMENTATION_STATE.md`. |

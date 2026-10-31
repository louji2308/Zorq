# Phase 9 release audit (recorded 2026-10-17)

Scope: the audit items from Hackathon_details §28 and IMPLEMENTATION_PLAN Phase 9/Phase 10
that are verifiable from this repository without live credentials. Items that require live
keys or the deployed URL are listed as pending live evidence, never claimed as passed.

> **Update 2026-10-31 (stale-claim correction):** the LLM is **Rapid Router**
> (`deepseek/deepseek-v4-flash` via `src/server/agent/llm.ts:24`, the model the record's
> logged live runs actually used). Render deploy is **live**: https://zorq-12dk.onrender.com with
> `/healthz` 200 (re-verified 2026-10-31). Real funded runs that complete exist
> (Chennai `d30b7047-df2c-4f65-bf72-4d7db6c60525`; Nashville
> `4564a1cb-f4fc-4a0c-b23d-45f929bbd976` — challenge verdicts + Blueprint grade B, see
> `IMPLEMENTATION_STATE.md` 2026-10-27/28), but the Without-Qloo A/B receipts in
> `docs/qloo-removal-proof.md` §3 remain pending. The `e2e/*` Playwright suites and
> `playwright.config.ts` were removed by user decision; e2e citations below are
> historical dated records, not current coverage. Dated 2026-10-17 rows are kept as
> the historical record.

## Secret audit

| Check | Result | Evidence |
|---|---|---|
| No credentials in source | Pass | `QLOO_API_KEY` / `RAPIDROUTER_API_KEY` / `TURSO_AUTH_TOKEN` appear in `src/server/*` as env-var *reads* only (config, gateway, agent errors); `VITE_MAPTILER_KEY` is documented public-by-design (D-6.1) and is the only secret-shaped identifier in the web bundle. |
| `.env` is not tracked | Pass | `git ls-files .env` returns nothing; only `.env.example` (placeholders) is committed. |
| Live gates are credential-gated | Pass | `tests/qloo/live.test.ts` and related live suites run only with `LIVE_QLOO=1` plus a real key; otherwise skipped, never faked. |

## Production-path anti-pattern scan

`grep -rniE "(mock|fake|stub|dummy|placeholder|hardcode|bypass)" src` excluding tests returns
only:

- HTML input `placeholder=` attributes and the `.s0-input::placeholder` rule (UI idiom, not data);
- one documented design comment (`s1.css` "Honest placeholder in the Prior card's own slot") and
  the `s1Model.ts` D-5.4 comment about a field the orchestrator never writes;
- `docBase`/`textBaseline` canvas/SVG APIs in `src/web/lib/map.ts` and s2/s3 (name collision, not a fake);

No `TODO`/`FIXME`/`XXX`/`HACK` markers in production source. No fake data, fake delays, hidden
fallbacks, or preset-specific answers found.

## Verified quality gates (exit codes observed)

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass (exit 0) — re-observed 2026-10-31 |
| `npm run lint` | Pass (exit 0) — re-observed 2026-10-31 |
| `npm test` | Pass — **831 tests passed / 6 skipped** (79 files, live tests credential-gated), 2026-10-30 audit run against the uncommitted working tree |
| `npm run build` | Pass (exit 0; the existing >500 kB chunk warning only), 2026-10-30 audit run |
| `npm run test:e2e` | *Historical (2026-10-17):* Pass — 10/10 judge-path + smoke against the then-current production build. The `e2e/*` Playwright suites and `playwright.config.ts` were removed by user decision on 2026-10-30; the judge path is now verified by the API/integration suites plus manual browser evidence (live runs browser-walked 2026-10-27/28, zero console errors). |

## Emergency/boundary behaviors already covered by suites

| Behavior | Where proven |
|---|---|
| Degraded boot (missing config → 503 typed health) | `tests/degradedBoot.test.ts`, `tests/serverHttp.test.ts` |
| Unknown entity / invented polish dropped with a ledger row | `tests/agent/prior.test.ts` |
| Failed probes stay visible and cap evidence grade | Phase 8 S4 suites (`tests/api/judgeChain.test.ts`) |
| Zero-result / invalid-combination Qloo semantics | `tests/qloo/*` contract suites |

*Historical 2026-10-17 baseline, superseded by the counts above:* typecheck/lint pass, 746 tests / 69 files, e2e 10/10.

## Pending live evidence (do not claim from fixtures)

- Real-run A/B receipts → `docs/qloo-removal-proof.md` §3. (Real funded runs that complete exist — Chennai `d30b7047…`, Nashville `4564a1cb…` — but the §3 receipt table stays unfilled until recorded; never claimed from other runs.)
- Live `LIVE_QLOO=1` gateway contract run.
- ~~Render deploy smoke (image builds and `/healthz` 200 through the public URL).~~ → **Done.** Deployed at https://zorq-12dk.onrender.com (Render Docker service); `/healthz` 200 confirmed 2026-10-18 and re-verified 2026-10-31 (`{"status":"ok","service":"zorq",…}`).
- Physical 360px/keyboard/reduced-motion manual sweep is partially covered (narrow-viewport S3 was e2e-proven at the 2026-10-17 record; that suite has since been removed, and live browser walks on 2026-10-27/28 showed zero console errors); the remaining manual pass against the live URL is outstanding.

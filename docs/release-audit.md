# Phase 9 release audit (recorded 2026-10-17)

Scope: the audit items from Hackathon_details §28 and IMPLEMENTATION_PLAN Phase 9/Phase 10
that are verifiable from this repository without live credentials. Items that require live
keys or the deployed URL are listed as pending live evidence, never claimed as passed.

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
| `npm run typecheck` | Pass (exit 0) |
| `npm run lint` | Pass (exit 0) |
| `npm test` | Pass — 746 tests / 69 files (5 live tests skipped as credential-gated) |
| `npm run test:e2e` | Pass — 10/10 judge-path + smoke against the real production build |

## Emergency/boundary behaviors already covered by suites

| Behavior | Where proven |
|---|---|
| Degraded boot (missing config → 503 typed health) | `tests/degradedBoot.test.ts`, `tests/serverHttp.test.ts` |
| Unknown entity / invented polish dropped with a ledger row | `tests/agent/prior.test.ts` |
| Failed probes stay visible and cap evidence grade | Phase 8 S4 suites (`tests/api/judgeChain.test.ts`) |
| Zero-result / invalid-combination Qloo semantics | `tests/qloo/*` contract suites |

## Pending live evidence (do not claim from fixtures)

- Real-run A/B receipts → `docs/qloo-removal-proof.md` §3.
- Live `LIVE_QLOO=1` gateway contract run.
- Render deploy smoke (image builds and `/healthz` 200 through the public URL).
- Physical 360px/keyboard/reduced-motion manual sweep is partially covered (narrow-viewport S3
  e2e exists); the remaining manual pass happens against the live URL at freeze.

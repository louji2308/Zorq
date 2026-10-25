# Qloo driven S0 tags design

## Goal

Replace the local S0 adaptive preference graph with server-side Qloo-driven
tag suggestions. Keep the suggestions compact and visually quiet beside the
Goal field, while preserving the existing brief submission contract and the
server-only secret boundary.

## Product behavior

- The S0 form no longer owns a hardcoded base-four relationship graph.
- Once a site is placed and the Goal contains enough text to form a useful
  signal, the browser debounces a same-origin request for Qloo tag suggestions.
- The request carries the site label, optional coordinates, the Goal, and the
  Qloo tag ids already selected in this draft.
- The server resolves the Goal through Qloo, asks Qloo for tag insights using
  those resolved signals plus the site context, removes duplicates and already
  selected tags, and returns at most eight labelled suggestions.
- The UI renders a compact muted row immediately below the Goal textarea:
  `Qloo-driven tags` in grey microcopy, followed by small grey outlined
  buttons. A selected tag remains visible with the selected treatment and can
  be toggled off.
- The row reports loading, empty, and unavailable states honestly. It never
  fabricates a local fallback tag list.
- Selecting a tag only adds its user-facing label to the existing Brief
  `constraints` array. The Qloo id stays draft-only and is used to refine the
  next preview request; the investigation resolves submitted phrases again
  through the canonical Qloo path.

## Architecture and trust boundary

- Add a typed `POST /api/qloo/tags` preview route. It is a bounded S0 preview,
  not a run or evidence event; the existing run path still locks the Prior
  before its investigation Qloo calls.
- The browser never receives `QLOO_API_KEY`. The route receives a gateway
  dependency and uses the existing Qloo cache, retry, timeout, and call-budget
  controls.
- Qloo tag discovery uses `QLOO_API_KEY` only. It does not call the LLM. The
  existing `RAPIDROUTER_API_KEY` remains required for the run Prior and agent
  paths, but is not involved in this preview request.
- Extend the typed Qloo insights boundary with a `tag` filter that maps to
  `urn:tag` and projects tag results. Verify the upstream response shape with
  tests; live behavior remains an integration check, not a fabricated fixture.
- Zorq code owns input validation, deduplication, selected-tag exclusion,
  result count, and UI state. Qloo owns the cultural inference.

## Error and budget behavior

- Empty or low-signal Qloo responses return an empty typed result and a muted
  explanation; they do not fall back to hardcoded tags.
- Missing Qloo configuration or an upstream failure returns the existing typed
  API error. The UI keeps the form usable and says that Qloo-driven tags are
  unavailable.
- The browser waits 650 ms after Goal or selected-tag changes before calling;
  stale responses are ignored. The existing server rate limit and Qloo cache
  provide the second guard.
- The route is not used for hard operational constraints. Hours, noise, floor
  area, and fit remain deterministic Zorq concerns.

## Verification

- Shared schema tests cover valid and invalid preview requests/responses.
- Qloo transport/gateway tests cover `urn:tag` request planning and tag
  projection.
- Preview service tests cover resolution, selected-tag exclusion, dedupe,
  empty results, and degraded envelopes.
- Route tests cover a successful preview, missing gateway, and typed upstream
  failure without exposing the key.
- Web tests cover the pure state transition for selecting/removing a Qloo tag
  and submission of its label as a Brief constraint.
- Run typecheck, lint, focused tests, full unit tests, production build, and a
  browser smoke check for the muted row when the server has Qloo configured.

## Deviation record

The Product Specification currently says S0 does not make Qloo cultural calls
before submit. This user-requested preview route is a deliberate, bounded
deviation so the requested Qloo-driven tags can appear beside the Goal field.
It is isolated from run evidence, has no LLM dependency, uses the existing
server controls, and leaves the Prior-before-Qloo invariant intact for the
actual investigation run.

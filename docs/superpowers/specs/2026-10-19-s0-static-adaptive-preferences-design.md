# S0 static layout and adaptive preferences design

## Goal

Make the first page a fixed viewport shell with a non-scrolling map and a
right-side scrolling brief panel, remove the preset section, slightly reduce
the landing sentence, and replace fixed constraint chips with fast adaptive
preference tags.

## Product behavior

- The S0 route has no document-level scroll. On wide screens the map occupies
  the full viewport and never scrolls; the right column owns overflow in its
  brief content area. On narrow screens the map remains a fixed, non-scrolling
  viewport section and the lower right brief area scrolls.
- The “Try a site” preset section is removed. The custom site flow remains the
  only first-page entry path.
- The landing sentence uses 70px on desktop (about 8% below the existing 76px)
  and remains responsive on narrow screens.
- The initial preference set is a small common seed set. Selecting a tag
  immediately reveals deterministic related suggestions from a local graph;
  selecting a suggestion reveals its own related suggestions. Selected tags
  remain visible and are visually distinct from available/unselected tags.
- Adaptive suggestions are interaction scaffolding, not claimed Qloo results.
  The selected phrases are submitted as the existing brief `constraints`
  array so the server can resolve and measure them during the run. Qloo owns
  external cultural/tag resolution; Zorq owns validation and deterministic
  fit rules; the LLM may interpret preferences and choose probes but does not
  invent tags, measurements, or numeric truth.
- No remote request happens while selecting a preference, preserving instant
  interaction. The UI states this boundary next to the adaptive tags.

## Honest `/method` position

The method's known limits remain correct: Qloo is not a census, cultural edges
are not demand or success probabilities, format footprints/hours are planning
heuristics, scores are relative to the measured pool, there is no ground truth
for the correct mix, and sparse or contradictory evidence remains thin or
contested. The method page will additionally explain that adaptive preference
chips are local interaction suggestions until Qloo measures the submitted
phrases.

## Verification

- Pure S0 tests cover seed visibility, recursive adaptive suggestions,
  selection toggling, unselected/selected submission, and removal of the old
  custom constraint rectangle.
- Browser verification checks no document scroll, no map scroll, right-panel
  overflow, reduced heading size, no preset section, and visible selected vs
  available states.
- Run typecheck, lint, focused tests, full tests, and production build.

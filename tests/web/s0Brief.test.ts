/*
 * S0 custom-brief form — pure state transitions, validation and Brief
 * construction (no DOM, no MapLibre, no network).
 *
 * Covers the geocode-failure fallback chain end to end in pure logic:
 * typing an address the provider cannot place, then clicking a point on the
 * map, must keep the user's own words as Brief.location and attach the clicked
 * coordinates — never a guessed place name.
 */
import { describe, expect, it } from "vitest";
import { briefSchema } from "../../src/shared/brief.js";
import {
  COMMON_PREFERENCES,
  DEFAULT_RADIUS_M,
  MAX_ADMIRED_PLACES,
  MAX_OBJECTIVE_CHARS,
  adaptivePreferenceTags,
  addAdmiredPlace,
  emptyBriefForm,
  pickSiteOnMap,
  removeAdmiredPlace,
  selectSuggestion,
  setLocationText,
  submitBriefForm,
  toggleConstraint,
  validateBriefForm,
  type BriefFormState
} from "../../src/web/screens/s0/briefFormState.js";

const SITE = { lat: 40.72466201611901, lon: -73.9963011816144 };
const ADDRESS = "Crosby Street, Manhattan, New York 10012, United States";
const GOAL = "A ground-floor place where downtown locals and visitors both feel they belong.";

function placedForm(): BriefFormState {
  const typed = setLocationText(emptyBriefForm(), ADDRESS);
  const placed = selectSuggestion(typed, { label: ADDRESS, lat: SITE.lat, lon: SITE.lon });
  return { ...placed, area: "28000", objective: GOAL };
}

describe("S0 brief form — validation", () => {
  it("requires an address, a placed point and a goal", () => {
    const errors = validateBriefForm(emptyBriefForm());

    expect(errors.location).toBe("Enter an address for the site.");
    expect(errors.site).toBe(
      "Place the site: pick an address suggestion or a point on the map."
    );
    expect(errors.objective).toBe("Add the goal for this site.");
    expect(errors.area).toBeUndefined();
  });

  it("accepts an empty area and rejects a non-positive or non-numeric one", () => {
    const base = placedForm();

    expect(validateBriefForm({ ...base, area: "" }).area).toBeUndefined();
    expect(validateBriefForm({ ...base, area: "28000" }).area).toBeUndefined();
    expect(validateBriefForm({ ...base, area: "0" }).area).toBe(
      "Area must be a positive number of square feet."
    );
    expect(validateBriefForm({ ...base, area: "-12" }).area).toBe(
      "Area must be a positive number of square feet."
    );
    expect(validateBriefForm({ ...base, area: "a lot" }).area).toBe(
      "Area must be a positive number of square feet."
    );
  });

  it("caps the goal at 200 characters", () => {
    const base = placedForm();

    expect(validateBriefForm({ ...base, objective: "x".repeat(MAX_OBJECTIVE_CHARS) }).objective)
      .toBeUndefined();
    expect(validateBriefForm({ ...base, objective: "x".repeat(MAX_OBJECTIVE_CHARS + 1) }).objective)
      .toBe(`Keep the goal to ${MAX_OBJECTIVE_CHARS} characters or fewer.`);
  });

  it("does not require a hidden custom-constraint field", () => {
    const base = placedForm();
    expect(validateBriefForm(base)).toEqual({});
  });
});

describe("S0 adaptive preferences", () => {
  it("starts with a small common seed set", () => {
    expect(adaptivePreferenceTags([])).toEqual([...COMMON_PREFERENCES]);
  });

  it("reveals related tags instantly and continues adapting after a suggestion is selected", () => {
    const first = adaptivePreferenceTags(["Walkable"]);
    expect(first).toContain("Transit-connected");
    expect(first).toContain("Street-facing");

    const second = adaptivePreferenceTags(["Walkable", "Transit-connected"]);
    expect(second).toContain("All-weather access");
  });
});

describe("S0 brief form — placement transitions", () => {
  it("drops coordinates as soon as the address text no longer matches the resolved label", () => {
    const placed = placedForm();
    expect(placed.site).toEqual(SITE);
    expect(placed.resolvedLabel).toBe(ADDRESS);

    const retyped = setLocationText(placed, "Crosby Street, Manhattan, New York 10013");
    expect(retyped.site).toBeNull();
    expect(retyped.resolvedLabel).toBeNull();
    expect(retyped.location).toBe("Crosby Street, Manhattan, New York 10013");
  });

  it("keeps coordinates while the resolved label is retyped verbatim", () => {
    const placed = placedForm();
    const same = setLocationText(placed, ADDRESS);

    expect(same.site).toEqual(SITE);
    expect(same.resolvedLabel).toBe(ADDRESS);
  });

  it("keeps the user's typed address when the point is picked on the map instead", () => {
    // Geocode-failure fallback (Final Design §7.0): the provider could not place
    // the address, so the map crosshair supplies coordinates and the typed text
    // stays as Brief.location — never a guessed place name.
    const typed = setLocationText(emptyBriefForm(), "the old tram depot, Lisbon");
    const picked = pickSiteOnMap(typed, { lat: 38.7223, lon: -9.1393 });

    expect(picked.location).toBe("the old tram depot, Lisbon");
    expect(picked.site).toEqual({ lat: 38.7223, lon: -9.1393 });

    const submission = submitBriefForm({
      ...picked,
      objective: "A workshop that stays open to the neighbourhood."
    });

    expect(submission.ok).toBe(true);
    if (!submission.ok) return;
    expect(submission.brief.location).toBe("the old tram depot, Lisbon");
    expect(submission.brief.coordinates).toEqual({ lat: 38.7223, lon: -9.1393 });
    expect(() => briefSchema.parse(submission.brief)).not.toThrow();
  });
});

describe("S0 brief form — constraints and admired places", () => {
  it("submits selected adaptive preference phrases as plain strings", () => {
    let state = placedForm();
    state = toggleConstraint(state, "Walkable");
    state = toggleConstraint(state, "Transit-connected");

    const submission = submitBriefForm(state);
    expect(submission.ok).toBe(true);
    if (!submission.ok) return;
    expect(submission.brief.constraints).toEqual([
      "Walkable",
      "Transit-connected"
    ]);
    expect(submission.brief.constraints).not.toContain("Custom");
  });

  it("omits constraints entirely when no rectangle is on", () => {
    const submission = submitBriefForm(placedForm());
    expect(submission.ok).toBe(true);
    if (!submission.ok) return;
    expect(submission.brief.constraints).toBeUndefined();
  });

  it("exposes no hard-coded constraint rectangle list", () => {
    expect(COMMON_PREFERENCES).not.toContain("Custom");
    expect(COMMON_PREFERENCES).not.toContain("No late night");
  });

  it("keeps admired places to three and supports removal", () => {
    let state = placedForm();
    state = addAdmiredPlace(state, "  Mercer  ");
    state = addAdmiredPlace(state, "Kazakhstan");
    state = addAdmiredPlace(state, "Tartine");
    const atCap = addAdmiredPlace(state, "A fourth place");

    expect(atCap.admiredPlaces).toEqual(["Mercer", "Kazakhstan", "Tartine"]);
    expect(atCap.admiredPlaces).toHaveLength(MAX_ADMIRED_PLACES);
    expect(addAdmiredPlace(atCap, "   ").admiredPlaces).toEqual(atCap.admiredPlaces);

    const removed = removeAdmiredPlace(atCap, 1);
    expect(removed.admiredPlaces).toEqual(["Mercer", "Tartine"]);

    const submission = submitBriefForm(removed);
    expect(submission.ok).toBe(true);
    if (!submission.ok) return;
    expect(submission.brief.admiredPlaces).toEqual(["Mercer", "Tartine"]);
  });
});

describe("S0 brief form — submission", () => {
  it("builds a schema-valid Brief from a placed, filled form", () => {
    const submission = submitBriefForm(placedForm());

    expect(submission.ok).toBe(true);
    if (!submission.ok) return;
    expect(submission.brief).toEqual({
      location: ADDRESS,
      coordinates: SITE,
      radius: DEFAULT_RADIUS_M,
      areaSqFt: 28000,
      objective: GOAL
    });
    expect(() => briefSchema.parse(submission.brief)).not.toThrow();
  });

  it("returns field errors instead of a Brief when the form is incomplete", () => {
    const submission = submitBriefForm(emptyBriefForm());

    expect(submission.ok).toBe(false);
    if (submission.ok) return;
    expect(Object.keys(submission.errors).sort()).toEqual(["location", "objective", "site"]);
  });

  it("toggles a constraint rectangle on and off", () => {
    let state = placedForm();
    state = toggleConstraint(state, "No late night");
    expect(state.selectedConstraints).toEqual(["No late night"]);
    state = toggleConstraint(state, "No late night");
    expect(state.selectedConstraints).toEqual([]);
  });
});

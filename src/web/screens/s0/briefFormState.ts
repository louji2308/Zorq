/*
 * S0 custom-brief form logic — pure, DOM-free, unit-tested (tests/web/s0Brief.test.ts).
 *
 * Owns the form's state transitions and Brief construction so the React layer
 * only wires events. Validation mirrors `briefSchema` (src/shared/brief.ts) plus
 * the S0 rules the schema cannot express: a placed site (coordinates) is
 * required before the card expands past address search (Final Design §7.0
 * progressive disclosure), area must be positive when given, and the goal is
 * capped at 200 characters.
 */
import type { Brief } from "../../../shared/brief.js";

export interface SelectedQlooTag {
  readonly id: string;
  readonly label: string;
}

export interface SitePoint {
  readonly lat: number;
  readonly lon: number;
}

/** Qloo owns cultural suggestions; S0 stores only selected draft tags. */
export const MAX_OBJECTIVE_CHARS = 200;
export const MAX_ADMIRED_PLACES = 3;
export const MAX_SELECTED_QLOO_TAGS = 6;
/** Search radius (metres) attached to custom briefs so S0/S1 can draw the ring. */
export const DEFAULT_RADIUS_M = 400;

export interface BriefFormState {
  /** Raw address text as typed (or the picked suggestion label). */
  location: string;
  /** Label of the suggestion the user picked, if any (keeps text/point in sync). */
  resolvedLabel: string | null;
  /** Placed site — null until a suggestion is picked or the map is clicked. */
  site: SitePoint | null;
  area: string;
  objective: string;
  selectedQlooTags: readonly SelectedQlooTag[];
  admiredPlaces: readonly string[];
}

export interface BriefFormErrors {
  location?: string;
  site?: string;
  area?: string;
  objective?: string;
  admiredPlaces?: string;
}

export function emptyBriefForm(): BriefFormState {
  return {
    location: "",
    resolvedLabel: null,
    site: null,
    area: "",
    objective: "",
    selectedQlooTags: [],
    admiredPlaces: []
  };
}

/**
 * Typing invalidates a placed point unless the text still equals the label the
 * point was resolved from — coordinates must never outlive the address they
 * belong to (AGENTS §14: browser state is untrusted).
 */
export function setLocationText(state: BriefFormState, text: string): BriefFormState {
  if (state.resolvedLabel !== null && text === state.resolvedLabel) {
    return { ...state, location: text };
  }
  return { ...state, location: text, resolvedLabel: null, site: null };
}

/** The user chose a geocoding suggestion: adopt its label and coordinates. */
export function selectSuggestion(
  state: BriefFormState,
  suggestion: { label: string; lat: number; lon: number }
): BriefFormState {
  return {
    ...state,
    location: suggestion.label,
    resolvedLabel: suggestion.label,
    site: { lat: suggestion.lat, lon: suggestion.lon }
  };
}

/**
 * Geocode-failure fallback: click the crosshair map to place the point
 * (Final Design §9 "Address can't be placed"). The typed address text is kept
 * as Brief.location — it is the user's own words, never a guessed place name.
 */
export function pickSiteOnMap(state: BriefFormState, point: SitePoint): BriefFormState {
  return { ...state, site: { lat: point.lat, lon: point.lon } };
}

export function toggleQlooTag(state: BriefFormState, tag: SelectedQlooTag): BriefFormState {
  const id = tag.id.trim();
  const label = tag.label.trim();
  if (id === "" || label === "") return state;
  const selected = state.selectedQlooTags.some((value) => value.id === id)
    ? state.selectedQlooTags.filter((value) => value.id !== id)
    : state.selectedQlooTags.length >= MAX_SELECTED_QLOO_TAGS
      ? state.selectedQlooTags
      : [...state.selectedQlooTags, { id, label }];
  return { ...state, selectedQlooTags: selected };
}

export function addAdmiredPlace(state: BriefFormState, raw: string): BriefFormState {
  const name = raw.trim();
  if (name === "" || state.admiredPlaces.length >= MAX_ADMIRED_PLACES) return state;
  return { ...state, admiredPlaces: [...state.admiredPlaces, name] };
}

export function removeAdmiredPlace(state: BriefFormState, index: number): BriefFormState {
  return { ...state, admiredPlaces: state.admiredPlaces.filter((_, i) => i !== index) };
}

export function validateBriefForm(state: BriefFormState): BriefFormErrors {
  const errors: BriefFormErrors = {};

  if (state.location.trim() === "") {
    errors.location = "Enter an address for the site.";
  }
  if (state.site === null) {
    errors.site = "Place the site: pick an address suggestion or a point on the map.";
  }

  const area = state.area.trim();
  if (area !== "") {
    const value = Number(area);
    if (!Number.isFinite(value) || value <= 0) {
      errors.area = "Area must be a positive number of square feet.";
    }
  }

  const objective = state.objective.trim();
  if (objective === "") {
    errors.objective = "Add the goal for this site.";
  } else if (objective.length > MAX_OBJECTIVE_CHARS) {
    errors.objective = `Keep the goal to ${MAX_OBJECTIVE_CHARS} characters or fewer.`;
  }

  if (state.admiredPlaces.length > MAX_ADMIRED_PLACES) {
    errors.admiredPlaces = `Keep it to ${MAX_ADMIRED_PLACES} places.`;
  }

  return errors;
}

export type BriefFormSubmission =
  | { readonly ok: true; readonly brief: Brief }
  | { readonly ok: false; readonly errors: BriefFormErrors };

/** Validate and build the Brief the "Investigate this site" button submits. */
export function submitBriefForm(state: BriefFormState): BriefFormSubmission {
  const errors = validateBriefForm(state);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const area = state.area.trim();
  const constraints = state.selectedQlooTags.map((tag) => tag.label.trim()).filter((tag) => tag !== "");
  const admiredPlaces = state.admiredPlaces
    .map((place) => place.trim())
    .filter((place) => place !== "")
    .slice(0, MAX_ADMIRED_PLACES);

  const brief: Brief = {
    location: state.location.trim(),
    coordinates: state.site === null ? undefined : { lat: state.site.lat, lon: state.site.lon },
    radius: DEFAULT_RADIUS_M,
    areaSqFt: area === "" ? undefined : Number(area),
    objective: state.objective.trim(),
    constraints: constraints.length > 0 ? constraints : undefined,
    admiredPlaces: admiredPlaces.length > 0 ? admiredPlaces : undefined
  };

  return { ok: true, brief };
}

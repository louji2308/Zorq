/*
 * S0 brief card — progressive disclosure form (Final Design §7.0):
 * address search first; Area + Goal + constraints + admired places + the one
 * filled element on the screen ("Investigate this site") appear once the site
 * is placed. Owns no state — the screen owns it; this renders and reports.
 * Async run outcome (status + createRun failure) is owned and rendered by the
 * screen, not here, so it stays visible even before a site is placed.
 */
import { useState } from "react";
import { AddressSearch, type GeocodeState } from "./AddressSearch.js";
import {
  CONSTRAINT_CHIPS,
  MAX_ADMIRED_PLACES,
  MAX_OBJECTIVE_CHARS,
  type BriefFormErrors,
  type BriefFormState,
  type ConstraintChip
} from "./briefFormState.js";
import type { GeocodeSuggestion } from "../../lib/geocode.js";

export interface BriefFormProps {
  form: BriefFormState;
  errors: BriefFormErrors;
  notice: string | null;
  submitting: boolean;
  apiKey: string | null;
  onTextChange: (text: string) => void;
  onSelectSuggestion: (suggestion: GeocodeSuggestion) => void;
  onGeocodeState: (state: GeocodeState) => void;
  onFieldChange: (patch: Partial<BriefFormState>) => void;
  onToggleConstraint: (chip: ConstraintChip) => void;
  onAddAdmired: (name: string) => void;
  onRemoveAdmired: (index: number) => void;
  onSubmit: () => void;
}

function fieldError(errors: BriefFormErrors, key: keyof BriefFormErrors): string | undefined {
  return errors[key];
}

export function BriefForm(props: BriefFormProps) {
  const {
    form,
    errors,
    notice,
    submitting,
    apiKey,
    onTextChange,
    onSelectSuggestion,
    onGeocodeState,
    onFieldChange,
    onToggleConstraint,
    onAddAdmired,
    onRemoveAdmired,
    onSubmit
  } = props;

  const [admiredDraft, setAdmiredDraft] = useState("");
  const sitePlaced = form.site !== null;
  const canGeocode = apiKey !== null;

  const locationError = fieldError(errors, "location");
  const siteError = fieldError(errors, "site");
  const areaError = fieldError(errors, "area");
  const objectiveError = fieldError(errors, "objective");
  const customError = fieldError(errors, "customConstraint");
  const admiredError = fieldError(errors, "admiredPlaces");

  function commitAdmired(): void {
    if (admiredDraft.trim() === "") return;
    onAddAdmired(admiredDraft);
    setAdmiredDraft("");
  }

  return (
    <form
      className="s0-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <AddressSearch
        value={form.location}
        apiKey={apiKey}
        disabled={!canGeocode}
        notice={
          notice ??
          (canGeocode
            ? null
            : "Address search is unavailable in this build (no map key). Preset sites still work.")
        }
        onTextChange={onTextChange}
        onSelect={onSelectSuggestion}
        onGeocodeState={onGeocodeState}
      />
      {locationError && <p className="s0-error">{locationError}</p>}

      {!sitePlaced && (
        <p className="s0-section-hint">
          Pick a suggestion to place the site — or, if the address can&apos;t be found, click a
          point on the map.
        </p>
      )}

      {siteError && <p className="s0-error">{siteError}</p>}

      {sitePlaced && (
        <>
          <div className="s0-fields-row">
            <div className="s0-field s0-area">
              <div className="s0-label-row">
                <label className="s0-label" htmlFor="s0-area">
                  Area (sq ft)
                </label>
              </div>
              <input
                id="s0-area"
                className="s0-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={areaError !== undefined}
                aria-describedby={areaError ? "s0-area-error" : undefined}
                value={form.area}
                onChange={(event) => onFieldChange({ area: event.target.value })}
              />
              {areaError && (
                <p className="s0-error" id="s0-area-error">
                  {areaError}
                </p>
              )}
            </div>

            <div className="s0-field s0-goal">
              <div className="s0-label-row">
                <label className="s0-label" htmlFor="s0-goal">
                  Goal
                </label>
                <span className="s0-counter zq-nums">
                  {form.objective.length}/{MAX_OBJECTIVE_CHARS}
                </span>
              </div>
              <textarea
                id="s0-goal"
                className="s0-input s0-textarea"
                maxLength={MAX_OBJECTIVE_CHARS + 20}
                aria-invalid={objectiveError !== undefined}
                aria-describedby={objectiveError ? "s0-goal-error" : undefined}
                value={form.objective}
                onChange={(event) => onFieldChange({ objective: event.target.value })}
              />
              {objectiveError && (
                <p className="s0-error" id="s0-goal-error">
                  {objectiveError}
                </p>
              )}
            </div>
          </div>

          <fieldset className="s0-fieldset">
            <legend className="s0-label">Constraints</legend>
            <div className="s0-chips">
              {CONSTRAINT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="s0-chip"
                  aria-pressed={form.selectedConstraints.includes(chip)}
                  onClick={() => onToggleConstraint(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
            {form.selectedConstraints.includes("Custom") && (
              <div className="s0-custom-constraint">
                <input
                  id="s0-custom-constraint"
                  className="s0-input"
                  type="text"
                  placeholder="Describe your constraint"
                  aria-label="Custom constraint"
                  aria-invalid={customError !== undefined}
                  value={form.customConstraint}
                  onChange={(event) => onFieldChange({ customConstraint: event.target.value })}
                />
              </div>
            )}
            {customError && <p className="s0-error">{customError}</p>}
          </fieldset>

          <fieldset className="s0-fieldset">
            <legend className="s0-label">Places we admire (optional)</legend>
            {form.admiredPlaces.length > 0 && (
              <ul className="s0-admired-list">
                {form.admiredPlaces.map((place, index) => (
                  <li key={`${place}-${index}`} className="s0-admired-item">
                    <span className="s0-admired-mark" aria-hidden="true">
                      {place.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="s0-admired-name">{place}</span>
                    <button
                      type="button"
                      className="s0-remove"
                      aria-label={`Remove ${place}`}
                      onClick={() => onRemoveAdmired(index)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {form.admiredPlaces.length < MAX_ADMIRED_PLACES && (
              <div className="s0-custom-constraint">
                <input
                  id="s0-admired"
                  className="s0-input"
                  type="text"
                  placeholder="Name a place you admire"
                  aria-label="Add a place you admire"
                  value={admiredDraft}
                  onChange={(event) => setAdmiredDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitAdmired();
                    }
                  }}
                />
                <button type="button" className="s0-add-button" onClick={commitAdmired}>
                  Add
                </button>
              </div>
            )}
            {admiredError && <p className="s0-error">{admiredError}</p>}
            <p className="s0-note">
              Place suggestions are unavailable. You can still investigate this site.
            </p>
          </fieldset>

          <button type="submit" className="s0-cta" disabled={submitting}>
            {submitting ? "Starting the investigation…" : "Investigate this site"}
          </button>

          <a className="s0-method-link" href="/method">
            How Zorq measures
          </a>
        </>
      )}
    </form>
  );
}

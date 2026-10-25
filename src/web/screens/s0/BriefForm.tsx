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
  MAX_ADMIRED_PLACES,
  MAX_OBJECTIVE_CHARS,
  QLOO_TAG_STAGGER_MS,
  type BriefFormErrors,
  type BriefFormState,
  type SelectedQlooTag
} from "./briefFormState.js";
import type { GeocodeSuggestion } from "../../lib/geocode.js";
import type { QlooTagSuggestion } from "../../../shared/routes.js";

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
  qlooTags: readonly QlooTagSuggestion[];
  qlooTagNewIds: readonly string[];
  qlooTagLoading: boolean;
  qlooTagMessage: string | null;
  onToggleQlooTag: (tag: SelectedQlooTag) => void;
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
    qlooTags,
    qlooTagNewIds,
    qlooTagLoading,
    qlooTagMessage,
    onToggleQlooTag,
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
  const admiredError = fieldError(errors, "admiredPlaces");
  const selectedQlooTags = form.selectedQlooTags.map((tag) => ({
    ...tag,
    source: "qloo" as const,
    score: null
  }));
  const visibleQlooTags = [
    ...selectedQlooTags,
    ...qlooTags.filter((tag) => !form.selectedQlooTags.some((selected) => selected.id === tag.id))
  ];
  const qlooTagNewIndexes = new Map(qlooTagNewIds.map((id, index) => [id, index]));

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

          <fieldset className="s0-fieldset" aria-describedby="s0-qloo-tags-note">
            <legend className="s0-label s0-qloo-tags-label">Qloo-driven tags</legend>
            <p className="s0-preferences-note" id="s0-qloo-tags-note">
              Qloo reads the goal and site context to suggest related cultural signals.
              {qlooTagLoading ? " Reading the signal…" : ""}
            </p>
            <div className="s0-chips s0-qloo-tags-list" aria-label="Qloo-driven tags">
              {visibleQlooTags.map((tag) => {
                const selected = form.selectedQlooTags.some((value) => value.id === tag.id);
                const newIndex = qlooTagNewIndexes.get(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`s0-chip s0-qloo-tag${selected ? " is-selected" : ""}${
                      newIndex === undefined ? "" : " is-new"
                    }`}
                    style={
                      newIndex === undefined
                        ? undefined
                        : { animationDelay: `${newIndex * QLOO_TAG_STAGGER_MS}ms` }
                    }
                    aria-pressed={selected}
                    aria-label={`${tag.label}${selected ? ", selected; activate to remove" : ""}`}
                    onClick={() => onToggleQlooTag({ id: tag.id, label: tag.label })}
                  >
                    <span>{tag.label}</span>
                    {selected && (
                      <span className="s0-chip-remove" aria-hidden="true">
                        ×
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {qlooTagMessage && <p className="s0-qloo-tags-note">{qlooTagMessage}</p>}
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
              <div className="s0-admired-entry">
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

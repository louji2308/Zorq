/*
 * S0 Brief — route "/" (Product Spec §7 S0; Final Design §7.0).
 *
 * Layout authority is Final Design §7.0: full-height MapLibre hero on the left,
 * decision column on the right (wordmark + "How to read", Display-XL landing
 * line, three presets ABOVE the custom brief, then the progressive form, then
 * the numbered three-step strip).
 *
 * Ownership rules:
 *  - Presets seed a Brief only (presets.ts). The frozen Prior is built
 *    server-side by POST /api/runs — this screen never computes or fakes one.
 *  - The browser talks to MapTiler only (geocoding + tiles). NO Qloo calls:
 *    the QLOO key never reaches the bundle (AGENTS §14).
 *  - createRun failures are rendered verbatim from ApiClientError codes
 *    (runFailure.ts). No run id is ever invented; navigation only happens with
 *    an id the server returned.
 *  - Map/key failures degrade to an honest note (MapPanel); the right column
 *    and the preset path keep working without any map at all.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Brief } from "../../shared/brief.js";
import type { GeocodeSuggestion } from "../lib/geocode.js";
import { createRun } from "../lib/api.js";
import type { MapSite } from "../lib/map.js";
import { PRESETS, briefFromPreset, type PresetSite } from "../presets.js";
import type { GeocodeState } from "../screens/s0/AddressSearch.js";
import { BriefForm } from "../screens/s0/BriefForm.js";
import { MapPanel } from "../screens/s0/MapPanel.js";
import { PresetCard } from "../screens/s0/PresetCard.js";
import {
  DEFAULT_RADIUS_M,
  addAdmiredPlace,
  emptyBriefForm,
  pickSiteOnMap,
  removeAdmiredPlace,
  selectSuggestion,
  setLocationText,
  submitBriefForm,
  toggleConstraint,
  type BriefFormErrors,
  type BriefFormState,
  type ConstraintChip
} from "../screens/s0/briefFormState.js";
import { describeRunFailure, type RunFailureView } from "../screens/s0/runFailure.js";
import "../screens/s0/s0.css";

/** Verbatim Product Spec §7 S0 / Final Design §7.0 geocode-failure copy. */
export const GEOCODE_FAILURE_COPY = "We couldn't place that address. Pick a point on the map.";

/**
 * VITE_MAPTILER_KEY is public by design (D-6.1) and lands in the bundle; it is
 * never logged. An unset/blank key degrades to null so MapPanel can say so
 * honestly instead of requesting a style with an empty key.
 */
function readMapApiKey(): string | null {
  const value: unknown = import.meta.env.VITE_MAPTILER_KEY;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

const MAP_API_KEY = readMapApiKey();

export function HomeRoute() {
  const navigate = useNavigate();

  const [form, setForm] = useState<BriefFormState>(emptyBriefForm);
  const [errors, setErrors] = useState<BriefFormErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [failure, setFailure] = useState<RunFailureView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hovered, setHovered] = useState<PresetSite | null>(null);
  const [crosshair, setCrosshair] = useState(false);

  const presetSites = useMemo<MapSite[]>(
    () =>
      PRESETS.map((preset) => ({
        lat: preset.coordinates.lat,
        lon: preset.coordinates.lon,
        radiusM: preset.radiusM
      })),
    []
  );

  // Identity must be stable or MapPanel's focus effect would refly every render.
  const placedSite = form.site;
  const activeSite = useMemo<MapSite | null>(() => {
    if (hovered !== null) {
      return {
        lat: hovered.coordinates.lat,
        lon: hovered.coordinates.lon,
        radiusM: hovered.radiusM
      };
    }
    if (placedSite !== null) {
      return { lat: placedSite.lat, lon: placedSite.lon, radiusM: DEFAULT_RADIUS_M };
    }
    return null;
  }, [hovered, placedSite]);

  function clearErrors(keys: readonly (keyof BriefFormErrors)[]): void {
    setErrors((current) => {
      const next: BriefFormErrors = { ...current };
      for (const key of keys) next[key] = undefined;
      return next;
    });
  }

  async function startRun(brief: Brief): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setFailure(null);
    setErrors({});
    setStatus("Creating the run and freezing the Prior…");
    try {
      const run = await createRun(brief);
      setStatus(`Run ${run.id} created — opening the investigation…`);
      navigate(`/run/${run.id}`);
    } catch (error) {
      const view = describeRunFailure(error);
      setFailure(view);
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleTextChange(text: string): void {
    setForm((current) => setLocationText(current, text));
    setNotice(null);
    setCrosshair(false);
    clearErrors(["location", "site"]);
  }

  function handleSelectSuggestion(suggestion: GeocodeSuggestion): void {
    setForm((current) => selectSuggestion(current, suggestion));
    setNotice(null);
    setCrosshair(false);
    clearErrors(["location", "site"]);
  }

  function handleGeocodeState(state: GeocodeState): void {
    if (state === "empty" || state === "failed") {
      setNotice(GEOCODE_FAILURE_COPY);
      setCrosshair(true);
      return;
    }
    setNotice(null);
    setCrosshair(false);
  }

  function handleSitePick(point: { lat: number; lon: number }): void {
    setForm((current) => pickSiteOnMap(current, point));
    setNotice(null);
    setCrosshair(false);
    clearErrors(["site"]);
  }

  function handleFieldChange(patch: Partial<BriefFormState>): void {
    setForm((current) => ({ ...current, ...patch }));
    const touched: (keyof BriefFormErrors)[] = [];
    if (patch.location !== undefined) touched.push("location");
    if (patch.site !== undefined) touched.push("site");
    if (patch.area !== undefined) touched.push("area");
    if (patch.objective !== undefined) touched.push("objective");
    if (patch.customConstraint !== undefined) touched.push("customConstraint");
    if (patch.admiredPlaces !== undefined) touched.push("admiredPlaces");
    if (touched.length > 0) clearErrors(touched);
  }

  function handleSubmit(): void {
    const submission = submitBriefForm(form);
    if (!submission.ok) {
      setFailure(null);
      setStatus(null);
      setErrors(submission.errors);
      return;
    }
    setErrors({});
    void startRun(submission.brief);
  }

  return (
    <div className="s0">
      <MapPanel
        apiKey={MAP_API_KEY}
        presets={presetSites}
        activeSite={activeSite}
        crosshair={crosshair}
        onSitePick={handleSitePick}
      />

      <div className="s0-side">
        <header className="s0-topbar">
          <h1 className="s0-wordmark">Zorq</h1>
          <Link className="s0-tertiary" to="/method">
            How to read
          </Link>
        </header>

        <main className="s0-main">
          <div className="s0-section">
            <h2 className="s0-landing">Design what belongs together on a site.</h2>
            <p className="s0-support">
              Zorq reads the culture around a site, tests which combinations of places belong
              together, then tries to break its own answer.
            </p>
          </div>

          <section className="s0-section" aria-labelledby="s0-try-title">
            <h2 className="s0-section-title" id="s0-try-title">
              Try a site
            </h2>
            <div className="s0-presets">
              {PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  busy={submitting}
                  onFocusSite={setHovered}
                  onLeaveSite={() => setHovered(null)}
                  onActivate={(chosen) => {
                    void startRun(briefFromPreset(chosen));
                  }}
                />
              ))}
            </div>
          </section>

          <section className="s0-section" aria-labelledby="s0-custom-title">
            <h2 className="s0-section-title" id="s0-custom-title">
              Or describe your own site
            </h2>
            <BriefForm
              form={form}
              errors={errors}
              notice={notice}
              submitting={submitting}
              apiKey={MAP_API_KEY}
              onTextChange={handleTextChange}
              onSelectSuggestion={handleSelectSuggestion}
              onGeocodeState={handleGeocodeState}
              onFieldChange={handleFieldChange}
              onToggleConstraint={(chip: ConstraintChip) => {
                setForm((current) => toggleConstraint(current, chip));
                clearErrors(["customConstraint"]);
              }}
              onAddAdmired={(name) => setForm((current) => addAdmiredPlace(current, name))}
              onRemoveAdmired={(index) =>
                setForm((current) => removeAdmiredPlace(current, index))
              }
              onSubmit={handleSubmit}
            />
          </section>

          {/* Single async outcome region — always in the DOM so aria-live can announce
              preset submissions too (the CTA only exists once a site is placed). */}
          <div className="s0-field" role="status" aria-live="polite">
            <p className="s0-status">{status ?? ""}</p>
            {failure !== null && (
              <>
                <p className="s0-error">{failure.message}</p>
                {Object.keys(failure.fieldErrors).length > 0 && (
                  <ul className="s0-error-list">
                    {Object.entries(failure.fieldErrors).map(([field, message]) => (
                      <li key={field} className="s0-error">
                        {message}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <ol className="s0-steps">
            <li>1 Read the culture.</li>
            <li>2 Test combinations.</li>
            <li>3 Challenge the answer.</li>
          </ol>
        </main>
      </div>
    </div>
  );
}

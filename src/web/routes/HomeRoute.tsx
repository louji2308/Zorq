/*
 * S0 Brief — route "/" (Product Spec §7 S0; Final Design §7.0).
 *
 * Layout authority is Final Design §7.0: full-height MapLibre hero on the left,
 * decision column on the right (wordmark + "How to read", Display-XL landing
 * line, the custom brief, then the numbered three-step strip).
 *
 * Ownership rules:
 *  - The custom brief seeds a Brief only. The frozen Prior is built server-side
 *    by POST /api/runs — this screen never computes or fakes one.
 *  - The browser talks to MapTiler for geocoding/tiles and to a same-origin
 *    server route for the bounded Qloo tag preview. The Qloo key never reaches
 *    the key never reaches the bundle (AGENTS §14).
 *  - createRun failures are rendered verbatim from ApiClientError codes
 *    (runFailure.ts). No run id is ever invented; navigation only happens with
 *    an id the server returned.
 *  - Map/key failures degrade to an honest note (MapPanel); the right column
 *    and the brief path keep working without any map at all.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Brief } from "../../shared/brief.js";
import type { GeocodeSuggestion } from "../lib/geocode.js";
import { createRun, getQlooTagSuggestions } from "../lib/api.js";
import type { QlooTagSuggestion } from "../../shared/routes.js";
import type { MapSite } from "../lib/map.js";
import type { GeocodeState } from "../screens/s0/AddressSearch.js";
import { BriefForm } from "../screens/s0/BriefForm.js";
import { MapPanel } from "../screens/s0/MapPanel.js";
import {
  DEFAULT_RADIUS_M,
  mergeQlooTagSuggestions,
  addAdmiredPlace,
  emptyBriefForm,
  pickSiteOnMap,
  removeAdmiredPlace,
  selectSuggestion,
  setLocationText,
  submitBriefForm,
  toggleQlooTag,
  type BriefFormErrors,
  type BriefFormState
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
/**
 * How long the goal/site draft must settle before the preview is requested.
 * 650 ms made the rail feel dead: it added half a second on top of the server's
 * Qloo round trips (measured ~5.3 s live before parallelising tag resolution).
 * 300 ms still coalesces normal typing, and later edits only append new signals
 * because the request is aborted and superseded by the effect cleanup below.
 */
const QLOO_TAG_DEBOUNCE_MS = 300;
const QLOO_TAG_UNAVAILABLE = "Qloo-driven tags are unavailable right now. You can continue without them.";

export function HomeRoute() {
  const navigate = useNavigate();

  const [form, setForm] = useState<BriefFormState>(emptyBriefForm);
  const [errors, setErrors] = useState<BriefFormErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [failure, setFailure] = useState<RunFailureView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [crosshair, setCrosshair] = useState(false);
  const [qlooTags, setQlooTags] = useState<readonly QlooTagSuggestion[]>([]);
  const [qlooTagNewIds, setQlooTagNewIds] = useState<readonly string[]>([]);
  const [qlooTagLoading, setQlooTagLoading] = useState(false);
  const [qlooTagMessage, setQlooTagMessage] = useState<string | null>(null);
  const qlooRequestSequence = useRef(0);
  const qlooTagsRef = useRef<readonly QlooTagSuggestion[]>([]);
  const qlooTagSiteKey = useRef<string | null>(null);

  const emptyMapSites = useMemo<readonly MapSite[]>(() => [], []);
  const placedSite = form.site;
  const activeSite = useMemo<MapSite | null>(
    () => (placedSite === null ? null : { lat: placedSite.lat, lon: placedSite.lon, radiusM: DEFAULT_RADIUS_M }),
    [placedSite]
  );

  useEffect(() => {
    const site = form.site;
    const location = form.location.trim();
    const objective = form.objective.trim();
    const selectedTagIds = form.selectedQlooTags.map((tag) => tag.id);
    const siteKey = site === null ? null : `${site.lat}:${site.lon}`;
    const requestSequence = qlooRequestSequence.current + 1;
    qlooRequestSequence.current = requestSequence;

    if (qlooTagSiteKey.current !== siteKey) {
      qlooTagSiteKey.current = siteKey;
      qlooTagsRef.current = [];
      setQlooTags([]);
      setQlooTagNewIds([]);
    }

    if (site === null || location === "" || objective.length < 3) {
      setQlooTagLoading(false);
      setQlooTagMessage(null);
      return;
    }

    const controller = new AbortController();
    setQlooTagLoading(true);
    setQlooTagMessage(null);

    const timer = window.setTimeout(() => {
      void getQlooTagSuggestions(
        {
          location,
          coordinates: { lat: site.lat, lon: site.lon },
          objective,
          selectedTagIds
        },
        { signal: controller.signal }
      )
        .then((result) => {
          if (qlooRequestSequence.current !== requestSequence) return;
          const merged = mergeQlooTagSuggestions(qlooTagsRef.current, result.tags);
          qlooTagsRef.current = merged.tags;
          setQlooTags(merged.tags);
          setQlooTagNewIds((currentIds) => [...new Set([...currentIds, ...merged.addedIds])]);
          setQlooTagMessage(merged.tags.length === 0 ? result.message ?? null : null);
        })
        .catch(() => {
          if (controller.signal.aborted || qlooRequestSequence.current !== requestSequence) return;
          setQlooTagMessage((current) =>
            qlooTagsRef.current.length === 0 ? QLOO_TAG_UNAVAILABLE : current
          );
        })
        .finally(() => {
          if (!controller.signal.aborted && qlooRequestSequence.current === requestSequence) {
            setQlooTagLoading(false);
          }
        });
    }, QLOO_TAG_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (qlooRequestSequence.current === requestSequence) {
        qlooRequestSequence.current += 1;
      }
    };
  }, [form.location, form.objective, form.site, form.selectedQlooTags]);

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
        presets={emptyMapSites}
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
              qlooTags={qlooTags}
              qlooTagNewIds={qlooTagNewIds}
              qlooTagLoading={qlooTagLoading}
              qlooTagMessage={qlooTagMessage}
              onToggleQlooTag={(tag) => setForm((current) => toggleQlooTag(current, tag))}
              onAddAdmired={(name) => setForm((current) => addAdmiredPlace(current, name))}
              onRemoveAdmired={(index) =>
                setForm((current) => removeAdmiredPlace(current, index))
              }
              onSubmit={handleSubmit}
            />
          </section>

          {/* Single async outcome region — always in the DOM so aria-live can announce
              submissions (the CTA only exists once a site is placed). */}
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

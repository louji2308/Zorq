/*
 * S0 map panel: hosts the MapLibre container, the drafting chrome and the
 * honest fallbacks (missing key / unreachable style) that keep the right
 * column usable no matter what the tiles do.
 */
import { useEffect, useRef, useState } from "react";
import { scheduleDeferred } from "../../lib/deferred.js";
import type { MapSite, S0MapHandle } from "../../lib/map.js";

export type MapPanelStatus = "no-key" | "loading" | "ready" | "failed";

export interface MapPanelProps {
  /** null when VITE_MAPTILER_KEY is missing — rendered as an honest note. */
  apiKey: string | null;
  presets: readonly MapSite[];
  /** Site the camera flies to (preset hover/focus, or the placed form site). */
  activeSite: MapSite | null;
  crosshair: boolean;
  onSitePick: (point: { lat: number; lon: number }) => void;
}

export function MapPanel({ apiKey, presets, activeSite, crosshair, onSitePick }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<S0MapHandle | null>(null);
  const onSitePickRef = useRef(onSitePick);
  const presetsRef = useRef(presets);
  const activeSiteRef = useRef(activeSite);
  const crosshairRef = useRef(crosshair);
  onSitePickRef.current = onSitePick;
  presetsRef.current = presets;
  activeSiteRef.current = activeSite;
  crosshairRef.current = crosshair;

  const [status, setStatus] = useState<MapPanelStatus>(apiKey === null ? "no-key" : "loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (apiKey === null) {
      setStatus("no-key");
      return;
    }
    const container = containerRef.current;
    if (container === null) return;

    let cancelled = false;
    let handle: S0MapHandle | null = null;
    setStatus("loading");
    const cancelDeferred = scheduleDeferred(() => {
      void import("../../lib/map.js")
        .then(({ createS0Map }) => {
          if (cancelled) return;
          handle = createS0Map(container, {
            apiKey,
            onSitePick: (point) => onSitePickRef.current(point),
            onReady: () => setStatus("ready"),
            onFailure: () => setStatus("failed")
          });
          handleRef.current = handle;
          handle.setPresets(presetsRef.current);
          handle.focusSite(activeSiteRef.current, false);
          handle.setCrosshair(crosshairRef.current);
        })
        .catch(() => {
          if (!cancelled) setStatus("failed");
        });
    });

    return () => {
      cancelled = true;
      cancelDeferred();
      handle?.destroy();
      handleRef.current = null;
    };
  }, [apiKey, attempt]);

  useEffect(() => {
    handleRef.current?.setPresets(presets);
  }, [presets, attempt]);

  useEffect(() => {
    handleRef.current?.focusSite(activeSite);
  }, [activeSite, attempt]);

  useEffect(() => {
    handleRef.current?.setCrosshair(crosshair);
  }, [crosshair, attempt]);

  return (
    <section className="s0-map" aria-label="Site map">
      <div className="s0-map-canvas" ref={containerRef} />
      {status === "loading" && <p className="s0-map-loading">Loading map…</p>}
      {status === "no-key" && (
        <div className="s0-map-veil">
          <p>
            Map unavailable: this build has no map key. Preset sites still work — choose one above.
          </p>
        </div>
      )}
      {status === "failed" && (
        <div className="s0-map-veil" role="status">
          <p>
            The map couldn&apos;t load — the style or tiles never arrived. The rest of this page
            works; you can still choose a site.
          </p>
          <button type="button" className="s0-add-button" onClick={() => setAttempt((n) => n + 1)}>
            Try the map again
          </button>
        </div>
      )}
    </section>
  );
}

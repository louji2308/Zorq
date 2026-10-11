/*
 * S1 investigation map: the persistent map (Final Design §7.1 map details).
 * Hosts the same createS0Map handle S0 uses, driven by REAL run data only:
 *  - site crosshair + dashed radius ring from the brief's coordinates/radius;
 *  - lettered anchor squares and halftone heat dots ONLY when run.siteRead
 *    carries them (today it never does — empty arrays, never synthetic);
 *  - the drafting chrome (north arrow + scale bar) comes from map.ts.
 * Honest fallbacks for a missing key or unreachable style keep the ledger
 * usable no matter what the tiles do.
 */
import { useEffect, useRef, useState } from "react";
import { createS0Map, type MapAnchor, type MapHeatPoint, type S0MapHandle } from "../../lib/map.js";
import type { S1Site } from "./s1Model.js";

export type S1MapStatus = "no-key" | "loading" | "ready" | "failed";

export interface InvestigateMapProps {
  apiKey: string | null;
  site: S1Site | null;
  anchors: readonly MapAnchor[];
  heat: readonly MapHeatPoint[];
}

export function InvestigateMap({ apiKey, site, anchors, heat }: InvestigateMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<S0MapHandle | null>(null);

  const [status, setStatus] = useState<S1MapStatus>(apiKey === null ? "no-key" : "loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (apiKey === null) {
      setStatus("no-key");
      return;
    }
    const container = containerRef.current;
    if (container === null) return;

    setStatus("loading");
    const handle = createS0Map(container, {
      apiKey,
      onReady: () => setStatus("ready"),
      onFailure: () => setStatus("failed")
    });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, [apiKey, attempt]);

  useEffect(() => {
    handleRef.current?.focusSite(site === null ? null : { ...site });
  }, [site, attempt]);

  useEffect(() => {
    handleRef.current?.setAnchors(anchors);
  }, [anchors, attempt]);

  useEffect(() => {
    handleRef.current?.setHeat(heat);
  }, [heat, attempt]);

  return (
    <section className="s1-map-panel" aria-label="Site map">
      <div className="s1-map-canvas" ref={containerRef} />
      {status === "loading" && <p className="s1-map-loading">Loading map…</p>}
      {status === "no-key" && (
        <div className="s1-map-veil">
          <p>
            Map unavailable: this build has no map key. The ledger and Prior still work — this
            investigation is unfolding on the right.
          </p>
        </div>
      )}
      {status === "failed" && (
        <div className="s1-map-veil" role="status">
          <p>
            The map couldn&apos;t load — the style or tiles never arrived. The investigation keeps
            running; the ledger on the right shows every step.
          </p>
          <button type="button" className="s1-secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try the map again
          </button>
        </div>
      )}
    </section>
  );
}

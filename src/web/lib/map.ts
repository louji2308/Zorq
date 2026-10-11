/*
 * MapLibre + MapTiler helper shared by S0 (this screen) and later screens.
 *
 * Surface (documented handoff for W-6.3; S1 additions are additive):
 *   createS0Map(container, { apiKey, onSitePick?, onReady?, onFailure? }) -> handle
 *   handle.setPresets(sites)          small site markers (no ring)
 *   handle.focusSite(site | null)     fly/jump the camera + draw the radius ring
 *   handle.setCrosshair(active)       geocode-failure point-pick mode
 *   handle.setAnchors(anchors)        lettered square pins (S1; empty = clear)
 *   handle.setHeat(points)            halftone heat dots (S1; empty = clear)
 *   handle.resize() / handle.destroy()
 *
 * Conventions (Final Design §7.1 map details, shared by S0):
 *   - site marker = circle with crosshair; search radius = chain (dashed) ring;
 *   - north arrow bottom-left and graphic scale bar bottom-left, always visible;
 *   - no control clutter: attribution only, no nav/zoom buttons.
 *
 * Design locks:
 *   - colours come from CSS tokens (--zq-*) read at runtime; keyword
 *     fallbacks ("black"/"white") are used only if a token is missing — no
 *     hex literals are introduced here;
 *   - fly-to honours prefers-reduced-motion (jump instead of animate);
 *   - failing styles/tiles report onFailure — the caller keeps rendering the
 *     rest of the page (never a white hole, never a hang).
 *
 * The MapTiler key is public by design (VITE_ prefix, D-6.1) and is never
 * logged or printed.
 *
 * Bundling note: MapLibre v6 resolves its worker indirectly (build
 * `new URL("./maplibre-gl-worker.mjs", import.meta.url)`, then read `.href`),
 * which Vite's worker detection does not rewrite — a bundled build would point
 * at a file that is never emitted and every map would die with "Worker failed
 * to load" before firing `load`. The `?url` import below makes Vite emit the
 * worker under a hashed same-origin path and pins MapLibre to it (same-origin,
 * so it stays inside helmet's default `default-src 'self'` CSP).
 */
import type { FeatureCollection, LineString, Point } from "geojson";
import { GeoJSONSource, Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(workerUrl);

export interface MapSite {
  readonly lat: number;
  readonly lon: number;
  /** Radius in metres; draws the chain ring when the site is focused. */
  readonly radiusM?: number;
}

/** S1 anchor pin: a small solid square lettered A–E (Final Design §7.1). */
export interface MapAnchor {
  readonly lat: number;
  readonly lon: number;
  readonly letter: string;
}

/** S1 heat point: halftone dot; weight 0..1 encodes affinity in four size steps. */
export interface MapHeatPoint {
  readonly lat: number;
  readonly lon: number;
  readonly weight: number;
}

export type MapFailureReason = "no-style" | "timeout";

export interface S0MapOptions {
  apiKey: string;
  /** Called when the map is clicked while crosshair mode is active. */
  onSitePick?: (point: { lat: number; lon: number }) => void;
  onReady?: () => void;
  onFailure?: (reason: MapFailureReason) => void;
}

export interface S0MapHandle {
  setPresets(sites: readonly MapSite[]): void;
  /** Fly to a site and draw its radius ring; null clears ring + active marker. */
  focusSite(site: MapSite | null, animate?: boolean): void;
  setCrosshair(active: boolean): void;
  /** S1: lettered anchor squares; empty array clears. Safe no-op until load. */
  setAnchors(anchors: readonly MapAnchor[]): void;
  /** S1: halftone heat dots (weight 0..1, four size steps); empty clears. */
  setHeat(points: readonly MapHeatPoint[]): void;
  resize(): void;
  destroy(): void;
}

const STYLE_URL = "https://api.maptiler.com/maps/streets-v2/style.json";
/** Final Design §8: "Map fly-to on preset hover | 400 ms". */
const FLY_MS = 400;
/** Fallback view when there are no preset markers (continental US). */
const INITIAL_CENTER: [number, number] = [-80.4, 38.4];
const INITIAL_ZOOM = 4.6;
const FAILURE_TIMEOUT_MS = 15_000;
const RING_SEGMENTS = 96;
/** Circumference of the web-mercator world at zoom 0 for 512 px tiles. */
const WORLD_PIXELS_Z0 = 512;

const SITES_SOURCE = "zq-sites";
const RING_SOURCE = "zq-ring";
const CROSS_SOURCE = "zq-cross";
const ANCHOR_SOURCE = "zq-anchors";
const HEAT_SOURCE = "zq-heat";
const RING_LAYER = "zq-site-ring";
const CROSS_LAYER = "zq-site-cross";
const PRESET_DOT_LAYER = "zq-site-dot-preset";
const ACTIVE_DOT_LAYER = "zq-site-dot-active";
const ANCHOR_LAYER = "zq-anchor-pins";
const HEAT_LAYER = "zq-heat-dots";
/** Anchor icons are drawn once per letter; the design only uses A–E. */
const ANCHOR_ICON_LETTERS = ["A", "B", "C", "D", "E"];
/** Final Design §7.1: dot diameter encodes affinity in four steps. */
const HEAT_RADIUS_STEPS = [2.5, 4, 5.5, 7];
const BLANK_STYLE_IMAGE = " ";

export function mapTilerStyleUrl(apiKey: string): string {
  return `${STYLE_URL}?key=${encodeURIComponent(apiKey)}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Read a design token at runtime so map paint stays inside tokens.css. */
function token(name: string, fallback: "black" | "white"): string {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value === "" ? fallback : value;
}

function ringLineString(site: MapSite): LineString {
  const radiusM = site.radiusM ?? 0;
  const latRad = (site.lat * Math.PI) / 180;
  const dLat = (radiusM / 6378137) * (180 / Math.PI);
  const dLon = dLat / Math.max(Math.cos(latRad), 1e-6);
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= RING_SEGMENTS; i += 1) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2;
    const lat = site.lat + dLat * Math.sin(angle);
    const lon = site.lon + dLon * Math.cos(angle);
    coordinates.push([lon, lat]);
  }
  return { type: "LineString", coordinates };
}

function emptyPoints(): FeatureCollection<Point> {
  return { type: "FeatureCollection", features: [] };
}

function emptyLines(): FeatureCollection<LineString> {
  return { type: "FeatureCollection", features: [] };
}

/** Small solid square with a letter (Final Design §7.1 anchor pins), drawn
 *  once per letter from design tokens — no image assets, no colour literals.
 *  Returns ImageData because MapLibre's addImage types (StyleImageSource)
 *  exclude HTMLCanvasElement; null when a 2d context is unavailable. */
function anchorIconImageData(letter: string, ink: string, paper: string): ImageData | null {
  const size = 28;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }
  const square = 22;
  const offset = (size - square) / 2;
  context.fillStyle = ink;
  context.fillRect(offset, offset, square, square);
  context.fillStyle = paper;
  context.font = "600 14px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(letter, size / 2, size / 2 + 1);
  return context.getImageData(0, 0, size, size);
}

/** Four-step halftone radius from a 0..1 affinity weight. */
function heatRadiusStep(weight: number): number {
  const clamped = Math.min(Math.max(weight, 0), 1);
  const index = Math.min(Math.floor(clamped * HEAT_RADIUS_STEPS.length), HEAT_RADIUS_STEPS.length - 1);
  return HEAT_RADIUS_STEPS[index] ?? HEAT_RADIUS_STEPS[0];
}

interface ChromeHandle {
  update(): void;
  destroy(): void;
}

function createMapChrome(container: HTMLElement, map: MapLibreMap): ChromeHandle {
  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText =
    "position:absolute;left:16px;bottom:16px;display:flex;align-items:flex-end;gap:12px;" +
    "pointer-events:none;z-index:2;font-family:var(--zq-font-ui);color:var(--zq-ink);";

  const north = document.createElement("div");
  north.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--zq-paper);" +
    "border:var(--zq-l2) solid var(--zq-ink-350);padding:6px 6px 4px;";
  const needle = document.createElement("div");
  needle.style.cssText = "transition:transform var(--zq-motion-flyto) var(--zq-ease-out);";
  needle.innerHTML =
    '<svg width="20" height="26" viewBox="0 0 20 26" focusable="false">' +
    '<path d="M10 2 L16 22 L10 18 Z M10 2 L4 22 L10 18 Z" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linejoin="miter"/></svg>';
  const northLabel = document.createElement("span");
  northLabel.style.cssText =
    "font-size:13px;font-weight:600;line-height:1;letter-spacing:0.04em;";
  northLabel.textContent = "N";
  north.append(needle, northLabel);

  const scale = document.createElement("div");
  scale.style.cssText =
    "display:flex;flex-direction:column;gap:2px;background:var(--zq-paper);" +
    "border:var(--zq-l2) solid var(--zq-ink-350);padding:4px 8px 6px;min-width:104px;";
  const scaleLabel = document.createElement("span");
  scaleLabel.style.cssText = "font-size:13px;font-weight:600;line-height:1;";
  const scaleBar = document.createElement("div");
  scaleBar.style.cssText = "display:flex;height:8px;border:var(--zq-l2) solid var(--zq-ink);";
  const segments: HTMLDivElement[] = [];
  for (let i = 0; i < 4; i += 1) {
    const segment = document.createElement("div");
    segment.style.cssText = `flex:1;background:${i % 2 === 0 ? "var(--zq-ink)" : "var(--zq-paper)"};`;
    segments.push(segment);
    scaleBar.append(segment);
  }
  scale.append(scaleLabel, scaleBar);

  wrap.append(north, scale);
  container.append(wrap);

  const SCALE_TARGET_PX = 76;
  const SCALE_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000];

  function update(): void {
    const latitude = map.getCenter().lat;
    const zoom = map.getZoom();
    const metersPerPixel =
      (40_075_016.686 * Math.max(Math.cos((latitude * Math.PI) / 180), 1e-6)) /
      (WORLD_PIXELS_Z0 * Math.pow(2, zoom));
    let chosen = SCALE_STEPS[0];
    for (const step of SCALE_STEPS) {
      if (step / metersPerPixel <= SCALE_TARGET_PX) chosen = step;
      else break;
    }
    const widthPx = Math.max(16, Math.round(chosen / metersPerPixel));
    scaleBar.style.width = `${widthPx}px`;
    scaleLabel.textContent = chosen >= 1000 ? `${chosen / 1000} km` : `${chosen} m`;
    needle.style.transform = `rotate(${-map.getBearing()}deg)`;
  }

  return {
    update,
    destroy(): void {
      wrap.remove();
    }
  };
}

/**
 * Create the S0 map inside `container` (which must have an explicit CSS size).
 * Construction is synchronous; layer wiring happens on the map's first "load".
 */
export function createS0Map(container: HTMLElement, options: S0MapOptions): S0MapHandle {
  const ink = token("--zq-ink", "black");
  const paper = token("--zq-paper", "white");

  let destroyed = false;
  let layersReady = false;
  let failureReported = false;
  let presets: readonly MapSite[] = [];
  let active: MapSite | null = null;
  let crosshair = false;
  let presetBoundsFitted = false;
  let anchors: readonly MapAnchor[] = [];
  let heat: readonly MapHeatPoint[] = [];
  const anchorIcons = new Set<string>();

  const map = new MapLibreMap({
    container,
    style: mapTilerStyleUrl(options.apiKey),
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    minZoom: 3,
    maxZoom: 17,
    maxPitch: 0,
    dragRotate: false,
    keyboard: false,
    attributionControl: { compact: true }
  });
  (window as unknown as Record<string, unknown>).__zqMap = map;
  (window as unknown as Record<string, unknown>).__zqDbg = {};

  map.setMissingStyleImageResolver((id) => {
    if (id === BLANK_STYLE_IMAGE && !map.hasImage(id)) {
      map.addImage(id, new ImageData(1, 1));
    }
  });

  const chrome = createMapChrome(container, map);

  const failureTimer =
    typeof window === "undefined"
      ? undefined
      : window.setTimeout(() => reportFailure("timeout"), FAILURE_TIMEOUT_MS);

  const resizeFrame =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(() => {
          if (!destroyed) map.resize();
        })
      : undefined;

  function reportFailure(reason: MapFailureReason): void {
    if (destroyed || failureReported || layersReady) return;
    failureReported = true;
    if (failureTimer !== undefined) window.clearTimeout(failureTimer);
    options.onFailure?.(reason);
  }

  function setData(sourceId: string, data: FeatureCollection<Point> | FeatureCollection<LineString>): void {
    if (!layersReady) return;
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    source?.setData(data);
  }

  function applyPresets(): void {
    setData(SITES_SOURCE, {
      type: "FeatureCollection",
      features: presets.map((site) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [site.lon, site.lat] as [number, number] },
        properties: { role: "preset" }
      }))
    });
  }

  /**
   * Crosshair for the active site in *pixels* (a marker must not grow with
   * ground scale), so it is recomputed from the current camera on every move.
   */
  function activeCrossCollection(): FeatureCollection<LineString> {
    if (active === null) return emptyLines();
    const halfPx = 14;
    const latRad = (active.lat * Math.PI) / 180;
    const metersPerPixel =
      (40_075_016.686 * Math.max(Math.cos(latRad), 1e-6)) /
      (WORLD_PIXELS_Z0 * Math.pow(2, map.getZoom()));
    const dLat = (halfPx * metersPerPixel) / 111_320;
    const dLon = dLat / Math.max(Math.cos(latRad), 1e-6);
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [active.lon, active.lat - dLat],
              [active.lon, active.lat + dLat]
            ]
          },
          properties: {}
        },
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [active.lon - dLon, active.lat],
              [active.lon + dLon, active.lat]
            ]
          },
          properties: {}
        }
      ]
    };
  }

  function applyActive(): void {
    if (!layersReady) return;
    if (active === null) {
      setData(RING_SOURCE, emptyLines());
      setData(CROSS_SOURCE, emptyLines());
      applyPresets();
      return;
    }
    setData(RING_SOURCE, {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: ringLineString(active),
          properties: {}
        }
      ]
    });
    setData(CROSS_SOURCE, activeCrossCollection());
    setData(SITES_SOURCE, {
      type: "FeatureCollection",
      features: [
        ...presets.map((site) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [site.lon, site.lat] as [number, number] },
          properties: { role: "preset" }
        })),
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [active.lon, active.lat] as [number, number]
          },
          properties: { role: "active" }
        }
      ]
    });
  }

  function ensureAnchorIcon(letter: string, ink: string, paper: string): void {
    const id = `zq-anchor-${letter}`;
    if (anchorIcons.has(id) || map.hasImage(id)) {
      return;
    }
    const image = anchorIconImageData(letter, ink, paper);
    if (image === null) {
      return;
    }
    map.addImage(id, image, { pixelRatio: 2 });
    anchorIcons.add(id);
  }

  function applyAnchors(): void {
    if (!layersReady) return;
    for (const anchor of anchors) {
      ensureAnchorIcon(anchor.letter.toUpperCase(), ink, paper);
    }
    setData(ANCHOR_SOURCE, {
      type: "FeatureCollection",
      features: anchors.map((anchor) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [anchor.lon, anchor.lat] as [number, number] },
        properties: {
          letter: anchor.letter.toUpperCase(),
          icon: `zq-anchor-${anchor.letter.toUpperCase()}`,
          order: anchor.letter.toUpperCase().charCodeAt(0)
        }
      }))
    });
  }

  function applyHeat(): void {
    if (!layersReady) return;
    setData(HEAT_SOURCE, {
      type: "FeatureCollection",
      features: heat.map((point) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [point.lon, point.lat] as [number, number] },
        properties: { r: heatRadiusStep(point.weight) }
      }))
    });
  }

  function installLayers(): void {
    if (map.getSource(SITES_SOURCE) !== undefined) return;

    map.addSource(SITES_SOURCE, { type: "geojson", data: emptyPoints() });
    map.addSource(RING_SOURCE, { type: "geojson", data: emptyLines() });
    map.addSource(CROSS_SOURCE, { type: "geojson", data: emptyLines() });

    map.addLayer({
      id: RING_LAYER,
      type: "line",
      source: RING_SOURCE,
      paint: {
        "line-color": ink,
        "line-width": 2,
        "line-dasharray": [6, 4]
      }
    });
    map.addLayer({
      id: CROSS_LAYER,
      type: "line",
      source: CROSS_SOURCE,
      paint: { "line-color": ink, "line-width": 1.5 }
    });
    map.addLayer({
      id: PRESET_DOT_LAYER,
      type: "circle",
      source: SITES_SOURCE,
      filter: ["==", ["get", "role"], "preset"],
      paint: {
        "circle-radius": 7,
        "circle-color": paper,
        "circle-stroke-color": ink,
        "circle-stroke-width": 2
      }
    });
    map.addLayer({
      id: ACTIVE_DOT_LAYER,
      type: "circle",
      source: SITES_SOURCE,
      filter: ["==", ["get", "role"], "active"],
      paint: {
        "circle-radius": 9,
        "circle-color": paper,
        "circle-stroke-color": ink,
        "circle-stroke-width": 2.5
      }
    });
    map.addSource(ANCHOR_SOURCE, { type: "geojson", data: emptyPoints() });
    map.addSource(HEAT_SOURCE, { type: "geojson", data: emptyPoints() });
    for (const letter of ANCHOR_ICON_LETTERS) {
      ensureAnchorIcon(letter, ink, paper);
    }
    map.addLayer({
      id: HEAT_LAYER,
      type: "circle",
      source: HEAT_SOURCE,
      paint: {
        "circle-radius": ["get", "r"],
        "circle-color": ink,
        "circle-opacity": 0.5
      }
    });
    map.addLayer({
      id: ANCHOR_LAYER,
      type: "symbol",
      source: ANCHOR_SOURCE,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": 1,
        "symbol-sort-key": ["get", "order"]
      }
    });
  }

  function fitPresetBounds(): void {
    if (presetBoundsFitted || presets.length === 0) return;
    presetBoundsFitted = true;
    let minLat = presets[0].lat;
    let maxLat = presets[0].lat;
    let minLon = presets[0].lon;
    let maxLon = presets[0].lon;
    for (const site of presets) {
      minLat = Math.min(minLat, site.lat);
      maxLat = Math.max(maxLat, site.lat);
      minLon = Math.min(minLon, site.lon);
      maxLon = Math.max(maxLon, site.lon);
    }
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat]
      ],
      { padding: 72, duration: 0, maxZoom: 12 }
    );
  }

  map.on("load", () => {
    const dbg = (window as unknown as Record<string, unknown>).__zqDbg as Record<string, unknown>;
    dbg.loadFired = true;
    try {
    if (destroyed || failureReported) { dbg.loadAborted = { destroyed, failureReported }; return; }
    if (failureTimer !== undefined) window.clearTimeout(failureTimer);
    layersReady = true;
    installLayers();
    applyPresets();
    applyActive();
    applyAnchors();
    applyHeat();
    chrome.update();
    fitPresetBounds();
    options.onReady?.();
    } catch (error) {
      dbg.loadThrew = String(error);
    }
  });

  map.on("error", (event) => {
    if (failureReported || layersReady) return;
    const message = event.error?.message ?? "";
    // A rejected/missing key fails the style itself (HTTP 403/404) — report
    // immediately instead of waiting for the timeout backstop.
    if (/\b(403|404)\b/.test(message) || /style/i.test(message)) {
      reportFailure("no-style");
    }
  });

  function onCamera(): void {
    chrome.update();
    if (layersReady && active !== null) {
      setData(CROSS_SOURCE, activeCrossCollection());
    }
  }

  map.on("zoom", onCamera);
  map.on("move", onCamera);
  map.on("rotate", onCamera);

  map.on("click", (event) => {
    if (!crosshair) return;
    options.onSitePick?.({ lat: event.lngLat.lat, lon: event.lngLat.lng });
  });

  return {
    setPresets(sites: readonly MapSite[]): void {
      presets = sites;
      applyPresets();
      fitPresetBounds();
    },

    focusSite(site: MapSite | null, animate = true): void {
      active = site;
      applyActive();
      if (site === null) return;
      const radiusM = site.radiusM ?? 0;
      const latRad = (site.lat * Math.PI) / 180;
      const dLat = (radiusM / 6378137) * (180 / Math.PI);
      const dLon = dLat / Math.max(Math.cos(latRad), 1e-6);
      const bounds: [[number, number], [number, number]] = [
        [site.lon - dLon, site.lat - dLat],
        [site.lon + dLon, site.lat + dLat]
      ];
      const duration = animate && !prefersReducedMotion() ? FLY_MS : 0;
      map.fitBounds(bounds, { padding: 88, duration, maxZoom: 15 });
    },

    setCrosshair(active: boolean): void {
      crosshair = active;
      container.style.cursor = active ? "crosshair" : "";
    },

    setAnchors(next: readonly MapAnchor[]): void {
      anchors = [...next];
      applyAnchors();
    },

    setHeat(next: readonly MapHeatPoint[]): void {
      heat = [...next];
      applyHeat();
    },

    resize(): void {
      map.resize();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (failureTimer !== undefined) window.clearTimeout(failureTimer);
      if (resizeFrame !== undefined && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(resizeFrame);
      }
      chrome.destroy();
      container.style.cursor = "";
      map.remove();
    }
  };
}

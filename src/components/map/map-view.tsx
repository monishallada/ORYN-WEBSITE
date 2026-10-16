"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  getVersion,
  Map as MlMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type ImageSource,
  type LngLatBoundsLike,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DETECTION_COLORS } from "@/components/map/legend";
import type { AoiFeatureProps, DetectionFeatureProps, FC } from "@/components/map/types";
import type { Geometry, PolygonGeometry } from "@/lib/geo";
import type { MapBasemap, MapOverlay } from "@/lib/map-layer-types";

export type DrawMode = "polygon" | "rectangle" | "point" | "linestring";
export type RasterOverlay = { url: string; corners: [[number, number], [number, number], [number, number], [number, number]]; opacity: number };
export type MapHandle = {
  map: () => MlMap | null;
  fitBounds: (b: [number, number, number, number], opts?: { maxZoom?: number; padding?: number }) => void;
  flyTo: (center: [number, number], zoom?: number) => void;
};

type Props = {
  basemap: MapBasemap;
  overlays: MapOverlay[];
  aois: FC<AoiFeatureProps> | null;
  detections: FC<DetectionFeatureProps> | null;
  showAois: boolean;
  showDetections: boolean;
  selectedAoiId: string | null;
  selectedDetectionId: string | null;
  raster: RasterOverlay | null;
  /** Organization reference layers to draw (permits, parcels, OSM infrastructure). */
  references?: { id: string; data: GeoJSON.FeatureCollection }[];
  initialBounds?: [number, number, number, number] | null;
  interactive?: boolean;
  drawMode?: DrawMode | null;
  editGeometry?: PolygonGeometry | null;
  onDrawFinish?: (g: Geometry) => void;
  onEditChange?: (g: PolygonGeometry) => void;
  onAoiClick?: (id: string) => void;
  onDetectionClick?: (id: string) => void;
  onView?: (v: { zoom: number; center: [number, number]; bounds: [number, number, number, number] }) => void;
  onReady?: (map: MlMap) => void;
  className?: string;
  ariaLabel?: string;
};

const MINE = "oryn-";

// Served from public/vendor (copied by scripts/copy-vendor.mjs): MapLibre
// cannot locate its worker relative to a bundled chunk.
let workerConfigured = false;
function configureWorker() {
  if (workerConfigured) return;
  setWorkerUrl(`/vendor/maplibre/maplibre-gl-worker-${getVersion()}.mjs`);
  workerConfigured = true;
}

function baseStyle(b: MapBasemap): StyleSpecification | string {
  if (b.kind === "vector-style") return b.styleUrl;
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { base: { type: "raster", tiles: [b.tiles], tileSize: b.tileSize, maxzoom: b.maxNativeZoom ?? 19, attribution: b.attribution } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#0a0b0c" } },
      { id: "base", type: "raster", source: "base", paint: { "raster-saturation": -0.15 } },
    ],
  };
}

function addOrynLayers(map: MlMap) {
  if (map.getSource(`${MINE}aois`)) return;
  const empty = { type: "FeatureCollection" as const, features: [] };
  map.addSource(`${MINE}aois`, { type: "geojson", data: empty, promoteId: "id" });
  map.addSource(`${MINE}detections`, { type: "geojson", data: empty, promoteId: "id" });
  map.addLayer({ id: `${MINE}aoi-fill`, type: "fill", source: `${MINE}aois`, paint: { "fill-color": "#f2f1ed", "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.08, 0.025] } });
  map.addLayer({
    id: `${MINE}aoi-line`,
    type: "line",
    source: `${MINE}aois`,
    paint: {
      "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#ff6a2b", "#f2f1ed"],
      "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 1.25],
      "line-opacity": 0.9,
    },
  });
  const typeColor: unknown[] = ["match", ["get", "type"]];
  for (const [t, c] of Object.entries(DETECTION_COLORS)) typeColor.push(t, c.color);
  typeColor.push("#9085e9");
  const dashedTypes = Object.entries(DETECTION_COLORS).filter(([, c]) => c.dashed).map(([t]) => t);
  const isDashed = ["in", ["get", "type"], ["literal", dashedTypes]];
  map.addLayer({
    id: `${MINE}det-fill`,
    type: "fill",
    source: `${MINE}detections`,
    paint: {
      "fill-color": typeColor as never,
      // Dashed (single-date) findings get a faint fill so the imagery underneath stays readable.
      "fill-opacity": [
        "case",
        ["==", ["get", "verification_status"], "dismissed"], 0.06,
        isDashed, ["case", ["boolean", ["feature-state", "selected"], false], 0.28, 0.12],
        ["boolean", ["feature-state", "selected"], false], 0.55, 0.35,
      ] as never,
    },
  });
  map.addLayer({
    id: `${MINE}zone-line`,
    type: "line",
    source: `${MINE}detections`,
    filter: isDashed as never,
    paint: {
      "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#ffffff", typeColor as never] as never,
      "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 1.5],
      "line-dasharray": [2, 1.5],
      "line-opacity": ["case", ["==", ["get", "verification_status"], "dismissed"], 0.35, 1],
    },
  });
  map.addLayer({
    id: `${MINE}det-line`,
    type: "line",
    source: `${MINE}detections`,
    filter: ["!", isDashed] as never,
    paint: {
      "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#ffffff", typeColor as never],
      "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 1.25],
      "line-opacity": ["case", ["==", ["get", "verification_status"], "dismissed"], 0.35, 1],
    },
  });
  map.addLayer({
    id: `${MINE}aoi-label`,
    type: "symbol",
    source: `${MINE}aois`,
    minzoom: 11,
    layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-allow-overlap": false },
    paint: { "text-color": "#f2f1ed", "text-halo-color": "#0a0b0c", "text-halo-width": 1.4 },
  });
}

function setRaster(map: MlMap, raster: RasterOverlay | null) {
  const src = map.getSource(`${MINE}raster`) as ImageSource | undefined;
  if (!raster) {
    if (map.getLayer(`${MINE}raster`)) map.removeLayer(`${MINE}raster`);
    if (src) map.removeSource(`${MINE}raster`);
    return;
  }
  if (src) {
    src.updateImage({ url: raster.url, coordinates: raster.corners });
  } else {
    map.addSource(`${MINE}raster`, { type: "image", url: raster.url, coordinates: raster.corners });
    map.addLayer(
      // Nearest-neighbour: enlarged source pixels stay visibly square instead of
      // being smoothed into a false impression of finer detail.
      { id: `${MINE}raster`, type: "raster", source: `${MINE}raster`, paint: { "raster-resampling": "nearest", "raster-fade-duration": 0 } },
      map.getLayer(`${MINE}aoi-fill`) ? `${MINE}aoi-fill` : undefined,
    );
  }
  map.setPaintProperty(`${MINE}raster`, "raster-opacity", raster.opacity);
}

const REF_COLOR = "#b6babe";

function setReferences(map: MlMap, refs: { id: string; data: GeoJSON.FeatureCollection }[]) {
  const wanted = new Set(refs.map((r) => `${MINE}ref-${r.id}`));
  for (const layer of map.getStyle().layers ?? []) {
    const src = (layer as { source?: string }).source;
    if (src?.startsWith(`${MINE}ref-`) && !wanted.has(src)) map.removeLayer(layer.id);
  }
  for (const id of Object.keys(map.getStyle().sources ?? {})) {
    if (id.startsWith(`${MINE}ref-`) && !wanted.has(id)) map.removeSource(id);
  }
  const before = map.getLayer(`${MINE}aoi-fill`) ? `${MINE}aoi-fill` : undefined;
  for (const r of refs) {
    const id = `${MINE}ref-${r.id}`;
    const src = map.getSource(id) as GeoJSONSource | undefined;
    if (src) {
      src.setData(r.data as never);
      continue;
    }
    map.addSource(id, { type: "geojson", data: r.data as never });
    map.addLayer({ id: `${id}-fill`, type: "fill", source: id, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": REF_COLOR, "fill-opacity": 0.12 } }, before);
    map.addLayer({ id: `${id}-line`, type: "line", source: id, filter: ["in", ["geometry-type"], ["literal", ["Polygon", "LineString"]]], paint: { "line-color": REF_COLOR, "line-width": 1, "line-opacity": 0.8 } }, before);
    map.addLayer({ id: `${id}-pt`, type: "circle", source: id, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": REF_COLOR, "circle-radius": 3, "circle-stroke-color": "#0a0b0c", "circle-stroke-width": 1 } }, before);
  }
}

function setOverlays(map: MlMap, overlays: MapOverlay[]) {
  const wanted = new Set(overlays.map((o) => `${MINE}ov-${o.id}`));
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id.startsWith(`${MINE}ov-`) && !wanted.has(layer.id)) {
      map.removeLayer(layer.id);
      map.removeSource(layer.id);
    }
  }
  for (const o of overlays) {
    const id = `${MINE}ov-${o.id}`;
    if (!map.getSource(id)) {
      map.addSource(id, { type: "raster", tiles: [o.tiles], tileSize: o.tileSize, attribution: o.attribution, ...(o.maxNativeZoom ? { maxzoom: o.maxNativeZoom } : {}) });
      map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": o.opacity ?? 0.7 } }, map.getLayer(`${MINE}raster`) ? `${MINE}raster` : map.getLayer(`${MINE}aoi-fill`) ? `${MINE}aoi-fill` : undefined);
    }
  }
}

export const MapView = forwardRef<MapHandle, Props>(function MapView(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const selected = useRef<{ aoi: string | null; det: string | null }>({ aoi: null, det: null });
  // isStyleLoaded() is also false while tiles load, long after "load" fired,
  // so readiness is tracked explicitly; work requested before then is queued.
  const ready = useRef(false);
  const pending = useRef<(() => void)[]>([]);
  const whenReady = (fn: (map: MlMap) => void) => {
    const map = mapRef.current;
    if (!map) return;
    if (ready.current) fn(map);
    else pending.current.push(() => fn(map));
  };
  const flush = () => {
    ready.current = true;
    const queued = pending.current;
    pending.current = [];
    for (const f of queued) f();
  };

  useImperativeHandle(ref, () => ({
    map: () => mapRef.current,
    fitBounds: (b, opts) => mapRef.current?.fitBounds(b as LngLatBoundsLike, { padding: opts?.padding ?? 48, maxZoom: opts?.maxZoom ?? 16, duration: 600 }),
    flyTo: (center, zoom) => mapRef.current?.flyTo({ center, zoom: zoom ?? Math.max(mapRef.current.getZoom(), 13), duration: 700 }),
  }));

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    configureWorker();
    const p = latest.current;
    const map = new MlMap({
      container: container.current,
      style: baseStyle(p.basemap),
      bounds: (p.initialBounds ?? [-125, 24, -66, 50]) as LngLatBoundsLike,
      fitBoundsOptions: { padding: 40 },
      attributionControl: false,
      interactive: p.interactive !== false,
      maxPitch: 0,
      dragRotate: false,
    });
    mapRef.current = map;
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    if (p.interactive !== false) {
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-left");
    }
    map.touchZoomRotate.disableRotation();

    const emitView = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      latest.current.onView?.({ zoom: map.getZoom(), center: [c.lng, c.lat], bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
    };
    map.on("moveend", emitView);

    map.on("load", () => {
      addOrynLayers(map);
      const q = latest.current;
      setOverlays(map, q.overlays);
      setRaster(map, q.raster);
      if (q.aois) (map.getSource(`${MINE}aois`) as GeoJSONSource).setData(q.aois as never);
      if (q.detections) (map.getSource(`${MINE}detections`) as GeoJSONSource).setData(q.detections as never);
      setReferences(map, q.references ?? []);
      emitView();
      q.onReady?.(map);
      flush();
    });

    const clickLayer = (layer: string, handler: (id: string) => void) => {
      map.on("click", layer, (e: MapLayerMouseEvent) => {
        if (drawRef.current?.enabled && drawRef.current.getMode() !== "static") return;
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") handler(id);
      });
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    };
    // Detections sit above AOIs; stop AOI selection when a detection was hit.
    map.on("click", (e) => {
      if (drawRef.current?.enabled && drawRef.current.getMode() !== "static") return;
      const hits = map.queryRenderedFeatures(e.point, { layers: [`${MINE}det-fill`, `${MINE}aoi-fill`].filter((l) => map.getLayer(l)) });
      const det = hits.find((h) => h.layer.id === `${MINE}det-fill`);
      const aoi = hits.find((h) => h.layer.id === `${MINE}aoi-fill`);
      if (det && latest.current.showDetections) latest.current.onDetectionClick?.(String(det.properties.id));
      else if (aoi && latest.current.showAois) latest.current.onAoiClick?.(String(aoi.properties.id));
    });
    clickLayer(`${MINE}det-fill`, () => {});
    clickLayer(`${MINE}aoi-fill`, () => {});

    return () => {
      drawRef.current?.stop();
      drawRef.current = null;
      ready.current = false;
      pending.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Basemap changes keep ORYN sources/layers via transformStyle.
  const basemapId = props.basemap.id;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    ready.current = false;
    map.once("style.load", flush);
    map.setStyle(baseStyle(latest.current.basemap), {
      transformStyle: (prev, next) => {
        if (!prev) return next;
        const mineSources = Object.fromEntries(Object.entries(prev.sources).filter(([k]) => k.startsWith(MINE)));
        const mineLayers = prev.layers.filter((l) => l.id.startsWith(MINE));
        return { ...next, glyphs: next.glyphs ?? prev.glyphs, sources: { ...next.sources, ...mineSources }, layers: [...next.layers, ...mineLayers] };
      },
    });
  }, [basemapId]);

  useEffect(() => {
    whenReady((map) => setOverlays(map, latest.current.overlays));
     
  }, [props.overlays]);

  useEffect(() => {
    whenReady((map) => setReferences(map, latest.current.references ?? []));
  }, [props.references]);

  useEffect(() => {
    whenReady((map) => {
      const src = map.getSource(`${MINE}aois`) as GeoJSONSource | undefined;
      if (src && latest.current.aois) src.setData(latest.current.aois as never);
    });
     
  }, [props.aois]);

  useEffect(() => {
    whenReady((map) => {
      const src = map.getSource(`${MINE}detections`) as GeoJSONSource | undefined;
      if (src && latest.current.detections) src.setData(latest.current.detections as never);
    });
     
  }, [props.detections]);

  useEffect(() => {
    whenReady((map) => {
      const { showAois, showDetections } = latest.current;
      for (const l of [`${MINE}aoi-fill`, `${MINE}aoi-line`, `${MINE}aoi-label`]) if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", showAois ? "visible" : "none");
      for (const l of [`${MINE}det-fill`, `${MINE}det-line`]) if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", showDetections ? "visible" : "none");
    });
     
  }, [props.showAois, props.showDetections]);

  useEffect(() => {
    whenReady((map) => applySelection(map));
     
  }, [props.selectedAoiId, props.selectedDetectionId, props.aois, props.detections]);

  function applySelection(map: MlMap) {
    if (!map.getSource(`${MINE}aois`)) return;
    const props = latest.current;
    const prev = selected.current;
    if (prev.aoi) map.setFeatureState({ source: `${MINE}aois`, id: prev.aoi }, { selected: false });
    if (prev.det) map.setFeatureState({ source: `${MINE}detections`, id: prev.det }, { selected: false });
    if (props.selectedAoiId) map.setFeatureState({ source: `${MINE}aois`, id: props.selectedAoiId }, { selected: true });
    if (props.selectedDetectionId) map.setFeatureState({ source: `${MINE}detections`, id: props.selectedDetectionId }, { selected: true });
    selected.current = { aoi: props.selectedAoiId, det: props.selectedDetectionId };
  }

  const rasterKey = props.raster ? `${props.raster.url}|${props.raster.opacity}` : "none";
  useEffect(() => {
    whenReady((map) => setRaster(map, latest.current.raster));
     
  }, [rasterKey]);

  // Drawing & editing (terra-draw).
  const drawKey = `${props.drawMode ?? ""}|${props.editGeometry ? JSON.stringify(props.editGeometry.coordinates[0]?.[0]) : ""}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { drawMode, editGeometry } = latest.current;
    if (!drawMode && !editGeometry) {
      if (drawRef.current) {
        drawRef.current.stop();
        drawRef.current = null;
      }
      return;
    }
    const start = () => {
      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawPolygonMode({ editable: true, validation: (f) => ValidateNotSelfIntersecting(f), styles: { fillColor: "#ff6a2b", fillOpacity: 0.15, outlineColor: "#ff6a2b", outlineWidth: 2 } }),
          new TerraDrawRectangleMode({ styles: { fillColor: "#ff6a2b", fillOpacity: 0.15, outlineColor: "#ff6a2b", outlineWidth: 2 } }),
          new TerraDrawPointMode({ styles: { pointColor: "#ff6a2b", pointWidth: 6 } }),
          new TerraDrawLineStringMode({ styles: { lineStringColor: "#ff6a2b", lineStringWidth: 2 } }),
          new TerraDrawSelectMode({
            flags: {
              polygon: { feature: { draggable: false, coordinates: { draggable: true, midpoints: true, deletable: true } } },
            },
          }),
        ],
      });
      draw.start();
      drawRef.current = draw;
      if (editGeometry) {
        const [id] = draw.addFeatures([{ id: "edit", type: "Feature", geometry: editGeometry, properties: { mode: "polygon" } } as never]).map((v) => v.id);
        draw.setMode("select");
        if (id !== undefined) draw.selectFeature(id);
        draw.on("change", () => {
          const f = draw.getSnapshot().find((s) => s.properties.mode === "polygon");
          if (f && f.geometry.type === "Polygon") latest.current.onEditChange?.(f.geometry as PolygonGeometry);
        });
      } else if (drawMode) {
        draw.setMode(drawMode);
        draw.on("finish", (id) => {
          const f = draw.getSnapshotFeature(id);
          if (f) latest.current.onDrawFinish?.(f.geometry as Geometry);
        });
      }
    };
    whenReady(start);
    return () => {
      drawRef.current?.stop();
      drawRef.current = null;
    };
  }, [drawKey]);

  // MapLibre's stylesheet sets position: relative on its container, so the
  // caller's positioning lives on a wrapper and the map fills it.
  return (
    <div className={props.className}>
      <div ref={container} className="h-full w-full" role="application" aria-label={props.ariaLabel ?? "Map"} />
    </div>
  );
});

import { useMemo, useRef, useState, useEffect } from "react";
import { CITIES, getPollen } from "../../lib/pollen";
import { bandColor, continuousColor, SEVERITY_BANDS, type MapMode } from "../../lib/severity";
import { GHANA_OUTLINE, pointInPoly } from "../../lib/ghanaGeo";
import { TimeBar } from "./TimeBar";
import { ZoomScrubber } from "./ZoomScrubber";
import type { Range } from "../../lib/pollen";

export type { MapMode };
export type Viewport = "mobile" | "tablet" | "desktop";

interface Props {
  selectedCityId: string;
  onSelectCity: (id: string) => void;
  date: Date;
  onChangeDate: (d: Date) => void;
  range: Range;
  onChangeRange: (r: Range) => void;
  mode: MapMode;
  onChangeMode: (m: MapMode) => void;
  theme: "light" | "dark";
  viewport?: Viewport;
  isDocked?: boolean;
}

// Canvas dimensions (SVG units)
const W = 980;
const H = 720;
const STEP = 10;
const COLOR_STEP = 7;
const SPARSE_STEP = 16;
const RADIAL_STEP = 15.6;
const BORDER_STEP = 5;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;

// Ghana bounding box (lng: -3.25 to 1.20, lat: 4.74 to 11.17)
const LNG_MIN = -3.30, LNG_MAX = 1.25;
const LAT_MIN = 4.65, LAT_MAX = 11.25;
// Map to a centred portrait zone within the SVG
const MX0 = 190, MX1 = 790;
const MY0 = 30,  MY1 = 680;

const CONTENT_X0 = MX0 - 10, CONTENT_X1 = MX1 + 10;
const CONTENT_Y0 = MY0 - 10, CONTENT_Y1 = MY1 + 10;
const EMPTY_GRID = { cells: [] as Cell[], cols: 0, rows: 0 };

function projectGhana(lat: number, lng: number) {
  return {
    x: ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * (MX1 - MX0) + MX0,
    y: (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (MY1 - MY0) + MY0,
  };
}
function unprojectGhana(x: number, y: number) {
  return {
    lng: ((x - MX0) / (MX1 - MX0)) * (LNG_MAX - LNG_MIN) + LNG_MIN,
    lat: LAT_MIN + (1 - (y - MY0) / (MY1 - MY0)) * (LAT_MAX - LAT_MIN),
  };
}

interface Cell {
  i: number; j: number;
  x: number; y: number;
  lat: number; lng: number;
  inside: boolean;
  value: number;
}

function buildGrid(
  bounds: { x0: number; y0: number; x1: number; y1: number },
  step: number,
  inside: (lat: number, lng: number) => boolean,
  unproj: (x: number, y: number) => { lat: number; lng: number },
  cityValues: { lat: number; lng: number; v: number }[],
): { cells: Cell[]; cols: number; rows: number } {
  const cols = Math.floor((bounds.x1 - bounds.x0) / step);
  const rows = Math.floor((bounds.y1 - bounds.y0) / step);
  const cells: Cell[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = bounds.x0 + (i + 0.5) * step;
      const y = bounds.y0 + (j + 0.5) * step;
      const { lat, lng } = unproj(x, y);
      const isIn = inside(lat, lng);
      let value = 0;
      if (isIn && cityValues.length > 0) {
        let wsum = 0, vsum = 0;
        for (const c of cityValues) {
          const dx = c.lng - lng;
          const dy = c.lat - lat;
          const d2 = dx * dx + dy * dy + 0.001;
          const w = 1 / (d2 * d2);
          wsum += w;
          vsum += w * c.v;
        }
        value = wsum > 0 ? vsum / wsum : 0;
      }
      cells.push({ i, j, x, y, lat, lng, inside: isIn, value });
    }
  }
  return { cells, cols, rows };
}

const SPOKE_INNER = 0.28;
const RADIAL_SPOKES = (() => {
  const N = 18;
  const arr: { x: number; y: number }[] = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    arr.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return arr;
})();
const RADIAL_SPOKES_PATH = RADIAL_SPOKES.map(
  (s) => `M${(s.x * SPOKE_INNER).toFixed(3)} ${(s.y * SPOKE_INNER).toFixed(3)} L${s.x.toFixed(3)} ${s.y.toFixed(3)}`,
).join(" ");

const RADIAL_TRANSITION = "transform 450ms cubic-bezier(.22,.7,.28,1), opacity 450ms cubic-bezier(.22,.7,.28,1)";
const LEGEND_BANDS_HI_LO = [...SEVERITY_BANDS].slice().reverse();
const LEGEND_CX = [12, 36, 60, 84, 108, 132] as const;

function PollenIndexLegend({ mode, theme }: { mode: MapMode; theme: "light" | "dark" }) {
  if (mode === "radial") {
    const radialKeySpokes = [
      "M11.35 10H19M11.17 10.68L17.79 14.5M10.68 11.17L14.5 17.79M10 11.35V19M9.33 11.17L5.5 17.79M8.83 10.68L2.21 14.5M8.65 10H1M8.83 9.32L2.21 5.5M9.32 8.83L5.5 2.21M10 8.65V1M10.68 8.83L14.5 2.21M11.17 9.32L17.79 5.5",
      "M42.9 10H48M42.78 10.45L47.2 13M42.45 10.78L45 15.2M42 10.9V16M41.55 10.78L39 15.2M41.22 10.45L36.8 13M41.1 10H36M41.22 9.55L36.8 7M41.55 9.22L39 4.8M42 9.1V4M42.45 9.22L45 4.8M42.78 9.55L47.2 7",
      "M70.17 10H74M70.08 10.34L73.4 12.25M69.84 10.58L71.75 13.9M69.5 10.68V14.5M69.16 10.58L67.25 13.9M68.92 10.34L65.6 12.25M68.83 10H65M68.92 9.66L65.6 7.75M69.16 9.42L67.25 6.1M69.5 9.32V5.5M69.84 9.42L71.75 6.1M70.08 9.66L73.4 7.75",
      "M94.45 10H97M94.39 10.22L96.6 11.5M94.22 10.39L95.5 12.6M94 10.45V13M93.78 10.39L92.5 12.6M93.61 10.22L91.4 11.5M93.55 10H91M93.61 9.78L91.4 8.5M93.78 9.61L92.5 7.4M94 9.55V7M94.22 9.61L95.5 7.4M94.39 9.78L96.6 8.5",
      "M116.3 10H118M116.26 10.15L117.73 11M116.15 10.26L117 11.73M116 10.3V12M115.85 10.26L115 11.73M115.74 10.15L114.27 11M115.7 10H114M115.74 9.85L114.27 9M115.85 9.74L115 8.27M116 9.7V8M116.15 9.74L117 8.27M116.26 9.85L117.73 9",
    ];
    return (
      <svg width={148} height={25} viewBox="0 0 119 20" fill="none" style={{ display: "block" }}>
        {radialKeySpokes.map((d, i) => (
          <path key={i} d={d} stroke="var(--strata-ink)" strokeOpacity={0.8} strokeWidth={0.5} strokeLinecap="round" />
        ))}
      </svg>
    );
  }

  if (mode === "dots") {
    const tiers = [1.0, 0.78, 0.58, 0.4, 0.22, 0.08];
    const dotFill = theme === "dark" ? "#ffffff" : "#5D5C5B";
    return (
      <svg width={148} height={20} viewBox="0 0 148 20" fill="none" style={{ display: "block" }}>
        {tiers.map((t, i) => {
          const r = (0.12 + Math.pow(t, 0.7) * 0.34) * 16;
          return <circle key={i} cx={LEGEND_CX[i]} cy={10} r={r.toFixed(2)} fill={dotFill} />;
        })}
      </svg>
    );
  }

  if (mode === "color") {
    return (
      <svg width={148} height={20} viewBox="0 0 148 20" fill="none" style={{ display: "block" }}>
        {LEGEND_BANDS_HI_LO.map((band, i) => {
          const midVal = (band.min + band.max) / 2;
          return <circle key={i} cx={LEGEND_CX[i]} cy={10} r={6} fill={continuousColor(midVal)} />;
        })}
      </svg>
    );
  }

  return (
    <svg width={148} height={20} viewBox="0 0 148 20" fill="none" style={{ display: "block" }}>
      {LEGEND_BANDS_HI_LO.map((band, i) => {
        const t = (band.min + band.max) / 2 / 12;
        const r = ((0.18 + Math.pow(t, 0.7) * 0.77) * 11).toFixed(2);
        return (
          <circle key={i} cx={LEGEND_CX[i]} cy={10} r={r} fill="none" stroke={band.color} strokeWidth={0.5}
            style={{ mixBlendMode: theme === "dark" ? "normal" : "multiply" }} />
        );
      })}
    </svg>
  );
}

function renderRadialBurst(
  c: { x: number; y: number; value: number },
  key: string,
  sparseStep: number,
  tNorm: number,
) {
  const spokeScale = sparseStep * (0.12 + Math.pow(tNorm, 1.15) * 4.3);
  return (
    <g key={key} transform={`translate(${c.x} ${c.y})`} opacity={0.4}>
      <path
        d={RADIAL_SPOKES_PATH}
        fill="none"
        stroke="var(--strata-ink)"
        strokeWidth={0.3}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{
          transform: `scale(${spokeScale.toFixed(3)})`,
          transformOrigin: "0 0",
          transition: RADIAL_TRANSITION,
        }}
      />
    </g>
  );
}

interface PopupState {
  containerX: number; containerY: number;
  cityName: string; regionName: string; value: number;
}

export function MapPanel({ selectedCityId, onSelectCity, date, onChangeDate, range, onChangeRange, mode, onChangeMode, theme, viewport = "desktop", isDocked = false }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [directManip, setDirectManip] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchInitRef = useRef<{ dist: number; zoom: number } | null>(null);
  const mainlandGroupRef = useRef<SVGGElement>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const wheelAccumRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  function groupTransform(px: number, py: number, z: number) {
    return `translate(${(px + (W / 2) * (1 - z)).toFixed(2)} ${(py + (H / 2) * (1 - z)).toFixed(2)}) scale(${z})`;
  }

  function clampPan(p: { x: number; y: number }, z: number) {
    const xMin = z * (W / 2 - CONTENT_X1), xMax = z * (W / 2 - CONTENT_X0);
    const yMin = z * (H / 2 - CONTENT_Y1), yMax = z * (H / 2 - CONTENT_Y0);
    return {
      x: Math.max(xMin, Math.min(xMax, p.x)),
      y: Math.max(yMin, Math.min(yMax, p.y)),
    };
  }

  useEffect(() => {
    setPan((p) => {
      const c = clampPan(p, zoom);
      return c.x === p.x && c.y === p.y ? p : c;
    });
  }, [zoom]);

  useEffect(() => {
    const city = CITIES.find((c) => c.id === selectedCityId);
    if (!city) return;
    const p = projectGhana(city.lat, city.lng);
    const z = zoomRef.current;
    setPan(clampPan({ x: z * (W / 2 - p.x), y: z * (H / 2 - p.y) }, z));
  }, [selectedCityId]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = new Date(date);
      next.setDate(next.getDate() + 3);
      if (next.getFullYear() !== date.getFullYear()) next.setMonth(0, 1);
      onChangeDate(next);
    }, 130);
    return () => window.clearInterval(id);
  }, [playing, date, onChangeDate]);

  const cityReadings = useMemo(
    () => CITIES.map((c) => {
      const r = getPollen(c.id, date);
      return { city: c, value: r.total };
    }),
    [date],
  );

  const detailMul = zoom < 1.5 ? 1 : zoom < 3 ? 2 : zoom < 6 ? 3 : 4;
  const liveStep = STEP / detailMul;
  const liveColorStep = COLOR_STEP / detailMul;
  const liveSparseStep = SPARSE_STEP / detailMul;
  const liveRadialStep = RADIAL_STEP / detailMul;

  const visibleRect = useMemo(() => {
    const halfPad = liveStep * 1.5 + (Math.max(W, H) * 0.3) / zoom;
    const vx0 = ((W / 2) * (zoom - 1) - pan.x) / zoom - halfPad;
    const vy0 = ((H / 2) * (zoom - 1) - pan.y) / zoom - halfPad;
    const vw = W / zoom + halfPad * 2;
    const vh = H / zoom + halfPad * 2;
    return { x0: vx0, y0: vy0, x1: vx0 + vw, y1: vy0 + vh };
  }, [zoom, pan.x, pan.y, liveStep]);

  function inView(x: number, y: number) {
    return x >= visibleRect.x0 && x <= visibleRect.x1 && y >= visibleRect.y0 && y <= visibleRect.y1;
  }

  const cityVals = useMemo(
    () => cityReadings.map((r) => ({ lat: r.city.lat, lng: r.city.lng, v: r.value })),
    [cityReadings],
  );

  const ghanaInside = (lat: number, lng: number) => pointInPoly(lng, lat, GHANA_OUTLINE);
  const mainBounds = { x0: MX0, y0: MY0, x1: MX1, y1: MY1 };

  const mainlandGrid = useMemo(
    () => mode !== "dots" ? null : buildGrid(mainBounds, liveStep, ghanaInside, unprojectGhana, cityVals),
    [cityVals, liveStep, mode],
  );
  const colorMainlandGrid = useMemo(
    () => mode !== "color" ? null : buildGrid(mainBounds, liveColorStep, ghanaInside, unprojectGhana, cityVals),
    [cityVals, liveColorStep, mode],
  );
  const sparseMainlandGrid = useMemo(
    () => mode !== "outlined" ? null : buildGrid(mainBounds, liveSparseStep, ghanaInside, unprojectGhana, cityVals),
    [cityVals, liveSparseStep, mode],
  );
  const radialMainlandGrid = useMemo(
    () => mode !== "radial" ? null : buildGrid(mainBounds, liveRadialStep, ghanaInside, unprojectGhana, cityVals),
    [cityVals, liveRadialStep, mode],
  );

  // Hi-fi coastline border grid (fixed resolution)
  const borderGrid = useMemo(
    () => buildGrid(mainBounds, BORDER_STEP, ghanaInside, unprojectGhana, []),
    [],
  );
  // Coarser grid for region borders
  const geoGrid = useMemo(
    () => buildGrid(mainBounds, STEP, ghanaInside, unprojectGhana, []),
    [],
  );

  function buildBorderSegs(grid: { cells: Cell[]; cols: number; rows: number }) {
    const segs: [number, number, number, number][] = [];
    const { cells, cols, rows } = grid;
    const at = (i: number, j: number) =>
      i >= 0 && i < cols && j >= 0 && j < rows ? cells[j * cols + i] : null;
    const half = BORDER_STEP / 2;
    for (const c of cells) {
      if (!c.inside) continue;
      const left = c.x - half, right = c.x + half, top = c.y - half, bot = c.y + half;
      if (!at(c.i - 1, c.j)?.inside) segs.push([left, top, left, bot]);
      if (!at(c.i + 1, c.j)?.inside) segs.push([right, top, right, bot]);
      if (!at(c.i, c.j - 1)?.inside) segs.push([left, top, right, top]);
      if (!at(c.i, c.j + 1)?.inside) segs.push([left, bot, right, bot]);
    }
    return segs;
  }

  const borderSegments = useMemo(() => buildBorderSegs(borderGrid), [borderGrid]);

  // Region borders — nearest city by region assignment
  const cityRegionLocations = useMemo(
    () => CITIES.map((c) => {
      const p = projectGhana(c.lat, c.lng);
      return { px: p.x, py: p.y, state: c.state };
    }),
    [],
  );

  const cellRegions = useMemo(() => {
    return geoGrid.cells.map((c) => {
      if (!c.inside) return "";
      let best = "", bestD = Infinity;
      for (const ci of cityRegionLocations) {
        const d = (ci.px - c.x) ** 2 + (ci.py - c.y) ** 2;
        if (d < bestD) { bestD = d; best = ci.state; }
      }
      return best;
    });
  }, [geoGrid, cityRegionLocations]);

  const regionBorderSegs = useMemo(() => {
    const segs: [number, number, number, number][] = [];
    const { cells, cols, rows } = geoGrid;
    const at = (i: number, j: number) =>
      i >= 0 && i < cols && j >= 0 && j < rows ? cells[j * cols + i] : null;
    const regionAt = (i: number, j: number) =>
      i >= 0 && i < cols && j >= 0 && j < rows ? cellRegions[j * cols + i] : "";
    for (const c of cells) {
      if (!c.inside) continue;
      const myRegion = cellRegions[c.j * cols + c.i];
      if (!myRegion) continue;
      const half = STEP / 2;
      const { x, y } = c;
      if (at(c.i - 1, c.j)?.inside && regionAt(c.i - 1, c.j) !== myRegion) segs.push([x - half, y - half, x - half, y + half]);
      if (at(c.i + 1, c.j)?.inside && regionAt(c.i + 1, c.j) !== myRegion) segs.push([x + half, y - half, x + half, y + half]);
      if (at(c.i, c.j - 1)?.inside && regionAt(c.i, c.j - 1) !== myRegion) segs.push([x - half, y - half, x + half, y - half]);
      if (at(c.i, c.j + 1)?.inside && regionAt(c.i, c.j + 1) !== myRegion) segs.push([x - half, y + half, x + half, y + half]);
    }
    return segs;
  }, [geoGrid, cellRegions]);

  const showRegionLabels = zoom >= 2;

  const regionCentroids = useMemo(() => {
    const map: Record<string, { lat: number; lng: number; n: number; label: string }> = {};
    for (const c of CITIES) {
      const cur = map[c.state] || { lat: 0, lng: 0, n: 0, label: c.state };
      cur.lat += c.lat; cur.lng += c.lng; cur.n += 1;
      map[c.state] = cur;
    }
    return Object.entries(map).map(([state, v]) => ({
      state,
      ...projectGhana(v.lat / v.n, v.lng / v.n),
    }));
  }, []);

  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) pinchInitRef.current = null;
      if (pointersRef.current.size === 0) setDirectManip(false);
      setDrag(null);
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, []);

  useEffect(() => {
    if (!popup) return;
    const id = setTimeout(() => setPopup(null), 4000);
    return () => clearTimeout(id);
  }, [popup]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelAccumRef.current += Math.max(-50, Math.min(50, e.deltaY));
      if (wheelRafRef.current != null) return;
      wheelRafRef.current = requestAnimationFrame(() => {
        const factor = Math.exp(-wheelAccumRef.current * 0.005);
        wheelAccumRef.current = 0;
        wheelRafRef.current = null;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelRafRef.current != null) cancelAnimationFrame(wheelRafRef.current);
    };
  }, []);

  function getSVGCoords(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const dx = pan.x + (W / 2) * (1 - zoom);
    const dy = pan.y + (H / 2) * (1 - zoom);
    return { x: (svgPt.x - dx) / zoom, y: (svgPt.y - dy) / zoom };
  }

  function handleMapClick(clientX: number, clientY: number) {
    const { x, y } = getSVGCoords(clientX, clientY);
    const inBounds = x >= MX0 && x <= MX1 && y >= MY0 && y <= MY1;
    if (!inBounds) return;

    let bestCity = CITIES[0];
    let bestDist = Infinity;
    for (const c of CITIES) {
      const proj = projectGhana(c.lat, c.lng);
      const d = Math.hypot(proj.x - x, proj.y - y);
      if (d < bestDist) { bestDist = d; bestCity = c; }
    }

    const pollen = getPollen(bestCity.id, date);
    const container = containerRef.current;
    const containerRect = container?.getBoundingClientRect();
    const cx = containerRect ? clientX - containerRect.left : clientX;
    const cy = containerRect ? clientY - containerRect.top : clientY;
    setPopup({ containerX: cx, containerY: cy, cityName: bestCity.name, regionName: bestCity.region, value: pollen.total });
    onSelectCity(bestCity.id);
  }

  function onMove(e: React.PointerEvent) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchInitRef.current) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = dist / pinchInitRef.current.dist;
      setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchInitRef.current.zoom * ratio)));
      return;
    }
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H) || 1;
    const dx = (e.clientX - drag.x) / scale;
    const dy = (e.clientY - drag.y) / scale;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    const next = clampPan({ x: drag.px + dx, y: drag.py + dy }, zoom);
    panRef.current = next;
    const tf = groupTransform(next.x, next.y, zoom);
    if (mainlandGroupRef.current) mainlandGroupRef.current.setAttribute("transform", tf);
  }

  // Contrast-stretch normalization
  type Grid = ReturnType<typeof buildGrid>;
  const pickGrid = (color: Grid | null, radial: Grid | null, sparse: Grid | null, std: Grid | null): Grid =>
    (mode === "color" ? color : mode === "radial" ? radial : mode === "outlined" ? sparse : std) ?? EMPTY_GRID;
  const activeGrid = pickGrid(colorMainlandGrid, radialMainlandGrid, sparseMainlandGrid, mainlandGrid);

  const valueExtent = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const c of activeGrid.cells) {
      if (!c.inside) continue;
      if (c.value < lo) lo = c.value;
      if (c.value > hi) hi = c.value;
    }
    if (!isFinite(lo)) return { lo: 0, hi: 12 };
    if (hi - lo < 0.5) hi = lo + 0.5;
    return { lo, hi };
  }, [activeGrid]);

  function normValue(v: number) {
    return Math.max(0, Math.min(1, (v - valueExtent.lo) / (valueExtent.hi - valueExtent.lo)));
  }

  function renderHalftoneCell(c: Cell, m: MapMode, key: string) {
    const t = normValue(c.value);
    if (m === "radial") return renderRadialBurst(c, key, liveRadialStep, t);
    if (m === "dots") {
      const rMin = 0.08 * liveStep, rMax = 0.46 * liveStep;
      const r = (rMin + Math.pow(t, 1.1) * (rMax - rMin)).toFixed(3);
      return (
        <circle key={key} cx={c.x} cy={c.y} r={1}
          fill={theme === "dark" ? "#ffffff" : "#5D5C5B"}
          style={{ transformBox: "fill-box", transformOrigin: "center", transform: `scale(${r})`, transition: "transform 450ms cubic-bezier(.22,.7,.28,1)" }}
        />
      );
    }
    if (m === "outlined") {
      const rMin = 0.12 * liveSparseStep, rMax = 1.0 * liveSparseStep;
      const r = (rMin + Math.pow(t, 1.1) * (rMax - rMin)).toFixed(3);
      return (
        <circle key={key} cx={c.x} cy={c.y} r={1}
          fill="none" stroke={bandColor(c.value)} strokeWidth={0.5} vectorEffect="non-scaling-stroke"
          style={{ transformBox: "fill-box", transformOrigin: "center", transform: `scale(${r})`, mixBlendMode: theme === "dark" ? "normal" : "multiply", transition: "transform 450ms cubic-bezier(.22,.7,.28,1), stroke 450ms ease" }}
        />
      );
    }
    const dotR = (liveColorStep * 0.55).toFixed(3);
    return (
      <circle key={key} cx={c.x} cy={c.y} r={dotR}
        fill={continuousColor(t * 12)}
        style={{ transition: "fill 450ms ease" }}
      />
    );
  }

  const fieldDeps = [activeGrid, mode, theme, valueExtent.lo, valueExtent.hi, visibleRect, liveStep, liveSparseStep, liveRadialStep, liveColorStep];
  const fieldCells = useMemo(
    () => activeGrid.cells.map((c) => (!c.inside || !inView(c.x, c.y)) ? null : renderHalftoneCell(c, mode, `c${c.i}-${c.j}`)),
    fieldDeps, // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isMobile = viewport === "mobile";
  const isCompact = viewport !== "desktop";
  const controlsOpacity = isDocked ? 0 : 1;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ fontFamily: "'Geist Mono', monospace" }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full select-none"
        style={{ cursor: drag ? "grabbing" : "grab", touchAction: "none", display: "block" }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          setDirectManip(true);
          if (pointersRef.current.size === 1) {
            setDrag({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
            didDragRef.current = false;
            clickStartRef.current = { x: e.clientX, y: e.clientY };
          } else if (pointersRef.current.size === 2) {
            setDrag(null);
            const pts = [...pointersRef.current.values()];
            const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            pinchInitRef.current = { dist, zoom };
          }
        }}
        onPointerMove={onMove}
        onPointerUp={(e) => {
          if (!didDragRef.current && clickStartRef.current) {
            const ds = Math.hypot(e.clientX - clickStartRef.current.x, e.clientY - clickStartRef.current.y);
            if (ds < 6) handleMapClick(e.clientX, e.clientY);
          } else if (didDragRef.current) {
            setPan(panRef.current);
          }
          pointersRef.current.delete(e.pointerId);
          if (pointersRef.current.size < 2) pinchInitRef.current = null;
          if (pointersRef.current.size === 0) setDirectManip(false);
          setDrag(null);
        }}
      >
        <g ref={mainlandGroupRef} transform={groupTransform(pan.x, pan.y, zoom)}
          style={{ transition: directManip ? "none" : "transform 170ms cubic-bezier(.22,.7,.28,1)" }}>

          {/* Stepped coastline border */}
          <g stroke="var(--strata-line-strong)" strokeWidth={0.8} fill="none" vectorEffect="non-scaling-stroke">
            {borderSegments.map((s, i) => {
              if (!inView((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)) return null;
              return <line key={`b${i}`} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />;
            })}
          </g>

          {/* Halftone field */}
          <g>{fieldCells}</g>

          {/* Region borders */}
          <g stroke={theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}
            strokeWidth={0.8} fill="none" vectorEffect="non-scaling-stroke">
            {regionBorderSegs.map((s, i) => {
              if (!inView((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)) return null;
              return <line key={`rg${i}`} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />;
            })}
          </g>

          {/* Region labels at zoom ≥ 2 */}
          {showRegionLabels && (
            <g style={{ pointerEvents: "none" }}>
              {regionCentroids.map((s) => {
                const w = 32, h = 18;
                const inv = (1 / zoom).toFixed(3);
                return (
                  <g key={s.state} transform={`translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) scale(${inv})`}>
                    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2}
                      fill="var(--strata-panel)" fillOpacity={0.92}
                      stroke="var(--strata-line-strong)" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
                    <text x={0} y={0.5} fontSize={12} textAnchor="middle" dominantBaseline="middle"
                      fill="var(--strata-ink)" fillOpacity={0.92}
                      style={{ fontFamily: "Jura, sans-serif", fontWeight: 400, letterSpacing: "0.14em" }}>
                      {s.state}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* City markers */}
          <g>
            {cityReadings.map(({ city, value }) => {
              const p = projectGhana(city.lat, city.lng);
              const markerColor = bandColor(value);
              const isSelected = city.id === selectedCityId;
              const isHover = hover === city.id;
              return (
                <g
                  key={city.id}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onSelectCity(city.id)}
                  onMouseEnter={() => setHover(city.id)}
                  onMouseLeave={() => setHover(null)}
                >
                  <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
                  {isSelected && (
                    <>
                      <circle cx={p.x} cy={p.y} r={11} fill="none" stroke="var(--strata-bg)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
                      <circle cx={p.x} cy={p.y} r={11} fill="none" stroke={markerColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                      <circle cx={p.x} cy={p.y} r={2.6} fill={markerColor} />
                    </>
                  )}
                  {!isSelected && isHover && (
                    <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="var(--strata-ink)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Floating controls */}
      <div style={{ opacity: controlsOpacity, transition: "opacity 300ms ease", pointerEvents: isDocked ? "none" : undefined }}>
        <div className="absolute top-3 left-3 right-3 z-10">
          <TimeBar
            date={date}
            onChangeDate={onChangeDate}
            range={range}
            onChangeRange={onChangeRange}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            viewport={viewport}
          />
        </div>

        {!isCompact ? (
          <div className="absolute right-4 z-10" style={{ top: "50%", transform: "translateY(-50%)" }}>
            <ZoomScrubber zoom={zoom} onChange={setZoom} />
          </div>
        ) : (
          <div className="absolute right-3 z-10 flex flex-col gap-1" style={{ top: "50%", transform: "translateY(-50%)" }}>
            {[{ label: "+", delta: 1.5 }, { label: "−", delta: -1.5 }].map(({ label, delta }) => (
              <button
                key={label}
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))}
                className="strata-chrome flex items-center justify-center"
                style={{ width: 36, height: 36, fontSize: 18, color: "var(--chip-color-strong)" }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-stretch gap-1">
          <div className="strata-chrome flex flex-col gap-2 justify-center" style={{ padding: "4px 8px" }}>
            <span className="strata-label">Mode</span>
            <div className="flex items-center gap-1">
              {(["radial", "color", "outlined", "dots"] as MapMode[]).map((m) => (
                <button key={m} onClick={() => onChangeMode(m)} className="strata-chip" data-active={mode === m}>
                  {m === "outlined" ? "Circles" : m === "radial" ? "Radial" : m === "color" ? "Color" : "Dots"}
                </button>
              ))}
            </div>
          </div>

          {!isMobile && (
            <div className="strata-chrome flex flex-col gap-2 justify-center" style={{ padding: 8 }}>
              <span className="strata-label">Pollen Index</span>
              <div className="flex items-center gap-1.5">
                <span className="strata-tick-text" style={{ color: "var(--chip-color)" }}>High</span>
                <PollenIndexLegend mode={mode} theme={theme} />
                <span className="strata-tick-text" style={{ color: "var(--chip-color)" }}>Low</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click popup */}
      {popup && (
        <div
          className="absolute strata-chrome pointer-events-none"
          style={{
            left: Math.max(8, Math.min(popup.containerX - 70, 9999)),
            top: Math.max(8, popup.containerY - 90),
            width: 160,
            padding: "8px 12px",
            borderRadius: 6,
            zIndex: 40,
          }}
        >
          <div style={{ fontFamily: "Jura, sans-serif", fontSize: 10, letterSpacing: "0.3px", color: "var(--chip-color)", marginBottom: 2 }}>
            {popup.cityName}
          </div>
          <div style={{ fontFamily: "Jura, sans-serif", fontSize: 9, letterSpacing: "0.2px", color: "var(--chip-color)", marginBottom: 4 }}>
            {popup.regionName} Region
          </div>
          <div style={{ fontFamily: "Geist, sans-serif", fontWeight: 100, fontSize: 32, lineHeight: "36px", color: "var(--strata-ink)" }}>
            {popup.value.toFixed(1)}
          </div>
          <div style={{ fontFamily: "Jura, sans-serif", fontSize: 10, color: "var(--chip-color)" }}>
            Pollen Index
          </div>
        </div>
      )}
    </div>
  );
}

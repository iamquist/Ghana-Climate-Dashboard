export interface City {
  id: string;
  name: string;
  state: string; // region abbreviation
  region: string; // full region name
  lat: number;
  lng: number;
}

// Ghana cities — 16 administrative regions, major population centres
export const CITIES: City[] = [
  // Greater Accra
  {
    id: "acc",
    name: "Accra",
    state: "GA",
    region: "Greater Accra",
    lat: 5.56,
    lng: -0.2,
  },
  {
    id: "tem",
    name: "Tema",
    state: "GA",
    region: "Greater Accra",
    lat: 5.67,
    lng: -0.01,
  },
  // Ashanti
  {
    id: "ksi",
    name: "Kumasi",
    state: "AS",
    region: "Ashanti",
    lat: 6.69,
    lng: -1.62,
  },
  {
    id: "oda",
    name: "Obuasi",
    state: "AS",
    region: "Ashanti",
    lat: 6.2,
    lng: -1.67,
  },
  // Western
  {
    id: "tad",
    name: "Takoradi",
    state: "WE",
    region: "Western",
    lat: 4.9,
    lng: -1.76,
  },
  {
    id: "tka",
    name: "Tarkwa",
    state: "WE",
    region: "Western",
    lat: 5.3,
    lng: -2.0,
  },
  // Central
  {
    id: "cap",
    name: "Cape Coast",
    state: "CE",
    region: "Central",
    lat: 5.12,
    lng: -1.25,
  },
  {
    id: "win",
    name: "Winneba",
    state: "CE",
    region: "Central",
    lat: 5.35,
    lng: -0.63,
  },
  // Eastern
  {
    id: "kof",
    name: "Koforidua",
    state: "EA",
    region: "Eastern",
    lat: 6.09,
    lng: -0.26,
  },
  {
    id: "akim",
    name: "Akim Oda",
    state: "EA",
    region: "Eastern",
    lat: 5.92,
    lng: -0.99,
  },
  // Volta
  { id: "hoh", name: "Ho", state: "VO", region: "Volta", lat: 6.6, lng: 0.47 },
  {
    id: "kpe",
    name: "Kpando",
    state: "VO",
    region: "Volta",
    lat: 6.99,
    lng: 0.3,
  },
  // Brong-Ahafo / Bono
  {
    id: "sua",
    name: "Sunyani",
    state: "BO",
    region: "Bono",
    lat: 7.34,
    lng: -2.33,
  },
  {
    id: "bea",
    name: "Berekum",
    state: "BO",
    region: "Bono",
    lat: 7.45,
    lng: -2.59,
  },
  // Northern
  {
    id: "tam",
    name: "Tamale",
    state: "NO",
    region: "Northern",
    lat: 9.4,
    lng: -0.84,
  },
  {
    id: "sav",
    name: "Savelugu",
    state: "NO",
    region: "Northern",
    lat: 9.63,
    lng: -0.83,
  },
  // Upper East
  {
    id: "bol",
    name: "Bolgatanga",
    state: "UE",
    region: "Upper East",
    lat: 10.79,
    lng: -0.85,
  },
  {
    id: "nas",
    name: "Navrongo",
    state: "UE",
    region: "Upper East",
    lat: 10.9,
    lng: -1.09,
  },
  // Upper West
  {
    id: "waw",
    name: "Wa",
    state: "UW",
    region: "Upper West",
    lat: 10.06,
    lng: -2.5,
  },
  {
    id: "lawra",
    name: "Lawra",
    state: "UW",
    region: "Upper West",
    lat: 10.65,
    lng: -2.9,
  },
  // Oti
  {
    id: "dab",
    name: "Dambai",
    state: "OT",
    region: "Oti",
    lat: 8.06,
    lng: 0.18,
  },
  // Bono East
  {
    id: "tec",
    name: "Techiman",
    state: "BE",
    region: "Bono East",
    lat: 7.59,
    lng: -1.94,
  },
  // Ahafo
  {
    id: "goa",
    name: "Goaso",
    state: "AH",
    region: "Ahafo",
    lat: 6.8,
    lng: -2.52,
  },
  // North East
  {
    id: "che",
    name: "Chereponi",
    state: "NE",
    region: "North East",
    lat: 10.34,
    lng: 0.54,
  },
  // Savannah
  {
    id: "dam",
    name: "Damongo",
    state: "SA",
    region: "Savannah",
    lat: 9.08,
    lng: -1.82,
  },
  // Western North
  {
    id: "sez",
    name: "Sefwi Wiawso",
    state: "WN",
    region: "Western North",
    lat: 6.21,
    lng: -2.48,
  },
];

export type AllergenType = "tree" | "grass" | "weed";

export interface PollenReading {
  tree: number;
  grass: number;
  weed: number;
  total: number;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = d.getTime() - start;
  return Math.floor(diff / 86400000);
}

function bell(day: number, peak: number, width: number): number {
  const x = (day - peak + 365) % 365;
  const dx = Math.min(x, 365 - x);
  return Math.exp(-(dx * dx) / (2 * width * width));
}

/**
 * Ghana has two main pollen seasons driven by its tropical wet/dry climate:
 *
 * Harmattan (dry) season — roughly Nov–Mar in the north, Nov–Feb in the south.
 * Saharan dust + dry winds desiccate vegetation and trigger heavy grass/weed pollen.
 * Peak day ≈ day 30 (late Jan). Further north the season is longer and more severe.
 *
 * Minor dry season — roughly Aug south of ~7°N (Accra region only).
 * Brings a secondary grass bloom. Peak day ≈ day 225 (mid-Aug).
 *
 * Rainforest belt (lat < 7°) has denser tree pollen during the long rains (Apr–Jun)
 * as flowering trees shed after dry stress. Peak day ≈ day 120 (late Apr).
 *
 * Savannah/northern belt (lat > 8°) has strong grass flush at onset of rains (Apr–May).
 */
export function seasonalCurve(
  type: AllergenType,
  day: number,
  lat: number,
): number {
  return curve(type, day, lat);
}

function curve(type: AllergenType, day: number, lat: number): number {
  // North–south gradient: 0 = equatorial coast (5°N), 1 = far north (11°N)
  const northness = Math.max(0, Math.min(1, (lat - 5) / 6));

  if (type === "tree") {
    // Rainforest trees bloom at start of long rains (Apr). Stronger in south.
    const southBoost = 1 - northness * 0.4;
    return bell(day, 110, 30) * southBoost;
  }

  if (type === "grass") {
    // Primary harmattan peak (Jan) + savannah onset-of-rains peak (May)
    const harmattan = bell(day, 25, 40) * (0.5 + northness * 0.5);
    const onset = bell(day, 130, 28) * (0.3 + northness * 0.6);
    // Minor dry-season bloom (Aug, coastal south only)
    const minorDry = bell(day, 225, 25) * Math.max(0, 1 - northness * 2);
    return Math.min(1, harmattan + onset + minorDry);
  }

  // Weed: heavy harmattan shed + post-rain weed burst (Sep)
  const harmattanWeed = bell(day, 20, 35) * (0.4 + northness * 0.5);
  const postRain = bell(day, 255, 30) * (0.5 + northness * 0.3);
  return Math.min(1, harmattanWeed + postRain);
}

export function getPollen(
  cityId: string,
  date: Date = new Date(),
): PollenReading {
  const city = CITIES.find((c) => c.id === cityId);
  if (!city) return { tree: 0, grass: 0, weed: 0, total: 0 };
  const d = dayOfYear(date);
  const dailyRand = mulberry32(
    hashSeed(`${cityId}-${date.toISOString().slice(0, 10)}`),
  );
  const baseRand = mulberry32(hashSeed(cityId));
  const baseline = baseRand() * 1.2;

  const t = Math.max(
    0,
    Math.min(
      12,
      curve("tree", d, city.lat) * 12 + baseline + (dailyRand() - 0.5) * 1.8,
    ),
  );
  const g = Math.max(
    0,
    Math.min(
      12,
      curve("grass", d, city.lat) * 12 + baseline + (dailyRand() - 0.5) * 1.8,
    ),
  );
  const w = Math.max(
    0,
    Math.min(
      12,
      curve("weed", d, city.lat) * 12 + baseline + (dailyRand() - 0.5) * 1.8,
    ),
  );
  const total = Math.max(0, Math.min(12, ((t + g + w) / 3) * 1.4));
  return {
    tree: round1(t),
    grass: round1(g),
    weed: round1(w),
    total: round1(total),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export interface SeriesPoint {
  label: string;
  date: Date;
  tree: number;
  grass: number;
  weed: number;
  total: number;
}

export type Range = "day" | "month" | "year";

export function getSeries(
  cityId: string,
  range: Range,
  anchor: Date = new Date(),
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  if (range === "day") {
    for (let h = 0; h < 24; h++) {
      const d = new Date(anchor);
      d.setHours(h, 0, 0, 0);
      const r = getPollen(cityId, d);
      // In Ghana diurnal peaks are mid-morning (10 AM) due to heat suppression at noon
      const diurnal = Math.sin(((h - 5) / 24) * Math.PI * 2) * 0.45 + 1;
      out.push({
        label: `${h.toString().padStart(2, "00")}:00`,
        date: d,
        tree: round1(r.tree * diurnal),
        grass: round1(r.grass * diurnal),
        weed: round1(r.weed * diurnal),
        total: round1(r.total * diurnal),
      });
    }
  } else if (range === "month") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      const r = getPollen(cityId, d);
      out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, date: d, ...r });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(anchor);
      d.setMonth(d.getMonth() - i, 15);
      const r = getPollen(cityId, d);
      out.push({
        label: d.toLocaleString("en-GH", { month: "short" }),
        date: d,
        ...r,
      });
    }
  }
  return out;
}

export async function fetchPollen(
  cityId: string,
  date: Date = new Date(),
): Promise<PollenReading> {
  return Promise.resolve(getPollen(cityId, date));
}

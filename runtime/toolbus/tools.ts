export type PlaceSearchResult = {
  place_id: string;
  title: string;
  tag: string;
  photo_ref?: string;
  photo_url?: string;
};

export type ToolMode = 'real' | 'stub' | 'record' | 'replay';

export interface ToolImplementations {
  places: {
    search: (args: { query: string; grid_id?: string; time_window?: string }) => Promise<PlaceSearchResult[]>;
  };
  maps: {
    link: (args: { query: string }) => Promise<{ url: string }>;
    arrivalGlance: (args: { place_title?: string; query?: string; transport_mode?: string }) => Promise<{ lines: string[] }>;
    sendToCar: (args: { url: string }) => Promise<{ ok: true }>;
  };
  weather: {
    forecast: (args: { grid_id?: string; days?: number }) => Promise<{ rain_flag: boolean; summary: string }>;
  };
  storage: {
    pocketAppend: (args: { ticket: any }) => Promise<{ ok: true }>;
    whispersAppend: (args: { note: any }) => Promise<{ ok: true }>;
  };
}

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && Boolean((process as any).versions?.node);
}

function env(key: string): string {
  if (!isNodeRuntime()) return '';
  return String((process as any).env?.[key] ?? '').trim();
}

async function fetchJson(url: string, opts?: RequestInit & { timeoutMs?: number; retries?: number; retryDelayMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const retries = Math.max(0, opts?.retries ?? 1);
  const retryDelayMs = Math.max(50, opts?.retryDelayMs ?? 250);
  let attempt = 0;
  let lastError: any;

  while (attempt <= retries) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      lastError = err;
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
    } finally {
      clearTimeout(id);
    }
    attempt += 1;
  }
  throw lastError;
}

type CircuitState = { failures: number; openedUntil: number; lastFailure: number };
const CIRCUIT_STATE = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 5 * 60 * 1000;
const CIRCUIT_OPEN_MS = 2 * 60 * 1000;

async function circuitCall<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const state = CIRCUIT_STATE.get(key);
  if (state?.openedUntil && now < state.openedUntil) {
    throw new Error(`circuit_open:${key}`);
  }
  try {
    const out = await fn();
    CIRCUIT_STATE.set(key, { failures: 0, openedUntil: 0, lastFailure: 0 });
    return out;
  } catch (err) {
    const next: CircuitState = state ?? { failures: 0, openedUntil: 0, lastFailure: 0 };
    if (now - next.lastFailure > CIRCUIT_WINDOW_MS) next.failures = 0;
    next.failures += 1;
    next.lastFailure = now;
    if (next.failures >= CIRCUIT_THRESHOLD) {
      next.openedUntil = now + CIRCUIT_OPEN_MS;
    }
    CIRCUIT_STATE.set(key, next);
    throw err;
  }
}

function mapGridToCity(gridId?: string) {
  const base = (gridId ?? '').toLowerCase();
  if (base.startsWith('sh')) return 'Shanghai';
  if (base.startsWith('bj')) return 'Beijing';
  if (base.startsWith('gz')) return 'Guangzhou';
  if (base.startsWith('sz')) return 'Shenzhen';
  return env('NF_DEFAULT_CITY') || 'Shanghai';
}

function photoRefToToken(photoRef?: string) {
  if (!photoRef) return undefined;
  return `nf://photo/${photoRef}`;
}

async function googlePlacesTextSearch(query: string) {
  const key = env('GOOGLE_PLACES_API_KEY') || env('GOOGLE_MAPS_API_KEY');
  if (!key) throw new Error('missing GOOGLE_PLACES_API_KEY');
  const q = encodeURIComponent(query);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&language=zh-CN&key=${key}`;
  const data = await circuitCall('places.search', () => fetchJson(url, { timeoutMs: 9000, retries: 1, retryDelayMs: 300 }));
  if (!data || data.status !== 'OK') {
    const msg = data?.error_message || data?.status || 'places_failed';
    throw new Error(String(msg));
  }
  return (data.results ?? []).map((r: any) => {
    const photo_ref = String(r?.photos?.[0]?.photo_reference ?? '').trim() || undefined;
    return {
      place_id: String(r.place_id ?? ''),
      title: String(r.name ?? r.formatted_address ?? 'Place'),
      tag: String((r.types && r.types[0]) ? r.types[0].toUpperCase() : 'PLACE'),
      photo_ref,
      photo_url: photoRefToToken(photo_ref)
    };
  });
}

async function nominatimSearch(query: string) {
  const q = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=6`;
  const data = await circuitCall('places.search', () => fetchJson(url, {
    timeoutMs: 8000,
    retries: 1,
    retryDelayMs: 300,
    headers: {
      'User-Agent': 'nightfall-orchestrator/1.0 (demo)'
    }
  }));
  if (!Array.isArray(data)) throw new Error('nominatim_failed');
  return data.map((r: any) => ({
    place_id: String(r.place_id ?? r.osm_id ?? ''),
    title: String(r.display_name ?? r.name ?? 'Place'),
    tag: String((r.type || r.class || 'PLACE')).toUpperCase()
  }));
}

async function openMeteoGeocode(name: string) {
  const q = encodeURIComponent(name);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=zh&format=json`;
  const data = await circuitCall('weather.forecast', () => fetchJson(url, { timeoutMs: 8000, retries: 1, retryDelayMs: 300 }));
  const item = data?.results?.[0];
  if (!item) throw new Error('geocode_not_found');
  return { lat: item.latitude, lon: item.longitude, name: item.name };
}

async function openMeteoForecast(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation&hourly=precipitation_probability,precipitation&forecast_days=1&timezone=auto`;
  const data = await circuitCall('weather.forecast', () => fetchJson(url, { timeoutMs: 8000, retries: 1, retryDelayMs: 300 }));
  const current = data?.current ?? {};
  const hourly = data?.hourly ?? {};
  const precip = Number(current.precipitation ?? 0);
  const prob = Array.isArray(hourly.precipitation_probability) ? Number(hourly.precipitation_probability[0] ?? 0) : 0;
  const temp = Number(current.temperature_2m ?? NaN);
  const rain_flag = precip > 0 || prob >= 50;
  const summary = `temp=${isNaN(temp) ? '?' : temp}C precip=${precip}mm prob=${prob}%`;
  return { rain_flag, summary };
}

export const StubTools: ToolImplementations = {
  places: {
    async search(args) {
      const q = args.query || 'quiet place';
      return [
        { place_id: 'p1', title: `${q} - hotel lobby`, tag: 'stable' },
        { place_id: 'p2', title: `${q} - late cafe`, tag: 'warm' },
        { place_id: 'p3', title: `${q} - bookstore`, tag: 'minimal' }
      ];
    }
  },
  maps: {
    async link(args) {
      const q = encodeURIComponent(args.query || 'Shanghai');
      return { url: `https://www.google.com/maps/search/?api=1&query=${q}` };
    }
    ,
    async arrivalGlance(args) {
      const title = (args.place_title || args.query || 'destination').slice(0, 60);
      // PoC: 3-line “last 300m” checklist. Real impl comes from Places/Visits + parking model.
      return {
        lines: [
          `停车：优先找最近地库/路侧（视情况）`,
          `入口：靠近主入口后再确认招牌（${title})`,
          `步行：3–7分钟，若人满直接切Plan B`
        ]
      };
    },
    async sendToCar(_args) {
      // PoC: no real car integration. Caller can treat as “copy/open link”.
      return { ok: true } as const;
    }
  },
  weather: {
    async forecast(_args) {
      // PoC stub: treat "rain" as unknown unless host provides real forecast.
      return { rain_flag: false, summary: 'weather_stub: no precipitation data' };
    }
  },
  storage: {
    async pocketAppend(_args) { return { ok: true } as const; },
    async whispersAppend(_args) { return { ok: true } as const; }
  }
};

export const DefaultTools: ToolImplementations = {
  places: {
    async search(args) {
      const provider = (env('PLACES_PROVIDER') || 'google').toLowerCase();
      try {
        if (provider === 'google') {
          const results = await googlePlacesTextSearch(args.query || 'quiet place');
          return results.slice(0, 8);
        }
        if (provider === 'nominatim') {
          const results = await nominatimSearch(args.query || 'quiet place');
          return results.slice(0, 8);
        }
      } catch (e) {
        // fall back to stub
      }
      // Try nominatim as a real fallback when no key is configured.
      try {
        const results = await nominatimSearch(args.query || 'quiet place');
        return results.slice(0, 8);
      } catch {
        // ignore
      }
      return StubTools.places.search(args);
    }
  },
  maps: {
    async link(args) {
      // Google Maps URL is a real link and works without API key.
      const q = encodeURIComponent(args.query || 'Shanghai');
      return { url: `https://www.google.com/maps/search/?api=1&query=${q}` };
    },
    async arrivalGlance(args) {
      // Still conservative: no origin, so provide minimal, safe guidance.
      const title = (args.place_title || args.query || 'destination').slice(0, 60);
      return {
        lines: [
          `步行：约 3–10 分钟（视实际距离）`,
          `入口：到场再确认招牌（${title})`,
          `若人多/等位>10分钟，切 Plan B`
        ]
      };
    },
    async sendToCar(_args) {
      return { ok: true } as const;
    }
  },
  weather: {
    async forecast(args) {
      const provider = (env('WEATHER_PROVIDER') || 'openmeteo').toLowerCase();
      try {
        if (provider === 'openmeteo') {
          const city = env('WEATHER_CITY') || mapGridToCity(args.grid_id);
          const geo = await openMeteoGeocode(city);
          return await openMeteoForecast(geo.lat, geo.lon);
        }
      } catch (e) {
        // fall back to stub
      }
      return StubTools.weather.forecast(args);
    }
  },
  storage: {
    async pocketAppend(args) { return StubTools.storage.pocketAppend(args); },
    async whispersAppend(args) { return StubTools.storage.whispersAppend(args); }
  }
};

export function getToolMode(): ToolMode {
  const raw = (env('NF_TOOL_MODE') || '').toLowerCase();
  if (raw === 'stub' || raw === 'replay' || raw === 'record') return raw as ToolMode;
  return 'real';
}

export function resolveTools(mode?: ToolMode): ToolImplementations {
  if (mode === 'stub') return StubTools;
  if (mode === 'replay') return StubTools;
  if (mode === 'record') {
    const source = (env('NF_TOOL_RECORD_SOURCE') || 'real').toLowerCase();
    return source === 'stub' ? StubTools : DefaultTools;
  }
  return DefaultTools;
}

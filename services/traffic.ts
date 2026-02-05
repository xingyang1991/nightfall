export interface TrafficSnapshot {
  status: number;
  description?: string;
  expedite: number;
  congested: number;
  blocked: number;
  unknown: number;
}

const cache = new Map<string, { ts: number; data: TrafficSnapshot | null }>();
const CACHE_TTL = 2 * 60 * 1000;

function parsePercent(input: any): number {
  const raw = String(input ?? '').replace('%', '').trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function getTrafficStatus(lat: number, lng: number, radius = 2000): Promise<TrafficSnapshot | null> {
  const key = `${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const apiKey = String(process.env.AMAP_API_KEY ?? '').trim();
  if (!apiKey) {
    cache.set(key, { ts: Date.now(), data: null });
    return null;
  }

  try {
    const url = new URL('https://restapi.amap.com/v3/traffic/status/circle');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('location', `${lng},${lat}`);
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('extensions', 'base');
    url.searchParams.set('output', 'JSON');

    const res = await fetch(url.toString());
    const data = await res.json();
    if (data?.status !== '1') {
      cache.set(key, { ts: Date.now(), data: null });
      return null;
    }

    const evaluation = data?.trafficinfo?.evaluation ?? {};
    const snapshot: TrafficSnapshot = {
      status: Number(evaluation.status ?? 0) || 0,
      description: String(evaluation.description ?? ''),
      expedite: parsePercent(evaluation.expedite),
      congested: parsePercent(evaluation.congested),
      blocked: parsePercent(evaluation.blocked),
      unknown: parsePercent(evaluation.unknown)
    };

    cache.set(key, { ts: Date.now(), data: snapshot });
    return snapshot;
  } catch {
    cache.set(key, { ts: Date.now(), data: null });
    return null;
  }
}

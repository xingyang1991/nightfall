import type { CityAtmosphere } from '../types';
import { searchNearby, type AmapPlace } from './amap';
import { getWeatherByLocation } from './weather';
import { getTrafficStatus } from './traffic';
import { getPresenceStats, type PresenceStats } from './presence';

const cache = new Map<string, { ts: number; data: CityAtmosphere }>();
const CACHE_TTL = 2 * 60 * 1000;

export async function getCityAtmosphere(
  lat: number,
  lng: number,
  city: string,
  opts?: { presence?: PresenceStats | null }
): Promise<CityAtmosphere> {
  const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  const cached = cache.get(key);
  const cachedValid = cached && Date.now() - cached.ts < CACHE_TTL;

  const keywords = ['餐饮', '咖啡', '酒吧', '书店', '夜宵'];
  const tasks = keywords.map((k) =>
    searchNearby({ keywords: k, location: `${lng},${lat}`, radius: 5000, offset: 10 })
  );
  let base: CityAtmosphere | null = cachedValid ? cached!.data : null;

  if (!base) {
    const results = (await Promise.all(tasks)).flat();
    const places = uniqPlaces(results);
    const [weather, traffic] = await Promise.all([
      getWeatherByLocation(lat, lng),
      getTrafficStatus(lat, lng, 2000)
    ]);
    const openPlaces = places.filter(isLikelyOpen);
    const trafficPenalty = traffic
      ? clamp(Math.round((traffic.congested * 0.6 + traffic.blocked * 1.0 + traffic.unknown * 0.2) * 0.2), 0, 20)
      : 0;
    const trafficBoost = traffic ? clamp(Math.round((traffic.expedite * 0.1)), 0, 8) : 0;
    const pulseScore = clamp(Math.round(12 + openPlaces.length * 3 + trafficBoost - trafficPenalty), 0, 100);

    const hotspots = buildHotspots(places);

    base = {
      timestamp: Date.now(),
      city,
      pulse: {
        level: getPulseLevel(pulseScore),
        score: pulseScore,
        description: getPulseDescription(pulseScore)
      },
      hotspots,
      anonymous_users: buildAnonymousUsers(openPlaces.length),
      weather: {
        condition: weather.condition,
        temperature: Math.round(weather.temperature),
        humidity: Math.round(weather.humidity),
        mood: getWeatherMood(weather.condition)
      },
      open_places: {
        total: openPlaces.length,
        by_category: groupByCategory(openPlaces)
      }
    };
    cache.set(key, { ts: Date.now(), data: base });
  }

  const presence = opts?.presence ?? await getPresenceStats({ city, lat, lng });
  if (presence) {
    return { ...base, anonymous_users: presence };
  }
  return base;
}

function uniqPlaces(places: AmapPlace[]) {
  const map = new Map<string, AmapPlace>();
  for (const p of places) {
    if (!p?.id) continue;
    if (!map.has(p.id)) map.set(p.id, p);
  }
  return Array.from(map.values());
}

function buildHotspots(places: AmapPlace[]) {
  return places
    .slice(0, 8)
    .map((p, idx) => ({
      name: p.name,
      center: { lat: p.lat, lng: p.lng },
      intensity: Math.min(1, Math.max(0.3, (Number(p.rating || 3) / 5))),
      category: String(p.type || '餐饮').split(';')[0] || '餐饮'
    }));
}

function buildAnonymousUsers(openCount: number) {
  const total = clamp(50 + openCount * 4, 20, 260);
  const nearby = clamp(Math.round(openCount * 0.4), 5, 40);
  return {
    total,
    nearby,
    distribution: [
      { area: '市中心', count: Math.round(total * 0.4) },
      { area: '大学城', count: Math.round(total * 0.25) },
      { area: '商业区', count: Math.round(total * 0.35) }
    ]
  };
}

function groupByCategory(places: AmapPlace[]) {
  const out: Record<string, number> = {};
  for (const p of places) {
    const key = String(p.type || '其他').split(';')[0] || '其他';
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function isLikelyOpen(place: AmapPlace): boolean {
  const text = String(place.opentime || '').toLowerCase();
  if (!text) return true;
  if (text.includes('休息') || text.includes('停业')) return false;
  if (text.includes('24')) return true;
  return true;
}

function getPulseLevel(score: number): CityAtmosphere['pulse']['level'] {
  if (score < 25) return 'quiet';
  if (score < 50) return 'moderate';
  if (score < 75) return 'vibrant';
  return 'bustling';
}

function getPulseDescription(score: number): string {
  if (score < 25) return '城市正在沉睡，只有零星灯火';
  if (score < 50) return '夜色渐浓，部分区域仍有活力';
  if (score < 75) return '夜生活正酣，多处热闹非凡';
  return '城市不夜，到处都是故事';
}

function getWeatherMood(condition: string): string {
  if (condition.includes('rain') || condition.includes('drizzle')) return '宜室内活动';
  if (condition.includes('snow')) return '适合安静停留';
  if (condition.includes('fog')) return '放慢脚步';
  return '适合散步';
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

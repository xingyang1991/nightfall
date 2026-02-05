export interface WeatherSnapshot {
  condition: string;
  temperature: number;
  humidity: number;
  code?: number;
}

const cache = new Map<string, { ts: number; data: WeatherSnapshot }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function getWeatherByLocation(lat: number, lng: number): Promise<WeatherSnapshot> {
  const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const current = data?.current ?? {};
    const temp = Number(current.temperature_2m);
    const humidity = Number(current.relative_humidity_2m);
    const code = Number(current.weather_code);
    const snapshot: WeatherSnapshot = {
      condition: mapWeatherCode(code),
      temperature: Number.isFinite(temp) ? temp : 0,
      humidity: Number.isFinite(humidity) ? humidity : 0,
      code: Number.isFinite(code) ? code : undefined
    };
    cache.set(key, { ts: Date.now(), data: snapshot });
    return snapshot;
  } catch (error) {
    const fallback: WeatherSnapshot = { condition: 'clear', temperature: 0, humidity: 0 };
    cache.set(key, { ts: Date.now(), data: fallback });
    return fallback;
  }
}

function mapWeatherCode(code?: number): string {
  if (code === undefined || code === null || Number.isNaN(code)) return 'clear';
  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return 'partly_cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 55) return 'drizzle';
  if (code >= 61 && code <= 65) return 'rain';
  if (code >= 71 && code <= 75) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}

import { Redis } from '@upstash/redis';

export interface PresenceStats {
  total: number;
  nearby: number;
  distribution: Array<{ area: string; count: number }>;
}

const TTL_MS = Number(process.env.NF_PRESENCE_TTL_MS ?? 180_000);
const GRID_STEP = Number(process.env.NF_PRESENCE_GRID_STEP ?? 0.03);

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = String(process.env.UPSTASH_REDIS_URL ?? '').trim();
  const token = String(process.env.UPSTASH_REDIS_TOKEN ?? '').trim();
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function gridKey(lat: number, lng: number, step = GRID_STEP): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'unknown';
  const latIdx = Math.floor(lat / step);
  const lngIdx = Math.floor(lng / step);
  return `${latIdx}_${lngIdx}`;
}

function neighborKeys(lat: number, lng: number): string[] {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ['unknown'];
  const baseLat = Math.floor(lat / GRID_STEP);
  const baseLng = Math.floor(lng / GRID_STEP);
  const keys: string[] = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      keys.push(`${baseLat + dx}_${baseLng + dy}`);
    }
  }
  return keys;
}

const memoryBuckets = new Map<string, Map<string, number>>();

function memPing(key: string, userId: string, now: number) {
  if (!memoryBuckets.has(key)) memoryBuckets.set(key, new Map());
  const bucket = memoryBuckets.get(key)!;
  bucket.set(userId, now);
  for (const [uid, ts] of bucket.entries()) {
    if (now - ts > TTL_MS) bucket.delete(uid);
  }
}

function memCount(key: string, now: number): number {
  const bucket = memoryBuckets.get(key);
  if (!bucket) return 0;
  for (const [uid, ts] of bucket.entries()) {
    if (now - ts > TTL_MS) bucket.delete(uid);
  }
  return bucket.size;
}

function buildDistribution(total: number, nearby: number) {
  const other = Math.max(0, total - nearby);
  return [
    { area: '你附近', count: nearby },
    { area: '城市其他', count: other }
  ];
}

export async function pingPresence(opts: {
  userId: string;
  city: string;
  lat: number;
  lng: number;
}): Promise<PresenceStats | null> {
  const now = Date.now();
  const city = opts.city || 'city';
  const userId = opts.userId || `guest_${Math.random().toString(36).slice(2, 8)}`;
  const grid = gridKey(opts.lat, opts.lng);
  const redis = getRedis();

  if (!redis) {
    memPing(`presence:${city}:all`, userId, now);
    memPing(`presence:${city}:grid:${grid}`, userId, now);
    const total = memCount(`presence:${city}:all`, now);
    const nearby = neighborKeys(opts.lat, opts.lng)
      .map((k) => memCount(`presence:${city}:grid:${k}`, now))
      .reduce((a, b) => a + b, 0);
    return { total, nearby, distribution: buildDistribution(total, nearby) };
  }

  const cityKey = `presence:${city}:all`;
  const gridKeyName = `presence:${city}:grid:${grid}`;
  const expireBefore = now - TTL_MS;

  await redis.zadd(cityKey, { score: now, member: userId });
  await redis.zadd(gridKeyName, { score: now, member: userId });
  await redis.zremrangebyscore(cityKey, 0, expireBefore);
  await redis.zremrangebyscore(gridKeyName, 0, expireBefore);

  const total = await redis.zcard(cityKey);
  const nearbyCounts = await Promise.all(
    neighborKeys(opts.lat, opts.lng).map(async (k) => {
      const kName = `presence:${city}:grid:${k}`;
      await redis.zremrangebyscore(kName, 0, expireBefore);
      return redis.zcount(kName, expireBefore + 1, now);
    })
  );
  const nearby = nearbyCounts.reduce((a, b) => a + b, 0);
  return { total, nearby, distribution: buildDistribution(total, nearby) };
}

export async function getPresenceStats(opts: { city: string; lat: number; lng: number }): Promise<PresenceStats | null> {
  const now = Date.now();
  const city = opts.city || 'city';
  const redis = getRedis();

  if (!redis) {
    const total = memCount(`presence:${city}:all`, now);
    const nearby = neighborKeys(opts.lat, opts.lng)
      .map((k) => memCount(`presence:${city}:grid:${k}`, now))
      .reduce((a, b) => a + b, 0);
    return { total, nearby, distribution: buildDistribution(total, nearby) };
  }

  const cityKey = `presence:${city}:all`;
  const expireBefore = now - TTL_MS;
  await redis.zremrangebyscore(cityKey, 0, expireBefore);
  const total = await redis.zcard(cityKey);
  const nearbyCounts = await Promise.all(
    neighborKeys(opts.lat, opts.lng).map(async (k) => {
      const kName = `presence:${city}:grid:${k}`;
      await redis.zremrangebyscore(kName, 0, expireBefore);
      return redis.zcount(kName, expireBefore + 1, now);
    })
  );
  const nearby = nearbyCounts.reduce((a, b) => a + b, 0);
  return { total, nearby, distribution: buildDistribution(total, nearby) };
}

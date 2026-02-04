export interface CircleConfig {
  bucketMinutes: number;
  kMin: number;
  delaySeconds: number;
  ttlSeconds: number;
}

export interface CircleSignal {
  visible: boolean;
  count: number;
  intensity: number; // 0..5
  summaryLine: string;
}

function bucketKey(nowMs: number, bucketMinutes: number) {
  const bucketMs = bucketMinutes * 60 * 1000;
  return Math.floor(nowMs / bucketMs);
}

export function circlePulse(session: Record<string, any>, gridId: string, mode: string, nowMs: number, cfg: CircleConfig) {
  const bk = bucketKey(nowMs, cfg.bucketMinutes);
  const key = `circle_${gridId}_${mode}_${bk}`;
  const bucket = session[key] ?? { count: 0, firstTs: nowMs, lastTs: nowMs };
  bucket.count += 1;
  bucket.lastTs = nowMs;
  if (!bucket.firstTs) bucket.firstTs = nowMs;
  session[key] = bucket;
  return key;
}

export function circleGet(session: Record<string, any>, gridId: string, mode: string, nowMs: number, cfg: CircleConfig): CircleSignal {
  // Sum across current bucket only for PoC (production can sum across nearby buckets)
  const bk = bucketKey(nowMs, cfg.bucketMinutes);
  const key = `circle_${gridId}_${mode}_${bk}`;
  const bucket = session[key];
  const count = Number(bucket?.count ?? 0);
  const ageOk = bucket ? (nowMs - Number(bucket.firstTs ?? nowMs)) >= cfg.delaySeconds * 1000 : false;
  const ttlOk = bucket ? (nowMs - Number(bucket.lastTs ?? nowMs)) <= cfg.ttlSeconds * 1000 : false;

  const visible = Boolean(bucket) && ttlOk && ageOk && count >= cfg.kMin;
  const intensity = visible ? Math.min(5, Math.max(1, Math.round(count / cfg.kMin))) : 0;
  const summaryLine = visible ? `附近亮着 ${count} 盏灯（仅聚合）` : `安静中（k≥${cfg.kMin}）`;
  return { visible, count, intensity, summaryLine };
}

export function circleCleanup(session: Record<string, any>, nowMs: number, cfg: CircleConfig) {
  const prefix = 'circle_';
  const ttlMs = cfg.ttlSeconds * 1000;
  for (const k of Object.keys(session)) {
    if (!k.startsWith(prefix)) continue;
    const b = session[k];
    const lastTs = Number(b?.lastTs ?? 0);
    if (lastTs && nowMs - lastTs > ttlMs) {
      delete session[k];
    }
  }
}

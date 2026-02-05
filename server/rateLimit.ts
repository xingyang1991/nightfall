type RateEntry = { count: number; resetAt: number };

const buckets = new Map<string, RateEntry>();

export function rateLimit(opts: { windowMs: number; max: number; keyFn: (req: any) => string }) {
  const windowMs = opts.windowMs;
  const max = opts.max;
  const keyFn = opts.keyFn;

  return (req: any, res: any, next: any) => {
    const key = keyFn(req);
    if (!key) return next();
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: 'rate_limited' });
    }
    entry.count += 1;
    return next();
  };
}

export function getClientIp(req: any): string {
  const xf = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return xf || req.socket?.remoteAddress || 'unknown';
}

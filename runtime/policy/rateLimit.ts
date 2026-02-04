import type { SkillManifest } from '../contracts';
import type { AuditLog } from '../audit/audit';

/**
 * Lightweight rate limiter for PoC.
 * In production: enforce server-side with user identity + durable store.
 */
export class RateLimiter {
  private calls: Record<string, number[]> = {};

  constructor(private audit?: AuditLog) {}

  check(skillId: string, manifest: SkillManifest): boolean {
    const now = Date.now();
    const perMinute = manifest.rateLimit?.perMinute ?? 60;
    const perNight = manifest.rateLimit?.perNight ?? 9999;

    const windowMs = 60_000;
    const nightMs = 12 * 60 * 60_000;

    const list = this.calls[skillId] ?? [];
    // keep only last minute
    const minuteList = list.filter(ts => now - ts < windowMs);
    const nightList = list.filter(ts => now - ts < nightMs);

    if (minuteList.length >= perMinute) {
      this.audit?.push({ type: 'policy_violation', ts: new Date().toISOString(), code: 'rate_limit_minute', detail: `${skillId} exceeded perMinute=${perMinute}` });
      this.calls[skillId] = nightList; // prune
      return false;
    }
    if (nightList.length >= perNight) {
      this.audit?.push({ type: 'policy_violation', ts: new Date().toISOString(), code: 'rate_limit_night', detail: `${skillId} exceeded perNight=${perNight}` });
      this.calls[skillId] = nightList; // prune
      return false;
    }

    nightList.push(now);
    this.calls[skillId] = nightList;
    return true;
  }
}

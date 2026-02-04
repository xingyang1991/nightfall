import type { AuditLog } from '../audit/audit';

/** Per-surface update throttling to prevent “info feed drift”. */
export const DEFAULT_SURFACE_BUDGET_MS: Record<string, number> = {
  tonight: 0,
  discover: 2000,
  sky: 8000,
  pocket: 30000,
  whispers: 60000,
  radio: 5000,
  veil: 12 * 60 * 60 * 1000,
  footprints: 60000,
};

export function shouldUpdateSurface(session: Record<string, any>, surfaceId: string, nowMs: number, audit?: AuditLog): boolean {
  const budget = DEFAULT_SURFACE_BUDGET_MS[surfaceId] ?? 10000;
  if (budget <= 0) return true;
  const key = `lastSurfaceUpdate_${surfaceId}`;
  const last = Number(session[key] ?? 0);
  if (nowMs - last >= budget) {
    session[key] = nowMs;
    return true;
  }
  audit?.push({
    type: 'policy_clip',
    ts: new Date().toISOString(),
    code: 'surface_budget',
    detail: `surfaceId=${surfaceId} budgetMs=${budget}`
  } as any);
  return false;
}

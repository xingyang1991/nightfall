import type { CuratorialBundle, CandidateItem } from '../../types';
import type { AuditLog } from '../audit/audit';

/**
 * Deterministic Plan B selector.
 * In production, this should use Places/Visits, time windows, parking, crowd signals, etc.
 * For PoC, we use a conservative heuristic:
 * - Prefer a different place_id if available
 * - Prefer tags containing stable/late/hotel/lobby
 * - Penalize “unknown” and “queue_risk” risk flags
 */

export function enforcePlanB(
  bundle: CuratorialBundle,
  candidates: CandidateItem[] | undefined,
  audit?: AuditLog
): CuratorialBundle {
  const primary = bundle.primary_ending;
  const planB = bundle.plan_b;

  // Ensure action exists
  if (!planB.action) planB.action = primary.action;
  if (!planB.action_label) planB.action_label = 'Plan B';

  // If no place ids, nothing to do.
  const pId = primary.place_id;
  const bId = planB.place_id;

  // If already different and seems “more stable”, keep.
  if (pId && bId && pId !== bId) return bundle;

  // Try pick a better PlanB from candidates.
  if (!candidates || candidates.length === 0) return bundle;

  const scored = candidates
    .filter((c) => c.id && c.id !== pId)
    .map((c) => ({ c, score: stabilityScore(c) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.c;
  if (!best) return bundle;

  audit?.push({
    type: 'policy_clip',
    ts: new Date().toISOString(),
    code: 'planb_override',
    detail: `planB replaced by candidate id=${best.id} score=${scored[0].score}`
  } as any);

  bundle.plan_b.place_id = best.id;
  bundle.plan_b.title = best.title || bundle.plan_b.title || 'Plan B';
  bundle.plan_b.reason = `退路更稳：${best.tag || 'stable'}`;
  // keep action = NAVIGATE when place_id exists
  if (bundle.plan_b.action === 'START_FOCUS') {
    bundle.plan_b.action = 'NAVIGATE';
    bundle.plan_b.action_label = '去退路';
  }
  return bundle;
}

function stabilityScore(c: CandidateItem): number {
  const tag = (c.tag || '').toLowerCase();
  const title = (c.title || '').toLowerCase();
  let s = 0;
  if (tag.includes('stable') || title.includes('hotel') || title.includes('lobby')) s += 3;
  if (tag.includes('late') || title.includes('late')) s += 2;
  if (tag.includes('quiet') || title.includes('quiet')) s += 1;
  if (tag.includes('unknown')) s -= 1;
  return s;
}

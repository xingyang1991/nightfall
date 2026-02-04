import type { CuratorialBundle } from '../../types';
import type { AuditLog } from '../audit/audit';

const MAX_CHECKLIST = 5;
const MAX_RISK_FLAGS = 2;
const MAX_AMBIENT_TOKENS = 4;
const MAX_CANDIDATES = 18;
const MAX_GALLERY = 6;

function clipArr<T>(arr: T[] | undefined, max: number) {
  if (!Array.isArray(arr)) return arr ?? [];
  return arr.slice(0, Math.max(0, max));
}

function clipString(s: string, maxLen: number) {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen - 1) + '…';
}

/** Enforce UI density budgets at the *domain bundle* layer. */
export function enforceBundlePolicy(bundle: CuratorialBundle, audit?: AuditLog): CuratorialBundle {
  const b: CuratorialBundle = JSON.parse(JSON.stringify(bundle));

  // Titles: keep them label-like (not essays)
  b.primary_ending.title = clipString(b.primary_ending.title, 24);
  b.primary_ending.reason = clipString(b.primary_ending.reason, 110);
  b.primary_ending.checklist = clipArr(b.primary_ending.checklist, MAX_CHECKLIST);
  b.primary_ending.risk_flags = clipArr(b.primary_ending.risk_flags, MAX_RISK_FLAGS);

  b.plan_b.title = clipString(b.plan_b.title, 24);
  b.plan_b.reason = clipString(b.plan_b.reason, 110);
  b.plan_b.checklist = clipArr(b.plan_b.checklist, MAX_CHECKLIST);
  b.plan_b.risk_flags = clipArr(b.plan_b.risk_flags ?? [], MAX_RISK_FLAGS);

  b.ambient_tokens = clipArr(b.ambient_tokens, MAX_AMBIENT_TOKENS);

  if (b.candidate_pool) b.candidate_pool = clipArr(b.candidate_pool, MAX_CANDIDATES);
  if (b.media_pack?.gallery_refs) b.media_pack.gallery_refs = clipArr(b.media_pack.gallery_refs, MAX_GALLERY);

  // Audit clips (rough)
  if (audit) {
    if ((bundle.primary_ending.checklist?.length ?? 0) > MAX_CHECKLIST) audit.push({ type: 'policy_clip', ts: new Date().toISOString(), field: 'primary.checklist', before: bundle.primary_ending.checklist.length, after: b.primary_ending.checklist.length });
    if ((bundle.primary_ending.risk_flags?.length ?? 0) > MAX_RISK_FLAGS) audit.push({ type: 'policy_clip', ts: new Date().toISOString(), field: 'primary.risk_flags', before: bundle.primary_ending.risk_flags.length, after: b.primary_ending.risk_flags.length });
    if (((bundle.plan_b.risk_flags ?? []).length) > MAX_RISK_FLAGS) audit.push({ type: 'policy_clip', ts: new Date().toISOString(), field: 'plan_b.risk_flags', before: (bundle.plan_b.risk_flags ?? []).length, after: (b.plan_b.risk_flags ?? []).length });
  }

  // Ensure Plan B exists and is executable
  if (!b.plan_b.action) {
    b.plan_b.action = b.primary_ending.action;
    b.plan_b.action_label = b.primary_ending.action_label;
    audit?.push({ type: 'policy_violation', ts: new Date().toISOString(), code: 'plan_b_missing_action', detail: 'plan_b.action missing; copied from primary' });
  }
  if (!b.plan_b.action_label) {
    b.plan_b.action_label = 'Switch Plan B';
  }

  return b;
}

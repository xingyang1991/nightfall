import type { CandidateItem } from '../../types';
import type { AuditLog } from '../audit/audit';

const MAX_CANDIDATES = 18;
const MAX_TITLE = 28;
const MAX_TAG = 16;
const MAX_DESC = 140;

function clipString(s: string, maxLen: number) {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen - 1) + '…';
}

export function enforceCandidatePolicy(items: CandidateItem[], audit?: AuditLog): CandidateItem[] {
  const arr = Array.isArray(items) ? items : [];
  const clipped = arr.slice(0, MAX_CANDIDATES).map((it, idx) => ({
    ...it,
    id: clipString(String(it?.id ?? `C${idx + 1}`), 18),
    title: clipString(String(it?.title ?? 'Untitled'), MAX_TITLE),
    tag: clipString(String(it?.tag ?? 'EDITION'), MAX_TAG),
    desc: clipString(String(it?.desc ?? ''), MAX_DESC),
  }));

  if (audit && arr.length > MAX_CANDIDATES) {
    audit.push({ type: 'policy_clip', ts: new Date().toISOString(), field: 'candidates', before: arr.length, after: clipped.length });
  }
  return clipped;
}

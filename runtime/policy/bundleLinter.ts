import type { CuratorialBundle, ContextSignals } from '../../types';
import type { AuditLog } from '../audit/audit';

const ACTIONS = new Set(['NAVIGATE', 'START_ROUTE', 'PLAY', 'START_FOCUS']);

function clip(s: string, maxLen: number) {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen - 1) + '…';
}

function ensureStr(val: any, fallback: string, maxLen = 80) {
  const s = typeof val === 'string' ? val : String(val ?? '');
  const out = clip(s || fallback, maxLen);
  return out || fallback;
}

function ensureArr(val: any, fallback: string[] = [], maxLen = 5) {
  if (!Array.isArray(val)) return fallback.slice(0, maxLen);
  return val.map((v) => clip(String(v ?? ''), 60)).filter(Boolean).slice(0, maxLen);
}

function defaultActionLabel(action: string) {
  if (action === 'PLAY') return 'Play';
  if (action === 'START_FOCUS') return 'Focus';
  return 'Open Map';
}

function deriveTokens(ctx: ContextSignals) {
  const tokens: string[] = [];
  const band = ctx.time?.time_band ?? 'prime';
  if (band === 'late') tokens.push('late');
  else if (band === 'dinner') tokens.push('dinner');
  else if (band === 'daytime') tokens.push('day');
  else tokens.push('prime');

  const mode = ctx.user_state?.mode ?? '';
  if (mode) tokens.push(mode);

  const energy = ctx.user_state?.energy_band ?? '';
  if (energy) tokens.push(energy);

  return tokens.slice(0, 3);
}

function fallbackBundle(ctx: ContextSignals): CuratorialBundle {
  const title = 'A quiet corner';
  const reason = 'Keep it simple. Stay light, then close the night.';
  return {
    primary_ending: {
      id: 'fallback_primary',
      title,
      reason,
      checklist: ['先确认环境是否舒适', '若不适合 10 分钟内切 Plan B'],
      risk_flags: [],
      expires_at: '',
      action: 'NAVIGATE',
      action_label: 'Open Map',
      payload: { query: title }
    },
    plan_b: {
      id: 'fallback_plan_b',
      title: 'Plan B',
      reason: '更稳的退路，快速收束。',
      checklist: ['若人多则直接切换', '保持安静与可控'],
      risk_flags: [],
      expires_at: '',
      action: 'NAVIGATE',
      action_label: 'Open Map',
      payload: { query: 'quiet place' }
    },
    ambient_tokens: deriveTokens(ctx)
  };
}

/**
 * Bundle linter: enforce must-have fields and auto-fix weak outputs.
 * This operates on the simplified CuratorialBundle contract used by the runtime.
 */
export function enforceBundleLinter(bundle: CuratorialBundle, ctx: ContextSignals, audit?: AuditLog): CuratorialBundle {
  if (!bundle || !bundle.primary_ending || !bundle.plan_b) {
    audit?.push({ type: 'policy_violation', ts: new Date().toISOString(), code: 'bundle_missing_core', detail: 'primary_ending/plan_b missing; fallback applied' } as any);
    return fallbackBundle(ctx);
  }

  const b: CuratorialBundle = JSON.parse(JSON.stringify(bundle));

  // Primary
  b.primary_ending.title = ensureStr(b.primary_ending.title, 'Untitled', 28);
  b.primary_ending.reason = ensureStr(b.primary_ending.reason, 'Keep it simple.', 120);
  b.primary_ending.checklist = ensureArr(b.primary_ending.checklist, ['到场后先确认环境', '若不适合则切 Plan B'], 5);
  b.primary_ending.risk_flags = ensureArr(b.primary_ending.risk_flags, [], 2);
  b.primary_ending.expires_at = ensureStr(b.primary_ending.expires_at, '', 32);

  const pAction = String(b.primary_ending.action ?? '').toUpperCase();
  b.primary_ending.action = ACTIONS.has(pAction) ? (pAction as any) : 'NAVIGATE';
  b.primary_ending.action_label = ensureStr(b.primary_ending.action_label, defaultActionLabel(b.primary_ending.action), 24);
  if ((b.primary_ending.action === 'NAVIGATE' || b.primary_ending.action === 'START_ROUTE') && !b.primary_ending.payload?.query) {
    b.primary_ending.payload = { ...(b.primary_ending.payload ?? {}), query: b.primary_ending.title };
  }

  // Plan B
  b.plan_b.title = ensureStr(b.plan_b.title, 'Plan B', 28);
  b.plan_b.reason = ensureStr(b.plan_b.reason, '更稳的退路。', 120);
  b.plan_b.checklist = ensureArr(b.plan_b.checklist, ['若人多则切换', '保持安静与可控'], 5);
  b.plan_b.risk_flags = ensureArr(b.plan_b.risk_flags ?? [], [], 2);
  b.plan_b.expires_at = ensureStr(b.plan_b.expires_at ?? '', '', 32);

  const bAction = String(b.plan_b.action ?? '').toUpperCase();
  b.plan_b.action = ACTIONS.has(bAction) ? (bAction as any) : b.primary_ending.action;
  b.plan_b.action_label = ensureStr(b.plan_b.action_label, defaultActionLabel(b.plan_b.action), 24);
  if ((b.plan_b.action === 'NAVIGATE' || b.plan_b.action === 'START_ROUTE') && !b.plan_b.payload?.query) {
    b.plan_b.payload = { ...(b.plan_b.payload ?? {}), query: b.plan_b.title };
  }

  if (!Array.isArray(b.ambient_tokens) || b.ambient_tokens.length === 0) {
    b.ambient_tokens = deriveTokens(ctx);
  } else {
    b.ambient_tokens = b.ambient_tokens.map((t) => clip(String(t ?? ''), 18)).filter(Boolean).slice(0, 4);
  }

  return b;
}

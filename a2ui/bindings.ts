import { A2UIValue } from './messages';

export function valueToPlain(v: A2UIValue): any {
  if ('valueString' in v) return v.valueString;
  if ('valueNumber' in v) return v.valueNumber;
  if ('valueBoolean' in v) return v.valueBoolean;
  if ('valueNull' in v) return null;
  if ('valueList' in v) return v.valueList.map(valueToPlain);
  if ('valueMap' in v) {
    const out: Record<string, any> = {};
    for (const kv of v.valueMap) {
      out[kv.key] = valueToPlain(kv.value);
    }
    return out;
  }
  // Exhaustive
  return undefined;
}

export function getByPath(obj: any, path?: string): any {
  if (!path) return undefined;
  const clean = path.startsWith('/') ? path.slice(1) : path;
  if (!clean) return obj;
  const parts = clean.split('/').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export type BoundText = { literalString?: string; path?: string };

export function resolveText(model: any, t?: BoundText): string {
  if (!t) return '';
  if (typeof t.literalString === 'string') return t.literalString;
  if (typeof t.path === 'string') {
    const v = getByPath(model, t.path);
    if (v == null) return '';
    return String(v);
  }
  return '';
}

export function resolveNumber(model: any, path?: string, fallback = 0): number {
  const v = getByPath(model, path);
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function resolveList(model: any, path?: string): any[] {
  const v = getByPath(model, path);
  return Array.isArray(v) ? v : [];
}

export function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

import { GoogleGenAI, Type } from '@google/genai';
import type { CuratorialBundle, CandidateItem } from '../types';
import type { ContextSignals } from '../types';

let ai: GoogleGenAI | null = null;
let aiKey: string | null = null;
let envLoaded = false;

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && Boolean((process as any).versions?.node);
}

function applyEnv(raw: string) {
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    if (typeof process !== 'undefined' && (process as any).env && (process as any).env[key] === undefined) {
      (process as any).env[key] = value;
    }
  }
}

async function ensureDotEnvLoaded() {
  if (envLoaded || !isNodeRuntime()) return;
  envLoaded = true;
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const candidates = ['.env.local', '.env'];
    for (const name of candidates) {
      const fp = path.resolve(process.cwd(), name);
      if (!fs.existsSync(fp)) continue;
      const raw = fs.readFileSync(fp, 'utf-8');
      applyEnv(raw);
    }
  } catch {
    // ignore
  }
}

async function resolveApiKey(): Promise<string> {
  await ensureDotEnvLoaded();
  const key = String(process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!key) return '';
  const lower = key.toLowerCase();
  if (lower.includes('placeholder') || lower.includes('your_api_key') || lower.includes('replace')) return '';
  return key;
}

async function getClient(): Promise<GoogleGenAI | null> {
  const key = await resolveApiKey();
  if (!key) return null;
  if (!ai || aiKey !== key) {
    ai = new GoogleGenAI({ apiKey: key });
    aiKey = key;
  }
  return ai;
}

/** Shared schema fragments */
const CANDIDATE_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    tag: { type: Type.STRING },
    desc: { type: Type.STRING },
    image_ref: { type: Type.STRING }
  },
  required: ['id', 'title', 'tag', 'desc']
};

const UI_HINTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    infoDensity: { type: Type.NUMBER },
    uiModeHint: { type: Type.STRING },
    toneTags: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
};

export const CURATORIAL_BUNDLE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    primary_ending: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        reason: { type: Type.STRING },
        checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
        risk_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
        expires_at: { type: Type.STRING },
        action: { type: Type.STRING, description: 'One of: NAVIGATE, START_ROUTE, PLAY, START_FOCUS' },
        action_label: { type: Type.STRING }
      },
      required: ['id', 'title', 'reason', 'checklist', 'expires_at', 'action', 'action_label', 'risk_flags']
    },
    plan_b: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        reason: { type: Type.STRING },
        checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
        risk_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
        expires_at: { type: Type.STRING },
        action: { type: Type.STRING, description: 'One of: NAVIGATE, START_ROUTE, PLAY, START_FOCUS' },
        action_label: { type: Type.STRING }
      },
      required: ['id', 'title', 'reason', 'checklist', 'action', 'action_label']
    },
    ambient_tokens: { type: Type.ARRAY, items: { type: Type.STRING } },
    candidate_pool: { type: Type.ARRAY, items: CANDIDATE_ITEM_SCHEMA },
    ui_hints: UI_HINTS_SCHEMA,
    audio_payload: {
      type: Type.OBJECT,
      properties: {
        track_id: { type: Type.STRING },
        narrative: { type: Type.STRING }
      }
    },
    media_pack: {
      type: Type.OBJECT,
      properties: {
        cover_ref: { type: Type.STRING },
        gallery_refs: { type: Type.ARRAY, items: { type: Type.STRING } },
        fragment_ref: { type: Type.STRING },
        stamp_ref: { type: Type.STRING },
        texture_ref: { type: Type.STRING },
        tone_tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        accent_hint: { type: Type.STRING }
      }
    }
  },
  required: ['primary_ending', 'plan_b', 'ambient_tokens']
};

export const CANDIDATE_POOL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    candidate_pool: { type: Type.ARRAY, items: CANDIDATE_ITEM_SCHEMA },
    ui: UI_HINTS_SCHEMA
  },
  required: ['candidate_pool']
};

async function runGeminiJSON<T>(prompt: string, schema: any, fallback: () => T): Promise<T> {
  const client = await getClient();
  if (!client) return fallback();

  let response: any;
  try {
    response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });
  } catch (error) {
    console.error('Gemini request failed:', error);
    return fallback();
  }

  try {
    return JSON.parse(response.text.trim()) as T;
  } catch (error) {
    console.error('Failed to parse Gemini JSON:', error);
    return fallback();
  }
}

/**
 * Legacy wrapper: Tonight composer prompt (kept for compatibility).
 * This is intentionally opinionated (Shanghai curator voice).
 */
export async function getCuratedEnding(userInput: string, context: ContextSignals): Promise<CuratorialBundle> {
  const prompt = `
ACT AS: A night-shift urban curator in Shanghai.
TONE: "Gallery Label" style. Minimalist, evocative, short sentences.
LOCATION: Strictly use Shanghai context (Xuhui, Jing'an, Bund, etc.).
USER INPUT: ${JSON.stringify(userInput)}
CONTEXT SIGNALS: ${JSON.stringify(context)}

GOAL: Generate a CuratorialBundle for tonight's city ending.
CONSTRAINTS:
- Primary checklist: max 5.
- Risk flags: max 2.
- Ambient tokens: max 3.
- Reason: 1-2 sentences.
- "Delivery is exit": Provide a single clear outcome.
- Plan B must be a real executable alternative with its own action and action_label.
OUTPUT: JSON only.
`.trim();

  return runGeminiJSON<CuratorialBundle>(prompt, CURATORIAL_BUNDLE_SCHEMA, () => stubBundle(userInput));
}

/** Generic: produce a CuratorialBundle from an already-built prompt (skills use this). */
export async function generateCuratorialBundleWithGemini(prompt: string): Promise<CuratorialBundle> {
  return runGeminiJSON<CuratorialBundle>(prompt, CURATORIAL_BUNDLE_SCHEMA, () => stubBundle(''));
}

/** Generic: produce a candidate pool for multi-stage skills. */
export async function generateCandidatePoolWithGemini(prompt: string): Promise<{ candidate_pool: CandidateItem[]; ui?: any }> {
  return runGeminiJSON<{ candidate_pool: CandidateItem[]; ui?: any }>(prompt, CANDIDATE_POOL_SCHEMA, () => stubCandidates());
}

/** --- Stubs (no API key / parse errors) --- */

function stubCandidates(): { candidate_pool: CandidateItem[]; ui?: any } {
  return {
    candidate_pool: [
      { id: 'A', title: 'A quiet corner', tag: 'LOW RISK', desc: 'Minimal talking. Sit down, breathe, regain shape.' },
      { id: 'B', title: 'A short walk route', tag: 'MICRO ROUTE', desc: '20–35 minutes, streetlight-safe, easy exit.' },
      { id: 'C', title: 'A warm late drink', tag: 'WARM', desc: 'One cup, one table, no performance required.' }
    ],
    ui: { infoDensity: 0.28, uiModeHint: 'explore', toneTags: ['minimal'] }
  };
}

function stubBundle(seed: string): CuratorialBundle {
  const title = seed?.trim() ? seed.trim().slice(0, 24) : 'A quiet corner & a warm drink';
  return {
    primary_ending: {
      id: 'primary',
      title,
      reason: 'Low pressure. High certainty. Tonight can be small and still complete.',
      checklist: ['Choose a seat with a wall behind you', 'Order one stable drink', 'Stay 60–90 minutes', 'If crowded, switch to Plan B', 'Leave on your own timing'],
      risk_flags: ['parking_uncertain'],
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      action: 'NAVIGATE',
      action_label: 'Go'
    },
    plan_b: {
      id: 'plan_b',
      title: 'Plan B: hotel lobby',
      reason: 'More conservative fallback. Longer hours. Less negotiation.',
      checklist: ['Walk in calmly', 'Sit at the edge', 'Order tea if needed'],
      risk_flags: ['noise_low'],
      action: 'NAVIGATE',
      action_label: 'Switch'
    },
    ambient_tokens: ['mist', 'warm', 'steady']
  };
}

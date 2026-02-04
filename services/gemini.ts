import { GoogleGenAI, Type } from '@google/genai';
import type { CuratorialBundle, CandidateItem } from '../types';
import type { ContextSignals } from '../types';

let ai: GoogleGenAI | null = null;
let aiKey: string | null = null;
let envLoaded = false;

// ============ P0-2: 使用稳定的 Gemini 2.5 Flash-Lite 模型 ============
const MODEL_NAME = 'gemini-2.5-flash-lite';

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
  if (!key) {
    console.warn('[Gemini] No valid API key found, will use stub data');
    return null;
  }
  if (!ai || aiKey !== key) {
    ai = new GoogleGenAI({ apiKey: key });
    aiKey = key;
    console.log('[Gemini] Client initialized with model:', MODEL_NAME);
  }
  return ai;
}

/** Payload schema for navigation actions */
const PAYLOAD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    lat: { type: Type.NUMBER, description: 'Latitude of the destination (Shanghai area: 31.0-31.5)' },
    lng: { type: Type.NUMBER, description: 'Longitude of the destination (Shanghai area: 121.0-122.0)' },
    name: { type: Type.STRING, description: 'Name of the place in Chinese' },
    address: { type: Type.STRING, description: 'Full address of the place in Chinese' }
  },
  required: ['lat', 'lng', 'name']
};

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
        action_label: { type: Type.STRING },
        payload: PAYLOAD_SCHEMA
      },
      required: ['id', 'title', 'reason', 'checklist', 'expires_at', 'action', 'action_label', 'risk_flags', 'payload']
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
        action_label: { type: Type.STRING },
        payload: PAYLOAD_SCHEMA
      },
      required: ['id', 'title', 'reason', 'checklist', 'action', 'action_label', 'payload']
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

// ============ P0-1 & P0-3: 改进的 LLM 调用函数 ============
async function runGeminiJSON<T>(prompt: string, schema: any, fallback: () => T): Promise<T> {
  const client = await getClient();
  if (!client) {
    console.log('[Gemini] No client available, using fallback');
    return fallback();
  }

  let response: any;
  try {
    console.log('[Gemini] Sending request to', MODEL_NAME);
    response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });
    console.log('[Gemini] Response received successfully');
  } catch (error: any) {
    // ============ P0-1: 暴露错误信息而非静默失败 ============
    console.error('[Gemini] API request failed:', error?.message || error);
    console.error('[Gemini] Full error:', JSON.stringify(error, null, 2));
    
    // 尝试不使用 schema 的简化模式
    try {
      console.log('[Gemini] Retrying without strict schema...');
      response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt + '\n\nIMPORTANT: Return valid JSON only, no markdown formatting.',
        config: {
          responseMimeType: 'application/json'
        }
      });
      console.log('[Gemini] Retry succeeded');
    } catch (retryError: any) {
      console.error('[Gemini] Retry also failed:', retryError?.message || retryError);
      return fallback();
    }
  }

  try {
    const text = response?.text?.trim() || '';
    if (!text) {
      console.error('[Gemini] Empty response text');
      return fallback();
    }
    const parsed = JSON.parse(text) as T;
    console.log('[Gemini] Successfully parsed response');
    return parsed;
  } catch (error: any) {
    console.error('[Gemini] Failed to parse JSON:', error?.message);
    console.error('[Gemini] Raw response:', response?.text?.slice(0, 500));
    return fallback();
  }
}

// ============ P0-4: 优化的 Prompt 设计（带 one-shot 示例）============
const ONE_SHOT_BUNDLE_EXAMPLE = `
EXAMPLE OUTPUT:
{
  "primary_ending": {
    "id": "primary",
    "title": "深夜书房角落",
    "reason": "安静、低压力、适合独处思考。",
    "checklist": ["选择靠墙的位置", "点一杯热饮", "停留60-90分钟"],
    "risk_flags": ["parking_uncertain"],
    "expires_at": "2026-02-05T02:00:00.000Z",
    "action": "NAVIGATE",
    "action_label": "Go",
    "payload": {
      "lat": 31.2304,
      "lng": 121.4737,
      "name": "% Arabica 武康路店",
      "address": "上海市徐汇区武康路378号"
    }
  },
  "plan_b": {
    "id": "plan_b",
    "title": "酒店大堂备选",
    "reason": "更保守的选择，营业时间更长。",
    "checklist": ["从容走入", "坐在边缘位置", "需要时点杯茶"],
    "risk_flags": ["noise_low"],
    "action": "NAVIGATE",
    "action_label": "Switch",
    "payload": {
      "lat": 31.2397,
      "lng": 121.4748,
      "name": "静安香格里拉大酒店大堂",
      "address": "上海市静安区延安中路1218号"
    }
  },
  "ambient_tokens": ["mist", "warm", "steady"]
}
`;

const ONE_SHOT_CANDIDATES_EXAMPLE = `
EXAMPLE OUTPUT:
{
  "candidate_pool": [
    { "id": "A", "title": "安静的角落", "tag": "LOW RISK", "desc": "少交谈，坐下来，呼吸，恢复状态。" },
    { "id": "B", "title": "短途散步路线", "tag": "MICRO ROUTE", "desc": "20-35分钟，路灯安全，容易退出。" },
    { "id": "C", "title": "温暖的夜饮", "tag": "WARM", "desc": "一杯饮品，一张桌子，无需表演。" }
  ],
  "ui": { "infoDensity": 0.28, "uiModeHint": "explore", "toneTags": ["minimal"] }
}
`;

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
- IMPORTANT: For NAVIGATE or START_ROUTE actions, you MUST provide a real Shanghai location with:
  - lat: latitude (31.0-31.5 range for Shanghai)
  - lng: longitude (121.0-122.0 range for Shanghai)
  - name: place name in Chinese
  - address: full address in Chinese
- Use real, well-known Shanghai locations (cafes, hotels, parks, etc.)

${ONE_SHOT_BUNDLE_EXAMPLE}

OUTPUT: JSON only, following the exact structure shown in the example.
`.trim();

  return runGeminiJSON<CuratorialBundle>(prompt, CURATORIAL_BUNDLE_SCHEMA, () => stubBundle(userInput));
}

/** Generic: produce a CuratorialBundle from an already-built prompt (skills use this). */
export async function generateCuratorialBundleWithGemini(prompt: string): Promise<CuratorialBundle> {
  const enhancedPrompt = prompt + '\n\n' + ONE_SHOT_BUNDLE_EXAMPLE + '\n\nOUTPUT: JSON only.';
  return runGeminiJSON<CuratorialBundle>(enhancedPrompt, CURATORIAL_BUNDLE_SCHEMA, () => stubBundle(''));
}

/** Generic: produce a candidate pool for multi-stage skills. */
export async function generateCandidatePoolWithGemini(prompt: string): Promise<{ candidate_pool: CandidateItem[]; ui?: any }> {
  const enhancedPrompt = prompt + '\n\n' + ONE_SHOT_CANDIDATES_EXAMPLE + '\n\nOUTPUT: JSON only.';
  return runGeminiJSON<{ candidate_pool: CandidateItem[]; ui?: any }>(enhancedPrompt, CANDIDATE_POOL_SCHEMA, () => stubCandidates());
}

/** --- Stubs (no API key / parse errors) --- */

function stubCandidates(): { candidate_pool: CandidateItem[]; ui?: any } {
  console.log('[Gemini] Using stub candidates');
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
  console.log('[Gemini] Using stub bundle');
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
      action_label: 'Go',
      payload: {
        lat: 31.2304,
        lng: 121.4737,
        name: '% Arabica 武康路店',
        address: '上海市徐汇区武康路378号'
      }
    },
    plan_b: {
      id: 'plan_b',
      title: 'Plan B: hotel lobby',
      reason: 'More conservative fallback. Longer hours. Less negotiation.',
      checklist: ['Walk in calmly', 'Sit at the edge', 'Order tea if needed'],
      risk_flags: ['noise_low'],
      action: 'NAVIGATE',
      action_label: 'Switch',
      payload: {
        lat: 31.2397,
        lng: 121.4748,
        name: '静安香格里拉大酒店大堂',
        address: '上海市静安区延安中路1218号'
      }
    },
    ambient_tokens: ['mist', 'warm', 'steady']
  };
}

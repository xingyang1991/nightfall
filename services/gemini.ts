import { GoogleGenAI, Type } from '@google/genai';
import type { CuratorialBundle, CandidateItem } from '../types';
import type { ContextSignals } from '../types';

let ai: GoogleGenAI | null = null;
let aiKey: string | null = null;
let envLoaded = false;

// ============ 使用 Gemini 2.5 Flash 模型（2026年最新稳定版）============
const MODEL_NAME = 'gemini-2.5-flash';

// ============ 上海真实地点数据库（用于多样性推荐）============
const SHANGHAI_PLACES = {
  cafes: [
    { name: '% Arabica 武康路店', lat: 31.2104, lng: 121.4337, address: '上海市徐汇区武康路378号', district: '徐汇' },
    { name: 'Manner Coffee 静安寺店', lat: 31.2234, lng: 121.4456, address: '上海市静安区南京西路1618号', district: '静安' },
    { name: 'Seesaw Coffee 愚园路店', lat: 31.2201, lng: 121.4289, address: '上海市长宁区愚园路1107号', district: '长宁' },
    { name: 'M Stand 新天地店', lat: 31.2189, lng: 121.4721, address: '上海市黄浦区太仓路181弄', district: '黄浦' },
    { name: 'Peet\'s Coffee 外滩店', lat: 31.2397, lng: 121.4907, address: '上海市黄浦区中山东一路18号', district: '外滩' },
    { name: '星巴克臻选烘焙工坊', lat: 31.2156, lng: 121.4612, address: '上海市静安区南京西路789号', district: '静安' },
    { name: 'Blue Bottle Coffee 上海店', lat: 31.2278, lng: 121.4567, address: '上海市静安区铜仁路88号', district: '静安' },
    { name: 'Costa Coffee 陆家嘴店', lat: 31.2363, lng: 121.5012, address: '上海市浦东新区世纪大道100号', district: '浦东' },
    { name: 'Greybox Coffee 永嘉路店', lat: 31.2089, lng: 121.4512, address: '上海市徐汇区永嘉路570号', district: '徐汇' },
    { name: 'Oatly 燕麦奶咖啡店', lat: 31.2145, lng: 121.4389, address: '上海市徐汇区乌鲁木齐中路318号', district: '徐汇' },
  ],
  hotels: [
    { name: '静安香格里拉大酒店大堂', lat: 31.2297, lng: 121.4448, address: '上海市静安区延安中路1218号', district: '静安' },
    { name: '外滩华尔道夫酒店大堂', lat: 31.2401, lng: 121.4912, address: '上海市黄浦区中山东一路2号', district: '外滩' },
    { name: '上海半岛酒店大堂', lat: 31.2389, lng: 121.4923, address: '上海市黄浦区中山东一路32号', district: '外滩' },
    { name: '上海浦东丽思卡尔顿酒店', lat: 31.2378, lng: 121.5034, address: '上海市浦东新区世纪大道8号', district: '浦东' },
    { name: 'W酒店大堂吧', lat: 31.2312, lng: 121.4756, address: '上海市黄浦区中山东二路66号', district: '外滩' },
    { name: '上海艾迪逊酒店大堂', lat: 31.2289, lng: 121.4734, address: '上海市黄浦区南京东路199号', district: '黄浦' },
  ],
  parks: [
    { name: '复兴公园', lat: 31.2156, lng: 121.4678, address: '上海市黄浦区雁荡路105号', district: '黄浦' },
    { name: '静安公园', lat: 31.2234, lng: 121.4512, address: '上海市静安区南京西路1649号', district: '静安' },
    { name: '中山公园', lat: 31.2201, lng: 121.4123, address: '上海市长宁区长宁路780号', district: '长宁' },
    { name: '外滩滨江步道', lat: 31.2378, lng: 121.4901, address: '上海市黄浦区中山东一路', district: '外滩' },
    { name: '徐家汇公园', lat: 31.1934, lng: 121.4378, address: '上海市徐汇区肇嘉浜路889号', district: '徐汇' },
  ],
  bookstores: [
    { name: '钟书阁 泰晤士小镇店', lat: 31.0789, lng: 121.2234, address: '上海市松江区三新北路900弄', district: '松江' },
    { name: '言几又书店 长宁来福士店', lat: 31.2178, lng: 121.4234, address: '上海市长宁区长宁路1193号', district: '长宁' },
    { name: '西西弗书店 静安大悦城店', lat: 31.2312, lng: 121.4567, address: '上海市静安区西藏北路166号', district: '静安' },
    { name: '朵云书院 上海中心店', lat: 31.2356, lng: 121.5012, address: '上海市浦东新区银城中路501号', district: '浦东' },
  ],
  coworking: [
    { name: 'WeWork 静安嘉里中心', lat: 31.2267, lng: 121.4489, address: '上海市静安区南京西路1515号', district: '静安' },
    { name: '裸心社 外滩店', lat: 31.2378, lng: 121.4878, address: '上海市黄浦区圆明园路169号', district: '外滩' },
    { name: 'SOHO 3Q 复兴广场', lat: 31.2134, lng: 121.4623, address: '上海市黄浦区淮海中路138号', district: '黄浦' },
    { name: '氪空间 陆家嘴店', lat: 31.2345, lng: 121.4989, address: '上海市浦东新区东方路738号', district: '浦东' },
  ]
};

// 生成随机种子
function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

// 随机选择地点类型
function getRandomPlaceCategory(): string {
  const categories = ['cafes', 'hotels', 'parks', 'bookstores', 'coworking'];
  return categories[Math.floor(Math.random() * categories.length)];
}

// 随机选择多个地点
function getRandomPlaces(count: number = 3): any[] {
  const allPlaces: any[] = [];
  Object.values(SHANGHAI_PLACES).forEach(places => allPlaces.push(...places));
  
  // 洗牌算法
  const shuffled = [...allPlaces].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

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
    const candidates = ['.env.local', '.env.production', '.env'];
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

// ============ 改进的 LLM 调用函数（带温度参数）============
async function runGeminiJSON<T>(prompt: string, schema: any, fallback: () => T): Promise<T> {
  const client = await getClient();
  if (!client) {
    // 不再静默回退，而是抛出明确错误
    const errorMsg = '[Gemini] No valid API key configured. Please set GEMINI_API_KEY environment variable.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  let response: any;
  try {
    console.log('[Gemini] Sending request to', MODEL_NAME);
    response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.9, // 增加温度以获得更多样化的输出
        topP: 0.95,
        topK: 40
      }
    });
    console.log('[Gemini] Response received successfully');
  } catch (error: any) {
    console.error('[Gemini] API request failed:', error?.message || error);
    console.error('[Gemini] Full error:', JSON.stringify(error, null, 2));
    
    // 尝试不使用 schema 的简化模式
    try {
      console.log('[Gemini] Retrying without strict schema...');
      response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt + '\n\nIMPORTANT: Return valid JSON only, no markdown formatting.',
        config: {
          responseMimeType: 'application/json',
          temperature: 0.9
        }
      });
      console.log('[Gemini] Retry succeeded');
    } catch (retryError: any) {
      console.error('[Gemini] Retry also failed:', retryError?.message || retryError);
      // 不再静默回退，而是抛出明确错误
      throw new Error(`[Gemini] API call failed after retry: ${retryError?.message || 'Unknown error'}`);
    }
  }

  try {
    const text = response?.text?.trim() || '';
    if (!text) {
      const errorMsg = '[Gemini] Empty response text from API';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    const parsed = JSON.parse(text) as T;
    console.log('[Gemini] Successfully parsed response');
    return parsed;
  } catch (error: any) {
    console.error('[Gemini] Failed to parse JSON:', error?.message);
    console.error('[Gemini] Raw response:', response?.text?.slice(0, 500));
    // 不再静默回退，而是抛出明确错误
    throw new Error(`[Gemini] Failed to parse API response: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Tonight composer prompt with diversity support.
 * Each request generates a unique random seed to ensure different recommendations.
 */
export async function getCuratedEnding(userInput: string, context: ContextSignals): Promise<CuratorialBundle> {
  // 生成随机种子和推荐地点
  const randomSeed = generateRandomSeed();
  const suggestedPlaces = getRandomPlaces(5);
  const currentHour = new Date().getHours();
  const timeContext = currentHour >= 22 || currentHour < 6 ? '深夜' : currentHour >= 18 ? '傍晚' : '白天';
  
  const prompt = `
ACT AS: 一位深夜城市策展人，对上海了如指掌。
TONE: "策展标签"风格。简约、富有画面感、短句为主。
LOCATION: 严格使用上海地名（徐汇、静安、外滩、浦东、长宁等）。
LANGUAGE: 所有输出必须使用中文，包括标题、描述、清单、风险提示等。

USER INPUT: ${JSON.stringify(userInput)}
CONTEXT SIGNALS: ${JSON.stringify(context)}
TIME CONTEXT: ${timeContext}

DIVERSITY REQUIREMENT (CRITICAL):
- Random seed for this request: ${randomSeed}
- You MUST generate DIFFERENT recommendations each time
- DO NOT always recommend the same places
- Consider the user's mood and the time of day
- Here are some suggested places to consider (but feel free to recommend others):
${suggestedPlaces.map(p => `  - ${p.name} (${p.district}): ${p.address}`).join('\n')}

GOAL: 为今晚生成一个城市结局方案。
CONSTRAINTS:
- 主要清单: 最多5条，使用中文
- 风险提示: 最多2条，使用中文短语（如"停车不确定"、"可能报队"、"噪音波动"）
- 氛围标签: 最多3个
- 理由: 1-2句中文
- "交付即出口": 提供一个清晰的结果
- Plan B 必须是与主要选项不同的地点（更保守、营业时间更长、或更安静）
- 重要: 对于 NAVIGATE 或 START_ROUTE 操作，必须提供真实的上海地点:
  - lat: 纬度 (31.0-31.5 范围)
  - lng: 经度 (121.0-122.0 范围)
  - name: 中文地点名称
  - address: 中文完整地址
- 使用真实、知名的上海地点（咖啡馆、酒店、公园、书店、联合办公空间等）
- 根据随机种子变化推荐 - 不要总是推荐相同的地点！

EXAMPLE OUTPUT (for format reference only - DO NOT copy these exact places):
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
      "name": "某咖啡馆",
      "address": "上海市某区某路某号"
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
      "name": "某酒店大堂",
      "address": "上海市某区某路某号"
    }
  },
  "ambient_tokens": ["mist", "warm", "steady"]
}

OUTPUT: 仅输出 JSON，遵循示例结构。记住根据随机种子使用不同的地点！所有文本内容必须使用中文！
`.trim();

  return runGeminiJSON<CuratorialBundle>(prompt, CURATORIAL_BUNDLE_SCHEMA, () => stubBundle(userInput));
}

/** Generic: produce a CuratorialBundle from an already-built prompt (skills use this). */
export async function generateCuratorialBundleWithGemini(prompt: string): Promise<CuratorialBundle> {
  const randomSeed = generateRandomSeed();
  const enhancedPrompt = prompt + `

DIVERSITY REQUIREMENT:
- Random seed: ${randomSeed}
- Generate DIFFERENT recommendations each time
- Do not always suggest the same places

EXAMPLE OUTPUT (format reference only):
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
      "name": "某咖啡馆",
      "address": "上海市某区某路某号"
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
      "name": "某酒店大堂",
      "address": "上海市某区某路某号"
    }
  },
  "ambient_tokens": ["mist", "warm", "steady"]
}

OUTPUT: JSON only.
`;
  return runGeminiJSON<CuratorialBundle>(enhancedPrompt, CURATORIAL_BUNDLE_SCHEMA, () => stubBundle(''));
}

/** Generic: produce a candidate pool for multi-stage skills. */
export async function generateCandidatePoolWithGemini(prompt: string): Promise<{ candidate_pool: CandidateItem[]; ui?: any }> {
  const randomSeed = generateRandomSeed();
  const enhancedPrompt = prompt + `

DIVERSITY REQUIREMENT:
- 随机种子: ${randomSeed}
- 每次生成不同的候选
- 变化推荐类型（咖啡馆、酒店、公园、书店、步行路线等）

LANGUAGE: 所有输出必须使用中文，包括标题、描述等。

EXAMPLE OUTPUT (仅供格式参考):
{
  "candidate_pool": [
    { "id": "A", "title": "安静的角落", "tag": "最稳", "desc": "少交谈，坐下来，呼吸，恢复状态。" },
    { "id": "B", "title": "短途散步路线", "tag": "微路线", "desc": "20-35分钟，路灯安全，容易退出。" },
    { "id": "C", "title": "温暖的夜饮", "tag": "温暖", "desc": "一杯饮品，一张桌子，无需表演。" }
  ],
  "ui": { "infoDensity": 0.28, "uiModeHint": "explore", "toneTags": ["minimal"] }
}

OUTPUT: 仅输出 JSON，所有文本必须使用中文。
`;
  return runGeminiJSON<{ candidate_pool: CandidateItem[]; ui?: any }>(enhancedPrompt, CANDIDATE_POOL_SCHEMA, () => stubCandidates());
}

/** --- Stubs (no API key / parse errors) --- */

function stubCandidates(): { candidate_pool: CandidateItem[]; ui?: any } {
  console.log('[Gemini] Using stub candidates');
  // 随机化 stub 数据
  const candidateOptions = [
    [
      { id: 'A', title: '安静的角落', tag: '最稳', desc: '少交谈，坐下来，呼吸，恢复状态。' },
      { id: 'B', title: '短途散步路线', tag: '微路线', desc: '20-35分钟，路灯安全，容易退出。' },
      { id: 'C', title: '温暖的夜饮', tag: '温暖', desc: '一杯饮品，一张桌子，无需表演。' }
    ],
    [
      { id: 'A', title: '深夜书店', tag: '安静', desc: '书架之间，时间变慢。' },
      { id: 'B', title: '江边漫步', tag: '户外', desc: '外滩灯光，清风徐来。' },
      { id: 'C', title: '酒店大堂', tag: '安全', desc: '24小时营业，无需解释。' }
    ],
    [
      { id: 'A', title: '独立咖啡馆', tag: '温馨', desc: '手冲咖啡，木质桌椅。' },
      { id: 'B', title: '公园长椅', tag: '免费', desc: '星空下，思绪飘远。' },
      { id: 'C', title: '联合办公空间', tag: '专注', desc: '安静工作，专注当下。' }
    ]
  ];
  
  const selected = candidateOptions[Math.floor(Math.random() * candidateOptions.length)];
  
  return {
    candidate_pool: selected,
    ui: { infoDensity: 0.28, uiModeHint: 'explore', toneTags: ['minimal'] }
  };
}

function stubBundle(seed: string): CuratorialBundle {
  console.log('[Gemini] Using stub bundle');
  
  // 随机选择不同的地点
  const places = getRandomPlaces(2);
  const primary = places[0] || SHANGHAI_PLACES.cafes[Math.floor(Math.random() * SHANGHAI_PLACES.cafes.length)];
  const backup = places[1] || SHANGHAI_PLACES.hotels[Math.floor(Math.random() * SHANGHAI_PLACES.hotels.length)];
  
  const title = seed?.trim() ? seed.trim().slice(0, 24) : primary.name;
  
  return {
    primary_ending: {
      id: 'primary',
      title,
      reason: '低压力，高确定性。今晚可以很小，但依然完整。',
      checklist: ['选择靠墙的位置', '点一杯稳定的饮品', '停留60-90分钟', '如果太挤，切换到备选', '按自己的节奏离开'],
      risk_flags: ['parking_uncertain'],
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      action: 'NAVIGATE',
      action_label: 'Go',
      payload: {
        lat: primary.lat,
        lng: primary.lng,
        name: primary.name,
        address: primary.address
      }
    },
    plan_b: {
      id: 'plan_b',
      title: `备选: ${backup.name}`,
      reason: '更保守的选择，营业时间更长。',
      checklist: ['从容走入', '坐在边缘位置', '需要时点杯茶'],
      risk_flags: ['noise_low'],
      action: 'NAVIGATE',
      action_label: 'Switch',
      payload: {
        lat: backup.lat,
        lng: backup.lng,
        name: backup.name,
        address: backup.address
      }
    },
    ambient_tokens: ['mist', 'warm', 'steady']
  };
}

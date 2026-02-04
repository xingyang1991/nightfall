import { GoogleGenAI, Type } from '@google/genai';
import type { CuratorialBundle, CandidateItem } from '../types';
import type { ContextSignals } from '../types';
import { searchPlaces, searchNearby, getSearchKeywords, formatDistance, formatWalkTime, hasAmapKey, getPhotoUrl, type AmapPlace } from './amap';
import { getImageForPlace } from './unsplash';
import { runOpenAIJSON, hasOpenAIKey } from './openai';

let ai: GoogleGenAI | null = null;
let aiKey: string | null = null;
let envLoaded = false;

// ============ 使用 Gemini 2.5 Flash 模型 ============
const MODEL_NAME = 'gemini-2.5-flash';

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
    console.warn('[Gemini] No valid API key found');
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
    lat: { type: Type.NUMBER, description: 'Latitude of the destination' },
    lng: { type: Type.NUMBER, description: 'Longitude of the destination' },
    name: { type: Type.STRING, description: 'Name of the place in Chinese' },
    address: { type: Type.STRING, description: 'Full address of the place in Chinese' },
    place_id: { type: Type.STRING, description: 'Place ID from map API' }
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
    image_ref: { type: Type.STRING },
    place_data: {
      type: Type.OBJECT,
      properties: {
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
        address: { type: Type.STRING },
        rating: { type: Type.STRING },
        distance: { type: Type.STRING },
        walk_time: { type: Type.STRING }
      }
    }
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

// ============ LLM 调用函数 ============

/**
 * 统一的 LLM 调用函数，支持 Gemini 和 OpenAI 两种后端
 * 优先使用 Gemini，如果失败（配额用完等）则回退到 OpenAI
 */
async function runLLMJSON<T>(prompt: string, schema: any, fallback: () => T): Promise<T> {
  // 首先尝试 Gemini
  const geminiResult = await tryGemini<T>(prompt, schema);
  if (geminiResult.success) {
    return geminiResult.data!;
  }
  
  // Gemini 失败，尝试 OpenAI
  if (hasOpenAIKey()) {
    console.log('[LLM] Gemini failed, trying OpenAI as fallback...');
    try {
      const result = await runOpenAIJSON<T>(prompt, fallback);
      return result;
    } catch (openaiError: any) {
      console.error('[LLM] OpenAI also failed:', openaiError?.message);
    }
  } else {
    console.warn('[LLM] OpenAI not available (no API key)');
  }
  
  // 两个都失败了，抛出原始 Gemini 错误
  throw new Error(geminiResult.error || 'LLM call failed');
}

/**
 * 尝试使用 Gemini API
 */
async function tryGemini<T>(prompt: string, schema: any): Promise<{ success: boolean; data?: T; error?: string }> {
  const client = await getClient();
  if (!client) {
    return { success: false, error: '[Gemini] No valid API key configured' };
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
        temperature: 0.8,
        topP: 0.95,
        topK: 40
      }
    });
    console.log('[Gemini] Response received successfully');
  } catch (error: any) {
    console.error('[Gemini] API request failed:', error?.message || error);
    
    // 检查是否是配额错误
    const errorMsg = String(error?.message || '');
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      return { success: false, error: `[Gemini] Quota exceeded: ${errorMsg}` };
    }
    
    // 尝试不使用 schema 的简化模式
    try {
      console.log('[Gemini] Retrying without strict schema...');
      response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt + '\n\nIMPORTANT: Return valid JSON only, no markdown formatting.',
        config: {
          responseMimeType: 'application/json',
          temperature: 0.8
        }
      });
      console.log('[Gemini] Retry succeeded');
    } catch (retryError: any) {
      console.error('[Gemini] Retry also failed:', retryError?.message || retryError);
      return { success: false, error: `[Gemini] API call failed: ${retryError?.message || 'Unknown error'}` };
    }
  }

  try {
    const text = response?.text?.trim() || '';
    if (!text) {
      return { success: false, error: '[Gemini] Empty response text from API' };
    }
    const parsed = JSON.parse(text) as T;
    console.log('[Gemini] Successfully parsed response');
    return { success: true, data: parsed };
  } catch (error: any) {
    console.error('[Gemini] Failed to parse JSON:', error?.message);
    console.error('[Gemini] Raw response:', response?.text?.slice(0, 500));
    return { success: false, error: `[Gemini] Failed to parse response: ${error?.message}` };
  }
}

// 保留旧函数名以兼容现有代码
async function runGeminiJSON<T>(prompt: string, schema: any, fallback: () => T): Promise<T> {
  return runLLMJSON<T>(prompt, schema, fallback);
}

/**
 * 将高德地点数据格式化为 LLM 可理解的文本
 */
function formatPlacesForLLM(places: AmapPlace[]): string {
  return places.map((p, idx) => {
    const rating = p.rating ? `评分${p.rating}` : '';
    const cost = p.cost ? `人均¥${p.cost}` : '';
    const distance = p.distance ? `距离${formatDistance(p.distance)}` : '';
    const walkTime = p.distance ? `步行${formatWalkTime(p.distance)}` : '';
    const opentime = p.opentime || '';
    const photoCount = p.photos?.length || 0;
    
    return `${idx + 1}. ${p.name}
   - 地址: ${p.address}
   - 坐标: ${p.lat}, ${p.lng}
   - 类型: ${p.type}
   - ${[rating, cost, distance, walkTime].filter(Boolean).join(' | ')}
   - 营业时间: ${opentime || '未知'}
   - 照片数量: ${photoCount}
   - 高德ID: ${p.id}`;
  }).join('\n\n');
}

/**
 * 基于真实地点数据生成推荐
 * 流程: 1. 搜索真实地点 -> 2. LLM 基于真实数据生成推荐文案
 */
export async function getCuratedEnding(
  userInput: string, 
  context: ContextSignals,
  userLocation?: { lat: number; lng: number }
): Promise<CuratorialBundle> {
  console.log('[Gemini] getCuratedEnding called with:', { userInput, hasLocation: !!userLocation });
  
  // Step 1: 搜索真实地点
  const searchKeywords = getSearchKeywords(userInput);
  let allPlaces: AmapPlace[] = [];
  
  for (const { keywords, types } of searchKeywords.slice(0, 2)) {
    let places: AmapPlace[];
    if (userLocation) {
      // 基于用户位置搜索附近地点
      places = await searchNearby({
        keywords,
        types,
        location: `${userLocation.lng},${userLocation.lat}`,
        radius: 3000,
        offset: 10
      });
    } else {
      // 关键词搜索（默认上海）
      places = await searchPlaces({
        keywords,
        types,
        city: '上海',
        offset: 10
      });
    }
    allPlaces.push(...places);
  }
  
  // 去重并取前10个
  const uniquePlaces = Array.from(new Map(allPlaces.map(p => [p.id, p])).values()).slice(0, 10);
  
  if (uniquePlaces.length === 0) {
    throw new Error('[Gemini] 未找到符合条件的地点，请尝试其他描述');
  }
  
  console.log('[Gemini] Found', uniquePlaces.length, 'real places from Amap');
  
  // Step 2: 让 LLM 基于真实数据生成推荐
  const currentHour = new Date().getHours();
  const timeContext = currentHour >= 22 || currentHour < 6 ? '深夜' : currentHour >= 18 ? '傍晚' : '白天';
  
  const prompt = `
你是一位深夜城市策展人，帮助用户找到今晚的落脚点。

用户需求: ${JSON.stringify(userInput)}
当前时间: ${timeContext}
用户位置: ${userLocation ? `已定位 (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})` : '未定位（默认上海）'}

以下是从高德地图搜索到的【真实地点数据】，你必须从中选择推荐：

${formatPlacesForLLM(uniquePlaces)}

任务要求：
1. 从上述真实地点中选择最适合用户需求的作为 primary_ending
2. 选择另一个作为 plan_b（备选方案，应该更保守或营业时间更长）
3. 所有 payload 中的坐标、名称、地址必须使用上述真实数据，不得虚构
4. 生成适合该地点的 checklist（行动清单，3-5条）
5. 生成可能的 risk_flags（风险提示，如"可能排队"、"停车不便"等）
6. 所有文本使用中文

输出格式要求：
- title: 创意标题（可以不是地点原名，但要体现特色）
- reason: 1-2句推荐理由
- checklist: 具体的行动建议
- risk_flags: 可能的风险提示
- payload: 必须包含真实的 lat, lng, name, address, place_id

OUTPUT: 仅输出 JSON，遵循 CuratorialBundle 结构。
`.trim();

  const bundle = await runGeminiJSON<CuratorialBundle>(prompt, CURATORIAL_BUNDLE_SCHEMA, () => {
    throw new Error('LLM 调用失败');
  });
  
  // Step 3: 附加真实照片
  const primaryPlace = uniquePlaces.find(p => 
    p.name === bundle.primary_ending.payload?.name || 
    p.id === bundle.primary_ending.payload?.place_id
  );
  const planBPlace = uniquePlaces.find(p => 
    p.name === bundle.plan_b.payload?.name || 
    p.id === bundle.plan_b.payload?.place_id
  );
  
  // 使用高德照片或 Unsplash 作为封面
  const coverPhoto = primaryPlace ? getPhotoUrl(primaryPlace) : null;
  const planBPhoto = planBPlace ? getPhotoUrl(planBPlace) : null;
  
  bundle.media_pack = {
    cover_ref: coverPhoto || '',
    fragment_ref: coverPhoto || '',
    gallery_refs: uniquePlaces.slice(0, 4).map(p => getPhotoUrl(p) || '').filter(Boolean),
    tone_tags: bundle.ambient_tokens || ['quiet']
  };
  
  console.log('[Gemini] Bundle generated with real place data');
  return bundle;
}

/**
 * 基于真实地点数据生成候选池
 */
export async function generateCandidatePoolWithRealData(
  userInput: string,
  userLocation?: { lat: number; lng: number }
): Promise<{ candidate_pool: CandidateItem[]; ui?: any; places: AmapPlace[] }> {
  console.log('[Gemini] generateCandidatePoolWithRealData called');
  
  // Step 1: 搜索真实地点
  const searchKeywords = getSearchKeywords(userInput);
  let allPlaces: AmapPlace[] = [];
  
  for (const { keywords, types } of searchKeywords) {
    let places: AmapPlace[];
    if (userLocation) {
      places = await searchNearby({
        keywords,
        types,
        location: `${userLocation.lng},${userLocation.lat}`,
        radius: 5000,
        offset: 8
      });
    } else {
      places = await searchPlaces({
        keywords,
        types,
        city: '上海',
        offset: 8
      });
    }
    allPlaces.push(...places);
  }
  
  // 去重并取前12个
  const uniquePlaces = Array.from(new Map(allPlaces.map(p => [p.id, p])).values()).slice(0, 12);
  
  if (uniquePlaces.length === 0) {
    throw new Error('[Gemini] 未找到符合条件的地点');
  }
  
  console.log('[Gemini] Found', uniquePlaces.length, 'real places for candidate pool');
  
  // Step 2: 让 LLM 为每个真实地点生成描述
  const currentHour = new Date().getHours();
  const timeContext = currentHour >= 22 || currentHour < 6 ? '深夜' : currentHour >= 18 ? '傍晚' : '白天';
  
  const prompt = `
你是一位深夜城市策展人。用户想要: ${userInput}
当前时间: ${timeContext}

以下是从高德地图搜索到的【真实地点】，为每个地点生成候选卡片：

${formatPlacesForLLM(uniquePlaces)}

任务：
1. 为每个地点生成一个候选卡片
2. id 使用地点的高德ID
3. title 可以是创意标题（体现地点特色）
4. tag 使用简短标签（如"最稳"、"安静"、"有氛围"、"适合久坐"等）
5. desc 使用1-2句描述，包含关键信息（距离、评分、特色等）
6. 所有文本使用中文

OUTPUT: 仅输出 JSON，包含 candidate_pool 数组。
`.trim();

  const result = await runGeminiJSON<{ candidate_pool: CandidateItem[]; ui?: any }>(
    prompt, 
    CANDIDATE_POOL_SCHEMA,
    () => { throw new Error('LLM 调用失败'); }
  );
  
  // Step 3: 为每个候选附加真实数据和图片
  // 注意：高德图片有 CORS 问题，统一使用 Unsplash
  result.candidate_pool = await Promise.all(result.candidate_pool.map(async (candidate, idx) => {
    const place = uniquePlaces.find(p => p.id === candidate.id) || uniquePlaces[idx];
    if (place) {
      // 使用 Unsplash 获取类型匹配的图片（高德图片有 CORS 问题）
      const imageUrl = await getImageForPlace(place.name || candidate.title) || '';
      console.log(`[Gemini] Candidate ${idx}: ${place.name} -> image: ${imageUrl ? 'OK' : 'NONE'}`);
      
      return {
        ...candidate,
        // 使用真实地点名称作为标题（如果 LLM 生成的标题不包含真实地名）
        title: candidate.title.includes(place.name) ? candidate.title : `${place.name}`,
        image_ref: imageUrl,
        place_data: {
          lat: place.lat,
          lng: place.lng,
          name: place.name,
          address: place.address,
          rating: place.rating,
          distance: place.distance ? formatDistance(place.distance) : '',
          walk_time: place.distance ? formatWalkTime(place.distance) : '',
          place_id: place.id,
          opentime: place.opentime || ''
        }
      };
    }
    return candidate;
  }));
  
  return { ...result, places: uniquePlaces };
}

/** Generic: produce a CuratorialBundle from an already-built prompt (skills use this). */
export async function generateCuratorialBundleWithGemini(prompt: string): Promise<CuratorialBundle> {
  const enhancedPrompt = prompt + `

LANGUAGE: 所有输出必须使用中文。

OUTPUT: 仅输出 JSON，遵循 CuratorialBundle 结构。
`;
  return runGeminiJSON<CuratorialBundle>(enhancedPrompt, CURATORIAL_BUNDLE_SCHEMA, () => {
    throw new Error('LLM 调用失败');
  });
}

/** Generic: produce a candidate pool for multi-stage skills. */
export async function generateCandidatePoolWithGemini(prompt: string): Promise<{ candidate_pool: CandidateItem[]; ui?: any }> {
  const enhancedPrompt = prompt + `

LANGUAGE: 所有输出必须使用中文。

OUTPUT: 仅输出 JSON，包含 candidate_pool 数组。
`;
  return runGeminiJSON<{ candidate_pool: CandidateItem[]; ui?: any }>(enhancedPrompt, CANDIDATE_POOL_SCHEMA, () => {
    throw new Error('LLM 调用失败');
  });
}

/**
 * 检查服务状态
 */
export async function checkServiceStatus(): Promise<{
  gemini: boolean;
  amap: boolean;
  geminiKey?: string;
}> {
  const geminiKey = await resolveApiKey();
  return {
    gemini: Boolean(geminiKey),
    amap: hasAmapKey(),
    geminiKey: geminiKey ? geminiKey.slice(0, 10) + '...' : undefined
  };
}

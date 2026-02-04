/**
 * OpenAI LLM Service
 * 作为 Gemini 的备选方案，当 Gemini 配额用完时使用
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

// 使用 gpt-4.1-mini 模型（通过 Manus 代理）
const MODEL_NAME = 'gpt-4.1-mini';

function getClient(): OpenAI | null {
  if (client) return client;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[OpenAI] No OPENAI_API_KEY found');
    return null;
  }
  
  // 使用 Manus 代理的 base_url（如果设置了的话）
  const baseUrl = process.env.OPENAI_BASE_URL || undefined;
  
  client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
  });
  
  console.log('[OpenAI] Client initialized with model:', MODEL_NAME);
  return client;
}

/**
 * 运行 OpenAI 并返回 JSON 响应
 */
export async function runOpenAIJSON<T>(prompt: string, fallback: () => T): Promise<T> {
  const openai = getClient();
  if (!openai) {
    console.warn('[OpenAI] No client available, using fallback');
    return fallback();
  }
  
  try {
    console.log('[OpenAI] Sending request to', MODEL_NAME);
    
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates JSON responses. Always respond with valid JSON only, no markdown formatting or code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });
    
    const text = response.choices[0]?.message?.content?.trim() || '';
    if (!text) {
      console.error('[OpenAI] Empty response');
      return fallback();
    }
    
    const parsed = JSON.parse(text) as T;
    console.log('[OpenAI] Successfully parsed response');
    return parsed;
  } catch (error: any) {
    console.error('[OpenAI] API request failed:', error?.message || error);
    return fallback();
  }
}

/**
 * 检查 OpenAI 是否可用
 */
export function hasOpenAIKey(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

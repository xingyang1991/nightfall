import type { ContextSignals } from '../../types';
import { hasSkill } from '../skills/registry';
import { rankSkills } from './skillRanker';

export interface RouteDecision {
  skillId: string;
  reason: string;
  confidence: number; // 0..1
  debug?: Record<string, any>;
}

export interface ClarifyDecision {
  type: 'clarify';
  choices: string[];
  choiceMap: Record<string, string>;
  reason: string;
  confidence: number;
  debug?: Record<string, any>;
}

export type RouteResult = RouteDecision | ClarifyDecision;

/**
 * Deterministic router (regex first).
 * - Keeps UX predictable.
 * - Avoids LLM-as-router in early builds (hard to debug).
 *
 * In production, you can layer:
 *   rules -> lightweight classifier -> LLM fallback
 */
export function routeSkillFromUtterance(utterance: string, context: ContextSignals, opts?: { fallbackSkillId?: string }): RouteResult {
  const text = (utterance ?? '').trim();

  // 1) Explicit skill call: "$skill-id"
  const explicit = extractExplicitSkillId(text);
  if (explicit && hasSkill(explicit)) {
    return { skillId: explicit, reason: 'explicit_call', confidence: 1.0 };
  }

  // 2) Keyword routing (Chinese-first; extend per locale)
  const rules: Array<{ re: RegExp; skillId: string; reason: string }> = [
    { re: /(不想社交|不社交|隐形|只想看看|不打招呼|不聊天)/, skillId: 'attend-invisibly', reason: 'social_stealth' },
    { re: /(书店|阅读|买书|书柜|图书)/, skillId: 'bookstore-refuge', reason: 'bookstore' },
    { re: /(咖啡|cafe|拿铁|卡布|美式)/i, skillId: 'coffee-dongwang', reason: 'coffee' },
    { re: /(下雨|雨天|雨夜|潮湿)/, skillId: 'curate-rainy-day', reason: 'rainy_day' },
    { re: /(一个人吃|独自吃|solo(\s*meal)?|夜宵|晚餐|宵夜)/i, skillId: 'solo-meal-editor', reason: 'solo_meal' },
    { re: /(展览|美术馆|画廊|艺术(\s*展)?|museum|gallery)/i, skillId: 'plan-artwalk', reason: 'artwalk' },
    { re: /(博物馆|museum)/i, skillId: 'plan-museum-sprint', reason: 'museum' },
    { re: /(建筑|architect|街区|citywalk|散步|走走|溜达|路上)/i, skillId: 'plan-architecture-citywalk', reason: 'walk' },
    { re: /(偏航|绕一下|回家路上|顺路|detour)/i, skillId: 'inner-street-detour', reason: 'detour' },
    { re: /(预算|便宜|省钱|平价)/, skillId: 'budget-stroll-curator', reason: 'budget' },
    { re: /(设计|空间|灯光|材质|动线|声场)/, skillId: 'space-reviewer', reason: 'design_lens' },
    { re: /(观后感|评价|复盘|留一句|写一句)/, skillId: 'leave-exhibit-review', reason: 'echo' },
    { re: /(艺术家|关注|展讯|订阅|follow)/i, skillId: 'follow-favorite-artists', reason: 'artists' },
    { re: /(打字|dazi|协议|节奏|写作习惯)/i, skillId: 'draft-dazi-protocol', reason: 'focus_protocol' },
    { re: /(快闪|pop\-?up|微展|路过的展)/i, skillId: 'plan-micro-exhibit-stop', reason: 'micro_exhibit' },
  ];

  for (const r of rules) {
    if (r.re.test(text) && hasSkill(r.skillId)) {
      return { skillId: r.skillId, reason: r.reason, confidence: 0.88 };
    }
  }

  // 3) Ranked semantic routing + context fit
  const ranked = rankSkills(text, context);
  const top = ranked[0];
  const second = ranked[1];

  if (top && shouldClarify(top, second, text)) {
    const { choices, choiceMap } = buildClarifyChoices(ranked, opts?.fallbackSkillId);
    return {
      type: 'clarify',
      choices,
      choiceMap,
      reason: 'clarify_low_confidence',
      confidence: top.score,
      debug: { top: ranked.slice(0, 3) }
    };
  }

  if (top) {
    return {
      skillId: top.id,
      reason: 'semantic_rank',
      confidence: top.score,
      debug: { top: ranked.slice(0, 3) }
    };
  }

  // 4) Fallback
  const fallback = opts?.fallbackSkillId && hasSkill(opts.fallbackSkillId)
    ? opts.fallbackSkillId
    : (hasSkill('chill-place-picker') ? 'chill-place-picker' : 'tonight_composer');

  return { skillId: fallback, reason: 'fallback', confidence: 0.35 };
}

function extractExplicitSkillId(text: string): string | null {
  const m = text.match(/\$([a-z0-9\-_]+)/i);
  if (!m) return null;
  return String(m[1] ?? '').trim();
}

function shouldClarify(top: { score: number }, second?: { score: number }, utterance?: string) {
  const minScore = 0.42;
  const minGap = 0.12;
  const short = (utterance ?? '').trim().length <= 6;
  if (top.score < minScore) return true;
  if (second && top.score - second.score < minGap) return true;
  if (short) return true;
  return false;
}

function buildClarifyChoices(ranked: Array<{ id: string; title: string }>, fallbackId?: string) {
  const choices: string[] = [];
  const choiceMap: Record<string, string> = {};

  const top = ranked.slice(0, 3);
  const labels = ['A', 'B', 'C'];
  for (let i = 0; i < top.length; i++) {
    const t = top[i];
    const label = `${labels[i]} · ${compactLabel(t.title)}`;
    choices.push(label);
    choiceMap[label] = t.id;
  }

  const fallback = fallbackId && hasSkill(fallbackId)
    ? fallbackId
    : (hasSkill('chill-place-picker') ? 'chill-place-picker' : 'tonight_composer');

  // If we have space, add a conservative fallback option.
  if (choices.length < 3) {
    const fallbackLabel = '稳一点 · 给我最稳的';
    if (!choiceMap[fallbackLabel]) {
      choices.push(fallbackLabel);
      choiceMap[fallbackLabel] = fallback;
    }
  }

  return { choices, choiceMap };
}

function compactLabel(s: string) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 24 ? t.slice(0, 23) + '…' : t;
}

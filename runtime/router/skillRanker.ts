import type { ContextSignals } from '../../types';
import type { Skill } from '../skills/skill';
import { listSkills } from '../skills/registry';

export interface RankedSkill {
  id: string;
  title: string;
  description: string;
  score: number; // 0..1
  reasons: string[];
}

interface SkillProfile {
  id: string;
  title: string;
  description: string;
  searchText: string;
  vector: Map<string, number>;
}

interface SkillIndex {
  skills: SkillProfile[];
  idf: Map<string, number>;
  key: string;
}

let cachedIndex: SkillIndex | null = null;

export function rankSkills(utterance: string, context: ContextSignals): RankedSkill[] {
  const skills = listSkills().filter((s) => shouldRankSkill(s));
  if (!skills.length) return [];

  const index = getIndex(skills);
  const utterTokens = tokenize(utterance);
  const utterVec = vectorize(utterTokens, index.idf);

  const out: RankedSkill[] = [];
  for (const profile of index.skills) {
    const semantic = cosineSim(utterVec, profile.vector);
    const contextBoost = scoreContextBoost(profile, context);
    const keywordBoost = scoreKeywordBoost(profile, utterance);
    const score = clamp01(semantic * 0.75 + contextBoost + keywordBoost);
    const reasons: string[] = [];
    if (semantic > 0.1) reasons.push(`semantic=${semantic.toFixed(2)}`);
    if (contextBoost > 0) reasons.push(`context+${contextBoost.toFixed(2)}`);
    if (keywordBoost > 0) reasons.push(`keyword+${keywordBoost.toFixed(2)}`);
    out.push({
      id: profile.id,
      title: profile.title,
      description: profile.description,
      score,
      reasons
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

function shouldRankSkill(skill: Skill): boolean {
  if (!skill?.manifest) return false;
  if (!skill.manifest.allowedSurfaces?.includes('tonight')) return false;
  if (!Array.isArray(skill.manifest.intents)) return false;
  const okIntent = skill.manifest.intents.includes('explore') || skill.manifest.intents.includes('tonight_answer');
  return okIntent;
}

function getIndex(skills: Skill[]): SkillIndex {
  const key = skills.map((s) => s.manifest.id).sort().join('|');
  if (cachedIndex && cachedIndex.key === key) return cachedIndex;

  const profiles: SkillProfile[] = skills.map((skill) => {
    const searchText = buildSearchText(skill);
    const tokens = tokenize(searchText);
    return {
      id: skill.manifest.id,
      title: skill.manifest.title,
      description: skill.manifest.description,
      searchText,
      vector: vectorize(tokens, new Map())
    };
  });

  const idf = buildIdf(profiles);
  for (const p of profiles) {
    const tokens = tokenize(p.searchText);
    p.vector = vectorize(tokens, idf);
  }

  cachedIndex = { skills: profiles, idf, key };
  return cachedIndex;
}

function buildSearchText(skill: Skill): string {
  const metaText = (skill as any).__searchText;
  if (metaText && typeof metaText === 'string') return metaText;
  const m = skill.manifest;
  return [m.title, m.description, m.defaultPrompt, m.shelfTag, m.id].filter(Boolean).join(' ');
}

function tokenize(text: string): string[] {
  const s = String(text ?? '').toLowerCase();
  const tokens: string[] = [];
  // Latin words
  const wordRe = /[a-z0-9_]+/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(s)) !== null) tokens.push(m[0]);

  // Chinese characters and bigrams
  const han = s.match(/[\u4e00-\u9fff]/g) ?? [];
  for (let i = 0; i < han.length; i++) {
    tokens.push(han[i]);
    if (i + 1 < han.length) tokens.push(han[i] + han[i + 1]);
  }
  return tokens;
}

function buildIdf(profiles: SkillProfile[]): Map<string, number> {
  const df = new Map<string, number>();
  const total = profiles.length;
  for (const p of profiles) {
    const seen = new Set(tokenize(p.searchText));
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [t, c] of df.entries()) {
    const v = Math.log(1 + total / (1 + c));
    idf.set(t, v);
  }
  return idf;
}

function vectorize(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vec = new Map<string, number>();
  for (const [t, c] of tf.entries()) {
    const weight = (1 + Math.log(c)) * (idf.get(t) ?? 1);
    vec.set(t, weight);
  }
  return vec;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const v of a.values()) normA += v * v;
  for (const v of b.values()) normB += v * v;
  if (!normA || !normB) return 0;
  for (const [t, v] of a.entries()) {
    const bv = b.get(t);
    if (bv) dot += v * bv;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function scoreKeywordBoost(profile: SkillProfile, utterance: string): number {
  const u = utterance.toLowerCase();
  const id = profile.id.toLowerCase().replace(/[-_]/g, ' ');
  if (id && u.includes(id)) return 0.2;
  return 0;
}

function scoreContextBoost(profile: SkillProfile, context: ContextSignals): number {
  let boost = 0;
  const text = profile.searchText.toLowerCase();

  // Driving / detour bias
  if (context.mobility.motion_state === 'driving') {
    if (hasAny(text, ['detour', 'drive', 'car', '绕', '偏航', '顺路'])) boost += 0.12;
  }

  // Stealth / low social
  if (context.user_state.stealth || context.user_state.social_temp <= 1) {
    if (hasAny(text, ['stealth', 'invisible', '隐身', '不社交', '安静', 'quiet', 'silent'])) boost += 0.1;
  }

  // Low energy
  if (context.user_state.energy_band === 'low') {
    if (hasAny(text, ['rest', 'quiet', 'chill', '安静', '低压', '躺'])) boost += 0.08;
  }

  // Late time band
  if (context.time.time_band === 'late') {
    if (hasAny(text, ['late', 'night', '宵', '夜'])) boost += 0.06;
  }

  return boost;
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

function clamp01(v: number) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

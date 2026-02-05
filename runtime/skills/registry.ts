import type { Skill } from './skill';
import { tonightComposerSkill } from './builtin/tonightComposer';
import { whispersNoteSkill } from './builtin/whispersNote';
import { loadManusSkillPackages } from './manusLoader';
import { makeManusPromptSkill } from './manusPromptSkill';
import { MANUS_OVERRIDES } from './manusOverrides';

/**
 * Client-side registry (PoC).
 * In production, this becomes a server-side SkillStore + remote loader with versioning & review.
 */
const skills: Record<string, Skill> = {
  [tonightComposerSkill.manifest.id]: tonightComposerSkill,
  [whispersNoteSkill.manifest.id]: whispersNoteSkill
};

// Load Manus packages bundled under runtime/skills/packages/*
for (const pkg of loadManusSkillPackages()) {
  const override = MANUS_OVERRIDES[pkg.id];
  if (override?.shelfTag) (pkg as any).shelfTag = override.shelfTag;

  skills[pkg.id] = makeManusPromptSkill(pkg, override);
}

export function getSkill(skillId: string): Skill | undefined {
  return skills[skillId];
}

export function listSkills(): Skill[] {
  return Object.values(skills);
}

export function hasSkill(skillId: string): boolean {
  return Boolean(skills[skillId]);
}

export interface SceneCard {
  id: string;
  title: string;
  subtitle: string;
  preset_query: string;
  skill_id: string;
  image_ref: string;
  gradient: string;
  icon: string;
  tags: string[];
}

export const PRESET_SCENES: SceneCard[] = [
  {
    id: 'bookstore-refuge',
    title: '书店避难所',
    subtitle: '在书香中找到安静角落',
    preset_query: '找个安静的书店或咖啡馆，适合阅读和工作',
    skill_id: 'coffee-dongwang',
    image_ref: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800',
    gradient: 'from-amber-900/80 to-stone-900/90',
    icon: '📚',
    tags: ['安静', '阅读', '工作']
  },
  {
    id: 'night-walk',
    title: '深夜漫步',
    subtitle: '城市霓虹下的独处时光',
    preset_query: '想在城市里散步，找个有意思的地方逛逛',
    skill_id: 'tonight_composer',
    image_ref: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800',
    gradient: 'from-indigo-900/80 to-slate-900/90',
    icon: '🌃',
    tags: ['散步', '探索', '夜景']
  },
  {
    id: 'late-night-food',
    title: '深夜食堂',
    subtitle: '用一顿好饭治愈疲惫',
    preset_query: '找个深夜还营业的餐厅，想吃点好的',
    skill_id: 'tonight_composer',
    image_ref: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
    gradient: 'from-orange-900/80 to-red-900/90',
    icon: '🍜',
    tags: ['美食', '深夜', '治愈']
  },
  {
    id: 'creative-space',
    title: '灵感工坊',
    subtitle: '激发创意的第三空间',
    preset_query: '找个有设计感的空间，适合思考和创作',
    skill_id: 'coffee-dongwang',
    image_ref: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
    gradient: 'from-purple-900/80 to-slate-900/90',
    icon: '💡',
    tags: ['创意', '设计', '灵感']
  },
  {
    id: 'social-hub',
    title: '社交据点',
    subtitle: '与朋友共度的夜晚',
    preset_query: '找个适合和朋友聊天的地方，氛围好一点',
    skill_id: 'tonight_composer',
    image_ref: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800',
    gradient: 'from-pink-900/80 to-purple-900/90',
    icon: '🍻',
    tags: ['社交', '朋友', '氛围']
  },
  {
    id: 'quiet-corner',
    title: '独处角落',
    subtitle: '只属于自己的时间',
    preset_query: '想找个安静的地方独处，不想被打扰',
    skill_id: 'coffee-dongwang',
    image_ref: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    gradient: 'from-slate-900/80 to-zinc-900/90',
    icon: '🌙',
    tags: ['独处', '安静', '放松']
  }
];

export function getPresetScenes(): SceneCard[] {
  return PRESET_SCENES;
}

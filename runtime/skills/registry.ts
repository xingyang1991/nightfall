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

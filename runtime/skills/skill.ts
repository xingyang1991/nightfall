import type { SkillContext, SkillManifest, SkillRequest, SkillResult } from '../contracts';
import type { ToolBus } from '../toolbus/toolBus';

export interface Skill {
  manifest: SkillManifest;
  run: (req: SkillRequest, ctx: SkillContext, tools: ToolBus) => Promise<SkillResult>;
}

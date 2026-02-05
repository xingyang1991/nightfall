import type { Skill } from '../skill';
import type { SkillRequest, SkillContext, SkillResult } from '../../contracts';
import type { ToolBus } from '../../toolbus/toolBus';
import { getCuratedEnding } from '../../../services/gemini';

export const tonightComposerSkill: Skill = {
  manifest: {
    id: 'tonight_composer',
    version: '0.2.0',
    title: 'Tonight Composer',
    description: 'Compresses a user request into one executable ending + one Plan B.',
    stages: ['finalize'],
    intents: ['tonight_answer', 'place_anchor', 'explore', 'plan_b'],
    allowedSurfaces: ['tonight', 'pocket'],
    permissions: {
      tools: ['maps.link', 'places.search'],
      dataScopes: ['context.read']
    },
    rateLimit: { perNight: 40, perMinute: 12 },
    uiHints: { uiModeHint: 'explore', toneTags: ['warm', 'minimal'] }
  },

  async run(req: SkillRequest, ctx: SkillContext, tools: ToolBus): Promise<SkillResult> {
    const user = req.utterance ?? '';
    const choice = req.selection?.choice ? ` Preference: ${req.selection.choice}` : '';
    const prompt = `${user}${choice}`.trim();
    
    // 获取用户位置（从 constraints 中传递）
    const userLocation = req.constraints?.userLocation as { lat: number; lng: number } | undefined;
    console.log('[TonightComposer] User location:', userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'not provided');

    // 传递用户位置到 getCuratedEnding，基于真实地点数据生成推荐
    const bundle = await getCuratedEnding(prompt, ctx.context, userLocation);

    const out: SkillResult = {
      bundle,
      ui: {
        infoDensity: ctx.context.mobility.motion_state === 'driving' ? 0.15 : 0.35,
        uiModeHint: ctx.context.mobility.motion_state === 'driving'
          ? 'drive_safe'
          : ctx.context.user_state.energy_band === 'low'
            ? 'low_battery'
            : 'explore',
        toneTags: ctx.context.user_state.mode === 'recovery' ? ['warm'] : ['minimal']
      }
    };
    return out;
  }
};

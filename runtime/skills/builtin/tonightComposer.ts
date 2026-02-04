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
    allowedSurfaces: ['tonight', 'radio', 'pocket'],
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

    // Seed session with real place photos when available (non-blocking).
    try {
      await tools.placesSearch({ query: prompt || ctx.context.location.city_id || 'quiet place', grid_id: ctx.context.location.grid_id });
    } catch {
      // ignore
    }

    const bundle = await getCuratedEnding(prompt, ctx.context);

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

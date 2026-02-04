import type { Skill } from '../skill';
import type { SkillRequest, SkillContext, SkillResult } from '../../contracts';
import type { ToolBus } from '../../toolbus/toolBus';

export const whispersNoteSkill: Skill = {
  manifest: {
    id: 'whispers_note',
    version: '0.1.0',
    title: 'Whispers Note',
    description: 'Append a short anonymous note into the hallway wall.',
    stages: ['system'],
    intents: ['whispers'],
    allowedSurfaces: ['whispers'],
    permissions: {
      tools: ['storage.whispers.append'],
      dataScopes: ['whispers.write']
    },
    rateLimit: { perNight: 8, perMinute: 2 }
  },

  async run(req: SkillRequest, ctx: SkillContext, tools: ToolBus): Promise<SkillResult> {
    const text = (req.utterance ?? '').trim();
    if (!text) return {};

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const note = { symbol: '◌', timestamp: `${hh}:${mm}`, content: text, grid: ctx.context.location.grid_id };

    await tools.whispersAppend({ note });

    return { debug: { appended: true } };
  }
};

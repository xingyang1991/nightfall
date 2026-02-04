import { ContextSignals, CuratorialBundle } from '../types';
import { A2UIMessage, A2UIValue } from './messages';

/** Helpers to build typed A2UI values */
export const vStr = (s: string): A2UIValue => ({ valueString: s });
export const vNum = (n: number): A2UIValue => ({ valueNumber: n });
export const vBool = (b: boolean): A2UIValue => ({ valueBoolean: b });
export const vNull = (): A2UIValue => ({ valueNull: null });
export const vList = (arr: any[]): A2UIValue => ({ valueList: arr.map(plainToValue) });
export const vMap = (obj: Record<string, any>): A2UIValue => ({
  valueMap: Object.entries(obj).map(([key, value]) => ({ key, value: plainToValue(value) }))
});

export function plainToValue(x: any): A2UIValue {
  if (x === null || x === undefined) return vNull();
  if (typeof x === 'string') return vStr(x);
  if (typeof x === 'number') return vNum(x);
  if (typeof x === 'boolean') return vBool(x);
  if (Array.isArray(x)) return vList(x);
  if (typeof x === 'object') return vMap(x as Record<string, any>);
  return vStr(String(x));
}

function baseContextModel(context: ContextSignals) {
  return {
    context
  };
}

/** --- Surface Programs (static structure, dynamic data) --- */

export function programTonightOrder(context: ContextSignals): A2UIMessage[] {
  return [
    {
      surfaceUpdate: {
        surfaceId: 'tonight',
        components: [
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-12', children: { explicitList: ['titleBlock', 'orderCard'] } } } },
          { id: 'titleBlock', component: { Box: { className: 'w-full max-w-sm mx-auto p-0', children: { explicitList: ['title', 'subtitle'] } } } },
          { id: 'title', component: { Text: { text: { literalString: "Tonight's End" }, usageHint: 'h1' } } },
          { id: 'subtitle', component: { Text: { text: { literalString: 'One request to exit' }, usageHint: 'subtitle', className: 'pl-1' } } },

          { id: 'orderCard', component: { Card: { variant: 'glass', rounded: 'rounded-[2.5rem]', pad: 'p-9', children: { explicitList: ['prompt'] } } } },
          { id: 'prompt', component: { PromptBar: { placeholder: 'I need a quiet place...', submitAction: { name: 'TONIGHT_SUBMIT_ORDER' } } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'tonight',
        contents: [
          { key: 'ui', value: vMap({ stage: 'order', loading: false, active_plan: 'primary' }) },
          { key: 'tonight', value: vMap({ order_text: '' }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'tonight', root: 'root' } }
  ];
}

export function programTonightClarify(context: ContextSignals, orderText: string, choices?: string[]): A2UIMessage[] {
  const fallbackChoices = ['A solitary walk', 'A silent sanctuary', 'Collective noise'];
  const finalChoices = Array.isArray(choices) && choices.length ? choices : fallbackChoices;
  return [
    {
      surfaceUpdate: {
        surfaceId: 'tonight',
        components: [
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-12', children: { explicitList: ['clarifyCard'] } } } },

          { id: 'clarifyCard', component: { Card: { variant: 'glass', rounded: 'rounded-[2.5rem]', pad: 'p-7', children: { explicitList: ['clarifyHead', 'clarifyTitle', 'choiceList', 'backBtn'] } } } },
          { id: 'clarifyHead', component: { Row: { children: { explicitList: ['clarifyBadge'] }, justify: 'justify-start', gap: 'gap-2' } } },
          { id: 'clarifyBadge', component: { Text: { text: { literalString: 'Clarifying' }, usageHint: 'label', className: 'flex items-center gap-2' } } },
          { id: 'clarifyTitle', component: { Text: { text: { literalString: '"How should the city meet you tonight?"' }, usageHint: 'h2', className: 'mt-6' } } },
          { id: 'choiceList', component: { ChoiceList: { itemsPath: '/tonight/choices', chooseActionName: 'TONIGHT_SELECT_CHOICE', loadingPath: '/ui/loading' } } },
          { id: 'backBtn', component: { Button: { label: { literalString: '← Adjust Order' }, variant: 'ghost', action: { name: 'TONIGHT_BACK_TO_ORDER' } } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'tonight',
        contents: [
          { key: 'ui', value: vMap({ stage: 'clarify', loading: false, active_plan: 'primary' }) },
          { key: 'tonight', value: vMap({ order_text: orderText, choices: finalChoices }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'tonight', root: 'root' } }
  ];
}

export function programTonightCandidates(
  context: ContextSignals,
  opts: { skillTitle: string; orderText: string; candidates: Array<{ id: string; tag: string; title: string; desc: string }> }
): A2UIMessage[] {
  const { skillTitle, orderText, candidates } = opts;

  return [
    {
      surfaceUpdate: {
        surfaceId: 'tonight',
        components: [
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-10', children: { explicitList: ['head', 'shelf', 'actions'] } } } },

          { id: 'head', component: { Box: { className: 'w-full max-w-xl mx-auto text-left space-y-2 pt-6 pb-4', children: { explicitList: ['title', 'subtitle'] } } } },
          { id: 'title', component: { Text: { text: { literalString: skillTitle || 'Candidates' }, usageHint: 'h2' } } },
          { id: 'subtitle', component: { Text: { text: { literalString: orderText ? `“${orderText}”` : 'Pick one to finalize' }, usageHint: 'subtitle', className: 'text-left' } } },

          { id: 'shelf', component: { CandidateShelf: { itemsPath: '/candidate_pool', selectActionName: 'TONIGHT_SELECT_CANDIDATE' } } },

          { id: 'actions', component: { Row: { justify: 'justify-center', gap: 'gap-3', children: { explicitList: ['shuffleBtn', 'backBtn'] } } } },
          { id: 'shuffleBtn', component: { Button: { label: { literalString: '换一批' }, variant: 'ghost', action: { name: 'TONIGHT_REFRESH_CANDIDATES' } } } },
          { id: 'backBtn', component: { Button: { label: { literalString: '← 返回' }, variant: 'ghost', action: { name: 'TONIGHT_RESET' } } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'tonight',
        contents: [
          { key: 'ui', value: vMap({ stage: 'candidate', loading: false, active_plan: 'primary' }) },
          { key: 'tonight', value: vMap({ order_text: orderText, skill_title: skillTitle }) },
          { key: 'candidate_pool', value: plainToValue(candidates) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'tonight', root: 'root' } }
  ];
}

export function programTonightResult(context: ContextSignals, bundle: CuratorialBundle): A2UIMessage[] {
  return [
    {
      surfaceUpdate: {
        surfaceId: 'tonight',
        components: [
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-12', children: { explicitList: ['ticket', 'rethinkBtn'] } } } },
          { id: 'ticket', component: { NightfallTicket: { bundlePath: '/bundle', uiPath: '/ui' } } },
          { id: 'rethinkBtn', component: { Button: { label: { literalString: '← Rethink Tonight' }, variant: 'ghost', action: { name: 'TONIGHT_RESET' } } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'tonight',
        contents: [
          { key: 'ui', value: vMap({ stage: 'result', loading: false, active_plan: 'primary' }) },
          { key: 'bundle', value: plainToValue(bundle) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'tonight', root: 'root' } }
  ];
}

export function programDiscover(context: ContextSignals, skills: Array<{ id: string; tag: string; title: string; desc: string }>): A2UIMessage[] {
  const hero = skills?.[0] ?? null;
  return [
    {
      surfaceUpdate: {
        surfaceId: 'discover',
        components: [
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-10', children: { explicitList: ['head', 'hero', 'gallery', 'shelf'] } } } },
          { id: 'head', component: { Box: { className: 'text-center space-y-2 pt-6 pb-4', children: { explicitList: ['title', 'subtitle'] } } } },
          { id: 'title', component: { Text: { text: { literalString: 'Discover' }, usageHint: 'h1' } } },
          { id: 'subtitle', component: { Text: { text: { literalString: 'A shelf of scenes, not a feed' }, usageHint: 'subtitle' } } },
          { id: 'hero', component: { CoverHero: { itemPath: '/discover/hero', selectActionName: 'DISCOVER_SELECT_SKILL' } } },
          { id: 'gallery', component: { GalleryWall: { itemsPath: '/discover/gallery_refs', label: 'Candidate Wall' } } },
          { id: 'shelf', component: { CandidateShelf: { itemsPath: '/discover/skills', selectActionName: 'DISCOVER_SELECT_SKILL', skipFirst: true } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'discover',
        contents: [
          { key: 'discover', value: vMap({ stage: 'library', skills, hero, gallery_refs: [] }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'discover', root: 'root' } }
  ];
}


export function programSky(context: ContextSignals): A2UIMessage[] {
  return [
    {
      surfaceUpdate: {
        surfaceId: 'sky',
        components: [
          { id: 'root', component: { SkyStats: { gridIdPath: '/context/location/grid_id', pressurePath: '/sky/pressure', ambientPath: '/sky/ambient' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'sky',
        contents: [
          { key: 'context', value: plainToValue(context) },
          { key: 'sky', value: vMap({ pressure: 'Moderate', ambient: '14 Active' }) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'sky', root: 'root' } }
  ];
}

export function programPocket(context: ContextSignals): A2UIMessage[] {
  const pulse = Array.from({ length: 14 }, (_, i) => Math.max(0.15, Math.sin(i / 2) * 0.25 + 0.35));
  const tickets = [
    { type: 'OUTCOME', date: 'Tonight', title: 'A quiet corner and one warm drink' },
    { type: 'ROUTE', date: 'Last week', title: 'Two blocks of neon, then home' },
    { type: 'NOTE', date: 'Archive', title: '“Less pressure, more clarity.”' },
  ];
  return [
    {
      surfaceUpdate: {
        surfaceId: 'pocket',
        components: [
          { id: 'root', component: { PocketPanel: { pulsePath: '/pocket/pulse', ticketsPath: '/pocket/tickets' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'pocket',
        contents: [
          { key: 'pocket', value: vMap({ pulse, tickets }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'pocket', root: 'root' } }
  ];
}

export function programWhispers(context: ContextSignals): A2UIMessage[] {
  const items = [
    { symbol: '✶', timestamp: '22:14', content: 'Lights feel kinder after rain.' },
    { symbol: '◌', timestamp: '22:31', content: 'Found a seat that doesn’t ask questions.' },
    { symbol: '⟡', timestamp: '23:02', content: 'One page, one breath, and the night folds.' },
  ];

  return [
    {
      surfaceUpdate: {
        surfaceId: 'whispers',
        components: [
          { id: 'root', component: { Box: { className: 'w-full', children: { explicitList: ['wall', 'composer'] } } } },
          { id: 'wall', component: { WhisperWall: { itemsPath: '/whispers/items' } } },
          { id: 'composer', component: { WhisperComposer: { submitActionName: 'WHISPER_SUBMIT' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'whispers',
        contents: [
          { key: 'whispers', value: vMap({ items }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'whispers', root: 'root' } }
  ];
}

export function programRadio(context: ContextSignals): A2UIMessage[] {
  return [
    {
      surfaceUpdate: {
        surfaceId: 'radio',
        components: [
          { id: 'root', component: { RadioStrip: { narrativePath: '/radio/narrative', trackIdPath: '/radio/track_id', playingPath: '/radio/playing' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'radio',
        contents: [
          { key: 'radio', value: vMap({ track_id: 'nf_001', narrative: 'A thin frequency: “You have time.”', playing: false, cover_ref: '' }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'radio', root: 'root' } }
  ];
}


// --- Veil (Screensaver) ---
export function programVeil(context: ContextSignals): A2UIMessage[] {
  const dateSeed = String(context.time?.now_ts ?? new Date().toISOString()).slice(0, 10);
  return [
    {
      surfaceUpdate: {
        surfaceId: 'veil',
        components: [
          { id: 'root', component: { VeilCollagePanel: { collagePath: '/veil/collage', uiPath: '/ui' } } }
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'veil',
        contents: [
          { key: 'ui', value: vMap({ stage: 'veil', loading: false }) },
          { key: 'veil', value: vMap({ collage: { collage_id: `veil_${dateSeed}`, tiles: [], caption: 'Moon veil', cover_ref: `nf://cover/${dateSeed}` } }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'veil', root: 'root' } }
  ];
}

// --- Footprints --- 
export function programFootprints(context: ContextSignals): A2UIMessage[] {
  return [
    {
      surfaceUpdate: {
        surfaceId: 'footprints',
        components: [
          { id: 'root', component: { FootprintsPanel: { fpPath: '/fp', uiPath: '/ui' } } }
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'footprints',
        contents: [
          { key: 'ui', value: vMap({ stage: 'footprints', loading: false }) },
          { key: 'fp', value: vMap({
            summary: { focus_min: 0, lights: 0, notes: 0, songs: 0 },
            weekly_text: '本周回声：\n1) 你最稳的夜晚在周二/周四。\n2) 22:00以后更偏向电台与屏保。\n3) 这周你点了4次灯。\n建议：下周保留一个更早的收束点。'
          }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'footprints', root: 'root' } }
  ];
}

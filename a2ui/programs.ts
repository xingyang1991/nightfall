import { ContextSignals, CuratorialBundle } from '../types';
import type { SceneCard } from '../runtime/skills/registry';
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
          { id: 'title', component: { Text: { text: { literalString: '今晚的结局' }, usageHint: 'h1' } } },
          { id: 'subtitle', component: { Text: { text: { literalString: '告诉我你想要什么' }, usageHint: 'subtitle', className: 'pl-1' } } },

          { id: 'orderCard', component: { Card: { variant: 'glass', rounded: 'rounded-[2.5rem]', pad: 'p-9', children: { explicitList: ['stepHint', 'prompt'] } } } },
          { id: 'stepHint', component: { Text: { text: { literalString: '第一步：描述你的需求' }, usageHint: 'label', className: 'mb-4 text-white/30' } } },
          { id: 'prompt', component: { PromptBar: { placeholder: '例如：找个安静的地方工作...', submitAction: { name: 'TONIGHT_SUBMIT_ORDER' } } } },
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
  const fallbackChoices = ['安静独处', '轻松社交', '专注工作'];
  const finalChoices = Array.isArray(choices) && choices.length ? choices : fallbackChoices;
  return [
    {
      surfaceUpdate: {
        surfaceId: 'tonight',
        components: [
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-12', children: { explicitList: ['clarifyCard'] } } } },

          { id: 'clarifyCard', component: { Card: { variant: 'glass', rounded: 'rounded-[2.5rem]', pad: 'p-7', children: { explicitList: ['clarifyHead', 'clarifyTitle', 'stepHint', 'choiceList', 'backBtn'] } } } },
          { id: 'clarifyHead', component: { Row: { children: { explicitList: ['clarifyBadge'] }, justify: 'justify-start', gap: 'gap-2' } } },
          { id: 'clarifyBadge', component: { Text: { text: { literalString: '需要确认' }, usageHint: 'label', className: 'flex items-center gap-2' } } },
          { id: 'clarifyTitle', component: { Text: { text: { literalString: '"今晚你更想要哪种感觉？"' }, usageHint: 'h2', className: 'mt-6' } } },
          { id: 'stepHint', component: { Text: { text: { literalString: '第二步：选择一个方向，帮我更好地理解你' }, usageHint: 'label', className: 'mt-2 mb-4 text-white/30' } } },
          { id: 'choiceList', component: { ChoiceList: { itemsPath: '/tonight/choices', chooseActionName: 'TONIGHT_SELECT_CHOICE', loadingPath: '/ui/loading' } } },
          { id: 'backBtn', component: { Button: { label: { literalString: '← 重新描述' }, variant: 'ghost', action: { name: 'TONIGHT_BACK_TO_ORDER' } } } },
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
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-10', children: { explicitList: ['head', 'stepHint', 'shelf', 'actions'] } } } },

          { id: 'head', component: { Box: { className: 'w-full max-w-xl mx-auto text-left space-y-2 pt-6 pb-2', children: { explicitList: ['title', 'subtitle'] } } } },
          { id: 'title', component: { Text: { text: { literalString: skillTitle || '为你找到的选项' }, usageHint: 'h2' } } },
          { id: 'subtitle', component: { Text: { text: { literalString: orderText ? `"${orderText}"` : '根据你的需求' }, usageHint: 'subtitle', className: 'text-left' } } },

          { id: 'stepHint', component: { Text: { text: { literalString: '第三步：选择一个你感兴趣的选项' }, usageHint: 'label', className: 'w-full max-w-xl mx-auto text-left mb-4 text-white/30' } } },
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
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-12', children: { explicitList: ['resultHint', 'ticket', 'rethinkBtn'] } } } },
          { id: 'resultHint', component: { Text: { text: { literalString: '你的今晚结局' }, usageHint: 'label', className: 'mb-4 text-white/30' } } },
          { id: 'ticket', component: { NightfallTicket: { bundlePath: '/bundle', uiPath: '/ui' } } },
          { id: 'rethinkBtn', component: { Button: { label: { literalString: '← 重新开始' }, variant: 'ghost', action: { name: 'TONIGHT_RESET' } } } },
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

export function programDiscover(context: ContextSignals, scenes: SceneCard[]): A2UIMessage[] {
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  return [
    {
      surfaceUpdate: {
        surfaceId: 'discover',
        components: [
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-10 page-entering', children: { explicitList: ['head', 'sceneGrid', 'gallery'] } } } },
          { id: 'head', component: { Box: { className: 'text-center space-y-2 pt-6 pb-6', children: { explicitList: ['title', 'subtitle'] } } } },
          { id: 'title', component: { Text: { text: { literalString: '发现' }, usageHint: 'h1' } } },
          { id: 'subtitle', component: { Text: { text: { literalString: '今晚想去哪里？' }, usageHint: 'subtitle' } } },
          { id: 'sceneGrid', component: { SceneGrid: { itemsPath: '/discover/scenes' } } },
          { id: 'gallery', component: { GalleryWall: { itemsPath: '/discover/gallery_refs', label: '候选墙' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'discover',
        contents: [
          { key: 'discover', value: vMap({ stage: 'scenes', scenes: safeScenes, skills: [], hero: null, gallery_refs: [] }) },
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
          { id: 'root', component: { SkyAtmosphere: { latPath: '/context/location/lat', lngPath: '/context/location/lng', cityPath: '/context/location/city_id', pressurePath: '/sky/pressure', ambientPath: '/sky/ambient', backdropPath: '/sky/backdrop_ref' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'sky',
        contents: [
          { key: 'context', value: plainToValue(context) },
          { key: 'sky', value: vMap({ pressure: '适中', ambient: '14 人在线' }) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'sky', root: 'root' } }
  ];
}

export function programPocket(context: ContextSignals): A2UIMessage[] {
  const pulse = Array.from({ length: 14 }, (_, i) => Math.max(0.15, Math.sin(i / 2) * 0.25 + 0.35));
  const tickets = [
    { type: 'OUTCOME', date: '今晚', title: '一个安静的角落，一杯热饮' },
    { type: 'ROUTE', date: '上周', title: '两条街的霓虹，然后回家' },
    { type: 'NOTE', date: '存档', title: '"少一点压力，多一点清醒。"' },
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
    { symbol: '✶', timestamp: '22:14', content: '雨后的灯光格外温柔。' },
    { symbol: '◌', timestamp: '22:31', content: '找到了一个不用解释的座位。' },
    { symbol: '⟡', timestamp: '23:02', content: '一页书，一口气，夜晚就这样折叠了。' },
  ];

  return [
    {
      surfaceUpdate: {
        surfaceId: 'whispers',
        components: [
          { id: 'root', component: { Box: { className: 'w-full max-w-xl mx-auto space-y-6 pt-8', children: { explicitList: ['wall', 'composer'] } } } },
          { id: 'wall', component: { WhisperWall: { itemsPath: '/whispers/items', symbolPath: '/whispers/symbols' } } },
          { id: 'composer', component: { WhisperComposer: { submitActionName: 'WHISPER_SUBMIT' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'whispers',
        contents: [
          { key: 'whispers', value: vMap({ items, symbols: ['✶', '◌', '⟡', '◈', '◎', '▽', '◆'] }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'whispers', root: 'root' } }
  ];
}


export function programVeil(context: ContextSignals): A2UIMessage[] {
  return [
    {
      surfaceUpdate: {
        surfaceId: 'veil',
        components: [
          { id: 'root', component: { VeilMomentStream: { momentsPath: '/veil/moments' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'veil',
        contents: [
          { key: 'veil', value: vMap({ moments: [] }) },
          { key: 'moments_tick', value: vNum(0) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'veil', root: 'root' } }
  ];
}

export function programFootprints(context: ContextSignals): A2UIMessage[] {
  return [
    {
      surfaceUpdate: {
        surfaceId: 'footprints',
        components: [
          { id: 'root', component: { FootprintsPanel: { fpPath: '/fp' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'footprints',
        contents: [
          { key: 'fp', value: vMap({ summary: { focus_min: 0, lights: 0, whispers: 0, places: 0 }, weekly_text: '这周还没有足迹...' }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'footprints', root: 'root' } }
  ];
}

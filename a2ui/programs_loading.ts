import { ContextSignals } from '../types';
import { A2UIMessage } from './messages';
import { vMap, plainToValue } from './programs';

/**
 * Loading screen program - shows while waiting for LLM response
 */
export function programTonightLoading(context: ContextSignals, orderText: string, loadingMessage?: string): A2UIMessage[] {
  const message = loadingMessage || '正在搜索附近地点...';
  return [
    {
      surfaceUpdate: {
        surfaceId: 'tonight',
        components: [
          { id: 'root', component: { Box: { className: 'w-full flex flex-col items-center justify-center min-h-[60vh] py-12', children: { explicitList: ['loadingCard'] } } } },
          { id: 'loadingCard', component: { Card: { variant: 'glass', rounded: 'rounded-[2.5rem]', pad: 'p-9', children: { explicitList: ['loadingIcon', 'loadingTitle', 'loadingSubtitle', 'loadingHint'] } } } },
          { id: 'loadingIcon', component: { Box: { className: 'flex justify-center mb-6', children: { explicitList: ['spinner'] } } } },
          { id: 'spinner', component: { Text: { text: { literalString: '◐' }, usageHint: 'h1', className: 'animate-spin text-4xl text-white/30' } } },
          { id: 'loadingTitle', component: { Text: { text: { literalString: message }, usageHint: 'h2', className: 'text-center' } } },
          { id: 'loadingSubtitle', component: { Text: { text: { literalString: orderText ? `"${orderText}"` : '' }, usageHint: 'subtitle', className: 'text-center mt-2' } } },
          { id: 'loadingHint', component: { Text: { text: { literalString: '基于你的位置搜索真实地点，请稍候...' }, usageHint: 'label', className: 'text-center mt-4 text-white/20' } } },
        ]
      }
    },
    {
      dataModelUpdate: {
        surfaceId: 'tonight',
        contents: [
          { key: 'ui', value: vMap({ stage: 'loading', loading: true, active_plan: 'primary' }) },
          { key: 'tonight', value: vMap({ order_text: orderText }) },
          { key: 'context', value: plainToValue(context) }
        ]
      }
    },
    { beginRendering: { surfaceId: 'tonight', root: 'root' } }
  ];
}

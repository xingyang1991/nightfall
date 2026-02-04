import type { ManusSkillOverride } from './manusPromptSkill';

/**
 * Hand-tuned overrides for Manus skill packages.
 * - Tags are UI shelf labels (tight).
 * - Permissions declare which tools the skill is allowed to call.
 *
 * In production, this lives in a server-side SkillStore (editable without redeploy).
 */
export const MANUS_OVERRIDES: Record<string, ManusSkillOverride> = {
  'chill-place-picker': {
    shelfTag: 'CHILL',
    intents: ['place_anchor', 'tonight_answer'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['warm', 'minimal'], uiModeHint: 'explore' }
  },
  'coffee-dongwang': {
    shelfTag: 'COFFEE',
    intents: ['place_anchor', 'explore'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['warm'], uiModeHint: 'explore' }
  },
  'micro-itinerary-curator': {
    shelfTag: 'ROUTE',
    intents: ['explore'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['minimal'], uiModeHint: 'explore' }
  },
  'inner-street-detour': {
    shelfTag: 'DET0UR',
    intents: ['explore'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['minimal'], uiModeHint: 'explore' }
  },
  'budget-stroll-curator': {
    shelfTag: 'BUDGET',
    intents: ['explore'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['lived_in'], uiModeHint: 'explore' }
  },
  'curate-rainy-day': {
    shelfTag: 'RAIN',
    intents: ['explore', 'place_anchor'],
    permissions: { tools: ['places.search', 'maps.link', 'weather.forecast'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['mist', 'warm'], uiModeHint: 'explore' }
  },
  'solo-meal-editor': {
    shelfTag: 'SOLO MEAL',
    intents: ['place_anchor'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['warm'], uiModeHint: 'explore' }
  },
  'space-reviewer': {
    shelfTag: 'DESIGN',
    intents: ['place_anchor'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['minimal'], uiModeHint: 'focus' }
  },
  'bookstore-refuge': {
    shelfTag: 'BOOK',
    intents: ['place_anchor', 'focus'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['paper', 'warm'], uiModeHint: 'focus' }
  },
  'attend-invisibly': {
    shelfTag: 'STEALTH',
    intents: ['quiet_copresence', 'explore'],
    permissions: { tools: [], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['minimal'], uiModeHint: 'stealth' }
  },
  'draft-dazi-protocol': {
    shelfTag: 'FOCUS',
    intents: ['focus'],
    permissions: { tools: [], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['minimal'], uiModeHint: 'focus' }
  },
  'follow-favorite-artists': {
    shelfTag: 'ART',
    intents: ['explore'],
    permissions: { tools: [], dataScopes: ['context.read'] },
    uiHints: { toneTags: ['minimal'], uiModeHint: 'explore' }
  },
  'leave-exhibit-review': {
    shelfTag: 'ECHO',
    intents: ['footprint'],
    permissions: { tools: ['storage.pocket.append'], dataScopes: ['pocket.write', 'context.read'] },
    uiHints: { toneTags: ['minimal'], uiModeHint: 'explore' }
  },
  'plan-artwalk': {
    shelfTag: 'ARTWALK',
    intents: ['explore'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] }
  },
  'plan-museum-sprint': {
    shelfTag: 'MUSEUM',
    intents: ['explore'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] }
  },
  'plan-architecture-citywalk': {
    shelfTag: 'ARCH',
    intents: ['explore'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] }
  },
  'plan-micro-exhibit-stop': {
    shelfTag: 'POP-UP',
    intents: ['explore'],
    permissions: { tools: ['places.search', 'maps.link'], dataScopes: ['context.read'] }
  }
};

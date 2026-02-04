import type { ContextSignals, CuratorialBundle, CandidateItem } from '../types';
import type { A2UIMessage } from '../a2ui/messages';

/** Canonical intents understood by the stage manager. */
export type Intent =
  | 'tonight_answer'
  | 'place_anchor'
  | 'explore'
  | 'quiet_copresence'
  | 'focus'
  | 'radio'
  | 'whispers'
  | 'footprint'
  | 'plan_b';

export type SkillStage = 'candidate' | 'finalize' | 'system';

export type ToolName =
  | 'places.search'
  | 'places.details'
  | 'maps.link'
  | 'maps.arrival_glance'
  | 'maps.send_to_car'
  | 'music.pick'
  | 'weather.forecast'
  | 'storage.pocket.append'
  | 'storage.whispers.append';

export type DataScope = 'context.read' | 'pocket.write' | 'whispers.write';

export interface SkillManifest {
  id: string;
  version: string;
  title: string;
  description: string;
  stages: SkillStage[];
  /** Which intents this skill can satisfy. */
  intents: Intent[];
  /** Which surfaces this skill is allowed to update (UI safety). */
  allowedSurfaces: string[];
  /** Permissions requested by this skill. */
  permissions: {
    tools: ToolName[];
    dataScopes: DataScope[];
  };
  /** Rate limiting / anti-spam (client-side PoC; enforce server-side in prod). */
  rateLimit?: {
    perNight?: number;
    perMinute?: number;
  };
    /** Optional short tag for shelves (UI). */
  shelfTag?: string;
  /** Optional default prompt used when user picks this skill from the shelf. */
  defaultPrompt?: string;

/** Optional hints to steer Style Envelope and UI variants. */
  uiHints?: {
    toneTags?: string[];
    uiModeHint?: 'drive_safe' | 'low_battery' | 'focus' | 'explore' | 'stealth';
  };
}

export interface SkillContext {
  context: ContextSignals;
  /** Opaque session state that survives within a night. */
  session: Record<string, any>;
}

export interface SkillRequest {
  intent: Intent;
  stage: SkillStage;
  utterance?: string;
  selection?: {
    selected_id?: string;
    choice?: string;
  };
  constraints?: Record<string, any>;
}

export interface SkillResult {
  bundle?: CuratorialBundle;
  /** Optional candidate pool for multi-stage skills. */
  candidates?: CandidateItem[];
  /** Optional UI-level patches. Use sparingly; prefer domain bundle + templates. */
  patches?: A2UIMessage[];
  /** Optional hint to adjust UI density and Style Envelope on the client. */
  ui?: {
    infoDensity?: number; // 0..1
    uiModeHint?: string;
    toneTags?: string[];
  };
  debug?: Record<string, any>;
}

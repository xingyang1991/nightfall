
export enum TimeBand {
  DINNER = 'dinner',
  PRIME = 'prime',
  LATE = 'late',
  DAYTIME = 'daytime'
}

export enum MotionState {
  DRIVING = 'driving',
  WALKING = 'walking',
  STILL = 'still',
  UNKNOWN = 'unknown'
}

export enum ChannelType {
  TONIGHT = 'tonight',
  DISCOVER = 'discover',
  SKY = 'sky',
  POCKET = 'pocket',
  VEIL = 'veil',
  FOOTPRINTS = 'footprints'
}


export interface CandidateItem {
  id: string;
  title: string;
  tag: string;
  desc: string;
  image_ref?: string;
}

export interface CuratorialBundle {
  primary_ending: {
    id: string;
    title: string;
    reason: string;
    checklist: string[];
    risk_flags: string[];
    expires_at: string;
    action: 'NAVIGATE' | 'START_ROUTE' | 'PLAY' | 'START_FOCUS';
    action_label: string;
  payload?: Record<string, any>;
  };
  plan_b: {
    id: string;
    title: string;
    reason: string;
    checklist: string[];
    risk_flags?: string[];
    expires_at?: string;
    action: 'NAVIGATE' | 'START_ROUTE' | 'PLAY' | 'START_FOCUS';
    action_label: string;
    payload?: Record<string, any>;
  };
  ambient_tokens: string[];
  candidate_pool?: CandidateItem[];
  ui_hints?: {
    infoDensity?: number; // 0..1
    uiModeHint?: string;
    toneTags?: string[];
  };
  media_pack?: {
    cover_ref?: string;        // 4:5
    gallery_refs?: string[];   // 1:1 smalls
    fragment_ref?: string;     // 1:1 ticket fragment
    stamp_ref?: string;        // 1:1 stamp
    texture_ref?: string;      // 16:9/1:1 backdrop
    tone_tags?: string[];
    accent_hint?: string;
  };
}

export interface ContextSignals {
  time: {
    now_ts: string;
    time_band: TimeBand;
    weekday: number;
    local_holiday_flag: boolean;
  };
  location: {
    grid_id: string;
    city_id: string;
    place_context: 'home' | 'work' | 'unknown';
    location_quality: 'ok' | 'low' | 'none';
    lat?: number;
    lng?: number;
  };
  mobility: {
    motion_state: MotionState;
    transport_mode: 'car' | 'transit' | 'walk';
    eta_min: number;
  };
  user_state: {
    mode: 'immersion' | 'convergence' | 'recovery' | 'explore' | 'night_flight' | 'light_talk';
    energy_band: 'low' | 'mid' | 'high';
    social_temp: number; // 0-3
    stealth: boolean;
  };
}

export interface WhisperNote {
  id: string;
  content: string;
  symbol: string;
  timestamp: string;
}

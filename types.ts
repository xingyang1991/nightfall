
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
  image_source?: 'amap' | 'unsplash' | 'default' | 'search' | 'google';
  place_data?: {
    lat?: number;
    lng?: number;
    name?: string;
    address?: string;
    rating?: string;
    distance?: string;
    walk_time?: string;
    place_id?: string;
    opentime?: string;
  };
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

export interface CityAtmosphere {
  timestamp: number;
  city: string;
  pulse: {
    level: 'quiet' | 'moderate' | 'vibrant' | 'bustling';
    score: number;
    description: string;
  };
  hotspots: Array<{
    name: string;
    center: { lat: number; lng: number };
    intensity: number;
    category: string;
  }>;
  anonymous_users: {
    total: number;
    nearby: number;
    distribution: Array<{ area: string; count: number }>;
  };
  weather: {
    condition: string;
    temperature: number;
    humidity: number;
    mood: string;
  };
  open_places: {
    total: number;
    by_category: Record<string, number>;
  };
}

export interface Moment {
  id: string;
  user_id: string;
  image: {
    url: string;
    thumbnail_url: string;
    width: number;
    height: number;
    blurhash?: string;
  };
  place?: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  caption?: string;
  taken_at: string;
  uploaded_at: string;
  likes: number;
  views: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MomentQuery {
  page: number;
  limit: number;
  filter?: {
    near?: { lat: number; lng: number; radius: number };
    place_id?: string;
    user_id?: string;
  };
  sort?: 'recent' | 'popular' | 'nearby';
}

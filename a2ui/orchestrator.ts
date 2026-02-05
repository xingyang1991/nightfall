import type { ContextSignals } from '../types';
import type { A2UIAction, A2UIMessage } from './messages';
import type { EngineEffect } from '../runtime/nightfallEngine';

/**
 * OrchestratorEnv is owned by the host shell (React App).
 * This file is now a thin adapter:
 * - It forwards userAction -> NightfallEngine
 * - It applies returned A2UI messages
 * - It executes host-side effects (open overlays, open external links)
 *
 * In production, NightfallEngine can live server-side and this adapter can become an API client.
 */
export interface OrchestratorEnv {
  context: ContextSignals;
  setContext: (updater: (prev: ContextSignals) => ContextSignals) => void;

  openWhispers: () => void;
  closeWhispers: () => void;
  enterFocus: () => void;
  exitFocus: () => void;

  // Channels include two hidden modes used by Pocket shortcuts.
  setActiveChannel: (channel: 'tonight' | 'discover' | 'sky' | 'pocket' | 'veil' | 'footprints') => void;
  applyStyleHint: (hint: { infoDensity?: number; uiModeHint?: string; toneTags?: string[] }) => void;
  openExternal: (url: string) => void;

  applyMessages: (messages: A2UIMessage[]) => void;
}

export class NightfallOrchestrator {
  private baseUrl: string;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private authToken: string | null = null;
  private ws: WebSocket | null = null;

  constructor(baseUrl?: string) {
    // In production, use relative path (same origin); in dev, use localhost:4000
    const defaultUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? '' 
      : 'http://localhost:4000';
    this.baseUrl = baseUrl ?? (import.meta as any).env?.VITE_NIGHTFALL_API ?? defaultUrl;
    this.userId = getOrCreateUserId();
    this.authToken = getAuthToken();
  }

  bootstrap(env: OrchestratorEnv) {
    const { context } = env;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) headers.Authorization = `Bearer ${this.authToken}`;
    fetch(`${this.baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ context, sessionId: this.sessionId, userId: this.userId })
    })
      .then((r) => r.json())
      .then((out) => {
        if (out?.sessionId) this.sessionId = String(out.sessionId);
        if (out?.userId) {
          this.userId = String(out.userId);
          setStoredUserId(this.userId);
        }
        if (out?.auth_token) {
          this.authToken = String(out.auth_token);
          setAuthToken(this.authToken);
        }
        if (out?.messages?.length) env.applyMessages(out.messages as A2UIMessage[]);
        if (out?.effects?.length) this.applyEffects(out.effects as EngineEffect[], env);
      })
      .catch((_e) => {
        // ignore in PoC
      });

    this.connectWebSocket(env);
    this.fetchScenes(env);
  }

  async handleAction(action: A2UIAction, env: OrchestratorEnv) {
    const { context } = env;
    const res = await fetch(`${this.baseUrl}/api/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {})
      },
      body: JSON.stringify({ action, context, sessionId: this.sessionId, userId: this.userId })
    }).then((r) => r.json());

    if (res?.sessionId) this.sessionId = String(res.sessionId);
    if (res?.auth_token) {
      this.authToken = String(res.auth_token);
      setAuthToken(this.authToken);
    }

    if (res?.messages?.length) env.applyMessages(res.messages as A2UIMessage[]);
    if (res?.effects?.length) this.applyEffects(res.effects as EngineEffect[], env);
  }

  /** Debug only: read audit events collected by SkillRuntime (PoC). */
  getAudit() {
    const headers: Record<string, string> = {};
    if (this.authToken) headers.Authorization = `Bearer ${this.authToken}`;
    return fetch(`${this.baseUrl}/api/audit?n=80`, { headers }).then((r) => r.json()).then((x) => x.events ?? []);
  }

  getTrace(traceId: string) {
    const headers: Record<string, string> = {};
    if (this.authToken) headers.Authorization = `Bearer ${this.authToken}`;
    return fetch(`${this.baseUrl}/api/trace/${encodeURIComponent(traceId)}`, { headers }).then((r) => r.json());
  }

  private applyEffects(effects: EngineEffect[], env: OrchestratorEnv) {
    for (const e of effects) {
      switch (e.type) {
        case 'open_whispers':
          env.openWhispers();
          break;
        case 'close_whispers':
          env.closeWhispers();
          break;
        case 'enter_focus':
          env.enterFocus();
          break;
        case 'exit_focus':
          env.exitFocus();
          break;
        case 'open_external':
          env.openExternal(e.url);
          break;
        case 'set_channel':
          env.setActiveChannel(e.channel);
          break;
        case 'style_hint':
          env.applyStyleHint(e.hint);
          break;
      }
    }
  }

  private connectWebSocket(env: OrchestratorEnv) {
    if (typeof window === 'undefined') return;
    if (this.ws) return;
    try {
      const base = this.baseUrl || window.location.origin;
      const url = base.startsWith('http') ? base.replace('http', 'ws') : `ws://${window.location.host}`;
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        const loc = env.context.location;
        this.ws?.send(JSON.stringify({
          type: 'subscribe:atmosphere',
          lat: loc.lat ?? 31.23,
          lng: loc.lng ?? 121.47,
          city: loc.city_id ?? 'Shanghai',
          uid: this.userId,
          token: this.authToken
        }));
      };
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data ?? ''));
          if (msg?.type === 'atmosphere:update' && msg.payload) {
            env.applyMessages([
              {
                dataModelUpdate: {
                  surfaceId: 'sky',
                  contents: [{ key: 'atmosphere_json', value: { valueString: JSON.stringify(msg.payload) } }]
                }
              } as any
            ]);
          }
          if (msg?.type === 'moment:new' && msg.payload) {
            env.applyMessages([
              {
                dataModelUpdate: {
                  surfaceId: 'veil',
                  contents: [{ key: 'moments_tick', value: { valueNumber: Date.now() } }]
                }
              } as any
            ]);
          }
          if (msg?.type === 'user:nearby' && msg.payload) {
            env.applyMessages([
              {
                dataModelUpdate: {
                  surfaceId: 'sky',
                  contents: [{ key: 'atmosphere_users', value: { valueString: JSON.stringify(msg.payload) } }]
                }
              } as any
            ]);
          }
        } catch {
          // ignore
        }
      };
      this.ws.onclose = () => {
        this.ws = null;
      };
    } catch {
      // ignore
    }
  }

  private fetchScenes(env: OrchestratorEnv) {
    const headers: Record<string, string> = {};
    if (this.authToken) headers.Authorization = `Bearer ${this.authToken}`;
    fetch(`${this.baseUrl}/api/scenes`, { headers })
      .then((r) => r.json())
      .then((data) => {
        const scenes = Array.isArray(data?.scenes) ? data.scenes : [];
        if (!scenes.length) return;
        env.applyMessages([
          {
            dataModelUpdate: {
              surfaceId: 'discover',
              contents: [
                { key: 'discover', value: { valueMap: [
                  { key: 'scenes', value: { valueList: scenes.map((s: any) => ({ valueMap: [
                    { key: 'id', value: { valueString: String(s.id ?? '') } },
                    { key: 'title', value: { valueString: String(s.title ?? '') } },
                    { key: 'subtitle', value: { valueString: String(s.subtitle ?? '') } },
                    { key: 'preset_query', value: { valueString: String(s.preset_query ?? '') } },
                    { key: 'skill_id', value: { valueString: String(s.skill_id ?? '') } },
                    { key: 'image_ref', value: { valueString: String(s.image_ref ?? '') } },
                    { key: 'gradient', value: { valueString: String(s.gradient ?? '') } },
                    { key: 'icon', value: { valueString: String(s.icon ?? '') } },
                    { key: 'tags', value: { valueList: Array.isArray(s.tags) ? s.tags.map((t: any) => ({ valueString: String(t) })) : [] } }
                  ]})) } }
                ] } }
              ]
            }
          } as any
        ]);
      })
      .catch(() => {});
  }
}

function getOrCreateUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = 'nightfall_user_id';
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `nf_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return null;
  }
}

function setStoredUserId(id: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('nightfall_user_id', id);
  } catch {
    // ignore
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.localStorage.getItem('nightfall_auth_token');
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!token) {
      window.localStorage.removeItem('nightfall_auth_token');
      return;
    }
    window.localStorage.setItem('nightfall_auth_token', token);
  } catch {
    // ignore
  }
}

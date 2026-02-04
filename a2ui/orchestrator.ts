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

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? (import.meta as any).env?.VITE_NIGHTFALL_API ?? 'http://localhost:4000';
  }

  bootstrap(env: OrchestratorEnv) {
    const { context } = env;
    fetch(`${this.baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, sessionId: this.sessionId })
    })
      .then((r) => r.json())
      .then((out) => {
        if (out?.sessionId) this.sessionId = String(out.sessionId);
        if (out?.messages?.length) env.applyMessages(out.messages as A2UIMessage[]);
        if (out?.effects?.length) this.applyEffects(out.effects as EngineEffect[], env);
      })
      .catch((_e) => {
        // ignore in PoC
      });
  }

  async handleAction(action: A2UIAction, env: OrchestratorEnv) {
    const { context } = env;
    const res = await fetch(`${this.baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, context, sessionId: this.sessionId })
    }).then((r) => r.json());

    if (res?.sessionId) this.sessionId = String(res.sessionId);

    if (res?.messages?.length) env.applyMessages(res.messages as A2UIMessage[]);
    if (res?.effects?.length) this.applyEffects(res.effects as EngineEffect[], env);
  }

  /** Debug only: read audit events collected by SkillRuntime (PoC). */
  getAudit() {
    return fetch(`${this.baseUrl}/api/audit?n=80`).then((r) => r.json()).then((x) => x.events ?? []);
  }

  getTrace(traceId: string) {
    return fetch(`${this.baseUrl}/api/trace/${encodeURIComponent(traceId)}`).then((r) => r.json());
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
}

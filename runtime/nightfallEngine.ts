import type { ContextSignals, CandidateItem } from '../types';
import type { A2UIAction, A2UIMessage } from '../a2ui/messages';
import {
  programTonightOrder,
  programTonightClarify,
  programTonightCandidates,
  programTonightResult,
  programDiscover,
  programPocket,
  programSky,
  programWhispers,
  programRadio,
  programVeil,
  programFootprints
} from '../a2ui/programs';
import { SkillRuntime } from './skillRuntime';
import { getSkill, listSkills } from './skills/registry';
import { routeSkillFromUtterance, type RouteResult } from './router/skillRouter';
import { ToolBus } from './toolbus/toolBus';
import { shouldUpdateSurface } from './policy/channelBudget';
import { circleCleanup, circleGet, circlePulse, type CircleConfig } from './policy/circleSignals';

export type EngineEffect =
  | { type: 'open_whispers' }
  | { type: 'close_whispers' }
  | { type: 'enter_focus' }
  | { type: 'exit_focus' }
  | { type: 'open_external'; url: string }
  | { type: 'set_channel'; channel: 'tonight' | 'discover' | 'sky' | 'pocket' | 'veil' | 'footprints' }
  | { type: 'style_hint'; hint: { infoDensity?: number; uiModeHint?: string; toneTags?: string[] } };

export interface EngineResponse {
  messages: A2UIMessage[];
  effects: EngineEffect[];
}

/**
 * NightfallEngine is the stage manager.
 * - Selects skills (rule-based router)
 * - Runs skills through SkillRuntime
 * - Emits A2UI surface updates + host effects (open maps, switch channel, style hint)
 *
 * PoC runs in the client; production can move NightfallEngine server-side.
 */
export class NightfallEngine {
  private runtime: SkillRuntime;
  private session: Record<string, any> = {};
  private systemTools: ToolBus;
  private isBrowser = typeof window !== 'undefined' && typeof (window as any).localStorage !== 'undefined';

  private circleCfg: CircleConfig = { bucketMinutes: 15, kMin: 3, delaySeconds: 120, ttlSeconds: 7200 };

  constructor(runtime?: SkillRuntime) {
    this.runtime = runtime ?? new SkillRuntime();
    this.systemTools = new ToolBus({ allowedTools: ['maps.link', 'maps.arrival_glance', 'maps.send_to_car'], audit: this.runtime.getAudit() });
  }

  getAudit() {
    return this.runtime.getAudit();
  }

  bootstrap(context: ContextSignals): EngineResponse {
    this.ensureSessionDefaults();

    const skillShelf = buildSkillShelfItems();
    this.session.discoverSkills = skillShelf;
    this.session.discoverHero = skillShelf?.[0] ?? null;

    const messages: A2UIMessage[] = [
      ...programTonightOrder(context),
      ...programDiscover(context, skillShelf),
      ...programSky(context),
      ...programPocket(context),
      ...programWhispers(context),
      ...programRadio(context),
      ...programVeil(context),
      ...programFootprints(context),

      ...this.patchSky(context),
      ...this.patchPocket(),
      ...this.patchWhispers(),
      ...this.patchRadio(),
      ...this.patchVeil(context)
    ];

    return { messages, effects: [] };
  }

  async dispatch(action: A2UIAction, context: ContextSignals): Promise<EngineResponse> {
    this.ensureSessionDefaults();

    const effects: EngineEffect[] = [];
    const messages: A2UIMessage[] = [];

    switch (action.name) {
      /** Tonight: free text -> routed skill -> candidate pool -> finalize */
      case 'TONIGHT_SUBMIT_ORDER': {
        const text = String((action.payload as any)?.text ?? '').trim();
        if (!text) return { messages: [], effects: [] };

        this.session.lastOrderText = text;

        const route = routeSkillFromUtterance(text, context, { fallbackSkillId: 'tonight_composer' });
        if ((route as any).type === 'clarify') {
          const clarify = route as any;
          this.session.clarifyChoiceMap = clarify.choiceMap ?? {};
          this.session.candidateVariant = 0;
          messages.push(...programTonightClarify(context, text, clarify.choices ?? []));
          return { messages, effects };
        }

        const rRoute = route as RouteResult;
        this.session.activeSkillId = (rRoute as any).skillId;
        this.session.candidateVariant = 0;

        const r = await this.runCandidateOrFinalize((rRoute as any).skillId, context, { utterance: text }, effects);
        messages.push(...r);

        return { messages, effects };
      }

      case 'TONIGHT_REFRESH_CANDIDATES': {
        const skillId = String(this.session.activeSkillId ?? '').trim();
        if (!skillId) return { messages: [], effects: [] };

        this.session.candidateVariant = Number(this.session.candidateVariant ?? 0) + 1;
        const utterance = String(this.session.lastOrderText ?? '').trim();

        const r = await this.runCandidateOrFinalize(
          skillId,
          context,
          { utterance, constraints: { variant: this.session.candidateVariant } },
          effects,
          { forceCandidate: true }
        );
        messages.push(...r);
        return { messages, effects };
      }

      case 'TONIGHT_SELECT_CANDIDATE': {
        const selectedId = String((action.payload as any)?.id ?? '').trim();
        const skillId = String(this.session.activeSkillId ?? '').trim();
        const utterance = String(this.session.lastOrderText ?? '').trim();
        if (!selectedId || !skillId) return { messages: [], effects: [] };

        const res = await this.runtime.runSkill(
          skillId,
          { intent: 'explore', stage: 'finalize', utterance, selection: { selected_id: selectedId } },
          context,
          this.session
        );

        if (res.ui) effects.push({ type: 'style_hint', hint: res.ui });

        if (res.bundle) {
          this.ensureMediaPack(res.bundle, skillId);
          this.session.lastBundle = res.bundle;
          messages.push(...programTonightResult(context, res.bundle));
        } else if (res.patches) {
          messages.push(...res.patches);
        }

        return { messages, effects };
      }

      case 'DISCOVER_SELECT_SKILL': {
        const skillId = String((action.payload as any)?.id ?? '').trim();
        if (!skillId) return { messages: [], effects: [] };

        const skill = getSkill(skillId);
        if (!skill) return { messages: [], effects: [] };

        // Jump user to Tonight
        effects.push({ type: 'set_channel', channel: 'tonight' });

        this.session.activeSkillId = skillId;
        this.session.candidateVariant = 0;

        const utterance = String((action.payload as any)?.item?.prompt ?? skill.manifest.defaultPrompt ?? '').trim()
          || `Use $${skillId}`;

        this.session.lastOrderText = utterance;

        const r = await this.runCandidateOrFinalize(skillId, context, { utterance }, effects);
        messages.push(...r);

        return { messages, effects };
      }

      case 'TONIGHT_BACK_TO_ORDER':
      case 'TONIGHT_RESET': {
        this.session.lastOrderText = '';
        this.session.activeSkillId = '';
        this.session.candidateVariant = 0;
        this.session.clarifyChoiceMap = null;
        messages.push(...programTonightOrder(context));
        return { messages, effects };
      }

      case 'TONIGHT_SELECT_CHOICE': {
        const choice = String((action.payload as any)?.choice ?? '').trim();
        if (!choice) return { messages: [], effects: [] };

        const map = (this.session.clarifyChoiceMap ?? {}) as Record<string, string>;
        const skillId = String(map[choice] ?? '').trim();

        const utterance = String(this.session.lastOrderText ?? '').trim();
        let resolvedSkillId = skillId;
        if (!resolvedSkillId) {
          const routed = routeSkillFromUtterance(`${utterance} ${choice}`, context, { fallbackSkillId: 'tonight_composer' }) as any;
          resolvedSkillId = routed?.skillId ?? '';
        }
        if (!resolvedSkillId) return { messages: [], effects: [] };

        this.session.activeSkillId = resolvedSkillId;
        this.session.candidateVariant = 0;
        this.session.clarifyChoiceMap = null;

        const r = await this.runCandidateOrFinalize(
          resolvedSkillId,
          context,
          { utterance, selection: { choice }, constraints: { clarify_choice: choice } },
          effects
        );
        messages.push(...r);
        return { messages, effects };
      }

      /** Ticket affordances */
      case 'SWITCH_PLAN': {
        const plan = (action.payload as any)?.plan === 'plan_b' ? 'plan_b' : 'primary';
        messages.push({
          dataModelUpdate: {
            surfaceId: 'tonight',
            contents: [
              { key: 'ui', value: { valueMap: [
                { key: 'stage', value: { valueString: 'result' } },
                { key: 'loading', value: { valueBoolean: false } },
                { key: 'active_plan', value: { valueString: plan } }
              ]}}
            ]
          }
        } as any);
        return { messages, effects };
      }

      case 'SAVE_TICKET': {
        const bundle = (action.payload as any)?.bundle ?? this.session.lastBundle;
        if (!bundle?.primary_ending?.title) return { messages: [], effects: [] };

        const tickets = this.session.pocketTickets as any[];
        tickets.unshift({
          type: 'OUTCOME',
          date: 'Tonight',
          title: String(bundle.primary_ending.title).trim(),
          image_ref: bundle.media_pack?.fragment_ref ?? bundle.media_pack?.cover_ref ?? ''
        });
        this.persistPocket();

        // Force immediate pocket refresh.
        this.session.lastSurfaceUpdate_pocket = 0;

        messages.push(...this.patchPocket());
        return { messages, effects };
      }

      case 'EXECUTE_OUTCOME': {
        const outcomeAction = (action.payload as any)?.action as string | undefined;
        const label = String((action.payload as any)?.label ?? '').trim();
        const title = String((action.payload as any)?.title ?? '').trim();

        if (!outcomeAction) return { messages: [], effects: [] };

        if (outcomeAction === 'START_FOCUS') {
          effects.push({ type: 'enter_focus' });
          return { messages: [], effects };
        }

        if (outcomeAction === 'PLAY') {
          effects.push({ type: 'set_channel', channel: 'sky' });
          messages.push(...this.patchRadio({ narrative: 'On air…', playing: true }));
          return { messages, effects };
        }

        // NAVIGATE / START_ROUTE: open external map deep link (prefer precomputed nav_url)
        const p = (action.payload as any)?.payload ?? {};
        const navUrl = String(p.nav_url ?? '').trim();
        const q = String(p.query ?? title ?? label ?? 'quiet place').trim();
        const link = navUrl ? { url: navUrl } : await this.systemTools.mapsLink({ query: q });
        // Optional: stub “send to car”
        if (p.send_to_car) {
          try { await this.systemTools.mapsSendToCar({ url: link.url }); } catch {}
        }
        effects.push({ type: 'open_external', url: link.url });
        return { messages: [], effects };
      }

      /** Whispers: semi-anonymous residue wall */
      case 'WHISPER_SUBMIT': {
        const content = String((action.payload as any)?.content ?? '').trim();
        if (!content) return { messages: [], effects: [] };

        await this.runtime.runSkill(
          'whispers_note',
          { intent: 'whispers', stage: 'system', utterance: content },
          context,
          this.session
        );

        const items = this.session.whispersItems as any[];
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        items.push({ symbol: '◌', timestamp: `${hh}:${mm}`, content });
        this.persistWhispers();

        // Force immediate render after user submits (bypass surface budget).
        this.session.lastSurfaceUpdate_whispers = 0;

        messages.push(...this.patchWhispers());
        return { messages, effects };
      }


      case 'LIGHT_ON': {
        if (context.user_state.stealth) return { messages: [], effects: [] };
        const now = Date.now();
        circleCleanup(this.session, now, this.circleCfg);
        const grid = context.location.grid_id || 'grid_unknown';
        const mode = context.user_state.mode || 'quiet';
        circlePulse(this.session, grid, mode, now, this.circleCfg);
        this.session.lastSurfaceUpdate_sky = 0;
        messages.push(...this.patchSky(context));
        return { messages, effects };
      }

      case 'OPEN_WHISPERS':
        effects.push({ type: 'open_whispers' });
        return { messages, effects };

      /** Radio strip */
      case 'RADIO_TOGGLE': {
        const next = !Boolean(this.session.radioPlaying);
        this.session.radioPlaying = next;
        messages.push(...this.patchRadio({ playing: next }));
        return { messages, effects };
      }

      case 'OPEN_VEIL':
        effects.push({ type: 'set_channel', channel: 'veil' });
        messages.push(...this.patchVeil(context));
        return { messages, effects };

      case 'OPEN_FOOTPRINTS':
        effects.push({ type: 'set_channel', channel: 'footprints' });
        return { messages, effects };

      case 'BACK_TO_POCKET':
        effects.push({ type: 'set_channel', channel: 'pocket' });
        return { messages, effects };

      case 'VEIL_FEEDBACK': {
        const vote = String((action.payload as any)?.vote ?? 'like');
        // tiny style hint only; no content stream.
        effects.push({ type: 'style_hint', hint: { uiModeHint: vote === 'like' ? 'focus' : 'stealth', infoDensity: 0.25 } });
        return { messages, effects };
      }

      case 'SAVE_VEIL_FRAME': {
        const collageId = String((action.payload as any)?.collage_id ?? 'veil');
        const tickets = this.session.pocketTickets as any[];
        tickets.unshift({ type: 'FRAME', date: 'Tonight', title: `Veil frame ${collageId}` });
        this.persistPocket();
        this.session.lastSurfaceUpdate_pocket = 0;
        messages.push(...this.patchPocket());
        return { messages, effects };
      }

      case 'EXPORT_POCKET': {
        const tickets = this.session.pocketTickets as any[];
        tickets.unshift({ type: 'WEEKLY', date: 'This week', title: 'Footprints archived' });
        this.persistPocket();
        this.session.lastSurfaceUpdate_pocket = 0;
        messages.push(...this.patchPocket());
        effects.push({ type: 'set_channel', channel: 'pocket' });
        return { messages, effects };
      }

      default:
        return { messages: [], effects: [] };
    }
  }

  private async runCandidateOrFinalize(
    skillId: string,
    context: ContextSignals,
    req: { utterance: string; constraints?: any; selection?: { choice?: string } },
    effects: EngineEffect[],
    opts?: { forceCandidate?: boolean }
  ): Promise<A2UIMessage[]> {
    const skill = getSkill(skillId);
    if (!skill) return [];

    const supportsCandidate = skill.manifest.stages.includes('candidate');
    const shouldCandidate = opts?.forceCandidate ? true : supportsCandidate;

    if (shouldCandidate) {
      const res = await this.runtime.runSkill(
        skillId,
        { intent: 'explore', stage: 'candidate', utterance: req.utterance, constraints: req.constraints, selection: req.selection },
        context,
        this.session
      );

      if (res.ui) effects.push({ type: 'style_hint', hint: res.ui });

      const candidates: CandidateItem[] = Array.isArray(res.candidates) ? res.candidates : [];
      const withImages = this.attachCandidateImages(skillId, candidates);
      if (candidates.length) {
        this.session.lastCandidates = withImages;
        return programTonightCandidates(context, {
          skillTitle: skill.manifest.title,
          orderText: req.utterance,
          candidates: withImages
        });
      }
      // fallthrough to finalize if no candidates returned
    }

    const res = await this.runtime.runSkill(
      skillId,
      { intent: 'explore', stage: 'finalize', utterance: req.utterance, constraints: req.constraints, selection: req.selection },
      context,
      this.session
    );

    if (res.ui) effects.push({ type: 'style_hint', hint: res.ui });

    if (res.bundle) {
      this.ensureMediaPack(res.bundle, skillId);
      this.session.lastBundle = res.bundle;
      // Enrich bundle with external navigation deep links and a minimal “last 300m” glance.
      await this.enrichNav(res.bundle, context);
      return [
        ...programTonightResult(context, res.bundle),
        ...this.patchRadio(),
        ...this.patchVeil(context),
        ...this.patchDiscoverGallery(res.bundle)
      ];
    }
    return res.patches ?? [];
  }

  private ensureSessionDefaults() {
    if (!this.session.pocketTickets) {
      if (this.isBrowser) {
        try {
          const raw = localStorage.getItem('nightfall_pocket');
          this.session.pocketTickets = raw ? JSON.parse(raw) : [];
        } catch {
          this.session.pocketTickets = [];
        }
      } else {
        this.session.pocketTickets = [];
      }
    }

    if (!this.session.whispersItems) {
      if (this.isBrowser) {
        try {
          const raw = localStorage.getItem('nightfall_whispers');
          this.session.whispersItems = raw ? JSON.parse(raw) : [];
        } catch {
          this.session.whispersItems = [];
        }
      } else {
        this.session.whispersItems = [];
      }
    }

    if (typeof this.session.lastOrderText !== 'string') this.session.lastOrderText = '';
    if (typeof this.session.activeSkillId !== 'string') this.session.activeSkillId = '';
    if (this.session.candidateVariant === undefined) this.session.candidateVariant = 0;
  }

  private patchSky(context: ContextSignals): A2UIMessage[] {
    const now = Date.now();
    if (!shouldUpdateSurface(this.session, 'sky', now, this.runtime.getAudit())) return [];

    if (context.user_state.stealth) {
      return [
        {
          dataModelUpdate: {
            surfaceId: 'sky',
            contents: [
              { key: 'sky', value: { valueMap: [
                { key: 'pressure', value: { valueString: 'Stealth' } },
                { key: 'ambient', value: { valueString: '隐身中' } },
                { key: 'backdrop_ref', value: { valueString: 'nf://texture/stealth' } },
              ]}}
            ]
          }
        } as any
      ];
    }

    circleCleanup(this.session, now, this.circleCfg);
    const grid = context.location.grid_id || 'grid_unknown';
    const mode = context.user_state.mode || 'quiet';
    const sig = circleGet(this.session, grid, mode, now, this.circleCfg);
    const pressure = sig.visible ? (sig.intensity >= 3 ? 'Warm' : 'Soft') : 'Quiet';

    return [
      {
        dataModelUpdate: {
          surfaceId: 'sky',
          contents: [
            { key: 'sky', value: { valueMap: [
              { key: 'pressure', value: { valueString: pressure } },
              { key: 'ambient', value: { valueString: sig.summaryLine } },
              { key: 'backdrop_ref', value: { valueString: 'nf://texture/moon' } }
            ]}}
          ]
        }
      } as any
    ];
  }

  private attachCandidateImages(skillId: string, candidates: CandidateItem[]): CandidateItem[] {
    const placeResults = Array.isArray(this.session.lastPlaces) ? this.session.lastPlaces : [];
    const placePhotos = placeResults
      .map((p: any) => ({ title: String(p.title ?? ''), photo_ref: String(p.photo_ref ?? ''), photo_url: String(p.photo_url ?? '') }))
      .filter((p: any) => p.photo_ref || p.photo_url);
    const canUsePhotos = hasPlacesPhotoKey() && placePhotos.length > 0;

    return candidates.map((c, idx) => {
      if (c.image_ref) return { ...c };

      let image_ref = `nf://fragment/${skillId}/${c.id || idx}`;
      if (canUsePhotos) {
        const match = matchPlacePhoto(c.title, placePhotos) ?? placePhotos[idx % placePhotos.length];
        const ref = (match?.photo_url || match?.photo_ref) ?? '';
        if (ref) image_ref = ref.startsWith('nf://') ? ref : `nf://photo/${ref}`;
      }

      return {
        ...c,
        image_ref
      };
    });
  }

  private ensureMediaPack(bundle: any, skillId: string) {
    const seed = String(skillId || bundle?.primary_ending?.id || bundle?.primary_ending?.title || 'nightfall');
    bundle.media_pack = bundle.media_pack ?? {};
    const placeResults = Array.isArray(this.session.lastPlaces) ? this.session.lastPlaces : [];
    const placePhotos = placeResults
      .map((p: any) => ({ photo_ref: String(p.photo_ref ?? ''), photo_url: String(p.photo_url ?? '') }))
      .filter((p: any) => p.photo_ref || p.photo_url);
    const canUsePhotos = hasPlacesPhotoKey() && placePhotos.length > 0;
    const photoToken = (idx: number) => {
      const p = placePhotos[idx % placePhotos.length];
      const ref = (p?.photo_url || p?.photo_ref) ?? '';
      if (!ref) return '';
      return ref.startsWith('nf://') ? ref : `nf://photo/${ref}`;
    };

    if (!bundle.media_pack.cover_ref) {
      bundle.media_pack.cover_ref = canUsePhotos ? photoToken(0) : `nf://cover/${seed}`;
    }
    if (!bundle.media_pack.fragment_ref) {
      bundle.media_pack.fragment_ref = canUsePhotos ? photoToken(1) : `nf://fragment/${seed}`;
    }
    if (!bundle.media_pack.stamp_ref) bundle.media_pack.stamp_ref = `nf://stamp/${seed}`;
    if (!bundle.media_pack.texture_ref) bundle.media_pack.texture_ref = `nf://texture/${seed}`;
    if (!bundle.media_pack.gallery_refs || !bundle.media_pack.gallery_refs.length) {
      if (canUsePhotos) {
        bundle.media_pack.gallery_refs = placePhotos.slice(0, 6).map((_, i) => photoToken(i)).filter(Boolean);
      } else if (Array.isArray(this.session.lastCandidates)) {
        bundle.media_pack.gallery_refs = this.session.lastCandidates
          .map((c: any) => String(c.image_ref ?? '').trim())
          .filter(Boolean)
          .slice(0, 6);
      } else {
        bundle.media_pack.gallery_refs = [];
      }
    }
    return bundle;
  }

  private async enrichNav(bundle: any, context: ContextSignals) {
    const apply = async (ending: any) => {
      if (!ending) return;
      const a = String(ending.action ?? '').toUpperCase();
      if (a !== 'NAVIGATE' && a !== 'START_ROUTE') return;
      const q = String(ending.payload?.query ?? ending.title ?? '').trim();
      if (!q) return;

      try {
        const link = await this.systemTools.mapsLink({ query: q });
        ending.payload = { ...(ending.payload ?? {}), nav_url: link.url };
      } catch {}

      try {
        const glance = await this.systemTools.mapsArrivalGlance({ place_title: q, transport_mode: context.mobility.transport_mode });
        ending.payload = { ...(ending.payload ?? {}), arrival_glance_lines: glance.lines };
      } catch {}
    };

    await apply(bundle.primary_ending);
    await apply(bundle.plan_b);
  }

  private patchRadio(opts?: { narrative?: string; playing?: boolean }): A2UIMessage[] {
    const now = Date.now();
    if (!shouldUpdateSurface(this.session, 'radio', now, this.runtime.getAudit())) return [];
    if (opts?.playing !== undefined) this.session.radioPlaying = opts.playing;
    if (typeof opts?.narrative === 'string') this.session.radioNarrative = opts.narrative;
    const playing = Boolean(this.session.radioPlaying);
    const narrative = String(this.session.radioNarrative ?? '…');
    const coverRef =
      this.session.lastBundle?.media_pack?.fragment_ref ||
      this.session.lastBundle?.media_pack?.cover_ref ||
      this.session.lastCandidates?.[0]?.image_ref ||
      '';
    return [
      {
        dataModelUpdate: {
          surfaceId: 'radio',
          contents: [
            { key: 'radio', value: { valueMap: [
              { key: 'playing', value: { valueBoolean: playing } },
              { key: 'narrative', value: { valueString: narrative } },
              { key: 'cover_ref', value: { valueString: coverRef } }
            ]}}
          ]
        }
      } as any
    ];
  }

  private patchPocket(): A2UIMessage[] {
    const now = Date.now();
    if (!shouldUpdateSurface(this.session, 'pocket', now, this.runtime.getAudit())) return [];
    const tickets = this.session.pocketTickets as any[];
    return [
      {
        dataModelUpdate: {
          surfaceId: 'pocket',
          contents: [
            { key: 'pocket', value: { valueMap: [
              { key: 'tickets', value: { valueList: tickets.slice(0, 14).map(t => ({ valueMap: [
                { key: 'type', value: { valueString: String(t.type ?? 'OUTCOME') } },
                { key: 'date', value: { valueString: String(t.date ?? '') } },
                { key: 'title', value: { valueString: String(t.title ?? '') } },
                { key: 'image_ref', value: { valueString: String(t.image_ref ?? '') } }
              ]})) } }
            ]}}
          ]
        }
      } as any
    ];
  }

  private patchWhispers(): A2UIMessage[] {
    const now = Date.now();
    if (!shouldUpdateSurface(this.session, 'whispers', now, this.runtime.getAudit())) return [];
    const items = this.session.whispersItems as any[];
    return [
      {
        dataModelUpdate: {
          surfaceId: 'whispers',
          contents: [
            { key: 'whispers', value: { valueMap: [
              { key: 'items', value: { valueList: items.slice(-12).map(n => ({ valueMap: [
                { key: 'symbol', value: { valueString: String(n.symbol ?? '◌') } },
                { key: 'timestamp', value: { valueString: String(n.timestamp ?? '') } },
                { key: 'content', value: { valueString: String(n.content ?? '') } }
              ]})) } }
            ]}}
          ]
        }
      } as any
    ];
  }

  private patchVeil(context: ContextSignals): A2UIMessage[] {
    const now = Date.now();
    if (!shouldUpdateSurface(this.session, 'veil', now, this.runtime.getAudit())) return [];
    const dateSeed = String(context.time?.now_ts ?? new Date().toISOString()).slice(0, 10);
    const coverRef =
      this.session.lastBundle?.media_pack?.cover_ref ||
      this.session.lastBundle?.media_pack?.fragment_ref ||
      this.session.lastCandidates?.[0]?.image_ref ||
      `nf://cover/${dateSeed}`;
    const caption = buildVeilCaption(context, this.session);
    return [
      {
        dataModelUpdate: {
          surfaceId: 'veil',
          contents: [
            { key: 'veil', value: { valueMap: [
              { key: 'collage', value: { valueMap: [
                { key: 'collage_id', value: { valueString: `veil_${dateSeed}` } },
                { key: 'cover_ref', value: { valueString: coverRef } },
                { key: 'caption', value: { valueString: caption } }
              ]}}
            ]}}
          ]
        }
      } as any
    ];
  }

  private patchDiscoverGallery(bundle?: any): A2UIMessage[] {
    const now = Date.now();
    if (!shouldUpdateSurface(this.session, 'discover', now, this.runtime.getAudit())) return [];
    const gallery = Array.isArray(bundle?.media_pack?.gallery_refs)
      ? bundle.media_pack.gallery_refs.filter((r: any) => String(r ?? '').trim().length > 0).slice(0, 12)
      : [];
    if (!gallery.length) return [];
    const skills = Array.isArray(this.session.discoverSkills) && this.session.discoverSkills.length
      ? this.session.discoverSkills
      : buildSkillShelfItems();
    const hero = this.session.discoverHero ?? skills?.[0] ?? null;
    return [
      {
        dataModelUpdate: {
          surfaceId: 'discover',
          contents: [
            { key: 'discover', value: { valueMap: [
              { key: 'stage', value: { valueString: 'library' } },
              { key: 'skills', value: { valueList: skills.map((s: any) => ({ valueMap: [
                { key: 'id', value: { valueString: String(s.id ?? '') } },
                { key: 'tag', value: { valueString: String(s.tag ?? '') } },
                { key: 'title', value: { valueString: String(s.title ?? '') } },
                { key: 'desc', value: { valueString: String(s.desc ?? '') } },
                { key: 'prompt', value: { valueString: String(s.prompt ?? '') } },
                { key: 'image_ref', value: { valueString: String(s.image_ref ?? '') } }
              ]})) } },
              { key: 'hero', value: { valueMap: [
                { key: 'id', value: { valueString: String(hero?.id ?? '') } },
                { key: 'tag', value: { valueString: String(hero?.tag ?? '') } },
                { key: 'title', value: { valueString: String(hero?.title ?? '') } },
                { key: 'desc', value: { valueString: String(hero?.desc ?? '') } },
                { key: 'prompt', value: { valueString: String(hero?.prompt ?? '') } },
                { key: 'image_ref', value: { valueString: String(hero?.image_ref ?? '') } }
              ] } },
              { key: 'gallery_refs', value: { valueList: gallery.map((g: any) => ({ valueString: String(g) })) } }
            ] } }
          ]
        }
      } as any
    ];
  }

  private persistPocket() {
    if (!this.isBrowser) return;
    try { localStorage.setItem('nightfall_pocket', JSON.stringify(this.session.pocketTickets)); } catch {}
  }

  private persistWhispers() {
    if (!this.isBrowser) return;
    try { localStorage.setItem('nightfall_whispers', JSON.stringify(this.session.whispersItems)); } catch {}
  }
}

function buildSkillShelfItems(): any[] {
  return listSkills()
    .filter((s) => s.manifest.id !== 'whispers_note')
    .map((s) => ({
      id: s.manifest.id,
      tag: s.manifest.shelfTag ?? (s.manifest.uiHints?.uiModeHint ? String(s.manifest.uiHints.uiModeHint).toUpperCase() : 'SKILL'),
      title: s.manifest.title,
      desc: s.manifest.description,
      prompt: s.manifest.defaultPrompt,
      image_ref: `nf://cover/${s.manifest.id}`
    }));
}

function buildVeilCaption(context: ContextSignals, session: Record<string, any>) {
  const band = context.time?.time_band ?? 'prime';
  const mode = context.user_state?.mode ?? '';
  const energy = context.user_state?.energy_band ?? '';
  const anchor =
    String(session?.lastBundle?.primary_ending?.title ?? session?.lastOrderText ?? '').trim();
  const tokens: string[] = Array.isArray(session?.lastBundle?.ambient_tokens) ? session.lastBundle.ambient_tokens : [];

  const bandLabel =
    band === 'late' ? '深夜' :
    band === 'dinner' ? '晚餐后' :
    band === 'daytime' ? '白日' :
    '夜场';

  const modeLabel =
    mode === 'recovery' ? '低压' :
    mode === 'explore' ? '探索' :
    mode === 'convergence' ? '收束' :
    mode === 'night_flight' ? '夜航' :
    mode === 'light_talk' ? '轻谈' :
    mode === 'immersion' ? '沉浸' :
    '';

  const energyLabel =
    energy === 'low' ? '低电' :
    energy === 'high' ? '高能' :
    '';

  const prefixParts = [bandLabel, modeLabel, energyLabel].filter(Boolean);
  const prefix = prefixParts.length ? prefixParts.join(' · ') : '夜幕';
  const token = tokens.length ? `#${tokens[0]}` : '';

  if (anchor) {
    const short = anchor.length > 24 ? `${anchor.slice(0, 23)}…` : anchor;
    return `${prefix}：${short}${token ? ` ${token}` : ''}`;
  }
  if (token) return `${prefix} ${token}`;
  return `${prefix} · Moon veil`;
}

function normalizeTitle(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

function matchPlacePhoto(title: string, list: Array<{ title: string; photo_ref?: string; photo_url?: string }>) {
  const target = normalizeTitle(title || '');
  if (!target) return null;
  let best: any = null;
  let bestScore = 0;
  for (const item of list) {
    const cand = normalizeTitle(item.title || '');
    if (!cand) continue;
    const score = cand.includes(target) || target.includes(cand) ? Math.min(cand.length, target.length) : 0;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

function hasPlacesPhotoKey() {
  try {
    const env = (typeof process !== 'undefined' && (process as any).env) ? (process as any).env : {};
    return Boolean(env.GOOGLE_PLACES_API_KEY || env.GOOGLE_MAPS_API_KEY);
  } catch {
    return false;
  }
}

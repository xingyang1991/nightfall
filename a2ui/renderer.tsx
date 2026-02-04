import React, { useMemo } from 'react';
import { useA2UIRuntime } from './store';
import { A2UIAction, A2UIComponent } from './messages';
import { getByPath, resolveList, resolveNumber, resolveText } from './bindings';
import { Bookmark, ChevronRight, Loader2, Navigation, Play, Lamp, Ticket, ArrowDown, Send, Sparkles, Activity, User as UserIcon, MapPin, ExternalLink } from 'lucide-react';
import { saveTicketToPocket, getPocketTickets, getFootprints, saveWhisper, getWhispers, recordPlaceVisit, StoredTicket } from './storage';

/**
 * A2UIRenderer renders a single surface by surfaceId.
 * The host shell can decide which surfaceId to display in each app area.
 */

export interface SurfaceViewProps {
  surfaceId: string;
  className?: string;
}

export const SurfaceView: React.FC<SurfaceViewProps> = ({ surfaceId, className }) => {
  const { surfaces } = useA2UIRuntime();
  const surface = surfaces[surfaceId];

  if (!surface || !surface.rootId) {
    return (
      <div className={className}>
        <div className="w-full flex items-center justify-center py-10 text-white/10 text-[10px] mono uppercase tracking-[0.4em]">
          Loading
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <A2UIRenderNode surfaceId={surfaceId} nodeId={surface.rootId} />
    </div>
  );
};

interface RenderNodeProps {
  surfaceId: string;
  nodeId: string;
}

const A2UIRenderNode: React.FC<RenderNodeProps> = ({ surfaceId, nodeId }) => {
  const { surfaces, dispatchAction } = useA2UIRuntime();
  const surface = surfaces[surfaceId];
  if (!surface) return null;

  const node: A2UIComponent | undefined = surface.components[nodeId];
  if (!node) return null;

  const [type, rawProps] = useMemo(() => {
    const keys = Object.keys(node);
    const t = keys[0];
    const p = (node as any)[t] ?? {};
    return [t, p] as const;
  }, [node]);

  const model = surface.dataModel;

  const send = (name: string, payload?: any) => {
    const action: A2UIAction = { name, payload, surfaceId };
    dispatchAction(action);
  };

  // Helpers to render child by id
  const child = (id?: string) => (id ? <A2UIRenderNode surfaceId={surfaceId} nodeId={id} /> : null);
  const childrenFromList = (ids?: string[]) => (Array.isArray(ids) ? ids.map(id => <A2UIRenderNode key={id} surfaceId={surfaceId} nodeId={id} />) : null);

  // --- Core primitives ---
  switch (type) {
    case 'Column': {
      const ids = (rawProps?.children?.explicitList ?? []) as string[];
      const gap = rawProps?.gap ?? 'gap-4';
      const align = rawProps?.align ?? 'items-stretch';
      return <div className={`flex flex-col ${align} ${gap}`}>{childrenFromList(ids)}</div>;
    }
    case 'Row': {
      const ids = (rawProps?.children?.explicitList ?? []) as string[];
      const gap = rawProps?.gap ?? 'gap-3';
      const align = rawProps?.align ?? 'items-center';
      const justify = rawProps?.justify ?? 'justify-between';
      return <div className={`flex flex-row ${align} ${justify} ${gap}`}>{childrenFromList(ids)}</div>;
    }
    case 'Box': {
      const ids = (rawProps?.children?.explicitList ?? []) as string[];
      const cls = rawProps?.className ?? '';
      return <div className={cls}>{childrenFromList(ids)}</div>;
    }
    case 'Card': {
      const ids = (rawProps?.children?.explicitList ?? []) as string[];
      const variant = rawProps?.variant ?? 'glass';
      const base = variant === 'glass'
        ? 'bg-[color:var(--nf-card-bg)] border border-[color:var(--nf-card-border)] backdrop-blur-2xl'
        : 'bg-[#080808] border border-white/10';
      const rounded = rawProps?.rounded ?? 'rounded-[2.5rem]';
      const pad = rawProps?.pad ?? 'p-7';
      return <div className={`${base} ${rounded} ${pad} shadow-2xl`}>{childrenFromList(ids)}</div>;
    }
    case 'Text': {
      const usage = rawProps?.usageHint ?? 'body';
      const text = resolveText(model, rawProps?.text);
      const className = rawProps?.className ?? '';
      const usageClass =
        usage === 'h1' ? 'text-5xl font-extralight tracking-tighter italic text-white/90' :
        usage === 'h2' ? 'text-3xl font-light italic text-white tracking-tight' :
        usage === 'subtitle' ? 'text-[9px] mono uppercase tracking-[0.4em] text-white/15' :
        usage === 'label' ? 'text-[9px] mono uppercase tracking-[0.3em] text-white/20' :
        usage === 'quote' ? 'text-white/40 text-[11px] font-light italic leading-relaxed' :
        'text-sm font-light text-white/70';
      return <div className={`${usageClass} ${className}`}>{text}</div>;
    }
    case 'Divider': {
      return <div className="w-full h-px bg-white/5" />;
    }
    case 'Spacer': {
      const h = rawProps?.h ?? 8;
      return <div style={{ height: `${h}px` }} />;
    }
    case 'Button': {
      const label = resolveText(model, rawProps?.label);
      const variant = rawProps?.variant ?? 'ghost';
      const disabledPath = rawProps?.disabledPath as string | undefined;
      const disabled = disabledPath ? Boolean(getByPath(model, disabledPath)) : false;
      const action = rawProps?.action;
      const onClick = () => {
        if (!action?.name) return;
        send(action.name, action.payload);
      };

      const cls =
        variant === 'primary'
          ? 'w-full bg-white text-black text-xs font-semibold py-4.5 rounded-2xl active:scale-[0.97] transition-all flex items-center justify-center gap-2'
          : variant === 'pill'
            ? 'w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all shadow-xl'
            : 'w-full bg-white/[0.03] text-white/30 text-[9px] mono uppercase tracking-widest py-3.5 rounded-2xl border border-white/5 hover:bg-white/[0.06] transition-all';

      return (
        <button onClick={onClick} disabled={disabled} className={`${cls} ${disabled ? 'opacity-20 pointer-events-none' : ''}`}>
          {label}
        </button>
      );
    }

    // --- Nightfall custom catalog ---
    case 'NightfallTicket': {
      return <NightfallTicket surfaceId={surfaceId} model={model} props={rawProps} onAction={send} />;
    }
    case 'CoverHero': {
      return <CoverHero model={model} props={rawProps} onAction={send} />;
    }
    case 'GalleryWall': {
      return <GalleryWall model={model} props={rawProps} onAction={send} />;
    }
    case 'PromptBar': {
      return <PromptBar model={model} props={rawProps} onAction={send} />;
    }
    case 'ChoiceList': {
      return <ChoiceList model={model} props={rawProps} onAction={send} />;
    }
    case 'CandidateShelf': {
      return <CandidateShelf model={model} props={rawProps} onAction={send} />;
    }
    case 'WhisperWall': {
      return <WhisperWall model={model} props={rawProps} onAction={send} />;
    }
    case 'WhisperComposer': {
      return <WhisperComposer model={model} props={rawProps} onAction={send} />;
    }
    case 'PocketPanel': {
      return <PocketPanel model={model} props={rawProps} onAction={send} />;
    }
    case 'RadioStrip': {
      return <RadioStrip model={model} props={rawProps} onAction={send} />;
    }
    case 'SkyStats': {
      return <SkyStats model={model} props={rawProps} onAction={send} />;
    }
    case 'VeilCollagePanel': {
      return <VeilCollagePanel model={model} props={rawProps} onAction={send} />;
    }
    case 'FootprintsPanel': {
      return <FootprintsPanel model={model} props={rawProps} onAction={send} />;
    }

    default:
      // Unknown component type: fail closed.
      return (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-200/60 text-[10px] mono">
          Unsupported component: {type}
        </div>
      );
  }
};

/* ---------------------------
   Custom components (catalog)
----------------------------*/

function hashCode(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function textureFromSeed(seed: string) {
  const safe = seed || 'nightfall';
  const h = hashCode(safe);
  const hue = h % 360;
  const hue2 = (hue + 42) % 360;
  const hue3 = (hue + 210) % 360;
  return [
    `radial-gradient(120% 140% at 15% 10%, hsla(${hue2}, 38%, 58%, 0.22), transparent 60%)`,
    `radial-gradient(110% 120% at 80% 70%, hsla(${hue3}, 32%, 48%, 0.18), transparent 55%)`,
    `linear-gradient(165deg, rgba(8,8,12,0.98), rgba(2,2,4,0.95))`
  ].join(', ');
}

function resolveImageStyle(imageRef?: string, fallbackSeed = 'nightfall') {
  const ref = String(imageRef ?? '').trim();
  if (!ref) {
    return { backgroundImage: textureFromSeed(fallbackSeed) };
  }
  if (ref.startsWith('http') || ref.startsWith('data:')) {
    return { backgroundImage: `url("${ref}")`, backgroundSize: 'cover', backgroundPosition: 'center' as const };
  }
  if (ref.startsWith('nf://photo/')) {
    const photoRef = ref.replace('nf://photo/', '');
    if (!photoRef) {
      return { backgroundImage: textureFromSeed(fallbackSeed) };
    }
    const apiBase = (import.meta as any).env?.VITE_NIGHTFALL_API ?? 'http://localhost:4000';
    const url = `${apiBase.replace(/\/$/, '')}/api/places/photo?ref=${encodeURIComponent(photoRef)}&maxw=900`;
    return { backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' as const };
  }
  if (ref.startsWith('nf://')) {
    const parts = ref.split('/');
    const seed = parts[parts.length - 1] || fallbackSeed;
    return { backgroundImage: textureFromSeed(seed) };
  }
  return { backgroundImage: textureFromSeed(ref) };
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="w-full max-w-md mx-auto py-10 px-6 rounded-[2rem] border border-white/5 bg-white/[0.02] text-center">
      <div className="text-sm font-light text-white/50">{title}</div>
      {subtitle ? <div className="text-[10px] mono uppercase tracking-[0.35em] text-white/15 mt-2">{subtitle}</div> : null}
    </div>
  );
}

function NightfallTicket({ model, props, onAction }: { surfaceId: string; model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const bundlePath = props?.bundlePath ?? '/bundle';
  const bundle = getByPath(model, bundlePath) ?? {};
  const uiPath = props?.uiPath ?? '/ui';
  const ui = getByPath(model, uiPath) ?? {};
  const activePlan = (ui.active_plan ?? 'primary') as 'primary' | 'plan_b';

  const primary = bundle.primary_ending ?? {};
  const planB = bundle.plan_b ?? {};
  const data = activePlan === 'primary' ? primary : planB;
  const mediaPack = bundle.media_pack ?? {};
  const fragmentRef = mediaPack.fragment_ref ?? mediaPack.cover_ref;
  const stampRef = mediaPack.stamp_ref ?? mediaPack.texture_ref;

  const checklist: string[] = Array.isArray(data.checklist) ? data.checklist.slice(0, 5) : [];
  const riskFlags: string[] = Array.isArray(data.risk_flags) ? data.risk_flags.slice(0, 2) : [];
  const arrivalLines: string[] = Array.isArray((data.payload ?? {}).arrival_glance_lines)
    ? (data.payload as any).arrival_glance_lines.slice(0, 3)
    : [];

  const getActionIcon = () => {
    const a = data.action ?? primary.action;
    switch (a) {
      case 'PLAY': return <Play size={16} fill="currentColor" />;
      case 'START_FOCUS': return <Lamp size={16} />;
      default: return <Navigation size={16} />;
    }
  };

  const doPrimary = () => {
    const actionData = data.action ?? primary.action;
    const payload = data.payload ?? primary.payload ?? {};
    
    // 根据 action 类型执行不同操作
    if (typeof actionData === 'object' && actionData !== null) {
      const actionType = actionData.type ?? actionData;
      const actionPayload = actionData.payload ?? payload;
      
      switch (actionType) {
        case 'NAVIGATE': {
          const { lat, lng, name, address } = actionPayload;
          if (lat && lng) {
            const query = name ? encodeURIComponent(name) : `${lat},${lng}`;
            const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
            window.open(url, '_blank');
            recordPlaceVisit();
          }
          break;
        }
        case 'START_ROUTE': {
          const { lat, lng, name } = actionPayload;
          if (lat && lng) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            window.open(url, '_blank');
            recordPlaceVisit();
          }
          break;
        }
        case 'PLAY': {
          // 触发播放动作
          onAction('RADIO_PLAY', { track_id: actionPayload.track_id });
          break;
        }
        case 'START_FOCUS': {
          onAction('ENTER_FOCUS_MODE', { duration: actionPayload.duration ?? 25 });
          break;
        }
        default:
          console.log('Executing action:', actionType, actionPayload);
          onAction('EXECUTE_OUTCOME', { action: actionType, payload: actionPayload });
      }
    } else if (typeof actionData === 'string') {
      // 字符串类型的 action
      console.log('String action:', actionData, 'payload:', payload);
      switch (actionData) {
        case 'NAVIGATE': {
          const { lat, lng, name } = payload;
          if (lat && lng) {
            const query = name ? encodeURIComponent(name) : `${lat},${lng}`;
            const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
            window.open(url, '_blank');
            recordPlaceVisit();
          } else {
            console.warn('NAVIGATE action missing lat/lng:', payload);
            // Fallback: 如果没有坐标但有名称，仍然尝试搜索
            if (name) {
              const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
              window.open(url, '_blank');
              recordPlaceVisit();
            }
          }
          break;
        }
        case 'START_ROUTE': {
          const { lat, lng, name } = payload;
          if (lat && lng) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            window.open(url, '_blank');
            recordPlaceVisit();
          } else if (name) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name)}`;
            window.open(url, '_blank');
            recordPlaceVisit();
          }
          break;
        }
        case 'PLAY': {
          onAction('RADIO_PLAY', { track_id: payload.track_id });
          break;
        }
        case 'START_FOCUS': {
          onAction('ENTER_FOCUS_MODE', { duration: payload.duration ?? 25 });
          break;
        }
        default:
          onAction('EXECUTE_OUTCOME', { action: actionData, payload });
      }
    }
  };

  const togglePlan = () => {
    onAction('SWITCH_PLAN', { plan: activePlan === 'primary' ? 'plan_b' : 'primary' });
  };

  const save = () => {
    // 保存到 localStorage
    const savedTicket = saveTicketToPocket(bundle);
    console.log('Ticket saved:', savedTicket);
    // 同时通知后端（如果需要）
    onAction('SAVE_TICKET', { bundle, ticketId: savedTicket.id });
  };

  return (
    <div className="w-full max-w-[320px] mx-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-700">
      <div className="relative bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-2xl">
        <div className="p-7 pb-6 border-b border-dashed border-white/10 relative">
          <div className="absolute -left-3 -bottom-3 w-6 h-6 bg-[#050505] rounded-full border border-white/10"></div>
          <div className="absolute -right-3 -bottom-3 w-6 h-6 bg-[#050505] rounded-full border border-white/10"></div>
          <div className="absolute right-6 top-6 w-16 h-16 rounded-[1.2rem] nf-grade nf-fragment" style={resolveImageStyle(fragmentRef, data.title ?? primary.title ?? 'fragment')} />

          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2 text-[8px] mono uppercase tracking-[0.2em] text-white/30">
              <Ticket size={10} />
              <span>{activePlan === 'primary' ? 'Outcome' : 'Plan B'}</span>
            </div>
            <button onClick={save} className="text-white/20 hover:text-white/50 transition-all">
              <Bookmark size={16} />
            </button>
          </div>

          <h1 className="text-3xl font-light italic text-white mb-3 tracking-tight leading-tight">{data.title ?? primary.title ?? 'Untitled'}</h1>
          <p className="text-white/40 text-[11px] font-light italic leading-relaxed">"{data.reason ?? primary.reason ?? ''}"</p>
        </div>

        <div className="p-7 pt-9 space-y-7">
          <div className="space-y-4">
            <span className="text-[8px] mono uppercase tracking-[0.3em] text-white/10 block">Gallery Note</span>
            {checklist.map((item: string, i: number) => (
              <div key={i} className="flex items-center gap-3 text-[11px] text-white/30">
                <div className="w-0.5 h-0.5 rounded-full bg-white/20" />
                <span className="font-light">{item}</span>
              </div>
            ))}
          </div>

          {riskFlags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {riskFlags.map((rf, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[8px] mono uppercase tracking-widest text-white/20">
                  {rf.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {arrivalLines.length > 0 && (
            <div className="space-y-2 pt-3">
              <span className="text-[8px] mono uppercase tracking-[0.3em] text-white/10 block">Last 300m</span>
              {arrivalLines.map((line, i) => (
                <div key={i} className="flex items-center gap-3 text-[11px] text-white/25">
                  <div className="w-0.5 h-0.5 rounded-full bg-white/20" />
                  <span className="font-light">{line}</span>
                </div>
              ))}
            </div>
          )}

          {stampRef && (
            <div className="pt-1 flex justify-end">
              <div className="w-12 h-12 rounded-full nf-grade nf-stamp" style={resolveImageStyle(stampRef, data.title ?? primary.title ?? 'stamp')} />
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button onClick={doPrimary} className="w-full bg-white text-black text-xs font-semibold py-4.5 rounded-2xl active:scale-[0.97] transition-all flex items-center justify-center gap-2">
              {getActionIcon()}
              <span>{data.action_label ?? primary.action_label ?? 'Execute'}</span>
            </button>
            <button onClick={togglePlan} className="w-full bg-white/[0.03] text-white/30 text-[9px] mono uppercase tracking-widest py-3.5 rounded-2xl border border-white/5">
              {activePlan === 'primary' ? 'Alternate' : 'Primary'}
            </button>
          </div>
        </div>

        <div className="px-7 py-5 bg-white/[0.02] border-t border-white/5 flex justify-between items-center text-[9px] mono text-white/20">
          <span className="tracking-widest">{primary.expires_at ?? ''}</span>
          <div className="flex gap-1">
            {Array.isArray(bundle.ambient_tokens) ? bundle.ambient_tokens.slice(0, 1).map((t: string) => <span key={t}>#{t}</span>) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoverHero({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const itemPath = props?.itemPath ?? '/discover/hero';
  const item = getByPath(model, itemPath);
  if (!item) return null;
  const selectActionName = props?.selectActionName ?? 'DISCOVER_SELECT';
  const title = item.title ?? 'Untitled';
  const desc = item.desc ?? '';
  const tag = item.tag ?? 'EDITION';
  const imageRef = item.image_ref ?? item.cover_ref;

  return (
    <div className="w-full max-w-xl mx-auto">
      <button
        onClick={() => onAction(selectActionName, { id: item.id, item })}
        className="w-full text-left"
      >
        <div className="relative w-full aspect-[4/5] rounded-[2.5rem] overflow-hidden border border-white/10">
          <div className="absolute inset-0 nf-grade" style={resolveImageStyle(imageRef, title)} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
          <div className="absolute bottom-6 left-6 right-6 space-y-2">
            <div className="text-[9px] mono uppercase tracking-[0.35em] text-white/30">{tag}</div>
            <div className="text-3xl font-light italic text-white/90 leading-tight">{title}</div>
            <div className="text-[11px] text-white/45 font-light leading-relaxed">{desc}</div>
          </div>
        </div>
      </button>
    </div>
  );
}

function GalleryWall({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const itemsPath = props?.itemsPath ?? '/discover/gallery_refs';
  const label = props?.label ?? 'Contact Sheet';
  const raw: any[] = resolveList(model, itemsPath);
  const refs = raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.image_ref ?? item.ref ?? '';
      return '';
    })
    .filter((r) => String(r).trim().length > 0)
    .slice(0, 12);

  if (!refs.length) return null;

  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      <div className="text-[9px] mono uppercase tracking-[0.35em] text-white/15">{label}</div>
      <div className="grid grid-cols-3 gap-3">
        {refs.map((ref, idx) => (
          <div key={idx} className="relative aspect-square rounded-[1.2rem] overflow-hidden border border-white/10">
            <div className="absolute inset-0 nf-grade" style={resolveImageStyle(ref, `${label}_${idx}`)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptBar({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const placeholder = props?.placeholder ?? 'I need a quiet place...';
  const submitAction = props?.submitAction ?? { name: 'TONIGHT_SUBMIT_ORDER' };
  const [input, setInput] = React.useState('');

  const disabled = !input.trim();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onAction(submitAction.name, { text: input.trim(), payload: submitAction.payload ?? {} });
  };

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-5 px-6 pr-14 text-white placeholder-white/10 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-light text-sm"
      />
      <button
        type="submit"
        disabled={disabled}
        className={`absolute right-4 top-1/2 -translate-y-1/2 transition-all ${disabled ? 'opacity-10 scale-90' : 'opacity-100 text-white active:scale-110'}`}
      >
        <Send size={16} />
      </button>
    </form>
  );
}

function ChoiceList({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const itemsPath = props?.itemsPath ?? '/tonight/choices';
  const items: string[] = resolveList(model, itemsPath);
  const chooseActionName = props?.chooseActionName ?? 'TONIGHT_SELECT_CHOICE';
  const loadingPath = props?.loadingPath ?? '/ui/loading';

  const loading = Boolean(getByPath(model, loadingPath));

  return (
    <div className="grid grid-cols-1 gap-2.5 pt-2">
      {items.map((opt, idx) => (
        <button
          key={idx}
          onClick={() => onAction(chooseActionName, { choice: opt })}
          disabled={loading}
          className="flex items-center justify-between px-6 py-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 transition-all text-left"
        >
          <span className="text-sm font-light text-white/60">{opt}</span>
          {loading ? <Loader2 size={14} className="animate-spin text-white/20" /> : <ChevronRight size={14} className="text-white/10" />}
        </button>
      ))}
    </div>
  );
}

function CandidateShelf({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const itemsPath = props?.itemsPath ?? '/discover/candidates';
  const skipFirst = Boolean(props?.skipFirst);
  const rawItems: any[] = resolveList(model, itemsPath);
  const items: any[] = (skipFirst ? rawItems.slice(1) : rawItems).slice(0, 18);
  const selectActionName = props?.selectActionName ?? 'DISCOVER_SELECT';
  const showImages = items.some((it) => Boolean(it?.image_ref));

  if (!items.length) {
    return <EmptyState title="No candidates yet" subtitle="Try another prompt" />;
  }

  if (showImages) {
    const trimmed = items.slice(0, 12);
    return (
      <div className="w-full max-w-xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {trimmed.map((it, idx) => {
            const title = it.title ?? 'Untitled';
            const tag = it.tag ?? 'EDITION';
            const desc = it.desc ?? '';
            return (
              <button
                key={idx}
                onClick={() => onAction(selectActionName, { id: it.id, item: it })}
                className="text-left group"
              >
                <div className="relative aspect-square rounded-[1.4rem] overflow-hidden border border-white/10">
                  <div className="absolute inset-0 nf-grade" style={resolveImageStyle(it.image_ref, title)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="text-[11px] font-light italic text-white/85 leading-tight">{title}</div>
                  </div>
                </div>
                <div className="mt-2 text-[8px] mono uppercase tracking-[0.35em] text-white/20">{tag}</div>
                {desc ? <div className="text-[10px] text-white/30 font-light leading-snug mt-1">{desc}</div> : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="grid grid-cols-1 gap-4">
        {items.map((it, idx) => (
          <button
            key={idx}
            onClick={() => onAction(selectActionName, { id: it.id, item: it })}
            className="text-left p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] hover:bg-white/[0.06] transition-all"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] mono uppercase tracking-[0.3em] text-white/20">{it.tag ?? 'EDITION'}</span>
              <span className="text-[9px] mono text-white/10">{it.id ?? `C${idx+1}`}</span>
            </div>
            <div className="text-xl font-light italic text-white/85 leading-tight">{it.title ?? 'Untitled'}</div>
            <div className="text-[11px] text-white/30 font-light mt-2 leading-relaxed">{it.desc ?? ''}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function WhisperWall({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const itemsPath = props?.itemsPath ?? '/whispers/items';
  const modelNotes: any[] = resolveList(model, itemsPath);
  const symbolPath = props?.symbolPath ?? '/whispers/symbols';
  
  // 优先从 localStorage 读取，如果没有则使用 model 中的数据
  const localWhispers = getWhispers();
  const notes = localWhispers.length > 0 
    ? localWhispers.map(w => ({
        id: w.id,
        symbol: w.symbol,
        content: w.text,
        timestamp: new Date(w.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      }))
    : modelNotes.slice(0, 24);

  return (
    <div className="w-full bg-black/50 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-2xl">
      <div className="p-7 border-b border-white/5 flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-3xl font-light italic text-white/90">Hallway</h2>
          <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">Anonymous residue</p>
        </div>
        <Sparkles size={14} className="text-white/15" />
      </div>

      <div className="p-7 grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar">
        {notes.length === 0 ? (
          <EmptyState title="No whispers yet" subtitle="Leave a trace below" />
        ) : (
          notes.map((n, idx) => (
            <div key={idx} className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
              <div
                className="absolute right-4 top-4 w-10 h-10 rounded-xl nf-grade nf-texture opacity-60 pointer-events-none"
                style={resolveImageStyle(`nf://texture/${n.id ?? n.symbol ?? idx}`, String(n.symbol ?? idx))}
              />
              <div className="flex justify-between items-start">
                <span className="text-[8px] mono uppercase tracking-[0.3em] text-white/15">{n.symbol ?? '•'}</span>
                <span className="text-[8px] mono text-white/10">{n.timestamp ?? ''}</span>
              </div>
              <div className="text-[12px] text-white/35 font-light mt-2 leading-relaxed">{n.content ?? ''}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WhisperComposer({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const submitActionName = props?.submitActionName ?? 'WHISPER_SUBMIT';
  const [text, setText] = React.useState('');
  const disabled = !text.trim();

  const symbols = ['◇', '○', '△', '□', '◈', '◎', '▽', '◆'];
  const randomSymbol = () => symbols[Math.floor(Math.random() * symbols.length)];

  const submit = () => {
    if (!text.trim()) return;
    // 保存到 localStorage
    const symbol = randomSymbol();
    const savedWhisper = saveWhisper(text.trim(), symbol);
    console.log('Whisper saved:', savedWhisper);
    // 同时通知后端
    onAction(submitActionName, { content: text.trim(), symbol, whisperId: savedWhisper.id });
    setText('');
  };

  return (
    <div className="mt-4 w-full">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a trace..."
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-2xl py-4 px-5 text-white placeholder-white/10 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-light text-sm"
        />
        <button
          onClick={submit}
          disabled={disabled}
          className={`px-5 rounded-2xl border border-white/10 bg-white/[0.03] ${disabled ? 'opacity-20' : 'hover:bg-white/[0.06]'}`}
        >
          <Send size={14} className="text-white/30" />
        </button>
      </div>
    </div>
  );
}

function PocketPanel({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const modelItems: any[] = resolveList(model, props?.ticketsPath ?? '/pocket/tickets');
  const pulse: number[] = resolveList(model, props?.pulsePath ?? '/pocket/pulse');
  
  // 优先从 localStorage 读取票根列表
  const localTickets = getPocketTickets();
  const items: any[] = localTickets.length > 0 
    ? localTickets.map(t => ({
        id: t.id,
        title: t.title,
        type: 'OUTCOME',
        date: new Date(t.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        image_ref: t.bundle?.media_pack?.cover_ref || t.bundle?.media_pack?.fragment_ref || '',
        bundle: t.bundle
      }))
    : modelItems;

  return (
    <div className="w-full max-w-xl mx-auto space-y-8">
      <div className="text-center space-y-2 pt-6">
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">Pocket</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">Your quiet archive</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onAction('OPEN_VEIL')} className="py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">Veil</button>
        <button onClick={() => onAction('OPEN_FOOTPRINTS')} className="py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">Footprints</button>
      </div>

      <div className="p-7 bg-white/[0.03] border border-white/5 rounded-[2.5rem] backdrop-blur-2xl">
        <span className="text-[9px] mono uppercase tracking-[0.3em] text-white/15 block mb-4">Rhythm</span>
        <div className="flex items-end justify-between gap-1 h-24">
          {pulse.slice(0, 14).map((v, i) => (
            <div key={i} className="w-full bg-white/10 rounded-full" style={{ height: `${Math.max(6, v * 90)}px` }} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <span className="text-[9px] mono uppercase tracking-[0.3em] text-white/15 block">Tickets</span>
        <div className="grid grid-cols-1 gap-3">
          {items.length === 0 ? (
            <EmptyState title="No tickets yet" subtitle="Save a ticket from Tonight" />
          ) : (
            items.slice(0, 12).map((t, i) => {
              const imageRef = t.image_ref ?? t.cover_ref ?? '';
              return (
                <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem]">
                  <div className="flex gap-4">
                    {imageRef ? (
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 nf-grade nf-fragment" style={resolveImageStyle(imageRef, t.title ?? 'ticket')} />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] mono uppercase tracking-[0.3em] text-white/15">{t.type ?? 'OUTCOME'}</span>
                        <span className="text-[9px] mono text-white/10">{t.date ?? ''}</span>
                      </div>
                      <div className="text-xl font-light italic text-white/80 mt-2">{t.title ?? ''}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function RadioStrip({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const narrative = resolveText(model, { path: props?.narrativePath ?? '/radio/narrative' });
  const playing = Boolean(getByPath(model, props?.playingPath ?? '/radio/playing'));
  const trackId = resolveText(model, { path: props?.trackIdPath ?? '/radio/track_id' });
  const coverRef = resolveText(model, { path: props?.coverPath ?? '/radio/cover_ref' });

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-40">
      <div className="bg-black/55 border border-white/10 rounded-full px-6 py-4 backdrop-blur-2xl shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {coverRef ? (
            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 nf-grade" style={resolveImageStyle(coverRef, trackId || 'radio')} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10" />
          )}
          <div className="min-w-0">
            <div className="text-[9px] mono uppercase tracking-[0.3em] text-white/15">Radio</div>
            <div className="text-[12px] text-white/40 font-light truncate">{narrative || '...'}</div>
          </div>
        </div>
        <button
          onClick={() => onAction('RADIO_TOGGLE', { track_id: trackId })}
          className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center hover:bg-white/[0.10] transition-all"
        >
          {playing ? <div className="w-3 h-3 bg-white/30 rounded-sm" /> : <Play size={16} className="text-white/30" />}
        </button>
      </div>
    </div>
  );
}

function SkyStats({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const gridId = resolveText(model, { path: props?.gridIdPath ?? '/context/location/grid_id' });
  const pressure = resolveText(model, { path: props?.pressurePath ?? '/sky/pressure' }) || 'Moderate';
  const ambient = resolveText(model, { path: props?.ambientPath ?? '/sky/ambient' }) || '14 Active';
  const backdropRef = resolveText(model, { path: props?.backdropPath ?? '/sky/backdrop_ref' }) || '';
  const stealth = Boolean(getByPath(model, '/context/user_state/stealth'));

  return (
    <div className="relative w-full flex flex-col items-center justify-center min-h-[60vh] px-4 py-8 overflow-hidden">
      {backdropRef ? (
        <div className="absolute inset-0 opacity-60">
          <div className="absolute inset-0 nf-grade nf-texture" style={resolveImageStyle(backdropRef, gridId || 'sky')} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/60" />
        </div>
      ) : null}
      <div className="text-center space-y-12 animate-in fade-in duration-1000 w-full max-w-xs">
        <div className="space-y-1">
          <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">Atmosphere</h1>
          <p className="text-[10px] mono text-white/20 tracking-[0.4em] uppercase">Node {gridId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] backdrop-blur-md">
            <Activity size={16} className="text-emerald-500/40 mb-3 mx-auto" />
            <span className="text-[10px] mono text-white/20 block mb-1 uppercase tracking-widest">Pressure</span>
            <span className="text-lg font-light text-white/80">{pressure}</span>
          </div>
          <div className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] backdrop-blur-md">
            <UserIcon size={16} className="text-white/20 mb-3 mx-auto" />
            <span className="text-[10px] mono text-white/20 block mb-1 uppercase tracking-widest">Ambient</span>
            <span className="text-lg font-light text-white/80">{ambient}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onAction('LIGHT_ON')}
            disabled={stealth}
            className={`w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] transition-all shadow-xl ${stealth ? 'text-white/10 cursor-not-allowed' : 'text-white/30 hover:text-white'}`}
          >
            Light On
          </button>
          <button
            onClick={() => onAction('OPEN_WHISPERS')}
            className="w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all shadow-xl"
          >
            Entrance
          </button>
        </div>
      </div>
    </div>
  );
}

function VeilCollagePanel({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const collage = getByPath(model, props?.collagePath ?? '/veil/collage') ?? {};
  const tiles = collage.tiles ?? [];
  const caption = collage.caption ?? '';
  const coverRef = collage.cover_ref ?? '';
  return (
    <div className="w-full max-w-xl mx-auto space-y-8 pt-8">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">Veil</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">Moon screensaver</p>
      </div>
      <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-2xl overflow-hidden">
        <div className="aspect-[16/10] w-full relative overflow-hidden">
          <div className="absolute inset-0 nf-grade nf-texture" style={resolveImageStyle(coverRef, collage.collage_id ?? 'veil')} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
          {Array.isArray(tiles) && tiles.slice(0, 6).map((t: any, i: number) => (
            <div key={i} className="absolute inset-0" style={{ opacity: 0 }} />
          ))}
          <div className="absolute inset-0 pointer-events-none" style={{ backdropFilter: 'blur(0px)' }} />
        </div>
        <div className="px-7 py-6 border-t border-white/5">
          <div className="text-white/40 text-[11px] font-light italic">{caption}</div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button onClick={() => onAction('VEIL_FEEDBACK', { vote: 'like' })} className="py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">Like</button>
            <button onClick={() => onAction('VEIL_FEEDBACK', { vote: 'dislike' })} className="py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">No</button>
            <button onClick={() => onAction('SAVE_VEIL_FRAME', { collage_id: collage.collage_id })} className="py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">Pocket</button>
          </div>
        </div>
      </div>
      <button onClick={() => onAction('BACK_TO_POCKET')} className="w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all">← Back</button>
    </div>
  );
}

function FootprintsPanel({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const modelFp = getByPath(model, props?.fpPath ?? '/fp') ?? {};
  const modelSummary = modelFp.summary ?? {};
  const weekly = modelFp.weekly_text ?? '';
  
  // 优先从 localStorage 读取统计数据
  const localFootprints = getFootprints();
  const summary = {
    focus_min: localFootprints.focusMinutes || modelSummary.focus_min || 0,
    lights: localFootprints.ticketsGenerated || modelSummary.lights || 0,
    whispers: localFootprints.whispersWritten || modelSummary.whispers || 0,
    places: localFootprints.placesVisited || modelSummary.places || 0,
  };
  return (
    <div className="w-full max-w-xl mx-auto space-y-8 pt-8">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">Footprints</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">No ranks. Just echoes.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem]">
          <div className="text-[10px] mono uppercase tracking-widest text-white/15">Focus</div>
          <div className="text-2xl font-light italic text-white/80 mt-2">{summary.focus_min ?? 0} min</div>
        </div>
        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem]">
          <div className="text-[10px] mono uppercase tracking-widest text-white/15">Lights</div>
          <div className="text-2xl font-light italic text-white/80 mt-2">{summary.lights ?? 0}</div>
        </div>
      </div>
      <div className="p-7 bg-white/[0.02] border border-white/5 rounded-[2.5rem]">
        <div className="text-[9px] mono uppercase tracking-[0.3em] text-white/15 mb-3">Weekly Echo</div>
        <div className="text-white/40 text-[11px] font-light italic leading-relaxed whitespace-pre-line">{weekly}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onAction('EXPORT_POCKET', { range: 'weekly' })} className="py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">Archive</button>
        <button onClick={() => onAction('BACK_TO_POCKET')} className="py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">Back</button>
      </div>
    </div>
  );
}

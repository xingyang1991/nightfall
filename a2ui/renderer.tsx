import React, { useMemo } from 'react';
import { useA2UIRuntime } from './store';
import { A2UIAction, A2UIComponent } from './messages';
import { getByPath, resolveList, resolveNumber, resolveText } from './bindings';
import { Bookmark, ChevronRight, Loader2, Navigation, Play, Lamp, Ticket, ArrowDown, Send, Sparkles, Activity, User as UserIcon, MapPin, ExternalLink, Camera, Heart, X } from 'lucide-react';
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
    case 'SceneGrid': {
      return <SceneGrid model={model} props={rawProps} onAction={send} />;
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
    case 'SkyStats': {
      return <SkyStats model={model} props={rawProps} onAction={send} />;
    }
    case 'SkyAtmosphere': {
      return <SkyAtmosphere model={model} props={rawProps} onAction={send} />;
    }
    case 'VeilMomentStream': {
      return <VeilMomentStream model={model} props={rawProps} onAction={send} />;
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

function getApiBase(): string {
  const envBase = (import.meta as any).env?.VITE_NIGHTFALL_API;
  if (typeof envBase === 'string') return envBase;
  if (typeof window === 'undefined') return '';
  return window.location.hostname === 'localhost' ? 'http://localhost:4000' : '';
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

function buildAuthHeaders(extra: Record<string, string> = {}) {
  const token = getAuthToken();
  return token
    ? { ...extra, Authorization: `Bearer ${token}` }
    : extra;
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
          // Radio 功能已移除
          console.log('PLAY action - Radio feature removed');
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
          // Radio 功能已移除
          console.log('PLAY action - Radio feature removed');
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
    const orderText = getByPath(model, '/tonight/order_text');
    onAction('SAVE_TICKET', { bundle, ticketId: savedTicket.id, user_query: orderText ?? '' });
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
  const placeholder = props?.placeholder ?? '例如：找个安静的地方工作...';
  const submitAction = props?.submitAction ?? { name: 'TONIGHT_SUBMIT_ORDER' };
  const presetText = resolveText(model, { path: props?.valuePath ?? '/tonight/order_text' }) || '';
  const [input, setInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const lastPresetRef = React.useRef('');

  const disabled = !input.trim() || isSubmitting;

  // 获取用户位置
  const requestLocation = React.useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('success');
      },
      (err) => {
        console.warn('[Location] Failed:', err.message);
        setLocationStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  React.useEffect(() => {
    if (!presetText) return;
    setInput((prev) => {
      if (!prev || prev === lastPresetRef.current) {
        lastPresetRef.current = presetText;
        return presetText;
      }
      return prev;
    });
  }, [presetText]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // 传递用户位置到后端
      onAction(submitAction.name, { 
        text: input.trim(), 
        payload: { 
          ...submitAction.payload,
          userLocation: userLocation || undefined
        } 
      });
    } finally {
      // 延迟重置，让 loading 状态保持一段时间
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* 定位状态提示 */}
      <div className="flex items-center justify-center gap-2 text-[10px]">
        {locationStatus === 'idle' && (
          <button
            onClick={requestLocation}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/50 transition-colors"
          >
            <MapPin size={10} />
            点击定位 · 用于推荐附近地点
          </button>
        )}
        {locationStatus === 'loading' && (
          <span className="flex items-center gap-1.5 text-white/30">
            <Loader2 size={10} className="animate-spin" />
            正在获取位置...
          </span>
        )}
        {locationStatus === 'success' && userLocation && (
          <span className="flex items-center gap-1.5 text-emerald-400/60">
            <MapPin size={10} />
            已定位 · 将搜索附近地点
          </span>
        )}
        {locationStatus === 'error' && (
          <button 
            onClick={requestLocation}
            className="flex items-center gap-1.5 text-amber-400/60 hover:text-amber-400/80 transition-colors"
          >
            <MapPin size={10} />
            未定位 · 点击重试
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="relative w-full">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-5 px-6 pr-14 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-light text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled}
          className={`absolute right-4 top-1/2 -translate-y-1/2 transition-all ${disabled ? 'opacity-10 scale-90' : 'opacity-100 text-white active:scale-110'}`}
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}

function SceneGrid({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const itemsPath = props?.itemsPath ?? '/discover/scenes';
  const scenes: any[] = resolveList(model, itemsPath);

  if (!scenes.length) {
    return <EmptyState title="暂无可用场景" subtitle="稍后再来看看" />;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {scenes.map((scene) => (
          <SceneCard key={scene.id} scene={scene} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

function SceneCard({ scene, onAction }: { scene: any; onAction: (name: string, payload?: any) => void }) {
  const [isActivating, setIsActivating] = React.useState(false);
  const tags: string[] = Array.isArray(scene?.tags) ? scene.tags : [];
  const gradient = String(scene?.gradient ?? 'from-slate-900/80 to-zinc-900/90');
  const imageRef = String(scene?.image_ref ?? '').trim();

  const onClick = () => {
    if (isActivating) return;
    setIsActivating(true);
    onAction('SCENE_ACTIVATE', {
      preset_query: scene?.preset_query,
      skill_id: scene?.skill_id,
      scene_id: scene?.id
    });
  };

  return (
    <button
      onClick={onClick}
      className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden group transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] ${isActivating ? 'scene-transitioning' : ''}`}
    >
      <div className="absolute inset-0 nf-grade" style={resolveImageStyle(imageRef, String(scene?.id ?? 'scene'))} />
      <div className={`absolute inset-0 bg-gradient-to-t ${gradient}`} />

      <div className="absolute inset-0 p-6 flex flex-col justify-end text-left">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{scene?.icon ?? '✦'}</span>
          <h3 className="text-xl font-semibold text-white">{scene?.title ?? '未命名场景'}</h3>
        </div>
        <p className="text-sm text-white/70 mb-3">{scene?.subtitle ?? ''}</p>
        <div className="flex gap-2 flex-wrap">
          {tags.map((tag) => (
            <span key={tag} className="px-2 py-1 text-xs bg-white/10 rounded-full text-white/80">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs text-white">
          点击启动 →
        </span>
      </div>
    </button>
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
    return <EmptyState title="还没有候选" subtitle="试试其他描述" />;
  }

  if (showImages) {
    const trimmed = items.slice(0, 12);
    return (
      <div className="w-full max-w-xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {trimmed.map((it, idx) => {
            const title = it.title ?? '未命名';
            const tag = it.tag ?? 'EDITION';
            const desc = it.desc ?? '';
            const source = String(it.image_source ?? '').toLowerCase();
            const sourceLabel =
              source === 'amap' ? '实景' :
              source === 'unsplash' ? '氛围' :
              source === 'default' ? '默认' :
              source === 'google' ? '实景' :
              '';
            const sourceTone =
              source === 'amap' || source === 'google' ? 'bg-emerald-500/80 text-white' :
              source === 'unsplash' ? 'bg-slate-800/70 text-white/80' :
              'bg-white/10 text-white/60';
            return (
              <button
                key={idx}
                onClick={() => onAction(selectActionName, { id: it.id, item: it })}
                className="text-left group"
              >
                <div className="relative aspect-square rounded-[1.4rem] overflow-hidden border border-white/10">
                  <div className="absolute inset-0 nf-grade" style={resolveImageStyle(it.image_ref, title)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  {sourceLabel ? (
                    <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-[9px] mono uppercase tracking-[0.2em] ${sourceTone}`}>
                      {sourceLabel}
                    </div>
                  ) : null}
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
          <h2 className="text-3xl font-light italic text-white/90">走廊</h2>
          <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">匿名的痕迹</p>
        </div>
        <Sparkles size={14} className="text-white/15" />
      </div>

      <div className="p-7 grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar">
        {notes.length === 0 ? (
          <EmptyState title="还没有人说话" subtitle="在下方留下你的痕迹" />
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
          placeholder="留下一句话..."
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
  const [remoteTickets, setRemoteTickets] = React.useState<any[]>([]);
  const [archive, setArchive] = React.useState<any | null>(null);
  const [archiveLoading, setArchiveLoading] = React.useState(false);
  const [archiveShareLoading, setArchiveShareLoading] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState('');
  const [editingTicketId, setEditingTicketId] = React.useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = React.useState<Record<string, string>>({});
  const [ticketSavingId, setTicketSavingId] = React.useState<string | null>(null);
  const fetchedRemoteRef = React.useRef(false);
  const fetchedArchiveRef = React.useRef(false);
  const userId = React.useMemo(() => getOrCreateUserId(), []);
  const apiBase = getApiBase();
  const apiRoot = apiBase.replace(/\/$/, '');

  // 优先从 localStorage 读取票根列表
  const localTickets = getPocketTickets();
  const hasLocal = localTickets.length > 0;

  React.useEffect(() => {
    if (!userId || fetchedRemoteRef.current || hasLocal) return;
    fetchedRemoteRef.current = true;
    fetch(`${apiRoot}/api/tickets?user_id=${encodeURIComponent(userId)}&limit=50`, {
      headers: buildAuthHeaders()
    })
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data?.tickets) ? data.tickets : [];
        const mapped = rows.map((t: any) => {
          const bundle = safeParse(t.bundle_json);
          return {
            id: t.id,
            title: t.place_name || bundle?.primary_ending?.title || t.id,
            type: 'OUTCOME',
            date: t.visit_date || String(t.created_at || '').slice(0, 10),
            image_ref: t.image_ref || bundle?.media_pack?.cover_ref || bundle?.media_pack?.fragment_ref || '',
            bundle,
            memory_note: t.memory_note ?? '',
            is_favorite: Boolean(t.is_favorite),
            remote: true
          };
        });
        setRemoteTickets(mapped);
      })
      .catch(() => {});
  }, [userId, apiBase, hasLocal]);

  React.useEffect(() => {
    if (!userId || fetchedArchiveRef.current) return;
    fetchedArchiveRef.current = true;
    fetch(`${apiRoot}/api/archives?user_id=${encodeURIComponent(userId)}&limit=1`, {
      headers: buildAuthHeaders()
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.archives) ? data.archives : [];
        if (list.length) setArchive(list[0]);
      })
      .catch(() => {});
  }, [userId, apiBase]);

  const items: any[] = localTickets.length > 0 
    ? localTickets.map(t => ({
        id: t.id,
        title: t.title,
        type: 'OUTCOME',
        date: new Date(t.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        image_ref: t.bundle?.media_pack?.cover_ref || t.bundle?.media_pack?.fragment_ref || '',
        bundle: t.bundle,
        remote: false
      }))
    : (remoteTickets.length ? remoteTickets : modelItems);

  const startOfMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: formatDate(start), end: formatDate(end) };
  };

  const updateRemoteTicket = (id: string, patch: { memory_note?: string; is_favorite?: boolean }) => {
    setRemoteTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const saveTicketPatch = async (id: string, patch: { memory_note?: string; is_favorite?: boolean }) => {
    if (!userId || ticketSavingId === id) return;
    setTicketSavingId(id);
    try {
      await fetch(`${apiRoot}/api/tickets/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(patch)
      });
      updateRemoteTicket(id, patch);
    } catch {
      // ignore
    } finally {
      setTicketSavingId(null);
    }
  };

  const generateArchive = async () => {
    if (!userId || archiveLoading) return;
    const period = startOfMonth();
    setArchiveLoading(true);
    setArchiveError('');
    try {
      const res = await fetch(`${apiRoot}/api/archives`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          user_id: userId,
          period: { type: 'month', start: period.start, end: period.end }
        })
      }).then((r) => r.json());
      if (res?.archive) setArchive(res.archive);
    } catch {
      setArchiveError('生成失败，请稍后重试');
    } finally {
      setArchiveLoading(false);
    }
  };

  const ensureShareUrl = async (): Promise<string | null> => {
    if (!archive?.id) return null;
    if (archive?.share?.share_url) return archive.share.share_url;
    const res = await fetch(`${apiRoot}/api/archives/${encodeURIComponent(archive.id)}/share`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' })
    }).then((r) => r.json());
    const shareUrl = res?.share_url;
    if (shareUrl) {
      setArchive((prev: any) => prev ? { ...prev, share: { ...(prev.share ?? {}), share_url: shareUrl, share_code: res?.share_code, is_public: true } } : prev);
      return shareUrl;
    }
    return null;
  };

  const openShare = async (print?: boolean) => {
    if (archiveShareLoading) return;
    setArchiveShareLoading(true);
    try {
      const shareUrl = await ensureShareUrl();
      if (!shareUrl) return;
      const base = apiRoot || window.location.origin;
      const full = shareUrl.startsWith('http') ? shareUrl : `${base}${shareUrl}`;
      const final = print ? `${full}${full.includes('?') ? '&' : '?'}print=1` : full;
      window.open(final, '_blank');
    } catch {
      // ignore
    } finally {
      setArchiveShareLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-8">
      <div className="text-center space-y-2 pt-6">
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">口袋</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">你的安静档案</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onAction('OPEN_VEIL')} className="py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">幕布</button>
        <button onClick={() => onAction('OPEN_FOOTPRINTS')} className="py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">足迹</button>
      </div>

      <div className="p-7 bg-white/[0.03] border border-white/5 rounded-[2.5rem] backdrop-blur-2xl">
        <span className="text-[9px] mono uppercase tracking-[0.3em] text-white/15 block mb-4">节奏</span>
        <div className="flex items-end justify-between gap-1 h-24">
          {pulse.slice(0, 14).map((v, i) => (
            <div key={i} className="w-full bg-white/10 rounded-full" style={{ height: `${Math.max(6, v * 90)}px` }} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <span className="text-[9px] mono uppercase tracking-[0.3em] text-white/15 block">图鉴</span>
        {archive ? (
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden">
            <div className="relative h-36 bg-gradient-to-br from-purple-900/80 to-indigo-900/80">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center px-6">
                  <h2 className="text-2xl font-semibold text-white mb-2">{archive.title}</h2>
                  <p className="text-white/60 text-sm">{archive.period?.start} - {archive.period?.end}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 p-6 border-b border-white/10 text-center">
              <StatItem value={archive.stats?.total_trips ?? 0} label="次出行" />
              <StatItem value={archive.stats?.total_places ?? 0} label="个地点" />
              <StatItem value={`${archive.stats?.total_distance ?? 0}km`} label="总里程" />
              <StatItem value={archive.stats?.night_owl_score ?? 0} label="夜猫指数" />
            </div>
            <div className="p-6">
              <h3 className="text-lg font-medium text-white mb-4">精选瞬间</h3>
              <div className="grid grid-cols-3 gap-3">
                {(archive.featured_tickets ?? []).slice(0, 6).map((t: any) => (
                  <div key={t.ticket_id} className="aspect-square rounded-lg overflow-hidden border border-white/10">
                    {t.image_ref ? (
                      <div className="w-full h-full nf-grade" style={resolveImageStyle(t.image_ref, t.place_name ?? 'ticket')} />
                    ) : (
                      <div className="w-full h-full bg-white/5" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {(archive.footprint ?? []).length ? (
              <div className="px-6 pb-6">
                <h3 className="text-sm font-medium text-white/80 mb-3">足迹地图</h3>
                <FootprintMiniMap footprint={archive.footprint ?? []} />
              </div>
            ) : null}
            <div className="p-6 flex gap-4">
              <button
                onClick={() => openShare(false)}
                disabled={archiveShareLoading}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-medium disabled:opacity-50"
              >
                {archiveShareLoading ? '生成中…' : '分享图鉴'}
              </button>
              <button
                onClick={() => openShare(true)}
                disabled={archiveShareLoading}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white disabled:opacity-50"
              >
                {archiveShareLoading ? '生成中…' : '导出 PDF'}
              </button>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={generateArchive}
                disabled={archiveLoading}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 text-sm disabled:opacity-50"
              >
                {archiveLoading ? '生成中…' : '重新生成'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-light text-white/80">生成本月图鉴</div>
                <div className="text-[11px] text-white/30 mt-1">把票根整理成一份夜行记录</div>
              </div>
              <button
                onClick={generateArchive}
                disabled={archiveLoading}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm disabled:opacity-50"
              >
                {archiveLoading ? '生成中…' : '生成'}
              </button>
            </div>
            {archiveError ? <div className="text-[10px] text-amber-400/70 mt-2">{archiveError}</div> : null}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <span className="text-[9px] mono uppercase tracking-[0.3em] text-white/15 block">票根</span>
        <div className="grid grid-cols-1 gap-3">
          {items.length === 0 ? (
            <EmptyState title="还没有票根" subtitle="从“今晚”保存一张" />
          ) : (
            items.slice(0, 12).map((t, i) => {
              const imageRef = t.image_ref ?? t.cover_ref ?? '';
              const canEdit = Boolean(t.remote && userId);
              const isFavorite = Boolean(t.is_favorite);
              const isEditing = editingTicketId === t.id;
              const draft = noteDrafts[t.id] ?? String(t.memory_note ?? '');
              return (
                <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem]">
                  <div className="flex gap-4">
                    {imageRef ? (
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 nf-grade nf-fragment" style={resolveImageStyle(imageRef, t.title ?? 'ticket')} />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] mono uppercase tracking-[0.3em] text-white/15">{t.type ?? 'OUTCOME'}</span>
                        <div className="flex items-center gap-3">
                          {canEdit ? (
                            <button
                              onClick={() => saveTicketPatch(t.id, { is_favorite: !isFavorite })}
                              className={`text-[10px] mono uppercase tracking-[0.2em] ${isFavorite ? 'text-amber-300/80' : 'text-white/20 hover:text-white/40'} transition`}
                            >
                              ★
                            </button>
                          ) : null}
                          <span className="text-[9px] mono text-white/10">{t.date ?? ''}</span>
                        </div>
                      </div>
                      <div className="text-xl font-light italic text-white/80 mt-2">{t.title ?? ''}</div>
                      {canEdit ? (
                        <div className="mt-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={draft}
                                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                placeholder="写一句备注"
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingTicketId(null);
                                    setNoteDrafts((prev) => ({ ...prev, [t.id]: String(t.memory_note ?? '') }));
                                  }}
                                  className="px-3 py-1.5 text-xs bg-white/5 rounded-lg text-white/40"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={() => {
                                    saveTicketPatch(t.id, { memory_note: draft });
                                    setEditingTicketId(null);
                                  }}
                                  className="px-3 py-1.5 text-xs bg-white/10 rounded-lg text-white/70"
                                  disabled={ticketSavingId === t.id}
                                >
                                  {ticketSavingId === t.id ? '保存中…' : '保存'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingTicketId(t.id);
                                setNoteDrafts((prev) => ({ ...prev, [t.id]: String(t.memory_note ?? '') }));
                              }}
                              className="text-xs text-white/30 hover:text-white/50 transition"
                            >
                              {t.memory_note ? `备注：${t.memory_note}` : '添加备注'}
                            </button>
                          )}
                        </div>
                      ) : null}
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

function StatItem({ value, label }: { value: any; label: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[9px] mono uppercase tracking-[0.2em] text-white/40 mt-1">{label}</div>
    </div>
  );
}

function FootprintMiniMap({ footprint }: { footprint: Array<{ lat: number; lng: number; visit_count: number; place_name: string }> }) {
  const points = Array.isArray(footprint) ? footprint : [];
  const lats = points.map((p) => p.lat).filter((v) => Number.isFinite(v));
  const lngs = points.map((p) => p.lng).filter((v) => Number.isFinite(v));
  if (!lats.length || !lngs.length) {
    return <div className="h-28 rounded-2xl bg-white/[0.04] border border-white/5" />;
  }
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.001, maxLat - minLat);
  const lngRange = Math.max(0.001, maxLng - minLng);

  return (
    <div className="relative h-28 rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
      />
      {points.slice(0, 24).map((p, idx) => {
        const left = 5 + ((p.lng - minLng) / lngRange) * 90;
        const top = 5 + (1 - (p.lat - minLat) / latRange) * 90;
        const size = Math.min(12, 4 + (p.visit_count || 1) * 2);
        return (
          <div
            key={idx}
            title={p.place_name}
            className="absolute rounded-full bg-purple-400/60 shadow-[0_0_12px_rgba(168,85,247,0.35)]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        );
      })}
    </div>
  );
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function safeParse(raw?: string) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
          <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">氛围</h1>
          <p className="text-[10px] mono text-white/20 tracking-[0.4em] uppercase">Node {gridId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] backdrop-blur-md">
            <Activity size={16} className="text-emerald-500/40 mb-3 mx-auto" />
            <span className="text-[10px] mono text-white/20 block mb-1 uppercase tracking-widest">压力</span>
            <span className="text-lg font-light text-white/80">{pressure}</span>
          </div>
          <div className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] backdrop-blur-md">
            <UserIcon size={16} className="text-white/20 mb-3 mx-auto" />
            <span className="text-[10px] mono text-white/20 block mb-1 uppercase tracking-widest">在线</span>
            <span className="text-lg font-light text-white/80">{ambient}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onAction('LIGHT_ON')}
            disabled={stealth}
            className={`w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] transition-all shadow-xl ${stealth ? 'text-white/10 cursor-not-allowed' : 'text-white/30 hover:text-white'}`}
          >
            点亮
          </button>
          <button
            onClick={() => onAction('OPEN_WHISPERS')}
            className="w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all shadow-xl"
          >
            入口
          </button>
        </div>
      </div>
    </div>
  );
}

function SkyAtmosphere({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const lat = Number(getByPath(model, props?.latPath ?? '/context/location/lat') ?? 31.23);
  const lng = Number(getByPath(model, props?.lngPath ?? '/context/location/lng') ?? 121.47);
  const city = resolveText(model, { path: props?.cityPath ?? '/context/location/city_id' }) || 'Shanghai';
  const pressure = resolveText(model, { path: props?.pressurePath ?? '/sky/pressure' }) || 'Moderate';
  const ambient = resolveText(model, { path: props?.ambientPath ?? '/sky/ambient' }) || '14 Active';
  const userId = React.useMemo(() => getOrCreateUserId(), []);
  const [atmosphere, setAtmosphere] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const pushed = resolveText(model, { path: '/atmosphere_json' });
  const pushedUsers = resolveText(model, { path: '/atmosphere_users' });
  const [presenceOverride, setPresenceOverride] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!pushed) return;
    try {
      const parsed = JSON.parse(pushed);
      setAtmosphere(parsed);
    } catch {
      // ignore
    }
  }, [pushed]);

  React.useEffect(() => {
    if (!pushedUsers) return;
    try {
      const parsed = JSON.parse(pushedUsers);
      setPresenceOverride(parsed);
    } catch {
      // ignore
    }
  }, [pushedUsers]);

  React.useEffect(() => {
    let active = true;
    const apiRoot = getApiBase().replace(/\/$/, '');
    const fetchAtmosphere = async () => {
      setLoading(true);
      try {
        const uidParam = userId ? `&uid=${encodeURIComponent(userId)}` : '';
        const url = `${apiRoot}/api/atmosphere?lat=${lat}&lng=${lng}&city=${encodeURIComponent(city)}${uidParam}`;
        const res = await fetch(url, { headers: buildAuthHeaders() });
        const data = await res.json();
        if (active) setAtmosphere(data);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchAtmosphere();
    const timer = setInterval(fetchAtmosphere, 120000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [lat, lng, city]);

  if (!atmosphere) {
    return <SkyStats model={model} props={props} onAction={onAction} />;
  }

  const anonymousUsers = presenceOverride ?? atmosphere.anonymous_users ?? { total: 0, nearby: 0 };

  return (
    <div className="relative w-full min-h-[70vh] px-4 py-8 overflow-hidden">
      <CityMapBackground hotspots={atmosphere.hotspots ?? []} pulseLevel={atmosphere.pulse?.level ?? 'quiet'} />
      <div className="relative z-10 max-w-xl mx-auto text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">氛围</h1>
          <p className="text-[10px] mono text-white/20 tracking-[0.4em] uppercase">{city}</p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <PulseIndicator level={atmosphere.pulse?.level ?? 'quiet'} score={atmosphere.pulse?.score ?? 0} />
          <p className="text-lg text-white/80">{atmosphere.pulse?.description ?? ''}</p>
        </div>

        <div className="space-y-2">
          <div className="text-4xl font-light text-white/90">
            {anonymousUsers?.total ?? 0}
          </div>
          <div className="text-sm text-white/60">人正在这座城市的深夜中漫游</div>
          <div className="text-xs text-white/40">其中 {anonymousUsers?.nearby ?? 0} 人在你附近</div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <AtmosphereCard icon="🌡️" label="温度" value={`${atmosphere.weather?.temperature ?? 0}°`} />
          <AtmosphereCard icon="🏪" label="营业中" value={`${atmosphere.open_places?.total ?? 0}`} />
          <AtmosphereCard icon="💡" label="热点区" value={`${(atmosphere.hotspots ?? []).length}`} />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onAction('LIGHT_ON')}
            className="w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all shadow-xl"
          >
            点亮
          </button>
          <button
            onClick={() => onAction('OPEN_WHISPERS')}
            className="w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all shadow-xl"
          >
            入口
          </button>
        </div>

        <div className="text-[9px] mono uppercase tracking-[0.35em] text-white/15">
          {loading ? '同步中…' : `${pressure} · ${ambient}`}
        </div>
      </div>
    </div>
  );
}

function AtmosphereCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-center">
      <div className="text-xl mb-2">{icon}</div>
      <div className="text-[10px] mono uppercase tracking-[0.3em] text-white/30">{label}</div>
      <div className="text-lg text-white/80 mt-2">{value}</div>
    </div>
  );
}

function PulseIndicator({ level, score }: { level: string; score: number }) {
  const colors: Record<string, string> = {
    quiet: 'from-slate-600 to-slate-800',
    moderate: 'from-blue-600 to-indigo-800',
    vibrant: 'from-purple-600 to-pink-800',
    bustling: 'from-orange-600 to-red-800'
  };
  const palette = colors[level] ?? colors.quiet;
  return (
    <div className="relative inline-flex items-center justify-center">
      <div className={`absolute w-28 h-28 rounded-full bg-gradient-to-br ${palette} animate-pulse opacity-30`} />
      <div className={`absolute w-20 h-20 rounded-full bg-gradient-to-br ${palette} animate-ping opacity-20`} style={{ animationDuration: '2s' }} />
      <div className="relative z-10 w-16 h-16 rounded-full bg-slate-900/80 flex items-center justify-center">
        <span className="text-2xl font-bold text-white">{score}</span>
      </div>
    </div>
  );
}

function CityMapBackground({ hotspots, pulseLevel }: { hotspots: any[]; pulseLevel: string }) {
  const coords = (hotspots ?? [])
    .map((spot) => spot?.center)
    .filter((c) => Number.isFinite(c?.lat) && Number.isFinite(c?.lng));
  const lats = coords.map((c) => c.lat as number);
  const lngs = coords.map((c) => c.lng as number);
  const minLat = lats.length ? Math.min(...lats) : 0;
  const maxLat = lats.length ? Math.max(...lats) : 0;
  const minLng = lngs.length ? Math.min(...lngs) : 0;
  const maxLng = lngs.length ? Math.max(...lngs) : 0;
  const latRange = Math.max(0.001, maxLat - minLat);
  const lngRange = Math.max(0.001, maxLng - minLng);

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
      {(hotspots ?? []).slice(0, 8).map((spot, i) => (
        <div
          key={i}
          className="absolute w-16 h-16 rounded-full animate-pulse"
          style={{
            left: `${10 + ((Number(spot?.center?.lng ?? 0) - minLng) / lngRange) * 80}%`,
            top: `${10 + (1 - (Number(spot?.center?.lat ?? 0) - minLat) / latRange) * 80}%`,
            background: `radial-gradient(circle, rgba(255,100,100,${(spot?.intensity ?? 0.5) * 0.5}) 0%, transparent 70%)`,
            animationDelay: `${i * 0.3}s`
          }}
        />
      ))}
    </div>
  );
}

function VeilMomentStream({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const momentsPath = props?.momentsPath ?? '/veil/moments';
  const modelMoments: any[] = resolveList(model, momentsPath);
  const tick = resolveNumber(model, '/moments_tick', 0);
  const [moments, setMoments] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState<any | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [mode, setMode] = React.useState<'stream' | 'screensaver'>('stream');
  const [showConsent, setShowConsent] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const apiRoot = getApiBase().replace(/\/$/, '');
  const userId = React.useMemo(() => getOrCreateUserId(), []);

  const fetchMoments = React.useCallback(async () => {
    try {
      const res = await fetch(`${apiRoot}/api/moments?limit=24&sort=recent`, {
        headers: buildAuthHeaders()
      });
      const data = await res.json();
      const list = Array.isArray(data?.moments) ? data.moments : [];
      setMoments(list);
    } catch {
      // ignore
    }
  }, [apiRoot]);

  React.useEffect(() => {
    fetchMoments();
  }, [fetchMoments, tick]);

  const hasConsent = () => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('nightfall_veil_consent') === 'true';
    } catch {
      return true;
    }
  };

  const acceptConsent = () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('nightfall_veil_consent', 'true');
    } catch {
      // ignore
    }
  };

  const handleUploadClick = () => {
    if (hasConsent()) {
      fileRef.current?.click();
      return;
    }
    setShowConsent(true);
  };

  const handleUpload = async (file?: File | null) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.readAsDataURL(file);
      });
      const rawLat = Number(getByPath(model, '/context/location/lat'));
      const rawLng = Number(getByPath(model, '/context/location/lng'));
      const lastTicket = getPocketTickets()[0];
      const lastPayload = lastTicket?.bundle?.primary_ending?.payload ?? {};
      const payload: any = {
        user_id: userId ?? 'anonymous',
        image_data: dataUrl,
        caption: '',
        place_id: String(lastPayload.place_id ?? lastPayload.id ?? ''),
        place_name: String(lastPayload.name ?? '')
      };
      if (Number.isFinite(rawLat)) payload.place_lat = rawLat;
      if (Number.isFinite(rawLng)) payload.place_lng = rawLng;

      await fetch(`${apiRoot}/api/moments`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      await fetchMoments();
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  const likeMoment = async (id: string) => {
    try {
      const res = await fetch(`${apiRoot}/api/moments/${encodeURIComponent(id)}/like`, {
        method: 'POST',
        headers: buildAuthHeaders()
      });
      const data = await res.json();
      setMoments((prev) => prev.map((m) => (m.id === id ? { ...m, likes: data?.likes ?? (m.likes ?? 0) + 1 } : m)));
    } catch {
      // ignore
    }
  };

  const data = moments.length ? moments : modelMoments;

  return (
    <div className="relative w-full min-h-[70vh] bg-black/60 rounded-[2.5rem] border border-white/5 overflow-hidden">
      <div className="p-6 text-center relative">
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">幕布</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">瞬间共享</p>
        <button
          onClick={() => setMode((prev) => (prev === 'stream' ? 'screensaver' : 'stream'))}
          className="absolute right-6 top-6 text-[9px] mono uppercase tracking-[0.35em] text-white/30 hover:text-white/60"
        >
          {mode === 'stream' ? '屏保' : '返回'}
        </button>
      </div>

      {mode === 'screensaver' ? (
        <VeilScreensaver moments={data} />
      ) : (
        <div className="columns-2 gap-2 p-4">
          {data.length === 0 ? (
            <EmptyState title="还没有瞬间" subtitle="上传一张夜晚的照片" />
          ) : (
            data.map((moment) => (
              <MomentCard key={moment.id} moment={moment} onClick={() => setSelected(moment)} onLike={() => likeMoment(moment.id)} />
            ))
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
      />

      {mode === 'stream' ? (
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center shadow-lg shadow-purple-600/30 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
        </button>
      ) : null}

      {selected ? (
        <MomentDetail moment={selected} onClose={() => setSelected(null)} onLike={() => likeMoment(selected.id)} />
      ) : null}
      {showConsent ? (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0b0b12] border border-white/10 rounded-2xl p-6 text-center space-y-4">
            <div className="text-lg text-white/90">上传提示</div>
            <div className="text-xs text-white/50 leading-relaxed">
              你上传的照片会展示在“幕布”公共瞬间流中。请勿上传包含个人隐私或不适内容的图片。
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConsent(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm"
              >
                取消
              </button>
              <button
                onClick={() => {
                  acceptConsent();
                  setShowConsent(false);
                  fileRef.current?.click();
                }}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm"
              >
                同意并上传
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MomentCard({ moment, onClick, onLike }: { moment: any; onClick: () => void; onLike: () => void }) {
  const img = moment.image_url || moment.thumbnail_url || '';
  return (
    <button onClick={onClick} className="relative mb-2 rounded-lg overflow-hidden group w-full">
      <img src={img} alt={moment.caption || '瞬间'} className="w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
        {moment.place_name ? (
          <div className="flex items-center gap-1 text-white text-sm">
            <MapPin size={14} />
            <span className="truncate">{moment.place_name}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-white/70 text-xs mt-2">
          <button onClick={(e) => { e.stopPropagation(); onLike(); }} className="flex items-center gap-1">
            <Heart size={12} />
            <span>{moment.likes ?? 0}</span>
          </button>
        </div>
      </div>
    </button>
  );
}

function MomentDetail({ moment, onClose, onLike }: { moment: any; onClose: () => void; onLike: () => void }) {
  const img = moment.image_url || moment.thumbnail_url || '';
  const openMap = () => {
    const lat = Number(moment.place_lat);
    const lng = Number(moment.place_lng);
    const name = String(moment.place_name ?? '').trim();
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      window.open(url, '_blank');
      return;
    }
    if (name) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
      window.open(url, '_blank');
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="relative max-w-xl w-full bg-[#0b0b12] rounded-2xl overflow-hidden border border-white/10">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white">
          <X size={18} />
        </button>
        <img src={img} alt="" className="w-full max-h-[70vh] object-cover" />
        <div className="p-5 space-y-2">
          {moment.place_name ? <div className="text-white/80 text-sm">{moment.place_name}</div> : null}
          {moment.caption ? <div className="text-white/60 text-xs">{moment.caption}</div> : null}
          <button onClick={onLike} className="flex items-center gap-2 text-white/70 text-xs">
            <Heart size={12} />
            <span>{moment.likes ?? 0} 喜欢</span>
          </button>
          {moment.place_name || (Number.isFinite(Number(moment.place_lat)) && Number.isFinite(Number(moment.place_lng))) ? (
            <button onClick={openMap} className="text-white/40 text-xs hover:text-white/70">
              查看地点
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VeilScreensaver({ moments }: { moments: any[] }) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const safeMoments = Array.isArray(moments) ? moments : [];

  React.useEffect(() => {
    if (!safeMoments.length) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % safeMoments.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [safeMoments.length]);

  if (!safeMoments.length) {
    return (
      <div className="p-8">
        <EmptyState title="还没有瞬间" subtitle="上传一张夜晚的照片" />
      </div>
    );
  }

  const current = safeMoments[currentIndex % safeMoments.length];
  const img = current.image_url || current.thumbnail_url || '';

  return (
    <div className="relative w-full min-h-[70vh] bg-black">
      <img src={img} alt="" className="w-full h-[70vh] object-cover transition-opacity duration-1000" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
      <div className="absolute bottom-10 left-6 right-6 space-y-2">
        {current.place_name ? (
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <MapPin size={14} />
            <span>{current.place_name}</span>
          </div>
        ) : null}
        {current.caption ? <div className="text-white/70 text-sm">{current.caption}</div> : null}
      </div>
      <div className="absolute bottom-4 left-6 right-6 flex gap-1">
        {safeMoments.slice(0, 10).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i === currentIndex ? 'bg-white' : 'bg-white/30'}`} />
        ))}
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
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">幕布</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">月光屏保</p>
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
            <button onClick={() => onAction('VEIL_FEEDBACK', { vote: 'like' })} className="py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">喜欢</button>
            <button onClick={() => onAction('VEIL_FEEDBACK', { vote: 'dislike' })} className="py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">不要</button>
            <button onClick={() => onAction('SAVE_VEIL_FRAME', { collage_id: collage.collage_id })} className="py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">收藏</button>
          </div>
        </div>
      </div>
      <button onClick={() => onAction('BACK_TO_POCKET')} className="w-full py-4 rounded-full bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all">← 返回</button>
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
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">足迹</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">不排名，只回响</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem]">
          <div className="text-[10px] mono uppercase tracking-widest text-white/15">专注</div>
          <div className="text-2xl font-light italic text-white/80 mt-2">{summary.focus_min ?? 0} min</div>
        </div>
        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem]">
          <div className="text-[10px] mono uppercase tracking-widest text-white/15">点亮</div>
          <div className="text-2xl font-light italic text-white/80 mt-2">{summary.lights ?? 0}</div>
        </div>
      </div>
      <div className="p-7 bg-white/[0.02] border border-white/5 rounded-[2.5rem]">
        <div className="text-[9px] mono uppercase tracking-[0.3em] text-white/15 mb-3">本周回响</div>
        <div className="text-white/40 text-[11px] font-light italic leading-relaxed whitespace-pre-line">{weekly}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onAction('EXPORT_POCKET', { range: 'weekly' })} className="py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">归档</button>
        <button onClick={() => onAction('BACK_TO_POCKET')} className="py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-[10px] mono uppercase tracking-widest text-white/30 hover:text-white transition">返回</button>
      </div>
    </div>
  );
}

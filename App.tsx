import React, { useEffect, useMemo, useState } from 'react';
import { ContextSignals, TimeBand, MotionState, ChannelType } from './types';
import StarMap from './components/StarMap';
import { A2UIRuntimeProvider, useA2UIRuntime } from './a2ui/store';
import { SurfaceView } from './a2ui/renderer';
import { NightfallOrchestrator } from './a2ui/orchestrator';
import { Ghost, Compass, History, Layers, Zap, ArrowDown } from 'lucide-react';
import type { A2UIAction } from './a2ui/messages';

const INITIAL_CONTEXT: ContextSignals = {
  time: {
    now_ts: new Date().toISOString(),
    time_band: TimeBand.PRIME,
    weekday: new Date().getDay() || 7,
    local_holiday_flag: false
  },
  location: {
    grid_id: 'sh_cn_881',
    city_id: 'Shanghai',
    place_context: 'unknown',
    location_quality: 'ok'
  },
  mobility: {
    motion_state: MotionState.STILL,
    transport_mode: 'walk',
    eta_min: 0
  },
  user_state: {
    mode: 'immersion',
    energy_band: 'mid',
    social_temp: 1,
    stealth: false
  }
};

const App: React.FC = () => {
  const [context, setContext] = useState<ContextSignals>(INITIAL_CONTEXT);
  const [activeChannel, setActiveChannel] = useState<ChannelType>(ChannelType.TONIGHT);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showWhispers, setShowWhispers] = useState(false);
  const [styleHint, setStyleHint] = useState<{ infoDensity?: number; uiModeHint?: string; toneTags?: string[] } | null>(null);
  const [pendingAction, setPendingAction] = useState<A2UIAction | null>(null);

  const orchestrator = useMemo(() => new NightfallOrchestrator(), []);

  // Keep time band updated (host shell signal)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      let band = TimeBand.DAYTIME;
      if (hours >= 19 && hours < 21) band = TimeBand.DINNER;
      else if (hours >= 21 && hours < 23) band = TimeBand.PRIME;
      else if (hours >= 23 || hours < 5) band = TimeBand.LATE;

      setContext(prev => ({
        ...prev,
        time: { ...prev.time, now_ts: now.toISOString(), time_band: band }
      }));
    };
    const interval = setInterval(updateTime, 60000);
    updateTime();
    return () => clearInterval(interval);
  }, []);

  const toggleStealth = () => {
    setContext(prev => ({
      ...prev,
      user_state: { ...prev.user_state, stealth: !prev.user_state.stealth }
    }));
  };

  return (
    <A2UIRuntimeProvider onAction={(a) => setPendingAction(a)}>
      <A2UIBridge
        orchestrator={orchestrator}
        context={context}
        setContext={setContext}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        isFocusMode={isFocusMode}
        setIsFocusMode={setIsFocusMode}
        showWhispers={showWhispers}
        setShowWhispers={setShowWhispers}
        toggleStealth={toggleStealth}
        pendingAction={pendingAction}
        clearPendingAction={() => setPendingAction(null)}
        styleHint={styleHint}
        setStyleHint={setStyleHint}
      />
    </A2UIRuntimeProvider>
  );
};

interface BridgeProps {
  orchestrator: NightfallOrchestrator;
  context: ContextSignals;
  setContext: React.Dispatch<React.SetStateAction<ContextSignals>>;
  activeChannel: ChannelType;
  setActiveChannel: React.Dispatch<React.SetStateAction<ChannelType>>;
  isFocusMode: boolean;
  setIsFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  showWhispers: boolean;
  setShowWhispers: React.Dispatch<React.SetStateAction<boolean>>;
  toggleStealth: () => void;
  pendingAction: A2UIAction | null;
  clearPendingAction: () => void;
  styleHint: { infoDensity?: number; uiModeHint?: string; toneTags?: string[] } | null;
  setStyleHint: React.Dispatch<React.SetStateAction<{ infoDensity?: number; uiModeHint?: string; toneTags?: string[] } | null>>;
}

/**
 * A2UIBridge lives inside the provider so it can:
 * - call applyMessages to bootstrap surfaces
 * - route user actions to the orchestrator with real applyMessages
 */
const A2UIBridge: React.FC<BridgeProps> = ({
  orchestrator,
  context,
  setContext,
  activeChannel,
  setActiveChannel,
  isFocusMode,
  setIsFocusMode,
  showWhispers,
  setShowWhispers,
  toggleStealth,
  pendingAction,
  clearPendingAction,
  styleHint,
  setStyleHint
}) => {
  const { applyMessages } = useA2UIRuntime();

  // Bootstrap A2UI surfaces once.
  useEffect(() => {
    orchestrator.bootstrap({
      context,
      setContext: (updater) => setContext(updater),
      openWhispers: () => setShowWhispers(true),
      closeWhispers: () => setShowWhispers(false),
      enterFocus: () => setIsFocusMode(true),
      exitFocus: () => setIsFocusMode(false),
      setActiveChannel: (ch) => {
        if (ch === 'tonight') setActiveChannel(ChannelType.TONIGHT);
        else if (ch === 'discover') setActiveChannel(ChannelType.DISCOVER);
        else if (ch === 'sky') setActiveChannel(ChannelType.SKY);
        else if (ch === 'pocket') setActiveChannel(ChannelType.POCKET);
        else if (ch === 'veil') setActiveChannel(ChannelType.VEIL);
        else if (ch === 'footprints') setActiveChannel(ChannelType.FOOTPRINTS);
      },
      applyStyleHint: (hint) => setStyleHint(hint),
      openExternal: (url) => window.open(url, '_blank'),
      applyMessages
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Style Envelope: continuous, reversible adjustments via CSS variables
  useEffect(() => {
    const root = document.documentElement;

    const energy = context.user_state.energy_band;
    const mode = context.user_state.mode;
    const stealth = context.user_state.stealth;
    const social = context.user_state.social_temp; // 0-3

    // Base mapping (avoid jumps)
    let mist = energy === 'low' ? 0.22 : energy === 'high' ? 0.14 : 0.18;
    let grain = context.mobility.motion_state === MotionState.DRIVING ? 0.14 : 0.10;
    let bloom = mode === 'recovery' ? 0.30 : mode === 'explore' ? 0.24 : 0.22;
    let starOpacity = stealth ? 0.16 : 0.22 + 0.06 * Math.min(3, Math.max(0, social));

    // Skill-provided hint (inside the envelope, small deltas only)
    if (styleHint) {
      const density = typeof styleHint.infoDensity === 'number' ? Math.min(1, Math.max(0, styleHint.infoDensity)) : null;
      if (density !== null) {
        // low density -> softer (more mist); high density -> sharper
        mist = Math.min(0.30, Math.max(0.10, mist + (0.5 - density) * 0.08));
        grain = Math.min(0.22, Math.max(0.06, grain + (density - 0.5) * 0.06));
      }

      const hintMode = (styleHint.uiModeHint ?? '').toLowerCase();
      if (hintMode === 'focus') {
        bloom = Math.max(0.16, bloom - 0.05);
        starOpacity = Math.max(0.10, starOpacity - 0.06);
      } else if (hintMode === 'stealth') {
        starOpacity = Math.max(0.08, starOpacity - 0.10);
        mist = Math.min(0.30, mist + 0.03);
      } else if (hintMode === 'explore') {
        bloom = Math.min(0.34, bloom + 0.03);
      }

      const tones = new Set((styleHint.toneTags ?? []).map(t => String(t).toLowerCase()));
      if (tones.has('warm')) bloom = Math.min(0.36, bloom + 0.02);
      if (tones.has('mist')) mist = Math.min(0.32, mist + 0.02);
      if (tones.has('minimal')) grain = Math.max(0.06, grain - 0.01);
    }

    root.style.setProperty('--nf-mist', String(mist));
    root.style.setProperty('--nf-grain', String(grain));
    root.style.setProperty('--nf-bloom', String(bloom));
    root.style.setProperty('--nf-star-opacity', String(starOpacity));
  }, [context, styleHint]);
  // Route user actions to orchestrator.
  useEffect(() => {
    if (!pendingAction) return;

    orchestrator.handleAction(pendingAction, {
      context,
      setContext: (updater) => setContext(updater),
      openWhispers: () => setShowWhispers(true),
      closeWhispers: () => setShowWhispers(false),
      enterFocus: () => setIsFocusMode(true),
      exitFocus: () => setIsFocusMode(false),
      setActiveChannel: (ch) => {
        if (ch === 'tonight') setActiveChannel(ChannelType.TONIGHT);
        else if (ch === 'discover') setActiveChannel(ChannelType.DISCOVER);
        else if (ch === 'sky') setActiveChannel(ChannelType.SKY);
        else if (ch === 'pocket') setActiveChannel(ChannelType.POCKET);
        else if (ch === 'veil') setActiveChannel(ChannelType.VEIL);
        else if (ch === 'footprints') setActiveChannel(ChannelType.FOOTPRINTS);
      },
      applyStyleHint: (hint) => setStyleHint(hint),
      openExternal: (url) => window.open(url, '_blank'),
      applyMessages
    }).finally(() => clearPendingAction());
  }, [pendingAction, orchestrator, context, setContext, applyMessages, setShowWhispers, setIsFocusMode, clearPendingAction]);

  const renderMainContent = () => {
    if (isFocusMode) return null;
    if (activeChannel === ChannelType.TONIGHT) return <SurfaceView surfaceId="tonight" />;
    if (activeChannel === ChannelType.DISCOVER) return <SurfaceView surfaceId="discover" />;
    if (activeChannel === ChannelType.SKY) return <SurfaceView surfaceId="sky" />;
    if (activeChannel === ChannelType.POCKET) return <SurfaceView surfaceId="pocket" />;
    if (activeChannel === ChannelType.VEIL) return <SurfaceView surfaceId="veil" />;
    if (activeChannel === ChannelType.FOOTPRINTS) return <SurfaceView surfaceId="footprints" />;
    return null;
  };

  return (
    <div className={`relative h-screen w-screen overflow-hidden transition-all duration-1000 ${isFocusMode ? 'bg-black' : 'bg-[#050505]'} text-white`}>
      {/* Background */}
      <div className={`fixed inset-0 pointer-events-none transition-all duration-1000 ${isFocusMode ? 'opacity-100 scale-110' : 'opacity-30'}`}>
        <StarMap socialTemp={context.user_state.social_temp} stealth={context.user_state.stealth} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.95)_100%)]"></div>
      </div>

      {/* Main Container */}
      <main className={`relative z-10 w-full h-full transition-all duration-1000 ${isFocusMode ? 'scale-105 opacity-0 blur-2xl pointer-events-none' : 'scale-100 opacity-100'}`}>
        <div className="w-full h-full pt-20 pb-28 overflow-y-auto overflow-x-hidden flex flex-col items-center no-scrollbar px-5">
          {renderMainContent()}
        </div>
      </main>

      {/* Whispers Overlay */}
      {showWhispers && !isFocusMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 animate-in fade-in zoom-in-95 duration-500 backdrop-blur-2xl bg-black/80">
          <div className="w-full max-w-lg relative">
            <button
              onClick={() => setShowWhispers(false)}
              className="absolute -top-10 left-1/2 -translate-x-1/2 text-white/20 flex flex-col items-center gap-1 transition-all"
            >
              <ArrowDown size={14} />
              <span className="text-[8px] mono uppercase tracking-widest">Exit</span>
            </button>
            <SurfaceView surfaceId="whispers" />
          </div>
        </div>
      )}

      {/* Focus Mode Overlay */}
      {isFocusMode && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center animate-in fade-in duration-1000">
          <div className="nf-focus-texture" />
          <div className="w-px h-56 bg-gradient-to-b from-white/30 to-transparent mb-10 shadow-[0_0_60px_rgba(255,255,255,0.3)]"></div>
          <div className="text-center space-y-4 px-10">
            <h2 className="text-[10px] font-light tracking-[0.7em] text-white/30 uppercase">Delivery Active</h2>
            <p className="text-sm text-white/10 font-extralight italic leading-relaxed">"The city is your gallery now."</p>
          </div>
          <button
            onClick={() => setIsFocusMode(false)}
            className="fixed bottom-10 px-10 py-3 rounded-full border border-white/5 text-[9px] mono uppercase tracking-[0.5em] text-white/10 hover:text-white/40 transition-all backdrop-blur-md"
          >
            ← Return
          </button>
        </div>
      )}

      {/* Global Radio (A2UI Surface) */}
      {!isFocusMode && <SurfaceView surfaceId="radio" />}

      {/* Global HUD - Top */}
      <div className={`fixed top-6 left-6 right-6 flex justify-between items-center z-50 pointer-events-none transition-all duration-700 ${isFocusMode ? '-translate-y-20 opacity-0' : 'translate-y-0 opacity-100'}`}>
        <div className="px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-full flex items-center gap-2 backdrop-blur-md pointer-events-auto">
          <div className="w-1.5 h-1.5 bg-emerald-500/80 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
          <span className="text-[9px] mono text-white/20 uppercase tracking-widest">sh_{context.location.grid_id}</span>
        </div>

        <button
          onClick={toggleStealth}
          className={`pointer-events-auto px-3 py-1.5 rounded-full border backdrop-blur-md flex items-center gap-2 transition-all ${
            context.user_state.stealth ? 'bg-white/10 border-white/20' : 'bg-white/[0.02] border-white/5'
          }`}
        >
          <Ghost size={12} className={`${context.user_state.stealth ? 'text-emerald-500/60' : 'text-white/20'}`} />
          <span className="text-[9px] mono text-white/20 uppercase tracking-widest">{context.user_state.stealth ? 'Stealth' : 'Visible'}</span>
        </button>
      </div>

      {/* Bottom Navigation (Host shell) */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-3 p-2 rounded-full bg-black/40 border border-white/10 backdrop-blur-2xl transition-all duration-700 ${isFocusMode ? 'translate-y-24 opacity-0' : 'translate-y-0 opacity-100'}`}>
        {[
          { id: ChannelType.TONIGHT, icon: <Zap size={14} />, label: 'Tonight' },
          { id: ChannelType.DISCOVER, icon: <Compass size={14} />, label: 'Discover' },
          { id: ChannelType.SKY, icon: <Layers size={14} />, label: 'Sky' },
          { id: ChannelType.POCKET, icon: <History size={14} />, label: 'Pocket' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveChannel(item.id)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              activeChannel === item.id ? 'bg-white text-black' : 'text-white/20 hover:text-white/40'
            }`}
            aria-label={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;

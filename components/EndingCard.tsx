
import React, { useState } from 'react';
import { CuratorialBundle } from '../types';
import { CheckCircle, ShieldAlert, Navigation, CornerUpRight, Bookmark, Ticket, Play, Lamp, Share2 } from 'lucide-react';

interface EndingCardProps {
  bundle: CuratorialBundle;
  onReset: () => void;
  onSave: () => void;
  onStartFocus: () => void;
}

const EndingCard: React.FC<EndingCardProps> = ({ bundle, onSave, onStartFocus }) => {
  const [view, setView] = useState<'primary' | 'plan_b'>('primary');
  const [saved, setSaved] = useState(false);

  const isPrimary = view === 'primary';
  const data = isPrimary ? bundle.primary_ending : { 
    ...bundle.primary_ending, 
    ...bundle.plan_b,
    risk_flags: [] 
  };

  const handleSave = () => {
    setSaved(true);
    onSave();
    setTimeout(() => setSaved(false), 2000);
  };

  const getActionIcon = () => {
    switch(data.action) {
      case 'PLAY': return <Play size={16} fill="currentColor" />;
      case 'START_FOCUS': return <Lamp size={16} />;
      default: return <Navigation size={16} />;
    }
  };

  return (
    <div className="w-full max-w-[320px] mx-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-700">
      <div className="relative bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-2xl">
        {/* Ticket Top */}
        <div className="p-7 pb-6 border-b border-dashed border-white/10 relative">
          <div className="absolute -left-3 -bottom-3 w-6 h-6 bg-[#050505] rounded-full border border-white/10"></div>
          <div className="absolute -right-3 -bottom-3 w-6 h-6 bg-[#050505] rounded-full border border-white/10"></div>
          
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2 text-[8px] mono uppercase tracking-[0.2em] text-white/30">
              <Ticket size={10} />
              <span>{isPrimary ? 'Outcome' : 'Plan B'}</span>
            </div>
            <button onClick={handleSave} className={`transition-all ${saved ? 'text-emerald-500' : 'text-white/20'}`}>
              <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>

          <h1 className="text-3xl font-light italic text-white mb-3 tracking-tight leading-tight">{data.title}</h1>
          <p className="text-white/40 text-[11px] font-light italic leading-relaxed">"{data.reason}"</p>
        </div>

        {/* Ticket Body */}
        <div className="p-7 pt-9 space-y-7">
          <div className="space-y-4">
            <span className="text-[8px] mono uppercase tracking-[0.3em] text-white/10 block">Gallery Note</span>
            {data.checklist.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-[11px] text-white/30">
                <div className="w-0.5 h-0.5 rounded-full bg-white/20" />
                <span className="font-light">{item}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button onClick={onStartFocus} className="w-full bg-white text-black text-xs font-semibold py-4.5 rounded-2xl active:scale-[0.97] transition-all flex items-center justify-center gap-2">
              {getActionIcon()}
              <span>{data.action_label || 'Execute'}</span>
            </button>
            <button onClick={() => setView(isPrimary ? 'plan_b' : 'primary')} className="w-full bg-white/[0.03] text-white/30 text-[9px] mono uppercase tracking-widest py-3.5 rounded-2xl border border-white/5">
              {isPrimary ? 'Alternate' : 'Primary'}
            </button>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-7 py-5 bg-white/[0.02] border-t border-white/5 flex justify-between items-center text-[9px] mono text-white/20">
          <span className="tracking-widest">{data.expires_at}</span>
          <div className="flex gap-1">
            {bundle.ambient_tokens.slice(0,1).map((token, i) => (
              <span key={i}>#{token}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EndingCard;

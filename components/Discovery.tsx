
import React, { useState } from 'react';
import { Compass, Sparkles, Coffee, BookOpen, Music, LayoutGrid, ArrowUpRight, ArrowLeft } from 'lucide-react';
import EndingCard from './EndingCard';
import { CuratorialBundle } from '../types';

const CATEGORIES = [
  { icon: <Coffee size={12} />, label: 'Quiet' },
  { icon: <BookOpen size={12} />, label: 'Reads' },
  { icon: <Music size={12} />, label: 'Sounds' },
  { icon: <LayoutGrid size={12} />, label: 'Mixed' },
];

const MOCK_POOL = [
  { id: '1', title: 'The Paper Lantern', tag: 'Xuhui Node', desc: 'Minimal noise, warm light. Perfect for physical books.' },
  { id: '2', title: 'Vinyl & Velvet', tag: 'Jing\'an Node', desc: 'Shanghai jazz records and deep immersion.' },
  { id: '3', title: 'Midnight Espresso', tag: 'Bund Node', desc: 'No-phone zone. Espresso and physical ink.' },
  { id: '4', title: 'Bund Shadow', tag: 'Pudong Node', desc: 'A low-mist transition. 1.8km path along the river.' },
];

const Discovery: React.FC = () => {
  const [selected, setSelected] = useState<typeof MOCK_POOL[0] | null>(null);

  if (selected) {
    const mockBundle: CuratorialBundle = {
      primary_ending: {
        id: selected.id,
        title: selected.title,
        reason: selected.desc,
        checklist: ["Enter without sound", "Warm light provided", "Leave phone at desk"],
        risk_flags: ["Limited capacity"],
        expires_at: "02:00",
        action: 'NAVIGATE',
        action_label: 'Confirm'
      },
      plan_b: {
        id: 'alt-1',
        title: 'Alternate Corner',
        reason: 'A backup shelter nearby.',
        action_label: 'Switch',
        checklist: ["Same atmosphere", "Nearby"]
      },
      ambient_tokens: ["Shanghai", "Curated"]
    };

    return (
      <div className="w-full max-w-sm mx-auto py-4 animate-in fade-in duration-500">
        <button onClick={() => setSelected(null)} className="mb-6 flex items-center gap-2 text-[9px] mono uppercase tracking-widest text-white/20">
          <ArrowLeft size={12} /> Back
        </button>
        <EndingCard bundle={mockBundle} onReset={() => setSelected(null)} onSave={() => {}} onStartFocus={() => {}} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-10 py-4 animate-in fade-in duration-1000">
      <header className="text-center space-y-1">
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">Transitions</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">Editorial Selection</p>
      </header>

      <div className="flex justify-center gap-2 overflow-x-auto no-scrollbar py-1">
        {CATEGORIES.map((cat, i) => (
          <button key={i} className="flex-none flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/5 rounded-full text-[9px] mono uppercase tracking-widest text-white/20">
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-1">
        {MOCK_POOL.map((item) => (
          <div key={item.id} onClick={() => setSelected(item)} className="group relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-7 hover:bg-white/[0.06] transition-all cursor-pointer">
            <ArrowUpRight size={18} className="absolute top-7 right-7 text-white/10 group-hover:text-white transition-all" />
            <span className="text-[8px] mono text-white/20 uppercase tracking-[0.3em] mb-4 block">{item.tag}</span>
            <h3 className="text-2xl font-light italic text-white/80 leading-tight mb-3">{item.title}</h3>
            <p className="text-[10px] text-white/30 italic line-clamp-1">"{item.desc}"</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Discovery;

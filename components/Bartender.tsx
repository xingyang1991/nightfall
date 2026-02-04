
import React, { useState } from 'react';
import { CuratorialBundle, ContextSignals } from '../types';
import { getCuratedEnding } from '../services/gemini';
import { Send, Loader2, Sparkles, ChevronRight, CornerDownRight } from 'lucide-react';

interface BartenderProps {
  context: ContextSignals;
  onCurationComplete: (bundle: CuratorialBundle) => void;
}

const Bartender: React.FC<BartenderProps> = ({ context, onCurationComplete }) => {
  const [input, setInput] = useState('');
  const [step, setStep] = useState<'order' | 'clarify'>('order');
  const [loading, setLoading] = useState(false);

  const handleOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setStep('clarify');
  };

  const handleFinalize = async (choice: string) => {
    setLoading(true);
    try {
      const bundle = await getCuratedEnding(`${input}. Preference: ${choice}`, context);
      onCurationComplete(bundle);
    } catch (err) {
      console.error(err);
      setStep('order');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'clarify') {
    return (
      <div className="w-full max-w-sm mx-auto p-7 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="space-y-8">
          <div className="flex items-center gap-2 text-white/20">
            <Sparkles size={12} className="text-emerald-500/60" />
            <span className="text-[9px] mono uppercase tracking-[0.3em]">Clarifying</span>
          </div>
          
          <div className="space-y-4">
            <p className="text-xl font-light text-white/90 leading-tight">
              "How should the city meet you tonight?"
            </p>
            <div className="grid grid-cols-1 gap-2.5 pt-2">
              {[
                'A solitary walk',
                'A silent sanctuary',
                'Collective noise'
              ].map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleFinalize(opt)}
                  disabled={loading}
                  className="flex items-center justify-between px-6 py-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 transition-all text-left"
                >
                  <span className="text-sm font-light text-white/60">{opt}</span>
                  {loading ? <Loader2 size={14} className="animate-spin text-white/20" /> : <ChevronRight size={14} className="text-white/10" />}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep('order')} className="text-[9px] mono uppercase text-white/10 hover:text-white/30 tracking-widest block mx-auto">
            ← Adjust Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto p-9 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-10 space-y-1">
        <h2 className="text-5xl font-extralight tracking-tighter italic text-white/90">Tonight's End</h2>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10 pl-1">One request to exit</p>
      </div>

      <form onSubmit={handleOrder} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="I need a quiet place..."
          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-5 px-6 pr-14 text-white placeholder-white/10 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-light text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className={`absolute right-4 top-1/2 -translate-y-1/2 transition-all ${!input.trim() ? 'opacity-10 scale-90' : 'opacity-100 text-white active:scale-110'}`}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default Bartender;


import React from 'react';
import { Play, SkipForward, Radio as RadioIcon } from 'lucide-react';

interface RadioProps {
  narrative?: string;
  onNext?: () => void;
}

const Radio: React.FC<RadioProps> = ({ narrative, onNext }) => {
  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-sm px-6">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-5 shadow-2xl">
        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
          <RadioIcon className="text-white/40" size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] mono uppercase tracking-widest text-white/30 mb-1">Night Radio FM</p>
          <p className="text-xs text-white/70 line-clamp-2 italic leading-relaxed">
            "{narrative || "Scanning the frequencies of the city..."}"
          </p>
        </div>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <Play size={14} className="fill-white" />
          </button>
          <button onClick={onNext} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <SkipForward size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Radio;

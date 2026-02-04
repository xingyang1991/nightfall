
import React from 'react';
import Bartender from './Bartender';
import EndingCard from './EndingCard';
import { CuratorialBundle, ContextSignals } from '../types';

interface TonightProps {
  curation: CuratorialBundle | null;
  context: ContextSignals;
  onCuration: (bundle: CuratorialBundle) => void;
  onReset: () => void;
  onStartFocus: () => void;
}

const Tonight: React.FC<TonightProps> = ({ curation, context, onCuration, onReset, onStartFocus }) => {
  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[60vh] py-12">
      {!curation ? (
        <div className="w-full animate-in fade-in zoom-in-95 duration-1000">
          <Bartender context={context} onCurationComplete={onCuration} />
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          <EndingCard 
            bundle={curation} 
            onReset={onReset} 
            onSave={() => console.log('Saved to Pocket')}
            onStartFocus={onStartFocus}
          />
          <button 
            onClick={onReset}
            className="mt-8 text-white/20 text-[10px] mono uppercase tracking-[0.3em] hover:text-white/50 transition-all border-b border-transparent hover:border-white/10 pb-1"
          >
            ← Rethink Tonight
          </button>
        </div>
      )}
    </div>
  );
};

export default Tonight;

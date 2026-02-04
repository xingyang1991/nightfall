
import React from 'react';
import { History, Bookmark, TrendingUp, Sparkles } from 'lucide-react';

const Echo: React.FC = () => {
  return (
    <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <section>
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp size={18} className="text-white/40" />
          <h2 className="text-[11px] mono uppercase tracking-[0.2em] text-white/40">Weekly Rhythm</h2>
        </div>
        <div className="grid grid-cols-7 gap-2 h-32 items-end">
          {[40, 70, 30, 90, 50, 60, 20].map((h, i) => (
            <div key={i} className="group relative flex flex-col items-center">
              <div 
                className="w-full bg-white/5 border border-white/10 rounded-t-lg transition-all group-hover:bg-white/20"
                style={{ height: `${h}%` }}
              ></div>
              <span className="mt-2 text-[8px] mono text-white/20">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4 text-white/40">
            <Sparkles size={16} />
            <span className="text-[10px] mono uppercase tracking-wider">Insights</span>
          </div>
          <ul className="space-y-3">
            <li className="text-xs text-white/60">● You prefer quiet cafes on rainy Tuesdays.</li>
            <li className="text-xs text-white/60">● Average night activity: 1.2 hours.</li>
            <li className="text-xs text-white/60">● Most frequent "End of Night": Home.</li>
          </ul>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 text-white/40">
              <Bookmark size={16} />
              <span className="text-[10px] mono uppercase tracking-wider">The Pocket</span>
            </div>
            <p className="text-xs text-white/50 mb-4">Your saved "Ends" and tickets for tonight's journey.</p>
          </div>
          <button className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] mono uppercase tracking-widest text-white/60 hover:bg-white/10 transition-all">
            Open Archive
          </button>
        </div>
      </section>
    </div>
  );
};

export default Echo;

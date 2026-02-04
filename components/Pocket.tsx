
import React from 'react';
import { Bookmark, Sparkles, Clock, Ticket, Wind, Activity } from 'lucide-react';

const Pocket: React.FC = () => {
  return (
    <div className="w-full max-w-sm space-y-10 py-4 animate-in fade-in duration-1000">
      <header className="text-center space-y-1">
        <h1 className="text-5xl font-extralight tracking-tighter italic text-white/90">Archives</h1>
        <p className="text-[9px] mono uppercase tracking-[0.4em] text-white/10">Personal Rhythm</p>
      </header>

      <section className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-7 backdrop-blur-md">
        <div className="flex items-center gap-2 text-white/20 mb-8">
          <Activity size={14} />
          <h2 className="text-[9px] mono uppercase tracking-widest">Weekly Pulse</h2>
        </div>
        
        <div className="flex items-end gap-1.5 h-16 mb-8">
          {[30, 60, 45, 80, 55, 95, 40].map((h, i) => (
            <div key={i} className="flex-1 bg-white/5 rounded-full relative overflow-hidden">
              <div className="w-full bg-white/10 absolute bottom-0 left-0" style={{ height: `${h}%` }}></div>
            </div>
          ))}
        </div>

        <ul className="space-y-4">
          {["Preferred: Quiet Nodes", "Avg Immersion: 72m"].map((insight, i) => (
            <li key={i} className="text-[11px] text-white/30 italic border-l border-white/10 pl-4">
              "{insight}"
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 px-1">
        <div className="flex items-center gap-2 text-white/20 px-1">
          <Bookmark size={14} />
          <h2 className="text-[9px] mono uppercase tracking-widest">Saved Outcome</h2>
        </div>
        
        <div className="space-y-3">
          {[
            { title: "Vinyl & Velvet", date: "FEB 23", type: "Listen" },
            { title: "The Paper Lantern", date: "FEB 21", type: "Focus" },
          ].map((ticket, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex justify-between items-center group">
               <div className="space-y-1">
                 <h3 className="text-sm font-light italic text-white/70">{ticket.title}</h3>
                 <span className="text-[8px] mono uppercase text-white/10 tracking-widest">{ticket.type}</span>
               </div>
               <span className="text-[9px] mono text-white/20">{ticket.date}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="text-center opacity-10 py-6 border-t border-white/5">
        <p className="text-[8px] mono uppercase tracking-[0.5em]">Shanghai Segment Log</p>
      </div>
    </div>
  );
};

export default Pocket;

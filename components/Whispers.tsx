
import React, { useState } from 'react';
import { WhisperNote } from '../types';
import { Send, Sparkles } from 'lucide-react';

const MOCK_WHISPERS: WhisperNote[] = [
  { id: '1', content: 'The rain smells like old books tonight.', symbol: '🌙', timestamp: '22:15' },
  { id: '2', content: 'Found a quiet corner near Jing\'an station.', symbol: '☕️', timestamp: '22:18' },
  { id: '3', content: 'Shanghai never really sleeps, it just sighs.', symbol: '📖', timestamp: '22:20' },
  { id: '4', content: 'One more chapter before the last metro.', symbol: '✨', timestamp: '22:25' },
];

const Whispers: React.FC = () => {
  const [notes, setNotes] = useState<WhisperNote[]>(MOCK_WHISPERS);
  const [input, setInput] = useState('');
  const [responded, setResponded] = useState<Record<string, string>>({});

  const handleRespond = (id: string, sym: string) => {
    setResponded(prev => ({ ...prev, [id]: sym }));
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const newNote: WhisperNote = {
      id: Date.now().toString(),
      content: input,
      symbol: '✨',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setNotes([newNote, ...notes]);
    setInput('');
  };

  return (
    <div className="w-full max-w-2xl h-[75vh] flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex-1 overflow-y-auto px-4 py-12 space-y-8 no-scrollbar mask-fade-edges">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {notes.map((note) => (
            <div 
              key={note.id} 
              className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-8 backdrop-blur-sm group hover:bg-white/[0.07] transition-all duration-500"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                  {note.symbol}
                </div>
                <span className="text-[10px] mono text-white/10">{note.timestamp}</span>
              </div>
              <p className="text-white/70 text-sm font-light leading-relaxed mb-8 italic">
                "{note.content}"
              </p>
              <div className="flex justify-end gap-2">
                {['✨', '🌙', '🏮'].map((sym) => (
                  <button 
                    key={sym}
                    onClick={() => handleRespond(note.id, sym)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${responded[note.id] === sym ? 'bg-white/10 opacity-100 scale-110' : 'opacity-10 hover:opacity-100'}`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto px-4 pb-8">
        <div className="p-7 bg-white/[0.02] border border-white/10 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl relative">
          <div className="flex items-center gap-5">
            <div className="flex-1">
              <input
                type="text"
                maxLength={22}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Exhale a short sentence..."
                className="w-full bg-transparent border-none text-white font-light text-sm placeholder-white/5 focus:outline-none"
              />
            </div>
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              className={`p-3 rounded-full transition-all ${input.trim() ? 'bg-white text-black' : 'bg-white/5 text-white/10'}`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        .mask-fade-edges { mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default Whispers;

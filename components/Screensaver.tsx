
import React from 'react';

const Screensaver: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 bg-black animate-in fade-in duration-1000">
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-60"></div>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-6">
        <div className="w-1 h-24 bg-gradient-to-b from-white/20 to-transparent"></div>
        <p className="text-lg font-light tracking-widest text-white/40 italic">
          "The city breathes when the lights dim."
        </p>
        <div className="flex gap-4">
          <span className="w-2 h-2 rounded-full bg-white/10 animate-pulse"></span>
          <span className="w-2 h-2 rounded-full bg-white/10 animate-pulse [animation-delay:200ms]"></span>
          <span className="w-2 h-2 rounded-full bg-white/10 animate-pulse [animation-delay:400ms]"></span>
        </div>
      </div>
      
      {/* Abstract floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i}
            className="absolute rounded-full bg-white/5 blur-3xl animate-float"
            style={{
              width: `${200 + Math.random() * 300}px`,
              height: `${200 + Math.random() * 300}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${20 + Math.random() * 20}s`,
              animationDelay: `${-Math.random() * 20}s`
            }}
          ></div>
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(10%, 10%); }
          66% { transform: translate(-10%, 5%); }
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Screensaver;

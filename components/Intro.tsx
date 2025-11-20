import React, { useState, useEffect } from 'react';

interface IntroProps {
  onComplete: () => void;
}

const Intro: React.FC<IntroProps> = ({ onComplete }) => {
  const [visible, setVisible] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 500);
    const t2 = setTimeout(() => setShowButton(true), 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617] text-white overflow-hidden">
      {/* Background abstract grid/particles */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-[100px] animate-pulse" />
      </div>

      <div className={`transition-all duration-1000 ease-out transform ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} flex flex-col items-center`}>
        
        {/* Sci-Fi Flux Core Icon */}
        <div className="relative mb-12">
           {/* Outer rotating ring */}
           <div className="w-32 h-32 rounded-full border border-cyan-500/20 border-t-cyan-400 animate-[spin_8s_linear_infinite] shadow-[0_0_30px_rgba(6,182,212,0.1)]"></div>
           
           {/* Inner rotating ring (reverse) */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-blue-500/30 border-b-blue-400 animate-[spin_5s_linear_infinite_reverse]"></div>
           
           {/* Core pulse */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-cyan-500/10 rounded-full animate-pulse shadow-[0_0_40px_cyan]"></div>
           
           {/* Center solid */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_20px_white]"></div>
           
           {/* Orbital particle */}
           <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
               <div className="absolute top-0 left-1/2 w-1 h-1 bg-cyan-300 rounded-full shadow-[0_0_5px_cyan]"></div>
           </div>
        </div>

        <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-4 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">UMBRAX</span>
          <span className="text-cyan-500 ml-4">FLUX 3</span>
        </h1>
        <p className="text-slate-400 tracking-[0.5em] text-sm md:text-base uppercase mb-12 font-mono">
          DREAMS ENGINEERED.
        </p>

        <button
          onClick={onComplete}
          className={`group relative px-8 py-4 bg-blue-600 text-white rounded-none clip-path-button font-bold tracking-wider transition-all duration-700 overflow-hidden hover:bg-blue-500 ${showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <span className="flex items-center gap-2">
            INITIALIZE FLUX
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
};

export default Intro;

import React, { useState, useEffect } from 'react';
import Intro from './components/Intro';
import Generator from './components/Generator';

// --- TRANSITION COMPONENT 1: BOOT SEQUENCE (Landing -> Login) ---
const BootSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  
  const bootText = [
    "INITIATING UMBRAX KERNEL v3.0.1",
    "LOADING NEURAL DRIVERS...",
    "ESTABLISHING SECURE LINK [ENCRYPTED]",
    "ALLOCATING MEMORY BLOCKS [17TB]",
    "SYNCHRONIZING FLUX CAPACITORS...",
    "SYSTEM READY."
  ];

  useEffect(() => {
    // Progress Bar Animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 5;
      });
    }, 50);

    // Text Scrolling Animation
    let lineIndex = 0;
    const textInterval = setInterval(() => {
      if (lineIndex < bootText.length) {
        setLines(prev => [...prev, bootText[lineIndex]]);
        lineIndex++;
      } else {
        clearInterval(textInterval);
      }
    }, 250);

    // Completion Trigger
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(textInterval);
      clearTimeout(completeTimeout);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] flex flex-col items-center justify-center font-mono text-xs md:text-sm text-cyan-500">
       <div className="w-full max-w-md px-8">
          <div className="flex justify-between mb-2 uppercase tracking-widest text-slate-500">
             <span>System Boot</span>
             <span>{Math.round(progress)}%</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-1 bg-slate-800 mb-8 relative overflow-hidden">
             <div 
               className="absolute top-0 bottom-0 left-0 bg-cyan-500 shadow-[0_0_20px_cyan] transition-all duration-100 ease-out"
               style={{ width: `${progress}%` }}
             />
          </div>
          
          {/* Terminal Output */}
          <div className="h-32 flex flex-col justify-end overflow-hidden">
             {lines.map((line, i) => (
               <div key={i} className="animate-fade-in mb-1 border-l-2 border-cyan-500/50 pl-2">
                  <span className="text-slate-500 mr-2">{`>`}</span>
                  <span className={i === lines.length - 1 ? "text-white animate-pulse" : "text-cyan-400/80"}>{line}</span>
               </div>
             ))}
          </div>
       </div>
       <div className="scanline-overlay opacity-50"></div>
    </div>
  );
};

// --- TRANSITION COMPONENT 2: FLUX CORE OVERLOAD (Login -> App) ---
const UnlockSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'ACCESS' | 'IMPLODE' | 'EXPLODE'>('ACCESS');

  useEffect(() => {
    // Phase 1: Show Access Granted (already rendered initially)
    // Phase 2: Implode (Collapse to center)
    const t1 = setTimeout(() => setPhase('IMPLODE'), 1000);
    
    // Phase 3: Explode (Shockwave)
    const t2 = setTimeout(() => setPhase('EXPLODE'), 1400); // 400ms for implosion
    
    // Phase 4: Finish (Reveal App)
    const t3 = setTimeout(onComplete, 2200); // 800ms for explosion/fade

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden pointer-events-none">
       
       {/* CONTENT TO IMPLODE */}
       {phase !== 'EXPLODE' && (
           <div className={`relative z-10 flex flex-col items-center justify-center transition-all ${phase === 'IMPLODE' ? 'animate-implode' : ''}`}>
              <div className="w-32 h-32 border-4 border-green-400 rounded-full flex items-center justify-center shadow-[0_0_50px_#4ade80] bg-green-900/20 backdrop-blur-md">
                 <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="mt-6 text-green-400 font-bold tracking-[0.5em] text-2xl uppercase whitespace-nowrap drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">Access Granted</div>
           </div>
       )}

       {/* SHOCKWAVE EXPLOSION */}
       {phase === 'EXPLODE' && (
           <div className="absolute inset-0 flex items-center justify-center">
               {/* Massive Gradient Ring that scales up without pixelation */}
               <div className="w-[100vmax] h-[100vmax] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0)_20%,rgba(6,182,212,1)_40%,rgba(224,242,254,0.8)_50%,rgba(6,182,212,1)_60%,rgba(6,182,212,0)_80%)] animate-shockwave opacity-0"></div>
           </div>
       )}
    </div>
  );
};


type AppState = 'INTRO' | 'BOOT' | 'LOGIN' | 'UNLOCK' | 'APP';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<AppState>('INTRO');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  
  // Generate a random session ID on mount
  const [sessionId] = useState(() => Math.floor(10000000000 + Math.random() * 90000000000).toString());

  const handleIntroComplete = () => {
    setViewState('BOOT');
  };

  const handleBootComplete = () => {
    setViewState('LOGIN');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Check for valid passwords
    if (passwordInput === 'genygen' || passwordInput === 'nsdadmin') {
      setAuthError(false);
      setViewState('UNLOCK');
    } else {
      setAuthError(true);
      setPasswordInput('');
    }
  };

  const handleUnlockComplete = () => {
    setViewState('APP');
  };

  return (
    <div className="w-full min-h-screen bg-[#020617] text-white overflow-x-hidden relative selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* GLOBAL DYNAMIC BACKGROUND - Persistent */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         {/* Deep Space Gradient */}
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(6,182,212,0.08),_rgba(2,6,23,1)_70%)]"></div>
         
         {/* Moving Grid */}
         <div className="absolute inset-0 bg-cyber-grid opacity-30"></div>
         
         {/* Floating Orbs */}
         <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-900/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
         
         {/* Scanline Overlay */}
         <div className="scanline-overlay opacity-30"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        
        {/* VIEW CONTROLLER */}
        {viewState === 'INTRO' && (
          <Intro onComplete={handleIntroComplete} />
        )}

        {viewState === 'BOOT' && (
          <BootSequence onComplete={handleBootComplete} />
        )}

        {viewState === 'LOGIN' && (
          <div className="flex-1 flex items-center justify-center p-4 animate-fade-in">
            <div className="max-w-md w-full glass-panel rounded-2xl p-8 md:p-10 text-center border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.5)] relative backdrop-blur-xl animate-warp-in">
              
              {/* Flux Aperture Icon */}
              <div className="w-24 h-24 mx-auto mb-8 relative flex items-center justify-center">
                 <div className="absolute inset-0 border border-slate-600 rounded-full animate-[spin_12s_linear_infinite] opacity-60"></div>
                 <div className="absolute w-16 h-16 border-2 border-cyan-500/30 rotate-45 animate-[spin_17s_linear_infinite_reverse]"></div>
                 <div className="absolute w-14 h-14 border border-blue-500/40 rounded-full animate-breathe"></div>
                 <div className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_25px_cyan] animate-[pulse_4s_ease-in-out_infinite]"></div>
                 <div className="absolute inset-0 animate-[spin_5s_linear_infinite]">
                    <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full absolute top-1 left-1/2 -translate-x-1/2 shadow-[0_0_8px_cyan]"></div>
                 </div>
                 <div className="absolute inset-2 animate-[spin_7s_linear_infinite_reverse]">
                    <div className="w-1 h-1 bg-blue-400 rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 shadow-[0_0_5px_blue]"></div>
                 </div>
              </div>
    
              <h2 className="text-3xl font-bold mb-2 font-sans tracking-tight text-white">
                UMBRAX FLUX 3
              </h2>
              <p className="text-slate-400 mb-8 text-xs uppercase tracking-[0.3em] font-mono">
                System Access Required
              </p>
    
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="relative group">
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setAuthError(false);
                    }}
                    className={`w-full bg-slate-900/50 border-2 ${authError ? 'border-red-500/50 animate-shake' : 'border-slate-700 focus:border-cyan-500'} rounded-lg px-4 py-4 text-center text-lg tracking-[0.5em] outline-none transition-all duration-300 placeholder-slate-700 text-white shadow-inner focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]`}
                    placeholder="•••••••"
                    autoFocus
                  />
                  {authError && (
                    <p className="absolute -bottom-6 left-0 right-0 text-red-400 text-xs font-mono animate-pulse">ACCESS DENIED: INVALID CREDENTIALS</p>
                  )}
                </div>
    
                <button 
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg font-bold tracking-wider uppercase transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:scale-[1.02] active:scale-95 border border-white/10"
                >
                  Authenticate
                </button>
              </form>
    
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between text-[10px] text-slate-500 font-mono uppercase">
                 <span>Flux Core v3.0.1</span>
                 <span className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                       <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500 shadow-[0_0_5px_#22c55e]"></span>
                    </span>
                    Online
                 </span>
              </div>
            </div>
          </div>
        )}

        {viewState === 'UNLOCK' && (
          <UnlockSequence onComplete={handleUnlockComplete} />
        )}

        {viewState === 'APP' && (
          <div className="animate-fade-in">
             <Generator initialId={sessionId} />
          </div>
        )}
        
        {/* Persistent Footer for Non-App Views */}
        {viewState !== 'APP' && (
             <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#020617]/90 border-t border-white/10 backdrop-blur-md px-6 py-2 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        SYSTEM READY
                    </span>
                    <span className="hidden md:inline text-slate-700">|</span>
                    <span className="hidden md:inline">MODEL: UMBRAX-IRIS_5.1</span>
                    <span className="hidden md:inline text-slate-700">|</span>
                    <a href="https://app.fearyour.life/" target="_blank" rel="noreferrer" className="hidden md:inline text-amber-400 hover:text-amber-300 hover:shadow-[0_0_10px_rgba(251,191,36,0.4)] transition-all cursor-pointer">
                        F&Q // SYNTHESIS CORE
                    </a>
                </div>
                <div className="opacity-70">
                    ID: {sessionId}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;

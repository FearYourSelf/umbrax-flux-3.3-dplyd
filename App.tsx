
import React, { useState, useEffect, useRef } from 'react';
import Intro from './components/Intro';
import Generator from './components/Generator';

// --- COMPONENT: RESTRICTED ACCESS TOAST ---
interface ToastProps {
  show: boolean;
  onClose: () => void;
}

const RestrictedAccessToast: React.FC<ToastProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start pt-[20vh] pointer-events-none">
      <div className="pointer-events-auto w-auto max-w-[90vw] animate-fade-in-up">
        <div 
          className="bg-red-950/90 border border-red-500/50 backdrop-blur-md text-red-200 px-8 py-6 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.4)] flex flex-col items-center justify-center gap-4 text-center cursor-pointer group hover:bg-red-900/40 transition-colors"
          onClick={onClose}
          title="Click to dismiss"
        >
           <div className="p-3 bg-red-900/50 rounded-full shrink-0 animate-pulse">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
           </div>
           <div className="flex flex-col items-center">
               <h4 className="text-red-400 font-bold uppercase tracking-widest text-sm mb-2">Authorization Protocol</h4>
               <p className="font-mono text-xs md:text-sm leading-relaxed max-w-lg">
                  Access to this gated model is restricted. Authorization required. For inquiries, contact <span className="text-white font-bold hover:text-cyan-400 transition-colors bg-white/10 px-1 rounded mx-1">nsd@fearyour.life</span> or <span className="text-[#5865F2] font-bold hover:text-white transition-colors bg-[#5865F2]/10 px-1 rounded mx-1 inline-flex items-center gap-1">0_nsd <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.772-.6083 1.1588a18.2915 18.2915 0 00-7.4858 0c-.1636-.3868-.3973-.7835-.6128-1.1588a.0771.0771 0 00-.0785-.0371 19.718 19.718 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/></svg></span> on Discord.
               </p>
           </div>
        </div>
      </div>
    </div>
  );
};

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


type AppState = 'INTRO' | 'BOOT' | 'LOGIN' | 'APP';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<AppState>('INTRO');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [isExitingLogin, setIsExitingLogin] = useState(false);
  
  // Track authenticated user
  const [username, setUsername] = useState<string>('');
  
  // Mouse Parallax State
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Scroll State
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Toast State
  const [showRestrictedToast, setShowRestrictedToast] = useState(false);
  
  // Generate a random session ID on mount
  const [sessionId] = useState(() => Math.floor(10000000000 + Math.random() * 90000000000).toString());

  // --- REACTIVITY: DISABLE CONTEXT MENU ---
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault(); // Disable right click
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
        window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // --- REACTIVITY: CURSOR TRAIL (CANVAS) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let width = window.innerWidth;
      let height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      // Trail particles
      const trail: {x: number, y: number, age: number}[] = [];
      let mouseX = width / 2;
      let mouseY = height / 2;
      
      const handleResize = () => {
          width = window.innerWidth;
          height = window.innerHeight;
          canvas.width = width;
          canvas.height = height;
      };
      window.addEventListener('resize', handleResize);

      const handleMove = (e: MouseEvent) => {
          mouseX = e.clientX;
          mouseY = e.clientY;
      };
      window.addEventListener('mousemove', handleMove);

      const animate = () => {
          ctx.clearRect(0, 0, width, height);
          
          // Add new point
          trail.push({ x: mouseX, y: mouseY, age: 0 });

          // Draw trail
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          // Remove old points
          while (trail.length > 0 && trail[0].age > 20) {
              trail.shift();
          }

          if (trail.length > 1) {
              // Draw Glow
              ctx.shadowBlur = 10;
              ctx.shadowColor = '#22d3ee'; // Cyan
              ctx.beginPath();
              ctx.moveTo(trail[0].x, trail[0].y);
              for (let i = 1; i < trail.length; i++) {
                   const p = trail[i];
                   p.age++; // Age points
                   
                   // Quadratic Bezier for smoothness
                   // ctx.lineTo(p.x, p.y); 
                   // Simpler line is often faster and sufficient for this effect
                   ctx.lineTo(p.x, p.y);
              }
              ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
              ctx.lineWidth = 2;
              ctx.stroke();

              // Draw Head
              const head = trail[trail.length - 1];
              ctx.beginPath();
              ctx.arc(head.x, head.y, 2, 0, Math.PI * 2);
              ctx.fillStyle = '#fff';
              ctx.fill();
          }

          requestAnimationFrame(animate);
      };
      const animId = requestAnimationFrame(animate);

      return () => {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('mousemove', handleMove);
          cancelAnimationFrame(animId);
      };
  }, []);

  // --- REACTIVITY: INERTIAL SMOOTH SCROLL ---
  useEffect(() => {
    const body = document.body;
    const container = scrollContainerRef.current;
    if (!container) return;

    let current = 0;
    let target = 0;
    let ease = 0.075; // Lower = smoother/heavier

    // Set body height to container height for native scrollbar feeling (even if hidden)
    const resizeObserver = new ResizeObserver(() => {
        // Wrap in requestAnimationFrame to prevent "loop completed with undelivered notifications"
        requestAnimationFrame(() => {
            if (container) {
                document.body.style.height = `${container.scrollHeight}px`;
            }
        });
    });
    resizeObserver.observe(container);

    const onScroll = () => {
       target = window.scrollY;
    };
    
    window.addEventListener('scroll', onScroll);

    const animateScroll = () => {
       current += (target - current) * ease;
       // Round to avoid sub-pixel jitter issues on some displays
       // Apply transform
       if (container) {
           container.style.transform = `translateY(-${current}px)`;
       }
       requestAnimationFrame(animateScroll);
    };
    requestAnimationFrame(animateScroll);

    return () => {
        window.removeEventListener('scroll', onScroll);
        resizeObserver.disconnect();
        document.body.style.height = '';
    };
  }, [viewState]); // Re-run when state changes (content height changes)

  // --- REACTIVITY: MOUSE PARALLAX ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1; // -1 to 1
        const y = (e.clientY / window.innerHeight) * 2 - 1; // -1 to 1
        setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleIntroComplete = () => {
    setShowRestrictedToast(true);
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
      setUsername(passwordInput); // Store username
      setIsExitingLogin(true); // Trigger exit animation
      setTimeout(() => {
        setViewState('APP');
        setShowRestrictedToast(false); // Hide toast if still visible
      }, 800); // Wait for dissolve animation
    } else {
      setAuthError(true);
      setPasswordInput('');
    }
  };

  return (
    <>
    {/* Global Restricted Access Toast - Controlled */}
    <RestrictedAccessToast show={showRestrictedToast} onClose={() => setShowRestrictedToast(false)} />

    {/* Cursor Trail Canvas */}
    <canvas id="cursor-canvas"></canvas>

    {/* --- ENHANCED DYNAMIC BACKGROUND --- */}
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#020617]">
         
         {/* 1. Animated Aurora Gradient Base - Reverted Opacity to 40 */}
         <div className="absolute inset-0 bg-animated-gradient opacity-40"></div>

         {/* 2. 3D Perspective Grid Floor (Moves with mouse parallax) - Increased Opacity */}
         <div 
           className="absolute inset-0 transition-transform duration-100 ease-out"
           style={{ transform: `translate(${mousePos.x * -15}px, ${mousePos.y * -15}px)` }}
         >
             <div className="perspective-grid-floor opacity-50"></div>
         </div>

         {/* 3. Ceiling Grid (Flatter, subtler) - Fixed width and Opacity */}
         <div 
            className="absolute top-0 left-[-10%] w-[120%] h-[50%] bg-cyber-grid opacity-30"
            style={{ transform: `perspective(500px) rotateX(-10deg) translate(${mousePos.x * 10}px, ${mousePos.y * 10}px)` }}
         ></div>
         
         {/* 4. Floating Orbs - Brighter */}
         <div 
            className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-[100px] animate-pulse transition-transform duration-700 ease-out"
            style={{ transform: `translate(${mousePos.x * -30}px, ${mousePos.y * -30}px)` }}
         ></div>
         <div 
            className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-900/20 rounded-full blur-[100px] animate-pulse delay-1000 transition-transform duration-700 ease-out"
            style={{ transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)` }}
         ></div>
         
         {/* 5. Scanline & Vignette Overlays */}
         <div className="scanline-overlay opacity-20"></div>
         <div className="absolute inset-0 vignette-radial pointer-events-none"></div>
    </div>

    {/* Main Scrolling Container - Managed by JS for Smooth Inertia */}
    <div ref={scrollContainerRef} className="fixed top-0 left-0 w-full z-10 min-h-screen flex flex-col will-change-transform">
        
        {/* VIEW CONTROLLER */}
        {viewState === 'INTRO' && (
          <Intro onComplete={handleIntroComplete} />
        )}

        {viewState === 'BOOT' && (
          <BootSequence onComplete={handleBootComplete} />
        )}

        {viewState === 'LOGIN' && (
          <div className={`flex-1 flex items-center justify-center p-4 min-h-screen transition-all duration-700 ${isExitingLogin ? 'opacity-0 scale-110 blur-lg' : 'animate-fade-in'}`}>
            <div className="max-w-md w-full glass-panel rounded-2xl p-8 md:p-10 text-center border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.5)] relative backdrop-blur-xl animate-warp-in">
              
              {/* UMBRAX FLUX CORE LOGO - Animated (Matching Landing Page) */}
              <div className="relative mb-8 w-32 h-32 mx-auto flex items-center justify-center">
                  {/* Outer rotating ring - Linear seamless */}
                  <div className="absolute inset-0 rounded-full border border-cyan-500/20 border-t-cyan-400 animate-spin-slow-linear shadow-[0_0_30px_rgba(6,182,212,0.1)]"></div>
                  
                  {/* Inner rotating ring - Linear seamless reverse */}
                  <div className="absolute inset-4 rounded-full border border-blue-500/30 border-b-blue-400 animate-spin-reverse-linear"></div>
                  
                  {/* Core pulse - Sine wave breathing */}
                  <div className="absolute w-12 h-12 bg-cyan-500/10 rounded-full animate-breathe shadow-[0_0_40px_cyan]"></div>
                  
                  {/* Center solid */}
                  <div className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_20px_white]"></div>
                  
                  {/* Orbital particle */}
                  <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
                      <div className="absolute top-0 left-1/2 w-1 h-1 bg-cyan-300 rounded-full shadow-[0_0_5px_cyan]"></div>
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

        {viewState === 'APP' && (
          <div className="min-h-screen">
             <Generator initialId={sessionId} username={username} />
          </div>
        )}
    </div>
        
    {/* Persistent Footer for Non-App Views */}
    {viewState !== 'APP' && (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#020617]/90 border-t border-white/10 backdrop-blur-md px-6 py-2 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest whitespace-nowrap overflow-hidden">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 shrink-0">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    SYSTEM READY
                </span>
                <span className="hidden md:inline text-slate-700">|</span>
                <span className="hidden md:inline shrink-0">MODEL: NSD-CORE/70B (IRIS)</span>
                <span className="hidden md:inline text-slate-700">|</span>
                <span className="hidden md:flex text-red-500 font-bold tracking-tight text-[9px] select-text cursor-help items-center gap-2 overflow-hidden text-ellipsis">
                    CONTACT: 
                    <span className="text-white hover:text-cyan-400 transition-colors">nsd@fearyour.life</span> / 
                    <span className="text-[#5865F2] hover:text-white transition-colors flex items-center gap-1">
                        0_nsd 
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.772-.6083 1.1588a18.2915 18.2915 0 00-7.4858 0c-.1636-.3868-.3973-.7835-.6128-1.1588a.0771.0771 0 00-.0785-.0371 19.718 19.718 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/></svg>
                    </span>
                </span>
            </div>
            
            <div className="flex items-center gap-4 shrink-0">
                <a href="https://fearyour.life/" target="_blank" rel="noreferrer" className="hidden md:flex items-center gap-2 text-[10px] text-[#8b5bf5] hover:text-[#a78bfa] transition-all font-bold tracking-widest hover:shadow-[0_0_15px_rgba(139,91,245,0.4)]">
                    POWERED BY NSD-CORE/70B
                </a>
                <span className="opacity-70">ID: {sessionId}</span>
            </div>
        </div>
    )}
    </>
  );
};

export default App;

import React, { useState, useEffect } from 'react';

const Loader: React.FC = () => {
  const [step, setStep] = useState(0);
  
  const steps = [
    "Establishing secure connection to archives...",
    "Analyzing query parameters...",
    "Consulting research databases...",
    "Synthesizing visual matrix...",
    "Rendering high-fidelity output..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"></div>
      
      {/* Content */}
      <div className="relative w-full max-w-md p-8 flex flex-col items-center glass-panel rounded-2xl border border-white/10 shadow-2xl">
        
        {/* Spinner Graphic */}
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-t-2 border-l-2 border-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-r-2 border-b-2 border-blue-600 rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-4">
           <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 animate-[loading_2s_ease-in-out_infinite] w-1/2 rounded-full"></div>
        </div>

        <h3 className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">
           Processing Request
        </h3>
        <p className="text-slate-300 text-sm text-center font-light h-6 transition-all duration-300">
           {steps[step]}
        </p>
      </div>
    </div>
  );
};

export default Loader;
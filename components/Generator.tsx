
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  AspectRatio, 
  ImageResolution, 
  Aesthetic, 
  AIModel,
  GenerationOptions, 
  GeneratedImage,
  Preset,
  SelectionBox,
  ImageAdjustments
} from '../types';
import { generateImage, editImage, getPromptEnhancements } from '../services/geminiService';
import { extendImage, applyImageAdjustments, applyOutline, cropImage, applyWatermark } from '../services/imageUtils';
import Loader from './Loader';

interface GeneratorProps {
  initialId?: string;
  username?: string;
}

interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'error' | 'success' | 'system' | 'warn';
    message: string;
}

// --- COMPONENT: TOAST NOTIFICATION ---
const Toast: React.FC<{ message: string, visible: boolean }> = ({ message, visible }) => (
    <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="bg-amber-900/40 border border-amber-500/50 backdrop-blur-md text-amber-400 px-6 py-3 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.2)] flex items-center gap-3">
             <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             <span className="font-mono font-bold tracking-widest text-xs uppercase">{message}</span>
        </div>
    </div>
);

// --- COMPONENT: TILT PANEL (3D Holographic Effect + Glare) ---
interface TiltPanelProps {
    children: React.ReactNode;
    className?: string;
    intensity?: number;
}

const TiltPanel: React.FC<TiltPanelProps> = ({ children, className = "", intensity = 2 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg)");
    const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Calculate rotation using intensity prop
        const rotateX = ((y - centerY) / centerY) * -intensity;
        const rotateY = ((x - centerX) / centerX) * intensity;
        
        setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`);
        
        // Calculate Glare (Inverse position)
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;
        setGlare({ x: glareX, y: glareY, opacity: 0.4 });
    };

    const handleMouseLeave = () => {
        setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)");
        setGlare(prev => ({ ...prev, opacity: 0 }));
    };

    return (
        <div 
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`transition-transform duration-200 ease-out relative overflow-hidden ${className}`}
            style={{ transform }}
        >
            {/* Dynamic Glare Overlay */}
            <div 
                className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-500"
                style={{
                    background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.15), transparent 60%)`,
                    opacity: glare.opacity,
                    mixBlendMode: 'overlay'
                }}
            />
            {children}
        </div>
    );
};

// --- COMPONENT: MAGNETIC BUTTON (Pulls to cursor) ---
const MagneticButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className, ...props }) => {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        // Move button 20% of distance to cursor
        setPos({ x: x * 0.2, y: y * 0.2 });
    };

    const handleMouseLeave = () => {
        setPos({ x: 0, y: 0 });
    };

    return (
        <button 
            ref={btnRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`transition-transform duration-200 ease-out ${className}`}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            {...props}
        >
            {children}
        </button>
    );
};


const THEMATIC_ERRORS = [
    "NEURAL LINK SEVERED: DATA PACKET LOSS",
    "FLUX CORE DIVERGENCE DETECTED",
    "SYNTHESIS MATRIX UNSTABLE",
    "QUANTUM ENTANGLEMENT FAILURE",
    "MEMORY BUFFER OVERFLOW IN SECTOR 7",
    "RENDER PIPELINE DESYNCHRONIZATION",
    "AI MODEL HALLUCINATION THRESHOLD EXCEEDED"
];

type ConsoleSize = 'small' | 'medium' | 'full';

const Generator: React.FC<GeneratorProps> = ({ initialId, username }) => {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Reactive Input State
  const [inputIntensity, setInputIntensity] = useState(0);

  // Default Session ID (Random if not provided)
  const [defaultId] = useState(initialId || Math.floor(10000000000 + Math.random() * 90000000000).toString());

  // Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image & History State
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Gallery State
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [showGallery, setShowGallery] = useState(false);

  // Void Mode State
  const [isVoidMode, setIsVoidMode] = useState(false);
  const [isCriticalError, setIsCriticalError] = useState(false);

  // Comparison Mode
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  
  const [isLoading, setIsLoading] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Animation Trigger
  const [animateImage, setAnimateImage] = useState(false);

  // Editing State
  const [isTargetMode, setIsTargetMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);

  // View Control State (Zoom/Pan)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    sepia: 0,
    grayscale: 0
  });

  // Options State
  const [options, setOptions] = useState<GenerationOptions>({
    aspectRatio: AspectRatio.SQUARE,
    resolution: ImageResolution.RES_1K,
    aesthetic: Aesthetic.GENERAL, 
    model: AIModel.FLASH, 
  });
  const [customRatioInput, setCustomRatioInput] = useState("21:9");

  // Presets State
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);

  // Download State
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);

  // Console State
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleSize, setConsoleSize] = useState<ConsoleSize>('small');
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [consoleInput, setConsoleInput] = useState('');
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null); 

  // --- RATE LIMIT STATE ---
  const [hourlyUsage, setHourlyUsage] = useState<number[]>([]);
  const [toastState, setToastState] = useState({ visible: false, message: '' });
  
  // Load Rate Limit
  useEffect(() => {
    try {
        const stored = localStorage.getItem('umbrax_hourly_usage');
        if (stored) setHourlyUsage(JSON.parse(stored));
    } catch(e) {}
  }, []);

  // Save Rate Limit
  useEffect(() => {
    localStorage.setItem('umbrax_hourly_usage', JSON.stringify(hourlyUsage));
  }, [hourlyUsage]);

  // Rate Limit Check Function
  const checkRateLimit = () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const valid = hourlyUsage.filter(t => now - t < oneHour);
    
    if (valid.length !== hourlyUsage.length) setHourlyUsage(valid);

    if (valid.length >= 20) {
        const oldest = Math.min(...valid);
        const resetTime = oldest + oneHour;
        const minsLeft = Math.ceil((resetTime - now) / 60000);
        
        setToastState({ visible: true, message: `HOURLY LIMIT REACHED. RESUME IN ${minsLeft} MIN.` });
        setTimeout(() => setToastState(s => ({ ...s, visible: false })), 5000);
        logToConsole(`RATE LIMIT: QUOTA EXCEEDED (${valid.length}/20). RESET IN ${minsLeft}m`, 'warn');
        return false;
    }
    return true;
  };

  const incrementRateLimit = () => {
      setHourlyUsage(prev => [...prev, Date.now()]);
  };

  useEffect(() => {
      const length = prompt.length;
      setInputIntensity(Math.min(length / 100, 1));
  }, [prompt]);

  const triggerCriticalError = () => {
      setIsCriticalError(true);
      document.body.classList.add('theme-critical');
      setTimeout(() => {
          setIsCriticalError(false);
          document.body.classList.remove('theme-critical');
      }, 4000);
  };

  const logToConsole = (message: string | object, type: LogEntry['type'] = 'info') => {
    let msgString = "";
    if (typeof message === 'object') {
        try {
            msgString = JSON.stringify(message, null, 2);
        } catch (e) {
            msgString = String(message);
        }
    } else {
        msgString = message;
    }

    const newLog: LogEntry = {
        id: Date.now().toString() + Math.random(),
        timestamp: new Date().toLocaleTimeString([], { hour12: false }) + '.' + new Date().getMilliseconds().toString().padStart(3, '0'),
        type,
        message: msgString
    };
    setConsoleLogs(prev => [...prev, newLog]);
  };

  useEffect(() => {
    if (isConsoleOpen && consoleContainerRef.current) {
        consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [consoleLogs, isConsoleOpen]);

  useEffect(() => {
      if (isConsoleOpen && consoleInputRef.current) {
          setTimeout(() => {
              consoleInputRef.current?.focus({ preventScroll: true });
          }, 50);
      }
  }, [isConsoleOpen]);

  const toggleConsole = () => {
      setIsConsoleOpen(!isConsoleOpen);
      if (!isConsoleOpen) setConsoleSize('small');
  };

  useEffect(() => {
      logToConsole("UMBRAX KERNEL INITIALIZED...", 'system');
      logToConsole(`SESSION ID: ${initialId || defaultId}`, 'info');
      logToConsole(`USER: ${username || 'GUEST'}`, 'info');
      logToConsole("CONNECTING TO NSD-CORE/70B API NODE...", 'warn');
      logToConsole("CONNECTION ESTABLISHED. READY FOR INPUT.", 'success');
  }, []);

  const handleConsoleCommand = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          const fullCmd = consoleInput.trim();
          if (!fullCmd) return;
          
          const args = fullCmd.split(' ');
          const cmd = args[0].toLowerCase();
          
          logToConsole(`> ${fullCmd}`, 'info');
          setConsoleInput('');

          switch(cmd) {
              case 'help':
                  logToConsole("AVAILABLE COMMANDS:", 'system');
                  logToConsole("CORE: help, clear, ver, uptime, date, whoami, exit, error_test", 'info');
                  logToConsole("ADMIN: nsd, creator, socials, root, lockdown, unlock", 'warn');
                  logToConsole("NET:  ping, trace, scan, ipconfig, netstat, nslookup, ssh, portscan", 'info');
                  logToConsole("SYS:  sys_status, top, ps, dmesg, kill, reboot, env, uname, coolant", 'info');
                  logToConsole("FILE: ls, cat, mkdir, rm, touch, chmod, du, decrypt", 'info');
                  logToConsole("MISC: matrix, weather, quote, neofetch, override, sudo, quantum", 'info');
                  break;
              case 'error_test':
                  logToConsole("TRIGGERING ARTIFICIAL SYSTEM FAILURE...", 'error');
                  triggerCriticalError();
                  break;
              case 'lockdown':
                  logToConsole("OVERRIDING SAFETY PROTOCOLS...", 'warn');
                  setHourlyUsage(Array(20).fill(Date.now()));
                  setToastState({ visible: true, message: "HOURLY LIMIT REACHED. SYSTEM LOCKED." });
                  setTimeout(() => setToastState(s => ({ ...s, visible: false })), 5000);
                  break;
              case 'unlock':
              case 'reset_limit':
                  setHourlyUsage([]);
                  setToastState({ visible: false, message: "" });
                  logToConsole("ADMIN OVERRIDE: QUOTA RESET.", 'success');
                  break;
              case 'nsd':
              case 'admin':
              case 'creator':
                  logToConsole("USER IDENTITY: NotSoDangerous", 'warn');
                  logToConsole("ROLE: SUPREME SYSTEM ARCHITECT / VOID ENGINEER", 'warn');
                  break;
              case 'socials':
                  logToConsole("GITHUB:  @NotSoDangerous", 'success');
                  break;
              case 'clear':
              case 'cls':
                  setConsoleLogs([]);
                  break;
              case 'sys_status':
                  logToConsole("ALL SYSTEMS NOMINAL.", 'success');
                  break;
              case 'exit':
                  setIsConsoleOpen(false);
                  break;
              case 'reboot':
                  logToConsole("SYSTEM REBOOT INITIATED...", 'warn');
                  setTimeout(() => {
                      setConsoleLogs([]);
                      logToConsole("UMBRAX KERNEL INITIALIZED...", 'system');
                      logToConsole("REBOOT SUCCESSFUL. READY.", 'success');
                  }, 2500);
                  break;
              default:
                  if (cmd !== '') logToConsole(`UNKNOWN COMMAND: "${cmd}"`, 'error');
          }
      }
  };

  useEffect(() => {
    const savedPresets = localStorage.getItem('infogenius_presets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
        logToConsole("USER PRESETS LOADED", 'success');
      } catch (e) { console.error("Failed to load presets", e); }
    }
  }, []);

  useEffect(() => {
    if (generatedImage && scrollRef.current) {
       scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generatedImage]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectionBox(null);
    setAnimateImage(true);
    setAdjustments({
        brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, grayscale: 0
    });
    
    if (options.aspectRatio === AspectRatio.CUSTOM && options.customRatioValue) {
        setSelectionBox({ x: 10, y: 10, w: 80, h: 80 / options.customRatioValue }); 
        setIsTargetMode(true);
        setZoom(1);
        setPan({x:0, y:0});
    } else {
        setSelectionBox(null);
        setIsTargetMode(false);
    }

    const t = setTimeout(() => setAnimateImage(false), 1000);
    return () => clearTimeout(t);
  }, [generatedImage?.id]);

  useEffect(() => {
    const element = imageWrapperRef.current;
    if (!element) return; 

    const handleWheelNative = (e: WheelEvent) => {
        if (!isTargetMode) { 
            e.preventDefault(); 
            const scaleAmount = -e.deltaY * 0.001;
            setZoom(prev => Math.min(Math.max(0.5, prev + scaleAmount), 5));
        }
    };

    element.addEventListener('wheel', handleWheelNative, { passive: false });

    return () => {
        element.removeEventListener('wheel', handleWheelNative);
    };
  }, [generatedImage, isTargetMode]); 

  const updateHistory = (newImage: GeneratedImage, isNewGeneration: boolean = false) => {
    if (isNewGeneration) {
      setHistory([newImage]);
      setHistoryIndex(0);
    } else {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newImage);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    setGeneratedImage(newImage);
    setGallery(prev => [newImage, ...prev]);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setGeneratedImage(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setGeneratedImage(history[newIndex]);
    }
  };
  
  const jumpToHistory = (index: number) => {
      if (index >= 0 && index < history.length) {
          setHistoryIndex(index);
          setGeneratedImage(history[index]);
      }
  }

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedImage) return;
    if (!checkRateLimit()) return;
    
    setIsLoading(true);
    setProcessingMessage("INITIATING SYNTHESIS...");
    setError(null);
    setShowSuggestions(false);
    
    logToConsole(`INITIATING GENERATION: "${prompt.substring(0, 30)}..."`, 'info');

    try {
      const finalRatio = options.aspectRatio === AspectRatio.CUSTOM 
        ? AspectRatio.SQUARE 
        : options.aspectRatio;

      const image = await generateImage(
        prompt, 
        { ...options, aspectRatio: finalRatio },
        uploadedImage || undefined
      );
      
      const cleanBase64 = image.base64;
      const watermarkedBase64 = await applyWatermark(image.base64);
      const finalImage: GeneratedImage = { 
          ...image, 
          base64: watermarkedBase64,
          cleanBase64: cleanBase64 
      };

      updateHistory(finalImage, true);
      incrementRateLimit(); 
      logToConsole("GENERATION COMPLETE. IMAGE RENDERED.", 'success');
      
    } catch (err: any) {
      console.error(err);
      let errorMsg = String(err);
      logToConsole(`RUNTIME ERROR: ${errorMsg}`, 'error');
      setError(THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)]);
      triggerCriticalError(); 
    } finally {
      setIsLoading(false);
      setProcessingMessage("");
    }
  };

  const handleEdit = async () => {
    if (!generatedImage || !editPrompt.trim()) return;
    if (!checkRateLimit()) return;
    
    setIsLoading(true);
    setProcessingMessage("MODULATING VISUAL DATA...");
    setError(null);
    logToConsole(`INITIATING EDIT: "${editPrompt.substring(0, 30)}..."`, 'info');

    try {
      let finalPrompt = editPrompt;
      if (selectionBox) {
         const top = selectionBox.y.toFixed(1);
         const left = selectionBox.x.toFixed(1);
         const width = selectionBox.w.toFixed(1);
         const height = selectionBox.h.toFixed(1);
         finalPrompt = `Apply this change EXCLUSIVELY to the region bounded by Top: ${top}%, Left: ${left}%, Width: ${width}%, Height: ${height}%. Task: ${editPrompt}`;
      }

      const sourceImage = {
          ...generatedImage,
          base64: generatedImage.cleanBase64 || generatedImage.base64
      };

      const image = await editImage(sourceImage, finalPrompt, options);
      
      const cleanBase64 = image.base64;
      const watermarkedBase64 = await applyWatermark(image.base64);
      const finalImage = { 
          ...image, 
          base64: watermarkedBase64,
          cleanBase64: cleanBase64
      };

      updateHistory(finalImage);
      incrementRateLimit(); 
      setEditPrompt('');
      if (!options.customRatioValue) {
          setSelectionBox(null);
          setIsTargetMode(false);
      }
      logToConsole("EDIT COMPLETE. MATRIX UPDATED.", 'success');
    } catch (err: any) {
      console.error(err);
      logToConsole(`EDIT ERROR: ${String(err)}`, 'error');
      setError(THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)]);
      triggerCriticalError(); 
    } finally {
      setIsLoading(false);
      setProcessingMessage("");
    }
  };

  const handleOutpaint = async () => {
    if (!generatedImage) return;
    if (!checkRateLimit()) return;
    
    setIsLoading(true);
    setProcessingMessage("EXPANDING CANVAS BOUNDARIES...");
    
    try {
      const sourceBase64 = generatedImage.cleanBase64 || generatedImage.base64;
      const extendedBase64 = await extendImage(sourceBase64);
      const extendedImage: GeneratedImage = {
        ...generatedImage,
        id: Date.now().toString(),
        base64: extendedBase64,
        cleanBase64: extendedBase64,
        timestamp: Date.now()
      };
      
      const filledImage = await editImage(extendedImage, "Seamlessly extend the scene into the empty dark area, matching the style and lighting of the central image.", options);
      const filledClean = filledImage.base64;
      const watermarkedBase64 = await applyWatermark(filledClean);
      const finalImage = { 
          ...filledImage, 
          base64: watermarkedBase64,
          cleanBase64: filledClean
      };

      updateHistory(finalImage); 
      incrementRateLimit(); 
      logToConsole("OUTPAINTING COMPLETE. HORIZON EXPANDED.", 'success');
    } catch (err: any) {
       console.error(err);
       logToConsole(`OUTPAINT ERROR: ${String(err)}`, 'error');
       setError(THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)]);
       triggerCriticalError();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = `data:${generatedImage.mimeType};base64,${generatedImage.base64}`;
      link.download = `flux_synthesis_${generatedImage.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowDownloadConfirm(false);
      logToConsole(`ASSET DOWNLOADED: flux_synthesis_${generatedImage.id}.png`, 'success');
    }
  };

  const handlePresetSave = () => {
    if (!newPresetName.trim()) return;
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: newPresetName,
      options: { ...options }
    };
    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    localStorage.setItem('infogenius_presets', JSON.stringify(updatedPresets));
    setNewPresetName('');
    setShowPresetSave(false);
  };

  const loadPreset = (preset: Preset) => {
    setOptions(preset.options);
    setPresetDropdownOpen(false);
  };
  
  const deletePreset = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = presets.filter(p => p.id !== id);
      setPresets(updated);
      localStorage.setItem('infogenius_presets', JSON.stringify(updated));
  }

  const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault(); 
      if (!generatedImage) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      if (!imageRef.current) return;
      const rect = imageRef.current.getBoundingClientRect();

      if (isTargetMode) {
          const xPct = ((e.clientX - rect.left) / rect.width) * 100;
          const yPct = ((e.clientY - rect.top) / rect.height) * 100;
          setIsDrawingBox(true);
          setDrawStart({ x: xPct, y: yPct });
          setSelectionBox({ x: xPct, y: yPct, w: 0, h: 0 });
      } else {
          setIsPanning(true);
          setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      e.preventDefault(); 
      if (!generatedImage || !imageRef.current) return;

      if (isTargetMode && isDrawingBox && drawStart) {
          const rect = imageRef.current.getBoundingClientRect();
          let currX = ((e.clientX - rect.left) / rect.width) * 100;
          let currY = ((e.clientY - rect.top) / rect.height) * 100;
          currX = Math.max(0, Math.min(100, currX));
          currY = Math.max(0, Math.min(100, currY));
          const newX = Math.min(drawStart.x, currX);
          const newY = Math.min(drawStart.y, currY);
          const newW = Math.abs(currX - drawStart.x);
          const newH = Math.abs(currY - drawStart.y);
          setSelectionBox({ x: newX, y: newY, w: newW, h: newH });
      } else if (isPanning) {
          setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      e.preventDefault();
      if (e.currentTarget) e.currentTarget.releasePointerCapture(e.pointerId);
      setIsPanning(false);
      setIsDrawingBox(false);
      setDrawStart(null);
  };

  const toggleTargetMode = () => {
      const newMode = !isTargetMode;
      setIsTargetMode(newMode);
      if (newMode) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
          setSelectionBox(null);
      } else {
          setSelectionBox(null);
      }
  };

  return (
    <div className="min-h-screen bg-transparent text-white font-sans selection:bg-cyan-500/30 selection:text-cyan-100 overflow-x-hidden pb-20">
      
      <Toast message={toastState.message} visible={toastState.visible} />

      <header className="pt-8 pb-6 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center animate-slide-down relative gap-4 md:gap-0">
        <div className="flex flex-col md:flex-row w-full md:w-auto items-center justify-between md:justify-start">
            <div className="text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tighter">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">UMBRAX</span> 
                <span className="text-cyan-500 ml-2 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">FLUX 3</span>
              </h2>
              <p className="text-xs text-slate-500 tracking-[0.5em] mt-1 uppercase font-mono">
                Dreams Engineered.
              </p>
            </div>
        </div>
        
        <div className="hidden md:flex gap-4">
            <MagneticButton 
              onClick={() => setShowGallery(true)}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-cyan-500 hover:text-cyan-400 transition-all backdrop-blur-md uppercase text-xs tracking-widest font-bold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Gallery
            </MagneticButton>
            
            <button onClick={() => setIsVoidMode(!isVoidMode)} className="text-slate-600 hover:text-white transition-colors flex flex-col items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <span className="text-[8px] uppercase tracking-wider">Void Mode</span>
            </button>
        </div>

        <div className="flex md:hidden gap-4 w-full justify-center mt-4">
             <MagneticButton onClick={() => setShowGallery(true)} className="flex items-center gap-2 px-5 py-2 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-cyan-500 hover:text-cyan-400 transition-all backdrop-blur-md uppercase text-xs tracking-widest font-bold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Gallery
            </MagneticButton>
             <button onClick={() => setIsVoidMode(!isVoidMode)} className="text-slate-600 hover:text-white transition-colors flex flex-col items-center gap-1">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </button>
        </div>
      </header>
      
      <div className="mt-6 md:mt-0 md:absolute md:top-12 md:left-1/2 md:-translate-x-1/2 z-50 flex justify-center w-full pointer-events-none">
          <div className="bg-slate-900/80 border border-yellow-500/30 px-4 py-1 rounded-full backdrop-blur-md shadow-[0_0_15px_rgba(234,179,8,0.1)] pointer-events-auto">
              <span className="text-[10px] text-yellow-500 font-mono font-bold tracking-widest">POWERED BY NSD-CORE/70B</span>
          </div>
      </div>

      <main className={`max-w-7xl mx-auto px-4 md:px-8 pb-24 transition-opacity duration-500 ${isVoidMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        <div className="animate-slide-left relative z-30">
        <TiltPanel className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-1" intensity={0.5}>
          <div className="p-6 md:p-8 space-y-8 relative">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
              {uploadedImage && (
                  <div className="absolute -top-20 left-0 z-40">
                      <div className="relative group/preview">
                          <img src={`data:image/png;base64,${uploadedImage}`} alt="Upload" className="h-16 w-16 object-cover rounded-lg border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
                          <button onClick={() => setUploadedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                      </div>
                  </div>
              )}

              <div className="relative flex items-center">
                  <div className="absolute left-4 text-cyan-500 animate-pulse font-mono text-lg">{`>_`}</div>
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="ENTER YOUR SYNTHESIS DIRECTIVE"
                    className="w-full bg-[#050b14] border border-slate-800 rounded-xl py-5 pl-12 pr-32 text-lg md:text-xl font-light tracking-wide text-white placeholder-slate-600 outline-none focus:border-cyan-500/50 focus:shadow-[0_0_30px_rgba(6,182,212,0.15)] transition-all duration-300 font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                  <div className="absolute right-2 flex items-center gap-2">
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-cyan-400 transition-colors rounded-lg hover:bg-white/5">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64 = (reader.result as string).split(',')[1];
                                    setUploadedImage(base64);
                                };
                                reader.readAsDataURL(file);
                            }
                        }} />
                      <button onClick={async () => {
                           if(!prompt) return;
                           const sugs = await getPromptEnhancements(prompt);
                           setSuggestions(sugs);
                           setShowSuggestions(true);
                        }} className="p-2 text-slate-500 hover:text-yellow-400 transition-colors rounded-lg hover:bg-white/5">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </button>
                  </div>
              </div>
              
              {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-cyan-500/30 rounded-xl overflow-hidden z-50 shadow-2xl animate-fade-in">
                      <div className="px-4 py-2 bg-cyan-950/30 border-b border-cyan-500/20 flex justify-between items-center">
                          <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">AI Suggestions</span>
                          <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-white">&times;</button>
                      </div>
                      {suggestions.map((s, i) => (
                          <button key={i} onClick={() => { setPrompt(s); setShowSuggestions(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors border-b border-white/5 last:border-0">
                              {s}
                          </button>
                      ))}
                  </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Model</label>
                <div className="relative group">
                  <select value={options.model} onChange={(e) => setOptions({ ...options, model: e.target.value as AIModel })} className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-xs font-mono text-cyan-100 outline-none focus:border-cyan-500 transition-all cursor-pointer hover:bg-slate-800">
                    <option value={AIModel.FLASH}>NSD-CORE/70B (IRIS)</option>
                    <option value={AIModel.IMAGEN}>NSD-GEN/2.5</option>
                    <option value={AIModel.PRO_IMAGE}>NSD-QUANTUM/3.0 (ULTRA)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Aesthetic</label>
                <div className="relative group">
                  <select value={options.aesthetic} onChange={(e) => setOptions({ ...options, aesthetic: e.target.value as Aesthetic })} className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-xs font-mono text-cyan-100 outline-none focus:border-cyan-500 transition-all cursor-pointer hover:bg-slate-800">
                    {Object.values(Aesthetic).map((style) => ( <option key={style} value={style}>{style}</option> ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Ratio</label>
                <div className="relative group">
                  <select value={options.aspectRatio} onChange={(e) => setOptions({ ...options, aspectRatio: e.target.value as AspectRatio })} className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-xs font-mono text-cyan-100 outline-none focus:border-cyan-500 transition-all cursor-pointer hover:bg-slate-800">
                    {Object.values(AspectRatio).map((ratio) => ( <option key={ratio} value={ratio}>{ratio}</option> ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
                </div>
                {options.aspectRatio === AspectRatio.CUSTOM && (
                    <div className="absolute top-full left-0 mt-2 w-full z-20 animate-fade-in">
                        <input type="text" value={customRatioInput} onChange={(e) => {
                                setCustomRatioInput(e.target.value);
                                const parts = e.target.value.split(':');
                                if (parts.length === 2) {
                                    const w = parseFloat(parts[0]);
                                    const h = parseFloat(parts[1]);
                                    if (!isNaN(w) && !isNaN(h) && h !== 0) setOptions(prev => ({ ...prev, customRatioValue: w/h }));
                                }
                            }} className="w-full bg-slate-900 border border-cyan-500 text-white text-xs p-2 rounded" placeholder="e.g. 21:9" />
                    </div>
                )}
              </div>

              <div className="flex gap-2 items-end">
                <MagneticButton onClick={handleGenerate} disabled={isLoading || (!prompt && !uploadedImage)} className={`flex-1 h-[42px] rounded-lg font-bold tracking-wider uppercase text-xs transition-all duration-300 flex items-center justify-center relative overflow-hidden ${ isLoading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]' }`}>
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                   <span className="relative z-10">{isLoading ? 'Synthesizing...' : 'Initiate'}</span>
                </MagneticButton>
                 <div className="relative">
                    <button onClick={() => setPresetDropdownOpen(!presetDropdownOpen)} className="h-[42px] px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </button>
                    {presetDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-2 animate-fade-in">
                            <button onClick={() => { setShowPresetSave(true); setPresetDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-cyan-400 hover:bg-slate-800 rounded mb-2 flex items-center gap-2">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Save Current Settings
                            </button>
                            <div className="h-px bg-slate-800 my-1"></div>
                            {presets.length === 0 && <p className="text-[10px] text-slate-600 px-3 py-2">No presets saved</p>}
                            {presets.map(p => (
                                <div key={p.id} className="flex items-center justify-between group/preset hover:bg-slate-800 rounded px-2">
                                    <button onClick={() => loadPreset(p)} className="flex-1 text-left py-2 text-xs text-slate-300"> {p.name} </button>
                                    <button onClick={(e) => deletePreset(p.id, e)} className="text-red-500 opacity-0 group-hover/preset:opacity-100 hover:text-red-400"> &times; </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </TiltPanel>
        </div>
        
        {history.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto py-2 px-1 custom-scrollbar animate-fade-in">
                {history.map((img, idx) => (
                    <button key={img.id} onClick={() => jumpToHistory(idx)} className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border transition-all ${historyIndex === idx ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-slate-700 hover:border-slate-500 opacity-60 hover:opacity-100'}`}>
                        <img src={`data:${img.mimeType};base64,${img.base64}`} alt="" className="w-full h-full object-cover" />
                    </button>
                ))}
            </div>
        )}

        <div ref={scrollRef} className="mt-6 animate-slide-up relative z-20">
        <TiltPanel className={`glass-panel rounded-2xl border-white/10 overflow-hidden min-h-[500px] flex flex-col items-center justify-center relative transition-all duration-500 ${generatedImage ? 'bg-slate-950' : 'bg-slate-900/30'}`} intensity={0.5}>
            {isLoading && <Loader />}
            {!generatedImage && !isLoading && !error && (
              <div className="text-center space-y-4 opacity-30">
                 <div className="w-24 h-24 border-2 border-dashed border-slate-500 rounded-full mx-auto flex items-center justify-center animate-[spin_20s_linear_infinite]"><div className="w-2 h-2 bg-slate-500 rounded-full"></div></div>
                 <p className="text-sm font-mono tracking-widest uppercase">System Idle</p>
              </div>
            )}
            {error && !isLoading && (
                <div className="text-center max-w-lg px-6 flex flex-col items-center">
                   <div className="text-red-500 text-4xl mb-4">⚠</div>
                   <h3 className="text-red-400 font-bold tracking-widest uppercase mb-2">System Error</h3>
                   <p className="text-red-300/70 font-mono text-sm mb-6">{error}</p>
                </div>
            )}
            {generatedImage && !isLoading && !error && (
                <div ref={imageWrapperRef} className="relative w-full h-full flex flex-col">
                   <div className="relative w-full flex-1 overflow-hidden flex items-center justify-center bg-slate-950 p-4 touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} style={{ cursor: isTargetMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}>
                       <div className={`relative shadow-2xl transition-transform duration-75 ease-out w-fit mx-auto ${animateImage ? 'animate-scan' : ''}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }}>
                           <img ref={imageRef} src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} alt="Generated" className="max-w-full max-h-[70vh] object-contain select-none pointer-events-none border border-white/10" />
                           {isTargetMode && selectionBox && (
                               <div className="absolute border-2 border-cyan-500 bg-cyan-500/20 shadow-[0_0_15px_cyan] z-10 pointer-events-none" style={{ left: `${selectionBox.x}%`, top: `${selectionBox.y}%`, width: `${selectionBox.w}%`, height: `${selectionBox.h}%` }}>
                                   <div className="absolute -top-6 left-0 bg-cyan-500 text-black text-[10px] font-bold px-1">TARGET</div>
                               </div>
                           )}
                       </div>
                   </div>
                   <div className="w-full bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-4 flex flex-col md:flex-row items-center gap-4">
                       <div className="flex items-center gap-2">
                           <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 hover:bg-white/10 rounded disabled:opacity-30 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                           <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-white/10 rounded disabled:opacity-30 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
                       </div>
                       <MagneticButton onClick={toggleTargetMode} className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${isTargetMode ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-cyan-500'}`}> {isTargetMode ? 'Stop Selecting' : 'Select Area'} </MagneticButton>
                       <div className="flex-1 w-full relative">
                           <input type="text" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEdit()} placeholder={isTargetMode ? "Describe change for selected area..." : "Describe change for whole image..."} className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-cyan-500 outline-none transition-colors" />
                           <button onClick={handleEdit} disabled={!editPrompt.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-cyan-300 disabled:opacity-30">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                           </button>
                       </div>
                       <div className="flex gap-2">
                           <button onClick={handleOutpaint} className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-xs hover:bg-slate-700 hover:text-white transition-colors">Extend</button>
                           <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 border border-slate-600 rounded text-xs transition-colors ${showFilters ? 'bg-cyan-900 text-cyan-200 border-cyan-500' : 'bg-slate-800 hover:bg-slate-700'}`}>Filters</button>
                           <button onClick={() => setShowDownloadConfirm(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs shadow-[0_0_10px_rgba(37,99,235,0.3)]"> Download </button>
                       </div>
                   </div>
                   {showFilters && (
                       <div className="w-full bg-slate-900/90 border-t border-white/10 p-4 grid grid-cols-2 md:grid-cols-6 gap-4 animate-fade-in">
                           {Object.entries(adjustments).map(([key, val]) => (
                               <div key={key} className="space-y-1">
                                   <label className="text-[10px] uppercase text-slate-500">{key}</label>
                                   <input type="range" min={0} max={key === 'blur' ? 20 : 200} value={val} onChange={(e) => setAdjustments(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="w-full accent-cyan-500 h-1 bg-slate-700 rounded cursor-pointer" />
                               </div>
                           ))}
                           <div className="flex items-end">
                               <button onClick={async () => {
                                       if(!generatedImage) return;
                                       const source = generatedImage.cleanBase64 || generatedImage.base64;
                                       const filteredClean = await applyImageAdjustments(source, adjustments);
                                       const watermarked = await applyWatermark(filteredClean);
                                       updateHistory({ ...generatedImage, id: Date.now().toString(), base64: watermarked, cleanBase64: filteredClean, timestamp: Date.now() });
                                   }} className="w-full py-1 bg-cyan-600 text-white text-xs rounded">Apply</button>
                           </div>
                       </div>
                   )}
                </div>
            )}
        </TiltPanel>
        </div>
      </main>
      
      {isConsoleOpen && createPortal(
          <div ref={consoleContainerRef} className={`fixed bottom-0 left-0 right-0 z-[100] bg-[#0a0f1e]/95 backdrop-blur-xl border-t border-cyan-500/30 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] transition-all duration-300 animate-fade-in-up font-mono text-xs text-green-400 flex flex-col ${ consoleSize === 'small' ? 'h-[200px]' : consoleSize === 'medium' ? 'h-[50vh]' : 'h-[100vh]' }`}>
              <div className="flex justify-between items-center px-4 py-1 bg-cyan-950/50 border-b border-cyan-500/20 select-none shrink-0">
                  <span className="tracking-widest text-cyan-500 uppercase text-[10px]">UMBRAX_KERNEL_DEBUG_SHELL</span>
                  <div className="flex items-center gap-3">
                      <button onClick={() => setConsoleSize(consoleSize === 'small' ? 'medium' : consoleSize === 'medium' ? 'full' : 'small')} className="hover:text-white text-cyan-600"> {consoleSize === 'full' ? '⤓' : '⤒'} </button>
                      <button onClick={toggleConsole} className="hover:text-white text-red-500">[CLOSE]</button>
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar bg-black/40">
                  {consoleLogs.map((log) => (
                      <div key={log.id} className={`flex gap-2 ${log.type === 'error' ? 'text-red-500' : log.type === 'warn' ? 'text-yellow-400' : log.type === 'system' ? 'text-cyan-400' : 'text-green-400/80'}`}>
                          <span className="opacity-50 text-[10px] shrink-0">[{log.timestamp}]</span>
                          <span className="break-all whitespace-pre-wrap font-mono">{log.message}</span>
                      </div>
                  ))}
              </div>
              <div className="p-2 bg-black/60 border-t border-white/5 flex items-center gap-2 pb-8 md:pb-2 shrink-0">
                  <span className="text-cyan-500">{`>`}</span>
                  <input ref={consoleInputRef} type="text" value={consoleInput} onChange={(e) => setConsoleInput(e.target.value)} onKeyDown={handleConsoleCommand} className="flex-1 bg-transparent outline-none text-white placeholder-white/20" placeholder="enter system command..." autoFocus />
              </div>
          </div>,
          document.body
      )}

      {showDownloadConfirm && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                  <h3 className="text-lg font-bold text-white mb-2">CONFIRM DOWNLOAD</h3>
                  <p className="text-slate-400 text-sm mb-6">Initiate secure transfer of visual asset to local storage?</p>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setShowDownloadConfirm(false)} className="px-4 py-2 text-slate-400 hover:text-white text-xs uppercase">Cancel</button>
                      <button onClick={handleDownload} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded text-xs uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)]">Proceed</button>
                  </div>
              </div>
          </div>,
          document.body
      )}
      
      {showGallery && createPortal(
        <div className="fixed inset-0 z-40 bg-[#020617]/95 backdrop-blur-xl flex flex-col animate-fade-in">
           <div className="p-6 flex justify-between items-center border-b border-white/10 bg-slate-900/50">
              <h2 className="text-2xl font-bold text-white tracking-tighter"><span className="text-cyan-500">FLUX</span> ARCHIVE</h2>
              <button onClick={() => setShowGallery(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
           </div>
           <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {gallery.length === 0 && (
                   <div className="col-span-full flex flex-col items-center justify-center text-slate-500 h-64 opacity-50">
                       <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       <p>NO ASSETS IN ARCHIVE</p>
                   </div>
               )}
               {gallery.map((img) => (
                   <div key={img.id} className="group relative aspect-square rounded-lg overflow-hidden border border-white/5 hover:border-cyan-500/50 transition-all cursor-pointer" onClick={() => { setGeneratedImage(img); setShowGallery(false); }}>
                       <img src={`data:${img.mimeType};base64,${img.base64}`} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <span className="text-cyan-400 text-xs font-bold uppercase tracking-widest border border-cyan-500 px-3 py-1 rounded">LOAD</span>
                       </div>
                       <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/80 text-[10px] text-slate-400 truncate"> {new Date(img.timestamp).toLocaleTimeString()} </div>
                   </div>
               ))}
           </div>
        </div>,
        document.body
      )}

      {showPresetSave && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-xl p-6 shadow-2xl">
                  <h3 className="text-white font-bold mb-4">SAVE PRESET</h3>
                  <input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="Enter preset name..." className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mb-4 focus:border-cyan-500 outline-none" autoFocus />
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setShowPresetSave(false)} className="text-slate-400 hover:text-white text-xs">CANCEL</button>
                      <button onClick={handlePresetSave} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs">SAVE</button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {createPortal(
        <div className={`fixed bottom-0 left-0 right-0 z-40 bg-[#020617]/90 border-t border-white/10 backdrop-blur-md px-4 md:px-6 py-2 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest transition-opacity duration-500 ${isVoidMode ? 'opacity-0 pointer-events-none' : 'opacity-100'} whitespace-nowrap overflow-hidden`}>
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
                <span className="flex items-center gap-2">
                   {isLoading ? (
                       <span className="relative flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                       </span>
                   ) : (
                       <span className="relative flex h-2 w-2">
                           <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                       </span>
                   )}
                   {isLoading ? <span className="text-amber-500">PROCESSING DATA</span> : <span>SYSTEM READY</span>}
                </span>
                <span className="hidden md:inline text-slate-700">|</span>
                <span className="hidden md:inline shrink-0">
                    MODEL: {
                        options.model === AIModel.FLASH ? "NSD-CORE/70B (IRIS)" :
                        options.model === AIModel.IMAGEN ? "NSD-GEN/2.5" :
                        "NSD-QUANTUM/3.0 (ULTRA)"
                    }
                </span>
                <span className="hidden md:inline text-slate-700">|</span>
                <span className="hidden md:flex text-red-500 font-bold tracking-tight text-[9px] select-text cursor-help items-center gap-2 overflow-hidden text-ellipsis">
                    CONTACT: 
                    <span className="text-white hover:text-cyan-400 transition-colors">nsd@fearyour.life</span> / 
                    <span className="text-[#5865F2] hover:text-white transition-colors flex items-center gap-1"> 0_nsd <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.772-.6083 1.1588a18.2915 18.2915 0 00-7.4858 0c-.1636-.3868-.3973-.7835-.6128-1.1588a.0771.0771 0 00-.0785-.0371 19.718 19.718 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/></svg> </span> </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <a href="https://fearyour.life/" target="_blank" rel="noreferrer" className="hidden md:flex items-center gap-2 text-[10px] text-[#8b5bf5] hover:text-[#a78bfa] transition-all font-bold tracking-widest hover:shadow-[0_0_15px_rgba(139,91,245,0.4)]"> POWERED BY NSD-CORE/70B </a>
                <span className="opacity-70">ID: {initialId || defaultId}</span>
                <button onClick={toggleConsole} className={`p-1 rounded hover:bg-white/10 transition-colors ${isConsoleOpen ? 'text-cyan-400' : 'text-slate-500'}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
            </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Generator;

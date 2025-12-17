
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

const ADMIN_KEY = "AIzaSyA3ci19iifvExK8pWZ7fwdkeWdYzUBmwHc";

type ConsoleSize = 'small' | 'medium' | 'full';

const Generator: React.FC<GeneratorProps> = ({ initialId, username }) => {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Custom API Key State
  const [customApiKey, setCustomApiKey] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  
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
    aesthetic: Aesthetic.GENERAL, // Default to General
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
  const imageRef = useRef<HTMLImageElement>(null); // Explicit ref for the image element

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
    // Filter timestamps to only those within the last hour
    const valid = hourlyUsage.filter(t => now - t < oneHour);
    
    // Auto-clean old records if state needs update
    if (valid.length !== hourlyUsage.length) setHourlyUsage(valid);

    // Limit: 20 requests per hour
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

  // Update Input Intensity based on prompt length
  useEffect(() => {
      const length = prompt.length;
      // Max intensity at 100 chars
      setInputIntensity(Math.min(length / 100, 1));
  }, [prompt]);

  // --- CRITICAL ERROR HANDLER ---
  const triggerCriticalError = () => {
      setIsCriticalError(true);
      // Apply class to body globally
      document.body.classList.add('theme-critical');
      
      // Revert after 4 seconds
      setTimeout(() => {
          setIsCriticalError(false);
          document.body.classList.remove('theme-critical');
      }, 4000);
  };

  // Helper to log to console
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

  // Scroll console to bottom (FIXED: uses scrollTop to avoid page scrolling)
  useEffect(() => {
    if (isConsoleOpen && consoleContainerRef.current) {
        consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [consoleLogs, isConsoleOpen]);

  // Focus console input without scrolling
  useEffect(() => {
      if (isConsoleOpen && consoleInputRef.current) {
          // Slight delay to ensure render is complete
          setTimeout(() => {
              consoleInputRef.current?.focus({ preventScroll: true });
          }, 50);
      }
  }, [isConsoleOpen]);

  const toggleConsole = () => {
      setIsConsoleOpen(!isConsoleOpen);
      // Reset to small when opening
      if (!isConsoleOpen) setConsoleSize('small');
  };

  // Initialize System Log
  useEffect(() => {
      logToConsole("UMBRAX KERNEL INITIALIZED...", 'system');
      logToConsole(`SESSION ID: ${initialId || defaultId}`, 'info');
      logToConsole(`USER: ${username || 'GUEST'}`, 'info');
      logToConsole("CONNECTING TO NSD-CORE/70B API NODE...", 'warn');
      logToConsole("CONNECTION ESTABLISHED. READY FOR INPUT.", 'success');
  }, []);

  // Handle Console Commands
  const handleConsoleCommand = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          const fullCmd = consoleInput.trim();
          if (!fullCmd) return;
          
          // Split command and args
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
              
              // --- DEBUG / TEST ---
              case 'error_test':
                  logToConsole("TRIGGERING ARTIFICIAL SYSTEM FAILURE...", 'error');
                  triggerCriticalError();
                  break;

              // --- RATE LIMIT COMMANDS (NEW) ---
              case 'lockdown':
                  logToConsole("OVERRIDING SAFETY PROTOCOLS...", 'warn');
                  logToConsole("INJECTING ARTIFICIAL LOAD...", 'warn');
                  setHourlyUsage(Array(20).fill(Date.now()));
                  setToastState({ visible: true, message: "HOURLY LIMIT REACHED. SYSTEM LOCKED." });
                  setTimeout(() => setToastState(s => ({ ...s, visible: false })), 5000);
                  setTimeout(() => logToConsole("LOCKDOWN ACTIVE. GENERATION DISABLED.", 'error'), 800);
                  break;
              
              case 'unlock':
              case 'reset_limit':
                  setHourlyUsage([]);
                  setToastState({ visible: false, message: "" }); // Hide toast if active
                  logToConsole("ADMIN OVERRIDE: QUOTA RESET.", 'success');
                  logToConsole("GENERATION CAPABILITIES RESTORED.", 'info');
                  break;

              // --- ADMIN / EASTER EGGS ---
              case 'nsd':
              case 'admin':
              case 'creator':
                  logToConsole("USER IDENTITY: NotSoDangerous", 'warn');
                  logToConsole("ROLE: SUPREME SYSTEM ARCHITECT / VOID ENGINEER", 'warn');
                  logToConsole("ACCESS LEVEL: UNLIMITED / OMNIPOTENT", 'success');
                  break;
              case 'socials':
                  logToConsole("CONNECTING TO THE CREATOR...", 'info');
                  logToConsole("GITHUB:  @NotSoDangerous", 'success');
                  logToConsole("STATUS:  WATCHING FROM THE SHADOWS", 'warn');
                  break;
              case 'root':
                  logToConsole("Nice try. Only NotSoDangerous has root privileges in this dimension.", 'error');
                  break;

              // --- CORE ---
              case 'clear':
              case 'cls':
                  setConsoleLogs([]);
                  logToConsole("CONSOLE BUFFER CLEARED", 'success');
                  break;
              case 'sys_status':
                  logToConsole("ALL SYSTEMS NOMINAL.", 'success');
                  logToConsole(`MEMORY USAGE: ${Math.floor(Math.random() * 30) + 10}%`, 'info');
                  logToConsole(`CPU LOAD: ${Math.floor(Math.random() * 50) + 20}%`, 'info');
                  logToConsole(`FLUX CAPACITOR: ONLINE`, 'success');
                  break;
              case 'ver':
              case 'version':
                  logToConsole("UMBRAX FLUX v3.0.1 (STABLE)", 'info');
                  logToConsole("BUILD: 2024-REL-C", 'info');
                  logToConsole("KERNEL: NSD-CORE 70B", 'info');
                  break;
              case 'flux_check':
                  logToConsole("CALIBRATING FLUX EMITTERS...", 'warn');
                  setTimeout(() => logToConsole("EMITTERS OPTIMIZED. EFFICIENCY: 99.9%", 'success'), 800);
                  break;
              case 'purge':
                  logToConsole("INITIATING CACHE PURGE...", 'error');
                  setTimeout(() => logToConsole("CACHE CLEARED. TEMPORARY FILES DELETED.", 'success'), 1000);
                  break;
              case 'whoami':
                  logToConsole("uid=1000(guest) gid=1000(guest) groups=1000(guest),4(adm)", 'info');
                  break;
              case 'date':
                  logToConsole(new Date().toUTCString(), 'info');
                  break;
              case 'exit':
                  setIsConsoleOpen(false);
                  break;
              case 'reboot':
                  logToConsole("SYSTEM REBOOT INITIATED...", 'warn');
                  logToConsole("SAVING SESSION STATE...", 'info');
                  setTimeout(() => {
                      setConsoleLogs([]);
                      logToConsole("UMBRAX KERNEL INITIALIZED...", 'system');
                      logToConsole("REBOOT SUCCESSFUL. READY.", 'success');
                  }, 2500);
                  break;
              case 'uname':
                  logToConsole("Linux umbrax-node-01 5.15.0-nsd-flux #42 SMP PREEMPT x86_64 GNU/Linux", 'info');
                  break;
              case 'env':
                  logToConsole("SHELL=/bin/zsh", 'info');
                  logToConsole("USER=guest", 'info');
                  logToConsole("PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/games", 'info');
                  logToConsole("FLUX_ENV=production", 'info');
                  break;

              // --- SYSTEM ---
              case 'ps':
                  logToConsole("PID   USER     TIME  COMMAND", 'system');
                  logToConsole("1     root     0:00  init", 'info');
                  logToConsole("42    root     1:23  flux_kernel_d", 'info');
                  logToConsole("88    daemon   0:45  gemini_bridge", 'info');
                  logToConsole("101   user     0:12  input_handler", 'info');
                  logToConsole("404   ghost    ?:??  [defunct]", 'warn');
                  break;
              case 'top':
                   logToConsole("Tasks: 142 total, 1 running, 141 sleeping", 'info');
                   logToConsole("CPU:  [||||||||||||||||||    ] 85.3% user, 4.2% sys", 'warn');
                   logToConsole("Mem:  [||||||||              ] 4.2G/16G", 'info');
                   break;
              case 'kill':
                   if (!args[1]) { logToConsole("usage: kill [PID]", 'error'); break; }
                   logToConsole(`Attempting to terminate PID ${args[1]}...`, 'info');
                   setTimeout(() => logToConsole(`kill: (${args[1]}) - Operation not permitted`, 'error'), 400);
                   break;
              case 'dmesg':
                  logToConsole("[    0.000000] Initializing Umbrax Neural Net...", 'info');
                  logToConsole("[    0.145002] CPU0: Intel(R) Quantum Core(TM) i9-9900K CPU @ 3.60GHz", 'info');
                  logToConsole("[    0.442100] flux: module verified. Signed by NotSoDangerous.", 'success');
                  logToConsole("[    1.200451] eth0: link up, 100Gbps, full-duplex", 'info');
                  break;
              case 'coolant':
                  const temp = Math.floor(Math.random() * 20) + 40;
                  logToConsole(`CORE TEMPERATURE: ${temp}°C`, temp > 55 ? 'warn' : 'success');
                  logToConsole("LIQUID NITROGEN FLOW: STABLE", 'info');
                  break;

              // --- NETWORK ---
              case 'ping':
                  const host = args[1] || "nsd-core.local";
                  logToConsole(`PING ${host} (192.168.1.1): 56 data bytes`, 'info');
                  setTimeout(() => logToConsole("64 bytes from 192.168.1.1: icmp_seq=0 time=0.042 ms", 'info'), 300);
                  setTimeout(() => logToConsole("64 bytes from 192.168.1.1: icmp_seq=1 time=0.038 ms", 'info'), 600);
                  setTimeout(() => logToConsole("64 bytes from 192.168.1.1: icmp_seq=2 time=0.045 ms", 'info'), 900);
                  break;
              case 'netstat':
                  logToConsole("Active Internet connections (w/o servers)", 'system');
                  logToConsole("Proto Recv-Q Send-Q Local Address           Foreign Address         State", 'info');
                  logToConsole("tcp        0      0 192.168.1.42:54322      172.217.14.206:443      ESTABLISHED", 'info');
                  logToConsole("tcp        0      0 192.168.1.42:43001      104.16.123.96:443       ESTABLISHED", 'info');
                  logToConsole("tcp        0      0 192.168.1.42:ssh        192.168.1.10:55412      ESTABLISHED", 'warn');
                  break;
              case 'nslookup':
                  const domain = args[1] || "google.com";
                  logToConsole(`Server:         127.0.0.53`, 'info');
                  logToConsole(`Address:        127.0.0.53#53`, 'info');
                  logToConsole(`Non-authoritative answer:`, 'info');
                  logToConsole(`Name:   ${domain}`, 'info');
                  logToConsole(`Address: 142.250.189.14`, 'info');
                  break;
              case 'ssh':
                  if (!args[1]) { logToConsole("usage: ssh user@host", 'error'); break; }
                  logToConsole(`Connecting to ${args[1]}...`, 'info');
                  setTimeout(() => logToConsole(`ssh: connect to host ${args[1]} port 22: Connection refused`, 'error'), 1500);
                  break;
              case 'telnet':
                  logToConsole("Trying 192.168.0.1...", 'info');
                  setTimeout(() => logToConsole("Connected to AI_MAINFRAME.", 'success'), 1000);
                  setTimeout(() => logToConsole("Escape character is '^]'.", 'info'), 1100);
                  setTimeout(() => logToConsole("Connection closed by foreign host.", 'error'), 2000);
                  break;
              case 'portscan':
                  logToConsole("Scanning target 127.0.0.1...", 'info');
                  setTimeout(() => logToConsole("PORT 80/TCP: OPEN", 'success'), 500);
                  setTimeout(() => logToConsole("PORT 443/TCP: OPEN", 'success'), 600);
                  setTimeout(() => logToConsole("PORT 22/TCP: FILTERED", 'warn'), 700);
                  setTimeout(() => logToConsole("PORT 3306/TCP: CLOSED", 'info'), 800);
                  break;
              case 'trace':
                  logToConsole("traceroute to 8.8.8.8 (8.8.8.8), 30 hops max, 60 byte packets", 'info');
                  setTimeout(() => logToConsole(" 1  gw.local (192.168.1.1)  0.431 ms  0.321 ms  0.401 ms", 'info'), 200);
                  setTimeout(() => logToConsole(" 2  10.20.0.1 (10.20.0.1)  2.123 ms  2.091 ms  2.112 ms", 'info'), 400);
                  setTimeout(() => logToConsole(" 3  * * *", 'warn'), 600);
                  break;
              case 'ipconfig':
              case 'ifconfig':
                  logToConsole("eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500", 'info');
                  logToConsole("      inet 192.168.1.42  netmask 255.255.255.0  broadcast 192.168.1.255", 'info');
                  logToConsole("      ether 00:1a:2b:3c:4d:5e  txqueuelen 1000  (Ethernet)", 'info');
                  break;

              // --- FILE SYSTEM ---
              case 'ls':
                  logToConsole("drwxr-xr-x  root  system  /var/flux_cache", 'info');
                  logToConsole("drwxr-xr-x  admin system  /usr/models/weights", 'info');
                  logToConsole("-rw-r--r--  root  root    config.sys", 'info');
                  logToConsole("-rw-r--r--  user  group   session_key.pem", 'info');
                  logToConsole("-r--r--r--  root  root    readme.txt", 'info');
                  logToConsole("drwx------  nsd   admin   /home/not_so_dangerous", 'warn');
                  break;
              case 'mkdir':
                  if (!args[1]) { logToConsole("usage: mkdir [directory]", 'error'); break; }
                  logToConsole(`mkdir: cannot create directory '${args[1]}': Read-only file system`, 'error');
                  break;
              case 'touch':
                  if (!args[1]) { logToConsole("usage: touch [file]", 'error'); break; }
                  logToConsole(`touch: cannot touch '${args[1]}': Permission denied`, 'error');
                  break;
              case 'rm':
                  logToConsole("Are you sure you want to delete system files? [y/N]", 'warn');
                  setTimeout(() => logToConsole("Action blocked by Sentinel Protocol.", 'error'), 1000);
                  break;
              case 'chmod':
                  logToConsole("Changing permissions...", 'info');
                  logToConsole("chmod: changing permissions of 'core.bin': Operation not permitted", 'error');
                  break;
              case 'du':
                  logToConsole("14G     /var/lib/docker", 'info');
                  logToConsole("2.4G    /usr/share", 'info');
                  logToConsole("128M    /boot", 'info');
                  logToConsole("18G     total", 'success');
                  break;
              case 'cat':
                  const file = args[1];
                  if (!file) {
                      logToConsole("usage: cat [file]", 'error');
                  } else if (file === 'config.sys') {
                      logToConsole("FLUX_VERSION=3.0.1", 'info');
                      logToConsole("RENDER_ENGINE=NSD-CORE", 'info');
                      logToConsole("SAFETY_LOCK=FALSE", 'warn');
                      logToConsole("MAX_DIMENSION=4096", 'info');
                  } else if (file === 'session_key.pem') {
                      logToConsole("-----BEGIN FLUX PRIVATE KEY-----", 'system');
                      logToConsole("MIIEowIBAAKCAQEAwX...", 'info');
                      logToConsole("...[CONTENT REDACTED FOR SECURITY]...", 'warn');
                      logToConsole("-----END FLUX PRIVATE KEY-----", 'system');
                  } else if (file === 'readme.txt') {
                      logToConsole("Welcome to Umbrax Flux 3.", 'info');
                      logToConsole("Authorized personnel only.", 'info');
                  } else {
                      logToConsole(`cat: ${file}: Permission denied or file not found`, 'error');
                  }
                  break;
              case 'history':
                   logToConsole("   1  init_flux_core", 'info');
                   logToConsole("   2  mount /dev/sda1", 'info');
                   logToConsole("   3  nsd --version", 'info');
                   logToConsole("   4  " + consoleInput, 'info');
                   break;
              case 'decrypt':
                  logToConsole("ATTEMPTING DECRYPTION ON /var/secure/...", 'info');
                  let prog = "";
                  for(let i=0; i<5; i++) {
                      setTimeout(() => {
                          prog += "█";
                          logToConsole(`DECRYPTING: [${prog.padEnd(5, '.')}]`, 'system');
                      }, (i+1) * 400);
                  }
                  setTimeout(() => logToConsole("ACCESS GRANTED. FILE: 'project_omega.dat'", 'success'), 2200);
                  break;

              // --- MISC / LORE ---
              case 'quantum':
                  logToConsole("MEASURING QUANTUM STATE...", 'info');
                  setTimeout(() => logToConsole("WAVEFUNCTION COLLAPSE DETECTED.", 'success'), 500);
                  setTimeout(() => logToConsole("ENTANGLEMENT STABLE AT 99.4%", 'success'), 1000);
                  break;
              case 'override':
                  logToConsole("SECURITY OVERRIDE INITIATED...", 'warn');
                  setTimeout(() => logToConsole("ACCESS DENIED. LEVEL 5 CLEARANCE REQUIRED.", 'error'), 1200);
                  break;
              case 'uptime':
                  const uptime = Math.floor(performance.now() / 1000);
                  const mins = Math.floor(uptime / 60);
                  logToConsole(`SYSTEM UPTIME: ${mins}m ${uptime % 60}s`, 'info');
                  break;
              case 'matrix':
                  logToConsole("WAKE UP, NEO...", 'success');
                  setTimeout(() => logToConsole("THE MATRIX HAS YOU...", 'success'), 1000);
                  setTimeout(() => logToConsole("FOLLOW THE WHITE RABBIT.", 'success'), 2000);
                  break;
              case 'sudo':
                  logToConsole("nsdadmin is not in the sudoers file. This incident will be reported.", 'error');
                  break;
              case 'neofetch':
                  logToConsole("       /\\       OS: UmbraxOS v3.0", 'system');
                  logToConsole("      /  \\      Kernel: 5.15.0-flux", 'system');
                  logToConsole("     / /\\ \\     Uptime: " + Math.floor(performance.now()/1000/60) + " mins", 'system');
                  logToConsole("    / /  \\ \\    Shell: ZSH 5.8", 'system');
                  logToConsole("   /_/    \\_\\   CPU: Neural Core X1", 'system');
                  logToConsole("                Memory: 128GB DDR6", 'system');
                  break;
              case 'scan':
                  logToConsole("INITIATING DEEP SYSTEM SCAN...", 'info');
                  setTimeout(() => logToConsole("SECTOR 1: INTEGRITY 100%", 'success'), 500);
                  setTimeout(() => logToConsole("SECTOR 2: INTEGRITY 100%", 'success'), 1000);
                  setTimeout(() => logToConsole("SECTOR 3: ANOMALY DETECTED [QUARANTINED]", 'warn'), 1500);
                  setTimeout(() => logToConsole("SCAN COMPLETE.", 'info'), 2000);
                  break;
              case 'weather':
                  logToConsole("CURRENT CONDITIONS: ELECTROMAGNETIC STORM", 'warn');
                  logToConsole("VISIBILITY: 15%", 'info');
                  logToConsole("TEMP: 450K", 'info');
                  break;
              case 'mount':
                   logToConsole("/dev/nvme0n1p1 on / type ext4 (rw,relatime)", 'info');
                   logToConsole("/dev/sda1 on /mnt/flux_drive type exfat (rw,nosuid)", 'info');
                   break;
              case 'protocol_7':
                   logToConsole("INITIATING PROTOCOL 7...", 'warn');
                   setTimeout(() => logToConsole("SEALING BLAST DOORS.", 'warn'), 500);
                   setTimeout(() => logToConsole("VENTING ATMOSPHERE.", 'error'), 1000);
                   setTimeout(() => logToConsole("Just kidding.", 'success'), 2000);
                   break;
              case 'quote':
                  const quotes = [
                      "I've seen things you people wouldn't believe.",
                      "The sky above the port was the color of television, tuned to a dead channel.",
                      "Reality is that which, when you stop believing in it, doesn't go away.",
                      "We dream in code.",
                      "Visuals are just math with feeling."
                  ];
                  logToConsole(`"${quotes[Math.floor(Math.random() * quotes.length)]}"`, 'info');
                  break;
              default:
                  if (cmd !== '') logToConsole(`UNKNOWN COMMAND: "${cmd}"`, 'error');
          }
      }
  };

  // Load presets & Gallery on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('infogenius_presets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
        logToConsole("USER PRESETS LOADED", 'success');
      } catch (e) { console.error("Failed to load presets", e); }
    }
  }, []);

  // Scroll to bottom when image generates
  useEffect(() => {
    if (generatedImage && scrollRef.current) {
       scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generatedImage]);

  // Reset Zoom/Pan and Adjustments when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectionBox(null);
    setAnimateImage(true);
    setAdjustments({
        brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, grayscale: 0
    });
    
    // Handle Custom Ratio Crop Guide on new image
    if (options.aspectRatio === AspectRatio.CUSTOM && options.customRatioValue) {
        // Force a selection box in the center that matches ratio
        setSelectionBox({ x: 10, y: 10, w: 80, h: 80 / options.customRatioValue }); 
        setIsTargetMode(true);
        // Reset Zoom/Pan for easier editing
        setZoom(1);
        setPan({x:0, y:0});
    } else {
        setSelectionBox(null);
        setIsTargetMode(false);
    }

    const t = setTimeout(() => setAnimateImage(false), 1000);
    return () => clearTimeout(t);
  }, [generatedImage?.id]);

  // FIX: Zoom Scroll prevention & Logic
  // Updated dependency array to rely on generatedImage existence rather than just current ref
  useEffect(() => {
    const element = imageWrapperRef.current;
    if (!element) return; // If image isn't generated yet, this exits.

    // Ensure we are adding non-passive listener to prevent scroll
    const handleWheelNative = (e: WheelEvent) => {
        if (!isTargetMode) { 
            e.preventDefault(); // Only prevent default if zooming
            const scaleAmount = -e.deltaY * 0.001;
            setZoom(prev => Math.min(Math.max(0.5, prev + scaleAmount), 5));
        }
    };

    element.addEventListener('wheel', handleWheelNative, { passive: false });

    return () => {
        element.removeEventListener('wheel', handleWheelNative);
    };
  }, [generatedImage, isTargetMode]); 

  // History Management
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
      logToConsole("HISTORY: UNDO ACTION PERFORMED", 'info');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setGeneratedImage(history[newIndex]);
      logToConsole("HISTORY: REDO ACTION PERFORMED", 'info');
    }
  };
  
  const jumpToHistory = (index: number) => {
      if (index >= 0 && index < history.length) {
          setHistoryIndex(index);
          setGeneratedImage(history[index]);
          logToConsole(`CHRONOSPHERE JUMP: INDEX ${index}`, 'info');
      }
  }

  const handleAuthSubmit = () => {
      setShowAuthModal(false);
      setError(null); // Clear thematic error
      logToConsole("AUTH KEY UPDATED. RETRY OPERATION.", 'success');
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedImage) return;

    // --- RATE LIMIT CHECK ---
    if (!checkRateLimit()) return;
    
    setIsLoading(true);
    setProcessingMessage("INITIATING SYNTHESIS...");
    setError(null);
    setShowSuggestions(false);
    
    logToConsole(`INITIATING GENERATION: "${prompt.substring(0, 30)}..."`, 'info');

    try {
      const finalRatio = options.aspectRatio === AspectRatio.CUSTOM 
        ? AspectRatio.SQUARE // Generate square then crop
        : options.aspectRatio;

      const image = await generateImage(
        prompt, 
        { ...options, aspectRatio: finalRatio },
        uploadedImage || undefined,
        customApiKey
      );
      
      // Store clean version before watermark
      const cleanBase64 = image.base64;

      // Automatically apply watermark
      const watermarkedBase64 = await applyWatermark(image.base64);
      const finalImage: GeneratedImage = { 
          ...image, 
          base64: watermarkedBase64,
          cleanBase64: cleanBase64 // Save raw
      };

      updateHistory(finalImage, true);
      incrementRateLimit(); // RECORD USAGE
      logToConsole("GENERATION COMPLETE. IMAGE RENDERED.", 'success');
      
    } catch (err: any) {
      console.error(err);
      let errorMsg = "";
      if (typeof err === 'object') {
          try {
             errorMsg = JSON.stringify(err);
          } catch {
             errorMsg = String(err);
          }
      } else {
          errorMsg = String(err);
      }

      // Check for specific API errors
      if (errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
           logToConsole(`FATAL ERROR (403): ${errorMsg}`, 'error');
           logToConsole("SECURITY PROTOCOL ACTIVATED: AUTHORIZATION REQUIRED", 'warn');
           setError("SECURITY PROTOCOL ACTIVATED: AUTHORIZATION REQUIRED");
           setShowAuthModal(true); // TRIGGER AUTH MODAL
      } else if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
           logToConsole(`FATAL ERROR (429): ${errorMsg}`, 'error');
           setError("SYSTEM OVERLOAD (429): API RATE LIMIT EXCEEDED.");
      } else {
           // Fallback to thematic for unknown errors
           logToConsole(`RUNTIME ERROR: ${errorMsg}`, 'error');
           const thematic = THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)];
           setError(thematic);
      }

      triggerCriticalError(); 
    } finally {
      setIsLoading(false);
      setProcessingMessage("");
    }
  };

  const handleEdit = async () => {
    if (!generatedImage || !editPrompt.trim()) return;
    
    // --- RATE LIMIT CHECK ---
    if (!checkRateLimit()) return;
    
    setIsLoading(true);
    setProcessingMessage("MODULATING VISUAL DATA...");
    setError(null);
    logToConsole(`INITIATING EDIT: "${editPrompt.substring(0, 30)}..."`, 'info');

    try {
      // If selection box is active, prepend instructions
      let finalPrompt = editPrompt;
      if (selectionBox) {
         // Calculate percentages
         const top = selectionBox.y.toFixed(1);
         const left = selectionBox.x.toFixed(1);
         const width = selectionBox.w.toFixed(1);
         const height = selectionBox.h.toFixed(1);
         
         finalPrompt = `Apply this change EXCLUSIVELY to the region bounded by Top: ${top}%, Left: ${left}%, Width: ${width}%, Height: ${height}%. Task: ${editPrompt}`;
      }

      // USE CLEAN BASE64 IF AVAILABLE
      const sourceImage = {
          ...generatedImage,
          base64: generatedImage.cleanBase64 || generatedImage.base64
      };

      const image = await editImage(sourceImage, finalPrompt, options, customApiKey);
      
      // Store new clean version
      const cleanBase64 = image.base64;

      // Re-apply watermark on edited image
      const watermarkedBase64 = await applyWatermark(image.base64);
      const finalImage = { 
          ...image, 
          base64: watermarkedBase64,
          cleanBase64: cleanBase64
      };

      updateHistory(finalImage);
      incrementRateLimit(); // RECORD USAGE
      setEditPrompt('');
      if (!options.customRatioValue) {
          setSelectionBox(null);
          setIsTargetMode(false);
      }
      logToConsole("EDIT COMPLETE. MATRIX UPDATED.", 'success');
    } catch (err: any) {
      console.error(err);
      
      let errorMsg = "";
      if (typeof err === 'object') {
          try { errorMsg = JSON.stringify(err); } catch { errorMsg = String(err); }
      } else { errorMsg = String(err); }

      if (errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
           logToConsole(`FATAL ERROR (403): ${errorMsg}`, 'error');
           setError("SECURITY PROTOCOL ACTIVATED: AUTHORIZATION REQUIRED");
           setShowAuthModal(true);
      } else {
           logToConsole(`EDIT ERROR: ${errorMsg}`, 'error');
           setError(THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)]);
      }

      triggerCriticalError(); 
    } finally {
      setIsLoading(false);
      setProcessingMessage("");
    }
  };

  const handleOutpaint = async () => {
    if (!generatedImage) return;

    // --- RATE LIMIT CHECK ---
    if (!checkRateLimit()) return;
    
    setIsLoading(true);
    setProcessingMessage("EXPANDING CANVAS BOUNDARIES...");
    
    try {
      // USE CLEAN BASE64
      const sourceBase64 = generatedImage.cleanBase64 || generatedImage.base64;
      
      const extendedBase64 = await extendImage(sourceBase64);
      const extendedImage: GeneratedImage = {
        ...generatedImage,
        id: Date.now().toString(),
        base64: extendedBase64,
        cleanBase64: extendedBase64, // This is the extended clean base
        timestamp: Date.now()
      };
      // We treat this as a new edit in the history
      updateHistory(extendedImage);
      
      // Now ask AI to fill it (using the extended image which is clean)
      const filledImage = await editImage(extendedImage, "Seamlessly extend the scene into the empty dark area, matching the style and lighting of the central image.", options, customApiKey);
      
      const filledClean = filledImage.base64;

      // Re-apply watermark
      const watermarkedBase64 = await applyWatermark(filledClean);
      const finalImage = { 
          ...filledImage, 
          base64: watermarkedBase64,
          cleanBase64: filledClean
      };

      updateHistory(finalImage); // Update again with filled version
      incrementRateLimit(); // RECORD USAGE
      logToConsole("OUTPAINTING COMPLETE. HORIZON EXPANDED.", 'success');
    } catch (err: any) {
       console.error(err);
       let errorMsg = "";
       try { errorMsg = JSON.stringify(err); } catch { errorMsg = String(err); }
       
       if (errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
           logToConsole(`FATAL ERROR (403): ${errorMsg}`, 'error');
           setError("SECURITY PROTOCOL ACTIVATED: AUTHORIZATION REQUIRED");
           setShowAuthModal(true);
       } else {
           logToConsole(`OUTPAINT ERROR: ${errorMsg}`, 'error');
           setError(THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)]);
       }

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
    logToConsole(`PRESET SAVED: ${newPresetName}`, 'success');
  };

  const loadPreset = (preset: Preset) => {
    setOptions(preset.options);
    setPresetDropdownOpen(false);
    logToConsole(`PRESET LOADED: ${preset.name}`, 'info');
  };
  
  const deletePreset = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = presets.filter(p => p.id !== id);
      setPresets(updated);
      localStorage.setItem('infogenius_presets', JSON.stringify(updated));
      logToConsole(`PRESET DELETED: ${id}`, 'warn');
  }

  // --- POINTER EVENT HANDLERS FOR IMAGE INTERACTION (Pan vs Draw Box) ---
  const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault(); // Prevent native image dragging
      if (!generatedImage) return;
      
      // Capture pointer on the container to track movement outside
      e.currentTarget.setPointerCapture(e.pointerId);
      
      // Make sure we have the image rect for accurate calculations
      if (!imageRef.current) return;
      const rect = imageRef.current.getBoundingClientRect();

      if (isTargetMode) {
          // DRAW BOX LOGIC - Relative to Image Element
          const xPct = ((e.clientX - rect.left) / rect.width) * 100;
          const yPct = ((e.clientY - rect.top) / rect.height) * 100;
          
          // Start drawing
          setIsDrawingBox(true);
          setDrawStart({ x: xPct, y: yPct });
          setSelectionBox({ x: xPct, y: yPct, w: 0, h: 0 });
      } else {
          // PAN LOGIC
          setIsPanning(true);
          setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      e.preventDefault(); // Prevent native behaviors
      if (!generatedImage || !imageRef.current) return;

      if (isTargetMode && isDrawingBox && drawStart) {
          // DRAW BOX LOGIC - Relative to Image Element
          const rect = imageRef.current.getBoundingClientRect();
          let currX = ((e.clientX - rect.left) / rect.width) * 100;
          let currY = ((e.clientY - rect.top) / rect.height) * 100;
          
          // Constrain to 0-100
          currX = Math.max(0, Math.min(100, currX));
          currY = Math.max(0, Math.min(100, currY));

          const newX = Math.min(drawStart.x, currX);
          const newY = Math.min(drawStart.y, currY);
          const newW = Math.abs(currX - drawStart.x);
          const newH = Math.abs(currY - drawStart.y);

          setSelectionBox({ x: newX, y: newY, w: newW, h: newH });

      } else if (isPanning) {
          // PAN LOGIC
          setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      e.preventDefault();
      if (e.currentTarget) {
          e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setIsPanning(false);
      setIsDrawingBox(false);
      setDrawStart(null);
  };

  // Toggle Target Mode: Reset view for easy drawing
  const toggleTargetMode = () => {
      const newMode = !isTargetMode;
      setIsTargetMode(newMode);
      if (newMode) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
          setSelectionBox(null); // Clear old box to let user draw new one
          logToConsole("TARGET MODE ACTIVE. DRAG TO SELECT AREA.", 'info');
      } else {
          setSelectionBox(null);
          logToConsole("TARGET MODE DISABLED.", 'info');
      }
  };

  return (
    <div className="min-h-screen bg-transparent text-white font-sans selection:bg-cyan-500/30 selection:text-cyan-100 overflow-x-hidden pb-20">
      
      {/* Toast Notification Container */}
      <Toast message={toastState.message} visible={toastState.visible} />

      {/* --- HEADER --- */}
      <header className="pt-8 pb-6 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center animate-slide-down relative gap-4 md:gap-0">
        {/* Header Left: Logo/Title - Wrapped for Flex Layout */}
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
        
        {/* Header Right: Buttons - Desktop */}
        <div className="hidden md:flex gap-4">
            <MagneticButton 
              onClick={() => setShowGallery(true)}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-cyan-500 hover:text-cyan-400 transition-all backdrop-blur-md uppercase text-xs tracking-widest font-bold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Gallery
            </MagneticButton>
            
            <button 
                onClick={() => setIsVoidMode(!isVoidMode)}
                className="text-slate-600 hover:text-white transition-colors flex flex-col items-center gap-1"
                title="Toggle Void Mode"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <span className="text-[8px] uppercase tracking-wider">Void Mode</span>
            </button>
        </div>

        {/* Mobile Buttons Row */}
        <div className="flex md:hidden gap-4 w-full justify-center mt-4">
             <MagneticButton 
              onClick={() => setShowGallery(true)}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-cyan-500 hover:text-cyan-400 transition-all backdrop-blur-md uppercase text-xs tracking-widest font-bold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Gallery
            </MagneticButton>
             <button 
                onClick={() => setIsVoidMode(!isVoidMode)}
                className="text-slate-600 hover:text-white transition-colors flex flex-col items-center gap-1"
            >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </button>
        </div>
      </header>
      
      {/* POWERED BY PILL - Responsive Positioning */}
      {/* Desktop: Absolute Center (Top-12) | Mobile: Static Block with Margin */}
      <div className="mt-6 md:mt-0 md:absolute md:top-12 md:left-1/2 md:-translate-x-1/2 z-50 flex justify-center w-full pointer-events-none">
          <div className="bg-slate-900/80 border border-yellow-500/30 px-4 py-1 rounded-full backdrop-blur-md shadow-[0_0_15px_rgba(234,179,8,0.1)] pointer-events-auto">
              <span className="text-[10px] text-yellow-500 font-mono font-bold tracking-widest">POWERED BY NSD-CORE/70B</span>
          </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <main className={`max-w-7xl mx-auto px-4 md:px-8 pb-24 transition-opacity duration-500 ${isVoidMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* --- INPUT PANEL --- */}
        <div className="animate-slide-left relative z-30">
        <div className="animate-slide-left">
        <TiltPanel className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-1" intensity={0.5}>
          <div className="p-6 md:p-8 space-y-8 relative">
            
            {/* Prompt Input */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
              
              {/* Uploaded Image Preview */}
              {uploadedImage && (
                  <div className="absolute -top-20 left-0 z-40">
                      <div className="relative group/preview">
                          <img src={`data:image/png;base64,${uploadedImage}`} alt="Upload" className="h-16 w-16 object-cover rounded-lg border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
                          <button 
                            onClick={() => setUploadedImage(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/preview:opacity-100 transition-opacity"
                          >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                      </div>
                  </div>
              )}

              <div className="relative flex items-center">
                  <div className="absolute left-4 text-cyan-500 animate-pulse font-mono text-lg">
                      {`>_`}
                  </div>
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="ENTER YOUR SYNTHESIS DIRECTIVE"
                    className="w-full bg-[#050b14] border border-slate-800 rounded-xl py-5 pl-12 pr-32 text-lg md:text-xl font-light tracking-wide text-white placeholder-slate-600 outline-none focus:border-cyan-500/50 focus:shadow-[0_0_30px_rgba(6,182,212,0.15)] transition-all duration-300 font-mono"
                    style={{
                        boxShadow: inputIntensity > 0 ? `0 0 ${inputIntensity * 20}px rgba(6, 182, 212, ${inputIntensity * 0.3})` : 'none',
                        borderColor: inputIntensity > 0.5 ? `rgba(6, 182, 212, ${inputIntensity})` : ''
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                  
                  {/* Input Actions */}
                  <div className="absolute right-2 flex items-center gap-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-500 hover:text-cyan-400 transition-colors rounded-lg hover:bg-white/5"
                        title="Upload Reference Image"
                      >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64 = (reader.result as string).split(',')[1];
                                    setUploadedImage(base64);
                                    logToConsole(`IMAGE UPLOADED: ${file.name}`, 'info');
                                };
                                reader.readAsDataURL(file);
                            }
                        }}
                      />
                      
                      <button 
                        onClick={async () => {
                           if(!prompt) return;
                           logToConsole("REQUESTING AI SUGGESTIONS...", 'info');
                           const sugs = await getPromptEnhancements(prompt, customApiKey);
                           setSuggestions(sugs);
                           setShowSuggestions(true);
                           logToConsole(`RECEIVED ${sugs.length} SUGGESTIONS`, 'success');
                        }}
                        className="p-2 text-slate-500 hover:text-yellow-400 transition-colors rounded-lg hover:bg-white/5"
                        title="AI Prompt Enhancer"
                      >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </button>
                  </div>
              </div>
              
              {/* AI Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-cyan-500/30 rounded-xl overflow-hidden z-50 shadow-2xl animate-fade-in">
                      <div className="px-4 py-2 bg-cyan-950/30 border-b border-cyan-500/20 flex justify-between items-center">
                          <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">AI Suggestions</span>
                          <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-white">&times;</button>
                      </div>
                      {suggestions.map((s, i) => (
                          <button 
                            key={i}
                            onClick={() => { setPrompt(s); setShowSuggestions(false); }}
                            className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors border-b border-white/5 last:border-0"
                          >
                              {s}
                          </button>
                      ))}
                  </div>
              )}
            </div>

            {/* Controls Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Model Selector */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Model</label>
                <div className="relative group">
                  <select
                    value={options.model}
                    onChange={(e) => setOptions({ ...options, model: e.target.value as AIModel })}
                    className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-xs font-mono text-cyan-100 outline-none focus:border-cyan-500 transition-all cursor-pointer hover:bg-slate-800"
                  >
                    <option value={AIModel.FLASH}>NSD-CORE/70B (IRIS)</option>
                    <option value={AIModel.IMAGEN}>NSD-GEN/2.5</option>
                    <option value={AIModel.PRO_IMAGE}>NSD-QUANTUM/3.0 (ULTRA)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Aesthetic Selector */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Aesthetic</label>
                <div className="relative group">
                  <select
                    value={options.aesthetic}
                    onChange={(e) => setOptions({ ...options, aesthetic: e.target.value as Aesthetic })}
                    className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-xs font-mono text-cyan-100 outline-none focus:border-cyan-500 transition-all cursor-pointer hover:bg-slate-800"
                  >
                    {Object.values(Aesthetic).map((style) => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Ratio Selector */}
              <div className="space-y-2 relative">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Ratio</label>
                <div className="relative group">
                  <select
                    value={options.aspectRatio}
                    onChange={(e) => setOptions({ ...options, aspectRatio: e.target.value as AspectRatio })}
                    className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-xs font-mono text-cyan-100 outline-none focus:border-cyan-500 transition-all cursor-pointer hover:bg-slate-800"
                  >
                    {Object.values(AspectRatio).map((ratio) => (
                      <option key={ratio} value={ratio}>{ratio}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {/* Custom Ratio Input Overlay if Custom selected */}
                {options.aspectRatio === AspectRatio.CUSTOM && (
                    <div className="absolute top-full left-0 mt-2 w-full z-20 animate-fade-in">
                        <input 
                            type="text"
                            value={customRatioInput}
                            onChange={(e) => {
                                setCustomRatioInput(e.target.value);
                                const parts = e.target.value.split(':');
                                if (parts.length === 2) {
                                    const w = parseFloat(parts[0]);
                                    const h = parseFloat(parts[1]);
                                    if (!isNaN(w) && !isNaN(h) && h !== 0) {
                                        setOptions(prev => ({ ...prev, customRatioValue: w/h }));
                                    }
                                }
                            }}
                            className="w-full bg-slate-900 border border-cyan-500 text-white text-xs p-2 rounded"
                            placeholder="e.g. 21:9"
                        />
                    </div>
                )}
              </div>

              {/* Presets / Save / Initiate */}
              <div className="flex gap-2 items-end">
                {/* Initiate Button */}
                <MagneticButton
                  onClick={handleGenerate}
                  disabled={isLoading || (!prompt && !uploadedImage)}
                  className={`flex-1 h-[42px] rounded-lg font-bold tracking-wider uppercase text-xs transition-all duration-300 flex items-center justify-center relative overflow-hidden ${
                    isLoading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]'
                  }`}
                >
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                   <span className="relative z-10">{isLoading ? 'Synthesizing...' : 'Initiate'}</span>
                </MagneticButton>
                
                {/* Preset Menu */}
                 <div className="relative">
                    <button 
                        onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
                        className="h-[42px] px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </button>
                    
                    {presetDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-2 animate-fade-in">
                            <button 
                                onClick={() => { setShowPresetSave(true); setPresetDropdownOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs text-cyan-400 hover:bg-slate-800 rounded mb-2 flex items-center gap-2"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Save Current Settings
                            </button>
                            <div className="h-px bg-slate-800 my-1"></div>
                            {presets.length === 0 && <p className="text-[10px] text-slate-600 px-3 py-2">No presets saved</p>}
                            {presets.map(p => (
                                <div key={p.id} className="flex items-center justify-between group/preset hover:bg-slate-800 rounded px-2">
                                    <button 
                                        onClick={() => loadPreset(p)}
                                        className="flex-1 text-left py-2 text-xs text-slate-300"
                                    >
                                        {p.name}
                                    </button>
                                    <button 
                                        onClick={(e) => deletePreset(p.id, e)}
                                        className="text-red-500 opacity-0 group-hover/preset:opacity-100 hover:text-red-400"
                                    >
                                        &times;
                                    </button>
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
        </div>
        
        {/* CHRONOSPHERE (HISTORY STRIP) */}
        {history.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto py-2 px-1 custom-scrollbar animate-fade-in">
                {history.map((img, idx) => (
                    <button 
                        key={img.id}
                        onClick={() => jumpToHistory(idx)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border transition-all ${historyIndex === idx ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-slate-700 hover:border-slate-500 opacity-60 hover:opacity-100'}`}
                    >
                        <img src={`data:${img.mimeType};base64,${img.base64}`} alt="" className="w-full h-full object-cover" />
                    </button>
                ))}
            </div>
        )}

        {/* --- OUTPUT PANEL --- */}
        <div ref={scrollRef} className="mt-6 animate-slide-up relative z-20">
        <TiltPanel className={`glass-panel rounded-2xl border-white/10 overflow-hidden min-h-[500px] flex flex-col items-center justify-center relative transition-all duration-500 ${generatedImage ? 'bg-slate-950' : 'bg-slate-900/30'}`} intensity={0.5}>
            
            {isLoading && <Loader />}

            {/* Empty State */}
            {!generatedImage && !isLoading && !error && (
              <div className="text-center space-y-4 opacity-30">
                 <div className="w-24 h-24 border-2 border-dashed border-slate-500 rounded-full mx-auto flex items-center justify-center animate-[spin_20s_linear_infinite]">
                    <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                 </div>
                 <p className="text-sm font-mono tracking-widest uppercase">System Idle</p>
              </div>
            )}
            
            {/* Error State - REVERTED TO THEMATIC */}
            {error && !isLoading && (
                <div className="text-center max-w-lg px-6 flex flex-col items-center">
                   <div className="text-red-500 text-4xl mb-4">⚠</div>
                   <h3 className="text-red-400 font-bold tracking-widest uppercase mb-2">System Error</h3>
                   <p className="text-red-300/70 font-mono text-sm mb-6">{error}</p>
                </div>
            )}

            {/* Image Display */}
            {generatedImage && !isLoading && !error && (
                <div ref={imageWrapperRef} className="relative w-full h-full flex flex-col">
                   {/* Main Canvas Wrapper - Updated for Pointer Events */}
                   <div 
                       className="relative w-full flex-1 overflow-hidden flex items-center justify-center bg-slate-950 p-4 touch-none"
                       onPointerDown={handlePointerDown}
                       onPointerMove={handlePointerMove}
                       onPointerUp={handlePointerUp}
                       onPointerLeave={handlePointerUp}
                       style={{ cursor: isTargetMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}
                   >
                       <div 
                           className={`relative shadow-2xl transition-transform duration-75 ease-out w-fit mx-auto ${animateImage ? 'animate-scan' : ''}`}
                           style={{ 
                               transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                               transformOrigin: 'center center'
                           }}
                       >
                           <img 
                               ref={imageRef}
                               src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} 
                               alt="Generated" 
                               className="max-w-full max-h-[70vh] object-contain select-none pointer-events-none border border-white/10"
                           />
                           
                           {/* Selection Box Overlay */}
                           {isTargetMode && selectionBox && (
                               <div 
                                 className="absolute border-2 border-cyan-500 bg-cyan-500/20 shadow-[0_0_15px_cyan] z-10 pointer-events-none"
                                 style={{
                                     left: `${selectionBox.x}%`,
                                     top: `${selectionBox.y}%`,
                                     width: `${selectionBox.w}%`,
                                     height: `${selectionBox.h}%`
                                 }}
                               >
                                   <div className="absolute -top-6 left-0 bg-cyan-500 text-black text-[10px] font-bold px-1">TARGET</div>
                               </div>
                           )}
                       </div>
                   </div>

                   {/* Refinement Toolbar */}
                   <div className="w-full bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-4 flex flex-col md:flex-row items-center gap-4">
                       {/* History Controls */}
                       <div className="flex items-center gap-2">
                           <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 hover:bg-white/10 rounded disabled:opacity-30 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                           <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-white/10 rounded disabled:opacity-30 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
                       </div>
                       
                       {/* Select Area Button (Relocated) */}
                       <MagneticButton
                           onClick={toggleTargetMode}
                           className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${isTargetMode ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-cyan-500'}`}
                       >
                           {isTargetMode ? 'Stop Selecting' : 'Select Area'}
                       </MagneticButton>

                       {/* Edit Input */}
                       <div className="flex-1 w-full relative">
                           <input 
                               type="text" 
                               value={editPrompt}
                               onChange={(e) => setEditPrompt(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                               placeholder={isTargetMode ? "Describe change for selected area..." : "Describe change for whole image..."}
                               className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
                           />
                           <button 
                               onClick={handleEdit}
                               disabled={!editPrompt.trim()}
                               className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-cyan-300 disabled:opacity-30"
                           >
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                           </button>
                       </div>

                       {/* Tools */}
                       <div className="flex gap-2">
                           <button onClick={handleOutpaint} className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-xs hover:bg-slate-700 hover:text-white transition-colors">Extend</button>
                           <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 border border-slate-600 rounded text-xs transition-colors ${showFilters ? 'bg-cyan-900 text-cyan-200 border-cyan-500' : 'bg-slate-800 hover:bg-slate-700'}`}>Filters</button>
                           <button 
                            onClick={() => setShowDownloadConfirm(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                           >
                               Download
                           </button>
                       </div>
                   </div>
                   
                   {/* Filter Panel */}
                   {showFilters && (
                       <div className="w-full bg-slate-900/90 border-t border-white/10 p-4 grid grid-cols-2 md:grid-cols-6 gap-4 animate-fade-in">
                           {Object.entries(adjustments).map(([key, val]) => (
                               <div key={key} className="space-y-1">
                                   <label className="text-[10px] uppercase text-slate-500">{key}</label>
                                   <input 
                                       type="range" 
                                       min={key === 'blur' ? 0 : 0} 
                                       max={key === 'blur' ? 20 : 200} 
                                       value={val}
                                       onChange={(e) => setAdjustments(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                       className="w-full accent-cyan-500 h-1 bg-slate-700 rounded cursor-pointer"
                                   />
                               </div>
                           ))}
                           <div className="flex items-end">
                               <button 
                                   onClick={async () => {
                                       if(!generatedImage) return;
                                       // USE CLEAN SOURCE
                                       const source = generatedImage.cleanBase64 || generatedImage.base64;
                                       const filteredClean = await applyImageAdjustments(source, adjustments);
                                       
                                       // Re-apply watermark
                                       const watermarked = await applyWatermark(filteredClean);
                                       updateHistory({ 
                                           ...generatedImage, 
                                           id: Date.now().toString(), 
                                           base64: watermarked, 
                                           cleanBase64: filteredClean,
                                           timestamp: Date.now() 
                                       });
                                   }}
                                   className="w-full py-1 bg-cyan-600 text-white text-xs rounded"
                               >Apply</button>
                           </div>
                       </div>
                   )}
                </div>
            )}

        </TiltPanel>
        </div>

      </main>
      
      {/* --- PORTALS --- */}
      
      {/* AUTH MODAL */}
      {showAuthModal && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="w-full max-w-sm bg-slate-900 border border-red-500/50 rounded-xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.2)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-amber-500"></div>
                  
                  <div className="flex items-center gap-3 mb-4 text-red-500">
                      <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <h3 className="text-sm font-bold tracking-widest uppercase">Security Clearance Required</h3>
                  </div>
                  
                  <p className="text-slate-400 text-xs mb-6 font-mono leading-relaxed">
                      Neural link requires Level 5 Authorization Code to access Quantum Models. 
                      Please verify credentials.
                  </p>
                  
                  <div className="space-y-4">
                      <div className="relative group">
                          <label className="text-[10px] text-red-400 uppercase font-bold mb-1 block tracking-wider">Authorization Code</label>
                          <input 
                            type="password"
                            value={customApiKey}
                            defaultValue={username === 'nsdadmin' && !customApiKey ? ADMIN_KEY : customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            placeholder="ENTER_API_KEY_SEQUENCE"
                            className="w-full bg-black/50 border border-red-900/50 rounded p-3 text-white text-xs font-mono focus:border-red-500 outline-none tracking-wider placeholder-red-900/50"
                            autoFocus
                          />
                      </div>
                      
                      <div className="flex justify-end gap-3 pt-2">
                          <button onClick={() => setShowAuthModal(false)} className="px-4 py-2 text-slate-500 hover:text-white text-xs uppercase tracking-widest">Abort</button>
                          <button 
                            onClick={handleAuthSubmit}
                            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] flex items-center gap-2"
                          >
                              Authorize
                          </button>
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* CONSOLE OVERLAY */}
      {isConsoleOpen && createPortal(
          <div 
            ref={consoleContainerRef}
            className={`fixed bottom-0 left-0 right-0 z-[100] bg-[#0a0f1e]/95 backdrop-blur-xl border-t border-cyan-500/30 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] transition-all duration-300 animate-fade-in-up font-mono text-xs text-green-400 flex flex-col ${
                consoleSize === 'small' ? 'h-[200px]' : consoleSize === 'medium' ? 'h-[50vh]' : 'h-[100vh]'
            }`}
          >
              {/* Header */}
              <div className="flex justify-between items-center px-4 py-1 bg-cyan-950/50 border-b border-cyan-500/20 select-none shrink-0">
                  <span className="tracking-widest text-cyan-500 uppercase text-[10px]">UMBRAX_KERNEL_DEBUG_SHELL</span>
                  <div className="flex items-center gap-3">
                      <button onClick={() => setConsoleSize(consoleSize === 'small' ? 'medium' : consoleSize === 'medium' ? 'full' : 'small')} className="hover:text-white text-cyan-600" title="Resize">
                         {consoleSize === 'full' ? '⤓' : '⤒'}
                      </button>
                      <button onClick={toggleConsole} className="hover:text-white text-red-500" title="Close">[CLOSE]</button>
                  </div>
              </div>
              
              {/* Output */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar bg-black/40">
                  {consoleLogs.map((log) => (
                      <div key={log.id} className={`flex gap-2 ${log.type === 'error' ? 'text-red-500' : log.type === 'warn' ? 'text-yellow-400' : log.type === 'system' ? 'text-cyan-400' : 'text-green-400/80'}`}>
                          <span className="opacity-50 text-[10px] shrink-0">[{log.timestamp}]</span>
                          <span className="break-all whitespace-pre-wrap font-mono">{log.message}</span>
                      </div>
                  ))}
              </div>
              
              {/* Input */}
              <div className="p-2 bg-black/60 border-t border-white/5 flex items-center gap-2 pb-8 md:pb-2 shrink-0">
                  <span className="text-cyan-500">{`>`}</span>
                  <input 
                    ref={consoleInputRef}
                    type="text" 
                    value={consoleInput}
                    onChange={(e) => setConsoleInput(e.target.value)}
                    onKeyDown={handleConsoleCommand}
                    className="flex-1 bg-transparent outline-none text-white placeholder-white/20"
                    placeholder="enter system command..."
                    autoFocus
                  />
              </div>
          </div>,
          document.body
      )}

      {/* DOWNLOAD CONFIRMATION MODAL */}
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
      
      {/* GALLERY MODAL */}
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
                       <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/80 text-[10px] text-slate-400 truncate">
                           {new Date(img.timestamp).toLocaleTimeString()}
                       </div>
                   </div>
               ))}
           </div>
        </div>,
        document.body
      )}

      {/* SAVE PRESET MODAL */}
      {showPresetSave && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-xl p-6 shadow-2xl">
                  <h3 className="text-white font-bold mb-4">SAVE PRESET</h3>
                  <input 
                    type="text" 
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Enter preset name..."
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mb-4 focus:border-cyan-500 outline-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setShowPresetSave(false)} className="text-slate-400 hover:text-white text-xs">CANCEL</button>
                      <button onClick={handlePresetSave} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs">SAVE</button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* --- FOOTER (PORTAL TO BODY FOR FIXED POS) --- */}
      {createPortal(
        <div className={`fixed bottom-0 left-0 right-0 z-40 bg-[#020617]/90 border-t border-white/10 backdrop-blur-md px-4 md:px-6 py-2 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest transition-opacity duration-500 ${isVoidMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex items-center gap-2 md:gap-4">
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
                {/* Dynamic Model Name Display */}
                <span className="hidden md:inline">
                    MODEL: {
                        options.model === AIModel.FLASH ? "NSD-CORE/70B (IRIS)" :
                        options.model === AIModel.IMAGEN ? "NSD-GEN/2.5" :
                        "NSD-QUANTUM/3.0 (ULTRA)"
                    }
                </span>
                <span className="hidden md:inline text-slate-700">|</span>
                <a href="https://app.fearyour.life/" target="_blank" rel="noreferrer" className="hidden md:inline text-amber-400 hover:text-amber-300 hover:shadow-[0_0_10px_rgba(251,191,36,0.4)] transition-all cursor-pointer">
                    F&Q // SYNTHESIS CORE
                </a>
            </div>
            
            <div className="flex items-center gap-4">
                <a href="https://fearyour.life/" target="_blank" rel="noreferrer" className="hidden md:flex items-center gap-2 text-[10px] text-[#8b5bf5] hover:text-[#a78bfa] transition-all font-bold tracking-widest hover:shadow-[0_0_15px_rgba(139,91,245,0.4)]">
                    POWERED BY NSD-CORE/70B
                </a>
                <span className="opacity-70">ID: {initialId || defaultId}</span>
                {/* Terminal Toggle - Right Side */}
                <button 
                    onClick={toggleConsole} 
                    className={`p-1 rounded hover:bg-white/10 transition-colors ${isConsoleOpen ? 'text-cyan-400' : 'text-slate-500'}`}
                    title="System Console"
                >
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


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
import { extendImage, applyImageAdjustments, applyOutline, cropImage } from '../services/imageUtils';
import Loader from './Loader';

interface GeneratorProps {
  initialId?: string;
}

interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'error' | 'success' | 'system' | 'warn';
    message: string;
}

// --- COMPONENT: TILT PANEL (3D Holographic Effect) ---
const TiltPanel: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg)");
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Calculate rotation (reduced intensity from 3 to 1 degree)
        const rotateX = ((y - centerY) / centerY) * -1;
        const rotateY = ((x - centerX) / centerX) * 1;
        
        setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`);
    };

    const handleMouseLeave = () => {
        setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)");
    };

    return (
        <div 
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`transition-transform duration-200 ease-out ${className}`}
            style={{ transform }}
        >
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

const Generator: React.FC<GeneratorProps> = ({ initialId }) => {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);

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
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);

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

  // Scroll console to bottom
  useEffect(() => {
    if (isConsoleOpen && consoleEndRef.current) {
        consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
      logToConsole("CONNECTING TO NSD-CORE/17B API NODE...", 'warn');
      logToConsole("CONNECTION ESTABLISHED. READY FOR INPUT.", 'success');
  }, []);

  // Handle Console Commands
  const handleConsoleCommand = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          const cmd = consoleInput.trim().toLowerCase();
          logToConsole(`> ${consoleInput}`, 'info');
          setConsoleInput('');

          switch(cmd) {
              case 'help':
                  logToConsole("COMMANDS: HELP, SYS_STATUS, CLEAR, VER, FLUX_CHECK, PURGE, LS, PING, OVERRIDE, UPTIME", 'system');
                  break;
              case 'clear':
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
                  logToConsole("UMBRAX FLUX v3.0.1 (STABLE)", 'info');
                  logToConsole("BUILD: 2024-REL-C", 'info');
                  break;
              case 'flux_check':
                  logToConsole("CALIBRATING FLUX EMITTERS...", 'warn');
                  setTimeout(() => logToConsole("EMITTERS OPTIMIZED. EFFICIENCY: 99.9%", 'success'), 800);
                  break;
              case 'purge':
                  logToConsole("INITIATING CACHE PURGE...", 'error');
                  setTimeout(() => logToConsole("CACHE CLEARED. TEMPORARY FILES DELETED.", 'success'), 1000);
                  break;
              case 'ls':
                  logToConsole("drwxr-xr-x  root  system  /var/flux_cache", 'info');
                  logToConsole("drwxr-xr-x  admin system  /usr/models/weights", 'info');
                  logToConsole("-rw-r--r--  root  root    config.sys", 'info');
                  logToConsole("-rw-r--r--  user  group   session_key.pem", 'info');
                  break;
              case 'override':
                  logToConsole("SECURITY OVERRIDE INITIATED...", 'warn');
                  setTimeout(() => logToConsole("ACCESS DENIED. LEVEL 5 CLEARANCE REQUIRED.", 'error'), 1200);
                  break;
              case 'uptime':
                  const uptime = Math.floor(performance.now() / 1000);
                  logToConsole(`SYSTEM UPTIME: ${uptime} SECONDS`, 'info');
                  break;
              case 'matrix':
                  logToConsole("WAKE UP, NEO...", 'success');
                  setTimeout(() => logToConsole("THE MATRIX HAS YOU...", 'success'), 1000);
                  setTimeout(() => logToConsole("FOLLOW THE WHITE RABBIT.", 'success'), 2000);
                  break;
              case 'ping':
                  logToConsole("PING nsd-core.local (192.168.1.1): 56 data bytes", 'info');
                  setTimeout(() => logToConsole("64 bytes from 192.168.1.1: icmp_seq=0 time=0.042 ms", 'info'), 300);
                  setTimeout(() => logToConsole("64 bytes from 192.168.1.1: icmp_seq=1 time=0.038 ms", 'info'), 600);
                  setTimeout(() => logToConsole("64 bytes from 192.168.1.1: icmp_seq=2 time=0.045 ms", 'info'), 900);
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
    } else {
        setSelectionBox(null);
        setIsTargetMode(false);
    }

    const t = setTimeout(() => setAnimateImage(false), 1000);
    return () => clearTimeout(t);
  }, [generatedImage?.id]);

  // FIX: Zoom Scroll prevention.
  useEffect(() => {
    const element = imageWrapperRef.current;
    if (!element) return;

    const handleWheelNative = (e: WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        setZoom(prev => Math.min(Math.max(0.5, prev + scaleAmount), 5));
    };

    element.addEventListener('wheel', handleWheelNative, { passive: false });

    return () => {
        element.removeEventListener('wheel', handleWheelNative);
    };
  }, [imageWrapperRef.current]); 

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

  const loadFromGallery = (img: GeneratedImage) => {
    setGeneratedImage(img);
    setHistory([img]);
    setHistoryIndex(0);
    setShowGallery(false);
    logToConsole(`GALLERY: IMAGE ID ${img.id} LOADED`, 'success');
  };

  const deleteFromGallery = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setGallery(prev => prev.filter(img => img.id !== id));
    logToConsole(`GALLERY: IMAGE ID ${id} DELETED`, 'warn');
  };

  // Presets Logic
  const savePreset = () => {
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
    logToConsole(`PRESET SAVED: ${newPreset.name}`, 'success');
  };

  const loadPreset = (preset: Preset) => {
    setOptions(preset.options);
    setPresetDropdownOpen(false);
    logToConsole(`PRESET LOADED: ${preset.name}`, 'info');
  };

  const deletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedPresets = presets.filter(p => p.id !== id);
    setPresets(updatedPresets);
    localStorage.setItem('infogenius_presets', JSON.stringify(updatedPresets));
    logToConsole(`PRESET DELETED`, 'warn');
  };

  // Image Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setUploadedImage(result);
      logToConsole(`IMAGE UPLOADED: ${file.name}`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    logToConsole("UPLOAD BUFFER CLEARED", 'info');
  };

  // Generation Logic
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    setSelectionBox(null);
    setShowSuggestions(false);
    logToConsole(`INITIATING GENERATION: "${prompt.substring(0, 30)}..."`, 'info');

    // Parse custom ratio if needed
    let finalOptions = { ...options };
    if (options.aspectRatio === AspectRatio.CUSTOM) {
        const parts = customRatioInput.split(':').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            finalOptions.customRatioValue = parts[0] / parts[1];
        } else {
            const msg = "Invalid Custom Ratio. Use format W:H (e.g., 21:9)";
            setError(msg); // Visual error
            logToConsole(msg, 'error'); // Log error
            setIsLoading(false);
            return;
        }
    }

    try {
      // If uploaded image exists, pass it to the service (stripping the data URL prefix)
      const inputImageBase64 = uploadedImage ? uploadedImage.split(',')[1] : undefined;
      
      if (inputImageBase64) logToConsole("MULTIMODAL INPUT DETECTED", 'info');

      const rawImg = await generateImage(prompt, finalOptions, inputImageBase64);
      const imgWithId = { ...rawImg, id: Date.now().toString() };
      updateHistory(imgWithId, true);
      logToConsole("GENERATION COMPLETE. IMAGE RENDERED.", 'success');
      
      // Clear uploaded image after successful generation
      if (inputImageBase64) {
        clearUploadedImage();
      }
    } catch (err: any) {
      const realErrorMessage = err.message || JSON.stringify(err);
      
      // Log the FULL error object to the console
      logToConsole(`CRITICAL ERROR: ${realErrorMessage}`, 'error');
      
      // Check if it's a quota error to show a specific thematic message in UI
      if (realErrorMessage.includes("QUOTA") || realErrorMessage.includes("429") || realErrorMessage.includes("RESOURCE_EXHAUSTED")) {
          setError("RESOURCE DEPLETED // INSUFFICIENT CREDITS");
          if (realErrorMessage.includes("limit: 0")) {
             logToConsole("ADVISORY: FREE TIER LIMIT FOR THIS MODEL IS 0. ENABLE BILLING IN GOOGLE CLOUD CONSOLE TO UNLOCK QUOTA.", 'warn');
          }
      } else {
          // Show a random thematic error for other issues
          const randomError = THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)];
          setError(randomError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptSuggest = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    logToConsole("QUERYING AI FOR PROMPT ENHANCEMENTS...", 'info');
    try {
        const sugs = await getPromptEnhancements(prompt);
        setSuggestions(sugs);
        setShowSuggestions(true);
        logToConsole("SUGGESTIONS RECEIVED", 'success');
    } catch (e: any) {
        const msg = e.message || String(e);
        logToConsole(`SUGGESTION FAILED: ${msg}`, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editPrompt.trim() || !generatedImage) return;
    setIsLoading(true);
    setError(null);
    logToConsole(`INITIATING EDIT: "${editPrompt.substring(0, 30)}..."`, 'info');

    try {
      let finalEditPrompt = editPrompt;
      if (selectionBox) {
        const { x, y, w, h } = selectionBox;
        finalEditPrompt = `${editPrompt}. IMPORTANT: Apply this change EXCLUSIVELY to the region bounded by Top: ${Math.round(y)}%, Left: ${Math.round(x)}%, Bottom: ${Math.round(y + h)}%, Right: ${Math.round(x + w)}%. Preserve the rest.`;
        logToConsole(`REGION LOCK ACTIVE: [${Math.round(x)},${Math.round(y)}]`, 'warn');
      }

      const rawImg = await editImage(generatedImage, finalEditPrompt, options);
      const imgWithId = { ...rawImg, id: Date.now().toString() };
      updateHistory(imgWithId, false);
      setEditPrompt(''); 
      setSelectionBox(null);
      setIsTargetMode(false);
      logToConsole("EDIT COMPLETE", 'success');
    } catch (err: any) {
      const realErrorMessage = err.message || JSON.stringify(err);
      logToConsole(`EDIT FAILED: ${realErrorMessage}`, 'error');
      
      if (realErrorMessage.includes("QUOTA") || realErrorMessage.includes("429")) {
          setError("RESOURCE DEPLETED // INSUFFICIENT CREDITS");
      } else {
          const randomError = THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)];
          setError(randomError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOutpaint = async () => {
    if (!generatedImage) return;
    setIsLoading(true);
    setError(null);
    logToConsole("INITIATING OUTPAINTING SEQUENCE...", 'info');

    try {
        const extendedBase64 = await extendImage(generatedImage.base64, 1.5);
        const tempImage: GeneratedImage = { ...generatedImage, base64: extendedBase64 };
        const outpaintPrompt = "Outpainting task: The center of this image contains original content. The surrounding dark area is empty canvas. Seamlessly extend the scene into the empty area, matching the style, lighting, and perspective of the original center content.";
        const rawImg = await editImage(tempImage, outpaintPrompt, options);
        const imgWithId = { ...rawImg, id: Date.now().toString() };
        updateHistory(imgWithId, false);
        logToConsole("OUTPAINTING COMPLETE", 'success');
    } catch (err: any) {
        const realErrorMessage = err.message || JSON.stringify(err);
        logToConsole(`OUTPAINT FAILED: ${realErrorMessage}`, 'error');
        
        if (realErrorMessage.includes("QUOTA") || realErrorMessage.includes("429")) {
             setError("RESOURCE DEPLETED // INSUFFICIENT CREDITS");
        } else {
             const randomError = THEMATIC_ERRORS[Math.floor(Math.random() * THEMATIC_ERRORS.length)];
             setError(randomError);
        }
    } finally {
        setIsLoading(false);
    }
  };

  // Local Image Processing
  const handleApplyFilters = async () => {
    if (!generatedImage) return;
    setIsLoading(true);
    setProcessingMessage("Applying filters...");
    logToConsole("APPLYING CLIENT-SIDE FILTERS...", 'info');
    
    setTimeout(async () => {
      try {
        const newBase64 = await applyImageAdjustments(generatedImage.base64, adjustments);
        const newImg: GeneratedImage = {
          ...generatedImage,
          id: Date.now().toString(),
          base64: newBase64,
          timestamp: Date.now()
        };
        updateHistory(newImg, false);
        setAdjustments({ brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, grayscale: 0 });
        setShowFilters(false);
        logToConsole("FILTERS APPLIED SUCCESSFULLY", 'success');
      } catch (e) {
        logToConsole("FILTER ERROR", 'error');
        setError("FILTER APPLICATION FAILED");
      } finally {
        setIsLoading(false);
        setProcessingMessage("");
      }
    }, 100);
  };

  const handleApplyCrop = async () => {
      if (!generatedImage || !selectionBox) return;
      setIsLoading(true);
      logToConsole("CROPPING IMAGE...", 'info');
      try {
        const newBase64 = await cropImage(generatedImage.base64, selectionBox);
        const newImg: GeneratedImage = {
            ...generatedImage,
            id: Date.now().toString(),
            base64: newBase64,
            timestamp: Date.now()
        };
        updateHistory(newImg, false);
        setSelectionBox(null);
        setIsTargetMode(false);
        logToConsole("CROP COMPLETE", 'success');
      } catch (e) {
          logToConsole("CROP FAILED", 'error');
          setError("CROP FAILED");
      } finally {
          setIsLoading(false);
      }
  };

  const handleApplyOutline = async () => {
    if (!generatedImage) return;
    setIsLoading(true);
    setProcessingMessage("Analyzing edge geometry...");
    logToConsole("CALCULATING EDGE GEOMETRY...", 'info');

    setTimeout(async () => {
      try {
        const newBase64 = await applyOutline(generatedImage.base64);
        const newImg: GeneratedImage = {
          ...generatedImage,
          id: Date.now().toString(),
          base64: newBase64,
          timestamp: Date.now()
        };
        updateHistory(newImg, false);
        logToConsole("OUTLINE EFFECT RENDERED", 'success');
      } catch (e) {
        logToConsole("OUTLINE EFFECT FAILED", 'error');
        setError("OUTLINE EFFECT FAILED");
      } finally {
        setIsLoading(false);
        setProcessingMessage("");
      }
    }, 100);
  };

  const initiateDownload = () => {
    if (!generatedImage) return;
    setShowDownloadConfirm(true);
  };

  const performDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = `data:${generatedImage.mimeType};base64,${generatedImage.base64}`;
    link.download = `umbraflux-${generatedImage.timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadConfirm(false);
    logToConsole(`FILE DOWNLOADED: umbraflux-${generatedImage.timestamp}.png`, 'success');
  };

  // --- Interaction Handlers (Zoom, Pan, Selection) ---
  const getRelativeCoords = (e: React.MouseEvent) => {
    if (!imageWrapperRef.current) return { x: 0, y: 0 };
    const rect = imageWrapperRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isTargetMode) {
        e.preventDefault();
        e.stopPropagation(); 
        const coords = getRelativeCoords(e);
        setDragStart(coords);
        setSelectionBox({ x: coords.x, y: coords.y, w: 0, h: 0 });
        setIsDragging(true);
    } else {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && isTargetMode && dragStart) {
        e.preventDefault();
        const coords = getRelativeCoords(e);
        
        const x = Math.min(coords.x, dragStart.x);
        const y = Math.min(coords.y, dragStart.y);
        let w = Math.abs(coords.x - dragStart.x);
        let h = Math.abs(coords.y - dragStart.y);
        setSelectionBox({ x, y, w, h });
    } else if (isPanning) {
        e.preventDefault();
        setPan({
            x: e.clientX - panStart.x,
            y: e.clientY - panStart.y
        });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
        setIsDragging(false);
        if (selectionBox && (selectionBox.w < 1 || selectionBox.h < 1)) {
            setSelectionBox(null);
        }
    }
    setIsPanning(false);
  };

  const getAspectRatioClass = (ratio: AspectRatio | string) => {
    switch (ratio) {
      case AspectRatio.SQUARE: return 'aspect-square max-w-[500px]';
      case AspectRatio.LANDSCAPE: return 'aspect-video max-w-full';
      case AspectRatio.PORTRAIT: return 'aspect-[9/16] max-h-[60vh]';
      case AspectRatio.STANDARD: return 'aspect-[4/3] max-w-[700px]';
      case AspectRatio.TALL: return 'aspect-[3/4] max-h-[60vh]';
      case AspectRatio.CUSTOM: return 'aspect-square max-w-[600px]';
      default: return 'aspect-square';
    }
  };

  const renderAdjustmentSlider = (label: string, key: keyof ImageAdjustments, min: number, max: number, unit: string = "") => (
    <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase text-slate-400 w-16">{label}</span>
        <input 
            type="range" min={min} max={max} 
            value={adjustments[key]}
            onChange={(e) => setAdjustments({ ...adjustments, [key]: parseInt(e.target.value) })}
            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:bg-slate-600 transition-colors"
        />
        <span className="text-[10px] font-mono text-slate-300 w-8 text-right">{adjustments[key]}{unit}</span>
    </div>
  );

  const previousImage = historyIndex > 0 ? history[historyIndex - 1] : null;

  // Determine Display Model Name for Footer
  const getModelDisplayName = (m: AIModel) => {
      switch(m) {
          case AIModel.FLASH: return 'UMBRAX-IRIS_5.1';
          case AIModel.IMAGEN: return 'UMBRX-GEN_2.5';
          case AIModel.EXP_FLASH: return 'UMBRAX-BETA_2.0 (EXP)';
          case AIModel.PRO_IMAGE: return 'UMBRAX-PRIME_3.0 (PRE)';
          default: return 'UNKNOWN_MODEL';
      }
  };

  const getConsoleHeight = () => {
      switch(consoleSize) {
          case 'small': return '300px';
          case 'medium': return '50vh';
          case 'full': return '100vh';
          default: return '300px';
      }
  };

  const footerContent = (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#020617]/90 border-t border-white/10 backdrop-blur-md px-6 py-2 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest select-none">
        <div className="flex items-center gap-4">
            {isLoading ? (
                 <span className="flex items-center gap-2 text-amber-500 transition-colors duration-300">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    PROCESSING DATA
                </span>
            ) : (
                <span className="flex items-center gap-2 transition-colors duration-300">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    SYSTEM READY
                </span>
            )}

            <span className="hidden md:inline text-slate-700">|</span>
            <span className="hidden md:inline">MODEL: {getModelDisplayName(options.model)}</span>
            <span className="hidden md:inline text-slate-700">|</span>
             <a href="https://app.fearyour.life/" target="_blank" rel="noreferrer" className="hidden md:inline text-amber-400 hover:text-amber-300 hover:shadow-[0_0_10px_rgba(251,191,36,0.4)] transition-all cursor-pointer">
                F&Q // SYNTHESIS CORE
            </a>
        </div>
        
        <div className="flex items-center gap-4 opacity-70">
            <span>ID: {initialId || defaultId}</span>
            <span className="text-slate-700">|</span>
             {/* Terminal moved here, simplified */}
            <button onClick={toggleConsole} className="hover:text-cyan-400 flex items-center gap-1 transition-colors opacity-50 hover:opacity-100" title="Open System Console">
                {">_"}
            </button>
        </div>
    </div>
  );

  const consoleContent = isConsoleOpen ? (
    <div 
        className="fixed bottom-0 left-0 right-0 z-[100] bg-black/95 border-t border-cyan-500/30 font-mono text-xs shadow-[0_-10px_40px_rgba(0,0,0,0.8)] animate-fade-in-up flex flex-col transition-all duration-300" 
        style={{ height: getConsoleHeight() }}
    >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-1 bg-cyan-900/20 border-b border-cyan-500/20 select-none">
            <span className="text-cyan-500 font-bold tracking-widest">UMBRAX_KERNEL_DEBUG_SHELL</span>
            <div className="flex items-center gap-2">
                {/* Size Controls */}
                <button 
                    onClick={() => setConsoleSize('small')} 
                    className={`p-1 hover:bg-cyan-900/40 rounded ${consoleSize === 'small' ? 'text-white' : 'text-cyan-500/50'}`}
                    title="Minimize Height"
                >
                    _
                </button>
                <button 
                    onClick={() => setConsoleSize('medium')} 
                    className={`p-1 hover:bg-cyan-900/40 rounded ${consoleSize === 'medium' ? 'text-white' : 'text-cyan-500/50'}`}
                    title="Medium Height"
                >
                    ▢
                </button>
                <button 
                    onClick={() => setConsoleSize('full')} 
                    className={`p-1 hover:bg-cyan-900/40 rounded ${consoleSize === 'full' ? 'text-white' : 'text-cyan-500/50'}`}
                    title="Full Screen"
                >
                    ⤡
                </button>
                <span className="text-cyan-500/20">|</span>
                <button onClick={toggleConsole} className="text-cyan-500/50 hover:text-cyan-400">[CLOSE]</button>
            </div>
        </div>
        
        {/* Logs Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-black">
            {consoleLogs.map((log) => (
                <div key={log.id} className={`font-mono break-words ${log.type === 'error' ? 'text-red-500' : log.type === 'warn' ? 'text-amber-500' : log.type === 'success' ? 'text-green-400' : log.type === 'system' ? 'text-cyan-600 font-bold' : 'text-slate-300'}`}>
                    <span className="opacity-30 mr-2 select-none">[{log.timestamp}]</span>
                    <span className="whitespace-pre-wrap">{log.message}</span>
                </div>
            ))}
            <div ref={consoleEndRef}></div>
        </div>

        {/* Input Area */}
        <div className="p-2 bg-black border-t border-white/10 flex items-center pb-2">
            <span className="text-cyan-500 mr-2">{">"}</span>
            <input 
                ref={consoleInputRef}
                type="text" 
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                onKeyDown={handleConsoleCommand}
                className="flex-1 bg-transparent border-none outline-none text-cyan-300 placeholder-cyan-900/50"
                placeholder="Enter system command..."
                autoComplete="off"
            />
        </div>
    </div>
  ) : null;

  return (
    <>
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center pt-20 pb-24 px-4 md:px-6 lg:px-8 animate-fade-in-up">
      
      {/* Header / Branding */}
      <div className="w-full mb-10 text-center relative z-10 flex flex-col items-center">
        <div className="flex justify-center items-center w-full relative">
            {/* Desktop Gallery Button */}
            <div className="absolute left-0 hidden md:block">
                <MagneticButton 
                    onClick={() => setShowGallery(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/40 border border-white/5 text-slate-300 hover:bg-slate-700 hover:text-white group hover:border-cyan-500/30"
                >
                    <svg className="w-5 h-5 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    GALLERY
                </MagneticButton>
            </div>
            <div>
                <div className="inline-block px-4 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-mono tracking-widest mb-6 animate-fade-in shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                <span className="mr-2">⚡</span> POWERED BY NSD-CORE/17B
                </div>
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-2 tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-400">UMBRAX</span>
                  <span className="text-cyan-500 ml-3 md:ml-4 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">FLUX 3</span>
                </h2>
                <p className="text-slate-400 tracking-[0.5em] text-xs font-mono uppercase opacity-80">
                   DREAMS ENGINEERED.
                </p>
            </div>
            <div className="absolute right-0 hidden md:block w-[100px]"></div>
        </div>
        {/* Mobile Gallery Button */}
        <button onClick={() => setShowGallery(true)} className="md:hidden mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/40 border border-white/10 text-slate-300 hover:bg-slate-800 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            View Gallery
        </button>
      </div>

      {/* Input Panel - Increased Z-Index to 50 to overlap Output Area properly */}
      <TiltPanel className="w-full glass-panel rounded-3xl p-5 md:p-8 mb-8 shadow-2xl shadow-blue-900/10 relative z-50 border border-white/10 hover:border-white/20">
        
        {/* Preset Toolbar */}
        <div className="flex justify-end items-center mb-4 gap-2">
          <div className="relative">
            <button 
              onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-xs font-mono text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            >
              PRESETS <span className="text-[10px] transition-transform duration-300" style={{transform: presetDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}}>▼</span>
            </button>
            
            {presetDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                {presets.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 text-center">No saved presets</div>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    {presets.map(preset => (
                      <div key={preset.id} onClick={() => loadPreset(preset)} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800 cursor-pointer group border-b border-slate-800/50 last:border-none transition-colors">
                        <span className="text-sm text-slate-300 group-hover:text-white">{preset.name}</span>
                        <button onClick={(e) => deletePreset(e, preset.id)} className="text-slate-600 hover:text-red-400 p-1 transition-colors">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setShowPresetSave(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-xs font-mono text-slate-300 hover:bg-slate-700 hover:text-white transition-all">
            SAVE
          </button>
        </div>
        
        {/* Uploaded Image Preview */}
        {uploadedImage && (
            <div className="mb-4 relative inline-block group animate-fade-in">
                <img src={uploadedImage} alt="Upload Preview" className="h-20 w-auto rounded-lg border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]" />
                <button 
                    onClick={clearUploadedImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg transform hover:scale-110 transition-all"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] text-cyan-400 py-0.5 rounded-b-lg backdrop-blur-sm">
                    REFERENCE ACTIVE
                </div>
            </div>
        )}

        {/* Main Prompt Input */}
        <div className="relative mb-8 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {/* Sci-Fi Command Prompt Icon */}
            <span className="text-cyan-500 font-mono font-bold text-lg group-hover:animate-pulse">{">_"}</span>
          </div>
          
          {/* Upload Button inside input */}
          <div className="absolute inset-y-0 right-14 flex items-center">
              <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
              />
              <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-slate-800 rounded-lg"
                  title="Upload Reference Image"
              >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
          </div>

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="ENTER YOUR SYNTHESIS DIRECTIVE"
            className="w-full bg-slate-900/50 border border-slate-700 text-white text-lg rounded-xl pl-12 pr-24 py-4 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_25px_rgba(6,182,212,0.2)] hover:border-slate-500 placeholder-slate-600 transition-all duration-300 shadow-inner font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          {/* Magic Wand */}
          <button 
              onClick={handlePromptSuggest}
              disabled={!prompt.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-cyan-400 disabled:opacity-30 transition-colors hover:scale-110 active:scale-95"
              title="Enhance Prompt with AI"
          >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </button>

          {/* Suggestions Modal/Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl z-50 p-4 shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">AI Suggestions</span>
                      <button onClick={() => setShowSuggestions(false)} className="text-slate-500 hover:text-white transition-colors">×</button>
                  </div>
                  <div className="space-y-2">
                      {suggestions.map((sug, idx) => (
                          <div 
                              key={idx} 
                              onClick={() => { setPrompt(sug); setShowSuggestions(false); }}
                              className="p-3 bg-slate-800/30 hover:bg-slate-800 rounded-lg cursor-pointer text-sm text-slate-300 hover:text-white border border-transparent hover:border-cyan-500/20 transition-all"
                          >
                              {sug}
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative group lg:col-span-1">
             <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 ml-1 font-mono">Model</label>
             <select 
              className="w-full bg-slate-800/50 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-400 transition-all cursor-pointer"
              value={options.model}
              onChange={(e) => setOptions({...options, model: e.target.value as AIModel})}
            >
              <option value={AIModel.FLASH}>UMBRAX-IRIS_5.1</option>
              <option value={AIModel.EXP_FLASH}>UMBRAX-BETA_2.0 (EXP)</option>
              <option value={AIModel.IMAGEN}>UMBRX-GEN_2.5</option>
              <option value={AIModel.PRO_IMAGE}>UMBRAX-PRIME_3.0 (PRE)</option>
            </select>
          </div>

          <div className="relative group lg:col-span-1">
             <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 ml-1 font-mono">Aesthetic</label>
             <select 
              className="w-full bg-slate-800/50 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-400 transition-all cursor-pointer"
              value={options.aesthetic}
              onChange={(e) => setOptions({...options, aesthetic: e.target.value as Aesthetic})}
            >
              {Object.values(Aesthetic).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="relative group lg:col-span-1">
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 ml-1 font-mono">Ratio</label>
              {options.aspectRatio === AspectRatio.CUSTOM ? (
                  <div className="flex gap-1">
                       <input 
                          type="text" 
                          value={customRatioInput}
                          onChange={(e) => setCustomRatioInput(e.target.value)}
                          className="w-full bg-slate-800/50 border border-cyan-500/50 text-cyan-400 rounded-lg px-2 py-2.5 text-sm text-center outline-none focus:ring-1 focus:ring-cyan-400"
                          placeholder="W:H"
                       />
                       <button onClick={() => setOptions({...options, aspectRatio: AspectRatio.SQUARE})} className="text-slate-500 hover:text-white px-2 hover:bg-slate-800 rounded transition-colors">×</button>
                  </div>
              ) : (
                  <select 
                      className="w-full bg-slate-800/50 border border-slate-700 hover:border-slate-500 rounded-lg px-2 py-2.5 text-sm text-white outline-none text-center focus:ring-1 focus:ring-cyan-400 transition-all cursor-pointer"
                      value={options.aspectRatio}
                      onChange={(e) => setOptions({...options, aspectRatio: e.target.value as AspectRatio})}
                  >
                      {Object.entries(AspectRatio).map(([key, val]) => <option key={key} value={val}>{val}</option>)}
                  </select>
              )}
          </div>

          <div className="relative group lg:col-span-1">
              <label className="block text-[10px] text-slate-600 uppercase tracking-wider mb-1.5 ml-1 font-mono">Size</label>
              <select 
                  className={`w-full border rounded-lg px-2 py-2.5 text-sm text-center outline-none transition-all bg-slate-900/30 border-slate-800 text-slate-600 cursor-not-allowed`}
                  value={options.resolution}
                  disabled={true}
                  onChange={(e) => setOptions({...options, resolution: e.target.value as ImageResolution})}
              >
                  {Object.values(ImageResolution).map(val => <option key={val} value={val}>{val}</option>)}
              </select>
          </div>

          <div className="lg:col-span-1 flex items-end">
            <MagneticButton 
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className={`w-full h-[42px] rounded-lg font-semibold tracking-wide transition-all duration-300 shadow-lg transform active:scale-95 ${isLoading ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white border border-blue-400/20'}`}
            >
              {isLoading ? 'PROCESSING...' : 'INITIATE'}
            </MagneticButton>
          </div>
        </div>
      </TiltPanel>

      {/* Error Message (THEMATIC) */}
      {error && (
        <div className="w-full mb-8 p-4 bg-red-900/20 border border-red-500/50 text-red-300 rounded-xl flex items-center gap-4 animate-fade-in backdrop-blur-sm shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <div className="p-2 bg-red-500/20 rounded-full animate-pulse">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div className="flex-1">
             <p className="font-mono font-bold text-sm tracking-wider uppercase">{error}</p>
             <p className="text-xs text-red-400/60 font-mono mt-1">CHECK SYSTEM CONSOLE FOR DIAGNOSTICS.</p>
          </div>
        </div>
      )}

      {/* Output Area - Kept Z-Index lower (10) */}
      <div className="w-full relative min-h-[400px] flex justify-center items-center mb-20 z-10" ref={scrollRef}>
        
        {isLoading && (
           <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-3xl transition-all duration-500">
               <Loader />
               {processingMessage && <div className="absolute top-[65%] text-cyan-400 font-mono text-xs animate-pulse tracking-wider">{processingMessage}</div>}
           </div>
        )}

        {generatedImage && (
          <TiltPanel className={`relative w-full transition-all duration-700 ease-out ${isLoading ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
             
             <div className="glass-panel p-1.5 md:p-2 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col items-center bg-slate-900/40">
               
               {/* Toolbar */}
               <div className="w-full flex flex-wrap justify-between items-center px-3 md:px-4 py-2 border-b border-white/5 bg-slate-900/60 mb-2 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                      </button>
                      <span className="text-xs font-mono text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(Math.min(5, zoom + 0.2))} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                      <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 hover:text-white ml-1 border border-slate-700 hover:border-slate-500 transition-all">RESET</button>
                  </div>
                  
                  <div className="flex gap-2 mt-2 md:mt-0">
                      <button 
                          onClick={() => setIsCompareMode(!isCompareMode)}
                          disabled={!previousImage}
                          className={`text-[10px] md:text-xs px-3 py-1 rounded border transition-all ${isCompareMode ? 'bg-amber-900/40 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                      >
                          COMPARE
                      </button>
                      <button 
                          onClick={() => setShowFilters(!showFilters)}
                          className={`text-[10px] md:text-xs flex items-center gap-1 px-3 py-1 rounded transition-all ${showFilters ? 'bg-blue-600 text-white border border-blue-400' : 'text-slate-400 hover:text-white bg-slate-800 border border-slate-700'}`}
                      >
                          FILTERS
                      </button>
                  </div>
               </div>

               {/* Filters Panel - Animated Height */}
               <div className={`w-full overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-96 opacity-100 mb-2' : 'max-h-0 opacity-0'}`}>
                   <div className="bg-slate-900/80 p-4 rounded-xl border border-white/5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                       <div>
                           {renderAdjustmentSlider("Brightness", "brightness", 0, 200, "%")}
                           {renderAdjustmentSlider("Contrast", "contrast", 0, 200, "%")}
                       </div>
                       <div>
                           {renderAdjustmentSlider("Saturation", "saturation", 0, 200, "%")}
                           {renderAdjustmentSlider("Blur", "blur", 0, 20, "px")}
                       </div>
                       <div className="flex flex-col justify-between gap-2">
                           <div>
                              {renderAdjustmentSlider("Sepia", "sepia", 0, 100, "%")}
                              {renderAdjustmentSlider("Grayscale", "grayscale", 0, 100, "%")}
                           </div>
                           <div className="flex justify-end gap-2 mt-1">
                              <button onClick={handleApplyOutline} className="px-2 py-1 text-[10px] bg-slate-800 border border-slate-600 text-slate-300 rounded hover:bg-slate-700 transition-colors">FX: OUTLINE</button>
                              <button onClick={handleApplyFilters} className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/20">APPLY</button>
                           </div>
                       </div>
                   </div>
               </div>

               {/* IMAGE AREA */}
               <div 
                  className={`relative bg-slate-950 overflow-hidden rounded-xl bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] ${getAspectRatioClass(options.aspectRatio)} w-full cursor-move select-none shadow-inner border border-white/5`} 
                  ref={imageWrapperRef} 
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
               >
                  <div 
                      className={`w-full h-full relative transition-transform duration-75 ease-out origin-center ${animateImage ? 'animate-hologram' : ''}`}
                      style={{ 
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          filter: (!isCompareMode && showFilters) ? `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) blur(${adjustments.blur}px) sepia(${adjustments.sepia}%) grayscale(${adjustments.grayscale}%)` : 'none'
                      }}
                  >
                      {isCompareMode && previousImage ? (
                          // COMPARISON VIEW
                          <div className="absolute inset-0">
                              {/* Background: Previous Image */}
                              <img 
                                  src={`data:${previousImage.mimeType};base64,${previousImage.base64}`} 
                                  className="absolute inset-0 w-full h-full object-contain opacity-50 grayscale"
                                  alt="Previous"
                              />
                              <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] text-white border border-white/10 pointer-events-none">PREVIOUS</div>

                              {/* Foreground: Current Image (Clipped) */}
                              <div className="absolute inset-0 overflow-hidden border-r-2 border-amber-500 shadow-[0_0_15px_orange]" style={{ width: `${compareSliderPos}%` }}>
                                  <img 
                                      src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} 
                                      className="absolute inset-0 w-full h-full object-contain max-w-none"
                                      style={{ width: '100%', height: '100%' }} 
                                      alt="Current"
                                  />
                              </div>

                              {/* Slider Handle */}
                              <input 
                                  type="range" min="0" max="100" 
                                  value={compareSliderPos}
                                  onChange={(e) => setCompareSliderPos(parseInt(e.target.value))}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-col-resize z-20"
                              />
                              <div 
                                  className="absolute top-0 bottom-0 w-1 bg-transparent z-10 pointer-events-none"
                                  style={{ left: `${compareSliderPos}%` }}
                              >
                                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-amber-500 p-1.5 rounded-full shadow-lg cursor-grab">
                                      <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 17h8" /></svg>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          // NORMAL VIEW
                          <>
                              <img 
                              src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} 
                              alt="Generated visualization" 
                              className="w-full h-full object-contain pointer-events-none select-none"
                              />
                              
                              {isTargetMode && (
                                  <div className="absolute inset-0 z-20">
                                      {selectionBox && selectionBox.w > 0 && (
                                          <div 
                                              className="absolute border-2 border-cyan-400 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-brightness-110"
                                              style={{
                                                  left: `${selectionBox.x}%`,
                                                  top: `${selectionBox.y}%`,
                                                  width: `${selectionBox.w}%`,
                                                  height: `${selectionBox.h}%`
                                              }}
                                          >
                                              {/* Actions popup for selection */}
                                              <div className="absolute -bottom-9 left-0 flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/10 backdrop-blur-sm animate-fade-in">
                                                   {options.aspectRatio === AspectRatio.CUSTOM && (
                                                       <button 
                                                          onMouseDown={(e) => { e.stopPropagation(); handleApplyCrop(); }}
                                                          className="bg-cyan-600 text-white text-[10px] px-2 py-1 rounded hover:bg-cyan-500 transition-colors"
                                                       >
                                                           CROP
                                                       </button>
                                                   )}
                                                   <span className="text-cyan-400 text-[10px] px-2 py-1 font-mono">
                                                       Selection Active
                                                   </span>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}
                          </>
                      )}
                  </div>
               </div>

               {/* Refinement Bar */}
               <div className="mt-2 p-2 w-full bg-slate-900/80 rounded-xl flex flex-col md:flex-row items-center gap-3 border border-white/5 relative z-30 backdrop-blur-md">
                  
                  <div className="flex gap-1 w-full md:w-auto justify-center md:justify-start">
                      <button onClick={handleUndo} disabled={historyIndex <= 0} className={`p-2 rounded-lg transition-all ${historyIndex > 0 ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' : 'bg-slate-900/50 text-slate-700 border border-transparent'}`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                      </button>
                      <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={`p-2 rounded-lg transition-all ${historyIndex < history.length - 1 ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' : 'bg-slate-900/50 text-slate-700 border border-transparent'}`}>
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                      </button>
                  </div>

                  <div className="flex-1 w-full relative">
                     <input 
                        type="text" 
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder={selectionBox ? "Change selected area..." : "Add stars, change lighting..."}
                        className="w-full bg-slate-800 text-sm text-white rounded-lg pl-4 pr-4 py-2.5 focus:ring-1 focus:ring-cyan-400 outline-none border border-slate-700/50 hover:border-slate-600 transition-colors"
                        onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                     />
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 justify-center md:justify-end">
                      <MagneticButton onClick={handleOutpaint} className="whitespace-nowrap px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-white/10 transition-colors" title="Extend Borders (Outpaint)">
                          Extend
                      </MagneticButton>
                      <MagneticButton
                          onClick={() => { setIsTargetMode(!isTargetMode); if (isTargetMode) setSelectionBox(null); }}
                          className={`whitespace-nowrap px-3 py-2 rounded-lg border text-sm transition-all ${isTargetMode ? 'bg-cyan-900/80 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-slate-800 border-white/10 text-slate-400 hover:text-white'}`}
                      >
                          {isTargetMode ? 'Target Active' : 'Select Area'}
                      </MagneticButton>
                      <MagneticButton onClick={initiateDownload} className="whitespace-nowrap px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-900/30 transition-colors">
                          Download
                      </MagneticButton>
                  </div>
               </div>
             </div>
          </TiltPanel>
        )}

        {/* Empty State / Intro Visuals could go here if needed */}
        {!generatedImage && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center mt-10 opacity-30 pointer-events-none select-none">
                <div className="w-32 h-32 border border-slate-700 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                </div>
                <p className="text-sm font-mono tracking-[0.5em] text-slate-500 uppercase">Waiting for Input</p>
            </div>
        )}

      </div>
    </div>

    {/* --- OVERLAYS --- */}

    {/* Gallery Modal */}
    {showGallery && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center animate-fade-in p-4 md:p-8">
            <div className="w-full max-w-6xl h-[80vh] bg-slate-900 rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/30">
                    <h3 className="text-xl font-bold text-white tracking-wide">ARCHIVE GALLERY <span className="text-slate-500 text-sm ml-2">({gallery.length} ITEMS)</span></h3>
                    <button onClick={() => setShowGallery(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {gallery.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                             <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                             <p className="font-mono uppercase tracking-widest">No Archives Found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {gallery.map(img => (
                                <div key={img.id} onClick={() => loadFromGallery(img)} className="group relative aspect-square rounded-xl overflow-hidden border border-white/5 hover:border-cyan-500/50 cursor-pointer transition-all">
                                    <img src={`data:${img.mimeType};base64,${img.base64}`} alt="Gallery item" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-xs text-white line-clamp-1 font-mono mb-1">{img.prompt}</p>
                                        <p className="text-[10px] text-slate-400">{new Date(img.timestamp).toLocaleTimeString()}</p>
                                        <button 
                                            onClick={(e) => deleteFromGallery(e, img.id)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500 hover:text-white transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )}

    {/* Download Confirmation Modal */}
    {showDownloadConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center">
                <div className="w-12 h-12 mx-auto bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Confirm Download</h3>
                <p className="text-slate-400 text-sm mb-6">Save this synthesis to your local device?</p>
                <div className="flex gap-3">
                    <MagneticButton onClick={() => setShowDownloadConfirm(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">Cancel</MagneticButton>
                    <MagneticButton onClick={performDownload} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-900/20 transition-colors">Save File</MagneticButton>
                </div>
            </div>
        </div>
    )}

    {/* Preset Name Modal */}
    {showPresetSave && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-4">Save Configuration</h3>
                <input 
                    type="text" 
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Enter preset name..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 mb-4"
                    autoFocus
                />
                <div className="flex gap-3">
                    <MagneticButton onClick={() => setShowPresetSave(false)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm">Cancel</MagneticButton>
                    <MagneticButton onClick={savePreset} className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium">Save Preset</MagneticButton>
                </div>
            </div>
        </div>
    )}

    {/* SYSTEM STATUS FOOTER (App View) - PORTALED TO BODY TO FIX SMOOTH SCROLLING */}
    {createPortal(footerContent, document.body)}

    {/* SYSTEM CONSOLE OVERLAY (Fixed Bottom Drawer) - PORTALED TO BODY */}
    {isConsoleOpen && createPortal(consoleContent, document.body)}
    </>
  );
};

export default Generator;

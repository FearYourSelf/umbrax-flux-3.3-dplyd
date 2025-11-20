
import React, { useState, useRef, useEffect } from 'react';
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

const Generator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);

  // Load presets & Gallery on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('infogenius_presets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
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
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setGeneratedImage(history[newIndex]);
    }
  };

  const loadFromGallery = (img: GeneratedImage) => {
    setGeneratedImage(img);
    setHistory([img]);
    setHistoryIndex(0);
    setShowGallery(false);
  };

  const deleteFromGallery = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setGallery(prev => prev.filter(img => img.id !== id));
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
  };

  const loadPreset = (preset: Preset) => {
    setOptions(preset.options);
    setPresetDropdownOpen(false);
  };

  const deletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedPresets = presets.filter(p => p.id !== id);
    setPresets(updatedPresets);
    localStorage.setItem('infogenius_presets', JSON.stringify(updatedPresets));
  };

  // Image Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Remove prefix for API compatibility later if needed, but keep for preview
      // For preview we need the prefix. For API we need to strip it.
      // We store the full string for preview and strip it when calling API.
      setUploadedImage(result);
    };
    reader.readAsDataURL(file);
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Generation Logic
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    setSelectionBox(null);
    setShowSuggestions(false);

    // Parse custom ratio if needed
    let finalOptions = { ...options };
    if (options.aspectRatio === AspectRatio.CUSTOM) {
        const parts = customRatioInput.split(':').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            finalOptions.customRatioValue = parts[0] / parts[1];
        } else {
            setError("Invalid Custom Ratio. Use format W:H (e.g., 21:9)");
            setIsLoading(false);
            return;
        }
    }

    try {
      // If uploaded image exists, pass it to the service (stripping the data URL prefix)
      const inputImageBase64 = uploadedImage ? uploadedImage.split(',')[1] : undefined;
      
      const rawImg = await generateImage(prompt, finalOptions, inputImageBase64);
      const imgWithId = { ...rawImg, id: Date.now().toString() };
      updateHistory(imgWithId, true);
      
      // Clear uploaded image after successful generation
      if (inputImageBase64) {
        clearUploadedImage();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptSuggest = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    try {
        const sugs = await getPromptEnhancements(prompt);
        setSuggestions(sugs);
        setShowSuggestions(true);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editPrompt.trim() || !generatedImage) return;
    setIsLoading(true);
    setError(null);

    try {
      let finalEditPrompt = editPrompt;
      if (selectionBox) {
        const { x, y, w, h } = selectionBox;
        finalEditPrompt = `${editPrompt}. IMPORTANT: Apply this change EXCLUSIVELY to the region bounded by Top: ${Math.round(y)}%, Left: ${Math.round(x)}%, Bottom: ${Math.round(y + h)}%, Right: ${Math.round(x + w)}%. Preserve the rest.`;
      }

      const rawImg = await editImage(generatedImage, finalEditPrompt, options);
      const imgWithId = { ...rawImg, id: Date.now().toString() };
      updateHistory(imgWithId, false);
      setEditPrompt(''); 
      setSelectionBox(null);
      setIsTargetMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOutpaint = async () => {
    if (!generatedImage) return;
    setIsLoading(true);
    setError(null);

    try {
        const extendedBase64 = await extendImage(generatedImage.base64, 1.5);
        const tempImage: GeneratedImage = { ...generatedImage, base64: extendedBase64 };
        const outpaintPrompt = "Outpainting task: The center of this image contains original content. The surrounding dark area is empty canvas. Seamlessly extend the scene into the empty area, matching the style, lighting, and perspective of the original center content.";
        const rawImg = await editImage(tempImage, outpaintPrompt, options);
        const imgWithId = { ...rawImg, id: Date.now().toString() };
        updateHistory(imgWithId, false);
    } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to extend image");
    } finally {
        setIsLoading(false);
    }
  };

  // Local Image Processing
  const handleApplyFilters = async () => {
    if (!generatedImage) return;
    setIsLoading(true);
    setProcessingMessage("Applying filters...");
    
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
      } catch (e) {
        console.error(e);
        setError("Failed to apply filters");
      } finally {
        setIsLoading(false);
        setProcessingMessage("");
      }
    }, 100);
  };

  const handleApplyCrop = async () => {
      if (!generatedImage || !selectionBox) return;
      setIsLoading(true);
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
      } catch (e) {
          console.error(e);
          setError("Failed to crop");
      } finally {
          setIsLoading(false);
      }
  };

  const handleApplyOutline = async () => {
    if (!generatedImage) return;
    setIsLoading(true);
    setProcessingMessage("Analyzing edge geometry...");

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
      } catch (e) {
        console.error(e);
        setError("Failed to generate outline");
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

  return (
    <>
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center pt-20 pb-24 px-4 md:px-6 lg:px-8 animate-fade-in-up">
      
      {/* Header / Branding */}
      <div className="w-full mb-10 text-center relative z-10 flex flex-col items-center">
        <div className="flex justify-center items-center w-full relative">
            {/* Desktop Gallery Button */}
            <div className="absolute left-0 hidden md:block">
                <button 
                    onClick={() => setShowGallery(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/40 border border-white/5 text-slate-300 hover:bg-slate-700 hover:text-white transition-all group hover:border-cyan-500/30"
                >
                    <svg className="w-5 h-5 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    GALLERY
                </button>
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
      <div className="w-full glass-panel rounded-3xl p-5 md:p-8 mb-8 shadow-2xl shadow-blue-900/10 relative z-50 border border-white/10 hover:border-white/20 transition-colors">
        
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
              <option value={AIModel.FLASH}>UMBRAX_Pro</option>
              <option value={AIModel.PRO}>UMBRAX_Flux</option>
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
                  className={`w-full border rounded-lg px-2 py-2.5 text-sm text-center outline-none transition-all ${options.model === AIModel.FLASH ? 'bg-slate-900/30 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800/50 border-slate-700 text-white hover:border-slate-500 cursor-pointer focus:ring-1 focus:ring-cyan-400'}`}
                  value={options.resolution}
                  disabled={options.model === AIModel.FLASH}
                  onChange={(e) => setOptions({...options, resolution: e.target.value as ImageResolution})}
              >
                  {Object.values(ImageResolution).map(val => <option key={val} value={val}>{val}</option>)}
              </select>
          </div>

          <div className="lg:col-span-1 flex items-end">
            <button 
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className={`w-full h-[42px] rounded-lg font-semibold tracking-wide transition-all duration-300 shadow-lg transform active:scale-95 ${isLoading ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white border border-blue-400/20'}`}
            >
              {isLoading ? 'PROCESSING...' : 'INITIATE'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="w-full mb-8 p-4 bg-red-500/10 border border-red-500/40 text-red-200 rounded-xl flex items-center gap-3 animate-fade-in backdrop-blur-sm">
          <span className="font-bold">Error:</span> {error}
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
          <div className={`relative w-full transition-all duration-700 ease-out ${isLoading ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
             
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
                      <button onClick={handleOutpaint} className="whitespace-nowrap px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-white/10 transition-colors" title="Extend Borders (Outpaint)">
                          Extend
                      </button>
                      <button
                          onClick={() => { setIsTargetMode(!isTargetMode); if (isTargetMode) setSelectionBox(null); }}
                          className={`whitespace-nowrap px-3 py-2 rounded-lg border text-sm transition-all ${isTargetMode ? 'bg-cyan-900/80 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-slate-800 border-white/10 text-slate-400 hover:text-white'}`}
                          title="Select Area for Inpainting"
                      >
                          Select / Inpaint
                      </button>
                      <button onClick={handleEdit} disabled={isLoading || !editPrompt.trim()} className="whitespace-nowrap px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-cyan-900 hover:to-blue-900 text-cyan-400 text-sm font-medium rounded-lg border border-cyan-500/30 hover:border-cyan-400 transition-all">
                         Run Edit
                      </button>
                      <button onClick={initiateDownload} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-white/10 transition-colors" title="Download">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                  </div>
               </div>
             </div>
          </div>
        )}
      </div>
      
      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#020617]/95 backdrop-blur-md animate-fade-in">
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-[#020617]">
             <h2 className="text-2xl font-bold text-white tracking-tight font-sans flex items-center gap-3">
                Session Gallery
             </h2>
             <button onClick={() => setShowGallery(false)} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {gallery.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p>No images generated in this session yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {gallery.map((img) => (
                        <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-white/10 cursor-pointer hover:border-cyan-500/50 transition-all shadow-lg hover:shadow-cyan-500/20" onClick={() => loadFromGallery(img)}>
                            <img src={`data:${img.mimeType};base64,${img.base64}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Gallery item" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-cyan-400 font-mono text-xs border border-cyan-400 px-2 py-1 rounded">LOAD</span>
                            </div>
                            <button onClick={(e) => deleteFromGallery(e, img.id)} className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-all transform scale-90 hover:scale-100">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      )}
      
      {/* Save Preset Modal */}
      {showPresetSave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl border-t border-white/10">
            <h3 className="text-lg font-bold text-white mb-4">Save Configuration</h3>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Enter preset name..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white mb-6 focus:ring-1 focus:ring-cyan-500 outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPresetSave(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={savePreset} disabled={!newPresetName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg">Save Preset</button>
            </div>
          </div>
        </div>
      )}

      {/* Download Confirmation Modal */}
      {showDownloadConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center border-t border-white/10">
            <div className="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Download Image?</h3>
            <p className="text-slate-400 text-sm mb-6">This will save the high-resolution render to your local device.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDownloadConfirm(false)} className="flex-1 px-4 py-3 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={performDownload} className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg hover:shadow-blue-500/20">Confirm</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="scanline-overlay opacity-20 pointer-events-none"></div>
    </div>

      {/* Footer Status Bar - MOVED OUTSIDE OF ANIMATED CONTAINER */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#020617]/90 border-t border-white/10 backdrop-blur-md px-6 py-2 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                      <span className={`animate-ping-slow absolute inline-flex h-full w-full rounded-full ${isLoading ? 'bg-amber-400' : 'bg-green-400'} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isLoading ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                  </span>
                  {isLoading ? 'PROCESSING DATA' : 'SYSTEM READY'}
              </span>
              <span className="hidden md:inline text-slate-700">|</span>
              <span className="hidden md:inline">MODEL: 3.5-UMBRAX_PRO</span>
              <span className="hidden md:inline text-slate-700">|</span>
              <a href="https://app.fearyour.life/" target="_blank" rel="noreferrer" className="hidden md:inline text-amber-400 hover:text-amber-300 hover:shadow-[0_0_10px_rgba(251,191,36,0.4)] transition-all cursor-pointer">
                  F&Q // SYNTHESIS CORE
              </a>
          </div>
          <div className="opacity-70">
              ID: {generatedImage?.id || '11986660500'}
          </div>
      </div>
    </>
  );
};

export default Generator;


export enum AspectRatio {
  SQUARE = "1:1",
  LANDSCAPE = "16:9",
  PORTRAIT = "9:16",
  STANDARD = "4:3",
  TALL = "3:4",
  CUSTOM = "Custom"
}

export enum ImageResolution {
  RES_1K = "1K",
  RES_2K = "2K",
  RES_4K = "4K"
}

export enum Aesthetic {
  GENERAL = "General",
  REALISTIC = "Photorealistic",
  ANIME = "Anime",
  ISOMETRIC = "3D Isometric",
  DIAGRAM = "Technical Diagram",
  PAINTING = "Oil Painting",
  CINEMATIC = "Cinematic Render",
  MINIMALIST = "Minimalist Vector",
  RETRO = "Retro Sci-Fi"
}

export enum AIModel {
  FLASH = "gemini-2.5-flash-image",
  IMAGEN = "imagen-3.0-generate-001"
}

export interface GenerationOptions {
  aspectRatio: AspectRatio | string; // Allow custom strings
  resolution: ImageResolution;
  aesthetic: Aesthetic;
  model: AIModel;
  customRatioValue?: number; // w / h
}

export interface GeneratedImage {
  id: string;
  base64: string;
  mimeType: string;
  prompt: string;
  timestamp: number;
}

export interface Preset {
  id: string;
  name: string;
  options: GenerationOptions;
}

export interface SelectionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageAdjustments {
  brightness: number; // 0-200, default 100
  contrast: number;   // 0-200, default 100
  saturation: number; // 0-200, default 100
  blur: number;       // 0-20, default 0
  sepia: number;      // 0-100, default 0
  grayscale: number;  // 0-100, default 0
}

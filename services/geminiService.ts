
import { GoogleGenAI } from "@google/genai";
import { GenerationOptions, GeneratedImage, AIModel, AspectRatio, Aesthetic } from "../types";

const getClient = (customKey?: string) => {
  const apiKey = customKey;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to map custom/UI ratios to API valid ratios
const getValidApiRatio = (ratio: string): string => {
  const validRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];
  if (validRatios.includes(ratio)) return ratio;
  return "1:1"; // Fallback for custom
};

export const validateCredentials = async (apiKey: string): Promise<boolean> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        // Try a very cheap/fast call to verify the key works
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "test",
        });
        return true;
    } catch (e) {
        console.error("Credential validation failed:", e);
        return false;
    }
};

export const getPromptEnhancements = async (currentPrompt: string, apiKey?: string): Promise<string[]> => {
  try {
    const ai = getClient(apiKey);
    const model = "gemini-2.5-flash"; 

    const prompt = `
      You are a creative assistant for an AI image generator. 
      The user has input: "${currentPrompt}".
      
      Please generate 3 distinct, improved variations of this prompt to create a better visual image.
      1. A more detailed, photorealistic version.
      2. A version focusing on artistic style and lighting.
      3. A version that is abstract or conceptual.
      
      Return ONLY the 3 prompt variations as a JSON string array. No markdown formatting.
      Example: ["Prompt 1...", "Prompt 2...", "Prompt 3..."]
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (e) {
    console.error("Error getting suggestions", e);
    return [];
  }
};

export const generateImage = async (
  prompt: string,
  options: GenerationOptions,
  inputImage?: string, // Base64 string (no prefix)
  apiKey?: string // Optional override
): Promise<GeneratedImage> => {
  const ai = getClient(apiKey);
  
  // Only append specific configuration if not General
  const aestheticConfig = options.aesthetic === Aesthetic.GENERAL 
    ? "" 
    : `- Aesthetic Style: ${options.aesthetic}`;

  const enhancedPrompt = `
    [SYSTEM_DIRECTIVE: GENERATE_VISUAL_ASSET]
    SUBJECT: "${prompt}"
    
    ${aestheticConfig ? `PARAMETERS: ${aestheticConfig}` : ""}
    
    CONSTRAINT: OUTPUT IMAGE ONLY. DO NOT GENERATE CONVERSATIONAL TEXT, COMMENTARY, OR FEEDBACK.
    MODE: HIGH_FIDELITY
  `;

  const apiRatio = getValidApiRatio(options.aspectRatio);

  // --- IMAGEN MODEL PATH ---
  if (options.model === AIModel.IMAGEN) {
      if (inputImage) {
          throw new Error("The selected Imagen model does not support Image-to-Image generation. Please use a Gemini model (UMBRAX-Iris 5.1).");
      }

      const response = await ai.models.generateImages({
          model: options.model,
          prompt: enhancedPrompt,
          config: {
              numberOfImages: 1,
              aspectRatio: apiRatio,
              outputMimeType: 'image/png'
          }
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
          return {
              id: Date.now().toString(),
              base64: response.generatedImages[0].image.imageBytes,
              mimeType: 'image/png',
              prompt: prompt,
              timestamp: Date.now(),
          };
      }
      throw new Error("No image data received from Imagen model.");
  }

  // --- GEMINI MODEL PATH ---
  const imageConfig: any = {
    aspectRatio: apiRatio,
  };

  let contents: any = enhancedPrompt;
  
  // Handle Image-to-Image (Multimodal)
  if (inputImage) {
    contents = {
      parts: [
        { text: enhancedPrompt },
        {
          inlineData: {
            data: inputImage,
            mimeType: 'image/png', // Assuming PNG/JPEG from frontend
          }
        }
      ]
    };
  }

  const response = await ai.models.generateContent({
    model: options.model, 
    contents: contents,
    config: {
      imageConfig: imageConfig,
    },
  });

  // Extract image
  if (response.candidates && response.candidates.length > 0) {
    const content = response.candidates[0].content;
    if (content.parts) {
      // First pass: look for valid image data
      for (const part of content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return {
            id: Date.now().toString(),
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
            prompt: prompt,
            timestamp: Date.now(),
          };
        }
      }
      // Second pass: if no image, check for text to throw as error (e.g. safety refusal)
      for (const part of content.parts) {
        if (part.text) {
          throw new Error(part.text);
        }
      }
    }
  }
  
  throw new Error("No image data received from the model.");
};

export const editImage = async (
  currentImage: GeneratedImage,
  editInstruction: string,
  options: GenerationOptions,
  apiKey?: string
): Promise<GeneratedImage> => {
  const ai = getClient(apiKey);

  if (options.model === AIModel.IMAGEN) {
      throw new Error("Edit/Inpainting functions are currently optimized for UMBRAX (Gemini) models only.");
  }

  // Configure based on selected model
  const apiRatio = getValidApiRatio(options.aspectRatio);
  const imageConfig: any = {
      aspectRatio: apiRatio
  };

  const strictInstruction = `
    [SYSTEM_DIRECTIVE: EDIT_VISUAL]
    TASK: ${editInstruction}
    CONSTRAINT: OUTPUT IMAGE ONLY. NO CONVERSATIONAL TEXT.
  `;

  const response = await ai.models.generateContent({
    model: options.model, 
    contents: {
      parts: [
        {
          text: strictInstruction,
        },
        {
          inlineData: {
            data: currentImage.base64,
            mimeType: currentImage.mimeType,
          },
        },
      ],
    },
    config: {
      imageConfig: imageConfig,
    },
  });

  // Extract image
  if (response.candidates && response.candidates.length > 0) {
    const content = response.candidates[0].content;
    if (content.parts) {
      for (const part of content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return {
            id: Date.now().toString(),
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
            prompt: editInstruction, // Update prompt to the latest edit instruction
            timestamp: Date.now(),
          };
        }
      }
      // If no image, check for text error
      for (const part of content.parts) {
        if (part.text) {
          throw new Error(part.text);
        }
      }
    }
  }

  throw new Error("No edited image data received from the model.");
};

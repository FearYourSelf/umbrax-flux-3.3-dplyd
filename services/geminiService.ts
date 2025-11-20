
import { GoogleGenAI } from "@google/genai";
import { GenerationOptions, GeneratedImage, AIModel, AspectRatio, Aesthetic } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to map custom/UI ratios to API valid ratios
const getValidApiRatio = (ratio: string): string => {
  const validRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];
  if (validRatios.includes(ratio)) return ratio;
  return "1:1"; // Fallback for custom
};

export const getPromptEnhancements = async (currentPrompt: string): Promise<string[]> => {
  const ai = getClient();
  const model = "gemini-2.5-flash"; // Use text model for suggestions

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

  try {
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
  inputImage?: string // Base64 string (no prefix)
): Promise<GeneratedImage> => {
  const ai = getClient();
  
  // Only append specific configuration if not General
  const aestheticConfig = options.aesthetic === Aesthetic.GENERAL 
    ? "" 
    : `- Aesthetic Style: ${options.aesthetic}`;

  const enhancedPrompt = `
    Create a visual representation of: "${prompt}".
    
    ${aestheticConfig ? "Configuration:" : ""}
    ${aestheticConfig}
    
    Ensure the image is high quality, detailed, and accurate to the request.
  `;

  const apiRatio = getValidApiRatio(options.aspectRatio);

  const imageConfig: any = {
    aspectRatio: apiRatio,
  };

  // Only add imageSize if using the Pro model
  if (options.model === AIModel.PRO) {
    imageConfig.imageSize = options.resolution;
  }

  try {
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

  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export const editImage = async (
  currentImage: GeneratedImage,
  editInstruction: string,
  options: GenerationOptions
): Promise<GeneratedImage> => {
  const ai = getClient();

  try {
    // Configure based on selected model
    const apiRatio = getValidApiRatio(options.aspectRatio);
    const imageConfig: any = {
        aspectRatio: apiRatio
    };
    if (options.model === AIModel.PRO) {
        imageConfig.imageSize = options.resolution;
    }

    const response = await ai.models.generateContent({
      model: options.model, 
      contents: {
        parts: [
          {
            text: editInstruction,
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
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};

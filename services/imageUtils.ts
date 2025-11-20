import { SelectionBox, ImageAdjustments } from "../types";

export const extendImage = (
  base64Data: string,
  scale: number = 1.5
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Calculate new dimensions
      const newWidth = Math.floor(img.width * scale);
      const newHeight = Math.floor(img.height * scale);
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Fill with a neutral dark color to represent "void" 
      // Using a specific color helps the model distinguish the original content
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.fillRect(0, 0, newWidth, newHeight);
      
      // Draw original image in the center
      const offsetX = (newWidth - img.width) / 2;
      const offsetY = (newHeight - img.height) / 2;
      
      ctx.drawImage(img, offsetX, offsetY);
      
      const dataUrl = canvas.toDataURL('image/png');
      // Remove the "data:image/png;base64," prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    img.onerror = (err) => reject(err);
    img.src = `data:image/png;base64,${base64Data}`;
  });
};

export const applyImageAdjustments = (
  base64Data: string,
  adjustments: ImageAdjustments
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Build filter string
      const filterString = `
        brightness(${adjustments.brightness}%) 
        contrast(${adjustments.contrast}%) 
        saturate(${adjustments.saturation}%) 
        blur(${adjustments.blur}px) 
        sepia(${adjustments.sepia}%) 
        grayscale(${adjustments.grayscale}%)
      `;

      ctx.filter = filterString;
      ctx.drawImage(img, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = (err) => reject(err);
    img.src = `data:image/png;base64,${base64Data}`;
  });
};

export const applyBlur = (
  base64Data: string,
  intensity: number, // 0 to 20
  selection?: SelectionBox
): Promise<string> => {
  return applyImageAdjustments(base64Data, {
      brightness: 100, contrast: 100, saturation: 100, sepia: 0, grayscale: 0,
      blur: intensity
  });
};

export const cropImage = (
    base64Data: string,
    crop: SelectionBox
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            
            // Convert percentages to pixels
            const x = (crop.x / 100) * img.width;
            const y = (crop.y / 100) * img.height;
            const w = (crop.w / 100) * img.width;
            const h = (crop.h / 100) * img.height;

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("No context"));
                return;
            }

            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = reject;
        img.src = `data:image/png;base64,${base64Data}`;
    });
};

// Applies a convolution matrix for edge detection (Laplacian)
export const applyOutline = (base64Data: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Create output buffer
      const outputData = ctx.createImageData(width, height);
      const output = outputData.data;

      // Simple Edge Detection Kernel (Laplacian)
      //  0  1  0
      //  1 -4  1
      //  0  1  0
      const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let r = 0, g = 0, b = 0;

          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4;
              const kVal = kernel[(ky + 1) * 3 + (kx + 1)];
              
              r += data[idx] * kVal;
              g += data[idx + 1] * kVal;
              b += data[idx + 2] * kVal;
            }
          }

          // Calculate magnitude and invert for dark lines on light or light on dark
          // We'll make edges bright (cyan) and background dark
          const mag = Math.abs(r) + Math.abs(g) + Math.abs(b);
          const val = Math.min(255, mag);

          const i = (y * width + x) * 4;
          
          // Stylistic choice: Cyan edges on dark background
          if (val > 30) {
             output[i] = 34;     // R
             output[i + 1] = 211; // G (Cyan-ish)
             output[i + 2] = 238; // B
             output[i + 3] = 255; // Alpha
          } else {
             // Background
             output[i] = 2;
             output[i + 1] = 6;
             output[i + 2] = 23;
             output[i + 3] = 255;
          }
        }
      }

      ctx.putImageData(outputData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = (err) => reject(err);
    img.src = `data:image/png;base64,${base64Data}`;
  });
};
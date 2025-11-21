
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

export const applyWatermark = (base64Data: string): Promise<string> => {
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

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Create Watermark Image from SVG
      const watermark = new Image();
      watermark.onload = () => {
          // Calculate size relative to image MIN dimension to ensure consistency across ratios
          // 10% of the smallest side
          const targetWidth = Math.max(60, Math.min(img.width, img.height) * 0.10); 
          const aspectRatio = 710.52 / 767.9; // Based on new viewBox
          const targetHeight = targetWidth / aspectRatio;

          const padding = Math.max(15, Math.min(img.width, img.height) * 0.02);

          const x = img.width - targetWidth - padding;
          const y = img.height - targetHeight - padding;

          ctx.globalAlpha = 0.5; // Reverted to 0.5 per user request
          // Add a glow/shadow backing for legibility in case the gray blends in
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 4;
          ctx.drawImage(watermark, x, y, targetWidth, targetHeight);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;

          resolve(canvas.toDataURL('image/png').split(',')[1]);
      };
      
      // SVG Data URI (Provided content)
      const svgString = `
<svg id="Layer_2" data-name="Layer 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 710.52 767.9">
  <defs>
    <style>
      .cls-1 {
        fill: #9e9fa2;
      }

      .cls-2 {
        fill: #9d9ea1;
      }

      .cls-3 {
        fill: #9e9fa1;
      }
    </style>
  </defs>
  <path class="cls-2" d="M509.52,739.9v-11.01c5.5-.19,17.57,1.92,18.99-5.53,2.83-14.89-23.48-8.66-30.98-5.47l3.5-11.99c3.48-3.69,23.18-3.55,28.31-2.32,14.34,3.45,16.59,21.45,5.2,29.81,4.08,4.42,8.29,6.43,8.98,13,2.24,21.27-22.41,23.8-38.03,20.04-10.34-2.48-9.36-4.06-8.96-14.54,5.27.2,8.88,3.41,14.51,3.99,6.81.7,21.12,1.17,19.29-9.23-.45-2.58-3.76-6.76-6.31-6.76h-14.5Z"/>
  <path class="cls-2" d="M434.52,702.9h16l-22.83,32.34c.23,2.69,18.02,23.63,20.87,28.12.79,1.24,1.26,1.95.96,3.54h-14.5c-2.64-2.72-13.37-21.5-15.9-20.96l-14.6,20.96h-16l23.01-32.48-22.01-31.52h14.5l15.02,21c1.42.35,2.15-1.27,2.9-2.08,4.34-4.64,9.12-13.34,12.58-18.92Z"/>
  <path class="cls-1" d="M256.52,702.9v52h31.5c2.93,2.9.98,8.14,1.5,12h-46v-64h13Z"/>
  <path class="cls-2" d="M21.52,561.9v64.5c0,.66,2.85,6.41,3.57,7.43,8.48,12.16,33.77,12.4,41.63-.24.92-1.48,3.81-7.94,3.81-9.19v-62.5h20v66.5c0,1.32-2.14,7.43-2.82,9.18-7.83,20.06-29.89,25-49.55,23.19-52.17-4.78-34.55-58.35-37.68-94.42-.39-1.27,1.74-4.45,2.55-4.45h18.5Z"/>
  <polygon class="cls-3" points="214.52 702.9 214.52 714.9 180.52 714.9 180.52 730.9 211.52 730.9 210.93 742.01 180.52 742.9 180.52 766.9 167.52 766.9 167.52 702.9 214.52 702.9"/>
  <path class="cls-2" d="M710.52,658.9c-7.91,1.02-15.97.07-23.98-.52-2.1-.94-17.89-26.09-21.59-30.41-.8-.94-1.43-2.29-2.91-2.09l-23.01,33.01h-22c-.42,0-2.89,2.69-2.49-.49l34.82-48.17-33.83-48.34h23.5l24,32.98,23.49-32.49c2.08-1.01,17.22-.76,20.56-.5,3.07.24,2.57-.49,2.45,3l-1.77.21-31.91,45.28,34.67,47.51v1Z"/>
  <path class="cls-2" d="M495.52,658.9l41.11-96.88,22.43-.19,42.46,97.07h-22l-9.66-21.84-43.73-.22-8.61,22.06h-22ZM563.52,620.9l-14.01-37c-1.22.1-1.68,1.38-2.18,2.3-3.69,6.78-10.99,24.24-13.35,31.66-.33,1.03-.65,1.93-.46,3.04h30Z"/>
  <path class="cls-2" d="M446.02,561.9c2.1.26,9.23,2.59,11.49,3.51,25.86,10.56,21.44,50.92-5.02,58.04l22.03,35.45h-23.5l-22-34h-22.5v34h-20v-97h59.5ZM442.02,579.9c-10.64-1.5-24.49,1.11-35.5,0v25.5l1.5,1.5h32c.29,0,4.76-1.23,5.5-1.5,12.18-4.39,10.37-23.54-3.5-25.5Z"/>
  <path class="cls-2" d="M328.02,561.9c11.5,1.22,24.07,7.91,25.5,20.5,1.2,10.48-1.55,19.62-11,25,17.99,9.4,20.28,35.68,2.69,46.7-2.38,1.49-10.78,4.81-13.19,4.81h-63.5v-97c18.98,1.47,40.87-1.97,59.5,0ZM288.52,600.9h35.5c.9,0,5.55-2.54,6.55-3.45,6.3-5.79,1.28-18.55-5.55-18.55h-36.5v22ZM288.52,641.9h36.5c9.08,0,15.19-12.07,8.53-19.53-1.27-1.42-7.99-4.47-9.53-4.47h-35.5v24Z"/>
  <path class="cls-2" d="M235.52,561.9v97c-3.96,2.17-7.16.01-10.55-.05s-5.95,1.93-9.45.05v-62l-35.5,50.98-36.5-50.98v62h-19v-97h20.5l35,51.98,35-51.98h20.5Z"/>
  <path class="cls-2" d="M322.52,702.9v42.5c0,2.16,4.65,7.19,6.65,8.35,5.79,3.37,15.84,2.83,20.87-1.83,1.11-1.03,4.48-7.5,4.48-8.52v-40.5h13v40.5c0,2.07-2.29,9.4-3.45,11.55-8.63,16.06-39.64,17.37-49.99,2.88-.83-1.17-4.57-8.65-4.57-9.43v-45.5h13Z"/>
  <path class="cls-2" d="M509.17,390.55c-27.69,28.63-63.5,47.44-101.64,58.35-.39-1.8.57-2.78,1.33-4.16,2.74-4.92,20.81-29.23,24.63-32.37,5.78-4.74,17.32-9.17,24.34-13.66,96.48-61.85,105.22-192.65,13.58-263.21-4.89-3.76-14.31-8.54-17.91-12.09-4.86-4.8-20.53-28.79-24.39-35.61-.72-1.27-1.94-2.21-1.59-3.9,90.55,28.88,148.54,113.06,132.7,209.21-6.07,36.82-25.32,70.83-51.06,97.44Z"/>
  <path class="cls-2" d="M301.51,447.89c-69.77-17.01-133.56-72.79-150.32-144.17-22.96-97.79,37.09-189.84,129.83-219.82,1.33.53.16,1.9-.29,2.7-4.59,8.18-19.18,30.29-25.22,36.78-4.8,5.16-16.17,11.34-22.47,16.53-89.96,74.07-73.35,201.26,22.55,261.4,5.13,3.22,15.68,7.29,19.44,10.56,5.87,5.12,15.32,20.5,20.51,27.49,1.96,2.64,5.98,4.62,5.97,8.52Z"/>
  <path class="cls-2" d="M208.52,242.9l146.5,200.04c2.03,0,4.97-4.92,6.31-6.72,21.57-28.84,41.36-59.34,62.37-88.63,23.66-32.99,48.84-71.78,74.39-102.6.98-1.18,3.42-3.22,3.42-.58v51c0,5.15-29.26,41.49-34.41,48.59-31.69,43.61-62.82,87.7-95.19,130.81-4.08,5.43-10.17,15.13-14.53,19.46-.68.67-.92,1.85-2.34,1.7-1.41,0-2.17-1.19-3.05-2.03-4.29-4.08-11.8-15.66-15.88-21.12-43.27-57.86-83.46-118.15-127.59-175.41v-54.5Z"/>
  <polygon class="cls-2" points="421.52 199.9 357.93 291.81 353.09 294.97 287.52 199.9 421.52 199.9"/>
  <path class="cls-2" d="M354.17,0l132.17,188.56-130.44,188.26-3.84-1.98c-42.84-62.1-87.87-122.58-129.35-185.6L354.17,0ZM354.17,59l-93.49,129.56,91.32,131.34,3,1.06,92.44-132.58-90.43-128.49-2.84-.9Z"/>
</svg>
      `;
      
      watermark.src = 'data:image/svg+xml;base64,' + btoa(svgString);
    };
    img.onerror = (err) => reject(err);
    img.src = `data:image/png;base64,${base64Data}`;
  });
};

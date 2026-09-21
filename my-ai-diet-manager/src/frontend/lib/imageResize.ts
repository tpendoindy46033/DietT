const MAX_EDGE = 1024;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ResizedImage {
  dataUrl: string;
  mimeType: string;
}

export function isSupportedImageType(file: File): boolean {
  return ALLOWED_TYPES.has(file.type);
}

/** Resizes and compresses an image client-side: longest edge 1024px, JPEG, stepping quality down until under the size limit. */
export async function resizeAndCompressImage(file: File): Promise<ResizedImage> {
  if (!isSupportedImageType(file)) {
    throw new Error("Only JPEG, PNG and WebP images are supported.");
  }

  const bitmap = await loadBitmap(file);
  const { width, height } = fitWithinEdge(bitmap.width, bitmap.height, MAX_EDGE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image on this device.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (estimateBytes(dataUrl) > MAX_BYTES && quality > 0.35) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (estimateBytes(dataUrl) > MAX_BYTES) {
    throw new Error("That image is too large even after compression. Please try a different photo.");
  }

  return { dataUrl, mimeType: "image/jpeg" };
}

function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.floor((base64.length * 3) / 4);
}

function fitWithinEdge(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> based loading
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file."));
    img.src = URL.createObjectURL(file);
  });
}

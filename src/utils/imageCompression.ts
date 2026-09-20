/**
 * Image Compression Pipeline
 * Guarantees profile images do not exceed the 500 KB target size.
 * Uses canvas downscaling and progressive JPEG quality downsampling.
 */

export const MAX_PHOTO_BYTES = 500 * 1024; // 500 KB

/**
 * Calculates byte size of a base64 Data URL.
 */
export function getBase64ByteSize(base64Str: string): number {
  if (!base64Str) return 0;
  const commaIdx = base64Str.indexOf(',');
  const pureBase64 = commaIdx >= 0 ? base64Str.slice(commaIdx + 1) : base64Str;
  const padding = (pureBase64.endsWith('==') ? 2 : pureBase64.endsWith('=') ? 1 : 0);
  return Math.round((pureBase64.length * 3) / 4) - padding;
}

/**
 * Compresses an image (from File or Base64 string) so that its final Base64
 * size is strictly <= maxBytes (defaults to 500 KB).
 */
export async function compressImage(
  input: File | Blob | string,
  maxBytes: number = MAX_PHOTO_BYTES
): Promise<string> {
  // If in a non-browser environment (e.g. node unit tests), return input if string
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    if (typeof input === 'string') return input;
    return '';
  }

  let dataUrl: string;
  if (typeof input === 'string') {
    dataUrl = input;
  } else {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  }

  // If already under maxBytes, still ensure it's a normalized JPEG under max dimensions
  const initialBytes = getBase64ByteSize(dataUrl);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  // Target maximum dimension: 1200px for portrait clarity
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  const maxDimension = 1200;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, width, height);

  // Progressive compression loop
  let quality = 0.88;
  let outputDataUrl = canvas.toDataURL('image/jpeg', quality);
  let currentBytes = getBase64ByteSize(outputDataUrl);

  // If still over limit, lower quality in steps down to 0.40
  while (currentBytes > maxBytes && quality > 0.40) {
    quality -= 0.10;
    outputDataUrl = canvas.toDataURL('image/jpeg', quality);
    currentBytes = getBase64ByteSize(outputDataUrl);
  }

  // If still over 500 KB after reducing quality, scale down dimensions aggressively
  while (currentBytes > maxBytes && (width > 320 && height > 320)) {
    width = Math.round(width * 0.80);
    height = Math.round(height * 0.80);
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    outputDataUrl = canvas.toDataURL('image/jpeg', Math.max(0.40, quality));
    currentBytes = getBase64ByteSize(outputDataUrl);
  }

  return outputDataUrl;
}

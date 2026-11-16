import { sha256Hex, type Photo } from 'core';

/** Quality steps for the JPEG encoder, tried in this order. */
export const QUALITY_STEPS = [0.82, 0.7, 0.6] as const;
export const MAX_SIDE = 1600;
export const MAX_BASE64 = 1_500_000;

export interface PhotoCodec {
  /** The size of the picture, or null when it cannot be read. */
  measure(file: Blob): Promise<{ width: number; height: number } | null>;
  /** JPEG at the given size and quality, as base64 text without a prefix. */
  render(file: Blob, width: number, height: number, quality: number): Promise<string>;
}

export type ResizeResult =
  | { ok: true; dataBase64: string; width: number; height: number }
  | { ok: false; error: 'unreadable' | 'too_big' };

/** Scales so the longer side is at most maxSide. Never enlarges. */
export function fitSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The browser codec: a bitmap drawn on a canvas. It needs a real browser. */
export const browserCodec: PhotoCodec = {
  async measure(file) {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size.width > 0 && size.height > 0 ? size : null;
    } catch {
      return null;
    }
  },
  async render(file, width, height, quality) {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('no canvas');
      context.drawImage(bitmap, 0, 0, width, height);
      const url = canvas.toDataURL('image/jpeg', quality);
      const prefix = 'data:image/jpeg;base64,';
      if (!url.startsWith(prefix)) throw new Error('no jpeg');
      return url.slice(prefix.length);
    } finally {
      bitmap.close();
    }
  },
};

export async function resizePhoto(
  file: Blob,
  maxSide: number = MAX_SIDE,
  maxBase64Length: number = MAX_BASE64,
  codec: PhotoCodec = browserCodec,
): Promise<ResizeResult> {
  const size = await codec.measure(file);
  if (size === null) return { ok: false, error: 'unreadable' };
  const { width, height } = fitSize(size.width, size.height, maxSide);
  for (const quality of QUALITY_STEPS) {
    let dataBase64: string;
    try {
      dataBase64 = await codec.render(file, width, height, quality);
    } catch {
      return { ok: false, error: 'unreadable' };
    }
    if (dataBase64.length <= maxBase64Length) return { ok: true, dataBase64, width, height };
  }
  return { ok: false, error: 'too_big' };
}

/** The digest of a photo is the SHA-256 of the bytes behind its base64 text. */
export function photoFromResult(result: { dataBase64: string; width: number; height: number }): Photo {
  const binary = atob(result.dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {
    digest: sha256Hex(bytes),
    mime: 'image/jpeg',
    width: result.width,
    height: result.height,
    dataBase64: result.dataBase64,
  };
}

/** Size shown on the photo line: base64 length * 3 / 4 bytes, rounded, in KB (1024 bytes), at least 1. */
export function photoSizeKb(dataBase64: string): number {
  return Math.max(1, Math.round((dataBase64.length * 3) / 4 / 1024));
}
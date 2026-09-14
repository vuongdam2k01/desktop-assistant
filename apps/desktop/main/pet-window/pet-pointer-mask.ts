import type { PixelAlphaProvider } from '../window-integration/types.js';

const BYTES_PER_PIXEL = 4;
const ALPHA_BYTE_OFFSET = 3;

/**
 * Display scale factors the operating systems in scope actually offer. A capture is
 * taken at the window's logical size multiplied by one of these, so trying them in turn
 * identifies the buffer exactly instead of inferring a factor from its length.
 */
const CANDIDATE_SCALE_FACTORS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;

export interface BitmapDimensions {
  width: number;
  height: number;
}

/**
 * Works out the pixel dimensions of a capture buffer from the window's logical size.
 * Returns null when no supported scale factor accounts for the buffer, so the caller can
 * decline to build a mask rather than hand the native layer a misaligned one.
 */
export function resolveBitmapDimensions(
  byteLength: number,
  logicalWidth: number,
  logicalHeight: number
): BitmapDimensions | null {
  if (logicalWidth <= 0 || logicalHeight <= 0) {
    return null;
  }

  const pixels = byteLength / BYTES_PER_PIXEL;
  if (!Number.isInteger(pixels) || pixels <= 0) {
    return null;
  }

  for (const scale of CANDIDATE_SCALE_FACTORS) {
    const width = Math.round(logicalWidth * scale);
    const height = Math.round(logicalHeight * scale);
    if (width * height === pixels) {
      return { width, height };
    }
  }

  return null;
}

/**
 * Exposes the alpha channel of a captured frame as the mask source the native window
 * integration samples. Electron hands back BGRA on every platform, so the alpha byte sits
 * at a fixed offset and no per-platform channel order is involved.
 *
 * The native layer rescales pointer coordinates into whatever resolution the mask carries,
 * so the capture is used at its own size and is never resampled here.
 */
export function createPointerAlphaProvider(
  bitmap: Buffer,
  width: number,
  height: number
): PixelAlphaProvider {
  return {
    width,
    height,
    getAlphaAt(x: number, y: number): number {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return 0;
      }
      const index = (y * width + x) * BYTES_PER_PIXEL + ALPHA_BYTE_OFFSET;
      return bitmap[index] ?? 0;
    },
  };
}

/**
 * Whether a mask describes any part of the character at all. The native layer treats a
 * low alpha as "pass this click through", so a mask with nothing opaque in it would make
 * the whole pet unclickable — which is worse than keeping a slightly stale outline.
 */
export function hasOpaquePixels(provider: PixelAlphaProvider, threshold = 10): boolean {
  for (let y = 0; y < provider.height; y++) {
    for (let x = 0; x < provider.width; x++) {
      if (provider.getAlphaAt(x, y) >= threshold) {
        return true;
      }
    }
  }
  return false;
}

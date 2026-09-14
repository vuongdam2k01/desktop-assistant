import { describe, it, expect } from 'vitest';
import {
  createPointerAlphaProvider,
  resolveBitmapDimensions,
} from '../main/pet-window/pet-pointer-mask.js';

/** Builds a BGRA capture buffer whose alpha channel is supplied per pixel. */
function bgraBuffer(width: number, height: number, alphaAt: (x: number, y: number) => number): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      buf[idx] = 10;
      buf[idx + 1] = 20;
      buf[idx + 2] = 30;
      buf[idx + 3] = alphaAt(x, y);
    }
  }
  return buf;
}

describe('Capture buffer dimensions', () => {
  it('resolves an unscaled capture', () => {
    expect(resolveBitmapDimensions(4 * 200 * 200, 200, 200)).toEqual({ width: 200, height: 200 });
  });

  it('resolves captures taken on a scaled display', () => {
    expect(resolveBitmapDimensions(4 * 400 * 400, 200, 200)).toEqual({ width: 400, height: 400 });
    expect(resolveBitmapDimensions(4 * 300 * 300, 200, 200)).toEqual({ width: 300, height: 300 });
    expect(resolveBitmapDimensions(4 * 250 * 250, 200, 200)).toEqual({ width: 250, height: 250 });
  });

  it('refuses a buffer it cannot account for rather than guessing', () => {
    expect(resolveBitmapDimensions(4 * 123 * 457, 200, 200)).toBeNull();
    expect(resolveBitmapDimensions(7, 200, 200)).toBeNull();
    expect(resolveBitmapDimensions(0, 200, 200)).toBeNull();
    expect(resolveBitmapDimensions(4 * 200 * 200, 0, 200)).toBeNull();
  });
});

describe('Pointer alpha provider', () => {
  it('reads the alpha channel of a BGRA capture', () => {
    const bitmap = bgraBuffer(4, 4, (x, y) => (x === 1 && y === 2 ? 255 : 0));
    const provider = createPointerAlphaProvider(bitmap, 4, 4);

    expect(provider.width).toBe(4);
    expect(provider.height).toBe(4);
    expect(provider.getAlphaAt(1, 2)).toBe(255);
    expect(provider.getAlphaAt(0, 0)).toBe(0);
    expect(provider.getAlphaAt(3, 3)).toBe(0);
  });

  it('does not mistake a colour channel for alpha', () => {
    // Opaque-looking colour, fully transparent pixel: only the alpha byte may count.
    const bitmap = bgraBuffer(2, 2, () => 0);
    const provider = createPointerAlphaProvider(bitmap, 2, 2);

    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        expect(provider.getAlphaAt(x, y)).toBe(0);
      }
    }
  });

  it('reports fully transparent for coordinates outside the capture', () => {
    const bitmap = bgraBuffer(2, 2, () => 200);
    const provider = createPointerAlphaProvider(bitmap, 2, 2);

    expect(provider.getAlphaAt(-1, 0)).toBe(0);
    expect(provider.getAlphaAt(0, -1)).toBe(0);
    expect(provider.getAlphaAt(2, 0)).toBe(0);
    expect(provider.getAlphaAt(0, 2)).toBe(0);
  });

  it('produces a provider the mask sampler accepts end to end', async () => {
    const { samplePixelAlpha } = await import('../main/window-integration/pixel-mask.js');
    const bitmap = bgraBuffer(8, 8, (x, y) => (x >= 2 && x < 6 && y >= 2 && y < 6 ? 255 : 0));
    const provider = createPointerAlphaProvider(bitmap, 8, 8);

    const mask = samplePixelAlpha(provider);

    expect(mask.length).toBe(64);
    expect(mask[2 * 8 + 2]).toBe(255);
    expect(mask[0]).toBe(0);
  });
});

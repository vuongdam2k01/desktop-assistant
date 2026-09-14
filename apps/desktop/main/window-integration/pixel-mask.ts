import type { WindowPlacementOptions } from '@desktop-assistant/contracts/native-window-manager';
import type { PixelAlphaProvider } from './types.js';

export function validatePlacement(placement: WindowPlacementOptions): void {
  if (
    !placement ||
    typeof placement !== 'object' ||
    !Number.isInteger(placement.x) ||
    !Number.isInteger(placement.y) ||
    !Number.isInteger(placement.width) ||
    placement.width <= 0 ||
    !Number.isInteger(placement.height) ||
    placement.height <= 0 ||
    typeof placement.visible !== 'boolean'
  ) {
    throw new Error('INVALID_PLACEMENT');
  }
}

export function samplePixelAlpha(
  provider: PixelAlphaProvider,
  existingBuffer?: Buffer
): Buffer {
  if (
    !provider ||
    typeof provider !== 'object' ||
    !Number.isInteger(provider.width) ||
    provider.width <= 0 ||
    !Number.isInteger(provider.height) ||
    provider.height <= 0 ||
    typeof provider.getAlphaAt !== 'function'
  ) {
    throw new Error('INVALID_ALPHA_MASK');
  }

  const { width, height } = provider;
  const size = width * height;

  // Allocate fresh buffer first to guarantee atomic swap
  const temp = Buffer.alloc(size);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = provider.getAlphaAt(x, y);
      if (!Number.isInteger(alpha) || alpha < 0 || alpha > 255) {
        throw new Error('INVALID_ALPHA_MASK');
      }
      temp[offset++] = alpha;
    }
  }

  if (existingBuffer && existingBuffer.length === size) {
    temp.copy(existingBuffer);
    return existingBuffer;
  }

  return temp;
}

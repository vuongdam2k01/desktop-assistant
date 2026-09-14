import { PNG } from 'pngjs';

export interface AlphaScanResult {
  width: number;
  height: number;
  totalPixels: number;
  transparentPixels: number;
  opaquePixels: number;
  edgePixels: number;
  edgeViolations: number; // Edge pixels with alpha > 40 and luminance < 15
  minEdgeLuminance: number;
  passed: boolean;
  summary: string;
}

export function scanAlphaBoundary(pngBuffer: Buffer): AlphaScanResult {
  const png = PNG.sync.read(pngBuffer);
  const totalPixels = png.width * png.height;

  let transparentPixels = 0;
  let opaquePixels = 0;
  let edgePixels = 0;
  let edgeViolations = 0;
  let minEdgeLuminance = 255;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const r = png.data[idx] ?? 0;
      const g = png.data[idx + 1] ?? 0;
      const b = png.data[idx + 2] ?? 0;
      const a = png.data[idx + 3] ?? 0;

      if (a === 0) {
        transparentPixels++;
      } else if (a === 255) {
        opaquePixels++;
      } else {
        edgePixels++;
        if (a > 40) {
          // Standard ITU-R BT.601 luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luminance < minEdgeLuminance) {
            minEdgeLuminance = luminance;
          }
          if (luminance < 15) {
            edgeViolations++;
          }
        }
      }
    }
  }

  // Must have significant transparent background around 200x200 pet disk
  const hasTransparentExterior = transparentPixels > totalPixels * 0.2;
  const passed = hasTransparentExterior && edgeViolations === 0;

  const summary = `AlphaScan: total=${totalPixels}, transparent=${transparentPixels} (${Math.round(
    (transparentPixels / totalPixels) * 100
  )}%), opaque=${opaquePixels}, edge=${edgePixels}, minEdgeLum=${minEdgeLuminance.toFixed(
    1
  )}, violations=${edgeViolations}, passed=${passed}`;

  return {
    width: png.width,
    height: png.height,
    totalPixels,
    transparentPixels,
    opaquePixels,
    edgePixels,
    edgeViolations,
    minEdgeLuminance: edgePixels > 0 ? minEdgeLuminance : 0,
    passed,
    summary,
  };
}

import fs from 'node:fs';
import path from 'node:path';

export interface DisplayRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplaySnapshot {
  id: number;
  bounds: DisplayRectangle;
  workArea: DisplayRectangle;
  scaleFactor: number;
}

export interface DisplayProvider {
  getAllDisplays: () => DisplaySnapshot[];
  getPrimaryDisplay: () => DisplaySnapshot;
  getDisplayMatching: (rect: DisplayRectangle) => DisplaySnapshot;
}

export interface PetWindowStateRecord {
  version: 1;
  bounds: DisplayRectangle;
  displayId: number;
  workArea: DisplayRectangle;
  scaleFactor: number;
  normalizedFraction: { x: number; y: number };
}

export const PET_WINDOW_WIDTH = 200;
export const PET_WINDOW_HEIGHT = 200;
export const FALLBACK_MARGIN_DIP = 20;

export function computePrimaryBottomRight(
  primaryWorkArea: DisplayRectangle,
  width: number = PET_WINDOW_WIDTH,
  height: number = PET_WINDOW_HEIGHT,
  margin: number = FALLBACK_MARGIN_DIP
): DisplayRectangle {
  const x = primaryWorkArea.x + Math.max(0, primaryWorkArea.width - width - margin);
  const y = primaryWorkArea.y + Math.max(0, primaryWorkArea.height - height - margin);
  return { x, y, width, height };
}

export function clampToBounds(
  target: DisplayRectangle,
  workArea: DisplayRectangle
): DisplayRectangle {
  const clampedX = Math.max(
    workArea.x,
    Math.min(target.x, workArea.x + Math.max(0, workArea.width - target.width))
  );
  const clampedY = Math.max(
    workArea.y,
    Math.min(target.y, workArea.y + Math.max(0, workArea.height - target.height))
  );
  return {
    x: clampedX,
    y: clampedY,
    width: target.width,
    height: target.height,
  };
}

export function computeNormalizedFraction(
  bounds: DisplayRectangle,
  workArea: DisplayRectangle
): { x: number; y: number } {
  const spanX = Math.max(1, workArea.width - bounds.width);
  const spanY = Math.max(1, workArea.height - bounds.height);
  const fx = Math.max(0, Math.min(1, (bounds.x - workArea.x) / spanX));
  const fy = Math.max(0, Math.min(1, (bounds.y - workArea.y) / spanY));
  return { x: fx, y: fy };
}

export function applyNormalizedFraction(
  fraction: { x: number; y: number },
  workArea: DisplayRectangle,
  width: number = PET_WINDOW_WIDTH,
  height: number = PET_WINDOW_HEIGHT
): DisplayRectangle {
  const spanX = Math.max(0, workArea.width - width);
  const spanY = Math.max(0, workArea.height - height);
  const x = workArea.x + Math.round(fraction.x * spanX);
  const y = workArea.y + Math.round(fraction.y * spanY);
  return clampToBounds({ x, y, width, height }, workArea);
}

export function reconcilePetBounds(
  savedRecord: PetWindowStateRecord | null,
  displayProvider: DisplayProvider,
  windowWidth: number = PET_WINDOW_WIDTH,
  windowHeight: number = PET_WINDOW_HEIGHT
): { bounds: DisplayRectangle; displayId: number } {
  const primary = displayProvider.getPrimaryDisplay();

  if (!savedRecord || savedRecord.version !== 1) {
    const fallbackBounds = computePrimaryBottomRight(primary.workArea, windowWidth, windowHeight);
    return { bounds: fallbackBounds, displayId: primary.id };
  }

  const allDisplays = displayProvider.getAllDisplays();
  const survivingDisplay = allDisplays.find(d => d.id === savedRecord.displayId);

  // If display detached, move directly to primary bottom-right
  if (!survivingDisplay) {
    const fallbackBounds = computePrimaryBottomRight(primary.workArea, windowWidth, windowHeight);
    return { bounds: fallbackBounds, displayId: primary.id };
  }

  // Surviving display: recompute from normalized fraction and clamp
  const bounds = applyNormalizedFraction(
    savedRecord.normalizedFraction,
    survivingDisplay.workArea,
    windowWidth,
    windowHeight
  );
  return { bounds, displayId: survivingDisplay.id };
}

export class PetBoundsStore {
  private saveTimeout: NodeJS.Timeout | null = null;
  private latestRecord: PetWindowStateRecord | null = null;

  constructor(private readonly filePath: string) {}

  load(): PetWindowStateRecord | null {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PetWindowStateRecord;
      if (
        parsed &&
        parsed.version === 1 &&
        parsed.bounds &&
        Number.isFinite(parsed.bounds.x) &&
        Number.isFinite(parsed.bounds.y) &&
        Number.isFinite(parsed.bounds.width) &&
        Number.isFinite(parsed.bounds.height) &&
        parsed.normalizedFraction &&
        Number.isFinite(parsed.normalizedFraction.x) &&
        Number.isFinite(parsed.normalizedFraction.y) &&
        Number.isFinite(parsed.displayId)
      ) {
        return parsed;
      }
      return null;
    } catch (err) {
      console.warn('[PetBoundsStore] Failed to load pet window state record:', err);
      return null;
    }
  }

  saveDebounced(record: PetWindowStateRecord, delayMs: number = 250): void {
    this.latestRecord = record;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate();
    }, delayMs);
  }

  saveImmediate(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (!this.latestRecord) return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.latestRecord, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.warn('[PetBoundsStore] Failed to persist pet window state record:', err);
    }
  }
}

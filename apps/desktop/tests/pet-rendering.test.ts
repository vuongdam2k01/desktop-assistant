import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  deriveWorkStatus,
  sanitizeSetStatePayload,
  SHIPPED_PET_DESCRIPTOR,
  type PetJobStateSnapshot,
} from '../main/pet-window/pet-protocol.js';
import {
  computePrimaryBottomRight,
  clampToBounds,
  computeNormalizedFraction,
  applyNormalizedFraction,
  reconcilePetBounds,
  PetBoundsStore,
  type DisplayProvider,
  type DisplaySnapshot,
  type PetWindowStateRecord,
} from '../main/pet-window/pet-bounds-topology.js';
import { PetIdleController } from '../renderer-pet/src/idle-controller.js';
import { PetWindowControllerImpl } from '../main/pet-window/pet-controller.js';
import { stubWindowIntegration } from './helpers/stub-window-integration.js';
import type { BrowserWindow } from 'electron';
import { RESOURCES } from '../i18n/resources.js';

describe('Pet protocol & job state derivation (deriveWorkStatus)', () => {
  it('prioritizes waiting-approval over all other statuses', () => {
    const snapshot: PetJobStateSnapshot = {
      waitingApprovalCount: 1,
      receivingOrder: true,
      activeJobCount: 5,
      unacknowledgedResultCount: 2,
    };
    expect(deriveWorkStatus(snapshot)).toBe(3);
  });

  it('prioritizes receiving-order when no approval is pending', () => {
    const snapshot: PetJobStateSnapshot = {
      waitingApprovalCount: 0,
      receivingOrder: true,
      activeJobCount: 3,
      unacknowledgedResultCount: 1,
    };
    expect(deriveWorkStatus(snapshot)).toBe(1);
  });

  it('reports working (2) when active jobs exist with no approval and no order reception', () => {
    const snapshot: PetJobStateSnapshot = {
      waitingApprovalCount: 0,
      receivingOrder: false,
      activeJobCount: 2,
      unacknowledgedResultCount: 1,
    };
    expect(deriveWorkStatus(snapshot)).toBe(2);
  });

  it('reports holding-result (4) when only unacknowledged results remain', () => {
    const snapshot: PetJobStateSnapshot = {
      waitingApprovalCount: 0,
      receivingOrder: false,
      activeJobCount: 0,
      unacknowledgedResultCount: 2,
    };
    expect(deriveWorkStatus(snapshot)).toBe(4);
  });

  it('reports idle (0) when all counts are zero and receivingOrder is false', () => {
    const snapshot: PetJobStateSnapshot = {
      waitingApprovalCount: 0,
      receivingOrder: false,
      activeJobCount: 0,
      unacknowledgedResultCount: 0,
    };
    expect(deriveWorkStatus(snapshot)).toBe(0);
  });
});

describe('Partial SetPetStatePayload validation (sanitizeSetStatePayload)', () => {
  it('accepts valid workStatus and locomotion in one payload', () => {
    const result = sanitizeSetStatePayload({ workStatus: 2, locomotion: 1 });
    expect(result).toEqual({ workStatus: 2, locomotion: 1 });
  });

  it('accepts valid single-layer payload for workStatus', () => {
    const result = sanitizeSetStatePayload({ workStatus: 0 });
    expect(result).toEqual({ workStatus: 0 });
  });

  it('accepts valid single-layer payload for locomotion', () => {
    const result = sanitizeSetStatePayload({ locomotion: 3 });
    expect(result).toEqual({ locomotion: 3 });
  });

  it('drops out-of-range workStatus without discarding valid locomotion', () => {
    const result = sanitizeSetStatePayload({ workStatus: 99, locomotion: 2 });
    expect(result).toEqual({ locomotion: 2 });
  });

  it('drops out-of-range locomotion without discarding valid workStatus', () => {
    const result = sanitizeSetStatePayload({ workStatus: 1, locomotion: -1 });
    expect(result).toEqual({ workStatus: 1 });
  });

  it('drops non-integer, NaN, or non-numeric layer values', () => {
    expect(sanitizeSetStatePayload({ workStatus: 2.5, locomotion: 1 })).toEqual({ locomotion: 1 });
    expect(sanitizeSetStatePayload({ workStatus: '2', locomotion: '1' })).toBeNull();
  });

  it('returns null for empty object or payloads with no valid layers', () => {
    expect(sanitizeSetStatePayload({})).toBeNull();
    expect(sanitizeSetStatePayload({ unknownField: true })).toBeNull();
    expect(sanitizeSetStatePayload(null)).toBeNull();
    expect(sanitizeSetStatePayload(undefined)).toBeNull();
    expect(sanitizeSetStatePayload([1, 2])).toBeNull();
  });
});

describe('Pet bounds topology & multi-display reconciliation', () => {
  const primaryDisplay: DisplaySnapshot = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
  };

  const secondaryDisplay: DisplaySnapshot = {
    id: 2,
    bounds: { x: 1920, y: 0, width: 1440, height: 900 },
    workArea: { x: 1920, y: 0, width: 1440, height: 860 },
    scaleFactor: 2,
  };

  const mockProvider: DisplayProvider = {
    getAllDisplays: () => [primaryDisplay, secondaryDisplay],
    getPrimaryDisplay: () => primaryDisplay,
    getDisplayMatching: (rect) => {
      if (rect.x >= 1920) return secondaryDisplay;
      return primaryDisplay;
    },
  };

  it('computes primary bottom-right placement with 20 DIP margin', () => {
    const bounds = computePrimaryBottomRight(primaryDisplay.workArea, 200, 200, 20);
    expect(bounds).toEqual({
      x: 1920 - 200 - 20, // 1700
      y: 1040 - 200 - 20, // 820
      width: 200,
      height: 200,
    });
  });

  it('clamps target rect within given workArea', () => {
    const clamped = clampToBounds({ x: 2000, y: 950, width: 200, height: 200 }, primaryDisplay.workArea);
    expect(clamped).toEqual({
      x: 1920 - 200, // 1720
      y: 1040 - 200, // 840
      width: 200,
      height: 200,
    });
  });

  it('preserves relative position via normalized fractions across scale and workArea changes', () => {
    const originalBounds = { x: 100, y: 100, width: 200, height: 200 };
    const fraction = computeNormalizedFraction(originalBounds, primaryDisplay.workArea);
    const recomputed = applyNormalizedFraction(fraction, primaryDisplay.workArea, 200, 200);
    expect(recomputed.x).toBe(100);
    expect(recomputed.y).toBe(100);
  });

  it('reconciles surviving display with normalized position', () => {
    const record: PetWindowStateRecord = {
      version: 1,
      bounds: { x: 2000, y: 100, width: 200, height: 200 },
      displayId: 2,
      workArea: secondaryDisplay.workArea,
      scaleFactor: 2,
      normalizedFraction: { x: 0.5, y: 0.5 },
    };

    const reconciled = reconcilePetBounds(record, mockProvider, 200, 200);
    expect(reconciled.displayId).toBe(2);
    // x = 1920 + Math.round(0.5 * (1440 - 200)) = 1920 + 620 = 2540
    // y = 0 + Math.round(0.5 * (860 - 200)) = 330
    expect(reconciled.bounds).toEqual({ x: 2540, y: 330, width: 200, height: 200 });
  });

  it('falls back to primary bottom-right when saved display was detached', () => {
    const record: PetWindowStateRecord = {
      version: 1,
      bounds: { x: 3000, y: 500, width: 200, height: 200 },
      displayId: 999, // Detached display ID
      workArea: { x: 3000, y: 0, width: 1000, height: 1000 },
      scaleFactor: 1,
      normalizedFraction: { x: 0.5, y: 0.5 },
    };

    const singleDisplayProvider: DisplayProvider = {
      getAllDisplays: () => [primaryDisplay],
      getPrimaryDisplay: () => primaryDisplay,
      getDisplayMatching: () => primaryDisplay,
    };

    const reconciled = reconcilePetBounds(record, singleDisplayProvider, 200, 200);
    expect(reconciled.displayId).toBe(1);
    expect(reconciled.bounds).toEqual(computePrimaryBottomRight(primaryDisplay.workArea, 200, 200));
  });

  it('persists and loads bounds record atomically via PetBoundsStore', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-bounds-test-'));
    const storePath = path.join(tmpDir, 'pet-window-state.json');
    const store = new PetBoundsStore(storePath);

    expect(store.load()).toBeNull();

    const record: PetWindowStateRecord = {
      version: 1,
      bounds: { x: 500, y: 400, width: 200, height: 200 },
      displayId: 1,
      workArea: primaryDisplay.workArea,
      scaleFactor: 1,
      normalizedFraction: { x: 0.2, y: 0.3 },
    };

    store.saveDebounced(record, 10);
    store.saveImmediate();

    const loaded = store.load();
    expect(loaded).toEqual(record);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('PetIdleController idle throttling and pause/resume', () => {
  let controller: PetIdleController;
  interface MockRiveInstance {
    play: () => void;
    pause: () => void;
  }
  let mockRive: MockRiveInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new PetIdleController(1000); // 1-second timeout for testing
    mockRive = {
      play: vi.fn(),
      pause: vi.fn(),
    };
    controller.setActiveRive(mockRive as unknown as Parameters<PetIdleController['setActiveRive']>[0]);
  });

  afterEach(() => {
    controller.dispose();
    vi.useRealTimers();
  });

  it('pauses Rive instance when idle timeout expires', () => {
    expect(controller.isPaused()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(controller.isPaused()).toBe(true);
    expect(mockRive.pause).toHaveBeenCalledTimes(1);
  });

  it('resets timer on activity before timeout', () => {
    vi.advanceTimersByTime(600);
    controller.markActivity();
    vi.advanceTimersByTime(600);
    expect(controller.isPaused()).toBe(false);
    expect(mockRive.pause).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(controller.isPaused()).toBe(true);
    expect(mockRive.pause).toHaveBeenCalledTimes(1);
  });

  it('resumes with play() without calling stop() when activity occurs after pause', () => {
    vi.advanceTimersByTime(1000);
    expect(controller.isPaused()).toBe(true);

    controller.markActivity();
    expect(controller.isPaused()).toBe(false);
    expect(mockRive.play).toHaveBeenCalledTimes(1);
  });

  it('pauses immediately on visibilityChanged(false) and resumes on visibilityChanged(true)', () => {
    controller.handleVisibilityChanged(false);
    expect(controller.isPaused()).toBe(true);
    expect(mockRive.pause).toHaveBeenCalledTimes(1);

    controller.handleVisibilityChanged(true);
    expect(controller.isPaused()).toBe(false);
    expect(mockRive.play).toHaveBeenCalledTimes(1);
  });
});

describe('PetWindowControllerImpl layer independence and lifecycle', () => {
  interface MockBrowserWindow {
    isDestroyed: () => boolean;
    isVisible: () => boolean;
    showInactive: () => void;
    hide: () => void;
    getBounds: () => { x: number; y: number; width: number; height: number };
    setBounds: (bounds: unknown) => void;
    setAlwaysOnTop: (flag: boolean, level: string) => void;
    setVisibleOnAllWorkspaces: (flag: boolean, opts: unknown) => void;
    capturePage: () => Promise<{ getSize: () => { width: number; height: number }; toBitmap: () => Buffer }>;
    on: (event: string, handler: unknown) => void;
    webContents: {
      send: (channel: string, ...args: unknown[]) => void;
      postMessage: (channel: string, ...args: unknown[]) => void;
      executeJavaScript: (code: string) => Promise<unknown>;
    };
  }
  let mockWin: MockBrowserWindow;
  let controller: PetWindowControllerImpl;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-ctrl-test-'));
    mockWin = {
      isDestroyed: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      showInactive: vi.fn(),
      hide: vi.fn(),
      getBounds: vi.fn(() => ({ x: 100, y: 100, width: 200, height: 200 })),
      setBounds: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      capturePage: vi.fn(async () => ({
        getSize: () => ({ width: 4, height: 4 }),
        toBitmap: () => Buffer.alloc(4 * 4 * 4, 255),
      })),
      on: vi.fn(),
      webContents: {
        send: vi.fn(),
        postMessage: vi.fn(),
        executeJavaScript: vi.fn(async () => undefined),
      },
    };

    const mockProvider: DisplayProvider = {
      getAllDisplays: () => [
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 0, width: 1920, height: 1040 },
          scaleFactor: 1,
        },
      ],
      getPrimaryDisplay: () => ({
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
      }),
      getDisplayMatching: () => ({
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
      }),
    };

    controller = new PetWindowControllerImpl(
      mockWin as unknown as BrowserWindow,
      stubWindowIntegration(),
      tmpDir,
      mockProvider
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retains independent layers across updates', async () => {
    controller.setState({ workStatus: 2 });
    let state = await controller.getPackState();
    expect(state.workStatus).toBe(2);
    expect(state.locomotion).toBe(0);

    controller.setState({ locomotion: 1 });
    state = await controller.getPackState();
    expect(state.workStatus).toBe(2);
    expect(state.locomotion).toBe(1);
  });

  it('only calls setState when deriveWorkStatus produces a new status', () => {
    const setStateSpy = vi.spyOn(controller, 'setState');

    // Initial snapshot -> deriveWorkStatus is 0 (matches initial cached value 0)
    controller.applyJobSnapshot({
      receivingOrder: false,
      activeJobCount: 0,
      waitingApprovalCount: 0,
      unacknowledgedResultCount: 0,
    });
    expect(setStateSpy).not.toHaveBeenCalled();

    // New snapshot -> activeJobCount: 1 -> status 2
    controller.applyJobSnapshot({
      receivingOrder: false,
      activeJobCount: 1,
      waitingApprovalCount: 0,
      unacknowledgedResultCount: 0,
    });
    expect(setStateSpy).toHaveBeenCalledWith({ workStatus: 2 });

    // Same derived status (2) with different job count -> should not call setState
    setStateSpy.mockClear();
    controller.applyJobSnapshot({
      receivingOrder: false,
      activeJobCount: 3,
      waitingApprovalCount: 0,
      unacknowledgedResultCount: 0,
    });
    expect(setStateSpy).not.toHaveBeenCalled();
  });

  it('rejects activation for incompatible contract major revisions', async () => {
    const result = await controller.activatePack('/some/path.riv', {
      contractVersion: '1.0.0',
    });
    expect(result).toEqual({ activated: false, error: 'INCOMPATIBLE_REVISION' });
  });

  it('rejects activation for out-of-range blend durations', async () => {
    const resultLow = await controller.activatePack('/some/path.riv', {
      contractVersion: '2.0.0',
      descriptor: {
        ...SHIPPED_PET_DESCRIPTOR,
        transitionBlendDurationMs: 100, // < 150 ms
      },
    });
    expect(resultLow).toEqual({ activated: false, error: 'BLEND_DURATION_OUT_OF_RANGE' });

    const resultHigh = await controller.activatePack('/some/path.riv', {
      contractVersion: '2.0.0',
      descriptor: {
        ...SHIPPED_PET_DESCRIPTOR,
        transitionBlendDurationMs: 300, // > 250 ms
      },
    });
    expect(resultHigh).toEqual({ activated: false, error: 'BLEND_DURATION_OUT_OF_RANGE' });
  });

  it('toggles visibility and notifies listeners on show and hide', () => {
    const listener = vi.fn();
    const unsub = controller.onVisibilityChange(listener);

    expect(controller.isVisible()).toBe(true);

    controller.hide();
    expect(controller.isVisible()).toBe(false);
    expect(mockWin.hide).toHaveBeenCalled();
    expect(mockWin.webContents.send).toHaveBeenCalledWith('pet:visibilityChanged', false);
    expect(listener).toHaveBeenCalledWith(false);

    controller.show();
    expect(controller.isVisible()).toBe(true);
    expect(mockWin.showInactive).toHaveBeenCalled();
    expect(mockWin.webContents.send).toHaveBeenCalledWith('pet:visibilityChanged', true);
    expect(listener).toHaveBeenCalledWith(true);

    unsub();
  });
});

describe('Tray localization resources', () => {
  it('provides complete trayHidePet and trayShowPet in both vi and en', () => {
    expect(RESOURCES.en.trayHidePet).toBe('Hide pet');
    expect(RESOURCES.en.trayShowPet).toBe('Show pet');
    expect(RESOURCES.vi.trayHidePet).toBe('Ẩn pet');
    expect(RESOURCES.vi.trayShowPet).toBe('Hiện pet');
  });
});

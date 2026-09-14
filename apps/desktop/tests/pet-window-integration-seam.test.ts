import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { BrowserWindow } from 'electron';
import { PetWindowControllerImpl } from '../main/pet-window/pet-controller.js';
import type { DisplayProvider } from '../main/pet-window/pet-bounds-topology.js';
import type {
  PixelAlphaProvider,
  WindowIntegrationCapabilities,
} from '../main/window-integration/types.js';
import {
  stubWindowIntegration,
  type StubWindowIntegration,
} from './helpers/stub-window-integration.js';

const DISPLAY = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1,
};

const displayProvider: DisplayProvider = {
  getAllDisplays: () => [DISPLAY],
  getPrimaryDisplay: () => DISPLAY,
  getDisplayMatching: () => DISPLAY,
};

function bgraBuffer(width: number, height: number, alphaAt: (x: number, y: number) => number): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buf[(y * width + x) * 4 + 3] = alphaAt(x, y);
    }
  }
  return buf;
}

/**
 * The pet window is the one surface both the rendering feature and the native window
 * feature act on. These checks hold the join between them: the controller must not
 * reach past the platform facade to Electron's own window controls, and the pointer
 * mask the native layer needs must actually be supplied.
 */
describe('Pet controller and window integration seam', () => {
  let tmpDir: string;
  let mockWin: Record<string, unknown>;
  let integration: StubWindowIntegration;
  let capabilities: WindowIntegrationCapabilities;
  let controller: PetWindowControllerImpl;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-seam-test-'));

    capabilities = {
      presentWithoutActivating: 'native',
      setPointerPassthrough: 'native',
      setVisibleEverywhere: 'native',
      restoreFocusTo: 'native',
      setDockPresence: 'native',
      setExcludedFromCapture: 'native',
    };

    mockWin = {
      isDestroyed: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      showInactive: vi.fn(),
      hide: vi.fn(),
      getBounds: vi.fn(() => ({ x: 100, y: 100, width: 200, height: 200 })),
      setBounds: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      on: vi.fn(),
      capturePage: vi.fn(async () => ({
        getSize: () => ({ width: 8, height: 8 }),
        toBitmap: () => bgraBuffer(8, 8, (x, y) => (x >= 2 && x < 6 && y >= 2 && y < 6 ? 255 : 0)),
      })),
      webContents: {
        send: vi.fn(),
        postMessage: vi.fn(),
        executeJavaScript: vi.fn(async () => undefined),
      },
    };

    integration = stubWindowIntegration(() => capabilities);

    controller = new PetWindowControllerImpl(
      mockWin as unknown as BrowserWindow,
      integration,
      tmpDir,
      displayProvider
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reasserts topmost through the platform facade rather than Electron directly', () => {
    controller.reassertAlwaysOnTop();

    expect(integration.applyNoActivateTopmost).toHaveBeenCalledWith(mockWin);
    expect(mockWin['setAlwaysOnTop']).not.toHaveBeenCalled();
    expect(mockWin['setVisibleOnAllWorkspaces']).not.toHaveBeenCalled();
  });

  it('supplies the pointer mask from a captured frame', async () => {
    await controller.refreshPointerMask();

    expect(integration.enablePixelHitTest).toHaveBeenCalledTimes(1);
    const [, provider] = integration.enablePixelHitTest.mock.calls[0] as [
      BrowserWindow,
      PixelAlphaProvider,
    ];
    expect(provider.width).toBe(8);
    expect(provider.height).toBe(8);
    expect(provider.getAlphaAt(3, 3)).toBe(255);
    expect(provider.getAlphaAt(0, 0)).toBe(0);
  });

  it('does not attempt a pointer mask where the platform cannot pass pointers through', async () => {
    capabilities = { ...capabilities, setPointerPassthrough: 'unavailable' };

    await controller.refreshPointerMask();

    expect(integration.enablePixelHitTest).not.toHaveBeenCalled();
    expect(mockWin['capturePage']).not.toHaveBeenCalled();
  });

  it('waits for the renderer to paint before capturing', async () => {
    const order: string[] = [];
    const webContents = mockWin['webContents'] as { executeJavaScript: ReturnType<typeof vi.fn> };
    webContents.executeJavaScript = vi.fn(async () => {
      order.push('awaited-paint');
    });
    mockWin['capturePage'] = vi.fn(async () => {
      order.push('captured');
      return {
        getSize: () => ({ width: 8, height: 8 }),
        toBitmap: () => bgraBuffer(8, 8, () => 255),
      };
    });

    await controller.refreshPointerMask();

    expect(order).toEqual(['awaited-paint', 'captured']);
  });

  it('refuses a mask with no opaque pixels, which would make the pet unclickable', async () => {
    mockWin['capturePage'] = vi.fn(async () => ({
      getSize: () => ({ width: 8, height: 8 }),
      toBitmap: () => bgraBuffer(8, 8, () => 0),
    }));

    await controller.refreshPointerMask();

    expect(integration.enablePixelHitTest).not.toHaveBeenCalled();
  });

  it('does not try to capture a window that is not on screen', async () => {
    (mockWin['isVisible'] as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await controller.refreshPointerMask();

    expect(mockWin['capturePage']).not.toHaveBeenCalled();
    expect(integration.enablePixelHitTest).not.toHaveBeenCalled();
  });

  it('gives up rather than waiting forever for a frame that never arrives', async () => {
    const webContents = mockWin['webContents'] as { executeJavaScript: ReturnType<typeof vi.fn> };
    // A hidden or occluded renderer never runs an animation frame, so the wait for a paint
    // has to have an end. Without one it kept the renderer busy and the application could
    // not close.
    webContents.executeJavaScript = vi.fn(() => new Promise<void>(() => {}));

    await expect(controller.refreshPointerMask()).resolves.toBeUndefined();
    expect(integration.enablePixelHitTest).not.toHaveBeenCalled();
  }, 10_000);

  it('leaves the previous mask in place when a capture cannot be accounted for', async () => {
    mockWin['capturePage'] = vi.fn(async () => ({
      getSize: () => ({ width: 8, height: 8 }),
      toBitmap: () => Buffer.alloc(4 * 123 * 457),
    }));

    await controller.refreshPointerMask();

    expect(integration.enablePixelHitTest).not.toHaveBeenCalled();
  });

  it('survives a capture that fails outright', async () => {
    mockWin['capturePage'] = vi.fn(async () => {
      throw new Error('capture unavailable');
    });

    await expect(controller.refreshPointerMask()).resolves.toBeUndefined();
    expect(integration.enablePixelHitTest).not.toHaveBeenCalled();
  });
});

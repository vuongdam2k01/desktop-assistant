import { vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type {
  WindowIntegration,
  WindowIntegrationCapabilities,
} from '../../main/window-integration/types.js';

export type StubWindowIntegration = WindowIntegration & {
  applyNoActivateTopmost: ReturnType<typeof vi.fn>;
  moveWithoutActivate: ReturnType<typeof vi.fn>;
  enablePixelHitTest: ReturnType<typeof vi.fn>;
  disablePixelHitTest: ReturnType<typeof vi.fn>;
  excludeFromCapture: ReturnType<typeof vi.fn>;
};

const NATIVE_EVERYWHERE: WindowIntegrationCapabilities = {
  presentWithoutActivating: 'native',
  setPointerPassthrough: 'native',
  setVisibleEverywhere: 'native',
  restoreFocusTo: 'native',
  setDockPresence: 'native',
  setExcludedFromCapture: 'native',
};

/**
 * A window integration that records what the caller asked of it. `capabilities` is read
 * through a getter so a test can change what the platform claims to support between calls.
 */
export function stubWindowIntegration(
  readCapabilities: () => WindowIntegrationCapabilities = () => NATIVE_EVERYWHERE
): StubWindowIntegration {
  return {
    capabilities: () => readCapabilities(),
    browserWindowOptions: () => ({}),
    applyNoActivateTopmost: vi.fn(),
    moveWithoutActivate: vi.fn(),
    enablePixelHitTest: vi.fn(),
    disablePixelHitTest: vi.fn(),
    restorePreviousFocus: () => false,
    setActivationPolicy: () => true,
    excludeFromCapture: vi.fn(() => true),
    prewarmCardWindow: async () => ({}) as BrowserWindow,
  } as StubWindowIntegration;
}

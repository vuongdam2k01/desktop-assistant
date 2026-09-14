import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import type { WindowPlacementOptions } from '@desktop-assistant/contracts/native-window-manager';
import {
  type ActivationPolicy,
  type PixelAlphaProvider,
  type WindowIntegration,
  type WindowIntegrationCapabilities,
} from './types.js';
import { samplePixelAlpha, validatePlacement } from './pixel-mask.js';

export const UNSUPPORTED_CAPABILITIES: Readonly<WindowIntegrationCapabilities> = Object.freeze({
  presentWithoutActivating: 'unavailable',
  setPointerPassthrough: 'unavailable',
  setVisibleEverywhere: 'framework',
  restoreFocusTo: 'unavailable',
  setDockPresence: 'framework',
  setExcludedFromCapture: 'unavailable',
});

export class UnsupportedWindowIntegration implements WindowIntegration {
  private cardWindow?: BrowserWindow;

  capabilities(): Readonly<WindowIntegrationCapabilities> {
    return UNSUPPORTED_CAPABILITIES;
  }

  browserWindowOptions(kind: 'pet' | 'card'): BrowserWindowConstructorOptions {
    return {
      transparent: true,
      frame: false,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: true,
      ...(kind === 'card' ? { resizable: false } : {}),
    };
  }

  applyNoActivateTopmost(window: BrowserWindow): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  moveWithoutActivate(window: BrowserWindow, placement: WindowPlacementOptions): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    validatePlacement(placement);
    window.setBounds({
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
    if (placement.visible) {
      window.showInactive();
    } else {
      window.hide();
    }
  }

  enablePixelHitTest(window: BrowserWindow, provider: PixelAlphaProvider): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    samplePixelAlpha(provider);
  }

  disablePixelHitTest(window: BrowserWindow): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
  }

  restorePreviousFocus(): boolean {
    return false;
  }

  setActivationPolicy(_mode: ActivationPolicy): boolean {
    return true;
  }

  excludeFromCapture(window: BrowserWindow, _excluded: boolean): boolean {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    return false;
  }

  async prewarmCardWindow(options?: BrowserWindowConstructorOptions): Promise<BrowserWindow> {
    if (this.cardWindow && !this.cardWindow.isDestroyed()) {
      return this.cardWindow;
    }

    const cardOpts: BrowserWindowConstructorOptions = {
      width: 340,
      height: 220,
      show: false,
      ...this.browserWindowOptions('card'),
      ...options,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        ...options?.webPreferences,
      },
    };

    const card = new BrowserWindow(cardOpts);
    try {
      await card.loadURL('about:blank');
    } catch (err) {
      if (!card.isDestroyed()) {
        card.destroy();
      }
      throw err;
    }

    this.applyNoActivateTopmost(card);
    card.hide();
    this.cardWindow = card;
    return card;
  }
}

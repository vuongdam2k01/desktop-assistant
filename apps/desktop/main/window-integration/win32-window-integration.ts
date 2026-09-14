import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import type { WindowPlacementOptions } from '@desktop-assistant/contracts/native-window-manager';
import {
  WIN32_DEGRADED_CAPABILITIES,
  type ActivationPolicy,
  type CapabilityStatus,
  type PixelAlphaProvider,
  type Win32NativeBinding,
  type WindowIntegration,
  type WindowIntegrationCapabilities,
} from './types.js';
import { samplePixelAlpha, validatePlacement } from './pixel-mask.js';

function toCapabilityStatus(val: unknown, fallback: CapabilityStatus): CapabilityStatus {
  return val === 'native' || val === 'framework' || val === 'unavailable' ? val : fallback;
}

export class Win32WindowIntegration implements WindowIntegration {
  private readonly binding: Win32NativeBinding;
  private readonly maskCache = new WeakMap<BrowserWindow, Buffer>();
  private cardWindow?: BrowserWindow;

  constructor(binding?: Win32NativeBinding) {
    if (binding) {
      this.binding = binding;
    } else {
      // Lazy load to prevent foreign-platform crashes during build/tests
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.binding = require('@desktop-assistant/win32-window');
    }
  }

  capabilities(): Readonly<WindowIntegrationCapabilities> {
    try {
      const raw = this.binding.capabilities();
      return Object.freeze({
        presentWithoutActivating: toCapabilityStatus(raw.presentWithoutActivating, 'unavailable'),
        setPointerPassthrough: toCapabilityStatus(raw.setPointerPassthrough, 'unavailable'),
        setVisibleEverywhere: toCapabilityStatus(raw.setVisibleEverywhere, 'framework'),
        restoreFocusTo: toCapabilityStatus(raw.restoreFocusTo, 'unavailable'),
        setDockPresence: toCapabilityStatus(raw.setDockPresence, 'framework'),
        setExcludedFromCapture: toCapabilityStatus(raw.setExcludedFromCapture, 'framework'),
      });
    } catch {
      return WIN32_DEGRADED_CAPABILITIES;
    }
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
    this.binding.apply_no_activate_topmost(window.getNativeWindowHandle());
  }

  moveWithoutActivate(window: BrowserWindow, placement: WindowPlacementOptions): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    validatePlacement(placement);
    const handle = window.getNativeWindowHandle();

    if (placement.visible) {
      this.binding.move_without_activate(handle, placement);
      window.setIgnoreMouseEvents(false);
      window.setOpacity(1.0);
    } else {
      window.setOpacity(0.0);
      window.setIgnoreMouseEvents(true);
      this.binding.move_without_activate(handle, {
        ...placement,
        visible: true,
      });
    }
  }

  enablePixelHitTest(window: BrowserWindow, provider: PixelAlphaProvider): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    const existing = this.maskCache.get(window);
    const mask = samplePixelAlpha(provider, existing);
    this.binding.enable_pixel_hit_test(
      window.getNativeWindowHandle(),
      provider.width,
      provider.height,
      mask
    );
    this.maskCache.set(window, mask);
  }

  disablePixelHitTest(window: BrowserWindow): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    this.binding.disable_pixel_hit_test(window.getNativeWindowHandle());
    this.maskCache.delete(window);
  }

  restorePreviousFocus(): boolean {
    return false;
  }

  setActivationPolicy(_mode: ActivationPolicy): boolean {
    return true;
  }

  excludeFromCapture(window: BrowserWindow, excluded: boolean): boolean {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    window.setContentProtection(excluded);
    return true;
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
      this.applyNoActivateTopmost(card);
      card.setOpacity(0.0);
      card.setIgnoreMouseEvents(true);

      const bounds = card.getBounds();
      this.binding.move_without_activate(card.getNativeWindowHandle(), {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        visible: true,
      });

      this.excludeFromCapture(card, true);
    } catch (err) {
      if (!card.isDestroyed()) {
        card.destroy();
      }
      throw err;
    }

    this.cardWindow = card;
    return card;
  }
}

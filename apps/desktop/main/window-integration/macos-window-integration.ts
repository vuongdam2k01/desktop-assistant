import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import type { WindowPlacementOptions } from '@desktop-assistant/contracts/native-window-manager';
import {
  MACOS_DEGRADED_CAPABILITIES,
  type ActivationPolicy,
  type CapabilityStatus,
  type MacOSNativeBinding,
  type PixelAlphaProvider,
  type WindowIntegration,
  type WindowIntegrationCapabilities,
} from './types.js';
import { samplePixelAlpha, validatePlacement } from './pixel-mask.js';

function toCapabilityStatus(val: unknown, fallback: CapabilityStatus): CapabilityStatus {
  return val === 'native' || val === 'framework' || val === 'unavailable' ? val : fallback;
}

export class MacOSWindowIntegration implements WindowIntegration {
  private readonly binding: MacOSNativeBinding;
  private readonly maskCache = new WeakMap<BrowserWindow, Buffer>();
  private cardWindow?: BrowserWindow;
  private warnedAboutWindowKind = false;

  constructor(binding?: MacOSNativeBinding) {
    if (binding) {
      this.binding = binding;
    } else {
      // Lazy load to prevent foreign-platform crashes during build/tests
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.binding = require('@desktop-assistant/macos-window');
    }
  }

  capabilities(): Readonly<WindowIntegrationCapabilities> {
    try {
      const raw = this.binding.capabilities();
      return Object.freeze({
        presentWithoutActivating: toCapabilityStatus(raw.presentWithoutActivating, 'framework'),
        setPointerPassthrough: toCapabilityStatus(raw.setPointerPassthrough, 'unavailable'),
        setVisibleEverywhere: toCapabilityStatus(raw.setVisibleEverywhere, 'framework'),
        restoreFocusTo: toCapabilityStatus(raw.restoreFocusTo, 'unavailable'),
        setDockPresence: toCapabilityStatus(raw.setDockPresence, 'framework'),
        setExcludedFromCapture: toCapabilityStatus(raw.setExcludedFromCapture, 'framework'),
      });
    } catch {
      return MACOS_DEGRADED_CAPABILITIES;
    }
  }

  browserWindowOptions(kind: 'pet' | 'card'): BrowserWindowConstructorOptions {
    return {
      transparent: true,
      frame: false,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: true,
      type: 'panel',
      ...(kind === 'card' ? { resizable: false } : {}),
    };
  }

  applyNoActivateTopmost(window: BrowserWindow): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');

    // Ownership is checked first, so a handle from another process is refused before
    // anything is applied to a window.
    try {
      this.binding.applyNoActivateTopmost(window.getNativeWindowHandle());
      // The native module owns the window from here: it has set the panel level and the
      // collection behaviour, and reapplying the framework equivalents over the top would
      // put the two in contention over the same properties.
      return;
    } catch (err) {
      if ((err as { code?: string }).code !== 'INVALID_WINDOW_KIND') {
        throw err;
      }
      if (!this.warnedAboutWindowKind) {
        this.warnedAboutWindowKind = true;
        console.warn(
          '[MacOSWindowIntegration] A window could not take the native panel styling; keeping the framework always-on-top behaviour for it.'
        );
      }
    }

    // The capability map declares presenting without activating as the framework's job on
    // this platform, and the spike that settled it measured the framework achieving it in
    // full. A window the native styling does not apply to is a reason to fall back to that,
    // not a reason to take the application down.
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
      this.binding.rememberPreviousFocus();
      window.showInactive();
    } else {
      window.hide();
    }
  }

  enablePixelHitTest(window: BrowserWindow, provider: PixelAlphaProvider): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    const existing = this.maskCache.get(window);
    const mask = samplePixelAlpha(provider, existing);
    this.binding.enablePixelHitTest(
      window.getNativeWindowHandle(),
      provider.width,
      provider.height,
      mask
    );
    this.maskCache.set(window, mask);
  }

  disablePixelHitTest(window: BrowserWindow): void {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    this.binding.disablePixelHitTest(window.getNativeWindowHandle());
    this.maskCache.delete(window);
  }

  restorePreviousFocus(): boolean {
    return this.binding.restorePreviousFocus();
  }

  setActivationPolicy(mode: ActivationPolicy): boolean {
    return this.binding.setActivationPolicy(mode);
  }

  excludeFromCapture(window: BrowserWindow, excluded: boolean): boolean {
    if (window.isDestroyed()) throw new Error('WINDOW_DESTROYED');
    return this.binding.excludeFromCapture(window.getNativeWindowHandle(), excluded);
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
      this.excludeFromCapture(card, true);
      card.hide();
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

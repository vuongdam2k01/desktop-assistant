import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import type { WindowPlacementOptions } from '@desktop-assistant/contracts/native-window-manager';

export type CapabilityStatus = 'native' | 'framework' | 'unavailable';

export interface WindowIntegrationCapabilities {
  presentWithoutActivating: CapabilityStatus;
  setPointerPassthrough: CapabilityStatus;
  setVisibleEverywhere: CapabilityStatus;
  restoreFocusTo: CapabilityStatus;
  setDockPresence: CapabilityStatus;
  setExcludedFromCapture: CapabilityStatus;
}

export const WIN32_NATIVE_CAPABILITIES: Readonly<WindowIntegrationCapabilities> = Object.freeze({
  presentWithoutActivating: 'native',
  setPointerPassthrough: 'native',
  setVisibleEverywhere: 'framework',
  restoreFocusTo: 'unavailable',
  setDockPresence: 'framework',
  setExcludedFromCapture: 'framework',
});

export const WIN32_DEGRADED_CAPABILITIES: Readonly<WindowIntegrationCapabilities> = Object.freeze({
  presentWithoutActivating: 'unavailable',
  setPointerPassthrough: 'unavailable',
  setVisibleEverywhere: 'framework',
  restoreFocusTo: 'unavailable',
  setDockPresence: 'framework',
  setExcludedFromCapture: 'framework',
});

export const MACOS_NATIVE_CAPABILITIES: Readonly<WindowIntegrationCapabilities> = Object.freeze({
  presentWithoutActivating: 'framework',
  setPointerPassthrough: 'native',
  setVisibleEverywhere: 'native',
  restoreFocusTo: 'native',
  setDockPresence: 'native',
  setExcludedFromCapture: 'native',
});

export const MACOS_DEGRADED_CAPABILITIES: Readonly<WindowIntegrationCapabilities> = Object.freeze({
  presentWithoutActivating: 'framework',
  setPointerPassthrough: 'unavailable',
  setVisibleEverywhere: 'framework',
  restoreFocusTo: 'unavailable',
  setDockPresence: 'framework',
  setExcludedFromCapture: 'framework',
});

export const WIN32_DEFAULT_CAPABILITIES = WIN32_DEGRADED_CAPABILITIES;
export const MACOS_DEFAULT_CAPABILITIES = MACOS_DEGRADED_CAPABILITIES;

export type ActivationPolicy = 'accessory' | 'regular';

export interface PixelAlphaProvider {
  readonly width: number;
  readonly height: number;
  getAlphaAt(x: number, y: number): number;
}

export interface WindowIntegration {
  capabilities(): Readonly<WindowIntegrationCapabilities>;
  browserWindowOptions(kind: 'pet' | 'card'): BrowserWindowConstructorOptions;
  applyNoActivateTopmost(window: BrowserWindow): void;
  moveWithoutActivate(window: BrowserWindow, placement: WindowPlacementOptions): void;
  enablePixelHitTest(window: BrowserWindow, provider: PixelAlphaProvider): void;
  disablePixelHitTest(window: BrowserWindow): void;
  restorePreviousFocus(): boolean;
  setActivationPolicy(mode: ActivationPolicy): boolean;
  excludeFromCapture(window: BrowserWindow, excluded: boolean): boolean;
  prewarmCardWindow(options?: BrowserWindowConstructorOptions): Promise<BrowserWindow>;
}

export interface Win32NativeBinding {
  capabilities(): Record<string, string>;
  apply_no_activate_topmost(handle: Buffer): void;
  move_without_activate(handle: Buffer, placement: WindowPlacementOptions): void;
  enable_pixel_hit_test(handle: Buffer, width: number, height: number, alpha: Buffer): void;
  disable_pixel_hit_test(handle: Buffer): void;
}

export interface MacOSNativeBinding {
  capabilities(): Record<string, string>;
  applyNoActivateTopmost(handle: Buffer): void;
  enablePixelHitTest(handle: Buffer, width: number, height: number, alpha: Buffer): void;
  disablePixelHitTest(handle: Buffer): void;
  rememberPreviousFocus(): boolean;
  restorePreviousFocus(): boolean;
  setActivationPolicy(mode: ActivationPolicy): boolean;
  excludeFromCapture(handle: Buffer, excluded: boolean): boolean;
}

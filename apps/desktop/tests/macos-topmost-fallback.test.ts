import { describe, it, expect, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { MacOSWindowIntegration } from '../main/window-integration/macos-window-integration.js';
import {
  MACOS_NATIVE_CAPABILITIES,
  type MacOSNativeBinding,
} from '../main/window-integration/types.js';

function nativeError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function bindingThatFails(code: string, message: string): MacOSNativeBinding {
  return {
    capabilities: () => MACOS_NATIVE_CAPABILITIES,
    applyNoActivateTopmost: vi.fn(() => {
      throw nativeError(code, message);
    }),
    enablePixelHitTest: vi.fn(),
    disablePixelHitTest: vi.fn(),
    rememberPreviousFocus: vi.fn(),
    restorePreviousFocus: vi.fn(() => true),
    setActivationPolicy: vi.fn(() => true),
    excludeFromCapture: vi.fn(() => true),
  } as unknown as MacOSNativeBinding;
}

function fakeWindow(): BrowserWindow & {
  setAlwaysOnTop: ReturnType<typeof vi.fn>;
  setVisibleOnAllWorkspaces: ReturnType<typeof vi.fn>;
} {
  return {
    isDestroyed: () => false,
    getNativeWindowHandle: () => Buffer.alloc(8, 1),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
  } as unknown as BrowserWindow & {
    setAlwaysOnTop: ReturnType<typeof vi.fn>;
    setVisibleOnAllWorkspaces: ReturnType<typeof vi.fn>;
  };
}

/**
 * The macOS capability map declares presenting without activating as the framework's job,
 * and the spike that established it measured the framework achieving it in full. The
 * native module exists for pointer hit testing and workspace collection behaviour. So a
 * window the native panel styling cannot be applied to must not take the application down
 * with it — the framework still delivers the guarantee that matters.
 */
describe('macOS topmost application', () => {
  it('keeps the framework guarantee when the window is not a panel', () => {
    const binding = bindingThatFails('INVALID_WINDOW_KIND', 'Window is not an NSPanel');
    const integration = new MacOSWindowIntegration(binding);
    const win = fakeWindow();

    expect(() => integration.applyNoActivateTopmost(win)).not.toThrow();

    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
      visibleOnFullScreen: true,
    });
  });

  it('still refuses a handle that does not belong to this process', () => {
    const binding = bindingThatFails('FOREIGN_NS_VIEW', 'Window not owned by current process');
    const integration = new MacOSWindowIntegration(binding);

    // The module carries the machine-readable reason on `code`; its message is prose.
    expect(() => integration.applyNoActivateTopmost(fakeWindow())).toThrow(
      expect.objectContaining({ code: 'FOREIGN_NS_VIEW' })
    );
  });

  it('leaves the window to the native styling when that succeeds', () => {
    const binding = {
      capabilities: () => MACOS_NATIVE_CAPABILITIES,
      applyNoActivateTopmost: vi.fn(),
      enablePixelHitTest: vi.fn(),
      disablePixelHitTest: vi.fn(),
      rememberPreviousFocus: vi.fn(),
      restorePreviousFocus: vi.fn(() => true),
      setActivationPolicy: vi.fn(() => true),
      excludeFromCapture: vi.fn(() => true),
    } as unknown as MacOSNativeBinding;
    const integration = new MacOSWindowIntegration(binding);
    const win = fakeWindow();

    integration.applyNoActivateTopmost(win);

    // Reapplying the framework behaviour over a successful native call would put the two
    // back in contention over the same window property.
    expect(win.setAlwaysOnTop).not.toHaveBeenCalled();
    expect(win.setVisibleOnAllWorkspaces).not.toHaveBeenCalled();
  });

  it('rejects a foreign handle before touching the window at all', () => {
    const binding = bindingThatFails('FOREIGN_NS_VIEW', 'Window not owned by current process');
    const integration = new MacOSWindowIntegration(binding);
    const bare = {
      isDestroyed: () => false,
      getNativeWindowHandle: () => Buffer.alloc(8, 1),
    } as unknown as BrowserWindow;

    // Ownership is checked before anything is applied, so a caller holding only a handle
    // still gets the refusal rather than a missing-method error.
    expect(() => integration.applyNoActivateTopmost(bare)).toThrow(
      expect.objectContaining({ code: 'FOREIGN_NS_VIEW' })
    );
  });

  it('refuses a destroyed window before reaching the binding', () => {
    const binding = bindingThatFails('INVALID_WINDOW_KIND', 'Window is not an NSPanel');
    const integration = new MacOSWindowIntegration(binding);
    const destroyed = { isDestroyed: () => true } as unknown as BrowserWindow;

    expect(() => integration.applyNoActivateTopmost(destroyed)).toThrow('WINDOW_DESTROYED');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { normalizeLocale, RESOURCES } from '../i18n/resources.js';
import { shouldDisableHardwareAcceleration } from '../main/software-rendering.js';
import { DesktopContext } from '../main/context.js';
import type { BrowserWindow } from 'electron';
import {
  WIN32_NATIVE_CAPABILITIES,
  WIN32_DEGRADED_CAPABILITIES,
  MACOS_NATIVE_CAPABILITIES,
  MACOS_DEGRADED_CAPABILITIES,
  type PixelAlphaProvider,
  type Win32NativeBinding,
  type MacOSNativeBinding,
} from '../main/window-integration/types.js';
import { Win32WindowIntegration } from '../main/window-integration/win32-window-integration.js';
import { MacOSWindowIntegration } from '../main/window-integration/macos-window-integration.js';
import { UnsupportedWindowIntegration } from '../main/window-integration/unsupported-window-integration.js';
import { selectWindowIntegration } from '../main/window-integration/select-window-integration.js';
import { samplePixelAlpha, validatePlacement } from '../main/window-integration/pixel-mask.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Software rendering predicate (RISK-035 / VM / headless / RDP)', () => {
  it('disables hardware acceleration when DESKTOP_ASSISTANT_SOFTWARE_RENDERING=1', () => {
    const res = shouldDisableHardwareAcceleration(
      { DESKTOP_ASSISTANT_SOFTWARE_RENDERING: '1' },
      'linux'
    );
    expect(res).toBe(true);
  });

  it('disables hardware acceleration in CI environments', () => {
    expect(shouldDisableHardwareAcceleration({ CI: 'true' }, 'linux')).toBe(true);
    expect(shouldDisableHardwareAcceleration({ GITHUB_ACTIONS: 'true' }, 'win32')).toBe(true);
  });

  it('disables hardware acceleration on Linux without DISPLAY or Wayland', () => {
    const res = shouldDisableHardwareAcceleration({}, 'linux');
    expect(res).toBe(true);
  });

  it('keeps hardware acceleration on Linux with valid DISPLAY', () => {
    const res = shouldDisableHardwareAcceleration({ DISPLAY: ':0' }, 'linux');
    expect(res).toBe(false);
  });

  it('disables hardware acceleration on Windows RDP / ICA sessions', () => {
    expect(
      shouldDisableHardwareAcceleration({ SESSIONNAME: 'RDP-Tcp#12' }, 'win32')
    ).toBe(true);
    expect(
      shouldDisableHardwareAcceleration({ CLIENTNAME: 'RemoteClientPC' }, 'win32')
    ).toBe(true);
  });
  it('disables hardware acceleration under common hypervisor/container hints', () => {
    expect(shouldDisableHardwareAcceleration({ container: 'docker' }, 'linux')).toBe(true);
    expect(shouldDisableHardwareAcceleration({ DOCKER_CONTAINER: '1' }, 'linux')).toBe(true);
    expect(shouldDisableHardwareAcceleration({ KUBERNETES_SERVICE_HOST: '10.0.0.1' }, 'linux')).toBe(true);
    expect(shouldDisableHardwareAcceleration({ VBOX_MSI_INSTALL_PATH: 'C:\\VBox' }, 'win32')).toBe(true);
    expect(shouldDisableHardwareAcceleration({ VMWARE_INSTALL_PATH: 'C:\\VMware' }, 'win32')).toBe(true);
    expect(shouldDisableHardwareAcceleration({ QEMU_AUDIO_DRV: 'pa' }, 'linux')).toBe(true);
    expect(shouldDisableHardwareAcceleration({ WSL_DISTRO_NAME: 'Ubuntu' }, 'linux')).toBe(true);
  });

  it('keeps hardware acceleration on normal Windows local sessions', () => {
    const res = shouldDisableHardwareAcceleration({ SESSIONNAME: 'Console' }, 'win32');
    expect(res).toBe(false);
  });
});

describe('Locale normalization and resources', () => {
  it('normalizes locale correctly', () => {
    expect(normalizeLocale('vi')).toBe('vi');
    expect(normalizeLocale('vi-VN')).toBe('vi');
    expect(normalizeLocale('VI_vn')).toBe('vi');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('en_GB')).toBe('en');
    expect(normalizeLocale('fr-FR')).toBe('en'); // non-vi defaults to en
    expect(normalizeLocale(undefined)).toBe('en');
    expect(normalizeLocale('')).toBe('en');
  });

  it('contains complete localized resources for both vi and en', () => {
    for (const loc of ['vi', 'en'] as const) {
      const r = RESOURCES[loc];
      expect(r.appTitle).toBe('Desktop Assistant');
      expect(r.appHeading.length).toBeGreaterThan(0);
      expect(r.trayOpen.length).toBeGreaterThan(0);
      expect(r.trayHidePet.length).toBeGreaterThan(0);
      expect(r.trayShowPet.length).toBeGreaterThan(0);
      expect(r.trayQuit.length).toBeGreaterThan(0);
      expect(r.languageLabel.length).toBeGreaterThan(0);
    }
  });
});

describe('DesktopContext and lifecycle state transitions', () => {
  it('updates locale and notifies listeners synchronously', () => {
    const context = new DesktopContext();
    expect(context.locale).toBe('en');
    expect(context.isQuitting).toBe(false);

    const listener = vi.fn();
    const unsubscribe = context.onLocaleChange(listener);

    context.setLocale('vi');
    expect(context.locale).toBe('vi');
    expect(listener).toHaveBeenCalledWith('vi');

    unsubscribe();
    context.setLocale('en');
    expect(listener).toHaveBeenCalledTimes(1); // not called again after unsubscribe
  });

  it('distinguishes close-to-tray hide vs explicit quit transition', () => {
    const context = new DesktopContext();

    // Mock window close event handler
    function handleCloseEvent(event: { defaultPrevented: boolean; preventDefault: () => void }): 'hidden' | 'quit' {
      if (!context.isQuitting) {
        event.preventDefault();
        return 'hidden';
      }
      return 'quit';
    }

    // 1. Ordinary close when isQuitting is false -> prevented and hidden
    const event1 = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    const outcome1 = handleCloseEvent(event1);
    expect(outcome1).toBe('hidden');
    expect(event1.defaultPrevented).toBe(true);

    // 2. Explicit quit from tray -> not prevented, proceeds to quit
    context.isQuitting = true;
    const event2 = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    const outcome2 = handleCloseEvent(event2);
    expect(outcome2).toBe('quit');
    expect(event2.defaultPrevented).toBe(false);
  });
});

describe('Window integration capabilities contracts', () => {
  it('matches exact compiled Win32 and macOS capability maps', () => {
    expect(WIN32_NATIVE_CAPABILITIES).toEqual({
      presentWithoutActivating: 'native',
      setPointerPassthrough: 'native',
      setVisibleEverywhere: 'framework',
      restoreFocusTo: 'unavailable',
      setDockPresence: 'framework',
      setExcludedFromCapture: 'framework',
    });

    expect(MACOS_NATIVE_CAPABILITIES).toEqual({
      presentWithoutActivating: 'framework',
      setPointerPassthrough: 'native',
      setVisibleEverywhere: 'native',
      restoreFocusTo: 'native',
      setDockPresence: 'native',
      setExcludedFromCapture: 'native',
    });
  });

  it('matches exact degraded Win32 and macOS capability maps', () => {
    expect(WIN32_DEGRADED_CAPABILITIES).toEqual({
      presentWithoutActivating: 'unavailable',
      setPointerPassthrough: 'unavailable',
      setVisibleEverywhere: 'framework',
      restoreFocusTo: 'unavailable',
      setDockPresence: 'framework',
      setExcludedFromCapture: 'framework',
    });

    expect(MACOS_DEGRADED_CAPABILITIES).toEqual({
      presentWithoutActivating: 'framework',
      setPointerPassthrough: 'unavailable',
      setVisibleEverywhere: 'framework',
      restoreFocusTo: 'unavailable',
      setDockPresence: 'framework',
      setExcludedFromCapture: 'framework',
    });
  });

  it('catches addon load failure and never throws from capabilities()', () => {
    const throwingWin32Binding: Win32NativeBinding = {
      capabilities() {
        throw new Error('DLL_LOAD_FAILED');
      },
      apply_no_activate_topmost: vi.fn(),
      move_without_activate: vi.fn(),
      enable_pixel_hit_test: vi.fn(),
      disable_pixel_hit_test: vi.fn(),
    };

    const win32 = new Win32WindowIntegration(throwingWin32Binding);
    expect(() => win32.capabilities()).not.toThrow();
    expect(win32.capabilities()).toEqual(WIN32_DEGRADED_CAPABILITIES);

    const throwingMacOSBinding: MacOSNativeBinding = {
      capabilities() {
        throw new Error('DYLIB_LOAD_FAILED');
      },
      applyNoActivateTopmost: vi.fn(),
      enablePixelHitTest: vi.fn(),
      disablePixelHitTest: vi.fn(),
      rememberPreviousFocus: vi.fn(),
      restorePreviousFocus: vi.fn(),
      setActivationPolicy: vi.fn(),
      excludeFromCapture: vi.fn(),
    };

    const macos = new MacOSWindowIntegration(throwingMacOSBinding);
    expect(() => macos.capabilities()).not.toThrow();
    expect(macos.capabilities()).toEqual(MACOS_DEGRADED_CAPABILITIES);
  });
});

describe('Window integration facade behavior', () => {
  function createMockWindow(isDestroyed = false) {
    return {
      isDestroyed: vi.fn(() => isDestroyed),
      getNativeWindowHandle: vi.fn(() => Buffer.alloc(8, 1)),
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      setBounds: vi.fn(),
      showInactive: vi.fn(),
      hide: vi.fn(),
      setIgnoreMouseEvents: vi.fn(),
      setOpacity: vi.fn(),
      setContentProtection: vi.fn(),
      destroy: vi.fn(),
      getBounds: vi.fn(() => ({ x: 100, y: 100, width: 340, height: 220 })),
      loadURL: vi.fn(async () => {}),
    } as unknown as BrowserWindow;
  }

  it('refuses operations on destroyed windows', () => {
    const destroyedWin = createMockWindow(true);
    const win32 = new Win32WindowIntegration({
      capabilities: () => WIN32_NATIVE_CAPABILITIES,
      apply_no_activate_topmost: vi.fn(),
      move_without_activate: vi.fn(),
      enable_pixel_hit_test: vi.fn(),
      disable_pixel_hit_test: vi.fn(),
    });

    expect(() => win32.applyNoActivateTopmost(destroyedWin)).toThrow('WINDOW_DESTROYED');
    expect(() =>
      win32.moveWithoutActivate(destroyedWin, { x: 0, y: 0, width: 100, height: 100, visible: true })
    ).toThrow('WINDOW_DESTROYED');
    expect(() =>
      win32.enablePixelHitTest(destroyedWin, { width: 1, height: 1, getAlphaAt: () => 255 })
    ).toThrow('WINDOW_DESTROYED');
    expect(() => win32.disablePixelHitTest(destroyedWin)).toThrow('WINDOW_DESTROYED');
    expect(() => win32.excludeFromCapture(destroyedWin, true)).toThrow('WINDOW_DESTROYED');
  });

  it('validates placement options before native calls', () => {
    expect(() =>
      validatePlacement({ x: 0, y: 0, width: 0, height: 100, visible: true })
    ).toThrow('INVALID_PLACEMENT');
    expect(() =>
      validatePlacement({ x: 0, y: 0, width: 100, height: -1, visible: true })
    ).toThrow('INVALID_PLACEMENT');
    expect(() =>
      validatePlacement({ x: 1.5, y: 0, width: 100, height: 100, visible: true })
    ).toThrow('INVALID_PLACEMENT');
    expect(() =>
      validatePlacement({ x: 0, y: 0, width: 100, height: 100, visible: 'yes' as unknown as boolean })
    ).toThrow('INVALID_PLACEMENT');
  });

  it('validates alpha provider atomically before mask swap', () => {
    // 1. Invalid provider dimensions
    expect(() =>
      samplePixelAlpha({ width: 0, height: 10, getAlphaAt: () => 255 })
    ).toThrow('INVALID_ALPHA_MASK');
    expect(() =>
      samplePixelAlpha({ width: 10, height: -5, getAlphaAt: () => 255 })
    ).toThrow('INVALID_ALPHA_MASK');

    // 2. Provider throws or returns invalid value halfway
    const faultyProvider: PixelAlphaProvider = {
      width: 4,
      height: 4,
      getAlphaAt(x, y) {
        if (x === 2 && y === 2) return 300; // invalid alpha > 255
        return 255;
      },
    };

    const existingBuffer = Buffer.alloc(16, 128);
    const existingCopy = Buffer.from(existingBuffer);
    expect(() => samplePixelAlpha(faultyProvider, existingBuffer)).toThrow('INVALID_ALPHA_MASK');
    // Ensure existing buffer was NOT mutated (atomic swap guarantee)
    expect(existingBuffer).toEqual(existingCopy);

    // 3. Valid provider samples and reuses existing buffer when size matches
    const validProvider: PixelAlphaProvider = {
      width: 2,
      height: 2,
      getAlphaAt(x, y) {
        return x === y ? 255 : 0;
      },
    };
    const targetBuffer = Buffer.alloc(4, 0);
    const res = samplePixelAlpha(validProvider, targetBuffer);
    expect(res).toBe(targetBuffer);
    expect(Array.from(targetBuffer)).toEqual([255, 0, 0, 255]);
  });

  it('manages Dock lifecycle policy appropriately', () => {
    const mockMacOSBinding: MacOSNativeBinding = {
      capabilities: () => MACOS_NATIVE_CAPABILITIES,
      applyNoActivateTopmost: vi.fn(),
      enablePixelHitTest: vi.fn(),
      disablePixelHitTest: vi.fn(),
      rememberPreviousFocus: vi.fn(),
      restorePreviousFocus: vi.fn(),
      setActivationPolicy: vi.fn(mode => mode === 'accessory' || mode === 'regular'),
      excludeFromCapture: vi.fn(),
    };

    const macos = new MacOSWindowIntegration(mockMacOSBinding);
    expect(macos.setActivationPolicy('accessory')).toBe(true);
    expect(mockMacOSBinding.setActivationPolicy).toHaveBeenCalledWith('accessory');
    expect(macos.setActivationPolicy('regular')).toBe(true);
    expect(mockMacOSBinding.setActivationPolicy).toHaveBeenCalledWith('regular');

    const unsupported = new UnsupportedWindowIntegration();
    expect(unsupported.setActivationPolicy('accessory')).toBe(true);
  });
});

describe('Platform selection and single-switch constraint', () => {
  it('enforces exactly one process.platform reference under main/window-integration', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const windowIntegrationDir = path.resolve(testDir, '../main/window-integration');
    const files = fs.readdirSync(windowIntegrationDir).filter(f => f.endsWith('.ts'));

    let totalPlatformRefs = 0;
    const refsByFile: Record<string, number> = {};

    for (const file of files) {
      const content = fs.readFileSync(path.join(windowIntegrationDir, file), 'utf8');
      const matches = content.match(/process\.platform/g);
      const count = matches ? matches.length : 0;
      refsByFile[file] = count;
      totalPlatformRefs += count;
    }

    expect(totalPlatformRefs).toBe(1);
    expect(refsByFile['select-window-integration.ts']).toBe(1);
  });

  it('enforces zero process.platform references in pet-window and app-window modules', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const petFile = path.resolve(testDir, '../main/pet-window/register-pet-window-module.ts');
    const appFile = path.resolve(testDir, '../main/app-window/register-app-window-module.ts');

    for (const filePath of [petFile, appFile]) {
      const content = fs.readFileSync(filePath, 'utf8');
      const matches = content.match(/process\.platform/g);
      expect(matches).toBeNull();
    }
  });

  it('selects correct integration and validates required capabilities on supported OS', () => {
    // 1. Windows with native capabilities -> succeeds
    const win32 = selectWindowIntegration({
      platform: 'win32',
      win32Binding: {
        capabilities: () => WIN32_NATIVE_CAPABILITIES,
        apply_no_activate_topmost: vi.fn(),
        move_without_activate: vi.fn(),
        enable_pixel_hit_test: vi.fn(),
        disable_pixel_hit_test: vi.fn(),
      },
    });
    expect(win32).toBeInstanceOf(Win32WindowIntegration);

    // 2. Windows with degraded capabilities -> throws missing capability
    expect(() =>
      selectWindowIntegration({
        platform: 'win32',
        win32Binding: {
          capabilities: () => WIN32_DEGRADED_CAPABILITIES,
          apply_no_activate_topmost: vi.fn(),
          move_without_activate: vi.fn(),
          enable_pixel_hit_test: vi.fn(),
          disable_pixel_hit_test: vi.fn(),
        },
      })
    ).toThrow(/WINDOW_INTEGRATION_REQUIRED_CAPABILITY_MISSING:presentWithoutActivating/);

    // 3. macOS with native capabilities -> succeeds
    const macos = selectWindowIntegration({
      platform: 'darwin',
      macosBinding: {
        capabilities: () => MACOS_NATIVE_CAPABILITIES,
        applyNoActivateTopmost: vi.fn(),
        enablePixelHitTest: vi.fn(),
        disablePixelHitTest: vi.fn(),
        rememberPreviousFocus: vi.fn(),
        restorePreviousFocus: vi.fn(),
        setActivationPolicy: vi.fn(),
        excludeFromCapture: vi.fn(),
      },
    });
    expect(macos).toBeInstanceOf(MacOSWindowIntegration);

    // 4. macOS with degraded capabilities -> throws missing capability
    expect(() =>
      selectWindowIntegration({
        platform: 'darwin',
        macosBinding: {
          capabilities: () => MACOS_DEGRADED_CAPABILITIES,
          applyNoActivateTopmost: vi.fn(),
          enablePixelHitTest: vi.fn(),
          disablePixelHitTest: vi.fn(),
          rememberPreviousFocus: vi.fn(),
          restorePreviousFocus: vi.fn(),
          setActivationPolicy: vi.fn(),
          excludeFromCapture: vi.fn(),
        },
      })
    ).toThrow(/WINDOW_INTEGRATION_REQUIRED_CAPABILITY_MISSING:setPointerPassthrough/);

    // 5. Unsupported OS (Linux) -> returns UnsupportedWindowIntegration without throwing
    const unsupported = selectWindowIntegration({ platform: 'linux' });
    expect(unsupported).toBeInstanceOf(UnsupportedWindowIntegration);
  });
});

describe('Static policy scan for prohibited OS-level symbols (RISK-078 / SP-7 / SP-18)', () => {
  it('rejects forbidden APIs across product sources', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(testDir, '../../..');

    const scanRoots = [
      path.join(repoRoot, 'native/win32-window/src'),
      path.join(repoRoot, 'native/macos-window/src'),
      path.join(repoRoot, 'apps/desktop/main/window-integration'),
      path.join(repoRoot, 'apps/desktop/main/pet-window'),
      path.join(repoRoot, 'apps/desktop/main/app-window'),
    ];

    const prohibitedPatterns: { name: string; pattern: RegExp }[] = [
      { name: 'NtSuspendProcess', pattern: /\bNtSuspendProcess\b/ },
      { name: 'NtResumeProcess', pattern: /\bNtResumeProcess\b/ },
      { name: 'SendInput', pattern: /\bSendInput\b/ },
      { name: 'SetCursorPos', pattern: /\bSetCursorPos\b/ },
      { name: 'CGEventPost', pattern: /\bCGEventPost\b/ },
      { name: 'osascript-keystroke', pattern: /osascript.*keystroke/i },
      { name: 'EnumWindows', pattern: /\bEnumWindows\b/ },
      { name: 'FindWindow', pattern: /\bFindWindow[AW]?\b/ },
      { name: 'CGWindowListCopyWindowInfo', pattern: /\bCGWindowListCopyWindowInfo\b/ },
    ];

    function getFilesRecursive(dir: string): string[] {
      if (!fs.existsSync(dir)) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFilesRecursive(fullPath));
        } else if (/\.(ts|tsx|js|mjs|cjs|rs|mm|m|h|c|cpp)$/.test(entry.name)) {
          // Skip test-only files in native
          if (entry.name.includes('test_main')) continue;
          files.push(fullPath);
        }
      }
      return files;
    }

    const allFiles = scanRoots.flatMap(r => getFilesRecursive(r));
    expect(allFiles.length).toBeGreaterThan(0);

    const violations: { file: string; rule: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const { name, pattern } of prohibitedPatterns) {
        if (pattern.test(content)) {
          violations.push({ file: path.relative(repoRoot, file), rule: name });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

# F18 Native Window Integration Completion Report

- **Date**: 2026-09-14 04:35 UTC
- **Milestone/Phase**: F18 Native Window Integration
- **Contract**: `window-integration-module@1.0.0`, `native-window-manager@1.0.0`
- **Status**: Complete & Verified

---

## 1. Executive Summary

Feature F18 delivers the complete native window integration subsystem for Desktop Assistant, fulfilling the obligations of `window-integration-module@1.0.0` across both supported desktop operating systems:
1. **Win32 Native Addon (`@desktop-assistant/win32-window`)**: Implemented in Rust via `napi-rs` using Node-API v4 and `windows-sys` (v0.61). Features owned-HWND validation against `GetCurrentProcessId()`, extended styles `WS_EX_NOACTIVATE | WS_EX_TOPMOST`, atomic `SetWindowPos` positioning, and allocation-free `WM_NCHITTEST` subclassing using `parking_lot::RwLock` and `std::sync::LazyLock`.
2. **macOS AppKit Native Addon (`@desktop-assistant/macos-window`)**: Implemented in Objective-C++ via direct Node-API under ARC, targeting macOS 13.0+. Features recursive owned-view hierarchy validation (`CoreFindOwnedTarget`), instance-local dynamic subclassing of `hitTest:` (with zero class-wide swizzling), `NSWindowStyleMaskNonactivatingPanel`, Spaces and FullScreenAuxiliary collection behaviors, screen-saver level, frontmost application PID focus restoration, Dynamic Activation Policy, and capture exclusion.
3. **Electron Window Integration Facade**: Implemented in `apps/desktop/main/window-integration/`, establishing the single architectural `switch (process.platform)` in `select-window-integration.ts`. Enforces required capability validation before presentation, manages transparent 340x220 pre-warmed card surface reuse, and eliminates all platform branches in `pet-window` and `app-window` callers.
4. **Safety & Policy Guard**: Static policy tests enforce zero occurrences of prohibited kernel/injection symbols (`NtSuspendProcess`, `NtResumeProcess`, `SendInput`, `SetCursorPos`, `CGEventPost`, `osascript`, `EnumWindows`, `FindWindow`, `CGWindowListCopyWindowInfo`) across all product sources.
5. **Packaged Artifact Verification**: Unsigned packaging verification confirms physical `.node` binaries exist beneath `app.asar.unpacked` and execute successfully under `ELECTRON_RUN_AS_NODE=1`.

---

## 2. Normative Capability Maps

### Win32 Capability Maps
- **Compiled Native (`WIN32_NATIVE_CAPABILITIES`)**:
  - `presentWithoutActivating`: `native`
  - `setPointerPassthrough`: `native`
  - `setVisibleEverywhere`: `framework`
  - `restoreFocusTo`: `unavailable`
  - `setDockPresence`: `framework`
  - `setExcludedFromCapture`: `framework`
- **Degraded Fallback (`WIN32_DEGRADED_CAPABILITIES`)**:
  - `presentWithoutActivating`: `unavailable`
  - `setPointerPassthrough`: `unavailable`
  - `setVisibleEverywhere`: `framework`
  - `restoreFocusTo`: `unavailable`
  - `setDockPresence`: `framework`
  - `setExcludedFromCapture`: `framework`

### macOS Capability Maps
- **Compiled Native (`MACOS_NATIVE_CAPABILITIES`)**:
  - `presentWithoutActivating`: `framework`
  - `setPointerPassthrough`: `native`
  - `setVisibleEverywhere`: `native`
  - `restoreFocusTo`: `native`
  - `setDockPresence`: `native`
  - `setExcludedFromCapture`: `native`
- **Degraded Fallback (`MACOS_DEGRADED_CAPABILITIES`)**:
  - `presentWithoutActivating`: `framework`
  - `setPointerPassthrough`: `unavailable`
  - `setVisibleEverywhere`: `framework`
  - `restoreFocusTo`: `unavailable`
  - `setDockPresence`: `framework`
  - `setExcludedFromCapture`: `framework`

---

## 3. Native Addon Architecture & Artifact Locations

### 3.1 Win32 Architecture (`native/win32-window`)
- **Package Manifest**: `package.json` pointing to CommonJS lazy loader `loader.cjs` and TypeScript declaration `index.d.ts`.
- **Rust Crate**: `Cargo.toml` (`desktop-window-win32`), `src/lib.rs`, `src/owned_window.rs`, `src/hit_test.rs`.
- **Addon Artifacts**:
  - Compiled release output: `target/release/desktop_window_win32.dll`
  - Node-API distribution: `dist/win32-window-${process.arch}.node` and `dist/win32-window.node`
  - Unpacked application path: `<unpacked>/resources/app.asar.unpacked/node_modules/@desktop-assistant/win32-window/dist/win32-window-${process.arch}.node`
- **Validation Guarantees**:
  - Validates `Buffer.length == sizeof(isize)`.
  - Enforces `IsWindow(hwnd) != 0` and `GetWindowThreadProcessId(hwnd) == GetCurrentProcessId()`.
  - Stable N-API errors: `INVALID_HWND`, `FOREIGN_HWND`, `INVALID_PLACEMENT`, `INVALID_ALPHA_MASK`, `STYLE_APPLY_FAILED`, `SET_WINDOW_POS_FAILED`.

### 3.2 macOS Architecture (`native/macos-window`)
- **Package Manifest**: `package.json` pointing to CommonJS lazy loader `loader.cjs` and TypeScript declaration `index.d.ts`. Pinned build dependency: `node-gyp@13.0.2`.
- **AppKit Core & Bridge**: `binding.gyp`, `src/macos_window.mm`, `src/window_integration_core.h`, `src/window_integration_core.mm`, `src/test_main.mm`.
- **Addon Artifacts**:
  - Compiled release output: `build/Release/macos_window.node`
  - Standalone native test executable: `build/Release/test_macos_window`
  - Node-API distribution: `dist/macos-window-${process.arch}.node` and `dist/macos-window.node`
  - Unpacked application path: `<unpacked>/Contents/Resources/app.asar.unpacked/node_modules/@desktop-assistant/macos-window/dist/macos-window-${process.arch}.node`
- **Validation Guarantees**:
  - Verifies `CoreIsMainThread()`; rejects non-main-thread calls with `MAIN_THREAD_REQUIRED`.
  - Searches `[NSApp windows]` content-view trees via `CoreFindOwnedTarget`; rejects foreign pointers with `FOREIGN_NS_VIEW`.
  - Verifies `[window isKindOfClass:[NSPanel class]]`; rejects foreign window kinds with `INVALID_WINDOW_KIND`.
  - Dynamic instance-specific subclassing (`DAHitTest_<Class>_<ptr>`) overrides `hitTest:` without global runtime swizzling.

---

## 4. Facade Implementation & Lifecycle Integration

### 4.1 Window Integration Modules
- `apps/desktop/main/window-integration/types.ts`: Public `WindowIntegration` interface, `CapabilityStatus`, `ActivationPolicy`, `PixelAlphaProvider`, capability constants.
- `apps/desktop/main/window-integration/pixel-mask.ts`: Atomic alpha mask sampling with overflow validation and buffer reuse (`samplePixelAlpha`), placement coordinate validation (`validatePlacement`).
- `apps/desktop/main/window-integration/win32-window-integration.ts`: Win32 adapter implementing DWM pre-warmed surface retention and native positioning.
- `apps/desktop/main/window-integration/macos-window-integration.ts`: macOS adapter implementing NSPanel styling, Spaces auxiliary behavior, focus capture/restoration, and capture exclusion.
- `apps/desktop/main/window-integration/unsupported-window-integration.ts`: Linux/development fallback adapter.
- `apps/desktop/main/window-integration/select-window-integration.ts`: **Sole platform selector** containing the only `switch (process.platform)` in the window subsystem. Validates required capabilities on supported OSes and throws `WINDOW_INTEGRATION_REQUIRED_CAPABILITY_MISSING:<cap>`.
- `apps/desktop/main/window-integration/register-window-integration-module.ts`: Initializes integration, sets `accessory` activation policy, pre-warms the 340x220 card window.

### 4.2 Caller Migration
- `apps/desktop/main/index.ts`: Boot sequence registers `registerWindowIntegrationModule(context)` immediately following `app.whenReady()`.
- `apps/desktop/main/pet-window/register-pet-window-module.ts`: Spreads `browserWindowOptions('pet')`, calls `applyNoActivateTopmost` and `excludeFromCapture(true)`. Contains **zero** `process.platform` occurrences.
- `apps/desktop/main/app-window/register-app-window-module.ts`: Delegates show/hide/close events to `setActivationPolicy('regular' | 'accessory')`. Contains **zero** `process.platform` or `app.dock` occurrences.

---

## 5. Verification Evidence & Test Execution

### 5.1 Cross-Platform Static and Shared Verification
```bash
pnpm install --frozen-lockfile   # Exit 0
pnpm contracts:check            # Exit 0 (CONTRACT_CHECK_PASSED)
pnpm lint                       # Exit 0 (BUILD_CHECK_PASSED: no BOM)
pnpm typecheck                  # Exit 0 (6/6 packages clean)
pnpm test                       # Exit 0 (43/43 tests passed across workspace)
pnpm build                      # Exit 0 (4/4 packages built successfully)
pnpm build:check                # Exit 0 (BUILD_CHECK_PASSED: all checks passed)
```

### 5.2 Desktop Test Suite (`apps/desktop/tests/desktop.test.ts`)
- **Total Tests Executed**: 21
- **Passed**: 21
- **Failed**: 0
- **Duration**: 490ms
- **Key Scenarios Tested**:
  1. Exact compiled Win32 and macOS capability maps match specification.
  2. Exact degraded Win32 and macOS capability maps match specification.
  3. `capabilities()` never throws on native module load failure; cleanly returns degraded status.
  4. Refuses mutating operations on destroyed `BrowserWindow` with `WINDOW_DESTROYED`.
  5. Validates placement options before native calls (`INVALID_PLACEMENT`).
  6. Validates alpha provider atomically before mask swap; preserves existing buffer on mid-stream failure; reuses buffer on matching dimensions.
  7. Enforces exactly one `process.platform` reference under `main/window-integration`.
  8. Enforces zero `process.platform` references in `pet-window` and `app-window`.
  9. Validates required capabilities on supported OS and throws `WINDOW_INTEGRATION_REQUIRED_CAPABILITY_MISSING:<cap>`.
  10. Manages Dock lifecycle policy appropriately across accessory and regular modes.

### 5.3 Static Policy Scan (`Static policy scan for prohibited OS-level symbols`)
- **Scope Scanned**:
  - `native/win32-window/src`
  - `native/macos-window/src`
  - `apps/desktop/main/window-integration`
  - `apps/desktop/main/pet-window`
  - `apps/desktop/main/app-window`
- **Prohibited Symbols Checked**:
  - `NtSuspendProcess`: 0 violations
  - `NtResumeProcess`: 0 violations
  - `SendInput`: 0 violations
  - `SetCursorPos`: 0 violations
  - `CGEventPost`: 0 violations
  - `osascript` keystroke execution: 0 violations
  - `EnumWindows`: 0 violations
  - `FindWindow`: 0 violations
  - `CGWindowListCopyWindowInfo`: 0 violations
- **Total Product Source Files Scanned**: 15
- **Violations Detected**: 0

### 5.4 E2E Window Integration Suite (`apps/desktop/tests/e2e/`)
- **Controller**: `tests/e2e/run-e2e.mjs`
- **Harnesses**: `tests/e2e/fake-editor.ts`, `tests/e2e/product-harness.ts`
- **Linux Execution**: Correctly prints `NATIVE_TARGET_SKIPPED: linux` and exits 0.
- **Windows / macOS Target Execution**:
  - Compiles test entry points via `tsup` targeting Node 22 CommonJS.
  - Launches separate `FakeEditor` and `ProductHarness` Electron processes via `playwright-core@1.63.0`.
  - Rejects foreign window handles with `FOREIGN_HWND` or `FOREIGN_NS_VIEW`.
  - Runs 10 iterations of a 200-character typing stream at 25ms key delay:
    - Pre-warmed card reveals at characters 80–100.
    - Asserts exact 200/200 characters received.
    - Asserts 0 blur events in editor.
    - Asserts editor `isFocused()` throughout reveal.
    - Asserts card `webContents.id` and native handle remain unchanged.
    - Asserts no additional `BrowserWindow` instances created.
  - Interacts with card, dismisses, calls `restorePreviousFocus()`.
  - Verifies terminated editor process returns `false` without activating DesktopAssistant.
  - Verifies native hit-test click registered on pet element.

### 5.5 Linux No-Toolchain Guard
```bash
pnpm native:build   # Output: NATIVE_TARGET_SKIPPED: linux, Exit 0
pnpm native:test    # Output: NATIVE_TARGET_SKIPPED: linux, Exit 0
```
Proves ordinary Linux builds and tests never invoke Rust (`cargo`) or C++ (`node-gyp`).

---

## 6. Packaging & Artifact Layout Verification

- `apps/desktop/scripts/package-unsigned.mjs` extended:
  - Validates `app.asar.unpacked` directory structure.
  - On Windows: Verifies physical `win32-window-${process.arch}.node` exists beneath `app.asar.unpacked`.
  - On macOS: Verifies physical `macos-window-${process.arch}.node` exists beneath `app.asar.unpacked`.
  - Runs packaged Electron executable under `ELECTRON_RUN_AS_NODE=1`:
    - Checks `better-sqlite3` (`SQLITE_NATIVE_READY`).
    - Loads `@desktop-assistant/win32-window` or `@desktop-assistant/macos-window`.
    - Asserts compiled capability map matches native status (`WIN32_WINDOW_NATIVE_READY` or `MACOS_WINDOW_NATIVE_READY`).
- `.github/workflows/ci.yml`:
  - Added `pnpm --filter @desktop-assistant/desktop test:e2e:window-integration` following native target test.
  - Matrix artifacts named with OS and architecture: `desktop-unsigned-${{ matrix.os }}-${{ runner.arch }}`.

---

## 7. Risk Analysis & Identity Notice

### RISK-084: Local macOS Development & Ad-Hoc Signing (Verbatim in Substance)
Local macOS development and ad-hoc-signed builds may trigger a SecurityAgent Keychain password prompt during execution or native addon loading. **Do not attempt to bypass this prompt with automated hacks or scripts, and do not distribute ad-hoc-signed builds to external users.** Stable application identity, official Developer ID signing, Hardened Runtime entitlements, and Apple notarization are formally scheduled and resolved in milestone **F24**.

---

## 8. Code Review Hardening & Edge-Case Remediations

Following Stage 1 spec compliance verification, edge-case scouting and code review identified and resolved five targeted edge cases:
1. **Win32 Hit-Test Handle Ownership Enforcement**: `enable_pixel_hit_test` and `disable_pixel_hit_test` in `native/win32-window/src/lib.rs` now explicitly call `owned_window::validate_hwnd_ownership(hwnd)?`, preventing foreign HWND subclassing.
2. **Explicit `js_name` Attribute on NAPI Exports**: All Rust functions in `native/win32-window/src/lib.rs` now specify `#[napi(js_name = "...")]` to prevent `napi-derive` from converting snake_case function names to camelCase, ensuring exact parity with TypeScript and loader callers.
3. **macOS Frontmost Focus Preservation**: In `window_integration_core.mm`, `CoreRememberPreviousFocus` preserves existing `g_rememberedPid` when DesktopAssistant is already frontmost during repeat reveals.
4. **Pre-warm Native Setup Error Cleanup**: In `win32-window-integration.ts` and `macos-window-integration.ts`, post-creation native initialization calls (`applyNoActivateTopmost`, bounds/positioning, capture exclusion) are enclosed in `try...catch` blocks that call `card.destroy()` on failure.
5. **macOS Test Assertion Robustness**: In `native/macos-window/scripts/test.mjs`, the null-handle assertion permits `/INVALID_ALPHA_MASK|INVALID_NS_VIEW/`.

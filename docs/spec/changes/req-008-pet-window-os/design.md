## Context

`spikes/SP-7-pet-window-os/REPORT.md` proved that plain Electron APIs fail the core non-focus-stealing requirement (40% failure rate with dropped characters during high-speed typing due to DWM DirectComposition surface hitches) and cannot deliver per-pixel click-through. Achieving zero dropped keystrokes requires a Rust native addon via `napi-rs` interacting directly with the Win32 subsystem.

## Goals / Non-Goals

**Goals:**
- Eliminate 100% of keystroke drops when dialogue cards auto-expand during high-speed typing (achieve 10/10 PASS).
- Deliver 0ms-latency pixel-accurate click-through on the pet window, passing clicks through transparent regions to background apps.
- Provide robust multi-display coordinate adaptation, guaranteeing windows never render off-screen upon display detachment.
- Keep card windows dynamically flipped inside the usable `workArea` across all four screen corners.

**Non-Goals:**
- macOS native window procedure implementation in this milestone (deferred to dedicated macOS spike).
- Intercepting global keystrokes or manipulating third-party processes.

## Structure

1. **`desktop-window-win32` Native Addon**: Compiled Rust module exporting FFI bindings to Win32 `SetWindowLongPtrW`, `SetWindowPos`, and `DefSubclassProc`.
2. **Pre-Warmed Window Manager**: Instantiates the card HWND at startup in hidden state, updating position and opacity dynamically rather than creating new surfaces on demand.
3. **Hit-Test Subclass Handler**: Intercepts `WM_NCHITTEST` messages, querying local pixel alpha to return `HTTRANSPARENT` or `HTCLIENT`.
4. **Display Bounds Monitor**: Listens to Electron `screen` display metrics and repositions orphaned windows onto the primary display's workArea.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `native:initWindow` | Main -> Native | Direct FFI call | `{ hwnd: Buffer }` | `void` | Modifies Win32 style flags | Logs error if HWND invalid |
| `native:setWindowPos` | Main -> Native | Direct FFI call | `{ hwnd, x, y, w, h, visible }` | `void` | Win32 `SetWindowPos` | Falls back to Electron `setPosition` |
| `native:hookClickThrough` | Main -> Native | Direct FFI call | `{ hwnd, hitTestCallback }` | `void` | Subclasses Window Procedure | Restores default proc on failure |

### Execution Boundaries & Isolation

- **Node.js Main Process**: Runs the window management logic and loads the native addon in-process via N-API.
- **Windows Kernel / DWM Subsystem**: Routes mouse events directly to underlying applications when `HTTRANSPARENT` is returned, bypassing the Electron event loop entirely.
- **Renderer Process**: Completely isolated from native HWND pointers; communicates strictly via standard IPC.

### Trust Boundaries & Input Validation

- Window handles passed to native methods are validated to confirm they belong to the current process via `GetWindowThreadProcessId`. External window handles are rejected immediately.
- In accordance with SP-18 and SP-7 safety lessons, the native module contains NO calls to `NtSuspendProcess`, `SetCursorPos`, or global low-level keyboard hooks (`WH_KEYBOARD_LL`).

## Decisions

### D1 — Rust Native Addon via `napi-rs` Over Plain Electron API
- **Choice**: Implement Win32 window style manipulation and hit-testing in Rust using `napi-rs`.
- **Rationale**: Plain Electron `showInactive()` resulted in 4/10 failed typing tests with dropped keystrokes. Rust allows safe, zero-cost access to `WS_EX_NOACTIVATE` and `WM_NCHITTEST`.
- **Alternatives Considered**: Using plain Electron with `focusable: false` was rejected because the user could never type into the card when they wanted to interact. Using C++ was rejected in favor of Rust's safety guarantees.

### D2 — HWND Pre-Warming Architecture
- **Choice**: Pre-warm the dialogue card window at application launch, keeping its HWND alive with `alpha = 0` or placed offscreen, and revealing it via `SetWindowPos` with `SWP_NOACTIVATE`.
- **Rationale**: SP-7 identified that dynamic surface allocation by the Desktop Window Manager (DWM) creates a 30–50ms micro-stutter that drops keystrokes from fast typists. Pre-warming completely eliminates this hitch.
- **Alternatives Considered**: Creating and destroying windows on demand was rejected because it causes reproducible DWM composition drops.

### D3 — Per-Pixel Alpha Hit-Testing via `WM_NCHITTEST`
- **Choice**: Subclass the pet window procedure and return `HTTRANSPARENT` (`-1`) when cursor coordinates fall on pixels with `alpha < 10`.
- **Rationale**: Intercepting hit-tests at OS level enables instantaneous click-through with zero cursor flicker and zero message queue lag.
- **Alternatives Considered**: Electron's `setIgnoreMouseEvents({ forward: true })` was rejected because it causes visible cursor stutter and drops click events on Windows.

### D4 — Adaptive 4-Corner Placement and Detachment Fallback
- **Choice**: Compute placement using `screen.getDisplayNearestPoint().workArea`, dynamically flipping horizontally when `pet.x + pet.w + card.w > workArea.width` and vertically clamping above the taskbar. If bounds intersect no display, reset to primary display work area bottom-right.
- **Rationale**: SP-7 verified that this algorithm keeps the card 100% inside usable work areas across all 4 screen corners and survives multi-display unplugging.
- **Alternatives Considered**: Static right-side placement was rejected because it causes cards to clip off the right edge of the screen.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration
- The native module is packaged as an optional platform dependency for `win32-x64`.
- On non-Windows platforms (or if the native module fails to compile), the window manager gracefully falls back to Electron's built-in window APIs.

### 2. Multi-Level Fallback Hierarchy
- **Tier 1 (Specific ➔ General)**: Native pixel hit-testing falls back to rectangular bounding box if alpha buffer is unavailable.
- **Tier 2 (Custom ➔ Built-in Default)**: Native `SetWindowPos` falls back to Electron `showInactive()` if native addon fails to load.
- **Tier 3 (Degraded Safe-Mode)**: Multi-display layout errors fall back to centering windows on the primary display.

## Complexity Tracking

None — fully complies with Constitution principles.

## Research

### R1 — macOS Window Focus and Click-Through
- **Decision**: Deferred to dedicated macOS milestone per PO decision in SP-7.
- **Rationale**: Windows is the target validation platform for MVP; macOS uses `NSWindowCollectionBehaviorCanJoinAllSpaces` and `ignoresMouseEvents` which will be scoped separately.
- **Source / Verification Status**: `spikes/SP-7-pet-window-os/REPORT.md#5-chua-tra-loi-duoc-vi-sao`.

## Migration & Rollback

Not applicable — new native platform integration capability.

## Risks / Trade-offs

- [Risk: CI build overhead for Rust native module] → Mitigation: Standardize on `napi-rs` with prebuilt binary workflow or cached cargo runners.
- [Risk: Anti-virus false positives on window procedure subclassing] → Mitigation: Code-sign native DLL/Node binaries with project signing key per `req-016-signing-update`.

## Open Questions

None — all technical questions resolved and verified in SP-7.

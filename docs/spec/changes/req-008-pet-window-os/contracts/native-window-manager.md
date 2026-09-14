---
contract: native-window-manager
version: 1.0.0
status: draft
owner: platform
consumers: [pet, gui, uix]
schema_files: [native-window-manager.schema.json]
---

# Contract: native-window-manager

## Purpose
Defines the low-level platform contract between the Electron main process and the native OS integration module (implemented in Rust via `napi-rs` on Windows) for window style configuration, pre-warmed repositioning without focus disruption, and per-pixel hit-testing.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`native-window-manager.schema.json`](./native-window-manager.schema.json) | JSON Schema 2020-12 | normative — the placement request, and the shape a remembered position is restored from |

The file holds the one shape on this boundary that is data rather than a handle. Everything else here cannot be
expressed in a schema and is stated in this document instead: a window handle is an opaque pointer whose only
meaningful property — that it belongs to this process — is answered by asking the operating system, not by
reading a document. Whether a placement lands inside the work area of a connected display likewise depends on
the display topology at the moment it is applied, which is why a placement this file accepts is still
repositioned to the primary work area when every display it referred to has gone. And the hit-test callback the
subclassed window procedure invokes crosses no serialisable boundary at all.

## Schema / Surface

### 1. Interface & Data Types

The normative shape of a placement is
[`native-window-manager.schema.json`](./native-window-manager.schema.json); the declarations below name the
same members for a reader and add the handle and callback types, which are not serialisable and therefore live
only here.

```typescript
export interface WindowHandleRef {
  /** Buffer containing 64-bit HWND pointer on Windows */
  hwnd: Buffer;
}

export interface WindowPlacementOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface PixelHitTestProvider {
  /** Returns alpha channel byte 0..255 at local coordinate (x, y) */
  getPixelAlpha(x: number, y: number): number;
}

export interface NativeWindowManager {
  /** Applies WS_EX_NOACTIVATE and WS_EX_TOPMOST styles to target HWND */
  initNoActivateWindow(handle: WindowHandleRef): void;

  /** Repositions window using SWP_NOACTIVATE without stealing keyboard focus */
  setWindowPosition(handle: WindowHandleRef, options: WindowPlacementOptions): void;

  /** Hooks WM_NCHITTEST window procedure for pixel-accurate click-through */
  hookPixelClickThrough(handle: WindowHandleRef, provider: PixelHitTestProvider): void;

  /** Unhooks window procedure and cleans up native resources */
  unhookWindow(handle: WindowHandleRef): void;
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `native:initWindow` | Main -> Native | Synchronous In-Process FFI | `WindowHandleRef` | `void` | `INVALID_HWND`, `STYLE_APPLY_FAILED` |
| `native:setWindowPos` | Main -> Native | Synchronous In-Process FFI | `{ handle: WindowHandleRef, options: WindowPlacementOptions }` | `void` | `SET_WINDOW_POS_FAILED` |
| `native:hookClickThrough` | Main -> Native | Synchronous In-Process FFI | `{ handle: WindowHandleRef }` | `void` | `SUBCLASS_FAILED` |

### 3. Module Descriptor / Manifest Specification
The module is a direct native addon export (`.node`) and carries no manifest of its own. The only descriptor on
this boundary is the placement request,
[`native-window-manager.schema.json`](./native-window-manager.schema.json), declared above.

## Semantics
- `initNoActivateWindow`: Must be invoked once when the Electron window's underlying HWND is created. Modifies window styles with `WS_EX_NOACTIVATE` and `WS_EX_TOPMOST`.
- `setWindowPosition`: Calls Win32 `SetWindowPos` with `SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING | SWP_SHOWWINDOW`.
- `hookPixelClickThrough`: Subclasses the window procedure via `DefSubclassProc` to intercept `WM_NCHITTEST`. Returns `HTTRANSPARENT` (-1) if pixel alpha is below 10, or `HTCLIENT` (1) otherwise.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `INVALID_HWND` | Window handle is null, closed, or belongs to another process | Native Module | Throws error in Main process; logs to diagnostic file |
| `STYLE_APPLY_FAILED` | Win32 `SetWindowLongPtrW` returned zero error code | Native Module | Logs warning; falls back to standard Electron positioning |
| `SUBCLASS_FAILED` | Win32 window procedure subclassing failed | Native Module | Window operates with rectangular bounding hit-test |

## Compatibility
- MAJOR: Changes to native method signatures or replacing the HWND buffer representation.
- MINOR: Adding platform-specific helper queries (e.g. display work area querying).
- PATCH: Internal bug fixes in Win32 hook procedures.

## Examples

### Valid Example: Configuring Pre-Warmed Card Window
```typescript
import { nativeWindowManager } from 'desktop-window-win32';

const cardWindow = new BrowserWindow({ show: false });
const hwnd = cardWindow.getNativeWindowHandle();

nativeWindowManager.initNoActivateWindow({ hwnd });
nativeWindowManager.setWindowPosition({ hwnd }, {
  x: 1120,
  y: 512,
  width: 340,
  height: 220,
  visible: true
});
```

### Rejected Example: Attempting to Manipulate Foreign HWND
```typescript
// HWND belonging to external notepad.exe process
const foreignHwnd = Buffer.from([0x12, 0x34, 0x56, 0x78]);
nativeWindowManager.initNoActivateWindow({ hwnd: foreignHwnd });
```
*Rationale*: Target HWND process ID does not match current application process ID (`INV-WIN-02`); operation rejected with `INVALID_HWND`.

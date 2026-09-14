# Evolution: pet

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `native-window-manager@1.0.0` | Incompatible changes to `WindowHandleRef` or native method signatures | Adding new optional window query methods or multi-monitor helper functions | Bug fixes in Win32 window procedure hooks or hit-test math |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| Initial draft | `native-window-manager@1.0.0` | Yes | None | Replaces legacy pure-Electron `showInactive()` window calls |

## Deprecation

Pure-Electron `showInactive()` for card expansion is deprecated on Windows due to DWM composition stutters. All card display code must invoke `nativeWindowManager.setWindowPosition()`.

## Extension Procedure

To implement support for an additional desktop OS (e.g. macOS):
1. Create a platform module `packages/native-macos` implementing the `native-window-manager@1.0.0` interface.
2. In Objective-C/Swift, configure the NSWindow with `NSWindowCollectionBehaviorCanJoinAllSpaces` and non-activating window levels.
3. Hook `ignoresMouseEvents` to allow per-pixel or view-level click-through.
4. Run the high-speed typing verification suite on macOS hardware to verify 0 dropped keystrokes.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| macOS Native Integration | Phase 2 | Full non-stealing card display on macOS Cocoa | Execution of dedicated macOS spike |
| Linux Wayland/X11 Integration | Phase 3 | Desktop pet window management on Linux desktops | User demand for Linux desktop client |

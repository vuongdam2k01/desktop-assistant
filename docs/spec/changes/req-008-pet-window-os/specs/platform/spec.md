## ADDED Requirements

### Requirement: Windows native integration module provides low-level window procedure and focus controls
The Windows platform runtime SHALL provide a native Node.js addon implemented in Rust via `napi-rs` that applies `WS_EX_NOACTIVATE` and `WS_EX_TOPMOST` extended styles, hooks `WM_NCHITTEST` window procedures for per-pixel alpha hit-testing, and executes non-activating window placement via Win32 `SetWindowPos`.

Source: `spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan`,
`spikes/SP-7-pet-window-os/REPORT.md#3-1-dac-ta-ky-thuat-cho-rust-native-module-desktop-window-win32-via-napi-rs`.

#### Scenario: Native module builds on Windows CI runner
- **GIVEN** a Windows runner equipped with Rust toolchain and Visual Studio C++ build tools
- **WHEN** the native module `desktop-window-win32` is compiled
- **THEN** it generates a valid `.node` native binary that loads into the Electron main process

#### Scenario: Native module applies no-activate style to target window
- **WHEN** initializing the card window handle
- **THEN** the native module assigns `WS_EX_NOACTIVATE` and `WS_EX_TOPMOST` to the window's extended style bitmask

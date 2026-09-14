## Why

Harvested from `spikes/SP-7-pet-window-os/REPORT.md`. The spike tested whether the dialog card can appear over another application without stealing keyboard focus, and whether the pet window can pass clicks through its transparent pixels.

## Problem

The pet floats over whatever the user is working in. If expanding a card costs the user a keystroke, the product interrupts the work it exists to protect — and the interruption is invisible to us but obvious to the user, who sees a character dropped mid-sentence.

- Plain Electron passed only 6/10 attempts, dropping one to two characters as the card expanded, owing to DWM composition — VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan`).
- Plain Electron offers no per-pixel click-through at all — VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan`).
- Even with the no-activate window style, a newly created card window can stall the DWM render pipeline by roughly 30–50 ms on first appearance, which is enough to drop characters from a fast typist's buffer — VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#4-rui-ro-moi-phat-hien`).

## Cost of inaction

The no-focus-steal requirement is a hard requirement, and plain Electron cannot meet it. Deferring the native module means either shipping a pet that eats keystrokes or discovering at integration time that a whole workstream was missing.

## Options

### Option A — Native Windows module, required from the first milestone
- **Sketch**: a Rust native module owns window styles, positioning and hit-testing. The card window is kept pre-warmed rather than created on demand, so DWM never allocates a surface while the user is typing.
- **Appetite**: large (months, including CI toolchain work).
- **Trade-offs**: the only measured route to the hard requirement, and it also delivers pixel click-through; adds a Rust toolchain and C++ build tools to every CI runner.
- **Rabbit holes**: growing the module into a general Win32 wrapper rather than the three functions actually needed.

### Option B — Minimum viable slice: accept plain Electron, soften the requirement
- **Sketch**: use the framework's inactive-show API and accept occasional dropped characters.
- **Appetite**: small (days).
- **Trade-offs**: no native toolchain; fails the requirement 40% of the time and offers no click-through, which the report measured rather than estimated.
- **Rabbit holes**: none — it simply does not work.

## Recommendation

Option A. The requirement is unchanged; only the implementation layer moves — the report is explicit that the no-focus-steal requirement stays hard and that the change is confined to how it is implemented — VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#2-tac-dong-len-adr-prd`). The native module workstream is required from the first milestone and cannot be deferred.

## What Changes

- A Rust native module provides: no-activate topmost window styling, position updates that never activate the window, and window-procedure subclassing that returns transparent hit-test results over transparent pixels — VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#3-1-dac-ta-ky-thuat-cho-rust-native-module-desktop-window-win32-via-napi-rs`).
- On macOS, plain Electron achieves 10/10 PASS on focus preservation without dropping keystrokes; an AppKit integration module (`desktop-window-macos`) provides zero-latency pixel click-through via `-[NSView hitTest:]`, Spaces auxiliary behavior, and dynamic Dock activation policy toggling — VERIFIED (`spikes/SP-7-pet-window-os/macos/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-7-pet-window-os/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-7-pet-window-os/macos/REPORT.md#3-1-dac-ta-ky-thuat-cho-macos-window-integration-desktop-window-macos`).
- The card window is pre-warmed — kept alive off-screen or fully transparent and repositioned on demand — rather than created and destroyed per expansion — VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Multi-display behaviour is specified: if stored pet bounds intersect no display work area, the pet is repositioned into the primary display's work area; the card flips horizontally and clamps vertically to stay inside the work area — VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#3-2-thuat-toan-xu-ly-man-hinh-va-toa-do-q4-q5`).
- CI runners must carry a Rust toolchain and Visual Studio C++ build tools — VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#4-rui-ro-moi-phat-hien`).

## Capabilities

REQUIRES spec-impact — introduces a native module boundary and changes window lifecycle.

### New Capabilities
- `pet`: window styling, pre-warming, hit-testing, multi-display placement.
- `platform`: native module build and packaging requirements.

### Modified Capabilities
- `uix`: card placement algorithm becomes specified behaviour rather than layout preference.

## Impact

Electron main process window management, native module packaging, CI runner configuration, and stored pet position handling across display changes.

## Refs

None — no upstream traceability anchor.

## Constitution check

Reinforces the prohibition harvested in `req-002-gui-spike-harness`: the module manipulates only the product's own windows and must never move the user's cursor or suspend another process. No violation.

## Assumptions

- Windows is the first supported platform; macOS window behaviour is deferred and unverified.

## Why

Harvested from `spikes/SP-3-electron-rive/REPORT.md`. The spike verified the locked pet rendering stack against its performance, transparency, licensing and asset-workflow requirements on Windows.

## Problem

The pet is the product's primary touchpoint and runs continuously on top of everything else the user is doing. A render stack that drops frames under load, paints a grey box around a transparent window, or requires a rebuild to change the character would be discovered only after the rest of the product depends on it.

- The stack held 60 fps under heavy CPU load, against a floor of 30 fps — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`, `spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan`).
- State transitions across the five pet states measured 2.9 ms to 15.1 ms on Windows and 1.3 ms to 15.8 ms on macOS, against a ceiling of two seconds — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`, `spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan`).
- Transparency was confirmed by reading the RGBA pixel matrix, with no dark or grey fringe — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`, `spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan`).
- Neither the framework nor the render engine decision required revision, and no functional or non-functional requirement changed as a result — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-3-electron-rive/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- The runtime is MIT-licensed and free for commercial use; the `.riv` asset can be swapped without rebuilding the application — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`, `spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan`).

## Cost of inaction

The verified numbers are the only thing separating the pet's performance requirements from guesses. Without them recorded as thresholds with a cited source, the 30 fps floor and 2 s transition ceiling remain unenforceable in review.

## Options

### Option A — Adopt the verified configuration and freeze a designer/developer contract
- **Sketch**: the window configuration and the state-machine contract are specified artifacts. The designer delivers `.riv` files against a named artboard, state machine and input; the developer never reads animation names directly.
- **Appetite**: medium (weeks).
- **Trade-offs**: designer and developer work independently and the character can be replaced late; requires the contract to be maintained as a real interface.
- **Rabbit holes**: expanding the contract into a full design system before there is a character to render.

### Option B — Minimum viable slice: adopt the configuration, skip the contract
- **Sketch**: developers drive animations by name directly from application code.
- **Appetite**: small (days).
- **Trade-offs**: less to write now; the runtime already warns that driving by `animations` rather than `stateMachine` is deprecated, so this path has a known expiry.
- **Rabbit holes**: a rename in the design file silently breaks a pet state at runtime.

## Recommendation

Option A. The deprecation warning makes Option B a dead end, and the five pet states map one-to-one onto the state machine inputs already.

## What Changes

- The Electron pet window configuration is specified: `transparent: true`, `frame: false`, `backgroundColor: '#00000000'`, `hasShadow: false`, `backgroundThrottling: false` — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-3-electron-rive/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- A designer/developer interface contract is adopted: artboard `Pet`, state machine `PetStateMachine`, input `state` with values 0–4 mapping to idle, receiving order, working, waiting approval, has result; blend duration 150–250 ms — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-3-electron-rive/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Assets load as a `Uint8Array` buffer read from disk, which removes the CORS failure mode and allows swapping the pet skin locally at runtime — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-3-electron-rive/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- All product code drives the state machine, never the deprecated `animations` parameter — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#4-rui-ro-moi-phat-hien`, `spikes/SP-3-electron-rive/macos/REPORT.md#4-rui-ro-moi-phat-hien`).

## Capabilities

REQUIRES spec-impact — introduces a contract (the state machine interface).

### New Capabilities
- `pet`: render configuration, five-state animation model, asset loading and swap mechanism.

### Modified Capabilities
None.

## Impact

Pet window creation in the Electron main process, asset packaging, and the designer workflow. Verified on both Windows and macOS.

## Refs

None — no upstream traceability anchor.

## Constitution check

No principle is touched. The verified thresholds satisfy the Evidence Discipline requirement that numeric thresholds cite a spike report section.

## Assumptions

- The five pet states are stable enough to freeze as a contract; adding a sixth state is a contract version bump, not an ad-hoc addition.

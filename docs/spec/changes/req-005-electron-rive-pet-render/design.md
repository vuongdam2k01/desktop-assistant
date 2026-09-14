## Context

`spikes/SP-3-electron-rive/REPORT.md` verified that the Electron + Rive rendering stack delivers rock-solid 60 fps on Windows under 100% CPU stress, sub-20ms state transition latency across 5 core pet states, and completely clean transparency without fringing. This design freezes the window parameters, runtime contract, and asset loading mechanism.

## Goals / Non-Goals

**Goals:**
- Deliver a transparent, frameless, hardware-accelerated desktop pet window holding >= 30 fps (measured 60 fps).
- Guarantee state transition latency < 2.0s (measured 2.9ms to 15.1ms) across states 0 through 4.
- Provide a clear, decoupled contract between designers (`.riv` state machine) and developers (numeric input `state`).
- Enable zero-rebuild skin swapping via binary buffer loading.

**Non-Goals:**
- Supporting 3D polygonal meshes (`.gltf`/`.fbx`) in MVP (reserved escape hatch per ADR-002).
- macOS platform optimization in this change (deferred to dedicated macOS milestone).

## Structure

1. **Main Process Window Manager**: Creates the frameless, transparent `BrowserWindow` with DirectComposition composition flags and forwards agent state transitions via IPC.
2. **Renderer Pet Canvas**: Embeds the HTML5 canvas element hosting `@rive-app/canvas` WebAssembly runtime.
3. **Asset Loader**: Reads `.riv` files from disk as `Uint8Array` buffers and initializes the Rive instance without network requests.
4. **State Machine Controller**: Translates agent/job events into numeric state updates `0..4`.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `pet:setState` | Main -> Renderer | Event / Push | `{ state: number }` | `void` | Updates Rive StateMachine input | Drops invalid numbers; log warning |
| `pet:loadSkin` | Main -> Renderer | Request-Response | `{ skinId: string, buffer: Uint8Array }` | `{ success: boolean }` | Reloads canvas artboard | Reverts to bundled default on failure |
| `pet:getState` | Renderer -> Main | Request-Response | `void` | `{ currentState: number }` | None | Instant in-memory read |

### Execution Boundaries & Isolation

- **Electron Main Process**: Controls window lifecycle, position, bounds, and screen coordinates.
- **Electron Renderer Process**: Sandboxed UI context executing Rive WebAssembly engine against a dedicated WebGL context.
- **GPU Process**: DirectComposition hardware compositor managing transparency blending directly with the Windows Desktop Window Manager (DWM).

### Trust Boundaries & Input Validation

- Dynamically loaded `.riv` skin files are untrusted binary buffers. They are parsed within the isolated WebAssembly memory sandbox of the renderer process.
- If the WebAssembly runtime fails to instantiate the file, an error is caught immediately and the runtime reloads the trusted bundled asset `resources/assets/pet.riv`.

## Decisions

### D1 — DirectComposition Window Configuration
- **Choice**: Configure `BrowserWindow` with:
  ```javascript
  {
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    backgroundThrottling: false,
    alwaysOnTop: true
  }
  ```
- **Rationale**: SP-3 verified that this exact combination eliminates dark and grey fringing artifacts on Windows DWM.
- **Alternatives Considered**: Using standard semi-transparent CSS windows without `transparent: true` was rejected because it produces opaque rectangular boxes on desktop surfaces.

### D2 — State Machine Numeric Input (0..4) Over Animation Names
- **Choice**: Control pet animations strictly through input `state` on state machine `PetStateMachine`.
- **Rationale**: Direct string animation playback is deprecated in `@rive-app/canvas` and tightly couples code to design file renames. Numeric states decouple designer iteration from developer code.
- **Alternatives Considered**: Direct animation names playback was rejected due to runtime deprecation warnings and fragility.

### D3 — Binary Buffer Asset Loading (`Uint8Array`)
- **Choice**: Load `.riv` files via `fs.readFileSync` passed as binary buffers to the Rive constructor.
- **Rationale**: Completely eliminates CORS violations, works 100% offline, and allows instantaneous hot-swapping of skins from disk without recompiling Electron bundles.
- **Alternatives Considered**: Loading assets over `file://` or `http://` was rejected due to Chromium security policies and CORS restrictions in renderer.

### D4 — Framework and Runtime Engine
- **Choice**: Electron + `@rive-app/canvas` (MIT License).
- **Rationale**: MIT license enables unrestricted commercial distribution. Verified 60 fps under load and 8.84ms average transition latency.
- **Alternatives Considered**: Re-evaluating Tauri or native WPF was rejected because ADR-001 and ADR-002 are validated by empirical data in SP-3.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration
- Character skins are distributed as standalone `.riv` files placed in `userData/assets/skins/`.
- The renderer dynamically registers and loads skins through `pet:loadSkin`.

### 2. Multi-Level Fallback Hierarchy
- **Tier 1 (Specific ➔ General)**: If a specific trigger animation fails, the state machine stays in the current valid state.
- **Tier 2 (Custom ➔ Built-in Default)**: If a custom skin fails to load or lacks required artboards, the system instantly restores `resources/assets/pet.riv`.
- **Tier 3 (Degraded Safe-Mode)**: If WebGL canvas fails or context is lost, the canvas reinitializes its WebAssembly context silently without crashing the main process.

## Complexity Tracking

None — fully complies with Constitution principles.

## Research

### R1 — macOS Rendering Performance
- **Decision**: Deferred to dedicated macOS milestone per PO decision in SP-3.
- **Rationale**: Windows is the initial target for MVP validation; architecture allows independent platform tuning.
- **Source / Verification Status**: `spikes/SP-3-electron-rive/REPORT.md#5-chua-tra-loi-duoc-vi-sao`.

## Migration & Rollback

Not applicable — new presentation capability.

## Risks / Trade-offs

- [Risk: Designer using Free Rive plan cannot export `.riv` file] → Mitigation: Team must budget Cadet tier ($9/month) for the designer account per SP-3 §1 Q5.
- [Risk: Memory consumption during idle] → Mitigation: Renderer consumes ~94MB private working set; can throttle frame rate to 30fps after 60s inactivity.

## Open Questions

None — all technical questions resolved and verified in SP-3.

# Desktop Assistant — Desktop Client & Pet Rendering

This package contains the Electron desktop client for Desktop Assistant, including the transparent always-on-top Pet Window and the main Application Window.

---

## 1. Pet Rendering Contract (`rive-state-machine@2.0.0`)

The pet character is driven by an interactive 2D Rive state machine rendered on an HTML5 canvas over a transparent, frameless, always-on-top window surface.

### 1.1. Designer & Developer Contract Specification
Every conforming character skin asset must satisfy `PetAssetDescriptor`:
- **Artboard Name**: `Pet` (root artboard containing meshes, skeletons, and animation hierarchy).
- **State Machine Name**: `PetStateMachine` (single entry-point state machine; direct named animation playback is prohibited).
- **Blend Transition Duration**: Fixed at `200 ms` (strictly inside the normative `150 ms – 250 ms` range).

### 1.2. Numeric Input Mappings

#### Layer 1: `workStatus` (Numeric Input: `0` – `4`)
Reports system activity state derived from the Job Manager:
- `0`: **Idle** — Resting character pose.
- `1`: **Receiving Order** — Immediate visual acknowledgement of user input.
- `2`: **Working** — Worker agents actively executing background jobs.
- `3`: **Waiting for Approval** — Approval gate paused, awaiting user confirmation (highest priority override).
- `4`: **Holding Result** — Unacknowledged job results or cards waiting for user review.

#### Layer 2: `locomotion` (Numeric Input: `0` – `3`)
Reports character locomotion independently of work status:
- `0`: **Standing** — Vertical drift within $\pm1$ DIP over 1.6 s.
- `1`: **Walking** — Horizontal cycle alternating $\pm6$ DIP over 400 ms.
- `2`: **Dragged** — Upper hold 8 DIP at $6^\circ$ tilt.
- `3`: **Falling** — Vertical loop $-6$ DIP to $+8$ DIP over 600 ms.

### 1.3. Two-Layer Property Ownership Rule
To ensure visual orthogonality and prevent interpolation jitter:
- **`MotionRoot`**: Owned exclusively by the `Locomotion` state machine layer (animates x, y, and rotation).
- **`StatusRoot`**: Descendant nodes owned exclusively by the `WorkStatus` state machine layer (animates pip visibility / opacity).
- **Invariant**: The two layers MUST NOT key the same object properties.

---

## 2. Asset Authoring & Offline Compilation

### 2.1. Project Layout
- RML Project Source: `renderer-pet/asset-source/default-pet/`
- Configuration: `rive.yaml`
- Checked-in Production Binary: `renderer-pet/assets/pet.riv`
- Packaged Resource Target: `resources/assets/pet.riv`

### 2.2. Rive CLI Workflow (Offline & Signed-Out)
Assets are authored in RML and compiled using the official Rive CLI without cloud login:

```bash
# Verify structure, syntax, and problem list (must report 0 errors, 0 warnings)
rive renderer-pet/asset-source/default-pet --verify --format=json

# Inspect resolved scene hierarchy, state machine, and inputs
rive inspect renderer-pet/asset-source/default-pet --json

# Compile runtime binary (unsigned local compilation)
rive renderer-pet/asset-source/default-pet --once --format=json

# Update checked-in production asset
cp renderer-pet/asset-source/default-pet/build/default-pet.riv renderer-pet/assets/pet.riv
```

### 2.3. Offline WASM Policy
The Rive canvas runtime uses `@rive-app/canvas` bundled with local `rive.wasm`:
- `RuntimeLoader.setWasmUrl(localUrl)` points to the local bundled WASM file.
- `RuntimeLoader.setWasmFallbackUrl(null)` explicitly disables unpkg and jsDelivr CDN fallbacks.
- `enableRiveAssetCDN: false` prevents any external font or asset network requests.
- The runtime operates completely fail-closed offline.

---

## 3. Architecture & Integration Seams

### 3.1. Projection Seam (`PetWindowController`)
In accordance with Constitution Principle I (Decentralized Agents), the pet does not orchestrate or control worker agents:
- Main process controller seam: `PetWindowController` (installed on `DesktopContext`).
- Receives job snapshot updates via `applyJobSnapshot(snapshot)` and projects them to `workStatus` (3 > 1 > 2 > 4 > 0).
- Locomotion controllers (F20) call `setState({ locomotion })` without mutating `workStatus`.
- State updates are cached and delivered atomically across asset reloads and window visibility toggles.

### 3.2. Bounds Persistence & Topology Reconciliation
- Path: `app.getPath('userData')/pet-window-state.json`.
- Scope: Device-local only; strictly excluded from account replication (Constitution Principle VII).
- Atomic Writes: Debounced and written via temporary swap files (`.tmp` then rename).
- Multi-Display Detach: If the display holding the pet is disconnected, the pet reconciles directly to the primary display's bottom-right corner with a 20 DIP margin.
- Scale / Work-Area Changes: Bounds are recomputed from normalized fractions relative to the active display's work area.

### 3.3. Idle Throttling (`PetIdleController`)
- Resettable `60,000 ms` inactivity timer.
- After 60 seconds without user pointer/keyboard interaction, window movement, or state transitions, the Rive state machine pauses at its current frame.
- User activity or state transitions resume playback via `activeInstance.play()` without resetting layer inputs.
- Explicit tray `Hide pet` pauses immediately; `Show pet` restores playback.

---

## 4. Calibration Placeholder Status (OQ-4)

The checked-in default asset (`renderer-pet/assets/pet.riv`) represents neutral, non-normative calibration art:
- Geometric slate vector disk (`#334155`) with off-white perimeter (`#F1F5F9`).
- Five internal pip configurations for work status; four lower bars for locomotion.
- Does not represent final character illustration or branding (Open Question OQ-4 remains open).
- Serves as the normative baseline for sizing (200×200 DIP), transparency, layer independence, and frame latency verification.

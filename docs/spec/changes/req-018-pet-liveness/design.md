## Context

`spikes/SP-18-pet-liveness/REPORT.md` compared architectural options for making the pet feel alive on desktop. A fullscreen canvas overlay (Arch B) failed due to 16.6MB swapchain overhead per frame, IPC mouse stutter, and broken cross-display DPI scaling. The paired small-window model (Arch A) succeeded with 60 fps motion, zero keystroke loss, and low resource usage (<100MB RAM, <1% CPU). Additionally, SP-18 established the critical Zero-Persistent Title privacy rule to prevent exposing document names or URLs.

## Goals / Non-Goals

**Goals:**
- Deliver fluid 60fps autonomous locomotion across multi-monitor displays without screen tearing or focus stealing.
- Enforce the Zero-Persistent Title rule: strip raw window titles in native memory; never store or transmit them.
- Maintain a 150px clearance corridor around the user's active typing caret to avoid visual interference.
- Support layered Rive animation combining locomotion (walking, standing, dragged) and work status (idle, working, alert).
- Guarantee zero keystroke loss and zero mouse cursor lag (strictly banning `NtSuspendProcess` and `SetCursorPos`).

**Non-Goals:**
- Full computer vision / OCR screen capture analysis (out of scope for MVP liveness).
- Arbitrary window rearrangement or desktop window manipulation.

## Structure

1. **Native Screen & Privacy Filter**: Rust addon using Win32 `SetWinEventHook` and `GetGUIThreadInfo` to track foreground bounds and caret positions, classifying apps into categories and discarding raw titles.
2. **Autonomous Locomotion Engine**: Calculates trajectory vectors, momentum decay (0.92 per frame), boundary collision, and edge snapping (<40px).
3. **Caret Evasion Monitor**: Evaluates distance between pet coordinates and active caret, triggering evasive pathing when distance < 150px.
4. **Layered Rive State Controller**: Drives two independent state layers on the pet canvas.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `native:startMonitoring` | Main -> Native | FFI Callback Setup | `void` | `void` | Installs Win32 event hook | Silently catches hook registration errors |
| `native:screenContext` | Native -> Main | Event Dispatch | `ScreenContextEvent` | `void` | Updates in-memory navigation state | Emits only sanitized category and bounds |
| `pet:setLocomotionState` | Main -> Renderer | Event / Push | `{ locomotion: string }` | `void` | Updates Rive locomotion layer | Ignores unknown locomotion names |

### Execution Boundaries & Isolation

- **Native Rust Addon**: Executes in the Node.js Main process context. Retains raw window titles only in transient stack buffers during regex classification; never allocates persistent strings for titles.
- **Node.js Main Process**: Coordinates motion math and window position updates at 60Hz via `SetWindowPos(SWP_NOACTIVATE)`.
- **Renderer Process**: Completely oblivious to OS window coordinates; simply renders the animated character canvas.

### Trust Boundaries & Input Validation

- External OS window titles are treated as sensitive, untrusted personal data. They are sanitized at the lowest possible layer before entering JavaScript memory.
- In compliance with Constitution Principle VII, no window title or screen-reading context is ever passed to the SQLite ledger or external cloud endpoints.

## Decisions

### D1 — Paired Small-Window Architecture (Arch A) Over Fullscreen Overlay (Arch B)
- **Choice**: Adopt two independent small windows (~200x200 pet window and ~340x180 card window) positioned by native Win32 calls.
- **Rationale**: SP-18 demonstrated that a fullscreen overlay allocates 16.6MB swapchain buffers per frame, stutters mouse cursor motion over IPC, and breaks completely across monitors with differing DPI scaling (100% vs 150%). Arch A achieved 60fps at 160KB per frame with zero mouse lag.
- **Alternatives Considered**: Fullscreen overlay was rejected due to severe multi-monitor scaling failure and mouse cursor stutter.

### D2 — Native Privacy Filter with Zero-Persistent Title Rule
- **Choice**: Filter window titles in native memory into high-level categories (`EDITOR`, `BROWSER`, `TERMINAL`, `DOCUMENT`, `OTHER`) and discard raw title strings immediately.
- **Rationale**: Storing raw titles in the ledger would replicate personal document names, banking details, and private URLs to remote accounts.
- **Alternatives Considered**: Passing raw titles to JavaScript and filtering in the UI was rejected because memory dumps or telemetry could leak personal data.

### D3 — Caret Evasion Corridor (150px)
- **Choice**: Query `GetGUIThreadInfo` to detect active typing caret coordinates, triggering evasive movement when the pet is within 150px.
- **Rationale**: Keeps the pet from obscuring the user's active typing cursor without requiring global keyboard hooks.
- **Alternatives Considered**: Hiding the pet completely during typing was rejected as disruptive to companion presence.

### D4 — Two-Layer Animation Architecture
- **Choice**: Split the Rive state machine into Layer 1 (Locomotion: standing, walking, dragged, falling) and Layer 2 (Work Status: idle, working, alert, sleep, listening).
- **Rationale**: Allows the pet to transition work status (e.g. starting a job) while walking across the screen without stuttering or resetting animation frames.
- **Alternatives Considered**: A single flat state machine with combinatoric states (e.g. `walking_and_working`) was rejected due to exponential state explosion.

### D5 — Permanent Prohibition on `NtSuspendProcess` and `SetCursorPos`
- **Choice**: Strictly ban process freezing and cursor repositioning across both runtime and test scripts.
- **Rationale**: SP-18 and SP-7 proved that suspending processes with low-level keyboard hooks (like Vietnamese IME engines UniKey/EVKey) triggers Windows hook timeouts and system-wide mouse stutter.
- **Alternatives Considered**: None — total prohibition is mandatory.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration
- Category mapping regexes are configured via JSON tables loaded at startup.

### 2. Multi-Level Fallback Hierarchy
- **Tier 1 (Specific ➔ General)**: Unrecognized processes fallback to `OTHER` category.
- **Tier 2 (Custom ➔ Built-in Default)**: If caret coordinates cannot be obtained from Win32, the pet maintains edge-docked safe zones.
- **Tier 3 (Degraded Safe-Mode)**: If native window hook fails, autonomous locomotion pauses and pet remains stationary at its last saved position.

## Complexity Tracking

None — fully aligns with Constitution Principle VII.

## Research

### R1 — macOS Screen Context & Accessibility Permissions
- **Decision**: Deferred to dedicated macOS milestone per PO decision in SP-18.
- **Rationale**: Windows is the target validation platform for MVP; macOS requires `AXUIElement` accessibility permissions which will be evaluated in a separate spike.
- **Source / Verification Status**: `spikes/SP-18-pet-liveness/REPORT.md#5-chua-tra-loi-duoc-vi-sao`.

## Migration & Rollback

Not applicable — new capability.

## Risks / Trade-offs

- [Risk: Electron CPU usage during continuous 60Hz movement] → Mitigation: SP-18 verified CPU stays under 1.0% when position updates use native `SetWindowPos`.
- [Risk: Fullscreen presentation apps (Keynote/PowerPoint)] → Mitigation: Native hook detects fullscreen windows and auto-parks pet into taskbar margin (Rule A.7).

## Open Questions

None — all aspects validated by SP-18.

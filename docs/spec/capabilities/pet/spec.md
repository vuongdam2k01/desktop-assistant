# pet Specification

## Purpose
Owns the persistent animated character on screen and its dialog card: rendering, animation states, locomotion, placement across displays, and the immediate acknowledgement the user sees when they hand over a command. It is the product's primary touchpoint and must never take keyboard focus from the application the user is working in.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence).

## Requirements

### Requirement: Pet is always on top and freely positioned

The pet SHALL render as a 2D figure above every other window, SHALL be draggable to any position the user
chooses, and SHALL restore that position when the application starts again.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-01) — UNVERIFIED.

#### Scenario: Position survives a restart
- **GIVEN** the user has dragged the pet to the lower-right corner of the primary display
- **WHEN** the application is quit and started again
- **THEN** the pet appears at the same position it was left in

#### Scenario: Pet stays above a full-screen foreground window
- **WHEN** another application is brought to the foreground, including maximised and full-screen windows
- **THEN** the pet remains visible above it and does not fall behind

#### Scenario: Saved position lies outside the current display arrangement
- **GIVEN** the pet was last positioned on a secondary display that is no longer attached
- **WHEN** the application starts
- **THEN** the pet is placed at a visible position on an attached display rather than off-screen

### Requirement: Pet animation reflects system state

The pet SHALL provide at least five distinguishable animation states — idle, command received, working,
waiting for approval, and result available — and SHALL enter the state matching an event within 2 seconds of
that event, driven by numeric state machine input values 0 through 4 with blend transitions between 150ms and 250ms.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-02),
`spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`,
`spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2),
`spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan`,
`spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) — VERIFIED: state transition latencies measured
between 2.9 ms and 15.1 ms on Windows (average 8.84 ms) and 1.3 ms to 15.8 ms on macOS (average 11.06 ms).

#### Scenario: Transition to working after a job starts
- **GIVEN** the pet is idle
- **WHEN** a job the user handed over enters the running state
- **THEN** the pet displays the working animation no later than 2 seconds after the state change

#### Scenario: Two states become true at once
- **GIVEN** one job is running and a second job raises an approval request
- **WHEN** both states apply simultaneously
- **THEN** the pet displays the waiting-for-approval state, because it is the state that requires the user to act

#### Scenario: No job is active
- **WHEN** no job is running and no card is waiting
- **THEN** the pet displays the idle animation

### Requirement: Clicking the pet opens the dialog surface promptly

Clicking the pet SHALL open the dialog surface and give it keyboard focus within 500 milliseconds of the click.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-03),
`docs/raw-idea/prd-mvp.md#11-1-hieu-nang` (NFR-PF-02) — UNVERIFIED.

#### Scenario: Composer receives focus on click
- **GIVEN** no card is waiting
- **WHEN** the user clicks the pet
- **THEN** the composer opens and accepts typed characters within 500 milliseconds

#### Scenario: Dismissal returns focus to the previous window
- **GIVEN** the dialog surface is open and focused, having been opened from a text editor
- **WHEN** the user presses Escape or clicks outside the dialog surface
- **THEN** the dialog surface closes and keyboard focus returns to the text editor

### Requirement: Pet visibility is user-controlled and does not affect execution

The user SHALL be able to hide and show the pet from the tray icon, and hiding the pet SHALL NOT stop, pause or
alter any running job.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-07) — UNVERIFIED.

#### Scenario: Job continues while the pet is hidden
- **GIVEN** a job is running
- **WHEN** the user hides the pet from the tray icon
- **THEN** the job continues to run and its ledger keeps recording

#### Scenario: Pet returns carrying the state it accumulated
- **GIVEN** the pet was hidden and two results arrived while it was hidden
- **WHEN** the user shows the pet again
- **THEN** the pet displays the badge count for the waiting cards rather than replaying them

### Requirement: Pet carries a right-click menu of immediate controls

Right-clicking the pet SHALL open a menu offering Open app, Do-Not-Disturb on/off, Hide pet and Quit, and
SHALL display the current approval mode; selecting the approval mode SHALL navigate to the application window
rather than change the mode in place.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-12) — UNVERIFIED.

#### Scenario: Menu shows the mode in force
- **GIVEN** the approval mode is `smart`
- **WHEN** the user right-clicks the pet
- **THEN** the menu shows `smart` as the current mode

#### Scenario: Mode cannot be changed from the menu
- **WHEN** the user selects the approval mode entry in the menu
- **THEN** the application window opens at the approval configuration, and the mode in force is unchanged

### Requirement: Pet indicates the approval mode in force

The pet SHALL carry a visible indicator of the approval mode currently in force.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-08, priority Should) — UNVERIFIED.

#### Scenario: Indicator follows a mode change
- **GIVEN** the approval mode is `on`
- **WHEN** the user changes the mode to `off` in the application window
- **THEN** the pet indicator changes to the `off` representation

### Requirement: All pet-visible text originates from the pet-agent

Every message the pet presents SHALL be produced by the pet-agent under its persona specification, and the
product SHALL NOT emit hardcoded notification strings through the pet surface. The single exception is the
acknowledgement line set: lines authored and localised as part of the persona specification, which the product
may present without a model, and which SHALL state receipt only — naming nothing from the command, asserting no
understanding of it, and promising no outcome.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-10) — UNVERIFIED. The exception is
added because the two-second commitment cannot survive a measured median of 6,655 ms for an image command —
VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q2) — and its scope was fixed in
`clarifications.md` session 2026-09-12: the requirement exists so the pet has one voice and so system
notifications cannot bypass the persona, and a receipt line that carries no meaning about the request does
neither.

#### Scenario: Result announcement is generated
- **WHEN** a job completes and the pet announces the result
- **THEN** the announcement text was produced by the pet-agent for this job rather than selected from a fixed
  string table

#### Scenario: Pet-agent is unavailable
- **GIVEN** the configured model provider cannot be reached
- **WHEN** an event would normally make the pet speak
- **THEN** the event is surfaced as a SYSTEM card reporting the provider failure, and no fabricated persona text
  is shown

#### Scenario: An acknowledgement line claims to have understood
- **WHEN** an acknowledgement line is reviewed that names an entity from the command or states what the product
  will do about it
- **THEN** it does not belong to the acknowledgement line set, because only the model that has read the command
  may say anything about it

#### Scenario: The line set is missing for the active language
- **GIVEN** the persona specification carries no acknowledgement lines for the language in force
- **WHEN** the user sends a command
- **THEN** the product presents the acknowledgement in its fallback language rather than presenting a string
  composed outside the persona specification

### Requirement: Pet holds its relative position across display changes

The pet SHALL keep its position relative to the display it occupies when the display arrangement changes, and
SHALL remain reachable when a display is detached.

Source: `docs/raw-idea/prd-mvp.md#11-4-kha-dung-amp-tuong-thich` (NFR-CP-02) — UNVERIFIED.

#### Scenario: Secondary display is detached while the pet sits on it
- **GIVEN** the pet is positioned on a secondary display
- **WHEN** that display is detached
- **THEN** the pet moves to an equivalent relative position on a remaining display and stays visible

#### Scenario: Display scaling changes
- **WHEN** the display scale factor changes
- **THEN** the pet re-renders at the new scale without changing its relative position

### Requirement: Pet animation holds its frame rate under load

The pet animation SHALL sustain at least 30 frames per second while the machine is at 70 percent CPU load.

Source: `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` (NFR-PF-04) — UNVERIFIED; the threshold is marked as proposed
in the source and is superseded by measurement in `req-005-electron-rive-pet-render`.

#### Scenario: Animation under sustained load
- **GIVEN** the machine is held at 70 percent CPU load
- **WHEN** the pet plays its working animation for one minute
- **THEN** the measured frame rate stays at or above 30 frames per second

### Requirement: Pet runs continuously without degradation

The pet SHALL run for at least 8 continuous hours without crashing and without growing its memory footprint
without bound.

Source: `docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` (NFR-RL-04) — UNVERIFIED.

#### Scenario: Eight-hour soak
- **GIVEN** the application has been running for 8 hours with periodic job activity
- **WHEN** memory usage and process health are sampled at the end of the period
- **THEN** the process is alive and its memory footprint has not grown monotonically across the run

### Requirement: The pet acknowledges a handed-over command before any model answers

When the user sends a command, the pet SHALL present an acknowledgement within 200 milliseconds, drawn from the
acknowledgement line set of its persona specification and requiring no network request, and SHALL enter its
working state while the model request that answers the command is outstanding.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) — VERIFIED that no measured model
holds the two-second commitment for every input shape: the fastest text model answered at a median of 1,958 ms
with a ninetieth percentile of 3,110 ms, and the vision model answered an image at a median of 6,655 ms with a
ninetieth percentile of 19,693 ms;
`spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd` item 3 recommends the local acknowledgement,
which involves no network and was measured at 50 ms in the spike's own reckoning. The 200 millisecond ceiling in
this requirement is the product-level budget covering queue placement and rendering as well as the line itself,
and is UNVERIFIED until measured in the packaged product.

#### Scenario: A text command on a slow network
- **GIVEN** the network is slow enough that the model's first token takes eight seconds
- **WHEN** the user sends a text command
- **THEN** the acknowledgement is presented within 200 milliseconds and the pet is in its working state while
  the answer is outstanding

#### Scenario: A command carrying an image
- **GIVEN** the pet image role is assigned and the model's median answer takes over six seconds
- **WHEN** the user sends a command with an image attached
- **THEN** the acknowledgement is presented within 200 milliseconds, and the pet stays in its working state
  until the answer arrives rather than appearing idle

#### Scenario: No provider is configured at all
- **GIVEN** no role has a usable assignment
- **WHEN** the user sends a command
- **THEN** the acknowledgement is not presented, and the product states that a provider must be configured,
  because an acknowledgement for work that cannot start would be a promise the product cannot keep

#### Scenario: The request fails immediately
- **GIVEN** an acknowledgement has been presented
- **WHEN** the provider refuses the credential one second later
- **THEN** the failure reaches the user as a SYSTEM card, and the acknowledgement is not retracted or rewritten
  into an error

### Requirement: Pet rendering engine maintains minimum frame rate and transparency under heavy load
The pet rendering engine SHALL maintain a frame rate of at least 30 frames per second on Windows and macOS under system CPU load up to 100%, and SHALL render characters against a transparent frameless window surface with clean anti-aliased edges exhibiting zero dark or grey halo fringing.

Source: `spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`,
`spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q3),
`spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan`,
`spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q3).

#### Scenario: Heavy multi-threaded CPU stress
- **GIVEN** background processes generate 70% to 100% CPU load across system cores
- **WHEN** the pet renders idle or state-transition animations
- **THEN** the renderer maintains a steady frame rate of at least 30 frames per second with zero dropped DirectComposition frames

#### Scenario: Pixel boundary transparency validation
- **WHEN** inspecting the RGBA pixel values along the transition boundary from external transparent background into pet artboard geometry
- **THEN** fully transparent pixels exhibit alpha 0 with zero premultiplied dark fringing, and edge pixels preserve character luminance without grey halo artifacts

### Requirement: Pet asset pipeline loads binary buffers dynamically without application rebuild
The pet runtime SHALL load character artboard and state machine definitions from a binary `Uint8Array` buffer read from local disk, and SHALL allow swapping the active `.riv` character skin asset at runtime without recompiling or restarting the host application.

Source: `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6),
`spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7).

#### Scenario: Local offline asset loading without CORS restrictions
- **GIVEN** the application is running in an offline environment
- **WHEN** the pet window initializes
- **THEN** the character asset is read directly from local storage as a binary buffer into the Rive runtime without making network requests or encountering CORS violations

#### Scenario: Runtime pet skin swap
- **GIVEN** the user or system updates the local character skin file
- **WHEN** the skin reload signal is dispatched
- **THEN** the runtime reloads the artboard and rebinds the state machine inputs dynamically without restarting the application process

### Requirement: Pet window provides per-pixel click-through via native window procedure subclassing
The pet window SHALL pass mouse click and movement events through to background applications when the cursor hovers over transparent pixels by intercepting `WM_NCHITTEST` and returning `HTTRANSPARENT` (`-1`), and SHALL capture mouse clicks directly on the pet character body by returning `HTCLIENT` (`1`).

Source: `spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan`,
`spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2).

#### Scenario: User clicks transparent padding around the pet
- **GIVEN** a background application window (such as a text editor) is beneath the transparent area of the pet window
- **WHEN** the user clicks at a pixel coordinate where the pet alpha value is zero
- **THEN** the mouse click passes through with zero latency to the background application and the pet does not intercept the click

#### Scenario: User clicks on the character body
- **WHEN** the user clicks on a non-transparent pixel representing the pet character geometry
- **THEN** the native window procedure returns `HTCLIENT` and dispatches the interaction event to the pet click handler

### Requirement: Card window uses HWND pre-warming and native no-activate styling to prevent keystroke drops
The dialogue card window SHALL be pre-warmed upon application startup with extended style `WS_EX_NOACTIVATE` and `WS_EX_TOPMOST`, and SHALL be repositioned and revealed using `SetWindowPos` with `SWP_NOACTIVATE` without triggering Desktop Window Manager surface allocation hitches or dropping user keystrokes in active foreground applications.

Source: `spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan`,
`spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1).

#### Scenario: Card auto-expands while user types at high speed
- **GIVEN** the user is actively typing a continuous stream of characters into a foreground editor
- **WHEN** an approval or question card is triggered and displayed on screen
- **THEN** exactly zero characters are dropped from the user's keystroke stream and the foreground editor retains uninterrupted keyboard focus

#### Scenario: User clicks card to give focus
- **GIVEN** a card is displayed in inactive topmost mode
- **WHEN** the user physically clicks inside the card surface
- **THEN** the card window activates and receives keyboard focus for typing

### Requirement: Pet and card windows restore bounds safely across dynamic multi-display configuration changes
When restoring stored pet window coordinates or adapting to display detachment, the window manager SHALL verify that the saved bounds intersect at least one active display work area, and SHALL reposition the pet to the bottom-right corner of the primary display work area whenever the saved bounds fall entirely outside all connected displays.

Source: `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4, Q5).

#### Scenario: Secondary display detached since last session
- **GIVEN** the pet was placed on a secondary display that is currently detached
- **WHEN** the application starts up
- **THEN** the window manager detects the bounds fall outside connected work areas and places the pet at the bottom-right of the primary display's work area

#### Scenario: Dynamic Per-Monitor DPI normalization
- **GIVEN** two displays with different DPI scaling factors (e.g. 150% and 100%)
- **WHEN** the pet is dragged across display boundaries
- **THEN** window dimensions and coordinates are normalized in device-independent pixels without layout distortion

### Requirement: Pet locomotion and screen context awareness with caret avoidance
The pet locomotion engine SHALL move the pet window across connected displays at up to 60 frames per second using non-activating window placement, SHALL maintain a minimum 150-pixel buffer zone around the user's active typing caret position to prevent visual obstruction, and SHALL avoid occupying the active user interaction zone.

Source: `spikes/SP-18-pet-liveness/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q14, Q16, Q17),
`spikes/SP-18-pet-liveness/macos/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q14, Q16, Q17).

#### Scenario: User types in an editor near the pet
- **GIVEN** the pet is idling within 150 pixels of the active text caret
- **WHEN** the user types characters into the foreground editor
- **THEN** the pet detects the caret coordinate within 10 milliseconds and animates away outside the 150-pixel buffer zone without stealing keyboard focus or dropping keystrokes

#### Scenario: Continuous movement during active high-speed typing
- **GIVEN** the pet is actively moving between screen waypoints at 60 frames per second
- **WHEN** the user types continuously at high speed (25ms per keystroke) into a text editor
- **THEN** 100% of user keystrokes reach the editor with exactly zero dropped characters

### Requirement: Two-layer animation state machine combining locomotion and work status
The pet animation controller SHALL combine a locomotion state layer (standing, walking, dragged, falling) with a work status state layer (idle, receiving_order, working, waiting_approval, has_result) in the Rive runtime, maintaining 60 frames per second with zero stutter during simultaneous motion and status transitions.

Source: `spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q19, Q20).

#### Scenario: Job status changes while pet is walking
- **GIVEN** the pet is in locomotion state `walking`
- **WHEN** a job event changes the work status from `idle` to `working`
- **THEN** the pet transitions its work status animation smoothly while continuing its walking locomotion without dropped frames or visual hitching

#### Scenario: User grabs pet during autonomous movement
- **WHEN** the user presses mouse button down over the character body while the pet is moving
- **THEN** the locomotion layer instantly transitions to `dragged` and tracks the cursor trajectory with latency under 10 milliseconds

### Requirement: Presenting the speech bubble on macOS takes no keyboard focus

On macOS the speech bubble SHALL appear without the application becoming active and without the keyboard focus
leaving the window the user is typing in, and this SHALL hold using the window presentation the desktop
framework already offers, without a native component.

Source: `spikes/SP-7-pet-window-os/macos/REPORT.md#0-ket-luan`,
`spikes/SP-7-pet-window-os/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1),
`spikes/SP-18-pet-liveness/macos/REPORT.md#0-ket-luan` — VERIFIED: 10 runs of 10 lost no character while the
bubble opened mid-typing, and 10 further runs lost none while the pet was also moving. The same test fails 6
times in 10 on Windows, which is why Windows carries a native component for this and macOS does not.

#### Scenario: The bubble opens while the user is typing

- **GIVEN** the user is typing into another application
- **WHEN** the pet opens its speech bubble unprompted
- **THEN** every keystroke reaches the application the user was typing in, and the caret stays where it was

#### Scenario: The bubble opens while the pet is moving

- **GIVEN** the pet is moving across the screen and the user is typing
- **WHEN** the bubble opens
- **THEN** no keystroke is lost

#### Scenario: The user addresses the pet deliberately

- **WHEN** the user clicks the pet to type a command
- **THEN** focus moves to the bubble, because the user asked for it

### Requirement: Returning focus to the previously active application requires native support on macOS

When the speech bubble closes after the user has typed into it, focus SHALL return to the application that held
it before the bubble opened, and on macOS this SHALL be performed by the platform's native integration module
because the desktop framework alone cannot restore another application's activation.

Source: `spikes/SP-18-pet-liveness/macos/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q30),
`spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: restoring the prior application
required activating it through native application control, which is why this obligation sits with the native
module and enlarges its scope beyond hit-testing.

#### Scenario: The user dismisses the bubble

- **GIVEN** the user was working in an editor before opening the bubble
- **WHEN** the user presses Escape or clicks outside the bubble
- **THEN** the editor is active again and receives the next keystroke

#### Scenario: The previously active application has closed

- **WHEN** the bubble closes and the application that previously held focus no longer exists
- **THEN** the product leaves focus where the operating system places it and does not activate itself in that
  application's place

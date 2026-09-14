## ADDED Requirements

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

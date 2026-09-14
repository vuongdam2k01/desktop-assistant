## ADDED Requirements

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
that event.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-02) — UNVERIFIED.

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
product SHALL NOT emit hardcoded notification strings through the pet surface.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-10) — UNVERIFIED.

#### Scenario: Result announcement is generated
- **WHEN** a job completes and the pet announces the result
- **THEN** the announcement text was produced by the pet-agent for this job rather than selected from a fixed
  string table

#### Scenario: Pet-agent is unavailable
- **GIVEN** the configured model provider cannot be reached
- **WHEN** an event would normally make the pet speak
- **THEN** the event is surfaced as a SYSTEM card reporting the provider failure, and no fabricated persona text
  is shown

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

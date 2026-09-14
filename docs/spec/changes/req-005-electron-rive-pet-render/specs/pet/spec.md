## ADDED Requirements

### Requirement: Pet rendering engine maintains minimum frame rate and transparency under heavy load
The pet rendering engine SHALL maintain a frame rate of at least 30 frames per second on Windows under system CPU load up to 100%, and SHALL render characters against a transparent frameless window surface with clean anti-aliased edges exhibiting zero dark or grey halo fringing.

Source: `spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`,
`spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q3).

#### Scenario: Heavy multi-threaded CPU stress
- **GIVEN** background processes generate 70% to 100% CPU load across system cores
- **WHEN** the pet renders idle or state-transition animations
- **THEN** the renderer maintains a steady frame rate of at least 30 frames per second with zero dropped DirectComposition frames

#### Scenario: Pixel boundary transparency validation
- **WHEN** inspecting the RGBA pixel values along the transition boundary from external transparent background into pet artboard geometry
- **THEN** fully transparent pixels exhibit alpha 0 with zero premultiplied dark fringing, and edge pixels preserve character luminance without grey halo artifacts

### Requirement: Pet asset pipeline loads binary buffers dynamically without application rebuild
The pet runtime SHALL load character artboard and state machine definitions from a binary `Uint8Array` buffer read from local disk, and SHALL allow swapping the active `.riv` character skin asset at runtime without recompiling or restarting the host application.

Source: `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6).

#### Scenario: Local offline asset loading without CORS restrictions
- **GIVEN** the application is running in an offline environment
- **WHEN** the pet window initializes
- **THEN** the character asset is read directly from local storage as a binary buffer into the Rive runtime without making network requests or encountering CORS violations

#### Scenario: Runtime pet skin swap
- **GIVEN** the user or system updates the local character skin file
- **WHEN** the skin reload signal is dispatched
- **THEN** the runtime reloads the artboard and rebinds the state machine inputs dynamically without restarting the application process

## MODIFIED Requirements

### Requirement: Pet animation reflects system state

The pet SHALL provide at least five distinguishable animation states — idle, command received, working,
waiting for approval, and result available — and SHALL enter the state matching an event within 2 seconds of
that event, driven by numeric state machine input values 0 through 4 with blend transitions between 150ms and 250ms.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-02),
`spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`,
`spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) — VERIFIED: state transition latencies measured
between 2.9 ms and 15.1 ms (average 8.84 ms).

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

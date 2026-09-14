## Purpose

Define platform-level OS interaction boundaries, window transparency, elevation safety, and process non-interference guarantees for desktop host integration.

## ADDED Requirements

### Requirement: Other applications are reached only through official interfaces

The product SHALL act on another application only through that application's published network or local API, its
command-line interface, an MCP server it exposes, or the system clipboard, and SHALL NOT drive another
application by operating its user interface.

Source: `spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien` (constraint 4) — VERIFIED.

#### Scenario: A supported platform is acted on
- **WHEN** the product performs a write on a connected platform
- **THEN** the write is issued through that platform's official interface, and the ledger record for it names
  that interface

#### Scenario: A platform offers no programmatic interface
- **GIVEN** the user asks for work on an application that exposes no API, command-line interface or MCP server
- **WHEN** the product resolves how to perform the work
- **THEN** it reports that the application is not supported and performs no action, rather than operating the
  application's interface on the user's behalf

### Requirement: Third-party processes are never suspended or resumed

The product SHALL NOT suspend, freeze or resume a process it did not start.

Source: `spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien` (risks 1 and 4) — VERIFIED; suspending a
process that holds a low-level input hook stalled the kernel input path on every mouse and keyboard packet and
made the user's physical pointer stutter system-wide.

#### Scenario: Another process interferes with the product's own input handling
- **GIVEN** a third-party process — an input-method editor, an overlay, or any other low-level input hook — is
  altering input the product receives
- **WHEN** the product handles that interference
- **THEN** it adapts its own behaviour or reports the interference to the user, and the third-party process
  continues running untouched

#### Scenario: A process the product started is stopped
- **GIVEN** the product started a child process of its own
- **WHEN** that child process must be stopped
- **THEN** stopping it is permitted, because the prohibition covers only processes the product did not start

### Requirement: Synthetic input is never injected into another application

The product SHALL NOT synthesise keyboard or mouse input destined for a window it does not own.

Source: `spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien` (constraint 4) — VERIFIED; the same section
records that the injection path also triggered menu accelerators in unrelated applications.

#### Scenario: Text must reach another application
- **WHEN** the product needs to place text into an application the user is working in
- **THEN** it makes the text available for the user to use — for example through the clipboard — and the user
  performs the insertion

#### Scenario: Input is delivered inside the product's own windows
- **WHEN** the product delivers input to its own pet or application window
- **THEN** this is permitted, because the prohibition covers only windows the product does not own

### Requirement: The pointer is never moved on the user's behalf

The product SHALL NOT reposition the user's pointer.

Source: `spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien` (risk 3) — VERIFIED; forced pointer
repositioning was removed from the spike harness after it yanked the user's cursor mid-session.

#### Scenario: The pet needs the user's attention at a location
- **WHEN** the product wants to draw attention to a position on screen
- **THEN** it moves or animates its own window at that position and leaves the pointer where the user left it

#### Scenario: The pointer is over the pet while the pet repositions itself
- **GIVEN** the pointer rests over the pet window
- **WHEN** the pet moves to a new position
- **THEN** the pointer stays at its screen coordinates and the pet window moves out from under it

### Requirement: Transparent window regions render as transparent in every supported session

The pet window's transparent regions SHALL render as transparent in every session the product supports,
including sessions without hardware compositing such as virtual machines, remote-desktop sessions and headless
test sessions.

Source: `spikes/SP-0-gui-harness/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` (item 2) — VERIFIED; the alpha
channel is honoured in such sessions only when the renderer is configured to forgo hardware acceleration.

#### Scenario: Remote-desktop or virtual-machine session
- **GIVEN** the product runs in a remote-desktop or virtual-machine session
- **WHEN** the pet window is shown over a known background
- **THEN** a capture of the window area shows that background through the window's transparent regions

#### Scenario: Session with hardware compositing available
- **GIVEN** the product runs in an ordinary desktop session with hardware compositing available
- **WHEN** the pet window is shown over a known background
- **THEN** the transparent regions render identically to the session without hardware compositing

### Requirement: Normal operation requires no administrator elevation

Every operation the product performs after installation SHALL complete under a standard, non-elevated user
account.

Source: `spikes/SP-0-gui-harness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6, the operations classified as requiring
no administrator rights) — VERIFIED; showing a transparent always-on-top window, receiving a connector
authorisation callback on a loopback address, storing credentials in operating-system secure storage and
reading and writing the local ledger all ran under a standard filtered token.

#### Scenario: Product is run by a standard user
- **GIVEN** the signed-in account holds no administrator rights
- **WHEN** the user runs the pet, connects a platform, approves an operation and inspects the ledger
- **THEN** all of it completes and no elevation prompt appears

### Requirement: Steps that require elevation are declared before they begin

An operation that cannot complete without administrator rights SHALL state that requirement before it starts,
and SHALL leave no partially applied state if the user does not grant elevation.

Source: `spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien` (risk 2) — VERIFIED; the operating system
presents the elevation prompt on an isolated secure desktop that no automated actor can answer or observe, so a
prompt raised part-way through an operation strands it.

#### Scenario: An operation needs administrator rights
- **GIVEN** an operation requires administrator rights
- **WHEN** the user starts it
- **THEN** the product states the requirement before any part of the operation is applied

#### Scenario: Elevation is refused or unanswered
- **GIVEN** an operation requiring administrator rights has stated its requirement and begun
- **WHEN** elevation is refused, or the prompt is never answered
- **THEN** the operation reports that it did not proceed, and the system is left in the state it held before
  the operation started

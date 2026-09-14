# platform Specification

## Purpose
Owns everything beneath the product surface: repository and toolchain layout, native module build and packaging, code signing, the update pipeline, device-local secure storage for credentials and replication material, and the standing prohibitions on interfering with other processes or the user's input devices.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence). Amended 2026-09-12 by change `req-022-account-sync` (constitution 2.0.0).

## Requirements

### Requirement: Credentials are held in operating-system secure storage

Connector authorisations, model-provider credentials and the material a device uses to replicate the account's
data SHALL be encrypted through the operating system's secure-storage facility and held on the device only as
that ciphertext in the application's own credential store, SHALL NOT be written in plain text anywhere on the
device, and SHALL NOT be placed in an operating-system credential vault that limits the size of an entry or
lists the product's entries among the user's own saved credentials.

Source: `docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-01),
`docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-11), `docs/spec/constitution.md` principle VII,
`spikes/SP-11-secure-storage/REPORT.md#0-ket-luan`, `spikes/SP-11-secure-storage/macos/REPORT.md#0-ket-luan` — VERIFIED on Windows and macOS. The mechanism is
now named rather than left open: the measurement in `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 and `spikes/SP-11-secure-storage/macos/REPORT.md` §1 Q2 eliminated the
operating-system credential vault on a hard per-entry limit, and `#2-tac-dong-len-adr-prd` records that the
wording of NFR-SEC-01, which named that vault, is what this requirement corrects. `req-022-account-sync` had
already added replication material to what this requirement protects and removed the binding of these
credentials to one machine; that is carried forward unchanged.

#### Scenario: Credential is not recoverable from the application directory
- **WHEN** the application's data directory is inspected
- **THEN** no credential value is readable from it, including from the credential store file that holds the
  ciphertext

#### Scenario: Secure storage is unavailable
- **WHEN** the operating system's secure storage cannot be reached
- **THEN** the product reports that credentials cannot be stored and refuses to hold them in plain text as a
  fallback

#### Scenario: A credential larger than an operating-system credential vault would accept
- **WHEN** a credential whose stored form exceeds two and a half kilobytes — a connector's tokens, scopes and
  platform metadata held together, or a user-supplied authorisation client — is stored
- **THEN** it is stored and read back whole, without being divided into numbered parts

#### Scenario: The product's credentials do not appear among the user's own saved credentials
- **WHEN** the user inspects the operating system's list of saved credentials
- **THEN** none of the product's credentials is listed there, so removing the product cannot leave entries
  behind in it

#### Scenario: Credentials are removed on uninstall or account deletion
- **WHEN** the account is deleted or the application is removed
- **THEN** the stored credentials are erased from secure storage

#### Scenario: Stored credentials cannot be decrypted on this device
- **GIVEN** the device's secure storage can no longer decrypt what it holds
- **WHEN** the user signs in to the account
- **THEN** the unreadable material is discarded and the credentials are restored by replication, and the user is
  not asked to reconnect each connector

#### Scenario: Credentials are erased on sign-out
- **WHEN** the user signs out on a device
- **THEN** the connector authorisations, provider credentials and replication material held for that account are
  erased from that device's secure storage

### Requirement: The product behaves consistently on both supported operating systems

The product SHALL run on Windows 10 or later and macOS 13 or later, and the always-on-top and tray behaviours
SHALL be consistent between them.

Source: `docs/raw-idea/prd-mvp.md#11-4-kha-dung-amp-tuong-thich` (NFR-CP-01) — UNVERIFIED; the source marks the
version floors as proposals.

#### Scenario: Tray behaviour parity
- **WHEN** the application window is closed on either operating system
- **THEN** the application remains reachable from the tray in the same way

#### Scenario: Unsupported operating-system version
- **WHEN** the product starts on a version below the supported floor
- **THEN** it states the requirement rather than failing in an unexplained way

### Requirement: The product can start with the operating system

The product SHALL offer launching at login as a setting the user controls, and SHALL NOT enable it without the
user's choice.

Source: `docs/raw-idea/prd-mvp.md#7-1-must-have-thieu-la-mvp-vo-nghia` (S-M1),
`docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-01) — UNVERIFIED.

#### Scenario: Setting is off by default
- **WHEN** the product is installed and started for the first time
- **THEN** launch at login is off until the user turns it on

#### Scenario: Starting at login restores the previous state
- **GIVEN** launch at login is enabled
- **WHEN** the machine starts
- **THEN** the pet appears at its remembered position and any interrupted jobs are reconciled before the pet
  window is shown

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

### Requirement: Interrupted work is classified from the local store before the first window appears

At every start, before any window is shown, the product SHALL read its local store, identify every tool call
with no recorded outcome, mark the jobs those calls belong to as not resumable until their outcome is
established, and SHALL complete this without requiring network access.

Source: `spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 6 — VERIFIED; recovery runs
at the application's ready point before the pet window is created, which is what makes a duplicate tool call
impossible. `docs/spec/changes/req-013-sqlite-ledger/clarifications.md` Q-5 records why only the local half of
recovery precedes the window: the half that reads the platform back needs a network the user may not have, and
the guarantee comes from not resuming rather than from waiting.

#### Scenario: Starting after an abrupt stop with no network
- **WHEN** the application starts with unresolved tool calls in its store and no network available
- **THEN** the window appears, the affected jobs are marked as not resumable, and no tool call is repeated

#### Scenario: The surfaces read reconciled state
- **WHEN** the first window is shown after a crash
- **THEN** the job states and blocking items it presents are the ones the store was reconciled to, not the ones
  that were in memory when the process stopped

#### Scenario: Nothing was interrupted
- **WHEN** the application starts after an ordinary shutdown
- **THEN** the pass finds no unresolved call and the start is not delayed by reconciliation

#### Scenario: The classification pass itself is interrupted
- **WHEN** the process stops during the pass
- **THEN** the next start performs the pass again from the store and reaches the same classification, because
  the pass reads records and never rewrites them

### Requirement: Native components are loaded from files on disk in the packaged product

The packaged product SHALL place every native component it loads as a file on disk that the operating system's
loader can open, rather than only inside the packaged application archive, and a build that fails to do so SHALL
fail rather than ship.

Source: `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q1e — VERIFIED; the packaged application loaded its native
component and opened its store only because the packaging step extracted that component out of the archive as a
file, which the Windows loader requires.

#### Scenario: The packaged product opens its store
- **WHEN** the packaged product is installed and started
- **THEN** it loads its native components and opens its local store, on both supported operating systems

#### Scenario: A build leaves a native component inside the archive
- **WHEN** the packaging step produces a build whose native components are not extracted as files
- **THEN** the build fails and is not published

### Requirement: The local store is reached without compiling anything on the machine

The product SHALL reach its local store through a binding that runs on the shipped application framework without
being compiled on a developer, build or user machine, and an upgrade of the application framework SHALL NOT
require that binding to be rebuilt.

Source: `spikes/SP-12-sqlite-ledger/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED; the superseded binding
generation bound to the framework's internal engine interfaces and could not be compiled at all against the
current framework, while the pinned generation loaded the same prebuilt component on both the plain runtime and
the framework without a rebuild. RISK-046 records the failure this closes, and the superseded generation is
DROPPED: it must not be reintroduced.

#### Scenario: A clean machine with no compiler toolchain
- **GIVEN** a machine with no C++ build tools and no separate build-time language runtime installed
- **WHEN** the repository is cloned, its dependencies installed and the product started
- **THEN** it starts and opens its store

#### Scenario: The application framework is upgraded
- **WHEN** the product moves to a newer version of its application framework
- **THEN** the store opens without the binding being rebuilt for that version

#### Scenario: A dependency proposes the superseded binding generation
- **WHEN** a change would introduce a store binding that compiles against the framework's internal engine
  interfaces
- **THEN** it is refused, because that is the failure RISK-046 records rather than a preference

### Requirement: Every stored credential is addressed by a namespaced key

Every credential SHALL be stored under a hierarchical key that names the domain it belongs to, the provider or
category within that domain and the identity it was issued for, and the store SHALL be enumerable by key prefix
so that everything belonging to one connector, one provider or one account can be found and removed as a group.

Source: `spikes/SP-11-secure-storage/REPORT.md` §1 Q5 — VERIFIED; the five key forms of the taxonomy were
written, read back and enumerated by prefix, and `#3-dau-vao-cho-tai-lieu-ky-thuat` item 2 carries the naming
rule into the technical input.

#### Scenario: Two accounts on the same provider do not collide
- **GIVEN** the user has authorised the same platform for two different accounts on it
- **WHEN** both authorisations are stored
- **THEN** each is addressable on its own and neither overwrites the other

#### Scenario: Everything belonging to one connector is found by prefix
- **WHEN** a connector is disconnected
- **THEN** every entry belonging to it — tokens, any user-supplied authorisation client, and its stored
  metadata — is found by its key prefix and erased, leaving no entry that only a full scan would reveal

#### Scenario: Storing under a key already in use replaces it
- **WHEN** a refreshed token is stored under the key its predecessor used
- **THEN** the entry holds the new value and no copy of the previous value remains readable

#### Scenario: A key that does not follow the naming rule is refused
- **WHEN** a credential is offered under a key that names no domain and no identity
- **THEN** the store refuses it and nothing is written, rather than accepting an entry that group erasure would
  later miss

### Requirement: A credential that cannot be decrypted is never returned as a value

When stored ciphertext cannot be decrypted, the store SHALL report the failure to its caller, SHALL NOT return a
partial, empty or substituted value in its place, and SHALL mark the entry unreadable so that it is replaced
rather than read again.

Source: `spikes/SP-11-secure-storage/REPORT.md` §1 Q3 — VERIFIED; every tampered, truncated and
foreign-format payload raised a decryption failure rather than yielding a value, and `#4-rui-ro-moi-phat-hien`
records the out-of-band password reset (RISK-042) as the realistic cause of this state on a machine nobody has
attacked.

#### Scenario: The stored ciphertext has been altered
- **WHEN** an entry whose stored bytes have been altered is read
- **THEN** the read fails and reports that the credential is unreadable, and no value is returned to the caller

#### Scenario: Material written in a form this device does not recognise
- **WHEN** an entry is read whose stored form is truncated or was written under a scheme this device does not
  recognise
- **THEN** it is treated as unreadable in the same way, rather than being parsed on a best-effort basis

#### Scenario: An unreadable connector authorisation is replaced from the account
- **GIVEN** a connector's stored authorisation is unreadable on this device
- **WHEN** the device next replicates with the account
- **THEN** the unreadable entry is replaced by the account's copy and jobs use the connector again without the
  user re-authorising it

#### Scenario: The device cannot yet reach the account
- **GIVEN** a connector's stored authorisation is unreadable and the device has not replicated since
- **WHEN** the user opens the product
- **THEN** it states which connections are unavailable on this device and that they are being restored, keeps
  that statement visible until they are, and does not present them as revoked at the platform

#### Scenario: The replication material itself is unreadable
- **GIVEN** the material this device uses to replicate is unreadable, so the account's copy cannot be reached
  to replace it
- **WHEN** the user opens the product
- **THEN** the product asks only for account sign-in, and re-establishes the device's replication material and
  every credential from that sign-in alone

### Requirement: Stored credentials are readable only by the operating-system user that stored them

A credential stored on a device SHALL be readable only by the operating-system user account that stored it, and
copying the application's data directory to another operating-system user account or to another machine SHALL
NOT make any credential in it readable.

Source: `spikes/SP-11-secure-storage/REPORT.md` §1 Q4 — VERIFIED; a second operating-system user created for the
measurement failed to decrypt the first user's material, and the same section records that a restored copy of
the data directory on another machine fails in the same way.

#### Scenario: A second operating-system user reads the data directory
- **GIVEN** two operating-system user accounts exist on one machine and the first has stored credentials
- **WHEN** the second reads the first's application data directory
- **THEN** no credential in it is readable, even though the file itself can be opened

#### Scenario: The data directory is restored onto a different machine
- **GIVEN** a backup of the application's data directory taken on one machine
- **WHEN** it is restored onto another machine and the product starts
- **THEN** the credentials in it are unreadable, the product does not crash, and they are replaced from the
  account rather than being trusted

### Requirement: A decrypted credential never leaves the process that uses it

A decrypted credential value SHALL be used only inside the process that makes the call it authorises, and SHALL
NOT be sent to a window process, written to the ledger, placed in an agent's context, or written to a log or a
crash report.

Source: `docs/spec/constitution.md` principles II and III;
`docs/spec/changes/req-013-sqlite-ledger/contracts/ledger-store.md` Semantics, which states that credentials are
not in the ledger store at all — UNVERIFIED as a whole; the storage half is measured in
`spikes/SP-11-secure-storage/REPORT.md` §1 Q5, while the boundary rule is a design obligation this change places
on every caller.

#### Scenario: A window process asks for a credential
- **WHEN** a window process requests a credential value
- **THEN** no value is returned to it; it receives only whether the credential is present and when it was last
  updated

#### Scenario: A tool call is recorded in the ledger
- **WHEN** a tool call authorised by a stored credential is recorded
- **THEN** the record names the connector and the operation, and contains no part of the credential value

#### Scenario: The product writes a diagnostic report
- **WHEN** a log line or a crash report is produced while a credential is in use
- **THEN** no credential value appears in it

### Requirement: Erasing the device's credentials leaves nothing readable behind

Erasing the device's credentials SHALL remove every stored entry and discard every decrypted copy the product
holds, SHALL complete before the local store file is removed, and an interrupted erasure SHALL be completed at
the next start rather than leaving a readable credential behind.

Source: `spikes/SP-11-secure-storage/REPORT.md` §1 Q6 — VERIFIED; after erasure the store file was gone, no key
remained in memory, a read returned nothing, and no entry was left in the operating system's own credential
list. `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12) is the requirement it answers.

#### Scenario: The account is deleted
- **WHEN** the user deletes their account
- **THEN** every credential on the device is erased before the local store file is removed, and a read afterwards
  returns nothing

#### Scenario: The application is uninstalled
- **WHEN** the product is removed from the machine
- **THEN** the erasure runs as part of the removal, and nothing readable is left in the application's data
  directory or in the operating system's credential list

#### Scenario: Erasure is interrupted part-way
- **GIVEN** an erasure was interrupted with some entries still present
- **WHEN** the product next starts
- **THEN** it completes the erasure before any other use of the store, and no credential is usable in between

#### Scenario: There is nothing to erase
- **WHEN** erasure runs on a device that holds no credentials
- **THEN** it completes successfully and reports that nothing was held, rather than failing

### Requirement: Windows native integration module provides low-level window procedure and focus controls
The Windows platform runtime SHALL provide a native Node.js addon implemented in Rust via `napi-rs` that applies `WS_EX_NOACTIVATE` and `WS_EX_TOPMOST` extended styles, hooks `WM_NCHITTEST` window procedures for per-pixel alpha hit-testing, and executes non-activating window placement via Win32 `SetWindowPos`.

Source: `spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan`,
`spikes/SP-7-pet-window-os/REPORT.md#3-1-dac-ta-ky-thuat-cho-rust-native-module-desktop-window-win32-via-napi-rs`.

#### Scenario: Native module builds on Windows CI runner
- **GIVEN** a Windows runner equipped with Rust toolchain and Visual Studio C++ build tools
- **WHEN** the native module `desktop-window-win32` is compiled
- **THEN** it generates a valid `.node` native binary that loads into the Electron main process

#### Scenario: Native module applies no-activate style to target window
- **WHEN** initializing the card window handle
- **THEN** the native module assigns `WS_EX_NOACTIVATE` and `WS_EX_TOPMOST` to the window's extended style bitmask

### Requirement: Native privacy filter strips raw window titles before memory dispatch
The native screen-context enumeration module SHALL execute within native process memory, SHALL categorize window titles into predefined non-sensitive application classifications via local pattern matching, and SHALL discard the raw title strings immediately, passing only geometric bounds and generic category tags into the Node.js application runtime.

Source: `spikes/SP-18-pet-liveness/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q15),
`spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`.

#### Scenario: Window title containing personal or confidential data
- **GIVEN** an active foreground window title contains personal document names, URLs, or client identifiers
- **WHEN** the native screen enumeration routine reads the window information via Win32 APIs
- **THEN** the native privacy filter classifies the window (e.g. `EDITOR`, `BROWSER`, `TERMINAL`), purges the raw title text from native memory, and dispatches only `{ category, bounds }` to JavaScript

#### Scenario: Raw window title never crosses FFI boundary
- **WHEN** inspecting any data payload dispatched from the native screen monitoring addon to Electron
- **THEN** no field contains the raw window title string or substrings of document contents

### Requirement: Desktop application packages and signs releases with cloud Authenticode certificates
The desktop release pipeline SHALL package the application into NSIS installers using `electron-builder`, SHALL sign executable and update artifacts in CI via a cloud signing service using an Authenticode code-signing certificate and RFC 3161 timestamp server, and SHALL enforce `verifyUpdateCodeSignature: true` so the operating system and updater verify digital signatures via `WinVerifyTrust` prior to installation.

Source: `spikes/SP-16-signing-update/REPORT.md#0-ket-luan`,
`spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q4),
`spikes/SP-16-signing-update/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`.

#### Scenario: Production build signed in CI runner
- **GIVEN** a CI runner environment with cloud signing credentials
- **WHEN** the production release is packaged
- **THEN** all executable binaries are signed with SHA-256 Authenticode signatures and valid DigiCert RFC 3161 timestamps with zero warnings and zero errors

#### Scenario: Verification failure blocks unsigned or tampered updates
- **GIVEN** a downloaded update installer whose Authenticode signature is invalid or untrusted
- **WHEN** `electron-updater` evaluates the downloaded package via `WinVerifyTrust`
- **THEN** the updater rejects the file with a certificate trust error, purges the payload from disk, and refuses to execute installation

### Requirement: Desktop update lifecycle checks and downloads updates in background without interrupting active work
The desktop application SHALL check for software updates periodically against the generic update feed, SHALL download new packages in the background without UI freeze, SHALL set `autoInstallOnAppQuit: false` to prevent surprise restarts, and SHALL defer update installation while any background agent job remains active.

Source: `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3, Q5).

#### Scenario: Update available with no running jobs
- **GIVEN** an update has completed background download and no agent jobs are running
- **WHEN** the system status card notifies the user
- **THEN** the user can choose to restart immediately or postpone, and restart executes `quitAndInstall` cleanly

#### Scenario: Update available while an agent job is active
- **GIVEN** an update has completed background download while a job is running
- **WHEN** the update ready event triggers
- **THEN** the application suppresses automatic restart, warns the user of the active job, and prompts to wait for job completion before restarting

### Requirement: macOS native integration module provides panel presentation, hit-testing and focus restoration

The macOS platform runtime SHALL provide its own native module, separate from the Windows one and sharing no
implementation with it, which presents the pet and card windows as non-activating panels, resolves pointer
events against the character's own opaque pixels, keeps the pet visible across every workspace and over
full-screen applications, and returns keyboard focus to the application that held it before the card appeared.

Source: `spikes/SP-7-pet-window-os/macos/REPORT.md#0-ket-luan`,
`spikes/SP-7-pet-window-os/macos/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: the macOS surface is AppKit
panel style, view hit-testing, window collection behaviour and application activation, none of which has a
Win32 counterpart, so the two operating systems carry two independent native components.

#### Scenario: The pointer crosses a transparent region of the pet window

- **GIVEN** the pointer is over a fully transparent pixel of the pet window
- **WHEN** the user clicks
- **THEN** the click reaches the application underneath without a round trip through the application runtime

#### Scenario: The pointer is over the character itself

- **WHEN** the user clicks on an opaque pixel of the character
- **THEN** the pet receives the click

#### Scenario: A native component is estimated for one operating system only

- **WHEN** the native work for window integration is planned
- **THEN** the macOS module and the Windows module are counted as two components, because neither can be
  compiled or reused on the other operating system

### Requirement: macOS releases are signed with an Apple Developer ID and notarised before distribution

Every macOS package the product distributes SHALL be signed with an Apple Developer ID identity under the
hardened runtime and SHALL be notarised, because the operating system offers the user no route to open an
unnotarised download.

Source: `spikes/SP-16-signing-update/macos/REPORT.md#0-ket-luan`,
`spikes/SP-16-signing-update/macos/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-16-signing-update/macos/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED: the update loop completed with
a named signing identity, and the report records that current macOS removed the user-side bypass that earlier
versions offered for unnotarised applications.

#### Scenario: An unnotarised package reaches a user

- **GIVEN** a package that is signed but not notarised
- **WHEN** the user downloads and opens it
- **THEN** the operating system refuses to run it and offers the user no override, so the package is not a
  distributable artifact

#### Scenario: A build is produced for testing rather than distribution

- **WHEN** a package is built for local verification and not for a user
- **THEN** it may carry a development identity, and it is not published through the update feed

### Requirement: An update preserves the signing identity, so stored credentials and granted permissions survive it

An update SHALL be signed with the same identity as the version it replaces, because the operating system binds
both the user's stored credentials and any permission the user has granted to that identity, and a change of
identity revokes both.

Source: `spikes/SP-11-secure-storage/macos/REPORT.md#0-ket-luan`,
`spikes/SP-11-secure-storage/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3),
`spikes/SP-16-signing-update/macos/REPORT.md#0-ket-luan`,
`spikes/SP-22-macos-permissions/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED: an update carrying a different
identity raised an operating-system password prompt on every launch, and a refusal left the stored credentials
undecryptable.

#### Scenario: An update carries a different signing identity

- **GIVEN** a user with stored connector credentials and granted permissions
- **WHEN** an update signed with a different identity is installed
- **THEN** the user is asked for their operating-system password to reach their own credentials, and refusing
  leaves those credentials unreadable — which is why the release pipeline does not produce such an update

#### Scenario: An update carries the same signing identity

- **WHEN** an update signed with the release identity is installed
- **THEN** the stored credentials are read without prompting the user, and permissions granted to the previous
  version still apply

#### Scenario: The stored credentials cannot be decrypted after an update

- **WHEN** a credential fails to decrypt following an update
- **THEN** the product does not present the failure as a lost account, but asks the user to reconnect the
  affected platform and records the reason

### Requirement: The product's core behaviour requires no operating-system privacy permission

Showing the pet, taking a command, running a job through a connector, recording the ledger and storing
credentials SHALL work with no privacy permission granted, and any feature that needs one SHALL be separable
from that core so the product remains usable when the permission is refused.

Source: `spikes/SP-22-macos-permissions/REPORT.md#0-ket-luan`,
`spikes/SP-22-macos-permissions/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: the behaviour above was
exercised against a wiped permission state and completed with none granted. The pet's awareness of other
windows is held to geometry and application identity, which the same report measured as needing no permission,
rather than to window titles, which do.

#### Scenario: A fresh machine with no permission granted

- **GIVEN** an installation on a machine where the product has been granted nothing
- **WHEN** the user signs in, connects a platform and runs a job
- **THEN** every step completes and no operating-system permission prompt appears

#### Scenario: A feature that needs a permission is refused it

- **WHEN** the user declines a permission that an individual feature needs
- **THEN** that feature alone is unavailable and says so, and the rest of the product is unaffected

#### Scenario: A change introduces a permission into the core path

- **WHEN** a proposed change would make the core behaviour depend on a privacy permission
- **THEN** it contradicts this requirement and is refused, because a refusal would leave the product unusable

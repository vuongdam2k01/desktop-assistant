## ADDED Requirements

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

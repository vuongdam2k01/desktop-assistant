## Why

The macOS half of the platform was specified from the Windows measurements and marked unverified. Eight macOS
spikes have now measured it, and four of their findings change what the product must do rather than merely
confirming what it already does.

## Problem

`NFR-CP-01` promises the product on Windows and macOS alike, but until now every platform requirement in
`capabilities/platform` and `capabilities/pet` rested on Windows evidence. The macOS branch was deferred on
11/09/2026 with a stated exit condition — reopen before M3 — and `docs/spike-inputs.md` §5 listed the six
questions left open, graded by severity. The branch reopened and ran `SP-0/mac`, `SP-3/mac`, `SP-7/mac`,
`SP-11/mac`, `SP-12/mac`, `SP-16/mac`, `SP-18/mac` and the macOS-only `SP-22`.

Four results are not confirmations. They are constraints the specification does not currently state:

1. **Durability.** On macOS `fsync()` does not push data past the drive's own cache. `SP-12/mac` measured that
   the ledger reaches physical media only with `fullfsync`, and that switching it on costs throughput —
   28,000 writes per second falls to 241, commit latency p50 rises from 0.028 ms to 4.03 ms. Principle III
   says a record is written before the operation runs; on macOS that promise is empty without this setting,
   and no requirement states it.
2. **Signing is a correctness constraint, not a distribution formality.** `SP-11/mac` Q3 measured that a
   macOS Keychain entry is bound to the application's designated requirement. An update signed with a
   different or ad-hoc identity breaks that binding: the user is asked for their login password on every
   update, and a refusal leaves every stored credential undecryptable. `SP-16/mac` and `SP-22` measured the
   same effect on granted privacy permissions. On Windows the equivalent question was a purchasing schedule;
   on macOS it decides whether credentials survive an update at all.
3. **The native workstream is two workstreams.** `SP-7/mac` measured Electron alone passing the
   focus-preservation test 10 times out of 10 on macOS, where Windows failed 6 out of 10 and required a native
   module. But the macOS native surface that remains — hit-testing, collection behaviour, focus restoration,
   activation policy — is AppKit, sharing no code with the Win32 module. `capabilities/platform` describes one
   native module, for Windows.
4. **macOS asks for permissions and the MVP needs none.** `SP-22` ran the MVP behaviour against a wiped
   permission state and completed it with zero privacy permissions granted. Nothing in the specification says
   this, so nothing prevents a later change from quietly introducing a screen-recording prompt into onboarding.

## Cost of inaction

The specification would continue to describe a Windows product with macOS assumed to follow. Implementation
would take the ledger's durability setting from the Windows default and lose committed records on macOS power
loss — a silent breach of Principle III, discovered after data is gone. Signing would be scheduled as a
release-week task and the first auto-update would lock every beta user out of their own connectors. The native
estimate would cover one operating system. None of these are visible until they fail on a user's machine.

## Options

### Option A — Record the macOS findings as platform-conditioned requirements in the existing capabilities
- **Sketch**: Nothing changes for the user. The specification gains requirements that state the durability
  setting, the signing constraint, the second native module and the zero-permission floor, each conditioned on
  the operating system where it applies and each citing the measurement behind it.
- **Appetite**: small
- **Trade-offs**: Keeps one specification describing one product, with the platform difference stated inside
  the requirement that owns the behaviour. Costs some verbosity, because several requirements must now say
  "on macOS" and "on Windows" in the same sentence.
- **Rabbit holes**: Writing the mechanism rather than the obligation. The requirement is that a committed
  record survives power loss; `PRAGMA fullfsync` is how it is met today and belongs in the design, not in the
  requirement text.

### Option B — Minimum viable slice: record only the durability and signing constraints
- **Sketch**: The two findings that can destroy user data are specified; the native scope and the permission
  floor stay as spike evidence only.
- **Appetite**: small
- **Trade-offs**: Cheaper now, and it covers the two failures that lose data. But the native scope feeds an
  M1 estimate that is currently half the true size, and an unstated permission floor is exactly the kind of
  thing a later change erodes without noticing.
- **Rabbit holes**: None; the risk is what it leaves out.

## Recommendation

Option A. All four findings are measured, and the two omitted by Option B are the ones that shape work already
being planned — the native module estimate for M1 and the macOS onboarding flow. The cost difference between
the options is a page of specification.

## What Changes

- The ledger states that a record reported as written survives sudden power loss, and that the guarantee is
  bought on macOS with a physical-flush setting confined to the ledger and job stores.
- The platform states the macOS native integration module as a separate component from the Windows one, with
  its own surface.
- The platform states that macOS releases carry an Apple Developer ID signature and notarisation, and that an
  update preserves the signing identity so that stored credentials and granted permissions survive it.
- The platform states that the product's core behaviour requires no operating-system privacy permission.
- The pet states that presenting the speech bubble on macOS takes no keyboard focus without native code, and
  that returning focus to the previously active application does require it.
- The application window states that the product's Dock presence follows whether the management window is open.
- The interface states that the pet is withheld from screen-sharing and recording streams, and that a denied
  permission degrades its feature and says so in a system card.
- The backend states that the update manifest and package format are served per operating system and per
  processor architecture.

No requirement is removed and no existing behaviour is contradicted, so nothing here is **BREAKING**.

## Capabilities

REQUIRES spec-impact — persistent storage behaviour is touched (ledger durability) and existing capabilities
are modified.

### New Capabilities

None. Every finding belongs to a capability that already exists.

### Modified Capabilities

- `ledger`: adds physical durability of a committed record, which the capability previously left to the store.
- `platform`: adds the macOS native integration module, macOS signing and notarisation, update-identity
  continuity, and the zero-permission floor.
- `pet`: adds macOS focus behaviour when the speech bubble appears, and focus restoration afterwards.
- `app`: adds Dock presence following the management window, and onboarding completing without a permission
  prompt.
- `uix`: adds withholding the pet from screen sharing, and the system card shown when a permission is denied.
- `backend`: adds per-operating-system and per-architecture update manifests.

## Impact

Persistent storage: the ledger and job stores open with a different durability setting on macOS, which changes
write throughput by two orders of magnitude and must be accounted for wherever a write rate is assumed.
Release pipeline: macOS artifacts are per-architecture archives with a separate manifest, signed and notarised
with an Apple Developer ID, which the update manifest service must serve alongside the Windows feed.
Native components: a second native module in AppKit, sized and scheduled independently of the Win32 one.
Procurement: an Apple Developer Program membership becomes a precondition of the first macOS distribution.

## Refs

None. This project declares no upstream traceability anchor; `NFR-CP-01`, `NFR-SEC-01`, `NFR-SEC-02`,
`NFR-RL-03`, `FR-INT-04`, `FR-PET-03`, `FR-APP-04`, `FR-APP-06`, `FR-BE-09` and `FR-BE-12` are named as
background material only.

## Constitution check

- **Principle III (Ledger Before Act, Append-Only)** — this change is what makes the principle true on macOS.
  Without a physical flush, a record the store reported as written can be lost to power failure, so the
  operation would have run against a record that no longer exists. No violation; a gap is closed.
- **Principle VII (Account-Owned Data)** — the macOS measurement confirms that a device's stored credentials
  are bound to that device, so recovery on a new machine rests entirely on replication from the account. No
  change to the principle; the evidence strengthens the reason it exists.
- **Constitutional invariant "Evidence Discipline"** — every requirement added here cites a macOS spike
  report section. The items the Mac mini could not measure — a 120 Hz display, mixed-scale displays, battery
  drain, the notch, Sidecar — stay marked unverified and are not specified.

No clause is violated and nothing requires justification in Complexity Tracking.

## Assumptions

- The macOS reports' conclusions are taken as measured. They cite evidence files under each spike's
  `macos/evidence/`, and the review of those reports found no conclusion resting on vendor documentation.
- The single measured machine — Apple Silicon, macOS 26.5.2, APFS with FileVault on — is treated as
  representative of Apple Silicon Macs. An Intel Mac is not covered by these measurements, and the
  requirements are written so that a per-architecture difference would be a new finding rather than a
  contradiction.
- The throughput measured for the durable setting, 241 writes per second, is assumed sufficient because a
  ledger write accompanies a tool call whose own latency is measured in hundreds of milliseconds. If a future
  design writes the ledger in tight loops, this assumption has to be revisited.

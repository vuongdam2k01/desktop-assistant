## ADDED Requirements

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

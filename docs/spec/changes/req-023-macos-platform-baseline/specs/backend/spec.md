## ADDED Requirements

### Requirement: The update manifest is served per operating system and per processor architecture

The update manifest service SHALL publish a separate manifest for each supported operating system and each
processor architecture, and SHALL serve for each the package format that operating system's updater can install,
so that a client is never offered a package it cannot apply.

Source: `spikes/SP-16-signing-update/macos/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-16-signing-update/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4),
`spikes/SP-12-sqlite-ledger/macos/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: the macOS updater reads a
manifest of its own and installs from an archive rather than from the disk image the user downloads by hand,
and a package combining both processor architectures is offered as a manual download rather than through the
update feed.

#### Scenario: A client asks for updates

- **WHEN** a client checks for an update
- **THEN** it receives the manifest for its own operating system and processor architecture, naming a package
  its updater can install

#### Scenario: A release is published for one operating system only

- **WHEN** a release is published for one operating system
- **THEN** clients on the other operating system continue to see their current version as the latest, and are
  not offered the package

#### Scenario: A package format the updater cannot install is published

- **WHEN** a manifest would name a package format that the client's updater cannot apply
- **THEN** the manifest is rejected at publication rather than failing on the user's machine

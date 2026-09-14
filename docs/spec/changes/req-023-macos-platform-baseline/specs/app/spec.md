## ADDED Requirements

### Requirement: The product's presence in the macOS Dock follows whether the management window is open

On macOS the product SHALL appear in the Dock and the application switcher while its management window is open,
and SHALL withdraw from both while only the pet is on screen, so that the pet alone never occupies a Dock slot
and the management window is never unreachable from the switcher.

Source: `spikes/SP-7-pet-window-os/macos/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-7-pet-window-os/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7) — VERIFIED: Dock presence on macOS is a
property of the whole application rather than of an individual window, so the two-window architecture requires
this to be switched as windows open and close rather than set once.

#### Scenario: Only the pet is on screen

- **WHEN** the management window is closed and the pet is visible
- **THEN** the product has no Dock icon and does not appear in the application switcher

#### Scenario: The user opens the management window

- **WHEN** the management window opens
- **THEN** the product appears in the Dock and in the application switcher, and the window can be raised from
  either

#### Scenario: The user closes the management window while a job is running

- **WHEN** the management window closes while a job continues in the background
- **THEN** the product withdraws from the Dock, the job keeps running, and the pet remains the way back in

### Requirement: Onboarding on macOS completes without an operating-system permission prompt

The onboarding sequence on macOS SHALL carry the user from first launch to a completed sample job without any
operating-system privacy prompt and without asking the user to open system settings.

Source: `spikes/SP-22-macos-permissions/REPORT.md#0-ket-luan`,
`spikes/SP-22-macos-permissions/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: the sequence was run against a
wiped permission state and completed with none granted.

#### Scenario: First launch on a machine that has never run the product

- **GIVEN** a machine where the product has been granted no permission
- **WHEN** the user completes onboarding
- **THEN** no permission prompt appears and the user is never sent to system settings

#### Scenario: A step would require a permission

- **WHEN** an onboarding step is proposed that needs a privacy permission
- **THEN** it does not belong in onboarding, and the feature behind it asks for the permission when the user
  first reaches for that feature

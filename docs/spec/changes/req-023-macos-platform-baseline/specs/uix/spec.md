## ADDED Requirements

### Requirement: The pet is withheld from screen sharing and screen recording

The pet window and its speech bubble SHALL be excluded from the frames another application captures when the
user shares or records their screen, so that presenting or recording does not broadcast the pet or the contents
of its bubble to an audience.

Source: `spikes/SP-18-pet-liveness/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q29) — VERIFIED on macOS: window content
protection removes the window from other applications' capture streams while leaving it visible to the user.

#### Scenario: The user shares their screen in a meeting

- **GIVEN** the pet is on screen with a notification in its bubble
- **WHEN** the user shares their screen
- **THEN** the audience sees the desktop without the pet and without the bubble's contents

#### Scenario: The user records their screen

- **WHEN** a screen recording is made
- **THEN** the resulting file does not contain the pet

#### Scenario: The user is looking at their own screen

- **WHEN** sharing is active
- **THEN** the pet remains visible to the user on their own display, and remains usable

### Requirement: A refused operating-system permission degrades one feature and explains it

When the user refuses a permission that a feature needs, that feature SHALL stop offering itself rather than
failing repeatedly, a system card SHALL state which feature is unavailable and what to grant to restore it, and
the card SHALL NOT reappear unprompted after the user has dismissed it once.

Source: `spikes/SP-22-macos-permissions/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`,
`spikes/SP-22-macos-permissions/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED for the detection: the product can
read whether a permission is held without raising a prompt, which is what allows the feature to withdraw
quietly instead of provoking the operating system.

#### Scenario: The user declines a permission a feature needs

- **GIVEN** a feature that needs a privacy permission
- **WHEN** the user declines it
- **THEN** a system card names the feature, says what is needed and how to grant it, and the feature stops
  presenting itself

#### Scenario: The user dismisses the card

- **WHEN** the user dismisses the card without granting the permission
- **THEN** the card does not return on its own, and the feature stays withdrawn until the user asks for it

#### Scenario: The permission is granted later

- **WHEN** the user grants the permission afterwards
- **THEN** the feature becomes available again without the user having to reinstall or reconfigure anything

## ADDED Requirements

### Requirement: Presenting the speech bubble on macOS takes no keyboard focus

On macOS the speech bubble SHALL appear without the application becoming active and without the keyboard focus
leaving the window the user is typing in, and this SHALL hold using the window presentation the desktop
framework already offers, without a native component.

Source: `spikes/SP-7-pet-window-os/macos/REPORT.md#0-ket-luan`,
`spikes/SP-7-pet-window-os/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1),
`spikes/SP-18-pet-liveness/macos/REPORT.md#0-ket-luan` — VERIFIED: 10 runs of 10 lost no character while the
bubble opened mid-typing, and 10 further runs lost none while the pet was also moving. The same test fails 6
times in 10 on Windows, which is why Windows carries a native component for this and macOS does not.

#### Scenario: The bubble opens while the user is typing

- **GIVEN** the user is typing into another application
- **WHEN** the pet opens its speech bubble unprompted
- **THEN** every keystroke reaches the application the user was typing in, and the caret stays where it was

#### Scenario: The bubble opens while the pet is moving

- **GIVEN** the pet is moving across the screen and the user is typing
- **WHEN** the bubble opens
- **THEN** no keystroke is lost

#### Scenario: The user addresses the pet deliberately

- **WHEN** the user clicks the pet to type a command
- **THEN** focus moves to the bubble, because the user asked for it

### Requirement: Returning focus to the previously active application requires native support on macOS

When the speech bubble closes after the user has typed into it, focus SHALL return to the application that held
it before the bubble opened, and on macOS this SHALL be performed by the platform's native integration module
because the desktop framework alone cannot restore another application's activation.

Source: `spikes/SP-18-pet-liveness/macos/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q30),
`spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: restoring the prior application
required activating it through native application control, which is why this obligation sits with the native
module and enlarges its scope beyond hit-testing.

#### Scenario: The user dismisses the bubble

- **GIVEN** the user was working in an editor before opening the bubble
- **WHEN** the user presses Escape or clicks outside the bubble
- **THEN** the editor is active again and receives the next keystroke

#### Scenario: The previously active application has closed

- **WHEN** the bubble closes and the application that previously held focus no longer exists
- **THEN** the product leaves focus where the operating system places it and does not activate itself in that
  application's place

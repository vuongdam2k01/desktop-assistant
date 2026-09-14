## ADDED Requirements

### Requirement: Pet locomotion and screen context awareness with caret avoidance
The pet locomotion engine SHALL move the pet window across connected displays at up to 60 frames per second using non-activating window placement, SHALL maintain a minimum 150-pixel buffer zone around the user's active typing caret position to prevent visual obstruction, and SHALL avoid occupying the active user interaction zone.

Source: `spikes/SP-18-pet-liveness/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q14, Q16, Q17),
`spikes/SP-18-pet-liveness/macos/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q14, Q16, Q17).

#### Scenario: User types in an editor near the pet
- **GIVEN** the pet is idling within 150 pixels of the active text caret
- **WHEN** the user types characters into the foreground editor
- **THEN** the pet detects the caret coordinate within 10 milliseconds and animates away outside the 150-pixel buffer zone without stealing keyboard focus or dropping keystrokes

#### Scenario: Continuous movement during active high-speed typing
- **GIVEN** the pet is actively moving between screen waypoints at 60 frames per second
- **WHEN** the user types continuously at high speed (25ms per keystroke) into a text editor
- **THEN** 100% of user keystrokes reach the editor with exactly zero dropped characters

### Requirement: Two-layer animation state machine combining locomotion and work status
The pet animation controller SHALL combine a locomotion state layer (standing, walking, dragged, falling) with a work status state layer (idle, receiving_order, working, waiting_approval, has_result) in the Rive runtime, maintaining 60 frames per second with zero stutter during simultaneous motion and status transitions.

Source: `spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q19, Q20).

#### Scenario: Job status changes while pet is walking
- **GIVEN** the pet is in locomotion state `walking`
- **WHEN** a job event changes the work status from `idle` to `working`
- **THEN** the pet transitions its work status animation smoothly while continuing its walking locomotion without dropped frames or visual hitching

#### Scenario: User grabs pet during autonomous movement
- **WHEN** the user presses mouse button down over the character body while the pet is moving
- **THEN** the locomotion layer instantly transitions to `dragged` and tracks the cursor trajectory with latency under 10 milliseconds

## ADDED Requirements

### Requirement: A non-blocking SYSTEM status card announces backend disruption and activates a pet badge

When a command cannot be immediately dispatched due to backend service disruption, the interface SHALL present a `SYSTEM` status card conforming to Appendix A.2 that is non-blocking (`isBlocking: false`), does not auto-dismiss (`autoDismiss: false`), displays a single-line explanation of local queueing and a single-line recovery action, and displays an active indicator badge on the pet window.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q9 — VERIFIED that the SYSTEM card reports the `BACKEND_DISRUPTED` condition, remains non-blocking so the composer stays usable, and anchors a visible badge to the pet.

#### Scenario: Backend disruption triggers status card and pet badge
- **GIVEN** a command failed to reach the backend service and entered the local offline queue
- **WHEN** the queueing event completes
- **THEN** a `SYSTEM` card appears explaining that commands are safely queued locally, the composer remains interactive, and a status badge appears on the pet

#### Scenario: Multiple queued commands share a single status card
- **GIVEN** a `SYSTEM` card is already active for backend disruption
- **WHEN** a second command enters the offline queue
- **THEN** no duplicate card is created; the existing status card updates its counter to reflect the total count of queued items

### Requirement: Disruption status card and badge dismiss automatically upon queue drain

When the offline command queue has drained all `QUEUED_OFFLINE` items and confirmed synchronization with the backend, the interface SHALL automatically dismiss the backend disruption `SYSTEM` card and remove the associated badge from the pet window without requiring manual user dismissal.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q9, Q10 — VERIFIED that completion of the queue sync automatically clears the disruption notification and deactivates the pet badge.

#### Scenario: Queue completes drain on connection recovery
- **GIVEN** an active `SYSTEM` card and pet badge indicating queued offline commands
- **WHEN** the background drain worker finishes syncing the last queued command
- **THEN** the `SYSTEM` status card is automatically dismissed and the badge is cleared from the pet window

### Requirement: Interactive inquiry card presents structured options and free-text input

When an agent invokes `ask_user`, the user interface SHALL render an interactive prompt displaying the question text, clickable chips for each provided option (up to 4), and a text entry field if `allow_free_text` is true, and upon timeout SHALL collapse into a pet badge.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q1, Q6 — VERIFIED that options and free-text fields are rendered, and unanswered cards collapse to badges on timeout.

#### Scenario: Inquiry renders option chips and text input
- **GIVEN** an agent calls `ask_user` with three options and `allow_free_text: true`
- **WHEN** the card renders for the user
- **THEN** three distinct option buttons and a text input box are displayed

#### Scenario: Timeout collapses inquiry into pet badge
- **GIVEN** an active inquiry card has been displayed for 30 minutes without interaction
- **WHEN** the timeout expires
- **THEN** the expanded card is dismissed and a badge indicating pending input is pinned to the pet window

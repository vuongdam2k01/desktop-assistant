## ADDED Requirements

### Requirement: Commands submitted during backend disruption persist in a durable local queue

When a user submits a command via the composer while the backend service is unreachable, the client SHALL persist the command in the local SQLite `offline_command_queue` table with an initial status of `QUEUED_OFFLINE`, a unique client-generated UUID `idempotency_key`, and an integer millisecond timestamp, and SHALL acknowledge receipt to the user without crashing or reporting a fatal error.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q8, Q12 — VERIFIED that commands submitted during simulated backend outages persist in SQLite and survive application restarts without data loss.

#### Scenario: Command accepted during backend outage
- **GIVEN** the backend intake service is offline or unreachable
- **WHEN** the user submits a command through the composer
- **THEN** the command is stored in `offline_command_queue` with status `QUEUED_OFFLINE` and a generated `idempotency_key`, and the composer confirms receipt

#### Scenario: Queued commands survive application restart
- **GIVEN** two commands are stored in `offline_command_queue` with status `QUEUED_OFFLINE`
- **WHEN** the application process is terminated and relaunched before connectivity is restored
- **THEN** on startup, both commands are present in the database with their text, timestamps, and idempotency keys fully intact

### Requirement: Offline commands drain in chronological FIFO order with duplicate suppression

When backend connectivity is restored, the queue drain worker SHALL transmit queued commands to the backend intake endpoint in strict chronological FIFO order (`ORDER BY created_at ASC`), SHALL attach the `idempotency_key` to each payload to ensure deduplication on the backend, and upon successful receipt or deduplication acknowledgement SHALL update the local status to `SYNCED`.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q10 — VERIFIED that 3 queued commands are processed by the backend in exact submission order, and repeated dispatches are deduplicated with zero redundant executions.

#### Scenario: Chronological draining upon connection recovery
- **GIVEN** three commands were queued offline at sequential timestamps T1, T2, and T3
- **WHEN** backend service becomes reachable
- **THEN** the drain worker sends command T1, receives confirmation, sends command T2, receives confirmation, and sends command T3 in strict sequence

#### Scenario: Duplicate transmission suppression
- **GIVEN** a network interruption occurred after the backend received a command but before the client received the HTTP response
- **WHEN** the client retransmits the command with the same `idempotency_key`
- **THEN** the backend recognizes the existing key, returns a deduplicated success response, and the client marks the local entry as `SYNCED` without duplicating the command

### Requirement: User can inspect, edit, or cancel queued offline commands

The application interface SHALL provide an affordance allowing the user to view all commands currently holding status `QUEUED_OFFLINE`, to edit the text of an individual queued command before it is transmitted, and to cancel and delete a queued command before dispatch.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §4 — Identified risk where users submit conflicting commands during an extended outage; mitigating UX allows inspection and removal.

#### Scenario: User cancels a superseded offline command
- **GIVEN** a command is queued with status `QUEUED_OFFLINE`
- **WHEN** the user opens the offline queue manager and selects "Cancel" on that command
- **THEN** the command is marked as cancelled or deleted from the queue and is never dispatched to the backend upon reconnection

#### Scenario: User edits a queued command
- **GIVEN** a command is queued with status `QUEUED_OFFLINE`
- **WHEN** the user edits the text of the command and saves the change
- **THEN** the `command_text` column in `offline_command_queue` is updated while preserving the original `idempotency_key` and timestamp

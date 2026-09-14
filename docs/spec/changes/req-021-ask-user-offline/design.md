# Design: req-021-ask-user-offline

## Context

Desktop Assistant uses an agentic loop where worker agents plan and execute multi-step tasks. In many real-world scenarios, a user prompt lacks essential parameters (such as a database name, priority level, or target path). To resolve ambiguities without failing the run, the agent must be able to ask a targeted clarification question mid-run (`ask_user`).

However, two architectural risks arise:
1. **Unbounded Prompt Flooding & Gate Evasion**: An agent could issue multiple simultaneous questions, overwhelming the user. Worse, an agent blocked by a hard security gate (e.g. deleting a protected resource) could attempt to ask the user for verbal permission in conversational text to evade the gate.
2. **Silent Work Loss during Backend Outages**: When the user enters commands while the backend server or network is unreachable, failing or silently dropping the command destroys user trust. The command must be safely persisted locally, executed without duplicates once connectivity recovers, and presented transparently to the user via non-blocking UI notifications.

These mechanisms were verified in `spikes/SP-21-ask-user-offline/REPORT.md`.

## Goals / Non-Goals

**Goals:**
- Provide a structured `ask_user` tool with up to 4 quick options and free-text entry.
- Enforce the constraint of at most one open inquiry per job at the runtime harness level.
- Ensure conversational user answers cannot override or satisfy deterministic hard gate security hooks.
- Persist offline commands in a durable local SQLite table surviving process crashes and restarts.
- Drain offline commands in strict chronological FIFO order with backend deduplication via unique idempotency keys.
- Display a non-blocking `SYSTEM` status card and pet badge during backend disruption that automatically dismisses upon queue drain.

**Non-Goals:**
- Replicating unsent offline commands across multiple devices. Unsent commands are strictly device-bound until accepted by the backend as active jobs.
- Full offline execution of operations that fundamentally require network access.
- Arbitrary multi-turn nested interrogation within a single tool call.

## Structure

| Component | Responsibility | Model Entity | Reached Through |
| --- | --- | --- | --- |
| **AskUserManager** | Manages in-flight inquiry promises per job, enforces 1-ask limit, manages 30-min timeout, bridges UI response to agent loop | `Pending Ask Slot` | In-memory service in Main Process |
| **ToolWrapper** | Intercepts `ask_user` invocations, validates TypeBox schema, enforces hard gate independence | `Ask Inquiry`, `Decision Record` | `agent/contracts/ask-user@0.1.0` |
| **OfflineCommandQueue** | Manages SQLite storage for unsent commands, generates idempotency keys | `Offline Command`, `Idempotency Key` | `app/contracts/offline-queue@0.1.0` |
| **OfflineDrainWorker** | Detects backend reconnection, drains queued items sequentially in FIFO order | `Offline Command` | Background worker in Main Process |
| **StatusCardPresenter** | Renders non-blocking `SYSTEM` card and updates pet window badge | `Disruption Notification` | IPC to Pet & App Renderers |

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `agent:ask_user` | Worker -> Main | Request-Response | `AskUserParams` | `AskUserResult` | Enters `waiting_input`, suspends execution | Harness rejects if 2nd ask emitted; 30m timeout |
| `POST /api/v1/commands/intake` | Main -> Backend | Request-Response | `IntakeCommandPayload` | `IntakeCommandResponse` | Ingests command, creates Job | Network failure triggers local queueing; 5s timeout |
| `app:offline_queue:updated` | Main -> Renderers | Pub-Sub | `{ queueCount: number }` | Void | Updates card badge | Non-blocking broadcast |
| `app:offline_queue:cancel` | Renderer -> Main | Request-Response | `{ id: string }` | `{ success: boolean }` | Marks status `CANCELLED` | Returns false if already sending |

### Execution Boundaries & Isolation

- **Main Process (Node.js)**: Owns SQLite database (`desktop-assistant.db`), `AskUserManager`, `OfflineCommandQueue`, and the `OfflineDrainWorker`.
- **Worker Agent**: Runs isolated agent loops using `@earendil-works/pi-agent-core`. Connects directly to LLM providers (BytePlus Ark / OpenAI) via TLS without passing prompt streams through the local backend.
- **Renderers (Pet and App)**: Completely decoupled from direct database access. Receive state notifications and trigger user responses through asynchronous Electron IPC.

### Trust Boundaries & Input Validation

- **User Free Text in `ask_user`**: Treated as untrusted conversational input. Filtered into the prompt transcript as conversational ground truth, but strictly isolated from security authorization logic.
- **Offline Command Intake**: Verified by Composer schema upon submission. Idempotency keys generated using cryptographically strong UUIDv4.

## Decisions

### D1 — Runtime-Enforced Single Ask Constraint vs UI Buffering
- **Choice**: Enforce the ceiling of at most one open inquiry per job at the runtime harness level (`AskUserManager`), rejecting subsequent calls with `MAX_ONE_PENDING_ASK_EXCEEDED`.
- **Rationale**: Buffering questions in the UI allows the agent loop to continue spawning diverging reasoning branches while waiting, producing an unmanageable pile of unordered prompts. Runtime rejection forces the agent to consolidate inquiries per FR-AG-05.
- **Alternatives Considered**: UI-only buffering was rejected because it conceals the agent's concurrency error and leaves multiple unresolved promises hanging in memory.

### D2 — Authoritative Ground Truth for Free-Text (Case E9)
- **Choice**: When a user inputs free text that contradicts all provided option chips, the agent treats the free text as authoritative ground truth and continues execution without forcing re-prompting.
- **Rationale**: User autonomy is paramount. In SP-21 test 4B, forcing option selection caused infinite loops or user frustration when reality diverged from the agent's pre-computed options.
- **Alternatives Considered**: Strict validation rejecting free text was rejected because option lists cannot foresee every edge case.

### D3 — 30-Minute Timeout Transition to Suspended State
- **Choice**: If an inquiry remains unanswered after 30 minutes, the job transitions from `waiting_input` to `suspended`, cleans up in-memory promises, and collapses the UI card into a pet badge.
- **Rationale**: Prevents memory leaks and zombie Node.js event loop listeners. The user can resume at their leisure from the app window via `agent.continue()`.
- **Alternatives Considered**: Failing the job on timeout was rejected because users frequently step away from their desk, and discarding multi-step progress is destructive.

### D4 — Shared SQLite Database File (`desktop-assistant.db`)
- **Choice**: Store `offline_command_queue` in the same SQLite file as the ledger and job records, in a separate dedicated table.
- **Rationale**: SP-21 §1 Q12 evaluated single vs. multiple files. A single file provides ACID transaction atomicity, avoids OS file locking collisions on Windows/macOS, consolidates connection pooling, and unifies schema migrations.
- **Alternatives Considered**: A separate `queue.db` file was rejected due to lack of cross-db transactions and doubled file handles.

### D5 — Strictly Non-Replicated Offline Commands
- **Choice**: Queued offline commands are device-bound and are NOT replicated across devices via account sync until the backend successfully receives and converts them into jobs.
- **Rationale**: Replicating unsubmitted commands would cause two devices to dispatch the same command independently upon reconnecting, causing race conditions and duplicate executions.
- **Alternatives Considered**: Replicating queue rows was rejected as an unnecessary distributed consensus problem.

### D6 — Hard Gate Isolation (Anti-Evasion)
- **Choice**: Tool security hooks and cryptographic approval tokens are evaluated inside the private closure of the tool wrapper, completely independent of the LLM's conversation transcript.
- **Rationale**: Prevents conversational jailbreaking or social engineering where an agent asks the user "Do you allow me to bypass the gate?" and attempts to treat the affirmative response as authorization.
- **Alternatives Considered**: Allowing the agent to pass user confirmation to the gate was rejected as a direct violation of Constitution Principle II.

## Extensibility & Fallback Strategy

### Multi-Level Fallback Hierarchy

- **Tier 1 (Transient Network Glitch)**: Backend intake returns 503 or network timeout ──> Immediate fallback to local SQLite enqueue (`QUEUED_OFFLINE`), display non-blocking `SYSTEM` card, composer remains active.
- **Tier 2 (Connection Recovery & Drain)**: Network restored ──> Drain worker dispatches items in FIFO order. If server reports duplicate idempotency key ──> Handled as success (`SYNCED`), suppressing redundant processing.
- **Tier 3 (Permanent Outage / Local Queue Overflow)**: Extended outage with queue reaching 1,000 items ──> Display warning card to user, maintain existing queue, allow user to inspect, edit, or cancel individual queued items.

## Complexity Tracking

None — all designs strictly comply with Constitution Principles I through VI.

## Research

None — all 12 technical questions from SP-21 were answered and verified empirically.

## Migration & Rollback

- **Database Migration**: Schema version increment adds table `offline_command_queue` and index `idx_offline_queue_drain`. Purely additive, fully backward-compatible.
- **Rollback**: Dropping table `offline_command_queue` cleanly reverts the feature without affecting ledger or job history.

## Risks / Trade-offs

- **Risk: User submits conflicting commands during extended outage** → Mitigated by providing an inspection/cancellation affordance in the App Window allowing users to remove or edit queued commands before dispatch.
- **Risk: Process crash during `waiting_input`** → Mitigated by checkpointing the session transcript and job state in SQLite; cold resume restores state on restart without re-executing completed steps.

## Open Questions

None.

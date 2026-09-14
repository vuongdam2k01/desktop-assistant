# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | The proposal bounds the change to two core mechanisms: the runtime-enforced `ask_user` contract with single-pending-question constraint, and the durable local offline command queue with FIFO drain and deduplication. Replicating unsent commands is explicitly out of scope (device-bound until submitted). |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | Settled by Q-1, Q-3, and Q-4: the `ask_user` parameter and return schemas, the `waiting_input` and `suspended` job lifecycle states, the `decision` ledger record, and the `offline_command_queue` table DDL with idempotency keys. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Clear | Settled by Q-3 and Q-4: non-blocking SYSTEM card for backend disruption with pet badge, interactive prompt bubble/card for `ask_user`, timeout collapse to badge, and affordance in app window to inspect/edit/cancel queued commands before dispatch. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | Measurements from `spikes/SP-21-ask-user-offline/REPORT.md`: 0-step repetition on resume, 100% hook evasion prevention at tool closure, zero loss of queued commands across crash/restart, and direct provider streaming uninterrupted during backend outage. |
| Integration & external dependencies (external services, formats, versions) | Clear | Integrates with `@earendil-works/pi-agent-core` (0.85.1) harness, SQLite (`better-sqlite3` 13.0.3) local database, and Fastify backend intake endpoint (`POST /api/v1/commands/intake`). |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Settled by Q-2, Q-3, and Q-5: agent attempting multiple concurrent asks, user free-text contradicting options (E9), 30-minute timeout expiration, backend offline during intake, network hiccup causing duplicate dispatch, and agent attempting to use free-text approval to override hook restrictions. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Runtime vs. UI-level enforcement of the single-ask constraint (Option A vs. Option B in proposal); single SQLite file vs. separate database files for queue and ledger (settled in Q-4). |
| Terminology & consistency (standard terms, terms to avoid) | Clear | Standard terms: `ask_user`, `waiting_input`, `suspended`, `QUEUED_OFFLINE`, `idempotency_key`, `SYSTEM card`, `decision ledger record`. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | SP-21 test harnesses (Q1–Q12) form the acceptance test criteria and are referenced in `verification.md`. |
| Placeholders (TODOs, unquantified adjectives) | Clear | All schemas, DDL, timeouts (30 minutes), option counts (0–4), and label limits (30 characters) are explicitly quantified. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | Settled by Q-4: stored in single SQLite file `desktop-assistant.db` at `app.getPath('userData')`; ephemeral memory promises cleaned up on suspension. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | The `ask_user` tool is registered via the standard harness tool wrapper as an internal agent tool; queue drainer is a background service in the Electron main process. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | Main process owns SQLite and backend HTTP client; renderer processes (Pet and App) interact via IPC; direct LLM streaming flows directly from client process to provider without passing through backend. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | Complete offline resilience specified: ongoing jobs continue uninterrupted during backend outage (ADR-007); commands queue locally and drain automatically in FIFO order when connectivity resumes. |

## Sessions

### Session 2026-09-12 — decisions delegated to the drafting agent

The decision-maker directed that these questions be answered by the agent rather than put to them one at a time, choosing the option that best fits `docs/raw-idea/prd-mvp.md`, `docs/spec/constitution.md`, and the empirical evidence in `spikes/SP-21-ask-user-offline/REPORT.md`.

- Q-1: What is the exact parameter and return schema for the `ask_user` tool, and how does it handle free-text answers contradicting provided options (Edge Case E9)? → A: **The `ask_user` tool accepts a structured object containing `question` (string), `options` (optional array of 0 to 4 items with `id` and `label` <= 30 chars, plus optional `description`), and `allow_free_text` (boolean, default true). The return value is `{ answer: { option_id?: string, text?: string } }`. In Edge Case E9 where free text contradicts all options, the agent SHALL treat the user's free text as the authoritative ground truth, overriding the options without forcing re-selection.**
  Rejected: **Enforcing strict selection from options only**, which frustrates users when none of the pre-computed options match reality; and **discarding free text when options are present**, which violates user agency and the findings of SP-21 test 4B.
  (patched: `contracts/ask-user.md`, `specs/agent/spec.md`, `model.md`)

- Q-2: How is the constraint of "at most one pending ask per job" enforced, and what does the harness return to the agent on violation? → A: **The constraint is enforced strictly at the runtime harness level by `AskUserManager`, not merely at the UI presentation layer. If an agent attempts to call `ask_user` while an ask is already open for that job, the runtime immediately rejects the execution with error code `MAX_ONE_PENDING_ASK_EXCEEDED` and guidance to merge missing questions into a single inquiry per FR-AG-05.**
  Rejected: **Silently buffering multiple questions in the UI**, which creates an unordered pile of prompts for the user and obscures the agent's reasoning thread; and **killing the job on a second ask**, which would destroy in-progress work over a recoverable coordination mistake.
  (patched: `specs/agent/spec.md`, `contracts/ask-user.md`, `design.md`)

- Q-3: What is the lifecycle transition and cleanup when a job in `waiting_input` exceeds the timeout limit (default 30 minutes)? → A: **When the 30-minute timer expires without user response, the job transitions from `waiting_input` to `suspended`. In-memory promises and listeners are deallocated to prevent memory leaks and ghost processes; the blocking UI card collapses to a non-intrusive badge on the pet; and the user can later resume the job from the main application window by providing the late answer, which appends to the transcript and calls `agent.continue()`.**
  Rejected: **Terminating the job with failure on timeout**, which loses all preceding work; and **leaving the promise open in memory indefinitely**, which leaks memory and leaves zombie agent loops active.
  (patched: `specs/job/spec.md`, `model.md`, `design.md`)

- Q-4: Where and how are offline commands persisted, deduplicated, and drained when the backend is unreachable? → A: **Offline commands are persisted in the `offline_command_queue` table in the shared `desktop-assistant.db` SQLite database file (same file as ledger and jobs) with an initial status of `QUEUED_OFFLINE` and a client-generated UUID `idempotency_key`. A background drainer monitors connectivity and drains the queue in strict FIFO order (`ORDER BY created_at ASC`). The backend intake endpoint deduplicates requests using `idempotency_key`, returning `status: "deduplicated"` on repeated dispatches. Commands synced successfully are retained for 7 days before garbage collection.**
  Rejected: **Using a separate SQLite file for the queue**, which breaks transactional atomicity between queue and job state and doubles file handles; and **in-memory-only queueing**, which loses all user commands if the application closes or crashes before connectivity is restored.
  (patched: `specs/app/spec.md`, `contracts/offline-queue.md`, `model.md`, `design.md`)

- Q-5: How does the system prevent the agent from using `ask_user` to evade hard approval gates or security hooks (e.g. asking the user for verbal permission to delete a protected resource)? → A: **The Hook Evaluator is located inside the tool wrapper's `.execute` closure (the Hard Gate) and evaluates deterministic security rules and cryptographic approval tokens independently of the LLM's conversation transcript. The text returned from `ask_user` is treated strictly as conversational data, NEVER as authorization or capability tokens. Even if the user says "I authorize you to bypass the gate", the tool wrapper still enforces the hook and blocks execution.**
  Rejected: **Allowing the model to interpret user text as an approval override**, which completely breaks Principle II of the Constitution and bypasses deterministic safety; and **disabling `ask_user` whenever sensitive tools are registered**, which prevents legitimate non-privileged clarifications.
  (patched: `specs/agent/spec.md`, `design.md`, `verification.md`)

## Assumptions

- A single desktop device owns its `offline_command_queue`; queued commands are never replicated across devices until converted into active jobs and ledger entries.
- The default timeout for an unanswered `ask_user` prompt is 1,800,000 ms (30 minutes), matching the approval card timeout.
- The Composer interface provides immediate visual feedback when an offline command is queued and displays a non-blocking SYSTEM card.
- The UI allows the user to inspect, edit, or remove commands from the local queue before they are dispatched.

## Open

None — all technical and operational questions have been verified by SPIKE-21 and resolved above.

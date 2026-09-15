# Implementation Report: F2 Job Manager & Vòng Đời Job

- **Task**: F2 Job Manager & Vòng đời job (`packages/job-manager`)
- **Date**: 2026-09-15
- **Host**: Linux x64 (7.0.0-31-generic)
- **Status**: Complete & 100% Verified

---

## 1. Executive Summary

`packages/job-manager` (`@desktop-assistant/job-manager`) has been implemented as the authoritative lifecycle manager for units of work (Jobs) in Desktop Assistant according to:
- **Constitution I (Decentralized Agents)**: Pet-agent creates jobs via Job Manager and never orchestrates worker agents; agents communicate strictly through job records held by Job Manager.
- **Constitution II (Hard Gate Outside The LLM Loop)**: Approval mode (`off` | `smart` | `on`) is captured and persisted at job creation time.
- **Constitution III (Ledger Before Act, Append-Only)**: Every state transition, retry attempt, cancellation, and recovery decision is written to the SQLite Action Ledger (`@desktop-assistant/ledger-store`) before triggering subsequent actions.
- **Constitution VII (Account-Owned Data, Local Working Copy, Device-Pinned Execution)**: A job executes strictly on the device that created it (`created_on_device === currentDeviceId`). Other devices in the account observe status and history via replication without executing tool calls (AC-28).

The package connects to the Electron Main process composition root (`apps/desktop/main/index.ts`) through **exactly one registration line**:
```ts
await registerJobManagerModule(context);
```

---

## 2. Deliverables & Package Surface

The package `@desktop-assistant/job-manager` is located at `packages/job-manager/`:

- `package.json`: Private workspace package with dependencies on `@desktop-assistant/contracts` and `@desktop-assistant/ledger-store`.
- `tsconfig.json` & `tsconfig.test.json`: Composite ESM TypeScript configuration with NodeNext resolution and strict typechecking.
- `src/index.ts`: Public package exports:
  - Domain types & inputs (`Job`, `JobState`, `JobPriority`, `CreateJobInput`, `JobStateTransition`, `CompletedOperation`, `FailureExplanation`, `ConnectorStatus`, `ReconcileOutcome`, etc.)
  - Domain error classes (`JobManagerError`, `TerminalStateError`, `InvalidStateTransitionError`, `JobCancelledError`, `JobTimeoutError`, `ResourceHeldError`, `PreFlightError`, `ForeignDeviceExecutionError`)
  - Subsystems: `JobStateMachine`, `JobScheduler`, `CancellationBarrier`, `TimeoutMonitor`, `RetryPolicy`, `PreFlightChecker`, `Reconciler`, `RecoveryManager`, `FailureReporter`, `JobEventBus`, `JobManager`.
- `src/state-machine.ts`: 11-state state machine (`created`, `queued`, `running`, `waiting_approval`, `waiting_input`, `suspended`, `recovering`, `waiting_user_confirmation`, `done`, `failed`, `cancelled`).
  - Guarantees timestamped transitions persisted in `job` and `job_state_transition` tables.
  - Enforces terminal state immutability: attempts to reopen `done`, `failed`, or `cancelled` jobs throw `TerminalStateError`.
- `src/scheduler.ts`: Concurrency admission controller per `connectorAccountId`.
  - Default capacity: 4 concurrent jobs per connector account (3 background slots + 1 reserved slot for interactive user commands, based on SP-15 Q4).
  - Supports connector manifest overrides.
  - Automatically releases admission slots when jobs enter waiting states (`waiting_approval`, `waiting_input`, `waiting_user_confirmation`, `suspended`), allowing queued jobs to proceed immediately.
- `src/cancellation.ts`: `CancellationBarrier` enforcing tool-call boundary cancellation (REQ-JOB-03).
  - Permits in-flight write calls to finish over the network and commit to the ledger.
  - Intercepts before starting next tool call, records stopping point, and transitions job to `cancelled`.
- `src/timeout-monitor.ts`: `TimeoutMonitor` tracking cumulative active running time (REQ-JOB-06).
  - Default limit: 10 minutes active execution time.
  - Excludes time spent in waiting states (`waiting_approval`, `waiting_input`, `waiting_user_confirmation`, `suspended`).
  - Tracks 30-minute inquiry timeout in `waiting_input`, automatically transitioning to `suspended` (SP-21 Q6).
- `src/retry-policy.ts`: `RetryPolicy` with bounded exponential backoff (`1s -> 2s -> 4s`, max 45s per SP-15).
  - Classifies errors based strictly on declared error codes from adapter (F7) or coordinator (F8).
  - Transient codes: `RATE_LIMITED`, `UNREACHABLE`, `RESOURCE_HELD`.
  - Permanent codes: `PERMISSION_DENIED`, `CONNECTOR_REVOKED`, etc.
  - Undeclared codes: treated as permanent; no retries.
  - Appends error record to Action Ledger on every retry attempt.
  - Throws `ResourceHeldError` naming holder job ID if `RESOURCE_HELD` is exhausted.
- `src/pre-flight.ts`: `PreFlightChecker` validating connector authorisation before start (REQ-JOB-09).
  - Proactively renews tokens if remaining validity is below margin (5 minutes = 300,000ms per SP-19 §4).
  - Blocks start with `PreFlightError` if token cannot be renewed without user interaction.
- `src/reconciler.ts`: `Reconciler` executing `ReconciliationDeclaration` copied in intent records (req-013).
  - Evaluates live platform state against `before` and `intended` values using declared dot-paths.
- `src/recovery-manager.ts`: `RecoveryManager` coordinating Two-Phase Crash Recovery (REQ-JOB-07, SP-12 Q4).
  - **Phase 1 (Sync/Local at Boot)**: Scans `unresolvedIntents` from local SQLite store, marks affected jobs as `recovering` before windows appear without network access (`capabilities/platform/spec.md`).
  - **Phase 2 (Async/Online)**: Reconciles live platform state per job:
    - Matches `intended` -> appends result with `establishedBy: "reconciled"` -> moves to `done`.
    - Matches `before` -> appends error -> moves to `failed` safely without repeating call.
    - Matches neither or method `none` -> moves to `waiting_user_confirmation`.
    - Unreachable -> remains `recovering`.
  - Confirms user outcome in `waiting_user_confirmation` (`confirmOutcomeByUser`).
- `src/failure-reporter.ts`: `FailureReporter` compiling natural language failure explanations and extracting completed operations for undo (REQ-JOB-04).
- `src/event-bus.ts`: `JobEventBus` typed EventEmitter streaming lifecycle events (`job:created`, `job:state_changed`, `job:progress`, `job:completed`, `job:failed`, `job:cancelled`).

**Electron Main Seam**:
- `apps/desktop/main/context.ts`: Added `ledgerStore` and `jobManager` accessors to `DesktopContext`.
- `apps/desktop/main/job-manager/register-job-manager-module.ts`:
  - Opens `LedgerStore` at `desktop-assistant.db`.
  - Runs Phase 1 Recovery (`performStartupRecovery()`) before window creation.
  - Registers IPC handlers (`job:get`, `job:list-active`, `job:cancel`, `job:resume`).
  - Broadcasts events to Pet Window and App Window webContents.
- `apps/desktop/main/index.ts`: Registered `await registerJobManagerModule(context);` between credential store and pet window creation.

---

## 3. Verification Suite & Quality Gates

All tests and automated verification checks passed with **0 failures**:

| Command | Status | Details |
|---|---|---|
| `pnpm --filter @desktop-assistant/job-manager test` | **PASSED** | 40 tests passed across 7 test files (100% pass) |
| `pnpm --filter @desktop-assistant/job-manager build` | **PASSED** | `tsc --build` succeeded with composite declarations |
| `pnpm --filter @desktop-assistant/job-manager typecheck` | **PASSED** | `tsc --noEmit -p tsconfig.test.json` 0 errors |
| `pnpm --filter @desktop-assistant/desktop test` | **PASSED** | 99 tests passed across 10 test files |
| `pnpm --filter @desktop-assistant/desktop typecheck` | **PASSED** | `tsc --noEmit` 0 errors |
| `pnpm --filter @desktop-assistant/ledger-store test` | **PASSED** | 70 tests passed across 13 test files |
| `pnpm --filter @desktop-assistant/credential-store test` | **PASSED** | 45 tests passed across 4 test files |
| `pnpm --filter @desktop-assistant/contracts test` | **PASSED** | 10 tests passed; contracts in sync with `docs/spec/` |
| `pnpm --filter @desktop-assistant/build-check test` | **PASSED** | 8 tests passed |
| `pnpm typecheck` | **PASSED** | 11 successful tasks across 9 packages in workspace |
| `pnpm lint` | **PASSED** | ESLint clean across all files; `build-check bom` verified |
| `pnpm build:check` | **PASSED** | All 4 hard build checks verified (harness, sqlite, packaging, bom) |
| `pnpm build` | **PASSED** | Turbo build succeeded across all packages |
| `node plugins/specdocs/bin/specdocs.mjs doctor` | **PASSED** | Constitution 2.1.0 clean; 12 capabilities verified |

---

## 4. Test Matrix Coverage (capabilities/job/spec.md)

1. `tests/state-machine.test.ts` (7 tests):
   - `Approval interrupts and resumes a run`: `running -> waiting_approval -> running`, timestamps recorded.
   - `Terminal states are final`: `done`, `failed`, `cancelled` refuse reopening via `TerminalStateError`.
   - `A job waits for the user to say what happened`: `recovering -> waiting_user_confirmation -> done`.
   - `Recovery is not a failure`: presented as recovering/determining, not failed.
   - `Invalid state transitions`: graph enforcement rejects invalid transitions.
2. `tests/scheduler-admission.test.ts` (6 tests):
   - `Second command during a running job`: concurrent independent execution.
   - `One job fails without affecting the other`: isolated context failure.
   - `More jobs are created than account allows`: 4th background job queues until slot is freed.
   - `Command from user arrives while background jobs fill account`: user command immediately takes reserved 4th slot.
   - `Two connectors are not one budget`: accounts do not share admission limit.
   - `Waiting does not hold a slot`: `waiting_approval` releases slot, queued job starts, resumes when slot freed.
3. `tests/cancellation-timeout.test.ts` (5 tests):
   - `Cancel while write is in flight`: in-flight call completes, commits to ledger, stops before next call.
   - `Stopping point is recoverable`: ledger identifies last completed operation and offers undo.
   - `Long job is stopped`: active execution exceeding 10 minutes transitions to `failed`.
   - `Waiting does not consume the limit`: 40 minutes in `waiting_approval` excluded from execution timer.
   - `Unanswered inquiry times out to suspended`: 30-minute timeout transitions `waiting_input -> suspended`.
4. `tests/retry-policy.test.ts` (6 tests):
   - `Rate limit clears on second attempt`: transient retry after delay succeeds, ledger holds error records.
   - `Retries are exhausted`: fails after 3 retries, reports reason.
   - `Permanent error is not retried`: permission denied fails immediately on attempt 1.
   - `Authorisation withdrawn while job running`: fails immediately without retry.
   - `Failure with no declared code`: treated as permanent, no retry.
   - `Resource held by another job`: retried with backoff, fails naming holder on exhaust (`ResourceHeldError`).
5. `tests/two-phase-recovery.test.ts` (6 tests):
   - `Phase 1 local classification`: unresolved intents found offline, marked `recovering` before windows appear.
   - `Point 3 crash`: state matches before -> `failed` safely without repeating.
   - `Point 4 crash`: state matches intended -> `done` with `establishedBy: "reconciled"`.
   - `Effect cannot be read back`: method `none` moves to `waiting_user_confirmation`.
   - `Platform unreachable at recovery`: stays in `recovering` until network restores.
   - `5-Point Crash Injection Matrix (SP-12 Q4)`: all 5 points verified, zero jobs lost (NFR-RL-01).
6. `tests/pre-flight-resumption.test.ts` (5 tests):
   - `Authorisation would expire mid-sequence`: proactively renewed before start (< 5 min margin).
   - `Authorisation cannot be renewed without user`: blocks start with `PreFlightError`.
   - `Connector job never uses`: runs normally even if other connectors are expired.
   - `In-flight suspension and resumption`: completed step 1 count remains exactly 1 (0 repetition).
   - `Resumption after cold restart from SQLite store`: cold instance resumes from checkpoint, 0 repetition.
7. `tests/scenario-coverage.test.ts` (5 tests):
   - `REQ-JOB-08`: Creating one task completes with median duration <= 30s (measured < 500ms on SQLite).
   - `REQ-JOB-04`: Failure with nothing done states reason and offers no undo.
   - `REQ-JOB-04`: Failure after partial work lists completed operations and offers undo.
   - `REQ-JOB-07`: User answered before platform was asked.
   - `REQ-JOB-05`: Held resource is not a platform fault.

# Implementation Plan: F2 — Job Manager & Vòng Đời Job

- **Feature**: F2 — Job Manager (`feat/f02-job-manager`)
- **Package Ownership**: `packages/job-manager`
- **Seam**: Composition Root in Electron Main (`apps/desktop/main/index.ts` — exactly 1 line)
- **Dependencies**: F1 (`@desktop-assistant/ledger-store` merged in tree), `@desktop-assistant/contracts`
- **Ratified Brainstorm**: `plans/reports/brainstorm-260915-f02-job-manager.md`
- **Status**: Ready for Implementation

---

## 1. Executive Summary & Purpose

`packages/job-manager` là mô-đun sở hữu toàn bộ vòng đời của Job trong Desktop Assistant theo:
- **Hiến pháp I (Decentralized Agents)**: Pet-agent tạo job qua Job Manager và không điều phối worker-agent; agents chỉ giao tiếp qua bản ghi job.
- **Hiến pháp II (Hard Gate Outside LLM Loop)**: Approval mode được lưu cố định lúc tạo job (`approval_mode`: `off` | `smart` | `on`).
- **Hiến pháp III (Ledger Before Act, Append-Only)**: Mọi chuyển trạng thái, retry, cancel đều được ghi vào Action Ledger và bảng lịch sử chuyển trạng thái.
- **Hiến pháp VII (Account-Owned, Local Working Copy, Device-Pinned Execution)**: Job chỉ thực thi trên thiết bị tạo ra nó (`created_on_device === currentDeviceId`).

Module này cung cấp:
1. **State machine 11 trạng thái**: `created`, `queued`, `running`, `waiting_approval`, `waiting_input`, `suspended`, `recovering`, `waiting_user_confirmation`, `done`, `failed`, `cancelled`.
2. **Scheduler & Admission Control**: Quản lý hạn mức song song theo tài khoản connector (mặc định tối đa 4 jobs: 3 background + 1 reserved slot cho interactive command; manifest override); tự động giải phóng slot khi job chuyển sang trạng thái chờ.
3. **Cancel tại ranh giới Tool Call**: In-flight call hoàn tất và ghi ledger; ledger ghi điểm dừng; đề nghị undo.
4. **Báo cáo Thất bại & Đề nghị Hoàn tác**: Diễn giải nguyên nhân, liệt kê completed operations từ ledger, đề nghị undo (F16).
5. **Bounded Retry Policy**: Tối đa 3 lần retry với exponential backoff (`1s -> 2s -> 4s`), chỉ retry theo error code khai báo (adapter / coordinator); không có code hoặc permanent -> fail ngay; `RESOURCE_HELD` quá 3 lần fail nêu tên job giữ; mỗi retry ghi vào ledger.
6. **Timeout Engine**: 10 phút active running time, loại trừ thời gian chờ.
7. **Khôi phục Hai Pha (Two-Phase Crash Recovery)**:
   - Pha 1: Quét `unresolvedIntents` từ `LedgerStore` trước khi cửa sổ đầu tiên hiển thị (`app.whenReady()`), đánh dấu `recovering` hoàn toàn offline.
   - Pha 2: Đối soát per-job khi có mạng theo declaration `tool-reconciliation`: khớp `before` -> `failed`; khớp `intended` -> `done` ("reconciled"); không xác định được -> `waiting_user_confirmation`; mất mạng -> giữ `recovering`.
8. **Pre-flight Authorisation**: Kiểm tra token validity của mọi connector job sử dụng; renew nếu dưới margin (5 phút); không renew được -> không start, thông báo reconnect.
9. **Resume Không Lặp Bước**: Timeout 30 phút `waiting_input` -> `suspended`; người dùng trả lời -> resume `running` từ checkpoint, 0 lặp bước.
10. **Event Bus & IPC Service**: Stream realtime thay đổi trạng thái xuống Pet & App renderers.

---

## 2. Architecture & Directory Topology

```text
packages/job-manager/
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── src/
│   ├── index.ts                      # Public exports
│   ├── types.ts                      # Core interfaces, states, inputs/outputs
│   ├── errors.ts                     # Domain error hierarchy
│   ├── state-machine.ts              # 11-state machine with timestamped transitions & terminal guard
│   ├── scheduler.ts                  # Admission controller, account pool & reserved slot
│   ├── cancellation.ts               # CancellationBarrier for tool boundaries
│   ├── retry-policy.ts               # Bounded retry engine & error code classification
│   ├── timeout-monitor.ts            # Active execution time monitor (excluding waiting)
│   ├── pre-flight.ts                 # Pre-flight connector authorisation checker
│   ├── reconciler.ts                 # Tool-reconciliation declaration executor
│   ├── recovery-manager.ts           # Phase 1 offline scan & Phase 2 online reconciler coordinator
│   ├── event-bus.ts                  # In-memory typed event emitter for job status
│   ├── failure-reporter.ts           # Human-readable failure explanation & undo offer generator
│   └── job-manager.ts                # Main facade service coordinating all subsystems
└── tests/
    ├── helpers/
    │   └── test-env.ts               # In-memory SQLite ledger & mock connector harness
    ├── state-machine.test.ts         # 11 states, valid transitions, terminal immutability
    ├── scheduler-admission.test.ts   # 4 concurrent limit, reserved slot, waiting slot release
    ├── cancellation-barrier.test.ts  # Tool-call boundary cancellation & in-flight completion
    ├── retry-policy.test.ts          # Error code classification, backoff, resource-held naming
    ├── timeout-monitor.test.ts       # Active running time vs waiting exclusion
    ├── pre-flight.test.ts            # Token margin renewal & failed authorisation block
    ├── two-phase-recovery.test.ts    # 5-point crash injection, offline phase 1, reconcile phase 2
    ├── suspension-resume.test.ts     # 30-min timeout to suspended, zero-repetition resumption
    └── scenario-coverage.test.ts     # 100% scenario tests mapping to capabilities/job/spec.md
```

**Desktop Main Integration Seam**:
```text
apps/desktop/main/
├── job-manager/
│   ├── register-job-manager-module.ts
│   └── register-job-manager-ipc.ts
├── context.ts                        # Add jobManager property to DesktopContext
└── index.ts                          # await registerJobManagerModule(context);
```

---

## 3. Detailed Implementation Phases

### Phase 1: Package Scaffolding & Core Types / Errors
- Create `packages/job-manager/package.json` with `@desktop-assistant/contracts`, `@desktop-assistant/ledger-store`, `typescript`, `vitest`.
- Configure `tsconfig.json` and `tsconfig.test.json`.
- In `src/types.ts`: Define `Job`, `JobState`, `JobPriority` (`interactive` | `background`), `CreateJobOptions`, `JobExecutionStep`, `JobEventMap`, `ConnectorStatusProvider`, `ConnectorTokenRenewer`.
- In `src/errors.ts`: Define `JobManagerError`, `JobCancelledError`, `JobTimeoutError`, `JobAdmissionError`, `PreFlightAuthorisationError`.

### Phase 2: State Machine & Transition Persistence
- In `src/state-machine.ts`:
  - Enforce transitions between the 11 valid states.
  - Guard terminal states: `done`, `failed`, `cancelled` are strictly final. Once terminal, any subsequent state change attempt throws `TERMINAL_STATE_IMMUTABLE`.
  - Persist every transition via `ledgerStore.setJobState(jobId, newState, timestamp)`.
  - Record transition history with timestamps in `job_state_transition`.

### Phase 3: Concurrency Scheduler & Admission Controller
- In `src/scheduler.ts`:
  - `JobScheduler` tracks running jobs per `connectorAccountId`.
  - Slots: total = 4, reserved = 1 (for `interactive`), unreserved = 3 (for `background`).
  - Connector Manifest overrides: Support custom `concurrencyCap` and `reservedSlots`.
  - Waiting release: When a job transitions to `waiting_approval`, `waiting_input`, `waiting_user_confirmation`, or `suspended`, release its slot immediately and dispatch the next eligible queued job.
  - Re-admission: When a waiting job resumes, request a slot. If full, queue at head of line.

### Phase 4: Cancellation Barrier & Timeout Monitor
- In `src/cancellation.ts`:
  - `CancellationBarrier` provides a cooperative cancellation token.
  - `checkBeforeToolCall()`: Throws `JobCancelledError` if cancelled.
  - When in-flight tool call completes, `onToolCallCompleted()` logs stopping point to ledger and transitions job to `cancelled`.
- In `src/timeout-monitor.ts`:
  - `JobTimeoutMonitor` tracks cumulative active running time.
  - Automatically pauses timer during `waiting_*` and `suspended` states.
  - When active running time exceeds `executionTimeoutMs` (default 10 minutes), triggers timeout failure.

### Phase 5: Retry Policy & Failure Reporter
- In `src/retry-policy.ts`:
  - Classify transient vs permanent error codes:
    - Transient: `RATE_LIMITED`, `UNREACHABLE`, `RESOURCE_HELD`.
    - Permanent: `PERMISSION_DENIED`, `CONNECTOR_REVOKED`, `NOT_FOUND`, `INVALID_PARAMS`, `UNSUPPORTED`, errors with no code.
  - Delay calculation: Respect `retryAfterMs` if present (max 45s), else exponential backoff `1s -> 2s -> 4s`.
  - Max retries = 3. Each retry appends an error record to the ledger.
  - If `RESOURCE_HELD` retries exhaust, throw error naming the job that held the resource.
- In `src/failure-reporter.ts`:
  - Generate human-readable reason.
  - Read job's completed actions from `ledgerStore.readJob(jobId)`.
  - Offer undo if completed reversible actions exist.

### Phase 6: Pre-Flight Authorisation Checker
- In `src/pre-flight.ts`:
  - Inspect connectors required by job before first tool call.
  - Query token expiry; if `< 5 minutes` (`tokenRefreshMarginMs = 300_000`), invoke proactive renewal.
  - If token expired and cannot be refreshed (needs re-auth): fail before starting, return actionable reconnect error.

### Phase 7: Two-Phase Recovery Manager & Reconciler
- In `src/reconciler.ts`:
  - Inspect `ReconciliationDeclaration` copied in intent record.
  - Execute declared read tool; compare path against `before` and `intended`.
  - Return `performed` | `not_performed` | `undetermined` | `unreachable`.
- In `src/recovery-manager.ts`:
  - **Phase 1 (Sync/Local at Boot)**: Call `ledgerStore.unresolvedIntents()`. Mark jobs as `recovering` in SQLite. Zero network calls.
  - **Phase 2 (Async/Online Background)**: Process recovering jobs. If `performed` -> append result, mark `done`. If `not_performed` -> append error, mark `failed`. If `undetermined` or `none` -> mark `waiting_user_confirmation`. If offline -> keep `recovering`.

### Phase 8: JobManager Facade, IPC Event Bus, and Main Seam
- In `src/event-bus.ts`: Typed EventEmitter for `job:created`, `job:state_changed`, `job:progress`, `job:completed`, `job:failed`, `job:cancelled`.
- In `src/job-manager.ts`: Assemble all subsystems into `JobManager` class.
- In `apps/desktop/main/job-manager/register-job-manager-module.ts`:
  - Run Recovery Phase 1 during module registration before pet window is created.
  - Register IPC handlers for renderer access.
  - Mount onto `DesktopContext.jobManager`.
- In `apps/desktop/main/context.ts`: Declare `jobManager` property.
- In `apps/desktop/main/index.ts`: Add `await registerJobManagerModule(context);`.

### Phase 9: Comprehensive Test Suite & Verification
- Unit & scenario tests mapping 1:1 to every requirement in `docs/spec/capabilities/job/spec.md`.
- Crash injection test suite reproducing the 5-point kill matrix from SP-12 Q4.
- Concurrency scaling and reserved slot tests based on SP-15 Q4.
- Verify build, typecheck, lint across workspace.

---

## 4. Verification Matrix & Quality Gates

| Requirement ID | Spec Scenario | Test File | Assertion |
|---|---|---|---|
| REQ-JOB-01 | Approval interrupts and resumes a run | `state-machine.test.ts` | Moves `running -> waiting_approval -> running`, timestamps recorded |
| REQ-JOB-01 | Terminal states are final | `state-machine.test.ts` | Event on `done`/`failed`/`cancelled` does not reopen job |
| REQ-JOB-01 | Unanswered inquiry times out to suspended | `suspension-resume.test.ts` | 30m timeout transitions `waiting_input -> suspended` |
| REQ-JOB-02 | More jobs created than account allows | `scheduler-admission.test.ts` | 5th job stays `queued`, runs when slot freed |
| REQ-JOB-02 | Command from user arrives while slots full | `scheduler-admission.test.ts` | User command takes reserved 4th slot |
| REQ-JOB-02 | Waiting does not hold a slot | `scheduler-admission.test.ts` | `waiting_approval` frees slot, queued job starts |
| REQ-JOB-03 | Cancel while write is in flight | `cancellation-barrier.test.ts` | In-flight write completes, stops before next call, ledger records stop |
| REQ-JOB-04 | Failed job explains itself and offers undo | `failure-reporter.test.ts` | Explains reason, lists completed operations, offers undo |
| REQ-JOB-05 | Transient failure retried bounded | `retry-policy.test.ts` | Retries <= 3 with backoff; error without code is permanent |
| REQ-JOB-05 | Resource held by another job | `retry-policy.test.ts` | Retries transiently; fails naming holder on exhaust |
| REQ-JOB-06 | Job ends when exceeds time limit | `timeout-monitor.test.ts` | 10m active execution time fails job; waiting time excluded |
| REQ-JOB-07 | Crash between intent and call (Point 3) | `two-phase-recovery.test.ts` | Reconciles state matches before -> `failed`, no repeat |
| REQ-JOB-07 | Platform holds intended result (Point 4) | `two-phase-recovery.test.ts` | Reconciles state matches intended -> `done` (reconciled) |
| REQ-JOB-07 | Effect cannot be read back / none | `two-phase-recovery.test.ts` | Moves to `waiting_user_confirmation`, never repeats |
| REQ-JOB-08 | Simple job median duration | `scenario-coverage.test.ts` | Median duration <= 30s benchmark check |
| REQ-JOB-09 | Authorisation would expire mid-sequence | `pre-flight.test.ts` | Proactively renews if < 5 min remaining |
| REQ-JOB-09 | Authorisation cannot be renewed | `pre-flight.test.ts` | Does not start, informs user to reconnect |
| REQ-JOB-10 | Suspended job resumes without repeating | `suspension-resume.test.ts` | Completed steps execution count stays exactly 1 |

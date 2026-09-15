# Implementation Plan: F1 — Action Ledger & Local Store

- **Date**: 2026-09-14
- **Feature Worktree**: `feat/f01-ledger-local-store`
- **Ownership**: `packages/ledger-store`
- **Dependencies**: F0 (merged into `dev`)
- **Status**: Ready for Implementation (`/ak:cook`)

---

## 1. Context & Architecture Review

`packages/ledger-store` is the foundational local-first, append-only SQLite store for Desktop Assistant, enforcing **Constitution Principles III, IV, and VII**:
- Two records (`intent` and `result`) per tool invocation, joined by `correlation_id`.
- Fail-closed: tool calls cannot execute unless the `intent` record is durable on disk.
- Engine-level immutability enforced by SQLite triggers (`action_record_no_update`, `action_record_no_delete`).
- Atomic retention cleanup ("Announce-then-remove", Q-4, INV-LG-07).
- Persistent monotonic `origin_sequence` per device.
- Operating-system physical durability: selective `PRAGMA fullfsync = ON` and `synchronous = FULL` on macOS exclusively for authoritative ledger and job stores (RISK-081).
- Startup recovery: `listUnresolvedIntents()` runs locally before the first window is shown, without network dependency.

### Selected Architecture Decisions (from Brainstorm)
1. **Record Representation**: Single structured JSON column (`content TEXT NOT NULL`) matching `contracts/ledger-store.sql` exactly, with fail-closed validation against `ledger-record.schema.json` via `@desktop-assistant/contracts`. Relational metadata (`record_id`, `job_id`, `position`, `type`, `origin_device`, `origin_sequence`, `recorded_at`, `correlation_id`, `references_json`) indexed in primary columns.
2. **Retention Announce-Then-Remove**: Two-step decoupled procedure. Step 1 writes `removal_announcement` in an independent commit. Step 2 opens a maintenance transaction, drops the DELETE trigger, deletes target records and file attachments, restores the trigger, and commits. This guarantees the announcement survives on disk even if step 2 is killed mid-flight.
3. **Crash-Injection Verification**: Multi-process worker test suite ported from SP-12 into Vitest, testing real OS process kills (`SIGKILL` on POSIX, `TerminateProcess` on Windows) across all 5 lifecycle points.
4. **Durability Scope**: Selective configuration via `openLedgerStore({ isAuthoritativeLedger: true })`. Non-authoritative stores (cache/scratch) use `synchronous = NORMAL` to preserve throughput.

---

## 2. Implementation Phases

| Phase | Title | Scope & Objectives | Deliverables |
|---|---|---|---|
| **Phase 1** | Package Scaffold & Workspace Integration | Initialize `packages/ledger-store` package, dependencies, tsconfig, build configuration. | `packages/ledger-store/package.json`, `tsconfig.json`, `README.md` |
| **Phase 2** | Schema DDL, Engine Triggers & Monotonic Sequence | Implement normative tables (`action_record`, `job`, `approval_request`, `device_sequence`), views (`unresolved_intent`), indexes, and immutability triggers. | `src/schema.ts`, `src/sequence.ts` |
| **Phase 3** | Store Opener & Physical Durability Configuration | Configure WAL mode, foreign keys, platform-aware fsync (`fullfsync` on macOS for authoritative stores only). | `src/opener.ts` |
| **Phase 4** | Record Builder, Type-Safe Validation & Append APIs | Implement fail-closed record validation against `ledger-record.schema.json`, Core Append APIs, Query APIs, and read stream. | `src/builder.ts`, `src/types.ts`, `src/channel.ts`, `src/store.ts` |
| **Phase 5** | Atomic Retention & Announce-Then-Remove | Implement 90-day retention expiry and user-requested history deletion with two-step atomic announcement and attachment purge. | `src/retention.ts` |
| **Phase 6** | Additive Migrations & Shape Manager | Implement schema migration manager using `PRAGMA user_version`; enforce zero history rewriting and atomic rollback on crash. | `src/migration.ts` |
| **Phase 7** | Comprehensive Spec Tests & SP-12 Crash Injection | Port 5-point crash runner into Vitest; implement automated scenario tests for 100% of `capabilities/ledger/spec.md` requirements. | `tests/*.test.ts`, `tests/fixtures/crash-worker.ts` |
| **Phase 8** | Build Check, Benchmark & Verification Report | Verify `pnpm build:check`, benchmark startup classification on full store (answering Q-6), write completion report. | `plans/reports/f01-ledger-local-store.md` |

---

## 3. Detailed Phase Specifications

### Phase 1: Package Scaffold & Workspace Integration
- **Directory**: `packages/ledger-store/`
- **Dependencies**:
  - `@desktop-assistant/contracts`: `workspace:*`
  - `better-sqlite3`: `13.0.3` (Node-API prebuilt)
- **DevDependencies**:
  - `@types/better-sqlite3`: `7.6.12`
  - `@types/node`: `24.13.4`
  - `typescript`: `5.9.3`
  - `vitest`: `5.0.0`
- **Verification**: `pnpm install` succeeds without node-gyp compilation; `pnpm --filter=@desktop-assistant/ledger-store typecheck` runs cleanly.

### Phase 2: Schema DDL, Engine Triggers & Monotonic Sequence
- **Files**: `src/schema.ts`, `src/sequence.ts`
- **Tables**:
  ```sql
  CREATE TABLE IF NOT EXISTS job (
      id TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS approval_request (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES job(id),
      tool_name TEXT NOT NULL,
      tool_params TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied', 'cancelled')),
      decided_by TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS device_sequence (
      device_id TEXT PRIMARY KEY,
      current_sequence INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS action_record (
      record_id       TEXT    PRIMARY KEY,
      job_id          TEXT    NOT NULL REFERENCES job(id),
      position        INTEGER NOT NULL,
      type            TEXT    NOT NULL,
      origin_device   TEXT    NOT NULL,
      origin_sequence INTEGER NOT NULL,
      recorded_at     TEXT    NOT NULL,
      correlation_id  TEXT,
      references_json TEXT,
      content         TEXT    NOT NULL,
      CONSTRAINT action_record_type_closed CHECK (type IN (
          'intent', 'result', 'decision', 'error', 'information', 'removal_announcement', 'superseded_version'
      )),
      CONSTRAINT action_record_correlation_scope CHECK (
          (type IN ('intent', 'result')) = (correlation_id IS NOT NULL)
      ),
      CONSTRAINT action_record_position_unique UNIQUE (job_id, position),
      CONSTRAINT action_record_origin_unique UNIQUE (origin_device, origin_sequence)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS action_record_correlation_pair
      ON action_record (correlation_id, type)
      WHERE correlation_id IS NOT NULL;

  CREATE VIEW IF NOT EXISTS unresolved_intent AS
  SELECT i.record_id, i.job_id, i.position, i.origin_device, i.origin_sequence, i.recorded_at, i.correlation_id, i.content
  FROM action_record AS i
  WHERE i.type = 'intent'
    AND NOT EXISTS (
        SELECT 1 FROM action_record AS r
        WHERE r.type = 'result' AND r.correlation_id = i.correlation_id
    );

  CREATE TRIGGER IF NOT EXISTS action_record_no_update
  BEFORE UPDATE ON action_record
  BEGIN
      SELECT RAISE(ABORT, 'action_record is append-only: UPDATE is refused (APPEND_ONLY_VIOLATION)');
  END;

  CREATE TRIGGER IF NOT EXISTS action_record_no_delete
  BEFORE DELETE ON action_record
  BEGIN
      SELECT RAISE(ABORT, 'action_record is append-only: DELETE is refused (APPEND_ONLY_VIOLATION)');
  END;
  ```
- **Monotonic Sequence Logic**:
  - Assigns `origin_sequence` inside the append transaction via `UPDATE device_sequence SET current_sequence = current_sequence + 1 WHERE device_id = ? RETURNING current_sequence`.
  - Ensures no restarts, resets, or gaps across application restarts.

### Phase 3: Store Opener & Physical Durability Configuration
- **File**: `src/opener.ts`
- **Configuration API**:
  ```ts
  export interface StoreOpenOptions {
    dbPath: string;
    deviceId: string;
    isAuthoritativeLedger?: boolean; // Defaults to true
    verbose?: (msg: string) => void;
  }
  ```
- **Durability Matrix**:
  - `PRAGMA journal_mode = WAL;`
  - `PRAGMA foreign_keys = ON;`
  - If `isAuthoritativeLedger === true`:
    - On macOS: `PRAGMA synchronous = FULL; PRAGMA fullfsync = ON; PRAGMA checkpoint_fullfsync = ON;`
    - On Linux/Windows: `PRAGMA synchronous = NORMAL;`
  - If `isAuthoritativeLedger === false`:
    - All platforms: `PRAGMA synchronous = NORMAL;` (strictly omits `fullfsync`).

### Phase 4: Record Builder, Type-Safe Validation & Append APIs
- **Files**: `src/builder.ts`, `src/store.ts`, `src/types.ts`, `src/channel.ts`
- **Builder Rules**:
  - Validates record content against schema before executing any DB statement.
  - Enforces `correlation_id` presence on `intent` and `result`, and absence on other types.
  - Automatically computes dense incrementing `position` per `job_id`.
  - Assigns monotonic `origin_sequence` per device.
- **Store APIs**:
  - `appendIntent(input: AppendIntentInput): LedgerRecord`
  - `appendResult(input: AppendResultInput): LedgerRecord`
  - `appendDecision(input: AppendDecisionInput): LedgerRecord`
  - `appendError(input: AppendErrorInput): LedgerRecord`
  - `appendInformation(input: AppendInformationInput): LedgerRecord`
  - `appendSupersededVersion(input: AppendSupersededInput): LedgerRecord`
  - `listUnresolvedIntents(): UnresolvedIntent[]`
  - `readJob(jobId: string): LedgerRecord[]`
  - `queryRecords(filter: RecordQueryFilter): LedgerRecord[]`
  - `createReadChannel(): ReadChannelSubscription` (Event-driven pub/sub for renderer IPC).

### Phase 5: Atomic Retention & Announce-Then-Remove
- **File**: `src/retention.ts`
- **Procedures**:
  - `expire(options: { retentionDays?: number; dryRun?: boolean }): Promise<RemovalReport>`
  - `deleteByUser(options: { jobId?: string; beforeDate?: string; reason: string }): Promise<RemovalReport>`
- **Atomicity Protocol**:
  1. Calculate target records to be deleted.
  2. Append `removal_announcement` record stating `range_start`, `range_end`, `reason`, `requester` in an independent transaction.
  3. In a subsequent transaction:
     - Drop `action_record_no_delete` trigger.
     - Delete target rows from `action_record`.
     - Recreate `action_record_no_delete` trigger.
  4. Purge referenced image extract / attachment files from disk.
  5. If interrupted between Step 2 and 3, announcement is preserved on disk, and records remain intact for retry.

### Phase 6: Additive Migrations & Shape Manager
- **File**: `src/migration.ts`
- **Rules**:
  - Uses `PRAGMA user_version` to track schema versions.
  - Only allows additive migrations (`ALTER TABLE ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`).
  - Prohibits and rejects any migration step that executes `UPDATE` on existing records or attempts historical backfills.
  - Runs inside an explicit transaction (`db.transaction(...)`); any interruption rolls back cleanly so the store is wholly at the old version or wholly at the new version.

### Phase 7: Comprehensive Spec Tests & SP-12 Crash Injection
- **Files**:
  - `tests/ledger-store.test.ts`: Covers every scenario in `docs/spec/capabilities/ledger/spec.md`.
  - `tests/immutability.test.ts`: Proves `UPDATE` / `DELETE` from external processes (`better-sqlite3` and child CLI) are blocked.
  - `tests/retention.test.ts`: Verifies announce-then-remove atomicity and crash tolerance.
  - `tests/migration.test.ts`: Tests additive schema migration and interrupted transaction rollback.
  - `tests/durability.test.ts`: Verifies PRAGMA settings per platform and store authority.
  - `tests/crash-injection.test.ts`: Ports SP-12 crash-injection runner (child process killed at 5 lifecycle points; verifies WAL recovery, zero lost jobs, and proper pre/post call state differentiation).

### Phase 8: Build Check, Benchmark & Verification Report
- **Tasks**:
  - Run `pnpm build:check` across monorepo to verify native `.node` bindings and BOM checks.
  - Benchmark `listUnresolvedIntents()` on 4,500 jobs database to measure startup classification latency (answering Q-6).
  - Document throughput figures with and without `fullfsync` citing SP-12/mac.
  - Generate completion report in `plans/reports/f01-ledger-local-store.md`.

---

## 4. Acceptance Criteria Checklist

- [ ] `packages/ledger-store` builds cleanly with strict TypeScript and zero toolchain requirements.
- [ ] 100% of scenarios in `docs/spec/capabilities/ledger/spec.md` pass in automated tests named after the scenarios.
- [ ] External process `UPDATE`/`DELETE` queries are rejected with `APPEND_ONLY_VIOLATION`.
- [ ] Crash-injection at all 5 lifecycle points passes: zero lost jobs, accurate state reconciliation.
- [ ] Announce-then-remove retention operates atomically and leaves announcement record intact upon interruption.
- [ ] Additive migrations leave historical records untouched and roll back cleanly if aborted.
- [ ] Durability settings (`fullfsync`) are confined to authoritative ledger stores.
- [ ] `pnpm build:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass monorepo-wide.

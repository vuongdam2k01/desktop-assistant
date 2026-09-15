# Implementation Report: F1 Action Ledger and Local Store

- **Task**: F1 Action Ledger and Local Store (`packages/ledger-store`)
- **Date**: 2026-09-14
- **Host**: Linux x64 (7.0.0-31-generic)
- **Status**: Complete & Verified

---

## 1. Executive Summary

`packages/ledger-store` has been implemented as the single device-resident SQLite working copy for jobs, approval requests, and immutable action records according to normative contracts (`ledger-store.sql`, `ledger-record.schema.json`, `tool-reconciliation.schema.json`, `ledger-store.md`, and `docs/spec/capabilities/ledger/spec.md`).

The package establishes the inviolable **ledger-before-act** boundary:
1. An intent record is appended, schema-validated, transactionally assigned a device sequence and job position, and durably written to SQLite WAL storage before any external connector effect can occur.
2. If the ledger write fails (e.g. storage full via `SQLITE_FULL`, constraint collision, or disk I/O failure), the operation fails closed with `LEDGER_WRITE_FAILED`, and the external tool call is never initiated.
3. Immutability guards (`action_record_no_update` and `action_record_no_delete`) enforce append-only semantics directly in the SQLite schema definition, refusing tampering by any process opening the file (including direct Node.js handles and the native `/usr/bin/sqlite3` CLI).
4. Controlled removal (retention expiry and user deletion) proceeds across three resumable stages: a `removal_announcement` is durably committed in stage 1, all target records are atomically removed and triggers restored in stage 2, and physical attachment files are unlinked in stage 3. Interrupted removals are safely resumed on store open.
5. All 11 findings from pre-landing code review have been remediated: internal database handles and maintenance collaborators are encapsulated using `#private` class fields, schema migrations enforce byte-level SHA-256 and constraint immutability, approval requests validate strict job ownership and input schemas, and query execution is bounded and deterministically ordered.

---

## 2. Deliverables & Package Surface

The package `@desktop-assistant/ledger-store` is located at `packages/ledger-store/` with TypeScript project references enabled:

- `package.json`: Private workspace package with exact dependencies (`better-sqlite3@13.0.3`, `ajv@8.17.1`, `ajv-formats@3.0.1`, `@desktop-assistant/contracts`).
- `tsconfig.json`: Composite ESM TypeScript project extending `tsconfig.base.json` with strict mode and declaration generation.
- `src/index.ts`: Single exported package surface:
  - Openers: `openLedgerStore`, `openAuxiliaryDatabase`, `durabilityPolicy`
  - Interfaces: `LedgerStore`, `ReadOnlyLedgerStore`, `RecordListener`
  - Types: Discriminated `TypedLedgerRecord`, inputs (`AppendIntentInput`, `AppendResultInput`, etc.), projections (`JobState`, `StoredJob`, `ApprovalRequest`, `StoredApprovalRequest`, `UnresolvedIntent`, `ShapeState`, `RemovalOutcome`, etc.)
  - Errors: `LedgerStoreError`, `LEDGER_STORE_ERROR_CODES`
  - Summary Presentation: `renderRecordSummary`
- `src/schema.ts`: SQLite DDL for jobs, transitions, approvals, device identities, action records, attachments, removal operations, indexes, triggers, and `unresolved_intent` view.
- `src/opener.ts`: Separate open functions for authoritative stores (integrity check, migration, device ID validation, trigger verification, removal resumption, platform durability) and auxiliary cache/scratch databases.
- `src/record-validator.ts`: Schema validation for ledger records (Ajv 2020) and tool reconciliation declarations (Draft-07), snapshot declarations, reversibility, and compensating actions.
- `src/record-repository.ts`: Synchronous transactional database primitives beneath Promise-returning methods.
- `src/removal-manager.ts`: Three-stage resumable retention expiry and user deletion with attachment cleanup.
- `src/migration-manager.ts`: Crash-atomic shape migrations with byte-level SHA-256 digests and constraint comparisons.
- `src/change-stream.ts`: Post-commit change notification stream with listener exception isolation.
- `src/summary.ts`: Deterministic English data-only record summary generator.
- `src/internal-test.ts`: Unexported test seam for test-only fault injection (`getInternalDatabaseForTesting`).

---

## 3. Benchmark & Durability Measurements

Running `pnpm --filter=@desktop-assistant/ledger-store benchmark` against a 4,500-job / 90-day simulated store yielded the following metrics:

```json
{
  "platform": "linux",
  "totalJobs": 4500,
  "unresolvedIntentsCount": 5,
  "retentionSpanDays": 90,
  "firstStartClassificationMs": 3.623,
  "classificationLatency": {
    "iterations": 100,
    "p50Ms": 3.061,
    "p95Ms": 3.502,
    "p99Ms": 3.971
  },
  "walCheckpoint": {
    "busy": 0,
    "log": 0,
    "checkpointed": 0
  },
  "macosComparison": {
    "status": "not_run",
    "reason": "Current host platform is linux (not darwin). macOS hardware-flush measurement cited from spikes/SP-12-sqlite-ledger/macos/REPORT.md (~28,314.9 buffered vs ~241.1 durable writes/s)."
  }
}
```

### Durability Evidence Summary
- **Classification Performance**: Cold first-start classification of 4,500 jobs completed in **3.623 ms** via the `unresolved_intent` anti-join view, well under the 50 ms budget. Warm p50 latency is **3.061 ms** (p99 **3.971 ms**).
- **WAL Checkpoint**: Passive checkpoint completed cleanly with 0 busy frames and 0 log backlog.
- **macOS Hardware-Flush Baseline**: As this session ran on Linux x64, macOS comparative measurements were not fabricated. The verified empirical baseline from `spikes/SP-12-sqlite-ledger/macos/REPORT.md` stands:
  - Buffered WAL (`NORMAL`, `fullfsync = OFF`): ~28,314.9 writes/s.
  - Durable Authoritative WAL (`FULL`, `fullfsync = ON`, `checkpoint_fullfsync = ON`): ~241.1 writes/s, p50 **4.033 ms**.
  - `durabilityPolicy('darwin', 'authoritative')` enforces `FULL` / `ON` / `ON` unconditionally.

---

## 4. Verification Suite Results

All 7 workspace packages and all automated verification checks passed with 0 failures:

| Command | Status | Details |
|---|---|---|
| `pnpm contracts:check` | **PASSED** | Contracts in sync with `docs/spec/` |
| `pnpm lint` | **PASSED** | ESLint clean across all packages; `build-check bom` verified |
| `pnpm typecheck` | **PASSED** | 6 workspace packages checked with `tsc --noEmit`, 0 type errors |
| `pnpm test` | **PASSED** | 81 tests passed across 13 test files (48 tests in `ledger-store`) |
| `pnpm build` | **PASSED** | Turbo build succeeded across all packages |
| `pnpm build:check` | **PASSED** | Native SQLite binding and BOM checks verified |
| `pnpm package:unsigned` | **PASSED** | Artifact check verified `better_sqlite3.node` in `app.asar.unpacked`; Electron-as-Node printed `SQLITE_NATIVE_READY` |
| `pnpm --filter=@desktop-assistant/ledger-store benchmark` | **PASSED** | 4,500-job benchmark executed in 1.75s wall time |

### Verified Test Suites (48 Tests)
1. `record-scenarios.test.ts` (20 tests): Snapshot availability/unavailability, pending outcomes, repeated modifications on one object, mistake corrections, denials, automatic risk-judge decisions, plain English summaries, raw call inspection, deletion filtering by type and date window, device attribution, call returns/refusals, flight interruptions, two calls per job, reconciliation declaration freezing, unread targets, undeclared tools, and frozen `readOnly()` facade inspection.
2. `immutability-scenarios.test.ts` (2 tests): Internal SQLite `UPDATE`/`DELETE` rejection, external Node.js process rejection, and external `/usr/bin/sqlite3` CLI rejection with `APPEND_ONLY_VIOLATION: RECORD_IMMUTABLE`.
3. `fail-closed-scenarios.test.ts` (2 tests): Simulated `SQLITE_FULL` via `max_page_count` proving intent write failure prevents external tool call; proof that append resolution strictly precedes external effect.
4. `retention-scenarios.test.ts` (6 tests): 90-day retention expiry, deliberate user deletion with confirmation gate, attachment file unlinking on disk, trigger immutability vs removal, crash before database deletion, crash during deletion transaction with atomic rollback, and idempotent resume.
5. `sequence-and-replication-readiness.test.ts` (4 tests): Monotonic sequence persistence across store restart, competing version conflict reconciliation via `superseded_version` with byte-identical prior record, no conflict no record, and atomic batch `appendMany` with remote origin preservation.
6. `migration-scenarios.test.ts` (3 tests): Additive migration with old record byte immutability, refusal of non-null/default columns or record rewrites with `SHAPE_WOULD_REWRITE`, child-process SIGKILL mid-step with atomic rollback to prior `user_version`, and `SHAPE_AHEAD` refusal.
7. `durability-scenarios.test.ts` (4 tests): Immediate external visibility of durable append, macOS `FULL`/`fullfsync` policy enforcement, auxiliary database scratch pragmas (`NORMAL`, no ledger schema), and design write-rate assumptions.
8. `crash-injection.test.ts` (5 tests): SP-12 5-crash-point process kill lifecycle verifying external effect sentinel state and unresolved intent classification across all interruption boundaries.
9. `scenario-coverage.test.ts` (2 tests): Full accounting of all 53 ledger specification scenarios; verification of consuming F1 contracts for downstream features (F5 audit, F8 exclusive-span and stale-before-state checks, F21 UI cards, and F22 replication transport).

---

## 5. Downstream Capability Boundaries

The storage foundation is complete for subsequent capabilities:
- **F2 Job Lifecycle**: Owns legal job state transition policies; `packages/ledger-store` provides atomic `setJobState` projection and `job_state_transition` history.
- **F4/F11 Approval Gate**: Owns rule compilation and evaluation; `packages/ledger-store` provides `createApprovalRequest`, pending listings, and `appendDecision` projection updates.
- **F5 Connector Loop**: Owns tool execution loops; `packages/ledger-store` provides the fail-closed `appendIntent` -> call -> `appendResult` ordering.
- **F8 Multi-Job Coordination**: Owns exclusive object locks and stale-before-state comparisons; `packages/ledger-store` provides immutable snapshots and `unresolvedIntents` crash recovery.
- **F21 UIX Presentation**: Owns localized cards; `packages/ledger-store` provides `renderRecordSummary` and frozen `readOnly()` instances.
- **F22 Sync Transport**: Owns network replication; `packages/ledger-store` provides `originDevice`/`originSequence` preservation and `superseded_version` records.

---

## 6. Upstream Observations & Contingencies
1. **GitHub Actions PR Trigger**: Existing CI workflow currently runs on pull requests targeting `main` and `master`, whereas feature work is targeting `dev`. The F0/CI owner should add `dev` to workflow triggers to enable automated multi-OS (Linux/macOS/Windows) matrix verification.
2. **macOS Benchmark Verification**: Hardware-flush comparison on live Apple Silicon hardware should be re-verified when running on a macOS runner or developer workstation.

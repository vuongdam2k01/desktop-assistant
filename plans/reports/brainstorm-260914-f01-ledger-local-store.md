# Brainstorm Contract: F1 — Action Ledger & Local Store

- **Date**: 2026-09-14
- **Feature**: F1 (`feat/f01-ledger-local-store`)
- **Package Ownership**: `packages/ledger-store`
- **Dependencies**: F0 (merged into `dev`)
- **Status**: Formulated & Ready for Implementation Planning

---

## 1. Executive Summary & Context

The Desktop Assistant architecture relies fundamentally on an immutable, fail-closed, local-first Action Ledger (`packages/ledger-store`). As established by **Constitution Principle III (Ledger Before Act, Append-Only)**, **Principle IV (Irreversibility Is Declared)**, and **Principle VII (Account-Owned Data, Local Store as Working Copy)**:
1. Every tool invocation writes an `intent` record before external API execution. If this write fails, execution is halted immediately (fail-closed).
2. Once the external operation completes (or fails), a corresponding `result` record is appended, joined by a unique `correlation_id`. Neither record is ever modified or rewritten.
3. Immutability is enforced directly by SQLite engine triggers (`BEFORE UPDATE` / `BEFORE DELETE`), defending data integrity against unauthorized internal paths and external processes (`sqlite3` CLI, DB browsers).
4. Physical write durability on macOS is guaranteed through `PRAGMA fullfsync = ON` and `synchronous = FULL`, while isolating transient scratchpads/caches from this I/O cost (RISK-081).
5. At application startup, the local store is inspected before displaying the first window to classify interrupted work from unresolved intents without network dependency.

This document establishes the bounded delivery contract, explores architecture options, and prepares the roadmap for implementation in `packages/ledger-store`.

---

## 2. Bounded Brainstorm Contract

### 2.1. Outcome
A production-ready, fully typed TypeScript package `packages/ledger-store` backed by `better-sqlite3@13.0.3` (Node-API prebuilt) that manages the authoritative device-resident SQLite store file:
- **Tables & Views**: Manages `action_record`, `job`, `approval_request`, `device_sequence`, and the derived `unresolved_intent` view.
- **Engine-Level Immutability**: SQLite triggers reject any `UPDATE` or `DELETE` on `action_record` with `ABORT` for any process opening the file.
- **Atomic Retention ("Announce-then-remove")**: Provides `expire()` and `deleteByUser()` procedures that precede removal with an appended `removal_announcement` record, executing atomic physical row removal and referenced attachment purges inside a controlled transaction.
- **Monotonic Sequence**: Guarantees a strictly increasing `origin_sequence` per device that survives reboots and process crashes.
- **Physical Durability Configuration**: Configures WAL mode, appropriate synchronous levels, and selectively activates `PRAGMA fullfsync = ON` / `checkpoint_fullfsync = ON` on macOS exclusively for authoritative ledger and job stores.
- **Core APIs**: `appendIntent`, `appendResult`, `appendDecision`, `listUnresolvedIntents`, `readJob`, `queryRecords`, `expire`, `deleteByUser`, and a read-only subscription channel for renderer processes.
- **Additive Migrations**: Schema/migration manager that strictly forbids backfilling or rewriting existing records; interrupted migrations roll back cleanly to old or new states.

### 2.2. Constraints
- **Constitution III (NON-NEGOTIABLE)**: Write before act. Fail-closed. Ledger records are never edited or deleted; corrections are new records referencing the original. Human decisions are ledger records.
- **Constitution IV**: Before/after snapshots are stored whole (uncompressed structured JSON); compensating actions are declared.
- **Constitution VII & ADR-002**: Local SQLite store (`better-sqlite3`) is the authoritative working copy on device.
- **Zero Local Toolchain Requirement**: Must use `better-sqlite3@13.0.3` prebuilt Node-API binaries (`tooling/build-check` verification remains green).
- **Physical Flush Scope (RISK-081)**: `PRAGMA fullfsync` and `synchronous=FULL` must be restricted to the ledger and job store; scratch/cache stores must use `synchronous=NORMAL`.
- **Operating Boundaries**: Only the main process holds a write handle. Renderer processes interact strictly via read-only channels and IPC streams.
- **File Ownership & Code Rules**: All code strictly owned within `packages/ledger-store/`. No modification of `docs/spec/`. Code and READMEs in English; user discussions in Vietnamese.

### 2.3. Non-Goals (Out of Scope for F1)
- **Job Lifecycle Logic**: State transitions, timeouts, and job execution loops belong to F2 (`packages/job-manager`).
- **Resource Locking & Concurrency Coordination**: Exclusive spans and distributed locks belong to F8 (`packages/resource-coordinator`).
- **Replication Protocol & Encrypted Sync**: Transporting records to the backend belongs to F22 (`packages/sync-client`).
- **User Interface**: Ledger visualization, timeline browsing, and undo UI belong to F21 (`apps/desktop`).
- **Credential Storage**: API keys and tokens reside in OS Keychain/DPAPI, owned by F3 (`packages/credential-store`).

### 2.4. Acceptance Criteria
1. **Spec Scenarios Verification**: 100% of scenarios declared in `docs/spec/capabilities/ledger/spec.md` have corresponding automated tests named after the scenarios.
2. **Crash Injection 5-Point Resilience**: Ported automated suite injecting crashes (`SIGKILL` on Linux/macOS, `TerminateProcess` on Windows per RISK-048) at all 5 tool call lifecycle points:
   - Point 1 (Before approval decision)
   - Point 2 (After approval, before intent WAL commit)
   - Point 3 (After intent WAL commit, before external API call)
   - Point 4 (After external API call succeeds, before result WAL commit)
   - Point 5 (After result WAL commit, before job status update)
   *Result*: Zero lost jobs; intent accurately differentiates pre-call vs post-call state.
3. **Engine-Level Immutability**: Direct `UPDATE` and `DELETE` queries executed from an external process (`better-sqlite3` or CLI) fail with `APPEND_ONLY_VIOLATION`.
4. **Announce-Then-Remove Atomicity**: Removal operations append a `removal_announcement` record first. If interrupted, the announcement is preserved on disk, and records are either all present or all removed.
5. **Cross-Platform Compatibility**: Full test suite passes across Linux, macOS, and Windows without compilation toolchains.
6. **Durability Benchmark Documentation**: macOS throughput with and without `fullfsync` documented in report, citing SP-12/mac findings (~28,000 writes/s vs 241 writes/s, p50 ~4.03 ms).

---

## 3. Option Exploration & Architectural Decisions

### Fork 1: Record Representation — Dedicated Relational Columns vs Single Structured JSON Column

| Dimension | Approach A: Flattened Dedicated Columns (SP-12 Prototype) | Approach B: Ratified JSON Column (`content TEXT NOT NULL`) [RECOMMENDED] | Approach C: Hybrid Storage with Generated Virtual Columns |
|---|---|---|---|
| **Description** | Store separate columns for `tool`, `args`, `result`, `snapshot_before`, `snapshot_after`, `compensating_action`. | Store relational metadata (`record_id`, `job_id`, `position`, `type`, `origin_device`, `origin_sequence`, `recorded_at`, `correlation_id`, `references_json`) with payload in validated JSON string `content`. | Approach B plus SQLite virtual generated columns (`tool AS (json_extract(content, '$.tool'))`). |
| **Contract Alignment** | Diverges from `contracts/ledger-store.sql` and `packages/contracts` `ActionRecordRow`. | 100% compliant with ratified `contracts/ledger-store.sql` and `ledger-record.schema.json`. | Compliant with base schema, adds virtual indexing. |
| **Schema Evolution** | Requires table migrations when tool params or record shapes change. | Zero migration needed for record payload evolution; shape changes handled in application layer. | Requires view/index migrations if virtual column definitions change. |
| **Worst-Case Failure** | Migration backfill attempts corrupt historical records, violating INV-LG-08. | Slightly higher JSON serialization overhead on read (p50 query latency remains <0.25 ms per SP-12). | Parsing errors if historical records lack expected fields in `json_extract`. |
| **Key Assumption** | Record payload structure is frozen. | Schema validation happens strictly in TypeScript before DB insertion. | Direct SQL filtering on tool parameters is frequent. |
| **Verdict** | **REJECTED** | **RECOMMENDED** | **RESERVED** (YAGNI for MVP; query indexes on `recorded_at` and `job_id` suffice). |

### Fork 2: Removal Announcement & Atomic Deletion Mechanics

| Dimension | Approach A: Single-Transaction Trigger Recreation | Approach B: Two-Step Decoupled Announcement [RECOMMENDED] | Approach C: Soft-Delete Flag (`is_deleted`) |
|---|---|---|---|
| **Description** | Insert announcement, drop trigger, delete rows, recreate trigger, and commit in one transaction. | Step 1: Append announcement in committed transaction. Step 2: In a subsequent transaction, drop trigger, delete rows, purge files, recreate trigger. | Add `is_deleted` column; set flag instead of deleting. |
| **Spec Scenario Alignment** | If crash occurs mid-transaction, announcement is rolled back. Fails: *"the record announcing removal is present in both cases"*. | Perfectly satisfies scenario: announcement is guaranteed durable even if removal transaction aborts. | Violates Constitution III, FR-LG-02, and fails to reclaim disk space over 90 days. |
| **Immutability Integrity** | High. | High (ordinary paths still blocked; trigger restoration guaranteed inside step 2 transaction). | Corrupts append-only invariant; allows historical row mutation. |
| **Worst-Case Failure** | Interrupted removal leaves no trace of the attempted maintenance action. | Interruption between Step 1 and 2 leaves announcement with unpurged rows, safely retried on next maintenance run. | Database size grows indefinitely; violates disk reclamation requirements. |
| **Verdict** | **REJECTED** | **RECOMMENDED** | **REJECTED** |

---

## 4. Technical Architecture for `packages/ledger-store`

```mermaid
flowchart TD
    subgraph Client Application
        WH[Worker Harness / Agent]
        RC[Recovery Manager / Boot]
        RP[Renderer Process / App UI]
    end

    subgraph packages/ledger-store
        API[LedgerStore API Facade]
        RB[Record Builder & Schema Validator]
        MM[Migration & Shape Manager]
        RM[Retention Manager]
        RO[Store Opener & PRAGMA Configurator]
        CH[Read Channel / Stream]

        subgraph SQLite Engine [better-sqlite3 v13.0.3]
            AR[(action_record)]
            JB[(job)]
            AP[(approval_request)]
            DS[(device_sequence)]
            UV{{unresolved_intent View}}
            TR[Append-Only Triggers: UPDATE/DELETE ABORT]
        end
    end

    WH -->|appendIntent / appendResult| API
    RC -->|listUnresolvedIntents| API
    RP -->|readJob / subscribe| CH

    API --> RB
    RB -->|Validated LedgerRecord| AR
    API --> UV
    UV -.->|Query Derived Intents| RC
    TR -.->|Enforces Invariants| AR
    RM -->|Announce-then-remove| AR
    RO -->|WAL + fullfsync| SQLite Engine
```

### 4.1. Directory Structure
```
packages/ledger-store/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                     # Public API exports
│   ├── store.ts                     # LedgerStore class implementation
│   ├── opener.ts                    # SQLite opener with platform PRAGMA configuration
│   ├── schema.ts                    # DDL, indexes, and triggers matching ledger-store.sql
│   ├── types.ts                     # TypeScript types (LedgerRecord, IntentContent, etc.)
│   ├── builder.ts                   # Record builder with fail-closed validation
│   ├── sequence.ts                  # Monotonic device sequence manager
│   ├── retention.ts                 # Atomic announce-then-remove maintenance
│   ├── migration.ts                 # Shape/migration runner (PRAGMA user_version)
│   └── channel.ts                   # In-process read channel & change emitter
└── tests/
    ├── ledger-store.test.ts         # Unit & scenario tests covering capabilities/ledger/spec.md
    ├── immutability-guard.test.ts   # Engine-level trigger enforcement (internal & external processes)
    ├── migration.test.ts            # Additive migrations and interrupted transaction rollback
    ├── retention.test.ts            # Announce-then-remove atomic lifecycle
    ├── durability-config.test.ts    # Verification of PRAGMA settings per platform and store type
    ├── fixtures/
    │   └── crash-worker.ts          # Subprocess runner for crash injection
    └── crash-injection.test.ts      # Port of SP-12 5-point crash runner
```

---

## 5. Unresolved Questions & Measured Constraints

1. **Q-6: Duration of Startup Recovery Classification Pass on a Full Store**:
   - *Status*: Open observation, non-blocking for implementation.
   - *Context*: `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 measured query latency for individual jobs at 0.13–0.25 ms on a 90-day simulated store (1,800 to 4,500 jobs, 12.4 to 30.8 MB). However, the total duration of the startup classification pass querying `unresolved_intent` before the first window appears has not been measured under full load.
   - *Plan*: Benchmark `listUnresolvedIntents()` against a populated 4,500-job database during F1 testing and record the measured duration in the completion report.

2. **WAL Checkpointing Duration & Strategy under Heavy Burst**:
   - *Status*: Open observation.
   - *Context*: While `synchronous = FULL` and `fullfsync = ON` on macOS guarantee durable commits at 241 writes/s, passive WAL checkpoints occur automatically at 1,000 pages. The latency impact of explicit checkpoints (`PRAGMA wal_checkpoint(TRUNCATE)`) during background retention cleanup needs to be characterized.
   - *Plan*: Verify in retention benchmarks that passive checkpointing does not introduce unacceptable blocking latency to foreground agent tool calls.

---

## 6. Downstream Handoff

- **Next Skill**: Implementation Planning via `ak-plan` (`f01-ledger-local-store`).
- **Follow-up Implementation**: Implementation in `feat/f01-ledger-local-store` worktree via `/ak:cook`.
- **Merge Target**: `dev` branch once all criteria pass across Linux, Windows, and macOS CI.

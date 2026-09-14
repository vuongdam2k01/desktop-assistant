---
contract: ledger-store
version: 0.1.0
status: draft
owner: ledger
consumers: [ledger, job, approval, undo, connector, sync, platform, app, uix]
schema_files: [ledger-store.sql]
---

# Contract: Ledger Store

## Purpose

This is the only way to reach the product's local store. It exposes appending a record, reading what the store
holds, listing the tool calls whose outcome was never recorded, and the two maintenance operations — removing
records at the end of their retention and advancing the store's shape. It exists so that no part of the product
opens the store file itself, and so that the one guarantee everything else rests on — that the record is durable
before the call is made — has a single place where it is either kept or refused.

The shape of what is appended and read is `ledger/contracts/ledger-record@0.1.0`. This contract fixes how it is
appended, who may append it, and what happens when that fails.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`ledger-store.sql`](./ledger-store.sql) | SQL DDL | normative |

`ledger-store.sql` is the physical shape of the store this contract opens: the action-record relation, the
constraints that carry INV-LG-02, INV-LG-04 and INV-LG-09, the immutability guard of INV-LG-06 as a refusal in
the store's own definition, the derived unresolved-intent set recovery reads, and the configuration the crash
evidence was taken under. It declares only the job identity its foreign key rests on; the job and
approval-request relations that share the same file are owned by `job` and `approval`. The content of a record
is one structured-text column there, because its shape is `ledger/contracts/ledger-record@0.1.0` and belongs to
that contract rather than to this schema.

The store's shape version is the store's own version marker, advanced by `advanceShape()` below; it is not the
version of this contract.

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { LedgerRecord, RecordId, JobId, CorrelationId } from "ledger-record@0.1.0";

interface UnresolvedIntent {
  intent: LedgerRecord;          // type: "intent"
  correlationId: CorrelationId;
  jobId: JobId;
  age: number;                   // milliseconds between recordedAt and now, for presentation only
}

interface RecordQuery {
  jobId?: JobId;
  types?: LedgerRecord["type"][];
  from?: string;                 // ISO-8601 bound on recordedAt, inclusive
  to?: string;
  text?: string;                 // matched against the readable rendering, never against credentials
  limit: number;                 // required: the store is never asked for an unbounded result
}

interface RemovalRequest {
  reason: "retention_expiry" | "user_deletion";
  requestedBy: "system" | "user";
  olderThan?: string;            // ISO-8601; required for retention_expiry
  jobIds?: JobId[];              // permitted only for user_deletion
}

interface RemovalOutcome {
  announcement: RecordId;        // the record appended before anything was removed (INV-LG-07)
  recordsRemoved: number;
  attachmentsRemoved: number;
  completed: boolean;            // false only if the store was closed mid-operation; see Semantics
}

interface ShapeState {
  current: number;
  target: number;
  pendingSteps: number[];
}

interface LedgerStore {
  // Writing. Available only inside the process that owns the store.
  append(record: LedgerRecord): Promise<RecordId>;          // durable on return, or it throws
  appendMany(records: LedgerRecord[]): Promise<RecordId[]>; // all appended or none

  // Reading. Available to every consumer, across the process boundary below.
  read(query: RecordQuery): Promise<LedgerRecord[]>;
  readJob(jobId: JobId): Promise<LedgerRecord[]>;           // in position order
  unresolvedIntents(): Promise<UnresolvedIntent[]>;

  // Maintenance. Available only inside the process that owns the store.
  remove(request: RemovalRequest): Promise<RemovalOutcome>;
  shape(): Promise<ShapeState>;
  advanceShape(): Promise<ShapeState>;                      // one whole step at a time (INV-LG-08)
  close(): Promise<void>;
}
```

The relations and refusals these methods operate on are [`ledger-store.sql`](./ledger-store.sql).

There is deliberately no `update`, no `delete` and no `removeRecord`. The surface does not express modifying a
record, which is the application-layer half of append-only; the store's own guard is the other half, and it is
the half that also binds processes that are not the product.

### 2. Wire / Communication Protocol

The store is opened by exactly one process — the one that also makes tool calls — and the window processes reach
it across the boundary below. The boundary is read-only in one direction on purpose: no channel exists by which
a window process can append a record, so a compromised or defective window cannot write history, and the
ledger-before-act rule cannot be satisfied from anywhere except beside the call it precedes.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `ledger.readJob` | Window → Store | Request-Response | `{ jobId }` | `LedgerRecord[]` in position order | `STORE_UNAVAILABLE`, `JOB_UNKNOWN` |
| `ledger.read` | Window → Store | Request-Response | `RecordQuery` | `LedgerRecord[]` | `STORE_UNAVAILABLE`, `QUERY_UNBOUNDED` |
| `ledger.changes` | Store → Window | Stream | — | `LedgerRecord` as appended | Stream loss is not an error: the window re-reads through `ledger.readJob` |
| `ledger.shape` | Window → Store | Request-Response | — | `ShapeState` | `STORE_UNAVAILABLE` |
| *(append)* | — | — | — | — | Not exposed. Appending is in-process only, beside the call being recorded |

### 3. Module Descriptor / Manifest Specification

Not applicable — this contract has no pluggable modules. The one extension point near it is the tool
reconciliation declaration, specified by `job/contracts/tool-reconciliation@0.1.0`.

## Semantics

- **`append` returns only when the record is durable.** A caller that has awaited it may make the call it
  recorded; a caller that received an error must not, and must fail the job with that reason. This is principle
  III at its narrowest point, and it is the property `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q3 measured: the
  commit reaches durable storage before control returns, so a process killed immediately afterwards leaves the
  record present and the call unmade.
- **The store is configured for crash survival, not for throughput.** Write-ahead logging with the ordinary
  durability setting and referential integrity enforced, plus an index on descending recorded time. This is the
  configuration under which the five kill points were measured; changing it changes what the evidence covers.
- **One process opens the store for writing.** A second writer is not an extension point. Readers reach it
  through the channels above. On one supported operating system a file that is still open cannot be replaced, so
  `close` precedes any maintenance that moves or replaces the file.
- **`unresolvedIntents` is the recovery surface.** It returns intents with no matching result, oldest first. It
  reads and does not write, so calling it twice is harmless — which is what lets an interrupted start simply
  start again (INV-PLT-01).
- **`remove` announces before it removes.** It appends the removal announcement, then removes the stated
  records, then restores the store's guard, all within one transaction (INV-LG-06, INV-LG-07). If the process
  stops part-way, the next start finds either the whole range gone or the whole range present, and the
  announcement present in both cases; `completed: false` is reported only to a caller that is still alive to
  receive it.
- **`advanceShape` moves one whole step.** A step adds fields without backfilling them, or rebuilds the store's
  layout by copying records unchanged; it never rewrites a record's content, and the store refuses it if it
  tries (`specs/ledger/spec.md`). Steps are applied in order until `current` reaches `target`, before any other
  use of the store.
- **`RecordQuery.limit` is required.** The store is never asked for an unbounded result, because the caller that
  wants "everything" is always a presentation surface that will page.
- **Text search matches the readable rendering of a record**, never a credential: credentials are not in this
  store at all, per `platform/contracts/secure-storage`.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `LEDGER_WRITE_FAILED` | The record could not be made durable — disk full, store locked, store damaged | Caller | The tool call is not made and the job fails stating that the history could not be written; no platform is touched |
| `RECORD_REJECTED` | The record does not satisfy `ledger-record@0.1.0`; the specific cause is that contract's error matrix | Caller, as a defect | Same as above: fail closed, no call |
| `STORE_UNAVAILABLE` | The store is not open — starting, closed for maintenance, or failed to open | Both | Reads report that the history is momentarily unavailable; writes fail closed, so no call proceeds |
| `STORE_DAMAGED` | The store fails its integrity check on open | Callee | The product reports that it cannot open its history and does not run jobs, rather than starting with an unknown history |
| `SHAPE_AHEAD` | The store's shape is newer than this product version understands | Callee | The product states that the store was written by a newer version and refuses to open it, rather than reading records it may misread |
| `SHAPE_STEP_FAILED` | A shape step could not be applied | Callee | The store is left at the shape it had; the product reports the failure and does not run jobs |
| `SHAPE_WOULD_REWRITE` | A shape step attempts to rewrite existing records | Callee | The step is refused; this is a defect in the step, not a condition the user can resolve |
| `JOB_UNKNOWN` | A read names a job the store does not hold | Caller | The surface shows that the job is not in this device's history |
| `QUERY_UNBOUNDED` | A query carries no limit | Caller, as a defect | None: the surface pages as it was always required to |
| `REMOVAL_SCOPE_INVALID` | A retention removal with no age bound, or a user deletion naming no jobs | Caller, as a defect | Nothing is removed |
| `RECORD_IMMUTABLE` | Any attempt to modify or delete a record outside `remove` | The store itself | Refused for every process that opens the store, not only for the product |

## Compatibility

- **MAJOR** — removing a method, adding a required parameter, removing a channel, or exposing an append channel
  across the process boundary. The last is major not because it breaks a caller but because it removes a
  guarantee this contract exists to make.
- **MINOR** — adding a method, an optional parameter, a channel, or an error code that a caller can treat as it
  already treats the nearest existing one.
- **PATCH** — wording, and error messages that do not change a code.
- Version discovery is by the contract version recorded in this file; the store's own shape version is separate
  and is discovered through `shape()`.

## Examples

A valid sequence around one tool call — the order is the contract, not an implementation detail:

```typescript
const intentId = await store.append(intentRecord);   // returns only when durable
const response = await connector.call(tool, params); // only now may the platform be touched
await store.append(resultRecordFor(intentId, response));
```

A rejected use, and why:

```typescript
const response = await connector.call(tool, params);
await store.append(resultRecordFor(response));       // the only record this call ever produces
```

This is refused by `ledger-record@0.1.0` with `CORRELATION_UNMATCHED`, because the result names no intent. It is
also the exact failure principle III exists to prevent: a process that stops between the call and the append
leaves a change on the user's real account with nothing in the history saying it happened, and therefore nothing
undo can compensate. The fail-closed direction is the opposite one — if the first `append` throws, the call is
never made, and the cost of the failure is a job that did nothing rather than a change nobody can find.

## Migration

Not applicable at 0.1.0 — this is the first version and has no consumers on an earlier one.

---
contract: offline-queue
version: 0.1.0
status: draft
owner: app
consumers: [uix, backend]
schema_files: [offline-queue.sql, offline-queue.schema.json]
---

# Contract: Offline Command Queue

## Purpose

Defines the durable local storage schema, lifecycle transitions, and drain protocol for user commands submitted while the backend intake service is disrupted or unreachable. Guarantees that no user command is dropped during network outages, preserves causality through strict FIFO dispatch upon recovery, suppresses duplicate transmissions using client-generated idempotency keys, and establishes non-blocking system status notifications.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`offline-queue.sql`](./offline-queue.sql) | SQL DDL | normative |
| [`offline-queue.schema.json`](./offline-queue.schema.json) | JSON Schema 2020-12 | normative |

`offline-queue.sql` is the physical shape of the queue: the relation, the closed status set, and the unique
idempotency key that is the whole basis of exactly-once acceptance. It carries no ledger, job or decision
relation, though those share the same database file; each is owned by its own capability and is not declared
twice. It also carries no replication marker, and that absence is deliberate — a command the backend has not
accepted is not yet a job, and carrying one to a second device would mean two devices racing to submit the same
intention.

`offline-queue.schema.json` is the payload the client sends the intake service, and it is the same payload
whether the command goes straight through or has waited in the queue. That is the point of it: a drained command
is not a special kind of submission, it is an ordinary one that happened later, which is why the idempotency key
is required on every send rather than only on a retry.

What neither file can express is the drain itself — that pending commands are dispatched oldest-first and one at
a time, and that a `deduplicated` answer is recorded as a successful sync rather than as a failure. Both are
stated below.

## Schema / Surface

### 1. Interface & Data Types

The stored record is shaped by [`offline-queue.sql`](./offline-queue.sql) and the intake payload by
[`offline-queue.schema.json`](./offline-queue.schema.json). The declarations below name the same members for a
reader and add the response the intake service returns, which is the backend's surface rather than this one.

```typescript
export type OfflineCommandStatus = "QUEUED_OFFLINE" | "SENDING" | "SYNCED" | "FAILED" | "CANCELLED";

export interface OfflineCommandRecord {
  /** Unique identifier (UUIDv4) of the queued command entry */
  id: string;
  /** Raw text of user instruction entered via Composer */
  command_text: string;
  /** Current synchronization lifecycle status */
  status: OfflineCommandStatus;
  /** Client-generated UUID ensuring exactly-once processing at the backend */
  idempotency_key: string;
  /** Milliseconds epoch timestamp when command was recorded */
  created_at: number;
  /** Milliseconds epoch timestamp when command was successfully synced */
  synced_at?: number | null;
  /** Number of dispatch attempts made */
  retry_count: number;
}

export interface IntakeCommandPayload {
  command_text: string;
  idempotency_key: string;
  client_timestamp: number;
}

export interface IntakeCommandResponse {
  status: "accepted" | "deduplicated" | "rejected";
  job_id?: string;
  message?: string;
}
```

### 2. Physical Storage

The queue relation, its closed status set, its unique idempotency key and the index the drain reads are
[`offline-queue.sql`](./offline-queue.sql), held beside this document rather than transcribed into it.

### 3. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `POST /api/v1/commands/intake` | Client -> Backend | Request-Response | `IntakeCommandPayload` | `IntakeCommandResponse` | HTTP 500/503/Timeout -> retry with exponential backoff; HTTP 200 with `deduplicated` -> mark `SYNCED` |
| `app:offline_queue:updated` | Main -> Renderer | IPC Pub-Sub | `{ queueLength: number, oldestTimestamp?: number }` | Void | Updates UI status card and pet badge |
| `app:offline_queue:cancel` | Renderer -> Main | IPC Request-Response | `{ id: string }` | `{ success: boolean }` | Marks status `CANCELLED` and removes from drain schedule |

## Semantics

1. **Local-First Enqueueing**: When `POST /api/v1/commands/intake` fails due to network unreachability, connection refusal, or HTTP 5xx errors, the command is immediately inserted into `offline_command_queue` with status `QUEUED_OFFLINE`.
2. **Strict Chronological FIFO Drain**: Upon detecting connectivity restoration, the drain worker fetches pending items using `SELECT * FROM offline_command_queue WHERE status = 'QUEUED_OFFLINE' ORDER BY created_at ASC` and dispatches them sequentially.
3. **Backend Deduplication**: The backend checks the `idempotency_key` against processed requests. If the key exists, the backend returns `{ status: "deduplicated", message: "Command already received." }`, which the client handles as a successful sync (`status = 'SYNCED'`).
4. **Device Boundary**: Queued offline commands are strictly device-bound and are NEVER replicated to other devices via account sync until converted into active jobs by the backend.
5. **Retention**: Synced commands (`status = 'SYNCED'`) are retained for 7 days before automated cleanup.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `ECONNREFUSED` / Timeout | Backend server offline or network down | Client Queue Worker | Presents non-blocking `SYSTEM` card; queues command in SQLite; composer stays ready |
| `503_SERVICE_UNAVAILABLE` | Backend undergoing maintenance | Client Queue Worker | Continues queueing commands; initiates periodic ping check |
| `DUPLICATE_IDEMPOTENCY_KEY` | Client retried already acknowledged command | Backend | Server returns 200 OK with `deduplicated` status; client marks local row `SYNCED` |
| `CORRUPT_QUEUE_ENTRY` | Malformed SQLite record | Client Queue Worker | Item marked `FAILED`; logged to diagnostic error log |

## Compatibility

- **MAJOR**: Changing the required columns in `offline_command_queue` or altering the intake HTTP payload format.
- **MINOR**: Adding non-required columns (e.g. metadata tags) or adding new non-breaking status values.
- **PATCH**: Documentation updates, index tuning, or retention policy adjustments.

## Examples

### Valid Example

```json
{
  "command_text": "Create Notion task for Q4 Marketing Plan",
  "idempotency_key": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "client_timestamp": 1757653800000
}
```
*Backend Response (Successful Intake)*:
```json
{
  "status": "accepted",
  "job_id": "job-8812-notion-task",
  "message": "Command queued for worker dispatch"
}
```

### Rejected Example

```json
{
  "command_text": "",
  "idempotency_key": "invalid-key-short",
  "client_timestamp": -1
}
```
*Rationale for rejection*: Empty command text violates schema requirement `minLength: 1`, invalid idempotency format, and negative timestamp.

---
contract: ledger-record
version: 0.1.0
status: draft
owner: ledger
consumers: [ledger, job, undo, approval, connector, sync, app, uix, agent]
schema_files: [ledger-record.schema.json]
---

# Contract: Ledger Record

## Purpose

This is the shape of one entry in the product's history, and the sole surface on which anything else is built:
undo infers a compensating sequence from these records, the job detail page renders them, the approval gate's
decisions are recorded as them, recovery reads them to work out what an interrupted call actually did, and
replication carries them to the account. Nothing reads the store's internal layout; everything reads this.

Two boundaries carry these records and neither is defined here. The process boundary between the store and the
windows is `ledger/contracts/ledger-store@0.1.0`. The client/backend boundary is
`sync/contracts/replication-protocol@0.1.0`, whose `RecordEnvelope` carries a record as its payload; the
envelope's `originDevice`, `originSequence`, `causalPosition` and `recordedAt` are the same values the record
below carries, assigned once at write time (INV-LG-09) and never recomputed.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`ledger-record.schema.json`](./ledger-record.schema.json) | JSON Schema 2020-12 | normative |

The schema file is the record's shape. What it cannot express is stated here instead, and is enforced by
`ledger/contracts/ledger-store@0.1.0` at append time: that a correlation identifier is never reused, that a
result closes an intent that is still open, and that a successful result for a call declared reversible carries
the compensating action undo would replay. Each of those is a relation between records rather than a property of
one, so a record can satisfy the schema and still be refused.

## Schema / Surface

### 1. Interface & Data Types

The normative shape is [`ledger-record.schema.json`](./ledger-record.schema.json). The declarations below name
the same fields for a reader and add the meaning the schema carries only as description.

```typescript
type RecordId       = string;
type JobId          = string;
type CorrelationId  = string;   // joins exactly one intent to at most one result (INV-LG-04)
type DeviceId       = string;

type RecordType =
  | "intent"              // a tool call is about to be made; written before the call leaves the device
  | "result"              // that tool call returned; written after it
  | "decision"            // a human or the risk judge decided: approve, deny, cancel, confirm an undo, confirm an outcome
  | "error"               // something failed or was interrupted, including a call recovery concluded never happened
  | "information"         // a step worth accounting for that is neither a call nor a decision
  | "removal_announcement"// records are about to leave the store, and why (INV-LG-07)
  | "superseded_version"; // replication resolved a mutable record; the displaced version is kept

interface LedgerRecord {
  recordId: RecordId;
  jobId: JobId;
  position: number;              // dense and strictly increasing within the job (INV-LG-02)
  type: RecordType;
  originDevice: DeviceId;
  originSequence: number;        // monotonic within originDevice, never reused (INV-SYNC-05, INV-LG-09)
  recordedAt: string;            // ISO-8601; displayed, never used to order (INV-SYNC-06)
  correlationId?: CorrelationId; // required on intent and result; absent on every other type
  references?: RecordId[];       // the records this one corrects, answers, or announces the removal of
  content: IntentContent | ResultContent | DecisionContent | ErrorContent | InformationContent
         | RemovalAnnouncementContent | SupersededVersionContent;
}

interface IntentContent {
  connector: string;
  tool: string;
  parameters: unknown;                       // as they will be sent; external content, never instruction
  before: Snapshot | SnapshotUnavailable;
  reversibility: Reversibility;
  reconciliation: ReconciliationDeclaration; // copied at write time (INV-LG-05); see tool-reconciliation@0.1.0
}

interface ResultContent {
  outcome: "succeeded" | "failed";
  establishedBy: "observed" | "reconciled" | "user_confirmed";  // never presented as stronger than it is
  response?: unknown;                        // as returned; absent when established by reconciliation
  after?: Snapshot | SnapshotUnavailable;
  compensatingAction?: CompensatingAction;   // absent only when reversibility is "irreversible"
  failure?: FailureDetail;
}

interface Snapshot {
  captured: true;
  target: string;                            // the object this state belongs to
  state: unknown;                            // the complete state, held whole rather than as a difference
}

interface SnapshotUnavailable {
  captured: false;
  target?: string;
  reason: string;                            // why no state could be read; never omitted (specs/ledger)
}

type Reversibility =
  | { kind: "reversible"; snapshotMethod: string }
  | { kind: "irreversible"; reason: string };

interface CompensatingAction {
  connector: string;
  tool: string;
  parameters: unknown;                       // replayed by undo against current state, not diffed
}

interface FailureDetail {
  code: string;
  message: string;                           // shown to the user; carries no model rewording of hook data
  retriable: boolean;
}

interface DecisionContent {
  decision: "approve" | "deny" | "cancel" | "confirm_undo" | "confirm_outcome";
  decidedBy: "user" | "risk_judge";
  scope?: string;                            // what the decision covers, when it covers more than this call
  reason?: string;                           // required when decidedBy is "risk_judge"
  answers?: RecordId;                        // the approval request or confirmation this answers
}

interface ErrorContent {
  code: string;
  message: string;
  interrupted?: boolean;                     // true when recovery concluded the call never reached the platform
}

interface InformationContent {
  summary: string;
  detail?: unknown;
}

interface RemovalAnnouncementContent {
  reason: "retention_expiry" | "user_deletion";
  requestedBy: "system" | "user";
  range: { fromRecordedAt: string; toRecordedAt: string; recordCount: number };
}

interface SupersededVersionContent {
  supersededRecord: RecordId;
  supersedingRecord: RecordId;
  supersededPayload: unknown;
  supersededDevice: DeviceId;
}
```

### 2. Wire / Communication Protocol

Not applicable in this contract, deliberately. A record crosses two boundaries and each is owned elsewhere:
`ledger/contracts/ledger-store@0.1.0` carries it between the process holding the store and the windows, and
`sync/contracts/replication-protocol@0.1.0` carries it to the account. This contract fixes what is carried, so
that both boundaries carry the same thing.

### 3. Module Descriptor / Manifest Specification

Not applicable — the one declaration a record embeds is specified by `job/contracts/tool-reconciliation@0.1.0`.

## Semantics

- **`correlationId` is present exactly on `intent` and `result`.** One intent carries it, at most one result
  carries it, and no second call may reuse it (INV-LG-04). A result whose correlation identifier matches no
  intent is not a record of a call and is refused.
- **`content` is fixed when the record is written.** Anything learned later is a new record that names this one
  in `references` (INV-LG-10). There is no edit, no patch and no supersede-in-place; `superseded_version` is
  itself an appended record about a mutable record in another store, not a rewrite of a ledger record.
- **`establishedBy` is the honesty field.** `observed` means the product saw the platform's response.
  `reconciled` means recovery inferred the outcome from the platform's later state, which is a weaker claim and
  must be presentable as such wherever the history is read. `user_confirmed` means the user said so, which is
  the only evidence available for a tool whose effect cannot be read back. A consumer that treats the three as
  equivalent is using this contract incorrectly.
- **`before` and `after` hold whole state, not differences.** Undo replays a compensating action against current
  state and reconciles what it finds, per principle IV; it never computes a patch from two snapshots. A snapshot
  that could not be taken is explicit rather than absent, because "no state recorded" and "state recorded as
  empty" lead to different undo decisions.
- **`reversibility` is declared on the intent, not inferred from the result.** Principle IV requires the
  declaration to exist before the call, and a call that failed is still a call whose reversibility was declared.
- **`recordedAt` orders nothing.** Ordering is `position` within a job and `originSequence` within a device,
  with cross-device ordering owned by `sync/contracts/replication-protocol@0.1.0`. RISK-068 records what using
  the clock instead would cost.
- **Every `unknown` payload is data.** `parameters`, `response`, `state` and `supersededPayload` hold content
  fetched from platforms and typed by the user. Reading the history never executes, follows or obeys them.

## Error Matrix

This contract defines a data shape rather than a callable surface, so refusals are raised by
`ledger/contracts/ledger-store@0.1.0`, which validates records against this shape before appending them. The
conditions this shape makes refusable are:

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `RECORD_TYPE_UNKNOWN` | `type` is outside the closed set | Callee refuses, caller is a defect | The operation that tried to write it fails closed; no tool call proceeds |
| `CORRELATION_MISSING` | `intent` or `result` without `correlationId` | Callee refuses | As above; the call is not made, per principle III |
| `CORRELATION_REUSED` | A second intent, or a second result, claims an identifier already used | Callee refuses | As above; prevents one call's result closing another call's intent |
| `CORRELATION_UNMATCHED` | A `result` whose `correlationId` matches no intent | Callee refuses | As above |
| `SNAPSHOT_UNDECLARED` | `before` is neither a snapshot nor an explicit unavailability with a reason | Callee refuses | As above |
| `REVERSIBILITY_UNDECLARED` | `intent` carries no reversibility declaration | Callee refuses | As above; principle IV is not satisfiable without it |
| `COMPENSATION_MISSING` | A successful `result` for a reversible call carries no compensating action | Callee refuses | As above; undo would otherwise silently have nothing to replay |
| `RECORD_IMMUTABLE` | Any attempt to write a record that already exists | Store refuses, at the store's own level | Refused for every process, including tools that are not the product |

## Compatibility

- **MAJOR** — removing a field, narrowing the meaning of one, or adding a value to `RecordType`. A new record
  type is a major change because every consumer decides what it may do from the type, and a reader that has not
  been taught the new type cannot present or compensate it safely.
- **MINOR** — adding an optional field, or adding an optional value to a field that already has a defined
  absent-meaning. Records written before the addition carry no value for it and are never backfilled
  (`specs/ledger/spec.md`, the requirement on shape changes).
- **PATCH** — clarifying wording with no change to what is written or how it is read.
- Records are self-describing by `type` and are read by the product version that opens the store. A consumer
  encountering a record it does not understand presents it as an unintelligible step and refuses to compensate
  it, rather than guessing; it never removes it.

## Examples

A valid intent record, for a call that is about to change a task's status:

```json
{
  "recordId": "rec_01J8F3K2",
  "jobId": "job_01J8F3J9",
  "position": 4,
  "type": "intent",
  "originDevice": "dev_win_01",
  "originSequence": 1841,
  "recordedAt": "2026-09-12T08:14:21.442Z",
  "correlationId": "corr_01J8F3K2QA",
  "content": {
    "connector": "notion",
    "tool": "update_page",
    "parameters": { "pageId": "p_7f21", "properties": { "Status": "In Progress" } },
    "before": {
      "captured": true,
      "target": "p_7f21",
      "state": { "Status": "To Do", "Priority": "High", "Tags": ["beta"] }
    },
    "reversibility": { "kind": "reversible", "snapshotMethod": "get_page" },
    "reconciliation": {
      "method": "readback",
      "read_operation": "get_page",
      "comparison": { "path": "properties.Status", "against": ["before", "intended"] }
    }
  }
}
```

A rejected record, and why: a result that claims to have been observed while carrying no response, and that
reuses the correlation identifier of a call already closed.

```json
{
  "recordId": "rec_01J8F3M0",
  "jobId": "job_01J8F3J9",
  "position": 5,
  "type": "result",
  "originDevice": "dev_win_01",
  "originSequence": 1842,
  "recordedAt": "2026-09-12T08:14:22.101Z",
  "correlationId": "corr_01J8F3K2QA",
  "content": {
    "outcome": "succeeded",
    "establishedBy": "observed"
  }
}
```

The schema accepts it and it is still wrong: both rules that refuse it are relations between records, and
`ledger-record.schema.json` describes one record. It is refused with `CORRELATION_REUSED` if that identifier
already has a result, and it would be refused with `COMPENSATION_MISSING` in any case: the call it closes
declared itself reversible, so a successful result must carry the compensating action undo would replay. Writing it as `establishedBy: "reconciled"` with no response
would be legitimate — that is exactly what recovery appends — but only against an intent that is still open.

## Migration

Not applicable at 0.1.0 — this is the first version and has no consumers on an earlier one.

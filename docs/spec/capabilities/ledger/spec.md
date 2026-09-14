# ledger Specification

## Purpose
Owns the append-only record of everything the system did and every decision a human made: an intent record written before each tool call and a result record after it, with before and after snapshots, reversibility flags and compensating actions. A failed ledger write stops the operation. Records are account-owned and replicate to every signed-in device, so append-only holds across replicas and not only within one store.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence). Amended 2026-09-12 by change `req-022-account-sync` (constitution 2.0.0).

## Requirements

### Requirement: A ledger record carries the full account of one step

Each ledger record SHALL carry the job identifier, the step sequence number, the record type — tool call,
decision, approval, error or information — the tool and its parameters, the outcome, the before and after
snapshots where they exist, the reversibility flag, the compensating action where one exists, and a timestamp;
when multiple records within the same job modify the same target object, each record SHALL capture its own discrete
before and after snapshot, preserving the sequential transition history.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-01),
`docs/raw-idea/prd-mvp.md#12-1-du-lieu-phia-client-local-first`,
`spikes/SP-9-undo-agent/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`.

#### Scenario: Snapshot is unavailable
- **WHEN** the target object cannot be read before the operation
- **THEN** the record is written with no before snapshot and with the reversibility flag set to false

#### Scenario: Outcome is not yet known
- **WHEN** the record is written before the external call returns
- **THEN** the outcome field is unresolved until the result is recorded, and the record is never rewritten to
  add it

#### Scenario: Repeated modifications to the same target object in one job
- **WHEN** a job modifies a single object across multiple sequential steps
- **THEN** each step records distinct `snapshot_before` and `snapshot_after` payloads, allowing the conflict probe
  to reference the final record's `snapshot_after` while preserving intermediate step states

### Requirement: The ledger is append-only

Ledger records SHALL never be modified once written on any device or on the backend, SHALL NOT be deleted by any
path other than retention expiry and deliberate deletion by the user, a correction SHALL be a new record that
references the original, and replication SHALL NOT remove, replace or overwrite a record on any replica. The
refusal SHALL be enforced by the store itself, so that it holds for any process that opens the store and not
only for the product's own writing path.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-02),
`docs/spec/constitution.md` principle III, `spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan` — VERIFIED for the
engine-level refusal, which blocked modification and deletion issued from outside the product as well as from
within it; RISK-065 records that last-writer-wins replication would break this principle, which is why it is
forbidden for this store, and RISK-044 records what the engine-level refusal does not cover.

#### Scenario: Correcting a recorded mistake
- **GIVEN** a record captured an incorrect outcome
- **WHEN** the correction is made
- **THEN** a new record is appended referencing the original, and the original is unchanged

#### Scenario: External modification attempt
- **WHEN** an attempt is made to update or delete a stored record by any route
- **THEN** the store refuses it

#### Scenario: A tool outside the product opens the store directly
- **GIVEN** the store file is opened by a database tool that is not the product
- **WHEN** that tool issues a modification or a deletion against a record
- **THEN** the store refuses it and reports why, so append-only does not depend on which program is writing

#### Scenario: Replication carries a competing version of an existing record
- **WHEN** replication delivers a record that claims to replace one already held
- **THEN** the held record is left unchanged and both are reconciled as records, so no history is lost

#### Scenario: Records survive the device that wrote them
- **GIVEN** a device that wrote ledger records is revoked and erases its local store
- **WHEN** the ledger is read on another signed-in device
- **THEN** the records that device wrote are still present

### Requirement: Writing the ledger record precedes the operation

A tool call SHALL NOT execute until its ledger record has been written, and a failure to write the ledger SHALL
prevent the operation.

Source: `docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` (NFR-RL-03),
`docs/spec/constitution.md` principle III — UNVERIFIED.

#### Scenario: Storage is full
- **GIVEN** the ledger store cannot accept writes
- **WHEN** a tool call is attempted
- **THEN** the call does not execute and the job fails with that reason

#### Scenario: Crash between record and call
- **GIVEN** the record was written and the process stopped before the call
- **WHEN** the application starts again
- **THEN** the unresolved record is visible to recovery, so the state can be reconciled rather than assumed

### Requirement: Human decisions are ledger records

Approving, denying, cancelling and confirming an undo SHALL each be recorded in the ledger as a record of type
decision, carrying who decided and when.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-04),
`docs/spec/constitution.md` principle III — UNVERIFIED.

#### Scenario: Denial is recorded
- **WHEN** the user denies an approval request
- **THEN** a decision record is written, including the request it answered

#### Scenario: Automatic decision is distinguishable
- **WHEN** the risk judge approves an operation automatically
- **THEN** the decision record identifies the decision as automatic and carries its reason, so it is not
  indistinguishable from a human approval

### Requirement: Every change is traceable to a record

Every change an agent makes on a connected platform SHALL be traceable to a ledger record, and no path SHALL
exist by which an operation reaches a platform without one.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-05) — UNVERIFIED.

#### Scenario: Audit of a completed job
- **GIVEN** a job modified four objects
- **WHEN** the platform state is compared with the ledger
- **THEN** each of the four modifications corresponds to a record, and the ledger holds no record without a
  corresponding effect or a recorded failure

### Requirement: The ledger is readable as plain language with raw data available

The ledger SHALL be presented to the user as readable natural-language steps, and each step SHALL be expandable
to show the underlying raw data.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-03) — UNVERIFIED.

#### Scenario: Reading what happened
- **WHEN** the user opens a job's ledger
- **THEN** each step reads as a sentence describing what was done to which object

#### Scenario: Inspecting the underlying call
- **WHEN** the user expands a step
- **THEN** the tool parameters, the response and the snapshots are shown as recorded

### Requirement: The ledger can be searched and filtered

The ledger SHALL be searchable and filterable by job, operation type and time range.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-06, priority Should) — UNVERIFIED.

#### Scenario: Finding every deletion in a period
- **WHEN** the user filters by operation type and time range
- **THEN** only the matching records are listed

### Requirement: Retention is bounded, configurable and deleted only deliberately

The ledger SHALL retain records for at least 90 days by default, that period SHALL be configurable, deleting
ledger data SHALL require a deliberate user action carrying a warning about what is lost, and retention SHALL
apply to the account across every device and the backend rather than to one device's store.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-07, priority Should),
`docs/spec/changes/req-022-account-sync/clarifications.md` Q-4 — UNVERIFIED; the source marks the 90-day figure
as proposed, `req-013-sqlite-ledger` measures its per-device storage cost, and RISK-069 records that the account
total across devices is unmeasured.

#### Scenario: Deletion is warned about
- **WHEN** the user asks to delete ledger data
- **THEN** the product states that undo of the affected jobs becomes impossible, and deletes only after
  confirmation

#### Scenario: Retention expiry removes attachments too
- **WHEN** records pass the retention period
- **THEN** the image extracts they reference are removed with them

#### Scenario: Deletion reaches every device
- **GIVEN** the account is signed in on two devices
- **WHEN** the user deletes ledger data on one
- **THEN** the deletion replicates, and the deleted records do not return from the other device or from the
  backend

#### Scenario: Expiry applies to a device that was offline
- **GIVEN** a device was offline while records passed the retention period
- **WHEN** it reconnects
- **THEN** those records are removed from it rather than being replicated back to the account

### Requirement: A ledger record carries the device that wrote it and its position in that device's sequence

Each ledger record SHALL carry the identifier of the device that wrote it and a sequence number that is monotonic
within that device.

Source: `docs/spec/changes/req-022-account-sync/clarifications.md` Q-2 — UNVERIFIED; RISK-068.

#### Scenario: Reading where a step ran
- **WHEN** the user expands a replicated ledger record
- **THEN** it identifies the device on which the step was performed

#### Scenario: A device's sequence does not restart
- **GIVEN** a device has written records and the application is restarted
- **WHEN** it writes the next record
- **THEN** the sequence number continues from where it stopped rather than repeating a number it has used

### Requirement: A superseded version of a mutable record is preserved in the ledger

When replication resolves a conflict in a mutable record, the superseded version SHALL be appended to the ledger
as a record that identifies the record it belongs to, the version that became current, and the device that wrote
the superseded one.

Source: `docs/spec/changes/req-022-account-sync/clarifications.md` Q-1 — UNVERIFIED.

#### Scenario: Reading why a rule changed
- **GIVEN** an approval rule was resolved between two devices
- **WHEN** the user reads the ledger
- **THEN** the superseded version is legible as a step describing what was replaced and by which device's edit

#### Scenario: No conflict, no record
- **WHEN** a mutable record is edited on one device with no competing edit
- **THEN** no superseded-version record is written, so the ledger does not fill with entries for ordinary edits

### Requirement: One tool call is two records joined by a correlation identifier

A tool call SHALL produce an intent record written before the call leaves the device and a result record written
after it returns, both carrying the same correlation identifier, and neither record SHALL be rewritten to carry
what the other holds.

Source: `spikes/SP-12-sqlite-ledger/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED; the two-record shape is what
allows append-only and writing before the call to hold at the same time, since the outcome is unknown at the
moment the record must exist.

#### Scenario: A call that returns
- **WHEN** a tool call is made and the platform answers
- **THEN** the store holds two records sharing one correlation identifier, the first written before the call and
  the second after it

#### Scenario: A call the platform refuses
- **WHEN** the platform rejects the call
- **THEN** the result record records the refusal, and the intent record is unchanged from how it was written

#### Scenario: The process stops between the two records
- **GIVEN** an intent record was written
- **WHEN** the process stops before the result record is written
- **THEN** the store holds the intent record with no result record carrying its correlation identifier

#### Scenario: Two calls in one job
- **WHEN** a job makes two tool calls
- **THEN** each call has its own correlation identifier, so the records of one call cannot be read as the records
  of the other

### Requirement: The intent record fixes what recovery may assume about the call

The intent record SHALL carry, as recorded at the moment it is written, the state of the target object before
the call or the reason no such state could be read, and the declaration of whether the effect of this call can
be read back from the platform afterwards; and a later change to that declaration SHALL NOT alter how an
already-written intent record is interpreted.

Source: `spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-045),
`docs/spec/changes/req-013-sqlite-ledger/clarifications.md` Q-3 — VERIFIED for the reconciliation behaviour the
declaration drives; copying the declaration into the record is the decision recorded in the clarification.

#### Scenario: The declaration changes between the call and the recovery
- **GIVEN** an intent record was written while its tool declared that its effect can be read back
- **WHEN** the tool's declaration is changed and the application then recovers that record
- **THEN** recovery follows the declaration held in the record, not the current one

#### Scenario: The target cannot be read before the call
- **WHEN** the object the call will change cannot be read beforehand
- **THEN** the intent record states that no prior state was captured and why, rather than omitting the field

#### Scenario: No declaration exists for the tool
- **WHEN** a tool carries no declaration of whether its effect can be read back
- **THEN** the intent record records that the effect cannot be read back, so recovery asks rather than assumes

### Requirement: Tool calls whose outcome was never recorded are listable

The store SHALL be able to list every intent record that has no result record carrying its correlation
identifier, and that list SHALL be available before any other work begins after a start.

Source: `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q3 — VERIFIED; the unresolved intent is the state an
interrupted call leaves behind, and the list of them is what recovery reads.

#### Scenario: After an abrupt stop
- **GIVEN** the process was killed while three calls were in flight and one had already recorded its result
- **WHEN** the list is read on the next start
- **THEN** it contains exactly the two calls whose result was never recorded

#### Scenario: Nothing was interrupted
- **WHEN** the list is read after an ordinary shutdown in which every call recorded its result
- **THEN** the list is empty and the start proceeds without reconciliation

### Requirement: Records leave the store only whole, and only after the store says so

A record SHALL leave the store only as a whole record removed by retention expiry or by a deletion the user
deliberately asked for, each such removal SHALL be preceded by an appended record stating what is being removed
and why, and a removal SHALL leave either all of the stated records gone or none of them.

Source: `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q6 — VERIFIED for the atomic procedure;
`docs/spec/changes/req-013-sqlite-ledger/clarifications.md` Q-4 — the separation of expiry from modification is
the decision recorded there, so that a gap in the history is always explained by a record in the history.

#### Scenario: Records reach the end of the retention period
- **WHEN** the retention period passes for a set of records
- **THEN** a record is appended stating the range and the reason before those records are removed, and the
  remaining records are unchanged

#### Scenario: The user deletes their history
- **WHEN** the user deliberately deletes ledger data
- **THEN** a record stating what was deleted and at whose request survives the deletion

#### Scenario: The application stops during a removal
- **WHEN** the process stops while records are being removed
- **THEN** on the next start either every record of the stated range is gone or every one is still present, and
  the record announcing the removal is present in both cases

#### Scenario: Removal is not a route to editing
- **WHEN** any path attempts to remove a record in order to write a changed version of it
- **THEN** the store refuses, because removal is available only to retention expiry and to deliberate deletion

### Requirement: A change to the store's shape leaves existing records as they were written

Changing the shape of the store between product versions SHALL leave every existing record with the content it
was written with, SHALL NOT backfill new fields into records written before those fields existed, and SHALL be
refused if it would rewrite a historical record.

Source: `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q6 — VERIFIED; adding a field to the store left historical
records untouched and carrying no value for it, and an attempt to rewrite historical records during the same
operation was refused by the store.

#### Scenario: A new field is added
- **GIVEN** records were written before a field existed
- **WHEN** the product adds that field and reads the old records
- **THEN** the old records carry no value for it, and their other content is exactly what was written

#### Scenario: A shape change tries to reinterpret history
- **WHEN** a change to the store's shape attempts to rewrite records written by an earlier version
- **THEN** the store refuses it, and the product reinterprets old records when reading them instead

#### Scenario: The shape change is interrupted
- **WHEN** the process stops part-way through a change to the store's shape
- **THEN** the next start finds the store either wholly at the old shape or wholly at the new one, and its
  records readable in both cases

### Requirement: A recorded before state is captured under exclusive access to its target

The before state an intent record carries SHALL be read while the call holds exclusive access to the target, and
that access SHALL be held until the result record for the call is durable, so that no other job can change the
target between the moment the state is recorded and the moment the outcome is.

Source: `spikes/SP-15-concurrency/REPORT.md` §1 Q2 — VERIFIED, and this requirement exists because of what was
measured: without the exclusive span, a second job read its before state while the first was mid-write, recorded
a state that was already false, and the later compensation of that second job restored it and erased the first
job's completed work, which the first job's own history said was still in place. With the span, the second job's
recorded before state matched what the first job had left, and compensating it preserved that work. The evidence
is `spikes/SP-15-concurrency/evidence/q2-dirty-snapshot.json` and records 3 to 6 of
`spikes/SP-15-concurrency/evidence/sp15-ledger.db`.

#### Scenario: Two jobs write to one object
- **GIVEN** one job is between reading its before state and recording its result on an object
- **WHEN** a second job begins a write to the same object
- **THEN** the second job's before state is read only after the first job's result record is durable, so it
  records what the first job left rather than what preceded it

#### Scenario: Undoing the second job preserves the first
- **GIVEN** two jobs wrote to one object in sequence under exclusive access
- **WHEN** the user undoes the second job
- **THEN** the first job's change is still in place afterwards, because the state the second job compensated
  against was true when it was recorded

#### Scenario: A read takes no exclusive access
- **WHEN** a job reads an object without writing to it
- **THEN** it neither waits for nor blocks a write on that object, because a read records no before state to be
  made false

#### Scenario: The process stops while access is held
- **GIVEN** a job holds exclusive access to an object
- **WHEN** the process stops
- **THEN** the next start finds no access held by anything, and the interrupted call is classified from its
  unresolved intent record exactly as any other interrupted call is

### Requirement: A call whose recorded before state no longer matches its target does not execute

When exclusive access to a target was released after the before state was recorded and before the call executed,
the call SHALL re-obtain that access and compare the target with the recorded before state, SHALL execute only
when they still match, and SHALL otherwise be refused with a recorded reason naming the change rather than
executing against a state its own record misdescribes.

Source: `docs/spec/changes/req-015-concurrency-coordinator/clarifications.md` Q-1 — the decision that an
approval waiting on a person releases the exclusive span rather than holding it. The failure this guards against
is the one measured in `spikes/SP-15-concurrency/REPORT.md` §1 Q2, reached by a different route: an approval
that waits while another job writes to the same object leaves exactly the stale recorded state that
compensation later restores. `docs/spec/constitution.md` principles III and IV — a record that is accurate about
the call and wrong about the world is what makes a compensating action destructive.

#### Scenario: The target is unchanged when the decision arrives
- **GIVEN** a call was held for approval and its target was not changed while the user decided
- **WHEN** the user approves it
- **THEN** the call executes, and the before state already recorded for it remains the state it is compensated
  against

#### Scenario: The target changed while the user was deciding
- **GIVEN** a call was held for approval and another job changed its target in the meantime
- **WHEN** the user approves it
- **THEN** the call does not execute, the refusal names that the object changed since the request was raised,
  and the refusal is recorded against the call

#### Scenario: The agent may propose the operation again
- **GIVEN** a call was refused because its target had changed
- **WHEN** the agent receives the refusal
- **THEN** it may propose the operation again as a new call, which reads its own before state and is judged
  afresh, rather than the refused call being resumed against its stale record

#### Scenario: The comparison is against what was recorded, not against what was intended
- **WHEN** the target is compared before a held call executes
- **THEN** it is compared with the before state the intent record holds, so an object that was changed and then
  changed back is treated as unchanged

### Requirement: A record the store reports as written survives sudden power loss

A ledger record SHALL NOT be reported as written until its bytes have reached durable media on the device,
including any write cache the storage hardware holds, so that a power failure or kernel panic immediately
afterwards leaves the record present rather than lost.

Source: `spikes/SP-12-sqlite-ledger/macos/REPORT.md#0-ket-luan`,
`spikes/SP-12-sqlite-ledger/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) — VERIFIED on macOS: 200 of 200
injected crashes left every committed record present once the physical-flush setting was on. The same section
records that with the setting off the operating system reports success before the data has left the drive
cache, which is the condition this requirement forbids.

#### Scenario: Power is cut immediately after a record is reported written

- **GIVEN** the store has reported a ledger record as written
- **WHEN** the machine loses power before any further write
- **THEN** the record is present when the store is next opened

#### Scenario: The operating system acknowledges a write before the hardware does

- **GIVEN** the operating system reports a write as complete once the bytes reach the drive's own cache
- **WHEN** the ledger writes a record on that operating system
- **THEN** the store requests a flush that reaches durable media, and reports the record written only after
  that flush returns

#### Scenario: A tool call proceeds on a record that is not yet durable

- **WHEN** a tool call is about to execute against a record whose durable flush has not returned
- **THEN** the call does not execute, because the record it depends on is not yet guaranteed to exist

### Requirement: The cost of durability is confined to the ledger and the job store

The physical-flush guarantee SHALL apply to the ledger and the job store alone, and SHALL NOT be applied to
caches, scratch data, transcripts or any other local store, so that the throughput it costs is paid only where
a lost record would break the record of what happened.

Source: `spikes/SP-12-sqlite-ledger/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3),
`spikes/SP-12-sqlite-ledger/macos/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED: the measurement records
28,000 writes per second without the guarantee and 241 with it, and commit latency rising from 0.028 ms to
4.033 ms at the median, which is why the scope is stated rather than left to the implementation.

#### Scenario: A cache or scratch store is opened

- **WHEN** the product opens a local store that is neither the ledger nor the job store
- **THEN** that store is opened without the physical-flush setting

#### Scenario: A write rate is assumed elsewhere in the design

- **GIVEN** a design assumes a ledger write rate
- **WHEN** that assumption is checked on an operating system requiring the physical flush
- **THEN** the rate assumed is no higher than the measured durable rate on that operating system

## ADDED Requirements

### Requirement: A ledger record carries the full account of one step

Each ledger record SHALL carry the job identifier, the step sequence number, the record type — tool call,
decision, approval, error or information — the tool and its parameters, the outcome, the before and after
snapshots where they exist, the reversibility flag, the compensating action where one exists, and a timestamp.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-01),
`docs/raw-idea/prd-mvp.md#12-1-du-lieu-phia-client-local-first` — UNVERIFIED; the record structure is measured in
`req-013-sqlite-ledger`.

#### Scenario: Snapshot is unavailable
- **WHEN** the target object cannot be read before the operation
- **THEN** the record is written with no before snapshot and with the reversibility flag set to false

#### Scenario: Outcome is not yet known
- **WHEN** the record is written before the external call returns
- **THEN** the outcome field is unresolved until the result is recorded, and the record is never rewritten to
  add it

### Requirement: The ledger is append-only

Ledger records SHALL never be modified or deleted once written; a correction SHALL be a new record that
references the original.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-02),
`docs/spec/constitution.md` principle III — UNVERIFIED.

#### Scenario: Correcting a recorded mistake
- **GIVEN** a record captured an incorrect outcome
- **WHEN** the correction is made
- **THEN** a new record is appended referencing the original, and the original is unchanged

#### Scenario: External modification attempt
- **WHEN** an attempt is made to update or delete a stored record by any route
- **THEN** the store refuses it

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

The ledger SHALL retain records for at least 90 days by default, that period SHALL be configurable, and deleting
ledger data SHALL require a deliberate user action carrying a warning about what is lost.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-07, priority Should) — UNVERIFIED; the
source marks the 90-day figure as proposed, and `req-013-sqlite-ledger` measures its storage cost.

#### Scenario: Deletion is warned about
- **WHEN** the user asks to delete ledger data
- **THEN** the product states that undo of the affected jobs becomes impossible, and deletes only after
  confirmation

#### Scenario: Retention expiry removes attachments too
- **WHEN** records pass the retention period
- **THEN** the image extracts they reference are removed with them

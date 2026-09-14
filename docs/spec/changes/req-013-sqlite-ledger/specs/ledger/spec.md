## ADDED Requirements

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

## MODIFIED Requirements

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

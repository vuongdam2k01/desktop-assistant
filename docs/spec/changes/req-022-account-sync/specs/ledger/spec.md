## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: The ledger is append-only

Ledger records SHALL never be modified or deleted once written on any device or on the backend; a correction
SHALL be a new record that references the original; and replication SHALL NOT remove, replace or overwrite a
record on any replica.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-02),
`docs/spec/constitution.md` principle III — UNVERIFIED; RISK-065 records that last-writer-wins replication would
break this principle, which is why it is forbidden for this store.

#### Scenario: Correcting a recorded mistake
- **GIVEN** a record captured an incorrect outcome
- **WHEN** the correction is made
- **THEN** a new record is appended referencing the original, and the original is unchanged

#### Scenario: External modification attempt
- **WHEN** an attempt is made to update or delete a stored record by any route
- **THEN** the store refuses it

#### Scenario: Replication carries a competing version of an existing record
- **WHEN** replication delivers a record that claims to replace one already held
- **THEN** the held record is left unchanged and both are reconciled as records, so no history is lost

#### Scenario: Records survive the device that wrote them
- **GIVEN** a device that wrote ledger records is revoked and erases its local store
- **WHEN** the ledger is read on another signed-in device
- **THEN** the records that device wrote are still present

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

## ADDED Requirements

### Requirement: Undo is a compensating sequence inferred from the ledger

Undo at job level SHALL be built by reading the recorded sequence of operations and constructing the reverse
sequence from the compensating-action formulas declared in the manifest, reasoning beyond those formulas where
the situation is not covered; it SHALL NOT be a differential revert.

Source: `docs/raw-idea/prd-mvp.md#10-5-module-undo-ud` (FR-UD-01),
`docs/spec/constitution.md` principle IV — UNVERIFIED; measured in `req-010-undo-agent`.

#### Scenario: Reverse order is preserved
- **GIVEN** a job created a task and then moved it
- **WHEN** the undo plan is built
- **THEN** the move is compensated before the creation is compensated

#### Scenario: Situation outside the declared formula
- **WHEN** an operation's recorded state does not fit its declared compensating formula
- **THEN** the undo reasons about the recorded snapshots to propose a compensating step, and marks that step as
  inferred rather than declared

### Requirement: Irreversible operations are a normal, declared outcome

The presence of irreversible operations in a job SHALL be reported as a declared outcome of the undo plan rather
than treated as a failure of the undo mechanism.

Source: `docs/raw-idea/prd-mvp.md#10-5-module-undo-ud` (FR-UD-01),
`docs/spec/constitution.md` principle IV — UNVERIFIED.

#### Scenario: Job mixes reversible and irreversible work
- **GIVEN** a job sent a message and updated two tasks
- **WHEN** the undo plan is presented
- **THEN** the two updates appear as revertible and the message appears as irreversible with its reason

### Requirement: Current state is reconciled against the snapshot before undoing

Before executing any compensating step the product SHALL compare the object's current state with the recorded
snapshot, SHALL mark an object changed by anyone else as a conflict, SHALL NOT overwrite it, and SHALL ask the
user to decide that item separately.

Source: `docs/raw-idea/prd-mvp.md#10-5-module-undo-ud` (FR-UD-02) — UNVERIFIED.

#### Scenario: Object edited by a colleague after the job
- **GIVEN** a task was edited by another person after the job changed it
- **WHEN** the undo plan is built
- **THEN** that task is marked as a conflict and its compensating step is not executed without a separate
  decision

#### Scenario: Object was deleted at the platform
- **WHEN** the object no longer exists
- **THEN** the step is reported as not applicable with that reason rather than recreating the object silently

### Requirement: Undo previews its plan and waits for confirmation

Undo SHALL present a plan listing each item as revertible, irreversible or conflicted with the reason for that
classification, and SHALL execute only after the user confirms.

Source: `docs/raw-idea/prd-mvp.md#10-5-module-undo-ud` (FR-UD-03) — UNVERIFIED.

#### Scenario: User declines the plan
- **WHEN** the user does not confirm the plan
- **THEN** nothing is executed and the original job is unchanged

#### Scenario: Every item carries a reason
- **WHEN** the plan is displayed
- **THEN** each item states why it falls into its category

### Requirement: Undo runs as its own job with its own ledger

Undo SHALL execute as a new job carrying its own ledger and a reference to the job it undoes, and its final
report SHALL separate what succeeded from what needs manual handling.

Source: `docs/raw-idea/prd-mvp.md#10-5-module-undo-ud` (FR-UD-04),
`docs/raw-idea/prd-mvp.md#12-1-du-lieu-phia-client-local-first` — UNVERIFIED.

#### Scenario: Traceability in both directions
- **WHEN** an undo job completes
- **THEN** the original job links to the undo job and the undo job links back to the original

#### Scenario: Undo itself fails partway
- **GIVEN** an undo job fails after compensating two of four operations
- **WHEN** it reports
- **THEN** it names the two that were compensated and the two that were not

### Requirement: Undo can be limited to a chosen set of operations

The user SHALL be able to select a subset of a job's operations to revert, and the product SHALL warn when the
selected subset breaks a logical dependency between operations.

Source: `docs/raw-idea/prd-mvp.md#10-5-module-undo-ud` (FR-UD-05, priority Should) — UNVERIFIED.

#### Scenario: Selection breaks a dependency
- **GIVEN** a job created a task and then updated it
- **WHEN** the user selects only the creation to revert
- **THEN** the product warns that the update depends on the creation before proceeding

### Requirement: Undo is refused when nothing can be compensated

When every operation in a job is irreversible, the undo action SHALL be unavailable and SHALL state why.

Source: `docs/raw-idea/prd-mvp.md#10-5-module-undo-ud` (FR-UD-06) — UNVERIFIED.

#### Scenario: Job consisting only of irreversible operations
- **GIVEN** a job whose every operation is flagged irreversible
- **WHEN** the user opens the job detail
- **THEN** the undo action is disabled with an explanation, rather than offered and then failing

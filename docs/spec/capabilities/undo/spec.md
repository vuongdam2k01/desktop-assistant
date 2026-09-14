# undo Specification

## Purpose
Owns reversing completed work by replaying compensating actions inferred from the ledger against current state: probing for third-party conflicts, presenting a preview that separates what can be restored from what cannot, and executing the reversal as a job in its own right.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence).

## Requirements

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
user to decide that item separately; an object the platform reports as removed but still recoverable SHALL be
returned to a reachable state before its compensating step rather than treated as absent.

Source: `docs/raw-idea/prd-mvp.md#10-5-module-undo-ud` (FR-UD-02),
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q7,
`spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED on the measured platform: an
object in the platform's trash is returned whole and can be made reachable again, while an object that was
permanently removed and one the connector may no longer see are answered identically, so absence cannot be
attributed to deletion.

#### Scenario: Object edited by a colleague after the job
- **GIVEN** a task was edited by another person after the job changed it
- **WHEN** the undo plan is built
- **THEN** that task is marked as a conflict and its compensating step is not executed without a separate
  decision

#### Scenario: Object is in the platform's recoverable removed state
- **GIVEN** the object a step must compensate was moved to the platform's trash after the job ran
- **WHEN** the step executes
- **THEN** the object is returned to a reachable state first and its recorded state is then restored, and the
  report says that the object had been removed and was brought back

#### Scenario: Object cannot be returned by the platform at all
- **WHEN** the platform will not return the object
- **THEN** the step is reported as not applicable, naming both possible causes — permanently removed, or no
  longer visible to the connector — and the object is not recreated silently

#### Scenario: Reconciliation is attempted on an object whose snapshot was never taken
- **WHEN** a step's recorded prior state is an explicit absence rather than a snapshot
- **THEN** the step is presented as not restorable with that reason, and no comparison against current state is
  claimed

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

### Requirement: An effect that cannot be recalled is named in the preview even when the step is revertible

The undo preview SHALL name, for each step, any effect the operation emitted outside the object it changed that
its compensating action cannot recall, and SHALL do so without reclassifying that step as irreversible.

Source: `spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan` condition 4,
`spikes/SP-1-notion-compensation/REPORT.md#4-rui-ro-moi-phat-hien` risk 4 — VERIFIED for the measured platform:
a property whose value is fully restorable causes a notification to a person that no operation withdraws.
`docs/spec/constitution.md` principle IV requires the outcome be reported against what cannot be restored.

#### Scenario: A revertible step carries an unrecallable effect
- **GIVEN** a job assigned a task to a colleague and changed its deadline
- **WHEN** the undo plan is presented
- **THEN** both steps appear as revertible, and the assignment additionally states that the colleague was
  notified and that the notification cannot be withdrawn

#### Scenario: A step carries no such effect
- **WHEN** a step whose tool declares no unrecallable effect is presented
- **THEN** it carries no such statement, so that the warning means something where it does appear

#### Scenario: The undo has run
- **WHEN** the undo reports what it did
- **THEN** each unrecallable effect named in the preview is named again in the report, under what could not be
  undone rather than under what failed

### Requirement: A compensating action refused as invalid is narrowed rather than abandoned

When a platform refuses a compensating action because part of its payload is invalid, the undo SHALL retry it
without the refused part, SHALL report each part it could not restore with the platform's own reason, and SHALL
NOT substitute a value the snapshot did not hold.

Source: `spikes/SP-1-notion-compensation/evidence/compensation-matrix.md` §3,
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q7 — VERIFIED: a payload carrying a value the
platform will not accept is refused whole with HTTP 400 `validation_error`, so a refusal costs every field in
that payload unless the attempt is narrowed.

#### Scenario: One property of several is refused
- **GIVEN** a compensating action restores four properties and the platform refuses the payload because one of
  them is no longer valid
- **WHEN** the undo narrows the attempt
- **THEN** the other three are restored and the fourth is reported as not restorable with the platform's reason

#### Scenario: Every part is refused
- **WHEN** narrowing leaves nothing the platform accepts
- **THEN** the step is reported as not restorable rather than as done, and the object is left exactly as it was

#### Scenario: Narrowing would invent a value
- **WHEN** a part is refused and no recorded prior value can be sent for it
- **THEN** that part is omitted from the attempt, and nothing is written in its place

### Requirement: The undo agent infers a reverse compensating action sequence from the ledger
The undo agent SHALL read the sequence of recorded action records for a target job from the ledger and synthesize a compensating action plan arranged in reverse topological order, reversing nested dependent operations prior to parent container teardown.

#### Scenario: Multi-step job with created container and child updates
- **GIVEN** a job created a page at sequence 2 and subsequently modified child page properties at sequence 4
- **WHEN** the undo agent synthesizes the compensating action plan
- **THEN** the plan schedules property reversion at sequence 4 before the page archive operation at sequence 2

#### Scenario: Independent action records
- **GIVEN** a job performed updates on three separate independent objects
- **WHEN** the undo plan is synthesized
- **THEN** the compensating actions are sequenced in strict reverse chronological order of their execution

### Requirement: The conflict detector probes live object state using property payload diffing
The conflict detector SHALL probe the live external state of each target object via connector read queries and compare the live properties against the recorded `snapshot_after.properties` payload, declaring a conflict whenever live properties differ or when the object is deleted or unreachable, regardless of whether `last_edited_time` timestamps match.

#### Scenario: Third-party modification within the same minute as job completion
- **GIVEN** the external platform rounds `last_edited_time` to minute precision and a third party modified a property within that same minute
- **WHEN** the conflict detector executes a probe against the target object
- **THEN** the property payload diff detects the modified value and classifies the object as a conflict with zero false negatives

#### Scenario: External object moved to trash or deleted
- **GIVEN** a target object was deleted or archived externally after job execution
- **WHEN** the conflict detector queries the live object
- **THEN** the detector classifies the object as a conflict due to unreachable state and prevents blind write replay

#### Scenario: Clean target object with matching properties
- **GIVEN** a target object has not been touched by any external entity since the job completed
- **WHEN** the conflict detector compares live properties with `snapshot_after.properties`
- **THEN** the detector classifies the object as clean with zero false positives

### Requirement: The undo preview categorizes operations into reversible, irreversible, and conflict groups
The undo pipeline SHALL present a three-way preview dialog displaying all candidate actions segmented into Reversible actions, Irreversible actions, and Conflicting actions with explicit rationale for each item.

#### Scenario: Mixed job containing reversible, irreversible, and conflicting actions
- **GIVEN** a job that updated a page property, posted an immutable comment, and touched a page later modified externally
- **WHEN** the undo preview is generated
- **THEN** the preview modal displays the property update under Reversible, the comment under Irreversible with the reason that the API prohibits comment deletion, and the third-party page under Conflict with the property difference details

#### Scenario: User inspects conflict details
- **WHEN** the user selects a conflicting item in the preview
- **THEN** the interface displays the expected snapshot properties alongside the current live properties and disables automatic overwrite for that item

### Requirement: Undo execution runs as an independent job with recursive lineage
Executing an approved undo plan SHALL initiate a new job recording `undo_of` set to the original job identifier, write new sequential ledger records for each executed compensating step, and support recursive undoing of an undo job.

#### Scenario: Executing an approved undo plan
- **WHEN** the user confirms the undo preview containing reversible steps
- **THEN** a new job is created with `undo_of` pointing to the target job ID and each compensating action writes a new record to the action ledger

#### Scenario: User requests undo of a prior undo job
- **GIVEN** an undo job previously executed and restored an object to its prior state
- **WHEN** the user triggers undo on that undo job
- **THEN** the undo agent reads the undo job's ledger, synthesizes forward compensation, and executes as a new job referencing the first undo job

### Requirement: Undo control is disabled when a job contains zero reversible actions
When all action records within a completed job are marked irreversible in the ledger or connector manifest, the user interface SHALL disable the undo trigger and display an explanatory message stating that no reversible operations exist.

#### Scenario: Job consisting entirely of irreversible tool calls
- **GIVEN** a job that only executed comment creation calls marked `is_reversible: false`
- **WHEN** the user views the completed job card
- **THEN** the undo button is rendered in a disabled state with explanatory copy indicating that all operations in the job are irreversible via API

### Requirement: Conflict detection for repeated object modifications references the final sequential snapshot
When a target job contains multiple action records modifying the same object, the conflict detector SHALL use the `snapshot_after` payload of the latest sequential record touching that object as the ground-truth reference baseline for live state comparison.

#### Scenario: Object updated multiple times in one job
- **GIVEN** a job updated status on page X at sequence 1 and updated due date on page X at sequence 3
- **WHEN** the conflict detector evaluates page X for undo conflicts
- **THEN** it compares the live state against the `snapshot_after` of sequence 3, ensuring intermediate steps of the same job are not flagged as external conflicts

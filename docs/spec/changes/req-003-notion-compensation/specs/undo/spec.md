## ADDED Requirements

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

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: A Notion snapshot excludes the values the platform computes

The Notion connector SHALL exclude `formula`, `rollup`, `created_time`, `created_by`, `last_edited_time` and
`last_edited_by` from every recorded pre-write snapshot, so that no compensating action built from that snapshot
can attempt to restore a value the platform refuses to be told.

Source: `spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan` condition 2,
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q1 and Q6 — VERIFIED: writing any of the six
is refused with HTTP 400 `validation_error`, and the same payload with the six removed is accepted
(`spikes/SP-1-notion-compensation/evidence/data/q6_complex_schema_results.json`,
`spikes/SP-1-notion-compensation/evidence/raw_logs/q6_test_unsanitized_patch*.json` against
`q6_test_sanitized_patch*.json`).

#### Scenario: Object carrying computed values is snapshotted
- **GIVEN** a task whose database defines a formula property and a rollup property
- **WHEN** the connector records the state before a write
- **THEN** the recorded snapshot contains neither of them, and neither the creation nor the last-edit attribution

#### Scenario: Computed values return by themselves after compensation
- **GIVEN** a write changed a relation, and the database computes a rollup from that relation
- **WHEN** the compensating action restores the relation
- **THEN** it sends only the relation, and the rollup holds its original value again without being written

#### Scenario: A compensating payload would carry a computed value
- **WHEN** a compensating action is assembled that would send one of the six computed values
- **THEN** it is refused before it leaves the device and recorded as a defect in the connector's declaration,
  rather than being sent and failing at the platform

### Requirement: Commenting on a Notion object is declared irreversible

The Notion connector SHALL declare every comment-creating tool `irreversible`, because the platform offers no
operation that removes or edits a comment once it exists.

Source: `spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan` condition 3,
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q3 — VERIFIED: the platform publishes neither
a delete nor an update operation for a comment
(`spikes/SP-1-notion-compensation/evidence/data/q3_irreversible_results.json`).

#### Scenario: A comment is about to be written
- **WHEN** the agent calls the comment tool
- **THEN** the declaration read by the approval evaluation says the operation cannot be reversed, and the user's
  request to approve says so in those terms

#### Scenario: A comment appears in an undo plan
- **GIVEN** a job added a comment and updated a deadline
- **WHEN** the undo plan is presented
- **THEN** the deadline appears as revertible and the comment appears as irreversible, with the absence of a
  platform operation given as its reason

### Requirement: A Notion choice property is restored by option identity rather than by label

The Notion connector SHALL record both the identity and the label of a `select` or `status` value in its
snapshot, and SHALL build the compensating action from the identity, so that renaming an option between the
write and its compensation does not change which option is restored.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q8 — VERIFIED: both property kinds
accept a write addressed by identity or by label, and restoration by identity was unaffected by a label change
(`spikes/SP-1-notion-compensation/evidence/data/q8_status_vs_select_results.json`).

#### Scenario: The option was renamed after the write
- **GIVEN** a status value was changed by a job, and a person then renamed that option in the database
- **WHEN** the compensating action runs
- **THEN** the property holds the same option it held before the job, under its new label

#### Scenario: The option no longer exists
- **WHEN** the option recorded in the snapshot has been removed from the database
- **THEN** the step is reported as not restorable with that reason, and no option is created by label to stand
  in for it

### Requirement: A Notion status property cannot be restored to empty

When the recorded prior state of a `status` property is empty, the Notion connector SHALL report the outcome of
its compensating action as the platform's default option rather than as the property restored to empty.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q8,
`spikes/SP-1-notion-compensation/REPORT.md#4-rui-ro-moi-phat-hien` risk 2 — VERIFIED: a `status` property sent
as empty is set by the platform to the first option of its to-do group rather than cleared
(`spikes/SP-1-notion-compensation/evidence/raw_logs/q8_null_status*.json`).

#### Scenario: Prior state of the status property was empty
- **GIVEN** a job set a status on a task whose status was previously empty
- **WHEN** that write is compensated
- **THEN** the task carries the platform's default status, and the report says the property could not be
  returned to empty rather than reporting it as restored

#### Scenario: Prior state of the status property held an option
- **WHEN** a status that held an option is compensated
- **THEN** the option is restored and the outcome is reported as restored, with no such qualification

### Requirement: A Notion option introduced by a write outlives the compensation of that write

When a write adds an option to a database's `select` schema, the Notion connector SHALL report that option as
left behind after the write is compensated, because removing it is outside the platform's write surface.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q8,
`spikes/SP-1-notion-compensation/REPORT.md#4-rui-ro-moi-phat-hien` risk 1 — VERIFIED: writing an unknown value
to a `select` property adds it to the database schema and returns HTTP 200, while the same write to a `status`
property is refused with HTTP 400
(`spikes/SP-1-notion-compensation/evidence/data/q8_status_vs_select_results.json`).

#### Scenario: A write invents a new label
- **GIVEN** a job set a `select` property to a label the database did not have
- **WHEN** that write is compensated
- **THEN** the object holds its prior value again, and the report states that the new label remains in the
  database's settings

#### Scenario: The same write is attempted on a status property
- **WHEN** a job sets a `status` property to a label the database does not have
- **THEN** the platform refuses the write, the failure names the property, and no residue is created

### Requirement: Compensating a Notion creation states what the compensation leaves behind

The compensating action for creating a Notion object SHALL move that object to the platform's recoverable
removed state, and SHALL report both that the object remains recoverable there and that its identifier is not
reclaimed.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q2,
`spikes/SP-1-notion-compensation/evidence/compensation-matrix.md` §1 — VERIFIED: the compensation returns
HTTP 200, the object leaves the database view, and it remains readable in the removed state.

#### Scenario: A created task is compensated
- **WHEN** the creation of a task is compensated
- **THEN** the task is no longer in the database's contents, and the report states it is in the platform's
  recoverable removed state rather than deleted

#### Scenario: The removed object was already cleared at the platform
- **GIVEN** the creation of an object is being compensated and a person has already cleared it permanently
- **WHEN** the compensating action runs
- **THEN** it reports the object as already absent and succeeds in intent rather than failing, since nothing it
  was asked to remove remains

### Requirement: A Notion write that notifies a person declares a notification it cannot recall

A Notion write tool that causes the platform to notify a person SHALL declare that notification as an effect its
compensating action cannot recall, and that declaration SHALL be available to the approval evaluation and to the
undo preview together with the words the user is shown.

Source: `spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan` condition 4,
`spikes/SP-1-notion-compensation/REPORT.md#4-rui-ro-moi-phat-hien` risk 4 — VERIFIED: assigning a person to a
task sends that person an email and an in-application notification that no platform operation withdraws
(`spikes/SP-1-notion-compensation/evidence/data/q3_irreversible_results.json`).

#### Scenario: Assignment is about to happen
- **WHEN** the user is asked to approve a write that assigns a person
- **THEN** the request states that the person will be notified and that undoing the assignment does not withdraw
  the notification

#### Scenario: The assignment is undone
- **WHEN** the assignment is compensated
- **THEN** the person is removed from the property, and the report names the notification that was already sent

### Requirement: The Notion connector tells a recoverably removed object apart from an absent one

The Notion connector SHALL classify an object the platform still returns in its removed state as recoverable,
SHALL classify an object the platform refuses to return as absent-or-unreachable, and SHALL NOT present the
second as evidence that the object was deleted.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q7,
`spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: an object in the platform's trash
is returned with HTTP 200 and a removed marker, while permanent deletion and withdrawn access both return
HTTP 404 with one indistinguishable code
(`spikes/SP-1-notion-compensation/evidence/data/q7_error_codes_results.json`).

#### Scenario: The object is in the platform's trash
- **WHEN** the prior state of a removed object is read
- **THEN** it is returned with its properties and marked recoverable, rather than reported as missing

#### Scenario: The object cannot be returned at all
- **WHEN** the platform refuses to return the object
- **THEN** the outcome names both possibilities — removed permanently, or no longer shared with the connector —
  because the platform does not distinguish them, and neither is asserted as the cause

### Requirement: Notion pacing is held per authorisation rather than per device

The Notion connector SHALL pace requests against one authorisation independently of every other authorisation,
so that an authorisation waiting out a refusal does not delay work under a different one.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5 — VERIFIED: while one token was
inside its cooldown, a second token called successfully from the same device
(`spikes/SP-1-notion-compensation/evidence/data/q5_rate_limit_results.json`).

#### Scenario: One authorisation is waiting and another is idle
- **GIVEN** one Notion authorisation has been refused for volume and is waiting
- **WHEN** a job issues a call under a different Notion authorisation
- **THEN** that call proceeds at its own pace rather than waiting for the first

#### Scenario: Two jobs share one authorisation
- **WHEN** two jobs issue Notion calls under the same authorisation at the same time
- **THEN** they draw on one pacing budget between them, rather than each pacing as though it were alone

### Requirement: An unmeasured Notion capability is declared absent rather than offered

The Notion connector SHALL declare no tool for creating a page directly in the workspace rather than in a
database, while that capability remains unverified, and SHALL tell the agent the capability is unavailable
rather than attempting it.

Source: `spikes/SP-1-notion-compensation/REPORT.md#5-chua-tra-loi-duoc-vi-sao`,
`docs/spec/constitution.md` Evidence Discipline — the capability is UNVERIFIED: the authorisation kind the spike
used is refused by the platform for this operation, so neither its snapshot nor its compensation has been
measured; recorded as Q-1 in `clarifications.md`.

#### Scenario: The agent is asked to create a page outside a database
- **WHEN** a command requires a page that belongs to the workspace rather than to a database
- **THEN** the agent is told the connector does not offer that operation, and the database route is offered
  instead of an attempt

#### Scenario: The manifest is loaded
- **WHEN** the Notion manifest is loaded
- **THEN** it declares no tool for that operation, so no tool for it can reach an agent

## MODIFIED Requirements

### Requirement: Notion write operations cover creation, property update and reordering

The Notion connector SHALL support creating a task, updating properties such as title, deadline, status,
priority and assignee, and moving or reordering objects where the database carries a numeric order property;
where it does not, free reordering SHALL be reported as unsupported before anything is written.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-03),
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q4 — VERIFIED: the platform exposes no native
position for a database view and refuses a write carrying one with HTTP 400; where a numeric order property
exists, reordering is a write to that property and is compensated from the snapshot at full integrity
(`spikes/SP-1-notion-compensation/evidence/data/q4_ordering_results.json`).

#### Scenario: Property value is rejected by the platform
- **WHEN** a property update is refused because the value does not match the property type
- **THEN** the failure is recorded and reported with the offending property named

#### Scenario: The database carries a numeric order property
- **GIVEN** the database addressed by the command has a number property recognised as its order
- **WHEN** the agent moves a task ahead of another
- **THEN** the move is a write to that property, and its compensating action restores the numbers the snapshot
  recorded

#### Scenario: The database carries no order property
- **WHEN** the agent is asked to move a task to a position in a database that has no such property
- **THEN** the operation is reported as unsupported for that database, naming the absent property, and no write
  is attempted

#### Scenario: Several properties could be the order
- **GIVEN** a database carrying more than one numeric property whose name suggests an order
- **WHEN** the agent is asked to move a task
- **THEN** the connector asks which property expresses the order rather than choosing one, and no write is made
  until the answer arrives

#### Scenario: The command means a state change rather than a position
- **GIVEN** a database with no order property
- **WHEN** the command moves a task between columns of a board
- **THEN** it is performed as a write to the property that column represents, which is snapshotted and
  compensated like any other property

### Requirement: Notion request volume respects the platform's limits

The Notion connector SHALL queue requests under one authorisation at no more than 2.5 per second, SHALL wait for
the delay the platform states when it refuses a request for volume, and SHALL NOT rely on any advance warning
that a limit is approaching.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-06),
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5,
`spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: the published average is 3
requests per second; bursts of 15 and 60 concurrent requests completed entirely, 100 concurrent requests
produced 69 accepted and 31 refused for volume, every refusal carried a stated delay in seconds, and no
successful response carried any remaining-quota header
(`spikes/SP-1-notion-compensation/evidence/data/q5_rate_limit_results.json`).

#### Scenario: Burst of writes
- **WHEN** a job issues more requests in a moment than the platform allows
- **THEN** the connector paces them and the job completes rather than failing

#### Scenario: The platform refuses a request for volume
- **WHEN** a request is refused for volume and the refusal states a delay
- **THEN** the connector waits at least that delay before its next request under that authorisation, rather than
  applying a delay of its own choosing

#### Scenario: A refusal states no delay
- **WHEN** a request is refused for volume and the refusal carries no delay
- **THEN** the connector waits a delay of its own that grows with each successive refusal up to a stated ceiling,
  rather than retrying immediately

#### Scenario: A successful response carries no quota information
- **WHEN** the platform accepts a request
- **THEN** the connector concludes nothing about remaining quota from that response, and continues to pace by
  its own queue

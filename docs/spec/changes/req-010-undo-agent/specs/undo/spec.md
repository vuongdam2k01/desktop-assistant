## Purpose
Owns the four-phase undo pipeline (inversion, conflict probe, three-way preview, and recursive execution) that restores external system state safely based on the action ledger without blind overwrites.

## ADDED Requirements

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

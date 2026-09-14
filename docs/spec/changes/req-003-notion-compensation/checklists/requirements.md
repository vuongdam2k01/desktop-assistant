# Requirements Quality Checklist: req-003-notion-compensation

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Are all four conditions the spike declared binding — computed values excluded, comments irreversible, reordering conditional on the database schema, an unrecallable notification — each carried by at least one requirement rather than only by design prose? [Completeness, Spec §connector ADDED 1, 2, 7 and MODIFIED "Notion write operations"]
- [ ] CHK002 Is the behaviour specified for a write whose prior state could not be read at all, as distinct from one whose prior state is empty? [Completeness, Spec §undo MODIFIED "Current state is reconciled", scenario 4]
- [ ] CHK003 Is it specified what happens to a compensating action when the object was moved to the platform's recoverable removed state between the write and the undo? [Completeness, Spec §undo MODIFIED "Current state is reconciled", scenario 2]
- [ ] CHK004 Does any requirement state what the product does with the identifier a compensated creation consumed, or is it only mentioned as a report line? [Completeness, Spec §connector "Compensating a Notion creation states what the compensation leaves behind"]
- [ ] CHK005 Is the behaviour of the connector specified when the database schema read itself fails, separately from the write failing? [Completeness, Gap — design Tier 2 covers it; no requirement states it]
- [ ] CHK006 Are the requirements silent about any write operation the manifest declares? Check the ten tools in `notion-property-compensation@0.1.0` §3 against the requirement set. [Completeness, Spec §connector, all]
- [ ] CHK007 Is it specified whether pacing applies to reads as well as writes, or only to writes? [Completeness, Ambiguity, Spec §connector MODIFIED "Notion request volume respects the platform's limits"]

## Requirement Clarity

- [ ] CHK008 Is "no more than 2.5 per second" stated in a way that can be checked — over what window, and counted against what unit? [Clarity, Spec §connector MODIFIED "Notion request volume"]
- [ ] CHK009 Is "the delay the platform states" unambiguous about its unit and about whether the product may wait longer but never less? [Clarity, Spec §connector MODIFIED "Notion request volume", scenario 2]
- [ ] CHK010 Are "recoverable", "absent-or-unreachable" and "not restorable" used with exactly one meaning each across both delta specs? [Clarity, Consistency, Spec §connector "tells a recoverably removed object apart" vs Spec §undo MODIFIED]
- [ ] CHK011 Does "reported as unsupported" specify who is told — the agent, the user, or both — and at what moment? [Clarity, Spec §connector MODIFIED "Notion write operations", scenario 3]
- [ ] CHK012 Is "the platform's default option" identified precisely enough that a reviewer can tell whether an outcome matched it? [Clarity, Spec §connector "A Notion status property cannot be restored to empty"]

## Requirement Consistency

- [ ] CHK013 Does the irreversibility of comments as stated here agree with the framework requirement that a write tool carries exactly one of a compensation or the irreversible flag? [Consistency, Spec §connector "Commenting on a Notion object is declared irreversible" vs living `connector` "A connector is defined by a manifest"]
- [ ] CHK014 Does the exclusion of the six computed values agree with, rather than restate, the framework requirement that a snapshotting write tool declares its exclusions? [Consistency, Spec §connector ADDED 1 vs living `connector` "A write tool that snapshots a structured object declares what is excluded"]
- [ ] CHK015 Is the unsupported outcome for reordering consistent with the framework's closed error vocabulary, rather than introducing a new failure kind? [Consistency, Spec §connector MODIFIED "Notion write operations" vs `connector/contracts/connector-adapter@1.0.0`]
- [ ] CHK016 Does the undo preview requirement for unrecallable effects avoid contradicting the living requirement that each preview item is classified revertible, irreversible or conflicted? [Consistency, Spec §undo ADDED 1 vs living `undo` "Undo previews its plan and waits for confirmation"]
- [ ] CHK017 Do the conflict rules here agree with what `req-010-undo-agent` will specify, given that it depends on this change and measures the conflict check? [Consistency, Conflict, Spec §undo MODIFIED vs design §D6]

## Acceptance Criteria Quality

- [ ] CHK018 Can "the recorded snapshot contains neither of them" be checked by inspecting a recorded artifact rather than by reading code? [Measurability, Spec §connector ADDED 1, scenario 1]
- [ ] CHK019 Is there an observable difference between the outcomes "restored", "approximated" and "narrowed" that a test can assert? [Measurability, Spec §connector "status property cannot be restored to empty", Spec §undo ADDED 2]
- [ ] CHK020 Does the pacing requirement admit a measurement that would fail a non-compliant implementation, rather than only one that passes a compliant one? [Measurability, Spec §connector MODIFIED "Notion request volume"]
- [ ] CHK021 Is "the report names the notification that was already sent" checkable without depending on particular wording? [Measurability, Spec §connector "A Notion write that notifies a person", scenario 2]

## Scenario Coverage

- [ ] CHK022 Does every ADDED requirement carry at least one scenario that is not the happy path? [Coverage, Spec §connector and §undo, all]
- [ ] CHK023 Is the primary journey — write, snapshot, compensate, report — covered end to end by scenarios rather than only in fragments? [Coverage, Spec §connector ADDED 1, 6, 7]
- [ ] CHK024 Is there a scenario for the recovery case in which a compensation succeeds only partly? [Coverage, Spec §undo ADDED 2, scenario 1]
- [ ] CHK025 Is there a scenario for the zero-data case: a job with nothing compensable at all on this platform? [Coverage, Gap — living `undo` "Undo is refused when nothing can be compensated" carries it; check it still holds with the new outcomes]

## Edge Case Coverage

- [ ] CHK026 Is the concurrent case covered: two jobs writing to the same object under one authorisation while a third undoes one of them? [Edge Case, Gap — locks belong to `req-015-concurrency-coordinator`; check this change states the dependency rather than assuming it]
- [ ] CHK027 Is the case of an option renamed, and separately an option deleted, between the write and the compensation each covered? [Edge Case, Spec §connector "A Notion choice property is restored by option identity", scenarios 1 and 2]
- [ ] CHK028 Is the case covered where the platform refuses a compensating payload for a property that no longer exists in the schema at all? [Edge Case, Spec §undo ADDED 2, scenario 1]
- [ ] CHK029 Is the case covered where a volume refusal's stated delay outlasts the job that is waiting on it? [Edge Case, Gap — design Tier 3 states the outcome; no requirement does]
- [ ] CHK030 Is the ambiguity case covered where more than one property could be the database's order? [Edge Case, Spec §connector MODIFIED "Notion write operations", scenario 4]

## Non-Functional Requirements

- [ ] CHK031 Are the pacing figures stated as requirements with their measured source, rather than only as design decisions? [Non-Functional, Spec §connector MODIFIED "Notion request volume", verification §Thresholds]
- [ ] CHK032 Is the privacy consequence of recording a projection — that it holds the user's work content in the ledger, which replicates — acknowledged somewhere a reviewer will meet it? [Non-Functional, Gap — model §Physical Resource, constitution principle VII]
- [ ] CHK033 Are the unverified figures distinguishable from the measured ones at the point of reading, not only in a footnote? [Non-Functional, verification §Thresholds]

## Dependencies & Assumptions

- [ ] CHK034 Is the assumption that the platform's limit is a constant rather than a property of the workspace tier stated where it can be challenged? [Assumption, proposal §Assumptions]
- [ ] CHK035 Is the dependency on `req-019-connector-framework`'s frozen contracts stated, including what breaks if their versions move? [Dependency, design §Context, contract §Migration]
- [ ] CHK036 Is it clear which parts of this connector's manifest are measured and which are carried from the framework because the spike's authorisation kind differed? [Assumption, design §Context, contract §Examples]
- [ ] CHK037 Is the deferral of the shared request queue to `req-015-concurrency-coordinator` stated as a boundary rather than left to be discovered? [Dependency, design §Goals / Non-Goals]

## Ambiguities & Conflicts

- [ ] CHK038 Does any requirement leave open whether a declared unrecallable effect changes the operation's approval classification? [Ambiguity, Spec §connector "A Notion write that notifies a person", contract §Semantics]
- [ ] CHK039 Is the relationship between "unsupported" and "irreversible" unambiguous, given that the spike's own conclusion used the two together for reordering? [Conflict, Spec §connector MODIFIED "Notion write operations" vs `spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan` condition 1]
- [ ] CHK040 Is it unambiguous whether a capability declared absent for want of evidence may be added by configuration rather than by a change? [Ambiguity, Spec §connector "An unmeasured Notion capability is declared absent rather than offered"]

## Physical Resource & Topology Quality

- [ ] CHK041 Are the format and the storage location of a projection stated, and is it clear that this capability stores nothing itself? [Resource, Topology §Physical Format & Storage]
- [ ] CHK042 Is the measured size range presented as a measurement of small objects rather than as a budget, and is the 64 KB guard visibly unverified? [Resource, Topology §Physical Resource Budget]
- [ ] CHK043 Does the state-to-artifact mapping account for every piece of state this change introduces, including the two that live only in memory? [Topology, Topology §State-to-Artifact Mapping Matrix]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK044 Is the fallback hierarchy deterministic — does each failure have exactly one stated next step rather than a choice? [Fallback, design §Extensibility & Fallback Strategy]
- [ ] CHK045 Are both manifest additions expressed as schema, with their refusal codes, rather than as prose obligations? [Extensibility, `connector/contracts/connector-manifest@1.1.0` §3 and §Error Matrix]
- [ ] CHK046 Does the extension procedure for a new property kind say what must be measured before the rule may be trusted, not only where to add it? [Extensibility, evolution §Extension Procedure]
- [ ] CHK047 Is every reserved point carrying a phase, a rationale and an activation condition, as the constitution requires? [Extensibility, model §Variability, constitution §Reserved By Design]

## Notes

Items marked `Gap` name something a reviewer should decide about rather than something already wrong: each is
either covered in `design.md` without a requirement, or owned by a change this one depends on. CHK017 and CHK039
are the two where a reviewer disagreeing would change this change's content rather than its wording.

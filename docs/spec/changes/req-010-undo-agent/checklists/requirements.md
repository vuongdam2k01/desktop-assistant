# Requirements Quality Checklist: req-010-undo-agent

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Has the four-phase undo sequence (inversion, conflict probe, three-way preview, execution) been explicitly defined? [Completeness, Spec §undo/spec.md#Requirement: The undo agent infers a reverse compensating action sequence from the ledger]
- [ ] CHK002 Are the conditions under which an undo control is disabled quantified and unambiguous? [Completeness, Spec §undo/spec.md#Requirement: Undo control is disabled when a job contains zero reversible actions]

## Requirement Clarity

- [ ] CHK003 Is the two-tier conflict detection methodology (payload diff vs minute-rounded timestamp) defined with verifiable criteria? [Clarity, Spec §undo/spec.md#Requirement: The conflict detector probes live object state using property payload diffing]
- [ ] CHK004 Is the baseline for multi-touch target object modifications explicitly tied to the final sequential action record? [Clarity, Spec §undo/spec.md#Requirement: Conflict detection for repeated object modifications references the final sequential snapshot]

## Requirement Consistency

- [ ] CHK005 Does the undo job lifecycle maintain strict consistency with append-only ledger invariants (no deletion or update in-place)? [Consistency, Spec §undo/spec.md vs ledger/spec.md]
- [ ] CHK006 Is the `is_reversible` flag definition in `connector/spec.md` consistent with the ledger and undo execution behavior? [Consistency, Spec §connector/spec.md vs undo/spec.md]

## Acceptance Criteria Quality

- [ ] CHK007 Are the criteria for achieving False-Negative = 0 in conflict detection mathematically and empirically measurable? [Measurability, Spec §undo/spec.md#Scenario: Third-party modification within the same minute as job completion]
- [ ] CHK008 Are preview groupings (Reversible, Irreversible, Conflict) partition-exhaustive and mutually exclusive? [Measurability, Spec §undo/spec.md#Scenario: Mixed job containing reversible, irreversible, and conflicting actions]

## Scenario Coverage

- [ ] CHK009 Is there a scenario covering the execution of an undo of a prior undo job (recursive undo)? [Coverage, Spec §undo/spec.md#Scenario: User requests undo of a prior undo job]
- [ ] CHK010 Is there a scenario covering external target objects moved to trash or returning 404/unreachable? [Coverage, Spec §undo/spec.md#Scenario: External object moved to trash or deleted]

## Edge Case Coverage

- [ ] CHK011 Are concurrent third-party modifications occurring during preview dialog display accounted for with pre-execution assertions? [Edge Case, Gap]
- [ ] CHK012 Is network failure during live probing explicitly handled by failing closed? [Edge Case, Spec §undo/spec.md#Scenario: External object moved to trash or deleted]

## Non-Functional Requirements

- [ ] CHK013 Is live probe latency bounded across multi-object jobs? [Non-Functional, Spec §undo/spec.md]
- [ ] CHK014 Is memory footprint during property-level diffing capped under peak load? [Non-Functional, Model §Physical Resource & Artifact Topology]

## Dependencies & Assumptions

- [ ] CHK015 Is the dependency on connector read tools explicitly validated prior to scheduling probe operations? [Assumption, Contract §undo-pipeline.md]

## Ambiguities & Conflicts

- [ ] CHK016 Are platform-specific timestamp precision quirks documented to prevent regressions to timestamp-only comparison? [Ambiguity, Spec §undo/spec.md]

## Physical Resource & Topology Quality

- [ ] CHK017 Are storage locations within SQLite ledger and memory bounds during diffing quantified? [Resource, Model §Physical Resource & Artifact Topology]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK018 Is the fallback matrix defined for offline states or partial probe timeouts? [Extensibility, Design §Extensibility & Fallback Strategy]

## Notes

Verified against empirical findings from `spikes/SP-9-undo-agent/REPORT.md`.

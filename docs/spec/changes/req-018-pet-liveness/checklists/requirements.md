# Requirements Quality Checklist: req-018-pet-liveness

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Has the Zero-Persistent Title rule been fully specified across native, application, and storage layers? [Completeness, Spec §app/spec.md#Requirement: Zero-persistent window title privacy boundary]
- [ ] CHK002 Are the two animation layers (locomotion vs work status) explicitly enumerated? [Completeness, Spec §pet/spec.md#Requirement: Two-layer animation state machine combining locomotion and work status]

## Requirement Clarity

- [ ] CHK003 Is the caret evasion buffer distance quantified (150 pixels)? [Clarity, Spec §pet/spec.md#Requirement: Pet locomotion and screen context awareness with caret avoidance]
- [ ] CHK004 Is the evasion reaction latency quantified (< 10 ms)? [Clarity, Spec §pet/spec.md#Scenario: User types in an editor near the pet]

## Requirement Consistency

- [ ] CHK005 Is the ban on `NtSuspendProcess` and `SetCursorPos` consistent across all test and production specifications? [Consistency, Model §Invariants (INV-LIVE-01) vs Design §D5]
- [ ] CHK006 Is the privacy filtering boundary consistent with Constitution Principle VII? [Consistency, Spec §platform/spec.md vs Constitution]

## Acceptance Criteria Quality

- [ ] CHK007 Are keystroke preservation criteria during active 60fps locomotion measurable via automated typing harness? [Measurability, Verification §Thresholds]
- [ ] CHK008 Is the absence of raw window titles in the database and replication streams verifiable via database schema and network payload assertions? [Measurability, Spec §app/spec.md#Scenario: Ledger write during screen context activity]

## Scenario Coverage

- [ ] CHK009 Is there a scenario covering concurrent work status changes while the character is in motion? [Coverage, Spec §pet/spec.md#Scenario: Job status changes while pet is walking]
- [ ] CHK010 Is there a scenario covering cursor grab (dragging) during autonomous navigation? [Coverage, Spec §pet/spec.md#Scenario: User grabs pet during autonomous movement]

## Edge Case Coverage

- [ ] CHK011 Are fullscreen applications handled gracefully with auto-park to prevent visual interference? [Edge Case, Design §Risks / Trade-offs]
- [ ] CHK012 Are edge boundaries and monitor seams traversed without coordinate snapping errors? [Edge Case, Verification §Eval Suites]

## Non-Functional Requirements

- [ ] CHK013 Is CPU overhead for background screen monitoring bounded (< 0.5% CPU)? [Non-Functional, Model §Physical Resource & Artifact Topology]
- [ ] CHK014 Is RAM resident footprint stable across 8 hours of continuous locomotion (>15,000 frames)? [Non-Functional, Verification §Thresholds]

## Dependencies & Assumptions

- [ ] CHK015 Is the application categorization regex table specified without cloud model dependencies? [Assumption, Contract §privacy-filter.md]

## Ambiguities & Conflicts

- [ ] CHK016 Is macOS screen context reading clearly marked as deferred to avoid blocking Windows MVP? [Ambiguity, Design §Research]

## Physical Resource & Topology Quality

- [ ] CHK017 Are physical RAM limits and GDI/USER handle ceilings explicitly tracked? [Resource, Model §Physical Resource & Artifact Topology]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK018 Is the fallback matrix defined for cases where Win32 event hooks fail to initialize? [Extensibility, Design §Extensibility & Fallback Strategy]

## Notes

All empirical metrics validated by `spikes/SP-18-pet-liveness/REPORT.md`.

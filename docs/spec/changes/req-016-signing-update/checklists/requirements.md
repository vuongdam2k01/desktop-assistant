# Requirements Quality Checklist: req-016-signing-update

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Has the packaging and Authenticode signing configuration for Windows NSIS been explicitly documented? [Completeness, Spec §platform/spec.md#Requirement: Desktop application packages and signs releases with cloud Authenticode certificates]
- [ ] CHK002 Are the conditions for delaying update application during running jobs fully specified? [Completeness, Spec §platform/spec.md#Requirement: Desktop update lifecycle checks and downloads updates in background without interrupting active work]

## Requirement Clarity

- [ ] CHK003 Is the static manifest format (`latest.yml` with SHA-512) quantified and defined? [Clarity, Contract §update-feed.md]
- [ ] CHK004 Is the two-layer verification requirement (SHA-512 hash match + WinVerifyTrust signature check) explicitly stated? [Clarity, Spec §platform/spec.md]

## Requirement Consistency

- [ ] CHK005 Is the backend manifest endpoint scope consistent with Constitution Principle VII (no account data access, unauthenticated static serving)? [Consistency, Spec §backend/spec.md vs Constitution]
- [ ] CHK006 Is the quit/restart behavior consistent with FR-APP-06 job preservation invariants? [Consistency, Spec §app/spec.md vs platform/spec.md]

## Acceptance Criteria Quality

- [ ] CHK007 Are Authenticode signature verification checks verifiable via `signtool verify /pa` with zero errors? [Measurability, Verification §Thresholds]
- [ ] CHK008 Is the updater failure behavior on untrusted self-signed certificates (`CERT_E_UNTRUSTEDROOT`) measurable in testing? [Measurability, Verification §Thresholds]

## Scenario Coverage

- [ ] CHK009 Is there a scenario covering update readiness while background agent jobs are running? [Coverage, Spec §platform/spec.md#Scenario: Update available while an agent job is active]
- [ ] CHK010 Is there a scenario covering differential blockmap byte-range downloads? [Coverage, Spec §backend/spec.md#Scenario: Differential update range request]

## Edge Case Coverage

- [ ] CHK011 Are tampered or corrupt update files immediately purged from disk without execution? [Edge Case, Spec §platform/spec.md#Scenario: Verification failure blocks unsigned or tampered updates]
- [ ] CHK012 Is update feed unavailability handled gracefully without disrupting current application execution? [Edge Case, Spec §backend/spec.md#Scenario: Version check is unavailable]

## Non-Functional Requirements

- [ ] CHK013 Is installer download cached in local app data without consuming excessive disk space? [Non-Functional, Model §Physical Resource & Artifact Topology]
- [ ] CHK014 Is background update checking non-blocking to active user interactions? [Non-Functional, Spec §platform/spec.md]

## Dependencies & Assumptions

- [ ] CHK015 Is the lead time for commercial Cloud Signing certificate procurement (2 weeks prior to beta) documented as a project dependency? [Assumption, Design §D4]

## Ambiguities & Conflicts

- [ ] CHK016 Is macOS code signing and notarization explicitly identified as deferred to prevent blocking Windows MVP? [Ambiguity, Design §Research]

## Physical Resource & Topology Quality

- [ ] CHK017 Are physical path layouts for download cache and installed binaries explicitly specified? [Resource, Model §Physical Resource & Artifact Topology]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK018 Is the fallback hierarchy from differential update to full installer download defined? [Extensibility, Design §Extensibility & Fallback Strategy]

## Notes

Verified against empirical findings from `spikes/SP-16-signing-update/REPORT.md`.

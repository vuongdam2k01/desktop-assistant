# Requirements Quality Checklist: req-013-sqlite-ledger

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is there a requirement stating what the product does when the store cannot be opened at all — damaged, or written by a newer version — or does that behaviour exist only as an error code in the contract? [Completeness, Gap]
- [ ] CHK002 Does any requirement state what the user is shown while a job sits in `recovering`, or does the state exist in the lifecycle without anything obliging the product to explain it? [Completeness, Gap]
- [ ] CHK003 Is the rollback position recorded as a requirement — what the user is told and what they lose when a restructuring migration is reversed — or only as a design intention? [Completeness, Gap]
- [ ] CHK004 Are ID conventions established for requirements in this project, given that requirements are addressed by title alone and a title edit silently breaks a `MODIFIED` delta? [Traceability, Gap]
- [ ] CHK005 Is any bound stated on how long a job may remain in `recovering` before the product does something other than retry — or is an indefinitely reconciling job an accepted outcome? [Completeness, Gap]
- [ ] CHK006 Do the requirements cover what happens to the image extracts a removed record references, or is that stated only in the existing retention requirement that this change does not modify? [Completeness, Spec §ledger "Retention is bounded, configurable and deleted only deliberately"]
- [ ] CHK007 Is there a requirement obliging the product to record which connector and tool a reconciling read used, so a reader can later tell a reconciling read from a user-initiated one? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK008 Is "SHALL complete this without requiring network access" checkable as written, or could an implementation satisfy it while still attempting a network call that merely fails fast? [Clarity, Spec §platform "Interrupted work is classified from the local store before the first window appears"]
- [ ] CHK009 Is "marked as not resumable" observable from outside the product, or is it an internal marking that no test or user can see? [Clarity, Spec §platform "Interrupted work is classified from the local store before the first window appears"]
- [ ] CHK010 Does "established by reconciliation rather than observed directly" oblige any surface to show the difference to the user, or only oblige the record to carry it? [Clarity, Spec §ledger "One tool call is two records joined by a correlation identifier", Contract §ledger-record `establishedBy`]
- [ ] CHK011 Is "records leave the store only whole" unambiguous about whether a removal announcement can itself be removed by a later retention run? [Clarity, Ambiguity, Spec §ledger "Records leave the store only whole, and only after the store says so"]
- [ ] CHK012 Does "without being compiled on a developer, build or user machine" make clear whether it constrains every dependency or only the store binding? [Clarity, Spec §platform "The local store is reached without compiling anything on the machine"]
- [ ] CHK013 Is "the same classification" precise enough to be checked after an interrupted pass, given that the store may have gained records between the two attempts? [Clarity, Spec §platform, Model §INV-PLT-01]

## Requirement Consistency

- [ ] CHK014 Does the modified append-only requirement now agree with the existing retention requirement, which deletes records, or do the two still read as contradicting each other to someone reading only the living spec? [Consistency, Spec §ledger "The ledger is append-only" vs §ledger "Retention is bounded, configurable and deleted only deliberately"]
- [ ] CHK015 Do the new `job` state `recovering` and the `platform` requirement to mark jobs "not resumable" describe the same thing in two vocabularies, and if so is that acceptable or a defect? [Consistency, Spec §job "Job lifecycle states are fixed and timestamped" vs §platform classification requirement]
- [ ] CHK016 Is there a card type for a job in `waiting_user_confirmation`, given that the `uix` spec fixes exactly seven card types and this change adds a state the user must answer? [Conflict, Spec §job vs §uix "Only seven card types exist"]
- [ ] CHK017 Does the two-record model remain consistent with the existing invariant that sequence numbers within a job are dense and strictly increasing, now that one call occupies two positions that may be separated by other records? [Consistency, Model §INV-LG-02 vs §INV-LG-04]
- [ ] CHK018 Do the recovery requirements in `job` and the classification requirement in `platform` agree on which one is responsible for the guarantee that no call is repeated, or does each assume the other holds it? [Consistency, Spec §job "No job is lost across a crash" vs §platform classification requirement]

## Acceptance Criteria Quality

- [ ] CHK019 Can "the record has been written before the call leaves the device" be checked from outside the implementation, or does verifying it require instrumenting the code under test? [Measurability, Spec §ledger "One tool call is two records joined by a correlation identifier"]
- [ ] CHK020 Is "either all of the stated records gone or none of them" checkable by a reviewer who cannot inspect the store's internals? [Measurability, Spec §ledger "Records leave the store only whole, and only after the store says so"]
- [ ] CHK021 Is "the build fails and is not published" stated so that its satisfaction is demonstrable, rather than being satisfied by the absence of a counterexample? [Measurability, Spec §platform "Native components are loaded from files on disk in the packaged product"]
- [ ] CHK022 Does the requirement that an absent reconciliation declaration is read as "cannot be read back" give an observable consequence, or only an internal interpretation? [Measurability, Spec §ledger "The intent record fixes what recovery may assume about the call"]

## Scenario Coverage

- [ ] CHK023 Is there a scenario for a result arriving for a job the user cancelled while the call was in flight, given that cancellation is specified to let an in-flight call complete? [Coverage, Spec §job "Cancellation stops at a tool-call boundary"]
- [ ] CHK024 Is there a scenario for the user answering a confirmation at the same moment reconciliation reaches a conclusion — and is the precedence between the two stated where a test could check it? [Coverage, Spec §job "The user was answered before the platform was asked"]
- [ ] CHK025 Is there a scenario for a call that partly succeeded at the platform — several objects intended, some changed — or do the requirements assume a call is atomic at the platform? [Coverage, Gap]
- [ ] CHK026 Is a scenario present for a job that holds more than one unresolved intent, or do the requirements assume a job's calls are strictly sequential? [Coverage, Gap]
- [ ] CHK027 Are the recovery requirements covered at the Primary, Alternate, Exception and Recovery layers, or is the Alternate layer — a call that succeeded but returned something unexpected — unrepresented? [Coverage, Gap]

## Edge Case Coverage

- [ ] CHK028 Is the behaviour specified when the device clock moves backwards between the intent and the result, so that the pair's recorded times are out of order? [Edge Case, Gap]
- [ ] CHK029 Is the behaviour specified when the disk fills during a removal, as distinct from during an ordinary append? [Edge Case, Gap]
- [ ] CHK030 Is it specified what happens when the connector that declared the interrupted tool has been removed by the time recovery runs? [Edge Case, Spec §ledger "The intent record fixes what recovery may assume about the call", Contract §tool-reconciliation]
- [ ] CHK031 Is the case of an interrupted shape change covered for both kinds of step — one that only adds, and one that rebuilds — or only in general terms? [Edge Case, Spec §ledger "A change to the store's shape leaves existing records as they were written"]

## Non-Functional Requirements

- [ ] CHK032 Is the absence of a startup-duration threshold a deliberate, recorded decision rather than an omission, and is the place it will be supplied identified? [Non-Functional, Assumption, Spec §platform classification requirement]
- [ ] CHK033 Are the measured per-device storage and query figures presented as observations of what was measured, or could a reader take them as commitments the product must meet? [Non-Functional, Model §Physical Resource Budget]
- [ ] CHK034 Is any bound stated on how long the store may take to accept a record before the call is failed closed, given that a slow store delays every tool call? [Non-Functional, Gap]

## Dependencies & Assumptions

- [ ] CHK035 Is the assumption that the store belongs to one operating-system user account recorded where a reader will find it, and is the consequence of violating it stated? [Assumption, Spec §clarifications "## Assumptions"]
- [ ] CHK036 Is this change's dependence on the connector manifest carrying a reconciliation declaration reflected in the roadmap ordering, or could this change be implemented before the manifest that feeds it exists? [Assumption, Gap]
- [ ] CHK037 Does the change record what it assumes about replication — that append-and-reconcile is settled elsewhere — rather than restating or quietly re-deciding it? [Assumption, Model §Relations]

## Ambiguities & Conflicts

- [ ] CHK038 Does `ambiguous_outcome: "treat_as_unperformed"` conflict with the requirement that a call is never repeated after a crash, or is the distinction — a new call with a new intent record — stated clearly enough to be relied on? [Conflict, Contract §tool-reconciliation]
- [ ] CHK039 Is the boundary between a "correction" record and an ordinary result record clear, given that both reference an earlier record and only one of them asserts the earlier record was wrong? [Ambiguity, Spec §ledger "The ledger is append-only"]
- [ ] CHK040 Is it unambiguous whether a reconciling read is subject to the approval gate, and if so whether a denial of that read is itself recorded? [Ambiguity, Contract §tool-reconciliation §2]

## Physical Resource & Topology Quality

- [ ] CHK041 Are the storage location and its permission expectations stated precisely enough for a reviewer to judge whether the bound claimed against RISK-044 actually holds? [Resource, Topology §Physical Format & Storage]
- [ ] CHK042 Is the lifecycle of the write-ahead companion file specified for the operations that copy or move the store, or only for ordinary use? [Topology, Gap]
- [ ] CHK043 Is it explicit that every quantified budget is per device and that no account-wide figure is asserted anywhere in this change? [Resource, Topology §Physical Resource Budget]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK044 Does the fallback hierarchy cover every way a reconciliation declaration can be unusable — absent, malformed, naming an unknown read, or belonging to a connector that is gone — with one stated outcome for each? [Fallback, Design §Multi-Level Fallback Hierarchy]
- [ ] CHK045 Is the restriction that no append channel crosses the process boundary expressed anywhere a reviewer would look for a requirement, or does it exist only inside the contract? [Extensibility, Contract §ledger-store §2, Gap]
- [ ] CHK046 Is the rule that a missing declaration means "cannot be read back" recorded where a connector author will encounter it, rather than only where a recovery implementer will? [Extensibility, Contract §tool-reconciliation, Evolution §Extension Procedure]

## Notes

**Session defaults.** This checklist was generated without an interview, so the standard defaults were applied and
are recorded here as the skill requires: standard rigor rather than a release gate, the decision-maker as the
intended reader, and emphasis on the two strongest signal clusters in this change — crash recovery correctness,
and the interaction between append-only and every operation that removes or reshapes data.

**Where the items point.** Items CHK041 to CHK046 evaluate `model.md`, `design.md` and the three contracts rather
than the delta specs, because the Physical Resource and Extensibility dimensions are owned by those artifacts in
this schema. Their traceability markers name those artifacts accordingly.

**Items worth the reviewer's attention first.** CHK016 asks whether a card type exists for a state this change
introduces; if it does not, the gap is in `uix`, which this change does not touch, and it needs a decision about
where that is fixed. CHK014 asks whether the modified append-only requirement finally resolves a contradiction
that has been present in the living spec since it was seeded. CHK036 asks whether the roadmap orders this change
after the one that supplies the declaration it reads.

**Metrics.** 46 items. Traceability: 46 of 46 carry a `Spec §`, `Contract §`, `Model §`, `Topology §`,
`Design §` or `Evolution §` reference, or a `Gap` / `Ambiguity` / `Conflict` / `Assumption` marker — 100 percent
against a target of 80. All eleven dimensions carry at least one item; none was omitted. Scenario layers
represented by the items: Primary, Alternate, Exception, Recovery and Non-functional.

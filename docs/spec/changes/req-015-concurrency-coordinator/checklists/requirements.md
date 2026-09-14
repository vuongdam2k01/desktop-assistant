# Requirements Quality Checklist: req-015-concurrency-coordinator

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is there a requirement stating what a user is shown while a job sits `queued` because the connector account's limit is full, or does the state change exist with nothing obliging the product to explain it? [Completeness, Gap]
- [ ] CHK002 Is the behaviour of a call refused because its object changed during an approval stated anywhere the user's experience is owned, or only as a coordinator error code and a ledger requirement? [Completeness, Spec §ledger "A call whose recorded before state no longer matches its target does not execute", Gap in `uix`]
- [ ] CHK003 Do the requirements say what happens to a job's already-queued platform requests when the job is cancelled while some of them are waiting for dispatch? [Completeness, Contract §resource-coordinator `CALL_CANCELLED`, Gap in specs]
- [ ] CHK004 Is there a requirement covering a job that holds a lease and then exceeds its time limit, or is the release of its leases only stated as a contract semantic? [Completeness, Contract §resource-coordinator `releaseJob`, Spec §job "A job ends when it exceeds its time limit"]
- [ ] CHK005 Is the interaction between the concurrency limit and a job that uses two connector accounts specified — does it need a slot in each before it may run? [Completeness, Gap, Spec §job "Jobs run in parallel without shared context"]
- [ ] CHK006 Is any requirement stated about what the coordinator does when a connector's declared limits are clamped, or is the clamp visible only to a connector author through a contract error? [Completeness, Contract §coordination-declaration `COORDINATION_POLICY_CLAMPED`]
- [ ] CHK007 Do the requirements state whether an undo job's own compensating calls take leases like any other write, or is that only implied by undo running as its own job? [Completeness, Gap, Spec §undo "Undo runs as its own job with its own ledger"]

## Requirement Clarity

- [ ] CHK008 Is "exclusive access" defined observably in the ledger requirement, or does checking it require inspecting the coordinator's internals? [Clarity, Spec §ledger "A recorded before state is captured under exclusive access to its target"]
- [ ] CHK009 Is "a job's wait does not grow with another job's backlog" precise enough to fail a specific implementation, or would a queue that merely bounds the wait loosely also satisfy it as written? [Clarity, Spec §connector "Requests under one authorisation are dispatched fairly between jobs"]
- [ ] CHK010 Does "no job waiting to be dispatched is passed over indefinitely" state a bound a test can apply, given that the weight and floor that would give it a number are deliberately unmeasured? [Clarity, Spec §connector fair-dispatch requirement, Verification §Thresholds]
- [ ] CHK011 Is "the same argument the platform call will address" checkable from outside, or is it a statement about internal wiring? [Clarity, Spec §connector "A resource is named by a normalised key derived from the call's own arguments"]
- [ ] CHK012 Is it unambiguous whether the configured number in the parallel-execution requirement counts jobs or counts tool calls? [Clarity, Ambiguity, Spec §job "Jobs run in parallel without shared context"]
- [ ] CHK013 Does "a job over that limit SHALL remain `queued`" make clear whether it is admitted in creation order, or is the order of admission unspecified? [Clarity, Gap, Spec §job parallel-execution requirement]

## Requirement Consistency

- [ ] CHK014 Does the modified retry requirement's new classification source — a coordinator error code — sit consistently with the existing statement that classification comes from what the adapter declared, or do the two now read as two rules? [Consistency, Spec §job "Transient failures are retried under a bounded policy"]
- [ ] CHK015 Is the slot-release-on-waiting rule consistent with the existing rule that waiting time does not consume the job's time limit, or does one of them need the other to be restated? [Consistency, Spec §job parallel-execution requirement vs §job "A job ends when it exceeds its time limit"]
- [ ] CHK016 Does the new ledger requirement on exclusive capture agree with the existing requirement that the intent record fixes what recovery may assume, given that both constrain the same recorded value? [Consistency, Spec §ledger new capture requirement vs §ledger "The intent record fixes what recovery may assume about the call"]
- [ ] CHK017 Do the new connector requirements and `agent/contracts/tool-wrapping@0.1.0` still describe one order, or does the wrapper's stated order now need the bracket written into it? [Conflict, Contract §tool-wrapping "The order, stated once" vs Design §D1]
- [ ] CHK018 Is the fair-dispatch requirement consistent with the existing Notion pacing requirements, which already fix a request ceiling and a per-authorisation budget? [Consistency, Spec §connector fair-dispatch vs §connector "Notion request volume respects the platform's limits", §connector "Notion pacing is held per authorisation rather than per device"]
- [ ] CHK019 Does refusing a manifest whose write tool declares no resources agree with the existing rule that a manifest is loaded whole or not at all, and with how the manifest contract already treats an undeclared reversibility? [Consistency, Spec §connector "A write tool declares the resources it touches, or its manifest is refused" vs §connector "A manifest is loaded whole or not at all", Contract §connector-manifest §Error Matrix]

## Acceptance Criteria Quality

- [ ] CHK020 Can "the second job's before state is read only after the first job's result record is durable" be demonstrated by a test that does not instrument the implementation? [Measurability, Spec §ledger capture requirement]
- [ ] CHK021 Is "both complete" a sufficient criterion for the opposite-order deadlock scenario, or should it state a bound within which they complete? [Measurability, Spec §connector "A call obtains every resource it declared at once, in a fixed order"]
- [ ] CHK022 Is the reserved interactive slot's effect demonstrable — can a test show a user-started job starting while background jobs fill the remaining slots? [Measurability, Spec §job parallel-execution requirement]
- [ ] CHK023 Is "dispatched within a bounded number of dispatches" measurable as written, given that the bound is not stated in the requirement? [Measurability, Spec §connector fair-dispatch requirement]
- [ ] CHK024 Does the requirement that a coordinator refusal is distinguishable from a platform failure have an observable consequence a reviewer can check, or only an internal distinction? [Measurability, Spec §connector "A call that cannot obtain its resources within the wait limit is refused rather than made"]

## Scenario Coverage

- [ ] CHK025 Is there a scenario for a job that is cancelled while it holds leases that other jobs are waiting for? [Coverage, Gap]
- [ ] CHK026 Is there a scenario for two jobs held for approval on the same object at the same time, and for what the second sees when the first is approved? [Coverage, Gap, Spec §ledger stale-state requirement]
- [ ] CHK027 Are the fair-dispatch scenarios covering the Exception layer — the platform refusing for volume mid-rotation — as well as the Primary and Alternate layers? [Coverage, Spec §connector fair-dispatch requirement]
- [ ] CHK028 Is there a scenario for the coordinator being unavailable during shutdown while a job is mid-call, or only for a call that has not started? [Coverage, Spec §connector "Every platform call passes through one resource coordinator"]
- [ ] CHK029 Is there a scenario for a reentrant call by a job that has suspended its bracket for an approval — can a job's second call proceed while its first is suspended? [Coverage, Gap, Model §INV-CN-18, §INV-CN-19]

## Edge Case Coverage

- [ ] CHK030 Is the case of a tool declaring the same resource twice, through two argument paths that normalise to one key, covered anywhere? [Edge Case, Gap, Contract §coordination-declaration]
- [ ] CHK031 Is the case of a declared resource whose identifier is present but empty distinguished from an absent one? [Edge Case, Gap, Contract §coordination-declaration `RESOURCE_KEY_UNRESOLVABLE`]
- [ ] CHK032 Is there coverage for a job whose call is refused with `STATE_CHANGED` repeatedly, because a busy object keeps changing during each approval? [Edge Case, Gap]
- [ ] CHK033 Is the clock-independence of the wait limit considered — what a wait means if the device's clock changes while a call is waiting? [Edge Case, Gap, cross-cutting "timezone/clock skew"]
- [ ] CHK034 Is the case of a connector disconnected while one of its objects is held by a running job covered? [Edge Case, Gap, cross-cutting "connector token revocation"]
- [ ] CHK035 Is the behaviour at start-up covered — a first call arriving before the coordinator has read the declarations? [Edge Case, Spec §connector "Every platform call passes through one resource coordinator", cross-cutting "startup/shutdown"]

## Non-Functional Requirements

- [ ] CHK036 Are the latency figures the design rests on stated with their measured source and their platform, rather than as product-wide numbers? [Non-Functional, Verification §Thresholds]
- [ ] CHK037 Is the unmeasured status of the dispatch weights and the background floor unmistakable to a reader of the specs, not only to a reader of `verification.md`? [Non-Functional, Spec §connector fair-dispatch requirement, Clarifications Q-5]
- [ ] CHK038 Is any requirement stated about memory or queue depth, and if not, is the absence justified by the structural bounds in the model rather than by omission? [Non-Functional, Model §Physical Resource Budget, Open Q-7]
- [ ] CHK039 Does anything oblige the product to keep the acknowledgement commitment for an interactive command while the account is at its concurrency limit? [Non-Functional, Gap, Spec §job parallel-execution requirement]

## Dependencies & Assumptions

- [ ] CHK040 Is the assumption that exclusivity is device-local visible where a reader of the living specs would find it, or only in this change's clarifications and model? [Assumption, Clarifications §Assumptions, Model §Variability reserved slot]
- [ ] CHK041 Is the manifest bump to `1.2.0` published where a reader of the current manifest version will find it, and is the one connector change that must add declarations named where its author will read it? [Dependency, Contract §connector-manifest §Migration, Evolution §Migration Paths, Impact §Versioning]
- [ ] CHK042 Is the assumption that read operations take no lease stated as a decision with its reason, rather than as an omission from the write requirements? [Assumption, Clarifications §Assumptions, Spec §ledger capture requirement]
- [ ] CHK043 Does the roadmap's dependency order place this change after the ones that supply the contracts it reads — the ledger record and the connector manifest? [Dependency, Roadmap R12 vs R4, R9]

## Ambiguities & Conflicts

- [ ] CHK044 Does "the job that holds them" in the resource-held refusal commit the product to naming another job to a user who may not have created it? [Ambiguity, Spec §connector wait-limit requirement]
- [ ] CHK045 Is there a conflict between suspending the bracket for an approval and the existing requirement that a held call's suspension is durable, given that the coordinator keeps nothing about it? [Conflict, Spec §approval "A held call suspends the job durably at the call" vs Model §INV-CN-21]
- [ ] CHK046 Does "one connector account" mean one authorisation or one platform account, in a product where a user may hold two authorisations to the same account? [Ambiguity, Spec §job parallel-execution requirement, Contract §resource-coordinator `authorisationRef`]

## Physical Resource & Topology Quality

- [ ] CHK047 Are the coordinator's in-memory structures, their bounds and their eviction rules stated precisely enough that a reviewer can tell what grows under load? [Resource, Model §Physical Resource & Artifact Topology]
- [ ] CHK048 Is the absence of any persisted artifact stated as a decision with its consequence for start-up, rather than as a section left empty? [Topology, Model §Physical Format & Storage, §INV-CN-21]
- [ ] CHK049 Does the state-to-artifact mapping account for every state in the bracket lifecycle, including the suspended one? [Topology, Model §State-to-Artifact Mapping Matrix vs §Lifecycle]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK050 Is the fallback hierarchy explicit about why a missing resource declaration withholds a tool while a missing reconciliation declaration does not? [Fallback, Design §Multi-Level Fallback Hierarchy, Model §Fallback on Missing Manifest]
- [ ] CHK051 Are the read-only cross-process channels specified with their payloads and failure behaviour, and is the absence of a mutating channel stated as a guarantee rather than an oversight? [Extensibility, Contract §resource-coordinator §2, Design §Execution Boundary]
- [ ] CHK052 Does the declaration schema prevent a normalisation rule that could split one object across two keys, or is that only stated in prose? [Extensibility, Contract §coordination-declaration `NORMALISATION_UNSAFE`]
- [ ] CHK053 Is the reserved point for cross-device exclusivity stated with a phase, a rationale and an activation condition, as the constitution requires of a reserved slot? [Extensibility, Model §Variability, Evolution §Reserved Slots]

## Notes

**Session defaults.** This checklist was generated without an interview, so the standard defaults were applied
and are recorded here as the skill requires: standard rigor rather than a release gate, the decision-maker as the
intended reader, and emphasis on the two clusters that carry the most signal in this change — the correctness of
the exclusive span around a recorded before state, and the boundary between this change's concerns and those of
the capabilities it borders on (`approval`, `undo`, `agent`).

**Where the items point.** CHK047 to CHK053 evaluate `model.md`, `design.md` and the two contracts rather than
the delta specs, because the Physical Resource and Extensibility dimensions are owned by those artifacts in this
schema. Their traceability markers name those artifacts accordingly.

**Items worth the reviewer's attention first.** CHK017 asks whether the wrapping contract must now state the
bracket in its own "order, stated once" — if it must, that is a change to another capability's contract and
needs a decision about where it is made. CHK045 asks whether suspending the bracket for an approval sits
comfortably with the durable-suspension requirement that `approval` already carries. CHK002 asks where the
user-facing side of a `STATE_CHANGED` refusal lives, since this change deliberately touches no interface
capability.

**Metrics.** 53 items. Traceability: 53 of 53 carry a `Spec §`, `Contract §`, `Model §`, `Design §`,
`Verification §`, `Evolution §`, `Impact §`, `Roadmap` or `Clarifications §` reference, or a `Gap`,
`Ambiguity`, `Conflict`, `Assumption` or `Dependency` marker — 100 percent against a target of 80. All eleven
dimensions carry at least one item; none was omitted. Scenario layers represented by the items: Primary,
Alternate, Exception, Recovery and Non-functional.

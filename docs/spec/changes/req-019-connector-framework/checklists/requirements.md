# Requirements Quality Checklist: req-019-connector-framework

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is there a requirement stating who may author a manifest, or is authorship treated as an internal act that no requirement constrains while the whole security argument for in-process adapters rests on manifests being first-party? [Completeness, Gap]
- [ ] CHK002 Do the requirements say what happens to a connector that loaded successfully at start-up but whose adapter fails at its first call, as distinct from a manifest that failed to load? [Completeness, Gap]
- [ ] CHK003 Is the obligation to record which scope profile an authorisation was granted under stated as a requirement, or only as a clause inside the scope requirement's statement? [Completeness, Spec §connector "Only the scope of an enabled capability is requested"]
- [ ] CHK004 Are the requirements explicit about what a user is told when a connector is unavailable because its manifest failed validation — a product defect — rather than because of anything they did? [Completeness, Spec §connector "A manifest is loaded whole or not at all"]
- [ ] CHK005 Is there a requirement covering what happens to a job that was waiting for approval when the connector it depends on is disconnected? [Completeness, Gap]
- [ ] CHK006 Do the requirements state whether a connector's status is re-established periodically, or only before a job and after a failure? [Completeness, Spec §connector "Connector state is established by asking the platform"]
- [ ] CHK007 Is the obligation on read-only connectors to declare content sanitization stated as a requirement anywhere, given that the constitution's External Content Is Data section depends on it? [Completeness, Gap]
- [ ] CHK008 Is there a requirement that the connector identity appearing in a ledger record matches the manifest identity, or is that left to the ledger's own record requirements? [Completeness, Spec §connector "One job may use several connectors"]

## Requirement Clarity

- [ ] CHK009 Does "the configured margin" name something a reviewer can look up, or does the requirement rely on `verification.md` to supply the only number? [Clarity, Spec §job "A job establishes its connectors' authorisation before it starts"]
- [ ] CHK010 Is "a structured object" precise enough to decide which write tools must declare exclusions, or could two authors reasonably disagree about whether their target counts? [Clarity, Spec §connector "A write tool that snapshots a structured object declares what is excluded from the snapshot"]
- [ ] CHK011 Does "states plainly that the platform still lists the integration" fix what the user is told closely enough to reject a message that merely says "disconnected"? [Clarity, Spec §connector "Disconnecting revokes and erases the authorisation"]
- [ ] CHK012 Is "the declarations the gate reads" enumerated in the requirement itself, or must a reader open the manifest contract to know which three fields are meant? [Clarity, Spec §approval "The declarations the gate reads come from the manifest, never from the call"]
- [ ] CHK013 Does "an unclassified adapter defect" describe something observable — a record, a state, a message — or an internal classification no test can see? [Clarity, Spec §connector "A connector reports failure only as a declared error code"]
- [ ] CHK014 Is "the connectors a job may use" decidable before the job runs, given that an agent chooses its tools during the run? [Clarity, Ambiguity, Spec §job "A job establishes its connectors' authorisation before it starts"]

## Requirement Consistency

- [ ] CHK015 Does the new requirement that failures arrive as declared codes agree with the existing agent requirement that a refusal is a result rather than a fault, or do the two describe overlapping vocabularies? [Consistency, Spec §connector "A connector reports failure only as a declared error code" vs §agent "Every worker tool is wrapped by the gate and the ledger obligation"]
- [ ] CHK016 Is the modified irreversible-approval requirement consistent with the mode `off` requirement, which says the mode removes waiting but never a boundary the user drew? [Consistency, Spec §approval "Irreversible operations require approval in `smart` and `on`" vs §approval "Approval mode `off` removes waiting but not recording"]
- [ ] CHK017 Do the connector requirement that state is established by probing and the existing requirement that connector state is visible and recoverable in one action use the same set of states, or has one of them acquired a state the other does not name? [Consistency, Spec §connector "Connector state is established by asking the platform" vs §connector "Connector state is visible and recoverable in one action"]
- [ ] CHK018 Does treating a call whose snapshot could not be read as irreversible agree with the existing Notion requirement that such an operation is "recorded as irreversible", or does one of them imply recording and the other implies approval? [Consistency, Spec §approval irreversible requirement vs §connector "Every Notion write is preceded by a recorded snapshot"]
- [ ] CHK019 Is the manifest requirement's list of what a tool declares consistent with what `agent/contracts/tool-wrapping@0.1.0` says it requires of a manifest, field for field? [Consistency, Spec §connector "A connector is defined by a manifest" vs Contract §tool-wrapping]
- [ ] CHK020 Do the job requirements use one classification of failures — the declared codes — or do the retry requirement and the failure requirement classify by different means? [Consistency, Spec §job "Transient failures are retried under a bounded policy" vs §job "A failed job explains itself and offers undo"]

## Acceptance Criteria Quality

- [ ] CHK021 Can "the job manager, the evaluator, the ledger, the wrapping layer and the tool generator are unchanged" be verified by anything other than a diff at the moment a connector is added — and is that check stated as an obligation anywhere? [Measurability, Spec §connector "A connector is reached only through the four adapter operations"]
- [ ] CHK022 Is "no part of them is present in any configuration file the user or a tool can read" testable without knowing every file the product writes? [Measurability, Spec §connector "A connector's authorisation is persisted only through the device's credential store"]
- [ ] CHK023 Can "the failure names the declaration at fault" be checked objectively, or does it accept any message that mentions the connector? [Measurability, Spec §connector "A manifest is loaded whole or not at all"]
- [ ] CHK024 Is "the adapter is not reached" observable in a test, given that the adapter is held privately by the wrapper? [Measurability, Spec §approval "The declarations the gate reads come from the manifest, never from the call"]
- [ ] CHK025 Does "renewed first, and the job's tool calls run against the renewed one" give a test something to assert beyond the job succeeding? [Measurability, Spec §job "A job establishes its connectors' authorisation before it starts"]

## Scenario Coverage

- [ ] CHK026 Is there a scenario for the primary path of adding a connector — a manifest and an adapter arriving together and producing a working tool set — or do the scenarios only cover what happens when something is wrong? [Coverage, Primary, Spec §connector "A connector is defined by a manifest"]
- [ ] CHK027 Is the alternate path of a connector that is connected on one device and not yet replicated to another covered by a scenario in this change, or is it inherited entirely from `req-022-account-sync`? [Coverage, Alternate, Spec §connector "Connector state is established by asking the platform"]
- [ ] CHK028 Are the exception paths of each of the twelve declared error codes covered by at least one scenario somewhere in the specification set, or only the three that end a job? [Coverage, Exception, Gap]
- [ ] CHK029 Is there a recovery scenario for a connector that was revoked and is then reconnected while a job that failed on it is still listed? [Coverage, Recovery, Gap]
- [ ] CHK030 Is the zero-data state covered — a product with no connector connected at all, where the agent holds no platform tool? [Coverage, Spec §connector "The tool set is generated from connected connectors only"]
- [ ] CHK031 Does any scenario cover a job that uses two connectors where one of them fails part-way, given that the multi-connector requirement's only scenario is the successful one? [Coverage, Exception, Spec §connector "One job may use several connectors"]

## Edge Case Coverage

- [ ] CHK032 Is behaviour specified when two devices disconnect and reconnect the same connector at nearly the same moment? [Edge Case, Gap]
- [ ] CHK033 Is behaviour specified when a manifest's `schema_version` is older than the current one by a minor version — accepted, or refused alongside the newer-major case? [Edge Case, Spec §connector "A manifest is loaded whole or not at all"]
- [ ] CHK034 Is behaviour specified when an authorisation is renewed successfully but the platform then refuses the very next call as expired? [Edge Case, Gap]
- [ ] CHK035 Is behaviour specified for a tool whose compensation names a tool that exists but is itself flagged irreversible? [Edge Case, Gap]
- [ ] CHK036 Is behaviour specified when the same platform is connected twice under two different accounts of that platform? [Edge Case, Gap]
- [ ] CHK037 Is behaviour specified when a connector's status probe succeeds but returns a state different from the one a concurrent tool call is observing? [Edge Case, Spec §connector "Connector state is established by asking the platform"]

## Non-Functional Requirements

- [ ] CHK038 Are there requirements about how long establishing every connector's state may take before a job starts, or is only the renewal's cost recorded? [Non-Functional, Gap]
- [ ] CHK039 Is any requirement stated about the number of connectors or tools the product must support without degrading, given that the measured configuration had two connectors and nine tools? [Non-Functional, Gap]
- [ ] CHK040 Are observability obligations stated — what a diagnostic bundle must contain about connector state and manifest load failures — or is that left to the platform capability? [Non-Functional, Spec §connector "A connector's authorisation is persisted only through the device's credential store"]
- [ ] CHK041 Is the compliance consequence of the scope profile — which verification tier a channel must clear — expressed anywhere as a requirement, or only as an open question? [Non-Functional, Spec §connector "Only the scope of an enabled capability is requested"]

## Dependencies & Assumptions

- [ ] CHK042 Is the assumption that two connectors suffice to freeze the boundary recorded where a reviewer will meet it, and is the condition that would falsify it stated? [Assumption, Proposal §Assumptions]
- [ ] CHK043 Is the dependency on `job/contracts/tool-reconciliation@0.1.0` for every tool's reconciliation declaration visible in the requirements, or only in the contract? [Dependency, Spec §connector "A connector is defined by a manifest"]
- [ ] CHK044 Is the assumption that every manifest ships with the release — on which the in-process adapter decision depends — stated as a constraint anywhere a requirement can be checked against? [Assumption, Model §Variability reserved point]
- [ ] CHK045 Is the dependency on the backend's provider descriptor for platforms needing a confidential client stated in the requirements, or only in the manifest contract's semantics? [Dependency, Contract §connector-manifest `provider_id`]

## Ambiguities & Conflicts

- [ ] CHK046 Does "irreversible" mean the same thing in the manifest, in the approval requirement and in the undo capability, or does one of them include operations whose snapshot merely could not be read? [Ambiguity, Spec §approval irreversible requirement vs §undo "Irreversible operations are a normal, declared outcome"]
- [ ] CHK047 Is "disconnected" one state or two — no authorisation held, and an authorisation held but not replicated to this device? [Ambiguity, Spec §connector "Connector state is established by asking the platform" vs §connector "Connecting a platform connects it for the account, not for one device"]
- [ ] CHK048 Do the requirements conflict on who renews an authorisation: the job before it starts, or the adapter at the moment of a call? [Conflict, Spec §job "A job establishes its connectors' authorisation before it starts" vs Contract §connector-adapter Semantics]
- [ ] CHK049 Does "the manifest is the sole place any platform-specific behaviour is expressed" conflict with the existence of an adapter, which is platform-specific code by definition? [Ambiguity, Spec §connector "A connector is defined by a manifest"]

## Physical Resource & Topology Quality

- [ ] CHK050 Are the manifest's storage location and format stated precisely enough to rule out a manifest fetched at runtime, or does the requirement set permit it while the model forbids it? [Resource, Topology §Physical Format & Storage]
- [ ] CHK051 Is a budget stated for the generated tool set — how many tools one job may hold — or is the only figure the measured nine? [Resource, Topology §Physical Format & Storage]
- [ ] CHK052 Does the state-to-artifact matrix account for every state in the registration lifecycle, including `Refused` and `Unavailable here`? [Topology, Model §State-to-Artifact Mapping Matrix]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK053 Does the fallback hierarchy state what happens at each tier without appealing to a substitute platform, and is the absence of a built-in stand-in explained rather than merely omitted? [Fallback, Design §Multi-Level Fallback Hierarchy]
- [ ] CHK054 Are the manifest schema's cross-field rules — exactly one of compensation or irreversible, snapshot required with compensation, exclusions required inside a snapshot — expressed as requirements as well as schema prose, so that a reviewer can test them? [Extensibility, Contract §connector-manifest Semantics]
- [ ] CHK055 Is every channel a window can use listed, and is the absence of a channel from a window to an adapter stated as an obligation rather than as an omission? [Protocol, Design §Communication Channels & Protocols]
- [ ] CHK056 Does the reserved point for third-party connectors carry a phase, a rationale and an activation condition, as the constitution's Reserved By Design section requires? [Extensibility, Model §Variability]

## Notes

Requirements in this project are addressed by title. A title edited after this checklist is written silently
breaks both the `MODIFIED` deltas and the references above, which is the concern CHK005 of
`req-012-secure-storage` raised at the project level and which this change inherits rather than resolves.

# Requirements Quality Checklist: req-007-pi-sdk-harness

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is there a requirement stating what the user is shown when a job cannot be resumed because its stored transcript does not load, or does that behaviour exist only as an error code in the contract? [Completeness, Gap]
- [ ] CHK002 Do the requirements say anything about how long a transcript is kept, or is retention stated only in the store descriptor inside a contract? [Completeness, Gap]
- [ ] CHK003 Is there a requirement obliging the product to show a transcript at all, or does the whole conversation exist in specs only as something that is stored? [Completeness, Gap]
- [ ] CHK004 Does any requirement state what happens to a suspended run when the connector it was about to call is disconnected while the job waits? [Completeness, Gap]
- [ ] CHK005 Is the obligation to release attached images at the end of a job restated anywhere in this change, or is it relied upon from the existing `agent` requirement without this change's image floor being connected to it? [Completeness, Spec §agent "Attached screenshots are discarded when the job ends"]
- [ ] CHK006 Is there a requirement covering a tool implementation that never returns — a call that hangs rather than failing — or is that left entirely to the job time limit in another capability? [Completeness, Gap]
- [ ] CHK007 Do the requirements state who may raise the pinned harness version, or only that a build fails when the installed version differs? [Completeness, Spec §agent "The agent harness is pinned to one package identity and one version"]

## Requirement Clarity

- [ ] CHK008 Is "SHALL be started holding no tool the factory did not return" observable from outside the product, or only checkable by reading the construction site? [Clarity, Spec §agent "Tools reach the harness only through the wrapping factory"]
- [ ] CHK009 Does "the product SHALL NOT depend on any call-interception facility the harness itself provides" forbid using such a facility at all, or only forbid depending on it for the guarantee? [Clarity, Ambiguity, Spec §agent "Tools reach the harness only through the wrapping factory"]
- [ ] CHK010 Is "evaluated like any other call rather than being exempted" specific enough to tell an implementer what verdict an internal tool is expected to receive? [Clarity, Spec §agent "Tools reach the harness only through the wrapping factory"]
- [ ] CHK011 Does "indistinguishable from the live session that was suspended" name a checkable comparison, or does it leave the reviewer to decide what counts as distinguishable? [Clarity, Model §INV-AG-06, Spec §agent "A resumed run continues at its suspension point without repeating completed work"]
- [ ] CHK012 Is "the turns completed so far are durable before the job is shown as waiting" checkable from outside, given that durability and visibility are both internal events? [Clarity, Spec §approval "A held call suspends the job durably at the call"]
- [ ] CHK013 Does "a credential for a named provider or a custom endpoint that speaks a completion protocol the harness supports" make clear that an unsupported dialect is refused at configuration rather than at first use? [Clarity, Spec §agent "Model provider and role routing are configured on the client"]
- [ ] CHK014 Is "no smaller than 14 pixels in either dimension" unambiguous about whether exactly 14 is accepted? [Clarity, Spec §uix "Composer accepts text and images with declared limits"]

## Requirement Consistency

- [ ] CHK015 Does the new single-registration-path requirement agree with the existing wrapping requirement, or do the two now state overlapping obligations that a reader must reconcile? [Consistency, Spec §agent "Tools reach the harness only through the wrapping factory" vs §agent "Every worker tool is wrapped by the gate and the ledger obligation"]
- [ ] CHK016 Does per-session isolation in `agent` say the same thing as per-job context isolation in `job`, and if so is the duplication intended? [Consistency, Spec §agent "Each harness session holds its own state and shares nothing with another" vs §job "Jobs run in parallel without shared context"]
- [ ] CHK017 Is the durable-suspension requirement consistent with the existing rule that an expired approval is evaluated again rather than executed, including when the decision arrives after a restart? [Consistency, Spec §approval "A held call suspends the job durably at the call" vs §approval "An unanswered approval pauses the job safely"]
- [ ] CHK018 Does treating a refusal as an ordinary tool result agree with the existing requirement that asking cannot obtain what the gate refused, or could an agent use the refusal text to construct a different route? [Consistency, Spec §approval "A denied call returns to the agent as a refusal, not as a fault" vs §agent "Asking cannot obtain what the gate refused"]
- [ ] CHK019 Does the corrected provider requirement leave any other artifact still describing an interactive provider sign-in that this change establishes does not exist? [Consistency, Conflict, Spec §agent "Model provider and role routing are configured on the client"]
- [ ] CHK020 Is the composer's image floor consistent with the per-model floor a provider profile may declare, and is it clear which one a user is told about? [Consistency, Spec §uix vs Contract §provider-profile `minimumImagePixels`]

## Acceptance Criteria Quality

- [ ] CHK021 Can "the tool implementation is not invoked" be observed by a test without instrumenting the implementation, or does the criterion presuppose a counter that only exists in test code? [Acceptance Criteria, Spec §agent "Tools reach the harness only through the wrapping factory"]
- [ ] CHK022 Is "the read is not re-issued" measurable in a way that distinguishes a genuinely skipped step from one that ran against a cache? [Acceptance Criteria, Spec §agent "A resumed run continues at its suspension point without repeating completed work"]
- [ ] CHK023 Does "the build fails and names the package it refused" state enough for a reviewer to know the check runs in continuous integration rather than only locally? [Acceptance Criteria, Spec §agent "The agent harness is pinned to one package identity and one version"]
- [ ] CHK024 Is "every such call is refused across the product until the catalogue is repaired" testable without constructing a second concurrent job? [Acceptance Criteria, Spec §approval "A denied call returns to the agent as a refusal, not as a fault"]

## Scenario Coverage

- [ ] CHK025 Is the primary journey covered end to end — a command, a read, a held write, an approval, a report — or only in the fragments each requirement needed? [Coverage, Spec §agent, §approval]
- [ ] CHK026 Is the denial journey covered as fully as the approval journey, including what the user sees afterwards? [Coverage, Gap]
- [ ] CHK027 Does any scenario cover a job that is cancelled while suspended, and what the user is told about the work already done? [Coverage, Spec §agent "A resumed run continues at its suspension point without repeating completed work"]
- [ ] CHK028 Is there a scenario for the first-run condition where no provider is configured and the user hands over a command with images attached? [Coverage, Gap]

## Edge Case Coverage

- [ ] CHK029 Is the case of two devices signed in to one account, both able to see the same pending approval, covered by a scenario that says which device executes? [Edge Cases, Spec §approval "A held call suspends the job durably at the call"]
- [ ] CHK030 Does any requirement cover a decision arriving for a call whose job has already reached a terminal state by another route? [Edge Cases, Contract §agent-session `RUN_ALREADY_FINISHED`, Gap in specs]
- [ ] CHK031 Is a transcript that ends on a tool call with neither result nor refusal covered as a requirement, or only as a contract error code? [Edge Cases, Contract §agent-session `TRANSCRIPT_INCONSISTENT`, Gap in specs]
- [ ] CHK032 Does any scenario cover the product being stopped between the durable transcript write and the approval request becoming visible? [Edge Cases, Spec §approval "A held call suspends the job durably at the call"]
- [ ] CHK033 Is there coverage for an image that passes the composer's floor but is refused by the provider for a different reason, so the user is not told twice in two different vocabularies? [Edge Cases, Gap]
- [ ] CHK034 Does any requirement cover the maximum number of sessions that may run at once, or is concurrency bounded only by the job manager in another change? [Edge Cases, Gap]

## Non-Functional Requirements

- [ ] CHK035 Are any of the measured figures — three concurrent sessions, resume duration — expressed as requirements, or do they live only in `verification.md` as observations? [Non-Functional, Gap]
- [ ] CHK036 Is the absence of a measured memory cost per session acceptable as a stated unknown, or does the reviewer need a bound before implementation starts? [Non-Functional, Gap]
- [ ] CHK037 Do the requirements state anywhere that credentials must not appear in a transcript, or is that only a model invariant? [Non-Functional, Model §INV-AG-08, Gap in specs]
- [ ] CHK038 Is the requirement that instructions are advisory stated anywhere a reviewer of a future change would encounter it, or only inside a contract's semantics? [Non-Functional, Contract §agent-session Semantics, Gap in specs]

## Dependencies & Assumptions

- [ ] CHK039 Are the assumptions that the harness runs in the main process, and that no window holds a session, recorded somewhere a later change would have to contradict deliberately? [Dependencies, Clarifications §Assumptions]
- [ ] CHK040 Is the dependency on `req-019-connector-framework` for tool declarations explicit enough that this change cannot be implemented before that contract exists? [Dependencies, Contract §tool-wrapping §3]
- [ ] CHK041 Is it clear which requirements depend on `req-013-sqlite-ledger`'s recovery pass, so that reordering the roadmap would be visibly wrong rather than quietly wrong? [Dependencies, Spec §approval "A held call suspends the job durably at the call"]
- [ ] CHK042 Is the assumption that every measurement was taken outside the shipped application framework stated where a reader of the requirements alone would see it? [Assumptions, Clarifications §Open Q-1]

## Ambiguities & Conflicts

- [ ] CHK043 Does "the similarly named alternative distribution" identify the refused package precisely enough for a build check to be written from the requirement alone? [Ambiguity, Spec §agent "The agent harness is pinned to one package identity and one version"]
- [ ] CHK044 Is "recorded as verified" in the pinning requirement a reference to a specific evidence section, or a phrase a later reader must go hunting for? [Ambiguity, Spec §agent "The agent harness is pinned to one package identity and one version"]
- [ ] CHK045 Does "the job SHALL remain able to continue and report" conflict with any existing requirement about what a job does after an operation it needed was refused? [Conflict, Spec §approval "A denied call returns to the agent as a refusal, not as a fault"]

## Physical Resource & Topology Quality

- [ ] CHK046 Is the transcript's storage location and its distinctness from the ledger stated anywhere in the requirements, or only in the model and the contract? [Topology, Model §Physical Resource & Artifact Topology, Gap in specs]
- [ ] CHK047 Does the change state a budget, or an explicit absence of one, for what a session costs in memory while suspended? [Topology, Model §Physical Resource & Artifact Topology]
- [ ] CHK048 Is it clear that a window never receives an image payload, and is that stated as a requirement anywhere or only as a channel omission? [Topology, Contract §agent-session §2, Gap in specs]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK049 Does the single-registration-path requirement leave room for a future tool source other than a connector manifest, or does adding one require a MAJOR change to the contract? [Extensibility, Model §Variability, Contract §tool-wrapping]
- [ ] CHK050 Is the rule that no fallback substitutes a different provider or model stated as a requirement, or only as a design position? [Fallback, Design §Extensibility & Fallback Strategy, Gap in specs]
- [ ] CHK051 Does the absence of any channel that starts or resumes a session appear anywhere a reviewer of a future change would see it before adding one? [Protocol, Contract §agent-session §2]
- [ ] CHK052 Is the forward-compatibility position on profiles — an older build refuses a newer profile rather than reading around it — reflected in any requirement, or only in the contract's compatibility section? [Extensibility, Contract §provider-profile Compatibility, Gap in specs]

## Notes

Items marked `Gap in specs` name something this change decided in a contract, a model or a clarification but did
not oblige in a requirement. That is not automatically a defect: a structural invariant belongs in `model.md` and
an error code belongs in a contract. The question each one asks is whether the obligation is one a test should be
able to fail on, and only the reviewer can answer that.

Four items are worth reading first, because a "no" on any of them changes the delta rather than refining it:
CHK009 (does the requirement forbid the engine's interception facility outright, which would over-constrain the
implementation), CHK015 (two overlapping obligations on tool wrapping now live in one capability), CHK018 (a
refusal returned as readable text to the model, checked against the rule that asking cannot obtain what the gate
refused), and CHK029 (which device executes a call approved from another).

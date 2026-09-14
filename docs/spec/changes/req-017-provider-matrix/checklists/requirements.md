# Requirements Quality Checklist: req-017-provider-matrix

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is there a requirement stating what the user sees while a vision model takes the measured six seconds, or does the specification stop at the acknowledgement and leave the gap to an open question? [Completeness, Gap, Spec §pet "The pet acknowledges a handed-over command before any model answers"]
- [ ] CHK002 Do the requirements say who may change a role's assignment — only the user in settings — or is that stated only in the contract's list of channels that do not exist? [Completeness, Gap]
- [ ] CHK003 Is there a requirement covering the first-run state where a profile exists but no routing table does, which is the state every existing user of `req-007-pi-sdk-harness` will be in? [Completeness, Spec §agent "Model provider and role routing are configured on the client", Design §Migration]
- [ ] CHK004 Does any requirement state what happens when a job is running and the profile its role points at is deleted, as opposed to the model being unoffered? [Completeness, Gap]
- [ ] CHK005 Is the retention of usage records stated in a requirement, or only inside the usage-accounting contract's semantics? [Completeness, Gap]
- [ ] CHK006 Do the requirements cover a provider that returns content the product cannot parse, as distinct from a provider that returns nothing at all? [Completeness, Spec §agent "A model response carrying neither content nor an error is a failure"]
- [ ] CHK007 Is there a requirement obliging the product to show the user which model served a completed job, or does that exist only as a usage record the job detail page happens to display? [Completeness, Spec §app "The job detail page carries the full account of one job"]
- [ ] CHK008 Does any requirement state what happens to the acknowledgement when the user sends a second command before the first has been answered? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK009 Is "within 200 milliseconds" measured from the send action or from the composer accepting the keystroke, and is the reference point unambiguous to an implementer? [Clarity, Spec §pet "The pet acknowledges a handed-over command before any model answers"]
- [ ] CHK010 Does "states receipt only — naming nothing from the command, asserting no understanding of it" give a reviewer a decidable test for a proposed persona line? [Clarity, Spec §pet "All pet-visible text originates from the pet-agent"]
- [ ] CHK011 Is "the product holds no measurement for that model in that role" clear about whether a measurement of the same model in a different role counts? [Clarity, Spec §agent "An assignment that departs from a measured result says what it departs from"]
- [ ] CHK012 Does "the shape of the input it carries" make plain that only the presence of images matters and nothing about the command's content? [Clarity, Spec §agent "Every model request resolves through the routing table", Model §INV-AG-22]
- [ ] CHK013 Is "classified into exactly one declared cause" observable from outside the product, or checkable only by reading the classifier? [Clarity, Spec §agent "Every provider failure is classified into a stated cause and a remedy"]
- [ ] CHK014 Does "a statement that no cost is available for that model" specify enough for a designer to know whether the statement is per model, per request or per job? [Clarity, Spec §app "The job detail page carries the full account of one job"]
- [ ] CHK015 Is "reported as unusable on this device" distinguishable, to a user reading the card, from a role that was never assigned? [Clarity, Spec §agent "The routing table follows the account and names what this device cannot serve"]
- [ ] CHK016 Does "the single control that opens the settings area where it is repaired" fix that there is exactly one control, or could a card carry a second, secondary action? [Clarity, Spec §uix "A provider failure reaches the user as a system card"]

## Requirement Consistency

- [ ] CHK017 Does the acknowledgement exception in `pet` contradict the rule it is written into, or does the content constraint genuinely preserve what that rule protects? [Consistency, Spec §pet "All pet-visible text originates from the pet-agent" vs §pet "The pet acknowledges a handed-over command before any model answers"]
- [ ] CHK018 Do the `agent` classification requirement and the `uix` card requirement divide the work cleanly, or do both now describe what the user sees? [Consistency, Spec §agent "Every provider failure is classified into a stated cause and a remedy" vs §uix "A provider failure reaches the user as a system card"]
- [ ] CHK019 Is the composer's image gate consistent with the existing image floor and limits in the same requirement, or do the two refusal paths now explain themselves differently? [Consistency, Spec §uix "Composer accepts text and images with declared limits"]
- [ ] CHK020 Does the six-role list in the MODIFIED `agent` requirement match the role catalogue in `role-routing@0.1.0` exactly, including names? [Consistency, Spec §agent "Model provider and role routing are configured on the client" vs Contract role-routing §Interface]
- [ ] CHK021 Does the ACK-before-job requirement agree with the existing rule that every card carries the shortened job name when it relates to a job? [Consistency, Spec §uix "An acknowledgement card may exist before its job does" vs §uix "Only seven card types exist"]
- [ ] CHK022 Is the risk-judge role's failure behaviour here consistent with the fail-closed requirement `req-011-risk-judge` owns, or could a routing error be read as a softer outcome than a provider error? [Consistency, Spec §agent vs `req-011-risk-judge`]
- [ ] CHK023 Does "the product does not retarget" in `agent` agree with the fallback hierarchy in design, which does allow defaults to be proposed automatically at first configuration? [Consistency, Spec §agent "The routing table follows the account…" vs Design §Extensibility Tier 2]

## Acceptance Criteria Quality

- [ ] CHK024 Is the 200 ms acknowledgement ceiling measurable by an automated check, given that it spans a user action and a rendered frame? [Measurability, Spec §pet, Verification §Thresholds]
- [ ] CHK025 Can "no request is sent" be observed in a test, or does verifying it require instrumenting the dispatcher? [Measurability, Spec §agent "A role is assigned only to a model that declares the capabilities its requests need"]
- [ ] CHK026 Are the token counts on the job detail page checkable against an independent figure, or only against what the product itself recorded? [Measurability, Spec §app, Verification §Manual Checks]
- [ ] CHK027 Does "the waiting card is updated rather than a second card being queued" state an observable queue length the test can assert? [Measurability, Spec §uix "A provider failure reaches the user as a system card"]
- [ ] CHK028 Is "usage was not reported for that request" distinguishable in the record from "zero tokens", and is that distinction asserted anywhere as a criterion? [Measurability, Spec §agent "Every model request records what it consumed"]

## Scenario Coverage

- [ ] CHK029 Is there a scenario for the primary path — a user with several models completing a job across three roles — or do the scenarios only cover deviations? [Coverage, Gap]
- [ ] CHK030 Does a scenario cover the alternate path where the user overrides a measured default and proceeds? [Coverage, Spec §agent "An assignment that departs from a measured result says what it departs from"]
- [ ] CHK031 Is the recovery path covered — a failure card raised, the configuration repaired, work resuming — end to end rather than in two separate requirements? [Coverage, Spec §uix "A provider failure reaches the user as a system card"]
- [ ] CHK032 Does a scenario cover the exception path where a role is assigned and usable but the request times out, as distinct from the endpoint being unreachable? [Coverage, Gap]
- [ ] CHK033 Is there a scenario covering a second device where the table replicated and the credential did not, from the user's point of view rather than the table's? [Coverage, Spec §agent "The routing table follows the account and names what this device cannot serve"]

## Edge Case Coverage

- [ ] CHK034 Is the case covered where a profile is edited mid-job so the running job's model loses a capability it was using? [Edge Case, Spec §agent "A role is assigned only to a model that declares the capabilities its requests need"]
- [ ] CHK035 Does anything cover a job whose requests span two profiles in two currencies, which the contract allows and the job total cannot reconcile? [Edge Case, Contract usage-accounting §Semantics, Spec §app]
- [ ] CHK036 Is the case covered where the same profile fails two different ways at once — quota exhausted for one role, model unavailable for another? [Edge Case, Spec §uix "A provider failure reaches the user as a system card"]
- [ ] CHK037 Does any scenario cover an image attached on one device and opened on another where the image role is unusable? [Edge Case, Spec §uix "Composer accepts text and images with declared limits"]
- [ ] CHK038 Is the zero-data state covered — a fresh account with no profile, no table and no prices — for each surface this change touches, rather than only for the composer? [Edge Case, Gap]
- [ ] CHK039 Is there coverage for a provider that reports usage figures which are implausible, such as more output tokens than the response contains? [Edge Case, Gap]

## Non-Functional Requirements

- [ ] CHK040 Are the acknowledgement's timing requirement and the product's existing two-second commitment stated in a way that makes clear which one a test failure would breach? [Non-Functional, Spec §pet, Verification §Thresholds]
- [ ] CHK041 Is the six-decimal precision floor for costs stated anywhere a reader of the requirements would find it, or only inside a contract? [Non-Functional, Contract usage-accounting §Semantics]
- [ ] CHK042 Do the requirements state any bound on how long the capability decision may hold an attached image in memory? [Non-Functional, Gap, Model §Physical Resource]
- [ ] CHK043 Is the privacy consequence of `providerDetail` — third-party text shown to the user — constrained by a requirement, or only by the contract's length bound? [Non-Functional, Contract provider-failure §Semantics, Gap]

## Dependencies & Assumptions

- [ ] CHK044 Is the dependency on `provider-profile@0.1.0` for declared capabilities explicit in the requirements, given that the whole enforcement layer rests on a field the user fills in? [Assumption, Spec §agent, Contract role-routing §Purpose]
- [ ] CHK045 Is the assumption that a provider reports token usage at all stated where a reader would see it, rather than only appearing as a scenario about its absence? [Assumption, Spec §agent "Every model request records what it consumed"]
- [ ] CHK046 Does the change state its dependency on the persona specification existing — the acknowledgement lines must be authored before the acknowledgement can be presented? [Assumption, Spec §pet, Open Q-OQ-3 in `req-001-mvp-product-definition`]
- [ ] CHK047 Is the assumption that the measured provider's prices drift recorded where it affects a decision, rather than only in the proposal? [Assumption, Clarifications §Assumptions, Verification §Thresholds]

## Ambiguities & Conflicts

- [ ] CHK048 Does "measured suitability" risk being read as a quality rating the product maintains for models generally, rather than a record of specific spikes? [Ambiguity, Spec §agent "An assignment that departs from a measured result says what it departs from"]
- [ ] CHK049 Is there a conflict between the product refusing to show a cost without a user-entered price and the user's reasonable expectation that a product showing tokens can multiply? [Conflict, Spec §app, Design §D8]
- [ ] CHK050 Could "the pet enters its working state" be read as conflicting with the existing requirement that pet animation reflects system state within two seconds, if the answer arrives sooner? [Ambiguity, Spec §pet vs §pet "Pet animation reflects system state"]

## Physical Resource & Topology Quality

- [ ] CHK051 Are the storage location, replication and retention of the routing table, price book and usage records each attributed to an owning store rather than left implied? [Resource, Model §Physical Resource & Artifact Topology]
- [ ] CHK052 Is the volume of usage records bounded by a stated figure rather than by an assumption that jobs are infrequent? [Resource, Model §Physical Resource, Verification §Thresholds]
- [ ] CHK053 Does the state-to-artifact matrix account for every state in the assignment lifecycle, including the three unusable states? [Topology, Model §Lifecycle vs §State-to-Artifact Mapping Matrix]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK054 Is the fallback hierarchy explicit that no tier substitutes a model, and is that consistent with defaults being proposed automatically at first configuration? [Fallback, Design §Extensibility, Spec §agent]
- [ ] CHK055 Does the routing table descriptor make an unassigned role representable rather than inferable from absence, and is the reason stated where an implementer would read it? [Extensibility, Contract role-routing §Manifest, Model §INV-AG-24]
- [ ] CHK056 Is the reserved slot for remotely updatable defaults documented with a phase, a rationale and an activation condition, as the constitution requires? [Extensibility, Model §Variability]
- [ ] CHK057 Do the three contracts agree on the mixed-version rule, given that the routing table is refused whole while a usage record is read field by field, and is the asymmetry justified where a reader meets it? [Protocol, Contract role-routing §Compatibility vs Contract usage-accounting §Compatibility]
- [ ] CHK058 Is every channel that deliberately does not exist listed in each contract, so that a later change adding one has to argue against a written statement rather than a silence? [Protocol, Contracts §Wire]

## Notes

Fifty-eight items across eleven groups. Fifty-two carry a traceability marker to a specific requirement,
contract section or model section; six are marked `Gap` because the question is precisely whether a requirement
is missing.

The items most likely to change the change, rather than to polish it, are CHK001 (the six-second gap this
change leaves to an open question), CHK010 (whether the persona content rule is decidable or merely
well-intentioned), CHK023 and CHK054 (whether "never substitute" and "propose defaults" are genuinely the same
rule seen twice), and CHK049 (whether refusing to multiply tokens by a price the user did not enter will read as
care or as an omission).

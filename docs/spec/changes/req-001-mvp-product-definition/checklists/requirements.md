# Requirements Quality Checklist: req-001-mvp-product-definition

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Are requirements present for every capability this change claims in its proposal, and is the absence of a `sync` delta spec recorded as a deliberate hand-off rather than an omission? [Completeness, Gap]
- [ ] CHK002 Are the four locked architectural decisions each traceable to at least one requirement, so that none of them survives only as narrative? [Completeness, Spec §agent, §approval, §ledger, §undo]
- [ ] CHK003 Are requirements stated for what happens when no connector is connected at all — the product's true zero-data state? [Completeness, Gap]
- [ ] CHK004 Are the pet persona and its visual style recorded as blocking open questions rather than left as unstated requirements that later work will silently invent? [Completeness, Spec §pet "All pet-visible text originates from the pet-agent", Gap]
- [ ] CHK005 Are the success metrics of the product definition either carried into requirements or explicitly declared out of scope for this change? [Completeness, Gap]
- [ ] CHK006 Are requirements defined for the transition between an unconfigured product and a working one, covering every step of onboarding that can fail? [Completeness, Spec §app "Onboarding ends with one successful job"]

## Requirement Clarity

- [ ] CHK007 Is "key information missing" defined precisely enough that two readers would agree whether a given command lacks it? [Clarity, Spec §agent "A job is not created while key information is missing", Ambiguity]
- [ ] CHK008 Is the bulk-operation threshold that puts an operation into the static approval tier stated as a number and a configuration point, rather than as "bulk"? [Clarity, Spec §approval "smart evaluates in two tiers", Ambiguity]
- [ ] CHK009 Is "the object threshold" for bulk evaluation tied to a named manifest parameter so it does not require connector-specific interpretation? [Clarity, Spec §connector "A connector is defined by a manifest"]
- [ ] CHK010 Are the thresholds the source itself marks as proposed — 500 ms to focus, 2 s to change animation, 30 s median job, 30 fps under load, 90-day retention, 10-minute job limit, 30-minute waiting period — each labelled with their proposed status so a later reader does not treat them as measured? [Clarity, Spec §pet, §job, §ledger, §approval]
- [ ] CHK011 Is "safely pause" defined as an observable state rather than a description of intent? [Clarity, Spec §approval "An unanswered approval pauses the job safely", Ambiguity]
- [ ] CHK012 Is it clear which language the pet answers in when the interface language and the conversation language differ? [Clarity, Spec §uix "Every interface string passes through the localisation layer"]

## Requirement Consistency

- [ ] CHK013 Do the ask requirements in `agent` and the ASK card requirements in `uix` describe the same limits — one open question per job, at most four options, free text on by default — without either being the sole source? [Consistency, Spec §agent "The ask tool takes a single question" vs §uix "ASK card presents one question"]
- [ ] CHK014 Do the four approval decision levels appear identically in `approval` and in `uix`, including the extra confirmation for the permanent allowlist? [Consistency, Spec §approval "Approval offers four decision levels" vs §uix "APPROVAL card offers all four decision levels"]
- [ ] CHK015 Is the ledger's record of a human decision consistent with the approval requirement that every decision is recorded, with one of the two named as the owner? [Consistency, Spec §ledger "Human decisions are ledger records" vs §approval]
- [ ] CHK016 Does the backend requirement set avoid reasserting the withdrawn "server holds no work content" invariant anywhere, including in scenarios? [Consistency, Spec §backend "The backend never executes job logic", Conflict]
- [ ] CHK017 Are the connector disconnect requirements consistent with account-scoped authorisation, given that disconnecting on one device is described here as a device-local erasure? [Consistency, Spec §connector "Disconnecting revokes and erases the authorisation", Conflict]
- [ ] CHK018 Do the retention requirements for attachments in `agent` and in `ledger` describe one policy rather than two? [Consistency, Spec §agent "Attached screenshots are discarded" vs §ledger "Retention is bounded"]

## Acceptance Criteria Quality

- [ ] CHK019 Can "the pet displays the working animation" be observed objectively, or does it require a judgement about which animation is playing? [Measurability, Spec §pet "Pet animation reflects system state"]
- [ ] CHK020 Is "no fabricated persona text is shown" stated so that a reviewer can tell whether the requirement was met? [Measurability, Spec §pet "All pet-visible text originates from the pet-agent", Ambiguity]
- [ ] CHK021 Is the claim that "no unwrapped tool can be registered" expressed as a property that can be checked against the registry rather than as a behaviour of each tool? [Measurability, Spec §agent "Every worker tool is wrapped"]
- [ ] CHK022 Is "the memory footprint has not grown monotonically" measurable without agreeing a sampling method first? [Measurability, Spec §pet "Pet runs continuously without degradation", Ambiguity]
- [ ] CHK023 Are the availability and load figures for the backend accompanied by the measurement window and the load profile that make them checkable? [Measurability, Spec §backend "The backend meets its availability and load expectations"]
- [ ] CHK024 Does each requirement state exactly one behaviour, with no requirement joining two obligations that could be met separately? [Measurability, Spec §all]

## Scenario Coverage

- [ ] CHK025 Does every requirement carry at least one scenario, and does every scenario name a case rather than restate the requirement? [Coverage, Spec §all]
- [ ] CHK026 Are alternate-path scenarios present where a requirement has a legitimate second route — a decision taken in the application window instead of the dialog surface, an answer typed instead of chosen? [Coverage, Spec §uix, §approval]
- [ ] CHK027 Are exception scenarios present for every external dependency that can refuse — the platform, the model provider, the secure store, the backend? [Coverage, Spec §connector, §agent, §platform, §backend]
- [ ] CHK028 Are recovery scenarios present for the crash cases the product promises to survive, including an intent record with no result record? [Coverage, Spec §job "No job is lost across a crash", §uix "Card queue is rebuilt after a restart"]
- [ ] CHK029 Are non-functional scenarios present rather than non-functional statements alone, so that performance and reliability claims are testable? [Coverage, Spec §pet, §job, §backend]
- [ ] CHK030 Is there a scenario for the zero-data state of each user-facing surface — the empty job list, the empty connector catalogue, the empty ledger? [Coverage, Gap]

## Edge Case Coverage

- [ ] CHK031 Is behaviour specified when the same approval is decided from two surfaces at the same moment? [Edge Case, Spec §uix "Approve and deny are equivalent on both surfaces"]
- [ ] CHK032 Is behaviour specified when a job is cancelled while its ASK or APPROVAL card is open? [Edge Case, Spec §uix "Card queue is rebuilt after a restart"]
- [ ] CHK033 Is behaviour specified when the display holding the pet is detached, and when the saved position lies outside the current display arrangement? [Edge Case, Spec §pet]
- [ ] CHK034 Is behaviour specified when an object targeted by an undo has been deleted at the platform rather than merely changed? [Edge Case, Spec §undo "Current state is reconciled against the snapshot"]
- [ ] CHK035 Is behaviour specified when a write's prior state cannot be read, covering both the connector's classification and the approval consequence? [Edge Case, Spec §connector "Every Notion write is preceded by a recorded snapshot"]
- [ ] CHK036 Are the concurrency cases between simultaneous jobs touching the same object covered, or deliberately deferred to the change that measures them? [Edge Case, Gap]
- [ ] CHK037 Is behaviour specified when several cards arrive at once, so that the anti-flooding rule is a requirement rather than a design note? [Edge Case, Spec §uix "Card queue follows a fixed priority order"]

## Non-Functional Requirements

- [ ] CHK038 Are security requirements stated for every place a credential could exist, including the negative case that no plain-text fallback is acceptable? [Non-Functional, Spec §platform "Credentials are held in operating-system secure storage"]
- [ ] CHK039 Are privacy requirements stated for what leaves the device — to the model provider, to the platforms, and to the backend — with the account-owned consequence visible? [Non-Functional, Spec §agent "Only job-relevant content is sent to the model provider", §backend]
- [ ] CHK040 Are accessibility requirements defined for the dialog surface and the application window, or is their absence recorded as a deliberate scope decision? [Non-Functional, Gap]
- [ ] CHK041 Are observability requirements defined for the device side, given that product telemetry was deferred and only the backend has logging requirements? [Non-Functional, Gap]
- [ ] CHK042 Are the operating-system version floors stated with the consequence of running below them? [Non-Functional, Spec §platform "The product behaves consistently on both supported operating systems"]

## Dependencies & Assumptions

- [ ] CHK043 Is the assumption that the user supplies and pays for their own model provider recorded, together with what the product does when they have not configured one? [Assumption, Spec §agent "Model provider and role routing are configured on the client"]
- [ ] CHK044 Is the dependency on platform authorisation review — and the bring-your-own client route that exists because of it — recorded as a dependency rather than a feature choice? [Assumption, Spec §connector "Bring-your-own authorisation client is a first-class connect route"]
- [ ] CHK045 Is the assumption recorded that the sections of the source document marked as proposed are unratified, and is that assumption applied consistently across every capability? [Assumption, Spec §all]
- [ ] CHK046 Is the dependency of this baseline on twenty spikes that measured a device-bound product recorded where it affects requirements, rather than only in the risk ledger? [Assumption, Gap]
- [ ] CHK047 Are the requirements that this change knowingly hands to a later change — replication, conflict resolution, device revocation — named, so that a reader can tell an omission from a hand-off? [Assumption, Spec §backend, §connector]

## Ambiguities & Conflicts

- [ ] CHK048 Is the open question about whether irreversible operations require approval by default resolved, or does a requirement still carry a clarification marker into review? [Ambiguity, Spec §approval "Irreversible operations require approval in smart and on"]
- [ ] CHK049 Do the three identifier collisions inherited from the source documents affect any requirement's meaning, and is the reader warned where they do? [Conflict, Gap]
- [ ] CHK050 Does "waiting period" mean the same duration for an unanswered approval and an unanswered question, and is that shared configuration stated rather than implied? [Ambiguity, Spec §approval vs §agent]
- [ ] CHK051 Is the boundary between an ask and an approval stated sharply enough that an agent cannot use one where the other applies? [Ambiguity, Spec §agent "Asking cannot obtain what the gate refused"]

## Physical Resource & Topology Quality

- [ ] CHK052 Are the storage location, the serialization form and the quantified resource budget of the local store stated, with measured figures distinguished from proposed ones? [Resource, Topology §Physical Format & Storage]
- [ ] CHK053 Is the eviction policy stated for every stored artifact — ledger records, attachments, agent transcripts, credentials — including the deliberate refusal to evict under capacity pressure? [Resource, Topology §Lifecycle & Eviction]
- [ ] CHK054 Does the state-to-artifact mapping account for every durable state a requirement refers to, with no state whose artifact is unnamed? [Resource, Topology §State-to-Artifact Mapping Matrix]
- [ ] CHK055 Are the per-command attachment limits expressed both as requirements and as a resource budget, without the two disagreeing? [Resource, Spec §uix "Composer accepts text and images with declared limits"]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK056 Does every `open` variability point in the model have a contract, and is each contract's owning change named so that freezing it has an owner? [Extensibility, Model §Variability]
- [ ] CHK057 Is the behaviour on a missing or malformed connector manifest specified as a whole-manifest refusal, with the reason it is not a per-tool refusal? [Fallback, Model §Fallback on Missing Manifest]
- [ ] CHK058 Does the fallback hierarchy name a defined outcome for each failing dependency — backend, risk judge, evaluator, secure store, ledger — and is each one fail-closed rather than fail-open? [Fallback, Design §Multi-Level Fallback Hierarchy]
- [ ] CHK059 Are the communication channels between execution boundaries each given a payload shape, an error handling rule and a timeout expectation? [Extensibility, Design §Communication Channels & Protocols]
- [ ] CHK060 Does each contract carry an error matrix, a compatibility rule stating what constitutes a major change, and a rejected example that explains why it is rejected? [Extensibility, Contracts §all]
- [ ] CHK061 Are the reserved slots each accompanied by their phase, their rationale and the condition that activates them, as the constitution requires? [Extensibility, Model §Variability]

## Traceability

- [ ] CHK062 Are identifier conventions established for requirements and acceptance criteria, given that this project declares no upstream anchor and requirement titles are descriptive rather than numbered? [Traceability, Gap]
- [ ] CHK063 Does every requirement cite the source section it derives from, and does every citation resolve to a section that exists in the source document? [Traceability, Spec §all]
- [ ] CHK064 Is every assertion labelled VERIFIED or UNVERIFIED in a way that matches what its source actually claims, with no label raised by inference? [Traceability, Spec §all]

## Rollback

- [ ] CHK065 Is the rollback position for this change stated, given that it defines persistent storage and publishes contracts but creates no data? [Rollback, Design §Migration & Rollback]
- [ ] CHK066 Is there a requirement covering the reversal of the user's own destructive action — deleting ledger data, deleting the account — including what cannot be reversed afterwards? [Rollback, Spec §ledger "Retention is bounded", §app "The user can delete their account"]

## Notes

This checklist was generated in a non-interactive run, so the skill's defaults apply: standard rigor, written
for the reviewer who will approve the change at W4, and focused on the two strongest signal clusters in the
material — the trust chain (the gate, the ledger obligation, declared irreversibility and undo) and the
account-owned data shift, whose requirements rest on no measurement.

Two dimensions are represented beyond the nine because the material calls for them: Traceability, because the
project declares no upstream anchor and therefore has no requirement identifiers to trace against, and
Rollback, because this change defines persistent storage.

Items carrying `[Gap]` are questions about what is absent, not assertions that something is missing. Three
deserve attention before approval: CHK040 and CHK041 ask whether accessibility and device-side observability
were deliberately excluded or merely not written; CHK046 asks whether the dependency on spikes of a
device-bound product is visible where it affects requirements rather than only in the risk ledger; and CHK048
tracks the one clarification marker left inside a requirement, which belongs to open question OQ-2 and needs
the product owner.

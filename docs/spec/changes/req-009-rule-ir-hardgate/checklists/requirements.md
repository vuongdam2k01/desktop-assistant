# Requirements Quality Checklist: req-009-rule-ir-hardgate

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is the complete set of things a rule may look at stated as a closed list, such that a reader can tell whether a given user intention is expressible? [Completeness, Spec §Every verdict is decided by a closed expression outside any model]
- [ ] CHK002 Is it specified what happens to a rule the user confirmed before a connector it names was disconnected — does the rule remain stored, and is the user told it now protects nothing? [Completeness, Gap]
- [ ] CHK003 Is the behaviour on an approval request that the user answers after the waiting period expired specified separately from the behaviour during the period? [Completeness, Spec §An unanswered approval pauses the job safely (living spec) vs §Approval offers four decision levels]
- [ ] CHK004 Are the four decision levels each stated with what they bind to and when they end, rather than only being named? [Completeness, Spec §Approval offers four decision levels]
- [ ] CHK005 Is it stated what the user sees, and what the job does, when the gate has halted writes account-wide on this device? [Completeness, Spec §Evaluation fails closed]
- [ ] CHK006 Does any requirement state who may create, edit or delete a hardline rule, or is that left to be inferred from the model's invariants? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK007 Is "the strictest verdict" defined by an explicit ordering of the three verdicts rather than by the word "strictest" alone? [Clarity, Spec §The strictest matching verdict wins]
- [ ] CHK008 Is "normalisation" of a field name defined by what it disregards, so that two implementers would normalise the same pair of names identically? [Clarity, Spec §Field names and nested values are normalised before comparison]
- [ ] CHK009 Is "the calendar day" pinned to a specific time zone in the requirement text, rather than left to the device? [Clarity, Spec §Accumulated counts are read from the account's ledger]
- [ ] CHK010 Is "the object's scope", to which a job-scoped approval binds, defined precisely enough to decide whether two calls share it? [Clarity, Spec §Approval offers four decision levels]
- [ ] CHK011 Does the requirement about disclosure state precisely what is attached to a question — operation, object, rule — rather than "the refusal"? [Clarity, Spec §A refusal is disclosed in every later question of the same job]

## Requirement Consistency

- [ ] CHK012 Does the modified statement that mode `off` keeps the user's refusals contradict any surviving sentence in the living `approval` spec that describes `off` as removing user rules? [Consistency, Spec §Approval mode `off` removes waiting but not recording vs living spec §Approval mode `smart` evaluates in two tiers]
- [ ] CHK013 Is the claim that a permanent allowlist entry never overrides a stopping rule consistent with the living requirement that the allowlist is the third decision level offered on an approval request — can a user be offered a level that will then be refused? [Consistency, Spec §Approval offers four decision levels vs §The strictest matching verdict wins]
- [ ] CHK014 Do the `approval` and `agent` deltas describe the same disclosure behaviour, or does one of them imply the gate reads the question's content? [Consistency, Spec §A refusal is disclosed in every later question of the same job vs agent §An answer to a question carries the refusal that preceded it]
- [ ] CHK015 Is the requirement that evaluation consults no model consistent with `smart` mode's second tier, which is a model-based judge? [Consistency, Spec §Every verdict is decided by a closed expression outside any model vs living spec §Approval mode `smart` evaluates in two tiers]
- [ ] CHK016 Do the specs and `model.md` agree on whether a refused hardline operation produces a ledger record, an approval request, both, or neither? [Consistency, Spec §A hardline refusal is never offered for approval vs Model §Entities]

## Acceptance Criteria Quality

- [ ] CHK017 Can "the same call evaluated against the same stored state always returns the same verdict" be tested without access to internal state, or does it need a hook the specs do not require? [Measurability, Spec §Every verdict is decided by a closed expression outside any model]
- [ ] CHK018 Is "the gate still returns a verdict when no model provider can be reached" stated so that a test can produce the condition? [Measurability, Spec §Every verdict is decided by a closed expression outside any model]
- [ ] CHK019 Does any requirement state a latency bound, or is performance deferred entirely to `verification.md` — and is that deferral deliberate and recorded? [Measurability, Gap]
- [ ] CHK020 Is "the count is corrected once replication completes" observable, and does the requirement say what the user or a test can see at the moment of correction? [Measurability, Spec §Accumulated counts are read from the account's ledger]

## Scenario Coverage

- [ ] CHK021 Is there a scenario for the primary path in which no rule matches and the operation simply proceeds? [Coverage, Gap]
- [ ] CHK022 Is there a scenario covering a rule that matches with verdict allow while the mode is `on` — does the blanket gate of mode `on` or the user's allow rule prevail? [Coverage, Gap]
- [ ] CHK023 Is there a recovery scenario for the gate returning from halted to ready after the catalogue is repaired? [Coverage, Gap]
- [ ] CHK024 Is there a scenario in which the job ends while an approval request is still open? [Coverage, Gap]
- [ ] CHK025 Is there a scenario for a rule confirmed on one device taking effect on another? [Coverage, Gap]
- [ ] CHK026 Are the measured adversarial cases represented by at least one scenario each for the four distinct evasion mechanisms — fragmentation, equivalent-tool substitution, ownership laundering, and grant widening? [Coverage, Spec §A rule constrains an individual field / §Rules address a target by connector-declared type and immutable identifier / §Approval offers four decision levels]

## Edge Case Coverage

- [ ] CHK027 Is the case of a rule whose condition can never be satisfied — for example naming a tool no manifest declares — addressed as a requirement rather than only in the contract's error matrix? [Edge Case, Gap]
- [ ] CHK028 Is the case of two rules matching with the same verdict specified, so that the user sees both reasons rather than an arbitrary one? [Edge Case, Spec §The strictest matching verdict wins]
- [ ] CHK029 Is a zero-rule catalogue distinguished in the requirements from an unreadable one? [Edge Case, Spec §Evaluation fails closed]
- [ ] CHK030 Is the case of a count whose boundary is a calendar day that changes mid-job specified? [Edge Case, Gap]
- [ ] CHK031 Is the case of an object whose ancestry cannot be read from the connector specified, given that ancestry is what several rules anchor to? [Edge Case, Gap]
- [ ] CHK032 Is concurrent evaluation of two calls in the same job against the same count specified, so that two calls cannot each see itself as the fifth? [Edge Case, Gap]

## Non-Functional Requirements

- [ ] CHK033 Is the latency ceiling for a whole evaluation stated with the read it now includes, rather than inherited from a measurement that excluded it? [Non-Functional, Design §R1]
- [ ] CHK034 Is the cost of obtaining object metadata bounded by a requirement, or only discussed as a risk? [Non-Functional, Design §R2]
- [ ] CHK035 Is the resident size of the rule catalogue given an expected order of magnitude, and is the expectation labelled as unmeasured? [Non-Functional, Model §Physical Resource Budget]
- [ ] CHK036 Are the security properties stated as requirements that can fail a test — rather than as descriptions of the architecture? [Non-Functional, Spec §The hook decides, not the prompt]

## Dependencies & Assumptions

- [ ] CHK037 Is the dependency on the connector manifest declaring irreversibility and permission effects stated as a requirement on this change, or only assumed of `req-019-connector-framework`? [Assumption, Model §Manifest Schema]
- [ ] CHK038 Is the assumption that the evaluator runs where no renderer can reach it recorded as a decision with evidence, or only as an assumption? [Assumption, Clarifications §Assumptions]
- [ ] CHK039 Is the dependency on the ledger maintaining counts stated in terms the `ledger` capability can accept as a requirement on itself? [Assumption, Design §D2]
- [ ] CHK040 Is the assumption that the frozen adversarial corpus remains the regression gate paired with a statement of who re-runs it and when? [Assumption, Proposal §Assumptions]
- [ ] CHK041 Is the version alignment with `req-004-rule-elicitation` stated concretely enough to detect a divergence? [Assumption, Proposal §Impact]

## Ambiguities & Conflicts

- [ ] CHK042 Does "a rule the user wrote whose verdict is refuse" leave ambiguous whether the elicitation conversation can even produce a refuse verdict, or only a hold? [Ambiguity, Spec §Approval mode `off` removes waiting but not recording]
- [ ] CHK043 Is it unambiguous whether the static patterns of the smart tier count as "rules the user wrote" for the purposes of mode `off`? [Ambiguity, Spec §Approval mode `off` removes waiting but not recording]
- [ ] CHK044 Does the open question OQ-2 about irreversible operations requiring approval by default conflict with any requirement here that assumes the irreversibility predicate has a default behaviour? [Conflict, Clarifications §Open Q-2]
- [ ] CHK045 Is "the product does not judge what the question means" — the reason a refusal is attached to unrelated questions too — stated as a deliberate property rather than reading as an oversight? [Ambiguity, Spec §A refusal is disclosed in every later question of the same job]

## Physical Resource & Topology Quality

- [ ] CHK046 Are the storage location, serialised form and validation obligation of the rule catalogue each stated, and is it clear that hardline rules are not in that store? [Resource, Model §Physical Format & Storage]
- [ ] CHK047 Is the quantified budget for evaluation separated from the unquantified expectation of catalogue size, and is the unmeasured one labelled as such? [Resource, Model §Physical Resource Budget]
- [ ] CHK048 Does the state-to-artifact mapping account for every state the lifecycle diagrams introduce, including the superseded and withdrawn states of a rule? [Topology, Model §State-to-Artifact Mapping Matrix]
- [ ] CHK049 Is the lifetime of each transient artifact — scoped approval, refusal notice, cached object metadata — stated together with what releases it? [Resource, Model §Lifecycle & Eviction]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK050 Is the fallback hierarchy deterministic — can a reader predict, for each failure, whether it holds one call, halts writes, or enters read-only mode? [Fallback, Design §Multi-Level Fallback Hierarchy]
- [ ] CHK051 Does every tier of the fallback hierarchy end in a state that refuses execution rather than one that permits it? [Fallback, Design §Multi-Level Fallback Hierarchy]
- [ ] CHK052 Are the channels that deliberately do not exist stated as a contract property rather than as an implementation note, so that adding one is a versioned change? [Extensibility, Contract gate-evaluation §Wire / Communication Protocol]
- [ ] CHK053 Is the manifest dependency specified as required fields with the consequence of each being absent, rather than as a general expectation? [Extensibility, Model §Manifest Schema]
- [ ] CHK054 Does the compatibility policy state what happens in both directions — an older catalogue on a newer build, and a newer catalogue on an older build — and is the asymmetry between them justified? [Extensibility, Contract rule-representation §Compatibility]
- [ ] CHK055 Is the error matrix complete with respect to the error codes the interface declares, with no code appearing in one and not the other? [Protocol, Contract gate-evaluation §Error Matrix]

## Notes

Three items warrant the reviewer's attention ahead of the others, because they are where this change departs from
what was measured rather than where it merely restates it:

- CHK033 and CHK034 concern the two latency questions the spike did not answer. The measured 0.48 ms p99 covered
  predicate evaluation with counts in memory and object metadata from a mock store. Both of those are now real
  reads. `design.md` §R1 and §R2 say so plainly; the question for the reviewer is whether the requirements bind
  anyone to measure them before implementation proceeds.
- CHK012, CHK013 and CHK043 concern the mode `off` decision taken on 2026-09-12. It is the one place where this
  change makes the product stricter than the evidence, and strictness that is only half-specified is how a
  contradiction gets shipped.
- CHK045 concerns the deliberate bluntness of the disclosure rule. Attaching a refusal to questions that have
  nothing to do with it is the price of never judging free text; if that reads as an oversight to a reviewer, it
  will read as a bug to an implementer.

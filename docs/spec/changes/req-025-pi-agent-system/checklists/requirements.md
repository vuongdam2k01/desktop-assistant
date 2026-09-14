# Requirements Quality Checklist: req-025-pi-agent-system

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-13

## Requirement Completeness

- [ ] CHK001 Is there a requirement stating what happens to a *running* job when the role entry it runs under is edited or removed mid-run, as distinct from the tool allowlist being frozen? [Completeness, Gap, Spec §agent "A role's tool allowlist is the whole of what its agent can hold"]
- [ ] CHK002 Do the requirements state who may author an account-scoped role entry — the user in settings only — or does that appear solely in the contract's list of channels that do not exist? [Completeness, Gap]
- [ ] CHK003 Is there a requirement covering the first-run state where a routing table exists from `req-017-provider-matrix` but no registry does, which is the state every existing device will be in? [Completeness, Spec §agent MODIFIED "Every model request resolves through the routing table", Design §Migration 1]
- [ ] CHK004 Does any requirement state what the user is told when a role entry is valid but the tier it names has never been assigned, as opposed to the tier being unassignable? [Completeness, Spec §agent "A role reaches a model only through the routing tier it names"]
- [ ] CHK005 Is the retention and deletion of the recorded context account — budget, reductions, skills loaded — stated in a requirement, or only implied by the job record it rides on? [Completeness, Gap]
- [ ] CHK006 Do the requirements cover a skill whose body is valid but whose applicability text matches every job, which is the degenerate case that defeats load-on-demand entirely? [Completeness, Gap, Spec §agent "A skill enters a job's context only when that job needs it"]
- [ ] CHK007 Is there a requirement stating what happens when a capability pack is removed while one of its contributed roles is named by a job that is queued but not yet running? [Completeness, Gap]
- [ ] CHK008 Does any requirement state how long a parent waits in `waiting_children` before its own time limit or some other bound applies, given that the waiting period is explicitly excluded from that limit? [Completeness, Gap, Spec §job "A parent waits for its children without holding a connector slot"]
- [ ] CHK009 Is there a requirement covering what the *user* sees while children run — one job or several — or is that deferred to `uix` without a requirement recording the deferral? [Completeness, Gap, Design §Open Questions]
- [ ] CHK010 Do the requirements state whether a redacted reference is shown to the user in the ledger view, and in what form, or only that the record carries it? [Completeness, Gap, Spec §agent "Secret material is replaced by a typed reference before it leaves the wrapper"]
- [ ] CHK011 Is there a requirement for the case where every declared context source is present but the assembled context is empty of work — a job whose command was blank? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK012 Is "the job's work matches it" decidable by a reviewer reading a skill's applicability text and a job's command, or does it name a judgement no one can check? [Clarity, Ambiguity, Spec §agent "A skill enters a job's context only when that job needs it"]
- [ ] CHK013 Does "derived from the declared context window" state the derivation precisely enough that two implementers would compute the same budget, given that the reserve is deliberately unpinned? [Clarity, Spec §agent "A job's context carries a declared budget derived from its assigned model"]
- [ ] CHK014 Is "approaches its budget" defined by an observable condition, or does it leave the trigger to implementation? [Clarity, Ambiguity, Spec §agent "Approaching the budget triggers a declared reduction ladder"]
- [ ] CHK015 Does "carries no information, such as empty searches" give a decidable test for what the second ladder step may remove? [Clarity, Spec §agent, same requirement]
- [ ] CHK016 Is "the older part of the transcript" bounded well enough that the fourth ladder step cannot summarise away a turn the protected set was meant to keep? [Clarity, Conflict risk, Spec §agent, same requirement]
- [ ] CHK017 Does "exceeds its declared budget" for an interception handler state whether the budget is wall-clock or active work, given that the distinction decides whether a handler awaiting I/O fails closed? [Clarity, Gap, Spec §agent "A failing interception point fails closed before a call and is dropped after one"]
- [ ] CHK018 Is "a value the boundary classifies as secret" clear about precedence when a tool's declaration and the conservative pattern default disagree? [Clarity, Spec §agent "Secret material is replaced by a typed reference before it leaves the wrapper"]
- [ ] CHK019 Does "nothing from which the value could be reconstructed" give a reviewer a decidable test, or does it require a cryptographic judgement the requirement does not scope? [Clarity, Measurability, Spec §agent, same requirement]
- [ ] CHK020 Is "the same per-account limit as every other job" unambiguous about whether the user-reserved slot may be taken by a child? [Clarity, Gap, Spec §job MODIFIED "Jobs run in parallel without shared context"]
- [ ] CHK021 Does "no work of its own" define `waiting_children` entry precisely enough to distinguish it from a parent that is merely idle between its own calls? [Clarity, Spec §job "A parent waits for its children without holding a connector slot"]

## Requirement Consistency

- [ ] CHK022 Are the six built-in roles named identically across the delta spec, the model's entity table, the registry contract and the revised routing contract, given that the identifier is what migration re-keys on? [Consistency, Spec §agent vs Model §Entities vs Contracts]
- [ ] CHK023 Is the protected set of context sections stated identically in the delta spec, `model.md` §Variability and `contracts/context-assembly`? [Consistency, Spec §agent vs Model §Variability]
- [ ] CHK024 Do the delegation bounds — depth 1, fan-out 4 — appear with the same values and the same unverified marking in `specs/job`, `model.md`, `design.md` R2 and `contracts/job-delegation`? [Consistency, Spec §job "Delegation depth and fan-out are bounded"]
- [ ] CHK025 Is the claim "children share the parent's per-account budget" consistent with the existing reserved-slot rule for user-started jobs, or do the two rules collide when a user-started parent delegates? [Consistency, Conflict, Spec §job MODIFIED "Jobs run in parallel without shared context"]
- [ ] CHK026 Does the requirement that a skill carries nothing executable stay consistent with capability packs, which carry both skills and tools in one unit? [Consistency, Spec §agent "A skill carries no executable content" vs "A capability pack contributes tools, roles and skills"]
- [ ] CHK027 Are the four exits the redaction boundary defends — model request, transcript, ledger record, replicated store — the same four everywhere they are enumerated? [Consistency, Spec §agent vs Model §INV-AG-42]
- [ ] CHK028 Is the treatment of a later-versioned document consistent across registry, catalogue, pack and routing table — refused whole in every case, never read around? [Consistency, Spec §agent "The role registry and the skill catalogue follow the account"]

## Acceptance Criteria Quality

- [ ] CHK029 Can "the two contexts are identical" be judged without access to internals, or does determinism need an observable surface the requirements do not provide? [Measurability, Spec §agent "A job's context is assembled deterministically from declared sources"]
- [ ] CHK030 Is "no agent commands another" expressed as something observable — the absence of an operation — rather than as an architectural intention? [Measurability, Spec §job "A child job is created through the Job Manager and never commanded"]
- [ ] CHK031 Can "the report grants nothing" be judged by a reviewer, given that the observable consequence is the absence of a behaviour change? [Measurability, Spec §job "A child's report reaches its parent as data"]
- [ ] CHK032 Are the four unverified targets in `verification.md` — correctness ≥ 90%, self-verification ≥ 95%, zero context-exhaustion failures, zero secret leakage — each paired with a corpus and a pass criterion specific enough to be run by someone who did not write them? [Measurability, Verification §Measurement Method]
- [ ] CHK033 Does "the instruction is reported to the user rather than followed" state an observable report, or leave open whether silence also satisfies it? [Measurability, Spec §agent "Content read from a page, a screen or an accessibility tree is data"]

## Scenario Coverage

- [ ] CHK034 Primary: is the ordinary path — a job loads one skill, stays within budget, completes — covered by a scenario anywhere, or do the requirements only describe deviations? [Coverage, Gap]
- [ ] CHK035 Alternate: is there a scenario for a job that delegates *and* is itself a child of nothing, versus one that delegates from a role that also does its own work? [Coverage, Spec §job "A parent waits for its children without holding a connector slot"]
- [ ] CHK036 Exception: are the failure paths of pack loading, skill validation, handler failure and budget exhaustion each covered by at least one scenario? [Coverage, Spec §agent]
- [ ] CHK037 Recovery: is there a scenario for recovery when the parent survived and a child did not, and for the inverse? [Coverage, Spec §job MODIFIED "No job is lost across a crash"]
- [ ] CHK038 Non-functional: is there a scenario judging that this change does not regress the measured 16.9-second median simple job? [Coverage, Gap, Verification §Thresholds]
- [ ] CHK039 Is the zero-data state covered — an empty skill catalogue, a registry holding only built-ins, a pack directory with no packs? [Coverage, Gap]
- [ ] CHK040 Is there a scenario for a capability that is inactive *and* named by a role's allowlist, which is the state both packs ship in? [Coverage, Spec §agent "An inactive capability is absent rather than present and refusing"]

## Edge Case Coverage

- [ ] CHK041 Is behaviour specified when two devices edit the same role entry offline and replicate afterwards? [Edge Case, Spec §agent "The role registry and the skill catalogue follow the account"]
- [ ] CHK042 Is behaviour specified when a skill is disabled while a job that loaded it is still running? [Edge Case, Gap]
- [ ] CHK043 Is behaviour specified when reduction runs while an approval is pending on a held call? [Edge Case, Gap, Conflict risk with the protected set]
- [ ] CHK044 Is behaviour specified when a child job requires an approval and the user never answers — does the parent wait indefinitely in `waiting_children`? [Edge Case, Gap, Spec §job]
- [ ] CHK045 Is behaviour specified when a parent reaches its time limit while children are still running? [Edge Case, Gap]
- [ ] CHK046 Is behaviour specified when a tool's declared secret field is absent from the arguments actually sent? [Edge Case, Gap]
- [ ] CHK047 Is behaviour specified when a handler transforms an argument into something the tool's schema refuses? [Edge Case, Gap, Spec §agent "The runtime declares its interception points and what each may change"]
- [ ] CHK048 Is behaviour specified when two capability packs contribute the same role identifier, as distinct from two packs contributing the same skill identifier? [Edge Case, Gap — precedence is specified for skills only]

## Non-Functional Requirements

- [ ] CHK049 Are the declared size ceilings — 256 KiB per skill, 16 KiB of instructions, 256 catalogue entries, 1 MiB per pack — each marked unverified wherever they appear, and is the consequence of exceeding one specified? [Non-Functional, Model §Physical Resource & Artifact Topology]
- [ ] CHK050 Is the cost of delegation to the user's own provider account — several concurrent sessions, each billing — stated anywhere in the requirements, or only in the design's risk list? [Non-Functional, Gap]
- [ ] CHK051 Are the requirements silent on observability of the new surfaces — how a user or a support process inspects why a skill loaded or a reduction ran — and is that silence intentional? [Non-Functional, Gap]
- [ ] CHK052 Is there a non-functional requirement bounding the time spent assembling and reducing context, given that it happens between every turn? [Non-Functional, Gap]

## Dependencies & Assumptions

- [ ] CHK053 Is the assumption that OMP serves only as a reference architecture, never a dependency, recorded as a requirement rather than as prose — and does the harness-pin requirement now carry it? [Assumption, Spec §agent MODIFIED "The agent harness is pinned to one package identity and one version"]
- [ ] CHK054 Is the assumption that packs are first-party recorded with its consequence — that no provenance or integrity model exists — and with the reserved slot that would activate if it changes? [Assumption, Model §Variability, Clarifications Q-3]
- [ ] CHK055 Is the assumption that "isolated context" means a separate harness session rather than filesystem isolation recorded where a reader of the delegation contract would find it? [Assumption, Clarifications §Assumptions 5]
- [ ] CHK056 Is the dependency on `approval` answering Q-5 — whether accumulated counts span a parent and its children — recorded as blocking something specific, or only as an open question? [Assumption, Clarifications §Open Q-5]
- [ ] CHK057 Is the dependency on `ledger` answering Q-6 — whether a typed reference satisfies "the full account of one step" — recorded with the consequence of a "no" answer? [Assumption, Clarifications §Open Q-6]

## Ambiguities & Conflicts

- [ ] CHK058 Does the constitution's *External Content Is Data* section, which enumerates two sources, conflict with requirements that add a third and fourth — and is the follow-on amendment recorded as blocking pack activation rather than as a note? [Conflict, Design §Complexity Tracking]
- [ ] CHK059 Does "a child is an ordinary job" conflict with "a child may not delegate", given that an ordinary job created by the pet-agent may be run by a role that delegates? [Conflict, Spec §job "Delegation depth and fan-out are bounded"]
- [ ] CHK060 Is there a conflict between the requirement that a job's context contains nothing from another job and the requirement that a parent reads its children's results? [Ambiguity, Spec §job MODIFIED "Jobs run in parallel without shared context" vs "A child's failure is a result, not the parent's failure"]
- [ ] CHK061 Does the prohibition on skills carrying executables conflict with a capability pack's skills, which sit in a directory beside the pack's tool declarations? [Ambiguity, Spec §agent]
- [ ] CHK062 Is "the product states that a provider must be configured" (existing) consistent with the new "the product names the tier that needs an assignment", or do two different messages now describe one situation? [Ambiguity, Spec §agent vs `docs/spec/capabilities/agent/spec.md`]

## Physical Resource & Topology Quality

- [ ] CHK063 Are the storage locations of the registry, the catalogue state and the activation state stated precisely enough to know which file they share with the ledger relations, and who owns that file's shape version? [Resource, Model §Physical Resource & Artifact Topology]
- [ ] CHK064 Is the claim that an assembled context is never persisted stated as a requirement, or only as a topology note — given that persisting one would be the simplest way to make reduction debuggable? [Resource, Gap, Model §Physical Resource]
- [ ] CHK065 Are the resource budgets accompanied by the behaviour that occurs at the limit, rather than only by the number? [Resource, Model §Physical Resource]
- [ ] CHK066 Is the eviction rule — a skill body released when its job reaches a terminal state — consistent with the existing rule for attached images? [Resource, Consistency, Spec §agent existing "Attached screenshots are discarded when the job ends"]
- [ ] CHK067 Does the State-to-Artifact matrix cover every state the two new lifecycles introduce, including a pack that is `invalid` rather than `inactive`? [Resource, Model §State-to-Artifact Mapping Matrix]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK068 Is the three-tier fallback hierarchy complete for every new extension point — role entry, skill, pack, handler — and does each tier name what the user is told? [Extensibility, Design §Multi-Level Fallback Hierarchy]
- [ ] CHK069 Is the decision to refuse a later-versioned document *whole* rather than degrade gracefully justified in a place a reviewer will find it, given that it is the least forgiving option? [Fallback, Design §Tier 3]
- [ ] CHK070 Are the manifest schemas of the three descriptor kinds standardised on one shape — schemaVersion, id, name, version — so that a reader of one can predict the others? [Extensibility, Model §Manifest Schema]
- [ ] CHK071 Is the absence of hot reload for handler registrations stated with its consequence — that a pack activated mid-session does not register until the next start? [Extensibility, Design §Pluggable Lifecycle & Registration]
- [ ] CHK072 Does every `open` variability point in `model.md` have exactly one contract, and does every contract in `contracts/` correspond to a declared variability point or a revision named in `impact.md`? [Extensibility, Model §Variability vs Contracts]
- [ ] CHK073 Is the reserved slot for pack provenance accompanied by its phase, rationale and activation condition, as the constitution's *Reserved By Design* section requires? [Extensibility, Model §Variability, Constitution §Reserved By Design]

## Rollback & Migration Quality

- [ ] CHK074 Does the migration from six closed role names to six tiers state what happens to a table that is missing a role entirely, as opposed to one whose role is unassigned? [Rollback, Design §Migration 1]
- [ ] CHK075 Is the rollback behaviour — an older assembly refusing a newer store — stated as an observable requirement, or only in the design? [Rollback, Gap, Design §Rollback]
- [ ] CHK076 Is there a statement of what is lost when a capability pack is deactivated after jobs have used it — whether their records remain readable? [Rollback, Gap]
- [ ] CHK077 Does the assertion that stored transcripts are never rewritten survive the role-identifier change, and is the translation-on-read rule stated where a consumer of `agent-session` would find it? [Rollback, Design §Migration 2]

## Notes

Generated non-interactively at the decision-maker's instruction to run the chain without interruption, so the
review-intent questions of step 1 were not asked. Defaults applied and recorded here: **standard rigor**
(pre-approval gate rather than release gate), **reviewer audience** = the `agent` and `job` spec owners plus
the decision-maker, and emphasis on the two strongest signal clusters in this change — the constitutional
surfaces (principles I and II, and the *External Content Is Data* invariant) and the unmeasured surfaces
(context budget, delegation, redaction, browser and desktop).

Item count: 77 across twelve sections. Traceability: 71 of 77 items carry a `Spec §`, `Model §`, `Design §`,
`Verification §`, `Clarifications §` or explicit `Gap` / `Ambiguity` / `Conflict` / `Assumption` marker
(92%). Scenario layers covered by items: Primary (CHK034), Alternate (CHK035), Exception (CHK036), Recovery
(CHK037), Non-functional (CHK038, CHK049–CHK052). A rollback section is present because this change touches
persistent data and carries two MAJOR contract bumps.

Several items are deliberately questions the requirements *cannot* answer yet — CHK056, CHK057 and CHK058 name
the two capability-owner decisions and the constitutional amendment that `clarifications.md` records as open.
They are checklist items rather than silent assumptions precisely so that a reviewer meets them.

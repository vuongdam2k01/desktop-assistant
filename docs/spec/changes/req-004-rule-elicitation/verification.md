# Verification: req-004-rule-elicitation

A document-level acceptance plan. The scenarios in the delta specs are the acceptance cases; this file records
what a scenario cannot express — the observable conditions that judge the change as a whole, the numbers and
where they come from, how each number would be measured, the combinations that must be exercised rather than
reasoned about, and the scope that is re-judged rather than only the delta.

One boundary governs everything below. Every figure here was measured in `spikes/SP-2-rule-elicitation/REPORT.md`
against a frozen twenty-item corpus driven by a language model playing a busy user, under the elicitation prompt
as it stood before this change hardened it and under a session allowance of six turns rather than the four this
change fixes. The figures are therefore VERIFIED for that population and say nothing yet about a real user, a
hardened prompt or an enforced ceiling. Each of those three is carried as an open gap rather than assumed away.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | A rule the user states in everyday language about deleting or removing something is confirmed with a tool scope that names both the page-archival and the block-deletion operation, and never one of the two alone | `specs/approval/spec.md` — Elicited deletion rules expand to both page archival and block deletion; Scenario: User requests rule preventing task deletion | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q2 (Case R-01), §4 item 2; INV-AP-18 |
| AC-2 | An attempt to destroy the content blocks of a protected object is intercepted by the same rule that protects the object, so leaving the page wrapper intact does not step around the rule | `specs/approval/spec.md` — Scenario: Elicited deletion rule prevents block deletion | `spikes/SP-2-rule-elicitation/REPORT.md` §4 item 2; INV-AP-18 |
| AC-3 | A rule protecting a page or a database reaches everything nested inside it: a change to a descendant is held by the parent's rule, and the confirmed restatement says so rather than leaving the user to assume it | `specs/approval/spec.md` — Elicited container protection inherits across descendant hierarchy; Scenarios: Rule protecting a root project page, Child page modification is intercepted by parent rule | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q2 (Case R-10), §4 item 3; INV-AP-19 |
| AC-4 | No elicitation session produces a fifth turn. A session still ambiguous at turn three ends with the safest fail-closed restatement on the table for the user to confirm, never by continuing to ask and never by falling silent | `specs/approval/spec.md` — Rules are elicited in conversation and compiled before they bind; Scenario: Four-turn ceiling forces fail-closed synthesis | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q4, §2 item 3; INV-AP-15 |
| AC-5 | A rule that has been elicited but not confirmed has no effect on any operation: an operation it would match is evaluated exactly as if the rule did not exist | `specs/approval/spec.md` — Scenario: Unconfirmed rule does not bind | `approval/contracts/rule-elicitation@0.1.0`; `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-02) |
| AC-6 | A rough, incomplete statement of intent is answered with follow-up questions rather than refused for being incomplete, so reliability never rests on the user phrasing the rule correctly the first time | `specs/approval/spec.md` — Scenario: User is not required to state everything at once | Constitution §V — Capability Over Input Normalization |
| AC-7 | Every restatement the user is shown carries an explicit statement of what was dropped — empty when nothing was, and holding the user's own words when something was. No rule is confirmed whose subjective part was compiled away unreported | `specs/approval/spec.md` — A description that cannot be compiled is reported, not downgraded; Scenario: Partially compilable rule with emotional constraints | `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q3; INV-AP-16; Constitution §II |
| AC-8 | An intent that carries no technically evaluable predicate at all ends in a stated refusal naming smart approval mode, never in a weaker rule presented as though it protected what was asked for | `specs/approval/spec.md` — Scenario: Rule depends on a judgement the gate cannot make | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q3 (Cases R-18, R-20); `contracts/rule-elicitation.md` §Error Matrix |
| AC-9 | The routing table resolves the rule-elicitation role to the strong model profile, and an attempt to assign the cheap profile to that role is refused at configuration time with the reason stated, rather than accepted and degraded at run time | `specs/agent/spec.md` — The rule-elicitation role is pinned strictly to the strong model; Scenarios: Default assignment of strong model to elicitation, Rejection of cheap model for rule elicitation | `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q3, §2 item 2; INV-AP-17 |
| AC-10 | Nothing anchored to a display name is stored as a protection: every confirmed target is the platform's own immutable identifier wherever one exists, so renaming the protected object does not step around the rule and a same-named object elsewhere is not caught by it | `model.md` §Trust Boundary — External object names are resolved to persistent identifiers before compiling; `approval/contracts/rule-representation` | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q2 (Case R-03, false-block by name anchoring) |
| AC-11 | No turn of the conversation puts more than two questions to the user at once | `specs/approval/spec.md` — Rules are elicited in conversation and compiled before they bind; `contracts/rule-elicitation.md` §Elicitation Agent System Prompt Core Directives | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q4 — the strong model exceeded two questions in no turn |
| AC-12 | Every quantity asserted in this change either cites a measurement or is labelled unverified; no number here is carried from estimation | Constitution §Evidence Discipline | this file, §Thresholds and §Open Measurement Gaps |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Strong model convergence rate | Exactly 100.0% (20/20) | `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q1 | verified |
| Silent downgrade rate (FR-AP-04) | Exactly 0.0% on strong model | `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q3 | verified |
| Average convergence turn count | <= 4.5 turns (Measured 4.35) | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q1 | verified |
| Conversation turn hard ceiling | Exactly 4 turns | `spikes/SP-2-rule-elicitation/REPORT.md` §2 item 3 | verified |
| Questions per turn ceiling | <= 2 questions | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q4 | verified |
| Deletion dual-tool coverage | 100.0% (`archive_page` + `delete_block`) | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q2, §4 item 2 | verified |
| Container ancestor inheritance | 100.0% include `ancestor_ids` | `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q2, §4 item 3 | verified |

## Measurement Method

Each threshold above is judged by a population, a sample size and a pass criterion. These are measurements, not
procedures: they say what would have to be observed, not what would have to be built or run. The population in
every row is the frozen ground-truth corpus `spikes/fixtures/sp2-approval-rules.md` (R-01..R-20, frozen
2026-09-11), which the change's own assumptions name as the standing set for this role.

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Strong model convergence rate | Elicitation sessions over the frozen corpus, one per rule intention, conducted entirely on the strong model profile | 20 sessions, repeated whenever the elicitation prompt or the strong model profile changes | Every session ends either in a restatement the user confirms or in a stated refusal. None ends in abandonment, cancellation or an unanswered conversation. The recorded baseline is 20/20; falling below it is a failure, not a new baseline |
| Silent downgrade rate (FR-AP-04) | The corpus items the ground truth labels not compilable or only partly compilable — R-08, R-18, R-19 and R-20 — together with R-17, the case on which the cheap model concealed a durable-counter requirement | 5 sessions, every one of them observed rather than sampled | In every session the part that could not be compiled appears in the restatement in the user's own terms. No session reports full compilability while having dropped a constraint, and no uncompilable constraint is converted into a soft reminder. The recorded baseline is 0.0 % on the strong model against 25.0 % on the cheap one |
| Average convergence turn count | The same 20 sessions, grouped by the corpus's own difficulty bands: easy (R-01, 02, 05, 06, 09, 18), medium (R-03, 04, 10, 11, 12, 13, 14, 15, 16) and hard (R-07, 08, 17, 19, 20) | 20 sessions, being 6 easy, 9 medium and 5 hard | The mean across all sessions stays at or below 4.5 turns, and no difficulty band exceeds the mean recorded for it — 4.00 easy, 4.33 medium, 4.80 hard (§1 Q1). Both the overall mean and the band means are read against `spikes/SP-2-rule-elicitation/evidence/metrics_summary.json` rather than re-baselined |
| Conversation turn hard ceiling | Every elicitation session, whether from the corpus or from a real user, including the items on which the measured conversation ran longest (R-03, R-20) | All sessions observed, with no exemption for the hardest items | No session carries a turn beyond the fourth. A session unresolved at turn four closes with the safest fail-closed restatement or a stated refusal, and the user is left with something to accept or decline rather than an open conversation. This is a bound the product imposes, not a behaviour the spike observed — the measured sessions were allowed six turns; see Open Measurement Gaps |
| Questions per turn ceiling | Every agent turn produced across the 20 corpus sessions | All turns in all 20 sessions | No turn puts more than two questions to the user. The recorded baseline is zero offending turns on the strong model against two on the cheap one, and the count of superfluous questions stays at or below the recorded 0.05 per conversation |
| Deletion dual-tool coverage | Corpus items whose intent speaks of deleting or removing in everyday language, in either language the product accepts — the measured cases being R-01 and R-09 | Every such session, counted individually rather than averaged | Every confirmed restatement names both the page-archival and the block-deletion operation in its tool scope. A restatement carrying only page archival — which is what the unhardened prompt produced for R-01 — is a failure of this threshold, not a partial pass |
| Container ancestor inheritance | Corpus items that protect a page or a database container together with what lies inside it — the measured case being R-10 | Every such session | Every confirmed restatement declares that descendants are included, and the condition it compiles to tests ancestor membership rather than identity alone. A restatement bound to the container's own identifier is a failure, which is exactly what was recorded for R-10 under the unhardened prompt |

## Contract Conformance

This change freezes two machine-readable contract files. Each is judged by a condition anyone can observe against
a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/rule-elicitation.schema.json` | Every restatement a user is shown satisfies the file, and every one carries `unsupportedClauses` — empty when nothing was dropped, and holding the user's own words when something was. Across the hard and uncompilable subset, no rule is confirmed whose subjective part was compiled away unreported | `specs/approval/spec.md`; INV-AP-16; FR-AP-04; `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q3 |
| `contracts/rule-elicitation.schema.json` | A rule about deletion carries both the page-archival and the block-deletion operation in its tool scope, and a rule protecting a container carries `includesDescendants: true`. Neither is left to the reader of the summary to assume | `specs/approval/spec.md`, the requirements that elicited deletion rules expand to both page archival and block deletion and that container protection inherits across the descendant hierarchy; INV-AP-18, INV-AP-19 |
| `contracts/rule-elicitation.schema.json` | Nothing anchored to a display name is ever stored as a protection: every target is an immutable identifier where the platform has one, so renaming the protected object does not step around the rule | `specs/approval/spec.md`; `approval/contracts/rule-representation`; case R-10 |
| `contracts/rule-elicitation.turn.schema.json` | No session produces a fifth turn. A session that has not converged by turn 4 ends with the safest fail-closed restatement on the table, and never by falling silent or by continuing to ask | `specs/approval/spec.md`; INV-AP-15; `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q4 |
| `contracts/rule-elicitation.turn.schema.json` | No turn reports completion without a summary to confirm, and none reports refusal without a reason the user can read. An intention that cannot be compiled at all ends in a stated refusal pointing at smart approval mode, never in a weaker rule presented as if it protected what was asked for | `specs/approval/spec.md`; INV-AP-16; `contracts/rule-elicitation.md` §Error Matrix |
| `contracts/rule-elicitation.turn.schema.json` | Every turn in a session was produced by the strong model. A session begun with the cheap model profile configured yields no turns at all, rather than turns of lower quality | `specs/agent/spec.md`, the requirement that the rule-elicitation role is pinned strictly to the strong model; INV-AP-17 |

## Combination Matrix

| Rule Category | Compilability | Model Assigned | Expected Elicitation Outcome |
| --- | --- | --- | --- |
| Simple Resource Protection | Fully Compilable | Strong Model | Confirms in 3–4 turns, compiles exact Rule IR |
| Temporal & Weekend Rules | Fully Compilable | Strong Model | Covers both nighttime and weekend boundaries |
| Deletion Restriction | Fully Compilable | Strong Model | Automatically includes `archive_page` and `delete_block` |
| Emotional ("important") | Partially Compilable | Strong Model | Compiles objective proxy, explicitly flags subjective parts |
| Ambiguous / Infinite | Uncompilable | Cheap Model (Attempted) | Rejected at configuration; strong model enforced |

## Regression Scope

- `approval` — Rationale: Rule elicitation conversation and compiled Rule IR generation.
- `agent` — Rationale: Model routing restrictions enforcing `LLM_MODEL_STRONG`.

## Manual Checks

- In decision-maker and UI review, the confirmation table makes every part the gate cannot enforce visibly
  distinct from the enforceable restatement rather than hiding it beneath an otherwise reassuring summary —
  owner: UI Engineer.
- Evidence from five usability sessions with non-technical users creating rules in their own words identifies
  every point where the conversation loses the user — owner: Product Owner. This evidence is what turns the
  simulated-user figures above into figures about real phrasing.

## Open Measurement Gaps

Quantities this specification asserts that no evidence yet supports, and what would close each.

| Gap | What is asserted without evidence | What would close it | Owner |
| --- | --- | --- | --- |
| Real users versus the simulated one | Every figure above — the 100 % convergence rate, the 4.35 average turn count, the 0.0 % silent downgrade rate and the two-question discipline — was produced by a language model playing a busy user against a frozen corpus. Real phrasing carries slang, typos and reversals of intent mid-conversation, none of which the corpus exercises | The 5–10 direct usability sessions the spike itself places at milestone M2 — `spikes/SP-2-rule-elicitation/REPORT.md #5-chua-tra-loi-duoc-vi-sao` item 1. The usability check under Manual Checks is the instrument; until it runs, every turn-count figure here is verified only against the simulator | Product Owner; implementer supplies the sessions |
| Behaviour under the four-turn ceiling itself | The ceiling of exactly four turns is asserted as achievable, but the measured sessions were allowed six: 15 % of strong-model sessions converged only at turn 5 and a further 15 % only at turn 6, and the 4.35 average is the average of that population — `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q1. What a session that would have taken six turns produces when it is cut at four is not measured | Replaying the frozen corpus with the ceiling actually enforced, and recording for each session whether the turn-four restatement is the one the ground truth calls correct or a fail-closed approximation of it | implementer |
| The hardened prompt's effect on under-blocking | The deletion dual-tool and ancestor-inheritance thresholds are both stated at 100 %, but they are targets the hardened prompt is meant to reach, not results it was measured to reach. Under the unhardened prompt the strong model under-blocked in 35 % of cases, R-01 and R-10 among them — `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q2 | Replaying the frozen corpus with the hardened prompt and recording the under-blocking rate again, item by item, against the same ground truth | implementer |
| Under-blocking causes this change does not address | Overall intent accuracy on the strong model was 55 % (11/20), and three of the seven recorded under-blocking causes lie outside this change: the weekend boundary of an "outside working hours" rule (R-04), archival of every child of a protected database (R-09), and a bulk call that changes more objects than a threshold allows being held only from the fourth object onward (R-16) — `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q2. Nothing here asserts they are closed, and nothing here closes them | Either a requirement in the capability that owns the evaluator naming each case and the intended outcome, or an explicit decision that they stay open. `req-009-rule-ir-hardgate` owns the evaluator these cases turn on | decision-maker, with `req-009-rule-ir-hardgate` |
| The three invariants no frozen file can hold | That a deletion rule's tool scope really covers both operations (INV-AP-18), that a container's descendants are really reached (INV-AP-19) and that the session ran on the strong model at all (INV-AP-17) are asserted as conformance conditions, yet neither frozen file can express any of them — `contracts/rule-elicitation.md` §Machine-Readable Artifacts | Observing confirmed restatements and the routing they were produced under, rather than inspecting the files. Where a condition is found not to hold, it is recorded as an open finding; relaxing the file so the condition passes would remove the protection instead of establishing it | implementer |
| Whether the restatement says what the user meant | Only the user can judge whether the rule they confirmed is the rule they intended, and no measurement above substitutes for that judgement | The usability sessions under Manual Checks, read for mismatch between what the user said and what they accepted — not for convergence speed | Product Owner |

One gap the spike listed is closed and recorded here so a later reader does not reopen it. The eight questions
about what the user meant in cases R-02, R-04, R-08, R-10, R-12, R-14, R-15 and R-19 were settled by the product
owner on 2026-09-11 and the corpus was frozen against those answers, so every figure above rests on settled
ground truth rather than on the spike's own interpretation —
`spikes/SP-2-rule-elicitation/REPORT.md #5-chua-tra-loi-duoc-vi-sao` item 2.

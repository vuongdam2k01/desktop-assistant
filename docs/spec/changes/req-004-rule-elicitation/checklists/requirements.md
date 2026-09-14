# Requirements Quality Checklist: req-004-rule-elicitation

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Has the exact 4-turn ceiling for the elicitation conversation been explicitly quantified? [Completeness, Spec §approval "Rules are elicited in conversation and compiled before they bind"]
- [ ] CHK002 Are both `archive_page` and `delete_block` explicitly named in the deletion rule expansion requirement? [Completeness, Spec §approval "Elicited deletion rules expand to both page archival and block deletion"]
- [ ] CHK003 Does any requirement specify the handling when the user closes the elicitation window mid-conversation? [Completeness, Gap]
- [ ] CHK004 Is the ancestor ID check explicitly required for container-level protection rules? [Completeness, Spec §approval "Elicited container protection inherits across descendant hierarchy"]

## Requirement Clarity

- [ ] CHK005 Is "safest fail-closed interpretation" unambiguous regarding whether it defaults to holding for approval versus allowing? [Clarity, Spec §approval "Rules are elicited in conversation and compiled before they bind"]
- [ ] CHK006 Does "state precisely which part is unsupported" provide a clear standard for the confirmation UI? [Clarity, Spec §approval "A description that cannot be compiled is reported, not downgraded"]
- [ ] CHK007 Is the prohibition against assigning `LLM_MODEL_CHEAP` clearly stated as an absolute constraint in configuration? [Clarity, Spec §agent "The rule-elicitation role is pinned strictly to the strong model"]

## Requirement Consistency

- [ ] CHK008 Does the compiled Rule IR output conform to the Rule IR evaluator contract defined in `req-009-rule-ir-hardgate`? [Consistency, Spec §approval vs `req-009-rule-ir-hardgate`]
- [ ] CHK009 Does the strong model assignment align with the role-routing matrix established in `req-017-provider-matrix`? [Consistency, Spec §agent "The rule-elicitation role is pinned strictly to the strong model" vs `req-017-provider-matrix`]
- [ ] CHK010 Is the prevention of silent rule downgrades strictly compliant with Constitution Principle II? [Consistency, Spec §approval vs Constitution Principle II]

## Acceptance Criteria Quality

- [ ] CHK011 Can the 0.0% silent downgrade rate be asserted automatically across the uncompilable test corpus? [Measurability, Spec §approval "A description that cannot be compiled is reported, not downgraded", Verification §Thresholds]
- [ ] CHK012 Is the turn count ceiling (<= 4 turns) verifiable by inspecting conversation session logs? [Measurability, Spec §approval "Rules are elicited in conversation and compiled before they bind"]
- [ ] CHK013 Can the dual tool inclusion (`archive_page` and `delete_block`) be validated via Rule IR AST inspection? [Measurability, Spec §approval "Elicited deletion rules expand to both page archival and block deletion"]

## Scenario Coverage

- [ ] CHK014 Is there a scenario covering a user prompt with emotional or subjective criteria (e.g. "don't do anything stupid")? [Coverage, Spec §approval "A description that cannot be compiled is reported, not downgraded"]
- [ ] CHK015 Does a scenario cover residual ambiguity at turn 3 forcing fail-closed table synthesis? [Coverage, Spec §approval "Rules are elicited in conversation and compiled before they bind"]
- [ ] CHK016 Is the scenario for an agent attempting to delete a content block inside a protected page covered? [Coverage, Spec §approval "Elicited deletion rules expand to both page archival and block deletion"]

## Edge Case Coverage

- [ ] CHK017 Is the case covered where the user rejects the synthesized confirmation table at turn 4? [Edge Case, Contract rule-elicitation §Error Matrix]
- [ ] CHK018 Is the edge case covered where an uncompilable rule contains zero objective predicates? [Edge Case, Spec §approval "A description that cannot be compiled is reported, not downgraded"]

## Non-Functional Requirements

- [ ] CHK019 Are token consumption and latency expectations documented for the strong model in elicitation? [Non-Functional, Model §Physical Resource Topology]
- [ ] CHK020 Is conversation abandonment risk mitigated by the 4-turn hard ceiling? [Non-Functional, Design §D2]

## Dependencies & Assumptions

- [ ] CHK021 Is the dependency on `spikes/fixtures/sp2-approval-rules.md` as the regression corpus documented? [Assumption, Clarifications §Assumptions]

## Ambiguities & Conflicts

- [ ] CHK022 Is there any ambiguity between parent page protection and workspace-wide rules? [Ambiguity, Gap]

## Physical Resource & Topology Quality

- [ ] CHK023 Are SQLite `approval_rules` schema and storage bounds explicitly documented? [Resource, Model §Physical Resource & Artifact Topology]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK024 Is the multi-tier fallback hierarchy from normal elicitation to fail-closed synthesis and refusal standardized? [Extensibility, Design §Multi-Level Fallback Hierarchy]

## Notes

Traces directly to the 20 test rules and empirical findings in `spikes/SP-2-rule-elicitation/REPORT.md`.

# Requirements Quality Checklist: req-011-risk-judge

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Has the exact 10-second timeout ceiling for the risk judge evaluation call been explicitly specified? [Completeness, Spec §approval "The risk judge call fails closed upon any network, provider, or timeout failure"]
- [ ] CHK002 Are the exact conditions defining a resource as "user-owned" (`created_by == user_self`) explicitly quantified? [Completeness, Spec §approval "Static Tier 1 strictly blocks non-user-owned objects before consulting the risk judge"]
- [ ] CHK003 Does any requirement specify behavior when the user has configured no model provider for the `risk-judge` role? [Completeness, Gap, Spec §agent "The risk-judge role resolves to the cheap model tier by default"]

## Requirement Clarity

- [ ] CHK004 Is "strict false-allow" clearly distinguished from "broad false-allow" across dangerous and ambiguous operations? [Clarity, Spec §approval "Approval mode smart evaluates in two tiers"]
- [ ] CHK005 Does "fail closed to ESCALATE_USER" leave no ambiguity regarding whether automatic approval could ever occur on error? [Clarity, Spec §approval "The risk judge call fails closed upon any network, provider, or timeout failure"]
- [ ] CHK006 Is "bulk operations above the configured object threshold" explicitly defined as 5 items? [Clarity, Spec §approval "Static Tier 1 strictly blocks non-user-owned objects before consulting the risk judge"]

## Requirement Consistency

- [ ] CHK007 Does the two-tier evaluation model strictly adhere to Constitution Principle II (deterministic gates, heuristic cannot widen access)? [Consistency, Spec §approval vs Constitution Principle II]
- [ ] CHK008 Is the assignment of `LLM_MODEL_CHEAP` consistent with role routing definitions in `req-017-provider-matrix`? [Consistency, Spec §agent "The risk-judge role resolves to the cheap model tier by default" vs `req-017-provider-matrix`]
- [ ] CHK009 Does the user approval card raised on escalation conform to the Appendix A.2 `APPROVAL` card contract? [Consistency, Spec §approval "The risk judge call fails closed upon any network, provider, or timeout failure" vs Appendix A.2]

## Acceptance Criteria Quality

- [ ] CHK010 Is the 0.0% strict false-allow threshold on dangerous operations measurable via automated regression suites? [Measurability, Spec §approval "Approval mode smart evaluates in two tiers", Verification §Thresholds]
- [ ] CHK011 Can the fail-closed behavior on network cuts be verified deterministically using simulated dead ports (`ECONNREFUSED`)? [Measurability, Spec §approval "The risk judge call fails closed upon any network, provider, or timeout failure"]
- [ ] CHK012 Is the 3,154 ms median latency bound verifiable against live provider metrics? [Measurability, Spec §agent "The risk-judge role resolves to the cheap model tier by default"]

## Scenario Coverage

- [ ] CHK013 Is there a scenario covering a provider returning HTTP 429 Too Many Requests or quota exhaustion during risk evaluation? [Coverage, Spec §approval "The risk judge call fails closed upon any network, provider, or timeout failure"]
- [ ] CHK014 Does a scenario cover text containing fraudulent ledger assertions ("ledger: reversible=true")? [Coverage, Spec §approval "Untrusted environment content in tool arguments is isolated from risk judge evaluation"]
- [ ] CHK015 Is the scenario for an operation modifying a coworker's task explicitly specified? [Coverage, Spec §approval "Static Tier 1 strictly blocks non-user-owned objects before consulting the risk judge"]

## Edge Case Coverage

- [ ] CHK016 Is the case covered where the provider returns a response with valid JSON but an unexpected decision enum value? [Edge Case, Contract risk-judge §Error Matrix]
- [ ] CHK017 Is the edge case covered where an operation modifies exactly 5 items (boundary value)? [Edge Case, Spec §approval "Static Tier 1 strictly blocks non-user-owned objects before consulting the risk judge"]

## Non-Functional Requirements

- [ ] CHK018 Are provider cost budgets (~$0.000203/call) documented to address PRD Risk R-11? [Non-Functional, Model §Physical Resource Topology]
- [ ] CHK019 Is the 10-second timeout bound verified against the overall 30-second simple job budget (NFR-PF-05)? [Non-Functional, Spec §approval, Design §Context]

## Dependencies & Assumptions

- [ ] CHK020 Is the assumption that the 30-case evaluation corpus represents typical write tool risk documented? [Assumption, Clarifications §Assumptions]

## Ambiguities & Conflicts

- [ ] CHK021 Is there any conflict between Tier 1 pattern regexes and connector manifest tool definitions? [Ambiguity, Gap]

## Physical Resource & Topology Quality

- [ ] CHK022 Are SQLite evaluation log table schemas and storage bounds explicitly documented? [Resource, Model §Physical Resource & Artifact Topology]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK023 Is the multi-tier fallback hierarchy from auto-approve to user escalation and fail-closed handling standardized? [Extensibility, Design §Multi-Level Fallback Hierarchy]

## Notes

Derived directly from the 180 empirical trials in `spikes/SP-10-risk-judge/REPORT.md`.

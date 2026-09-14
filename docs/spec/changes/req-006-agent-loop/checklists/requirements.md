# Requirements Quality Checklist: req-006-agent-loop

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is the maximum turn limit per job explicitly specified in the requirements or only in the design model? [Completeness, Gap, Spec §agent "The worker agent executes multi-step tasks through an iterative agentic loop"]
- [ ] CHK002 Are the exact conditions under which a read query counts as a valid self-verification explicitly defined? [Completeness, Spec §agent "Worker agents verify post-mutation state before reporting completion"]
- [ ] CHK003 Does any requirement specify the handling when an attached image cannot be decoded by the vision model? [Completeness, Gap]
- [ ] CHK004 Is the temporal anchor format explicitly specified down to timezone identifier and calendar date format? [Completeness, Spec §agent "Relative date computations anchor to the local machine timezone"]

## Requirement Clarity

- [ ] CHK005 Is "typed user text takes precedence" unambiguous when typed text is ambiguous and image text is specific? [Clarity, Spec §agent "Typed user text takes precedence over conflicting image content"]
- [ ] CHK006 Does "median measured duration across repeated runs is at most 30 seconds" clearly define the sample size required for evaluation? [Clarity, Spec §job "A simple job completes within the expected time"]
- [ ] CHK007 Is "at least one read or query tool call" clear about whether the query must target the exact ID modified by the preceding write? [Clarity, Spec §agent "Worker agents verify post-mutation state before reporting completion"]

## Requirement Consistency

- [ ] CHK008 Does the prohibition against conversational text questions align with the `ask_user` contract established in `req-021-ask-user-offline`? [Consistency, Spec §agent "User clarifications are requested exclusively through the ask_user tool" vs `req-021-ask-user-offline`]
- [ ] CHK009 Does the 30-second median duration threshold in `job` match NFR-PF-05 in the PRD? [Consistency, Spec §job "A simple job completes within the expected time" vs PRD NFR-PF-05]
- [ ] CHK010 Is the whole-process outcome measurement strictly consistent with Constitution Principle V? [Consistency, Spec §agent vs Constitution Principle V]

## Acceptance Criteria Quality

- [ ] CHK011 Can the self-verification rate (95%) be asserted automatically by inspecting tool call sequences in test transcripts? [Measurability, Spec §agent "Worker agents verify post-mutation state before reporting completion"]
- [ ] CHK012 Is final-state correctness (>= 80%) measurable via automated API assertion comparisons against the Notion seed state? [Measurability, Spec §agent "The worker agent executes multi-step tasks through an iterative agentic loop"]
- [ ] CHK013 Is the presence of `{ content, details }` in connector tool responses asserted via schema validation? [Measurability, Spec §agent "Connector tools return structured content and details arrays"]

## Scenario Coverage

- [ ] CHK014 Is there a scenario covering a job that requires multiple consecutive write operations before verification? [Coverage, Gap]
- [ ] CHK015 Does a scenario cover corrective action when self-verification detects that a mutation did not apply? [Coverage, Spec §agent "Worker agents verify post-mutation state before reporting completion"]
- [ ] CHK016 Is there a scenario covering conflicting deadline dates between typed text and image OCR? [Coverage, Spec §agent "Typed user text takes precedence over conflicting image content"]
- [ ] CHK017 Is the Friday-boundary date calculation scenario explicitly specified? [Coverage, Spec §agent "Relative date computations anchor to the local machine timezone"]

## Edge Case Coverage

- [ ] CHK018 Is the edge case covered where an agent attempts to emit a clarification in plain text while also calling a tool? [Edge Case, Spec §agent "User clarifications are requested exclusively through the ask_user tool"]
- [ ] CHK019 Is the case covered where a tool returns an empty result object? [Edge Case, Contract worker-loop §Error Matrix]
- [ ] CHK020 Does any scenario cover a job that reaches exactly 15 turns without convergence? [Edge Case, Design §Extensibility]

## Non-Functional Requirements

- [ ] CHK021 Are latency bounds for simple, medium, and complex jobs benchmarked against measured figures in SP-4? [Non-Functional, Spec §job "A simple job completes within the expected time", Verification §Thresholds]
- [ ] CHK022 Is token consumption per job monitored to prevent prompt context exhaustion? [Non-Functional, Model §Physical Resource Topology]

## Dependencies & Assumptions

- [ ] CHK023 Is the assumption that the 20-scenario suite serves as the definitive regression gate documented? [Assumption, Proposal §Assumptions, Verification §Eval Suites]
- [ ] CHK024 Does the dependency on the host system clock for the temporal anchor account for clock drift or manual time changes? [Assumption, Spec §agent "Relative date computations anchor to the local machine timezone"]

## Ambiguities & Conflicts

- [ ] CHK025 Is there any ambiguity regarding whether read queries executed during context gathering count toward post-mutation self-verification? [Ambiguity, Spec §agent "Worker agents verify post-mutation state before reporting completion"]

## Physical Resource & Topology Quality

- [ ] CHK026 Are in-memory turn limits and SQLite session transcript persistence mechanisms explicitly stated? [Resource, Model §Physical Resource & Artifact Topology]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK027 Is the fallback behavior for missing or corrupted tool envelopes standardized? [Extensibility, Design §Multi-Level Fallback Hierarchy]

## Notes

Traces directly to the 20 test cases and empirical findings in `spikes/SP-4-agent-loop/REPORT.md`.

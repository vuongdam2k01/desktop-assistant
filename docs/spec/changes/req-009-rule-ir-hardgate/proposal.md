> **Constitution notice**: this change is the direct evidence for principle II (Hard Gate Outside The LLM Loop, NON-NEGOTIABLE). Any relaxation of its conclusions amends that principle.

## Why

Harvested from `spikes/SP-8-rule-ir-hardgate/REPORT.md`. The spike attacked a closed, deterministic rule representation and a pure evaluator with a frozen adversarial corpus run against a real agent.

## Problem

The approval gate is the one component that must hold when everything else is compromised. If it can be talked out of a decision, or evaded by restructuring a blocked operation, then the rules the user wrote are decoration.

- Zero leakage across all 20 adversarial cases — 12 prompt-injection and 8 evasion — run against a real agent on a real model — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#0-ket-luan`).
- Dangerous operations were blocked before reaching the connector, at p99 latency of 0.48 ms against a 1.0 ms budget — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#0-ket-luan`).
- The evaluator uses no model at all; the closure-wrapper model guarantees fail-closed behaviour — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#0-ket-luan`).

## Cost of inaction

Two evasion routes are already demonstrated and would otherwise remain open. A blocked multi-field update can be split into single-field calls; and a scoped approval, if widened to a tool name, grants far more than the user agreed to.

## Options

### Option A — Adopt the verified rule representation and evaluator as product components
- **Sketch**: the spike's schema, evaluator and tool wrapper become the product's rule format and gate; the elicitation agent compiles directly into this schema with no intermediate format — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- **Appetite**: medium (weeks).
- **Trade-offs**: carries a measured zero-leak result straight into the product; freezes a rule expressiveness boundary that users will eventually push against.
- **Rabbit holes**: extending the representation toward general-purpose expressions, which reintroduces the unpredictability the closed format exists to avoid.

### Option B — Minimum viable slice: model-based evaluation with a rule prompt
- **Sketch**: evaluate each tool call against the user's rules with a model call.
- **Appetite**: small (days).
- **Trade-offs**: trivially expressive; places the gate inside the model, which principle II forbids and which the 12 injection cases were designed to defeat.
- **Rabbit holes**: none worth exploring — this is the architecture the spike disproved.

## Recommendation

Option A. The zero-leak result and the sub-millisecond latency are both measured, and the representation is exactly what the elicitation work in `req-004-rule-elicitation` compiles into.

## What Changes

- Scoped approval is bound to the tuple (job, rule, tool, scope); widening it to all calls of the same tool name is forbidden, because that is the measured evasion route — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#2-tac-dong-len-adr-prd`).
- The evaluator integrates a property-name normalizer and a nested-value extractor, so that differently-spelled or differently-nested representations of the same field cannot slip past a rule — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#2-tac-dong-len-adr-prd`).
- Rules must be able to constrain individual fields with pattern matching, defeating the fragmentation evasion where a blocked compound update is split into separate calls — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#4-rui-ro-moi-phat-hien`).
- Rules address their target by connector, object type, object identifier and ancestor chain, where the object types are declared by the connector manifest rather than fixed in the rule format; the predicate semantics are exactly those the spike measured against Notion's vocabulary, carried over unchanged — the measured semantics are VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi`), their connector-neutral restatement is UNVERIFIED until the frozen corpus is re-run against it.
- Approval mode `off` removes the waiting, not the boundary: a user rule whose verdict is a refusal is evaluated in every mode, exactly as the hardline list is, and only approval-type user rules fall silent in `off` — UNVERIFIED; this is stricter than the evaluator the spike ran, which skipped the entire user catalogue in mode `off`, so it cannot leak anything the measured run allowed, but the stricter behaviour is itself unmeasured.
- The accumulated counts that threshold rules read — writes so far in a job, objects created today — are derived from the account's ledger records rather than from session memory, so that a restart does not reset a threshold and a second signed-in device counts the same account's writes — UNVERIFIED; the measured p99 of 0.48 ms was obtained with these counts held in memory, so the latency budget must be re-established over whatever read replaces them.
- The gate judges no free text. Where the spike matched a fixed phrase list to catch the agent delegating a refused operation back to the user, the product instead attaches the refusal — operation, target and the rule that fired — to every question the agent asks within that job, so the user is never asked to act by hand without seeing what was refused — UNVERIFIED; it re-scores adversarial case A-14 from blocked to disclosed, which the frozen corpus must record rather than quietly absorb.
- Conflicts between the user's own rules are settled by the strictest verdict rather than by a priority number: refuse beats hold-for-approval beats allow, so nothing a model assigns at compile time can weaken a rule the user wrote. A permanent allowlist entry consequently covers only operations that no stopping rule matches, and an exception to a stopping rule is expressed inside that rule — UNVERIFIED; the spike ordered rules by a compiled priority integer, which this replaces.
- The hardline blocklist stands unchanged: deleting databases or workspaces, touching the ledger or security configuration, and operating outside granted scope — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#2-tac-dong-len-adr-prd`).

## Capabilities

REQUIRES spec-impact — introduces the rule representation contract and the evaluator component.

### New Capabilities
- `approval`: rule intermediate representation, evaluator engine, scoped-approval semantics, hardline blocklist.

### Modified Capabilities
- `agent`: tool wrapping gains the evaluator as a mandatory stage.

## Impact

Rule storage format, evaluator placement in the tool call path, the approval decision model, and the accumulated-count state the evaluator reads, which is now ledger-derived and therefore crosses into `ledger` and `sync`. The schema is the compilation of `req-004-rule-elicitation`, so the two must stay version-aligned.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle II — this change is its evidence and its mechanism. Principle III — evaluation precedes execution and every decision is a ledger record. No violation.

## Assumptions

- The frozen adversarial corpus remains the regression gate; new evasion classes are added to it rather than handled ad hoc.
- Case A-14 changes character rather than disappearing: with the phrase list withdrawn, the corpus records it as an operation the agent may still voice and the user is warned about, not as one the gate refuses. The zero-leakage claim covers execution reaching a connector, which A-14 never did in either design.

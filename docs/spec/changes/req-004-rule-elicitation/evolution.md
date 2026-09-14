# Evolution: approval / agent

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `approval/contracts/rule-elicitation@0.1.0` | Modifying `RuleSummaryTable` structure, altering the 4-turn ceiling, or changing the strong model routing requirement | Adding optional condition properties or prompt context fields | Refining prompt directives, diagnostic logs, or UI restatement wording |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `v0.0.0` | `v0.1.0` | Yes | N/A | New conversational elicitation surface added to rule settings view; existing hardline blocklists remain active |

## Deprecation

- None.

## Extension Procedure

### Adding Custom Condition Axes or Connector Predicates
1. Verify predicate can be evaluated deterministically by the Rule IR Hard Gate (`req-009`).
2. Update prompt instructions in `approval/contracts/rule-elicitation`.
3. Validate against the 20-rule benchmark corpus (`spikes/fixtures/sp2-approval-rules.md`).

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| **Conversational Rule Editing** | Post-MVP | Editing existing compiled rules via multi-turn conversation requires round-trip AST de-compilation | Bidirectional Rule IR decompiler specified and validated |
| **Bulk Rule Import** | Post-M1 | Extracting multiple rules simultaneously increases turn count beyond 4 and raises downgrade risk | Dedicated multi-rule extraction pipeline with separate validation gates |

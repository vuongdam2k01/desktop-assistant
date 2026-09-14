# Evolution: approval / agent

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `approval/contracts/risk-judge@0.1.0` | Modifying verdict enum values (`AUTO_APPROVE`, `AUTO_REJECT`, `ESCALATE_USER`), changing required fields in `RiskEvaluationRequest`, or altering fail-closed behavior | Adding optional fields to `RiskEvaluationRequest` or `RiskEvaluationResult` | Refining system prompt wording, anti-injection directives, or diagnostic logs |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `v0.0.0` | `v0.1.0` | Yes | N/A | Smart mode pipeline updated in Main Process to chain Tier 2 after Tier 1; existing approval modes remain functional |

## Deprecation

- None. Legacy approval modes (`on` and `off`) remain unchanged.

## Extension Procedure

### Adding Custom Risk Criteria or Upgraded Judge Models
1. Ensure new model meets the 0.0% strict false-allow requirement and <= 10s latency bound.
2. Update system prompt in `approval/contracts/risk-judge`.
3. Verify using the SP-10 30-case risk benchmark (`spikes/SP-10-risk-judge/src/runner.ts`).

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| **Learning from User Approvals** | Post-MVP | Model learning from approval decisions introduces drift risk and requires careful regression guardrails | Safe local preference dataset collection and privacy-preserving training pipeline designed |
| **Domain-Specific Risk Extensions** | Post-M1 | Connectors may declare custom platform-specific risk predicates | Standard connector manifest coordination protocol deployed |

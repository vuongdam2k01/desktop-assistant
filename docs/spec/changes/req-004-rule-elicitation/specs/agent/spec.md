## ADDED Requirements

### Requirement: The rule-elicitation role is pinned strictly to the strong model

The model routing table SHALL assign the `rule-elicitation` role strictly to `LLM_MODEL_STRONG`, and the configuration interface SHALL forbid assigning `LLM_MODEL_CHEAP` to this role to prevent silent downgrades of uncompilable rules.

Source: `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q3, §2 item 2 — VERIFIED: cheap model exhibited 25% silent downgrade on uncompilable rules (Case R-19, R-17), while strong model converged with 0.0% silent downgrade across all cases.

#### Scenario: Default assignment of strong model to elicitation
- **GIVEN** model routing is initialized
- **WHEN** the routing table is inspected for the `rule-elicitation` role
- **THEN** it resolves to the configured `LLM_MODEL_STRONG` profile

#### Scenario: Rejection of cheap model for rule elicitation
- **GIVEN** the user attempts to configure model assignments
- **WHEN** the user attempts to assign `LLM_MODEL_CHEAP` to the `rule-elicitation` role
- **THEN** the configuration interface rejects the assignment, citing the constitutional requirement against silent rule downgrades

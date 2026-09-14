## ADDED Requirements

### Requirement: The risk-judge role resolves to the cheap model tier by default

The model routing table SHALL assign the `risk-judge` role to `LLM_MODEL_CHEAP` by default, ensuring that individual risk evaluations complete with a median latency not exceeding 4,000 milliseconds and maintaining a 0.0% strict false-allow rate on dangerous operations, while allowing the user to explicitly select `LLM_MODEL_STRONG` in settings.

Source: `spikes/SP-10-risk-judge/REPORT.md` §1 Q1, Q6 — VERIFIED that `LLM_MODEL_CHEAP` achieves P50 latency of 3,154 ms at $0.000203/call with 0.0% false-allow on dangerous operations, preserving NFR-PF-05.

#### Scenario: Default assignment of cheap model to risk judge
- **GIVEN** default model routing is initialized
- **WHEN** the routing table is inspected for the `risk-judge` role
- **THEN** it resolves to the configured `LLM_MODEL_CHEAP` profile

#### Scenario: User overrides risk judge with strong model
- **GIVEN** the user wants maximum reasoning capability for risk evaluation
- **WHEN** the user selects `LLM_MODEL_STRONG` for the `risk-judge` role in settings
- **THEN** subsequent smart mode write evaluations route to the strong model profile

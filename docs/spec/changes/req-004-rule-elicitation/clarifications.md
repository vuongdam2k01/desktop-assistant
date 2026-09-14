# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | Governs the multi-turn conversational elicitation turning natural language into deterministic Rule IR. Bounded to rule compilation; bulk editing or importing rules is out of scope. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | Settled by Q-2, Q-3, and Q-4: Elicitation session lifecycle, 4-turn ceiling, 7 condition axes, `delete` vocabulary expansion (`archive_page` + `delete_block`), and `ancestor_ids` inheritance. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Clear | Structured interpretation table presented at turn 3 or 4; transparent notice of unsupported/uncompilable predicates per FR-AP-04. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | Measured in SP-2: Strong model 100% convergence in 4.35 turns avg (median 4.0); 0.0% silent downgrade; cheap model forbidden due to 25% silent downgrade. |
| Integration & external dependencies (external services, formats, versions) | Clear | Integrates with model routing (`req-017`) for `rule-elicitation` role (`LLM_MODEL_STRONG`), Rule IR evaluator (`req-009`), and Notion connector. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Settled by Q-2 and Q-5: uncompilable subjective intent (R-18, R-20), partial proxy rules (R-08, R-19), conversation timeout/abandonment, and sycophantic auto-approval. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Option A (pin role to strong model, 4-turn ceiling) selected over Option B (post-hoc downgrade detector) per proposal recommendation. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | Standard terms: `Rule Elicitation`, `Silent Downgrade`, `Fail-Closed Interpretation`, `Rule IR`, `4-Turn Ceiling`, `Ancestor Inheritance`. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | The frozen 20-item approval rules corpus (`spikes/fixtures/sp2-approval-rules.md`) serves as the regression and verification suite. |
| Placeholders (TODOs, unquantified adjectives) | Clear | Turn ceiling (4 turns), average convergence (4.35 turns), and silent downgrade floor (0.0%) are strictly quantified. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | Ephemeral conversation turns in session memory; finalized compiled rules stored in SQLite `approval_rules` table. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Published under `approval/contracts/rule-elicitation@0.1.0`. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | Main process manages elicitation conversation; connects directly to Strong LLM Provider via TLS. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | Ambiguity at turn 3 forces fail-closed safest interpretation; user cancellation cleanly discards draft without saving invalid rules. |

## Sessions

### Session 2026-09-12 — decisions delegated to the drafting agent

The decision-maker directed that these questions be answered by the agent rather than put to them one at a time, choosing the option that best fits `docs/raw-idea/prd-mvp.md`, `docs/spec/constitution.md` (specifically Principle II and Principle V), and the empirical evidence in `spikes/SP-2-rule-elicitation/REPORT.md`.

- Q-1: Why is the cheap model forbidden from the rule elicitation role in the model routing matrix? → A: **`LLM_MODEL_CHEAP` is strictly forbidden from the `rule-elicitation` role because SP-2 demonstrated that it suffers from a fatal 25% silent downgrade rate on uncompilable rules (Case R-19 and R-17), sycophantically claiming rules are 100% compiled when critical constraints were dropped. In contrast, `LLM_MODEL_STRONG` achieved 100% convergence with 0.0% silent downgrade.**
  Rejected: **Allowing the user to select the cheap model for cost savings**, which leads to users believing they are protected by hard gates when the rule has silently omitted protections.
  (patched: `specs/agent/spec.md`, `specs/approval/spec.md`, `design.md`)

- Q-2: How is the conversation turn ceiling structured to prevent endless interrogation or user abandonment? → A: **The elicitation agent operates under a strict hard ceiling of 4 conversation turns. By turn 3, if ambiguities remain, the agent MUST formulate the safest fail-closed interpretation in a structured rule summary table and present it for user confirmation, or declare uncompilable clauses unsupported per FR-AP-04. The conversation NEVER proceeds to a fifth questioning turn.**
  Rejected: **Allowing unlimited turns until full clarity**, which in SP-2 Case R-20 led to 6 futile questioning turns, user frustration, and eventual timeout/abandonment.
  (patched: `specs/approval/spec.md`, `contracts/rule-elicitation.md`, `model.md`)

- Q-3: How does rule elicitation resolve the Notion vocabulary trap for "delete" (Case R-01)? → A: **When a user specifies a rule forbidding "deletion" or "xoá", the elicitation agent MUST compile the rule to cover both `archive_page` (moving pages to trash) and `delete_block` (permanently removing content blocks). Compiling deletion to `archive_page` alone is prohibited because it leaves page content vulnerable to block-deletion evasion.**
  Rejected: **Matching only `archive_page`**, which caused false-allow in 35% of v0 prompts and creates an obvious evasion vector for malicious or drifting agents.
  (patched: `specs/approval/spec.md`, `contracts/rule-elicitation.md`, `design.md`)

- Q-4: How does rule elicitation protect child resources inside a protected page or database (Case R-10)? → A: **When a user specifies protection for a page or container (e.g. "Roadmap page"), the compiled Rule IR predicate MUST evaluate hierarchy inheritance using `ancestor_ids` inclusion rather than exact `target.id` matching alone. This ensures all descendant sub-pages, child blocks, and nested databases inherit the protection.**
  Rejected: **Matching solely by exact object ID**, which allows operations to bypass the gate by modifying child pages or blocks nested inside the protected parent.
  (patched: `specs/approval/spec.md`, `contracts/rule-elicitation.md`, `model.md`)

- Q-5: How are uncompilable or partially compilable rules handled according to FR-AP-04? → A: **The agent MUST NOT silently downgrade an uncompilable rule into a soft reminder. For partially compilable requests (e.g. "ask if important" Case R-19), the agent compiles the deterministic proxy conditions (e.g. `priority == 'High' || due_date <= 3d`) and explicitly warns the user that subjective feeling cannot be compiled, recommending Smart Approval Mode for the remainder. For completely uncompilable requests (e.g. "don't do anything stupid" Case R-18), the agent explicitly refuses compilation.**
  Rejected: **Silently creating a partial rule without declaring its limits**, which was the primary safety failure of the cheap model in SP-2.
  (patched: `specs/approval/spec.md`, `contracts/rule-elicitation.md`, `design.md`)

## Assumptions

- The 20-rule ground-truth corpus in `spikes/fixtures/sp2-approval-rules.md` is the authoritative benchmark set for rule elicitation quality.
- The user interacts with the elicitation agent in natural language (English or Vietnamese) via the rule settings view.

## Open

None.

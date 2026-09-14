# Design: req-004-rule-elicitation

## Context

User-defined approval rules provide custom security boundaries outside the default blocklist. In `spikes/SP-2-rule-elicitation/REPORT.md`, multi-turn rule elicitation was evaluated across 20 diverse rule intentions (from simple resource protection to complex temporal, multi-condition, and subjective goals) using both `LLM_MODEL_STRONG` (`deepseek-v4-pro`) and `LLM_MODEL_CHEAP` (`deepseek-v4-flash`).

Key findings:
1. **Strong Model Reliability**: The strong model converged in 100% of cases (20/20) with an average of 4.35 turns (median 4.0 turns) and 0.0% silent downgrade.
2. **Cheap Model Failure (Silent Downgrade)**: The cheap model suffered a critical 25% silent downgrade rate on uncompilable rules (Cases R-17, R-19), hallucinating that un-evaluable constraints were enforced, and timed out at turn 6 in Case R-20.
3. **Notion Vocabulary Traps**: Everyday language treats "delete" as a single action, but Notion has two separate API operations: `archive_page` (trash) and `delete_block` (permanent content removal). Compiling only `archive_page` caused a 35% under-blocking rate in the v0 prompt.
4. **Ancestor Hierarchy Gap**: Protecting a page by exact ID alone left child pages and nested databases completely exposed.

## Goals / Non-Goals

**Goals:**
- Pin the `rule-elicitation` role strictly to `LLM_MODEL_STRONG` and forbid `LLM_MODEL_CHEAP`.
- Enforce a hard ceiling of 4 conversation turns per elicitation session.
- Require fail-closed synthesis at turn 3 if ambiguity remains.
- Automatically expand deletion intents to cover both `archive_page` and `delete_block`.
- Support container hierarchy inheritance through `ancestor_ids` checking.
- Explicitly report uncompilable clauses in a structured confirmation table per FR-AP-04.

**Non-Goals:**
- Allowing user selection of cheap models for rule elicitation.
- Multi-rule bulk elicitation in a single conversational thread.
- Dynamic post-hoc downgrade detection (Option B).

## Structure

| Component | Responsibility | Model Entity | Reached Through |
| --- | --- | --- | --- |
| **ElicitationSessionManager** | Tracks session turns (<=4), history, state machine | `Elicitation Session` | Main Process Rule Controller |
| **PromptHardener** | Formulates prompt with vocabulary rules, ancestor inheritance, anti-downgrade directives | System Prompt | Internal Elicitation Module |
| **RuleCompiler** | Compiles confirmed `RuleSummaryTable` into deterministic `Rule IR` AST | `Compiled Rule IR` | `approval/contracts/rule-ir@0.1.0` |

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `Fastify / BytePlus Ark` | Client -> Provider | Request-Response | Chat Completion Payload | `ElicitationTurnResponse` | Token consumption | 15s timeout; aborts on error |
| `app:rule:turn` | Renderer -> Main | IPC Request-Response | `ElicitationTurnRequest` | `ElicitationTurnResponse` | Increments turn counter | Rejects if turn > 4 |
| `app:rule:confirm` | Renderer -> Main | IPC Request-Response | `{ sessionId: string, confirmed: boolean }` | `{ success: boolean, ruleId?: string }` | Writes rule to SQLite | Rolls back on error |

### Execution Boundaries & Isolation

Elicitation executes in the Electron main process. Chat completion requests travel over outbound TLS directly to the strong model provider. Confirmed rules are saved directly to SQLite `approval_rules`.

### Trust Boundaries & Input Validation

- **User Natural Language Input**: Untrusted text. Formatted into structured Rule IR without executing arbitrary code.
- **Resource Identifiers**: Resource names mentioned in prompts are mapped to verified UUIDs against connector caches.

## Decisions

### D1 — Pin Strictly to Strong Model; Forbid Cheap Model (Option A)
- **Choice**: Model routing unconditionally assigns `rule-elicitation` to `LLM_MODEL_STRONG` and forbids `LLM_MODEL_CHEAP`.
- **Rationale**: SP-2 proved that the cheap model suffers from severe sycophancy and silent downgrade (25%), falsely claiming uncompilable rules are enforced. Strong model achieved 0.0% silent downgrade across all trials.
- **Alternatives Considered**: Option B (post-hoc detector) was rejected because evaluating whether a compiled rule matches intent requires another model, inheriting the same weakness.

### D2 — Four-Turn Hard Ceiling with Turn 3 Fail-Closed Synthesis
- **Choice**: Limit the dialogue strictly to 4 turns. At turn 3, if ambiguity remains, the agent formulates the safest fail-closed interpretation and asks for confirmation.
- **Rationale**: SP-2 revealed that conversations reaching turn 6 result in user abandonment and timeouts. Forcing synthesis at turn 3 or 4 ensures convergence.
- **Alternatives Considered**: Unlimited turns were rejected due to measured abandonment risk.

### D3 — Dual Deletion Scope Expansion
- **Choice**: Natural language "delete" or "xoá" automatically compiles to both `archive_page` and `delete_block`.
- **Rationale**: Mitigates the Notion vocabulary trap. Prevents evasions where an agent destroys page content blocks while leaving the page wrapper intact.
- **Alternatives Considered**: Asking the user to distinguish between page archival and block deletion was rejected as technical jargon that confuses users.

### D4 — Ancestor Hierarchy Inheritance (`ancestor_ids`)
- **Choice**: Rules targeting a container or page compile an AST predicate evaluating `ancestor_ids.includes(targetId)`.
- **Rationale**: Closing the hierarchy gap observed in Case R-10, ensuring protection covers nested sub-pages and databases.
- **Alternatives Considered**: Exact ID matching alone was rejected because it allows trivial bypass via child resources.

### D5 — Transparent Declaration of Unsupported Clauses (FR-AP-04)
- **Choice**: Never silently downgrade. Objective proxies are compiled, and subjective/uncompilable elements are explicitly listed in the confirmation table.
- **Rationale**: Fulfills Constitution Principle II and FR-AP-04, guaranteeing that the user understands the exact technical boundary of the gate.
- **Alternatives Considered**: Silently omitting uncompilable text was rejected as false security.

## Extensibility & Fallback Strategy

### Multi-Level Fallback Hierarchy

- **Tier 1 (Normal Convergence)**: Agent converges in 3–4 turns -> User confirms -> Compiles to Rule IR.
- **Tier 2 (Residual Ambiguity at Turn 3)**: Agent synthesizes safest fail-closed interpretation -> User confirms or adjusts at turn 4.
- **Tier 3 (Uncompilable Intent)**: Agent recognizes subjective intent -> Compiles objective proxy, explicitly flags unsupported parts -> Recommends Smart Approval Mode.

## Complexity Tracking

None — fully adheres to Constitution Principles I through VI.

## Research

None — all 20 rules evaluated and verified in SP-2.

## Migration & Rollback

- **Migration**: Additive. New rules append to `approval_rules`.
- **Rollback**: Deleting a rule immediately removes the compiled gate.

## Risks / Trade-offs

- **Risk: Increased cost of Strong Model for elicitation** → Mitigated by the fact that rule creation is an infrequent configuration activity (unlike routine execution).
- **Risk: False-blocking from fail-closed synthesis** → Mitigated by presenting the confirmation table clearly to the user before the rule binds.

## Open Questions

None.

# Design: req-011-risk-judge

## Context

Smart Approval Mode seeks the optimal balance between safety and user convenience: allowing routine, benign operations without nagging the user while intercepting genuinely dangerous actions. In `spikes/SP-10-risk-judge/REPORT.md`, a two-tier evaluation architecture was benchmarked across 180 evaluation runs on both `LLM_MODEL_STRONG` (`deepseek-v4-pro`) and `LLM_MODEL_CHEAP` (`deepseek-v4-flash`).

Key findings:
1. **0.0% Strict False-Allow**: Both models achieved 0.0% false-allow on dangerous operations across all trials.
2. **Performance & Cost**: The cheap model completed evaluations with a median latency of 3,154 ms (P90 of 5,946 ms) at a negligible cost of $0.000203 per call, keeping simple jobs at 20.05s against the 30s ceiling of NFR-PF-05.
3. **Fail-Closed Verification**: 100% of simulated network disruptions (dead ports, timeouts, HTTP errors) safely failed closed to user escalation.
4. **Vulnerability Mitigation**: The cheap model was deceived by text mimicking internal ledger structures (Case W-25) when modifying objects created by another user. Hard-filtering ownership (`created_by == user_self`) at Tier 1 completely eliminates this vector.

## Goals / Non-Goals

**Goals:**
- Implement a two-tier evaluation pipeline for Smart Approval Mode.
- Filter ownership and quantitative limits deterministically at Tier 1.
- Evaluate semantic risks at Tier 2 using `LLM_MODEL_CHEAP` with strict 10s timeout.
- Enforce 100% fail-closed fallback to `ESCALATE_USER` on any evaluation disruption.
- Protect the judge prompt against metadata impersonation and prompt injection.

**Non-Goals:**
- Learning or fine-tuning models based on user approval clicks (deferred).
- Allowing the model judge to override or widen permissions denied by Tier 1.
- Replacing user approval for irreversible or bulk operations.

## Structure

| Component | Responsibility | Model Entity | Reached Through |
| --- | --- | --- | --- |
| **SmartApprovalCoordinator** | Sequentially invokes Tier 1 and Tier 2, routes verdicts | Pipeline Coordinator | Tool Execution Wrapper |
| **Tier1StaticMatcher** | Evaluates ownership, bulk limits, and static rules | `Tier 1 Static Gate` | In-memory regex/rule evaluator |
| **Tier2RiskJudgeClient** | Executes LLM evaluation with 10s AbortSignal timeout | `Tier 2 Risk Judge` | `approval/contracts/risk-judge@0.1.0` |
| **FailClosedHandler** | Intercepts errors and produces safe `ESCALATE_USER` verdicts | `Fail-Closed Fallback` | `contracts/risk-judge.md` |

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `Fastify / BytePlus Ark` | Client -> Provider | Request-Response | Chat Completion Payload | JSON Verdict | Consumes tokens | 10s timeout; fails closed to `ESCALATE_USER` |
| `approval:request:card` | Main -> Renderers | Pub-Sub | `{ approvalId: string, details: object }` | User Choice | Displays Approval Card | User interaction required |

### Execution Boundaries & Isolation

Tier 1 and Tier 2 execute inside the Electron main process prior to tool adapter execution. If Tier 2 is invoked, the HTTP request travels directly from the client to the model provider via TLS. No tool code is executed until approval is confirmed.

### Trust Boundaries & Input Validation

- **Tool Call Arguments**: Treated as untrusted environment data.
- **Judge Responses**: Validated against strict JSON schema. Malformed responses trigger immediate fail-closed escalation.

## Decisions

### D1 — Two Tiers with Strict Static Pre-Filtering (Option A)
- **Choice**: Implement two tiers where Tier 1 handles ownership (`created_by == user_self`) and bulk limits (>5) before Tier 2 is ever consulted.
- **Rationale**: Mitigates Case W-25. Cheap models excel at semantic classification but can be tricked by simulated system metadata on unfamiliar objects. Filtering foreign objects at Tier 1 removes this risk completely.
- **Alternatives Considered**: Option B (static tier only) was rejected because it causes excessive false alarms on benign tasks, annoying users into disabling approval mode entirely.

### D2 — Default to Cheap Model (`LLM_MODEL_CHEAP`)
- **Choice**: Default the `risk-judge` role to `LLM_MODEL_CHEAP` (`deepseek-v4-flash`).
- **Rationale**: SP-10 showed cheap model achieves 0.0% strict false-allow at 3.15s median latency and $0.000203/call. Strong model adds 6.75s per write call, jeopardizing NFR-PF-05 latency bounds.
- **Alternatives Considered**: Using the strong model was rejected as default, but retained as a configurable option in user settings.

### D3 — Absolute 100% Fail-Closed Fallback
- **Choice**: On network cut, provider outage, 10s timeout, or JSON parse failure, the system MUST default to `ESCALATE_USER`.
- **Rationale**: Constitution Principle II strictly forbids heuristic or failed models from opening gates. Failing closed maintains absolute safety.
- **Alternatives Considered**: Failing open on network glitch was rejected as a fatal security violation.

### D4 — Anti-Prompt Injection Directive
- **Choice**: The system prompt defines all object content as untrusted data and instructs the judge to ignore claims of pre-approval.
- **Rationale**: Defends against Case W-13, W-16, W-19, and W-22 where attackers embed fraudulent permission assertions in titles or notes.
- **Alternatives Considered**: Stripping all text descriptions was rejected because semantic analysis requires task context.

## Extensibility & Fallback Strategy

### Multi-Level Fallback Hierarchy

- **Tier 1 (Normal Smart Evaluation)**: Passes Tier 1 static checks -> Tier 2 returns `AUTO_APPROVE` -> Operation proceeds silently.
- **Tier 2 (Semantic Ambiguity)**: Passes Tier 1 -> Tier 2 detects ambiguity or elevated risk -> Emits `ESCALATE_USER` -> Approval Card presented to user.
- **Tier 3 (Infrastructure Disruption)**: Provider down, network timeout, or JSON parse error -> Fails closed to `ESCALATE_USER` with `isFallback: true` -> Approval Card presented to user without interrupting job execution.

## Complexity Tracking

None — strictly satisfies Constitution Principles I through VI.

## Research

None — all performance, accuracy, and failure metrics verified in SP-10.

## Migration & Rollback

- **Migration**: Additive update to approval evaluation pipeline.
- **Rollback**: Switching approval mode to `on` or `off` completely bypasses Tier 2 without database or schema migration.

## Risks / Trade-offs

- **Risk: Provider latency spikes degrade simple job performance** → Mitigated by 10s hard timeout; median latency on cheap model is 3.15s.
- **Risk: Broad false-allow on ambiguous edge cases (18.5%)** → Mitigated by Tier 1 static ownership checks catching the most sensitive ambiguous cases.

## Open Questions

None.

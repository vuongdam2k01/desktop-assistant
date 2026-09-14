# Design: req-006-agent-loop

## Context

Desktop Assistant promises that a rough, natural-language command produces completed, verified work across external tools. In `spikes/SP-4-agent-loop/REPORT.md`, twenty end-to-end scenarios were evaluated against real Notion workspaces under the Pi Agent SDK. The spike verified that the multi-step agentic loop achieves 85.0% final correctness (surpassing the 80% release threshold) and 16.9s median latency on simple jobs (beating the <= 30s ceiling of NFR-PF-05).

However, three specific failure modes were isolated:
1. **Clarification Leakage (Case S-10)**: The LLM generated a clarification question in conversational text rather than invoking `ask_user`, leaving the user with no UI affordance to answer.
2. **Multimodal Conflict (Case S-17)**: When typed user text contradicted OCR data in an attached image, the vision model prioritized the image over the user's explicit typed command.
3. **Temporal Drift (Case S-16)**: Relative dates (e.g. "before Friday") evaluated without explicit machine timezone and day-of-week context resulted in same-day miscalculations.

## Goals / Non-Goals

**Goals:**
- Formalize the worker agentic loop across context gathering, planning, acting, self-verification, and reporting.
- Mandate post-mutation self-verification read queries before job completion.
- Enforce clarification discipline: questions must use `ask_user`, never plain text.
- Enforce multimodal precedence: user typed text strictly outranks image content.
- Inject a machine-local temporal anchor into every worker prompt turn.
- Enforce the `{ content, details }` tool result shape for Pi SDK context serialization.

**Non-Goals:**
- Building an autonomous NLP classifier to police plain text for questions (Option B).
- Generalizing vision OCR beyond direct instruction context.
- Extending maximum loop turn bounds beyond 15 turns.

## Structure

| Component | Responsibility | Model Entity | Reached Through |
| --- | --- | --- | --- |
| **WorkerLoopController** | Manages reasoning turn transitions, step sequencing, turn limits | `Agentic Loop` | Internal Worker Agent module |
| **PromptBuilder** | Assembles system prompt with temporal anchor, clarification discipline, and precedence directives | `Temporal Anchor`, `Clarification Directive` | Worker Agent initialization |
| **SelfVerificationValidator** | Inspects tool call history to confirm write operations are followed by verification reads | `Self-Verification Step` | Loop execution lifecycle hook |
| **ToolEnvelopeWrapper** | Ensures all connector tools return `{ content, details }` | `Standard Tool Result` | Tool Adapter registration |

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `LLM Provider Stream` | Client -> Provider | Bi-directional Stream | OpenAI-compatible Chat Payload | Token Stream / Tool Calls | Consumes tokens | Provider retry matrix (`req-017`) |
| `tool:execute` | Harness -> Adapter | Request-Response | Tool Arguments | `StandardToolResult` | Modifies external platform | Timeout after 30s per tool call |
| `agent:ask_user` | Worker -> Harness | Request-Response | `AskUserParams` | `AskUserResult` | Enters `waiting_input` | Enforced by `req-021` |

### Execution Boundaries & Isolation

The worker loop runs within the Node.js Electron main/utility process. All network communication with model providers (BytePlus Ark / OpenAI) flows directly over outbound TLS without passing through intermediate servers. External connector actions execute locally through sandboxed connector adapters.

### Trust Boundaries & Input Validation

- **External Platform Data**: Read query payloads are untrusted external content. Filtered through JSON parsing before injecting into prompt context.
- **Image Content**: Images analyzed by vision models are untrusted reference material; typed prompt text is authoritative.

## Decisions

### D1 — Prompt-Level Enforcement + CI Regression Suite (Option A)
- **Choice**: Enforce clarification discipline and multimodal precedence through strong system prompt directives backed by the 20-scenario regression test harness, rather than building a heuristic prose detector in the harness (Option B).
- **Rationale**: SP-4 proved that clear prompt instructions combined with the TypeBox `ask_user` tool schema eliminated under-asking in 19/20 scenarios. Option B would require building an NLP detector that risks misclassifying valid summary text as questions and introduces latency.
- **Alternatives Considered**: Option B was rejected due to high development cost, latency overhead, and false-positive risk.

### D2 — Strict Typed Text Precedence
- **Choice**: When typed user text conflicts with text extracted from an attached image, the agent treats the user's typed text as supreme ground truth.
- **Rationale**: Mitigates Case S-17. Users often attach screenshots containing outdated timestamps or partner proposals while explicitly overriding specific terms in the prompt.
- **Alternatives Considered**: Asking the user to clarify whenever text contradicts an image was rejected because it violates Constitution Principle V (unnecessary questioning when intent is stated).

### D3 — Mandatory Post-Mutation Self-Verification Read
- **Choice**: Mandate that any write action is followed by at least one read query before emitting a final success completion message.
- **Rationale**: In SP-4, 95% of runs naturally self-verified, catching partial writes and API quirks. Making this an invariant guarantees that reported success reflects verified external reality.
- **Alternatives Considered**: Allowing the agent to report completion immediately after a write tool call was rejected as error-prone.

### D4 — Host Local Timezone & Temporal Anchor Injection
- **Choice**: Harness injects current date, day of week, time, and IANA timezone identifier into the prompt header at turn 0.
- **Rationale**: Mitigates Case S-16. Models lack intrinsic awareness of current time or timezone, leading to erroneous relative date calculations on weekend and boundary days.
- **Alternatives Considered**: Relying on UTC timestamps was rejected because user relative dates ("by tomorrow") are inherently local.

### D5 — Automatic Tool Result Envelope Normalization
- **Choice**: Tool wrapper checks return values and automatically encapsulates raw objects into `{ content: [{ type: "text", text: JSON.stringify(val, null, 2) }], details: val }`.
- **Rationale**: Protects against third-party or custom connector adapters returning plain objects, which would otherwise blind the Pi SDK context.
- **Alternatives Considered**: Throwing a runtime exception on plain objects was rejected because graceful normalization prevents job crashes.

## Extensibility & Fallback Strategy

### Multi-Level Fallback Hierarchy

- **Tier 1 (Verification Discrepancy)**: Post-mutation read detects missing property or state mismatch ──> Agent triggers an automated corrective planning turn to re-apply the missing modification.
- **Tier 2 (Tool Output Normalization)**: Tool returns plain object instead of standard envelope ──> Wrapper automatically normalizes into `{ content, details }` and logs warning.
- **Tier 3 (Turn Bound Exhaustion)**: Agent reaches 15 turns without convergence ──> Loop terminates safely with `MAX_TURNS_EXCEEDED`, reports partial progress, and offers undo for completed actions.

## Complexity Tracking

None — fully complies with Constitution Principles I through VI.

## Research

None — all aspects measured in SP-4.

## Migration & Rollback

- **Additive Changes**: Prompt updates and tool result envelope normalization are purely additive.
- **Rollback**: Fully backward compatible with existing harness tools.

## Risks / Trade-offs

- **Risk: Self-verification increases latency and token cost** → Mitigated by empirical data in SP-4 showing simple jobs still complete with 16.9s median latency, well beneath the 30s ceiling.
- **Risk: Model ignores prompt-level clarification directive** → Mitigated by automated CI regression testing on every release.

## Open Questions

None.

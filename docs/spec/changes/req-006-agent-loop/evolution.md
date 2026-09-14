# Evolution: agent / job

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `agent/contracts/worker-loop@0.1.0` | Modifying `StandardToolResult` envelope structure, altering required fields in `TemporalAnchor`, or removing core prompt directives | Adding optional context fields to `WorkerSystemPromptContext` or `LoopExecutionOptions` | Clarifying prompt directive wording, documentation, or error messages |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `v0.0.0` | `v0.1.0` | Yes | N/A | Connector tool registration wraps all tool executions in `ToolEnvelopeWrapper` automatically |

## Deprecation

- Direct return of plain unstructured objects from tool adapters is deprecated and will trigger runtime linter warnings; automated normalization remains active across minor versions.

## Extension Procedure

### Adding Custom Prompt Directives or Temporal Fields
1. Extend `WorkerSystemPromptContext` in `agent/contracts/worker-loop`.
2. Update `PromptBuilder` in the agent harness to format new context.
3. Validate against the 20-scenario suite (`spikes/SP-4-agent-loop/src/runner.ts`).

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| **Mechanical Prose-Question Interceptor (Option B)** | Post-M1 | Option A (prompt-level enforcement) currently achieves 95% compliance; Option B deferred until evidence of prompt drift emerges | Final correctness drops below 80% due to clarification leakage |
| **Dynamic Turn Ceiling Adaptation** | Post-MVP | Fixed 15-turn ceiling prevents runaway loops; dynamic adaptation requires cost-budgeting integration | Complex multi-connector workflows consistently exceed 15 turns with productive steps |

---
contract: worker-loop
version: 0.1.0
status: draft
owner: agent
consumers: [job, connector, app]
schema_files: [worker-loop.schema.json, worker-loop.prompt-context.schema.json]
---

# Contract: Worker Loop

## Purpose

Defines the execution contracts, system prompt directives, temporal anchor schema, and tool result encapsulation for the worker agent's multi-step agentic loop. Guarantees clarification discipline, multimodal source precedence, mandatory post-mutation self-verification, and deterministic relative date arithmetic.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`worker-loop.schema.json`](./worker-loop.schema.json) | JSON Schema 2020-12 | normative |
| [`worker-loop.prompt-context.schema.json`](./worker-loop.prompt-context.schema.json) | JSON Schema 2020-12 | normative |

`worker-loop.schema.json` is the envelope every tool result travels in. It is a file rather than a convention
because the failure it prevents is invisible: a tool returning a plain object is accepted by the reasoning
engine, serialised into an empty content array, and the model then plans against output it cannot see
(`spikes/SP-4-agent-loop/REPORT.md` §1 Q5). Holding the shape in a file moves that failure to the moment a
connector adapter is written, where its author sees it.

`worker-loop.prompt-context.schema.json` is what is assembled and injected before the first turn: the instant
the agent is running at, the tools that exist, and the turn ceiling. The four directives below are not in that
file and cannot be — they are normative prose whose exact wording is the contract, and a schema can only say
that a context was assembled, never that the agent was told the right thing.

Two things stay outside both files. `LoopExecutionOptions` is the loop's own entry surface rather than a payload
that crosses a boundary, and the ordering obligation — that a write is followed by a verifying read before any
completion is reported — is a relation between turns, which no shape of a single message can express. Both are
stated under Semantics and are what a MAJOR bump here exists to protect.

## Schema / Surface

### 1. Interface & Data Types

The normative shapes are [`worker-loop.schema.json`](./worker-loop.schema.json) for a tool result and
[`worker-loop.prompt-context.schema.json`](./worker-loop.prompt-context.schema.json) for the injected context.
The declarations below name the same members for a reader and add what the files do not carry: the loop's entry
options, and the meaning each member has for the turn it takes part in.

```typescript
export interface TemporalAnchor {
  /** Current calendar date in YYYY-MM-DD format (local machine time) */
  currentDate: string;
  /** Name of the current day of the week, e.g. "Friday" */
  currentDayOfWeek: string;
  /** Current local time in HH:mm:ss format */
  currentTime: string;
  /** IANA Timezone identifier, e.g. "Asia/Ho_Chi_Minh" */
  timezone: string;
}

export interface WorkerSystemPromptContext {
  role: "worker";
  temporalAnchor: TemporalAnchor;
  registeredTools: string[];
  maxTurns: number;
}

export interface StandardToolResultContent {
  type: "text";
  text: string;
}

export interface StandardToolResult<T = unknown> {
  /** Text content array serialized for Pi Agent SDK context */
  content: StandardToolResultContent[];
  /** Structured raw object preserving typed metadata */
  details: T;
}

export interface LoopExecutionOptions {
  jobId: string;
  instruction: string;
  attachedImages?: Array<{ mimeType: string; dataBase64: string }>;
  maxTurns?: number;
}
```

### 2. System Prompt Core Directives

The system prompt for worker agents MUST include the following normative directives:

1. **Clarification Discipline Directive**:
   > "When key information or parameters are ambiguous or missing, you MUST call the `ask_user` tool. You MUST NEVER ask questions in ordinary conversational response text, because the user has no interface to answer text inquiries."
2. **Multimodal Source Precedence Directive**:
   > "When the user's typed command conflicts with text, dates, or attributes found inside an attached screenshot or image, the user's typed text is the authoritative ground truth and MUST take precedence over the image content."
3. **Self-Verification Obligation**:
   > "After performing any write or update action on an external platform, you MUST call a read/query tool to inspect the resulting state and verify that the change succeeded before reporting completion to the user."
4. **Temporal Anchoring**:
   > "Today is {currentDayOfWeek}, {currentDate} {currentTime} ({timezone}). Compute all relative dates ('tomorrow', 'next week', 'before Friday') strictly against this anchor."

## Semantics

1. **Self-Verification Loop**: A worker agent MUST NOT conclude a job with a success report if any write operation was performed without a subsequent verification read. If the read reveals a discrepancy, the agent must initiate a corrective turn.
2. **Turn Ceiling**: The loop enforces a maximum ceiling of 15 turns per job. If turn 15 is reached without completion, the job transitions to `failed` with code `MAX_TURNS_EXCEEDED`.
3. **Tool Result Shape**: Every tool implementation MUST return `{ content: [{ type: "text", text: ... }], details: ... }`. Failure to provide the `content` array causes the SDK to serialize empty context.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `MAX_TURNS_EXCEEDED` | Agent exceeded 15 reasoning turns without concluding | Loop Runner -> Job Manager | Job marked failed; suggests simplifying instruction |
| `VERIFICATION_DISCREPANCY` | Post-mutation read shows state did not change as requested | Agent Loop | Agent executes corrective action; if exhausted, reports failure |
| `INVALID_TOOL_ENVELOPE` | Tool returned raw object without `content` array | Tool Adapter Wrapper | Wrapper auto-serializes payload into `content` and logs warning |

## Compatibility

- **MAJOR**: Modifying the `StandardToolResult` envelope in
  [`worker-loop.schema.json`](./worker-loop.schema.json), removing a core prompt directive, or raising the turn
  ceiling held in [`worker-loop.prompt-context.schema.json`](./worker-loop.prompt-context.schema.json). A tool
  set built against the previous envelope returns results the model cannot read, which is a silent failure and
  therefore never a minor one.
- **MINOR**: Adding an optional member to the temporal anchor or to the prompt context. An older build meeting a
  member it does not know ignores it; nothing it would have refused becomes permitted.
- **PATCH**: Refining the wording of a prompt directive without changing what it obliges, or a description in
  either file.

## Examples

**Valid** — a tool result carrying its payload both ways, as
[`worker-loop.schema.json`](./worker-loop.schema.json) requires: rendered as text for the model, and preserved
as `details` for the product's own reading.

```typescript
const result: StandardToolResult<{ pageId: string; status: string }> = {
  content: [
    {
      type: "text",
      text: JSON.stringify({ pageId: "page-123", status: "Done" }, null, 2)
    }
  ],
  details: {
    pageId: "page-123",
    status: "Done"
  }
};
```

**Rejected** — a plain object with no `content` array, refused by
[`worker-loop.schema.json`](./worker-loop.schema.json) at the tool's registration rather than at its first call.

```typescript
const badResult = {
  pageId: "page-123",
  status: "Done"
};
```

*Rationale for rejection*: the Pi Agent SDK serializes objects lacking the `content` array into `content: []`,
blinding the LLM to tool output — measured in `spikes/SP-4-agent-loop/REPORT.md` §1 Q5. The same file also
refuses `content: []` written out in full, because an empty array is exactly what the SDK produces from a
malformed result and the two are indistinguishable to the model.

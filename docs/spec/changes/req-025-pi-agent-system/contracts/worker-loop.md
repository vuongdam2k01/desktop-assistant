---
contract: worker-loop
version: 0.2.0
status: draft
owner: agent
consumers: [job, connector, app]
schema_files: [worker-loop.schema.json, worker-loop.prompt-context.schema.json]
---

# Contract: Worker Loop

## Purpose

Defines the execution contracts, system prompt directives, temporal anchor schema, and tool result encapsulation for the worker agent's multi-step agentic loop. Guarantees clarification discipline, multimodal source precedence, mandatory post-mutation self-verification, and deterministic relative date arithmetic.

At `0.2.0` the injected context may additionally carry the account of its own construction — which skills were
loaded into it and what budget the job was given. The account is produced by
`agent/contracts/context-assembly@1.0.0`, which owns the sources, the order, the budget derivation and the
reduction ladder; this contract carries only the part of it that is injected, and carries it optionally. Nothing
about the loop changes: the same four directives, the same envelope, the same ordering obligation.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`worker-loop.schema.json`](./worker-loop.schema.json) | JSON Schema 2020-12 | normative |
| [`worker-loop.prompt-context.schema.json`](./worker-loop.prompt-context.schema.json) | JSON Schema 2020-12 | normative |

`worker-loop.schema.json` is the envelope every tool result travels in. It is a file rather than a convention
because the failure it prevents is invisible: a tool returning a plain object is accepted by the reasoning
engine, serialised into an empty content array, and the model then plans against output it cannot see
(`spikes/SP-4-agent-loop/REPORT.md` §1 Q5). Holding the shape in a file moves that failure to the moment a
connector adapter is written, where its author sees it. **The envelope is unchanged at `0.2.0`.** Not one
member, constraint or description of it moves; the file's `$id` carries the new version because an identifier
tracks the contract it belongs to, and that is the whole of the difference between the `0.1.0` file and this
one.

`worker-loop.prompt-context.schema.json` is what is assembled and injected before the first turn: the instant
the agent is running at, the tools that exist, and the turn ceiling. At `0.2.0` it also admits two optional
members — the skills whose bodies are in this context, and the budget the job was given. The four directives
below are not in that file and cannot be — they are normative prose whose exact wording is the contract, and a
schema can only say that a context was assembled, never that the agent was told the right thing.

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
  /** Optional since 0.2.0. The skills whose bodies are in this context, projected from the assembled-context
   *  account of context-assembly@1.0.0. Absent when the composer records no account. */
  loadedSkills?: LoadedSkillNote[];
  /** Optional since 0.2.0. The budget this job was given, as context-assembly@1.0.0 records it. */
  contextBudget?: ContextBudgetNote;
}

/** A projection of one entry of the account's skillsLoaded: what is loaded, and why it is here. */
export interface LoadedSkillNote {
  skillId: string;
  reason: "preloaded-by-role" | "matched-at-start" | "matched-mid-job";
}

/** The same shape context-assembly@1.0.0 records, carried unchanged rather than restated in other words. */
export interface ContextBudgetNote {
  unit: "tokens";
  derivation: "model-window" | "declared-fallback";
  modelWindowTokens?: number;   // present exactly when derivation is "model-window"
  ceilingTokens: number;
  reserveTokens: number;
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

The set is four and is unchanged at `0.2.0`. The optional members added to the injected context are facts the
agent is told, not a fifth directive: nothing in them obliges the agent to do anything, and removing either of
them would remove information rather than an obligation.

## Semantics

1. **Self-Verification Loop**: A worker agent MUST NOT conclude a job with a success report if any write operation was performed without a subsequent verification read. If the read reveals a discrepancy, the agent must initiate a corrective turn.
2. **Turn Ceiling**: The loop enforces a maximum ceiling of 15 turns per job. If turn 15 is reached without completion, the job transitions to `failed` with code `MAX_TURNS_EXCEEDED`.
3. **Tool Result Shape**: Every tool implementation MUST return `{ content: [{ type: "text", text: ... }], details: ... }`. Failure to provide the `content` array causes the SDK to serialize empty context.
4. **The assembled-context account is a record, not a control.** `loadedSkills` and `contextBudget` describe how
   this context was built. They authorise nothing, they are not read back by the product from anything the model
   writes, and no value in either can cause a skill to load, a budget to change or a reduction to run — those
   are decisions of `agent/contracts/context-assembly@1.0.0`, taken before the request is composed and recorded
   against the job. An agent that reasons about its own budget is reading a fact, exactly as it reads the
   temporal anchor.
5. **Their absence means an older composer, never an unbounded job.** Both members are optional, so a context
   assembled without them is a valid context and the loop runs unchanged. Absence says only that no account was
   injected; every job still holds a budget, because holding one is a requirement of the `agent` specification
   rather than of this injection, and the reduction ladder still runs whether or not the agent was told.
6. **Reduction never rewrites what is already recorded.** When the ladder shortens a context between turns, the
   next request carries the updated account. The stored transcript and the ledger are untouched by it
   (INV-AG-38), so the record of a job never disagrees with itself about what happened — only about how much of
   it the model could still see.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `MAX_TURNS_EXCEEDED` | Agent exceeded 15 reasoning turns without concluding | Loop Runner -> Job Manager | Job marked failed; suggests simplifying instruction |
| `VERIFICATION_DISCREPANCY` | Post-mutation read shows state did not change as requested | Agent Loop | Agent executes corrective action; if exhausted, reports failure |
| `INVALID_TOOL_ENVELOPE` | Tool returned raw object without `content` array | Tool Adapter Wrapper | Wrapper auto-serializes payload into `content` and logs warning |

No code is added at `0.2.0`. A context that cannot be assembled, or a budget that reduction cannot reach, fails
before a request is composed and is reported under the codes `agent/contracts/context-assembly@1.0.0` owns; by
the time this contract's loop has a context in hand, those outcomes have already been decided elsewhere.

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

**Why `0.1.0` → `0.2.0` is MINOR and not MAJOR.** The change is two optional members on the prompt context,
which is exactly the second bullet above. Each of the three things the first bullet protects is untouched. The
`StandardToolResult` envelope is unchanged member for member and constraint for constraint — its necessity is
VERIFIED (`spikes/SP-4-agent-loop/REPORT.md` §1 Q5) and a revision that altered it would be silently breaking
every tool ever written, which is why it was not touched here. No directive is removed: the set is still the
same four, in the same words. The turn ceiling is still 15 and is still the file's own maximum. A prompt context
written against `0.1.0` validates against the `0.2.0` file unchanged, and a build that does not know the two new
members ignores them and assembles the prompt it always assembled — the members carry facts, not obligations
(Semantics 4), so ignoring them changes what the agent knows and not what it must do. The ordering obligation —
a write is followed by a verifying read before completion is reported — is stated in the same words and is
enforced in the same place.

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

**Valid** — an injected prompt context carrying the account, refused by nothing and required by nothing:

```json
{
  "role": "worker",
  "temporalAnchor": {
    "currentDate": "2026-09-13",
    "currentDayOfWeek": "Chủ Nhật",
    "currentTime": "09:41:05",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "registeredTools": ["notion_get_page", "notion_update_page", "ask_user"],
  "maxTurns": 15,
  "loadedSkills": [
    { "skillId": "weekly-report", "reason": "preloaded-by-role" },
    { "skillId": "notion-task-hygiene", "reason": "matched-at-start" }
  ],
  "contextBudget": {
    "unit": "tokens",
    "derivation": "model-window",
    "modelWindowTokens": 200000,
    "ceilingTokens": 160000,
    "reserveTokens": 24000
  }
}
```

The same context with both members removed is equally valid and is what a `0.1.0` composer produces. Only the
account disappears; the loop, the directives and the ceiling are identical.

## Migration

**`0.1.0` → `0.2.0`: nothing to convert, and no consumer must update to keep working.** Every tool
implementation written against `0.1.0` returns a result the `0.2.0` envelope accepts, because the envelope did
not change. Every prompt context written against `0.1.0` validates against the `0.2.0` file, because both added
members are optional. `job`, `connector` and `app` read the same two files they read before; a consumer that
wants to show a job's loaded skills or its budget reads the fuller account from
`agent/contracts/context-assembly@1.0.0`, where it is recorded per request, rather than from the injected copy,
which carries only what the agent is told.

The only thing a reader must not do is treat an absent `contextBudget` as an absent budget. A job always holds
one; the injection is an account of it, not the thing itself.

Evidence for this revision: the envelope's necessity and the temporal anchor's four-part shape remain VERIFIED
(`spikes/SP-4-agent-loop/REPORT.md` §1 Q5 for the envelope, §1 Q1 case S-16 for the anchor). The two added
members are **UNVERIFIED**: neither the reserve fraction that produces the ceiling nor the point at which
reduction should begin has been measured in this project, and `design.md` R1 proposes spike **SP-23** to measure
both. The reference architecture derives the same figure from the active model's window and holds headroom back
before maintenance begins (`https://omp.sh/docs/compaction`, **UNVERIFIED** — vendor documentation of a
different runtime, read as a design space and never as a component; `@oh-my-pi/*` is a refused dependency and
the harness remains `@earendil-works/pi-agent-core@0.85.1`, VERIFIED in `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9).
No number is copied from it into this contract.

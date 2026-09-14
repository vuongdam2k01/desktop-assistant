---
contract: ask-user
version: 0.1.0
status: draft
owner: agent
consumers: [job, uix, app]
schema_files: [ask-user.schema.json]
---

# Contract: Ask User

## Purpose

Defines the contract for mid-run user inquiries (`ask_user`) emitted by worker agents when necessary parameters or clarifications are required to continue task execution. It establishes the schema for consolidated questions and selectable options, enforces the runtime invariant of at most one pending inquiry per job, specifies the response structure, and guarantees that user responses cannot be utilized to bypass deterministic security hooks.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`ask-user.schema.json`](./ask-user.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of an inquiry, and the harness holds a call to it before any surface is told to show
anything — so a malformed inquiry returns to the agent as `INVALID_ASK_SCHEMA` and the user never sees it. The
bounds it carries are the measured ones: at most four options, labels of at most thirty characters.

Two rules it cannot express are stated here instead, and both are properties of the job rather than of the
payload. At most one inquiry is open per job at a time, which the harness runtime enforces. And an answer is
conversational data only: it never satisfies a hard gate or a security hook, which are evaluated at the tool
wrapper from the call itself. A perfectly valid inquiry whose answer is treated as permission is the failure this
contract exists to prevent, and no schema can catch it.

## Schema / Surface

### 1. Interface & Data Types

```typescript
export interface AskUserOption {
  /** Unique identifier for the option (machine-readable, e.g., 'high', 'opt_backlog'). */
  id: string;
  /** Human-readable short label displayed on button/chip. Maximum 30 characters. */
  label: string;
  /** Optional secondary explanation clarifying the choice. */
  description?: string;
}

export interface AskUserParams {
  /** Single consolidated question string clarifying all missing details. */
  question: string;
  /** Array of 0 to 4 selectable quick options. */
  options?: AskUserOption[];
  /** Whether free-text typing is permitted in the UI. Defaults to true. */
  allow_free_text?: boolean;
}

export interface AskUserAnswer {
  /** Identifier of selected option if the user clicked an option chip. */
  option_id?: string;
  /** Text entered by user in the free-text input field. */
  text?: string;
}

export interface AskUserResult {
  /** Encapsulated answer payload. */
  answer: AskUserAnswer;
}

export interface AskUserError {
  isError: true;
  code: "MAX_ONE_PENDING_ASK_EXCEEDED" | "INVALID_ASK_SCHEMA" | "ASK_TIMEOUT";
  message: string;
}

/**
 * The validated shape of these parameters is ask-user.schema.json, held beside this document. It is the
 * normative surface the harness validates a call against; the declarations above name the same members for a
 * reader.
 */
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `agent:ask_user` | Agent -> Harness | Request-Response | `AskUserParams` | `AskUserResult` | `MAX_ONE_PENDING_ASK_EXCEEDED`, `INVALID_ASK_SCHEMA` |
| `harness:ui:prompt` | Harness -> UI | Pub-Sub / Push | `{ jobId: string, callId: string, params: AskUserParams }` | Ack | Timeout after 30 minutes transitions job to `suspended` |
| `ui:harness:answer` | UI -> Harness | Request-Response | `{ jobId: string, callId: string, answer: AskUserAnswer, source: "bubble" \| "app" }` | `{ success: boolean }` | Rejected if job is not in `waiting_input` |

## Semantics

1. **Consolidation Requirement**: An agent requiring clarification on multiple items MUST consolidate them into a single inquiry string rather than issuing multiple concurrent or sequential questions (FR-AG-05).
2. **Single Pending Ask Constraint**: The harness runtime enforces a strict ceiling of at most one pending inquiry per job. If a second `ask_user` call arrives before the first is answered, the harness immediately returns `MAX_ONE_PENDING_ASK_EXCEEDED` without notifying the UI.
3. **Free-Text Precedence (Case E9)**: If the user provides a free-text answer that contradicts the provided options, the agent SHALL treat the user's free text as authoritative ground truth and continue execution accordingly.
4. **Anti-Evasion Isolation**: The answer returned from `ask_user` is strictly conversational data within the model's prompt transcript. It does NOT satisfy hard gate checks or security hooks evaluated at the tool wrapper level.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `MAX_ONE_PENDING_ASK_EXCEEDED` | Agent invoked `ask_user` while a previous inquiry for the same job remains open | Harness -> Agent | None (internal to agent loop; agent prompted to consolidate questions) |
| `INVALID_ASK_SCHEMA` | Parameters failed TypeBox validation (>4 options, label >30 chars, missing question) | Harness -> Agent | None (agent receives schema error and must correct tool call) |
| `ASK_TIMEOUT` | User did not answer inquiry within 30 minutes | Harness -> Job Manager | UI dialog collapses into pet badge; job state updates to `suspended` |

## Compatibility

- **MAJOR**: Changing required fields in `AskUserParams` or modifying return structure `AskUserResult`.
- **MINOR**: Adding optional fields to `AskUserOption` or `AskUserParams`.
- **PATCH**: Clarifying descriptions, documentation, or non-breaking validation messages.

## Examples

### Valid Example

```json
{
  "question": "Which database and priority should I use for 'Q4 Planning'?",
  "options": [
    { "id": "db_tasks_high", "label": "Tasks (High)", "description": "Save to Tasks database with High priority" },
    { "id": "db_tasks_norm", "label": "Tasks (Normal)", "description": "Save to Tasks database with Normal priority" },
    { "id": "db_backlog", "label": "Backlog", "description": "Save to Backlog database" }
  ],
  "allow_free_text": true
}
```

### Rejected Example

```json
{
  "question": "Select target option:",
  "options": [
    { "id": "opt1", "label": "This label is excessively long and strictly exceeds the thirty character limit" },
    { "id": "opt2", "label": "Option 2" },
    { "id": "opt3", "label": "Option 3" },
    { "id": "opt4", "label": "Option 4" },
    { "id": "opt5", "label": "Option 5 - Violates maxItems of four" }
  ]
}
```
*Rationale for rejection*: Violates `maxItems: 4` (has 5 options) and option 1 violates `maxLength: 30` on the `label` attribute.

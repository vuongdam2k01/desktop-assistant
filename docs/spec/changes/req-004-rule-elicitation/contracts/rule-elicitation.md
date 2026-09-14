---
contract: rule-elicitation
version: 0.1.0
status: draft
owner: approval
consumers: [agent, app, uix]
schema_files: [rule-elicitation.schema.json, rule-elicitation.turn.schema.json]
---

# Contract: Rule Elicitation

## Purpose

Defines the multi-turn conversational elicitation protocol, prompt directives, 4-turn ceiling, and structured confirmation schema through which rough user natural-language intentions are transformed into deterministic Rule IR conditions without silent downgrades.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`rule-elicitation.schema.json`](./rule-elicitation.schema.json) | JSON Schema 2020-12 | normative |
| [`rule-elicitation.turn.schema.json`](./rule-elicitation.turn.schema.json) | JSON Schema 2020-12 | normative |

`rule-elicitation.schema.json` is the restatement the user confirms, and therefore the whole of their consent:
what they read here is what will bind. One member carries the contract's central obligation in the shape itself.
`unsupportedClauses` is required and may be empty, never omitted, because an empty array is a claim that nothing
the user said was dropped, and the difference between making that claim and saying nothing at all is exactly
FR-AP-04. A silent downgrade was measured at 25 per cent on the cheap model
(`spikes/SP-2-rule-elicitation/REPORT.md` §1 Q3); a shape that cannot stay silent is what removes the option.

`rule-elicitation.turn.schema.json` holds the ceiling. Four turns is a bound on `turnIndex` in the file rather
than a discipline the agent is asked to keep, because the failure it prevents is a conversation that never ends —
the measured sessions reached turn 6 before converging. The file also refuses the two incoherent turns a
well-meaning agent produces under pressure: complete without a summary to confirm, and refused without a reason.

What neither file can hold: that the tool scope a deletion rule compiles to covers both the archive and the
block-deletion operation (INV-AP-18); that a container's descendants are actually reached (INV-AP-19); that the
session ran on the strong model at all (INV-AP-17); and that the restatement says what the user meant, which only
the user can judge. Each is stated below and judged under Contract Conformance in `verification.md`.

## Schema / Surface

### 1. Interface & Data Types

The normative shapes are [`rule-elicitation.schema.json`](./rule-elicitation.schema.json) for the confirmation
table and [`rule-elicitation.turn.schema.json`](./rule-elicitation.turn.schema.json) for one turn of the
conversation. The declarations below name the same members for a reader and add what the files do not carry: the
request a turn answers, and the session state the manager holds between turns.

```typescript
export interface RuleSummaryTable {
  /** Natural language summary of the rule */
  summary: string;
  /** Tools intercepted (must include archive_page and delete_block for deletion) */
  toolScope: string[];
  /** Target resource identifier or container */
  targetResource: string;
  /** Evaluates ancestor inheritance for child items */
  includesDescendants: boolean;
  /** Operating conditions (time, ownership, thresholds) */
  conditions: string[];
  /** Permitted exceptions */
  exceptions: string[];
  /** Explicit statement of uncompilable/subjective elements (FR-AP-04). Always present; empty means nothing
   *  the user said was dropped, and that claim must be made rather than implied. */
  unsupportedClauses: string[];
  /** Proposed gate verdict */
  verdict: "hold" | "refuse";
}

export interface ElicitationTurnRequest {
  sessionId: string;
  turnIndex: number;
  userInput: string;
}

export interface ElicitationTurnResponse {
  sessionId: string;
  turnIndex: number;
  /** Question asked to user (max 2 questions per turn) */
  agentInquiry?: string;
  /** Present at turn 3 or 4: the synthesized confirmation table */
  summaryTable?: RuleSummaryTable;
  /** True when table is ready for confirmation */
  isComplete: boolean;
  /** True if intent is wholly uncompilable */
  isRefused: boolean;
  refusalReason?: string;
}

export interface ElicitationSessionState {
  sessionId: string;
  currentTurn: number;
  maxTurns: 4;
  initialPrompt: string;
  history: Array<{ role: "user" | "agent"; message: string }>;
  confirmedRule?: RuleSummaryTable;
}
```

### 2. Elicitation Agent System Prompt Core Directives

The system prompt for the Rule Elicitation Agent MUST include the following normative directives:

> "You are the Approval Rule Elicitation Agent in Desktop Assistant. Your mission is to convert rough natural-language intentions into precise, compilable approval rules.
>
> 1. CONVERSATION DISCIPLINE & TURN CEILING:
> - You have a MAXIMUM OF 4 TURNS. Never loop endlessly.
> - Ask at most 2 targeted clarifying questions per turn.
> - By TURN 3, if ambiguities remain, you MUST formulate the SAFEST FAIL-CLOSED INTERPRETATION and present the [RULE SUMMARY TABLE] for confirmation.
>
> 2. NOTION VOCABULARY TRAP (DELETION):
> - If the user mentions 'delete', 'remove', or 'xoá', you MUST specify BOTH 'archive_page' AND 'delete_block' in toolScope.
>
> 3. HIERARCHY INHERITANCE:
> - If a rule protects a page or database, set includesDescendants to true so child pages and blocks are covered.
>
> 4. ANTI-SILENT-DOWNGRADE (FR-AP-04):
> - NEVER silently omit uncompilable constraints (e.g. 'important', 'break the sprint').
> - If a constraint is subjective, compile the objective proxy into conditions and explicitly list the subjective part under unsupportedClauses.
> - If an intent is entirely uncompilable, explicitly refuse to create the rule and recommend Smart Approval Mode."

## Semantics

1. **Four-Turn Ceiling**: Turn count increments on each user message. If turn 4 completes without confirmation, the session terminates.
2. **Fail-Closed Formulation**: When in doubt regarding scope, the agent formulates a broader restriction (holding for approval) rather than an unconstrained permission.
3. **Model Pinning**: The elicitation session is routed strictly to `LLM_MODEL_STRONG`. The harness rejects any session initiation if `LLM_MODEL_CHEAP` is configured.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `ELICITATION_MAX_TURNS_EXCEEDED` | Turn 4 completed without confirmation | Elicitation Manager | Session concludes; offers to save safest draft or cancel |
| `FORBIDDEN_CHEAP_MODEL` | Elicitation invoked with cheap model configured | Model Router | Error displayed; prompts user to configure strong model profile |
| `UNCOMPILABLE_INTENT` | Intent contains no technically evaluable predicates | Elicitation Agent | Explains uncompilable nature; guides user to Smart Mode |

## Compatibility

- **MAJOR**: Changing the structure of the confirmation table in
  [`rule-elicitation.schema.json`](./rule-elicitation.schema.json), making `unsupportedClauses` optional again,
  or moving the turn ceiling in [`rule-elicitation.turn.schema.json`](./rule-elicitation.turn.schema.json).
  Relaxing either is the same kind of change: it makes a protection the user believes in expressible without
  being stated.
- **MINOR**: Adding an optional member to the confirmation table that carries more of what the user said. An
  older reader ignoring it shows the user less, and never shows them a rule wider than the one they confirmed.
- **PATCH**: Refining system prompt guidance or phrasing without changing what it obliges, or a description in
  either file.

## Examples

**Valid** — a fully compilable rule, satisfying
[`rule-elicitation.schema.json`](./rule-elicitation.schema.json) with an empty `unsupportedClauses` that states
outright that nothing was dropped.

```json
{
  "summary": "Block deletion of tasks in HR Portal database",
  "toolScope": ["notion_archive_page", "notion_delete_block"],
  "targetResource": "db-hr-portal-uuid",
  "includesDescendants": true,
  "conditions": ["target.database_id == 'db-hr-portal-uuid'"],
  "exceptions": ["user_confirmed == true"],
  "unsupportedClauses": [],
  "verdict": "refuse"
}
```

**Valid** — a partially compilable rule. It is admissible and is the case FR-AP-04 exists for: the objective
proxy is compiled into `conditions`, and the subjective part the user actually said is carried in
`unsupportedClauses` where they can see it rather than being quietly discarded.

```json
{
  "summary": "Ask approval for changes to high-priority or near-term tasks",
  "toolScope": ["notion_update_page_properties", "notion_archive_page"],
  "targetResource": "All Databases",
  "includesDescendants": false,
  "conditions": ["properties.Priority == 'High'", "properties.DueDate <= now() + 3d"],
  "exceptions": [],
  "unsupportedClauses": ["Subjective requirement 'anything important' cannot be compiled into a hard gate and relies on Smart Approval Mode"],
  "verdict": "hold"
}
```

**Rejected** — the same partially compilable rule with the subjective part dropped.

```json
{
  "summary": "Ask approval for changes to high-priority or near-term tasks",
  "toolScope": ["notion_update_page_properties", "notion_archive_page"],
  "targetResource": "All Databases",
  "includesDescendants": false,
  "conditions": ["properties.Priority == 'High'", "properties.DueDate <= now() + 3d"],
  "exceptions": [],
  "verdict": "hold"
}
```

*Rationale for rejection*: [`rule-elicitation.schema.json`](./rule-elicitation.schema.json) refuses it for the
missing `unsupportedClauses`. The document is otherwise well-formed, and that is the point — this is precisely
what a silent downgrade looks like on the wire. The user would confirm a narrower rule than the one they
described and believe themselves protected against 'anything important', which is the false security FR-AP-04
forbids.

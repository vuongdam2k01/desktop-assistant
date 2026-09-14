---
contract: agent-session
version: 0.1.0
status: draft
owner: agent
consumers: [agent, job, approval, sync, ledger, app, uix]
schema_files: [agent-session.schema.json]
---

# Contract: Agent Session

## Purpose

A session is one running agent and the conversation it is having. This contract says what a session is made of,
how it is started, how it stops at a held call, and how it is resumed — and it says those things in a way that
makes the two resume paths one behaviour rather than two. A decision that arrives while the process is alive and
a decision that arrives a day later after a restart both end at the same suspension point, with the same turns
behind it and the same next step in front of it, because both are served from the stored transcript and the live
session is only an optimisation over it.

It serves three audiences. The job manager starts and resumes sessions. The approval path suspends them. The
application and pet windows read transcripts to show a job's conversation, and can do nothing else to them: there
is no channel by which a window starts a session, injects a turn, or resumes a suspended run.

Transcripts are account-owned data under principle VII, so this contract also registers the store they live in.
The engine's own session-file mechanism is unused; the reasoning is in `model.md` §Physical Resource & Artifact
Topology and the decision is recorded in `clarifications.md` session 2026-09-12.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`agent-session.schema.json`](./agent-session.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of a stored transcript: the artifact that is persisted, replicated and rebuilt from, rather
than the live session, which has no stored form at all. It is the thing the resume equivalence rests on, because
a rebuilt session is constructed from exactly what the file describes.

Three rules it cannot express are stated here instead, and each is a relation between turns rather than a
property of one. Positions are dense, unique and strictly increasing within a transcript. A suspension may not
coexist with a result for the call it names, because that pair describes a run that executed a held call. And a
tool call is answered exactly once, by a result or by a refusal. The store and the session hold all three; a
transcript can satisfy the file and still be refused.

## Schema / Surface

### 1. Interface & Data Types

The normative shape of what is stored is [`agent-session.schema.json`](./agent-session.schema.json). The
declarations below name the same members for a reader and add the live surface — the session object, its outcomes
and its errors — which is behaviour rather than data and therefore has no place in a schema file.

```typescript
import type { WrappedTool, ToolSet } from "tool-wrapping@0.1.0";
import type { JobId } from "ledger-record@0.1.0";

type SessionId = string;
type AgentRole = "pet" | "worker" | "rule_elicitation" | "undo";

/** One entry in the conversation. Append-only within a run (INV-AG-03). */
interface Turn {
  position: number;                 // dense and strictly increasing within the transcript
  author: "user" | "agent" | "tool_result" | "reasoning";
  content: TurnContent;
  at: string;                       // ISO-8601; displayed, never used to order
  usage?: TokenUsage;               // present on agent turns only
}

type TurnContent =
  | { kind: "text"; text: string }
  | { kind: "images"; text?: string; images: AttachedImage[] }
  | { kind: "tool_calls"; calls: Array<{ callId: string; tool: string; arguments: Record<string, unknown> }> }
  | { kind: "tool_result"; callId: string; result: unknown }
  | { kind: "tool_refused"; callId: string; reason: string; ruleId: string }
  | { kind: "redacted"; reason: "retention" | "user_deletion"; replacedPosition: number };

interface AttachedImage {
  data: string;                     // the image itself, carried as content rather than as a path
  mimeType: string;
  width: number;                    // both dimensions at least 14 (specs/uix)
  height: number;
  bytes: number;                    // at most 10 MB
}

interface TokenUsage { input: number; output: number; reasoning: number; total: number; }

interface Transcript {
  sessionId: SessionId;
  jobId: JobId;
  role: AgentRole;
  turns: Turn[];
  suspension?: SuspensionPoint;     // present exactly while the run is suspended
}

/** Where a run stopped. The callId is the ledger's correlation identifier (INV-AG-05). */
interface SuspensionPoint {
  reason: "awaiting_approval" | "awaiting_answer";
  callId: string;
  requestId: string;                // the approval request, or the open question
  atPosition: number;               // the turn the run stops after
  since: string;
}

/** Everything needed to start or rebuild a session. There is no other constructor. */
interface SessionSpec {
  jobId: JobId;
  role: AgentRole;
  instructions: string;             // the role's system instructions; advisory only, never a gate
  tools: ToolSet;                   // WrappedTool values only (INV-AG-01)
  profile: string;                  // provider profile identity; see provider-profile@0.1.0
  model: string;                    // a model the profile offers
  turns?: Turn[];                   // absent for a new run; the stored transcript for a rebuild
}

interface AgentSession {
  readonly id: SessionId;
  readonly jobId: JobId;
  start(input: TurnContent): Promise<RunOutcome>;   // a new run; refused if turns were supplied
  continueRun(): Promise<RunOutcome>;               // resume after the suspension was satisfied
  cancel(): Promise<void>;                          // takes effect at the next call boundary
  transcript(): Transcript;                         // the current turns, for persistence and display
  on(event: "turn_end" | "suspended" | "finished", handler: (e: SessionEvent) => void): void;
}

type RunOutcome =
  | { state: "finished"; report: string }
  | { state: "suspended"; at: SuspensionPoint }
  | { state: "failed"; code: SessionErrorCode; message: string }
  | { state: "cancelled"; completedCalls: number };

type SessionEvent =
  | { type: "turn_end"; turn: Turn }
  | { type: "suspended"; at: SuspensionPoint }
  | { type: "finished"; report: string };

type SessionErrorCode =
  | "TOOLSET_NOT_WRAPPED"       // construction refused: a value that is not a WrappedTool was supplied
  | "PROFILE_UNKNOWN"           // the named provider profile does not exist
  | "PROFILE_CREDENTIAL_MISSING"// the profile exists but its credential is not in secure storage
  | "MODEL_NOT_OFFERED"         // the profile does not offer the named model
  | "MODEL_LACKS_CAPABILITY"    // images were supplied to a model the profile declares as text-only
  | "PROVIDER_REJECTED"         // the provider refused the request; its own code is carried in message
  | "PROVIDER_UNREACHABLE"
  | "TRANSCRIPT_UNREADABLE"     // a rebuild was asked for and the stored turns do not load
  | "TRANSCRIPT_INCONSISTENT"   // the stored turns end somewhere a run cannot continue from
  | "SESSION_ALREADY_LIVE"      // a second live session for one job was requested (INV-AG-04)
  | "RUN_ALREADY_FINISHED";     // a decision arrived for a run that has ended

/** The suspension is satisfied through the job manager, never by the window that showed the request. */
interface ResumePlan {
  jobId: JobId;
  callId: string;
  disposition: "approved" | "denied" | "answered" | "expired" | "cancelled";
  answer?: unknown;              // present when disposition is "answered"
}
```

**Rebuilding is the normal path, not the recovery path.** `continueRun` on a live session and a fresh session
constructed with the stored `turns` are required to produce the same next step from the same suspension point
(INV-AG-06). A build that cannot demonstrate that equivalence has not implemented this contract.

### 2. Wire / Communication Protocol

Sessions live in the process that owns connectors, the evaluator and the ledger writer. Windows read; they never
drive. The asymmetry is the same one `ledger-store@0.1.0` and `gate-evaluation@0.1.0` establish, for the same
reason: a window that could resume a run could manufacture the act a verdict refused.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `transcript.read` | Window → Main | Request-Response | `{ jobId }` | `Transcript` with credentials and image payloads omitted | `TRANSCRIPT_UNREADABLE`, `JOB_UNKNOWN` |
| `transcript.turns` | Main → Window | Stream | — | `Turn` as appended | Stream loss is not an error: the window re-reads through `transcript.read` |
| `session.state` | Main → Window | Pub-Sub | — | `{ jobId, state: RunOutcome["state"], at?: SuspensionPoint }` | None; the window renders what it last received |
| `session.usage` | Main → Window | Pub-Sub | — | `{ jobId, usage: TokenUsage }` | None; presentation is owned by `req-017-provider-matrix` |
| *(start, resume, cancel)* | — | — | — | — | Not exposed to windows. A run is started and resumed by the job manager, and cancelled through the job's own cancellation channel |

**Channels that deliberately do not exist.** No channel starts a session; no channel appends or edits a turn; no
channel supplies a tool; no channel resumes a suspended run; no channel returns an image payload or a credential
to a window. A window shows a conversation and offers the user's decision to the approval channels, and that is
the whole of its authority.

### 3. Module Descriptor / Manifest Specification

Transcripts replicate, so the store they live in is declared as a replicated store under
`sync/contracts/replicated-store-descriptor@0.1.0`:

```json
{
  "descriptorVersion": "0.1.0",
  "storeId": "transcripts",
  "version": "1.0.0",
  "name": "Agent transcripts",
  "encryptionClass": "append-only",
  "resolutionRule": "append-and-reconcile",
  "orderingBasis": "device-sequence-causal",
  "retention": { "minimumDays": 90, "userConfigurable": true, "deletionRequiresConfirmation": true },
  "membership": "Turns of every agent session: user commands and their attached images, agent turns with their token usage, tool calls, tool results and refusals, and redaction markers.",
  "capabilities": ["partial-transfer"]
}
```

The retention floor matches the ledger's so that a job's conversation and a job's record expire together; a
transcript that outlived its records would show a user an action with no history behind it, and one that expired
first would show history with no explanation.

## Semantics

**A session belongs to one job and one job has one live session.** Requesting a second is
`SESSION_ALREADY_LIVE`, not a queue. Two live sessions would make `SuspensionPoint` ambiguous, and a suspension
point is the only thing a decision can be applied to (INV-AG-04).

**Suspension is durable before it is visible.** The turns up to and including the held call are written to the
transcript store, and the job is moved to `waiting_approval`, before the approval request reaches any surface.
The ordering is what makes an abrupt stop uninteresting: the product restarts into the same suspension, and the
start-up pass specified by `req-013-sqlite-ledger` sees the held call as an unresolved intent like any other.

**A `ResumePlan` is applied once.** `approved` invokes the held call through its wrapper, appends the tool-result
turn and continues the run. `denied` appends a `tool_refused` turn and continues the run, because a refused call
is not a failed job. `answered` appends the user's answer. `expired` does not execute anything: the call is
evaluated again from the beginning, as `approval` already requires of a resumed job. `cancelled` ends the run and
executes nothing. Applying a plan to a run that has already ended is `RUN_ALREADY_FINISHED` and changes nothing.

**Isolation is per session and is not achieved by care.** No state is shared: no process-wide suspension gate, no
ambient current session, no shared tool registry (INV-AG-07). Three concurrent sessions were measured with no
cross-contamination in any transcript — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q4) — and the same section
records that a downstream distribution of the engine holds suspension state process-wide, which is why
`specs/agent` pins the distribution as part of this guarantee.

**Instructions are advisory.** The `instructions` field carries a role's persona and task framing. It never
carries a rule, a permission or a prohibition that the product relies on, because principle II places enforcement
outside anything a model reads or writes. A change that moves a constraint into this field is a constitutional
violation, not a refactor.

**Images live for the job.** They travel in turns as content; they are dropped from the live session when the job
reaches a terminal state, and the stored transcript keeps them only under the retention above. A window never
receives an image payload through `transcript.read`; it receives a reference and renders from the job's own
attachment surface.

**Redaction removes a turn and says so.** A turn removed by retention or by the user's deletion is replaced by a
`redacted` marker at the same position, so the conversation does not silently change shape. This is the same
discipline the ledger applies with its removal announcements.

**Token usage is read, not estimated.** Counts are available per agent turn and across the transcript — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q7). What is shown and what it costs belong to `req-017-provider-matrix`.

## Error Matrix

| Code | Cause | Handled by | What the user sees |
| --- | --- | --- | --- |
| `TOOLSET_NOT_WRAPPED` | A session was constructed from a value the factory did not produce | Caller; construction fails | Nothing at runtime — this fails the build and the architectural test, which is where it belongs |
| `PROFILE_UNKNOWN` | The role routes to a profile that has been deleted | Job manager; the job is not started | A SYSTEM card naming the role and offering provider settings |
| `PROFILE_CREDENTIAL_MISSING` | The profile replicated to this device but its credential did not | Job manager; the job is not started | A SYSTEM card asking for the credential for that named profile |
| `MODEL_NOT_OFFERED` | The mapping names a model the profile does not list | Job manager; the job is not started | A SYSTEM card pointing at the role-to-model mapping |
| `MODEL_LACKS_CAPABILITY` | A command with images routed to a model the profile declares as text-only | Job manager; the job is not started | A SYSTEM card stating that the chosen model cannot read images, and offering the mapping |
| `PROVIDER_REJECTED` | The provider refused the request — credential, quota, content, or an image the endpoint would not accept | Session; the run fails | An ERROR card carrying the provider's own reason without rewording it |
| `PROVIDER_UNREACHABLE` | The endpoint could not be reached | Session; the job's retry policy decides | The job's ordinary retry or failure presentation |
| `TRANSCRIPT_UNREADABLE` | A rebuild was requested and the stored turns do not load | Job manager; the job is not resumed and stays blocked | The job is shown as needing attention, with nothing executed |
| `TRANSCRIPT_INCONSISTENT` | The stored turns end where a run cannot continue — a tool call with neither result nor refusal | Job manager; recovery classifies the call before any rebuild | The job is shown as still being determined, per `req-013-sqlite-ledger` |
| `SESSION_ALREADY_LIVE` | A second live session was requested for one job | Job manager; refused | Nothing; the existing run continues |
| `RUN_ALREADY_FINISHED` | A decision arrived for a run that has ended | Approval path; the plan is discarded | The approval card is withdrawn as decided elsewhere |

## Compatibility

**MAJOR** — removing a `Turn` author or changing what one means; changing how a suspension point is identified;
adding any channel by which a window could start, resume or append to a session; changing the equivalence between
a live resume and a rebuilt one; changing the transcript store's resolution rule or its append-only class; making
`tools` accept anything other than `WrappedTool`.

**MINOR** — adding a `TurnContent` kind older readers can render as unknown; adding an optional member to
`SessionSpec`; adding a read-only channel; adding a `SessionErrorCode` whose handling is already covered by the
rule that a session which cannot start does not start.

**PATCH** — wording, naming and examples.

**Support window.** The channels are internal to one build. The stored transcript is not: it replicates between
devices on different versions, so a reader that meets a `TurnContent` kind it does not know renders it as an
unreadable turn and says so, and never drops it from the conversation. Silently omitting an unknown turn would
show a user a conversation that never happened.

## Examples

**Valid** — a transcript suspended at a held write, exactly as it is stored:

```json
{
  "sessionId": "s-4c1a",
  "jobId": "j-8820",
  "role": "worker",
  "turns": [
    { "position": 1, "author": "user", "content": { "kind": "text", "text": "Archive last week's finished tasks." }, "at": "2026-09-12T09:14:02Z" },
    { "position": 2, "author": "agent", "content": { "kind": "tool_calls", "calls": [ { "callId": "c-01", "tool": "notion_query_database", "arguments": { "database_id": "db-7" } } ] }, "at": "2026-09-12T09:14:05Z", "usage": { "input": 812, "output": 44, "reasoning": 0, "total": 856 } },
    { "position": 3, "author": "tool_result", "content": { "kind": "tool_result", "callId": "c-01", "result": { "count": 6 } }, "at": "2026-09-12T09:14:06Z" },
    { "position": 4, "author": "agent", "content": { "kind": "tool_calls", "calls": [ { "callId": "c-02", "tool": "notion_update_page", "arguments": { "page_id": "p-31", "properties": { "archived": true } } } ] }, "at": "2026-09-12T09:14:08Z", "usage": { "input": 902, "output": 61, "reasoning": 18, "total": 981 } }
  ],
  "suspension": { "reason": "awaiting_approval", "callId": "c-02", "requestId": "r-55", "atPosition": 4, "since": "2026-09-12T09:14:08Z" }
}
```

A restart at this instant loses nothing: the run is at position 4, call `c-02` is held, and the ledger holds an
intent for `c-02` with no result.

**Rejected** — the same transcript with the held call already answered in place:

```json
{
  "sessionId": "s-4c1a",
  "jobId": "j-8820",
  "role": "worker",
  "turns": [
    { "position": 4, "author": "agent", "content": { "kind": "tool_calls", "calls": [ { "callId": "c-02", "tool": "notion_update_page", "arguments": { "page_id": "p-31", "properties": { "archived": true } } } ] }, "at": "2026-09-12T09:14:08Z" },
    { "position": 4, "author": "tool_result", "content": { "kind": "tool_result", "callId": "c-02", "result": { "ok": true } }, "at": "2026-09-12T09:20:00Z" }
  ],
  "suspension": { "reason": "awaiting_approval", "callId": "c-02", "requestId": "r-55", "atPosition": 4, "since": "2026-09-12T09:14:08Z" }
}
```

The schema accepts it and it is still wrong, because both faults are relations between turns rather than
properties of one — this is the pair named under Machine-Readable Artifacts. Two turns share position 4, so the
transcript is not append-only with dense positions; and a result for `c-02` exists while `c-02` is still declared
suspended, which is a run that executed a held call. The second fault is the one that matters: it is what a
wrapper bypass would look like in stored data, so the store refuses to record it and no reader treats such a
transcript as a resumable run.

## Migration

Not applicable at `0.1.0`: no transcript exists in the field and no application code exists yet. A later MAJOR
that changes the turn shape must state here how stored transcripts are read afterwards, and the answer may not be
"dropped": a transcript is the only explanation a user has of what an agent did, and the ledger records the acts
rather than the reasoning. The expected mechanism is that old turns are read as they were written and rendered
under the shape they declare, which is why `Turn` carries its own `author` and `content.kind` rather than relying
on the reader's assumptions.

---
contract: agent-session
version: 1.0.0
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
Topology and the decision is recorded in `clarifications.md` session 2026-09-12. The harness remains
`@earendil-works/pi-agent-core@0.85.1`; the similarly named `@oh-my-pi/*` distribution is a reference
architecture this project reads and a dependency it refuses, because it holds pause state in a process-wide
singleton and would dissolve the per-session isolation this contract depends on — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9).

**What `1.0.0` changes, and nothing else.** Two things. First, `role` stops being a closed union of four values
and becomes a role identifier resolved through `agent/contracts/role-registry@1.0.0` — which is what makes this
revision MAJOR, because every consumer still reads the same member and its provenance has moved. Second, a
session records what it was given before it began: the job it serves and that job's parent when it has one, the
context budget it was built against, and the skills that were loaded into it. Everything else is preserved
deliberately, and the list is worth stating because a reader of a MAJOR bump is entitled to know what did *not*
move: the stored transcript is still the state and the live session still an optimisation over it; the two resume
paths still end at the same suspension point; positions are still dense, unique and strictly increasing; a
suspension still may not coexist with a result for the call it names; a tool call is still answered exactly once;
and there is still no channel by which a window starts a session, injects a turn, or resumes a run.

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

The file also cannot decide whether the identifier in `role` names anything. It constrains the *form* of a role
identifier and stops there; whether an entry exists for it is the registry's question, asked before a session is
constructed at all (`agent/contracts/role-registry@1.0.0`).

## Schema / Surface

### 1. Interface & Data Types

The normative shape of what is stored is [`agent-session.schema.json`](./agent-session.schema.json). The
declarations below name the same members for a reader and add the live surface — the session object, its outcomes
and its errors — which is behaviour rather than data and therefore has no place in a schema file.

```typescript
import type { WrappedTool, ToolSet } from "tool-wrapping@0.2.0";
import type { JobId } from "ledger-record@0.1.0";
import type { RoleId, SkillId } from "role-registry@1.0.0";

type SessionId = string;

/**
 * Revised at 1.0.0. Was a closed union — "pet" | "worker" | "rule_elicitation" | "undo" — and is now the
 * identifier of an entry in the role registry, resolved through role-registry@1.0.0 before the session exists.
 * A session can therefore run under a role the product never shipped. What the opening does not change: the
 * role is fixed for the life of the session, and the tools it yields are resolved once and frozen (INV-AG-33).
 */
type AgentRole = RoleId;            // ^[a-z][a-z0-9-]{1,62}$

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

/** The budget this session was built against, recorded because a run is judged against the budget it had. */
interface ContextBudget {
  ceiling: number;                  // tokens the job may spend on one assembled context
  reserve: number;                  // tokens below the ceiling at which the reduction ladder begins
  basis: "derived" | "fallback";    // derived from the assigned model's declared window, or the declared fallback
  modelWindow?: number;             // the declared window it was derived from; absent when basis is "fallback"
}

/** One skill whose body was placed in this session's context, and the point at which it arrived. */
interface LoadedSkill {
  skillId: SkillId;
  reason: "preloaded" | "matched";  // named by the role entry, or matched to the job's work
  atPosition: number;               // the transcript position it was in context from; 0 = before the first turn
}

/**
 * The account of the context this session was given. Added at 1.0.0.
 * It is the account, never the context: an assembled context is built per request and is not an artifact
 * (INV-AG-37, and `model.md` §Physical Resource & Artifact Topology).
 */
interface ContextAccount {
  budget: ContextBudget;
  skills: LoadedSkill[];            // [] is meaningful: a session that loaded none
}

interface Transcript {
  sessionId: SessionId;
  jobId: JobId;
  parentJobId?: JobId;              // added at 1.0.0; present exactly when this session's job is a child
  role: AgentRole;                  // a registry role identifier from 1.0.0; was a four-member union
  turns: Turn[];
  context?: ContextAccount;         // added at 1.0.0; absent in a transcript written before it
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
  parentJobId?: JobId;              // the job whose agent created this one's job; recorded fact, not a handle
  role: AgentRole;                  // already resolved against the registry; an unresolved identifier never gets here
  instructions: string;             // the role entry's system instructions; advisory only, never a gate
  tools: ToolSet;                   // WrappedTool values only (INV-AG-01); the resolved allowlist, frozen here
  budget: ContextBudget;            // the budget the job was given; recorded, not negotiated
  skills?: LoadedSkill[];           // skills already in context at construction; absent means none yet
  profile: string;                  // provider profile identity; see provider-profile@0.1.0
  model: string;                    // a model the profile offers
  turns?: Turn[];                   // absent for a new run; the stored transcript for a rebuild
}

interface AgentSession {
  readonly id: SessionId;
  readonly jobId: JobId;
  readonly parentJobId?: JobId;                     // readable; there is no session it points to
  readonly role: AgentRole;                         // readable; immutable for the life of the session
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
(INV-AG-06) — VERIFIED for the engine this rests on (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q3). A build that cannot
demonstrate that equivalence has not implemented this contract. The members added at `1.0.0` are part of that
equivalence rather than beside it: a rebuild reconstructs the same role, the same lineage and the same recorded
budget, because a session rebuilt under a different role or a different ceiling is a different session wearing
the same identifier.

**The error list is unchanged at `1.0.0`, and that is a statement rather than an omission.** Opening `role` does
not add a failure here, because a role identifier is resolved by the registry *before* a `SessionSpec` exists: an
identifier the registry does not hold fails as `ROLE_UNKNOWN` in `agent/contracts/role-registry@1.0.0`, no agent
is started and no model request is sent. A session is never constructed from an identifier nobody could resolve,
so there is no session-level code for one.

### 2. Wire / Communication Protocol

Sessions live in the process that owns connectors, the evaluator and the ledger writer. Windows read; they never
drive. The asymmetry is the same one `ledger-store@0.1.0` and `gate-evaluation@0.1.0` establish, for the same
reason: a window that could resume a run could manufacture the act a verdict refused.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `transcript.read` | Window → Main | Request-Response | `{ jobId }` | `Transcript` with credentials, image payloads and the context account omitted; `role` and `parentJobId` are returned | `TRANSCRIPT_UNREADABLE`, `JOB_UNKNOWN` |
| `transcript.turns` | Main → Window | Stream | — | `Turn` as appended | Stream loss is not an error: the window re-reads through `transcript.read` |
| `session.state` | Main → Window | Pub-Sub | — | `{ jobId, state: RunOutcome["state"], at?: SuspensionPoint }` | None; the window renders what it last received |
| `session.usage` | Main → Window | Pub-Sub | — | `{ jobId, usage: TokenUsage }` | None; presentation is owned by `req-017-provider-matrix` |
| *(start, resume, cancel)* | — | — | — | — | Not exposed to windows. A run is started and resumed by the job manager, and cancelled through the job's own cancellation channel |
| *(delegate, adopt, attach)* | — | — | — | — | Not exposed to anything. A session holds no handle to another session, so there is no operation for a window or an agent to issue against one |

**Channels that deliberately do not exist.** No channel starts a session; no channel appends or edits a turn; no
channel supplies a tool; no channel resumes a suspended run; no channel returns an image payload or a credential
to a window. A window shows a conversation and offers the user's decision to the approval channels, and that is
the whole of its authority.

Two consequences of the `1.0.0` members belong here. `parentJobId` is returned because a window that renders a
child's conversation has to know whose child it is; it is an identifier of a *job*, which the window already
reads through the job surface, and it yields nothing to reach a running agent with. The context account is not
returned by `transcript.read`: a window that needs to show what a job spent and what it loaded reads the job's
own account through the job surface, which is where `design.md` puts it, so that this channel keeps returning one
thing — the conversation.

### 3. Module Descriptor / Manifest Specification

Transcripts replicate, so the store they live in is declared as a replicated store under
`sync/contracts/replicated-store-descriptor@0.1.0`:

```json
{
  "descriptorVersion": "0.1.0",
  "storeId": "transcripts",
  "version": "1.1.0",
  "name": "Agent transcripts",
  "encryptionClass": "append-only",
  "resolutionRule": "append-and-reconcile",
  "orderingBasis": "device-sequence-causal",
  "retention": { "minimumDays": 90, "userConfigurable": true, "deletionRequiresConfirmation": true },
  "membership": "Turns of every agent session: user commands and their attached images, agent turns with their token usage, tool calls, tool results and refusals, and redaction markers; together with each session's role identifier, the job it serves and that job's parent when it has one, and the account of the context it was given — the budget and the skills that were loaded.",
  "capabilities": ["partial-transfer"]
}
```

The store's own `version` advances by a MINOR with this revision because its membership grew, while
`descriptorVersion`, `encryptionClass`, `resolutionRule`, `orderingBasis` and `retention` are untouched: nothing
about how a transcript replicates or reconciles changes here, only what one contains. The declaration bump is
therefore not a device-compatibility statement — `DESCRIPTOR_VERSION_UNSUPPORTED` keys on `descriptorVersion`,
which is unchanged, so a device on an older assembly still exchanges this store rather than refusing it.

The retention floor matches the ledger's so that a job's conversation and a job's record expire together; a
transcript that outlived its records would show a user an action with no history behind it, and one that expired
first would show history with no explanation.

## Semantics

**A session belongs to one job and one job has one live session.** Requesting a second is
`SESSION_ALREADY_LIVE`, not a queue. Two live sessions would make `SuspensionPoint` ambiguous, and a suspension
point is the only thing a decision can be applied to (INV-AG-04).

**A session's role is an identifier, and it is fixed for the session's life.** From `1.0.0` the member names an
entry in the role registry rather than one of four values compiled into the product. What that buys is the point
of the change: a session can run under a role the product did not ship — a reviewer, a triage agent, a role a
capability pack contributed — with no release, because identity became data (INV-AG-30, principle VI). What it
must not cost is the two properties that made the closed union safe, and neither is given up. The role is
resolved once, at construction, and never re-read: a registry edited mid-run does not reach a running session,
and nothing in a run can change what it is running as. And the tools the entry yields are resolved once and
frozen with it (INV-AG-33), so a running agent's tool set cannot widen — not by a skill's text, not by model
output, not by a child's report, not by connecting a connector while it runs.

**A session names its job's lineage and holds no handle to another session.** `parentJobId` is present exactly
when the job this session serves was created by an agent running another job. It is a recorded fact about jobs,
not a channel between agents: there is no handle, no queue and no message bus, and the pair of job records is the
whole of what connects a parent to a child (INV-JOB-08, principle I). A parent does not step, instruct, interrupt
or read the working state of a child's run, and a child does not answer for its parent; each reads the other only
as a job record. A child is a separate session in the same process, which is safe only because sessions share
nothing — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q4). What a parent may create, how deep and how wide, is
`agent/contracts/job-delegation@1.0.0`'s; this contract records the result of those rules and enforces none of
them, except that a session's `parentJobId` is never its own `jobId`.

**A session records the account of its context, never the context.** `context.budget` is the ceiling and reserve
the job was given and whether they were derived from the assigned model's declared window or taken from the
declared fallback; `context.skills` is what was loaded and whether each was preloaded by the role entry or
matched to the work, at the position from which it was in context. The assembled context itself is built per
request and is never persisted (INV-AG-37; `model.md` §Physical Resource & Artifact Topology), which is exactly
why the account is: a run investigated later is judged against the budget it actually had and the playbooks it
actually read, and neither is recoverable from the turns. Reduction acts only on what is sent to a model and
never rewrites a stored transcript (INV-AG-38), so the account grows and the conversation is never edited to fit
a ceiling. The derivation of the budget and the point at which reduction begins are product choices with no
measurement behind them — UNVERIFIED, recorded as Q-4 in `clarifications.md` session 2026-09-13 — and the
load-on-demand shape of `skills` follows the reference architecture, which advertises a skill's description and
loads its body when the work matches (`https://omp.sh/docs/skills`, UNVERIFIED); both are re-implemented against
the pinned harness and nothing is imported.

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
`specs/agent` pins the distribution as part of this guarantee. Lineage does not soften this: a parent and a child
are two sessions sharing nothing, and the only thing that passes between them is a job record.

**Instructions are advisory.** The `instructions` field carries a role's persona and task framing. It never
carries a rule, a permission or a prohibition that the product relies on, because principle II places enforcement
outside anything a model reads or writes. A change that moves a constraint into this field is a constitutional
violation, not a refactor. Opening `role` does not weaken this: an account-authored or pack-contributed role
entry supplies this same advisory text and gains nothing by it — a badly authored role can waste a job, not
escalate one.

**Images live for the job.** They travel in turns as content; they are dropped from the live session when the job
reaches a terminal state, and the stored transcript keeps them only under the retention above. A window never
receives an image payload through `transcript.read`; it receives a reference and renders from the job's own
attachment surface.

**Redaction removes a turn and says so.** A turn removed by retention or by the user's deletion is replaced by a
`redacted` marker at the same position, so the conversation does not silently change shape. This is the same
discipline the ledger applies with its removal announcements.

**Token usage is read, not estimated.** Counts are available per agent turn and across the transcript — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q7). What is shown and what it costs belong to `req-017-provider-matrix`.

**A transcript stays readable when its role no longer resolves.** An account role that was removed, or a
capability pack that was deactivated, leaves stored transcripts naming an identifier the registry no longer
holds. They are still displayed, under the identifier they were written with, because a transcript is the only
explanation a user has of what an agent did. Only a *rebuild* is refused, and it is refused by the registry with
`ROLE_UNKNOWN` before a session is constructed — never by quietly resolving the run to some other role.

## Error Matrix

| Code | Cause | Handled by | What the user sees |
| --- | --- | --- | --- |
| `TOOLSET_NOT_WRAPPED` | A session was constructed from a value the factory did not produce | Caller; construction fails | Nothing at runtime — this fails the build and the architectural test, which is where it belongs |
| `PROFILE_UNKNOWN` | The role's tier routes to a profile that has been deleted | Job manager; the job is not started | A SYSTEM card naming the role and offering provider settings |
| `PROFILE_CREDENTIAL_MISSING` | The profile replicated to this device but its credential did not | Job manager; the job is not started | A SYSTEM card asking for the credential for that named profile |
| `MODEL_NOT_OFFERED` | The mapping names a model the profile does not list | Job manager; the job is not started | A SYSTEM card pointing at the role-to-model mapping |
| `MODEL_LACKS_CAPABILITY` | A command with images routed to a model the profile declares as text-only | Job manager; the job is not started | A SYSTEM card stating that the chosen model cannot read images, and offering the mapping |
| `PROVIDER_REJECTED` | The provider refused the request — credential, quota, content, or an image the endpoint would not accept | Session; the run fails | An ERROR card carrying the provider's own reason without rewording it |
| `PROVIDER_UNREACHABLE` | The endpoint could not be reached | Session; the job's retry policy decides | The job's ordinary retry or failure presentation |
| `TRANSCRIPT_UNREADABLE` | A rebuild was requested and the stored turns do not load | Job manager; the job is not resumed and stays blocked | The job is shown as needing attention, with nothing executed |
| `TRANSCRIPT_INCONSISTENT` | The stored turns end where a run cannot continue — a tool call with neither result nor refusal | Job manager; recovery classifies the call before any rebuild | The job is shown as still being determined, per `req-013-sqlite-ledger` |
| `SESSION_ALREADY_LIVE` | A second live session was requested for one job | Job manager; refused | Nothing; the existing run continues |
| `RUN_ALREADY_FINISHED` | A decision arrived for a run that has ended | Approval path; the plan is discarded | The approval card is withdrawn as decided elsewhere |

Two failures a reader might expect here belong to neighbouring contracts and are named so that nobody adds a
duplicate code for them. A role identifier the registry does not hold is `ROLE_UNKNOWN` in
`agent/contracts/role-registry@1.0.0`, raised before a session is constructed. An assembled context that already
exceeds its budget before the first turn stops the job in `agent/contracts/context-assembly@1.0.0`, which is why
`SessionSpec` receives a budget as a recorded figure rather than deciding one.

## Compatibility

**MAJOR** — removing a `Turn` author or changing what one means; changing how a suspension point is identified;
adding any channel by which a window could start, resume or append to a session; changing the equivalence between
a live resume and a rebuilt one; changing the transcript store's resolution rule or its append-only class; making
`tools` accept anything other than `WrappedTool`; **changing where `role` gets its meaning from, as `1.0.0` does**;
making `role` mutable within a session, or letting anything re-resolve it mid-run; giving `parentJobId` any
meaning beyond a recorded job reference.

**MINOR** — adding a `TurnContent` kind older readers can render as unknown; adding an optional member to
`SessionSpec`; adding an optional member to `ContextAccount`; adding a read-only channel; adding a
`SessionErrorCode` whose handling is already covered by the rule that a session which cannot start does not
start.

**PATCH** — wording, naming and examples.

**Why this revision is MAJOR.** Not because a member was removed — `role` keeps its name, its position and its
string type, and a transcript written at `0.1.0` still parses against `1.0.0` for every member but that one. It
is MAJOR because every consumer reads that member and its *provenance* changed: at `0.1.0` a reader could
exhaustively switch on four values and be sure it had covered the world, and at `1.0.0` it cannot, because the
set of values is an account's registry rather than a compiled union. A reader that keeps the old assumption does
not fail loudly; it silently mishandles a role it has never heard of, which is exactly the class of break a MAJOR
is for. The added members are additive on their own and would have been MINOR alone; they are carried in this
revision because the same consumers must be revisited anyway, and because a consumer that renders a child job
needs `parentJobId` at the moment it learns that roles are open.

**Support window.** The channels are internal to one build. The stored transcript is not: it replicates between
devices on different versions, so a reader that meets a `TurnContent` kind it does not know renders it as an
unreadable turn and says so, and never drops it from the conversation. Silently omitting an unknown turn would
show a user a conversation that never happened. The same rule now covers the `1.0.0` members in both directions:
a `1.0.0` reader meeting a transcript with no `context` and no `parentJobId` reads a session that recorded
neither — the Migration section says exactly what that means — and a `0.1.0` reader meeting a transcript whose
`role` it does not recognise renders the conversation with the role shown as written rather than mapping it to
one of the four it knows. Guessing a role for a conversation is worse than admitting the role is unfamiliar,
because the role is what tells the user which agent said this.

## Examples

**Valid** — a child session suspended at a held write, exactly as it is stored:

```json
{
  "sessionId": "s-4c1a",
  "jobId": "j-8821",
  "parentJobId": "j-8820",
  "role": "worker",
  "context": {
    "budget": { "ceiling": 160000, "reserve": 24000, "basis": "derived", "modelWindow": 200000 },
    "skills": [
      { "skillId": "notion-task-hygiene", "reason": "preloaded", "atPosition": 0 }
    ]
  },
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
intent for `c-02` with no result. The `1.0.0` members carry their own weight here. `role` is a registry
identifier, so the rebuild resolves the same entry and the same frozen allowlist. `parentJobId` says this work
was created by the agent running `j-8820` and says nothing more: there is no handle to that job's session, and
`j-8820` cannot reach into this one. And the account states the ceiling this run was measured against and the one
playbook it was reading, neither of which the turns would have revealed.

**Rejected** — the same transcript with the held call already answered in place:

```json
{
  "sessionId": "s-4c1a",
  "jobId": "j-8821",
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

**From `0.1.0`.** A stored transcript written before this change carries one of the four old `AgentRole` values
and no lineage, and it is read as the corresponding built-in role identifier with no parent. The translation is:

| Stored `0.1.0` value | Read at `1.0.0` as |
| --- | --- |
| `"pet"` | `pet-text`, or `pet-image` when the session's user turn carries images — the split `0.1.0` made at routing time from `InputShape.carriesImages` rather than in this member |
| `"worker"` | `worker` |
| `"rule_elicitation"` | `rule-elicitation` |
| `"undo"` | `undo` |

`risk-judge` appears in no `0.1.0` transcript, because no session was stored under it. An absent `parentJobId`
reads as a top-level job — the same posture `design.md` gives job records, where a record with no child link
reads as top-level — and an absent `context` reads as a session that recorded no account, which is a statement
about what the writing build knew rather than a session that had no budget. A reader shows the absence as
"not recorded" and never substitutes a figure of its own, because a budget invented afterwards would be a number
nothing was measured against.

**Stored transcripts are never rewritten.** Not by this migration and not by any later one. They are append-only
account data under principle III, the store's `encryptionClass` is `append-only`, and the reading side does the
translation every time it reads. There is no backfill pass, no rewrite-on-open, and no "upgrade the transcripts"
step at start-up: a migration that edited a transcript would edit the only explanation a user has of what an
agent did, and the ledger records the acts rather than the reasoning. The mechanism that makes this possible is
the one `0.1.0` already chose for the same purpose — each `Turn` carries its own `author` and `content.kind`, so
old turns are read as they were written and rendered under the shape they declare.

**A later MAJOR that changes the turn shape** must state here how stored transcripts are read afterwards, and the
answer may not be "dropped", for the reason above.

**Mixed versions in the field.** Transcripts replicate to every device on the account, and devices update at
different times. A `1.0.0` device reading a `0.1.0` transcript applies the table above. A `0.1.0` device reading a
`1.0.0` transcript parses every member it knows, ignores `parentJobId` and `context` as unknown members, and
meets a `role` outside its four values: it renders the conversation with the role shown as written and does not
map it to one it knows. It does not rebuild a session from that transcript — a rebuild resolves the role through
a registry that build has no concept of — so a suspended run continues on a device that understands it, which is
the same posture `agent/contracts/role-routing@0.1.0` already takes for a table version ahead of the build and
for the same reason: reading around an unrecognised member means running work under an identity the user never
assigned.

No production transcript exists in the field today and no application code exists yet, so this section is the
reading rule a build must implement rather than a conversion anyone has to perform.

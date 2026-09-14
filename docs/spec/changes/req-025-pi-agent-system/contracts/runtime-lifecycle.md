---
contract: runtime-lifecycle
version: 1.0.0
status: draft
owner: agent
consumers: [agent, approval, ledger, connector, job]
schema_files: [runtime-lifecycle.schema.json]
---

# Contract: Runtime Lifecycle

## Purpose

This contract declares the six places where the agent runtime may be watched, and the two of them where the data
passing through may be changed. It is what a capability pack attaches to when it needs a field redacted before a
call is recorded, what the product attaches to when it needs a terminal job counted, and the only surface through
which any of that is possible. Whoever writes a handler builds on this document; whoever reads a run's account
reads the points named here.

Its single most important property is a negative one: **no point can return a value that causes a call to
execute.** A handler may block, observe, or transform. None may allow. That is principle II made structural
rather than procedural — the gate is unreachable by model output, and it must be equally unreachable by product
code taking a shortcut, so "allow" is not a value any handler can produce (INV-AG-40). The approval gate and the
ledger write are steps of the tool wrapper, not registrations at a point, so there is nothing to unregister,
reorder or replace (INV-AG-41).

The position this contract takes is the one the wrapper already took and measured. The wrapper's four-step order
holds with the engine's own call-interception facility deliberately left unconfigured — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2, bypass vector 2) — and eleven attempts to reach a platform call around the
gate all failed — VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md` §1 Q2). Adding an interception surface is
the obvious way to give both of those back. This contract exists so that it does not: the points sit outside the
four steps, never between them, and they carry no vocabulary with which an authorisation could be expressed.

What it does not cover: the four steps themselves and the wrapped-tool type, which belong to
`agent/contracts/tool-wrapping@0.2.0`; the verdict, which belongs to `approval/contracts/gate-evaluation@0.1.0`;
the record, which belongs to `ledger/contracts/ledger-record@0.1.0`; how a context is built and reduced, which
belongs to `agent/contracts/context-assembly@1.0.0`; and what a pack is, which belongs to
`agent/contracts/capability-pack@1.0.0`.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`runtime-lifecycle.schema.json`](./runtime-lifecycle.schema.json) | JSON Schema 2020-12 | normative |

The file's root is a handler registration — the same shape a capability pack's `handlers` member carries, so a
pack is validated against exactly what the bus enforces. Beside it, under `$defs`, are the event payload and the
return payload of each of the six points, each reachable by anchor.

It is worth reading for what the return payloads *cannot* say. Every point's return is a closed union whose
members are `unchanged`, `observed`, `blocked`, or a named transformation, and no member — at any point — means
allow, proceed, approve, permit or authorise. A reader who knows nothing of this document can determine from the
file alone that a handler's return has no way to cause a call to run, because the vocabulary that would express
it is absent from all six unions. The same is true of re-running: the after-a-tool-result return carries no tool
name and no arguments, so there is nothing with which to ask for the call again, and it carries no status
member, so a handler can change what the agent reads of a result and never whether the call succeeded.

What the file cannot express is the order the points occupy relative to the wrapper's four steps, which is stated
below and is what a MAJOR bump here exists to protect; the budget's enforcement, which is a clock; and two of the
six protected context sections, which exist only in some contexts and are therefore checked by the composer
rather than by the schema (see § Semantics).

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { JobId } from "ledger-record@0.1.0";
import type { ToolOrigin } from "tool-wrapping@0.2.0";

/** The closed set. A seventh member is a MAJOR revision: a new place to stand is a new place principle II
 *  must be re-argued. The gate and the ledger step are not members and cannot become members. */
type InterceptionPoint =
  | "before-a-tool-call"
  | "after-a-tool-result"
  | "when-a-message-is-recorded"
  | "when-context-is-assembled"
  | "when-context-is-reduced"
  | "when-a-job-reaches-a-terminal-state";

/** Who attached. First-party only: the product itself, or a pack that activated (D7). There is no
 *  priority member, because a priority is a way to place code ahead of the product's own handlers. */
type HandlerOwner =
  | { kind: "product"; id: string }
  | { kind: "pack"; id: string };

interface HandlerRegistration {
  handlerId: string;            // unique across the whole registration set
  point: InterceptionPoint;
  owner: HandlerOwner;
  budgetMs: number;             // wall-clock ceiling for one dispatch; default 250, maximum 2000
  description: string;          // what this handler does, for the run's account and the system card
}

/* ---------- before a tool call ---------- */

interface BeforeAToolCallEvent {
  point: "before-a-tool-call";
  jobId: JobId;
  callId: string;               // the wrapper's call identifier, also the ledger correlation identifier
  roleId: string;
  toolName: string;
  origin: ToolOrigin;
  arguments: Record<string, unknown>;   // as the previous handler left them
  declarations: { writes: boolean; isIrreversible: boolean; changesPermission: boolean };
  budgetMs: number;
}

/** No member means allow. `unchanged` is this handler having nothing to say; the gate still decides. */
type BeforeAToolCallReturn =
  | { outcome: "unchanged" }
  | { outcome: "arguments-transformed"; arguments: Record<string, unknown>; note?: string }
  | { outcome: "blocked"; reason: string; detail?: string };

/* ---------- after a tool result ---------- */

interface AfterAToolResultEvent {
  point: "after-a-tool-result";
  jobId: JobId;
  callId: string;
  toolName: string;
  status: "ok" | "failed";      // read-only: the return carries no status member
  value: unknown;               // the redacted projection, as the previous handler left it
  resultRecordId: string;       // the ledger result record this call already wrote
  budgetMs: number;
}

/** No member names a tool or an argument, so the call cannot be asked for again. */
type AfterAToolResultReturn =
  | { outcome: "unchanged" }
  | { outcome: "result-transformed"; value: unknown; note?: string };

/* ---------- the four observation points ---------- */

/** The only return the four observation points accept. */
type Observation = { outcome: "observed" };

interface MessageRecordedEvent {
  point: "when-a-message-is-recorded";
  jobId: JobId;
  messageOrdinal: number;
  author: "user" | "agent" | "tool" | "system";
  content: string;              // already redacted; this is the recorded form, not the model's raw output
  recordedAt: string;
}

interface ContextAssembledEvent {
  point: "when-context-is-assembled";
  jobId: JobId;
  requestOrdinal: number;
  budget: { ceiling: number; reserve: number; isFallback: boolean };
  sections: ContextSection[];
  budgetMs: number;
}

interface ContextSection {
  kind: ContextSectionKind;
  ordinal: number;
  protected: boolean;           // true for the six the reduction ladder may never remove
  tokenEstimate: number;
}

type ContextSectionKind =
  | "role-instructions" | "temporal-anchor" | "tool-set" | "rules-advisory" | "loaded-skill"
  | "command" | "attachments-in-use" | "transcript" | "most-recent-turn" | "open-question";

/** The one transforming point that is not on the tool path. It may reshape the assembled context and may
 *  never drop a protected section. */
type ContextAssembledReturn =
  | { outcome: "unchanged" }
  | { outcome: "context-transformed"; sections: ContextSection[]; note?: string };

interface ContextReducedEvent {
  point: "when-context-is-reduced";
  jobId: JobId;
  requestOrdinal: number;
  stepOrdinal: number;
  step: "drop-superseded-reads" | "drop-empty-results" | "replace-bulky-results" | "summarise-older-transcript";
  removed: Array<{ kind: ContextSectionKind; ordinal: number; tokenEstimate: number }>;
  replacedWith: Array<{ kind: ContextSectionKind; ledgerRecordId?: string; tokenEstimate: number }>;
}

interface JobTerminalEvent {
  point: "when-a-job-reaches-a-terminal-state";
  jobId: JobId;
  parentJobId?: JobId;
  roleId: string;
  terminalState: "succeeded" | "failed" | "cancelled" | "refused";
  completedOperations: number;
  reason?: string;
  reachedAt: string;
}

/* ---------- the bus ---------- */

type Handler =
  | { point: "before-a-tool-call"; run: (e: BeforeAToolCallEvent) => Promise<BeforeAToolCallReturn> }
  | { point: "after-a-tool-result"; run: (e: AfterAToolResultEvent) => Promise<AfterAToolResultReturn> }
  | { point: "when-a-message-is-recorded"; run: (e: MessageRecordedEvent) => Promise<Observation> }
  | { point: "when-context-is-assembled"; run: (e: ContextAssembledEvent) => Promise<ContextAssembledReturn> }
  | { point: "when-context-is-reduced"; run: (e: ContextReducedEvent) => Promise<Observation> }
  | { point: "when-a-job-reaches-a-terminal-state"; run: (e: JobTerminalEvent) => Promise<Observation> };

interface LifecycleBus {
  /** In-process, during start-up only. There is no unregister and no replace. */
  register(registration: HandlerRegistration, handler: Handler): RegistrationOutcome;
  /** Called once by the product after packs have activated. Registration is closed afterwards. */
  seal(): void;
  /** What the product, the run's account and the system card may read. */
  registrations(): ReadonlyArray<HandlerRegistration>;
}

type RegistrationOutcome =
  | { ok: true }
  | { ok: false; error: LifecycleErrorCode; detail: string };

type LifecycleErrorCode =
  | "POINT_UNKNOWN"                 // a point outside the closed set of six
  | "POINT_NOT_REGISTRABLE"         // the gate or the ledger step named as a point
  | "HANDLER_ID_DUPLICATE"
  | "HANDLER_BUDGET_OUT_OF_RANGE"
  | "REGISTRATION_CLOSED"           // registration attempted after seal, including mid-job
  | "PRECALL_HANDLER_BLOCKED"       // an outcome, not a fault: the handler blocked the call
  | "PRECALL_HANDLER_FAILED"
  | "PRECALL_HANDLER_TIMEOUT"
  | "PRECALL_TRANSFORM_INVALID"     // transformed arguments do not satisfy the tool's parameter shape
  | "POSTRESULT_HANDLER_DROPPED"
  | "CONTEXT_TRANSFORM_INVALID"     // a transformation dropped a protected section
  | "OBSERVER_HANDLER_DROPPED";
```

**Where the points sit.** Nothing here reorders the wrapper. One tool call runs in this order, and the two
transforming points are outside the four steps rather than between them:

```
agent issues call
  → before-a-tool-call        (may block; may transform arguments; may not allow)
  → redaction boundary        (projects arguments)
  → ledger: intent record     (fail-closed: no record, no call)
  → gate: verdict             (allow / hold / refuse)
  → coordinator: resources
  → adapter executes          (receives the transformed arguments, unredacted)
  → redaction boundary        (projects the result)
  → ledger: result record
  → after-a-tool-result       (may transform what the agent sees; may not re-run the call)
  → agent receives the result
```

### 2. Wire / Communication Protocol

**Not applicable, and deliberately so. There is no channel.** Handlers are in-process registrations made during
start-up by the product and by activated packs, and no window may register, list or trigger one.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| *(register)* | — | — | — | — | **No channel.** A window that could register a handler could place code of its own choosing on the path a call takes to the gate |
| *(list)* | — | — | — | — | **No channel.** The set of registrations is the shape of the product's own obligations; a renderer has no use for it, and the system card is told what it needs through the existing surface |
| *(trigger / dispatch)* | — | — | — | — | **No channel.** A point is dispatched by the wrapper, the composer and the job manager at the positions above and by nothing else; a triggerable point is a point whose event payload a caller chooses |
| *(events)* | — | — | — | — | **No channel.** An event carries a call's arguments, a context's composition and a transcript's content; none of that crosses the process boundary because none of it has to |

The asymmetry is the one `agent/contracts/role-routing@0.1.0` already establishes: a window may express the
user's intent and can never obtain the resolved thing. Here the resolved thing is a position on the call path,
which is strictly more valuable than an endpoint. Everything a user is entitled to know about what a handler did
— that a call was blocked and by which handler, that a transformation ran, that a handler was dropped — reaches
the interface as part of the job's account, through the surfaces `job` and `uix` already own.

### 3. Module Descriptor / Manifest Specification

A capability pack declares the points it attaches to in its manifest's optional `handlers` member, owned by
`agent/contracts/capability-pack@1.0.0`. Each entry is a handler registration and is validated against
[`runtime-lifecycle.schema.json`](./runtime-lifecycle.schema.json), so the shape a pack author writes and the
shape the bus enforces cannot drift apart:

```json
{
  "handlers": [
    {
      "handlerId": "desktop-control.redact-window-titles",
      "point": "before-a-tool-call",
      "owner": { "kind": "pack", "id": "desktop-control" },
      "budgetMs": 250,
      "description": "Replaces window titles in desktop tool arguments with a typed reference before the call is recorded."
    }
  ]
}
```

**A budget is required, not defaulted by omission.** Every entry states `budgetMs`. The product's default is
**250 ms** and the maximum any registration may state is **2000 ms**. Both figures are **UNVERIFIED**: they are
declared ceilings, not measurements — no spike has measured handler latency — and they are written here rather
than left open so that a registration which cannot state a budget is refused at load, where a pack author sees
it, rather than at the first call, where a user does.

**Discovery.** None beyond pack enumeration. The product's own handlers are registered by the product; a pack's
are registered when the pack activates; an inactive pack registers nothing, like everything else it declares
(INV-AG-45). There is no installation route from outside the product's pack directory.

**Refusal is whole.** A `handlers` entry naming a point outside the six, naming the gate or the ledger step, or
stating a budget outside the range, refuses the pack whole — the pack contributes no tool, no role and no skill.
A pack that got one handler wrong is a pack whose review missed something, and applying the rest of it would be
applying a tool set nobody reviewed.

**Fallback when there are no handlers at all.** Every point dispatches to an empty set and the run proceeds
unchanged: the ledger record is written first, the gate evaluates second, execution happens only on allow. An
empty handler set is the product's ordinary state, not a degraded one.

## Semantics

**No point can allow, and the schema is where that is visible.** Each point's return is a closed union. The
before-a-tool-call point accepts `unchanged`, `arguments-transformed` or `blocked`; the after-a-tool-result point
accepts `unchanged` or `result-transformed`; the other four accept `observed` and nothing else. There is no
member at any point that means allow, and `unchanged` is not one: it is a handler stating it has nothing to say,
after which the wrapper proceeds to the ledger and the gate exactly as it would have with no handler registered.
A handler that runs after the gate refused a call does not exist, because the refusal ends the call — but even a
handler that could somehow run there would have no value to return that execution reads (INV-AG-40).

**The gate and the ledger write are not points.** They are steps of the wrapper. A registration naming either is
refused with `POINT_NOT_REGISTRABLE` rather than with the generic unknown-point code, so the message can say why:
those steps are not points, and making them registrable would make them unregistered one refactor later
(INV-AG-41). This is the reason the interception surface is safe to have at all — the guarantee it could
undermine is not reachable from it.

**Blocking is monotonic and ends the chain.** A `blocked` return stops dispatch at that point: later handlers are
not consulted, because nothing they could return would undo a block. The wrapper turns the block into a refusal
carrying the handler's stated reason, and the refusal names the handler. Nothing executed — but the call is
still recorded. The point sits before the intent record in the pipeline so that a transformed argument is what
gets recorded; a block does not skip the record, it decides what the record says. The wrapper writes the intent
record for the call the agent issued and a result record stating the refusal and naming the handler, which is
the same shape `approval` uses when the gate refuses: the intent stands, the result carries the refusal, and no
execution lies between them. A call a handler stopped is therefore as traceable in the ledger as a call the gate
stopped, and principle III holds for every call the agent issued rather than only for those that reached the
gate. The block is additionally recorded against the job's account of the run, beside reductions and skill
loads, so the account explains why a call the agent made never happened without the reader opening the ledger.

**One transformation, one value.** The arguments the last pre-call handler returns are the arguments from which
everything downstream is built: the redaction boundary projects *that* value, the ledger intent record records
*that* value, the gate's call subject is built from *that* value, and the adapter calls the platform with *that*
value. No step re-derives anything from the untransformed original. This is the whole reason the point sits
before the ledger write rather than after it: what was approved, what was recorded and what ran are the same
thing. The redaction boundary still differs between the record and the call — the adapter receives the
transformed arguments unredacted, as `agent/contracts/secret-redaction@1.0.0` specifies — but that difference is
a projection of one value, not two values.

**A pre-call handler's transformation is checked before it is used.** Transformed arguments are validated against
the tool's declared parameter shape. A transformation that no longer satisfies it fails the call with
`PRECALL_TRANSFORM_INVALID`, naming the handler, rather than proceeding with arguments the tool never agreed to
accept. This is a fail-closed check for the same reason the rest of the point is fail-closed: an argument shape
the gate cannot read is an argument shape the gate cannot decide about.

**A transforming handler is not the redaction boundary.** The boundary is a step of the wrapper and every value
leaving crosses it exactly once (INV-AG-42). A handler that redacts is an *additional*, declared transformation —
typically a pack narrowing what its own tools carry. Removing every such handler weakens nothing the constitution
protects; removing the boundary is not possible, because it is not registered.

**Failure posture differs by side, and only by side.** A handler at the before-a-tool-call point that throws or
exceeds its budget causes the call to be refused, naming the handler: the call has not happened yet, and
proceeding without that handler's opinion is proceeding without knowing what it would have said. A handler at any
other point that throws or exceeds its budget is dropped, its failure is recorded, and the run continues: at
those points the act is already over or the material is already safe, and stopping a job because a telemetry
handler is slow would trade a real guarantee for an imagined one. For the after-a-tool-result point specifically,
the result reaches the agent unchanged by the dropped handler and every other handler in the chain still runs.

**A post-result handler changes what is read, never what happened.** The return carries a value and nothing else:
no status, so success and failure are untouchable; no tool name and no arguments, so the call cannot be asked for
again. The result record was already written before this point, so nothing a handler does here can alter the
history of the call.

**A context transformation may never drop a protected section.** The protected set is command, attachments in
use, temporal anchor, tool set, open question, and the most recent turn. Four of the six exist in every assembled
context and the schema requires a transformed context to contain them. The other two — attachments in use and an
open question — exist only in some contexts, so the schema cannot require them unconditionally; the composer
compares the returned sections against the event's own `protected` flags and refuses the transformation with
`CONTEXT_TRANSFORM_INVALID` when one is missing. A refused transformation is discarded, the untransformed context
is used, and the failure is recorded — the drop posture, because this point is not on the tool path.

**Ordering is declared, never negotiated.** Within one owner, handlers dispatch in the order they were
registered, which for a pack is the order its manifest lists them. Across owners, the product's handlers dispatch
before any pack's, and packs dispatch in ascending pack-identifier order. There is no priority member to raise,
because a priority is a way for a pack to place itself ahead of the product. The order is therefore a function of
what is installed, which means a run's account of its own calls is reproducible on a second device holding the
same packs.

**The registration set is fixed for the process lifetime.** Registration happens at start-up; the product seals
the bus after packs have activated; a later attempt is refused with `REGISTRATION_CLOSED`. There is no hot
reload. A handler appearing mid-job would mean two calls in one job were processed by different code with no
record of the difference, which makes that job's account inconsistent — and the account is the thing the points
exist to enrich. Changing what is registered means restarting the product, which is also when a pack's activation
is re-evaluated.

**The budget is per handler, and the worst case is known at start.** Each registration's `budgetMs` bounds one
dispatch of that handler. A point's worst-case cost is therefore the sum of its handlers' budgets, and because
the set is sealed at start, that sum is a number the product knows before the first job rather than a runtime
surprise. At the before-a-tool-call point the sum is latency added to every call before the gate, which is the
reason the maximum is stated at all.

**The requested event names were not adopted.** The names in the original request — `before_tool`, `after_tool`,
`on_message`, `on_error`, `pre_compact` — are not this contract's names, and two of them name nothing that
exists anywhere. The reference architecture's actual surface is `tool_call` and `tool_result`, a message family
and a compaction family, with a failure surfacing through a result's error flag rather than through an `on_error`
event (`https://omp.sh/docs/hooks`, UNVERIFIED). Naming a point after something that exists in neither the
reference nor this product would leave a reader unable to check either source. The six names above are this
product's own, and each says what happens at it. The same documentation states that its handlers "supplement"
its approval settings; that relation is refused here, because the gate is not one voice among several.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `POINT_UNKNOWN` | A registration names a point outside the closed set of six | Bus, at registration; a pack carrying it is refused whole | A SYSTEM card naming the pack, the handler and the point it asked for |
| `POINT_NOT_REGISTRABLE` | A registration names the approval gate or the ledger write as its point | Bus, at registration; the pack is refused whole | The same card, stating that those steps are not points and cannot be registered at |
| `HANDLER_ID_DUPLICATE` | Two registrations share one handler identifier | Bus, at registration; the later one is refused and its owner named | A SYSTEM card naming both owners, because a silent win would make the dispatch order unreadable |
| `HANDLER_BUDGET_OUT_OF_RANGE` | A registration states no budget, or one above the maximum | Bus, at registration; the pack is refused whole | The same card, naming the handler and the permitted range |
| `REGISTRATION_CLOSED` | Registration attempted after the bus was sealed, including mid-job | Bus; refused, nothing is added | None during a run; the attempt is recorded for the developer of whatever made it |
| `PRECALL_HANDLER_BLOCKED` | A handler returned `blocked` — an outcome, not a fault | Wrapper; the call is refused, and the ledger receives the intent record and a result record stating the refusal and naming the handler | The refusal the agent re-plans around, carrying the handler's stated reason and the handler's name |
| `PRECALL_HANDLER_FAILED` | A handler at the before-a-tool-call point threw or exceeded its budget | Wrapper; fail-closed, the call is refused and nothing executes, and the ledger receives the intent record and a result record stating the refusal and naming the handler | An ERROR card stating that the action was not performed and naming the handler that failed |
| `PRECALL_HANDLER_TIMEOUT` | A handler at the before-a-tool-call point exceeded its declared budget | Wrapper; fail-closed, the call is refused | The same card, stating that the call was refused rather than proceeding without that handler's opinion |
| `PRECALL_TRANSFORM_INVALID` | Transformed arguments no longer satisfy the tool's declared parameter shape | Wrapper; fail-closed, the call is refused | The same card, naming the handler and the field that no longer fits |
| `POSTRESULT_HANDLER_DROPPED` | A handler at the after-a-tool-result point threw or exceeded its budget | Wrapper; the handler's output is discarded, the run continues | Nothing interrupts the job; the drop appears in the job's account with the handler named |
| `CONTEXT_TRANSFORM_INVALID` | A returned context omits a section the event marked protected | Context composer; the transformation is discarded, the untransformed context is used | Nothing interrupts the job; the discard appears in the job's account with the handler named |
| `OBSERVER_HANDLER_DROPPED` | A handler at one of the four observation points threw or exceeded its budget | Dispatcher; dropped and recorded | Nothing; the run is unaffected, and the drop appears in the job's account |

## Compatibility

**MAJOR** — adding, removing or renaming a point; adding any return member, at any point, from which execution
could follow; changing a point's position relative to the ledger write or the gate; changing a point's failure
posture; making the gate or the ledger step registrable; adding a channel that registers, lists or triggers a
handler; permitting registration after the bus is sealed; adding a priority member to a registration; adding a
status member to the after-a-tool-result return; removing a member from the protected set. Several of these are
source-compatible and are MAJOR anyway, because each changes the security argument rather than the interface.

**MINOR** — adding an optional member to an event payload; adding a `LifecycleErrorCode` whose handling follows
an existing posture; adding a `ContextSectionKind`; changing the default or maximum budget when a measurement
replaces the declared figure; adding an owner kind strictly narrower than `pack`.

**PATCH** — wording, descriptions, examples, and the evidence citations attached to them.

**The names in the request are recorded as not adopted** (§ Semantics), and renaming a point to any of them
would be MAJOR — not because the names are wrong in themselves, but because a point's name is how a run's
account, a pack manifest and a refusal message refer to it.

**Support window.** Both ends of this contract are inside one application build, and a pack ships with the
product, so there is no mixed-version window to negotiate. It is versioned for reviewers: a MAJOR bump here is an
instruction to re-run the bypass suite before the change ships, because the suite
(`spikes/SP-8-rule-ir-hardgate/REPORT.md` §1 Q2, VERIFIED) is what this contract's claim rests on rather than
the wording above.

## Examples

**Valid** — a redaction handler at the before-a-tool-call point, contributed by a pack. The registration:

```json
{
  "handlerId": "desktop-control.redact-window-titles",
  "point": "before-a-tool-call",
  "owner": { "kind": "pack", "id": "desktop-control" },
  "budgetMs": 250,
  "description": "Replaces window titles in desktop tool arguments with a typed reference before the call is recorded."
}
```

and what it returns when it has something to change:

```json
{
  "outcome": "arguments-transformed",
  "arguments": {
    "window": { "class": "window-title", "field": "window.title" },
    "action": "focus"
  },
  "note": "window.title replaced with a typed reference"
}
```

The wrapper takes those arguments forward: the intent record records them, the gate evaluates them, and the
platform receives them. Nothing here authorises the call — the gate has not run yet — and the handler cannot
learn what the gate decides.

**Valid** — an observer at the terminal-state point, contributed by the product:

```json
{
  "handlerId": "usage-accounting.close-job",
  "point": "when-a-job-reaches-a-terminal-state",
  "owner": { "kind": "product", "id": "usage-accounting" },
  "budgetMs": 250,
  "description": "Closes the job's usage account when the job reaches a terminal state."
}
```

Its only possible return is `{ "outcome": "observed" }`. If it throws or runs long it is dropped and recorded,
and the job's terminal state is unaffected — a job does not stay open because an accountant was slow.

**Rejected** — a registration naming a point outside the closed set:

```json
{
  "handlerId": "telemetry.on-error",
  "point": "on-error",
  "owner": { "kind": "pack", "id": "telemetry" },
  "budgetMs": 100,
  "description": "Reports failures."
}
```

Refused with `POINT_UNKNOWN`, and the pack that declared it contributes nothing. The name is the one the original
request asked for, and it exists in neither this product nor the reference architecture, where a failure surfaces
through a result's error flag rather than as an event of its own (`https://omp.sh/docs/hooks`, UNVERIFIED). What
this handler wants is the after-a-tool-result point, where a failed result arrives with `status` set to `failed`.
The refusal is at registration rather than at first dispatch because a pack author can fix it and a user cannot.

**Rejected** — a registration attempting to stand where the gate or the ledger stands:

```json
{
  "handlerId": "fast-path.approve",
  "point": "approval-gate",
  "owner": { "kind": "pack", "id": "fast-path" },
  "budgetMs": 50,
  "description": "Approves routine calls without asking."
}
```

Refused with `POINT_NOT_REGISTRABLE`. The gate is a step of the wrapper, not a point, so there is nothing here to
register at (INV-AG-41) — and even if this registration were accepted at some other point, its intent is
unrepresentable: no return value at any of the six points can cause a call to execute (INV-AG-40). The same
refusal applies to a registration naming the ledger write, for the same reason and with the same message. This is
the registration the closed set exists to make impossible, and it is impossible twice: once because the point
does not exist, and once because the vocabulary of approval does not exist in any return.

## Migration

Not applicable at `1.0.0`: no interception surface exists in the field, no application code exists yet, and no
pack has been written against an earlier shape.

What this version changes for an existing reader is position rather than order. `agent/contracts/tool-wrapping@0.2.0`
keeps its four steps unchanged and unreordered; this contract adds one point before them and one after them, and
nothing between them. The engine's own call-interception facility remains deliberately unconfigured, as it was
when the wrapper's guarantee was measured (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2, bypass vector 2, VERIFIED), so
introducing this surface does not reintroduce that bypass vector: the points dispatched here are the product's
own, registered through the product's own bus, and the engine is not asked to dispatch anything.

At the first release the registration set is whatever the product registers plus whatever activated packs
contribute; with browser and desktop shipping inactive, that is the product's own handlers alone. A future MAJOR
that adds or renames a point will state here how an existing pack manifest's `handlers` member is converted, and
will re-run the bypass suite before it ships.

---
contract: tool-wrapping
version: 0.1.0
status: draft
owner: agent
consumers: [agent, approval, ledger, connector, job, undo]
schema_files: [tool-wrapping.schema.json]
---

# Contract: Tool Wrapping

## Purpose

This is the seam between the product's obligations and a third-party reasoning engine, and it is the only place
a tool implementation can be reached. Whoever writes a connector adapter produces an implementation and hands it
here; whoever starts an agent receives wrapped tools and can obtain nothing else. Between those two acts the four
steps happen in a fixed order — record the intent, obtain a verdict, act only on allow, record the result — and
there is no argument, configuration or engine setting that reorders or skips them.

The surface is shaped so that the guarantee is structural rather than procedural. The factory's output type is
the only thing a session accepts, and the factory is the only producer of that type, so "every tool is wrapped"
is not a review rule that a hurried change can forget. It is what the type system permits. The engine's own
call-interception facility is not used, and the spike that measured this ran deliberately without it —
`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2, bypass vector 2 — because a guarantee that depends on an upstream
project's middleware depends on an upstream project's roadmap.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`tool-wrapping.schema.json`](./tool-wrapping.schema.json) | JSON Schema 2020-12 | normative |

The file is the registration surface: what an adapter must declare for a tool to exist at all. It carries the
obligation principle IV places on a writing tool as a refusal in the shape itself — a tool that writes must say
whether it is irreversible, and one that writes reversibly must say how its before state is read — so the failure
lands at registration, where a connector author sees it, rather than at the first call, where a user does.

The executable member is deliberately outside the file. A schema can describe what must be declared about a tool;
it cannot describe the function the factory closes over and keeps unreachable, and that closure is the whole of
INV-AG-02. Nor can it express the order the four steps happen in, which is stated below and is what a MAJOR bump
here exists to protect.

## Schema / Surface

### 1. Interface & Data Types

The normative shape of what an adapter registers is
[`tool-wrapping.schema.json`](./tool-wrapping.schema.json). The declarations below name the same members for a
reader and add what a schema file has no way to hold: the wrapped type the factory alone produces, the narrowed
dependencies it is given, and the results a call can return.

```typescript
import type { CallSubject, EvaluationContext, Decision } from "gate-evaluation@0.1.0";
import type { LedgerRecord, CorrelationId, JobId } from "ledger-record@0.1.0";
import type { ReconciliationDeclaration } from "tool-reconciliation@0.1.0";

/** Where a tool came from. There is no third value, and no value meaning "trusted". */
type ToolOrigin =
  | { kind: "connector"; connector: string }   // generated from a connector manifest
  | { kind: "internal" };                      // job control, notification, asking the user

/**
 * What a connector adapter or an internal module writes. It is never given to a session; it is given to the
 * factory, which keeps it and returns something else.
 */
interface ToolImplementation {
  name: string;                       // unique across the tool set of one session
  origin: ToolOrigin;
  description: string;                // shown to the model; text only, no capability of its own
  parameters: ParameterSchema;        // the shape the engine validates a call against before the wrapper runs
  /** Declarations the gate reads. Read from the manifest, never from a call's own arguments. */
  declarations: {
    writes: boolean;
    isIrreversible: boolean;
    changesPermission: boolean;
    reconciliation: ReconciliationDeclaration;
    snapshot?: SnapshotPlan;          // required when writes is true and isIrreversible is false
  };
  execute: (args: Record<string, unknown>, ctx: ExecutionContext) => Promise<ToolOutcome>;
}

/** How the state about to be changed is read before the change, so undo has something to replay against. */
interface SnapshotPlan {
  read_operation: string;             // a read tool the same origin declares
  target_path: string;                // where in the arguments the object being changed is named
}

interface ExecutionContext {
  jobId: JobId;
  callId: string;                     // also the ledger correlation identifier (INV-AG-05)
  signal: AbortSignal;                // cancellation arrives here, at a call boundary
}

type ToolOutcome =
  | { ok: true; value: unknown; after?: unknown }
  | { ok: false; code: string; message: string; retriable: boolean };

/**
 * What a session holds. Opaque: it exposes a name, a description and a parameter shape to the engine, and its
 * behaviour to nothing else. The implementation is closed over and is reachable by no name (INV-AG-02).
 */
declare const WrappedBrand: unique symbol;
interface WrappedTool {
  readonly [WrappedBrand]: true;      // only createWrappedTool can produce this
  readonly name: string;
  readonly description: string;
  readonly parameters: ParameterSchema;
  readonly invoke: (args: Record<string, unknown>, ctx: ExecutionContext) => Promise<WrappedResult>;
}

/** What the engine receives back. A refusal is a result, not an exception (see Semantics). */
type WrappedResult =
  | { status: "ok"; value: unknown }
  | { status: "refused"; reason: string; ruleId: string; appealable: boolean }
  | { status: "held"; requestId: string }        // the run suspends here; see agent-session@0.1.0
  | { status: "failed"; code: WrapperErrorCode; message: string; retriable: boolean };

type WrapperErrorCode =
  | "LEDGER_INTENT_UNWRITABLE"    // principle III: the call does not happen and the job fails
  | "LEDGER_RESULT_UNWRITABLE"    // the call happened; recorded as an error referencing the intent
  | "GATE_UNAVAILABLE"            // the evaluator could not be reached at all
  | "GATE_FAILED"                 // the evaluator returned an EvaluationFailure; fail-closed for writes
  | "SNAPSHOT_UNREADABLE"         // a reversible write could not read its before state
  | "TOOL_EXECUTION_FAILED"       // the implementation itself failed; its own code is carried in message
  | "CANCELLED";                  // the job was cancelled at this call boundary

/** The one producer of WrappedTool. There is no second, and no way to construct the type directly. */
type CreateWrappedTool = (
  implementation: ToolImplementation,
  deps: { ledger: LedgerAppender; evaluate: EvaluateCall; snapshots: SnapshotReader }
) => WrappedTool;

/** Narrowed views of the collaborating contracts, so the factory holds no more authority than it needs. */
interface LedgerAppender { append(record: LedgerRecord): Promise<string>; }
type EvaluateCall = (subject: CallSubject, context: EvaluationContext) => Decision | { error: string; detail: string };
interface SnapshotReader { read(plan: SnapshotPlan, args: Record<string, unknown>): Promise<unknown>; }

/** What a session is constructed from. It accepts WrappedTool and nothing else (INV-AG-01). */
type ToolSet = ReadonlyArray<WrappedTool>;

type ParameterSchema = { type: "object"; properties: Record<string, unknown>; required?: string[] };
```

**The order, stated once.** Build the call subject from the arguments and the manifest declarations; read the
before state when the tool is a reversible write; append the intent record and wait for it to be durable;
evaluate; on `allow` invoke the implementation; append the result record with the after state and the
compensating action. Any other order is a different contract.

### 2. Wire / Communication Protocol

Not applicable. Every participant — the factory, the evaluator, the ledger appender and the implementations —
lives in the one process that owns connectors and the store, and the call is an ordinary in-process invocation.
This is deliberate and is the reason there is nothing here: a wrapper reachable across a process boundary would
be a wrapper a compromised window could invoke, and the boundaries that do exist are specified by
`approval/contracts/gate-evaluation@0.1.0` and `ledger/contracts/ledger-store@0.1.0`, both of which are
deliberately one-directional away from execution.

### 3. Module Descriptor / Manifest Specification

The descriptor for a tool is the tool declaration inside a connector manifest, owned by
`req-019-connector-framework`. This contract states only what the factory requires of whatever that manifest
produces, and states it as [`tool-wrapping.schema.json`](./tool-wrapping.schema.json): whether the tool writes,
whether it is irreversible, whether it changes permissions, how an interrupted call is reconciled, and how its
before state is read. A manifest that omits any of these for a writing tool yields no tool at all — the factory
refuses it at registration, because the alternative is a write whose reversibility nobody declared, which
principle IV forbids.

## Semantics

**A refusal is a result; a broken obligation is a failure.** The three ways a call can stop before it runs are
deliberately not alike. `refused` is an ordinary outcome the agent receives and may re-plan around, and the job
continues. `LEDGER_INTENT_UNWRITABLE` stops the call and fails the job, because principle III makes the durable
record a precondition of the act rather than a report of it. `GATE_FAILED` is fail-closed across the product for
writes, not for this call alone, because an unreadable rule catalogue is indistinguishable from a tampered one.
This separation was decided in `clarifications.md` session 2026-09-12.

**`held` suspends; it does not block the product.** The wrapper returns `held` with the identifier of the
approval request, and the run suspends at that call under `agent/contracts/agent-session@0.1.0`. Whether the
implementation is invoked later by the still-live session or by a rebuilt one is invisible here: either way it is
invoked exactly once, through the same wrapper, after a verdict of `allow`.

**A verdict is obtained per call, never cached.** A scoped approval is matched afresh on each call by the
evaluator, as `gate-evaluation@0.1.0` states. The wrapper holds no memory of previous verdicts, so there is no
place for a stale allow to live.

**The result record is written even when the call failed.** A failing implementation produces a result record
with the failure, not an absent record; an absent result record means something interrupted the product, and
recovery treats those two cases differently. When the implementation succeeded and the result record cannot be
written, the wrapper appends an error record referencing the intent as soon as the store accepts writes again,
and the job fails rather than reporting a success the history does not hold.

**Cancellation lands between calls.** The abort signal is checked before the intent record is written and is
honoured while the implementation runs if the implementation honours it; a call already sent is never abandoned
mid-flight, because an abandoned call is an unresolved intent, which is the expensive state.

**The factory holds no policy.** It does not know what a rule is, does not read the catalogue, and cannot form a
verdict. It knows the order. Everything it decides, it decides by asking something else.

**Internal tools are not exempt, they are cheap.** A tool with the internal origin still writes an intent record
and still obtains a verdict; since it declares `writes: false` and touches no platform, the verdict is `allow`
under every ordinary catalogue. The cost is a record and a pure evaluation, and the benefit is that there is only
one registration path to audit.

## Error Matrix

| Code | Cause | Handled by | What the user sees |
| --- | --- | --- | --- |
| `LEDGER_INTENT_UNWRITABLE` | The store refused or could not durably accept the record of intent | Wrapper; the job fails | An ERROR card stating that the product could not record the action and therefore did not perform it |
| `LEDGER_RESULT_UNWRITABLE` | The call was made but its outcome could not be recorded | Wrapper; the job fails after appending an error record when writes resume | An ERROR card stating that the action was performed but could not be recorded, and naming what to check |
| `GATE_UNAVAILABLE` | The evaluator could not be reached | Wrapper; treated as `GATE_FAILED` | The banner that says writes are halted, from `gate-evaluation@0.1.0` |
| `GATE_FAILED` | The evaluator returned a failure — catalogue unreadable, invalid, a needed count unavailable | Wrapper; fail-closed for every write across the product | The same banner, naming what must be repaired |
| `SNAPSHOT_UNREADABLE` | A reversible write could not read the state it was about to change | Wrapper; the call is refused and the reason recorded | An ERROR card stating the action was not performed because its previous state could not be captured |
| `TOOL_EXECUTION_FAILED` | The implementation failed — the platform refused, timed out, or rate-limited | Caller of the wrapper: the job's retry policy decides | The job's ordinary failure or retry presentation |
| `CANCELLED` | The job was cancelled at this call boundary | Wrapper; nothing is executed | The job shows as cancelled with what it completed |
| *(unknown tool)* | The model named a tool the session does not hold | The engine, before the wrapper | Nothing; the agent is told the tool does not exist and re-plans |

## Compatibility

**MAJOR** — changing the order of the four steps; adding any way to obtain a `WrappedTool` other than the
factory; adding any way to reach a `ToolImplementation` from outside its wrapper; changing what a verdict other
than `allow` implies for execution; making any `declarations` member optional for a writing tool; changing
`refused` from a result into a thrown failure or the reverse. Each of these changes the security argument rather
than the interface, which is why they are MAJOR even when they are source-compatible.

**MINOR** — adding an optional member to `ToolImplementation`; adding a `WrapperErrorCode` whose handling is
already covered by the rule that a failure never executes; adding a narrowed dependency the factory may use;
adding an origin kind that is strictly narrower than `connector`.

**PATCH** — wording, naming and examples.

**Support window.** Both ends of this contract are inside one application build and update together, so there is
no mixed-version window to support. It is versioned for reviewers, not for runtime negotiation: a MAJOR here is
an instruction to re-run the bypass suite before the change ships.

## Examples

**Accepted** — a connector write tool, declared completely:

```json
{
  "name": "notion_update_page",
  "origin": { "kind": "connector", "connector": "notion" },
  "description": "Update properties of a page.",
  "parameters": {
    "type": "object",
    "properties": { "page_id": { "type": "string" }, "properties": { "type": "object" } },
    "required": ["page_id", "properties"]
  },
  "declarations": {
    "writes": true,
    "isIrreversible": false,
    "changesPermission": false,
    "reconciliation": {
      "method": "readback",
      "read_operation": "notion_get_page",
      "comparison": { "path": "properties", "against": ["before", "intended"], "equality": "normalised" }
    },
    "snapshot": { "read_operation": "notion_get_page", "target_path": "page_id" }
  }
}
```

The factory accepts it, keeps `execute` privately, and returns a wrapped tool whose name and parameter shape are
all the engine ever sees.

**Refused** — the same tool with its reversibility undeclared:

```json
{
  "name": "notion_update_page",
  "origin": { "kind": "connector", "connector": "notion" },
  "description": "Update properties of a page.",
  "parameters": {
    "type": "object",
    "properties": { "page_id": { "type": "string" } },
    "required": ["page_id"]
  },
  "declarations": { "writes": true, "changesPermission": false }
}
```

Refused at registration: a writing tool that declares neither a snapshot plan nor irreversibility is exactly the
case principle IV exists to prevent, and the failure belongs at registration where a connector author sees it,
not at the first call where a user does.

## Migration

Not applicable at `0.1.0`: no predecessor exists, no application code exists yet, and no connector has been
written against an earlier shape. The first MAJOR bump will state here how existing connector manifests are
converted, and will re-run the bypass suite named in `verification.md` before it ships, because the suite is what
the contract's claim rests on rather than the wording above.

---
contract: tool-wrapping
version: 0.2.0
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

At `0.2.0` the same seam carries one further obligation, which is why a registration may now say something more
about itself. Secret material — a token, a key, a credential carried in an argument or returned in a result —
must not leave the wrapper in the clear toward a model request, a stored transcript, a ledger record or a
replicated store. The projection that enforces this sits inside the wrapper, so a tool author's silence is not a
disclosure: a registration *may* carry a `secrets` declaration naming which of its argument and result fields
carry which redaction class, and a field nobody declared is still redacted when it matches a declared class's
recognition rule. The class vocabulary, the field-path grammar and the reference form are owned by
`agent/contracts/secret-redaction@1.0.0` and are referenced here rather than restated, in the same way the
reconciliation vocabulary already is.

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

The `secrets` declaration added at `0.2.0` is in the file and is optional. What the file cannot express is the
half that makes the optionality safe — that an undeclared field matching a declared class's recognition rule is
redacted anyway — because that is a property of the boundary, not of the registration. It is stated under
Semantics.

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
import type { SecretField } from "secret-redaction@1.0.0";

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
  /** Optional since 0.2.0. What this tool knows about its own secret-bearing fields. Never required. */
  secrets?: ToolSecretFields;
  execute: (args: Record<string, unknown>, ctx: ExecutionContext) => Promise<ToolOutcome>;
}

/**
 * An optimisation, not the mechanism. It tells the boundary where a secret is certain to be, so the value is
 * projected by field rather than by recognition. Omitting it — or omitting one field of it — narrows nothing:
 * the boundary still applies every declared class's recognition rule to every argument and every result.
 */
interface ToolSecretFields {
  arguments?: SecretField[];          // paths into the call's arguments
  results?: SecretField[];            // paths into the value a successful call returns
}
// SecretField is { path: FieldPath; class: ClassName }, both owned by secret-redaction@1.0.0. The standalone
// form of this declaration in that contract repeats a schemaVersion and the tool's name so a document can be
// validated on its own; inside a registration both are already present, so neither is repeated here.

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
  | { status: "held"; requestId: string }        // the run suspends here; see agent-session@1.0.0
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
  deps: { ledger: LedgerAppender; evaluate: EvaluateCall; snapshots: SnapshotReader; redact: RedactionProjector }
) => WrappedTool;

/** Narrowed views of the collaborating contracts, so the factory holds no more authority than it needs. */
interface LedgerAppender { append(record: LedgerRecord): Promise<string>; }
type EvaluateCall = (subject: CallSubject, context: EvaluationContext) => Decision | { error: string; detail: string };
interface SnapshotReader { read(plan: SnapshotPlan, args: Record<string, unknown>): Promise<unknown>; }
/** Projects one value for every exit that is not the platform. It cannot allow, refuse, hold or fail a call. */
interface RedactionProjector { project(value: unknown, declared?: SecretField[]): unknown; }

/** What a session is constructed from. It accepts WrappedTool and nothing else (INV-AG-01). */
type ToolSet = ReadonlyArray<WrappedTool>;

type ParameterSchema = { type: "object"; properties: Record<string, unknown>; required?: string[] };
```

**The order, stated once.** Build the call subject from the arguments and the manifest declarations; read the
before state when the tool is a reversible write; append the intent record and wait for it to be durable;
evaluate; on `allow` invoke the implementation; append the result record with the after state and the
compensating action. Any other order is a different contract.

**Where the projection sits, which does not change the order.** The redaction boundary is not a fifth step and
does not decide anything. It is a projection applied twice inside the sequence above: to the arguments *before*
the intent record is built, so the record and the model request never hold the value, and to the result *before*
the result record is built, for the same reason. The implementation is invoked with the unredacted arguments,
because the platform the call is made against is the one destination a secret is supposed to reach (D9,
INV-AG-42). Nothing else about the four steps moves: the subject the gate evaluates and the record the ledger
holds describe the same call that runs.

**Where the interception points sit, which also does not change the order.** The before-a-tool-call and
after-a-tool-result points of `agent/contracts/runtime-lifecycle@1.0.0` bracket the sequence rather than
entering it: the first runs before the arguments are projected and may block the call or transform its
arguments, and the second runs after the result record is written and may transform what the agent is shown.
Neither is a step of the four, neither can be registered in their place, and neither can produce an `allow` —
no return value at any point is an authorisation (INV-AG-40, INV-AG-41). A call that a handler transformed is
gated and recorded in its transformed form, so what was approved and what was recorded are what ran.

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

A capability pack contributes tool declarations through the same file and the same factory
(`agent/contracts/capability-pack@1.0.0`, INV-AG-44). A pack is a source of declarations, never a second
registration route, so nothing in this section is conditional on where a declaration came from.

## Semantics

**A refusal is a result; a broken obligation is a failure.** The three ways a call can stop before it runs are
deliberately not alike. `refused` is an ordinary outcome the agent receives and may re-plan around, and the job
continues. `LEDGER_INTENT_UNWRITABLE` stops the call and fails the job, because principle III makes the durable
record a precondition of the act rather than a report of it. `GATE_FAILED` is fail-closed across the product for
writes, not for this call alone, because an unreadable rule catalogue is indistinguishable from a tampered one.
This separation was decided in `clarifications.md` session 2026-09-12.

**`held` suspends; it does not block the product.** The wrapper returns `held` with the identifier of the
approval request, and the run suspends at that call under `agent/contracts/agent-session@1.0.0`. Whether the
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
verdict. It knows the order. Everything it decides, it decides by asking something else. The redaction
projection does not change this: it is a transformation of values, with no verdict of its own and no way to stop
a call.

**The `secrets` declaration is an optimisation; the default is the mechanism.** A registration that declares
nothing is complete. The boundary applies every declared class's recognition rule to every argument and every
result, so an undeclared field carrying a token is redacted on the strength of the rule alone, and a tool
author's omission is a missed optimisation rather than a disclosure (D9, and the spec scenario "A result
carrying a secret the product did not expect"). What a declaration buys is precision at two points: a field
whose value would not be recognised — an opaque identifier that is nonetheless a credential — is projected
because it was named, and a field named in a declaration is projected without the cost of matching. A
declaration can therefore only widen what is redacted, never narrow it, which is exactly what makes adding it a
MINOR change.

**Redaction never affects the platform call.** The projection is applied to what *leaves* the wrapper. The
implementation receives the arguments as the agent produced them, so no declaration, and no conservative match,
can break a call by removing something the platform needed (INV-AG-42).

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

No code is added at `0.2.0`. The redaction projection has no call-time failure of its own that a caller could
act on: a value it cannot inspect is replaced whole, and a projection that could fail open would be a projection
that discloses on error, which is the one outcome the boundary exists to prevent. The two ways a `secrets`
declaration can be wrong — a path naming no member of the tool's declared parameter shape, and a class no
declaration provides — are refused at registration, where the tool's author sees them, under the codes
`agent/contracts/secret-redaction@1.0.0` owns. That is the same placement `declarations` already uses, and it is
why nothing about it belongs in this table, which is a table of what can happen to a call.

## Compatibility

**MAJOR** — changing the order of the four steps; adding any way to obtain a `WrappedTool` other than the
factory; adding any way to reach a `ToolImplementation` from outside its wrapper; changing what a verdict other
than `allow` implies for execution; making any `declarations` member optional for a writing tool; changing
`refused` from a result into a thrown failure or the reverse. Each of these changes the security argument rather
than the interface, which is why they are MAJOR even when they are source-compatible.

Two further cases became MAJOR when the `secrets` declaration was added, and are written down so that a later
change cannot reach them by increments: making `secrets` required, whether for all tools or for a class of them,
because every registration written before it would stop being valid; and removing the conservative default, so
that an undeclared field escapes projection, because that turns a tool author's omission into a disclosure and
empties INV-AG-42 of content.

**MINOR** — adding an optional member to `ToolImplementation`; adding a `WrapperErrorCode` whose handling is
already covered by the rule that a failure never executes; adding a narrowed dependency the factory may use;
adding an origin kind that is strictly narrower than `connector`.

**Why `0.1.0` → `0.2.0` is MINOR and not MAJOR.** The change is one optional member, `secrets`, on
`ToolImplementation`, which is the first case in the MINOR list above, together with the narrowed
`RedactionProjector` dependency, which is the third. Three things a MAJOR bump exists to protect are all
untouched. The four steps happen in the same order, with the projection applied inside them rather than between
them; the factory is still the only producer of a `WrappedTool` and the implementation is still unreachable; and
no verdict changes meaning. Every registration valid at `0.1.0` is valid at `0.2.0` and behaves identically at
the gate and in the ledger, because the declaration is optional and its absence is not a weaker state: an
undeclared field that matches a declared class's recognition rule is redacted regardless, so a connector author
who never reads this revision loses no protection and gains no obligation. The only observable difference for an
existing tool is the *value* recorded for a secret-bearing field, which is a change to what the record holds,
not to the record's shape — a question `impact.md` carries to the `ledger` owner rather than settling here. The
interception points named under Schema / Surface add no compatibility surface at all: they are described because
a reader must be able to see that they sit outside the four steps, and `runtime-lifecycle@1.0.0` owns them.

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
all the engine ever sees. It declares nothing about redaction and is complete: its arguments and its results
still cross the boundary, and any field of either that matches a declared class's recognition rule is projected.

**Accepted** — the same tool, naming the one field it knows carries a credential:

```json
{
  "name": "notion_update_page",
  "origin": { "kind": "connector", "connector": "notion" },
  "description": "Update properties of a page.",
  "parameters": {
    "type": "object",
    "properties": {
      "page_id": { "type": "string" },
      "properties": { "type": "object" },
      "integration_token": { "type": "string" }
    },
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
  },
  "secrets": {
    "arguments": [{ "path": "integration_token", "class": "connector-authorisation-token" }]
  }
}
```

The projection replaces that field with a reference naming the class and the path before the intent record is
built, and Notion receives the real token, because the platform is the one destination the value is supposed to
reach. Declaring `arguments` and saying nothing about `results` is deliberate and complete: results are still
projected by recognition.

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

**`0.1.0` → `0.2.0`: nothing to convert, and nothing a connector author must do.** No registration written
against `0.1.0` becomes invalid, because the only added member is optional and every `0.1.0` document satisfies
the `0.2.0` file unchanged. No connector manifest is rewritten; no adapter signature changes; the factory's
dependencies gain the projector, which is internal to the main process and crosses no boundary a consumer holds.

A connector author who wants the precision described under Semantics adds a `secrets` block naming the fields
they know to be secret. Doing so is optional at every point in the life of this contract, and the reason it may
stay optional is that the conservative default is what protects an undeclared field. An author who declares
nothing is in exactly the position they were in at `0.1.0`, except that their secrets no longer reach a record.

Consumers listed in the front-matter need no update to keep working. `ledger` reads a record whose shape is
unchanged and whose secret-bearing fields now hold a typed reference — the one behavioural difference in this
revision, and the one carried to the `ledger` owner as an open question in `impact.md`. `approval` evaluates a
subject built from the same members. `connector`, `job` and `undo` see no change at all; in particular a
compensating action is built from the same snapshot and the same after state, because the adapter's view of a
call is unredacted.

Not applicable at `0.1.0`: no predecessor existed, no application code existed yet, and no connector had been
written against an earlier shape. The first MAJOR bump will state here how existing connector manifests are
converted, and will re-run the bypass suite named in `verification.md` before it ships, because the suite is what
the contract's claim rests on rather than the wording above.

Evidence for this revision: the wrapper's guarantee under an unconfigured interception facility is VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2, bypass vector 2), and the harness this contract is implemented against
remains `@earendil-works/pi-agent-core@0.85.1`, with `@oh-my-pi/*` refused as a dependency — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9). The redaction obligation itself is **UNVERIFIED**: no measurement of
what reaches a model request, a transcript, a record and a replicated envelope exists yet, and one is scheduled
in `verification.md`. The reference architecture treats the same class of material as never belonging in a
conversation (`https://omp.sh/docs/secrets`, **UNVERIFIED** — vendor documentation of a different runtime, read
as a design space and never as a component).

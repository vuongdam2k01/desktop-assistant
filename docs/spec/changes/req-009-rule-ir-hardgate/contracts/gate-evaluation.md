---
contract: gate-evaluation
version: 0.1.0
status: draft
owner: approval
consumers: [agent, connector, ledger, uix, job]
schema_files: [gate-evaluation.asyncapi.yaml]
---

# Contract: Gate Evaluation

## Purpose

This contract defines the one way a tool call becomes a decision, and the boundary that decision lives behind. It
serves two audiences. The tool wrapper that every connector tool passes through uses the evaluation surface: it
submits what the call is about and receives a verdict, and it has no other way to reach the connector. The
application and pet windows use the channels: they display approval requests, carry the user's decision back, and
list the rules — and, critically, they cannot ask for a verdict, cannot supply a call subject, and cannot execute
a tool.

The separation is the point. Evaluation is a synchronous, model-free decision inside the process that owns the
connectors and the ledger. Everything a window can do is presentation and human decision. A compromised window
can therefore annoy the user but cannot manufacture permission.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`gate-evaluation.asyncapi.yaml`](./gate-evaluation.asyncapi.yaml) | AsyncAPI 3.0 | normative |

The AsyncAPI document carries the eleven channels and every payload they exchange. It is worth reading for what
it does not contain: no channel accepts a call subject, none returns or injects a decision, none executes,
retries or replays a tool, and none reaches a hardline rule or a ledger record. The evaluation surface itself is
deliberately absent from it, because evaluation is a synchronous in-process decision and putting it on a channel
would be putting it within reach of a window.

Two things the format cannot state are stated here instead, and both are load-bearing. The first is the order
the wrapper must observe around a verdict, below. The second is that an `EvaluationFailure` is neither `refuse`
nor `allow`: the schema can describe the failure, not the rule that a call which cannot be judged does not run.

The payload of a rule on `rules/list` and `rules/upsert` is owned by
[`rule-representation.schema.json`](./rule-representation.schema.json) and is referenced rather than restated,
so that the shape a window reads and the shape the gate evaluates cannot drift apart.

## Schema / Surface

### 1. Interface & Data Types

```typescript
/** Everything the gate is permitted to look at. Assembled by the wrapper, never by a window. */
interface CallSubject {
  callId: string;
  connector: string;
  tool: string;
  /** The call's own arguments, exactly as the agent produced them. The subject of judgement, not an input to it. */
  arguments: Record<string, unknown>;
  /** Read from the connector's record of the object. Never from `arguments`. */
  object?: {
    type: string;                    // a type the connector manifest declares
    id: string;                      // immutable identity per that manifest
    ancestorIds: string[];
    createdBy?: string;
    assignedTo?: string[];
  };
  /** Read from the connector manifest's declaration for this tool. */
  isIrreversible: boolean;
  changesPermission: boolean;
}

/** The state the decision is taken against. Supplied by the job and the stores, not by the agent. */
interface EvaluationContext {
  jobId: string;
  /** The mode recorded on the job when it was created, not the mode currently configured. */
  mode: "on" | "smart" | "off";
  currentUser: string;
  now: string;                       // ISO-8601 instant
  timezone: string;                  // the user's zone, e.g. "Asia/Ho_Chi_Minh"
}

interface Decision {
  verdict: "allow" | "hold" | "refuse";
  /** Every rule that matched, strictest first. Empty when nothing matched and the verdict is allow. */
  matched: Array<{
    ruleId: string;                  // a stored rule's id, or a hardline/static identifier
    origin: "hardline" | "static" | "user";
    name: string;
    verdict: "allow" | "hold" | "refuse";
  }>;
  /** Stated in the user's language, for the request card and the ledger record. */
  reason: string;
  /** Present only when the verdict is refuse and the origin is hardline: no approval may be offered. */
  unappealable?: true;
}

/**
 * The whole decision. Pure: given the same subject, context and stored state it returns the same Decision,
 * consults no model, performs no network call, and changes nothing but the record it produces.
 */
type Evaluate = (subject: CallSubject, context: EvaluationContext) => Decision | EvaluationFailure;

interface EvaluationFailure { error: EvaluationErrorCode; detail: string; }

type EvaluationErrorCode =
  | "RULE_CATALOGUE_UNREADABLE"
  | "RULE_CATALOGUE_INVALID"
  | "RULE_VERSION_AHEAD"
  | "MANIFEST_DECLARATION_MISSING"
  | "FIELD_VALUE_UNEXTRACTABLE"
  | "COUNT_UNAVAILABLE"
  | "EVALUATION_FAILED";

/** The grant a user's job-scoped approval creates. All four parts are required to match a later call. */
interface ScopedApproval {
  jobId: string;
  ruleId: string;
  tool: string;
  objectScope: { type: string; id: string };
  grantedAt: string;
}

/** Held for the length of a job once anything in it was refused or held. */
interface RefusalNotice {
  jobId: string;
  tool: string;
  object?: { type: string; id: string };
  ruleId: string;
  ruleName: string;
  reason: string;
  at: string;
}
```

**The order the wrapper must observe.** Write the ledger record of intent; evaluate; act only on `allow`; write
the ledger record of the result. The wrapper holds the tool's implementation privately, so that a verdict other
than `allow` does not merely decline to call it — there is no reachable name by which it could be called. A
failure to write the intent record stops the call before evaluation, per principle III.

### 2. Wire / Communication Protocol

These channels cross the boundary between the process that owns connectors, rules and the ledger, and the windows
the user sees. Direction `main → window` is an event the window renders; `window → main` is a request the user
made. There is deliberately no channel that submits a `CallSubject`, requests a `Decision`, or executes a tool.

The normative surface is [`gate-evaluation.asyncapi.yaml`](./gate-evaluation.asyncapi.yaml), which holds every
payload named below. The table is the index a reader needs beside it: which direction a channel runs, which
interaction it is, and which error codes it can answer with — the last of which the format has no place for.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `approval/request` | main → window | Pub-Sub | — | `ApprovalRequest` | None; a window that cannot render it is a display fault and the request remains pending. |
| `approval/decide` | window → main | Request-Response | `ApprovalDecision` | `ApprovalDecisionAccepted` | `APPROVAL_REQUEST_UNKNOWN`, `APPROVAL_REQUEST_EXPIRED`, `APPROVAL_NOT_APPEALABLE`, `APPROVAL_LEVEL_FORBIDDEN`. |
| `approval/withdrawn` | main → window | Pub-Sub | — | `ApprovalWithdrawn` | None; the window removes the card. |
| `approval/refusal-notice` | main → window | Pub-Sub | — | `RefusalNotice` | None; the window attaches it to every question it shows for that job. |
| `rules/list` | window → main | Request-Response | `EmptyRequest` | `RuleCatalogueResult` | `RULE_CATALOGUE_UNREADABLE`, `RULE_CATALOGUE_INVALID`, `RULE_VERSION_AHEAD`. |
| `rules/upsert` | window → main | Request-Response | `RuleUpsertRequest` | `RuleIdResult` | `RULE_SCHEMA_INVALID`, `RULE_PATTERN_INVALID`, `RULE_REFERENCE_UNKNOWN`, `RULE_ORIGIN_FORBIDDEN`. |
| `rules/delete` | window → main | Request-Response | `RuleIdRequest` | `DeletedResult` | `RULE_UNKNOWN`, `RULE_NOT_DELETABLE`. |
| `allowlist/list` | window → main | Request-Response | `EmptyRequest` | `AllowlistResult` | `RULE_CATALOGUE_UNREADABLE`. |
| `allowlist/delete` | window → main | Request-Response | `AllowlistIdRequest` | `DeletedResult` | `ALLOWLIST_ENTRY_UNKNOWN`. |
| `mode/set` | window → main | Request-Response | `ModeRequest` | `ModeResult` | None; takes effect for jobs created afterwards only. |
| `gate/health` | main → window | Pub-Sub | — | `GateHealth` | None; the `stopped` state is what drives the banner telling the user writes are halted. |

**Channels that deliberately do not exist.** No channel evaluates a call on a window's behalf; no channel returns
or injects a `Decision`; no channel executes, retries or replays a tool call; no channel edits a hardline rule,
because hardline rules are not in the store a window can reach; no channel edits or deletes a ledger record.

### 3. Module Descriptor / Manifest Specification

Not applicable. This contract consumes the connector manifest — for object identity, irreversibility and
permission declarations — and defines no descriptor of its own. See `contracts/rule-representation.md` and the
Manifest Schema section of `model.md`.

## Semantics

**Purity.** `Evaluate` reads the subject, the context, the loaded catalogue and the counts its conditions name.
It performs no network call, consults no model, and mutates nothing. Called twice with the same inputs it returns
the same `Decision`, which is what makes a disputed decision reproducible after the fact.

**Mode is a property of the job.** The mode in `EvaluationContext` is the one recorded on the job when it was
created. Changing the mode while a job runs does not change how that job is judged.

**Order of consideration.** Hardline rules are considered before the mode is looked at, so a hardline refusal
holds in every mode and carries `unappealable`. A refusal the user cannot appeal is never turned into an approval
request, and `approval/decide` rejects any attempt to decide one with `APPROVAL_NOT_APPEALABLE`.

**Strictest wins.** `matched` lists every rule that matched, strictest first, and `verdict` is the strictest among
them. The list is what the request card shows the user and what the ledger record keeps, so that the user can see
all the reasons an operation stopped rather than only the first.

**A grant is matched, not spent.** A `ScopedApproval` covering a later call is matched afresh each time; it is
never consumed, and it never widens. Absent any of its four parts it matches nothing. It ends when its job ends.

**Unattended jobs.** When no person is present, a `hold` verdict is treated as a denial: the job pauses and the
request waits. Nothing approves itself.

**Failure is not a verdict.** An `EvaluationFailure` is not `refuse` and not `allow`. The call does not execute,
the failure is recorded with its code, the user is told, and `gate/health` reports `stopped` for the codes that
halt writes generally — an unreadable, invalid or forward-versioned catalogue. `FIELD_VALUE_UNEXTRACTABLE` and
`COUNT_UNAVAILABLE` concern one call and hold that call for the user rather than halting every write.

**Counts.** `COUNT_UNAVAILABLE` means the ledger could not answer a count a rule needed. That call is held. It is
not treated as a count of zero, because a count of zero is exactly the answer an attacker would want.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `RULE_CATALOGUE_UNREADABLE` | The stored catalogue cannot be read. | Callee (gate) | All writes stop. A banner states that rules could not be loaded and offers to retry; reads continue. |
| `RULE_CATALOGUE_INVALID` | The catalogue does not validate against the rule representation. | Callee (gate) | All writes stop; the offending rule is named. The catalogue is never partially loaded. |
| `RULE_VERSION_AHEAD` | The catalogue was written by a newer release, typically arriving by replication. | Callee (gate) | All writes stop; the user is offered the update. This device does not guess at what it cannot read. |
| `MANIFEST_DECLARATION_MISSING` | The tool's manifest does not declare irreversibility or permission effect. | Callee (gate) | That tool's calls are refused. The connector is reported as incompletely declared. |
| `FIELD_VALUE_UNEXTRACTABLE` | A field a matching rule needs cannot be extracted from the call. | Callee (gate) | That one call is held for the user's decision, with the field named. |
| `COUNT_UNAVAILABLE` | The ledger could not answer a count a rule named. | Callee (gate) | That one call is held for the user's decision. Never counted as zero. |
| `EVALUATION_FAILED` | Evaluation raised an unexpected fault. | Callee (gate) | The call does not execute; the fault is recorded and reported. |
| `LEDGER_WRITE_FAILED` | The record of intent could not be written before the call. | Callee (wrapper) | The call does not execute and the job fails, naming the ledger failure — principle III. |
| `APPROVAL_REQUEST_UNKNOWN` | A decision names a request that does not exist. | Caller (window) | Nothing happens; the window refreshes its list. |
| `APPROVAL_REQUEST_EXPIRED` | The waiting period elapsed before the decision arrived. | Both | The job is already paused; the operation is re-evaluated if the user resumes, never executed on the strength of the late answer. |
| `APPROVAL_NOT_APPEALABLE` | A decision was submitted for a hardline refusal. | Caller (window) | Refused, and recorded. The window should never have offered the choice. |
| `APPROVAL_LEVEL_FORBIDDEN` | A permanent allowlist entry was requested for an operation a stopping rule also matches. | Callee (gate) | Refused, with the rule named and the explanation that the exception belongs inside that rule. |
| `RULE_NOT_DELETABLE` | Deletion was requested for a rule that is not in the stored catalogue. | Callee (gate) | Refused. Hardline rules and static patterns are not deletable and are not offered as such. |
| `RULE_UNKNOWN`, `ALLOWLIST_ENTRY_UNKNOWN` | The named rule or entry does not exist, typically because another device deleted it. | Both | The window refreshes; no error is shown for a deletion that has already happened. |

## Compatibility

**MAJOR** — removing a channel, changing the direction or meaning of one, adding any channel by which a window
could obtain a verdict or reach a tool, changing the order the wrapper must observe, or changing what
`EvaluationFailure` implies for execution. Each of these changes the security argument, not merely the interface.

**MINOR** — adding a channel that only presents or only carries a human decision; adding an optional member to a
payload; adding an error code whose handling is already covered by the general rule that failure does not execute.

**PATCH** — wording and examples.

**Support window.** The channels are internal to one application build: both ends update together, so no mixed
version of this contract exists at runtime. The version is recorded so that a ledger record written by an older
build can still be read and explained.

## Examples

A valid exchange. The agent attempts to archive a page in the HR database; the user's rule holds it; the user
approves it for this job; a second call against a different page stops again.

```text
wrapper → ledger      intent{ callId: c1, tool: archive_page, object: page/p-114 }
wrapper → Evaluate    subject{ c1, notion, archive_page, object{page, p-114, ancestors:[db-hr-portal-uuid-001]} }
Evaluate → wrapper    { verdict: "hold",
                        matched: [{ ruleId: "rule_7f3a91", origin: "user",
                                    name: "Ask before archiving anything in HR", verdict: "hold" }],
                        reason: "Archiving a page in HR Portal; your rule asks to be consulted first." }
main    → window      approval/request{ requestId: r1, jobId: j9, tool: archive_page, object: page/p-114, … }
window  → main        approval/decide{ requestId: r1, level: "job" }
                      → grant ScopedApproval{ jobId: j9, ruleId: rule_7f3a91,
                                              tool: archive_page, objectScope: { type: page, id: p-114 } }
wrapper → Evaluate    subject{ c2, notion, archive_page, object{page, p-222, …} }
Evaluate → wrapper    { verdict: "hold", … }     ← the grant named p-114; a different page is a new decision
```

A rejected exchange, and why. A renderer window attempts to obtain permission directly:

```text
window  → main        approval/decide{ requestId: "hl-7", level: "once" }
main    → window      error APPROVAL_NOT_APPEALABLE
```

Request `hl-7` was a hardline refusal, which carries `unappealable` and raises no approval request at all — so no
window should hold that identifier, and one that does is either stale or forged. The attempt is refused and
recorded. There is no payload a window could send, on this channel or any other, that would cause the archive to
run: the only route to the tool's implementation is a wrapper that received `allow` from `Evaluate`, and no
channel reaches `Evaluate`.

## Migration

Not applicable at version 0.1.0 — first published version, and both ends of every channel ship in the same build.

---
contract: resource-coordinator
version: 0.1.0
status: draft
owner: connector
consumers: [connector, agent, job, ledger, approval, app, uix]
schema_files: [resource-coordinator.schema.json]
---

# Contract: Resource Coordinator

## Purpose

This is the surface between a wrapped tool call and the platform it is going to touch. It exists because two
things that are correct on their own are wrong together: a product that runs jobs in parallel, and a ledger
record whose before state is read at one moment and acted on at another. The coordinator closes the gap by
making the span from the read to the record an exclusive one, and by making every request to one platform pass
through one paced, fair queue instead of through whichever agent happened to issue it.

Two audiences depend on it. The wrapping layer calls it, and needs to know exactly when its exclusive span
begins and ends, what it must do when the gate holds a call, and what it may conclude from each refusal. The job
manager calls it for admission, and needs the refusals to arrive in a fixed vocabulary so that what is retried
and what ends a job is decided once rather than per platform.

What it deliberately does not do is decide anything about permission. It holds no rule, forms no verdict and
reads no catalogue (INV-CN-13). It is the last component before a platform, which is exactly why it must not be
able to allow anything.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`resource-coordinator.schema.json`](./resource-coordinator.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of the one thing the coordinator lets out: the read-only picture returned on
`coordinator.inspect`, which is what lets a surface say *waiting for the object job 3 is changing* instead of
*working…*. Its `$defs` carry the refusal shape every operation returns in place of throwing, with the closed code
vocabulary and the rule that the three defects and the cancellation are never marked retryable.

The operations are deliberately not in it, and that absence is the contract: `acquire`, `suspend`, `resume`,
`dispatch` and every release are in-process only, so there is nothing to publish. A coordinator reachable across a
process boundary would be one a compromised window could call, and the ability to release another job's lease is
the ability to defeat everything this contract guarantees.

What the file cannot express is what the rest of this document is for: when the exclusive span begins and ends,
that `suspend` is legal exactly once, that `resume` compares against the state that was recorded rather than the
state that was intended, and that a coordinator refusal is never dressed as a platform failure (INV-CN-20).

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { JobId, CorrelationId } from "ledger/contracts/ledger-record@0.1.0";
import type { ToolDeclaration } from "connector/contracts/connector-manifest@1.2.0";

/** The name of one thing that can be held exclusively: `<connector>:<type>:<identifier>` (INV-CN-16). */
type ResourceKey = string;

/** Whether a person started the job. It changes share of dispatch and slot eligibility, nothing else. */
type JobClass = "interactive" | "background";

interface CoordinatedCall {
  jobId: JobId;
  jobClass: JobClass;
  correlationId: CorrelationId;        // the ledger correlation identifier of this call
  connectorId: string;
  authorisationRef: string;            // which authorisation the request is paced against; never part of a key
  tool: string;
  declaration: ToolDeclaration;        // as loaded at registration; never reconstructed from the arguments
  arguments: Record<string, unknown>;  // the same values the adapter will address
  signal: AbortSignal;
}

/** One exclusive span. Obtained whole, released once, re-established at most once (INV-CN-17, INV-CN-19). */
interface Bracket {
  readonly keys: ReadonlyArray<ResourceKey>;   // canonical order
  readonly acquiredAt: string;                 // ISO-8601
  /** Release for an approval that waits on a person. Legal exactly once, before execution. */
  suspend(): Promise<SuspensionToken>;
  release(): Promise<void>;                    // idempotent; called when the result record is durable
}

interface SuspensionToken {
  readonly correlationId: CorrelationId;
  readonly keys: ReadonlyArray<ResourceKey>;
}

type AcquireOutcome =
  | { ok: true; bracket: Bracket }
  | { ok: false; error: CoordinatorError };

type ResumeOutcome =
  | { ok: true; bracket: Bracket; stateMatches: true }
  | { ok: false; error: CoordinatorError };    // STATE_CHANGED when the target no longer matches

interface ResumeInput {
  token: SuspensionToken;
  recordedBefore: unknown;                     // the before state the intent record holds, not the intended one
  compare: (recorded: unknown, current: unknown) => boolean;  // the connector's own snapshot comparison
}

/** Admission against a connector account's concurrency limit. Held only while the job is `running`. */
type SlotOutcome =
  | { ok: true; slot: AdmissionSlot }
  | { ok: false; error: CoordinatorError };    // SLOT_UNAVAILABLE — the job stays `queued`

interface AdmissionSlot {
  readonly connectorId: string;
  readonly authorisationRef: string;
  readonly reserved: boolean;                  // taken from the slot reserved for the interactive class
  release(): Promise<void>;                    // on leaving `running`, for any reason
}

interface ResourceCoordinator {
  /** Derive the keys this call needs, without acquiring anything. Used by the job manager when planning. */
  keysFor(call: CoordinatedCall): ResourceKey[] | { error: CoordinatorError };

  /** Obtain every declared resource, all at once, in canonical order, within the wait limit. */
  acquire(call: CoordinatedCall): Promise<AcquireOutcome>;

  /** Obtain them again after an approval, and compare the target with the recorded before state. */
  resume(input: ResumeInput): Promise<ResumeOutcome>;

  /** Dispatch the platform request under this authorisation's fair queue and pacing budget. */
  dispatch<T>(call: CoordinatedCall, run: () => Promise<T>): Promise<T | { error: CoordinatorError }>;

  /** Admission against the connector account's concurrency limit. */
  requestSlot(jobId: JobId, jobClass: JobClass, connectorId: string, authorisationRef: string): Promise<SlotOutcome>;

  /** Everything the job holds — leases, queued requests, slots — released at a terminal state. */
  releaseJob(jobId: JobId): Promise<void>;

  /** What is held and what is waiting, for the job detail surface and for diagnosis. Read-only. */
  inspect(): Promise<CoordinatorSnapshot>;
}

interface CoordinatorSnapshot {
  leases: Array<{ key: ResourceKey; jobId: JobId; heldForMs: number; depth: number }>;
  waits: Array<{ jobId: JobId; keys: ResourceKey[]; waitingForMs: number; heldBy: JobId[] }>;
  queues: Array<{ authorisationRef: string; jobId: JobId; depth: number; pausedUntil?: string }>;
  slots: Array<{ authorisationRef: string; total: number; reserved: number; held: JobId[] }>;
}

interface CoordinatorError {
  code: CoordinatorErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  heldBy?: JobId;          // for RESOURCE_HELD, so the wait can be explained rather than merely reported
  key?: ResourceKey;
}

type CoordinatorErrorCode =
  | "RESOURCE_HELD"             // the wait limit elapsed with a declared resource still held
  | "RESOURCE_UNDECLARED"       // the call needs a resource its declaration did not name
  | "RESOURCE_KEY_UNRESOLVABLE" // a declared path is absent from the arguments and is not optional
  | "STATE_CHANGED"             // the target no longer matches the recorded before state after an approval
  | "SLOT_UNAVAILABLE"          // the connector account's concurrency limit is reached
  | "BRACKET_INVALID"           // suspend or resume used out of order, or twice
  | "COORDINATOR_UNAVAILABLE"   // the coordinator is starting or shutting down
  | "CALL_CANCELLED";           // the job was cancelled while waiting or queued
```

**What may not happen.** The coordinator does not throw for contention: it returns a `CoordinatorError`, so the
wrapping layer can record an outcome for the intent it has already written. It never returns a connector error
code and never lets one of its own codes be presented as a platform failure (INV-CN-20). It does not call an
adapter itself — `dispatch` runs the function the wrapping layer supplied, at the moment the pacing budget
permits — and it never retries anything, because the retry budget belongs to the job.

### 2. Wire / Communication Protocol

The coordinator has no channel of its own in the direction that matters. It lives in the one process that owns
connectors, the ledger and the gate, and every call into it is an ordinary in-process invocation from the
wrapping layer or the job manager. This is the same deliberate absence that `agent/contracts/tool-wrapping@0.1.0`
records: a coordinator reachable across a process boundary would be a coordinator a compromised window could
call, and the ability to release another job's lease is the ability to defeat everything this contract exists to
guarantee.

One read-only channel exists outward, for surfaces that must explain a wait to the user:

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `coordinator.inspect` | Window → Coordinator | Request-Response | — | `CoordinatorSnapshot`, normatively [`resource-coordinator.schema.json`](./resource-coordinator.schema.json) | `COORDINATOR_UNAVAILABLE`; the surface says the coordinator cannot be read rather than showing an empty state that looks like idleness |
| `coordinator.waits` | Coordinator → Window | Stream | — | A wait beginning or ending, with its keys and holder | Stream loss is not an error: the surface re-reads through `coordinator.inspect` |
| *(acquire, suspend, resume, dispatch, release)* | — | — | — | — | Not exposed. In-process only, beside the call being coordinated |

### 3. Module Descriptor / Manifest Specification

Not applicable here. The pluggable half of this capability — which arguments name resources, how identifiers are
normalised, and what a platform tolerates — is specified by
`connector/contracts/coordination-declaration@0.1.0`, which this contract reads and does not restate.
[`resource-coordinator.schema.json`](./resource-coordinator.schema.json) is not a descriptor either: nothing
registers by satisfying it, and it describes only what `coordinator.inspect` returns and what a refusal looks
like.

## Semantics

- **`acquire` obtains the whole set or nothing.** The keys are sorted canonically and taken in one attempt; a
  call that cannot have all of them holds none of them while it waits, and waits at most the configured limit —
  15 seconds by default, sourced from `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`
  item 1. Ordering alone would prevent cycles; ordering plus wholeness also prevents a waiting call from
  withholding a resource nobody else can use.
- **The bracket begins before the before state is read and ends when the result record is durable.** Not when
  the platform answers. This is the property that was measured: with the span ending at the platform's answer,
  another job can read its own before state in the window before the result is recorded, which is the same stale
  read by a narrower margin — `spikes/SP-15-concurrency/REPORT.md` §1 Q2.
- **`suspend` is legal exactly once, and only for an approval.** It releases the leases while a person decides,
  because the alternative is one user's deliberation stopping every other job on that object, with the 15-second
  limit turning the stall into failures nobody can explain. `resume` obtains the same keys again and compares
  the target with the before state the intent record holds. A second `suspend` on one bracket is
  `BRACKET_INVALID`: permitting it would allow a call to be verified, released, and executed against a third
  state (INV-CN-19).
- **`resume` compares against what was recorded, not against what was intended.** An object changed and changed
  back matches, and executes. An object changed and left changed is `STATE_CHANGED`, the call does not execute,
  and the agent receives a refusal it may re-plan around — a new call, with its own before state and its own
  verdict, never a resumption of the old one.
- **`dispatch` runs the caller's function at the moment the budget permits.** The coordinator owns when, not
  what: it holds one queue per job under one authorisation and rotates between them, so a job's wait is bounded
  by the number of jobs rather than by another job's backlog — 252 ms against 4,251 ms in the measured
  comparison. When the platform states a delay, every job under that authorisation waits together, because the
  budget belongs to the authorisation and not to the job that happened to be refused.
- **Reentrancy is counted.** A job that already holds a key obtains it again without waiting, and the lease is
  released only when the outermost bracket releases it. An uncounted reentrancy would end the exclusive span at
  the inner call's result, which is before the outer call's result is durable (INV-CN-18).
- **`requestSlot` refuses rather than queues.** `SLOT_UNAVAILABLE` is the job manager's signal to leave the job
  `queued` and ask again when a slot is released; the coordinator does not hold a waiting list of jobs, because
  the job manager already holds one and two queues would need a rule about which is authoritative.
- **`releaseJob` is the reclaiming path.** A job that fails, is cancelled or times out releases everything at
  once. Nothing else reclaims a lease, and nothing needs to: one process holds them all, so a process that stops
  releases them by ceasing to exist (INV-CN-21).
- **A cancelled call stops waiting but not mid-flight.** `CALL_CANCELLED` is returned to a call still waiting for
  a lease or a dispatch. A request already sent to a platform is never abandoned, which is the rule `job`
  already states for cancellation, and the interrupted case stays owned by
  `job/contracts/tool-reconciliation@0.1.0`.
- **`inspect` is read-only and exists for explanation.** It is what lets a surface say "waiting for the object
  job 3 is changing" instead of "working…", and it is deliberately the only thing a window may reach.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `RESOURCE_HELD` | The wait limit elapsed with a declared resource still held by another job | Caller: the job's bounded retry policy | Nothing while retries continue; if they are exhausted, the job fails naming the job that held the object, and no connector is shown as unhealthy |
| `RESOURCE_UNDECLARED` | The call needs a resource its manifest declaration did not name | Caller, as a defect in the connector | An ordinary failure card; the defect is reported to the connector's author, because the alternative is acquiring a lease after the bracket began |
| `RESOURCE_KEY_UNRESOLVABLE` | A declared, non-optional argument path is absent from the call's arguments | Caller, as a defect | The call fails without touching the platform; nothing is held and nothing is written |
| `STATE_CHANGED` | After an approval, the target no longer matches the before state the intent record holds | Caller: returned to the agent as a refusal | The user is told the object changed since they were asked, and that the action was not performed |
| `SLOT_UNAVAILABLE` | The connector account is running its configured number of jobs | Caller: the job stays `queued` | The job is shown as queued with what it is waiting for, rather than as running and doing nothing |
| `BRACKET_INVALID` | `suspend` or `resume` called out of order, or twice on one bracket | Caller, as a defect | The call fails and nothing executes; this is a product defect, never a condition a user can resolve |
| `COORDINATOR_UNAVAILABLE` | The coordinator is starting or shutting down | Both | No call reaches any platform; a job that needed one fails stating so, and nothing falls back to an uncoordinated route |
| `CALL_CANCELLED` | The job was cancelled while the call waited for a lease or a dispatch | Caller | The job shows as cancelled with what it completed; nothing was sent to the platform |

## Compatibility

**MAJOR** — removing a method; changing when the bracket begins or ends; permitting more than one `suspend` per
bracket; making `resume` compare against the intended state rather than the recorded one; exposing `acquire`,
`suspend`, `resume`, `dispatch` or any release across the process boundary; removing an error code or changing
what one means; making a coordinator refusal a connector error code. Several of these are source-compatible and
are still MAJOR, because each changes what the rest of the product may conclude rather than what it may call.

**MINOR** — adding a method; adding an optional member to `CoordinatedCall` or `CoordinatorSnapshot`; adding an
error code whose handling the existing rules already cover, such as a further never-retryable defect; adding a
read-only channel.

**PATCH** — wording, messages that do not change a code, and examples.

**Support window.** Both ends live in one application release and update together, so there is no mixed-version
window. The version is for reviewers: a MAJOR here is an instruction to re-run the dirty-snapshot reproduction
and the deadlock suite named in `verification.md` before the change ships, because those suites — not this
prose — are what the correctness claim rests on.

## Examples

**Accepted** — the whole of one write call, in the order that is the contract:

```typescript
const admitted = await coordinator.requestSlot(jobId, "interactive", "notion", authRef);
if (!admitted.ok) return stayQueued(admitted.error);            // SLOT_UNAVAILABLE

const acquired = await coordinator.acquire(call);                // whole set, canonical order, <= 15 s
if (!acquired.ok) return refuse(acquired.error);                 // RESOURCE_HELD -> the job retries

const before = await adapter.fetchSnapshot(call, auth);          // inside the bracket
await ledger.append(intentRecordWith(before));                   // durable before anything else
const verdict = evaluate(subject, context);

if (verdict.kind === "hold") {
  const token = await acquired.bracket.suspend();                // the person decides; nothing is held
  await waitForDecision(requestId);
  const resumed = await coordinator.resume({ token, recordedBefore: before, compare });
  if (!resumed.ok) return refuse(resumed.error);                 // STATE_CHANGED -> a refusal, not an execution
}

const result = await coordinator.dispatch(call, () => adapter.execute(call, auth));
await ledger.append(resultRecordFor(correlationId, result));     // durable
await acquired.bracket.release();                                // only now
```

**Rejected** — the same call with the release moved one line earlier:

```typescript
const result = await coordinator.dispatch(call, () => adapter.execute(call, auth));
await acquired.bracket.release();                                // the platform answered, so we let go
await ledger.append(resultRecordFor(correlationId, result));
```

Refused as a contract violation, and it is the violation worth naming precisely because it looks harmless. In
the window between the release and the append, a second job may acquire the same key and read its before state —
which is the state this call produced but has not yet recorded. The second job's record is then true about the
world and inconsistent with the history, and when the first job's result finally lands, two records describe one
object in an order that never happened. The measured version of this failure is
`spikes/SP-15-concurrency/REPORT.md` §1 Q2; this variant is the same defect with a smaller window, and a smaller
window is what makes it survive testing.

## Migration

Not applicable at 0.1.0 — this is the first version and has no consumers on an earlier one. What this contract
does require of an existing one is carried by this change itself: `connector/contracts/connector-manifest` is
republished here at `1.2.0`, additively, to carry the coordination declaration. Every manifest valid under
`1.1.0` remains structurally valid; what changes is that a manifest whose write tool declares no resources is
refused whole. `evolution.md` states the steps and `impact.md` records the consumers.

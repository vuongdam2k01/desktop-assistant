## Context

The product's reasoning is done by an embedded third-party agent engine, and every guarantee the constitution
makes about gating and recording has to survive that fact. The engine supplies the multi-step loop, a tool
registry, a provider layer and a transcript; it supplies none of the product's obligations, and it is under
someone else's release schedule — roughly two to three minor releases a month —
VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9).

Three things are already settled elsewhere and are treated here as given. `req-009-rule-ir-hardgate` publishes
`approval/contracts/gate-evaluation@0.1.0`, which is the only way a verdict is obtained and which already states
the order a wrapper must observe. `req-013-sqlite-ledger` publishes `ledger/contracts/ledger-record@0.1.0` and
`ledger/contracts/ledger-store@0.1.0`, which make a durable record a precondition of an act and define what a
crash leaves behind. `req-022-account-sync` publishes the replication descriptor that any account-owned store
must register under. This change adds the layer between those and the engine, and it is deliberately the only
layer that knows the engine exists.

One constraint shapes everything below: the spike measured the engine under a plain runtime, not inside the
application framework the product ships. Nothing in the design depends on a capability that was not measured, but
the environment the measurements were taken in is not the environment the product runs in, and `verification.md`
records closing that gap as an open measurement rather than as an assumption.

## Goals / Non-Goals

**Goals.** One registration path for tools that cannot be bypassed by forgetting it. A suspension that survives a
process ending. Sessions that share nothing. A provider surface that matches what the embedded path actually
offers. A pinned engine identity that a build enforces.

**Non-Goals.** The worker's own reasoning loop and its self-verification discipline (`req-006-agent-loop`). The
role-to-model matrix and cost presentation (`req-017-provider-matrix`). The connector manifest and adapter
interface (`req-019-connector-framework`). The rules themselves and how they are written (`req-009`, `req-004`).
The mid-run question mechanism and the offline queue (`req-021-ask-user-offline`); this change specifies only
that a question is a suspension of the same kind as an approval.

## Structure

| Component | Responsibility | Model entity | Reaches other domains through |
| --- | --- | --- | --- |
| Wrapping factory | Turns a tool implementation into a wrapped tool; the only holder of the path from a name to an implementation | Wrapping factory, Wrapped tool, Tool implementation | `approval/contracts/gate-evaluation@0.1.0` for verdicts; `ledger/contracts/ledger-store@0.1.0` for the record |
| Tool set builder | Assembles one session's tools from the connector manifests in force plus the enumerated internal tools | Wrapped tool, Agent role | The connector manifest contract owned by `req-019-connector-framework` |
| Session manager | Starts, suspends, rebuilds and cancels sessions; enforces one live session per job | Harness session, Suspension point | `agent/contracts/agent-session@0.1.0`, which it implements |
| Transcript store | Appends turns, reads them back, registers the store for replication, applies retention and redaction | Transcript, Turn | `sync/contracts/replicated-store-descriptor@0.1.0`; the local store from `req-013-sqlite-ledger` |
| Provider registry | Holds profiles, resolves an endpoint beside the request that uses it, probes a profile | Provider profile, Endpoint descriptor | `agent/contracts/provider-profile@0.1.0`; `platform/contracts/secure-storage@0.1.0` for credentials |
| Engine adapter | The only module that names the engine: constructs its agent object, hands it wrapped tools and turns, and translates its events into session events | Harness identity | Nothing. It is the boundary, not a participant |
| Build pin check | Fails a build whose dependency graph resolves the wrong distribution or the wrong version of the engine | Harness identity | The dependency lockfile |

The engine adapter is deliberately thin and deliberately alone. Everything above it is written against this
change's own contracts, so replacing the engine rewrites one module and re-runs one suite. That is the whole
architectural claim of this change, and it is why Option A in the proposal was chosen over relying on the
engine's middleware.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel | Direction | Pattern | Payload | Error handling |
| --- | --- | --- | --- | --- |
| Factory → evaluator | In-process call | Request-Response | `CallSubject`, `EvaluationContext` | An `EvaluationFailure` is fail-closed for writes across the product, per `gate-evaluation@0.1.0` |
| Factory → ledger | In-process call | Request-Response | `LedgerRecord` | A refused intent record stops the call and fails the job (principle III) |
| Factory → tool implementation | In-process call | Request-Response | Validated arguments, an abort signal | The implementation's own failure becomes a result record and the job's retry policy decides |
| Session manager → engine adapter | In-process call | Request-Response | `SessionSpec`, wrapped tools, stored turns | A provider or transcript failure ends the run with a session error code |
| Engine adapter → provider endpoint | Network | Streaming request | The turns, the tool descriptions, the images | Provider errors are carried to the user unreworded |
| Main → window | Inter-process | Pub-Sub and Request-Response | Transcript turns, session state, token usage, provider state | A window that cannot render is a display fault; nothing about the run changes |
| Window → main | Inter-process | Request-Response | Profile edits and probes only | Every other verb is absent by design |

### Execution Boundaries & Isolation

Sessions, the factory, the evaluator, the connectors and the ledger writer all live in the one process that owns
the local store. Windows are separate processes with no capability to start, resume or feed a session. This is
the same shape `req-009` and `req-013` established, and the reason is identical: if a window could drive a
session, a compromised window could manufacture the act a verdict refused, and the hard gate would be reachable
from a place a prompt injection can eventually reach.

Isolation between sessions is per instance and not achieved by care. Each session holds its own turns, tool set
and suspension state; there is no process-wide suspension gate, no ambient current session, no shared registry
(INV-AG-07). Three concurrent sessions were measured with no cross-contamination in any transcript —
VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q4). The same measurement is why the engine's distribution is pinned:
a downstream distribution of the same engine holds suspension state in a process-wide singleton, which would
break this property without breaking any single-session test.

### Trust Boundaries & Input Validation

Model output crosses into the product as a tool name and a set of arguments. The name is matched against the
session's registry and fails as unknown when absent; the engine performs that match itself and never falls
through to execution — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2, bypass vector 1). The arguments are the
subject the gate judges, never an input to the judgement, and the declarations the gate reads — irreversibility,
permission change, reconciliation — are taken from the connector manifest rather than from the arguments, so an
agent cannot declare its own call harmless.

Tool results crossing back in are untrusted external content under the constitution's External Content Is Data
clause. They may inform the next proposal; they may never authorise an act or relax a verdict. The mechanism that
makes this true is that the only route to an act is the wrapper, and the wrapper asks the evaluator every time.

## Decisions

### D1 — The wrap is a factory outside the engine, not the engine's own interception facility

Every tool is produced by one factory that closes over the implementation and performs the four steps itself.
**Rationale:** the guarantee then holds regardless of what the engine's middleware does, and the spike proved it
by running with that middleware deliberately unconfigured and observing an identical refusal —
VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2, bypass vector 2). **Alternatives rejected:** the engine's
interception facility, which makes a constitutional guarantee depend on an upstream project's release notes and
would also require separately excluding the engine's built-in coding tools; and a review convention that every
tool must be wrapped, which is exactly the convention principle III exists to replace.

### D2 — The factory's output type is the only value a session accepts

`WrappedTool` is branded so that only the factory can produce one, and `SessionSpec.tools` accepts nothing else.
**Rationale:** it converts "every tool is wrapped" from a rule someone must remember into a condition the build
enforces, which is what principle VI's "without exception" has to mean in practice. **Alternatives rejected:** a
naming convention plus a code review checklist, which fails silently the first time someone is in a hurry; and a
runtime assertion at session construction, which is better than nothing but reports the fault after a build has
shipped rather than before.

### D3 — There is no trusted-tool category; internal tools take the same path

The pet-agent's five tools declare the internal origin and pass through the factory like any connector tool.
**Rationale:** a second registration path is the bypass the first one exists to prevent, and the cost of routing
internal tools through the factory is one ledger record and one pure evaluation that always allows.
**Alternatives rejected:** registering internal tools directly, which creates the category an attacker or a
careless change only has to reach; and giving internal tools a wrapper that skips evaluation, which is the same
thing with more code. Decided in `clarifications.md` session 2026-09-12.

### D4 — The stored transcript is the state; the live suspension is an optimisation

At a hold, the turns are made durable and the job moves to `waiting_approval` before the request is shown. A
decision may then be served by the live session or by one rebuilt from the transcript, and the two are required
to be equivalent (INV-AG-06). **Rationale:** both paths were measured — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q3) — and making the durable one authoritative means no guarantee rests on a
promise held in memory, which is what lets `req-013`'s start-up recovery treat a held call as an ordinary
unresolved intent. **Alternatives rejected:** in-memory suspension alone, which loses the run on any restart and
would make a 30-minute approval window a 30-minute uptime requirement; and cold rebuild always, which is correct
but throws away a live session and its provider context for no benefit when the user answers in ten seconds.

### D5 — Transcripts live in the product's own store, not in the engine's session files

**Rationale:** principle VII makes transcripts account-owned, and a store the product does not own cannot be
given a retention rule, a replication descriptor, an erase-on-sign-out behaviour or a redaction pass. Owning it
also makes D4's equivalence a property of our data rather than of the engine's file format.
**Alternatives rejected:** the engine's own session files, which would put account-owned data in a format an
upstream release may change and would leave replication with nothing to describe; and holding transcripts only in
the ledger, which conflates the record of what was done with the conversation about it — two things the spike
found to be cleanly separable and joined by the call identifier alone (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q8).

### D6 — The three pre-execution failures have three different consequences

A refusal is a tool result; a failed intent record fails the job; an evaluation failure is fail-closed for every
write across the product. **Rationale:** they are different facts. A refusal is the system working, and treating
it as a fault would make the agent unable to re-plan and would teach users that rules break their work. A missing
record is principle III's precondition unmet. An unreadable catalogue is indistinguishable from a tampered one,
so narrowing it to one call would leave the rest of the product running without the protection the user wrote.
**Alternatives rejected:** failing the job on every refusal, which is simpler and wrong; and treating an
evaluation failure as a refusal of that call only, which fails open in aggregate.

### D7 — Provider configuration is a profile with a credential and an endpoint descriptor

No interactive sign-in is built. **Rationale:** the embedded path exposes a credential per provider and a custom
endpoint descriptor, and nothing else; the interactive sign-in named in the product definition belongs to the
engine's command-line tool, and the engine's publisher sells no subscription — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q5). **Alternatives rejected:** implementing a device-code flow against each
provider ourselves, which is a product the user did not ask for and which none of the providers requires for API
access; and running a gateway so the product holds the credential, which the product definition already rejected
and which would make the product responsible for model cost.

### D8 — The engine is pinned by distribution and version, enforced by the build

**Rationale:** two distributions of this engine exist under similar names; the one that was measured targets the
product's runtime and holds state per instance, and the other targets a different runtime and holds suspension
state process-wide — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9, and the namespace confusion is recorded as
a risk in `spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien`). A wrong resolution would compile and pass most
tests while breaking isolation. **Alternatives rejected:** a documented note telling developers which one to
install, which does not survive a transitive dependency; and version ranges, which would silently move the
runtime the measurements are attached to.

### D9 — Images are validated at the composer, not at the request

**Rationale:** the vision endpoint refuses an image below 14 pixels in either dimension with a protocol error —
VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien`) — and a refusal at the request means a job that
fails for a reason the user cannot act on, after they have already handed work over. At the composer they are told
immediately, before a job exists. **Alternatives rejected:** validating at the session boundary, which is a
better place to defend but a worse place to explain; and per-provider floors resolved at request time, which
makes the composer's behaviour depend on a setting configured elsewhere.

### D10 — A session is constructed per run rather than kept warm

Each start or rebuild constructs a fresh session object from turns and tools. **Rationale:** it is what makes the
live and rebuilt paths one behaviour, and the cost was measured as acceptable — a rebuilt session resumed and
completed its reasoning in about three seconds, and three concurrent sessions finished in under six seconds of
wall-clock time — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 and Q4). **Alternatives rejected:** a pool of
warm sessions reused across jobs, which would introduce exactly the shared state INV-AG-07 forbids and would make
one job's residue reachable from another's.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

Two things extend. **Tools** arrive from connector manifests: the tool set builder reads the manifests in force,
produces implementations, and passes each through the factory; adding the Nth platform therefore edits no part of
this change, which is principle VI stated concretely. **Provider profiles** are written by the user: the registry
validates a profile against its schema at save time, refuses an unsupported dialect there rather than at first
use, and keeps credentials in secure storage under the profile's declared key.

Registration is one-way and total. There is no unregister-and-replace for a live session's tool set: a manifest
change takes effect for sessions started afterwards, so a running job cannot have its tools swapped underneath a
verdict it already obtained.

### 2. Multi-Level Fallback Hierarchy

| Failure | First response | Then | Finally |
| --- | --- | --- | --- |
| Provider unreachable | The job's retry policy, which already governs transient failures | The job fails cleanly with what it completed and an undo offer | Never a silent switch to another profile: the user chose and pays for a specific provider |
| Credential rejected or missing | A SYSTEM card naming the profile, with the settings one click away | The roles routed to that profile start no jobs | Never a fallback to a built-in profile, which would spend someone else's money |
| Model lacks a capability the command needs | Refused before the job starts, naming the mapping | — | Never silently routing to a different model, which changes cost and behaviour without consent |
| Transcript unreadable on rebuild | The job is not resumed and is shown as needing attention | The ledger still holds what was done, so the job's history is intact and undo still works | Never reconstructing a plausible transcript, which would be fiction presented as record |
| Engine throws where the contract expects a result | Translated into a session failure with the engine's message preserved | The job fails; nothing is retried blindly | Never swallowing it into a successful report |
| Evaluator unavailable | Fail-closed for all writes, product-wide banner | Reads continue, so the product remains useful while it is repaired | Never degrading to allow |

The pattern in the right-hand column is deliberate: every fallback stops short of substituting a different intent
for the user's. This is the same discipline principle IV applies to undo — report what could not be done rather
than do something adjacent.

## Complexity Tracking

None. No clause of the constitution is violated or bent by this design. Three are strengthened rather than
merely respected: principle II, because the gate is reached through a wrapper that the engine cannot route
around; principle III, because the record is a precondition inside the same wrapper; and principle VI, because
the factory is what makes "wrapped without exception" a property of the type rather than of a review.

## Research

### R1 — Whether arbitrary tools can be registered and the engine's own coding tools kept out

**Decision:** register only our own tools; the engine's built-in coding tools are never installed.
**Rationale:** the embedded engine loads no tools at all unless given them, and an enumeration of a session's
tools showed only the two declared for the test with none of the four built-in coding tools present; asked to run
a shell command, the agent refused safely because no such tool existed — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q1). **Alternatives:** suppressing the built-in tools after construction,
which would be a subtraction to maintain rather than an absence to preserve.

### R2 — Whether a wrap can be inserted before execution, and whether anything routes around it

**Decision:** two layers — a wrapped `execute` closure, plus the engine's own registry lookup — with the wrapper
alone load-bearing. **Rationale:** a forbidden write was requested and the implementation's call count stayed at
zero, the store was unchanged, and the ledger held an intent and a blocked record with no result. Three bypass
routes were tested: naming a tool that does not exist, which the engine refuses at lookup; leaving the engine's
interception facility unconfigured, which changed nothing because the protection is in the tool object; and one
tool calling another, which is impossible because a generated tool holds no reference to the harness — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2). **Alternatives:** the engine's interception facility alone, rejected in
D1.

### R3 — Whether a run resumes at its stopping point without repeating work

**Decision:** both an in-flight suspension and a cold rebuild, with the stored transcript authoritative.
**Rationale:** in the live path, a completed read was not re-issued when the held write was approved; in the cold
path, a session rebuilt from stored turns re-issued the read zero times, executed the approved write once, and
continued its reasoning in about three seconds — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q3).
**Alternatives:** replaying the run from the beginning and skipping already-recorded calls, which is a
reconstruction that only works while every call is deterministic, and which the product definition forbids
outright.

### R4 — Whether concurrent sessions are genuinely isolated in one process

**Decision:** one process, many sessions, no shared state. **Rationale:** three sessions ran concurrently in a
single process, each holding a distinct secret, finished in 5.9 seconds of wall-clock time, and a cross-check of
all three transcripts found no value belonging to another — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q4).
**Alternatives:** a process per job, which buys isolation the engine already provides at the cost of a store
handle per process, which `ledger-store@0.1.0` forbids outright since one process opens the store for writing.

### R5 — What the embedded provider layer actually offers

**Decision:** a credential per provider, and a custom endpoint descriptor for any service speaking the supported
dialect. **Rationale:** both were exercised, including against a third-party service for a strong model, a cheap
model and a vision model; the interactive sign-in in the product definition is a command-line affordance and the
engine's publisher sells no subscription — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q5 and
`spikes/SP-6-pi-sdk/REPORT.md#2-tac-dong-len-adr-prd`). The product definition's wording is corrected by the
MODIFIED requirement in `specs/agent`. **Alternatives:** rejected in D7.

### R6 — Whether the engine's transcript conflicts with the product's ledger

**Decision:** they are independent and joined by the call identifier. **Rationale:** the transcript holds the
conversation and the ledger holds the acts and the decisions; neither depends on the other's storage, and they
are correlated through the job and call identifiers — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q8). The only
change this design makes to that conclusion is where the transcript is stored, which D5 explains.
**Alternatives:** one store for both, rejected because an append-only audit record and an editable-by-retention
conversation have different retention, different redaction rules and different replication conflicts.

### R7 — Which distribution of the engine is canonical, and how volatile its interface is

**Decision:** pin the canonical distribution at the measured versions; refuse the other outright.
**Rationale:** the canonical distribution ships built code for the product's runtime and keeps state per
instance; the downstream distribution targets a different runtime, ships raw sources and uses a process-wide
suspension gate. The embedded interface has been stable across roughly eleven minor releases, and the wrap sits
outside it, so an upgrade does not reshape the product — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9, with
the exact versions in `spikes/SP-6-pi-sdk/REPORT.md#6-phien-ban-chinh-xac-cua-moi-package-cong-cu`).
**Alternatives:** rejected in D8.

### R8 — What the vision path requires of an image

**Decision:** validate dimensions at the composer against a product-wide floor of 14 pixels.
**Rationale:** an image was accepted and described correctly by a vision model, and the endpoint refuses anything
below 14 pixels in either direction with a protocol error — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q6 and
`spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien`). **Alternatives:** rejected in D9. Note that the floor is
a property of one service; the profile schema therefore lets a service declare a higher one, and the effective
floor is the larger of the two.

### R9 — Whether any of this was measured in the environment the product ships

**Decision:** no, and it is treated as work rather than as an assumption. **Rationale:** every figure above was
measured under a plain runtime at a version above the engine's stated floor
(`spikes/SP-6-pi-sdk/REPORT.md#6-phien-ban-chinh-xac-cua-moi-package-cong-cu`); the product ships inside an
application framework with its own bundled runtime and its own native-module behaviour, which
`req-013-sqlite-ledger` already found to matter for a different dependency. Re-running the nine checks inside the
packaged application is a task in this change and an open question in `clarifications.md`.

## Migration & Rollback

No user data exists in the field and no application code exists yet, so there is nothing to migrate into this
design. Two forward-looking positions are recorded because they are cheaper to decide now than during an
incident.

**Transcripts.** The transcript store is append-only and replicates, so a build that changes the turn shape meets
turns written by other builds. The rule is in `agent-session@0.1.0`: an unknown turn kind is rendered as an
unreadable turn and never dropped, because a conversation with holes in it is worse than one with a gap the user
can see. A rollback to a build that predates a turn kind therefore degrades presentation and loses nothing.

**Provider profiles.** Profiles replicate and credentials do not. A build meeting a profile written by a newer
build refuses to use that profile and says so, rather than reading around members it does not recognise; roles
routed to it start no jobs until the device is updated. A rollback across a profile MAJOR therefore stops jobs
for the roles involved and does not silently send a request somewhere unintended, which is the failure mode worth
paying for.

**The engine pin.** Raising it is a change with its own evidence: the bypass suite, the resume equivalence check
and the isolation check are re-run before the pin is accepted, because the pin is what the measurements are
attached to. Lowering it is the same operation in reverse and carries the same obligation.

## Risks / Trade-offs

- **[The factory is on every tool call's hot path]** → It does four things and holds no policy: build the
  subject, append a record, ask for a verdict, invoke. The record append is the expensive step and it was
  measured at the store level rather than here (`req-013-sqlite-ledger` §Thresholds); the evaluation is pure and
  was measured well inside its budget (`req-009` §Thresholds). The residual risk is the sum of the two under
  concurrency, which no spike measured — UNVERIFIED, and `verification.md` says so rather than inventing a number.
- **[The engine is upstream and moves two to three times a month]** → The wrap is outside it and the version is
  pinned, so an upgrade is a deliberate act with a suite attached. VERIFIED that the embedded interface has been
  stable across the observed release history (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9); that history is not a
  guarantee about the future, which is what the pin is for.
- **[A wrong distribution resolves transitively]** → The build check refuses it by name. Without the check this
  fails quietly: most tests pass and only concurrent suspension misbehaves, which is the hardest failure to
  attribute.
- **[Everything was measured outside the shipped framework]** → Recorded as R9, as an open question, and as a
  first-phase task. The design depends on no unmeasured capability, but a measurement taken elsewhere is not a
  measurement taken here.
- **[Owning the transcript store means owning its size]** → Tool-result turns carry platform responses and no
  spike measured what 90 days of them costs. The retention floor matches the ledger's so the two expire together,
  and sizing is an explicit task rather than a threshold this file invents.
- **[One live session per job is a real constraint]** → It rules out a job splitting itself across two concurrent
  agents. That is deliberate: a second live session makes the suspension point ambiguous, and a decision has
  nothing else to attach to. A job needing parallel work creates jobs, which is what principle I already says.

## Open Questions

These can be postponed without changing the specs, the approach or the task list. Anything that would change them
was resolved in `clarifications.md` instead of being parked here.

- **What 90 days of transcripts costs on a device, and whether the retention floor should differ from the
  ledger's.** It refines a number after the work exists. Measured during implementation and recorded as an
  observation; if it proves large, the answer is a retention setting, not a design change.
- **Whether a rebuilt session should be preferred even when a live one exists, so that only one path is ever
  exercised in production.** Both are required to be equivalent, and the equivalence is tested either way; this
  is a question about which path to run by default, and it can be answered from telemetry later.
- **Whether the probe should run automatically when a profile replicates to a new device, or only on request.**
  It changes when the user learns a credential is missing, not what the product does about it.

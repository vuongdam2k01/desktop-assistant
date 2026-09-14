# Design: req-003-notion-compensation

## Context

`req-019-connector-framework` froze the shape a connector has: a manifest, an adapter of four operations, a fixed
error vocabulary, and declarations the gate and the undo planner read rather than infer. It deliberately deferred
every individual platform. This change is the first platform, and its job is to find out what the frozen shape
could not say — by writing one down against measurements rather than against documentation.

Three constraints govern everything below.

The first is that the core must not learn anything. The measured property of `req-019` is that adding a platform
costs zero lines in the job manager, the evaluator, the ledger, the wrapping layer and the tool generator. A
design that spends that property to accommodate this platform's peculiarities would make the second connector
cost the same again, and the third more.

The second is the evidence boundary. `spikes/SP-1-notion-compensation/REPORT.md` measured write operations, their
snapshots and their compensating actions against three real workspaces of different shape, through the raw HTTP
surface, using an internal integration token. Everything about writing, compensating, pacing and failing is
therefore measured. Nothing about the authorisation flow is: the token kind the spike used is not the kind the
product will ship, which is why the authorisation half of this connector's manifest is carried from
`req-019-connector-framework` and `req-020-backend-slice` rather than asserted here, and why one capability is
declared absent instead of offered (Q-1).

The third is ownership of the shared machinery. The queue that paces requests and the locks that stop two jobs
corrupting each other's snapshots belong to `req-015-concurrency-coordinator`. This change supplies what that
queue must be keyed by and paced at, and specifies the platform's own refusal behaviour; it does not design the
queue.

## Goals / Non-Goals

**Goals:**

- Express every measured condition of the first platform as data — a manifest declaration or a projection rule —
  and nothing as a special case in a core component.
- Make each of the four conditions the spike found binding checkable: computed values excluded, comments
  irreversible, reordering conditional on the database's own schema, and an unrecallable notification declared.
- Give `undo` a vocabulary precise enough that a user is never told something was restored when it was
  approximated, narrowed, or left in place.
- Amend the frozen manifest contract exactly twice, additively, with both additions traceable to a measurement.

**Non-Goals:**

- The request queue, the object locks and the concurrency cap — `req-015-concurrency-coordinator`.
- The undo pipeline itself: its phases, its plan construction, its recursion — `req-010-undo-agent`, which
  consumes this change.
- The authorisation flow, the broker and the client secret — `req-019-connector-framework`,
  `req-020-backend-slice`, `req-014-byo-oauth-google`.
- A cross-platform model of properties. There is one measured platform; a generalisation drawn from one instance
  would be a guess wearing the clothes of an abstraction.
- Repairing what the platform leaves behind: a schema option a write invented, an identifier a creation consumed,
  a notification already delivered. Each is reported; none is tidied.

## Structure

Five components, all inside the process that owns the connectors, and all reachable only through the four adapter
operations of `connector/contracts/connector-adapter@1.0.0`.

| Component | Responsibility | Model entity | Reached through |
| --- | --- | --- | --- |
| **Notion manifest** | Declares the connector: its tools, their snapshots, their compensations, the one unrecallable effect, and the pacing figures. Data, not code. | Connector manifest, Tool declaration, Unrecallable effect declaration | `connector/contracts/connector-manifest@1.1.0` |
| **Projection engine** | Turns a platform object into a projection and a projection into a restoring payload, by rule and by rule only. | Property projection rule, Property snapshot projection, Compensating payload | `connector/contracts/notion-property-compensation@0.1.0` |
| **Schema reader** | Reads a database's properties before a write that depends on them: option identities, and whether an order property exists. Job-scoped, never persisted. | Database schema observation, Order property | The declared read tool `notion_read_database_schema` |
| **Recoverability classifier** | Turns the platform's answer about an object into one of three observations, and maps every failure into the closed error vocabulary. | Recoverability observation | `connector/contracts/connector-adapter@1.0.0` |
| **Pacing gateway** | Holds one budget per authorisation, admits requests at the declared rate, and holds every request under an authorisation the platform has told to wait. | Pacing budget | Internal to the connector; generalised by `req-015-concurrency-coordinator` |

The adapter itself holds no compensation knowledge. `execute` and `fetchSnapshot` call the projection engine;
`fetchSnapshot` returns a projection already stripped of computed values, which is what
`connector/contracts/connector-adapter@1.0.0` says a snapshot result is. The wrapping layer records it through
`ledger/contracts/ledger-record@0.1.0` before the call leaves the device, per principle III, and the gate has
already read the declarations through `approval/contracts/gate-evaluation@0.1.0`, per principle II.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| Platform write | Device → Notion | Request-Response | The platform's own request, formed from the tool's declared parameters | The platform's object, as returned | The change itself, plus any effect declared in `side_effects` | Mapped at this edge into the closed error vocabulary; a volume refusal carries the platform's stated delay |
| Platform read for a snapshot | Device → Notion | Request-Response | The read named by `snapshot.read_operation`, addressed by `snapshot.target_param` | A projection, computed values already absent | None | `SNAPSHOT_UNREADABLE` on refusal; the write is then not attempted as though a snapshot existed |
| Database schema read | Device → Notion | Request-Response | The database identifier | A schema observation, job-scoped | None | On refusal, operations that depend on it are `UNSUPPORTED` rather than attempted on a guess |
| Compensating write | Device → Notion | Request-Response | A payload built only from a recorded projection | The platform's object, as returned | The restoration itself; never the withdrawal of an effect already emitted | `INVALID_PARAMS` narrows the payload once and retries; `NOT_FOUND` ends the step as not applicable |
| Volume refusal | Notion → Device | Request-Response, as a refusal | The platform's refusal, carrying a delay in seconds | The delay, applied to that authorisation's budget | Every request under that authorisation waits | The stated delay is authoritative; a delay is never shortened, and a small jitter is added to avoid a synchronised retry |

### Execution Boundaries & Isolation

Everything in this change runs in the single process that owns the connectors, the ledger and the gate. No window
and no renderer can reach it: a tool call arrives from an agent session through the wrapping factory of
`agent/contracts/tool-wrapping@0.1.0`, and nothing else has a route. The only boundary this change crosses is
HTTPS to the platform, and the authorisation it carries is resolved per call from
`platform/contracts/secure-storage@0.1.0` and never held in a projection, a payload or a record.

Two pieces of state live only in memory: the schema observation, which is discarded with the job that read it,
and the pacing budget, which is discarded when the connector is disconnected. Losing either costs one extra read
or, at worst, one volume refusal. Nothing that must survive a crash lives here — what must survive is the
projection, and it is in the ledger before the call is made.

### Trust Boundaries & Input Validation

Every value the platform returns is untrusted external content. Three rules make that operational rather than
aspirational. A projection is built by rule, so a platform response cannot introduce a field the rules do not
name. A write is addressed by option identity, so a renamed or lookalike label cannot redirect a restoration. And
the platform's error text is carried to the user unrewritten but never parsed for control flow, which follows the
declared error codes alone. Content sanitisation before any of it reaches an agent's context is declared in the
manifest under `content_sanitization` and is the framework's mechanism, not this connector's.

## Decisions

### D1 — Amend the frozen manifest contract twice, additively, rather than teach the adapter two secrets

- **Choice**: publish `connector/contracts/connector-manifest@1.1.0` with two new optional fields —
  `tools[].side_effects[]`, and `compensation.arguments_source` — and express both measured facts there.
- **Rationale**: both facts are facts about an operation, and principle VI says an operation's facts live in the
  manifest. An effect that no compensation withdraws is exactly the class of thing principle IV exists to make
  visible before the user decides; a compensating action whose arguments come from the platform's response rather
  than from prior state is the ordinary shape of compensating a creation, which every future connector will also
  have. Both are optional, both default to what `1.0.0` meant, and neither adds a mechanism the core must
  interpret — the gate and the undo preview read them the way they already read `irreversible`.
- **Alternatives Considered**: *Hold both inside the Notion adapter* — the proposal's Option B. Rejected: it is
  the same knowledge in a place no other connector can reach, so the second platform with a notification or a
  creation copies it, which is the erosion principle VI forbids. *Add a general condition language to the
  manifest*, so that an effect could be declared for particular arguments. Rejected: it puts a decision the gate
  must make into data the gate would have to interpret, and it is the rabbit hole the proposal named. D3 solves
  the same problem with a declaration instead. *Extend the ledger record so the declaration travels with the
  call.* Not rejected, deferred: it is the right answer the moment a manifest can differ between the build that
  wrote a record and the build that reads it, and it is recorded as a reserved point in `model.md` with that
  activation condition, rather than paid for now by widening this change into the ledger's contract.

### D2 — Publish the property rules as a reviewable descriptor, not as adapter code

- **Choice**: `connector/contracts/notion-property-compensation@0.1.0` carries one rule per property kind, the
  order-detection rule, the outcome vocabulary and the platform-to-error-code mapping; the adapter may hold no
  compensation knowledge that is not in it.
- **Rationale**: these rules are the part of undo a user's trust actually rests on, and they are decidable by
  reading. A rule that restores a choice by its label is wrong in a way that is obvious in a table and invisible
  in a function. Publishing them also makes the extension procedure real: a new property kind is a row, reviewed
  before it is trusted.
- **Alternatives Considered**: *Implement as code with a test per kind.* Rejected: the tests would prove the code
  does what it does, not that the rule is right, and a reviewer cannot see the set. *Generalise into a
  cross-platform property model now.* Rejected: one measured platform is not a sample; the generalisation would
  be invented, and `req-014-byo-oauth-google` is the change that will have a second instance to generalise from.

### D3 — Declare assignment as its own tool rather than a conditional effect on the property write

- **Choice**: `notion_assign_person` is a declared write tool, separate from `notion_update_properties`, and
  carries the notification declaration unconditionally.
- **Rationale**: the effect depends on which property is written, and a declaration that depends on arguments is
  a declaration that must be evaluated. Splitting the operation makes the declaration unconditional, which keeps
  the manifest readable by the gate without interpretation, and it matches the framework's own rule that a
  platform capability that does not fit becomes a declared tool. It also improves the user's experience of
  approval: "assign this person, who will be notified" is a different request from "change these properties".
- **Alternatives Considered**: *A `when_parameter_present` clause on the declaration.* Rejected: it is a
  condition language in a descriptor, and the gate would have to run it. *Warn on every property write.*
  Rejected: a warning that appears every time is a warning nobody reads, which costs exactly the case it exists
  for. *Detect the people property from the call's arguments at gate time.* Rejected: declarations are never read
  from a call's arguments — that rule is what makes a recorded call's treatment stable.

### D4 — Decide reordering from the database's own schema, before anything is written

- **Choice**: the schema reader looks for a numeric order property by kind and name; where one is found,
  reordering is a write to it; where none is found, the operation is refused with `UNSUPPORTED` before any
  request is made, naming what the database would need; where more than one matches, the user is asked.
- **Rationale**: the platform exposes no native position and refuses a write that carries one, so the only honest
  outcomes are "this database supports it" and "this database does not". Deciding before the write means the user
  learns the limit instead of meeting a failure, and it keeps this out of the irreversibility vocabulary
  entirely: an operation that cannot be performed is unsupported, not irreversible.
- **Alternatives Considered**: *Flag free reordering `irreversible`*, as the spike's own conclusion suggested.
  Rejected on the evidence rather than against it: irreversible means performed and not undoable, which would let
  the operation run and change nothing. *Keep the order in the product and present it in our own interface.*
  Rejected: the user's order would exist only where the user is not looking, since their own view at the platform
  would be unchanged. *Create an order property in the user's database automatically.* Rejected: it is a schema
  change to someone's workspace as a side effect of a movement command; it is recorded as an open question, not
  taken.

### D5 — Pace at a fixed rate per authorisation and obey the platform's stated wait

- **Choice**: 2.5 requests per second per authorisation, a burst of 20, and on a volume refusal a wait of exactly
  the delay the platform states plus a small jitter, applied to every request under that authorisation. A refusal
  carrying no delay — which was not observed, but is the only case the stated delay does not cover — backs off by
  doubling from one second to a ceiling of sixty.
- **Rationale**: the platform publishes an average of 3 per second and sends no remaining-quota information on a
  successful response, so a client queue is the only control that exists; 2.5 leaves margin without leaving
  throughput unused. The stated delays measured 37 to 49 seconds — far longer than any backoff a client would
  guess — so obeying them is both correct and much cheaper than discovering them by retrying. The unit is the
  authorisation because that is the unit the platform enforces against, measured directly: one token waiting out
  a refusal did not affect another token from the same device. The three figures are the spike's own
  recommendation, adopted rather than re-derived.
- **Alternatives Considered**: *Adapt from response headers.* Impossible: there are none on a successful
  response, which is a measurement, not an assumption. *Exponential backoff as the primary policy.* Rejected: it
  would retry several times inside a delay the platform had already quantified, each retry extending the
  platform's patience rather than the product's; it survives only as the fallback for a refusal that states no
  delay. *Burst up to 60*, which was also measured as completing. Rejected: the point at which the platform
  begins refusing lies somewhere above the bursts that completed and is not located, so the conservative figure
  is the one that can be raised by a later measurement — and raising it is a PATCH to the manifest, not a change
  to this contract.

### D6 — Decide a third-party edit by comparing property values, with the last-edited time as corroboration only

- **Choice**: conflict is decided by comparing the current value of each property a step would restore against
  what this job left. The platform's last-edited time is read alongside it and may raise a conflict, but it may
  never be the sole basis for concluding that there was none.
- **Rationale**: two spikes point in different directions and the later one carries the measurement. `SP-1`'s
  compensation matrix offers the timestamp comparison as the conflict rule; `SP-9` measured that this platform
  rounds that timestamp to the minute, so a third-party edit inside the same minute as the job's own write leaves
  it unchanged — a false negative, which is exactly the failure that makes an undo overwrite a colleague's work.
  Comparing the values themselves has no such blind spot: with both layers compared in parallel, `SP-9` measured
  zero false negatives and zero false positives.
- **Alternatives Considered**: *Timestamp alone*, as the matrix proposes. Rejected on the later measurement.
  *Timestamp as a cheap pre-filter, comparing values only when it moved.* Rejected: the pre-filter's failure mode
  points the dangerous way, skipping precisely the comparisons that matter. *Ask the user in every case.*
  Rejected: it converts a mechanical check into a prompt, and a prompt that always appears teaches the user to
  accept it.

### D7 — Say "absent or no longer visible" rather than guessing which

- **Choice**: when the platform will not return an object, the step reports both possible causes and asserts
  neither; the ledger's record that the object was reachable earlier is used to say that something changed, not
  to conclude what.
- **Rationale**: the platform answers identically for an object permanently removed and one the connector may no
  longer see, deliberately. Choosing one of the two for the user would be inventing a fact about their workspace,
  and the two have different remedies — one is gone, the other is a sharing setting they can change.
- **Alternatives Considered**: *Report deletion, as the more common case.* Rejected: the rarer case is the one
  where a confident wrong sentence causes real harm — the user believes work was destroyed. *Probe with a second
  authorisation to tell them apart.* Rejected: the product has one authorisation, and acquiring another to
  investigate is not something a work assistant may do on its own.

### D8 — Author the words of an unrecallable effect in the manifest, not in the interface

- **Choice**: `side_effects[].user_text` carries the sentence the approval request and the undo preview show.
- **Rationale**: the sentence is platform knowledge — what is emitted, to whom, and what undo does not do about
  it. Keeping it with the connector means a new platform's new effect is a manifest edit; keeping it in the
  interface would mean every new effect is an interface change, which is a core change in all but name.
- **Alternatives Considered**: *Interface strings keyed by an effect type.* Rejected for the reason above, and
  because the enumeration of effect types would have to be guessed from one platform. *Compose the sentence from
  the fields.* Rejected: the resulting prose is worse than an authored sentence, and translation is a
  localisation concern that `uix/contracts/localisation-resources@0.1.0` owns, addressable by key against text
  the connector supplies.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: the manifest and the rule set are read once at start-up, whole or not at
  all, and paired with the adapter registered under the same connector identity. There is no hot reload and no
  discovery path: both ship inside the build, which is what makes the version window in
  `connector/contracts/connector-manifest@1.1.0` empty by construction.
- **Isolation & Sandboxing**: in-process, as `req-019-connector-framework` established while every manifest is
  first-party. The adapter holds no policy: it cannot form a verdict, read a rule or write to the ledger, so a
  connector author cannot weaken the gate by writing an adapter.
- **Resource Management & Eviction**: a schema observation is released with its job; a pacing budget is released
  when the connector is disconnected; a projection is owned by the ledger from the moment it is recorded. Nothing
  in this change holds a cache across jobs, because option identities and order properties change at the platform
  without the product being told.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (Specific ➔ General)**: `no rule for this property kind` ──> the property is neither projected nor
  written, and is named in the outcome. `no order property in this database` ──> free reordering is `UNSUPPORTED`
  and the movement the command means is attempted as an ordinary property write where one exists (a board column
  is a state property). `option identity missing from the schema` ──> `conflicted`, never a new option created
  from the label.
- **Tier 2 (Custom ➔ Built-in Default)**: `compensating payload refused as invalid` ──> narrowed once to the
  properties the platform did not name, restoring what can be restored and reporting the rest with the platform's
  own words. `schema observation unavailable` ──> operations that depend on it are refused rather than attempted
  on a guess. `object removed but recoverable` ──> reopened, then restored, and reported as both.
- **Tier 3 (Degraded Safe-Mode)**: `manifest or rule set fails to load` ──> the connector offers no tool at all
  and is presented as unavailable with the failing declaration named, while every other connector keeps working.
  `platform unreachable, or a volume wait outlasts the job` ──> the job ends with its completed-operations list
  and nothing is concluded about the authorisation. In every case the product stays up and the ledger stays
  complete, so the work already done remains undoable later — degradation costs progress, never accounting.

## Complexity Tracking

None. No constitutional principle is violated by this change. Principle IV is the principle it exists to satisfy
with evidence; principle VI is the reason both additions are declarations rather than code; principle VIII is why
the one capability the spike could not exercise through a real authorisation is declared absent rather than
offered on the strength of documentation.

## Research

### R1 — Which conflict check does this connector use, given that two spikes propose different ones?

- **Decision**: property-value comparison is the deciding layer, with the last-edited time corroborating but
  never deciding that nothing changed, as in D6. `SP-1`'s timestamp-only rule is superseded, not merely unused.
- **Rationale**: the timestamp is rounded to the minute at this platform, so an edit within the same minute as
  the job's write produces a false negative — the failure direction that causes an undo to overwrite a
  colleague's work. Both layers compared in parallel measured zero false negatives and zero false positives.
- **Alternatives**: timestamp alone; timestamp as a pre-filter; asking the user every time.
- **Source / Verification Status**: VERIFIED —
  `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` Q3 and `#2-tac-dong-len-adr-prd` (the rounding and
  the measured result); the superseded rule is
  `spikes/SP-1-notion-compensation/evidence/compensation-matrix.md` §3, last row.

### R2 — What rate, and what wait, should the connector use?

- **Decision**: 2.5 requests per second per authorisation, burst 20, and the platform's stated delay on refusal
  plus a small jitter.
- **Rationale**: the published average is 3 per second; bursts of 15 and 60 completed entirely; 100 concurrent
  requests produced 69 accepted and 31 refused; every refusal stated a delay, measured at 37 to 49 seconds across
  207 refusals in the raw logs; no successful response carries quota information at all.
- **Alternatives**: header-driven adaptation (impossible here); exponential backoff as the primary policy
  (retries inside a wait the platform already quantified); burst 60 (measured as completing, but closer to a
  boundary that is not located).
- **Source / Verification Status**: VERIFIED —
  `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5,
  `spikes/SP-1-notion-compensation/evidence/data/q5_rate_limit_results.json`, and the per-request logs
  `spikes/SP-1-notion-compensation/evidence/raw_logs/q5_*.json`. The figures 2.5 and 20 are the spike's own
  recommendation within those measurements rather than measurements themselves, and are labelled so in
  `verification.md`.

### R3 — Can the connector create a page that belongs to the workspace rather than to a database?

- **Decision**: not offered. No tool is declared, and the agent is told the operation is unavailable.
- **Rationale**: the platform refused the operation to the authorisation kind the spike used, so neither the
  operation, nor its snapshot, nor its compensating action has been measured. Declaring it would put an
  unmeasured write behind principle IV's guarantee, and the constitution's Evidence Discipline forbids treating
  the vendor's documentation as sufficient grounds.
- **Alternatives**: declare it and flag it irreversible (a guess about a capability nobody has exercised); declare
  it and let it fail at call time (a user-facing failure for a fact known at authoring time).
- **Source / Verification Status**: UNVERIFIED capability, recorded as Q-1 in `clarifications.md` and as a
  reserved point in `model.md` —
  `spikes/SP-1-notion-compensation/REPORT.md#5-chua-tra-loi-duoc-vi-sao`.

### R4 — How much does a recorded projection cost?

- **Decision**: no ceiling is imposed by this capability; the ledger's retention sizing bounds accumulation, and
  a projection above 64 KB is treated as a defect worth recording.
- **Rationale**: across the 30 object reads the spike recorded in three workspaces, a returned object measured
  1,333–2,185 bytes and its projection 575–1,149 bytes. These are small objects by construction — page body
  content is not part of a property projection — so the range bounds nothing on its own, and inventing a limit
  from it would be exactly the kind of threshold the constitution forbids.
- **Alternatives**: a per-projection size limit derived from the measured range (a threshold with no measurement
  behind it); storing a reference and re-reading at undo time (rejected: the prior state would then be whatever
  the platform holds later, which is not prior state).
- **Source / Verification Status**: VERIFIED for the range, derived from
  `spikes/SP-1-notion-compensation/evidence/raw_logs/*_GET_pages_*.json`; the 64 KB guard is UNVERIFIED and
  labelled so in `model.md` and `verification.md`.

## Migration & Rollback

**What changes.** One frozen contract gains two optional fields and a minor version:
`connector/contracts/connector-manifest@1.0.0` → `@1.1.0`. One contract is published new at `0.1.0`. No living
requirement is removed, and no stored data exists anywhere in the project yet — the phase is design-first, so
this is a migration of documents, with the consumer updates listed in the contract's own Migration section.

**Migration steps.** Consumers that must change are `approval`, which reads `side_effects` to say in the request
what an approval will emit, and `undo`, which reads it in the preview and reads `arguments_source` to know where
a compensating action's arguments come from. Every `1.0.0` manifest remains valid unchanged; a manifest using
either new field declares `schema_version: "1.1"`, because a build that predates the fields refuses unknown ones
rather than ignoring them.

**Rollback.** Returning the contract to `1.0.0` means dropping both declarations from every manifest. The
consequences are stateable rather than silent, which is why rollback is acceptable: the creation tool would have
to carry a snapshot declaration whose read is not applicable in order to express a compensation, and the
assignment tool would have to be declared irreversible — true of the notification, false of the property — or
carry no statement about the notification at all. Both are worse products; neither is a corrupted one, and no
recorded data would need conversion.

## Risks / Trade-offs

- [A manifest updated after a call was recorded could state a different unrecallable effect than the one the call
  actually emitted] → the declaration is resolved at presentation time today, which is exact while every manifest
  ships inside the build that reads it; the reserved point in `model.md` names the trigger — the first release
  that alters a shipped tool's `side_effects` — at which the declaration must travel in the intent record, a
  MINOR addition to `ledger/contracts/ledger-record@0.1.0`.
- [The burst figure is conservative, so a legitimate burst is paced more slowly than the platform would allow] →
  accepted deliberately: the boundary between 60 and 100 concurrent requests is not located, and the cost of
  being wrong upward is a 40-to-49-second stall for every request under that authorisation.
- [Recognition of an order property is by name, so a database may name its order something unrecognised] → the
  rule never invents the property, the unrecognised case is `UNSUPPORTED` with what the database would need, and
  the ambiguous case asks the user; adding a name is a contract change and nothing else.
- [A schema option a write invented accumulates in the user's database across many jobs] → each is named in the
  compensation report so the user can remove it; the product does not edit their database schema to tidy after
  itself.
- [A status property restored to the platform's default reads, to a hurried user, like a restoration] → the
  outcome vocabulary separates `approximated` from `restored`, and the interface must render them differently;
  that rendering is a manual check in `verification.md`.
- [One capability of the platform is declared absent on the strength of a measurement made with the wrong
  authorisation kind] → recorded as Q-1 with a re-measurement route; the cost of the conservative choice is a
  capability the product does not offer, which is recoverable, against a promise it cannot keep, which is not.

## Open Questions

Both can be answered after this change without altering any requirement, contract or task in it.

- **Should the recognised names for an order property be configurable per database by the user, rather than only
  extensible by a contract change?** It affects wording and a settings surface, not the rules: the detection, the
  ambiguity rule and the unsupported outcome are unchanged either way. Deciding it needs evidence about how often
  real databases name the property something the recognised set misses, which arrives with the first users.
- **Should the product offer to add an order property to a database that lacks one?** It would turn an
  unsupported operation into a supported one, at the cost of a schema change to the user's workspace as a
  consequence of a movement command. It is a new write operation with its own snapshot, compensation and approval
  story, so it belongs to its own change rather than to a clause in this one.

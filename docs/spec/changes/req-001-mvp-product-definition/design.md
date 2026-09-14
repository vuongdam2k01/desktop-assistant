## Context

Nothing is built yet. This change turns the frozen product definition into the first specification, so the
design below describes the shape the twenty spike-derived changes will fill in rather than a modification to an
existing system. Four constraints are fixed before any choice is made: the four architectural decisions locked
by the product owner, the eight ratified principles, the technology stack recorded as ADR-001 to ADR-009, and
the account-owned data model that `req-022-account-sync` established after the harvest.

The consequential constraint is that three things must hold simultaneously on every single tool call — the
ledger record is written before the call, the approval gate evaluates outside the model's reach, and the
compensating action is declared in advance. Any structure that makes one of those optional for one code path has
failed, regardless of how well it serves the rest.

## Goals / Non-Goals

**Goals:**
- Establish the component structure and the boundaries between the twelve capabilities, so that later changes
  modify a named component rather than negotiate one.
- Place the ledger obligation and the approval gate on the single path every connector operation must take.
- Make a connector an artifact of data, so that the platform count can grow without the core changing.
- Keep the device able to work while the network and the backend are unavailable.

**Non-Goals:**
- Choosing the technology stack. It was locked by the product owner as ADR-001 to ADR-009; this design records
  those choices with their alternatives and consequences, and does not reopen them.
- Specifying the internals of any one subsystem. The ledger's record layout, the rule evaluator's algorithm, the
  pet's locomotion model and the replication protocol each belong to their own change.
- Scheduling, meeting capture, third-party tool servers and a mobile client. Each is recorded as a reserved slot
  in `model.md` with the condition that activates it.

## Structure

The product is one desktop application, one backend service, and the platforms the user already uses.

**Pet layer** owns the pet window and the dialog surface. It renders animation state and cards, and it holds no
domain state of its own: every card is a projection of a job, an approval request, a question or a system
condition, which is what allows the queue to be rebuilt from the ledger after a crash. It maps to the Card
entity and reads job and approval state through those domains' contracts.

**Pet-agent** is one agent with five tools and no connector access. It creates jobs and reports on them. It is
deliberately not an orchestrator: it hands work over and then learns about it the same way the interface does,
through the Job Manager. This is the structural expression of the first principle, and it is why a new worker
capability never edits the pet.

**Job Manager** owns the Job entity and its lifecycle: queueing, state transitions, cancellation at tool-call
boundaries, timeouts, and the decision lock that stops one approval being decided twice from two surfaces. It is
the only component that writes job state, and every other component reads it.

**Worker-agents** run inside the agent harness, one instance per job, with no context shared between them. Their
tool set is generated from the manifests of connected connectors through
`connector/contracts/connector-manifest@0.1.0`; nothing else registers a tool. Each generated tool is wrapped
once, and the wrapper is where the three simultaneous obligations live.

**The wrapper** is the smallest and most load-bearing component in the product. For each call it writes the
intent record, asks the evaluator for a verdict, suspends the agent when the verdict is `require_approval`,
executes on `allow`, and writes the result record with the after-snapshot and the compensating action. Because
every tool reaches the connector through it, there is no second path to audit.

**Approval evaluator** owns rule storage and the verdict, exposed as
`approval/contracts/rule-representation@0.1.0`. It is pure and performs no input or output, which is what makes
it testable against an adversarial corpus and what keeps it unreachable from model output.

**Connector adapters** own platform communication, the pre-write snapshot, and request pacing. They implement
the adapter surface in the manifest contract and know nothing about jobs, rules or the ledger.

**Local store** holds jobs, ledger records, rules and configuration; the secure store holds credentials by
reference through the platform contract. The local store is the working copy for the device, and
`req-022-account-sync` owns its relationship to the account's authoritative copy.

**Application window** presents connectors, jobs, approvals and settings. Everything it can do the dialog
surface can do for the quick case, and it holds no state the other components do not own.

**Backend** performs authentication, connector authorisation brokering, the device registry, encrypted
replication storage and the update manifest. It executes no job logic, which means an unreachable backend
degrades the product rather than stopping it.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction (A→B / B→A / Duplex) | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| Renderer ↔ main (pet window) | Duplex | Request-Response and Pub-Sub | card projections, pet state, user interactions | acknowledgement | none in the renderer; all state changes occur in main | a renderer crash loses no state; the window is recreated from current state |
| Renderer ↔ main (application window) | Duplex | Request-Response and Pub-Sub | job list and detail queries, approval decisions, configuration edits | query results, decision receipts | decisions reach the Job Manager, never a connector | a decision arriving for an already-decided request returns "already handled" |
| Job Manager → worker-agent | A→B | Request-Response over the harness | job descriptor, tool set, system prompt | terminal job outcome | agent session transcript written | job timeout applies; cancellation takes effect at the next tool-call boundary |
| Worker-agent → wrapper → connector adapter | A→B | Request-Response | tool name, parameters, authorisation reference | tool result or connector error | ledger intent and result records; platform state change | connector error codes from the manifest contract; bounded retry for retryable codes |
| Wrapper → approval evaluator | A→B | Request-Response, in-process | tool call descriptor, confirmed rules, mode | verdict | none — the evaluator is pure | an evaluator exception escalates to the user; the gate never fails open |
| Wrapper → ledger store | A→B | Request-Response, in-process | record | write acknowledgement | durable append | a failed write prevents the call, and the job fails with that reason |
| Client → backend (auth) | A→B | Request-Response over encrypted transport | identity token, device identifier | session tokens | device and session records created | an invalid token yields no session and no account disclosure |
| Client → backend (authorisation broker) | A→B | Request-Response over encrypted transport | authorisation code, connector identity | connector authorisation | authorisation stored per `req-022-account-sync` | a failed exchange stores nothing partial |
| Client ↔ backend (replication) | Duplex | specified by `req-022-account-sync` | account-owned records | — | replication of the local working copy | the local store remains authoritative for the running device |
| Client → backend (update manifest) | A→B | Request-Response | current version | manifest or "current" | none | failure leaves the application on its current version |
| Client → model provider | A→B | Request-Response and Stream | job content and attachments | model output | provider billing against the user's own account | provider error codes surface as SYSTEM cards |
| Native module ↔ main | Duplex | in-process function calls | window handles, positions, hit-test results | platform results | window styling and placement | a native failure degrades to standard window behaviour and is reported |

### Execution Boundaries & Isolation

The desktop application runs as several processes. The main process owns the local store, the Job Manager, the
wrapper, the evaluator and the connector adapters — that is, everything that can change state. The two renderer
processes own presentation only. Agent execution runs off the main thread so that a long model call never
freezes the pet, and each worker-agent is isolated per job so that one job's context cannot reach another's.

Ownership follows that split exactly: a renderer owns nothing durable, so a renderer crash costs a window and no
data. If the main process dies, recovery reads the ledger at the next start, reconciles every unresolved intent
record, and only then creates the pet window — so a duplicate tool call cannot occur while the user is already
able to issue commands.

The native module is in-process by necessity: it exists to style and place the very windows the main process
owns. It is kept narrow for exactly that reason — window styling, non-activating placement, and transparent
hit-testing — and a failure in it degrades to standard window behaviour rather than propagating.

The backend is a separate trust and failure domain. It participates in no decision the client makes, so its
loss removes sign-in, brokering and replication while jobs continue to run against platforms directly.

### Trust Boundaries & Input Validation

Three entry points are untrusted, and each is handled structurally rather than by inspection.

User input from the dialog surface expresses intent and carries no authority. It reaches an agent as content;
it never reaches the evaluator.

Connector-fetched content is the sharper case, because it arrives inside the agent's own working material. Each
connector declares its sanitization in its manifest, and the structural defence is placement rather than
filtering: the evaluator runs after all content has been read and after any question has been answered, so no
fetched text can alter a verdict.

Model output is a proposal, never a control signal. The wrapper treats a proposed tool call as a request to be
evaluated, and an automatic approval from the risk judge is recorded as a distinguishable decision so that it is
never mistaken later for a human one.

The backend validates that every request resolves to exactly one account and rate-limits its authentication and
broker endpoints. Its own compromise is a declared consequence of the account-owned model and is bounded by
operational controls — confined key access, least privilege, audit — recorded in principle VII and in RISK-062.

## Decisions

### D1 — The wrapper is the only path from an agent to a platform

- **Choice**: generate every worker tool from a connector manifest and wrap each one in a single component that
  writes the intent record, evaluates the gate, executes, and writes the result record.
- **Rationale**: it converts three separate promises into one code path. Auditing that the ledger is complete and
  the gate unbypassable becomes reading one component instead of reviewing every tool for compliance, and a new
  connector inherits both guarantees without writing a line about them.
- **Alternatives Considered**: *middleware supplied by the agent harness* — rejected because it makes the
  guarantee depend on the framework's interception capabilities, which would have to be re-verified at every
  upgrade. *Enforcement inside each adapter* — rejected because it multiplies the number of places a mistake
  removes a guarantee by the number of connectors, which is the opposite of the product's stated reach.
  *A system-prompt instruction to always record actions* — rejected outright: the second principle forbids the
  prompt from being the mechanism.

### D2 — The approval evaluator is pure and deterministic

- **Choice**: compile user rules into a closed representation and evaluate them with a total, side-effect-free
  function that performs no input or output.
- **Rationale**: purity is what makes the gate testable against an adversarial corpus, and what makes it
  unreachable from model output. An evaluator that could fetch something could be made to wait, and a gate that
  can be made to wait can be made to fail open.
- **Alternatives Considered**: *asking a model whether an operation matches the user's rules* — rejected because
  it reintroduces the LLM into the blocking path, and because the same input would not reliably produce the same
  verdict. *Free-form predicates supplied by the user* — rejected because an unbounded condition language cannot
  be enumerated in tests, and the product would not be able to tell the user which rules it actually enforces.

### D3 — The pet-agent creates jobs and never commands them

- **Choice**: give the pet-agent five tools, none of them a connector tool, and route all work through the Job
  Manager.
- **Rationale**: it makes failure attributable. When a job goes wrong, the agent that owns the decision is the
  one that made it, and adding a capability does not edit the component every interaction passes through.
- **Alternatives Considered**: *a central orchestrator that plans and delegates* — rejected by the first locked
  decision, and on its own merits: every new capability becomes an edit to one hot module. *Letting the
  pet-agent perform quick operations directly* — rejected because "quick" is not a property the gate can
  evaluate, and it would create a second path to the platform, defeating D1.

### D4 — Two records per tool call

- **Choice**: write an intent record before the call and a result record after it, sharing a correlation
  reference.
- **Rationale**: it is the only structure that satisfies fail-closed recording and append-only storage at the
  same time, because the outcome is unknown at the moment the record must exist. It also gives recovery exactly
  the signal it needs: an intent without a result is the indeterminate state to reconcile.
- **Alternatives Considered**: *one record written after the call* — rejected because a crash between the call
  and the write loses the action entirely, which is the precise failure the third principle exists to prevent.
  *One record updated in place after the call* — rejected because it makes the store mutable, and an editable
  ledger is not evidence.

### D5 — The local store is the working copy and the device keeps working offline

- **Choice**: run jobs against the local store, and replicate to the account rather than reading through the
  network.
- **Rationale**: crash recovery, the offline command queue and the fail-closed ledger write all require a store
  that is present and authoritative at the moment of the call. Routing them through the network would make
  every guarantee conditional on connectivity.
- **Alternatives Considered**: *server-authoritative state with a thin client* — rejected because it puts the
  backend in the path of every tool call, making a network failure a correctness failure rather than an
  inconvenience, and because it would place job execution on the server, which principle VII forbids.

### D6 — Connector authorisation is brokered by the server

- **Choice**: exchange authorisation codes on the backend, where the provider client secret is held.
- **Rationale**: several platforms require a confidential client, and shipping a client secret inside a desktop
  binary does not make it secret. Brokering also means a new provider is a server configuration change rather
  than a client release.
- **Alternatives Considered**: *client-side exchange with an embedded secret* — rejected because the secret is
  extractable from the artifact. *Requiring every user to register their own client* — rejected as the general
  case because it puts a technical setup burden on the user, which the standard connect flow forbids; it is kept
  as a deliberate per-connector route where a platform's verification requirements make it the only path, and
  `req-014-byo-oauth-google` specifies it with in-application guidance.

### D7 — Two windows with a narrow native escape hatch

- **Choice**: a transparent frameless always-on-top pet window and a conventional application window, with a
  small native module for window styling, non-activating placement and transparent hit-testing.
- **Rationale**: the interaction commitment — a card may appear over another application without taking
  keyboard focus — is not expressible through the application framework's own window interface. Keeping the
  native surface narrow means the escape hatch does not become a second platform.
- **Alternatives Considered**: *a single window with an overlay region* — rejected because it cannot be
  always-on-top and click-through at once. *Building the shell natively per operating system* — rejected as
  disproportionate for the two supported systems, and it would duplicate the interface twice over.

### D8 — Content is data everywhere, enforced by placement rather than filtering

- **Choice**: run the evaluator after all content is read and after any question is answered.
- **Rationale**: filtering untrusted content is a losing race; placement is structural. Whatever a page or a
  message body says, and whatever the user answers, the verdict is computed from the call descriptor and the
  confirmed rules.
- **Alternatives Considered**: *detecting injected instructions in fetched content* — rejected as a primary
  defence because it fails quietly and invites reliance; connectors still declare sanitization, but as
  hardening, not as the boundary.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: connector manifests are read from the application's own registry at
  start, validated as a whole, and registered. A connector becomes available to an agent only once it holds an
  authorised account, so the agent's tool set follows connection state rather than installation state. Manifests
  are never read from a location the user can write to arbitrarily: a manifest declares what is irreversible,
  which makes it a security surface rather than a preference file.
- **Isolation & Sandboxing**: adapters run in the main process alongside the wrapper, because the wrapper must
  observe every call they make. Their isolation is contractual rather than spatial — an adapter receives only an
  authorisation reference and the parameters for one call, and holds no access to jobs, rules or the ledger. The
  native module is likewise in-process by necessity and is kept to three narrow functions.
- **Resource Management & Eviction**: disconnecting a connector revokes at the platform where an endpoint
  exists, deletes the credential from the secure store, unregisters its tools, and fails any job depending on it
  with a clean report. Attachments are released from working memory when their job reaches a terminal state.
  Ledger records are evicted only by the retention policy or by an explicit warned deletion, never under
  capacity pressure, because pressure-driven eviction would silently remove the evidence undo depends on.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (Specific ➔ General)**: a write whose recorded state does not fit its declared compensating formula
  ──> the undo planner reasons from the recorded snapshots and marks the step as inferred rather than declared.
  A model assigned to a role that cannot accept an input ──> the capability is checked before the call and the
  affordance is disabled with an explanation, rather than failing downstream.
- **Tier 2 (Custom ➔ Built-in Default)**: a manifest that is absent, malformed or missing a required field ──>
  the connector is unavailable with the reason stated, no tool from it is registered, and any existing
  authorisation is left untouched so it survives a bad release. A missing translation ──> the English string. A
  missing role assignment ──> the provider's recommended default.
- **Tier 3 (Degraded Safe-Mode)**: the backend unreachable ──> sign-in, brokering and replication stop while
  jobs continue against the local store and commands queue locally, surfaced as a SYSTEM card. The risk judge
  unreachable, slow or unparsable ──> escalate to the user, never auto-approve. The evaluator itself failing
  ──> the call is stopped and escalated; the gate never fails open. The secure store unreachable ──> credentials
  are not held at all rather than held in plain text, and the product says so. The ledger unwritable ──> tool
  calls stop; the product is read-only rather than acting without recording.

## Complexity Tracking

None. This change introduces no deviation from a constitutional principle. The one place where a principle's
consequence is uncomfortable — the backend holding decryption keys under principle VII — is not a deviation but
the principle as the decision-maker redefined it, and it is recorded in the constitution and in RISK-062 rather
than here.

## Research

### R1 — Whether the wrapper can guarantee that no tool bypasses it

- **Decision**: register every tool through the wrapper and register none of the harness's own default tools.
- **Rationale**: the guarantee follows from the registry being ours rather than from the framework's
  interception behaviour, so it does not need re-verification when the harness is upgraded.
- **Alternatives**: framework middleware; per-adapter enforcement.
- **Source / Verification Status**: VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#0-ket-luan`), carried by
  `req-007-pi-sdk-harness`.

### R2 — Whether a card can appear over another application without stealing keyboard focus

- **Decision**: a native module supplies no-activate topmost styling, non-activating position updates and
  transparent hit-testing.
- **Rationale**: the application framework's window interface does not express the combination, and the
  interaction commitment depends on it.
- **Alternatives**: framework-level window flags; a single window with an overlay region.
- **Source / Verification Status**: VERIFIED (`spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan`), carried by
  `req-008-pet-window-os`.

### R3 — Whether append-only and fail-closed recording can hold simultaneously

- **Decision**: the two-record model with database-enforced immutability and a startup recovery phase.
- **Rationale**: it was the only measured structure satisfying both, and recovery passed every deliberate kill
  point tested.
- **Alternatives**: a single record after the call; a mutable record updated in place.
- **Source / Verification Status**: VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan`), carried by
  `req-013-sqlite-ledger`.

### R4 — Whether a deterministic evaluator withstands a real agent trying to get past it

- **Decision**: a closed rule representation with a pure evaluator, and scoped approval bound to the tuple of
  job, rule, tool and scope.
- **Rationale**: the measured evasion route was widening a scoped approval to all calls of the same tool name,
  which the tuple forecloses.
- **Alternatives**: model-evaluated rules; free-form user predicates.
- **Source / Verification Status**: VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#0-ket-luan`), carried by
  `req-009-rule-ir-hardgate`.

### R5 — Whether adding a connector really leaves the core untouched

- **Decision**: freeze the manifest schema and the adapter surface as versioned contracts.
- **Rationale**: the claim was tested by adding a second connector and counting the core changes required.
- **Alternatives**: per-connector integration code.
- **Source / Verification Status**: VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#0-ket-luan`), carried
  by `req-019-connector-framework`.

### R6 — How the working copy relates to the account's authoritative copy

- **Decision**: the local store stays authoritative for the running device, and replication is append-and-
  reconcile rather than last-writer-wins.
- **Rationale**: last-writer-wins would silently delete ledger history, which the third principle forbids; and
  the offline and crash-recovery guarantees require a present, authoritative local store.
- **Alternatives**: server-authoritative state; last-writer-wins replication.
- **Source / Verification Status**: UNVERIFIED. No spike measured replication — all twenty measured a
  device-bound product (RISK-070). `req-022-account-sync` carries this question, and its open question Q-5 asks
  whether a spike must run before the design proceeds.

## Migration & Rollback

No existing data and no existing contracts: this is the first definition, and every contract it publishes is
version 0.1.0 in draft status. Nothing is migrated.

Rollback of this change means the specification set is discarded and the capabilities return to purpose-only
stubs. Because no code exists, no artifact and no user data is affected, and the harvest that produced the
change can be rerun from the same source documents.

The migration obligation that does exist is forward-looking and belongs to the changes that follow: each of the
four contracts here is drafted and is frozen by its owning change — `connector-manifest` by
`req-019-connector-framework` and `rule-representation` by `req-009-rule-ir-hardgate` — and freezing one carries
the version bump and consumer update that the contract's own compatibility section describes.

## Risks / Trade-offs

- [The wrapper is a single point of failure for three guarantees at once] → its surface is deliberately tiny,
  it is the first thing `req-007-pi-sdk-harness` verifies, and the verification checks the property that no
  unwrapped tool can be registered rather than checking that each tool behaves.
- [A purely deterministic gate cannot express every rule a user might state] → the product names the unsupported
  part rather than storing a weakened rule, and the `smart` mode's second tier covers judgement cases by
  escalating to the user rather than by widening the rule language.
- [Adapters running in the main process are not spatially isolated] → their contractual surface is four
  operations and an authorisation reference, and the wrapper observes every call they make; the trade is
  accepted so that the wrapper can hold the guarantee centrally.
- [The backend can decrypt replicated content] → the declared consequence of principle VII as redefined; bounded
  by confined key access, least privilege and audit, and recorded as RISK-062 rather than hidden.
- [Most of this design rests on spikes of a device-bound product] → every replication-dependent statement above
  is labelled UNVERIFIED and belongs to `req-022-account-sync`; nothing in this design treats it as settled.
- [Twelve capabilities specified at once risks a baseline nobody reads] → the delta specs are the only place
  requirements live, each carries its source, and the roadmap sequences which change fills in which capability.

## Open Questions

- Whether the pet's reading of on-screen context joins the constitution's list of untrusted external content.
  It does not change this structure — such content would enter through the same trust boundary as the other two
  — and it is queued in `req-018-pet-liveness`.
- Whether connector tool interfaces should be shaped for the external tool protocol now or at the point
  third-party connectors are accepted. The manifest contract admits either, and the reserved slot in `model.md`
  records the condition.
- Which infrastructure region hosts the backend. It is recorded as a compliance decision in `req-001`'s
  clarification queue and constrains deployment rather than this structure.

## Context

The product's reach depends on a claim that was, until this spike, untested: that the Nth platform costs a
manifest and an adapter rather than an edit to the core. The claim is now measured. A second connector of
deliberately opposite shape — read-only, no writes, no snapshots, a different authorisation provider — was added
at zero lines of change in the job manager, the connector registry, the evaluator, the ledger, the wrapping layer
and the tool generator, with one line of registration at the point where the application wires itself together —
VERIFIED (`spikes/SP-19-connector-framework/evidence/core-diff-report.md`).

What remains is to write the boundary down precisely enough that the third connector cannot renegotiate it, and
to attach the consequences that the measurement exposed: an operation flagged irreversible is stopped by the gate
with no user rule; one of the two platforms publishes no way to withdraw an authorisation; and an authorisation
that expires inside a tool sequence costs an unplanned round trip.

Three constraints bound every decision below. The constitution's principle VI is the property being protected and
principle IV is why a declaration may never be optional. The contracts this change consumes already exist and are
not reopened here: `agent/contracts/tool-wrapping@0.1.0` owns the four-step order every call passes through,
`approval/contracts/gate-evaluation@0.1.0` owns the verdict, `ledger/contracts/ledger-record@0.1.0` owns what is
written, `job/contracts/tool-reconciliation@0.1.0` owns what an interrupted call meant,
`platform/contracts/secure-storage@0.1.0` owns every credential value, and
`backend/contracts/authorisation-broker-api@0.1.0` owns the exchange. And no application code exists yet, so
nothing here is a migration of a running product.

## Goals / Non-Goals

**Goals:**
- Freeze the manifest schema and the adapter interface as versioned contracts, so that the zero-core-change
  property is a contract rather than a happy accident.
- Fix a single vocabulary of connector failures, so that what is retried, what ends a job and what reaches the
  user is decided once rather than per platform.
- Settle the approval consequence of the `irreversible` declaration, and make the declaration unreachable from
  anything a model produces.
- Make the two operational facts the spike exposed — a platform with no revocation endpoint, and an expiry that
  falls mid-sequence — specified behaviour rather than production surprises.
- Leave a stated, dated route for platforms the product did not write, without building any part of it now.

**Non-Goals:**
- Any individual connector. Notion's operations and its compensation matrix belong to
  `req-003-notion-compensation`; the Google connectors and the bring-your-own authorisation route belong to
  `req-014-byo-oauth-google`.
- Third-party or externally-hosted connectors. Reserved in `model.md` with its phase and activation condition.
- The resource-lock manager and the shared rate queue, which are `req-015-concurrency-coordinator`.
- The undo pipeline that consumes the compensation formula, which is `req-010-undo-agent`.
- Anything the backend does with a provider, beyond naming the join between a manifest and a provider descriptor.

## Structure

Six components, all inside the process that owns the ledger, the gate and the connectors. Each maps to entities
in `model.md`, and every interaction with another capability goes through that capability's contract.

| Component | Responsibility | Model entities | Reaches other domains through |
| --- | --- | --- | --- |
| **Manifest loader** | Reads each manifest shipped with the release, validates it whole against the frozen schema, and produces either a complete set of tool declarations or a refusal naming the failing declaration | Connector manifest, tool declaration, capability declaration, scope profile | `connector/contracts/connector-manifest@1.0.0` |
| **Connector registry** | Pairs a validated manifest with the adapter registered under the same identity, holds the connection state and the instant it was established, and answers "which connectors are currently connected" | Connector registration, connection state | — (it is the capability's own surface) |
| **Tool generator** | Turns each tool declaration of a connected connector into a tool implementation carrying its declarations, and hands it to the wrapping factory; it never hands anything to a session directly | Generated tool, tool declaration | `agent/contracts/tool-wrapping@0.1.0` |
| **Adapter** | Speaks one platform's protocol through exactly four operations, resolving its authorisation per call | Connector adapter, connector error | `connector/contracts/connector-adapter@1.0.0`, `platform/contracts/secure-storage@0.1.0` |
| **Authorisation lifecycle** | Starts and completes Connect, establishes state by probing, renews before a job where the margin requires it, and performs disconnection including the case where the platform offers no withdrawal | Authorisation grant, connection state | `backend/contracts/authorisation-broker-api@0.1.0`, `platform/contracts/secure-storage@0.1.0`, `sync/contracts/replicated-store-descriptor@0.1.0` |
| **Declaration reader** | The single path by which the gate, the undo planner and recovery obtain a tool's declarations, copying them into the record of intent at call time | Tool declaration, snapshot declaration, compensation formula | `approval/contracts/gate-evaluation@0.1.0`, `ledger/contracts/ledger-record@0.1.0`, `job/contracts/tool-reconciliation@0.1.0` |

The shape that produced the measurement is visible in that table: no component above is per-platform except the
adapter, and no component below this capability knows a platform exists. The job manager asks the registry which
connectors are connected and the generator for their tools; the wrapping factory asks the declaration reader what
a tool declares; neither asks which platform it is dealing with, and the spike's core components contain no
branch on a connector's identity — VERIFIED
(`spikes/SP-19-connector-framework/evidence/core-diff-report.md` §3).

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `connectors.list` | Window → Main | Request-Response | none | Catalogue: identity, display name, icon, connection state, the instant it was established, whether renewal is possible here | none | Never fails for a connector in a failing state; the state is the answer |
| `connectors.connect` | Window → Main | Request-Response | Connector identity | An outcome: connected, abandoned, or refused with the platform's reason | Opens the browser, listens on a loopback address, exchanges through the broker, writes one credential entry | The broker's codes; the loopback listener stops on its own deadline and the connector returns to registered |
| `connectors.disconnect` | Window → Main | Request-Response | Connector identity | Which of the two outcomes occurred, and the settings address where the platform still lists the integration | Calls revocation where declared, erases the credential entry for the account, fails jobs that depend on it | A refused revocation still erases locally and says so |
| `connectors.reconsent` | Window → Main | Request-Response | Connector identity, capability | As Connect | Requests the wider scope only | As Connect |
| `connectors.state` | Main → Window | Event | Connector identity, state, instant, whether renewal is possible here | — | none | Emitted on every state change, including one established by a failed job |
| Tool execution | Wrapped tool → Adapter | In-process call | `ToolCall` with its declaration | `ToolResult` | The platform's own effect | `connector/contracts/connector-adapter@1.0.0`; failures are returned, never thrown |
| Platform request | Adapter → Platform | Request-Response over HTTPS | The platform's own protocol | The platform's own response | The platform's own effect | Mapped to the fixed error vocabulary at this edge |
| Authorisation exchange and renewal | Main → Backend | Request-Response | `backend/contracts/authorisation-broker-api@0.1.0` | Tokens | Writes a credential entry | The broker's codes; a renewal needing the user surfaces as a state, not as a job failure |

No window channel reaches an adapter, a tool or a declaration. A window can present connector state and ask for
Connect, re-consent or disconnect; it cannot execute a tool, cannot supply a declaration, and cannot cause a call
to be made — which is the same separation `approval/contracts/gate-evaluation@0.1.0` draws for verdicts, for the
same reason.

### Execution Boundaries & Isolation

One process owns the manifests, the registry, the adapters, the ledger writer and the evaluator. Adapters are
in-process modules within it, not workers and not subprocesses. That is sound precisely while every manifest is
first-party and shipped with the release: an adapter holds the authorisation it must present, so moving it across
a boundary would either move the credential with it or add a second credential-bearing channel — both worse than
the risk the boundary would remove. The condition that reopens this is the reserved point in `model.md`, and it
is stated there rather than assumed away here.

A crash of that process is an ordinary crash: no connector state is authoritative in memory, the registry is
rebuilt at the next start from the release's manifests and the account's connector records, and every connection
state is established again by asking the platform rather than by trusting what was cached. A call that was in
flight is an unresolved intent in the ledger and is settled by `job/contracts/tool-reconciliation@0.1.0`.

### Trust Boundaries & Input Validation

| Entry point | Trust | Control |
| --- | --- | --- |
| A manifest | First-party, and only after whole-manifest validation | Validated at load against the frozen schema plus the cross-field rules; a failure yields no tool at all |
| Tool arguments produced by a model | Untrusted | Validated against the declared parameter shape before the adapter is reached; never a source of any declaration (INV-CN-06) |
| Everything a platform returns | Untrusted data | Sanitized as the manifest declares before entering an agent's context; never an instruction, never an authorisation |
| A platform's statement about the authorisation | An observation with a time | A failure to reach the platform establishes nothing (INV-CN-10) |
| A window's request to connect or disconnect | User intent, authenticated by being the signed-in user's own window | The window names a connector; it supplies no scope, no endpoint and no credential |
| The authorisation value | Secret | Resolved from the credential store at the moment of use, present in no record this capability writes (INV-CN-09) |

## Decisions

### D1 — Freeze the boundary now, at two connectors
- **Choice**: publish `connector-manifest@1.0.0` and `connector-adapter@1.0.0` as frozen contracts, with additive
  extension defined as a MINOR bump.
- **Rationale**: the property worth protecting is the boundary, not the two platforms that happen to exist. The
  zero-core-change result was measured through this exact shape, so the shape is what the measurement licenses.
  An informal boundary is renegotiated by the third connector, and what absorbs the difference is the core.
- **Alternatives Considered**: *Keep the manifest internal and informal* (the proposal's minimum viable slice) —
  rejected because it maximises flexibility exactly where flexibility is the failure mode; divergence would be
  discovered when the fourth connector needed the second's behaviour. *Wait for a third connector before
  freezing* — rejected because the third connector is written against whatever exists, so waiting does not
  produce evidence, it produces a third informal shape.

### D2 — The adapter is four operations, and a platform capability that does not fit becomes a tool
- **Choice**: `execute`, `fetchSnapshot`, `checkStatus`, `revoke`, and no fifth.
- **Rationale**: every platform peculiarity that becomes a method is a peculiarity some core component eventually
  learns about. Four operations were sufficient for a seven-tool writing connector and a two-tool read-only one —
  VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q3).
- **Alternatives Considered**: *A richer interface with per-capability methods* — rejected because it makes the
  interface grow with the union of all platforms rather than with the product's obligations. *Passing a
  platform's own client through to the core* — rejected outright: it would put platform-shaped objects inside the
  job manager and the ledger, which is the erosion principle VI forbids.

### D3 — A fixed failure vocabulary, mapped at the adapter's edge
- **Choice**: every failure becomes one of twelve declared codes, with `retryable` as advice; the job's retry
  policy reads the code, never the platform's message.
- **Rationale**: the job manager has to decide what to retry and what ends a job. If it decided by inspecting
  platform messages, every platform would eventually add a branch to it. A withdrawn authorisation surfaced as
  its own code and ended a running job cleanly with no such branch — VERIFIED (Q10).
- **Alternatives Considered**: *Pass platform errors through untranslated* — rejected because it moves platform
  knowledge into the core one string comparison at a time. *Let each connector supply its own retry policy* —
  rejected because retry budget interacts with the job's time limit and with the rate queue, neither of which a
  connector can see.

### D4 — A manifest is a release resource, validated whole
- **Choice**: manifests ship with the application, are validated whole at start-up, and a failure yields no tool
  from that connector while every other connector continues.
- **Rationale**: a partially loaded manifest offers operations whose reversibility nobody declared, which
  principle IV forbids; and a manifest discovered at runtime is a tool description the product never reviewed.
- **Alternatives Considered**: *Load the valid tools and skip the malformed one* — rejected on principle IV, and
  because it hides an authoring defect behind a silently smaller tool set. *Discover manifests in a user
  directory* — rejected as the third-party question in disguise; it is reserved in `model.md`, with the isolation
  answer that must accompany it.

### D5 — Adapters run in the process that owns the ledger and the gate
- **Choice**: in-process modules, for first-party manifests only.
- **Rationale**: an adapter must present a credential; isolating it would either move the credential across a
  boundary or create a second channel that carries one. While every manifest ships with the release, the isolation
  would buy little and cost a credential path.
- **Alternatives Considered**: *A worker or subprocess per connector* — rejected for the credential reason above,
  and recorded as the thing that must be revisited when the reserved point activates. *A sandbox with a narrow
  message surface* — same rejection, plus it would make the four-operation interface an inter-process protocol
  with its own failure modes, for no gain against first-party code.

### D6 — Connection state is established by asking the platform
- **Choice**: `checkStatus` probes; a stored expiry is never the basis of a state; every state carries the instant
  it was established, and an unreachable platform establishes nothing.
- **Rationale**: only the platform knows whether an authorisation is still accepted — a user can withdraw it
  there at any moment. All four states were told apart against real endpoints — VERIFIED (Q9). Presenting a stale
  belief as current is how a user is told they revoked something they did not.
- **Alternatives Considered**: *Infer from the stored expiry* — rejected because it cannot see a withdrawal at
  all. *Discover state lazily at the first call* — rejected because the connectors area would then show nothing
  until a job failed, and because the pre-flight check in D7 needs an answer before work starts.

### D7 — A pre-flight authorisation check with a margin, and on-demand renewal as well
- **Choice**: before a job's first call, every connector it may use is established and renewed where less validity
  remains than the configured margin; the adapter still renews on demand, because a long job can outlive any
  margin.
- **Rationale**: an expiry falling inside a tool sequence costs an unplanned renewal round trip of roughly 300 ms
  and, worse, lands in the middle of a sequence the user is watching — VERIFIED
  (`spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien`). The margin is a risk reduction, not a
  guarantee, and the specification says so.
- **Alternatives Considered**: *On-demand renewal only* — rejected as the measured problem itself. *A background
  renewal daemon* — rejected because it keeps authorisations alive on a device that may be doing nothing, which
  works against the account-owned model, and because it would renew for connectors no job is using.

### D8 — The absence of a revocation endpoint is declared, not discovered
- **Choice**: the manifest's `revocation` field is required; where the platform publishes no endpoint, the
  manifest carries the address of the page where the user can withdraw the integration themselves, and
  disconnection states which of the two outcomes occurred.
- **Rationale**: one of the two measured platforms has no such endpoint, so disconnecting it removes the product's
  copy while the platform still lists the integration — VERIFIED
  (`spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien`). A user who believes they revoked access
  and has not is being told something untrue about their own account.
- **Alternatives Considered**: *Attempt revocation and report whatever happens* — rejected because the product
  would then discover at disconnect time what it could have known at authoring time, and would have to improvise
  the sentence it shows. *Refuse to disconnect from platforms with no endpoint* — rejected because it strands the
  user with an authorisation they can remove from neither side.

### D9 — Adopt the external protocol's tool shape now; reserve accepting other people's connectors
- **Choice**: tool descriptions follow the Model Context Protocol's conventions, with the product's safety
  declarations carried in that protocol's annotation surface; accepting third-party or externally-hosted
  connectors is a reserved point with a phase and an activation condition.
- **Rationale**: converting an external tool description into a manifest declaration cost no architectural change
  — VERIFIED (Q11) — so adopting the shape is free and keeps the option open. What is not free is running other
  people's code next to the credential store, and that is a decision with an isolation design attached, not a
  refactor.
- **Alternatives Considered**: *Accept external connectors now* — rejected because D5's in-process adapter is
  sound only for first-party code, so this would silently change the isolation argument. *Design a surface of our
  own* — rejected because the external protocol already matches one-to-one and a private shape would have to be
  translated for every future third party.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: eager, at start-up. Each manifest shipped with the release is validated
  whole and paired with the adapter registered under the same identity; a pair registers, half a pair registers
  nothing (INV-CN-12). There is no hot reload and no runtime installation: the registry changes during a session
  only when a connector's connection state changes, which is what makes the tool set visible to an agent change
  without restarting — VERIFIED (Q6: the tool set moved from 7 tools to 9 the moment the second connector became
  connected).
- **Isolation & Sandboxing**: in-process, per D5, for first-party manifests only. An adapter's blast radius is
  bounded by what the interface lets it return rather than by a process boundary, which is why the adapter may
  hold no policy and is reachable only from inside its wrapper (INV-CN-08).
- **Resource Management & Eviction**: a manifest is loaded once and held for the life of the process; the
  generated tool set is assembled per job and released with it; a disconnection erases the credential entry,
  drops the connector from the connected set, and fails the jobs that depended on it rather than letting them
  continue against an authorisation that no longer exists.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (specific to general)**: a *tool* that cannot run — the platform refused it, its snapshot could not be
  read, its declaration referenced something missing — fails that call with its declared code. The job's other
  tools and the product's other connectors are unaffected, and the agent may re-plan around a refusal because a
  refusal is a result rather than a fault.
- **Tier 2 (custom to built-in baseline)**: a *connector* that cannot load — a manifest that fails validation, a
  schema version ahead of the release, a missing adapter — yields no tool at all and is presented as unavailable
  with the reason. Every other connector continues, and a job that needed the missing one fails naming it rather
  than substituting anything. There is deliberately no built-in stand-in: a substitute platform is not a
  degradation, it is a different act on someone's account.
- **Tier 3 (degraded safe mode)**: when no connector can be reached at all — the credential store is unavailable,
  the device has not yet replicated its authorisations, or the network is gone — the product stays up and refuses
  to start jobs that need a platform, stating which connector is unavailable and why. The pet, the ledger, the
  rules and every already-recorded job history remain readable, because none of them depends on a platform being
  reachable. Nothing is attempted blind, and no state is inferred from a failure to look (INV-CN-10).

## Complexity Tracking

None. This change adds no constitutional violation and removes one piece of guesswork: principle VI's claim moves
from asserted to measured, and principle IV's declaration acquires the default consequence it previously lacked.
The one place a deviation could be argued — running adapter code in the process that owns the ledger and the gate
— is not a deviation while every manifest is first-party, and the condition under which it would become one is
recorded as a reserved point rather than left implicit.

## Research

### R1 — Is a schema frozen at two connectors likely to survive the third?
- **Decision**: freeze, and expect additive extension.
- **Rationale**: the two connectors were chosen to be opposite in the dimensions that matter — writing against
  read-only, snapshot-bearing against stateless, confidential-client against proof-key, one scope profile against
  two. The fields a third platform is most likely to need are additive: another authorisation kind, another rate
  dimension, a per-tool timeout.
- **Alternatives**: waiting for a third connector; a deliberately loose schema with a free-form extension field,
  which would reintroduce the informal boundary under another name.
- **Source / Verification Status**: VERIFIED for the two shapes
  (`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q1); UNVERIFIED as a prediction about the
  third, and recorded as such in `proposal.md` under Assumptions.

### R2 — How far is the product from accepting tools described by an external protocol server?
- **Decision**: adopt the shape now, defer acceptance.
- **Rationale**: name, description and parameter schema match one-to-one, results share the same content shape,
  and the product's extra declarations fit the protocol's annotation surface; an imported description converted
  without an architectural change.
- **Alternatives**: a private tool shape; accepting external servers immediately.
- **Source / Verification Status**: VERIFIED
  (`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q11).

### R3 — What margin should trigger a pre-flight renewal?
- **Decision**: a configured margin, defaulting to five minutes.
- **Rationale**: the spike measured the cost of an in-sequence renewal at roughly 300 ms and recommended a
  five-minute pre-flight margin for the first milestone. The cost of renewing early is one extra round trip
  before a job that would probably have needed it anyway; the cost of renewing late is a pause inside a sequence
  the user is watching.
- **Alternatives**: renewing whenever any validity remains below an hour, which renews constantly; renewing only
  on failure, which is the measured problem.
- **Source / Verification Status**: the 300 ms cost is VERIFIED
  (`spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien`); the five-minute margin is that report's
  recommendation and is UNVERIFIED as a threshold, recorded that way in `verification.md`.

### R4 — Which platforms can actually be revoked from the product?
- **Decision**: treat revocation as a per-platform declaration with a user-facing consequence.
- **Rationale**: one measured platform publishes a revoke endpoint and the other publishes none, so this is a
  property that varies per platform and cannot be assumed either way.
- **Alternatives**: assuming an endpoint exists and handling its absence as an error; hiding the difference from
  the user.
- **Source / Verification Status**: VERIFIED
  (`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q10, and
  `#4-rui-ro-moi-phat-hien` for the platform that has none).

## Migration & Rollback

**What is migrated.** Two contract versions and no data. `connector-manifest` moves from the `0.1.0` draft in
`req-001-mvp-product-definition` to a frozen `1.0.0`; the migration steps, field by field, are in that contract's
own Migration section. `connector-adapter@1.0.0` is a first publication that supersedes four signatures sketched
inside the earlier manifest draft. No application code, no manifest and no stored authorisation exists against
either predecessor, so there is nothing to convert and nobody to notify beyond the changes that consume them:
`req-003-notion-compensation` and `req-014-byo-oauth-google` author manifests against `1.0.0` directly, and
`req-007-pi-sdk-harness` consumes the declarations by name rather than by encoding and needs no change.

**Rollback.** Reverting this change returns both contracts to draft status and returns the approval default for
irreversible operations to an open product question. Nothing else unwinds, because nothing persistent was
created. The one thing a rollback would not undo is the measurement: the zero-core-change result stands in the
spike report whatever the contracts say.

## Risks / Trade-offs

- [The third connector needs a field the frozen schema lacks] → additive extension is a MINOR bump with a stated
  procedure in `evolution.md`; the extension procedure is written before the need arises rather than after.
- [A platform with no revocation endpoint leaves a user authorised after they believed they disconnected] →
  declared in the manifest, stated plainly at disconnection, and the settings address offered directly; the
  product does not claim what it cannot do — VERIFIED as a real case.
- [An authorisation expires mid-sequence despite the pre-flight margin] → on-demand renewal remains, so the cost
  is the measured round trip rather than a failure; the specification says the margin is a reduction and not a
  guarantee.
- [An adapter defect returns a failure with no declared code] → treated as permanent rather than transient, and
  recorded as an adapter defect; the conformance suite in `verification.md` makes this a test rather than a hope.
- [In-process adapters become unsound the moment a connector is not first-party] → the reserved point in
  `model.md` names this as the activation condition, so the isolation question arrives with the decision rather
  than after it.
- [Freezing the schema makes a connector author work around it rather than propose an extension] → the extension
  procedure in `evolution.md` is short and additive by design; a workaround would have to hide platform behaviour
  somewhere the loader validates, which the whole-manifest rule makes conspicuous.

## Open Questions

- Which verification tier the mass-market release channel must clear, and therefore which scope profile a
  connector's manifest names as the default for that channel. Postponable: the mechanism is specified and
  measured, and the answer changes one field's value in a connector's own manifest rather than anything here.
  Tracked as Q-1 in `clarifications.md`.
- On what condition the product begins accepting connectors it did not write. Postponable by construction: it is
  a reserved point with a phase and an activation condition, and nothing in this change's specs, approach or
  tasks changes when it is answered. Tracked as Q-2 in `clarifications.md`.

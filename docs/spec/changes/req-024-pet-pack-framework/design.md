## Context

Three things already exist and constrain everything below. The renderer loads an animation asset from a binary
buffer and swaps it while running, VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` Q6;
`spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q7), so no transport mechanism has to be
invented. The pet already animates on two independent layers at 60 frames per second, VERIFIED
(`spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` Q19, Q20), so the second layer is a declaration
problem rather than a rendering problem. And replication already has an extension point: a body of account data
joins it by registering a descriptor against `sync/contracts/replicated-store-descriptor@0.1.0`, which the
protocol reads without knowing what the store contains.

The consequence that shapes this design is that almost nothing here is new machinery. The work is to name a unit
that was previously implicit, declare an interface that was previously half-stated, and register against two
extension points that already exist.

One constraint is genuinely new. Every replicated store so far carries records. A pack carries a binary, and
no spike has measured replication of one — which is why the design bounds the payload rather than optimising a
transfer it cannot characterise.

## Goals / Non-Goals

**Goals:**

- Make a pet pack the unit that is shipped, created, activated and owned, so that adding a pet is adding data.
- Close the contradiction between the two-layer specification and the one-input contract, so that an author
  outside the product team can satisfy both at once.
- Give the persona specification an owner, so the living requirement that refers to it stops referring to
  nothing.
- Let a pack the user made follow their account without them carrying a file.
- Keep the boundary that makes a future distribution channel safe, while that channel stays closed.

**Non-Goals:**

- Authoring animation inside the product. Fixed in `clarifications.md` session 2026-09-13; the product supplies
  the standard and the frame, not a drawing tool.
- A public marketplace, third-party submission, content moderation, or provenance signing. Deferred by the
  decision-maker on 2026-09-13 and reserved in `model.md`.
- Changing how the pet renders, moves, or holds its frame rate. A pack changes which character is drawn.
- Deciding the persona or the visual style of the shipped packs. Those are `Q-PACK-1` and `Q-PACK-2`, and they
  are content for this framework to carry rather than inputs it waits on.

## Structure

Four components, each mapping to entities in `model.md`.

The **pack library** owns discovery and the store. It enumerates the two storage locations, reads manifests, and
holds `Pet Pack`, `Pack Library` and `Active Pack Selection`. It reads manifests only — never assets — so the
cost of listing does not grow with how large the characters are. It is the only component that writes
`contracts/pet-pack-store.sql`.

The **import path** owns validation and packaging, producing a `Pet Pack` from a supplied asset and an authored
persona. It validates against both contracts before anything is written, so a refusal leaves no partial pack on
disk.

The **pack resolver** owns the decision of what actually gets rendered. Given a pack and the shipped default, it
produces the `ResolvedPack` of `pet/contracts/pet-pack-manifest@1.0.0`: which capabilities come from this pack
and which are substituted. It is where `INV-PACK-06` lives, because it is the component that sees the claim and
the asset together.

The **persona composer** takes the active pack's `Persona Specification` and supplies it to the pet-agent as
advisory input. It is deliberately a separate component from everything above: it is the only one that touches
the prompt path, which makes `INV-PACK-03` a property of one boundary rather than a rule scattered across four.

Cross-domain interactions are exclusively through contracts. `pet/contracts/rive-state-machine@2.0.0` is how the
asset is driven. `sync/contracts/replicated-store-descriptor@0.1.0` is how the pack store joins replication, and
`sync/contracts/replication-protocol@0.1.0` carries it. `app` reads the library and writes the selection through
`pet/contracts/pet-pack-manifest@1.0.0` and holds no pack state of its own. `agent` receives a persona and never
sees a manifest, an asset, or the library.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `pet:setState` | Application → renderer | Pub-sub | `rive-state-machine.set-state.schema.json` | none | The rendered animation changes | A value outside a layer's set is dropped for that layer; the other still applies. No timeout: it is fire-and-forget |
| `pet:activatePack` | Application → renderer | Request-response | Pack identity, asset buffer, resolved capability set | `{ activated, reason? }` | The resident asset buffer is replaced | `ActivationRefusal`; the outgoing buffer is released only after the incoming one binds, so a refusal leaves the previous character on screen |
| `pet:packState` | Renderer → application | Request-response | none | Active pack, bound capabilities, current layer values | none | none |
| `pack:list` / `pack:import` / `pack:activate` / `pack:delete` | Settings surface → application | Request-response | `pet/contracts/pet-pack-manifest@1.0.0` §2 | As that contract states | Library reads; store writes on import, activate and delete | `ImportRefusal` / `ActivationRefusal`, each naming the failed condition |
| `GET /pet-packs/catalogue` | Client → backend | Request-response | Session | The supplied templates | none | Unreachable leaves existing templates usable and reports a refresh failure |
| Pack store records | Client ↔ backend | As `sync/contracts/replication-protocol@0.1.0` | Records of store `pet-pack` | As that contract | Packs appear and disappear across devices | As that protocol, under `contracts/pet-pack-store.descriptor.json` |

### Execution Boundaries & Isolation

Three boundaries are crossed, and only one of them is new.

The **renderer boundary** is inherited from `req-005-electron-rive-pet-render`. The animation asset is parsed by
the runtime inside the sandboxed rendering process. The library, the store and the resolver live in the
application process; the renderer receives a buffer and a resolved capability set and returns what it managed to
bind. A malformed or hostile asset therefore fails inside the sandbox, and the process holding the ledger and
the approval gate is unaffected. When the renderer's context is lost, it reinitialises and the application
re-sends the active pack — the recovery path `req-005-electron-rive-pet-render` already specifies, now carrying
a pack identity instead of a file path.

The **client/backend boundary** is inherited from `req-022-account-sync` and `req-020-backend-slice`. The
catalogue is a read; the pack store travels as replicated records. The backend stores and serves; it does not
open a pack, read a persona, or evaluate a manifest.

The **prompt boundary** is the one this change introduces, and it is one-directional by construction. The
persona composer writes into the pet-agent's advisory input. Nothing reads back from the prompt into the
library, the store, or the gate. This is why `INV-PACK-03` can be a structural claim rather than a filtering
claim: there is no path, not a blocked path.

### Trust Boundaries & Input Validation

Three untrusted entry points, each validated where it enters rather than where it is used.

A **supplied animation asset** is validated against `pet/contracts/rive-state-machine@2.0.0` before a pack
exists, then verified by digest at every subsequent load. Size is bounded at 5 MB and enforced at import, in the
store's own constraint, and at the backend — three places, because each is the last line for a different path in.

A **manifest** is validated against `pet-pack-manifest.schema.json`. The asset path is constrained to a single
file name with no separators, which closes path traversal at the shape rather than at resolution time. A
manifest whose major schema revision is unimplemented is refused whole rather than read partially.

**Persona text** is bounded in length and composed only into advisory positions. It is not sanitised, filtered,
or scanned for instruction-like phrasing, and this is deliberate: filtering would imply that unfiltered text
could do something, which would be the wrong claim to make. The correct claim is that the approval gate runs in
the application layer outside the model loop, per `docs/spec/constitution.md` principle II, so no prompt content
of any provenance reaches it.

A pack **arriving through replication** is the account's own data and is validated exactly as an imported one
is, for the same reason the ledger is fail-closed: the value of a check is in the case where the store is not
what it should be.

## Decisions

### D1 — A pack is a manifest plus assets, mirroring the connector shape

- **Choice**: model a pet as a manifest-described unit discovered by enumeration, rather than as a file the
  product knows about.
- **Rationale**: it makes adding the Nth pet a data operation, and it makes the failure modes nameable. The
  current arrangement cannot distinguish "authored for a different version" from "corrupt", because a bare file
  carries no claim to check against. A manifest is exactly the artifact that carries the claim.
- **Alternatives Considered**: a naming convention over files, where the file name encodes the pack — rejected
  because it cannot carry a capability declaration, a digest, or a persona, and a convention has no revision. A
  registry file listing all packs centrally — rejected because installing or removing a pack would then be an
  edit to a shared file, which two devices could conflict on for reasons unrelated to either pack.

### D2 — Raise `rive-state-machine` to 2.0.0 rather than extend 1.0.0 compatibly

- **Choice**: a MAJOR revision naming two layer inputs, `workStatus` and `locomotion`, replacing the single
  input `state`.
- **Rationale**: the contract's own versioning policy names renaming an input as MAJOR, and the rename is what
  makes the interface honest — `state` was a name that made sense when there was one layer and misleads when
  there are two. The numbering of the work status values is carried over unchanged, so an asset's authored
  transitions survive; what breaks is the descriptor and the channel name, which are the product's own and which
  no external asset yet depends on, because no external author could produce one.
- **Alternatives Considered**: keep `state` and add `locomotion` beside it, making the change MINOR — rejected
  because it would leave the interface permanently asymmetric, with one layer named after the concept of state
  in general and the other after what it actually is, and every future author would have to be told why.
  Leaving the contract at 1.0.0 and specifying the second layer only in prose — rejected because that is the
  current state, and it is the defect this change exists to fix.

### D3 — Degrade per capability, not per pack

- **Choice**: when a pack does not supply a capability, substitute the shipped default's behaviour for that
  capability alone and keep the pack for everything else.
- **Rationale**: the all-or-nothing fallback of `req-005-electron-rive-pet-render` made the cost of an
  incomplete pack total. An author who animates five work states but no walking loses their character
  entirely, which is a strong disincentive to author anything at all. Per-capability substitution makes a
  partial pack a usable pack, and the library discloses the substitution before activation so it is not a
  surprise.
- **Alternatives Considered**: refuse any pack that does not implement everything — rejected as above, and
  because it would make every future MINOR layer addition invalidate every existing pack. Substitute from
  another pack in the library — rejected because the result would depend on library order and no user could
  predict what their pet does; this is `INV-PACK-02`.

### D4 — The asset is the authority; the declaration is a claim

- **Choice**: where a manifest declares a capability the asset does not contain, treat the capability as absent
  and substitute.
- **Rationale**: a declaration is authored text and can be stale, mistaken, or copied from another pack. Binding
  on the strength of a claim the asset cannot honour would render nothing where the user was told something
  would render — a worse outcome than the substitution, and a harder one to diagnose.
- **Alternatives Considered**: refuse the pack for a false declaration — rejected because it punishes the user
  for the author's bookkeeping error in a case the product can handle silently and correctly. Trust the
  declaration and let the layer stay blank — rejected because a blank layer is indistinguishable from a bug.

### D5 — Persona lives in the pack, not in the product or the agent

- **Choice**: the persona specification is part of a pack and the persona in force is that of the active pack.
- **Rationale**: the living requirement already obliges every pet-visible string to come from a persona
  specification, and nothing owned one. Putting it in the pack is what makes "the user creates their own pet"
  mean a pet rather than a costume, and it is also what unblocks `Q-OQ-3`: the product no longer has to decide
  one persona before it can ship, because a persona became content.
- **Alternatives Considered**: keep the persona in the product and let packs supply visuals only — rejected by
  the decision-maker on 2026-09-13, and separately weak: every custom pet would speak in the product's voice,
  which is the half of a character that users actually notice. Keep the persona in the agent's configuration —
  rejected because it would let the persona and the character drift apart, with a cat speaking as last month's
  robot after an activation.

### D6 — Register a replicated store descriptor rather than extend the replication protocol

- **Choice**: the pack store joins replication as an instance of
  `sync/contracts/replicated-store-descriptor@0.1.0`, declaring `mutable`,
  `last-writer-wins-with-preservation`, and the `partial-transfer` capability that contract already defines.
- **Rationale**: the protocol was built with exactly this extension point, and using it means this change adds a
  store and edits no protocol — which is the same property principle VI asks of connectors. It also gets the
  `arriving` state for free: `partial-transfer` is what lets a manifest land before its asset, which is what the
  user sees as "still arriving" rather than as a pack that briefly exists and cannot be activated.
- **Alternatives Considered**: a dedicated asset-transfer endpoint outside the replication protocol — rejected
  because it would create a second path carrying account data with its own encryption, audit and deletion
  obligations, all of which the replication path already discharges. Inlining the asset into a configuration
  value — rejected because a 5 MB value in a store designed for settings would degrade every configuration read.

### D7 — Bound the pack at 5 MB rather than build a resumable blob channel

- **Choice**: refuse an asset over 5 MB at import, and keep replication of a pack a record-sized transfer.
- **Rationale**: no spike has measured a replication store carrying binaries, so the honest choice is to stay
  inside the envelope that was measured for records rather than to design against an unmeasured one. 5 MB is
  roughly ten times the shipped asset's budget, which leaves real room for a detailed character.
- **Alternatives Considered**: a generous ceiling with chunked, resumable transfer — rejected as scope that
  buys nothing until someone actually has a pack that needs it, and that would extend this change into the
  backend's transfer layer. No ceiling — rejected because it defers a storage-cost and sync-time risk to
  operations, and because `model.md` requires quantified budgets rather than an open end.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: discovery is eager and cheap — manifests are enumerated at startup and
  when the library changes, because reading them is small. Assets are lazy: exactly one is loaded, on
  activation. Registration is therefore implicit in the presence of a valid manifest; there is no install step
  that could succeed while leaving the pack unusable.
- **Isolation & Sandboxing**: the asset is parsed inside the sandboxed rendering process, as inherited from
  `req-005-electron-rive-pet-render`. The manifest is parsed in the application process but is a bounded
  document validated against a closed schema, and the one field that could name something outside the pack —
  the asset path — is constrained to a bare file name.
- **Resource Management & Eviction**: one asset buffer is resident at a time. On activation the incoming buffer
  is bound before the outgoing one is released, which is how the pet stays continuously visible across a swap as
  the living specification requires. Manifests stay resident; they are the library. A deleted pack releases its
  directory on every signed-in device by following the deletion through replication, rather than each device
  deciding independently that a pack has gone.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (Specific ➔ General)**: a capability the active pack does not supply — declared but absent, or never
  declared — binds from the shipped default pack for that capability alone. The pack's character stays on
  screen. One step only, per `INV-PACK-02`.
- **Tier 2 (Custom ➔ Built-in Default)**: a pack that cannot be presented at all — incompatible revision,
  missing artboard or state machine, unreadable buffer, digest mismatch, blend duration out of range — yields
  to the previously active pack if one is on screen, or to the shipped default pack at startup. The failing pack
  is marked in the library with its reason and left on disk, never deleted, so the user can see what was
  rejected.
- **Tier 3 (Degraded Safe-Mode)**: if every pack in the library fails, including the account's and the
  templates', the shipped default pack is presented and the failure is reported. It is not deletable and ships
  with every installation, so this tier always has something to present. If the rendering context itself is
  lost, it reinitialises and the application re-sends the active pack, without the process holding the ledger or
  the gate being affected.

The hierarchy terminates by construction rather than by convention: Tier 1 substitutes only from the shipped
default, and Tier 3's target is the one pack that cannot be removed.

## Complexity Tracking

None. Principle VII is engaged and satisfied rather than violated — an account pack is account data, it
replicates, and the user carries nothing. The `External Content Is Data` invariant is engaged and satisfied by
`INV-PACK-03` and D5's placement of the persona composer at a single one-directional boundary. Principle II is
preserved and is the reason the persona boundary holds. The `Reserved By Design` clause is satisfied: both
reserved slots in `model.md` state a phase, a rationale and an activation condition.

## Research

### R1 — Replication of a binary payload

- **Decision**: bound the payload at 5 MB and carry it through the existing replication path under the
  `partial-transfer` capability, rather than characterise or optimise the transfer.
- **Rationale**: the replication protocol was measured for records. Designing a transfer strategy against an
  unmeasured envelope would be a conclusion drawn from nothing; bounding the payload keeps the change inside
  what is known and leaves the measurement to whoever needs a larger one.
- **Alternatives**: chunked resumable transfer; content-addressed deduplication across accounts sharing a
  derived template.
- **Source / Verification Status**: UNVERIFIED. No spike has measured a replicated store carrying binaries;
  `req-022-account-sync` records that its own store sizing is likewise unmeasured. The 5 MB figure is a declared
  budget from `clarifications.md` session 2026-09-13, not a measurement.

### R2 — Whether a two-layer descriptor can be validated from asset headers alone

- **Decision**: validate the descriptor from the asset's own artboard headers where possible, and treat a
  declared-but-absent layer as a load-time substitution rather than a validation failure.
- **Rationale**: `req-005-electron-rive-pet-render` established that artboard and state machine presence is
  answered by reading the file's headers, which is why `ARTBOARD_NOT_FOUND` exists as a load-time refusal rather
  than a schema failure. Whether the presence of a specific named layer input is equally readable from headers
  was not part of that spike's questions, so the design does not assume it: the substitution path handles the
  case either way.
- **Alternatives**: require the author to supply a separate descriptor file alongside the asset, removing the
  need to read headers.
- **Source / Verification Status**: UNVERIFIED for the layer inputs specifically.
  `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) covers loading and swapping, not per-input
  introspection. Recorded as a measurement gap in `verification.md`.

### R3 — The prompt cost of a persona

- **Decision**: bound the character description at 1,200 characters and the manifest-and-persona document at
  64 KB, so a pack's contribution to every pet-agent request is predictable.
- **Rationale**: the persona is composed into requests the user pays for and waits on, and the provider matrix
  already shows latency that the acknowledgement line set exists to cover. An unbounded description would make
  a pack able to degrade the responsiveness of the product that hosts it.
- **Alternatives**: no bound, with a warning in the authoring surface.
- **Source / Verification Status**: UNVERIFIED as a threshold.
  `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) establishes the latencies the product is
  already working against; it measured no relationship between persona length and latency, and none is claimed.

## Migration & Rollback

This change touches a versioned contract, adds persistent data on both sides of the client/backend boundary, and
is marked BREAKING, so migration is mandatory rather than optional.

**The contract.** `pet/contracts/rive-state-machine` moves from 1.0.0 to 2.0.0. No pack authored outside the
product exists to migrate, because until this change no external author could produce one — which is precisely
why the revision is affordable now and would not be later. The shipped default asset is re-authored to declare
both layer inputs; its work status numbering is unchanged, so its existing transitions are carried rather than
rebuilt. The channel `pet:loadSkin` is replaced by `pet:activatePack`, and the input `state` by `workStatus`.
`evolution.md` holds the step-by-step form of this.

**The stores.** The device gains the relations in `contracts/pet-pack-store.sql` within the existing Local Store
file, whose shape-version marker advances one step as `req-013-sqlite-ledger` requires. The backend gains no
table: the pack store is rows in the generic replicated relation, admitted by registering
`contracts/pet-pack-store.descriptor.json`.

**Existing installations.** A device that has only ever had the shipped asset gains a library containing the
shipped default pack, active. Nothing is lost, because there was nothing a user could have created.

**Rollback.** Reverting to a build implementing contract major 1 leaves account packs in the store declaring
`targetContractMajor: 2`. They are refused with `INCOMPATIBLE_REVISION` — which is exactly what that refusal was
specified for — and the shipped default pack is presented. Packs are not deleted by the rollback, so rolling
forward again restores them. This is the concrete reason the incompatibility refusal has to be distinguishable
from damage in the user interface: after a rollback it is the expected state, not a fault.

## Risks / Trade-offs

- [A pack's persona is the first authored text on the prompt path, and the product's own decision-makers may
  later be tempted to let it carry more — instructions, tool hints, rule preferences] → the boundary is stated
  as a requirement with scenarios, not only as a design note, so widening it is a specification change that must
  be argued rather than a quiet addition.
- [Replication of a binary payload is unmeasured, and a library of many packs multiplies an unmeasured cost] →
  bounded per pack at 5 MB and recorded as a measurement gap; a library cap is deliberately not invented, since
  inventing a second unmeasured number would not reduce the risk.
- [Per-capability substitution can produce a pet that looks composed of two characters — one pack's body with
  the default's gait] → the library discloses which capabilities a pack supplies before activation, so the user
  chooses it knowingly; the alternative, refusing the pack, was rejected in D3 for worse reasons.
- [The catalogue is served by the backend, so a backend outage could appear to empty the user's pet choices] →
  templates already on the device stay listed and usable, and the surface reports a refresh failure rather than
  an empty catalogue.
- [`5 MB` will look arbitrary to whoever implements this] → it is recorded as a declared budget with its
  derivation and its UNVERIFIED label in three places, so it can be raised by measurement rather than by
  argument.

## Open Questions

- Whether built-in templates should eventually be delivered through the update channel as packaged resources or
  fetched individually from the catalogue as the user selects them. Both satisfy every requirement here and the
  choice affects installer size against first-use latency; it can be settled when the catalogue has more than a
  handful of entries, and settling it changes no specification, contract, or acceptance criterion in this
  change.

# Design: account-owned replication

## Context

The product exists today as a device-bound design across twenty spikes. Four of them constrain this work
directly and are the only VERIFIED ground it stands on.

`spikes/SP-20-backend-slice/REPORT.md` §1 Q1 established the backend shape: Fastify with TypeScript over
PostgreSQL, Google Sign-In verified server-side, a 15-minute access token and a 30-day refresh token stored as a
SHA-256 hash, with `account`, `device`, `session` and `invite_allowlist` tables. A `device` row therefore already
exists, created at sign-in; this change gives it a lifecycle rather than inventing it. The same report's §0
records 200 concurrent connections at a 0.00 percent error rate, and RISK-060 records that the same load pushed
median database latency to roughly 1.5 seconds on a development machine.

That spike also proved, by dumping the real database, that the server held no connector token and no work
content. **This change deliberately reverses that property**, which is the substantive cost recorded in the
proposal and in RISK-062.

`spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 measured the local ledger: 12.36 MB for 1,800 jobs and 30.83 MB for
4,500 jobs over a 90-day retention, with detail queries at p50 between 0.13 ms and 0.25 ms on both ext4 and NTFS.
§1 Q2 established append-only enforcement in the store itself, and §1 Q6 established the migration strategy for an
immutable ledger whose schema changes. The local store is SQLite through `better-sqlite3`, rebuilt against the
Electron ABI.

`spikes/SP-11-secure-storage/REPORT.md` §0 settled device-local credential storage: Electron `safeStorage`
(DPAPI with AES-256-GCM) holding ciphertext in the app's own store. Windows is verified; **macOS is explicitly
not** — the spike deferred it. The Windows Credential Manager was rejected on a hard 2,560-byte blob limit, which
matters here because replication material is one more thing that must fit.

`spikes/SP-21-ask-user-offline/REPORT.md` established the offline command queue, and RISK-061 its contradiction
hazard.

The constraint that shapes every decision below is not technical. The decision-maker ruled that the user carries
no secret between machines, so the service holds the keys, and the privacy boundary is operational. A design that
quietly re-introduces a user-held secret to improve the security story would be solving a problem that was
already decided.

## Goals / Non-Goals

**Goals:**
- Replicate the account's stores between each device's local working copy and the backend, so that sign-in alone
  restores everything on a new or replacement device.
- Preserve the append-only guarantee of principle III across replicas, not only within one store.
- Keep the local store authoritative for the running device, so offline behaviour and crash recovery are
  unchanged.
- Make the replicated store set an extension point: adding a store registers a descriptor and changes no
  protocol.
- Bound what a device can do once it can no longer be reached.

**Non-Goals:**
- A general-purpose synchronisation engine. This replicates the specific stores this product has, under rules
  each store declares. The proposal names generalising it as a rabbit hole.
- End-to-end encryption. Evaluated and rejected on 2026-09-12 with the constraint that settled it.
- Moving job execution off the creating device. Jobs stay pinned, which keeps the in-process object lock and rate
  queue measured in `req-015-concurrency-coordinator` in-process and unmeasured work off this change.
- Real-time collaboration semantics. Two devices are the same user, not two users; the conflict rules are sized
  for occasional offline divergence, not for concurrent editing.

## Structure

| Component | Responsibility | Model entities | Execution site |
| --- | --- | --- | --- |
| Replication Coordinator | Drives handshake, pull, push and cursor advancement per store; owns retry and backoff | Replication Checkpoint, Lease | Electron main process |
| Store Registry | Holds the registered Store Descriptors; refuses an unregistered or malformed store | Store Descriptor, Replicated Store | Electron main process, mirrored server-side |
| Local Working Copy | The SQLite store the product reads and writes; gains replication metadata columns | Local Working Copy, Record, Device Sequence | Electron main process |
| Envelope Codec | Wraps a record's payload for transit and unwraps on arrival; never touches replication metadata | Record, Encryption Key | Electron main process |
| Device Identity | Holds this device's identifier and replication material in `safeStorage` | Device | Electron main process |
| Replication Service | Accepts and serves envelopes; advances cursors; applies each descriptor's declared rule | Record, Replication Checkpoint | Backend, Fastify |
| Key Custody | Wraps and unwraps per-account data keys; emits an audit record for every use | Encryption Key, Access Audit Record | Backend, isolated from request handlers |
| Device Registry Service | Persists the registry; enforces revocation on every request | Device, Device Registry | Backend |
| Sync Surface | Presents sync state, the device list and revocation | — | Renderer process |

Cross-domain interaction is exclusively through contracts: `sync/contracts/replication-protocol@0.1.0`,
`sync/contracts/replicated-store-descriptor@0.1.0`, `sync/contracts/device-registry@0.1.0`. The `ledger`,
`connector` and `platform` capabilities are reached through their own contracts as recorded in `model.md`
Relations; no component here reads another domain's internal state.

The Replication Coordinator lives in the Electron **main** process, not the renderer. Two reasons decide it: the
local SQLite store and `safeStorage` are main-process resources, and replication must continue while every window
is closed, which the `app` capability requires by keeping the product running in the tray.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `replication.handshake` | Client main → Backend | Request-Response | `Handshake` | `HandshakeResult` | Issues a Lease; records the device's descriptor set | Terminal on `DEVICE_REVOKED` / `ACCOUNT_DELETED` → begin erasure. `PROTOCOL_VERSION_UNSUPPORTED` → stop, report update required. Timeout → retry with backoff, continue against local copy |
| `replication.pull` | Client main → Backend | Request-Response, cursor-resumable | `PullRequest` | `PullResult` | Advances this device's cursor for one store; decrypts server-side, so emits an Access Audit Record | `CURSOR_INVALID` → restart that store from `null`; other stores unaffected. `KEY_UNAVAILABLE` → fail the request, no plaintext path. Timeout → resume from last cursor, never from the start |
| `replication.push` | Client main → Backend | Request-Response | `PushRequest` | `PushResult` | Writes records; may append a Superseded Version; advances cursor | `APPEND_ONLY_VIOLATION` → nothing written, attempt recorded. `LEASE_EXPIRED` → re-handshake then retry. Partial batch failure rejects the record, not the batch |
| `replication.changes` | Backend → Client main | Stream | — | `RecordEnvelope` batches + `Cursor` | None beyond delivery | Stream loss is not an error: fall back to `replication.pull` from the last cursor. No correctness depends on delivery |
| `registry.list` / `registry.revoke` | Client main → Backend | Request-Response | — / `RevokeRequest` | `RegistryView` / `RevokeResult` | Revocation withdraws sessions server-side | `CONFIRMATION_REQUIRED` is a calling-surface defect, never retried by appending the field |
| `sync:state`, `sync:devices`, `sync:revoke` | Renderer ↔ Main | Request-Response over Electron IPC | Plain state objects | Plain state objects | `sync:revoke` initiates a registry call after the user confirms | Renderer never reaches the backend or the store directly; main validates every argument |

### Execution Boundaries & Isolation

Four boundaries carry weight in this design.

**Renderer ↔ Main.** The renderer owns no account data, holds no session, and reaches no store. It asks main for
state and sends user intent back. A renderer compromise — the process that renders untrusted connector content —
therefore cannot read the ledger or push a record. If the renderer crashes, replication continues; the window
reopens onto current state.

**Client ↔ Backend.** The network boundary. The client is authoritative for its own work; the backend is
authoritative for ordering, resolution, the registry and the lease. If the backend is unreachable, the device
continues entirely against its local copy — this is the property principle VII and the offline requirements
depend on, and it is why no product operation blocks on a replication call.

**Request handlers ↔ Key Custody.** Inside the backend. Handlers receive envelopes and route them; only the
custody path unwraps a data key, and it emits an Access Audit Record for every use. The boundary is what makes
the claim in principle VII — key access confined to the replication path — a structural statement rather than a
convention. RISK-063 records honestly that nothing prevents a future feature from calling across it; the audit
record is the detection, not the prevention.

**Job execution ↔ Replication.** A replicated record is data describing work done elsewhere. The Replication
Coordinator writes records into the local store and never hands one to the agent loop, the approval evaluator or
a connector adapter. This is what makes job pinning true by construction rather than by a check.

Recovery: if the Coordinator crashes, cursors are durable, so it resumes rather than restarts. If the main
process dies mid-erasure, erasure resumes before any account data is readable, which the `sync` spec requires.

### Trust Boundaries & Input Validation

Untrusted entry points, in order of exposure:

1. **Records arriving through replication.** Written by another device, which may be compromised, revoked while
   offline, or running an older build. Every envelope is validated on arrival: the store must be registered, the
   `originDevice` must be enrolled in this account per the registry, `originSequence` must not conflict with a
   position already held from that device, and the store's `encryptionClass` must admit what the envelope
   implies — a non-zero `version` on an append-only store is refused. A replicated record never causes a tool
   call.
2. **Connector-fetched content and user input inside payloads.** Unchanged by this design and still data, never
   instructions, per the constitution's External Content Is Data section. Passing through replication grants
   content no authority it lacked at ingestion.
3. **Renderer IPC arguments.** Validated in main. A `deviceId` from the renderer is a string to be looked up, not
   a capability.
4. **A device's own Lease claim.** Not trusted by the backend at all. The Lease bounds local behaviour; the
   backend enforces revocation independently, so a device that lies about its lease gains only the right to keep
   using an authorisation the backend has already stopped honouring.

Rate limiting already exists on authentication and broker endpoints per the `backend` capability; the replication
endpoints join it, since they are now the highest-volume authenticated surface.

## Decisions

### D1 — Per-store log replication with durable cursors, not a general sync engine
- **Choice**: each store replicates as an ordered log of immutable envelopes; a device holds a durable cursor per
  store and exchanges by pulling from and pushing to it. Mutable records replicate as versioned envelopes in the
  same shape, so one mechanism serves both store classes.
- **Rationale**: it makes resumability free, which the enrolment requirement needs — an interrupted transfer
  continues from its cursor rather than restarting, and a per-store cursor (INV-SYNC-09) stops one large store
  from dragging the others. It also keeps the backend from needing to understand payloads, which is what makes
  the "serves replication without executing" requirement mechanically true. The product's own ledger is already
  an append-only log measured in SP-12, so the dominant store fits the mechanism natively rather than being
  adapted to it.
- **Alternatives Considered**:
  - *A full CRDT-based sync engine.* Rejected: it buys automatic merge of concurrent edits, which this product
    barely needs — two devices are one user, and the Q-1 decision already settled that a deterministic rule with
    preservation is acceptable. It costs a per-type merge semantic for every store and a substantially larger
    metadata footprint on a payload the backend must not read. The proposal names building a general sync engine
    as a rabbit hole; this is that rabbit hole.
  - *Operational transformation.* Rejected: designed for concurrent editing of shared documents with a central
    transform authority that understands content. The backend must not understand content.
  - *Whole-store snapshot replacement.* Rejected: simplest to build, and fatal — replacing a ledger store with
    another device's snapshot is last-writer-wins by another name, which RISK-065 identifies as silent history
    loss.

### D2 — Ordering by per-device sequence plus a version vector
- **Choice**: each record carries `originDevice`, a monotonic `originSequence` (INV-SYNC-05), and a
  `causalPosition` holding the per-device high-water marks the writer had observed. Ordering is causal first,
  then a stable tie-break on `(originDevice, originSequence)`. `recordedAt` is carried and displayed and never
  consulted for ordering (INV-SYNC-06).
- **Rationale**: it answers RISK-068 without trusting any clock, and the tie-break is total, so every replica
  derives the same order from the same records with no coordination. Vector size is bounded by the number of
  enrolled devices, which for this product is a handful, not a cluster.
- **Alternatives Considered**:
  - *Lamport timestamps.* Rejected: cheaper and smaller, but they lose the distinction between "concurrent" and
    "ordered". This design needs that distinction, because a genuine concurrency is what triggers preservation of
    a superseded version; collapsing it would mean either preserving on every edit or silently discarding some.
  - *Hybrid logical clocks.* Rejected for now: they keep the vector small and stay close to wall-clock for human
    reading, which is genuinely attractive. They also re-admit clock skew into ordering by construction, bounded
    but not eliminated. With a handful of devices the vector costs little, so the stronger property is affordable.
    Recorded as a candidate if SP-22 finds vector growth to matter.
  - *Server receive order alone.* Rejected as the ordering basis: it is exactly right for deciding *which* mutable
    version wins (Q-1 and D4) and wrong for ordering a ledger, because two devices offline for different periods
    would have their interleaved history rewritten by the accident of who reconnected first.

### D3 — Envelope encryption: per-account data key, service-held, wrapped by a custody key
- **Choice**: each record's payload is encrypted client-side under a per-account data key; the data key is held
  wrapped by a custody key the backend controls, and unwrapped only inside the Key Custody path, which emits an
  Access Audit Record per use (INV-SYNC-08). Replication metadata — device, sequence, causal position, recorded
  time, store — stays outside the ciphertext.
- **Rationale**: it satisfies "encrypted at rest under service-managed keys" while letting the backend order and
  resolve without decrypting anything, which is what the `backend` requirement about not interpreting content
  needs in order to be checkable. Per-account keys also make the reserved slot in `model.md` — narrowing key
  scope — a change of custody policy rather than a re-encryption of everything.
- **Alternatives Considered**:
  - *Database-level transparent encryption only.* Rejected: it protects a stolen disk and nothing else. Every
    request handler would see plaintext, so "key access confined to the replication path" would be untrue the
    moment it was written, and RISK-062's compensating controls would be decorative.
  - *Column-level encryption inside PostgreSQL.* Rejected: the decrypting party is then the database session
    shared by all handlers, which has the same failure as above with more machinery.
  - *One service-wide key instead of per-account keys.* Rejected: operationally simpler, but a single compromise
    reaches every account, and it forecloses the per-account narrowing that `model.md` reserves against RISK-062
    and RISK-067.
  - *Client-held key.* This is end-to-end encryption. Rejected by the decision-maker on 2026-09-12, for the
    recorded reason that recovery must work from sign-in alone on a replacement device.

### D4 — The backend arbitrates conflicts; the client never decides a winner
- **Choice**: resolution happens server-side, at the point a push is accepted. For
  `last-writer-wins-with-preservation` the server's receive order decides, and the displaced version is appended
  to the descriptor's `supersededTarget` in the same operation. For `append-and-reconcile` every record survives
  and re-delivery is idempotent.
- **Rationale**: "receive order" needs a single observer to be well defined at all, and one arbiter means two
  devices cannot reach different conclusions from the same records. Appending the superseded version in the same
  operation is what stops a crash between "replace" and "preserve" from losing the user's edit — the case that
  would turn the Q-1 guarantee into a lie precisely when it is needed.
- **Alternatives Considered**:
  - *Client-side resolution with server as dumb store.* Rejected: two clients resolving independently can reach
    different currents, and no receive order exists to appeal to.
  - *Surface every conflict to the user.* Rejected — and this was Q-1's third option, declined by the
    decision-maker. It leaves a rule or connector unusable until the user acts, on a product whose point is to
    take work away from the user.
  - *Plain last-writer-wins.* Rejected: destroys a user edit silently. The preservation half is not a refinement;
    it is what makes the rule admissible under principle III at all.

### D5 — The Lease is a derived server-issued bound, not a credential
- **Choice**: every successful handshake or exchange issues a Lease with an expiry bound. A device may use
  replicated connector authorisation only while its Lease is current; it cannot extend its own (INV-SYNC-07). An
  expired Lease blocks `replication.push` and connector use but never `replication.pull`.
- **Rationale**: it converts RISK-066's unbounded window into a stated bound, and the asymmetry between push and
  pull is deliberate — a device must be able to catch up at exactly the moment its lease has lapsed, or expiry
  would be unrecoverable without re-enrolment.
- **Alternatives Considered**:
  - *Rely on the existing 15-minute access-token TTL.* Rejected as the mechanism, though it is the obvious
    anchor: SP-20 §1 Q1 verified that TTL, and a refresh at 30 days means a device can hold a valid session far
    longer than it has replicated. Session liveness and replication liveness are different questions.
  - *Online check per connector call.* Rejected — Q-3's third option, declined. It makes connector work
    impossible offline, contradicting behaviour the proposal states is load-bearing.
  - *No bound at all; server-side invalidation only.* Rejected — Q-3's second option, declined. It is not wrong
    about the server being the real defence, but it leaves the local window unbounded and unverifiable, which is
    RISK-066 as written today.

### D6 — Extend the existing SQLite store rather than adding a replication store
- **Choice**: add replication metadata to the existing local store and a per-store cursor table, following the
  migration strategy SP-12 §1 Q6 established for an immutable ledger whose schema changes. No second local
  database.
- **Rationale**: the ledger's append-only enforcement, crash recovery and query performance are already measured
  (SP-12 §1 Q2, §1 Q4, §1 Q5) and a second store would duplicate all of it while introducing a consistency
  problem between the two at exactly the point — crash recovery — where the existing evidence is strongest.
- **Alternatives Considered**:
  - *A separate replication queue database.* Rejected: two stores that must agree about what has been replicated
    is a distributed-consistency problem created inside one process for no gain.
  - *Rebuild the local store around the replication model.* Rejected: discards four spikes' worth of verified
    behaviour to re-derive it.

### D7 — Replication material joins `safeStorage`, with the 2,560-byte lesson applied
- **Choice**: device identity and replication material are held through Electron `safeStorage`, alongside
  connector authorisation, per SP-11 §0. Material is sized so that no single secret approaches a platform blob
  limit, and ciphertext lives in the app's own store rather than an OS credential store.
- **Rationale**: SP-11 rejected the Windows Credential Manager on a hard 2,560-byte limit; a design that puts a
  growing replication key set into a fixed-size slot repeats a failure already paid for.
- **Alternatives Considered**:
  - *A file in the app data directory.* Rejected: the `platform` requirement forbids plaintext credentials
    anywhere on the device.
  - *Deriving material from the session token.* Rejected: session tokens rotate on refresh, and material tied to
    them would be lost at every rotation.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: eager registration at startup. The Store Registry enumerates registered
  Store Descriptors before the first exchange, and the descriptor set is carried in `replication.handshake` so
  both sides compare them before a record moves. There is no runtime hot-registration: a store that appears after
  the handshake waits for the next one. This is deliberate — a store joining mid-exchange would replicate under a
  descriptor the other side has not seen.
- **Isolation & Sandboxing**: stores are not code and are not sandboxed; a descriptor is declarative data, not an
  executable plugin, so it carries no execution risk. The isolation that matters is the payload boundary: the
  Envelope Codec is the only component that sees plaintext on the client, and the Key Custody path is the only
  one on the backend.
- **Resource Management & Eviction**: a store removed from the registry stops replicating at the next handshake;
  its cursor is retained until its records are erased, so that re-registration resumes rather than re-transfers.
  Records are evicted only by retention expiry or deliberate user deletion — never by capacity pressure, because
  a record dropped for space breaks append-only as surely as one overwritten.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (Specific ➔ General)**: a store whose descriptor the other side does not recognise ──> that store is
  excluded and every other store continues replicating. The device reports itself as not fully current and names
  what is not replicating, rather than reporting success. Equally, loss of the `replication.changes` stream ──>
  fall back to polling `replication.pull` from the last cursor; no correctness depends on the stream.
- **Tier 2 (Custom ➔ Built-in Default)**: **there is no descriptor fallback, deliberately.** A missing or
  malformed descriptor is refused, not defaulted. This is the one place where the usual tier-2 pattern is wrong:
  the default that is convenient for a mutable store — last-writer-wins — is the one that destroys history in an
  append-only store, so a "safe built-in baseline" does not exist. Refusal at registration is a visible failure;
  a default would be an invisible one at conflict time. What does fall back is the *cursor*: an invalid cursor
  restarts that store's transfer from the beginning, which is safe because a full transfer reconciles against
  what is already held rather than replacing it.
- **Tier 3 (Degraded Safe-Mode)**: total replication failure — backend unreachable, keys unavailable, protocol
  MAJOR mismatch ──> the device continues in full local operation against its working copy. Jobs run, the ledger
  is written, approvals are evaluated, undo works. The product reports that the account's devices are out of
  step. This is not a crippled mode bolted on for failures; it is the pre-amendment product, which is why it is
  credible. The one capability actually lost is the use of replicated connector authorisation once the Lease
  expires, and that loss is stated to the user as a reason to reconnect rather than as a connector error.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternatives Rejected Because |
| --- | --- | --- |
| None | — | — |

Two candidates were examined and are not violations. **The backend now holds user work content**, which would
have violated principle VII at 1.0.0 — but this change is the amendment that redefines it, and 2.0.0 permits it
under stated operational controls. **Ledger records now cross a network and are resolved by a server**, which
touches principle III — preserved, not violated: INV-SYNC-04 makes the destructive rule unexpressible for an
append-only store, so replication cannot remove a record. The design schema was mandatory here under Rigor By
Risk, which forces it for anything touching the client/backend boundary or the replication path.

## Research

### R1 — Vector-clock growth against the real device population
- **Decision**: carry a full version vector per record; revisit if growth matters.
- **Rationale**: the vector is bounded by enrolled devices, which for a personal desktop product is a handful.
  At that size the metadata cost is negligible against a per-job payload of roughly 7 KB, derived from SP-12 §1 Q5 (12.36 MB across 1,800 jobs).
- **Alternatives**: hybrid logical clocks (smaller, re-admits bounded skew); Lamport timestamps (smallest, loses
  concurrency detection, which D2 needs).
- **Source / Verification Status**: **UNVERIFIED**. The device-count assumption is untested; no spike has
  measured a multi-device account. Assigned to SP-22.

### R2 — The Lease expiry period
- **Decision**: not fixed here.
- **Rationale**: it is a threshold, and the Evidence Discipline section forbids a hard threshold without a
  VERIFIED source. The requirement states that a bounded period exists and that expiry stops replicated
  authorisation; the number is a separate, sourced decision. The natural anchor is the 15-minute access-token TTL
  verified in SP-20 §1 Q1, but session liveness and replication liveness are different questions (D5), so
  inheriting the number would be borrowing a measurement taken for something else.
- **Alternatives**: inherit the access-token TTL; make it configurable per account; derive it from observed
  replication frequency.
- **Source / Verification Status**: **UNVERIFIED**. Assigned to SP-22; RISK-066.

### R3 — Encrypted-store cost on the backend
- **Decision**: envelope encryption with per-account data keys (D3), accepting unmeasured overhead.
- **Rationale**: the alternatives were rejected on boundary grounds rather than cost, so the overhead is a
  consequence to measure rather than a variable to optimise. RISK-060 is the warning: 200 concurrent writers
  already pushed median latency to about 1.5 seconds on a development machine, and that was *without* encryption
  or replication volume.
- **Alternatives**: database-level encryption (rejected, D3); no encryption at rest (rejected by principle VII).
- **Source / Verification Status**: **UNVERIFIED**. `spikes/SP-20-backend-slice/REPORT.md` §0 and RISK-060 give
  the pre-replication baseline only. Assigned to SP-22.

### R4 — Account-total storage and transfer volume
- **Decision**: no budget stated.
- **Rationale**: the only measured figure is per device — 12.36 MB at 1,800 jobs over 90 days
  (`spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5). The account total is the reconciled union across devices, and
  transcripts were added to the replicated set by Q-4 and were never part of what SP-12 measured. Stating a
  budget from this would be inventing one.
- **Alternatives**: extrapolate from SP-12 (rejected — wrong unit and incomplete membership); apply the 44.5
  percent compression SP-12 measured but declined (reserved in `evolution.md` pending sizing).
- **Source / Verification Status**: **UNVERIFIED**. Assigned to SP-22; RISK-069.

### R5 — macOS secure storage
- **Decision**: assume `safeStorage` parity and verify before macOS release.
- **Rationale**: `spikes/SP-11-secure-storage/REPORT.md` §0 verified Windows and explicitly deferred macOS. This
  change adds replication material to what `safeStorage` holds, so it inherits that gap and slightly widens it.
- **Alternatives**: verify macOS within SP-22; defer to a macOS-specific spike.
- **Source / Verification Status**: **UNVERIFIED on macOS**, VERIFIED on Windows. Pre-existing gap, not created
  here.

### R6 — Enrolment duration on a replacement device
- **Decision**: resumable transfer by cursor, with the device reporting progress and never presenting partial
  state as complete.
- **Rationale**: the structural requirement is known even though the duration is not — neither side may need the
  whole account state resident at once, which is why cursors are per store and per device.
- **Alternatives**: full transfer before the product becomes usable; usable-while-restoring with progressive
  availability. The second is preferable if the measured duration is long enough to matter.
- **Source / Verification Status**: **UNVERIFIED**. Assigned to SP-22.

## Migration & Rollback

**Migration from device-bound storage (constitution 1.0.0 → 2.0.0).**

1. A device updating to a replication-capable build keeps its existing local store untouched. Nothing is
   exported, and the user is asked for nothing.
2. On the first sign-in after update, the device enrols. Its existing ledger, rules, configuration and connector
   authorisation are stamped with this device's identifier and a sequence position, then pushed as the seed of
   the account's replicated set. The local schema change follows the migration strategy SP-12 §1 Q6 established
   for the immutable ledger.
3. If a second device enrols with its own pre-existing local store, both seeds replicate. The ledger stores
   reconcile by append-and-reconcile, so neither device's history is lost — this is the case that would be
   destroyed by any last-writer-wins path, and it is why the rule is foreclosed at the descriptor rather than
   chosen at merge time.
4. Connector authorisation moves from device-scoped to account-scoped. Where two devices hold authorisations for
   the same connector, they are mutable records and resolve by D4, with the displaced one preserved.

**Rollback.**

Rollback is bounded by one asymmetry, and it is the reason this section is not symmetrical: replication is
additive on the client. A device's local store remains complete and authoritative throughout, so reverting a
device to a pre-replication build loses replication but loses no data that device holds.

- *Before any beta device has replicated*: destroy the server-side replicated store and its keys, revert the
  backend, and ship a client build with replication disabled. Nothing is lost, because every device still holds
  its own complete store. The contracts are `draft`, so no compatibility obligation exists.
- *After devices have replicated*: reverting is a data-loss event for one specific case — work created on device
  B and never seen by device A. Rollback therefore requires each enrolled device to complete one final pull
  before the server-side store is destroyed, and a device that cannot be reached cannot be made whole. This is
  the point at which rollback stops being free, and it arrives the moment a second device enrols, not at general
  release.
- *Partial rollback of the protocol across a MAJOR*: not offered. A device that misunderstands a resolution
  outcome can destroy data without knowing it, so the contracts refuse partial exchange across a MAJOR and the
  device reports that an update is required.

**Legacy data**: no data is discarded by this migration. Pre-amendment local stores become account seeds rather
than being replaced.

## Risks / Trade-offs

- [A backend compromise now exposes user work content — RISK-062] → Accepted deliberately by the decision-maker;
  end-to-end encryption was rejected because recovery must work from sign-in alone. Mitigated structurally by D3:
  envelope encryption with a custody path that is the only holder of plaintext keys, and an inescapable audit
  record (INV-SYNC-08).
- [The key path widens over time into support tooling, analytics or model input — RISK-063] → No mechanism
  prevents it; the boundary in D3 and the audit record are detection, not prevention. Stated honestly rather than
  overclaimed.
- [Account compromise now yields the entire history across all devices — RISK-064] → The device registry exists
  so the user can see and revoke what the gate admitted; multi-factor authentication at the identity provider is
  the real control and sits outside this design.
- [Replication silently deleting ledger history — RISK-065] → Made unexpressible: INV-SYNC-04 is enforced in the
  descriptor schema, so an append-only store cannot declare a destructive rule, and `APPEND_ONLY_VIOLATION`
  refuses the attempt at the wire.
- [A revoked device keeps operating offline — RISK-066] → Bounded by the Lease (D5), with backend enforcement as
  the first line and local erasure as the second. The period is unmeasured (R2).
- [Clock skew reordering replicated records — RISK-068] → Removed as a mechanism by D2; wall-clock time
  participates in no ordering computation (INV-SYNC-06).
- [Encryption plus replication volume degrading backend latency past RISK-060's 1.5-second baseline] → Unmeasured
  (R3). The mitigation available now is architectural: resolution and ordering read only metadata, so the hot
  path does not decrypt.
- [Enrolment on a replacement device taking long enough to feel broken] → Resumable transfer and explicit
  progress (R6); partial state is never presented as complete.
- [macOS secure storage unverified while replication material is added to it — R5] → Pre-existing gap from SP-11,
  inherited. Must be closed before a macOS release, not before this design is accepted.

## Open Questions

These can be postponed without altering the specs, the approach or the tasks. Everything that would alter them
was resolved in `clarifications.md` before `specs` was written.

- Whether the Lease period should be configurable per account or fixed product-wide. Either way the requirement
  holds that a bounded period exists; only the number and its ownership differ, and R2 must produce the number
  first.
- Whether the device registry should show a device's approximate location or network origin alongside its label.
  It would help a user recognise an unfamiliar device, and it is additional personal data being retained. A
  product-owner call, and a MINOR addition to `device-registry` whenever it is made.
- Whether retention should be configurable per store rather than inherited from the ledger's period. The
  descriptor already carries a per-store `retention`, so this is a question about what the product exposes, not
  about what the contract can express.
- Whether a device should be able to request an immediate replication rather than waiting for the coordinator's
  schedule. A convenience; the `app` requirement already forbids making the user trigger replication for it to
  happen at all.

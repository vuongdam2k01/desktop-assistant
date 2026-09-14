## Context

The product holds four groups of credential on the device: connector authorisations, the authorisation clients
users supply themselves, model-provider credentials, and the account session together with the material a device
uses to replicate. Where those rest decides what an attacker with file access gets, what a second person with an
account on the same machine can read, and whether removing the product really removes them. `proposal.md` states
why that is worth a change of its own; this file states how it is built.

Three constraints are already settled and are not reopened here. `spikes/SP-11-secure-storage/REPORT.md`
measured the mechanism on Windows and eliminated two candidates by measurement rather than by preference.
`req-013-sqlite-ledger` established a device-local store that refuses modification and deletion, which a
credential — refreshed on every token renewal, deleted on every disconnect — cannot live in.
`req-022-account-sync` changed what happens when a device cannot read what it stored: the account holds a copy,
so the answer is replacement rather than asking the user to reconnect everything by hand. The proposal was
harvested before that amendment and carries a note where its original wording said otherwise; this design
follows the amended behaviour.

What remains open is macOS. The spike measured Windows end to end and the macOS branch is deferred by decision,
so every assertion below is marked for which platform it holds.

## Goals / Non-Goals

**Goals:**
- One service through which every credential is written, read, grouped and erased, so no other component
  encrypts, decrypts or stores one.
- A credential value that never crosses the process boundary and never rests in plain text on disk.
- Erasure that finishes — on disconnect, sign-out, revocation, account deletion and uninstall — including when
  it is interrupted.
- An unreadable credential that is replaced rather than reported to the user as a broken connection.
- Adding a credential-holding capability by registering a class, without editing the store or anything that
  erases, restores or displays credentials.

**Non-Goals:**
- Key rotation or product-held key material. The product holds no key; the operating system does. The reserved
  slot in `model.md` records what would activate this.
- Protecting a credential from the operating-system user who stored it. That user can read it by running the
  product, and no design here changes that.
- The macOS implementation beyond the structure that will hold it. The keychain permission prompt is unmeasured
  and is carried as Q-1 in `clarifications.md`.
- Server-side credential storage. The account's encrypted copy belongs to `req-022-account-sync` and
  `req-020-backend-slice`.

## Structure

One service in the process that makes tool calls owns the credential store. It is reached only through
`platform/contracts/secure-storage@0.1.0`, and it is composed of six parts, each mapping onto an entity in
`model.md`.

| Component | Responsibility | Model entity |
| --- | --- | --- |
| Class Registry | Holds registered Credential Class Descriptors, matches an incoming key to exactly one class, refuses overlapping patterns at registration | Credential Class |
| Key Parser | Splits a key into domain, category, identity and optional field; refuses a key that carries no group | Credential Key |
| Cipher Gateway | The only caller of the operating system's secure-storage facility: encrypt on write, decrypt on read, report availability | Encryption Facility |
| Entry Table | The credential store file: one row per entry holding key, ciphertext, last-updated time and declared metadata | Credential Store, Credential Entry |
| Erasure Runner | Performs scoped and whole-store erasure, records an outstanding erasure, resumes one at start before any other use | Erasure |
| Restoration Coordinator | Marks an entry unreadable on a failed read, raises it to the surfaces, and takes the replacement route its class declares | Unreadable Entry |

Cross-domain interaction is through contracts only. `connector` writes and reads authorisations through
`platform/contracts/secure-storage@0.1.0` and declares its class through
`platform/contracts/credential-class-descriptor@0.1.0`. `sync` supplies replacements for replicating classes
through `sync/contracts/replication-protocol` and learns revocation through `sync/contracts/device-registry`;
the store does not call the backend and does not know what a lease is. `ledger` is not involved at all: no
credential value or fragment reaches `ledger/contracts/ledger-record`, which is the claim
`ledger/contracts/ledger-store@0.1.0` already makes about its own text search.

The credential store file sits beside the ledger store file in the application's per-user data directory and is
a separate artifact with separate rules — INV-PLT-04. The two are opened by the same process and never share a
transaction: an append to the ledger must not be able to fail because a token refresh was in flight, and the
append-only guard on the ledger store must not have to be weakened so that a credential can be deleted.

## Execution Boundary & Protocol Topology

The product runs one main process and several window processes — the pet window, the application window, and
the card windows. The main process holds the store, the agent harness and the connector adapters. The window
processes render untrusted content: connector bodies, model output, and what the user types or pastes. The
boundary between them is where this design does most of its work.

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction (A→B / B→A / Duplex) | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `credentials.presence` | Window → Main | Request-Response | `{ prefix }` | `CredentialPresence[]` | None; decrypts nothing | `SECURE_STORAGE_UNAVAILABLE`; the surface shows the store as unavailable rather than the connectors as disconnected |
| `credentials.available` | Window → Main | Request-Response | — | `{ available: boolean }` | None | No error path: the answer is the state |
| `credentials.changed` | Main → Window | Stream | — | `CredentialPresence` | None | Loss is not an error; the window re-reads presence |
| `credentials.unreadable` | Main → Window | Stream | — | `{ key, classId, restorationRoute }` | None | Drives the "unavailable on this device, being restored" statement |
| `credentials.erasureState` | Window → Main | Request-Response | — | `ErasureState \| null` | None | Lets sign-out and account deletion show progress honestly |
| Connector adapter → Cipher Gateway | In-process | Function call | `CredentialKey` | Decrypted value, for the duration of one call | Decryption; the value is discarded after the call | `CREDENTIAL_UNREADABLE`, `CREDENTIAL_NOT_FOUND`, `SECURE_STORAGE_UNAVAILABLE` |
| Replication → Entry Table | In-process | Function call | Key, replacement value | Entry replaced | Write | Replacement of an unreadable entry is the ordinary path, not a repair |

There is no channel by which a window process obtains a credential value, and none is planned. This is the same
shape as the ledger's read-only boundary and for the same reason: the guarantee is that the channel does not
exist, not that a check refuses it.

### Execution Boundaries & Isolation

The main process owns the credential store file exclusively and is the only process linked to the operating
system's secure-storage facility. Window processes run with context isolation and without direct access to the
file system or the store; their preload surface exposes exactly the five channels above. Connector adapters and
the agent harness run in the main process, which is what allows a decrypted value to reach a call without
crossing any boundary at all.

If the main process stops, everything stops: there is no window-side cache of credentials to go stale, because
there is no window-side copy. If a window process crashes, nothing about the store changes; the replacement
window re-reads presence. An erasure interrupted by either is recorded as outstanding and completed at the next
start, before the store answers anything else — the same shape as the ledger's start-up classification pass,
and for the same reason: the recovery must not depend on the process that failed.

### Trust Boundaries & Input Validation

Three inputs are untrusted and each is handled at a single point. Ciphertext read from disk is untrusted: every
failure mode — altered body, altered authentication tag, unrecognised scheme marker, truncated buffer, a profile
that can no longer decrypt what it wrote — is collapsed by the Cipher Gateway into one outcome, a failed read,
because `spikes/SP-11-secure-storage/REPORT.md` §1 Q3 measured all of them raising an error rather than
returning a value, and because distinguishing them would tempt a best-effort parse. Keys offered by callers are
untrusted: the Key Parser refuses a key with no group and the Class Registry refuses a key matching no class,
both before anything is written. Metadata offered alongside a credential is untrusted: only fields the class
declares are accepted, which is what keeps the undecrypted presence path free of secrets.

## Decisions

### D1 — Encrypt through the platform's own secure-storage facility, not a keychain library and not the operating-system credential vault
- **Choice**: the application framework's built-in secure-storage facility — on Windows, a randomly generated
  key protected by the operating-system user profile, with an authenticated cipher over the payload.
- **Rationale**: it ships with the framework, so there is no separately compiled component to rebuild on every
  framework upgrade, and it imposes no size limit — VERIFIED to 1 MB,
  `spikes/SP-11-secure-storage/REPORT.md` §1 Q2. Cross-user isolation was measured directly rather than assumed:
  a second operating-system user created for the test failed to decrypt with a bad-key-state error, §1 Q4.
- **Alternatives Considered**: the long-standing third-party keychain library, rejected because its repository
  was archived in 2022 and its natively compiled binding broke on framework upgrades — §1 Q1, and the same
  section records the largest application in this ecosystem having moved off it for these reasons. The
  operating-system credential vault, rejected on a hard 2,560-byte limit per entry that one connector's combined
  authorisation state already approaches at 752 bytes and a multi-connector payload exceeds — §1 Q2; it also
  lists the product's entries among the user's own saved credentials, which turns a failed enumeration during
  uninstall into permanently orphaned entries, §1 Q6. A file encrypted with a key shipped beside it, which
  `proposal.md` carries as its minimum viable slice, rejected because the key sits next to the ciphertext and
  therefore protects against nothing an attacker with file access cannot defeat.

### D2 — Keep credentials in their own store, separate from the append-only ledger store
- **Choice**: a dedicated credential store file in the application's per-user data directory, holding key,
  ciphertext, last-updated time and declared metadata.
- **Rationale**: a credential is updated on every token refresh and deleted on every disconnect. The ledger
  store refuses both by construction, and that refusal is enforced by the store itself so that it also binds
  processes that are not the product — `docs/spec/changes/req-013-sqlite-ledger/contracts/ledger-store.md`.
  Putting credentials there would mean weakening the one guarantee principle III rests on in order to satisfy an
  unrelated need.
- **Alternatives Considered**: a table inside the ledger store, rejected for the reason above and because
  `ledger/contracts/ledger-store@0.1.0` already states that credentials are not in that store, which is what
  lets its text search be described simply. One file per credential, rejected because grouping and erasure would
  then depend on directory enumeration, and a partial enumeration is exactly how the credential-vault route
  leaves orphans.

### D3 — Address credentials by a hierarchical key, and group by prefix
- **Choice**: `<domain>:<category>:<identity>[:<field>]`, with prefix enumeration as the grouping mechanism.
- **Rationale**: every erasure in this design is a group operation — one connector on disconnect, everything on
  sign-out — and a prefix is the cheapest grouping that survives an entry the code forgot about, because the
  group is computed from the key rather than from a list somebody has to maintain. The five forms were written,
  read back and enumerated by prefix in `spikes/SP-11-secure-storage/REPORT.md` §1 Q5.
- **Alternatives Considered**: a table per credential kind, rejected because adding a connector would then add a
  table and thereby edit the core, which principle VI forbids. An opaque identifier with a separate index,
  rejected because the index becomes a second thing to keep in step, and the failure mode of a stale index is a
  credential nobody erases.

### D4 — Store credentials whole; never split one across entries
- **Choice**: no chunking layer.
- **Rationale**: chunking exists only to work around the credential vault's per-entry limit, and the spike
  described what it would cost: a payload split into numbered parts with a count held separately, which loses
  synchronisation if the machine stops between writes and leaves partial credentials nobody can interpret —
  `spikes/SP-11-secure-storage/REPORT.md` §1 Q2. With the chosen facility no limit was reached at 1 MB, which is
  three orders of magnitude above what any class holds.
- **Alternatives Considered**: chunking with a manifest entry, rejected as above; compressing before encryption
  to stay under a limit, rejected because the limit it serves does not exist on the chosen route.

### D5 — An unreadable credential is replaced through its class's route, not reported as a broken connection
- **Choice**: a failed decryption marks the entry unreadable and hands it to the Restoration Coordinator, which
  takes the route the class declares: replacement from the account for replicating classes, and re-establishment
  from account sign-in for the class holding the device's own replication material.
- **Rationale**: `req-022-account-sync` made the account the owner of connector authorisation, so the copy that
  can replace this one already exists. Asking the user to reconnect every connector, which the spike's original
  system card did, is now the wrong response to a condition the product can fix without them —
  `docs/spec/capabilities/platform/spec.md`, the scenario on stored credentials that cannot be decrypted. The
  one case replication cannot fix is the replication material itself, which is why the class declares its route
  rather than the store assuming one (INV-PLT-06).
- **Alternatives Considered**: the spike's design of a persistent system card directing the user to reconnect
  each affected connector — `spikes/SP-11-secure-storage/REPORT.md` §1 Q3 — rejected as the primary path because
  it hands the user work the product can do, and retained only as what is shown while the device cannot yet
  reach the account. Silently deleting unreadable entries and presenting the connector as never connected,
  rejected because the two states demand opposite responses and collapsing them is INV-PLT-07 inverted.

### D6 — No channel returns a credential value
- **Choice**: the boundary surface exposes presence, availability, change and erasure state; reading a value is
  in-process only.
- **Rationale**: the window processes render untrusted content, and principle II's argument applies here
  unchanged — a control that can be reached from where untrusted content is interpreted is a control that
  prompt injection or a rendering defect can turn into privilege. Removing the channel removes the class of
  attack rather than defending against it.
- **Alternatives Considered**: a channel guarded by a capability check, rejected because the check is code that
  can be wrong and the absence of a channel cannot be. Passing a short-lived handle the window redeems, rejected
  because the window has no use for a credential at all — everything it shows is answered by presence.

### D7 — Credential classes are registered descriptors, not cases in the store
- **Choice**: each credential-holding capability registers a Credential Class Descriptor declaring its key
  pattern, whether it replicates, its restoration route, its erasure triggers and its permitted metadata fields.
- **Rationale**: it makes the class set the single `open` variability point, so the Nth connector adds a
  registration and no edit to the store, to erasure or to any surface — principle VI. It also puts the two rules
  that are easy to get wrong, the erasure triggers and the restoration route, in a declaration that can be
  checked at start rather than in behaviour that is discovered at sign-out.
- **Alternatives Considered**: a fixed set of four kinds with behaviour in the store, rejected because the
  fourth connector would be a fifth case and the tenth an unreadable function. Deriving policy from the key's
  domain segment by convention, rejected because the convention is unstated and unenforceable, and its failure
  mode — a credential inheriting a policy nobody chose — is silent.

### D8 — Erasure overwrites, then discards, and records that it is running
- **Choice**: an erasure overwrites the stored ciphertext and discards the decrypted copies the process holds,
  then removes the entries, and records an outstanding erasure that the next start completes before the store
  answers anything else. The store file is removed only after the erasure reports completion.
- **Rationale**: the ordering is what matters and it is measured: in `spikes/SP-11-secure-storage/REPORT.md`
  §1 Q6 the post-erasure state was no file, no key in memory, a read returning nothing and no entry in the
  operating system's credential list. Recording the run is what makes an interrupted uninstall finishable, since
  an uninstaller that is killed part-way is an ordinary event rather than an exotic one.
- **Alternatives Considered**: deleting the file and trusting the file system, rejected because an interrupted
  removal then leaves entries that are still readable by the operating-system user who wrote them. Relying on
  the overwrite alone as an anti-forensic measure is explicitly **not** claimed here: on flash storage and
  journaling file systems an overwrite does not reliably reach the physical blocks, and that limitation is
  UNVERIFIED in this project because nothing measured it. The guarantee this design makes rests on the
  encryption and its binding to the operating-system user profile; the overwrite is defence in depth, and
  `verification.md` records it as such rather than as a threshold.

### D9 — macOS is structured for, not designed now
- **Choice**: the Cipher Gateway is the only component that touches the platform facility, and nothing above it
  knows which platform it is on.
- **Rationale**: the same facility uses the system keychain on macOS, which can present a permission prompt the
  user may decline — a state this design does not yet have, because nothing has measured when the prompt
  appears or what declining leaves behind. `spikes/SP-11-secure-storage/REPORT.md#5-chua-tra-loi-duoc-vi-sao`
  records the gap and `clarifications.md` Q-1 carries it. Confining the platform surface to one component is
  what makes adding that state a change to one place.
- **Alternatives Considered**: designing the prompt-declined behaviour now from vendor documentation, rejected
  under the constitution's Evidence Discipline — vendor documentation alone is never an architectural
  conclusion, and the behaviour worth specifying is the one the prompt actually has.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: classes are registered eagerly at start, before the store answers any
  call. Registration validates the descriptor against
  `platform/contracts/credential-class-descriptor@0.1.0`, rejects a pattern overlapping a registered one,
  rejects a class whose erasure triggers omit any of the four account-level events, and rejects a class
  declaring replication as its restoration route while not replicating. Every one of these failures stops the
  product rather than degrading it, because each describes credentials with an undefined erasure policy.
- **Isolation & Sandboxing**: classes are declarations, not code. There is no module to load, no callback to
  invoke and no third-party execution anywhere in this design — the registry holds data and the store applies
  it. The isolation that matters is the process boundary of D6, which no class can widen.
- **Resource Management & Eviction**: a decrypted value exists for the duration of one call and is discarded
  afterwards (INV-PLT-10), so there is no cache to evict and no eviction policy to tune. The registry is fixed
  after start. Entries leave the store only by replacement or erasure; nothing expires on a timer, because an
  expired token is still the thing that must be refreshed rather than forgotten.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (Specific ➔ General)**: `Entry unreadable on this device` ──> replaced from the account's copy on the
  next replication, with no user action; the connector is shown as unavailable on this device and being
  restored in the meantime, never as revoked at the platform.
- **Tier 2 (Custom ➔ Built-in Default)**: `Replication cannot supply it — the device's own replication material
  is unreadable, or the device has not reached the account` ──> the product asks for account sign-in and nothing
  else, and re-establishes the replication material and every replicating credential from that sign-in alone.
  This is principle VII's guarantee applied to the store's own failure: the user carries nothing, so the
  recovery can ask for nothing but sign-in.
- **Tier 3 (Degraded Safe-Mode)**: `The operating system's secure-storage facility is unavailable` ──> the
  product continues to run, reads its ledger and shows its history, refuses to connect anything new, fails jobs
  that need a credential with a stated reason, and holds nothing in plain text. There is no fourth tier: a
  plain-text fallback is not degraded operation but a different product, and INV-PLT-03 leaves no state from
  which one could be written.

## Complexity Tracking

None. No constitutional principle is violated by this design. Two are load-bearing and worth naming rather than
assuming: principle VI, which the class registry serves by making the Nth connector a registration rather than an
edit; and principle VII, whose guarantee that sign-in alone suffices is what makes Tier 2 above an acceptable
answer instead of a data-loss event.

## Research

### R1 — The macOS keychain permission prompt
- **Decision**: deferred; the Cipher Gateway is the single point that will absorb it.
- **Rationale**: the behaviour worth specifying is when the prompt appears, what declining it leaves behind and
  whether it recurs after an update — none of which has been measured.
- **Alternatives**: specifying from vendor documentation now, rejected under Evidence Discipline.
- **Source / Verification Status**: `spikes/SP-11-secure-storage/REPORT.md#5-chua-tra-loi-duoc-vi-sao` —
  UNVERIFIED; carried as Q-1 in `clarifications.md` and as a reserved point in `model.md`.

### R2 — The total size of the credential store
- **Decision**: no product-level figure is stated; per-entry cost is used instead.
- **Rationale**: per-entry ciphertext is the plaintext plus exactly 31 bytes at every size, VERIFIED, so the
  total is computable once the class set and connector count are known. Stating a total now would be inventing
  a quantity no measurement supports.
- **Alternatives**: a cap per entry or per store, rejected because the only measured ceiling belongs to the
  rejected credential-vault route.
- **Source / Verification Status**: `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 — VERIFIED for the per-entry
  cost; the total is UNVERIFIED and is an observation in `verification.md`.

### R3 — Whether overwriting before deletion removes anything physically
- **Decision**: not claimed as a guarantee; retained as defence in depth.
- **Rationale**: the spike performed and measured the sequence, but what it demonstrated is that the product
  leaves no readable entry — not that the bytes left the medium. On flash storage and journaling file systems an
  overwrite in place is not reliably the same operation it appears to be.
- **Alternatives**: claiming secure deletion, rejected as an assertion no measurement here supports; omitting
  the overwrite entirely, rejected because it costs little and the ordering it enforces is what makes erasure
  finish before the file is removed.
- **Source / Verification Status**: `spikes/SP-11-secure-storage/REPORT.md` §1 Q6 — VERIFIED for the observable
  outcome; the physical claim is UNVERIFIED and is deliberately not made.

### R4 — How long a revoked device can still use a replicated credential
- **Decision**: out of scope here; the bound is the lease `req-022-account-sync` owns.
- **Rationale**: this change erases on revocation as the second line. The first line is backend enforcement, and
  the window between revocation and a device learning of it is unmeasured.
- **Alternatives**: a device-side expiry independent of the lease, rejected because two authorities over the
  same window disagree eventually, and INV-SYNC-07 already forbids a device extending its own right to act.
- **Source / Verification Status**: RISK-066 — UNVERIFIED; owned by `sync`.

## Migration & Rollback

**Migration.** There is no application code and no existing installation, so there is no credential to migrate.
What this change introduces is the store file and its first shape: one row per entry with key, ciphertext,
last-updated time and metadata, created at first start. A device that starts with no store file creates one; a
device whose store file exists at an older shape applies the shape steps before the store answers any call, in
the same order and with the same one-step-at-a-time discipline `req-013-sqlite-ledger` established for the
ledger store.

Two rules bind any future migration of this store and are stated now because they are easy to violate later.
A migration may never write a decrypted credential anywhere, including to a temporary file or a backup taken
before the step; if a step must re-encrypt, it decrypts and re-encrypts one entry at a time in memory. And a
migration may not reclassify an entry by rewriting its key, because class follows key (INV-PLT-02) and a
rewritten key silently changes what erases the entry — the correct procedure is to write the entry under its new
key and erase the old one, so that a failure in between leaves two erasable entries rather than one
unclassified.

**Rollback.** Removing this change removes the store and everything in it; the credentials are re-established
from account sign-in, which is Tier 2 above and costs the user one sign-in rather than any re-authorisation. An
older product version that meets a newer store shape refuses to open it and says so, rather than reading entries
it may misread — the same refusal the ledger store makes.

## Risks / Trade-offs

- [An administrator resets the operating-system password out of band, desynchronising the profile that protects
  the key, and every stored credential becomes unreadable — RISK-042, VERIFIED as a mechanism by
  `spikes/SP-11-secure-storage/REPORT.md` §1 Q4] → Tier 1 and Tier 2 of the fallback hierarchy make this
  recoverable without the user reconnecting anything; the product asks at most for account sign-in.
- [Readability is bound to the operating-system user profile, so a device change, a restored backup or a
  reinstalled operating system loses every local credential] → the account holds the copy since
  `req-022-account-sync`; what was previously a loss is now a re-sync. The binding is kept deliberately, because
  the property that makes a stolen data directory worthless is the same one that makes a moved directory
  unreadable.
- [The metadata beside the ciphertext is readable without decrypting, and a process with file access can edit
  it] → the class declares an exhaustive list of permitted fields, nothing is authorised on the strength of
  metadata, and the presence path exists to answer display questions only.
- [A user who deletes the application directory by hand rather than uninstalling bypasses erasure, leaving
  ciphertext that their own operating-system account could still decrypt] → the entries are unreadable to every
  other account and every other machine, and account deletion withdraws the authorisations at the providers
  independently, so what is left is inert rather than merely hidden.
- [The whole design depends on one process holding the store, so a defect there is a defect in every credential
  path] → the surface is small and single-purpose, its boundary is structural rather than checked, and
  `verification.md` gives the boundary its own regression suite.
- [macOS is unmeasured, and the permission prompt may introduce a state no requirement covers] → the platform
  surface is confined to the Cipher Gateway, and the spike that closes it is a task in this change rather than
  an assumption.

## Open Questions

- Whether presence should carry a last-used time in addition to last-updated. It would let the connectors
  surface show a genuinely dormant authorisation, and it is a metadata field addition — a minor version of the
  descriptor contract — so it changes no specification and no task here.
- Whether a class should be able to declare an expected refresh cadence, so that a token not refreshed within it
  is surfaced as suspect. This is an observation to make once real usage exists; specifying it now would be a
  threshold with no measurement behind it.

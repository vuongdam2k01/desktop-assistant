## Context

The store this change designs is the only place the product's history exists on a device, and three
non-negotiable properties meet inside it: a record must be durable before the call it describes is made, a
record must never change afterwards, and a crash must not cost the product its knowledge of what it was doing.
`spikes/SP-12-sqlite-ledger/REPORT.md` built the store and the recovery engine and measured all three against
deliberate process kills on both supported operating systems, so most of what follows is a decision about which
measured arrangement to adopt rather than an open design question.

Three constraints come from outside this change and are taken as given. Records are account-owned and replicate,
so append-only must hold across replicas and identifiers assigned at write time must not be recomputed —
`req-022-account-sync`. Every tool call is wrapped by the approval gate and the ledger obligation and no path
registers a tool outside that wrapper — `req-019-connector-framework` and principle VI. Credentials never live
in this store; they live in operating-system secure storage — `req-012-secure-storage`.

For why the two-record model rather than one, see `proposal.md`. For the decisions taken on the decision-maker's
behalf during planning, see `clarifications.md`.

## Goals / Non-Goals

**Goals:**
- A store in which append-only and write-before-act hold simultaneously, enforced where an external tool cannot
  work around them, not only where the product's own code chooses to respect them.
- A start after any crash that loses no job, repeats no tool call, and does not depend on the network to be safe.
- A recovery engine that learns what a tool can tell it from the tool's own declaration, so the Nth platform is a
  manifest rather than an edit to recovery.
- A store whose 90-day cost and query behaviour are known numbers rather than hopes, and whose shape can change
  between product versions without rewriting history.
- A native component that loads on every supported machine without a compiler being installed on it.

**Non-Goals:**
- Replication, conflict resolution, device enrolment and the account-side store. Owned by `sync`.
- How the history is presented, searched or paged. Owned by `app` and `uix`.
- How an undo plan is built from records. Owned by `undo`; this change owes it the snapshots and the compensating
  actions, and nothing more.
- The approval decision itself. Owned by `approval`; this change records the decision it produces.
- Server-side retention sizing, which RISK-069 records as unmeasured and `req-022-account-sync` owns.

## Structure

| Component | Responsibility | Model entities | Reached through |
| --- | --- | --- | --- |
| Ledger Store | Owns the store file and everything that touches it: opening it, configuring it, appending records, answering queries, and holding the guard. The only component that knows the store is a file. | Local Store, Action Record, Immutability Guard | `ledger/contracts/ledger-store@0.1.0` |
| Record Builder | Assembles a record from what the caller knows at the moment of writing — the before snapshot, the reversibility declaration, the reconciliation declaration copied from the tool, the correlation identifier — and refuses to assemble one that is incomplete. | Action Record, Tool Call, Snapshot, Correlation Identifier | `ledger/contracts/ledger-record@0.1.0` |
| Recovery Manager | Runs at every start. Its classification part reads unresolved intents and marks the jobs that hold them; its reconciliation part establishes each outcome afterwards. Holds no knowledge of any platform. | Recovery Pass, Unresolved Intent | `job/contracts/tool-reconciliation@0.1.0` |
| Reconciler | Executes one declaration against one intent: calls the declared read through the connector, applies the declared comparison, returns a conclusion. | Reconciliation Declaration | `job/contracts/tool-reconciliation@0.1.0`, `connector/contracts/connector-manifest@0.1.0` |
| Retention Manager | Runs the two operations by which records leave: expiry and the deletion the user asks for. Announces first, removes whole records, restores the guard inside the same transaction. | Retention Window, Removal Announcement | `ledger/contracts/ledger-store@0.1.0` |
| Shape Manager | Compares the store's shape version against the running product's and applies the steps between them, one whole step at a time, before the store is used for anything else. | Store Shape Version, Shape Change | `ledger/contracts/ledger-store@0.1.0` |
| Read Channel | Serves the window processes their read-only view of the history and streams records as they are appended. | Action Record | `ledger/contracts/ledger-store@0.1.0` §2 |

The Ledger Store is the only component holding a writable handle. Job execution, the approval gate and undo
reach it through the contract; the window processes reach only the Read Channel.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| In-process `append` | Job execution → Ledger Store | Call, awaited | `LedgerRecord` | `RecordId` | The record becomes durable | Throws `LEDGER_WRITE_FAILED`; the caller must not make the call it was recording. No timeout: a local durable write that hangs is a damaged store, surfaced as `STORE_DAMAGED` on the next open |
| `ledger.readJob` | Window process → Ledger Store | Request-Response | `{ jobId }` | `LedgerRecord[]` | None | `STORE_UNAVAILABLE`, `JOB_UNKNOWN`; the surface shows the history as momentarily unavailable |
| `ledger.read` | Window process → Ledger Store | Request-Response | `RecordQuery` | `LedgerRecord[]` | None | `QUERY_UNBOUNDED` is a defect, not a user condition |
| `ledger.changes` | Ledger Store → Window process | Stream | — | `LedgerRecord` | None | Loss of the stream is not an error: the window re-reads by job |
| Tool call | Job execution → platform | Request-Response over the network | Connector's own | Connector's own | Changes the user's real account | Owned by `connector`; this design's only requirement is that it happens strictly after the intent is durable |
| Reconciling read | Reconciler → platform | Request-Response over the network | The declared read operation | Observed state | None — it is a read | `unreachable` concludes nothing and is retried; `read_refused` becomes a question for the user |

### Execution Boundaries & Isolation

The store is opened for writing by exactly one process, which is also the process that makes tool calls. That
co-location is the design: the durability guarantee is only meaningful if the write and the call are on the same
side of every boundary between them, because a boundary between them is one more place to stop after the write
has been reported and before the call is made. The window processes hold no handle to the store and no channel
that appends, so a defect or a compromise in a window cannot write history and cannot satisfy the ledger
obligation on behalf of anything.

Recovery runs inside the same process, before the window processes exist. Its classification part completes
first, then the process creates the pet window, then its reconciliation part proceeds per affected job. If the
process stops during classification, the next start repeats it from the store and reaches the same result, since
classification writes job state and no records (INV-PLT-01).

The store file itself is a boundary the product does not fully own: it is a file in the user's own directory,
and anything running as the user can open it. The guard lives in the store's definition precisely so that this
boundary is defended by the store rather than by the product's good behaviour.

### Trust Boundaries & Input Validation

- **Records presented for appending** are validated against `ledger-record@0.1.0` before anything is written; a
  record that fails is refused and the call it would have preceded is not made. The validation is the fail-closed
  point, so it is deliberately strict about the fields recovery and undo will later need.
- **The platform's answer during reconciliation** is untrusted and is never rounded toward a conclusion. Matching
  neither the recorded state nor the intended one is `state_matches_neither`, and the user is asked.
- **Record content is data.** Parameters, responses and snapshots hold platform content and user text; reading
  the history never treats them as instruction, per the constitution's External Content Is Data section.
- **A query from a window process** carries a required limit and is served read-only; there is no query that
  returns credentials, because credentials are not in this store.

## Decisions

### D1 — One store file per device, holding jobs, approval requests and records together
- **Choice**: a single store file in the per-user application data directory, with the guard applied to the
  record table only.
- **Rationale**: recovery's central question — is this intent unresolved, and what job does it belong to — is
  answered by reading records and job state as one consistent picture. In one store that is a single read; across
  two stores it is a reconciliation with its own failure mode, at exactly the moment the product is least sure of
  itself. It is also the arrangement the crash injection ran against, so the evidence stays applicable —
  `spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1.
- **Alternatives Considered**: a separate store for the ledger, rejected because the isolation it buys is not a
  problem the product has, while the cross-store read it costs is; a store per job, rejected because retention
  and the recent-jobs query would become file-system scans; keeping jobs in memory and only records on disk,
  rejected outright because a job that exists only in memory is a job that disappears in a crash, which
  NFR-RL-01 forbids.

### D2 — Two records per call, rather than one record written twice
- **Choice**: an intent record before the call and a result record after it, joined by a correlation identifier,
  with neither ever rewritten.
- **Rationale**: the outcome is not knowable when the record must exist, and the record must not change once it
  does. Two records is the only arrangement that satisfies both without weakening either.
- **Alternatives Considered**: one record written after the call, rejected in `proposal.md` because a crash
  between the call and the write loses the action entirely; one record written before and updated after,
  rejected because the update is precisely what principle III forbids and what the guard makes impossible; a
  transaction spanning the network call, rejected because no such transaction exists — the platform has no part
  in our commit, which is why the indeterminate state has to be reconciled rather than prevented; a local
  two-phase protocol with a prepared state, rejected as the same thing as two records with more machinery and
  an extra state that can itself be interrupted.

### D3 — Immutability enforced in the store's own definition, with a write surface that cannot express change
- **Choice**: both layers. The store refuses modification and deletion of a record by its own definition, and
  the contract exposes no method that modifies or deletes one.
- **Rationale**: the two layers fail differently. The surface stops the product's own defects at the point a
  reviewer can see them; the store's own refusal stops everything else, including a database tool opened against
  the file by a curious user, which was measured — `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q2 recorded the
  refusal from a second language runtime entirely. Neither layer alone covers what the other does.
- **Alternatives Considered**: enforcement in the repository layer only, rejected because it holds exactly as
  long as every future writer goes through that layer and is silent when one does not; a cryptographic chain
  over records, rejected because it detects tampering rather than preventing it, and because the product's
  threat model here is accident and adjacent tooling rather than a motivated local attacker — a motivated one
  can remove the guard too, which is RISK-044 and is bounded by directory permissions instead.

### D4 — Snapshots held whole and uncompressed
- **Choice**: the complete state of the target object, as structured text, with no compression at MVP.
- **Rationale**: undo replays a recorded state rather than computing a patch, so the whole state is what makes
  the compensating action a single call, and it is what survives an intermediate change by someone else.
  Compression was measured at 44.5 percent against a 90-day total of 12.36 MB to 30.83 MB —
  `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 — which is not a saving worth trading the ability to read the
  store directly while diagnosing a failure.
- **Alternatives Considered**: a property-level difference, rejected because it cannot rebuild an object whose
  intermediate state moved under it, and RISK-001 already records that some operations have no usable
  compensation formula without a full prior state; compressing now, rejected on the measurement above and kept
  as a reserved variability point with the condition that would activate it, aligned with the same slot in
  `req-022-account-sync` so the two do not diverge.

### D5 — Recovery in two passes, with only the local one before the first window
- **Choice**: classification — read unresolved intents, mark their jobs unresumable, hand the surfaces their
  state — completes before the first window. Reconciliation against the platform runs afterwards, per job.
- **Rationale**: what prevents a duplicate call is refusing to resume past an unresolved intent, and that is
  established by the local pass alone. Making the window wait for a platform read makes an offline start hang on
  a network the user may not have, against principle VII's requirement that the product keeps working while the
  backend and network do not. The ordering the spike verified —
  `spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 6 — is preserved for the part that
  needs it.
- **Alternatives Considered**: everything before the first window, rejected on the offline case above; everything
  after, rejected because the blocking card queue and the unresumable marking must exist before the user can act
  on anything, or the user can answer a card for a job whose state has not yet been established; a background
  pass with no ordering guarantee at all, rejected because "no duplicate call" would then depend on timing.

### D6 — Reconciliation is declared by the tool and copied into the intent
- **Choice**: each tool declares `readback` with what to read and compare, or `none`; the declaration is copied
  into the intent record when it is written, and recovery follows the copy.
- **Rationale**: hard-coding which tools are readable makes the Nth platform an edit to the recovery engine,
  which principle VI forbids. Copying rather than resolving later means a manifest edited between the crash and
  the recovery cannot change how the interrupted call is treated — which, for a tool that sends messages, is the
  difference between asking the user and sending twice (RISK-045).
- **Alternatives Considered**: a list inside recovery, rejected as above; inferring readability from whether the
  tool has a read counterpart, rejected because the inference is wrong exactly where it is expensive; resolving
  the declaration at recovery time, rejected on the manifest-drift case; asking the user about every unresolved
  intent regardless, rejected because it makes every crash the user's problem when four of the five measured
  crash points can be resolved without them.

### D7 — Records leave by announce-then-remove, inside one transaction that restores the guard
- **Choice**: retention expiry and deliberate deletion append a removal announcement, then remove whole records,
  then restore the guard, all in a single transaction using the procedure verified in
  `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q6.
- **Rationale**: it keeps "no record is ever rewritten" absolute while still letting the product honour the
  retention requirement and the user's right to delete their own history, and it leaves the history containing
  its own account of every gap. An interruption leaves the whole range present or the whole range gone, and the
  announcement present either way, so the next start can tell what happened.
- **Alternatives Considered**: relaxing the guard to permit deleting rows older than the retention period,
  rejected because it puts deletion back in the ordinary write path and makes principle III conditional; never
  removing anything, rejected because it contradicts the existing retention requirement and denies the user
  deletion of their own history; removing without announcing, rejected because a gap with no explanation is
  indistinguishable from data loss to the next person reading the history — including to us, during an
  investigation.

### D8 — The store binding is pinned to the generation that needs no compiler, and packaging extracts it
- **Choice**: the binding generation that is binary-compatible across runtimes and ships prebuilt components, and
  a packaging step that places those components on disk outside the application archive.
- **Rationale**: measured, not preferred. The superseded generation could not be compiled at all against the
  current application framework, failing on internal engine interfaces the framework had removed; the pinned
  generation loaded the same component under both the plain runtime and the framework with no rebuild, and the
  packaged application opened its store only because the component was extracted as a file, which the Windows
  loader requires — `spikes/SP-12-sqlite-ledger/REPORT.md#2-tac-dong-len-adr-prd` and §1 Q1e.
- **Alternatives Considered**: compiling at install or build time, rejected because it puts a C++ toolchain on
  every developer, build and user machine and reintroduces a whole class of upgrade failures (RISK-046); a
  pure-language store with no native component, rejected because nothing in that class was measured against the
  crash, durability and immutability requirements this store has to meet, and adopting one would discard the
  evidence base entirely.

### D9 — One writing process, read-only channels outward
- **Choice**: the process that makes tool calls is the only one that opens the store for writing; window
  processes get read and stream channels and no append channel.
- **Rationale**: the ledger obligation is only enforceable beside the call it precedes. An append channel
  reachable from a window is a path by which history could be written by something that is not making the call,
  and — since windows render untrusted content — a path worth not having at all.
- **Alternatives Considered**: a shared handle with both processes writing, rejected because concurrent writers
  to one store trade the crash guarantees for a locking problem, and one supported operating system enforces
  file sharing modes that make the failure platform-dependent; a service process owning the store with both the
  caller and the windows as clients, rejected because it puts a boundary between the write and the call, which
  is the one place D2 exists to keep boundary-free.

### D10 — The crash suite asserts process termination in platform-neutral terms
- **Choice**: the regression suite asserts that the killed process did not exit cleanly, rather than asserting a
  POSIX signal.
- **Rationale**: one supported operating system has no POSIX signals; the kill maps to a native termination that
  reports an exit code and no signal, so a signal assertion reports a false result there —
  `spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 5, and RISK-048.
- **Alternatives Considered**: running the crash suite on one operating system only, rejected because the
  differences the spike found — file locking release, the durability call, deletion of an open file — are
  precisely the behaviours the store depends on, and they differ between the two.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: reconciliation declarations arrive with the connector manifest that
  declares the tool and are registered when that manifest is loaded, eagerly at start and again when a connector
  is added. Recovery never consults the registry: it reads the copy carried by the intent record, so an
  interrupted call remains recoverable even if its connector has since been removed or changed.
- **Isolation & Sandboxing**: the Reconciler performs no platform work of its own. It invokes the declared read
  through the connector's ordinary tool surface, which means the read passes the approval gate and is recorded
  like any other call. A declaration cannot name an operation the connector does not declare; if it does, it is
  treated as absent.
- **Resource Management & Eviction**: recovery holds only the unresolved intents, which are bounded by how many
  calls were in flight when the process stopped — a small number by construction, since a job makes calls in
  sequence. Reconciling reads are performed per job rather than in a single burst, so a start after a crash does
  not open a connection storm against a platform the product also needs for the user's next command.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (Specific ➔ General)**: `tool declares readback` ──> `declaration missing, malformed, or naming an
  unknown read operation` ──> treated as `none`. The user is asked. This direction is chosen deliberately: the
  opposite default would let a missing field decide that a message was safe to reconcile automatically.
- **Tier 2 (Custom ➔ Built-in Default)**: `reconciling read succeeds` ──> `read refused, target gone, or state
  matching neither the recorded nor the intended value` ──> the job moves to `waiting_user_confirmation`, showing
  what was recorded and what is there now, so the user answers a question they can actually answer. No
  conclusion is inferred from an ambiguous read.
- **Tier 3 (Degraded Safe-Mode)**: three progressively worse conditions, none of which is allowed to crash the
  product or to guess:
  - *Platform unreachable*: the job stays `recovering`, nothing is repeated, and the rest of the product is fully
    usable. Reconciliation is retried; a failure to look is never evidence.
  - *Store shape newer than this version understands*: the product refuses to open the store, states that it was
    written by a newer version, and runs no jobs — rather than reading records it may misread.
  - *Store damaged, or unopenable*: the product reports that it cannot open its history and runs no jobs.
    Fail-closed is the only safe reading here, because a product that runs jobs without a history is a product
    that cannot undo, explain or recover any of them — which is worse than a product that will not start.

## Complexity Tracking

One entry, and it is a reading of a principle rather than a departure from its purpose. Everything else in this
change is the mechanism behind principle III rather than a deviation from it; the two places where a principle
constrains the design rather than the design constraining itself are recorded above as decisions — D3 for where
immutability is enforced, and D6 for tool-declared reconciliation under principle VI.

| Violation | Why Needed | Simpler Alternatives Rejected Because |
| --- | --- | --- |
| Principle III states that ledger records "SHALL never be edited or deleted". D7 permits records to be removed by retention expiry and by a deletion the user asks for | FR-LG-07 requires retention bounded at 90 days and a deliberate deletion carrying a warning, and the living `ledger` spec already carries both, so the literal reading of the principle is in tension with a requirement that predates this change. A user who cannot delete their own history is not a user this product intends to have, and the account-deletion requirement in `app` assumes the same capability. The reading adopted is that the principle forbids mutation and any selective or unannounced removal, while whole-record expiry and user-directed deletion — announced in the ledger before they happen, all-or-nothing, and never a route to rewriting — are permitted | Keeping every record forever was rejected: it contradicts the existing retention requirement and denies the user deletion of their own data. Relaxing the guard so that records past the retention period can be deleted through the ordinary write path was rejected: it returns deletion to the path every future writer uses and makes the prohibition conditional rather than absolute, which is a deeper dilution of the principle than the reading above. Neither alternative is simpler in the sense that matters — one breaks a requirement, the other breaks the principle |

This entry needs the decision-maker's explicit acceptance at W4, per the constitution's Governance section.
Accepting it is not an amendment: the principle's wording is unchanged, and clarifying that wording would be a
dedicated change of its own.

## Research

### R1 — Which generation of the store binding survives an application framework upgrade
- **Decision**: the binary-compatible generation that ships prebuilt components; the superseded generation is
  DROPPED and must not be reintroduced.
- **Rationale**: the superseded generation binds to the framework's internal engine interfaces, which the
  current framework has removed; it fails to compile rather than degrading. The pinned generation loaded the
  identical component under both the plain runtime and the framework without any rebuild.
- **Alternatives**: compiling from source at install time, which was measured as possible but requires a full
  C++ toolchain and a separate language runtime on every machine, taking 38 to 55 seconds per build; rebuilding
  against each framework version, which succeeded in 10.26 seconds for the pinned generation and failed outright
  for the superseded one.
- **Source / Verification Status**: `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q1a to Q1c — VERIFIED on Windows
  11 against the current framework version. RISK-046 is resolved by this decision.

### R2 — Whether the durability configuration holds on both supported operating systems
- **Decision**: write-ahead logging with the ordinary durability setting and referential integrity enforced.
- **Rationale**: the durability call differs by operating system, and one of them releases file handles on
  termination in a way the other does not, so the configuration had to be re-measured rather than inferred. All
  five kill points passed on both, and the store's integrity check reported no damage in any of them.
- **Alternatives**: the strictest durability setting, which costs a disk flush per commit for a guarantee the
  measurements did not show to be needed; the default journaling mode, which does not give a concurrent reader a
  consistent view while a write is in progress.
- **Source / Verification Status**: `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q1d and §1 Q3 — VERIFIED on both
  ext4 and NTFS.

### R3 — What 90 days of history actually costs on a device
- **Decision**: keep records for 90 days, uncompressed, with no capacity-driven eviction.
- **Rationale**: 12.36 MB at 1,800 jobs and 30.83 MB at 4,500 jobs, at roughly 7.0 KB per job and 2.4 KB per
  record, with one job's detail read at 0.13 to 0.25 ms median. At that size, the retention period is a product
  decision rather than a technical constraint.
- **Alternatives**: compression, measured at 44.5 percent and deliberately deferred to a reserved slot; a shorter
  retention period, unnecessary at this size; capacity-driven eviction, rejected because a record dropped for
  space is history lost without anyone deciding to lose it.
- **Source / Verification Status**: `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 — VERIFIED per device. The
  account total across devices is UNVERIFIED and is RISK-069, owned by `req-022-account-sync`.

### R4 — Whether the recent-jobs query needs an index
- **Decision**: index the records on descending recorded time.
- **Rationale**: it takes the recent-jobs query from roughly 30 ms to under 1 ms, which matters because that
  query runs on every start and behind the job list.
- **Alternatives**: no index, measured at roughly 30 ms and rejected; additional indexes, not measured and not
  added speculatively, since write amplification on an append-only store is paid on every single call.
- **Source / Verification Status**: `spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`
  item 2 — VERIFIED.

### R5 — Why a text encoding rule belongs in a store design
- **Decision**: machine-readable configuration files in the repository are written without a byte-order mark, and
  a check enforces it.
- **Rationale**: one shell's default text encoding inserts a byte-order mark that the native rebuild tooling
  cannot parse, which breaks the build in a way whose error message points nowhere near its cause. It is a
  one-line rule that removes a whole afternoon of confusion.
- **Alternatives**: relying on authors to remember, rejected because the failure is silent at the point of
  writing and loud somewhere else entirely.
- **Source / Verification Status**: `spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-047) —
  VERIFIED as an observed build failure.

### R6 — How the crash suite tells that a process was killed
- **Decision**: assert that the process did not exit cleanly, not that it received a particular signal.
- **Rationale**: signals do not exist on one supported operating system; the kill becomes a native termination
  reporting an exit code and no signal. A suite asserting the signal reports a false result there, which is worse
  than no suite because it reports a false pass.
- **Alternatives**: separate assertions per operating system, which is the same rule written twice and drifts.
- **Source / Verification Status**: `spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`
  item 5 — VERIFIED; RISK-048.

## Migration & Rollback

The store holds persistent data that no other copy of the product can reproduce, so both directions are
specified.

**Forward.** The store carries a shape version. At every start, before the store is used for anything else, the
Shape Manager compares it with the running product's target version and applies the intervening steps in order,
one whole step at a time. Two kinds of step exist:

1. *Additive* — a new field is added and existing records are left without a value for it. This does not disturb
   the guard and does not touch existing records; readers treat the absent value as "written before this
   existed", never as a default to backfill. This is the ordinary case and is what
   `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q6 verified.
2. *Restructuring* — the record table is rebuilt. Inside one transaction: the guard is removed, the existing
   table is set aside, the new one is created, every record is copied across unchanged, the old one is dropped,
   the guard is recreated, and the shape version is advanced. The transaction is the atomicity: an interruption
   leaves the store wholly at the old shape.

A step that would rewrite a record's content is refused rather than run. Where a new product version needs to
read old records differently, it does so when reading them — never by editing them.

**Rollback.** An older product version refuses to open a store whose shape is ahead of it, reporting
`SHAPE_AHEAD` rather than reading records it may misread. This makes downgrade an explicit operation rather than
a silent corruption:

- Before a *restructuring* step, the store file is copied aside and the copy is retained until the product has
  started successfully once on the new shape. Downgrading within that window restores the copy.
- Downgrading restores the history as it stood at the step. Records written after it are not present in the
  restored copy, and the product states this plainly before the restore rather than after — the user is losing
  their own history and is the one entitled to decide.
- *Additive* steps need no copy: an older version cannot open the newer shape either, but nothing was
  restructured, so the forward-only rule and a reinstall of the newer version is the whole recovery.
- Rollback of the native component or the packaging arrangement is ordinary application rollback; the store is
  untouched by it, which is one more reason the binding is pinned to a generation that does not have to be
  rebuilt per framework version.

## Risks / Trade-offs

- [A process with file-system write access can remove the guard or overwrite the store's bytes, defeating
  append-only from outside the product — RISK-044] → The store lives in a per-user application data directory
  the application owns, is never exposed on a network port, and the application never runs elevated. This is a
  bound, not a fix, and it is stated as such: local write access to the user's own files is a threat this design
  does not defeat.
- [A tool whose effect cannot be read back leaves an outcome nobody can establish automatically — RISK-045] →
  Declared per tool, routed to the user rather than retried, and the question carries what was recorded and what
  is there now. The cost is a question after a rare crash; the alternative is a second message.
- [Two records per call doubles the record count, and the reconciliation adds a phase to every start] → Measured
  as immaterial: 30.83 MB for a power user's 90 days, sub-millisecond detail queries, and a classification pass
  that reads only unresolved intents. The one number not yet measured — the classification pass against a full
  store — is Q-6 and is carried into `verification.md` as an observation rather than a threshold.
- [A restructuring migration is the one operation that sets the guard aside, so a defect in it can leave the
  store unguarded] → It is a single transaction that recreates the guard, it is refused if it would rewrite a
  record, and the suite asserts the guard is present and refusing after every migration test, not merely that
  the migration completed.
- [Recovery reads platform state, which is a network call at start, against a platform that may be rate-limiting
  or down] → Reconciliation runs per job after the window is shown, concludes nothing from a failure to reach the
  platform, and retries. A start is never blocked by it.
- [The account total across devices is unmeasured — RISK-069] → Out of scope here and owned by
  `req-022-account-sync`; this change states per-device numbers only and invents no account-wide budget.
- [Pinning the binding generation ties the product to one library's release policy] → The pin is to a
  binary-compatible interface standard rather than to an internal one, which is precisely what removes the
  framework-upgrade coupling that RISK-046 records. The exposure that remains is ordinary dependency risk.

## Open Questions

- How long does the local classification pass take against a store holding a full retention period of records?
  It does not change the specs, the approach or the tasks — the pass is required before the first window either
  way — but it would let `verification.md` state a startup budget as a threshold instead of as an observation.
  Measured during implementation; carried as Q-6 in `clarifications.md`.
- Should the removal transaction also force a checkpoint of the write-ahead file, or is the next ordinary
  checkpoint soon enough for the disk space to be returned? It affects only when space is reclaimed after a
  deletion, not whether records are removed, and is settled by measuring during implementation.

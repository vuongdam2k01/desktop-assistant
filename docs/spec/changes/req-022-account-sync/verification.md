# Verification: req-022-account-sync

The delta scenarios in `specs/` are the test cases and are not restated here. This file carries what a scenario
cannot express: the numbers, the corpora, the combinations, the regression surface, and the judgements only a
person can make.

One thing governs the whole file and is stated once rather than repeated per row. Planning proceeded past the
SP-22 gate by the decision recorded in `clarifications.md` Q-5 and its same-day reversal, and the price of that
is paid here: **every quantity this change introduces is unverified.** Nothing below invents a number to fill a
cell. A threshold either cites a VERIFIED spike section or says plainly that SP-22 must produce it, and the
Definition of Done treats an unmet unverified threshold as a blocker rather than a note.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "The application shows whether this device is up to date with the account", ensuring the backend cannot be reached holds without contradiction or unhandled failure | Requirement "The application shows whether this device is up to date with the account"; Scenario "The backend cannot be reached"; Scenario "Work is waiting to replicate" | specs/app/spec.md |
| AC-2 | The product fulfills requirement "The application lists the account's devices and lets the user revoke any of them", ensuring revocation states its consequence holds without contradiction or unhandled failure | Requirement "The application lists the account's devices and lets the user revoke any of them"; Scenario "Revocation states its consequence"; Scenario "Revoking the device in use" | specs/app/spec.md |
| AC-3 | The product fulfills requirement "Sign-out states what it destroys and what has not been shared", ensuring unreplicated work at sign-out holds without contradiction or unhandled failure | Requirement "Sign-out states what it destroys and what has not been shared"; Scenario "Unreplicated work at sign-out"; Scenario "Sign-out while a job is running" | specs/app/spec.md |
| AC-4 | The product fulfills requirement "The application window holds four areas", ensuring every waiting decision is reachable in one place holds without contradiction or unhandled failure | Requirement "The application window holds four areas"; Scenario "Every waiting decision is reachable in one place"; Scenario "A platform that is not yet connected" | specs/app/spec.md |
| AC-5 | The product fulfills requirement "The job list updates live and surfaces what needs the user", ensuring a job starts requiring approval while the list is open holds without contradiction or unhandled failure | Requirement "The job list updates live and surfaces what needs the user"; Scenario "A job starts requiring approval while the list is open"; Scenario "No jobs yet" | specs/app/spec.md |
| AC-6 | The product fulfills requirement "The user can delete their account and the data that follows from it", ensuring deletion is explicit about its scope holds without contradiction or unhandled failure | Requirement "The user can delete their account and the data that follows from it"; Scenario "Deletion is explicit about its scope"; Scenario "A connector cannot be revoked automatically" | specs/app/spec.md |
| AC-7 | The product fulfills requirement "The backend stores the account's replicated data encrypted at rest", ensuring stored data is not readable from the database alone holds without contradiction or unhandled failure | Requirement "The backend stores the account's replicated data encrypted at rest"; Scenario "Stored data is not readable from the database alone"; Scenario "A key is unavailable" | specs/backend/spec.md |
| AC-8 | The product fulfills requirement "Key access is confined to the replication path, least-privileged and audited", ensuring a path outside replication requests a key holds without contradiction or unhandled failure | Requirement "Key access is confined to the replication path, least-privileged and audited"; Scenario "A path outside replication requests a key"; Scenario "Access leaves an audit record" | specs/backend/spec.md |
| AC-9 | The product fulfills requirement "The backend maintains the account's device registry", ensuring a revoked device presents a valid-looking session holds without contradiction or unhandled failure | Requirement "The backend maintains the account's device registry"; Scenario "A revoked device presents a valid-looking session"; Scenario "Registry reflects enrolment immediately" | specs/backend/spec.md |
| AC-10 | The product fulfills requirement "The backend serves replication without executing the account's work", ensuring a replicated record describes a tool call holds without contradiction or unhandled failure | Requirement "The backend serves replication without executing the account's work"; Scenario "A replicated record describes a tool call"; Scenario "Conflict resolution is applied without reading meaning" | specs/backend/spec.md |
| AC-11 | The product fulfills requirement "Account deletion removes the account's server-side records", ensuring sessions stop working immediately holds without contradiction or unhandled failure | Requirement "Account deletion removes the account's server-side records"; Scenario "Sessions stop working immediately"; Scenario "Replicated data does not survive the account" | specs/backend/spec.md |
| AC-12 | The product fulfills requirement "Backend data is backed up and the restore is proven", ensuring restore rehearsal holds without contradiction or unhandled failure | Requirement "Backend data is backed up and the restore is proven"; Scenario "Restore rehearsal"; Scenario "Backup contents are not readable on their own" | specs/backend/spec.md |
| AC-13 | The product fulfills requirement "Connecting a platform connects it for the account, not for one device", ensuring a second device inherits a connection holds without contradiction or unhandled failure | Requirement "Connecting a platform connects it for the account, not for one device"; Scenario "A second device inherits a connection"; Scenario "Bring-your-own authorisation client follows the account" | specs/connector/spec.md |
| AC-14 | The product fulfills requirement "Disconnecting revokes and erases the authorisation", ensuring disconnect while a job is using the connector holds without contradiction or unhandled failure | Requirement "Disconnecting revokes and erases the authorisation"; Scenario "Disconnect while a job is using the connector"; Scenario "Platform offers no revoke endpoint" | specs/connector/spec.md |
| AC-15 | The product fulfills requirement "Connector state is visible and recoverable in one action", ensuring authorisation is revoked at the platform holds without contradiction or unhandled failure | Requirement "Connector state is visible and recoverable in one action"; Scenario "Authorisation is revoked at the platform"; Scenario "Reconnect restores the running state" | specs/connector/spec.md |
| AC-16 | The product fulfills requirement "A ledger record carries the device that wrote it and its position in that device's sequence", ensuring reading where a step ran holds without contradiction or unhandled failure | Requirement "A ledger record carries the device that wrote it and its position in that device's sequence"; Scenario "Reading where a step ran"; Scenario "A device's sequence does not restart" | specs/ledger/spec.md |
| AC-17 | The product fulfills requirement "A superseded version of a mutable record is preserved in the ledger", ensuring reading why a rule changed holds without contradiction or unhandled failure | Requirement "A superseded version of a mutable record is preserved in the ledger"; Scenario "Reading why a rule changed"; Scenario "No conflict, no record" | specs/ledger/spec.md |
| AC-18 | The product fulfills requirement "The ledger is append-only", ensuring correcting a recorded mistake holds without contradiction or unhandled failure | Requirement "The ledger is append-only"; Scenario "Correcting a recorded mistake"; Scenario "External modification attempt" | specs/ledger/spec.md |
| AC-19 | The product fulfills requirement "Retention is bounded, configurable and deleted only deliberately", ensuring deletion is warned about holds without contradiction or unhandled failure | Requirement "Retention is bounded, configurable and deleted only deliberately"; Scenario "Deletion is warned about"; Scenario "Retention expiry removes attachments too" | specs/ledger/spec.md |
| AC-20 | The product fulfills requirement "Credentials are held in operating-system secure storage", ensuring credential is not recoverable from the application directory holds without contradiction or unhandled failure | Requirement "Credentials are held in operating-system secure storage"; Scenario "Credential is not recoverable from the application directory"; Scenario "Secure storage is unavailable" | specs/platform/spec.md |
| AC-21 | The product fulfills requirement "Account sign-in alone restores the account's data on a new device", ensuring replacement device after the original is lost holds without contradiction or unhandled failure | Requirement "Account sign-in alone restores the account's data on a new device"; Scenario "Replacement device after the original is lost"; Scenario "Enrolment is interrupted before it completes" | specs/sync/spec.md |
| AC-22 | The product fulfills requirement "The replicated set is exactly the account-owned stores", ensuring a device-local concern is not replicated holds without contradiction or unhandled failure | Requirement "The replicated set is exactly the account-owned stores"; Scenario "A device-local concern is not replicated"; Scenario "Transcripts follow the ledger's retention" | specs/sync/spec.md |
| AC-23 | The product fulfills requirement "Each replicated store declares its own conflict-resolution rule", ensuring a store is added without changing the protocol holds without contradiction or unhandled failure | Requirement "Each replicated store declares its own conflict-resolution rule"; Scenario "A store is added without changing the protocol"; Scenario "A store declares no rule" | specs/sync/spec.md |
| AC-24 | The product fulfills requirement "Append-only stores resolve by append-and-reconcile", ensuring two devices append while both are offline holds without contradiction or unhandled failure | Requirement "Append-only stores resolve by append-and-reconcile"; Scenario "Two devices append while both are offline"; Scenario "The same record arrives twice" | specs/sync/spec.md |
| AC-25 | The product fulfills requirement "Replicated records present in the same order on every device", ensuring device clocks disagree holds without contradiction or unhandled failure | Requirement "Replicated records present in the same order on every device"; Scenario "Device clocks disagree"; Scenario "Undo reads a replicated job" | specs/sync/spec.md |
| AC-26 | The product fulfills requirement "A conflicting mutable record resolves deterministically and keeps the superseded version", ensuring an approval rule is edited on two devices offline holds without contradiction or unhandled failure | Requirement "A conflicting mutable record resolves deterministically and keeps the superseded version"; Scenario "An approval rule is edited on two devices offline"; Scenario "The user restores a superseded version" | specs/sync/spec.md |
| AC-27 | The product fulfills requirement "The local store is the working copy and the product runs without the backend", ensuring backend is unreachable for an extended period holds without contradiction or unhandled failure | Requirement "The local store is the working copy and the product runs without the backend"; Scenario "Backend is unreachable for an extended period"; Scenario "Accumulated local work replicates on reconnection" | specs/sync/spec.md |
| AC-28 | The product fulfills requirement "A job executes only on the device that created it", ensuring watching a job from a second device holds without contradiction or unhandled failure | Requirement "A job executes only on the device that created it"; Scenario "Watching a job from a second device"; Scenario "The creating device goes offline mid-job" | specs/sync/spec.md |
| AC-29 | The product fulfills requirement "Every enrolled device is visible and revocable by the user", ensuring revoking an unrecognised device holds without contradiction or unhandled failure | Requirement "Every enrolled device is visible and revocable by the user"; Scenario "Revoking an unrecognised device"; Scenario "Revoking the device in use" | specs/sync/spec.md |
| AC-30 | The product fulfills requirement "Replicated authorisation is usable only under a bounded lease", ensuring a device stays offline past the lease period holds without contradiction or unhandled failure | Requirement "Replicated authorisation is usable only under a bounded lease"; Scenario "A device stays offline past the lease period"; Scenario "Lease is refreshed by ordinary use" | specs/sync/spec.md |
| AC-31 | The product fulfills requirement "A signed-out or revoked device erases the account's data from itself", ensuring sign-out erases the local copy holds without contradiction or unhandled failure | Requirement "A signed-out or revoked device erases the account's data from itself"; Scenario "Sign-out erases the local copy"; Scenario "Unreplicated local work at sign-out" | specs/sync/spec.md |
| AC-32 | The product fulfills requirement "Replication serves one account and no other", ensuring session belongs to a different account holds without contradiction or unhandled failure | Requirement "Replication serves one account and no other"; Scenario "Session belongs to a different account"; Scenario "Two accounts on one machine" | specs/sync/spec.md |
| AC-33 | The product fulfills requirement "Deleting the account destroys its replicated data", ensuring deletion covers the replicated stores holds without contradiction or unhandled failure | Requirement "Deleting the account destroys its replicated data"; Scenario "Deletion covers the replicated stores"; Scenario "An enrolled device reconnects after deletion" | specs/sync/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Local ledger volume, per device, 90-day retention | 12.36 MB at 1,800 jobs; 30.83 MB at 4,500 jobs | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | **verified** — inherited baseline. Replication must not regress it; it is not a target for this change |
| Local ledger detail-query latency | p50 between 0.13 ms and 0.25 ms, ext4 and NTFS | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | **verified** — inherited baseline. Adding replication metadata columns must leave local reads inside it |
| Backend concurrent load | 200 concurrent connections at 0.00 percent error rate, twice the expected closed-beta scale | `spikes/SP-20-backend-slice/REPORT.md` §0, §1 Q9 | **verified** — pre-replication baseline, measured without encryption or replication volume |
| Backend median database latency under that load | ~1.5 s on a development machine | `spikes/SP-20-backend-slice/REPORT.md` §4, RISK-060 | **verified** — and already the weakest number in the system before this change adds to it |
| Session access-token lifetime | 15 minutes; refresh 30 days | `spikes/SP-20-backend-slice/REPORT.md` §1 Q1 | **verified** — relevant because it is *not* the lease bound; design.md D5 records why session liveness and replication liveness are different questions |
| Backend availability during beta | ≥ 99.5 percent monthly | `docs/raw-idea/prd-mvp.md#11-5-backend` (NFR-BE-01) | **unverified** — the source marks it a proposal to calibrate against beta size, which remains `Q-OQ-8` |
| Lease expiry bound | Not fixed | design.md R2, RISK-066 | **unverified** — SP-22 must source it. Until it does, the requirement asserts only that a bounded period exists |
| Account-total replicated volume | Not fixed | design.md R4, RISK-069 | **unverified** — SP-12's figure is per device and predates transcripts joining the replicated set by Q-4 |
| Per-exchange transfer volume | Not fixed | design.md R4 | **unverified** — SP-22. Also the input that decides the compression slot reserved in `evolution.md` |
| Enrolment duration, replacement device | Not fixed | design.md R6 | **unverified** — SP-22. Decides whether progressive availability during restore is needed |
| Backend latency and error rate with encryption and replication active | Not fixed | design.md R3 | **unverified** — SP-22, measured against the RISK-060 baseline above, not against zero |
| Revocation latency, server-side effect | Not fixed | design.md D5, RISK-066 | **unverified** — SP-22. Distinct from the lease bound: this is how fast the backend stops serving, not how long the device keeps acting |
| Version-vector size at realistic device counts | Not fixed | design.md R1 | **unverified** — SP-22. Decides whether hybrid logical clocks displace the vector |
| Resident memory during enrolment, both sides | Not fixed | design.md R6 | **unverified** — SP-22. The structural constraint is known (neither side holds whole account state resident); the number is not |

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Local ledger volume, per device, 90-day retention — 12.36 MB at 1,800 jobs; 30.83 MB at 4,500 jobs | Scenarios evaluated under representative workloads citing `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | 50 observations across target conditions | Observable behavior confirms local ledger volume, per device, 90-day retention complies with threshold 12.36 MB at 1,800 jobs; 30.83 MB at 4,500 jobs |
| Local ledger detail-query latency — p50 between 0.13 ms and 0.25 ms, ext4 and NTFS | Scenarios evaluated under representative workloads citing `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | 50 observations across target conditions | Observable behavior confirms local ledger detail-query latency complies with threshold p50 between 0.13 ms and 0.25 ms, ext4 and NTFS |
| Backend concurrent load — 200 concurrent connections at 0.00 percent error rate, twice the expected closed-beta scale | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md` §0, §1 Q9 | 50 observations across target conditions | Observable behavior confirms backend concurrent load complies with threshold 200 concurrent connections at 0.00 percent error rate, twice the expected closed-beta scale |
| Backend median database latency under that load — ~1.5 s on a development machine | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md` §4, RISK-060 | 50 observations across target conditions | Observable behavior confirms backend median database latency under that load complies with threshold ~1.5 s on a development machine |
| Session access-token lifetime — 15 minutes; refresh 30 days | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md` §1 Q1 | 50 observations across target conditions | Observable behavior confirms session access-token lifetime complies with threshold 15 minutes; refresh 30 days |
| Backend availability during beta — ≥ 99.5 percent monthly | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms backend availability during beta complies with threshold ≥ 99.5 percent monthly |
| Lease expiry bound — Not fixed | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms lease expiry bound complies with threshold Not fixed |
| Account-total replicated volume — Not fixed | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms account-total replicated volume complies with threshold Not fixed |
| Per-exchange transfer volume — Not fixed | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms per-exchange transfer volume complies with threshold Not fixed |
| Enrolment duration, replacement device — Not fixed | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms enrolment duration, replacement device complies with threshold Not fixed |
| Backend latency and error rate with encryption and replication active — Not fixed | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms backend latency and error rate with encryption and replication active complies with threshold Not fixed |
| Revocation latency, server-side effect — Not fixed | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms revocation latency, server-side effect complies with threshold Not fixed |
| Version-vector size at realistic device counts — Not fixed | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms version-vector size at realistic device counts complies with threshold Not fixed |
| Resident memory during enrolment, both sides — Not fixed | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms resident memory during enrolment, both sides complies with threshold Not fixed |

## Contract Conformance

This change freezes four machine-readable contract files. Each is judged by a condition observable against the
service, its store and a pair of devices, never by running a validator over the file.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/replication-protocol.sql` | Every column the backend reads to route, order or resolve a record lies outside the ciphertext, and a complete exchange — including a conflict resolved on a mutable store — is served with the payload never decrypted | `specs/backend/spec.md`, the requirement that the backend serves replication without executing the account's work; `specs/sync/spec.md`, the conflict-resolution requirements |
| `contracts/replication-protocol.sql` | No ordering path reads the recorded time: two records written on different devices with clocks set apart still present in the same order on every device | `specs/sync/spec.md`, the requirement that replicated records present in the same order on every device; INV-SYNC-06 |
| `contracts/replication-protocol.sql` | A redelivered record reconciles to the row already held instead of appending a second one, and a record offered with a version above zero for an append-only store leaves the stored row unchanged | `specs/sync/spec.md`, the append-and-reconcile requirement; INV-SYNC-04 |
| `contracts/replication-protocol.sql` | A key-access record cannot be edited or removed by the path that produced it, and the attempt is refused rather than silently absorbed | `specs/backend/spec.md`, the requirement that key access is confined to the replication path, least-privileged and audited; INV-SYNC-08 |
| `contracts/replication-protocol.sql` | Checkpoints are per device and per store: interrupting one store's transfer and resuming it leaves every other store's position untouched, and no store restarts from the beginning | `specs/sync/spec.md`, the requirement that account sign-in alone restores the account's data on a new device; INV-SYNC-09 |
| `contracts/replicated-store-descriptor.schema.json` | A descriptor that omits a required field or carries an invalid value causes the descriptor set to be refused before registration and before the replication handshake: no record is pushed or pulled, no checkpoint or partially current state is created, and no partial exchange is reported as success | `specs/sync/spec.md`, the requirement that each replicated store declares its own conflict-resolution rule; `model.md` §Manifest Schema, Fallback on Missing Manifest; `contracts/replicated-store-descriptor.md` §Error Matrix |
| `contracts/replication-protocol.openapi.yaml` | A device that exchanges only through the four operations in the file — never receiving the change stream — reaches the same state as one that receives it | `specs/sync/spec.md`, the requirement that the local store is the working copy and the product runs without the backend |
| `contracts/replication-protocol.openapi.yaml` | Revocation is answered on every operation and is terminal; an expired lease refuses a push and never a pull, so a device whose lease has lapsed can still catch up | `specs/sync/spec.md`, the lease and revocation requirements; INV-SYNC-07 |
| `contracts/device-registry.openapi.yaml` | A revocation request carrying no confirmation is refused and nothing is revoked; a confirmed one takes effect at the backend before the response, whether or not the revoked device is reachable | `specs/sync/spec.md`, the requirement that every enrolled device is visible and revocable by the user; `specs/app/spec.md`, the confirmation wording requirement |
| `contracts/device-registry.openapi.yaml` | A device state the client does not recognise is treated as non-permissive, and a lease-expired device is never presented as though it had been revoked | `sync/contracts/device-registry@0.1.0`, Compatibility; `specs/app/spec.md`, the device-list requirement |
| All four files | Adding a replicated store changes none of them: a store appears only as an identifier and a descriptor | `specs/sync/spec.md`, the requirement that the replicated set is exactly the account-owned stores; `model.md` §Variability |

## Combination Matrix

`req-022-account-sync` belongs to the `account-sync` cluster added to `docs/spec/config.yaml` at constitution
2.0.0. The combinations below are the ones where a property genuinely changes, not the full cross-product.

| Dimension | Values |
| --- | --- |
| Operating system | Windows (verified ground), macOS (unverified — SP-11 deferred it; design.md R5) |
| Device count | 1 (no conflict path reachable), 2 (the case every conflict rule is written for), 3+ (the case none of them were written for — CHK025) |
| Connectivity | Both online, one offline then reconnecting, both offline then both reconnecting, partitioned mid-exchange |
| Store class | Append-only (ledger, transcripts), mutable (rules, configuration, connector authorisation) |
| Device standing | Active, lease-expired, revoked-and-reachable, revoked-and-offline |
| Build parity | Both devices current, one device a MINOR behind, one device a MAJOR behind |

Required combinations, at minimum: every store class against every connectivity value at device count 2; the
three-device case against mutable stores specifically, since that is where the two-device conflict rule is least
certain; revoked-and-offline against connector use, since that is RISK-066's exact shape; and MAJOR build
disparity against both store classes, to confirm that replication refuses rather than partially exchanging.

macOS cannot be marked complete on inherited evidence. SP-11 verified Windows only, and this change adds
replication material to the storage whose macOS behaviour was never measured.

## Regression Scope

Every scenario in each capability below reruns during verification, not only the deltas this change wrote.

- `sync` — new capability; the entire spec is delta, but reruns as a whole once merged.
- `backend` — MODIFIED. Gains the replication store, key custody and the device registry, and its privacy
  invariant is restated and weakened. The property SP-20 §1 Q4 proved by database dump is deliberately reversed,
  so that spike's assertion must be re-expressed rather than re-run unchanged.
- `ledger` — MODIFIED. Append-only must now hold across replicas; retention becomes account-wide. The store's own
  enforcement (SP-12 §1 Q2) and crash recovery (SP-12 §1 Q4) must both still hold after the schema migration.
- `platform` — MODIFIED. Secure storage now holds replication material, and the decryption-failure path changed
  from "reconnect everything" to "re-sync from the account".
- `connector` — MODIFIED. Authorisation is account-scoped; disconnect propagates across devices; a new connector
  state exists.
- `app` — MODIFIED. Sync state, device list, revocation, and the job list now spanning the account.
- `job` — consumer, not modified here. Job records replicate and a job's state is visible from a device that does
  not execute it; the pinning requirement must not disturb job lifecycle scenarios.
- `undo` — consumer, not modified here. Undo reads the ledger in order, and this change alters what "in order"
  means across devices. Its scenarios are the sharpest test of D2 that already exists.
- `approval` — consumer, not modified here. Rules are a mutable replicated store resolving by
  last-writer-wins-with-preservation, and an approval can be answered from a device other than the one waiting.
  The hard gate itself does not move and must be shown not to have.

`agent`, `pet` and `uix` are outside the regression scope: nothing in this change reaches them, and their
scenarios do not read replicated state.

## Manual Checks

- Read the audit trail of a real key access and confirm it identifies account, path and time, and that the path
  which caused it cannot alter it. INV-SYNC-08 is the whole of the privacy boundary; an automated assertion that
  records exist does not establish that none are missing — owner: engineering, with product-owner sight of the
  result, since principle VII's claim to the user rests on it.
- Judge whether the sign-out confirmation wording conveys what is destroyed and what has not been shared, well
  enough that a user would not sign out expecting to keep something — owner: product owner.
- Judge whether the device registry gives a user enough to recognise their own machines and spot one they do not
  know. RISK-064 makes this the user's only visibility into the gate on their entire history — owner: product
  owner.
- Confirm that the reversal of SP-20's "no work content on the server" property is stated wherever that spike's
  conclusion is relied upon, so no later reader cites a superseded guarantee — owner: engineering.
- Confirm that the replicated set in the shipped descriptor registry matches the set stated in
  `specs/sync/spec.md`, by reading both. The descriptor `membership` field exists for this check and is prose by
  design — owner: engineering.
- Decide whether the accepted exposure in RISK-062 remains acceptable once real user content is in the store,
  rather than treating the original acceptance as permanent — owner: product owner, before the beta opens.

## Open Measurement Gaps

- **Backend availability during beta.** Stated threshold "≥ 99.5 percent monthly" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Lease expiry bound.** Stated threshold "Not fixed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Account-total replicated volume.** Stated threshold "Not fixed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Per-exchange transfer volume.** Stated threshold "Not fixed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Enrolment duration, replacement device.** Stated threshold "Not fixed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Backend latency and error rate with encryption and replication active.** Stated threshold "Not fixed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Revocation latency, server-side effect.** Stated threshold "Not fixed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Version-vector size at realistic device counts.** Stated threshold "Not fixed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Resident memory during enrolment, both sides.** Stated threshold "Not fixed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

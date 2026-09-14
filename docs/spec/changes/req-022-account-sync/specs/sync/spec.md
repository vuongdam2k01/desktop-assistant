## Purpose

Owns making the account's data the same on every signed-in device: the replication protocol between a device's local store and the backend, the conflict-resolution rule each replicated store declares, the registry of enrolled devices and their revocation, and the enrolment path that lets a device recover the full account state from sign-in alone without the user carrying anything between machines.

## ADDED Requirements

### Requirement: Account sign-in alone restores the account's data on a new device

A device that completes account sign-in SHALL receive the account's replicated data without the user supplying
any secret, file, recovery code or previously enrolled device.

Source: `docs/spec/constitution.md` principle VII, decision-maker directive 2026-09-12 — UNVERIFIED; no spike has
measured enrolment, which RISK-070 records.

#### Scenario: Replacement device after the original is lost
- **GIVEN** the account's only previously enrolled device is lost and cannot be reached
- **WHEN** the user signs in on a newly acquired device
- **THEN** the account's replicated data is restored to it, and at no point is the user asked for a passphrase, a
  recovery code, an exported file, or confirmation from the lost device

#### Scenario: Enrolment is interrupted before it completes
- **GIVEN** a device is signing in and the transfer of replicated data is interrupted
- **WHEN** the device reconnects
- **THEN** enrolment resumes from where it stopped rather than restarting, and the device does not present
  partially restored data as if it were complete

#### Scenario: Account has no data yet
- **WHEN** the first device ever to sign in to an account completes enrolment
- **THEN** it starts with an empty account state and reports enrolment as complete, rather than waiting for data
  that does not exist

### Requirement: The replicated set is exactly the account-owned stores

Replication SHALL carry jobs, ledger records and their snapshots, approval rules, provider and application
configuration, connector authorisation, and agent transcripts; and SHALL NOT carry data outside that set.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED.

#### Scenario: A device-local concern is not replicated
- **WHEN** the replicated set is enumerated
- **THEN** device-local concerns such as window position, the pet's on-screen placement and the local cache of
  update artifacts are absent from it

#### Scenario: Transcripts follow the ledger's retention
- **GIVEN** the ledger retention period has elapsed for a job's records
- **WHEN** retention is applied
- **THEN** that job's transcript is removed with its ledger records on every device and on the backend, rather
  than persisting after the records it belongs to

### Requirement: Each replicated store declares its own conflict-resolution rule

Every replicated store SHALL declare the rule by which a conflict in that store is resolved, and the replication
protocol SHALL apply the declared rule rather than imposing a single rule on all stores.

Source: `docs/spec/changes/req-022-account-sync/clarifications.md` Q-1 — UNVERIFIED.

#### Scenario: A store is added without changing the protocol
- **WHEN** a new replicated store is introduced with its resolution rule declared
- **THEN** the replication protocol carries it with no change to the protocol itself

#### Scenario: A store declares no rule
- **WHEN** a store is presented for replication without a declared resolution rule
- **THEN** it is refused rather than replicated under a default, so no store can silently inherit a rule that
  discards its data

### Requirement: Append-only stores resolve by append-and-reconcile

Conflicts in the ledger and in agent transcripts SHALL be resolved by appending and reconciling every
participating record, and SHALL NOT be resolved by last-writer-wins or by any rule that discards a record.

Source: `docs/spec/constitution.md` principle III, `docs/spec/changes/req-022-account-sync/clarifications.md`
Q-1 — UNVERIFIED; RISK-065.

#### Scenario: Two devices append while both are offline
- **GIVEN** two devices each appended ledger records for different jobs while disconnected
- **WHEN** both reconnect and replicate
- **THEN** every record from both devices is present on both devices and on the backend, and none was overwritten

#### Scenario: The same record arrives twice
- **WHEN** a ledger record already present is received again from replication
- **THEN** it is reconciled as the same record rather than appended a second time, and the existing record is
  left unmodified

#### Scenario: Last-writer-wins is attempted against an append-only store
- **WHEN** a resolution that would replace or discard an existing ledger record is attempted by any route
- **THEN** it is refused, and the attempt is itself recorded

### Requirement: Replicated records present in the same order on every device

Replicated records SHALL be ordered by a basis that is independent of device wall-clock time, such that every
device presents the account's records in the same order.

Source: `docs/spec/changes/req-022-account-sync/clarifications.md` Q-2 — UNVERIFIED; RISK-068 records the
measurement as outstanding.

#### Scenario: Device clocks disagree
- **GIVEN** two devices whose system clocks differ by several minutes
- **WHEN** each appends records and both replicate
- **THEN** both devices present the combined records in the same order, and that order does not change when a
  device's clock is corrected

#### Scenario: Undo reads a replicated job
- **GIVEN** a job whose ledger records were written on one device and replicated to another
- **WHEN** undo reads the ledger on the second device
- **THEN** it reads the steps in the order they were performed

#### Scenario: Recorded time remains visible
- **WHEN** a user reads a replicated record
- **THEN** the time it was recorded is shown, and it is not used to order the record against records from other
  devices

### Requirement: A conflicting mutable record resolves deterministically and keeps the superseded version

When the same mutable record is edited on more than one device, the version the backend receives last SHALL
become current, and the superseded version SHALL be appended to the ledger so the user can read it and restore
it.

Source: `docs/spec/changes/req-022-account-sync/clarifications.md` Q-1 — UNVERIFIED.

#### Scenario: An approval rule is edited on two devices offline
- **GIVEN** the same approval rule was edited differently on two devices while both were disconnected
- **WHEN** both reconnect
- **THEN** one version becomes current on every device, the other is present in the ledger as superseded, and the
  user is able to restore it

#### Scenario: The user restores a superseded version
- **WHEN** the user restores a superseded version from the ledger
- **THEN** it becomes current by the ordinary edit path, and the version it replaced is itself recorded as
  superseded

#### Scenario: Resolution does not block use of the record
- **WHEN** a mutable record has just been resolved
- **THEN** the record is immediately usable, and no rule, connector or configuration value is left in a state
  that requires the user to act before it works

### Requirement: The local store is the working copy and the product runs without the backend

Each device SHALL read and write its local store as the working copy, and job execution, approval evaluation,
ledger writing and undo SHALL continue while the backend is unreachable.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED.

#### Scenario: Backend is unreachable for an extended period
- **GIVEN** the backend cannot be reached
- **WHEN** the user runs a job that uses an already-connected connector
- **THEN** the job executes, its ledger records are written locally, and the work is not blocked on replication

#### Scenario: Accumulated local work replicates on reconnection
- **GIVEN** a device worked offline and accumulated jobs and ledger records
- **WHEN** the backend becomes reachable
- **THEN** the accumulated records replicate without the user asking for it

#### Scenario: Replication fails repeatedly
- **WHEN** replication fails repeatedly
- **THEN** the product continues to work against the local store and reports that the account's devices are out
  of step, rather than failing the user's work

### Requirement: A job executes only on the device that created it

A job SHALL execute only on the device where it was created; every other signed-in device SHALL receive its
state, ledger and result without executing any part of it.

Source: `docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED; the in-process object lock and rate
queue are measured in `req-015-concurrency-coordinator`.

#### Scenario: Watching a job from a second device
- **GIVEN** a job is running on one device
- **WHEN** the user opens that job on another signed-in device
- **THEN** its state, steps and result are shown as they progress, and the second device performs no tool call
  for it

#### Scenario: The creating device goes offline mid-job
- **GIVEN** a job is running and its device becomes unreachable
- **WHEN** the user views the job from another device
- **THEN** it is shown as interrupted with the steps recorded so far, and no other device resumes it

#### Scenario: Approval is answered from another device
- **GIVEN** a job on one device is waiting for approval
- **WHEN** the user answers the approval from another signed-in device
- **THEN** the decision is recorded and replicates, and the job resumes on its own device

### Requirement: Every enrolled device is visible and revocable by the user

The account SHALL maintain a registry of its enrolled devices, the user SHALL be able to read it and revoke any
device including the one in use, and revocation SHALL be enforced by the backend rather than depending on the
revoked device.

Source: `docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED; RISK-064, RISK-066.

#### Scenario: Revoking an unrecognised device
- **GIVEN** the registry lists a device the user does not recognise
- **WHEN** the user revokes it
- **THEN** the backend stops serving that device's session and replication, whether or not the device is reachable

#### Scenario: Revoking the device in use
- **WHEN** the user revokes the device they are using
- **THEN** it is treated as a sign-out on that device, and the other devices are unaffected

#### Scenario: A revoked device attempts to replicate
- **WHEN** a revoked device presents its session to the backend
- **THEN** it is refused, and the refusal identifies the session as revoked so the device can act on it

### Requirement: Replicated authorisation is usable only under a bounded lease

A device SHALL use replicated connector authorisation only while holding a lease that is refreshed on each
successful replication and that expires after a bounded period, and an expired lease SHALL stop the device from
using replicated authorisation.

Source: `docs/spec/changes/req-022-account-sync/clarifications.md` Q-3 — UNVERIFIED; the bounded period is a
threshold that spike SP-22 must source, per RISK-066 and RISK-070.

#### Scenario: A device stays offline past the lease period
- **GIVEN** a device has not replicated for longer than the lease period
- **WHEN** a job attempts an operation through a connector
- **THEN** the operation does not proceed, and the user is told the device must reconnect to the account

#### Scenario: Lease is refreshed by ordinary use
- **GIVEN** a device replicates successfully
- **WHEN** the lease is evaluated
- **THEN** it is current, and the user is not asked to do anything to keep it so

#### Scenario: Revocation arrives before the lease expires
- **WHEN** a device learns that it has been revoked
- **THEN** it stops using replicated authorisation at once rather than waiting for the lease to expire

### Requirement: A signed-out or revoked device erases the account's data from itself

On sign-out or on revocation, a device SHALL erase the account's replicated data and its replication material
from itself.

Source: `docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED; RISK-066.

#### Scenario: Sign-out erases the local copy
- **WHEN** the user signs out on a device
- **THEN** the account's jobs, ledger, transcripts, rules, configuration and connector authorisation are erased
  from that device, and the application's data directory holds none of them

#### Scenario: Unreplicated local work at sign-out
- **GIVEN** the device holds records that have not yet replicated
- **WHEN** the user signs out
- **THEN** the product states what has not been replicated and erases only after the user confirms, so work is
  not destroyed without the user knowing

#### Scenario: Erasure completes despite interruption
- **GIVEN** erasure was interrupted by the application stopping
- **WHEN** the application starts again
- **THEN** erasure completes before any account data is readable on that device

### Requirement: Replication serves one account and no other

Replication SHALL serve a device only the data of the account whose session it presents, and SHALL NOT expose one
account's data to another under any condition.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED.

#### Scenario: Session belongs to a different account
- **WHEN** a device requests replication for an account other than the one its session identifies
- **THEN** the request is refused and no data is returned

#### Scenario: Two accounts on one machine
- **GIVEN** two accounts have been signed in on the same machine at different times
- **WHEN** the second account's data is served
- **THEN** it contains nothing belonging to the first account

### Requirement: Deleting the account destroys its replicated data

Deleting the account SHALL destroy its replicated data on the backend as well as its account, device, session and
allowlist records.

Source: `docs/spec/changes/req-022-account-sync/proposal.md`,
`docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12) — UNVERIFIED.

#### Scenario: Deletion covers the replicated stores
- **WHEN** the account is deleted
- **THEN** its jobs, ledger records, snapshots, transcripts, rules, configuration and connector authorisation are
  destroyed on the backend, not only its account record

#### Scenario: An enrolled device reconnects after deletion
- **GIVEN** a device was offline when the account was deleted
- **WHEN** it reconnects
- **THEN** its session is refused and it erases the account's data from itself

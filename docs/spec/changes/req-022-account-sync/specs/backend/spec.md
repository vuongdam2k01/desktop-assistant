## ADDED Requirements

### Requirement: The backend stores the account's replicated data encrypted at rest

The backend SHALL store the account's replicated data encrypted at rest under service-managed keys.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED; RISK-062 records the exposure this accepts, and
RISK-070 records that no spike has measured an encrypted replication store.

#### Scenario: Stored data is not readable from the database alone
- **WHEN** the database's stored contents are read without the encryption keys
- **THEN** no job, ledger record, snapshot, transcript, rule, configuration value or connector authorisation is
  readable from them

#### Scenario: A key is unavailable
- **WHEN** the key needed to serve a request cannot be obtained
- **THEN** the request fails and reports that the data cannot be served, and no plaintext fallback path exists

### Requirement: Key access is confined to the replication path, least-privileged and audited

Access to the keys that decrypt account data SHALL be available only to the path that serves replication to the
same account, SHALL be granted at the least privilege that path requires, and every access SHALL be recorded in
an audit record that identifies what was accessed, by which path and when.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED; these controls are the entire privacy boundary,
per RISK-062, and RISK-063 records that they are enforced by review and audit rather than by mechanism.

#### Scenario: A path outside replication requests a key
- **WHEN** any path other than serving replication to the owning account requests a decryption key
- **THEN** the request is refused and the refusal is recorded

#### Scenario: Access leaves an audit record
- **WHEN** the replication path decrypts an account's data
- **THEN** an audit record is written identifying the account, the path and the time, and that record is not
  modifiable by the path that caused it

#### Scenario: Audit record cannot be written
- **WHEN** the audit record for an access cannot be written
- **THEN** the access does not proceed

### Requirement: The backend maintains the account's device registry

The backend SHALL record every device enrolled to an account, SHALL serve that registry to the account's signed-in
devices, and SHALL enforce revocation of a device independently of that device's cooperation.

Source: `docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED; RISK-064, RISK-066.

#### Scenario: A revoked device presents a valid-looking session
- **GIVEN** a device was revoked while it was offline
- **WHEN** it presents its session to any endpoint
- **THEN** the session is refused, whether or not the device has acknowledged the revocation

#### Scenario: Registry reflects enrolment immediately
- **WHEN** a device completes enrolment
- **THEN** it appears in the registry served to the account's other devices without their signing in again

### Requirement: The backend serves replication without executing the account's work

The backend SHALL accept, store and serve replicated records, and SHALL NOT interpret, execute, evaluate or act
on their content.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED.

#### Scenario: A replicated record describes a tool call
- **WHEN** a ledger record describing a tool call is replicated to the backend
- **THEN** the backend stores and serves it and performs no connector call, approval evaluation or agent step of
  its own

#### Scenario: Conflict resolution is applied without reading meaning
- **WHEN** the backend resolves a conflict between two versions of a record
- **THEN** it applies the store's declared resolution rule, and the resolution does not depend on interpreting
  the record's content

## MODIFIED Requirements

### Requirement: Account deletion removes the account's server-side records

Deleting an account SHALL remove its account, device, session and allowlist records from the backend, and SHALL
destroy its replicated data together with the keys used to encrypt it.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12),
`docs/spec/constitution.md` principle VII — UNVERIFIED; the account-wide consequences are specified in the `sync`
capability by `req-022-account-sync`.

#### Scenario: Sessions stop working immediately
- **GIVEN** the account was signed in on two devices
- **WHEN** the account is deleted
- **THEN** both sessions stop being accepted

#### Scenario: Replicated data does not survive the account
- **WHEN** the account is deleted
- **THEN** its replicated jobs, ledger records, snapshots, transcripts, rules, configuration and connector
  authorisation are destroyed, and the keys that would decrypt them are destroyed with them

### Requirement: Backend data is backed up and the restore is proven

The backend database SHALL be backed up daily, backups SHALL be retained for 30 days, the restore SHALL be
verified rather than assumed, and backups SHALL carry the account's replicated data in its encrypted form under
the same confined key access as the live store.

Source: `docs/raw-idea/prd-mvp.md#11-5-backend` (NFR-BE-04), `docs/spec/constitution.md` principle VII —
UNVERIFIED; the backup now contains user work content, which it did not before `req-022-account-sync`.

#### Scenario: Restore rehearsal
- **WHEN** a restore is performed from a backup into a separate environment
- **THEN** it completes and the restored data is checked against expectations

#### Scenario: Backup contents are not readable on their own
- **WHEN** a backup artifact is read outside the replication path
- **THEN** no account content is readable from it

#### Scenario: Deleted account does not return through a restore
- **GIVEN** an account was deleted after a backup was taken
- **WHEN** that backup is restored
- **THEN** the deleted account's replicated data is not served again

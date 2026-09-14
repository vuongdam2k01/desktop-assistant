# backend Specification

## Purpose
Owns the server-side service: user authentication, brokering connector authorisation, storing and serving the account's replicated data encrypted at rest under service-managed keys, maintaining the device registry, and serving the update manifest. It never executes job logic, and it uses account content for nothing beyond serving replication back to that same account — a boundary enforced by confined key access, least privilege and audit.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence). Amended 2026-09-12 by change `req-022-account-sync` (constitution 2.0.0).

## Requirements

### Requirement: Authentication is Google Sign-In exchanged for an application session

The backend SHALL authenticate a user by verifying a Google identity token supplied by the client and issuing
its own access and refresh session tokens, SHALL allow one account to be signed in on several devices at once,
and signing out SHALL revoke that device's refresh token.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-01),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) — VERIFIED end to end: identity-token
verification, account and device registration, issuance of a short-lived access token alongside a long-lived
refresh token, and renewal through the refresh endpoint.

#### Scenario: Second device signs in
- **GIVEN** the account is already signed in on one device
- **WHEN** the user signs in on a second device
- **THEN** both sessions are valid and both devices are recorded against the account

#### Scenario: Sign-out on one device
- **WHEN** the user signs out on one device
- **THEN** that device's refresh token is revoked and the other device's session continues

#### Scenario: Identity token is invalid or expired
- **WHEN** the supplied identity token fails verification
- **THEN** no session is issued and the failure is reported without revealing whether the account exists

#### Scenario: Session is renewed without signing in again
- **GIVEN** the access token has expired and the refresh token has not
- **WHEN** the device presents the refresh token
- **THEN** a new access token is issued and the user is not asked to sign in

#### Scenario: Same device signs in twice
- **WHEN** a device that is already enrolled signs in again
- **THEN** it remains one device on the account rather than appearing as a second one

### Requirement: Access during the closed beta is gated by an allowlist

The backend SHALL admit only accounts present on an invitation allowlist during the closed beta, and SHALL
provide the minimal administration needed to manage that allowlist.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-01, FR-BE-10),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) — VERIFIED: an address outside the allowlist
was refused with a distinct reason and no session, while listed addresses were admitted and their invitations
marked activated. The size of the beta population remains open question OQ-8.

#### Scenario: Sign-in from an address that is not invited
- **WHEN** a user who is not on the allowlist completes Google Sign-In
- **THEN** no application session is issued and the user is told that access is limited to invited participants

#### Scenario: Invitation is consumed
- **WHEN** an invited user signs in for the first time
- **THEN** the allowlist entry is marked as activated against that account

#### Scenario: Allowlist is empty
- **GIVEN** no invitation has been issued
- **WHEN** any user completes Google Sign-In
- **THEN** no session is issued, and the refusal is the same one an uninvited address receives

#### Scenario: Invitation is withdrawn after activation
- **GIVEN** an account activated an invitation and holds live sessions
- **WHEN** that invitation is withdrawn
- **THEN** the account's existing sessions stop being renewed and a new sign-in is refused

### Requirement: The backend brokers connector authorisation for any provider

The backend SHALL exchange an authorisation code for connector tokens using the provider's client secret held on
the server, SHALL support the proof-key exchange where the provider allows it, and SHALL admit a new provider
through configuration alone without changing the contract it offers the client.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-02),
`docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-03),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3, Q6) — VERIFIED: declaring a second provider
alongside the first cost 19 lines of configuration and no change to the broker, the routes or the client-facing
interface description; a real provider refresh succeeded through the broker. Where the resulting authorisation
is stored is redefined by `req-022-account-sync`, which makes it account-owned rather than device-bound.

#### Scenario: Adding a provider
- **WHEN** a new provider is configured on the server
- **THEN** the client uses the same broker endpoints as for every existing provider

#### Scenario: Authorisation code is rejected by the provider
- **WHEN** the exchange fails
- **THEN** the failure is returned to the client with a reason it can present, and no partial authorisation is
  stored

#### Scenario: Providers differ in how they authenticate the token call
- **GIVEN** one provider expects its client credentials in the request body and another in the request header
- **WHEN** each is brokered
- **THEN** both succeed from the same client-facing interface, with the difference expressed only in that
  provider's configuration

#### Scenario: Provider requires the proof-key exchange
- **WHEN** a provider that requires the proof-key exchange is brokered
- **THEN** the challenge and verifier are carried through the same endpoints used by a provider that does not
  require them

#### Scenario: Client asks for an unconfigured provider
- **WHEN** a device requests an authorisation URL for a provider that is not configured
- **THEN** the request is refused with a reason naming the provider as unsupported, and no authorisation URL is
  produced

### Requirement: The backend never executes job logic or reads content for other purposes

The backend SHALL NOT execute job business logic, SHALL NOT use account content for any purpose beyond serving
replication back to that same account, and SHALL NOT expose one account's content to another.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED; this requirement replaces the PRD's
`NFR-BE-05`, which forbade the server to hold work content at all and was superseded by `req-022-account-sync`.

#### Scenario: Agent execution stays on the device
- **WHEN** a job runs
- **THEN** the agent loop, the approval evaluation and the tool calls all execute on the device, and the backend
  participates only in authentication, brokering, replication and update manifests

#### Scenario: Cross-account isolation
- **WHEN** a request carries a session for one account
- **THEN** it can reach only that account's data

### Requirement: Every endpoint is authenticated and transport is encrypted

Every backend endpoint except authentication, health and version check SHALL require a valid session token, and
all communication SHALL use encrypted transport.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-08),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) — VERIFIED: a missing token, an expired token
and a token bearing an invalid signature were each refused before any account data was read. Health is named
here alongside version check because it must answer while the store is degraded, which the observability
requirement depends on.

#### Scenario: Request without a session
- **WHEN** a request arrives without a valid session token
- **THEN** it is rejected before any account data is read

#### Scenario: Unencrypted request
- **WHEN** a request arrives over an unencrypted channel
- **THEN** it is refused

#### Scenario: Session token has expired
- **WHEN** a request presents an expired session token
- **THEN** it is refused with a reason that distinguishes expiry from rejection, so the client can renew rather
  than sign the user out

#### Scenario: Session token carries an invalid signature
- **WHEN** a request presents a token whose signature does not verify
- **THEN** it is refused, and the reason given does not distinguish which part of the token was wrong

### Requirement: The backend serves version checks and the update manifest

The backend SHALL serve static update manifests (`latest.yml`), installers, and blockmaps for the desktop
application as static artifacts without requiring a session or server-side PKI manifest signing, relying on
client-side SHA-512 payload hashing and operating-system Authenticode signature verification for artifact integrity.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-09, priority Should),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9),
`spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3).

#### Scenario: Client asks whether it is current
- **WHEN** a client requests the version check
- **THEN** it receives the current version and, when an update exists, the manifest describing it

#### Scenario: Version check is requested before sign-in
- **WHEN** a client that holds no session requests the version check
- **THEN** it is answered, so a client can learn it is too old to sign in

#### Scenario: Version check is unavailable
- **WHEN** the version check cannot be reached
- **THEN** the application continues to run and reports that it could not check for updates

#### Scenario: Differential update range request
- **WHEN** an updater requests byte ranges of the update package via HTTP Range header
- **THEN** the backend responds with HTTP 206 Partial Content delivering the requested blockmap segments

### Requirement: The backend is observable and resists abuse

The backend SHALL expose a health endpoint, SHALL log and monitor its operation, and SHALL rate-limit the
authentication and broker endpoints.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-11),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q8) — VERIFIED: the health endpoint exercised the
database connection rather than answering statically, and a burst above the configured rate was refused with a
distinct rate-limit response naming when to retry.

#### Scenario: Repeated authentication attempts
- **WHEN** authentication attempts from one source exceed the configured rate
- **THEN** further attempts are refused for a period and the event is recorded

#### Scenario: Health is reported independently of account data
- **WHEN** the health endpoint is called
- **THEN** it answers without requiring a session and without exposing account information

#### Scenario: Health reflects a failing dependency
- **GIVEN** the backend cannot reach its store
- **WHEN** the health endpoint is called
- **THEN** it reports unhealthy rather than reporting the process as alive

#### Scenario: Rate-limited caller learns when to retry
- **WHEN** a caller is refused for exceeding the rate
- **THEN** the refusal is distinguishable from an authentication failure and states when the caller may retry

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

### Requirement: Server secrets are held in a secret manager and rotated

Server-side secrets, including the provider client secrets used for brokering, SHALL be held in a secret
manager, SHALL NOT appear in the repository, the built artifacts or the logs, and SHALL have a rotation
procedure.

Source: `docs/raw-idea/prd-mvp.md#11-5-backend` (NFR-BE-03),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7) — VERIFIED: client secrets were loaded from
outside the source tree, sensitive fields were redacted in log output, and a scan over the whole source and its
generated logs found no leak. The rotation procedure is UNVERIFIED; the spike did not rotate a secret.

#### Scenario: Secret appears in a log line
- **WHEN** logging output is inspected
- **THEN** no client secret or session token value is present

#### Scenario: Rotating a provider secret
- **WHEN** a provider client secret is rotated
- **THEN** brokering continues without redeploying the client

#### Scenario: Secret scan over source and artifacts
- **WHEN** the source tree and the built artifacts are scanned for credential patterns
- **THEN** no client secret, signing key or session secret is found

#### Scenario: A required secret is absent at startup
- **WHEN** the backend starts without a secret it needs to broker a configured provider
- **THEN** it refuses to serve that provider and reports the missing secret, rather than starting and failing at
  the first exchange

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

### Requirement: The backend meets its availability and load expectations

The backend SHALL sustain at least 99.5 percent monthly availability during the beta with a published status
page, and the authentication and broker endpoints SHALL withstand at least twice the expected concurrent beta
load, demonstrated by a load test on production-equivalent infrastructure before release.

Source: `docs/raw-idea/prd-mvp.md#11-5-backend` (NFR-BE-01, NFR-BE-07),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) — the architecture VERIFIED at 200 concurrent
connections with a 0.00 percent error rate; the latency figures are development-machine measurements and are not
release thresholds, which is why the load test is now required on production-equivalent infrastructure. Both
availability figures remain UNVERIFIED proposals to be calibrated against the beta size, which is open question
OQ-8.

#### Scenario: Load test before release
- **WHEN** the load test runs at twice the expected concurrent beta load
- **THEN** the authentication and broker endpoints continue to answer within their measured limits

#### Scenario: Load test is run on a development machine
- **WHEN** load figures are produced anywhere other than production-equivalent infrastructure
- **THEN** they are recorded as evidence that the architecture holds and are not accepted as release thresholds

#### Scenario: Concurrent sign-ins contend for the store
- **WHEN** the expected beta population signs in concurrently
- **THEN** every request is answered rather than refused, and the latency observed is reported against the
  release threshold

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

### Requirement: Deleting the account withdraws its connector authorisations at the providers

Deleting an account SHALL call the revocation endpoint of every provider the account holds an authorisation for
before the account's records are destroyed, SHALL record for each provider whether the withdrawal succeeded, and
where a provider offers no revocation endpoint SHALL tell the user which platform they must withdraw the
authorisation in themselves.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12),
`spikes/SP-11-secure-storage/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 4 — VERIFIED as the required
sequence, which pairs the device-side erasure with server-side withdrawal; RISK-058 records the platform that
offers no revocation endpoint, so the second half of this requirement is not hypothetical.

#### Scenario: Every connected provider is withdrawn from
- **WHEN** an account holding authorisations for several platforms is deleted
- **THEN** each platform's revocation endpoint is called before the account's records are destroyed

#### Scenario: A provider offers no revocation endpoint
- **WHEN** the account holds an authorisation for a platform that offers no revocation endpoint
- **THEN** the deletion proceeds and the user is told, by name, which platform they must withdraw the
  authorisation in themselves

#### Scenario: A revocation call fails
- **WHEN** a provider's revocation endpoint refuses or cannot be reached
- **THEN** the deletion still proceeds, the failure is recorded against that provider, and the user is told which
  authorisations could not be withdrawn on their behalf

#### Scenario: Every device is offline when the account is deleted
- **GIVEN** no device signed in to the account is reachable
- **WHEN** the account is deleted
- **THEN** the withdrawals are performed from the server without waiting for any device, and each device erases
  its own copy when it next starts

### Requirement: The authentication and brokering store holds only account, device, session and invitation records

The backend's authentication and brokering store SHALL persist only account records, device records, session
records and invitation allowlist records, and SHALL NOT persist connector tokens, user commands, model prompts,
connector-fetched content, agent transcripts or ledger records in it.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) — VERIFIED by a dump of the live
schema and of every table after a complete run. This requirement bounds the authentication and brokering store
only. The account's replicated data is held in a separate encrypted store specified by `req-022-account-sync`,
which is why the original "no work content on the server" claim no longer holds and this narrower one replaces
it.

#### Scenario: Stored shape is inspected after a complete run
- **GIVEN** a user has signed in, connected a platform and run a job
- **WHEN** the authentication and brokering store is dumped in full
- **THEN** it contains only account, device, session and invitation records, and no connector token, command,
  prompt, fetched content, transcript or ledger record appears in it

#### Scenario: A new server-side record type is introduced
- **WHEN** a change adds a record type to the authentication and brokering store
- **THEN** it is admitted only by amending this requirement, so the store's shape cannot widen silently

#### Scenario: Replicated account data is not mixed into this store
- **WHEN** the account's replicated data is written to the backend
- **THEN** it lands in the encrypted replication store and not in the authentication and brokering store, and
  the two remain separable for inspection and for deletion

### Requirement: The authorisation broker retains no provider credential

The broker SHALL return the provider's tokens to the requesting device in the response to the exchange or
refresh call, and SHALL NOT write them to the authentication and brokering store, to a cache or to a log.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4, Q6, Q7) — VERIFIED: the token
traverses broker memory over encrypted transport during the exchange, the table dump after a real Google refresh
shows no trace of it, and the secret scan over source and generated logs found none. Any server-side copy of a
connector authorisation exists only as replicated account data under `req-022-account-sync`, encrypted at rest
and reachable only through the replication path.

#### Scenario: Store is dumped after a successful exchange
- **WHEN** the store is dumped after a device has exchanged an authorisation code through the broker
- **THEN** no provider access token or provider refresh token is present in it

#### Scenario: Provider token is refreshed through the broker
- **WHEN** a device refreshes a provider token through the broker
- **THEN** the new token is returned to that device and no copy of it remains on the server outside the response

#### Scenario: Broker output is logged
- **WHEN** the broker's log output is inspected after an exchange and a refresh
- **THEN** no provider token, client secret or session token value appears in it

### Requirement: Session refresh tokens are held only as an irreversible hash

The backend SHALL store a session refresh token only as an irreversible hash of its value, and SHALL NOT be able
to reproduce a usable refresh token from what it stores.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) — VERIFIED: the session record holds a
one-way hash of the refresh token and its expiry, and nothing else that would reconstitute it.

#### Scenario: Session records are read directly
- **WHEN** the session records are read from the store
- **THEN** no value in them can be presented to the backend as a refresh token

#### Scenario: Refresh token is presented after the session is revoked
- **GIVEN** a device signed out, revoking its session
- **WHEN** that device's refresh token is presented again
- **THEN** the renewal is refused and no new access token is issued

#### Scenario: Refresh token is presented after it has expired
- **WHEN** a refresh token is presented after its expiry
- **THEN** the renewal is refused and the device is required to sign in again

### Requirement: An authorisation exchange is bound to the session and request that began it

The backend SHALL issue an opaque binding value with every authorisation URL it produces, and SHALL refuse an
exchange whose binding value is absent, unrecognised, already used, or issued to a different session.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2, Q3) — the authorisation endpoints sit
behind the session guard and the authorisation URL carries a binding value, both VERIFIED; that the binding is
single-use and session-scoped is UNVERIFIED, because the spike did not exercise a replayed or cross-session
code.

#### Scenario: Authorisation code arrives for a request this session did not start
- **WHEN** an exchange presents a binding value issued to a different session
- **THEN** the exchange is refused and no provider token is obtained

#### Scenario: The same authorisation code is exchanged twice
- **WHEN** an exchange presents a binding value that has already been used
- **THEN** the second exchange is refused

#### Scenario: Exchange arrives without a binding value
- **WHEN** an exchange carries no binding value
- **THEN** it is refused before the provider is contacted

### Requirement: A backend outage blocks only new sign-in, new authorisation, version checks and replication

While the backend is unreachable the product SHALL continue to run jobs, call the model and write the ledger on
the device, and the outage SHALL block only new account sign-in, new connector authorisation through the broker,
the version check, and replication, which resumes from its checkpoint when the backend returns.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q11) — VERIFIED by stopping the backend
process during a live session: model calls go device-direct, connector tokens are already on the device and the
ledger is local, so running work continued. The replication clause is UNVERIFIED and follows from
`req-022-account-sync`; RISK-009 records that devices drift apart until the outage clears.

#### Scenario: Backend stops while a job is running
- **GIVEN** a job is executing tool calls against a connected platform
- **WHEN** the backend becomes unreachable
- **THEN** the job continues, its tool calls execute and its ledger records are written on the device

#### Scenario: User tries to connect a new platform during the outage
- **WHEN** the user activates Connect while the backend is unreachable
- **THEN** the attempt fails with a statement that the service is unavailable and an action to retry, and no
  partial authorisation is left behind

#### Scenario: User tries to sign in on a new device during the outage
- **WHEN** a user signs in on a device that is not yet enrolled while the backend is unreachable
- **THEN** sign-in fails with a statement that the service is unavailable, and no partial enrolment is recorded

#### Scenario: Replication resumes after the outage
- **GIVEN** the device accumulated unreplicated records while the backend was unreachable
- **WHEN** the backend becomes reachable again
- **THEN** replication resumes from its checkpoint rather than restarting, and no record written during the
  outage is lost

### Requirement: The update manifest is served per operating system and per processor architecture

The update manifest service SHALL publish a separate manifest for each supported operating system and each
processor architecture, and SHALL serve for each the package format that operating system's updater can install,
so that a client is never offered a package it cannot apply.

Source: `spikes/SP-16-signing-update/macos/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-16-signing-update/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4),
`spikes/SP-12-sqlite-ledger/macos/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: the macOS updater reads a
manifest of its own and installs from an archive rather than from the disk image the user downloads by hand,
and a package combining both processor architectures is offered as a manual download rather than through the
update feed.

#### Scenario: A client asks for updates

- **WHEN** a client checks for an update
- **THEN** it receives the manifest for its own operating system and processor architecture, naming a package
  its updater can install

#### Scenario: A release is published for one operating system only

- **WHEN** a release is published for one operating system
- **THEN** clients on the other operating system continue to see their current version as the latest, and are
  not offered the package

#### Scenario: A package format the updater cannot install is published

- **WHEN** a manifest would name a package format that the client's updater cannot apply
- **THEN** the manifest is rejected at publication rather than failing on the user's machine

## ADDED Requirements

### Requirement: Authentication is Google Sign-In exchanged for an application session

The backend SHALL authenticate a user by verifying a Google identity token supplied by the client and issuing
its own access and refresh session tokens, SHALL allow one account to be signed in on several devices at once,
and signing out SHALL revoke that device's refresh token.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-01) — UNVERIFIED; measured in
`req-020-backend-slice`.

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

### Requirement: Access during the closed beta is gated by an allowlist

The backend SHALL admit only accounts present on an invitation allowlist during the closed beta, and SHALL
provide the minimal administration needed to manage that allowlist.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-01, FR-BE-10) — UNVERIFIED; the source
marks the allowlist mechanism as a proposal.

#### Scenario: Sign-in from an address that is not invited
- **WHEN** a user who is not on the allowlist completes Google Sign-In
- **THEN** no application session is issued and the user is told that access is limited to invited participants

#### Scenario: Invitation is consumed
- **WHEN** an invited user signs in for the first time
- **THEN** the allowlist entry is marked as activated against that account

### Requirement: The backend brokers connector authorisation for any provider

The backend SHALL exchange an authorisation code for connector tokens using the provider's client secret held on
the server, SHALL support the proof-key exchange where the provider allows it, and SHALL admit a new provider
through configuration alone without changing the contract it offers the client.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-02),
`docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-03) — UNVERIFIED; where the resulting
authorisation is stored is redefined by `req-022-account-sync`, which makes it account-owned rather than
device-bound.

#### Scenario: Adding a provider
- **WHEN** a new provider is configured on the server
- **THEN** the client uses the same broker endpoints as for every existing provider

#### Scenario: Authorisation code is rejected by the provider
- **WHEN** the exchange fails
- **THEN** the failure is returned to the client with a reason it can present, and no partial authorisation is
  stored

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

Every backend endpoint except authentication and version check SHALL require a valid session token, and all
communication SHALL use encrypted transport.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-08) — UNVERIFIED.

#### Scenario: Request without a session
- **WHEN** a request arrives without a valid session token
- **THEN** it is rejected before any account data is read

#### Scenario: Unencrypted request
- **WHEN** a request arrives over an unencrypted channel
- **THEN** it is refused

### Requirement: The backend serves version checks and the update manifest

The backend SHALL serve a version check and an update manifest for the desktop application.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-09, priority Should) — UNVERIFIED;
narrowed to static artifact serving in `req-016-signing-update`.

#### Scenario: Client asks whether it is current
- **WHEN** a client requests the version check
- **THEN** it receives the current version and, when an update exists, the manifest describing it

### Requirement: The backend is observable and resists abuse

The backend SHALL expose a health endpoint, SHALL log and monitor its operation, and SHALL rate-limit the
authentication and broker endpoints.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-11) — UNVERIFIED.

#### Scenario: Repeated authentication attempts
- **WHEN** authentication attempts from one source exceed the configured rate
- **THEN** further attempts are refused for a period and the event is recorded

#### Scenario: Health is reported independently of account data
- **WHEN** the health endpoint is called
- **THEN** it answers without requiring a session and without exposing account information

### Requirement: Account deletion removes the account's server-side records

Deleting an account SHALL remove its account, device, session and allowlist records from the backend.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12) — UNVERIFIED; deletion of the
account's replicated data is specified by `req-022-account-sync`.

#### Scenario: Sessions stop working immediately
- **GIVEN** the account was signed in on two devices
- **WHEN** the account is deleted
- **THEN** both sessions stop being accepted

### Requirement: Server secrets are held in a secret manager and rotated

Server-side secrets, including the provider client secrets used for brokering, SHALL be held in a secret
manager, SHALL NOT appear in the repository, the built artifacts or the logs, and SHALL have a rotation
procedure.

Source: `docs/raw-idea/prd-mvp.md#11-5-backend` (NFR-BE-03) — UNVERIFIED.

#### Scenario: Secret appears in a log line
- **WHEN** logging output is inspected
- **THEN** no client secret or session token value is present

#### Scenario: Rotating a provider secret
- **WHEN** a provider client secret is rotated
- **THEN** brokering continues without redeploying the client

### Requirement: Backend data is backed up and the restore is proven

The backend database SHALL be backed up daily, backups SHALL be retained for 30 days, and the restore SHALL be
verified rather than assumed.

Source: `docs/raw-idea/prd-mvp.md#11-5-backend` (NFR-BE-04) — UNVERIFIED.

#### Scenario: Restore rehearsal
- **WHEN** a restore is performed from a backup into a separate environment
- **THEN** it completes and the restored data is checked against expectations

### Requirement: The backend meets its availability and load expectations

The backend SHALL sustain at least 99.5 percent monthly availability during the beta with a published status
page, and the authentication and broker endpoints SHALL withstand at least twice the expected concurrent beta
load, demonstrated by a load test before release.

Source: `docs/raw-idea/prd-mvp.md#11-5-backend` (NFR-BE-01, NFR-BE-07) — UNVERIFIED; the source marks both
figures as proposals to be calibrated against the beta size, which remains open question OQ-8.

#### Scenario: Load test before release
- **WHEN** the load test runs at twice the expected concurrent beta load
- **THEN** the authentication and broker endpoints continue to answer within their measured limits

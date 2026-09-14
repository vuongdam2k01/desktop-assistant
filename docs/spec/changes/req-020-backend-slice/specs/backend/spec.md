## ADDED Requirements

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

## MODIFIED Requirements

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

The backend SHALL serve a version check and an update manifest for the desktop application, and both SHALL be
served without requiring a session.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-09, priority Should),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) — VERIFIED as an unauthenticated endpoint
under load; narrowed to static artifact serving in `req-016-signing-update`, which owns the manifest's content.

#### Scenario: Client asks whether it is current
- **WHEN** a client requests the version check
- **THEN** it receives the current version and, when an update exists, the manifest describing it

#### Scenario: Version check is requested before sign-in
- **WHEN** a client that holds no session requests the version check
- **THEN** it is answered, so a client can learn it is too old to sign in

#### Scenario: Version check is unavailable
- **WHEN** the version check cannot be reached
- **THEN** the application continues to run and reports that it could not check for updates

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

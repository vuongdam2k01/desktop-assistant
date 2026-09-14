## Context

The backend is a peer of the desktop client, not a hub it depends on. All product logic — the pet, the agents,
the approval hooks, the ledger, undo — runs on the device, and model calls go device-direct. What is left for
the server is what only a server can do: verify an identity, hold a confidential client secret, keep the
account's replicated data, and say which client version is current. That division is what bounds an outage to
new sign-in, new authorisation, the version check and replication, and it was demonstrated rather than argued:
the backend process was stopped mid-session and the running job continued to execute tool calls and write ledger
records — VERIFIED, `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q11).

Two constraints shape everything below. First, principle VI: adding the Nth platform must be a declaration, not
a code change, and the spike measured what that costs when the shape is right — 19 lines of configuration and
zero lines elsewhere. Second, principle VII as redefined at constitution 2.0.0: the account's data now rests on
our infrastructure encrypted at rest, so the old "the server sees nothing" claim is gone. What replaces it is
narrower and easier to erode, which is why this design draws the line inside the server rather than around it:
the authentication and brokering path — the largest surface exposed to the internet — cannot reach a key that
decrypts account data.

The spike is a vertical slice, not a deployment. Its load figures come from a development workstation and are
treated here as evidence that the architecture holds at twice beta scale, never as release thresholds.

## Goals / Non-Goals

**Goals:**
- Fix the authentication and brokering store's shape at four record types, so that what the server holds is
  inspectable rather than asserted.
- Make the authorisation broker provider-agnostic, with every provider difference expressed in a descriptor.
- Keep provider credentials off the device and out of the server's storage at the same time.
- Bound a backend outage to the four things that genuinely need the server.
- Keep key custody for replicated data unreachable from the authentication and brokering path.

**Non-Goals:**
- Executing any job business logic on the server. The constitution forbids it and nothing here approaches it.
- Specifying the encrypted replication store, the replication protocol or the device registry's semantics.
  Those belong to `req-022-account-sync`; this design implements their server side and consumes their contracts.
- Specifying the update artifact, its signing or its verification. `req-016-signing-update` owns them; this
  design serves the version check that points at them.
- Capacity planning. The load result is headroom evidence; release thresholds come from a measurement on
  production-equivalent infrastructure that has not been taken.
- A second identity provider, a public API, or third-party access of any kind.

## Structure

| Component | Responsibility | Model entities | Reached through |
| --- | --- | --- | --- |
| Session issuer | Verifies the identity token, consults the invitation set, creates or finds the account and the device enrolment, issues and renews sessions | Account, Device Enrolment, Session, Invitation | `backend/contracts/client-session-api@0.1.0` |
| Session guard | Refuses every authenticated call that lacks a valid session, before any account data is read | Session | Applied by every authenticated channel; not itself an endpoint |
| Rate limiter | Refuses callers above the class threshold, ahead of the session guard | Rate Limit Window | `backend/contracts/public-service-endpoints@0.1.0` declares the classes |
| Authorisation broker | Issues authorisation URLs with a binding, exchanges codes, refreshes provider tokens, using secrets resolved by name | Authorisation Request, Brokered Exchange, Server Secret | `backend/contracts/authorisation-broker-api@0.1.0` |
| Provider registry | Reads descriptors at startup, resolves their secrets, refuses to serve a provider it cannot fully configure | Provider Descriptor, Authorisation Provider | `backend/contracts/authorisation-provider-descriptor@0.1.0` |
| Account lifecycle | Withdraws authorisations at the providers, then destroys everything reachable from the account in both stores | Account and everything reachable from it, Encrypted Replication Partition | `backend/contracts/client-session-api@0.1.0` |
| Replication service | Accepts, stores and serves replicated records; the only path that may reach a decryption key | Encrypted Replication Partition | `sync/contracts/replication-protocol@0.1.0` — consumed, not owned |
| Device registry service | Persists enrolments and enforces revocation independently of the device | Device Enrolment | `sync/contracts/device-registry@0.1.0` — consumed, not owned |
| Public surface | Answers health and version without a session | Health Probe Result, Release Manifest Reference | `backend/contracts/public-service-endpoints@0.1.0` |

The session issuer, the broker and the account lifecycle share one store. The replication service uses another,
and the two are addressed separately so the first can be dumped in full without the second — which is what makes
the store-shape requirement testable at all.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `session.signIn`, `session.refresh`, `session.signOut`, `account.delete` | Device → Backend, encrypted transport | Request-Response | `client-session-api@0.1.0` | `SessionTokens`, `SignOutResult`, `DeleteAccountResult` | Creates or revokes sessions; creates enrolments; destroys accounts | Error matrix in that contract. Rate-limited in the `authentication` class before verification |
| `broker.authorizeUrl`, `broker.exchange`, `broker.refreshProviderToken` | Device → Backend, encrypted transport | Request-Response | `authorisation-broker-api@0.1.0` | `AuthorizeUrlResult`, `ProviderTokens` | Creates and consumes Authorisation Requests. No token is persisted | Error matrix in that contract. `brokering` rate class. Provider call bounded by a timeout that yields `PROVIDER_UNREACHABLE` |
| `service.health`, `service.version` | Device or operator → Backend | Request-Response | `public-service-endpoints@0.1.0` | `HealthResult`, `VersionResult` | None | `public` rate class. Health answers `unhealthy` rather than failing when the store is unreachable |
| Replication and registry calls | Device ↔ Backend, encrypted transport | Request-Response and Pub-Sub | `sync/contracts/replication-protocol@0.1.0`, `sync/contracts/device-registry@0.1.0` | Per those contracts | Reads and writes the encrypted partition; enforces revocation | Owned by `req-022-account-sync`; this design provides the server side |
| Provider token call | Backend → Provider, encrypted transport | Request-Response | Provider's own, shaped by the descriptor | Provider tokens, passed through | None on our side — INV-BE-03 | Timeout yields `PROVIDER_UNREACHABLE`; a refusal yields `PROVIDER_REJECTED` carrying the provider's reason as untrusted text |
| Provider redirect | Provider → Device, through the user's browser and the operating system's URL handling | Request-Response | Authorisation code and binding, or a refusal | — | Device-side only | A redirect carrying a binding the device did not issue is discarded — `specs/connector/spec.md` |
| Store access | Backend → Relational store | Request-Response | Relational | Rows | Persists the four record types | Unreachable store makes the instance `unhealthy` and authenticated calls yield `SERVICE_UNAVAILABLE` |
| Secret resolution | Backend → Secret manager | Request-Response | Secret name | Secret value, held only for the call | None persisted — INV-BE-05 | Unresolved at startup withholds that provider and reports the missing name |

### Execution Boundaries & Isolation

There are four boundaries and they are not equally trusted.

**Device and backend** are separate machines under separate control. The device is the working copy and the
locus of all product logic; the backend is stateless per request except for its stores, so any instance can
serve any request. Nothing in this design gives an instance affinity to a device — with one exception, the
Authorisation Request, which is why R4 below treats its storage as a design question rather than an
implementation detail.

**Backend and the encrypted replication partition** are separated inside the service. The session issuer, the
broker and the public surface run without any capability to obtain a decryption key; only the replication
service holds that capability, and every use of it produces an audit record it cannot itself modify — INV-BE-07
and the key-access requirement in the living backend spec. This is the whole of the privacy boundary principle
VII now claims, and RISK-063 records that it is enforced by review and audit rather than by mechanism.

**Backend and the providers** are separated by the network and by trust: a provider's response is forwarded to
the device rather than interpreted, and its failure text is displayed rather than acted on.

**Browser and device** is the boundary the binding exists to survive. The authorisation code travels through
software neither side controls; the binding makes the round trip verifiable and is worthless if intercepted.

Recovery: an instance that crashes loses nothing but in-flight calls, because sessions and enrolments are in the
store. A device that loses the backend continues working, replays nothing, and resumes replication from its
checkpoint. A device that is revoked while offline is refused on its next call, whether or not it cooperates.

### Trust Boundaries & Input Validation

Every entry point is untrusted. The identity token is verified against the identity provider before any record
is created, and admission through the invitation set is a second, separate check. `deviceId` scopes an enrolment
and confers nothing; `deviceName` is display text and is never an identifier. The authorisation code and binding
are validated against server-side state — issued to this session, not yet consumed, not expired, same redirect
address — before the provider is contacted. Provider responses are passed through unread except for the fields
the exchange requires. Rate limiting runs ahead of session verification on every class, by INV-BE-09, so an
unauthenticated flood cannot buy the expensive path with worthless tokens. Transport is encrypted everywhere; an
unencrypted request is refused rather than upgraded.

## Decisions

### D1 — The backend is a peer service; model calls and tool calls stay on the device
- **Choice**: the server authenticates, brokers, replicates and serves version checks. It never proxies model
  calls, never executes tool calls, and never evaluates approval.
- **Rationale**: it is what makes an outage survivable, and it was measured that way — the backend was stopped
  mid-job and the job continued. It is also required: principle VII forbids the backend from executing job
  business logic.
- **Alternatives Considered**: a model gateway on the server, which would centralise provider keys and usage
  accounting — rejected because it makes every running job depend on our availability and puts prompt content
  on the path of a service that must not read work content for any other purpose. A thin server holding nothing
  at all — rejected by `req-022-account-sync`, which needs an account-owned store.

### D2 — Provider behaviour lives in a descriptor read at startup, never in the broker
- **Choice**: one declarative descriptor per provider; the registry is read at startup, its secrets resolved
  then; the broker branches on no provider identity.
- **Rationale**: this is the measured property, not an aspiration — a second provider cost 19 configuration
  lines and nothing else, across two providers that differ in how they authenticate the token call and in
  whether they require the proof-key exchange. Resolving secrets at startup converts a class of runtime failure
  into a deployment failure, which the user never sees.
- **Alternatives Considered**: a provider adapter module per platform, which is the conventional shape —
  rejected because it reintroduces code per platform and makes principle VI unfalsifiable. Runtime discovery
  with hot reload — rejected because it defers secret resolution to the first user's exchange and makes the
  brokerable set a request-time property. Detecting a provider's token authentication method by attempting one
  and retrying — rejected because it turns a configuration error into an intermittent failure and spends a live
  authorisation code doing it.

### D3 — The authorisation round trip is threaded by a server-side single-use binding
- **Choice**: `broker.authorizeUrl` issues an opaque binding bound to the session, the provider and the redirect
  address; `broker.exchange` consumes it on attempt. The proof-key verifier is held server-side with it.
- **Rationale**: the code returns through the browser and the operating system's URL handling, neither of which
  the product controls. Server-side state is what makes "this code belongs to this connect attempt" checkable.
  Consuming on attempt rather than on success closes replay as a class rather than case by case.
- **Alternatives Considered**: a self-contained signed state parameter needing no server state — rejected
  because single use requires remembering what was used, so the state is unavoidable and a signed blob only
  hides where it lives. No binding at all, relying on the session guard — rejected because the guard proves who
  is calling, not that this code belongs to the connect they started. A device-held proof-key verifier —
  rejected because it adds a secret to the device for no gain, given the confidential client secret is already
  server-side.

### D4 — Sessions are stored; refresh tokens are stored only as a one-way hash
- **Choice**: a refresh token names its session and carries a secret; the store holds a one-way hash of the
  presented value, its expiry and its revocation mark.
- **Rationale**: revocation must be immediate and must work per device, which requires server-side session state
  regardless. Given that state exists, storing anything from which a token could be reproduced is pure downside:
  it makes a store dump, a backup or a log line into a session-hijacking artifact.
- **Alternatives Considered**: a self-contained signed refresh token with no stored session — rejected because
  revocation then needs a denylist, which is the same state with worse properties. Storing the token value to
  allow lookup — rejected outright.

### D5 — Two stores, with no key path from the authentication side to the replication side
- **Choice**: the authentication and brokering store holds four record types and nothing else; the account's
  replicated data lives in a separate encrypted partition; no authentication or brokering path can obtain a
  decryption key.
- **Rationale**: the store's shape is a requirement precisely because it can be checked by dumping it, and that
  check means nothing if the dump also contains the account's work. Separating them keeps the claim honest after
  the amendment, and confines key access to the path principle VII names.
- **Alternatives Considered**: one store for everything, simpler to operate — rejected because it makes the
  boundary unprovable and puts key access on the most exposed path. Encrypting the four record types as well —
  rejected because it protects little that is not already a hash or an identifier, and would cost the ability to
  demonstrate what the server holds.

### D6 — Rate limiting is applied at the edge in three fixed classes
- **Choice**: `authentication`, `brokering`, `public`. Thresholds are configuration; the classes are not.
  Evaluation precedes session verification.
- **Rationale**: the endpoints that must answer without a session are the ones most worth flooding, and
  verification costs more than refusal. Fixing the classes means a new endpoint must be placed in one rather
  than escaping limiting by being new — which is how limiting usually erodes.
- **Alternatives Considered**: per-endpoint thresholds — rejected for that erosion. Limiting only
  unauthenticated endpoints — rejected because the brokered path reaches an external provider and a flood there
  spends our rate budget at the platform, not only ours.

### D7 — Connection pooling before release; read/write separation only on measurement
- **Choice**: pooling is a release prerequisite. Read/write separation is a reserved topology change, activated
  by a measurement on production-equivalent infrastructure.
- **Rationale**: 200 concurrent writers on a development machine pushed median sign-in latency to about 1.5 s —
  VERIFIED, `spikes/SP-20-backend-slice/REPORT.md#4-rui-ro-moi-phat-hien`, RISK-060. The contended path is the
  store write in sign-in. Pooling addresses that directly; replicas address read volume, which is not where the
  measurement points.
- **Alternatives Considered**: adding replicas now — rejected as an unmeasured response to a measured problem.
  Doing neither until the beta complains — rejected because the release criterion is a load test, and running it
  without pooling would measure an arrangement we know we would not ship.

### D8 — Account deletion cascades from the account, after withdrawing at the providers
- **Choice**: call each provider's revocation endpoint, record the outcome per provider, then destroy everything
  reachable from the account in both stores, including the keys that would decrypt the replicated part.
- **Rationale**: deletion verified by a before-and-after dump is only meaningful if completeness follows from
  reachability rather than from an enumerated list of cleanup steps that can fall out of date — INV-BE-10. The
  cascade was exercised and left no residue in any relation — VERIFIED,
  `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q10).
- **Alternatives Considered**: destroying first and withdrawing afterwards — rejected because the authorisations
  to withdraw are known only from the account's own data. Blocking deletion when a provider refuses — rejected
  because it makes a third party able to hold an account open; RISK-058 records that at least one platform in
  scope offers no revocation endpoint at all.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: eager, at startup. The registry reads every Provider Descriptor,
  validates it against `backend/contracts/authorisation-provider-descriptor@0.1.0`, resolves the secrets it names
  and registers the providers that pass. The registered set is the authority for which providers exist; nothing
  discovers a provider by any other route, so an undeclared provider is invisible by construction rather than by
  omission.
- **Isolation & Sandboxing**: none is required, and that is the point of the design rather than a gap. A provider
  contributes data, not code: endpoints, secret names, an authentication method, a flag and a flat map of literal
  parameters. There is nothing to execute, so there is no sandbox to escape. The descriptor schema refuses
  unrecognised fields and refuses literal secrets, which are the two ways data would otherwise start behaving
  like code.
- **Resource Management & Eviction**: registration holds no connections and no per-provider resources. Secrets
  are resolved by name at use and are not retained as attributes of anything — INV-BE-05. Authorisation Requests
  expire on a short bound and are destroyed on use, so an abandoned connect leaves nothing to reclaim. Changing
  the registered set is a deployment, so eviction is a restart rather than a lifecycle to manage at runtime.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (Specific ➔ General)**: a request naming no scopes falls back to the descriptor's `defaultScopes`; a
  descriptor with no `extraAuthorizeParams` falls back to the bare authorisation request. These are the only
  defaults in the path, and both are declared rather than inferred.
- **Tier 2 (Custom ➔ Built-in Default)**: there is deliberately no fallback for a broken provider. A descriptor
  that is malformed, duplicated, carries a non-encrypted endpoint, or names a secret that does not resolve causes
  that provider to be withheld and the failure reported at startup — while every other provider and the rest of
  the service serve normally. Inheriting another provider's endpoints or authentication method would send a
  user's live authorisation code to the wrong platform, which is worse than any startup refusal. The general
  fallback is therefore "this platform is not offered", never "this platform is served approximately".
- **Tier 3 (Degraded Safe-Mode)**: when the store is unreachable, the instance reports `unhealthy` and refuses
  authenticated calls with `SERVICE_UNAVAILABLE` rather than failing opaquely; the version check continues to
  answer, because it is served from configuration rather than from the store, so a client can still learn it is
  too old. Below that, when the service is unreachable altogether, the safe mode is the device's: jobs, model
  calls and ledger writes continue against the local working copy, replication resumes from its checkpoint, and
  only new sign-in, new brokered authorisation and the version check are blocked. That degradation is the
  product's principal resilience property, and it is VERIFIED — `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q11).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternatives Rejected Because |
| --- | --- | --- |
| None | — | — |

No constitutional principle is violated by this design. The proposal's original privacy claim — that the server
holds no work content — was superseded by `req-022-account-sync` and is not asserted anywhere in these
artifacts; principle VII's surviving obligation on this capability, that the backend executes no job business
logic and confines key access to the replication path, is met by D1 and D5.

## Research

### R1 — Release load thresholds for the authentication and broker endpoints
- **Decision**: none are set here. The release criterion is a load test at twice the expected beta population on
  production-equivalent infrastructure, with pooling in place, and its results become the thresholds.
- **Rationale**: the available figures were taken on a development workstation whose network stack and graphical
  subsystem a production host does not have, and the spike says so itself. They answer "does the architecture
  collapse at twice beta scale" — it does not, at a 0.00 percent error rate — and answer nothing about latency
  budgets.
- **Alternatives**: adopting the measured percentiles as thresholds, which would set a release bar from a
  machine we will not ship on; or setting round numbers, which would be invented.
- **Source / Verification Status**: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) —
  VERIFIED as headroom evidence; thresholds UNVERIFIED and carried by `verification.md`.

### R2 — What a provider returns when a refresh token issued by an unverified client expires
- **Decision**: not resolved here. The behaviour the broker must report — expired versus revoked versus
  rejected — is assumed to arrive as a distinguishable provider refusal, and `PROVIDER_REJECTED` carries the
  provider's own reason so the product can present it.
- **Rationale**: this is open question Q-1 of this change and Q-2 of `req-014-byo-oauth-google`, and it can only
  be answered by observing the provider at the expiry date; no vendor statement substitutes, per the
  constitution's evidence discipline.
- **Alternatives**: guessing a response shape and coding against it, which would be an untested assumption on a
  path the user meets at the worst moment.
- **Source / Verification Status**: `spikes/SP-20-backend-slice/REPORT.md#5-chua-tra-loi-duoc-vi-sao` —
  UNVERIFIED, awaiting the named expiry window.

### R3 — Where Authorisation Request state lives in a multi-instance deployment
- **Decision**: server-side state shared across instances, not instance-local memory.
- **Rationale**: a binding issued by one instance must be consumable by another, because nothing else in this
  design gives a device affinity to an instance. Instance-local memory would make Connect fail intermittently
  behind a load balancer and would fail in exactly the way that is hardest to reproduce.
- **Alternatives**: sticky routing for the connect window — rejected as an operational constraint imposed by an
  avoidable design choice. A signed self-contained state parameter — rejected in D3, because single use needs
  memory regardless.
- **Source / Verification Status**: UNVERIFIED. The spike ran a single instance, so multi-instance behaviour was
  not exercised; `verification.md` assigns it a check.

### R4 — Which relational store topology the release runs on
- **Decision**: a pooled connection layer in front of a single primary for the beta, with read/write separation
  reserved.
- **Rationale**: the measured contention is on the write path in sign-in, which pooling addresses and replicas
  do not. Reserving the topology change with a stated activation condition keeps it from being either
  forgotten or built speculatively.
- **Alternatives**: replicas from the start, unmeasured; or no pooling, which would make the release load test
  measure an arrangement we would not ship.
- **Source / Verification Status**: `spikes/SP-20-backend-slice/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED as
  the observed contention; the chosen topology's sufficiency is UNVERIFIED until the release load test.

## Migration & Rollback

This change creates the server's persistent shape; there is no prior production data to migrate.

- **Forward**: the four record types are created by an initial, versioned schema migration applied before the
  service starts. Provider descriptors and their secrets are deployed with it; the service refuses to start on a
  duplicate descriptor and withholds any provider whose descriptor or secrets are incomplete, reporting which.
- **Subsequent migrations are forward-only and additive within a MAJOR version**: a release adds relations or
  nullable attributes and does not remove or repurpose one, so the previous service version can run against the
  new schema for the length of one release. That window is what makes rollback possible at all.
- **Rollback**: redeploy the previous service version against the unchanged schema. Sessions survive, because
  they are store state rather than instance state. A rollback that would require reverting a migration is not
  available in one step and is handled by restoring from backup, whose retention and proven-restore obligations
  are specified in the living backend spec.
- **Provider descriptor changes** roll back with the deployment, since they are configuration. Withdrawing a
  provider does not invalidate authorisations already held by devices; those keep working until the platform
  expires them, and the connector shows the state the platform reports.
- **Legacy data**: none. The spike's data is a development artifact and is not carried forward.

## Risks / Trade-offs

- [Sign-in write contention degrades under concurrency — RISK-060, measured at about 1.5 s median at 200
  concurrent writers] → pooling before release, read/write separation reserved against a measurement, and a
  release load test on production-equivalent infrastructure rather than on a workstation.
- [A backend compromise now exposes user work content, which was structurally impossible before the amendment —
  RISK-062] → accepted deliberately by the decision-maker, with confined key access, least privilege and audit
  as the boundary; D5 and INV-BE-07 keep the most exposed path out of key custody entirely.
- [The key-access path widens over time into support tooling or analytics — RISK-063] → principle VII restricts
  backend use of account content to serving replication; enforcement is review plus the audit record, and this
  design adds no path that would make widening convenient.
- [A platform offers no revocation endpoint, so deleting an account cannot withdraw everywhere — RISK-058] →
  the descriptor records the absence, deletion proceeds regardless, and the product names the platform the user
  must withdraw in themselves.
- [Binding state in a multi-instance deployment was never exercised] → R3 decides shared server-side state, and
  `verification.md` assigns a multi-instance check; until it runs, this is UNVERIFIED.
- [A provider's refusal text is attacker-influenced content displayed to the user] → it is displayed as text and
  never interpreted, per the constitution's External Content Is Data section; it authorises nothing.
- [Fixing the store's shape constrains future backend features] → accepted, and it is the trade the change
  exists to make: widening the store is an amendment to a requirement, which is exactly the friction that keeps
  the shape honest.

## Open Questions

These can be answered after approval without altering the specs, the approach or the tasks.

- Whether health should be split into separate liveness and readiness answers for the deployment platform, or
  remain one endpoint with a three-valued status. The contract's semantics hold either way; this is an
  operational shape.
- Which status page service publishes the availability figure the living spec requires.
- What the retention period is for expired and revoked session records before they are removed. They hold no
  usable token, so this is a hygiene decision rather than a safety one.
- Whether the invitation administration surface is an internal tool or a script for the closed beta. The
  requirement asks only for the minimum needed to manage the allowlist.

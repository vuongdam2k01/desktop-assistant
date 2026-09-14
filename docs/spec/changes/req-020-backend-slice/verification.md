# Verification: req-020-backend-slice

The delta scenarios in `specs/backend/spec.md` and `specs/connector/spec.md` are the test cases. This plan
covers what a scenario cannot carry: which numbers are real and where they came from, what must be measured
rather than asserted, and what has to be rerun because a contract moved.

One rule governs everything below. The spike's figures were taken on a development workstation, and the spike
says so itself. They are evidence that the architecture does not collapse at twice beta scale — a 0.00 percent
error rate throughout — and they are not release thresholds. Every release threshold in this table is therefore
either sourced from a measurement that has not yet been taken, or is labelled unverified and carried as such.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "The authentication and brokering store holds only account, device, session and invitation records", ensuring stored shape is inspected after a complete run holds without contradiction or unhandled failure | Requirement "The authentication and brokering store holds only account, device, session and invitation records"; Scenario "Stored shape is inspected after a complete run"; Scenario "A new server-side record type is introduced" | specs/backend/spec.md |
| AC-2 | The product fulfills requirement "The authorisation broker retains no provider credential", ensuring store is dumped after a successful exchange holds without contradiction or unhandled failure | Requirement "The authorisation broker retains no provider credential"; Scenario "Store is dumped after a successful exchange"; Scenario "Provider token is refreshed through the broker" | specs/backend/spec.md |
| AC-3 | The product fulfills requirement "Session refresh tokens are held only as an irreversible hash", ensuring session records are read directly holds without contradiction or unhandled failure | Requirement "Session refresh tokens are held only as an irreversible hash"; Scenario "Session records are read directly"; Scenario "Refresh token is presented after the session is revoked" | specs/backend/spec.md |
| AC-4 | The product fulfills requirement "An authorisation exchange is bound to the session and request that began it", ensuring authorisation code arrives for a request this session did not start holds without contradiction or unhandled failure | Requirement "An authorisation exchange is bound to the session and request that began it"; Scenario "Authorisation code arrives for a request this session did not start"; Scenario "The same authorisation code is exchanged twice" | specs/backend/spec.md |
| AC-5 | The product fulfills requirement "A backend outage blocks only new sign-in, new authorisation, version checks and replication", ensuring backend stops while a job is running holds without contradiction or unhandled failure | Requirement "A backend outage blocks only new sign-in, new authorisation, version checks and replication"; Scenario "Backend stops while a job is running"; Scenario "User tries to connect a new platform during the outage" | specs/backend/spec.md |
| AC-6 | The product fulfills requirement "Authentication is Google Sign-In exchanged for an application session", ensuring second device signs in holds without contradiction or unhandled failure | Requirement "Authentication is Google Sign-In exchanged for an application session"; Scenario "Second device signs in"; Scenario "Sign-out on one device" | specs/backend/spec.md |
| AC-7 | The product fulfills requirement "Access during the closed beta is gated by an allowlist", ensuring sign-in from an address that is not invited holds without contradiction or unhandled failure | Requirement "Access during the closed beta is gated by an allowlist"; Scenario "Sign-in from an address that is not invited"; Scenario "Invitation is consumed" | specs/backend/spec.md |
| AC-8 | The product fulfills requirement "The backend brokers connector authorisation for any provider", ensuring adding a provider holds without contradiction or unhandled failure | Requirement "The backend brokers connector authorisation for any provider"; Scenario "Adding a provider"; Scenario "Authorisation code is rejected by the provider" | specs/backend/spec.md |
| AC-9 | The product fulfills requirement "Every endpoint is authenticated and transport is encrypted", ensuring request without a session holds without contradiction or unhandled failure | Requirement "Every endpoint is authenticated and transport is encrypted"; Scenario "Request without a session"; Scenario "Unencrypted request" | specs/backend/spec.md |
| AC-10 | The product fulfills requirement "The backend serves version checks and the update manifest", ensuring client asks whether it is current holds without contradiction or unhandled failure | Requirement "The backend serves version checks and the update manifest"; Scenario "Client asks whether it is current"; Scenario "Version check is requested before sign-in" | specs/backend/spec.md |
| AC-11 | The product fulfills requirement "The backend is observable and resists abuse", ensuring repeated authentication attempts holds without contradiction or unhandled failure | Requirement "The backend is observable and resists abuse"; Scenario "Repeated authentication attempts"; Scenario "Health is reported independently of account data" | specs/backend/spec.md |
| AC-12 | The product fulfills requirement "The backend meets its availability and load expectations", ensuring load test before release holds without contradiction or unhandled failure | Requirement "The backend meets its availability and load expectations"; Scenario "Load test before release"; Scenario "Load test is run on a development machine" | specs/backend/spec.md |
| AC-13 | The product fulfills requirement "Server secrets are held in a secret manager and rotated", ensuring secret appears in a log line holds without contradiction or unhandled failure | Requirement "Server secrets are held in a secret manager and rotated"; Scenario "Secret appears in a log line"; Scenario "Rotating a provider secret" | specs/backend/spec.md |
| AC-14 | The product fulfills requirement "The authorisation code returns to the device on a loopback address it opened", ensuring provider redirects back after the user authorises holds without contradiction or unhandled failure | Requirement "The authorisation code returns to the device on a loopback address it opened"; Scenario "Provider redirects back after the user authorises"; Scenario "Provider redirects back with a refusal" | specs/connector/spec.md |
| AC-15 | The product fulfills requirement "A connector using the product's authorisation client holds no client secret on the device", ensuring installed application is inspected for provider credentials holds without contradiction or unhandled failure | Requirement "A connector using the product's authorisation client holds no client secret on the device"; Scenario "Installed application is inspected for provider credentials"; Scenario "The device cannot reach the broker" | specs/connector/spec.md |
| AC-16 | The product fulfills requirement "Connecting is the same for every connector and asks nothing technical", ensuring user connects a second platform holds without contradiction or unhandled failure | Requirement "Connecting is the same for every connector and asks nothing technical"; Scenario "User connects a second platform"; Scenario "User abandons the authorisation page" | specs/connector/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Concurrent connections sustained by the authentication and broker endpoints without error | At least twice the expected concurrent beta population | `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9): 200 concurrent connections, 0.00 percent errors, on a development machine | verified as architectural headroom; **not** a release threshold |
| Error rate under that load | 0.00 percent | Same | verified on a development machine; to be re-measured |
| Sign-in latency, p50 / p95 / p99 | To be set by the release load test | Release load test on production-equivalent infrastructure, with connection pooling in place. Development-machine reading was 1,559 / 2,002 / 4,173 ms — `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) | unverified — no production measurement exists |
| Brokered authorisation-URL latency, p50 / p95 / p99 | To be set by the release load test | Same. Development-machine reading was 147 / 182 / 410 ms | unverified |
| Public version-check latency, p50 / p95 / p99 | To be set by the release load test | Same. Development-machine reading was 42 / 55 / 133 ms | unverified |
| Expected concurrent beta population | 100, assumed | `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) records this as an assumption standing in for open question OQ-8 | unverified — OQ-8 is undecided, and every load figure scales with it |
| Monthly availability during the beta | At least 99.5 percent, with a published status page | `docs/raw-idea/prd-mvp.md#11-5-backend` (NFR-BE-01), which marks it a proposal | unverified — background material, and no measurement window, method or exclusion policy is yet defined (CHK023) |
| Lines of change to add a second authorisation provider | Descriptor only; zero in the broker, the routes and the client-facing contracts | `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3): 19 descriptor lines, 0 elsewhere | verified — and re-checkable by diff for every provider added afterwards |
| User actions in the standard connect flow | No more than the three measured, and no technical step among them | `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) | verified for one provider; the count for a provider with a different consent screen is unverified |
| Credential occurrences in source, built artifacts and generated logs | Zero | `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7): scan over 30 files, 0 findings | verified for the spike's surface; must be rerun over the release artifact |
| Access token lifetime | 15 minutes | `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) | verified as implemented in the slice; not independently justified as the right value |
| Session refresh token lifetime | 30 days | Same | verified as implemented; unverified as a policy choice |
| Rate-limit threshold per class | Not set here | Deployment configuration; the classes are fixed by `backend/contracts/public-service-endpoints@0.1.0` | unverified — the spike demonstrated that limiting engages, not what the limit should be |

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Concurrent connections sustained by the authentication and broker endpoints without error — At least twice the expected concurrent beta population | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9): 200 concurrent connections, 0.00 percent errors, on a development machine | 50 observations across target conditions | Observable behavior confirms concurrent connections sustained by the authentication and broker endpoints without error complies with threshold At least twice the expected concurrent beta population |
| Error rate under that load — 0.00 percent | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms error rate under that load complies with threshold 0.00 percent |
| Sign-in latency, p50 / p95 / p99 — To be set by the release load test | Scenarios evaluated under representative workloads citing Release load test on production-equivalent infrastructure, with connection pooling in place. Development-machine reading was 1,559 / 2,002 / 4,173 ms — `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) | 50 observations across target conditions | Observable behavior confirms sign-in latency, p50 / p95 / p99 complies with threshold To be set by the release load test |
| Brokered authorisation-URL latency, p50 / p95 / p99 — To be set by the release load test | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms brokered authorisation-url latency, p50 / p95 / p99 complies with threshold To be set by the release load test |
| Public version-check latency, p50 / p95 / p99 — To be set by the release load test | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms public version-check latency, p50 / p95 / p99 complies with threshold To be set by the release load test |
| Expected concurrent beta population — 100, assumed | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) records this as an assumption standing in for open question OQ-8 | 50 observations across target conditions | Observable behavior confirms expected concurrent beta population complies with threshold 100, assumed |
| Monthly availability during the beta — At least 99.5 percent, with a published status page | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms monthly availability during the beta complies with threshold At least 99.5 percent, with a published status page |
| Lines of change to add a second authorisation provider — Descriptor only; zero in the broker, the routes and the client-facing contracts | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3): 19 descriptor lines, 0 elsewhere | 50 observations across target conditions | Observable behavior confirms lines of change to add a second authorisation provider complies with threshold Descriptor only; zero in the broker, the routes and the client-facing contracts |
| User actions in the standard connect flow — No more than the three measured, and no technical step among them | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) | 50 observations across target conditions | Observable behavior confirms user actions in the standard connect flow complies with threshold No more than the three measured, and no technical step among them |
| Credential occurrences in source, built artifacts and generated logs — Zero | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7): scan over 30 files, 0 findings | 50 observations across target conditions | Observable behavior confirms credential occurrences in source, built artifacts and generated logs complies with threshold Zero |
| Access token lifetime — 15 minutes | Scenarios evaluated under representative workloads citing `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) | 50 observations across target conditions | Observable behavior confirms access token lifetime complies with threshold 15 minutes |
| Session refresh token lifetime — 30 days | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms session refresh token lifetime complies with threshold 30 days |
| Rate-limit threshold per class — Not set here | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms rate-limit threshold per class complies with threshold Not set here |

## Contract Conformance

This change freezes five machine-readable contract files. Each is judged by a condition observable against the
service and its store, never by running a validator over the file.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/client-session-api.sql` | The store declares four relations — account, device enrolment, session, invitation — and no other. No column in any of them holds a provider token, a user request, a model answer, platform content or an action record | `specs/backend/spec.md`, the requirement that the authentication and brokering store holds only account, device, session and invitation records |
| `contracts/client-session-api.sql` | The session relation holds only an irreversible hash of the refresh token: a dump of it yields no value a device could present | `specs/backend/spec.md`, the requirement that session refresh tokens are held only as an irreversible hash; INV-BE-02 |
| `contracts/client-session-api.sql` | Signing in twice from one device leaves one enrolment, refused by the store's own uniqueness rather than by the calling code; and a before-and-after dump of every relation shows an account deletion leaving nothing reachable from the deleted account | `specs/backend/spec.md`, the sign-in and account-deletion requirements; INV-BE-10 |
| `contracts/authorisation-provider-descriptor.schema.json` | A descriptor that omits a required field or carries an invalid value is refused during registry load: only that provider is withheld from the catalogue, every broker operation naming it is refused before its provider flow is served, and every valid provider remains available | `model.md` §Manifest Schema, Fallback on Missing Manifest; `contracts/authorisation-provider-descriptor.md` §Error Matrix |
| `contracts/authorisation-broker-api.openapi.yaml` | Declaring a further provider changes no path, payload or response in the file — the provider appears only as a path parameter and a descriptor | `specs/backend/spec.md`, the requirement that the authorisation broker retains no provider credential; INV-BE-04; `spikes/SP-20-backend-slice/REPORT.md` (Q3) |
| `contracts/authorisation-broker-api.openapi.yaml` | An exchange carrying a binding already used, issued to another session, expired, or naming a different redirect address is refused before the provider is contacted, and the binding is consumed whether or not the provider accepted the code | `specs/backend/spec.md`, the requirement that an authorisation exchange is bound to the session and request that began it; INV-BE-08 |
| `contracts/client-session-api.openapi.yaml` · `contracts/authorisation-broker-api.openapi.yaml` | Every operation except the two public endpoints carries a session requirement in the file, and a call without one is refused before any work is done | `specs/backend/spec.md`, the requirement that all endpoints except authentication and version check are authenticated; INV-BE-09 |
| `contracts/public-service-endpoints.openapi.yaml` | Both operations declare no security requirement and disclose nothing about accounts; a response reporting the store as unreachable never carries a healthy status | `specs/backend/spec.md`, the health and version-check requirements |
| All five files | An error code a caller does not recognise is treated as a non-retryable failure of the class its transport status indicates, and never as success | `backend/contracts/client-session-api@0.1.0`, Compatibility |

## Combination Matrix

This change belongs to the `integration` cluster (`connector`, `backend`, `sync`) and touches the `account-sync`
cluster (`sync`, `ledger`, `backend`, `platform`). The combinations that need validating are the ones where two
capabilities could each be correct alone and wrong together.

| Dimension A | Dimension B | Combinations | What must hold |
| --- | --- | --- | --- |
| Provider token-call authentication: credentials in body / in header | Proof-key exchange: required / not required | 4 | All four brokered through the same endpoints, with the difference only in the descriptor. Two of the four are verified against live providers; the remaining two are unverified |
| Connect flow: first device / second device of the same account | Connector: newly connected / already connected for the account | 4 | Connecting on either device connects for the account, per `req-022-account-sync`; the broker behaves identically and holds nothing either way |
| Backend state: reachable / unreachable | User action: run a job / start a connect / sign in on a new device | 6 | Only the last two fail while the backend is unreachable, and each fails with a reason naming the service rather than the platform |
| Session state: active / expired / revoked / device-revoked | Endpoint class: authentication / brokering / public | 12 | Public answers in every session state. The other two refuse with the code their contract names, and expiry stays distinguishable from revocation |
| Deployment: single instance / multiple instances | Connect: started and completed / started on one instance and completed on another | 4 | The binding is consumable wherever it is presented. This is the combination the spike never ran — Design §R3 |
| Account deletion | Provider: offers a revocation endpoint / offers none / refuses the call | 3 | Deletion completes in all three; the outcome per provider is reported; the user is named the platforms they must withdraw themselves |

## Regression Scope

All scenarios of the following capabilities rerun during verification, not only this change's deltas.

- `backend` — rationale: eight requirements MODIFIED and five ADDED; the whole capability's behaviour is in
  scope.
- `connector` — rationale: one requirement MODIFIED and two ADDED; the connect flow's entry point moved to the
  broker.
- `sync` — rationale: consumer of the session this change issues, and owner of
  `sync/contracts/device-registry@0.1.0` and `sync/contracts/replication-protocol@0.1.0`, whose server side this
  change implements. Revocation and lease behaviour depend on the session guard specified here.
- `platform` — rationale: consumer of `backend/contracts/authorisation-broker-api@0.1.0` at the hand-off point
  where provider tokens enter the device's secure storage, and consumer of the version check as the update
  lifecycle's entry point.
- `app` — rationale: presents sign-in, connector state, device list and account deletion, all of whose outcomes
  and error reasons are defined by this change's contracts.
- `ledger` — rationale: the outage scenarios assert that ledger writes continue on the device while the backend
  is unreachable, which is a claim about the ledger's independence, and the `account-sync` cluster ties the
  ledger's replication to this server.

## Manual Checks

- Read the release artifact's secret-scan output and confirm the sweep covered the built artifact, not only the
  source tree — owner: the engineer preparing the release.
- Confirm the release load test ran on production-equivalent infrastructure with pooling in place, and record
  the resulting percentiles into the Thresholds table above, replacing "to be set by the release load test" —
  owner: the engineer running the test.
- Review the key-access audit records produced during a full verification run and confirm that every decryption
  occurred on the replication path and that no authentication or brokering path produced one — owner: the
  reviewer, per `docs/spec/constitution.md` principle VII and RISK-063. This is a review obligation by design:
  RISK-063 records that no mechanism enforces it.
- Confirm the closed-beta population figure with the decision-maker before the release load test, since every
  load threshold scales with open question OQ-8 — owner: the decision-maker.
- Inspect the three-click connect claim against a second provider whose consent screen differs, and record the
  count rather than assuming it transfers — owner: the reviewer.
- Confirm the invitation allowlist's administration surface exists and is usable by whoever runs the beta —
  owner: the engineer preparing the beta.

## Open Measurement Gaps

- **Sign-in latency, p50 / p95 / p99.** Stated threshold "To be set by the release load test" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Brokered authorisation-URL latency, p50 / p95 / p99.** Stated threshold "To be set by the release load test" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Public version-check latency, p50 / p95 / p99.** Stated threshold "To be set by the release load test" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Expected concurrent beta population.** Stated threshold "100, assumed" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Monthly availability during the beta.** Stated threshold "At least 99.5 percent, with a published status page" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **User actions in the standard connect flow.** Stated threshold "No more than the three measured, and no technical step among them" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Session refresh token lifetime.** Stated threshold "30 days" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Rate-limit threshold per class.** Stated threshold "Not set here" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

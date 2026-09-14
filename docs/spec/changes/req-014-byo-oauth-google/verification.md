# Verification: req-014-byo-oauth-google

The scenarios in `specs/` are the test cases. This file holds what a scenario cannot say: which figures are
measured and which are the product's own, what has to be re-measured at a date already known, which combinations
matter because this change meets the account-replication cluster, and which checks only a person can perform.

One property shapes the whole plan. The central risk of this route is not that it fails technically — it was
measured working end to end — but that a person who is not technical cannot complete it. No automated suite can
verify that, so the manual checks below are load-bearing rather than supplementary, and the definition of done
treats a failure there as a product defect.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "The bring-your-own setup runs as ordered steps inside the application", ensuring the user works through the sequence holds without contradiction or unhandled failure | Requirement "The bring-your-own setup runs as ordered steps inside the application"; Scenario "The user works through the sequence"; Scenario "The user closes the window mid-setup" | specs/app/spec.md |
| AC-2 | The product fulfills requirement "The setup states what it will cost the user before the first step", ensuring the route is offered holds without contradiction or unhandled failure | Requirement "The setup states what it will cost the user before the first step"; Scenario "The route is offered"; Scenario "The user declines after reading what it costs" | specs/app/spec.md |
| AC-3 | The product fulfills requirement "The application window holds four areas", ensuring every waiting decision is reachable in one place holds without contradiction or unhandled failure | Requirement "The application window holds four areas"; Scenario "Every waiting decision is reachable in one place"; Scenario "A platform that is not yet connected" | specs/app/spec.md |
| AC-4 | The product fulfills requirement "The Google connector authorises with an authorisation client the user created", ensuring the user completes the bring-your-own route holds without contradiction or unhandled failure | Requirement "The Google connector authorises with an authorisation client the user created"; Scenario "The user completes the bring-your-own route"; Scenario "The broker is never asked about a user-supplied client" | specs/connector/spec.md |
| AC-5 | The product fulfills requirement "The device chooses its loopback port at the moment it connects", ensuring the chosen port is already taken holds without contradiction or unhandled failure | Requirement "The device chooses its loopback port at the moment it connects"; Scenario "The chosen port is already taken"; Scenario "No loopback port can be acquired" | specs/connector/spec.md |
| AC-6 | The product fulfills requirement "A supplied authorisation client is checked before the browser is opened", ensuring a client of the wrong kind is supplied holds without contradiction or unhandled failure | Requirement "A supplied authorisation client is checked before the browser is opened"; Scenario "A client of the wrong kind is supplied"; Scenario "A file that is not an authorisation client at all" | specs/connector/spec.md |
| AC-7 | The product fulfills requirement "A consent that grants less than was asked for does not present as connected", ensuring the user grants mail and withholds files holds without contradiction or unhandled failure | Requirement "A consent that grants less than was asked for does not present as connected"; Scenario "The user grants mail and withholds files"; Scenario "The user withholds everything" | specs/connector/spec.md |
| AC-8 | The product fulfills requirement "An account the user's own client does not admit is reported as the client's restriction", ensuring the user signs in with an account the client does not list holds without contradiction or unhandled failure | Requirement "An account the user's own client does not admit is reported as the client's restriction"; Scenario "The user signs in with an account the client does not list"; Scenario "The user authorises a different account from the one they use in the product" | specs/connector/spec.md |
| AC-9 | The product fulfills requirement "A refused renewal under the user's own client is an expired connector, not a lost one", ensuring renewal is refused mid-job holds without contradiction or unhandled failure | Requirement "A refused renewal under the user's own client is an expired connector, not a lost one"; Scenario "Renewal is refused mid-job"; Scenario "The provider cannot be reached during renewal" | specs/connector/spec.md |
| AC-10 | The product fulfills requirement "Reconnecting under the user's own client never asks for the credential file again", ensuring reconnect after the seven-day window holds without contradiction or unhandled failure | Requirement "Reconnecting under the user's own client never asks for the credential file again"; Scenario "Reconnect after the seven-day window"; Scenario "The stored authorisation client is gone" | specs/connector/spec.md |
| AC-11 | The product fulfills requirement "The authorisation client the user supplied belongs to the account, not to the device", ensuring the user signs in on a second device holds without contradiction or unhandled failure | Requirement "The authorisation client the user supplied belongs to the account, not to the device"; Scenario "The user signs in on a second device"; Scenario "The connector is disconnected" | specs/connector/spec.md |
| AC-12 | The product fulfills requirement "A Drive file is read by the route its type declares", ensuring a spreadsheet is read holds without contradiction or unhandled failure | Requirement "A Drive file is read by the route its type declares"; Scenario "A spreadsheet is read"; Scenario "A stored file is read" | specs/connector/spec.md |
| AC-13 | The product fulfills requirement "A file that exceeds the ceiling of its route is refused with the ceiling named", ensuring a stored file above the product's ceiling holds without contradiction or unhandled failure | Requirement "A file that exceeds the ceiling of its route is refused with the ceiling named"; Scenario "A stored file above the product's ceiling"; Scenario "An export the platform refuses for size" | specs/connector/spec.md |
| AC-14 | The product fulfills requirement "A Google capability that was never exercised is declared absent rather than offered", ensuring an unexercised capability is requested holds without contradiction or unhandled failure | Requirement "A Google capability that was never exercised is declared absent rather than offered"; Scenario "An unexercised capability is requested"; Scenario "Scope is not requested for an absent capability" | specs/connector/spec.md |
| AC-15 | The product fulfills requirement "Bring-your-own authorisation client is a first-class connect route", ensuring guided setup inside the application holds without contradiction or unhandled failure | Requirement "Bring-your-own authorisation client is a first-class connect route"; Scenario "Guided setup inside the application"; Scenario "Refresh token expires under an unverified client" | specs/connector/spec.md |
| AC-16 | The product fulfills requirement "Google Drive is read-only in this scope", ensuring unsupported format holds without contradiction or unhandled failure | Requirement "Google Drive is read-only in this scope"; Scenario "Unsupported format"; Scenario "The agent is asked to change a file" | specs/connector/spec.md |
| AC-17 | The product fulfills requirement "A connector that has stopped working reaches the user as a system card", ensuring an authorisation expires while the user is away holds without contradiction or unhandled failure | Requirement "A connector that has stopped working reaches the user as a system card"; Scenario "An authorisation expires while the user is away"; Scenario "The same connector fails again" | specs/uix/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Loopback redirect accepted on a port not registered with the client | Accepted on any acquired port, for a client of the accepted kind | `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q2; `evidence/q2_dynamic_ports.log` — three unrelated ports, both loopback host forms, and no port at all, all accepted; an unregistered external address refused | verified |
| Authorisation lifetime while the user's client is unverified | 7 days from the grant | `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q3 — the grant instant and the resulting window were recorded; renewal succeeded 17 hours in | verified for the window's existence and length; the refusal at its end is not yet observed |
| The refusal the provider returns once the window closes | A refusal to renew, handled by shape rather than by code | Provider documentation only, quoted in `REPORT.md#1-tra-loi-tung-cau-hoi` Q3 | unverified — re-measurement scheduled below |
| Direct download of a stored file | Succeeds at least to 30,749,685 bytes | `evidence/q6_drive_export_read.log` — three files above twenty megabytes downloaded | verified |
| Product ceiling on a direct download | 20,971,520 bytes | Product decision, argued in `design.md` D5 from the memory and context costs the spike named; the platform serves more | unverified as a platform limit, and deliberately so — it is the product's own |
| Platform ceiling on an export | 10,485,760 bytes, refused above it | Provider documentation, quoted in `REPORT.md#1-tra-loi-tung-cau-hoi` Q6; the exports actually performed were 696 and 32,275 bytes | unverified |
| Spreadsheet export to delimited text | Returns the sheet's real columns | `evidence/q6_drive_export_read.log` | verified |
| Actions the user performs on the provider's pages | 4 | `REPORT.md#1-tra-loi-tung-cau-hoi` Q5 — account chooser, Advanced, continue-anyway, consent | verified |
| Steps in the setup sequence | 8 — six in the console, two in the application | `REPORT.md#1-tra-loi-tung-cau-hoi` Q7; `evidence/byo-setup-guide-draft.md` | verified as the content of the draft; the sequence as rendered by the product is checked manually below |
| Time the device waits for the redirect | 5 minutes, after which the listener closes | Product decision, argued in `design.md` R5; the measured run used a 300-second wait and completed well inside it | unverified as a requirement |
| Requests the user's own client may make before the provider limits it | Unknown | Not measured — the spike made tens of calls, far below any published quota | unverified |

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Loopback redirect accepted on a port not registered with the client — Accepted on any acquired port, for a client of the accepted kind | Scenarios evaluated under representative workloads citing `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q2; `evidence/q2_dynamic_ports.log` — three unrelated ports, both loopback host forms, and no port at all, all accepted; an unregistered external address refused | 50 observations across target conditions | Observable behavior confirms loopback redirect accepted on a port not registered with the client complies with threshold Accepted on any acquired port, for a client of the accepted kind |
| Authorisation lifetime while the user's client is unverified — 7 days from the grant | Scenarios evaluated under representative workloads citing `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q3 — the grant instant and the resulting window were recorded; renewal succeeded 17 hours in | 50 observations across target conditions | Observable behavior confirms authorisation lifetime while the user's client is unverified complies with threshold 7 days from the grant |
| The refusal the provider returns once the window closes — A refusal to renew, handled by shape rather than by code | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms the refusal the provider returns once the window closes complies with threshold A refusal to renew, handled by shape rather than by code |
| Direct download of a stored file — Succeeds at least to 30,749,685 bytes | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms direct download of a stored file complies with threshold Succeeds at least to 30,749,685 bytes |
| Product ceiling on a direct download — 20,971,520 bytes | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms product ceiling on a direct download complies with threshold 20,971,520 bytes |
| Platform ceiling on an export — 10,485,760 bytes, refused above it | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms platform ceiling on an export complies with threshold 10,485,760 bytes, refused above it |
| Spreadsheet export to delimited text — Returns the sheet's real columns | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms spreadsheet export to delimited text complies with threshold Returns the sheet's real columns |
| Actions the user performs on the provider's pages — 4 | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms actions the user performs on the provider's pages complies with threshold 4 |
| Steps in the setup sequence — 8 — six in the console, two in the application | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms steps in the setup sequence complies with threshold 8 — six in the console, two in the application |
| Time the device waits for the redirect — 5 minutes, after which the listener closes | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms time the device waits for the redirect complies with threshold 5 minutes, after which the listener closes |
| Requests the user's own client may make before the provider limits it — Unknown | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms requests the user's own client may make before the provider limits it complies with threshold Unknown |

## Contract Conformance

This change freezes three machine-readable contract files. Each is judged by a condition anyone can observe
against a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/byo-authorisation-client.schema.json` | A supplied client the rule does not admit is refused before the browser opens, with the remedy step named and nothing stored — the whole file, never a part of it. The eight-case acceptance corpus produces a refusal or an acceptance and never a partial state | `specs/connector/spec.md`, the requirement that a supplied authorisation client is checked before the browser is opened; INV-GG-02 |
| `contracts/byo-authorisation-client.schema.json` | No descriptor pins a port: the redirect address is built from a port acquired when Connect starts and one of the host forms the descriptor names, and a connect works on a port the client never registered | `specs/connector/spec.md`, the requirement that the device chooses its loopback port at the moment it connects |
| `contracts/byo-authorisation-client.schema.json` | A descriptor that admits a client kind which cannot complete a loopback redirect satisfies the file and is still wrong: the failure lands on the provider's page after the user has left the application, so the condition is judged by review of each descriptor rather than by the file | `contracts/byo-authorisation-client.md` §Examples; the manual checks below |
| `contracts/byo-setup-guide.schema.json` | A guide the file refuses makes the route unavailable and names the failing declaration; it is never offered half-complete. Each of the seven invalid descriptors in the guide corpus produces exactly that | `specs/app/spec.md`, the requirement that the setup runs as ordered steps inside the application; the guide descriptor corpus |
| `contracts/byo-setup-guide.schema.json` | The user is told what the task will cost them before the first step: the four preamble notes are present in every offered guide, because a guide missing any of them does not load | `specs/app/spec.md`, the requirement that the setup states what it will cost the user before the first step |
| `contracts/byo-setup-guide.schema.json` | A connector's route ends in a connection: every offered guide contains the step that supplies the client, and the file admits no guide without one | `specs/app/spec.md`; `contracts/byo-setup-guide.md` §Semantics |
| `contracts/drive-content-projection.schema.json` | A file kind absent from the route table is reported unsupported before any content request is made, and no route is inferred from a name or an extension | `specs/connector/spec.md`, the requirement that a Drive file is read by the route its type declares |
| `contracts/drive-content-projection.schema.json` | A file above its route's ceiling is refused with the ceiling and its owner named, and a product ceiling is presented as the product's own rather than as the platform refusing | `specs/connector/spec.md`, the requirement that a file exceeding the ceiling of its route is refused with the ceiling named |
| `contracts/drive-content-projection.schema.json` | Every row of every shipped route table cites a path under `spikes/` or carries the word `unmeasured` with its reason; a row may not be silent, and a capability that was never exercised is declared absent rather than offered | `specs/connector/spec.md`, the requirement that a Google capability that was never exercised is declared absent; the Definition of Done below |

## Combination Matrix

This change belongs to the `integration` cluster (`connector`, `backend`, `sync`) and meets the `account-sync`
cluster through the credential it stores. The combinations that must be exercised:

| Combination | Why it matters | Expected |
| --- | --- | --- |
| Bring-your-own route × backend unavailable | The route is specified as the one connect path that does not need the backend | Connect completes; no request to the broker is attempted |
| Bring-your-own route × second signed-in device | Principle VII forbids the user repeating console work per machine | Google usable on the second device after replication, with no console step |
| Bring-your-own route × device that has not replicated | An authorisation the account holds but this device lacks must not read as revoked | Shown as unavailable on this device, and the setup route is not re-offered |
| Expired authorisation × reconnect from another device | The framework requires reconnect on any signed-in device | One consent on either device restores the connector for the account |
| Expired authorisation × running job | The interruption is the most frequent one the product has | The job fails with a direct route to repair; the ledger records the failure and the reason |
| Partial consent × tool set assembly | A withheld scope must not produce a tool that fails mid-job | The affected tools are absent from the next job's tool set |
| Disconnect × replicated credential | The client and tokens must not survive on any device | Both erased everywhere the account reaches |
| Account deletion × supplied client | The credential class's erasure triggers include account deletion | Nothing remains under the connector's keys |
| Read tool × user rule over a read operation | Read-only connectors still honour rules | The hook stops the call and raises an approval request |

## Regression Scope

All scenarios of the capabilities below are rerun, not only this change's deltas.

- `connector` — modified by this change; also the owner of the framework requirements this route must not
  weaken, particularly those about state, revocation and the product's own authorisation client.
- `app` — modified by this change; the connectors area gains the setup sequence.
- `uix` — modified by this change; a new system-card behaviour that must not introduce an eighth card type or
  break Do-Not-Disturb.
- `platform` — consumer of nothing new, but the holder of what this change stores:
  `platform/contracts/secure-storage@0.1.0` and its credential class must still erase and restore correctly with a
  client of this shape present.
- `sync` — the supplied client joins the account's replicated set; the replication, lease and revocation scenarios
  must hold with it.
- `backend` — unchanged, and the point is to prove it: no scenario of the broker may be reachable from this route.
- `approval` and `ledger` — unchanged; read tools are still wrapped, rules over read operations still bind, and
  every call still writes its record first.
- `job` — a failing connector's effect on a running job.

## Manual Checks

- **A person who did not write this completes the setup unaided**, on a machine where the product has never run,
  using only what the application shows them. What is observed: whether they pass the provider's warning screen
  without help, where they hesitate, and how long it takes. A failure is a defect in the guide, not in the
  person. — owner: product decision-maker.
- **Re-measure the refusal at the end of the authorisation window**, on or after `2026-09-18 09:24 UTC` for the
  first recorded grant, or `2026-09-19 02:33 UTC` for the second, using the tokens the spike left in place. What
  is recorded: the exact status, code and message the provider returns. This closes Q-2 in `clarifications.md`
  and fixes the words the expiry notice uses. — owner: whoever repeats `spikes/SP-13-byo-oauth-google`.
- **Exercise every content route declared with `evidence: unmeasured`**, at minimum the platform's
  word-processing document kind, and record the form produced and the behaviour above the platform's export
  ceiling. Until this is done, no route may claim measurement it does not have. — owner: connector implementer.
- **Read the guide's words against the constitution as it stands**, specifically the storage note: the spike's
  draft states the credentials never leave the machine, which was true under the superseded local-first principle
  and is false under principle VII. — owner: product decision-maker.
- **Attempt the route on an account inside a managed organisation**, if one becomes available, and record whether
  the unverified-client cadence applies at all. This closes Q-1 in `clarifications.md`; until then the behaviour
  stays declared unknown. — owner: product decision-maker.
- **Confirm no diagnostic bundle, log or ledger record carries the supplied client or any token**, by exporting a
  bundle with the connector connected and searching it. — owner: connector implementer.

## Open Measurement Gaps

- **The refusal the provider returns once the window closes.** Stated threshold "A refusal to renew, handled by shape rather than by code" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Product ceiling on a direct download.** Stated threshold "20,971,520 bytes" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Platform ceiling on an export.** Stated threshold "10,485,760 bytes, refused above it" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Time the device waits for the redirect.** Stated threshold "5 minutes, after which the listener closes" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Requests the user's own client may make before the provider limits it.** Stated threshold "Unknown" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

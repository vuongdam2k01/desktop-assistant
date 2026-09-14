# connector Specification

## Purpose
Owns integration with external work platforms as data rather than code: the manifest that declares each platform's tools, authorisation, snapshot method and compensation formula; the adapter that executes them; and the gateway that holds resource locks and the shared rate queue. Authorisation is account-scoped, so connecting on one device connects on all of them. Adding a platform must not change the core.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence). Amended 2026-09-12 by change `req-022-account-sync` (constitution 2.0.0).

## Requirements

### Requirement: A connector is defined by a manifest

Every connector SHALL be defined by a manifest declaring its identity, name and icon, its authorisation
configuration including the scope required per capability, and its tool list with parameter schemas; every write
tool in that list SHALL declare an explicit `is_reversible` boolean flag, and where true, provide its pre-write
snapshot method together with the formula for its compensating action; and every tool SHALL declare how an
interrupted call is reconciled, so that the manifest is the sole place any platform-specific behaviour is expressed.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-01),
`docs/spec/constitution.md` principles IV and VI,
`spikes/SP-19-connector-framework/REPORT.md#0-ket-luan`,
`spikes/SP-9-undo-agent/REPORT.md#2-tac-dong-len-adr-prd`.

#### Scenario: Write tool without a compensation declaration
- **WHEN** a manifest declares a write tool with `is_reversible: true` that carries no compensating-action formula
- **THEN** the manifest is rejected and the connector does not load

#### Scenario: Adding a platform changes no core component
- **WHEN** a new connector is added by supplying a manifest and an adapter
- **THEN** the job manager, the approval hooks, the ledger and the interface are unchanged

#### Scenario: A tool arrives without a reconciliation declaration
- **WHEN** a manifest declares a tool that does not say how an interrupted call is reconciled
- **THEN** the tool is treated as one whose effect cannot be read back, so an interrupted call becomes a question
  for the user rather than a repeated call

#### Scenario: The agent proposes a call that contradicts the manifest
- **GIVEN** a tool is declared irreversible in the manifest
- **WHEN** the agent's call arguments assert anything about reversibility
- **THEN** the declaration in the manifest is what the gate and the undo planner read, and the arguments change
  nothing

### Requirement: Connecting is the same for every connector and asks nothing technical

Connecting any connector SHALL follow one flow — choose the application from the catalogue, activate Connect,
authorise in the platform's own page in the browser, return to a connected state — SHALL route the code exchange
through the backend's broker so the provider's client secret stays on the server, and SHALL NOT ask the user to
paste a token, enter a client identifier or configure a redirect address.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-02),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) — VERIFIED: the standard connect flow cost the
user three actions, one in the application and two on the provider's own page, with no technical step among
them.

#### Scenario: User connects a second platform
- **WHEN** the user connects a platform they have never connected before
- **THEN** the steps presented are identical to the first connector's, apart from the platform's own
  authorisation page

#### Scenario: User abandons the authorisation page
- **GIVEN** the browser is open at the platform's authorisation page
- **WHEN** the user closes it without authorising
- **THEN** the connector returns to the disconnected state with an explanation and no partial credential is kept

#### Scenario: Connect asks for nothing the user has to look up
- **WHEN** the user completes Connect for a platform using the product's authorisation client
- **THEN** every action is a choice or a confirmation, and at no point is the user asked for a token, a client
  identifier or a redirect address

### Requirement: Only the scope of an enabled capability is requested

A connector SHALL request only the scopes required by the capabilities currently enabled, SHALL obtain any
further scope through a separate re-consent flow, its manifest SHALL support several capability-to-scope profiles
so that a release channel can be changed by selecting a profile, and the profile an authorisation was granted
under SHALL be recorded with it.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-04),
`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q8) — VERIFIED: one manifest carried a
narrow profile for the channel where the user supplies their own authorisation client and a narrower one for the
mass-market channel, and switching between them changed neither the manifest's structure nor the adapter.

#### Scenario: New capability needs a wider scope
- **GIVEN** a connector is authorised for reading only
- **WHEN** the user enables a capability that writes
- **THEN** a re-consent flow requests the additional scope, and the scope was not requested in advance

#### Scenario: Switching release channel
- **WHEN** the release channel changes
- **THEN** a different capability-to-scope profile is selected from the same manifest, with no change to the
  manifest's core

#### Scenario: An authorisation granted under a narrower profile meets a wider one
- **GIVEN** an authorisation was granted under one profile
- **WHEN** the connector is later used on a build whose profile requires more than was granted
- **THEN** the connector is shown as needing wider permission and re-consent is offered, rather than the existing
  authorisation being used as though it covered the difference

#### Scenario: A profile names a capability no tool uses
- **WHEN** a manifest's selected profile grants scope for a capability that no declared tool requires
- **THEN** the manifest is refused, so that unused scope cannot be requested from the user by accident

### Requirement: Connector state is visible and recoverable in one action

The application SHALL show each connector as connected, token expired, permission error, revoked or unavailable
on this device, SHALL offer a one-action reconnect, and a job that meets a failing connector SHALL fail with a
clear reason and a direct route to reconnect.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-05),
`docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-07),
`docs/spec/changes/req-022-account-sync/clarifications.md` Q-3 — UNVERIFIED; the additional state distinguishes a
withdrawn authorisation from one this device cannot currently use.

#### Scenario: Authorisation is revoked at the platform
- **GIVEN** the user revoked the authorisation in the platform's own settings
- **WHEN** a running job calls that connector
- **THEN** the job fails stating that the authorisation was revoked, and the application shows the connector as
  revoked with a reconnect action

#### Scenario: Reconnect restores the running state
- **WHEN** the user completes reconnect
- **THEN** the connector returns to connected and subsequent jobs use it without further configuration

#### Scenario: The device's lease has expired
- **GIVEN** the device has not replicated for longer than the lease period
- **WHEN** the connectors area is opened
- **THEN** the connector is shown as unavailable on this device with the reason that the device must reconnect to
  the account, and it is not presented as revoked or expired at the platform

#### Scenario: Reconnect is offered on the device that can perform it
- **WHEN** a connector needs re-authorisation
- **THEN** completing it on any signed-in device restores the connector for the account, so the user is not
  required to use the device where it first failed

### Requirement: The tool set is generated from connected connectors only

The worker-agent's tool set SHALL be generated from the manifests of connectors that are currently connected,
and a connector that is not connected SHALL NOT appear in that tool set.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-06) — UNVERIFIED.

#### Scenario: Agent cannot see an unconnected platform
- **GIVEN** the Gmail connector is not connected
- **WHEN** the worker-agent's tools are enumerated
- **THEN** no Gmail tool is present, so the agent cannot propose or attempt to use it

#### Scenario: Disconnecting during a session
- **GIVEN** a connector was connected when a job started
- **WHEN** the user disconnects it
- **THEN** jobs created afterwards do not receive its tools

### Requirement: The gate and the ledger apply uniformly to every connector

Approval hooks and ledger recording SHALL operate identically across all connectors through the manifest
contract, and an operation any connector declares `irreversible` SHALL fall under the approval rules without
connector-specific code.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-07),
`docs/spec/constitution.md` principle VI — UNVERIFIED.

#### Scenario: Newly added connector inherits enforcement
- **WHEN** a new connector's irreversible operation is invoked
- **THEN** it is evaluated by the same hook and recorded in the same ledger as every existing connector, with no
  code written for it

### Requirement: Disconnecting revokes and erases the authorisation

Disconnecting a connector SHALL call the platform's revoke endpoint when the manifest declares one, SHALL delete
the stored authorisation from secure storage on every device signed in to the account and from the account's
replicated data, SHALL fail any running job that depends on that connector with a clean failure report, and SHALL
state which of the two outcomes occurred — withdrawn at the platform, or removed from the product only.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-08),
`docs/spec/constitution.md` principle VII,
`spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED: one platform's revoke endpoint
was called and the authorisation withdrawn, while the other platform publishes no such endpoint at all, so
disconnecting it removes the product's copy while the integration remains listed in the user's account there.
Account-scoped erasure replaces the device-scoped erasure this requirement specified before
`req-022-account-sync`.

#### Scenario: Disconnect while a job is using the connector
- **GIVEN** a job is running against a connector
- **WHEN** the user disconnects it
- **THEN** the job fails with its completed-operations list and the authorisation is erased

#### Scenario: Platform offers no revoke endpoint
- **WHEN** a connector whose manifest declares no revoke endpoint is disconnected
- **THEN** the stored authorisation is erased, the user is told plainly that the platform still lists the
  integration, and the route to the page where it can be withdrawn is offered directly

#### Scenario: The revoke endpoint exists but refuses
- **WHEN** the platform's revoke endpoint is called and fails
- **THEN** the stored authorisation is still erased, and the outcome is reported as removed from the product only
  rather than as a completed withdrawal

#### Scenario: Disconnect reaches a device that was offline
- **GIVEN** a second device was offline when the connector was disconnected
- **WHEN** that device reconnects
- **THEN** the authorisation is erased from it before any job on it can use the connector

#### Scenario: A job runs on another device at the moment of disconnect
- **GIVEN** a job on a second device is using the connector
- **WHEN** the user disconnects it on the first device
- **THEN** the second device's job fails with its completed-operations list once the disconnection reaches it,
  rather than continuing to completion against a withdrawn authorisation

### Requirement: One job may use several connectors

A job SHALL be able to use tools from more than one connector, and each ledger record SHALL identify the
connector its tool call belonged to.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-10) — UNVERIFIED.

#### Scenario: Read from one platform, write to another
- **WHEN** a job reads messages from Gmail and creates tasks in Notion
- **THEN** it completes as one job and the ledger names the connector on each record

### Requirement: Connector tool interfaces are designed for external interoperability

Connector tool interfaces SHALL be designed to be compatible with the Model Context Protocol, so that
third-party connectors can later be accepted without changing the architecture, and the product's own safety
declarations SHALL be carried in that protocol's annotation surface rather than in fields of the product's own
invention.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-09, priority Should),
`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q11) — VERIFIED: a tool description taken
from an external protocol server converted into a manifest tool declaration without an architectural change, name
and parameter schema matching one to one, with the snapshot, compensation and irreversibility declarations
carried as annotations.

#### Scenario: Tool description shape
- **WHEN** a connector tool is described for the agent
- **THEN** its name, parameter schema and result shape follow the external protocol's conventions

#### Scenario: An external tool description carries no safety declaration
- **WHEN** a tool description imported from outside declares neither a compensating action nor irreversibility
  and would write
- **THEN** it yields no tool, because the product's obligation under principle IV is not waived by the origin of
  the description

### Requirement: Bring-your-own authorisation client is a first-class connect route

The product SHALL offer, per connector, a route in which the user supplies their own authorisation client
credentials, SHALL guide that setup step by step inside the application, SHALL warn before the first step about
the refresh-token lifetime that applies while the user's own client is unverified and about the provider warning
screen the user will have to pass, and SHALL declare the route's availability and its guidance as connector data
rather than as a screen written for one platform.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-11),
`docs/raw-idea/prd-mvp.md#13-6-chien-luoc-phat-hanh-khi-hoan-track-casa-quyet-dinh-oq-15`,
`spikes/SP-13-byo-oauth-google/REPORT.md#0-ket-luan` — VERIFIED: the route completes end to end on a supported
operating system, and the setup it asks of the user is six steps in the provider's console followed by two in the
application, with four actions on the provider's pages including one warning screen
(`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q5, Q7).

#### Scenario: Guided setup inside the application
- **WHEN** the user chooses the bring-your-own route for a Google connector
- **THEN** the application presents each step in order and accepts the credential file, without sending the user
  to documentation to work it out

#### Scenario: Refresh token expires under an unverified client
- **GIVEN** the user's own client is in a testing state where refresh tokens expire after seven days
- **WHEN** the token expires
- **THEN** the connector shows as expired with a one-action reconnect, and the user was warned of this at setup

#### Scenario: The user is told what the route costs before starting it
- **WHEN** the bring-your-own route is offered
- **THEN** the number of steps, the warning screen the provider shows for an unverified client, and the
  reconnection the user will have to perform periodically are stated before the first step

#### Scenario: A connector that does not offer the route
- **WHEN** a connector whose data does not declare the bring-your-own route is opened
- **THEN** the route is not offered for it, and the standard connect flow is the only one presented

### Requirement: Notion connects with a chosen workspace and default database

The Notion connector SHALL authorise against a workspace the user selects, SHALL let the user nominate a default
task database, and SHALL hold the resulting authorisation in operating-system secure storage.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-01),
`docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-01) — UNVERIFIED.

#### Scenario: Workspace selection is explicit
- **WHEN** the user authorises Notion
- **THEN** the workspace and the default database are chosen by the user rather than inferred

#### Scenario: No default database is chosen
- **GIVEN** the user skipped choosing a default database
- **WHEN** a command does not name a database
- **THEN** the agent asks which database to use rather than guessing

### Requirement: Notion read operations cover query, object and schema

The Notion connector SHALL support querying a database, reading a page or task with its properties, and reading
a database's property schema.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-02) — UNVERIFIED.

#### Scenario: Property schema informs a write
- **WHEN** the agent prepares to set a property
- **THEN** it reads the database schema first, so it writes a value of the declared type

#### Scenario: Query returns nothing
- **WHEN** a query matches no objects
- **THEN** the agent reports an empty result rather than treating it as a failure

### Requirement: Notion write operations cover creation, property update and reordering

The Notion connector SHALL support creating a task, updating properties such as title, deadline, status,
priority and assignee, and moving or reordering objects where the database carries a numeric order property;
where it does not, free reordering SHALL be reported as unsupported before anything is written.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-03),
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q4 — VERIFIED: the platform exposes no native
position for a database view and refuses a write carrying one with HTTP 400; where a numeric order property
exists, reordering is a write to that property and is compensated from the snapshot at full integrity
(`spikes/SP-1-notion-compensation/evidence/data/q4_ordering_results.json`).

#### Scenario: Property value is rejected by the platform
- **WHEN** a property update is refused because the value does not match the property type
- **THEN** the failure is recorded and reported with the offending property named

#### Scenario: The database carries a numeric order property
- **GIVEN** the database addressed by the command has a number property recognised as its order
- **WHEN** the agent moves a task ahead of another
- **THEN** the move is a write to that property, and its compensating action restores the numbers the snapshot
  recorded

#### Scenario: The database carries no order property
- **WHEN** the agent is asked to move a task to a position in a database that has no such property
- **THEN** the operation is reported as unsupported for that database, naming the absent property, and no write
  is attempted

#### Scenario: Several properties could be the order
- **GIVEN** a database carrying more than one numeric property whose name suggests an order
- **WHEN** the agent is asked to move a task
- **THEN** the connector asks which property expresses the order rather than choosing one, and no write is made
  until the answer arrives

#### Scenario: The command means a state change rather than a position
- **GIVEN** a database with no order property
- **WHEN** the command moves a task between columns of a board
- **THEN** it is performed as a write to the property that column represents, which is snapshotted and
  compensated like any other property

### Requirement: Every Notion write is preceded by a recorded snapshot

Before each write operation the Notion connector SHALL read the current state of the target object and record
that snapshot in the ledger.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-04),
`docs/spec/constitution.md` principle IV — UNVERIFIED.

#### Scenario: Snapshot cannot be read
- **GIVEN** the object cannot be read before the write
- **WHEN** the write is attempted
- **THEN** the operation is treated as having no restorable prior state and is recorded as irreversible rather
  than proceeding as if a snapshot existed

#### Scenario: Snapshot precedes the call
- **WHEN** a property update executes
- **THEN** the ledger holds the before-state recorded prior to the call

### Requirement: Each Notion write declares its compensation or its irreversibility

Each Notion write operation SHALL declare in its tool specification whether a compensating action exists and how
it is built from the snapshot, and an operation with no compensating action SHALL be flagged irreversible.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-05) — UNVERIFIED.

#### Scenario: Irreversible operation is visible before it runs
- **WHEN** an operation flagged irreversible is about to execute
- **THEN** that flag is available to the approval evaluation and to the user-facing request

### Requirement: Notion request volume respects the platform's limits

The Notion connector SHALL queue requests under one authorisation at no more than 2.5 per second, SHALL wait for
the delay the platform states when it refuses a request for volume, and SHALL NOT rely on any advance warning
that a limit is approaching.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-06),
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5,
`spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: the published average is 3
requests per second; bursts of 15 and 60 concurrent requests completed entirely, 100 concurrent requests
produced 69 accepted and 31 refused for volume, every refusal carried a stated delay in seconds, and no
successful response carried any remaining-quota header
(`spikes/SP-1-notion-compensation/evidence/data/q5_rate_limit_results.json`).

#### Scenario: Burst of writes
- **WHEN** a job issues more requests in a moment than the platform allows
- **THEN** the connector paces them and the job completes rather than failing

#### Scenario: The platform refuses a request for volume
- **WHEN** a request is refused for volume and the refusal states a delay
- **THEN** the connector waits at least that delay before its next request under that authorisation, rather than
  applying a delay of its own choosing

#### Scenario: A refusal states no delay
- **WHEN** a request is refused for volume and the refusal carries no delay
- **THEN** the connector waits a delay of its own that grows with each successive refusal up to a stated ceiling,
  rather than retrying immediately

#### Scenario: A successful response carries no quota information
- **WHEN** the platform accepts a request
- **THEN** the connector concludes nothing about remaining quota from that response, and continues to pace by
  its own queue

### Requirement: Several Notion databases are addressable in one workspace

The Notion connector SHALL support several databases within a workspace, SHALL use the database a command names,
and SHALL fall back to asking the user when no database is identified.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-08, priority Should) — UNVERIFIED.

#### Scenario: Command names a database that does not exist
- **WHEN** the command names a database the workspace does not contain
- **THEN** the agent reports that it was not found and asks, rather than writing to the default

### Requirement: Gmail is read-only in this scope

The Gmail connector SHALL support listing and searching messages and reading message content and metadata, and
SHALL NOT send, modify, delete or label messages.

Source: `docs/raw-idea/prd-mvp.md#10-11-module-connector-gmail-gm-amp-google-drive-dr` (FR-GM-01) — UNVERIFIED.

#### Scenario: Agent is asked to send mail
- **WHEN** the user asks the agent to reply to an email
- **THEN** the agent reports that sending is not available, because no such tool exists in the manifest

### Requirement: Message content enters a job only when the job needs it

The Gmail connector SHALL bring message content into a job's context only when that job requires it, SHALL NOT
index or store the mailbox in the background, and any extract recorded in the ledger SHALL follow the ledger
retention policy.

Source: `docs/raw-idea/prd-mvp.md#10-11-module-connector-gmail-gm-amp-google-drive-dr` (FR-GM-03) — UNVERIFIED.

#### Scenario: No background synchronisation
- **WHEN** no job is running
- **THEN** no mailbox content is fetched

#### Scenario: Disclosure of onward transmission
- **WHEN** the user connects Gmail
- **THEN** the flow discloses that message content will be sent to the model provider the user configured

### Requirement: Google Drive is read-only in this scope

The Google Drive connector SHALL support finding files, reading metadata and reading content through the route
declared for each file type, and SHALL NOT create, modify, delete or share files.

Source: `docs/raw-idea/prd-mvp.md#10-11-module-connector-gmail-gm-amp-google-drive-dr` (FR-DR-01, FR-DR-02),
`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) — VERIFIED for reading: more than forty
files were listed, a spreadsheet was exported to two forms and stored files were downloaded, all under an
authorisation carrying only the read scope, which is also why no write tool can be generated for this connector.

#### Scenario: Unsupported format
- **WHEN** a file's format cannot be read
- **THEN** the connector reports the format as unsupported rather than returning empty content

#### Scenario: The agent is asked to change a file
- **WHEN** the user asks the agent to edit or share a Drive file
- **THEN** the agent reports that writing is not available, because no such tool exists in the manifest

#### Scenario: A file is read under a read-only authorisation
- **WHEN** a job reads a file's content
- **THEN** the read succeeds under the scope the connector requested, and no wider scope was requested in order
  to perform it

### Requirement: Read-only connectors still honour user rules

Tools of a read-only connector SHALL be flagged read-only in the manifest, and approval rules the user has
declared over read operations SHALL still be enforced on them.

Source: `docs/raw-idea/prd-mvp.md#10-11-module-connector-gmail-gm-amp-google-drive-dr` (FR-DR-03) — UNVERIFIED;
the source marks rule enforcement over read operations as a proposal.

#### Scenario: Rule over a read operation
- **GIVEN** the user declared that reading mail from a particular sender requires asking them
- **WHEN** a job attempts that read
- **THEN** the hook stops the call and raises an approval request

### Requirement: Connecting a platform connects it for the account, not for one device

Completing a connector's authorisation SHALL make that connector connected on every device signed in to the
account, without the user repeating the authorisation on any of them.

Source: `docs/spec/changes/req-022-account-sync/proposal.md`, `docs/spec/constitution.md` principle VII —
UNVERIFIED; this resolves the question carried as `Q-OQ-9` in `req-001-mvp-product-definition` about whether the
connector token stays client-only.

#### Scenario: A second device inherits a connection
- **GIVEN** the user connected a platform on one device
- **WHEN** they sign in on another device
- **THEN** that platform is connected there, and the user is not sent to the platform's authorisation page again

#### Scenario: Bring-your-own authorisation client follows the account
- **GIVEN** the user supplied their own authorisation client for a provider that requires it
- **WHEN** they sign in on a new device
- **THEN** that provider is connected there without the user configuring the client again

#### Scenario: A device that has not yet replicated
- **GIVEN** a device has not completed replication since the connector was connected elsewhere
- **WHEN** a job on that device attempts to use the connector
- **THEN** the job reports that the connector is not yet available on this device rather than failing as though
  the authorisation were invalid

### Requirement: A connector's authorisation is persisted only through the device's credential store

A connector SHALL persist its authorisation — access token, refresh token, expiry, granted scopes, the platform
metadata that identifies the workspace or account it was issued for, and any authorisation client the user
supplied themselves — only through the device's secure credential store, and SHALL NOT write any part of it to a
configuration file, the ledger, a log, an exported diagnostic bundle or an agent's context.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-08, FR-CF-11),
`docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-01),
`spikes/SP-11-secure-storage/REPORT.md` §1 Q5 — VERIFIED for the storage route, which held each of the four
credential groups the product has, including a user-supplied authorisation client of about four hundred bytes,
under its own key.

#### Scenario: A platform is connected
- **WHEN** a connector's authorisation completes
- **THEN** the tokens, their expiry and the granted scopes are written through the credential store, and no part
  of them is present in any configuration file the user or a tool can read

#### Scenario: The user supplies their own authorisation client
- **GIVEN** the user completed the bring-your-own authorisation route for a connector
- **WHEN** the client credentials they supplied are kept for later use
- **THEN** they are written through the credential store under that connector's keys, and the file the user
  provided them in is not retained afterwards

#### Scenario: A token is refreshed during a job
- **WHEN** a connector refreshes its access token mid-job
- **THEN** the refreshed value replaces the stored one through the credential store, and the ledger record for
  the job's calls shows the refresh happened without carrying the token

#### Scenario: Authorisation is abandoned part-way
- **GIVEN** the user closed the platform's authorisation page without completing it
- **WHEN** the connector returns to the disconnected state
- **THEN** no partial credential is written, so nothing is left under that connector's keys

#### Scenario: A diagnostic bundle is exported
- **WHEN** the user exports a diagnostic bundle to report a problem with a connector
- **THEN** it states which connectors are connected and when their authorisation was last updated, and contains
  no token, refresh token or client secret

### Requirement: The authorisation code returns to the device on a loopback address it opened

The device SHALL receive the provider's redirect on a loopback address it is listening on, SHALL complete the
exchange through the broker without further user action, and SHALL show the connector as connected.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) — VERIFIED: the browser redirected to
a loopback address, the device sent the code to the broker on its own, and the interface moved to connected
without the user returning to it manually.

#### Scenario: Provider redirects back after the user authorises
- **GIVEN** the device is listening on the loopback address it supplied with the authorisation request
- **WHEN** the provider redirects to that address carrying an authorisation code
- **THEN** the device exchanges it through the broker and shows the connector as connected, with no further user
  action

#### Scenario: Provider redirects back with a refusal
- **WHEN** the redirect carries a refusal instead of an authorisation code
- **THEN** the connector returns to disconnected with the provider's reason presented, and no exchange is
  attempted

#### Scenario: Redirect arrives for a request this device did not start
- **WHEN** a redirect arrives on the loopback address carrying a binding value the device did not issue
- **THEN** it is discarded, no exchange is attempted, and the connector's state is unchanged

#### Scenario: The loopback address cannot be opened
- **WHEN** the device cannot listen on a loopback address
- **THEN** Connect fails before the browser is opened, stating that the authorisation cannot be completed on this
  device, and no partial authorisation is left behind

#### Scenario: The user never returns from the browser
- **GIVEN** the browser is open at the provider's page and the device is listening
- **WHEN** no redirect arrives within the waiting period
- **THEN** the device stops listening, the connector returns to disconnected, and Connect can be started again

### Requirement: A connector using the product's authorisation client holds no client secret on the device

A connector that authorises through the product's own authorisation client SHALL obtain its tokens through the
backend's broker, and the client secret for that provider SHALL NOT be present in the installed application, its
configuration or its logs.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3, Q7) — VERIFIED: the exchange is
performed server-side with a secret loaded from outside the source tree, and a scan of source and generated logs
found no leak. The bring-your-own route specified by `req-014-byo-oauth-google` is the deliberate exception: the
user's own credentials are supplied by the user and are held in the device's secure storage under
`req-012-secure-storage`.

#### Scenario: Installed application is inspected for provider credentials
- **WHEN** the installed application and its configuration are searched for provider client secrets
- **THEN** none is found, because the exchange that needs one happens on the server

#### Scenario: The device cannot reach the broker
- **WHEN** the device attempts to connect a platform that uses the product's authorisation client while the
  broker is unreachable
- **THEN** Connect fails stating the service is unavailable, and the device does not fall back to any
  device-side exchange

### Requirement: A connector is reached only through the four adapter operations

Every platform interaction SHALL pass through one of exactly four adapter operations — execute a declared tool,
read the prior state of a write target, establish the connection's current state, and withdraw the
authorisation — and no component outside a connector's adapter SHALL hold a route to that platform.

Source: `spikes/SP-19-connector-framework/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` — VERIFIED: the adapter
surface was reduced to these four operations and both connectors were driven entirely through it, the second one
at zero lines of change to the job manager, the evaluator, the ledger, the wrapping layer and the tool generator
(`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q3). Frozen as
`connector/contracts/connector-adapter@1.0.0`.

#### Scenario: A platform capability has no adapter operation
- **WHEN** a connector needs the product to do something the four operations do not express
- **THEN** it is declared as a tool and performed through execution, rather than by adding a fifth operation or a
  path of its own

#### Scenario: A write tool runs without its prior state being readable
- **GIVEN** a write tool declares a snapshot and the platform refuses the read
- **WHEN** the call is about to be made
- **THEN** the operation is treated as having no restorable prior state and is not executed as though a snapshot
  existed

#### Scenario: The core is asked to behave differently for one platform
- **WHEN** a second connector of an entirely different shape is added
- **THEN** the job manager, the evaluator, the ledger, the wrapping layer and the tool generator are unchanged,
  and the only additions are a manifest, an adapter and its registration

### Requirement: A connector reports failure only as a declared error code

Every failed platform interaction SHALL be returned as one of the connector error codes the adapter contract
declares, carrying whether a retry may succeed, and SHALL NOT be raised as an unclassified fault or as a success
with an error inside it.

Source: `spikes/SP-19-connector-framework/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`,
`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q10) — VERIFIED for the three codes that end
a job cleanly: a call made after the authorisation was withdrawn raised the withdrawn code, the wrapping layer
recorded it and the job finished failed without hanging or crashing.

#### Scenario: The platform refuses because the authorisation was withdrawn
- **WHEN** a tool call reaches a platform that no longer accepts the authorisation
- **THEN** the adapter returns the withdrawn-authorisation code and the job ends with that stated reason rather
  than with a generic failure

#### Scenario: The platform fails for a reason the codes do not name
- **WHEN** a platform fails in a way no specific code describes
- **THEN** it is returned as the general platform-failure code carrying the platform's own message, and never as
  a code that would imply the authorisation is at fault

#### Scenario: A failure arrives with no code at all
- **WHEN** an adapter returns a failure that carries no declared code
- **THEN** it is recorded as an unclassified adapter defect, the call counts as failed, and it is not retried as
  though it were transient

### Requirement: Connector state is established by asking the platform

The state of a connector SHALL be established by asking the platform whether the stored authorisation is
currently accepted, SHALL distinguish accepted, expired, insufficient permission and withdrawn from one another,
and SHALL state whether the device holds the means to renew the authorisation without the user returning to the
platform.

Source: `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) — VERIFIED: all four states were
produced and told apart against real endpoints, and the renewability of each was reported alongside it.

#### Scenario: The stored authorisation has expired but can be renewed
- **WHEN** the platform refuses the stored authorisation as expired and the device holds the means to renew it
- **THEN** the connector is shown as expired and renewable, and the user is not sent to the platform's page

#### Scenario: The authorisation is intact but the granted permission is too narrow
- **WHEN** the platform refuses an operation for lack of permission while accepting the authorisation
- **THEN** the connector is shown as needing wider permission, distinctly from being expired, and re-consent is
  offered rather than reconnection

#### Scenario: The platform cannot be reached at all
- **WHEN** the platform does not answer
- **THEN** the connector's last established state is shown together with the fact that it could not be checked,
  and it is not reported as revoked or expired on the strength of a failed request

### Requirement: A write tool that snapshots a structured object declares what is excluded from the snapshot

A write tool whose snapshot captures a structured object SHALL declare in its manifest which of that object's
values are computed by the platform and therefore excluded from the snapshot and from any compensating action
built from it.

Source: `spikes/SP-19-connector-framework/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`,
`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) — VERIFIED: the declared exclusions were
applied by the wrapping layer with no connector-specific code, and the recorded snapshot of a document-platform
write carried none of the six computed values `req-003-notion-compensation` identified.

#### Scenario: A computed value would be written back by an undo
- **GIVEN** a write tool captures an object whose platform computes some of its values
- **WHEN** the snapshot is recorded
- **THEN** the computed values are absent from it, so a compensating action built from that snapshot cannot
  attempt to restore a value the platform will refuse

#### Scenario: A snapshotting write tool declares no exclusions
- **WHEN** a manifest declares a write tool that snapshots a structured object and names no exclusions
- **THEN** the manifest is refused, because an undeclared exclusion list is indistinguishable from an untested one

### Requirement: A manifest is loaded whole or not at all

A manifest that does not satisfy the frozen manifest schema SHALL yield no tool at all, and the product SHALL
report which declaration failed rather than loading the declarations that were valid.

Source: `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1),
`docs/spec/constitution.md` principle IV — VERIFIED that both manifests validate against the schema; the
whole-or-nothing rule is the constitutional consequence of a write whose reversibility is undeclared.

#### Scenario: One tool declaration in a valid manifest is malformed
- **WHEN** a manifest contains nine sound tool declarations and one that is not
- **THEN** the connector offers no tools, and the failure names the declaration at fault

#### Scenario: The manifest was written for a later schema version
- **WHEN** a manifest declares a schema version whose major number exceeds the one this build understands
- **THEN** it is refused with the application version it requires, rather than loaded partially

#### Scenario: A manifest fails to load while the product is running
- **GIVEN** a connector's manifest cannot be loaded
- **WHEN** a job is created
- **THEN** the job receives no tool from that connector, the connector is presented as unavailable with the
  reason, and every other connector continues to work

### Requirement: A Notion snapshot excludes the values the platform computes

The Notion connector SHALL exclude `formula`, `rollup`, `created_time`, `created_by`, `last_edited_time` and
`last_edited_by` from every recorded pre-write snapshot, so that no compensating action built from that snapshot
can attempt to restore a value the platform refuses to be told.

Source: `spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan` condition 2,
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q1 and Q6 — VERIFIED: writing any of the six
is refused with HTTP 400 `validation_error`, and the same payload with the six removed is accepted
(`spikes/SP-1-notion-compensation/evidence/data/q6_complex_schema_results.json`,
`spikes/SP-1-notion-compensation/evidence/raw_logs/q6_test_unsanitized_patch*.json` against
`q6_test_sanitized_patch*.json`).

#### Scenario: Object carrying computed values is snapshotted
- **GIVEN** a task whose database defines a formula property and a rollup property
- **WHEN** the connector records the state before a write
- **THEN** the recorded snapshot contains neither of them, and neither the creation nor the last-edit attribution

#### Scenario: Computed values return by themselves after compensation
- **GIVEN** a write changed a relation, and the database computes a rollup from that relation
- **WHEN** the compensating action restores the relation
- **THEN** it sends only the relation, and the rollup holds its original value again without being written

#### Scenario: A compensating payload would carry a computed value
- **WHEN** a compensating action is assembled that would send one of the six computed values
- **THEN** it is refused before it leaves the device and recorded as a defect in the connector's declaration,
  rather than being sent and failing at the platform

### Requirement: Commenting on a Notion object is declared irreversible

The Notion connector SHALL declare every comment-creating tool `irreversible`, because the platform offers no
operation that removes or edits a comment once it exists.

Source: `spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan` condition 3,
`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q3 — VERIFIED: the platform publishes neither
a delete nor an update operation for a comment
(`spikes/SP-1-notion-compensation/evidence/data/q3_irreversible_results.json`).

#### Scenario: A comment is about to be written
- **WHEN** the agent calls the comment tool
- **THEN** the declaration read by the approval evaluation says the operation cannot be reversed, and the user's
  request to approve says so in those terms

#### Scenario: A comment appears in an undo plan
- **GIVEN** a job added a comment and updated a deadline
- **WHEN** the undo plan is presented
- **THEN** the deadline appears as revertible and the comment appears as irreversible, with the absence of a
  platform operation given as its reason

### Requirement: A Notion choice property is restored by option identity rather than by label

The Notion connector SHALL record both the identity and the label of a `select` or `status` value in its
snapshot, and SHALL build the compensating action from the identity, so that renaming an option between the
write and its compensation does not change which option is restored.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q8 — VERIFIED: both property kinds
accept a write addressed by identity or by label, and restoration by identity was unaffected by a label change
(`spikes/SP-1-notion-compensation/evidence/data/q8_status_vs_select_results.json`).

#### Scenario: The option was renamed after the write
- **GIVEN** a status value was changed by a job, and a person then renamed that option in the database
- **WHEN** the compensating action runs
- **THEN** the property holds the same option it held before the job, under its new label

#### Scenario: The option no longer exists
- **WHEN** the option recorded in the snapshot has been removed from the database
- **THEN** the step is reported as not restorable with that reason, and no option is created by label to stand
  in for it

### Requirement: A Notion status property cannot be restored to empty

When the recorded prior state of a `status` property is empty, the Notion connector SHALL report the outcome of
its compensating action as the platform's default option rather than as the property restored to empty.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q8,
`spikes/SP-1-notion-compensation/REPORT.md#4-rui-ro-moi-phat-hien` risk 2 — VERIFIED: a `status` property sent
as empty is set by the platform to the first option of its to-do group rather than cleared
(`spikes/SP-1-notion-compensation/evidence/raw_logs/q8_null_status*.json`).

#### Scenario: Prior state of the status property was empty
- **GIVEN** a job set a status on a task whose status was previously empty
- **WHEN** that write is compensated
- **THEN** the task carries the platform's default status, and the report says the property could not be
  returned to empty rather than reporting it as restored

#### Scenario: Prior state of the status property held an option
- **WHEN** a status that held an option is compensated
- **THEN** the option is restored and the outcome is reported as restored, with no such qualification

### Requirement: A Notion option introduced by a write outlives the compensation of that write

When a write adds an option to a database's `select` schema, the Notion connector SHALL report that option as
left behind after the write is compensated, because removing it is outside the platform's write surface.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q8,
`spikes/SP-1-notion-compensation/REPORT.md#4-rui-ro-moi-phat-hien` risk 1 — VERIFIED: writing an unknown value
to a `select` property adds it to the database schema and returns HTTP 200, while the same write to a `status`
property is refused with HTTP 400
(`spikes/SP-1-notion-compensation/evidence/data/q8_status_vs_select_results.json`).

#### Scenario: A write invents a new label
- **GIVEN** a job set a `select` property to a label the database did not have
- **WHEN** that write is compensated
- **THEN** the object holds its prior value again, and the report states that the new label remains in the
  database's settings

#### Scenario: The same write is attempted on a status property
- **WHEN** a job sets a `status` property to a label the database does not have
- **THEN** the platform refuses the write, the failure names the property, and no residue is created

### Requirement: Compensating a Notion creation states what the compensation leaves behind

The compensating action for creating a Notion object SHALL move that object to the platform's recoverable
removed state, and SHALL report both that the object remains recoverable there and that its identifier is not
reclaimed.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q2,
`spikes/SP-1-notion-compensation/evidence/compensation-matrix.md` §1 — VERIFIED: the compensation returns
HTTP 200, the object leaves the database view, and it remains readable in the removed state.

#### Scenario: A created task is compensated
- **WHEN** the creation of a task is compensated
- **THEN** the task is no longer in the database's contents, and the report states it is in the platform's
  recoverable removed state rather than deleted

#### Scenario: The removed object was already cleared at the platform
- **GIVEN** the creation of an object is being compensated and a person has already cleared it permanently
- **WHEN** the compensating action runs
- **THEN** it reports the object as already absent and succeeds in intent rather than failing, since nothing it
  was asked to remove remains

### Requirement: A Notion write that notifies a person declares a notification it cannot recall

A Notion write tool that causes the platform to notify a person SHALL declare that notification as an effect its
compensating action cannot recall, and that declaration SHALL be available to the approval evaluation and to the
undo preview together with the words the user is shown.

Source: `spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan` condition 4,
`spikes/SP-1-notion-compensation/REPORT.md#4-rui-ro-moi-phat-hien` risk 4 — VERIFIED: assigning a person to a
task sends that person an email and an in-application notification that no platform operation withdraws
(`spikes/SP-1-notion-compensation/evidence/data/q3_irreversible_results.json`).

#### Scenario: Assignment is about to happen
- **WHEN** the user is asked to approve a write that assigns a person
- **THEN** the request states that the person will be notified and that undoing the assignment does not withdraw
  the notification

#### Scenario: The assignment is undone
- **WHEN** the assignment is compensated
- **THEN** the person is removed from the property, and the report names the notification that was already sent

### Requirement: The Notion connector tells a recoverably removed object apart from an absent one

The Notion connector SHALL classify an object the platform still returns in its removed state as recoverable,
SHALL classify an object the platform refuses to return as absent-or-unreachable, and SHALL NOT present the
second as evidence that the object was deleted.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q7,
`spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: an object in the platform's trash
is returned with HTTP 200 and a removed marker, while permanent deletion and withdrawn access both return
HTTP 404 with one indistinguishable code
(`spikes/SP-1-notion-compensation/evidence/data/q7_error_codes_results.json`).

#### Scenario: The object is in the platform's trash
- **WHEN** the prior state of a removed object is read
- **THEN** it is returned with its properties and marked recoverable, rather than reported as missing

#### Scenario: The object cannot be returned at all
- **WHEN** the platform refuses to return the object
- **THEN** the outcome names both possibilities — removed permanently, or no longer shared with the connector —
  because the platform does not distinguish them, and neither is asserted as the cause

### Requirement: Notion pacing is held per authorisation rather than per device

The Notion connector SHALL pace requests against one authorisation independently of every other authorisation,
so that an authorisation waiting out a refusal does not delay work under a different one.

Source: `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5 — VERIFIED: while one token was
inside its cooldown, a second token called successfully from the same device
(`spikes/SP-1-notion-compensation/evidence/data/q5_rate_limit_results.json`).

#### Scenario: One authorisation is waiting and another is idle
- **GIVEN** one Notion authorisation has been refused for volume and is waiting
- **WHEN** a job issues a call under a different Notion authorisation
- **THEN** that call proceeds at its own pace rather than waiting for the first

#### Scenario: Two jobs share one authorisation
- **WHEN** two jobs issue Notion calls under the same authorisation at the same time
- **THEN** they draw on one pacing budget between them, rather than each pacing as though it were alone

### Requirement: An unmeasured Notion capability is declared absent rather than offered

The Notion connector SHALL declare no tool for creating a page directly in the workspace rather than in a
database, while that capability remains unverified, and SHALL tell the agent the capability is unavailable
rather than attempting it.

Source: `spikes/SP-1-notion-compensation/REPORT.md#5-chua-tra-loi-duoc-vi-sao`,
`docs/spec/constitution.md` Evidence Discipline — the capability is UNVERIFIED: the authorisation kind the spike
used is refused by the platform for this operation, so neither its snapshot nor its compensation has been
measured; recorded as Q-1 in `clarifications.md`.

#### Scenario: The agent is asked to create a page outside a database
- **WHEN** a command requires a page that belongs to the workspace rather than to a database
- **THEN** the agent is told the connector does not offer that operation, and the database route is offered
  instead of an attempt

#### Scenario: The manifest is loaded
- **WHEN** the Notion manifest is loaded
- **THEN** it declares no tool for that operation, so no tool for it can reach an agent

### Requirement: The Google connector authorises with an authorisation client the user created

The Google connector SHALL, on the bring-your-own route, perform the whole authorisation with the authorisation
client the user created in the provider's console — opening the provider's page in the system browser under that
client's identity and exchanging the returned code against it on the device — and SHALL NOT route that exchange
through the backend's broker or present the product's own authorisation client anywhere in the flow.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1),
`spikes/SP-13-byo-oauth-google/evidence/q1_loopback_run.log` — VERIFIED: the device opened the system browser
against a user-created client, received the code on its own listener, exchanged it at the provider's token
endpoint without a server in the path, and then read real data from both Gmail and Drive with the resulting
token. `docs/spec/constitution.md` principle VIII — the route is an official in-app flow, not a developer
shortcut.

#### Scenario: The user completes the bring-your-own route
- **GIVEN** the user has supplied an authorisation client for Google
- **WHEN** the user activates Connect
- **THEN** the system browser opens at the provider's page under that client, and on the user's consent the
  connector reaches connected without the user returning to the application to finish anything

#### Scenario: The broker is never asked about a user-supplied client
- **WHEN** the bring-your-own route completes an exchange
- **THEN** no request carrying the user's client identifier or client secret leaves the device for the product's
  backend

#### Scenario: The backend is unreachable during a bring-your-own connect
- **GIVEN** the product's backend cannot be reached
- **WHEN** the user connects Google through their own authorisation client
- **THEN** Connect completes, because nothing in this route depends on the backend

### Requirement: The device chooses its loopback port at the moment it connects

The bring-your-own route SHALL listen for the provider's redirect on a loopback port acquired when Connect starts
rather than on a port fixed in advance, and SHALL NOT require the user to register that port, or any port, with
the authorisation client they created.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2),
`spikes/SP-13-byo-oauth-google/evidence/q2_dynamic_ports.log` — VERIFIED: a client declaring only
`http://localhost` accepted authorisation requests on three unrelated ports, on both loopback host forms and with
no port at all, while an address the client had not registered was refused. The behaviour is the desktop-client
rule of RFC 8252 §7.3, confirmed by measurement rather than assumed from it.

#### Scenario: The chosen port is already taken
- **GIVEN** another process holds the port the device would have used
- **WHEN** Connect starts
- **THEN** a different free port is acquired and the flow proceeds, without asking the user to change anything

#### Scenario: No loopback port can be acquired
- **WHEN** the device cannot listen on any loopback port
- **THEN** Connect fails before the browser is opened, stating that the authorisation cannot be completed on this
  device, and no partial authorisation is left behind

#### Scenario: Setup never mentions a port
- **WHEN** the user is guided through creating their authorisation client
- **THEN** no step asks them to enter a redirect address or a port number

### Requirement: A supplied authorisation client is checked before the browser is opened

The connector SHALL accept the authorisation client the user supplies only after confirming that it carries the
identifiers the flow needs and that it is of the desktop kind the loopback route requires, and SHALL report what
is wrong with a client it refuses, naming the step of the guide that produces a correct one.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2, Q7),
`spikes/SP-13-byo-oauth-google/evidence/byo-setup-guide-draft.md#6-xu-ly-cac-su-co-thuong-gap` — VERIFIED for the
distinction that matters: the desktop-kind client accepted an unregistered loopback port, and an address outside
what a client registers was refused by the provider with a mismatch error, which is the failure a client of the
wrong kind produces after the user has already left for the browser.

#### Scenario: A client of the wrong kind is supplied
- **WHEN** the user supplies an authorisation client that is not of the desktop kind
- **THEN** it is refused before the browser opens, stating that the loopback route needs a desktop client and
  which step of the guide creates one

#### Scenario: A file that is not an authorisation client at all
- **WHEN** the user supplies a file that does not carry an authorisation client
- **THEN** it is refused naming what was missing, the connector stays disconnected, and nothing is stored

#### Scenario: A valid client replaces one already stored
- **GIVEN** an authorisation client is already stored for Google
- **WHEN** the user supplies a different valid one
- **THEN** the stored tokens obtained under the previous client are discarded with it, because they were issued
  to a client that is no longer in use

### Requirement: A consent that grants less than was asked for does not present as connected

When the provider returns an authorisation whose granted scopes are narrower than the selected profile requested,
the connector SHALL record what was granted, SHALL present itself as needing wider permission naming the
capabilities that are unavailable, and SHALL NOT present as connected or offer the tools whose scope was
withheld.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5),
`spikes/SP-13-byo-oauth-google/evidence/ui_scope_consent.svg` — VERIFIED: the provider's consent screen presents
each requested scope as an individually selectable box, so a consent that grants one and withholds the other is
an ordinary outcome of the screen the user is shown rather than an exceptional one.

#### Scenario: The user grants mail and withholds files
- **GIVEN** the profile requested reading mail and reading files
- **WHEN** the user ticks only the mail permission and continues
- **THEN** the connector reports that file reading is unavailable until permission is granted, offers re-consent,
  and the file-reading tools are absent from the tool set

#### Scenario: The user withholds everything
- **WHEN** the user continues having ticked nothing
- **THEN** the connector returns to disconnected with the reason, and no authorisation is stored

#### Scenario: Re-consent widens an existing authorisation
- **GIVEN** the connector is short of one capability's scope
- **WHEN** the user completes re-consent granting it
- **THEN** the connector reaches connected and the previously absent tools appear in the next job's tool set

### Requirement: An account the user's own client does not admit is reported as the client's restriction

When the provider refuses the authorisation because the signing-in account is not admitted by the user's own
authorisation client, the connector SHALL report that the client admits only the accounts listed on it and point
at the step of the guide where accounts are listed, and SHALL NOT present the refusal as a fault of the product
or of the account.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5),
`spikes/SP-13-byo-oauth-google/evidence/byo-setup-guide-draft.md#6-xu-ly-cac-su-co-thuong-gap` — VERIFIED: an
account outside the client's list is refused by the provider with an access-denied error at the account-chooser
step, before any consent is shown.

#### Scenario: The user signs in with an account the client does not list
- **WHEN** the provider refuses with an access-denied outcome at the account chooser
- **THEN** the connector explains that this account is not listed on the user's own authorisation client and
  names the guide step that lists accounts

#### Scenario: The user authorises a different account from the one they use in the product
- **WHEN** the authorisation completes for an account other than the one previously connected
- **THEN** the connector records the account the authorisation was issued for and states it, so a mailbox the
  user did not expect is visible as such rather than silently in use

### Requirement: A refused renewal under the user's own client is an expired connector, not a lost one

When the provider refuses to renew an authorisation obtained through the user's own client, the connector SHALL
move to the expired state carrying the instant of the refusal and the provider's own reason, SHALL keep the
stored authorisation client, and SHALL NOT erase the connector, discard the user's client credentials, or present
the failure as a revocation performed by the user.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3),
`spikes/SP-13-byo-oauth-google/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED that renewal succeeds while the
authorisation is inside the provider's window for an unverified client, and that the seven-day window is the
provider's standard behaviour for such a client rather than a defect. The precise refusal the provider returns at
the end of that window is UNVERIFIED and is scheduled for measurement in `verification.md`.

#### Scenario: Renewal is refused mid-job
- **GIVEN** a job is calling a Google tool
- **WHEN** renewal of the authorisation is refused
- **THEN** the job fails stating that the Google connector must be reconnected, and the connector is shown as
  expired with a reconnect action

#### Scenario: The provider cannot be reached during renewal
- **WHEN** the renewal request does not reach the provider
- **THEN** the connector is not moved to expired, because nothing was established about the authorisation

#### Scenario: Expiry is expected rather than surprising
- **WHEN** the connector becomes expired under an unverified client
- **THEN** the reason shown is the one the user was warned of at setup, stated in the same words

### Requirement: Reconnecting under the user's own client never asks for the credential file again

Reconnecting a connector authorised through the user's own client SHALL reuse the stored authorisation client and
run only the browser consent, and SHALL NOT ask the user to supply the credential file, repeat any step performed
in the provider's console, or re-enter anything they entered at first setup.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` — VERIFIED as the specified
shape of the one-click reconnect; the stored client is what the flow needs and it is already held.
`docs/spec/constitution.md` principle VII — the user carries nothing between reconnections, as they carry nothing
between machines.

#### Scenario: Reconnect after the seven-day window
- **GIVEN** the connector is expired because renewal was refused
- **WHEN** the user activates reconnect
- **THEN** the browser opens at the provider's consent page under the stored client, and on consent the connector
  returns to connected

#### Scenario: The stored authorisation client is gone
- **GIVEN** the stored authorisation client cannot be read
- **WHEN** the user activates reconnect
- **THEN** the guide is offered from the step that supplies the credential file, rather than a consent that
  cannot succeed being attempted

#### Scenario: Reconnect is abandoned
- **WHEN** the user closes the provider's page without consenting
- **THEN** the connector stays expired with its reconnect action, and the stored authorisation client is
  untouched

### Requirement: The authorisation client the user supplied belongs to the account, not to the device

An authorisation client supplied by the user SHALL be held as part of that connector's account-owned
authorisation, so that signing in on another device makes the Google connector usable there without repeating any
step performed in the provider's console, and disconnecting the connector SHALL erase the supplied client with
the tokens obtained under it.

Source: `docs/spec/constitution.md` principle VII; `docs/spec/changes/req-012-secure-storage/specs/connector/spec.md`;
`spikes/SP-11-secure-storage/REPORT.md` §1 Q5 — VERIFIED for the storage route, which held a user-supplied
authorisation client of about four hundred bytes under its own key. That the second device needs no console work
follows from the client being data the account holds — UNVERIFIED, and listed for measurement in
`verification.md`.

#### Scenario: The user signs in on a second device
- **GIVEN** Google was connected through the user's own client on one device
- **WHEN** the user signs in to the account on another device and replication completes
- **THEN** Google is usable there with no return to the provider's console

#### Scenario: The connector is disconnected
- **WHEN** the user disconnects Google
- **THEN** the supplied authorisation client is erased along with the tokens, on every device the account reaches

#### Scenario: A device has not yet replicated the client
- **WHEN** the connectors area is opened on a device that does not hold the account's Google authorisation yet
- **THEN** Google is shown as unavailable on this device, and the bring-your-own guide is not offered as though
  the client had to be created again

### Requirement: A Drive file is read by the route its type declares

The Drive connector SHALL read a file through the route declared for its type — exporting a document or
spreadsheet to the text form declared for it, and downloading a stored file directly — and SHALL report the type
as unsupported when no route is declared for it rather than returning empty content.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6),
`spikes/SP-13-byo-oauth-google/evidence/q6_drive_export_read.log` — VERIFIED: a spreadsheet exported to delimited
text returned its real columns, the same spreadsheet exported to a document format returned a document, and
stored files of several types downloaded directly, all under an authorisation carrying only the read scope.

#### Scenario: A spreadsheet is read
- **WHEN** a job reads a spreadsheet
- **THEN** it receives the delimited text form declared for spreadsheets, not an opaque document

#### Scenario: A stored file is read
- **WHEN** a job reads a file the platform stores rather than computes
- **THEN** it is downloaded directly rather than exported

#### Scenario: A type with no declared route
- **WHEN** a job reads a file of a type no route is declared for
- **THEN** the connector reports the type as unsupported and names it, and no partial content is returned

### Requirement: A file that exceeds the ceiling of its route is refused with the ceiling named

Reading a Drive file SHALL be refused when it exceeds the ceiling declared for its route, and the refusal SHALL
state the ceiling and which route it belongs to, so that the user learns the file is too large rather than that
the connector failed.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) — VERIFIED that a stored file of
30,749,685 bytes downloaded successfully, so the ceiling this product applies to a direct download is a product
decision rather than a platform limit. The platform's own export ceiling and the error it returns above it are
UNVERIFIED, taken from provider documentation and listed for measurement in `verification.md`.

#### Scenario: A stored file above the product's ceiling
- **WHEN** a job reads a stored file larger than the declared download ceiling
- **THEN** the read is refused stating the ceiling, and nothing is loaded into the job

#### Scenario: An export the platform refuses for size
- **WHEN** the platform refuses an export because the exported form would exceed its own ceiling
- **THEN** the connector reports that the document is too large to export and states the platform's ceiling,
  rather than reporting a generic platform failure

#### Scenario: A file whose size the platform does not state
- **WHEN** a file's size is not known before the read begins
- **THEN** the read stops at the ceiling and is reported as exceeding it, rather than being allowed to continue
  because the size was unknown

### Requirement: A Google capability that was never exercised is declared absent rather than offered

The Google connector SHALL declare only the capabilities that were exercised against the provider through a real
authorisation, and a capability that was not SHALL be absent from the manifest so that no tool for it is
generated, rather than being offered on the strength of the provider's documentation.

Source: `docs/spec/constitution.md` Evidence Discipline;
`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q6) — VERIFIED for listing and reading
messages, and for listing, exporting and downloading files. `spikes/SP-13-byo-oauth-google/REPORT.md#5-chua-tra-loi-duoc-vi-sao`
records what the spike could not exercise.

#### Scenario: An unexercised capability is requested
- **WHEN** the user asks for something the connector declares no tool for
- **THEN** the agent reports that the capability is not available, because no such tool exists in the manifest

#### Scenario: Scope is not requested for an absent capability
- **WHEN** the bring-your-own consent is presented
- **THEN** it asks only for the scopes of the declared capabilities, so the user is not asked to grant more than
  the product can use

### Requirement: Every platform call passes through one resource coordinator

Every call that reaches a platform SHALL pass through a single device-wide coordinator that grants the resources
the call declared and dispatches the request through that authorisation's shared queue, and no component outside
that coordinator SHALL hold a route by which a connector adapter is invoked.

Source: `spikes/SP-15-concurrency/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-15-concurrency/REPORT.md` §1 Q3 — VERIFIED: worker agents run isolated from one another, so a queue
or a lock held inside one of them governs nothing outside it; both mechanisms were measured only as a single
shared instance, and the head-of-line measurement is meaningless against per-worker queues that cannot see each
other.

#### Scenario: Two agents call the same platform at the same time
- **GIVEN** two jobs are running in separate agent sessions against one connector authorisation
- **WHEN** both issue a platform call in the same moment
- **THEN** both calls are paced by one queue and counted against one budget, rather than each session pacing as
  though it were alone

#### Scenario: A component attempts to reach a platform directly
- **WHEN** any component other than the coordinator attempts to invoke a connector adapter
- **THEN** no such route exists, so the attempt cannot be made rather than being detected and refused

#### Scenario: The coordinator cannot admit the call
- **GIVEN** the coordinator is unavailable or is shutting down
- **WHEN** a tool call is made
- **THEN** the call does not reach the platform, the job fails with that stated reason, and no call is made
  outside the coordinator as a fallback

### Requirement: A resource is named by a normalised key derived from the call's own arguments

A resource SHALL be named by the key `<connector>:<type>:<identifier>`, the identifier SHALL be taken from the
argument path the tool declared and normalised by the rule the connector declared, and the key SHALL NOT be
taken from any value a model supplied for the purpose nor be qualified by the authorisation used.

Source: `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — VERIFIED for the key's
shape, which is the form the measured lock manager used; `spikes/SP-15-concurrency/REPORT.md` §1 Q1 — VERIFIED
for why the authorisation is excluded: concurrent writes to one object from separate callers are accepted and
silently resolved last-write-wins by the platform, so two callers reaching one object must contend for one key.
The decision is recorded as Q-2 in `clarifications.md`.

#### Scenario: The same object is named in two forms
- **GIVEN** a platform accepts an object's identifier both with and without separators
- **WHEN** two calls name the same object in the two different forms
- **THEN** they contend for one key, because the connector's declared normalisation maps both forms to it

#### Scenario: Two authorisations reach one object
- **GIVEN** two connected authorisations of the same platform can both address one object
- **WHEN** a job under each authorisation writes to that object
- **THEN** the two calls contend for one key, rather than each believing it holds exclusive access

#### Scenario: The call names a different object than the key would
- **WHEN** a tool call is prepared
- **THEN** the key is derived from the same argument the platform call will address, so no call can be made
  against an object other than the one whose key was granted

### Requirement: A write tool declares the resources it touches, or its manifest is refused

A tool that writes SHALL declare, in its connector manifest, every argument path naming a resource it may change
and the type of each, and a manifest containing a writing tool whose declaration is absent, malformed, or names
a path its parameter shape does not contain SHALL be refused whole, yielding no tool from that connector.

Source: `spikes/SP-15-concurrency/REPORT.md` §1 Q2 — VERIFIED: an unlocked write produced a stale recorded
snapshot whose later compensation erased another job's completed work, so a write that cannot be held
exclusively is a write whose record cannot be trusted. Refusing the manifest whole rather than withholding one
tool is the treatment the existing requirement that a manifest is loaded whole or not at all already fixes, and
the treatment `connector/contracts/connector-manifest@1.2.0` gives a write tool that declares neither a
compensation nor its irreversibility: a partially loaded connector would offer writes the product cannot keep
its promises about.

#### Scenario: A writing tool declares no resource
- **WHEN** a manifest declares a writing tool with no resource declaration
- **THEN** that connector yields no tool at all and is presented as unavailable naming the tool, while every
  other connector is unaffected

#### Scenario: The declaration names a parameter that does not exist
- **WHEN** a resource declaration names an argument path absent from the tool's parameter shape
- **THEN** the manifest is refused at registration and the connector's author is told which path is wrong,
  rather than the call failing later when the argument cannot be read

#### Scenario: A read tool declares nothing
- **WHEN** a tool that only reads declares no resource
- **THEN** the manifest loads normally, because a read records no prior state that another job could falsify

#### Scenario: A read tool declares a resource
- **WHEN** a tool that only reads declares a resource it touches
- **THEN** the manifest is refused, because a read takes no exclusive access and the declaration states
  something that cannot be true

### Requirement: Requests under one authorisation are dispatched fairly between jobs

Requests waiting under one authorisation SHALL be dispatched so that a job's wait does not grow with another
job's backlog and so that no job waiting to be dispatched is passed over indefinitely, and the pacing SHALL
remain within the request rate that authorisation's connector declares.

Source: `spikes/SP-15-concurrency/REPORT.md` §1 Q3 — VERIFIED: against a bulk job holding fifteen queued
requests, an interactive job's wait was 4,251 ms under first-in-first-out and 252 ms under round-robin across
per-job queues, 11.7 times faster, while the bulk job's own completion grew by about sixteen percent. The weight
per job class and the floor guaranteeing the background class a share are recommendations of the same report and
are unmeasured; they are declared defaults under
`connector/contracts/coordination-declaration@0.1.0` rather than part of this requirement, per Q-5 in
`clarifications.md`.

#### Scenario: A short job arrives behind a long one
- **GIVEN** a bulk job has many requests waiting under one authorisation
- **WHEN** a job the user just started issues one request under the same authorisation
- **THEN** that request is dispatched within a bounded number of dispatches rather than after the bulk job's
  backlog has drained

#### Scenario: A stream of short jobs arrives while a bulk job runs
- **GIVEN** a bulk job is waiting under an authorisation
- **WHEN** short jobs arrive continuously under the same authorisation
- **THEN** the bulk job continues to be dispatched and completes, rather than being deferred for as long as
  short jobs keep arriving

#### Scenario: The platform refuses a request for volume
- **WHEN** the platform refuses a request for volume and states a delay
- **THEN** dispatching under that authorisation pauses for at least that delay, and requests of every job under
  it wait together rather than one job absorbing the pause on behalf of the others

#### Scenario: Another authorisation is idle
- **GIVEN** one authorisation is paused after a refusal
- **WHEN** a job issues a request under a different authorisation
- **THEN** that request is dispatched at its own pace, because the queue is per authorisation

### Requirement: A call obtains every resource it declared at once, in a fixed order

A call SHALL obtain all of the resources it declared in one attempt, ordered canonically by key, SHALL obtain
none of them when any one cannot be obtained, and SHALL NOT obtain a further resource after it has begun; a job
that already holds a key SHALL obtain it again without waiting.

Source: `spikes/SP-15-concurrency/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-049) — VERIFIED as the risk: a job
holding one platform's object while waiting for another's, against a second job holding them in the opposite
order, deadlocks; the report names canonical ordering and upfront acquisition as the two mitigations, and Q-1 in
`clarifications.md` records taking both rather than either.
`spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — VERIFIED for reentrancy within one
job.

#### Scenario: Two jobs need the same two resources in opposite orders
- **GIVEN** two jobs each need one object on each of two connectors
- **WHEN** both start at the same moment
- **THEN** both complete, because each obtains its whole set in one ordered attempt and neither holds one
  resource while waiting for the other

#### Scenario: A call discovers a resource it did not declare
- **WHEN** a call would need a resource its declaration did not name
- **THEN** the call is refused with that stated reason rather than obtaining a second resource while holding the
  first

#### Scenario: A job calls a tool twice on one object
- **GIVEN** a job holds the key for an object
- **WHEN** the same job makes a further call on that object
- **THEN** it proceeds without waiting, because a job does not contend with itself

#### Scenario: Part of the set is unavailable
- **GIVEN** a call declares two resources and another job holds one of them
- **WHEN** the call attempts to obtain them
- **THEN** it holds neither in the meantime, so the resource that was free is not withheld from other jobs while
  this call waits

### Requirement: A call that cannot obtain its resources within the wait limit is refused rather than made

A call SHALL wait at most the coordinator's configured limit, defaulting to 15 seconds, for the resources it
declared, SHALL then be refused with the coordinator's resource-held error code naming the job that holds them,
and SHALL NOT reach the platform.

Source: `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — VERIFIED for the limit and
the distinct error code, which the report specifies precisely so the job manager can retry with backoff instead
of failing the job outright. `spikes/SP-15-concurrency/REPORT.md` §1 Q4 — VERIFIED for the magnitudes the limit
must accommodate: the longest queue wait measured at three concurrent jobs was 1,327 ms and at five was
3,332 ms.

#### Scenario: The holder finishes inside the limit
- **GIVEN** a job is waiting for a resource another job holds
- **WHEN** the holder releases it before the limit elapses
- **THEN** the waiting call proceeds normally and nothing is reported to the user

#### Scenario: The limit elapses
- **WHEN** the limit elapses with the resource still held
- **THEN** the call is refused with the resource-held code, the platform is not called, and the refusal names
  the job holding the resource so the wait can be explained rather than merely reported

#### Scenario: The refusal is distinguishable from a platform failure
- **WHEN** a call is refused because a resource was held
- **THEN** the recorded outcome identifies it as a coordinator refusal rather than as a failure of the platform,
  so no connector is presented as unhealthy because of it

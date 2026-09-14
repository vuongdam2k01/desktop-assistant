## ADDED Requirements

### Requirement: A connector is defined by a manifest

Every connector SHALL be defined by a manifest declaring its identity, name and icon, its authorisation
configuration including the scope required per capability, and its tool list with parameter schemas; and every
write tool in that list SHALL declare either its pre-write snapshot method together with the formula for its
compensating action, or the flag `irreversible`.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-01),
`docs/spec/constitution.md` principles IV and VI — UNVERIFIED; the manifest contract is frozen in
`req-019-connector-framework`.

#### Scenario: Write tool without a compensation declaration
- **WHEN** a manifest declares a write tool that carries neither a compensating-action formula nor the
  `irreversible` flag
- **THEN** the manifest is rejected and the connector does not load

#### Scenario: Adding a platform changes no core component
- **WHEN** a new connector is added by supplying a manifest and an adapter
- **THEN** the job manager, the approval hooks, the ledger and the interface are unchanged

### Requirement: Connecting is the same for every connector and asks nothing technical

Connecting any connector SHALL follow one flow — choose the application from the catalogue, activate Connect,
authorise in the platform's own page in the browser, return to a connected state — and SHALL NOT ask the user
to paste a token, enter a client identifier or configure a redirect address.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-02) — UNVERIFIED.

#### Scenario: User connects a second platform
- **WHEN** the user connects a platform they have never connected before
- **THEN** the steps presented are identical to the first connector's, apart from the platform's own
  authorisation page

#### Scenario: User abandons the authorisation page
- **GIVEN** the browser is open at the platform's authorisation page
- **WHEN** the user closes it without authorising
- **THEN** the connector returns to the disconnected state with an explanation and no partial credential is kept

### Requirement: Only the scope of an enabled capability is requested

A connector SHALL request only the scopes required by the capabilities currently enabled, SHALL obtain any
further scope through a separate re-consent flow, and its manifest SHALL support several capability-to-scope
profiles so that a release channel can be changed by selecting a profile.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-04) — UNVERIFIED.

#### Scenario: New capability needs a wider scope
- **GIVEN** a connector is authorised for reading only
- **WHEN** the user enables a capability that writes
- **THEN** a re-consent flow requests the additional scope, and the scope was not requested in advance

#### Scenario: Switching release channel
- **WHEN** the release channel changes
- **THEN** a different capability-to-scope profile is selected from the same manifest, with no change to the
  manifest's core

### Requirement: Connector state is visible and recoverable in one action

The application SHALL show each connector as connected, token expired, permission error or revoked, SHALL offer
a one-action reconnect, and a job that meets a failing connector SHALL fail with a clear reason and a direct
route to reconnect.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-05),
`docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-07) — UNVERIFIED.

#### Scenario: Authorisation is revoked at the platform
- **GIVEN** the user revoked the authorisation in the platform's own settings
- **WHEN** a running job calls that connector
- **THEN** the job fails stating that the authorisation was revoked, and the application shows the connector as
  revoked with a reconnect action

#### Scenario: Reconnect restores the running state
- **WHEN** the user completes reconnect
- **THEN** the connector returns to connected and subsequent jobs use it without further configuration

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

Disconnecting a connector SHALL call the platform's revoke endpoint when one exists, SHALL delete the stored
authorisation from secure storage, and SHALL fail any running job that depends on that connector with a clean
failure report.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-08) — UNVERIFIED; account-scoped
revocation across devices is specified by `req-022-account-sync`.

#### Scenario: Disconnect while a job is using the connector
- **GIVEN** a job is running against a connector
- **WHEN** the user disconnects it
- **THEN** the job fails with its completed-operations list and the authorisation is erased

#### Scenario: Platform offers no revoke endpoint
- **WHEN** a connector without a revoke endpoint is disconnected
- **THEN** the local authorisation is erased and the user is told the authorisation must also be withdrawn in the
  platform's own settings

### Requirement: One job may use several connectors

A job SHALL be able to use tools from more than one connector, and each ledger record SHALL identify the
connector its tool call belonged to.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-10) — UNVERIFIED.

#### Scenario: Read from one platform, write to another
- **WHEN** a job reads messages from Gmail and creates tasks in Notion
- **THEN** it completes as one job and the ledger names the connector on each record

### Requirement: Connector tool interfaces are designed for external interoperability

Connector tool interfaces SHALL be designed to be compatible with the Model Context Protocol, so that
third-party connectors can later be accepted without changing the architecture.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-09, priority Should) — UNVERIFIED;
the source marks this as a proposal.

#### Scenario: Tool description shape
- **WHEN** a connector tool is described for the agent
- **THEN** its name, parameter schema and result shape follow the external protocol's conventions

### Requirement: Bring-your-own authorisation client is a first-class connect route

The product SHALL offer, per connector, a route in which the user supplies their own authorisation client
credentials, SHALL guide that setup step by step inside the application, and SHALL warn about the refresh-token
lifetime that applies while the user's own client is unverified.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-11),
`docs/raw-idea/prd-mvp.md#13-6-chien-luoc-phat-hanh-khi-hoan-track-casa-quyet-dinh-oq-15` — UNVERIFIED; measured
in `req-014-byo-oauth-google`.

#### Scenario: Guided setup inside the application
- **WHEN** the user chooses the bring-your-own route for a Google connector
- **THEN** the application presents each step in order and accepts the credential file, without sending the user
  to documentation to work it out

#### Scenario: Refresh token expires under an unverified client
- **GIVEN** the user's own client is in a testing state where refresh tokens expire after seven days
- **WHEN** the token expires
- **THEN** the connector shows as expired with a one-action reconnect, and the user was warned of this at setup

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
priority and assignee, and moving or reordering objects.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-03) — UNVERIFIED; the conditions under
which reordering is supported are measured in `req-003-notion-compensation`.

#### Scenario: Property value is rejected by the platform
- **WHEN** a property update is refused because the value does not match the property type
- **THEN** the failure is recorded and reported with the offending property named

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

The Notion connector SHALL queue requests and apply backoff so that a burst of requests does not cause a job to
fail against the platform's rate limits.

Source: `docs/raw-idea/prd-mvp.md#10-3-module-connector-notion-nt` (FR-NT-06) — UNVERIFIED; the source defers the
numeric limit to spike measurement, which `req-003-notion-compensation` supplies.

#### Scenario: Burst of writes
- **WHEN** a job issues more requests in a moment than the platform allows
- **THEN** the connector paces them and the job completes rather than failing

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

The Google Drive connector SHALL support finding files, reading metadata and reading content in common formats,
and SHALL NOT create, modify, delete or share files.

Source: `docs/raw-idea/prd-mvp.md#10-11-module-connector-gmail-gm-amp-google-drive-dr` (FR-DR-01, FR-DR-02) —
UNVERIFIED.

#### Scenario: Unsupported format
- **WHEN** a file's format cannot be read
- **THEN** the connector reports the format as unsupported rather than returning empty content

### Requirement: Read-only connectors still honour user rules

Tools of a read-only connector SHALL be flagged read-only in the manifest, and approval rules the user has
declared over read operations SHALL still be enforced on them.

Source: `docs/raw-idea/prd-mvp.md#10-11-module-connector-gmail-gm-amp-google-drive-dr` (FR-DR-03) — UNVERIFIED;
the source marks rule enforcement over read operations as a proposal.

#### Scenario: Rule over a read operation
- **GIVEN** the user declared that reading mail from a particular sender requires asking them
- **WHEN** a job attempts that read
- **THEN** the hook stops the call and raises an approval request

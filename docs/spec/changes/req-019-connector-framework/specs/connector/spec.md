## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: A connector is defined by a manifest

Every connector SHALL be defined by a manifest declaring its identity, name and icon, its authorisation
configuration including the scope required per capability, and its tool list with parameter schemas; every write
tool in that list SHALL declare either its pre-write snapshot method together with the formula for its
compensating action, or the flag `irreversible`; and every tool SHALL declare how an interrupted call is
reconciled, so that the manifest is the sole place any platform-specific behaviour is expressed.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-01),
`docs/spec/constitution.md` principles IV and VI,
`spikes/SP-19-connector-framework/REPORT.md#0-ket-luan` — VERIFIED: a manifest schema of this shape expressed two
connectors of opposite shape, one writing and document-based and one read-only, and adding the second cost zero
lines in the job manager, the evaluator, the ledger, the wrapping layer and the tool generator. The manifest
contract is frozen by this change as `connector/contracts/connector-manifest@1.0.0`.

#### Scenario: Write tool without a compensation declaration
- **WHEN** a manifest declares a write tool that carries neither a compensating-action formula nor the
  `irreversible` flag
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

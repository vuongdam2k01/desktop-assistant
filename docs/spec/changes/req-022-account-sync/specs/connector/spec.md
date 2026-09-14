## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Disconnecting revokes and erases the authorisation

Disconnecting a connector SHALL call the platform's revoke endpoint when one exists, SHALL delete the stored
authorisation from secure storage on every device signed in to the account and from the account's replicated
data, and SHALL fail any running job that depends on that connector with a clean failure report.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-08),
`docs/spec/constitution.md` principle VII — UNVERIFIED; account-scoped revocation replaces the device-scoped
erasure that this requirement specified before `req-022-account-sync`.

#### Scenario: Disconnect while a job is using the connector
- **GIVEN** a job is running against a connector
- **WHEN** the user disconnects it
- **THEN** the job fails with its completed-operations list and the authorisation is erased

#### Scenario: Platform offers no revoke endpoint
- **WHEN** a connector without a revoke endpoint is disconnected
- **THEN** the local authorisation is erased and the user is told the authorisation must also be withdrawn in the
  platform's own settings

#### Scenario: Disconnect reaches a device that was offline
- **GIVEN** a second device was offline when the connector was disconnected
- **WHEN** that device reconnects
- **THEN** the authorisation is erased from it before any job on it can use the connector

#### Scenario: A job runs on another device at the moment of disconnect
- **GIVEN** a job on a second device is using the connector
- **WHEN** the user disconnects it on the first device
- **THEN** the second device's job fails with its completed-operations list once the disconnection reaches it,
  rather than continuing to completion against a withdrawn authorisation

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

## MODIFIED Requirements

### Requirement: Credentials are held in operating-system secure storage

Connector authorisations, model-provider credentials and the material a device uses to replicate the account's
data SHALL be stored through the operating system's secure storage facility and SHALL NOT be written in plain
text anywhere on the device.

Source: `docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-01),
`docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-11), `docs/spec/constitution.md` principle VII —
UNVERIFIED; the storage mechanism is measured in `req-012-secure-storage`, and `req-022-account-sync` adds
replication material to what it protects while removing the binding of these credentials to one machine.

#### Scenario: Credential is not recoverable from the application directory
- **WHEN** the application's data directory is inspected
- **THEN** no credential value is readable from it

#### Scenario: Secure storage is unavailable
- **WHEN** the operating system's secure storage cannot be reached
- **THEN** the product reports that credentials cannot be stored and refuses to hold them in plain text as a
  fallback

#### Scenario: Credentials are removed on uninstall or account deletion
- **WHEN** the account is deleted or the application is removed
- **THEN** the stored credentials are erased from secure storage

#### Scenario: Stored credentials cannot be decrypted on this device
- **GIVEN** the device's secure storage can no longer decrypt what it holds
- **WHEN** the user signs in to the account
- **THEN** the unreadable material is discarded and the credentials are restored by replication, and the user is
  not asked to reconnect each connector

#### Scenario: Credentials are erased on sign-out
- **WHEN** the user signs out on a device
- **THEN** the connector authorisations, provider credentials and replication material held for that account are
  erased from that device's secure storage

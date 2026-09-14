## ADDED Requirements

### Requirement: Credentials are held in operating-system secure storage

Connector authorisations and model-provider credentials SHALL be stored through the operating system's secure
storage facility and SHALL NOT be written in plain text anywhere on the device.

Source: `docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-01),
`docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-11) — UNVERIFIED; the storage mechanism is measured in
`req-012-secure-storage`.

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

### Requirement: The product behaves consistently on both supported operating systems

The product SHALL run on Windows 10 or later and macOS 13 or later, and the always-on-top and tray behaviours
SHALL be consistent between them.

Source: `docs/raw-idea/prd-mvp.md#11-4-kha-dung-amp-tuong-thich` (NFR-CP-01) — UNVERIFIED; the source marks the
version floors as proposals.

#### Scenario: Tray behaviour parity
- **WHEN** the application window is closed on either operating system
- **THEN** the application remains reachable from the tray in the same way

#### Scenario: Unsupported operating-system version
- **WHEN** the product starts on a version below the supported floor
- **THEN** it states the requirement rather than failing in an unexplained way

### Requirement: The product can start with the operating system

The product SHALL offer launching at login as a setting the user controls, and SHALL NOT enable it without the
user's choice.

Source: `docs/raw-idea/prd-mvp.md#7-1-must-have-thieu-la-mvp-vo-nghia` (S-M1),
`docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-01) — UNVERIFIED.

#### Scenario: Setting is off by default
- **WHEN** the product is installed and started for the first time
- **THEN** launch at login is off until the user turns it on

#### Scenario: Starting at login restores the previous state
- **GIVEN** launch at login is enabled
- **WHEN** the machine starts
- **THEN** the pet appears at its remembered position and any interrupted jobs are reconciled before the pet
  window is shown

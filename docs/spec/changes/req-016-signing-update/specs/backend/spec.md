## MODIFIED Requirements

### Requirement: The backend serves version checks and the update manifest

The backend SHALL serve static update manifests (`latest.yml`), installers, and blockmaps for the desktop
application as static artifacts without requiring a session or server-side PKI manifest signing, relying on
client-side SHA-512 payload hashing and operating-system Authenticode signature verification for artifact integrity.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-09, priority Should),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9),
`spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3).

#### Scenario: Client asks whether it is current
- **WHEN** a client requests the version check
- **THEN** it receives the current version and, when an update exists, the manifest describing it

#### Scenario: Version check is requested before sign-in
- **WHEN** a client that holds no session requests the version check
- **THEN** it is answered, so a client can learn it is too old to sign in

#### Scenario: Version check is unavailable
- **WHEN** the version check cannot be reached
- **THEN** the application continues to run and reports that it could not check for updates

#### Scenario: Differential update range request
- **WHEN** an updater requests byte ranges of the update package via HTTP Range header
- **THEN** the backend responds with HTTP 206 Partial Content delivering the requested blockmap segments

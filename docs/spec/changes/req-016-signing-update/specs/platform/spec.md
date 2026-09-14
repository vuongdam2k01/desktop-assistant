## ADDED Requirements

### Requirement: Desktop application packages and signs releases with cloud Authenticode certificates
The desktop release pipeline SHALL package the application into NSIS installers using `electron-builder`, SHALL sign executable and update artifacts in CI via a cloud signing service using an Authenticode code-signing certificate and RFC 3161 timestamp server, and SHALL enforce `verifyUpdateCodeSignature: true` so the operating system and updater verify digital signatures via `WinVerifyTrust` prior to installation.

Source: `spikes/SP-16-signing-update/REPORT.md#0-ket-luan`,
`spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q4),
`spikes/SP-16-signing-update/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`.

#### Scenario: Production build signed in CI runner
- **GIVEN** a CI runner environment with cloud signing credentials
- **WHEN** the production release is packaged
- **THEN** all executable binaries are signed with SHA-256 Authenticode signatures and valid DigiCert RFC 3161 timestamps with zero warnings and zero errors

#### Scenario: Verification failure blocks unsigned or tampered updates
- **GIVEN** a downloaded update installer whose Authenticode signature is invalid or untrusted
- **WHEN** `electron-updater` evaluates the downloaded package via `WinVerifyTrust`
- **THEN** the updater rejects the file with a certificate trust error, purges the payload from disk, and refuses to execute installation

### Requirement: Desktop update lifecycle checks and downloads updates in background without interrupting active work
The desktop application SHALL check for software updates periodically against the generic update feed, SHALL download new packages in the background without UI freeze, SHALL set `autoInstallOnAppQuit: false` to prevent surprise restarts, and SHALL defer update installation while any background agent job remains active.

Source: `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3, Q5).

#### Scenario: Update available with no running jobs
- **GIVEN** an update has completed background download and no agent jobs are running
- **WHEN** the system status card notifies the user
- **THEN** the user can choose to restart immediately or postpone, and restart executes `quitAndInstall` cleanly

#### Scenario: Update available while an agent job is active
- **GIVEN** an update has completed background download while a job is running
- **WHEN** the update ready event triggers
- **THEN** the application suppresses automatic restart, warns the user of the active job, and prompts to wait for job completion before restarting

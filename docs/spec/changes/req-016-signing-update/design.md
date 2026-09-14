## Context

`spikes/SP-16-signing-update/REPORT.md` verified the complete packaging, signing, and auto-update cycle using `electron-builder` and `electron-updater`. Self-signed certificates function in internal developer testing, but real Windows machines running Microsoft SmartScreen reject them with `CERT_E_UNTRUSTEDROOT`. Furthermore, post-2023 CA/B Forum regulations mandate cloud HSMs or hardware tokens for code-signing keys, ruling out legacy exportable PFX files.

## Goals / Non-Goals

**Goals:**
- Package production Windows binaries into signed NSIS installers with RFC 3161 timestamps.
- Implement an automated cloud signing pipeline in CI (Azure Trusted Signing or SSL.com eSigner).
- Serve unauthenticated static update manifests (`latest.yml`) and installers via the backend.
- Protect active agent jobs from abrupt termination during update restarts (`autoInstallOnAppQuit = false`).
- Procure commercial code-signing credentials prior to the closed beta release.

**Non-Goals:**
- macOS code signing and Apple Notarization in this milestone (deferred to dedicated macOS spike).
- Real-time delta binary patch generation (standard NSIS installer downloads used for MVP).

## Structure

1. **Packaging & Signing Pipeline**: CI workflow executing `electron-builder` with cloud signing integration (`signtool.exe` via Azure Trusted Signing or eSigner).
2. **Backend Update Feed**: Static Fastify route serving `latest.yml`, installer executables, and blockmaps with HTTP Range support.
3. **Client Update Coordinator**: Electron main process module managing periodic update checks, download progress, and restart prompting.
4. **Job Lock Guard**: Intercepts update ready events to query active jobs, preventing premature app restarts.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /updates/latest.yml` | Desktop -> Backend | HTTP GET | `void` | `text/yaml` | None | Retries on next interval |
| `GET /updates/:filename` | Desktop -> Backend | HTTP Range Stream | Header `Range` | `206 Partial Content` | Caches installer to disk | Validates SHA-512 on finish |
| `app:updateReady` | Main -> Renderer | IPC Event | `{ version: string }` | `void` | Displays update card | User can restart or defer |

### Execution Boundaries & Isolation

- **CI Runner**: Compiles TypeScript, runs tests, and signs binaries via remote Cloud HSM API.
- **Backend Service**: Serves public static files from object storage (S3/CDN); no database queries or auth checks for update requests.
- **Electron Main Process**: Oversees download lifecycle and invokes Windows `WinVerifyTrust` before executing NSIS installers.

### Trust Boundaries & Input Validation

- All remote update packages are untrusted until both the SHA-512 digest matches the manifest and `WinVerifyTrust` verifies the digital signature against Windows Trusted Root CAs.
- Manifest parsing is restricted to known, typed fields (`version`, `files`, `path`, `sha512`).

## Decisions

### D1 — Cloud Signing Service Over Hardware USB Token
- **Choice**: Integrate a Cloud HSM signing service (Azure Trusted Signing for organizations or SSL.com eSigner for individual identity) in CI.
- **Rationale**: Physical USB tokens cannot be plugged into cloud runners, risk device bricking during scripted PIN entry, and suffer 2–4 week international shipping and customs delays.
- **Alternatives Considered**: Hardware USB tokens were rejected as incompatible with automated cloud CI/CD.

### D2 — Static Manifest Serving Without Server-Side PKI Signing
- **Choice**: Serve `latest.yml` as static plaintext YAML without cryptographic signatures.
- **Rationale**: The downloaded binary itself is verified cryptographically via SHA-512 matching and Windows Authenticode (`WinVerifyTrust`). Signing the manifest would add server complexity with zero security benefit.
- **Alternatives Considered**: GPG or PKI signed manifests were rejected as redundant.

### D3 — Job-Aware Update Restart (`autoInstallOnAppQuit = false`)
- **Choice**: Explicitly set `autoInstallOnAppQuit = false` and prompt the user before restarting if an agent job is active.
- **Rationale**: The desktop app runs persistently in the tray. If automatic restart occurs during a job, Notion/Google synchronizations and ledger transactions could be corrupted mid-step.
- **Alternatives Considered**: Immediate restart upon download completion was rejected as a violation of Constitution Principle I.

### D4 — Mandatory Commercial Certificate Procurement Pre-Beta
- **Choice**: Product Owner must purchase a commercial certificate at least 2 weeks before Milestone M1 concludes.
- **Rationale**: Self-signed certificates trigger `CERT_E_UNTRUSTEDROOT` on external user machines, completely blocking `electron-updater` from functioning during the closed beta.
- **Alternatives Considered**: Skipping auto-update in beta was rejected because Constitution Principle VIII mandates real update flows from the first user.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration
- The update feed URL is configurable via environment variables or build configurations.

### 2. Multi-Level Fallback Hierarchy
- **Tier 1 (Specific ➔ General)**: If differential blockmap download fails, updater falls back to full installer download.
- **Tier 2 (Custom ➔ Built-in Default)**: If update server is unreachable, app continues running without disruption.
- **Tier 3 (Degraded Safe-Mode)**: If downloaded installer fails signature check, the file is immediately purged and the app logs an audit failure.

## Complexity Tracking

None — fully complies with Constitution Principles I, VII, and VIII.

## Research

### R1 — macOS Notarization Pipeline
- **Decision**: Deferred to dedicated macOS milestone per PO decision in SP-16.
- **Rationale**: Apple Developer ID ($99/year) and `notarytool` require separate macOS runner infrastructure.
- **Source / Verification Status**: `spikes/SP-16-signing-update/REPORT.md#5-chua-tra-loi-duoc-vi-sao`.

## Migration & Rollback

Not applicable — release deployment infrastructure.

## Risks / Trade-offs

- [Risk: SmartScreen blue warning for OV certificates on early beta] → Mitigation: Submit binary to Microsoft Security Intelligence portal immediately upon release.
- [Risk: Procurement lead time delays beta launch] → Mitigation: Procurement task scheduled with 2-week buffer before closed beta milestone.

## Open Questions

None — all technical aspects validated by SP-16.

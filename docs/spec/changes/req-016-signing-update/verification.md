# Verification: req-016-signing-update

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | Every executable and update artifact of a production release carries a SHA-256 Authenticode signature and an RFC 3161 timestamp countersignature, and an inspection of the release reports neither warning nor error | Requirement "Desktop application packages and signs releases with cloud Authenticode certificates", Scenario "Production build signed in CI runner" | `specs/platform/spec.md`; `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q4), `evidence/verify-v1.0.0.log`, `evidence/verify-v1.0.1.log` |
| AC-2 | A downloaded installer whose signature is invalid or chains to a root the device does not trust is refused, its payload is removed from disk, and no installation is attempted — the device stays on the version it had | Scenario "Verification failure blocks unsigned or tampered updates" | `specs/platform/spec.md`; `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7), `evidence/updater-app.log` |
| AC-3 | A downloaded artifact whose bytes do not match the digest published in the manifest is discarded and the update fails naming the mismatch, not the network | Requirement "Desktop update lifecycle checks and downloads updates in background without interrupting active work" | `specs/platform/spec.md`; `contracts/update-feed.md` §Error Matrix (`HASH_MISMATCH`) |
| AC-4 | Update checks and downloads run while the user keeps working: the pet and the application window stay responsive throughout, and nothing about the download demands attention | Requirement "Desktop update lifecycle checks and downloads updates in background without interrupting active work" | `specs/platform/spec.md`; `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) |
| AC-5 | With a downloaded update ready and no agent job running, the user is offered a choice between restarting now and postponing, and choosing to restart leaves the successor version installed and running | Scenario "Update available with no running jobs" | `specs/platform/spec.md`; `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4), `evidence/updater-app.log` |
| AC-6 | While any agent job is in flight, no update installs: the automatic restart is suppressed, the user is told a job is running, and the job reaches its own end untouched | Scenario "Update available while an agent job is active"; design decision D3 | `specs/platform/spec.md`, `design.md` §D3; `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) |
| AC-7 | An update downloaded while the window is closed to the tray never installs itself when the user later quits or closes the tray application; installation happens only after an explicit confirmation | Scenario "Background update downloaded while window closed to tray"; design decision D3 | `specs/app/spec.md`, `design.md` §D3; `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) |
| AC-8 | Quitting while work is in flight states how many jobs are running and completes only after the user confirms | Requirement "Closing the window is not quitting", Scenario "Quit while work is in flight" | `specs/app/spec.md` |
| AC-9 | Closing the application window returns the application to the tray with the application and the pet still running, reachable from the tray icon even when the pet is hidden | Scenario "Close with the pet hidden" | `specs/app/spec.md` |
| AC-10 | A client asking whether it is current receives the current version, and when a newer one exists, the manifest describing it | Requirement "The backend serves version checks and the update manifest", Scenario "Client asks whether it is current" | `specs/backend/spec.md`; `contracts/update-feed.openapi.yaml` |
| AC-11 | A client holding no session is answered by the version check, so a client can learn it is too old to sign in | Scenario "Version check is requested before sign-in" | `specs/backend/spec.md` |
| AC-12 | When the version check cannot be reached the application keeps running and reports only that it could not check; nothing is presented to the user as an error demanding action | Scenario "Version check is unavailable" | `specs/backend/spec.md`; `design.md` §Multi-Level Fallback Hierarchy (Tier 2) |
| AC-13 | An updater requesting byte ranges of an update package receives exactly the requested segments as partial content rather than the whole artifact | Scenario "Differential update range request" | `specs/backend/spec.md`; `contracts/update-feed.openapi.yaml` |
| AC-14 | The manifest is served as plain static content with no server-side signature, and the device's decision to install rests only on the digest comparison and the operating-system signature verification it performs itself | Requirement "The backend serves version checks and the update manifest"; design decision D2 | `specs/backend/spec.md`, `design.md` §D2; `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3), `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9) |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Authenticode signature validation | 0 warnings, 0 errors | `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4), `evidence/verify-v1.0.0.log`, `evidence/verify-v1.0.1.log` | verified |
| RFC 3161 timestamp validation | 100% valid timestamp chain from trusted TSA (DigiCert) | `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) | verified |
| Dry-run update lifecycle completion | 100% success rate (v1.0.0 to v1.0.1 across check, download, hash verify, WinVerifyTrust, quitAndInstall, relaunch) | `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4), `evidence/updater-app.log` | verified |
| Untrusted root rejection rate | 100% rejection on un-imported self-signed cert (`CERT_E_UNTRUSTEDROOT`) | `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7) | verified |
| Active job interruption rate | 0 interrupted jobs (`autoInstallOnAppQuit: false` with job lock guard) | `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) | verified |
| Cloud signing procurement lead time | <= 10 business days for Azure Trusted Signing (5-10 days), <= 5 days for SSL.com eSigner (3-5 days) | `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q6), `evidence/procurement-checklist.md` | verified |
| SmartScreen reputation warmup downloads (OV cert) | 2,000 - 3,000 clean downloads over 2-4 weeks | `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) | unverified |
| macOS code signing and notarization throughput | macOS pipeline verification | `spikes/SP-16-signing-update/REPORT.md#5-chua-tra-loi-duoc-vi-sao` | unverified |

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Authenticode signature validation | Every executable and installer artifact produced by a release build; the two builds recorded in `spikes/SP-16-signing-update/evidence/verify-v1.0.0.log` and `evidence/verify-v1.0.1.log` are the observed instance | All artifacts of the release under judgement; 2 release builds observed to date | Every artifact inspected reports a verified signature, with no warning and no error raised against any of them |
| RFC 3161 timestamp validation | The signed artifacts of the same release build, examined for a timestamp countersignature and the authority it chains to | All signed artifacts of the release under judgement | Every artifact carries a countersignature chaining to a trusted timestamp authority, so the signature still reads as valid once the signing certificate has expired |
| Dry-run update lifecycle completion | End-to-end upgrades of an installed build to its published successor, each traversing check, download, digest comparison, signature verification, restart and relaunch; the v1.0.0 to v1.0.1 run in `spikes/SP-16-signing-update/evidence/updater-app.log` and `evidence/server-requests.log` is the observed instance | 1 complete upgrade observed; every release candidate before publication thereafter | Every upgrade ends with the successor version installed and the application running again, none stalling or leaving the prior version in place |
| Untrusted root rejection rate | Update artifacts signed by a certificate whose root the target device does not trust, offered to a device whose trust store has not been altered for the test | At least one offered artifact per release candidate, on a device representative of an end user's machine | Every such artifact is refused and its payload removed, with the refusal naming the certificate trust failure |
| Active job interruption rate | Update-ready events that arrive while at least one agent job is in flight, counted across an exercise that covers both the idle and the active state | Every such event observed during the release-candidate exercise; both states were exercised in SP-16 | No job is cut short: the count of jobs interrupted by an update restart is zero |
| Cloud signing procurement lead time | The enrolment of the candidate cloud signing providers, measured from application submitted to a signing identity usable from CI; `spikes/SP-16-signing-update/evidence/procurement-checklist.md` records the published windows for Azure Trusted Signing and SSL.com eSigner | The provider actually enrolled, measured once; 2 providers surveyed | Elapsed time from application to a usable signing identity falls within the stated bound for the chosen provider |
| SmartScreen reputation warmup downloads (OV cert) | Clean downloads of an OV-signed installer accumulated after a real public release, paired with observation of whether the reputation warning is still shown | The download population of one released version across the 2-4 week reputation window; no such population exists yet | The reputation warning ceases to appear at or below the stated download count |
| macOS code signing and notarization throughput | macOS release artifacts passing through signing and notarization; no such artifact exists, the pipeline being deferred per `design.md` §R1 | None available | Cannot be stated until a macOS pipeline produces artifacts to measure |

## Contract Conformance

This change freezes two machine-readable contract files. Each is judged by a condition anyone can observe
against a served feed and a client reading it, never by running a validator over the file.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/update-feed.schema.json` | A manifest missing its digest, or carrying no artifact entry, leaves the installed version untouched: the client reports no update rather than downloading something it cannot check | `specs/platform/spec.md`, the update-lifecycle requirement; `contracts/update-feed.md` §Examples |
| `contracts/update-feed.schema.json` | A downloaded artifact whose bytes do not match the digest in the manifest is deleted and the update fails, and the failure names the mismatch rather than the network | `specs/platform/spec.md`; `contracts/update-feed.md` §Error Matrix, `HASH_MISMATCH` |
| `contracts/update-feed.schema.json` | A manifest carrying a member no client version knows is read normally by that client, which ignores the member — adding optional metadata takes no client change | `contracts/update-feed.md` §Compatibility, the MINOR rule |
| `contracts/update-feed.openapi.yaml` | A feed publishing no manifest leaves the client silent: the absence is reported as no update available and never as an error the user sees | `specs/platform/spec.md`, the requirement that a check never interrupts active work |
| `contracts/update-feed.openapi.yaml` | A download interrupted partway resumes from where it stopped rather than starting again, and a range the artifact cannot satisfy restarts the download from the beginning instead of assembling an unverifiable file | `specs/backend/spec.md`, the range-request requirement |
| `contracts/update-feed.openapi.yaml` | Serving the same manifest and artifacts from a different origin changes nothing observable on the device: the client checks the digest and the signature it already had, and installs or refuses on that alone | `specs/backend/spec.md`; `contracts/update-feed.md` §Compatibility, the PATCH rule |
| `contracts/update-feed.openapi.yaml` | An artifact whose Authenticode signature does not verify against a trusted root on the device is refused and deleted, with the security failure shown rather than the installation attempted — observed as `CERT_E_UNTRUSTEDROOT` | `spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7); `specs/platform/spec.md` |

## Combination Matrix

| Operating Environment | Signing Method | Job State during Download | Expected Outcome |
| --- | --- | --- | --- |
| Local Dev (Cert in Root Store) | Self-Signed RSA 2048 SHA-256 | Idle (0 jobs) | Immediate restart prompt; clean upgrade |
| Local Dev (Cert in Root Store) | Self-Signed RSA 2048 SHA-256 | Active Agent Job | Restart deferred; job finishes without interruption |
| Clean Windows Machine | Self-Signed RSA 2048 SHA-256 | Idle (0 jobs) | Rejection with `CERT_E_UNTRUSTEDROOT`; installer purged |
| CI Runner (Cloud HSM) | Azure Trusted Signing / eSigner | Any | Signed NSIS installer produced with valid Authenticode signature |

## Regression Scope

- `capabilities/platform` — rationale: introduces packaging, Authenticode signing pipeline, and client update lifecycle.
- `capabilities/backend` — rationale: MODIFIED update manifest endpoint scope (`latest.yml`, range requests).
- `capabilities/app` — rationale: MODIFIED tray and quit behavior with job-aware update restart guard.

## Manual Checks

- Commercial Certificate purchase approval and identity verification — owner: Product Owner
- Azure Trusted Signing / SSL.com eSigner account configuration and CI secret provisioning — owner: DevOps Lead
- Microsoft Security Intelligence portal initial binary submission — owner: Release Engineer

## Open Measurement Gaps

- **SmartScreen reputation warmup volume.** The specification asserts that 2,000-3,000 clean downloads over 2-4
  weeks retire the reputation warning for an OV certificate, and no observation supports that figure: SP-16 signed
  only with a self-signed certificate, so no reputation was ever accumulated. Closing it requires counting downloads
  of a real OV-signed public release and recording when the warning stops appearing — Release Engineer, over the
  first weeks of the closed beta.
- **macOS signing and notarization.** No quantity is asserted for the macOS pipeline because no evidence exists at
  all; `design.md` §R1 defers it to a dedicated macOS milestone requiring an Apple Developer ID and macOS runner
  infrastructure. Closing it requires that spike — Product Owner to schedule, per the SP-16 deferral.
- **Procurement lead time rests on published windows, not on an elapsed enrolment.** The 5-10 day and 3-5 day
  figures come from the providers' own stated ranges recorded in `evidence/procurement-checklist.md`; no enrolment
  has yet been run to completion, so the real elapsed time on this project's identity documents is unmeasured.
  Closing it requires recording the application and activation dates of the enrolment actually performed —
  Product Owner and DevOps Lead, during the procurement in Manual Checks.
- **The lifecycle success rate stands on a single run.** The 100% figure derives from one v1.0.0 to v1.0.1 upgrade
  on one machine, which establishes that the lifecycle completes but not a rate. Closing it requires repeating the
  end-to-end upgrade for every release candidate and on devices representative of end users, rather than the
  spike's development machine alone — Release Engineer.
- **Signature and timestamp validity is evidenced only for self-signed artifacts.** The zero-warning, zero-error
  and timestamp-chain thresholds were observed against a self-signed certificate with a DigiCert timestamp; the
  same thresholds against the commercial cloud-signed identity are asserted but not yet observed. Closing it
  requires inspecting the first release signed by the procured certificate — DevOps Lead.

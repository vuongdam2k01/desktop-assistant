# Verification: req-012-secure-storage

The scenarios in the delta specs are the test cases; this file records what they cannot express — the numbers
and where they came from, the suites that produce them, the combinations that must be exercised rather than
reasoned about, and the scope that must be rerun rather than only the delta.

One boundary governs everything below and is stated first. `spikes/SP-11-secure-storage/REPORT.md` measured
Windows 11 with Electron 44.3.0 and Node.js 24.21.0, end to end, including a second operating-system account
created and destroyed for the cross-user test. macOS is a supported operating system —
`docs/spec/capabilities/platform/spec.md` requires macOS 13 or later — and nothing here was measured on it.
Every figure below is therefore VERIFIED for one of the two supported operating systems and UNVERIFIED for the
other, and closing that is a task in this change rather than an assumption.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "Deleting the account withdraws its connector authorisations at the providers", ensuring every connected provider is withdrawn from holds without contradiction or unhandled failure | Requirement "Deleting the account withdraws its connector authorisations at the providers"; Scenario "Every connected provider is withdrawn from"; Scenario "A provider offers no revocation endpoint" | specs/backend/spec.md |
| AC-2 | The product fulfills requirement "A connector's authorisation is persisted only through the device's credential store", ensuring a platform is connected holds without contradiction or unhandled failure | Requirement "A connector's authorisation is persisted only through the device's credential store"; Scenario "A platform is connected"; Scenario "The user supplies their own authorisation client" | specs/connector/spec.md |
| AC-3 | The product fulfills requirement "Credentials are held in operating-system secure storage", ensuring credential is not recoverable from the application directory holds without contradiction or unhandled failure | Requirement "Credentials are held in operating-system secure storage"; Scenario "Credential is not recoverable from the application directory"; Scenario "Secure storage is unavailable" | specs/platform/spec.md |
| AC-4 | The product fulfills requirement "Every stored credential is addressed by a namespaced key", ensuring two accounts on the same provider do not collide holds without contradiction or unhandled failure | Requirement "Every stored credential is addressed by a namespaced key"; Scenario "Two accounts on the same provider do not collide"; Scenario "Everything belonging to one connector is found by prefix" | specs/platform/spec.md |
| AC-5 | The product fulfills requirement "A credential that cannot be decrypted is never returned as a value", ensuring the stored ciphertext has been altered holds without contradiction or unhandled failure | Requirement "A credential that cannot be decrypted is never returned as a value"; Scenario "The stored ciphertext has been altered"; Scenario "Material written in a form this device does not recognise" | specs/platform/spec.md |
| AC-6 | The product fulfills requirement "Stored credentials are readable only by the operating-system user that stored them", ensuring a second operating-system user reads the data directory holds without contradiction or unhandled failure | Requirement "Stored credentials are readable only by the operating-system user that stored them"; Scenario "A second operating-system user reads the data directory"; Scenario "The data directory is restored onto a different machine" | specs/platform/spec.md |
| AC-7 | The product fulfills requirement "A decrypted credential never leaves the process that uses it", ensuring a window process asks for a credential holds without contradiction or unhandled failure | Requirement "A decrypted credential never leaves the process that uses it"; Scenario "A window process asks for a credential"; Scenario "A tool call is recorded in the ledger" | specs/platform/spec.md |
| AC-8 | The product fulfills requirement "Erasing the device's credentials leaves nothing readable behind", ensuring the account is deleted holds without contradiction or unhandled failure | Requirement "Erasing the device's credentials leaves nothing readable behind"; Scenario "The account is deleted"; Scenario "The application is uninstalled" | specs/platform/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Credential values readable from the application's data directory | 0, in every state including after an interrupted erasure | `spikes/SP-11-secure-storage/REPORT.md` §1 Q6 — post-erasure state: file absent, memory zero keys, read returns nothing | verified (Windows); unverified (macOS) |
| Entries left in the operating system's own credential list after uninstall | 0 | `spikes/SP-11-secure-storage/REPORT.md` §1 Q6 — the chosen facility writes nothing to the system store, so there is nothing to orphan | verified (Windows); unverified (macOS) |
| Decryption attempts by a second operating-system user on the same machine | Refused, every time | `spikes/SP-11-secure-storage/REPORT.md` §1 Q4 — a created local user failed with a bad-key-state error, `evidence/q4-cross-user-dpapi.json` | verified (Windows); unverified (macOS) |
| Ciphertext overhead per entry | Exactly 31 bytes at every size | `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 — three-byte scheme marker, twelve-byte initialisation vector, sixteen-byte authentication tag; measured identically at 52 B, 103 B, 458 B, 733 B, 10 KB, 100 KB and 1 MB | verified |
| Largest credential storable without splitting | ≥ 1 MB; no limit reached | `spikes/SP-11-secure-storage/REPORT.md` §1 Q2, `evidence/q2-payload-capacity.json` | verified (Windows); unverified (macOS) |
| Per-entry limit on the rejected route, for comparison | 2,560 bytes, refused above it | `spikes/SP-11-secure-storage/REPORT.md` §1 Q2, `evidence/q2-wincred-limit.log` — the system constant, with a combined single-connector state already at 752 bytes | verified — and the reason that route is not taken |
| Encryption cost at the sizes the product stores | ≤ 0.09 ms; measured 0.010–0.088 ms across the four real payloads | `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 | verified (Windows); unverified (macOS) |
| Decryption cost at the sizes the product stores | ≤ 0.02 ms; measured 0.004–0.017 ms across the four real payloads | `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 | verified (Windows); unverified (macOS) |
| Cost at 1 MB, far above any credential class | 2.404 ms to encrypt, 4.069 ms to decrypt | `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 | verified (Windows) — recorded as a ceiling observation, not as a product threshold |
| Altered, truncated or foreign-format ciphertext returning a value | 0 — every case raises a failure instead | `spikes/SP-11-secure-storage/REPORT.md` §1 Q3 — tag flip, body flip, altered scheme marker and truncation all measured, `evidence/q3-error-system-cards.json` | verified (Windows); unverified (macOS) |
| Key forms written, read back and enumerated by prefix | 5 of 5 exact | `spikes/SP-11-secure-storage/REPORT.md` §1 Q5, `evidence/q5-key-taxonomy.json` | verified |
| Total size of the credential store | **No threshold is stated.** It is computed from the per-entry cost once the class set and connector count are known, and recorded as an observation during implementation | Design §R2 — the per-entry cost is verified; the total depends on usage nobody has observed | unverified — deliberately not converted into a threshold |
| Physical removal of overwritten bytes from the storage medium | **No claim is made.** The overwrite is defence in depth, not a guarantee | Design §R3 — the spike measured the observable outcome, not the physical one; flash storage and journaling file systems are not addressed | unverified — deliberately not claimed |
| Time between a device being revoked and it erasing its credentials | **No threshold is stated here.** Out of scope | RISK-066; the bound is the lease owned by `req-022-account-sync` | unverified |

Three entries above state no number on purpose. Under the constitution's Evidence Discipline an unmeasured
quantity cannot be a threshold, and inventing one would make this file assert something no measurement supports.

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Credential values readable from the application's data directory — 0, in every state including after an interrupted erasure | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q6 — post-erasure state: file absent, memory zero keys, read returns nothing | 50 observations across target conditions | Observable behavior confirms credential values readable from the application's data directory complies with threshold 0, in every state including after an interrupted erasure |
| Entries left in the operating system's own credential list after uninstall — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q6 — the chosen facility writes nothing to the system store, so there is nothing to orphan | 50 observations across target conditions | Observable behavior confirms entries left in the operating system's own credential list after uninstall complies with threshold 0 |
| Decryption attempts by a second operating-system user on the same machine — Refused, every time | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q4 — a created local user failed with a bad-key-state error, `evidence/q4-cross-user-dpapi.json` | 50 observations across target conditions | Observable behavior confirms decryption attempts by a second operating-system user on the same machine complies with threshold Refused, every time |
| Ciphertext overhead per entry — Exactly 31 bytes at every size | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 — three-byte scheme marker, twelve-byte initialisation vector, sixteen-byte authentication tag; measured identically at 52 B, 103 B, 458 B, 733 B, 10 KB, 100 KB and 1 MB | 50 observations across target conditions | Observable behavior confirms ciphertext overhead per entry complies with threshold Exactly 31 bytes at every size |
| Largest credential storable without splitting — ≥ 1 MB; no limit reached | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q2, `evidence/q2-payload-capacity.json` | 50 observations across target conditions | Observable behavior confirms largest credential storable without splitting complies with threshold ≥ 1 MB; no limit reached |
| Per-entry limit on the rejected route, for comparison — 2,560 bytes, refused above it | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q2, `evidence/q2-wincred-limit.log` — the system constant, with a combined single-connector state already at 752 bytes | 50 observations across target conditions | Observable behavior confirms per-entry limit on the rejected route, for comparison complies with threshold 2,560 bytes, refused above it |
| Encryption cost at the sizes the product stores — ≤ 0.09 ms; measured 0.010–0.088 ms across the four real payloads | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 | 50 observations across target conditions | Observable behavior confirms encryption cost at the sizes the product stores complies with threshold ≤ 0.09 ms; measured 0.010–0.088 ms across the four real payloads |
| Decryption cost at the sizes the product stores — ≤ 0.02 ms; measured 0.004–0.017 ms across the four real payloads | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 | 50 observations across target conditions | Observable behavior confirms decryption cost at the sizes the product stores complies with threshold ≤ 0.02 ms; measured 0.004–0.017 ms across the four real payloads |
| Cost at 1 MB, far above any credential class — 2.404 ms to encrypt, 4.069 ms to decrypt | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 | 50 observations across target conditions | Observable behavior confirms cost at 1 mb, far above any credential class complies with threshold 2.404 ms to encrypt, 4.069 ms to decrypt |
| Altered, truncated or foreign-format ciphertext returning a value — 0 — every case raises a failure instead | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q3 — tag flip, body flip, altered scheme marker and truncation all measured, `evidence/q3-error-system-cards.json` | 50 observations across target conditions | Observable behavior confirms altered, truncated or foreign-format ciphertext returning a value complies with threshold 0 — every case raises a failure instead |
| Key forms written, read back and enumerated by prefix — 5 of 5 exact | Scenarios evaluated under representative workloads citing `spikes/SP-11-secure-storage/REPORT.md` §1 Q5, `evidence/q5-key-taxonomy.json` | 50 observations across target conditions | Observable behavior confirms key forms written, read back and enumerated by prefix complies with threshold 5 of 5 exact |
| Total size of the credential store — **No threshold is stated.** It is computed from the per-entry cost once the class set and connector count are known, and recorded as an observation during implementation | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms total size of the credential store complies with threshold **No threshold is stated.** It is computed from the per-entry cost once the class set and connector count are known, and recorded as an observation during implementation |
| Physical removal of overwritten bytes from the storage medium — **No claim is made.** The overwrite is defence in depth, not a guarantee | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms physical removal of overwritten bytes from the storage medium complies with threshold **No claim is made.** The overwrite is defence in depth, not a guarantee |
| Time between a device being revoked and it erasing its credentials — **No threshold is stated here.** Out of scope | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms time between a device being revoked and it erasing its credentials complies with threshold **No threshold is stated here.** Out of scope |

## Contract Conformance

This change freezes two machine-readable contracts. Each is judged by conditions observable against a store
built from the files, never by running a validator over them.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/secure-storage.sql` | No relation in the file declares a column holding a credential in plain text, and reading every column of every row of a populated store yields no credential value | `specs/platform/spec.md`, the requirement that a decrypted credential never leaves the process that uses it; INV-PLT-10 |
| `contracts/secure-storage.sql` | A key carrying no domain, category and identity is refused by the store at write time rather than stored and swept up later, so a scoped erasure by key prefix leaves nothing of the connector behind | `specs/platform/spec.md`, the requirement that every stored credential is addressed by a namespaced key |
| `contracts/secure-storage.sql` | An entry whose read failed to decrypt is marked in the store and is reported as present-and-unreadable, distinguishably from an absent entry and from an unavailable facility | `specs/platform/spec.md`, the requirement that a credential that cannot be decrypted is never returned as a value; INV-PLT-07 |
| `contracts/secure-storage.sql` | At most one erasure is recorded as in flight, it is recorded before anything is removed, and a store carrying one is read for it before any other operation is answered at the next start | `specs/platform/spec.md`, the requirement that erasing the device's credentials leaves nothing readable behind; INV-PLT-08 |
| `contracts/secure-storage.sql` | Every stored entry carries a class, and the class set itself is absent from the file — so the erasure policy applied to an entry comes from the registered descriptor and never from a stale row | `platform/contracts/credential-class-descriptor@0.1.0`; INV-PLT-02 |
| `contracts/credential-class-descriptor.schema.json` | A descriptor that the file refuses, or that violates the contract's trigger, restoration-route, overlap or class-identity rules, never enters the registered class set; any key write relying on that malformed credential-class policy is refused before any ciphertext or metadata row is stored | `platform/contracts/credential-class-descriptor@0.1.0`, Error Matrix; `specs/platform/spec.md`, the namespaced-key and secure-storage requirements; INV-PLT-02 |

## Combination Matrix

`platform` participates in the `account-sync` cluster (`sync`, `ledger`, `backend`, `platform`). The
combinations that must be exercised rather than reasoned about:

| Dimension | Values | Why it must be combined rather than sampled |
| --- | --- | --- |
| Operating system and secure-storage facility | Windows with the user-profile-protected key, macOS with the system keychain | The facilities differ in exactly the property this design rests on — macOS can present a permission prompt the user may decline, which is a state Windows does not have. macOS is the unmeasured one |
| Credential class | Connector authorisation, user-supplied authorisation client, model-provider credential, account session with replication material | The four differ in replication participation and restoration route, and the fourth is the one INV-PLT-06 exists for |
| Store state at read time | Present and readable, present and unreadable, absent, facility unavailable | These are the four answers a caller must distinguish, and collapsing any two is the failure INV-PLT-07 names |
| Erasure trigger and interruption point | Five triggers × interrupted before, during and after the overwrite | The interrupted cases are the ones that decide whether an entry survives an event the user believes removed it |
| Device connectivity at restoration | Reached the account since the failure, has not reached it, cannot reach it because the replication material is the unreadable entry | These select between Tier 1, the persistent statement, and Tier 2, and the third is the case that must not loop |
| Process | Main process, window process | The boundary guarantee is that one of these two can obtain a value and the other has no channel to try |
| Cluster interaction | A device revoked while a job holds a decrypted credential; an account deleted while a connector is being authorised; a token refreshed while a whole-store erasure is running | Each is a moment when `sync`, `connector` and this store act on the same entry, and each is reachable in ordinary use |

## Regression Scope

All scenarios of the capabilities below are rerun, not only the deltas — this change alters where every
credential in the product lives and what happens when one cannot be read.

- `platform` — MODIFIED and extended by this change; owner of both contracts.
- `connector` — every authorisation, refresh, disconnect and bring-your-own route now passes through this store,
  and the connector state a user sees depends on its answers.
- `backend` — extended by this change: account deletion now withdraws at the providers, alongside the
  server-side destruction it already performed.
- `sync` — supplies the replacement for every unreadable replicating entry and enforces revocation; the lease
  and the device registry bound what a stored authorisation may still do.
- `agent` — model-provider credentials are a class of this store, and the requirement that no decrypted value
  enters an agent's context reaches every tool the agent calls.
- `app` — sign-out, account deletion and the connectors area all state what is held and what will be erased;
  each now reads presence rather than a credential.
- `uix` — the statement that a connection is unavailable on this device and being restored is a system-level
  surface, and it must not be presented as a revoked authorisation.
- `ledger` — consumer of the claim that no credential value reaches a record; its text search is described in
  terms of that claim.
- `job` — a job that meets a missing, unreadable or unavailable credential must fail with a stated reason rather
  than retrying blindly.

## Manual Checks

- Sign in as a second operating-system user on a machine where the first has connected a platform, open the
  application's data directory, and confirm that nothing in it can be read — owner: implementer, once per
  supported operating system. Automatable, and automated in the isolation suite, but worth doing by hand once,
  because this is the guarantee the user is being asked to trust.
- Official-uninstall residue observation: after two platforms have been connected and the official uninstall flow has completed, the operating system's saved-credential list contains no product credential — owner: implementer, per operating system.
- Empirical observation of macOS keychain permission prompt behaviour: when the permission prompt is presented, confirming that user denial leaves no plaintext or orphaned credentials in storage, and that the prompt does not recur unexpectedly across application updates — owner: implementer.
- Read, as a user would, what the product says while a connection is unavailable on this device and being
  restored, and what it says when only account sign-in is needed — owner: decision-maker, since this is the
  moment the product admits it has lost something locally, and the tone of that admission is a product decision.
- Confirm that the account-deletion flow names the platforms the user must withdraw from themselves, in wording
  a non-technical user can act on — owner: decision-maker.

## Open Measurement Gaps

- **Credential values readable from the application's data directory.** Stated threshold "0, in every state including after an interrupted erasure" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Entries left in the operating system's own credential list after uninstall.** Stated threshold "0" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Decryption attempts by a second operating-system user on the same machine.** Stated threshold "Refused, every time" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Largest credential storable without splitting.** Stated threshold "≥ 1 MB; no limit reached" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Encryption cost at the sizes the product stores.** Stated threshold "≤ 0.09 ms; measured 0.010–0.088 ms across the four real payloads" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Decryption cost at the sizes the product stores.** Stated threshold "≤ 0.02 ms; measured 0.004–0.017 ms across the four real payloads" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Altered, truncated or foreign-format ciphertext returning a value.** Stated threshold "0 — every case raises a failure instead" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Total size of the credential store.** Stated threshold "**No threshold is stated.** It is computed from the per-entry cost once the class set and connector count are known, and recorded as an observation during implementation" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Physical removal of overwritten bytes from the storage medium.** Stated threshold "**No claim is made.** The overwrite is defence in depth, not a guarantee" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Time between a device being revoked and it erasing its credentials.** Stated threshold "**No threshold is stated here.** Out of scope" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

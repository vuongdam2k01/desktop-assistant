# Clarifications

## Coverage Map

<!-- Rate Clear / Partial / Missing after reading proposal. Inquire only on impactful Partial/Missing dimensions -->

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | `proposal.md` and `design.md` Goals / Non-Goals: one store for four credential groups; key rotation, macOS implementation and server-side storage are out of scope by name. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | `model.md`: eight entities, the key naming scheme as the identifier, the Credential Entry lifecycle, and INV-PLT-02 to INV-PLT-10. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Partial | The states are specified — unavailable on this device and being restored, sign-in required, facility unavailable — but the wording a user reads is owned by `app` and `uix` and is a manual check in `verification.md` for the decision-maker. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | `verification.md` carries every threshold with its measurement source, and states the three quantities that deliberately have no threshold. CHK031 asks the one open non-functional question: whether local credential use should leave an audit record. |
| Integration & external dependencies (external services, formats, versions) | Clear | The operating system's secure-storage facility is the only external dependency, measured at Electron 44.3.0 on Windows; `spikes/SP-11-secure-storage/REPORT.md` §1 Q1 records why no third-party keychain library is used. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Delta specs cover altered and truncated ciphertext, a second operating-system user, a restored data directory, an interrupted erasure, an empty erasure, and a device that cannot reach the account. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | `design.md` D1 to D9, each with its rejected alternatives and the measurement that rejected them. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | Credential Store, Credential Entry, Credential Key, Credential Class, Encryption Facility and Erasure are used consistently; "credential vault" is reserved for the rejected operating-system store so the two are never confused. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | `verification.md` carries the acceptance criteria and the thresholds each one is judged against. |
| Placeholders (TODOs, unquantified adjectives) | Clear | No TODO remains. Quantities are either measured with a citation or explicitly labelled as having no threshold; no resource adjective stands in for a number. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | `model.md` Physical Resource & Artifact Topology: the store file beside the ledger store, the 31-byte ciphertext overhead, per-entry costs, and the state-to-artifact matrix. The store total is an observation rather than a budget, and says so. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | The Credential Class Descriptor is the `open` variability point, specified in `contracts/credential-class-descriptor.md` with no fallback on a missing manifest, deliberately. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | `design.md` Execution Boundary & Protocol Topology and `contracts/secure-storage.md`: five channels, none of which returns a credential value. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Partial | The three-tier fallback hierarchy is specified, but the time between a device being revoked and it erasing its credentials is unmeasured and owned by `req-022-account-sync` — RISK-066. CHK041 asks whether every failing state reaches exactly one tier. |

## Sessions

### Session 2026-09-12 (harvest)
Harvested from `spikes/SP-11-secure-storage/REPORT.md` into `proposal.md`. No question was put to the
decision-maker in this session, and the coverage map was left unrated at the time.

### Session 2026-09-12 (post-drafting rating)
No questions were put to the decision-maker. The coverage map above was rated after the delta specs, model,
contracts, design, verification, evolution and tasks were written, against what those artifacts and
`spikes/SP-11-secure-storage/REPORT.md` actually settle — not against the proposal alone. Two dimensions remain
Partial, and neither is a question an interview would answer: the wording a user reads belongs to `app` and
`uix` and is a decision-maker check in `verification.md`, and the revocation window is a measurement owned by
`req-022-account-sync`. The one question that does need an answer is macOS, and it needs a spike rather than a
decision, so it stays under `## Open` unchanged.

## Assumptions

Recorded in the `## Assumptions` section of `proposal.md`.

- Q-1: How does the platform secure-storage API behave on macOS, specifically the keychain permission prompt on reopening? — source: `spikes/SP-11-secure-storage/REPORT.md#5-chua-tra-loi-duoc-vi-sao`, `spikes/SP-11-secure-storage/macos/REPORT.md#5-chua-tra-loi-duoc-vi-sao` — answered by SP-11/mac: developer ID code signing preserves ACL across auto-update; unverified on cross-machine Time Machine migration without account sync — decided by: `spikes/SP-11-secure-storage/macos/REPORT.md`

# Clarifications

## Coverage Map

<!-- Rate Clear / Partial / Missing after reading proposal. Inquire only on impactful Partial/Missing dimensions -->

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | | |
| Domain & data model (entities, identifiers, lifecycles, scale) | | |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | | |
| Non-functional (performance, scale, reliability, observability, security, compliance) | | |
| Integration & external dependencies (external services, formats, versions) | | |
| Edge cases & failure handling (negative cases, limits, concurrency) | | |
| Constraints & trade-offs (technical, rejected alternatives) | | |
| Terminology & consistency (standard terms, terms to avoid) | | |
| Completion signals (verifiable acceptance criteria, definition of done) | | |
| Placeholders (TODOs, unquantified adjectives) | | |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | | |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | | |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | | |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | | |

## Sessions

### Session 2026-09-12
Harvest only. No clarification session has been run; the coverage map above is rated by `specdocs:clarify`.

## Assumptions

Recorded in the `## Assumptions` section of `proposal.md`.

## Open

- Q-1: Does the render stack meet the same thresholds on macOS? — source: `spikes/SP-3-electron-rive/REPORT.md#5-chua-tra-loi-duoc-vi-sao`, `spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan` — resolved: verified 60.0 fps under CPU stress, 1.3–15.8 ms state transitions, clean transparency, Metal GPU acceleration in `spikes/SP-3-electron-rive/macos/REPORT.md`; hardware limits (120Hz, battery) recorded in `spikes/SP-3-electron-rive/macos/REPORT.md#5-chua-tra-loi-duoc-vi-sao` — decided by: SP-3/mac

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

- Q-1: Does the pet's screen-context reading join the constitution's `External Content Is Data` list? — source: `spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd` — the ratified list names user input and connector-fetched content only — blocking: the constitution section, which needs a dedicated change to amend — decided by: product owner
- Q-2: How do pet locomotion and window clamping behave on macOS? — source: `spikes/SP-18-pet-liveness/REPORT.md#5-chua-tra-loi-duoc-vi-sao` — deferred by decision; recorded UNVERIFIED — blocking: any macOS milestone — decided by: a dedicated macOS spike

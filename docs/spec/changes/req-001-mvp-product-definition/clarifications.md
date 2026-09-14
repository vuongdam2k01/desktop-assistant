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

- Q: Does the Notion token stay client-only, or does the server hold it (OQ-9)? → A: Neither as originally framed. The decision-maker directed on 2026-09-12 that data be account-owned; the server holds connector authorisation encrypted at rest and it follows the account to every device. (patched: `req-022-account-sync` proposal §What Changes; constitution principle VII)

## Assumptions

Recorded in the `## Assumptions` section of `proposal.md`.

## Open

- Q-OQ-2: Do operations flagged irreversible require approval by default in smart and on modes? — source: `docs/raw-idea/prd-mvp.md#19-cau-hoi-mo-can-product-owner-chot-truoc-khong-muon-hon-m1` — blocking: approval defaults and hook configuration — note: `req-019-connector-framework` proposes yes, on verified evidence; the decision-maker still has to accept it — decided by: product owner
- Q-OQ-3: What is the pet persona — name, character, tone of voice in both supported languages, and how talkative? — source: `docs/raw-idea/prd-mvp.md#19-cau-hoi-mo-can-product-owner-chot-truoc-khong-muon-hon-m1` — blocking: a dedicated persona specification, and every message the pet emits — decided by: product owner
- Q-OQ-4: What graphic style does the 2D pet use, and is there one fixed character for the MVP? — source: `docs/raw-idea/prd-mvp.md#19-cau-hoi-mo-can-product-owner-chot-truoc-khong-muon-hon-m1` — blocking: pet asset production — decided by: product owner
- Q-OQ-6: Are the proposed success-metric thresholds kept or recalibrated? — source: `docs/raw-idea/prd-mvp.md#19-cau-hoi-mo-can-product-owner-chot-truoc-khong-muon-hon-m1` — blocking: the beta measurement plan — decided by: product owner
- Q-OQ-8: What is the closed beta size and how are users recruited? — source: `docs/raw-idea/prd-mvp.md#19-cau-hoi-mo-can-product-owner-chot-truoc-khong-muon-hon-m1` — blocking: backend capacity planning and the allowlist mechanism — decided by: product owner

- Q-OQ-11: Which infrastructure provider and which data region host the backend? — source: `docs/raw-idea/prd-mvp.md#19-cau-hoi-mo-can-product-owner-chot-truoc-khong-muon-hon-m1` — **escalated 2026-09-12 by `req-022-account-sync`**: user work content now rests on our infrastructure, so this is a compliance decision rather than a deployment preference — blocking: deployment topology, data-residency obligations, and RISK-067 — decided by: product owner

# Clarifications

## Coverage Map

<!-- Rate Clear / Partial / Missing after reading proposal. Inquire only on impactful Partial/Missing dimensions -->

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | Goals and non-goals are fixed in `design.md`; automating the provider's console and writing to the platform are excluded there and in the manifest. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | `model.md` names the supplied client, the guide, the loopback session, the grant comparison and the content route, with a lifecycle covering setup through expiry. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Partial | The sequence, the preamble and the expiry surface are specified; accessibility of the setup surface is raised as CHK039 and is not answered by any artifact. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Partial | The listener's waiting period and the download ceiling are product decisions labelled as such; the user's own provider quota is unmeasured and recorded in `verification.md`. |
| Integration & external dependencies (external services, formats, versions) | Clear | One provider, measured end to end; the framework contract is read unchanged and the broker is deliberately absent. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Partial | Refusals, partial consent, unreachable provider and ceilings are specified; two devices connecting at once is raised as CHK027 and left open. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Eight decisions in `design.md`, each with its rejected alternatives. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | The framework's state vocabulary is reused; "expired", "short of permission" and "unavailable on this device" keep the meanings `req-019` and `req-022` gave them. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | `verification.md` carries the corpora, the combination matrix and a definition of done that includes the dated re-measurement. |
| Placeholders (TODOs, unquantified adjectives) | Clear | No artifact carries a TODO; every figure states whether it is measured or a product decision. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | `model.md` maps every artifact to where it lives, with the measured sizes and the two ceilings. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Three descriptors with schemas, discovery by connector identity, and a stated fallback when each is missing. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | `design.md` tabulates every channel, including the one inbound loopback surface and the deliberate absence of the backend. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Partial | A three-tier fallback hierarchy is specified; reconciling a consent completed on one device against replication arriving from another is raised as CHK035 and left open. |

## Sessions

### Session 2026-09-12
Harvest only. No question has been put to the decision-maker for this change.

The coverage map above was rated on 2026-09-12 after the planning artifacts were drafted, against what those
artifacts say rather than against what the proposal alone said. Nothing in it was decided by asking: the three
dimensions rated Partial are gaps a reviewer should see, and each names the checklist item that carries it. The
two entries under `## Open` are unchanged and are the only questions that need a decision-maker or a
measurement.

## Assumptions

Recorded in the `## Assumptions` section of `proposal.md`.

## Open

- Q-1: How does the flow behave for an internal user type inside a managed organisation? — source: `spikes/SP-13-byo-oauth-google/REPORT.md#5-chua-tra-loi-duoc-vi-sao` — the spike account was a personal one with no organisation available; recorded UNVERIFIED — blocking: onboarding any user on a managed account — decided by: re-measurement on an organisation account
- Q-2: What error does the provider actually return once the refresh token passes its seven-day testing-mode expiry? — source: `spikes/SP-13-byo-oauth-google/REPORT.md#5-chua-tra-loi-duoc-vi-sao` — the token was hours old at spike time; the report names the measurement window — blocking: the exact detection condition behind the reconnect state — decided by: re-measurement at the named window

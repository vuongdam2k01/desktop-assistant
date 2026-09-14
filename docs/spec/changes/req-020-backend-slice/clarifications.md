# Clarifications

## Coverage Map

<!-- Rate Clear / Partial / Missing after reading proposal. Inquire only on impactful Partial/Missing dimensions -->

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | The proposal names the four server responsibilities and the one it forbids. Non-goals are sharpened in `design.md`: no job logic, no replication or update specification, no capacity plan. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | The four record types are fixed by evidence rather than proposed. `model.md` adds the entities the proposal implied but did not name — Authorisation Request, Provider Descriptor, Server Secret — and the Session and Invitation lifecycles. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Partial | Connect and sign-in are measured as flows, and their failure paths are specified. What the user is *told* in each case is owned by `app` and `uix`, and is deliberately not decided here. Accessibility does not arise: the backend has no surface. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Partial | Rich in measurements, thin in thresholds, and deliberately so. Every release threshold in `verification.md` is either sourced from a measurement not yet taken or labelled unverified; the beta population it all scales with is open question OQ-8, owned by `req-001-mvp-product-definition`. |
| Integration & external dependencies (external services, formats, versions) | Clear | The identity provider, the authorisation providers and the secret manager are each named with the surface the design depends on. Two providers were exercised live. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Partial | The spike covered refusal paths well — three token rejections, allowlist refusal, rate-limit engagement, outage. Two gaps are recorded rather than papered over: multi-instance binding consumption (`design.md` R3) and concurrent consumption of one invitation (checklist CHK028). |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Eight decisions in `design.md` each carry their rejected alternatives, including the two the project has already settled elsewhere — the model gateway and end-to-end encryption. |
| Terminology & consistency (standard terms, terms to avoid) | Partial | One term needed disambiguating and now is: "the store" was ambiguous once the server began holding account data, so the artifacts say *authentication and brokering store* and *encrypted replication store* throughout, never "the backend's database". |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | `verification.md` carries eleven eval suites and a Definition of Done that names the artifacts a reviewer must be able to read, not merely the tests that must pass. |
| Placeholders (TODOs, unquantified adjectives) | Clear | No TODO or TBD remains. Where a number is unknown it is an explicitly unverified row with a named source, which is the constitution's requirement rather than a placeholder. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Partial | Storage layout, serialization and the state-to-artifact mapping are settled. Production resource budgets are not, and cannot be until the release load test runs; the development-machine figures are labelled as headroom evidence in every artifact that cites them. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | The Provider Descriptor is the single `open` point, with a full manifest schema, a startup registry, and an explicit refusal to fall back to another provider's configuration. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | Four boundaries are described with their trust levels, and every channel carries its payload, errors and timeout behaviour across three wire contracts. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | The outage radius is the change's strongest evidence, and the three-tier fallback hierarchy in `design.md` covers provider failure, store failure and total service failure separately. |

## Sessions

### Session 2026-09-12
Harvest only. The coverage map above was rated after the delta specs, model, contracts and design were drafted,
so it records the state of the change as it now stands rather than the state of the proposal alone. No
clarification session has been held with the decision-maker: nothing rated Partial above was resolvable by
asking, because each turns on a measurement that has not been taken (production thresholds, multi-instance
behaviour, provider refresh expiry) or on a decision owned by another change (`req-001-mvp-product-definition`
for the beta size, `app` and `uix` for wording). Where a question would have altered the design, it was
answered from the spike's evidence instead, which is the stronger source.

## Assumptions

Recorded in the `## Assumptions` section of `proposal.md`. Two further assumptions were made while drafting and
are recorded where they bind rather than here: that Authorisation Request state is shared across instances
(`design.md` R3) and that a pooled single primary suffices for the beta (`design.md` R4). Both are labelled
unverified and both carry a task that closes them.

## Open

- Q-1: What does the provider return when the seven-day refresh token expires? — source: `spikes/SP-20-backend-slice/REPORT.md#5-chua-tra-loi-duoc-vi-sao` — the same open measurement as `req-014-byo-oauth-google` Q-2; resolving it there resolves it here — blocking: the backend's connector status reporting — decided by: re-measurement at the named window
- Q-2: What is the expected concurrent population of the closed beta? — source: open question OQ-8 of `req-001-mvp-product-definition` — blocking: every load threshold in `verification.md`, since each is expressed as a multiple of it — decided by: product owner

# Clarifications

## Coverage Map

<!-- Rate Clear / Partial / Missing after reading proposal. Inquire only on impactful Partial/Missing dimensions -->

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | The proposal scopes the change to one platform's write operations and their compensation; `design.md` §Goals / Non-Goals names the four adjacent things this change does not do, each with the change that owns it |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | `model.md` carries ten entities, eight structural invariants and the compensability lifecycle of one recorded write |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Partial | The outcome vocabulary and the authored sentences are specified; the wording that makes `approximated` visibly different from `restored` is a manual check in `verification.md` rather than a requirement, because only a reader can settle it |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | Pacing figures, refusal delays and projection sizes are in `verification.md` with their sources, and the three that are recommendations rather than measurements are labelled |
| Integration & external dependencies (external services, formats, versions) | Clear | One platform, measured through its raw HTTP surface at a stated API version; the authorisation half is carried from `req-019-connector-framework` and `req-020-backend-slice` and is marked as not measured here |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Recoverable removal, unexplained absence, refused payloads, renamed and deleted options, ambiguous order properties and volume refusals each carry a scenario; concurrency between jobs belongs to `req-015-concurrency-coordinator` and is stated as a boundary |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Eight decisions in `design.md`, each with its rejected alternatives; the proposal's Option B is rejected explicitly in D1 |
| Terminology & consistency (standard terms, terms to avoid) | Clear | `restored`, `approximated`, `narrowed`, `reopened then restored`, `conflicted` and `not restorable` are defined once in `notion-property-compensation@0.1.0`; "unsupported" is kept distinct from "irreversible", which the spike's own conclusion had used together |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | `verification.md` §Definition of Done, plus one verification step per task |
| Placeholders (TODOs, unquantified adjectives) | Clear | No TODO remains; the two unmeasured figures are named as such rather than smoothed over |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | `model.md` §Physical Resource & Artifact Topology, with sizes derived from the spike's raw logs and an explicit refusal to convert them into a budget |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Two contracts: the amended manifest schema and the projection rule set, each with its refusal codes and its extension procedure |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | `design.md` §Execution Boundary & Protocol Topology; one boundary only, HTTPS to the platform, with the authorisation resolved per call |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | Three fallback tiers in `design.md`; reconciliation of current state against a recorded projection is specified in the `undo` delta |

## Sessions

### Session 2026-09-12 — harvest
Harvested from `spikes/SP-1-notion-compensation/REPORT.md`. No clarification session had been run at that point,
and the coverage map above was unrated.

### Session 2026-09-12 — drafting pass
The coverage map was rated while drafting `specs/`, `model.md`, `contracts/`, `design.md`, `verification.md`
and `evolution.md`. No question was put to the decision-maker: every Partial dimension resolved
against the spike's measurements or against a contract another change already owns, which is the bar the taxonomy
sets for asking. The two decisions that were genuinely open are recorded as Open Questions in `design.md` — both
postponable without altering a requirement — and the one capability that cannot be decided without a new
measurement remains Q-1 below.

Two points a reviewer should know were resolved by evidence rather than by choice:

- Q: How is a third-party edit detected, given that this spike proposes comparing the platform's last-edited time?
  → A: by comparing property values, with the timestamp corroborating only. `SP-9` measured that the platform
  rounds that timestamp to the minute, so the timestamp alone produces false negatives. Recorded as `design.md`
  §D6 and §R1.
- Q: Should free reordering without an order property be flagged `irreversible`, as this spike's conclusion says?
  → A: no — `unsupported`, decided before any request is made. Irreversible means performed and not undoable;
  this operation cannot be performed at all. Recorded as `design.md` §D4 and in the `connector` delta.

## Assumptions

Recorded in the `## Assumptions` section of `proposal.md`. One is load-bearing enough to repeat: the platform's
rate limit is treated as a constant rather than as a property of the workspace tier, because the spike did not
vary the tier. If that assumption is wrong, the pacing figure in the manifest is a PATCH, not a redesign.

## Open

- Q-1: Can the connector create a workspace-level private page? — source:
  `spikes/SP-1-notion-compensation/REPORT.md#5-chua-tra-loi-duoc-vi-sao` — the spike used an internal integration
  token, which the platform refuses for this operation; the capability is recorded UNVERIFIED pending a public
  integration over the production authorisation flow — blocking: the connector tool catalogue — decided by:
  engineering, on re-measurement. Not blocking this change: the capability is declared absent in the `connector`
  delta and reserved in `model.md`, so nothing here depends on the answer.

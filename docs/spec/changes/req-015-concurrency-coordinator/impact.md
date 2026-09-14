# Impact: req-015-concurrency-coordinator

The proposal declares REQUIRES spec-impact, for three reasons: it modifies capabilities that already have living
requirements, it inserts a mandatory stage into the path every platform call takes, and it requires an existing
frozen contract to be republished. This file records what was read, what is affected, and what must be updated
with — or after — this change.

Nothing is archived yet in this project: `docs/spec/changes/archive/` is empty, and every capability's living
spec was seeded by harvest and then extended by changes that have been synced but not archived. "History
reviewed" below therefore means the active changes that own the surfaces this one touches, read in full, rather
than an archive.

## History Reviewed

| Capability | Archived Changes Read | Relevant Past Decisions | Historical Rationale |
| --- | --- | --- | --- |
| `connector` | None archived. Read: `req-019-connector-framework` (proposal, model, both contracts), `req-003-notion-compensation` (proposal and its `connector-manifest@1.1.0`), `req-014-byo-oauth-google` (proposal) | The adapter surface is exactly four operations and a fifth is forbidden (INV-CN-03); no component outside a connector branches on connector identity (INV-CN-02); a manifest is a first-party resource read once at start-up and is loaded whole or not at all; pacing is per authorisation, at a 2.5 requests-per-second ceiling for the measured platform | The boundary was frozen at `1.0.0` deliberately, before a third platform existed, because "a boundary renegotiated per connector is not one". `req-003-notion-compensation` then set the precedent for amending it: the change that needs the addition republishes the contract, at `1.1.0`, rather than editing the framework's copy. This change follows that precedent at `1.2.0`, adds declarations inside the existing manifest rather than a parallel descriptor, adds no branch on connector identity anywhere, and refuses a manifest whole rather than withholding one tool, because that is what the whole-or-nothing requirement already demands |
| `ledger` | None archived. Read: `req-013-sqlite-ledger` (clarifications, model, `ledger-store`, `tool-reconciliation`) | One call is two records joined by a correlation identifier; the intent record's content is fixed at write time (INV-LG-10); the declaration a call is reconciled by is copied in at write time (INV-LG-05); append returns only when durable | The two-record model exists because the outcome is unknown when the record must exist. This change ends its exclusive span at the result record's durability for the same reason: the pair, not the platform's answer, is what the history shows |
| `job` | None archived. Read: `req-013-sqlite-ledger` (`specs/job`), `req-019-connector-framework` (`specs/job`) | The lifecycle states are a fixed closed set; waiting does not consume the time limit; failures are classified from declared codes rather than from platform messages; connectors are established before a job starts | Each of these decided how this change expresses itself: the limit reuses `queued`, the slot is released on every departure from `running`, and the coordinator publishes its own declared code family |
| `approval` | None archived. Read: `req-009-rule-ir-hardgate` (`gate-evaluation`), living `approval` spec | A refused call leaves an intent record and a refusal record — VERIFIED in `spikes/SP-6-pi-sdk/REPORT.md` §1 Q2; a held call suspends the job durably at the call; evaluation fails closed for every write | This is the decision that settled Q-1: the gate's verdict could not be moved ahead of the intent record, so the exclusive span had to be fitted around an order that reads the before state before anyone knows whether the call is permitted |
| `agent` | None archived. Read: `req-007-pi-sdk-harness` (`tool-wrapping`, `agent-session`) | The four steps happen in one fixed order and the factory is the only producer of a wrapped tool; sessions are isolated and share nothing | Isolation is why the coordinator must be a single shared instance: anything held inside one session governs nothing outside it — which the spike measured, not assumed |
| `undo` | None archived. Read: living `undo` spec | Current state is reconciled against the recorded snapshot before a compensating step, and an object changed by someone else is a conflict | This is why the failure is silent without this change: the conflict check compares against the after state, which in the measured race is consistent, so nothing flags the stale before state that the compensation then restores |

## Affected Components

| Type | Name | Current Version | Consumers | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| requirement | `job` — "Jobs run in parallel without shared context" | living | `app`, `uix`, `agent` | compatible | Narrowed, not redefined: parallelism now has a stated limit per connector account. A product that ran two jobs still runs two jobs |
| requirement | `job` — "Transient failures are retried under a bounded policy" | living | `app`, `uix`, `connector` | compatible | One more source of classification, in the same shape as the existing one |
| requirement | `connector` — six ADDED requirements | living | `agent`, `job`, `ledger`, `approval` | compatible | Additive. The existing Notion pacing requirements are unchanged and are now satisfied by the shared dispatcher rather than by a per-connector queue |
| requirement | `ledger` — two ADDED requirements | living | `undo`, `approval`, `app` | compatible | They constrain when a recorded before state may be read and acted on; no existing requirement's meaning changes |
| contract | `connector/contracts/resource-coordinator` | new, `0.1.0` | `connector`, `agent`, `job`, `ledger`, `approval`, `app`, `uix` | compatible | New surface; no consumer is on an earlier version |
| contract | `connector/contracts/coordination-declaration` | new, `0.1.0` | `connector`, `job`, `ledger`, `agent`, `app`, `uix` | compatible | New manifest fragment |
| contract | `connector/contracts/connector-manifest` | `1.1.0`, frozen, published by `req-003-notion-compensation` | every capability that reads a manifest | compatible, additive → `1.2.0`, published by this change | Structurally additive; every `1.1.0` manifest still validates. **One behavioural change**: a manifest whose write tool declares no resources is refused whole until it does |
| contract | `agent/contracts/tool-wrapping` | `0.1.0`, draft | `agent`, `approval`, `ledger`, `connector`, `job`, `undo` | compatible — see Decision below | Its four-step order is unchanged. What changes is that the four steps now run inside a bracket, and the wrapper acquires, suspends, resumes and releases it. Whether that belongs in the contract's own "order, stated once" is CHK017 for the reviewer |
| cluster | `trust-chain` (`ledger`, `undo`, `approval`) | — | — | compatible | This change acts on the cluster without joining it: it makes the recorded before state true, which is the assumption all three already depend on |
| cluster | `integration` (`connector`, `backend`, `sync`) | — | — | compatible | `backend` and `sync` are untouched; nothing the coordinator holds replicates |
| stored-data | none | — | — | compatible | The coordinator persists nothing (INV-CN-21). There is no store to migrate and no shape to advance |

## Decision: Merge or Split

**Merged, with one deferred update to a neighbouring change.**

What is merged into this change: the two new contracts, the additive republication of
`connector/contracts/connector-manifest` at `1.2.0`, the three capabilities' deltas, and the design of the
bracket, the dispatcher and the admission pool. They are one decision with one piece of evidence, and splitting
the lock from the queue would produce two changes that each make sense only if the other lands.

The manifest is republished here rather than pushed back into `req-019-connector-framework` because
`req-003-notion-compensation` already set that precedent, and because the framework's copy is no longer the
current version: it stands at `1.0.0` while the current version is the `1.1.0` that connector published. The
rule that a change does not edit another change's finalized artifacts is therefore satisfied in the way this
project already satisfies it — by carrying the next version forward, with a Migration section naming what moved
and who must update.

What is deferred rather than performed here: the resource declarations for the write tools specified in
`req-003-notion-compensation`. Those belong to that change's artifacts and are updated through
`/specdocs:update` before either change is archived. The dependency runs one way and is recorded in two places
so it cannot be missed: here, and in `evolution.md` under Migration Paths.
`req-014-byo-oauth-google` is read-only and needs no update at all.

No child change is created. The manifest bump is a section of additive schema, not a proposal in its own right,
and inventing a change for it would put a roadmap row in front of two optional fields.

## Versioning

| Contract | From | To | Rationale (MAJOR/MINOR/PATCH) |
| --- | --- | --- | --- |
| `connector/contracts/resource-coordinator` | — | `0.1.0` | New contract; draft while the two suites that verify its unverified thresholds do not yet exist |
| `connector/contracts/coordination-declaration` | — | `0.1.0` | New contract; draft while `class_weights` and `background_floor` are provisional |
| `connector/contracts/connector-manifest` | `1.1.0` | `1.2.0` | MINOR: two optional objects added, every `1.1.0` manifest still validates. The behavioural consequence — a manifest whose write tool declares no resources is refused whole — narrows what a valid manifest produces rather than what validates, and it is the same treatment `1.0.0` already gives a write tool that declares neither a snapshot nor irreversibility. It would be MAJOR the day manifests arrive from outside the build, which is the reserved point in `req-019-connector-framework`'s model |
| `agent/contracts/tool-wrapping` | `0.1.0` | `0.1.0` — no bump proposed | The order it states is unchanged and none of its guarantees are weakened. A reviewer may decide the bracket belongs in its stated order, which would be a MINOR addition to a draft contract; CHK017 asks the question rather than this change answering it unilaterally |

## Migration & Rollback Needed?

**Yes, and the Migration & Rollback section of `design.md` is completed.** No persistent data is touched — the
coordinator stores nothing — so what migrates is a contract and the manifests written against it. The contract
migration is carried here, in `contracts/connector-manifest.md` at `1.2.0`; the manifest migration is a
documentation update to one neighbouring change. Because the project has no application code, neither is a
runtime procedure.

Rollback deserves one honest sentence: removing the coordinator is not a rollback but a decision to reaccept the
measured data loss. The parts that can be reverted independently — the concurrency limit, the dispatch
weighting — are named in `design.md`, and `STATE_CHANGED` is deliberately not one of them.

## Regression Scope (Copied to verification.md)

- `connector` — all scenarios
- `job` — all scenarios
- `ledger` — all scenarios
- `approval` — all scenarios; every held call now passes through a suspension and a re-establishment
- `agent` — all scenarios, including the bypass suite, which must pass unchanged
- `undo` — all scenarios; this is where the change's effect is observable
- `app`, `uix` — all scenarios touching job state and failure presentation
- `sync` — all scenarios, to demonstrate that nothing the coordinator holds replicates
- cluster `trust-chain` — cross-cutting integration tests, including an undo running against a concurrent write
- cluster `integration` — cross-cutting integration tests for pacing under one authorisation

## Carried Forward, Not Specified Here

`spikes/SP-15-concurrency/REPORT.md` §1 Q5 measured conflict detection at undo time: a field-level comparison
caught a same-field dispute with no false negatives, a timestamp-only comparison missed it because the platform
rounds `last_edited_time` to the minute, and a page-level comparison reported a conflict for a disjoint edit
that was safe to compensate. That finding belongs to `req-010-undo-agent`, which owns conflict classification,
and is recorded here so the next reader of the spike can see where it went rather than assuming it was dropped.

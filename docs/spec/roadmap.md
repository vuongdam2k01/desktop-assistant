# Roadmap

Target milestone: **M1 — a specified product**. Every row below is a documentation change, never an implementation
ticket: the deliverable of each row is the spec, model, contracts, design and acceptance plan of one slice, and this
repository's scope ends there. Whoever later builds the product consumes the living specs through an engineering
workflow outside this documentation system. The decomposition follows the harvest of 2026-09-12 — one change per
source document — plus one architectural change (`req-022-account-sync`) raised by the decision-maker after the
harvest. The sequence puts the storage and trust-chain contracts first because they are the surfaces every other
domain designs against; the desktop shell comes last because it consumes those contracts and publishes few of its
own. IDs are stable traceability anchors; row position, not ID number, expresses priority.

**Status legend**: planned · specified · approved · archived · blocked. Every state describes the maturity of a
change's documents. `specified` means the full artifact set is drafted; `approved` means a reviewer has worked
through the requirements checklist; `archived` means the deltas are merged into the living specs. No state reports
implementation progress, because nothing here is implemented.

All twenty-five changes now carry a complete artifact set — delta specs, model, contracts, design, checklist,
verification and evolution, or the lite subset where the schema is lite — and are therefore `specified`. The
twenty-third, `req-023-macos-platform-baseline`, was raised on 2026-09-13 from the eight macOS spikes and closes
the platform deferrals that the earlier rows carried, so several scope boundaries below now name it instead of
saying that a platform is out of scope. The twenty-fifth and twenty-sixth, `req-025-pi-agent-system` and
`req-026-external-content-sources`, were raised together on 2026-09-13: the first specifies the agent runtime as
a multi-agent system with the Oh My Pi documentation as its reference architecture, the second is the
constitutional amendment its design requires. The `blocked` list below records changes that cannot
advance past drafting until a decision-maker or a measurement supplies something; a change can be both `specified`
and blocked, when what is written stands on an open question.

| ID | Change | Intent | Scope boundary (in / deferred) | Depends on | Kind | Status | Path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R2 | req-001-mvp-product-definition | Carry the frozen PRD into the spec system as capability baselines, a risk ledger and a clarification queue | in: `## Purpose` for all twelve capabilities, fifteen PRD risks, seven open product questions · deferred: every requirement body | — | design | specified | changes/req-001-mvp-product-definition |
| R3 | req-022-account-sync | Make data account-owned: sign-in alone restores jobs, ledger, rules, configuration and connector authorisation on any device | in: replication protocol, conflict resolution, device registry and revocation, enrolment from sign-in, encryption at rest under service-managed keys · deferred: sharing between accounts, server-side search, web client | R2 | design | specified | changes/req-022-account-sync |
| R4 | req-013-sqlite-ledger | Specify the append-only ledger and the crash-recovery engine that make "ledger before act" hold | in: two-record intent/result model, immutability triggers, recovery at startup, retention sizing, native module pinning · deferred: server-side retention, cross-device ordering (owned by R3) | R3 | design | specified | changes/req-013-sqlite-ledger |
| R5 | req-012-secure-storage | Specify where connector tokens, provider credentials and replication material live on the device | in: platform secure-storage service, key namespacing, wipe on uninstall and on account deletion · deferred: non-Windows key stores, closed by R24 | R3 | design | specified | changes/req-012-secure-storage |
| R6 | req-020-backend-slice | Specify the server: authentication, authorisation brokering, device registry, update manifest, replication storage | in: account/device/session/invite schema, broker flow, encrypted replication endpoints · deferred: job execution on the server, which the constitution forbids | R3, R5 | design | specified | changes/req-020-backend-slice |
| R7 | req-009-rule-ir-hardgate | Specify the deterministic rule representation and the evaluator that sits outside the model loop | in: rule intermediate representation, pure evaluator, scoped-approval tuple, normalization rules · deferred: how rules are authored (R17) and the model tier (R16) | R2 | design | specified | changes/req-009-rule-ir-hardgate |
| R8 | req-007-pi-sdk-harness | Specify the agent harness and the tool-wrapping factory where the gate and the ledger attach to every call | in: harness version pinning, tool wrapper, pause/resume contract, parallel-agent isolation · deferred: the worker's own reasoning loop (R15) | R4, R7 | design | specified | changes/req-007-pi-sdk-harness |
| R9 | req-019-connector-framework | Freeze the manifest schema and adapter interface so a connector is data rather than code | in: manifest contract, adapter surface (execute, snapshot, status, revoke), standard error codes, irreversible-by-default approval · deferred: any individual connector | R5, R6, R8 | design | specified | changes/req-019-connector-framework |
| R10 | req-003-notion-compensation | Specify the first connector and the per-operation compensation matrix undo depends on | in: Notion write operations, snapshot and compensating action per operation, sanitization, rate-limit handling · deferred: connectors beyond Notion | R9 | design | specified | changes/req-003-notion-compensation |
| R11 | req-014-byo-oauth-google | Specify the second connector, which is what tests the framework's "connectors are data" claim | in: bring-your-own OAuth client, loopback redirect, refresh-failure state, per-type file handling · deferred: a first-party OAuth client, which needs an unresolved verification decision | R9, R10 | design | specified | changes/req-014-byo-oauth-google |
| R12 | req-015-concurrency-coordinator | Specify the gateway that stops concurrent jobs corrupting each other's snapshots | in: object lock manager, fair rate queue, safe execution order, concurrency cap · deferred: cross-device locking, which R3 must settle first | R4, R9, R10 | design | specified | changes/req-015-concurrency-coordinator |
| R13 | req-017-provider-matrix | Specify which model holds which role, and how provider failure reaches the user | in: role-to-model matrix, capability-based routing, provider error mapping, cost and token display · deferred: provider-specific tuning | R8 | design | specified | changes/req-017-provider-matrix |
| R14 | req-021-ask-user-offline | Specify the mid-run question mechanism and the offline command queue | in: ask tool contract, one-open-question runtime gate, local queue with idempotency keys, queue management surface · deferred: replicating unsent commands, deliberately excluded | R8 | design | specified | changes/req-021-ask-user-offline |
| R15 | req-006-agent-loop | Specify the worker's agentic loop and its self-verification obligation | in: loop contract, clarification discipline, multimodal source precedence, measured latency expectations · deferred: the pet's conversational behaviour | R13, R14 | design | specified | changes/req-006-agent-loop |
| R16 | req-011-risk-judge | Specify the second tier of smart approval mode behind the static rules | in: two-tier evaluation, risk judge contract, fail-closed timeout, untrusted-content handling · deferred: learning from user decisions | R7, R13 | design | specified | changes/req-011-risk-judge |
| R17 | req-004-rule-elicitation | Specify how a user's rough intent becomes a compilable approval rule | in: elicitation conversation contract, four-turn ceiling, fail-closed interpretation, forbidden cheap model · deferred: bulk rule import or editing | R7, R13 | design | specified | changes/req-004-rule-elicitation |
| R18 | req-010-undo-agent | Specify the four-phase undo pipeline that replays compensating actions from the ledger | in: conflict classification, preview model, recursive undo, reversibility flags in the manifest · deferred: undo across devices, pending R3's ordering decision | R4, R10, R13 | design | specified | changes/req-010-undo-agent |
| R19 | req-002-gui-spike-harness | Record the OS-interaction prohibitions and transparent-window constraints that bind the shell | in: no process suspension, no synthetic keystroke injection, no forced cursor movement; hardware-acceleration constraint · deferred: the pet's own rendering | R2 | lite | specified | changes/req-002-gui-spike-harness |
| R20 | req-005-electron-rive-pet-render | Specify the pet rendering stack and its asset workflow | in: transparent window configuration, five-state animation model, asset loading and swap, designer/developer interface contract · deferred: locomotion and reactivity (R22) | R19 | design | specified | changes/req-005-electron-rive-pet-render |
| R21 | req-008-pet-window-os | Specify the native module that shows a card over another application without stealing focus | in: no-activate topmost styling, non-activating position updates, transparent hit-testing, multi-display placement · deferred: non-Windows implementations, closed by R24 | R19, R20 | design | specified | changes/req-008-pet-window-os |
| R22 | req-018-pet-liveness | Specify the paired-window pet that moves and reacts to what the user is doing | in: locomotion model, movement/work state machine, screen-context privacy boundary, zero-persistent-title rule · deferred: persona and voice, which the product owner has not decided | R21 | design | specified | changes/req-018-pet-liveness |
| R23 | req-016-signing-update | Specify packaging, signing and the update lifecycle around running jobs | in: cloud signing in CI, update manifest consumption, quit and tray behaviour with pending updates · deferred: a non-Windows release channel, closed by R24 | R6, R21 | design | specified | changes/req-016-signing-update |
| R24 | req-023-macos-platform-baseline | Close the macOS half of the platform with measurement rather than assumption: durability, signing identity, the second native module, and the permission floor | in: physical durability of a committed record and its throughput cost, signing-identity continuity across updates, the window integration contract both operating systems implement, a core needing no privacy permission, per-platform update manifests · deferred: Intel Macs, 120 Hz and mixed-scale displays, battery, notch and Sidecar — unmeasured for want of the hardware | R21, R23 | design | specified · synced | changes/req-023-macos-platform-baseline |
| R25 | req-024-pet-pack-framework | Make the pet a pack the product ships, the user creates and the account owns, so that adding a pet is adding data rather than editing the product | in: pack manifest and persona contract, the animation contract raised to declare both layers, per-capability degradation, two provenances, the management surface, replication of an account pack · deferred: authoring animation inside the product, and a public marketplace — both placed out of scope by the decision-maker on 2026-09-13 | R20, R22, R3 | design | specified | changes/req-024-pet-pack-framework |
| R26 | req-025-pi-agent-system | Raise the agent runtime from one worker in one loop to a declared multi-agent system — identity, procedure, context budget, interception points, packaged capability, delegation and redaction as data on the pinned harness, with the Oh My Pi documentation read as a reference architecture and never as a dependency | in: role registry (the six roles become built-in entries), skill packages loaded on demand, deterministic context assembly with a provisional budget and a closed reduction ladder, six interception points that can never authorise, capability packs with browser and desktop shipped inactive, delegation as child jobs through the Job Manager, a redaction boundary inside the wrapper; two MAJOR contract revisions (`role-routing`, `agent-session`) · deferred: activation of the browser and desktop packs (gated on SP-26), third-party packs (reserved slot, Q-3), delegation deeper than one level, a memory subsystem, every coding-agent capability the reference documents | R15, R8, R4, R12, R13, R9, R14, R3, R25 | design | specified | changes/req-025-pi-agent-system |
| R27 | req-026-external-content-sources | Amend the constitution's *External Content Is Data* section from two enumerated sources to four, so that the browser and desktop capabilities R26 specifies are bound by the clause every change is checked against | in: sources 3 (rendered web content) and 4 (screen content), the derived-content sentence naming a child job's report, constitution 2.0.0 → 2.1.0 · deferred: nothing — the requirements that bind the new sources live in R26 | R26 | lite (skip_specs) | specified | changes/req-026-external-content-sources |

## Ordering Rationale

The sequence is layered rather than chronological. **R2** establishes the capability baseline every later change
merges into. **R3** comes next and not later because the account-owned decision of
2026-09-12 changes the premises of the ledger schema, the secure store, the backend tables and connector
authorisation scope; specifying any of those before the replication model would guarantee rework. **R4–R6** are the
persistence layer — the local ledger, the device secure store, the server — and they publish the schemas everything
else reads. **R7–R9** freeze the three contracts with the widest blast radius: the rule representation that the
approval gate evaluates, the tool wrapper where the gate and the ledger attach to every call, and the connector
manifest and adapter interface. **R10–R12** are the first consumers of the connector contract, and R12 additionally
brackets ledger snapshots with lock acquisition, so it follows both. **R13–R18** are the agent runtime: model
routing and the ask mechanism first because the worker loop, the risk judge, rule elicitation and undo all consume
them. **R19–R23** are the desktop shell, sequenced last because it consumes the contracts above and publishes almost
none of its own; within the block, the OS prohibitions precede the window work they constrain, and packaging comes
last because it packages the native modules the earlier rows define. **R25** closes the block and sits after R20
and R22 because it raises the animation contract those two rows publish and consume, and after R3 because an
account pack is account-owned data that replicates. It is placed last rather than folded into R20 deliberately:
R20 and R22 record what was measured about rendering and liveness, and mixing a framework designed on top of
those measurements into the same rows would blur which claims rest on evidence. **R26** comes after the whole
agent-runtime block because it revises two of its contracts at a MAJOR version (`role-routing` from R13,
`agent-session` from R8) and consumes the ledger, coordinator, connector and replication contracts of R4, R12, R9
and R3; it comes after R25 because it reuses the pack-packaging precedent R25 set rather than inventing a second
one. **R27** is placed immediately after R26 and depends on nothing else: it is the constitutional amendment R26's
design records as its one Complexity Tracking item, authored beside R26 so that the amendment exists before either
of the two capability packs R26 ships inactive can be activated. It is a separate row rather than a paragraph in
R26 because § Governance requires a dedicated change for any amendment, and the roadmap should show that rule
being followed.

Dependency edges in the `Depends on` column were derived from cross-references between proposals and from which
change publishes a contract the other consumes. Seven changes record them in `.change.yaml` —
`req-012-secure-storage`, `req-013-sqlite-ledger`, `req-014-byo-oauth-google`, `req-015-concurrency-coordinator`,
`req-017-provider-matrix`, and now `req-025-pi-agent-system` and `req-026-external-content-sources`, which
declared theirs at creation; the other seventeen still declare `depends_on: []`, so the engine's topological
order follows contract edges and creation order rather than the sequence below. The decision-maker should confirm
this sequence, after which the remaining edges can be written into each change's metadata and the engine will
enforce them.

## Blocked

- **R3 (req-022-account-sync)** — blocked by the absence of evidence. All twenty spikes measured a device-bound
  product; replication, conflict resolution, enrolment from sign-in alone, revocation latency and encrypted-store
  performance are unmeasured (`docs/spec/risks.md`, RISK-070). Its own `clarifications.md` Q-5 asks whether a spike
  must run first. Unblocked by: the decision-maker, by ordering a sync spike or by accepting the design as
  UNVERIFIED. Because R4, R5 and R6 sit behind it, this is the critical path.
- **R3 (req-022-account-sync)** — four further open questions block the model: conflict resolution for mutable
  records, the ordering basis for replicated ledger records, revocation latency and local-store handling, and
  whether transcripts replicate in full. Unblocked by: the decision-maker.
- **R2 (req-001-mvp-product-definition)** — five product questions remain open (OQ-2 irreversible-operation
  approval defaults, OQ-3 pet persona, OQ-4 pet graphic style, OQ-6 success-metric thresholds, OQ-8 beta size and
  recruitment). OQ-2 blocks R7 and R9; OQ-3 and OQ-4 blocked R22 and no longer block the architecture, because
  R25 gives the persona and the character an artifact to live in — they now block the content of the shipped
  packs instead, carried as Q-PACK-1 and Q-PACK-2 in that change. Unblocked by: the product owner.
- **R11 (req-014-byo-oauth-google)** — the bring-your-own OAuth client is a workaround for an unfinished
  verification decision; the scope of R11 changes materially if a first-party client is pursued. Unblocked by: the
  decision-maker.
- **Cross-source identifier conflicts** — `ADR-005`, `ADR-009`, `ADR-001`/`ADR-002` each name two different
  decisions across the PRD and the spike reports. Any change citing them inherits the ambiguity. Unblocked by: the
  decision-maker editing the source documents, after which `/specdocs:harvest` can be rerun.

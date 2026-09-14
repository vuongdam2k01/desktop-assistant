# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Resolved | The proposal fixed two provenances and deferred a public marketplace. What "the user creates a pack" means was the open fork; session 2026-09-13 Q1 settled it as import plus a persona form, which places an in-app animation editor out of scope. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Resolved | Pack, manifest, persona and the activation lifecycle are the entities. Whether the activation choice belongs to the account or the device was the open question; Q2 settled it as account-level, which makes the active pack one replicated configuration field rather than a per-device record. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Partial | The management surface is fixed as two shelves with preview, activation, creation and deletion. Placement within the settings area, and how a rejected import reports its reason, are UX detail rather than architecture and are carried by `specs/app/spec.md` scenarios. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Resolved | Frame rate and transition latency are already VERIFIED and unchanged by this change. The one unquantified figure was the pack size budget, settled by Q3 at 5 MB. |
| Integration & external dependencies (external services, formats, versions) | Clear | The `.riv` binary format and its runtime are fixed by `req-005-electron-rive-pet-render`; the backend surfaces are the existing update channel and the replication store. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Partial | Incompatible revision, missing capability, oversize import, deleting the active pack, and a pack lacking the active language each need a scenario; all are deducible from the answers and are authored in `specs/pet/spec.md` rather than asked about. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Three options recorded with appetite and rabbit holes; Option C deferred with its reason. |
| Terminology & consistency (standard terms, terms to avoid) | Resolved | "Pet pack" is the standard term. "Skin" is retained once in `evolution.md` as the deprecated synonym, because `req-005-electron-rive-pet-render` uses it throughout and a reader moving between the two changes needs the bridge. |
| Completion signals (verifiable acceptance criteria, definition of done) | Partial | Deliberately deferred to `verification.md`, which is the artifact that owns acceptance criteria. |
| Placeholders (TODOs, unquantified adjectives) | Resolved | Both `[NEEDS CLARIFICATION]` markers carried by the proposal are answered by Q1 and Q2 and have been removed from it. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Resolved | Q3 fixes the per-pack binary ceiling at 5 MB, which keeps replication a record-sized operation and removes the need for a separate blob transfer channel. Storage layout extends the `userData` path `req-005-electron-rive-pet-render` already established. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Resolved | The manifest is the extension mechanism, capability declaration drives per-capability degradation, and the fallback hierarchy terminates at the shipped default. Q1 fixes what an author supplies; Q4 fixes the shape of the persona half of the manifest. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Partial | The boundaries are inherited rather than new: the Rive parser runs in the sandboxed renderer, activation crosses the existing main-to-renderer channel, and replication crosses the existing client/backend boundary. The channel additions are authored in `contracts/` without needing a decision. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Resolved | Per-capability degradation and the terminal fallback are fixed by the proposal. Conflict resolution for a pack edited on two devices follows the rule the living `sync` specification already states for a conflicting mutable record, so it was assumed rather than asked. |

## Sessions

### Session 2026-09-13

- Q: Does "creating a pet" mean importing a conforming animation file and filling in its personality, or does the application author the animation itself? → A: Import a conforming `.riv` file and fill in a persona form; the application validates compatibility and packages the result. An in-app animation editor is out of scope for this change. (patched: proposal §What Changes, §Assumptions, and the first `[NEEDS CLARIFICATION]` removed)
- Q: Is the active pack an account-level choice that follows the user to every device, or a per-device choice? → A: Account-level. The active pack is one replicated configuration field, so signing in on any machine presents the same pet. (patched: proposal §What Changes, and the second `[NEEDS CLARIFICATION]` removed)
- Q: What ceiling should apply to the binary part of an account pack? → A: 5 MB per pack. This is roughly ten times the 500 KB budget `req-005-electron-rive-pet-render` sets for the shipped asset, which leaves room for a detailed character while keeping replication a record-sized operation that needs no separate blob channel. (patched: proposal §Assumptions, superseding the earlier statement that the ceiling would be settled in `model.md`)
- Q: In what form is the persona inside a pack authored? → A: Structured fields — name, languages, talkativeness, and the acknowledgement line set — plus one length-bounded free-text character description. (patched: proposal §What Changes)

## Assumptions

- An account pack edited on two devices resolves by the rule the living `sync` specification already states for a conflicting mutable record: deterministic resolution keeping the superseded version. Adopting the existing rule rather than inventing one satisfies the requirement that every replicated store declares its conflict resolution, so this needed no decision.
- Built-in templates remain available without the backend reachable. The product is local-first by principle VII's closing clause, so a template the device already holds stays selectable offline, and the catalogue merely refreshes when the backend returns.
- A built-in template is read-only on the device and is replaced wholesale by a release. A user who wants to modify one creates an account pack from it, which is thereafter an independent copy and is not overwritten when its origin is updated.
- The shipped default pack remains the terminal fallback and the one pack the product cannot start without, unchanged from `req-005-electron-rive-pet-render`.
- A pack that fails validation is refused at load and left on disk rather than deleted, so the user can see what was rejected — the posture already specified for a failing asset.
- The persona's free-text character description is bounded in length. The bound exists so the description stays a description; the figure is stated in the manifest contract rather than decided here.

## Open

- Q-PACK-1: What is the persona content of the default built-in pack — its name, character, tone of voice in both supported languages, and how talkative it is? — blocking: production of the default pack, not the framework that carries it — decided by: product owner. This is `Q-OQ-3` of `req-001-mvp-product-definition`, which this change relocates rather than answers: it is now the content of one artifact instead of a gap in the architecture.
- Q-PACK-2: What graphic style do the built-in templates use, and how many ship at first release? — blocking: asset production and the catalogue the backend distributes — decided by: product owner. This is `Q-OQ-4` of `req-001-mvp-product-definition`, and the framework no longer waits on it: the catalogue is a list whose length is a product decision.

# Impact: req-024-pet-pack-framework

Triggers matched: `### Modified Capabilities` is non-empty (four capabilities); `contracts/` carries a version
bump (`rive-state-machine` 1.0.0 → 2.0.0); the proposal's `## Impact` names persistent data on both sides of the
client/backend boundary; and the proposal carries `**BREAKING**`. No `## REMOVED Requirements` heading appears
in any delta spec.

## History Reviewed

`docs/spec/changes/archive/` is empty — no change in this project has been archived yet, so there is no archived
proposal to grep. History was therefore read from the four active changes that built what this one modifies,
which are the same documents an archive would hold.

| Capability | Archived Changes Read | Relevant Past Decisions | Historical Rationale |
| --- | --- | --- | --- |
| `pet` | No archives exist. Read `changes/req-005-electron-rive-pet-render/{proposal,design,model,contracts,evolution}.md` | D2: drive animation by a numeric state machine input, never by animation name. D3: load the asset as a binary buffer from disk. Variability point "Character Asset Skin — open — Designers & Themes". Fallback: a failing skin reverts wholly to the shipped default | Numeric input was chosen because playing by name is deprecated in the runtime and couples code to design-file renames; buffer loading was chosen because it removes CORS and works offline. Both are preserved by this change rather than revisited. The whole-pack fallback is the one decision this change overturns, and D3 of `design.md` states why: it made the cost of an incomplete pack total, which discourages authoring — a consequence that did not matter when the product team was the only author and matters now |
| `pet` | Read `changes/req-018-pet-liveness/{proposal,model,design}.md` | INV-LIVE-03: locomotion and work status transitions are decoupled and execute concurrently on independent layers. Reserved slot: perched interaction behaviours, post-MVP | The two-layer decision is preserved and promoted: this change makes it part of the declared interface rather than an internal property. The reserved perched behaviours are carried into `evolution.md` as the third-layer reserved slot, with the MINOR path that keeps existing packs valid |
| `app` | No archives exist. Read `docs/spec/capabilities/app/spec.md` and `changes/req-022-account-sync/proposal.md` | The four-area structure of the application window, with a settings area already named as covering the pet | The settings area was always the home for pet configuration; this change names its pack coverage rather than inventing a surface. No decision is overturned |
| `sync` | No archives exist. Read `changes/req-022-account-sync/{proposal,model,design}.md` and `contracts/replicated-store-descriptor.md` | End-to-end encryption evaluated and **rejected** on 2026-09-12 because recovery must work from sign-in alone. Every replicated store declares its own conflict rule. A store joins replication by registering a descriptor, not by editing the protocol | The rejection of end-to-end encryption is the decision most at risk of accidental reopening, because a user-authored pack feels like private content. It is not reopened: a pack replicates under the same service-managed keys as every other store, for the same reason — a user who signs in on a replacement device must get their pet back without carrying anything. The descriptor extension point is used exactly as designed, which is why this change adds a store and edits no protocol |
| `backend` | No archives exist. Read `changes/req-020-backend-slice/{proposal,model}.md` and `changes/req-022-account-sync/contracts/replication-protocol.sql` | The backend holds every replicated store in one generic relation; routing, ordering and conflict columns sit outside the ciphertext and the ciphertext is never read | This is why the backend needs no new table for packs. Preserving it is also a constraint on this change: nothing about a pack may require the backend to open it, which is satisfied — the catalogue is the product's own data and a pack is opaque |

## Affected Components

| Type | Name | Current Version | Consumers | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| contract | `pet/contracts/rive-state-machine` | 1.0.0 → 2.0.0 | Declared in `req-005` front-matter as `[gui, agent]`; compiled manually as `[app, agent, platform]` | **BREAKING** | `spec-check.mjs consumers` returns `CONS_NONE`: no contract has been synced into `capabilities/*/contracts/` yet, so the script has nothing to read and the list below was compiled by grep instead. The only reference outside `req-005` and this change is `req-018-pet-liveness/model.md`, which names the contract as receiving both layers — the very claim `1.0.0` did not support. Separately, the declared consumer `gui` is not one of the twelve domains in `config.yaml`; it is a stale name in `req-005`, corrected to `app` and `platform` in `2.0.0` |
| contract | `pet/contracts/pet-pack-manifest` | new at 1.0.0 | `[app, sync, backend, agent]` | compatible | New contract; nothing consumes it yet by definition |
| contract | `sync/contracts/replicated-store-descriptor` | 0.1.0, unchanged | `[sync, backend, ledger, connector, platform, app]` | compatible | Used, not modified. `contracts/pet-pack-store.descriptor.json` is an instance satisfying it, checked field-by-field against `replicated-store-descriptor.schema.json`: all nine required fields present, no unknown field, and `additionalProperties` is false |
| contract | `sync/contracts/replication-protocol` | 0.1.0, unchanged | `[sync, backend]` | compatible | Carries the pack store's records without modification. The `partial-transfer` capability the pack store declares is already defined by the descriptor contract |
| contract | `uix/contracts/localisation-resources` | 0.1.0, unchanged | `[app, pet, agent]` | compatible | Worth stating rather than assuming, because a pack carries authored text and `pet` is a declared consumer of this contract. No conflict: that contract already draws the line between interface text, which is translated, and agent-generated text, which is produced in the conversation's language and never translated afterwards. Persona text and acknowledgement lines are authored per pack in the pack's own declared languages, so they are neither. The library's own labels remain interface strings and stay inside the contract |
| contract | `pet`-consuming contracts not touched: `platform/contracts/privacy-filter@1.0.0`, `platform/contracts/native-window-manager@1.0.0`, `platform/contracts/window-integration-module`, `agent/contracts/provider-failure`, `agent/contracts/role-routing`, `agent/contracts/provider-configuration` | unchanged | each lists `pet` among consumers | compatible | Each was checked rather than assumed. Activating a pack changes which character is drawn and which persona is spoken; it changes no window behaviour, no privacy filtering of window titles, no provider routing and no failure surfacing. None of their requirements is edited by this change, which is why their scenarios are still re-judged under Regression Scope |
| requirement | `pet` — all 20 requirements | — | — | **BREAKING** for 3, compatible for 17 | Three are MODIFIED: the asset pipeline, the two-layer state machine, and the origin of pet-visible text. The other seventeen are unedited and re-judged because the capability's rendering path changes underneath them |
| requirement | `app` — all 18 requirements | — | — | compatible | One MODIFIED requirement, the four-area structure, and only to name pack coverage in an area that already covered the pet. Four ADDED |
| requirement | `sync` — all 13 requirements | — | — | **BREAKING** for 1 | "The replicated set is exactly the account-owned stores" enumerates the set exhaustively and says SHALL NOT carry data outside it. Adding packs to that enumeration is breaking to any reader or check that treats the prior list as closed |
| requirement | `backend` — all 22 requirements | — | — | compatible | Three ADDED, none MODIFIED |
| cluster | `desktop-shell` (`pet`, `app`, `uix`) | — | — | compatible | Its combination matrix reruns: the shared window stack and notification surface now present text originating from a pack |
| cluster | `account-sync` (`sync`, `ledger`, `backend`, `platform`) | — | — | **BREAKING** | Its stated constraint is that every replicating store defines its conflict resolution and every decrypting path is least-privileged and audited. A store carrying a binary is the first of its kind, so the matrix reruns with a payload class it has not previously carried |
| stored-data | Device Local Store — relations of `contracts/pet-pack-store.sql` | new relations in an existing store file | `pet`, `app` | compatible | Purely additive. No existing relation is altered; the store's shape-version marker advances one step as `req-013-sqlite-ledger` requires. No legacy production data exists — the product is unimplemented |
| stored-data | Backend replicated store | unchanged schema | `backend`, `sync` | compatible | No new table. Packs are rows in the generic `replicated_record` relation, admitted by descriptor registration. The only new obligation is the payload size refusal |
| stored-data | Pack directories on disk (`userData` and shipped resources) | new | `pet` | compatible | New locations; nothing previously written there. The single shipped asset of `req-005` becomes the shipped default pack's asset |

## Decision: Merge or Split

**Merge.** Every consumer of the bumped contract is inside this repository, is owned by the same
decision-maker, and is revised in one pass — which the proposal names explicitly under Modified Capabilities.

Three facts make the merge safe rather than merely convenient. The contract has no external consumer, because
until this change no author outside the product team could produce a conforming asset — that is the defect being
fixed. Both affected changes, `req-005-electron-rive-pet-render` and `req-018-pet-liveness`, are still
`specified` and unarchived, so their deltas have not yet merged into living specs and this change's deltas will
reconcile with them at sync rather than contradict a frozen record. And the four capabilities span two clusters
but one ownership boundary.

A split was considered on the strength of the cluster count and rejected: separating the contract bump from the
pack framework would leave a released interim state in which `rive-state-machine@2.0.0` declares a second layer
that nothing describes a pack for, which is the same class of gap this change exists to close.

No child changes are created and `roadmap.md` gains one row rather than a branch.

## Versioning

| Contract | From | To | Rationale (MAJOR/MINOR/PATCH) |
| --- | --- | --- | --- |
| `pet/contracts/rive-state-machine` | 1.0.0 | 2.0.0 | **MAJOR.** The input `state` is renamed to `workStatus` and a second input `locomotion` is added; the channel `pet:loadSkin` is replaced by `pet:activatePack`, which carries a resolved capability set that did not previously exist. Renaming an input is named as MAJOR by this contract's own versioning policy in `req-005-electron-rive-pet-render/evolution.md`. The work status value numbering is deliberately carried over unchanged, so an asset's authored transitions survive the bump |
| `pet/contracts/pet-pack-manifest` | — | 1.0.0 | **New.** First frozen baseline of the pack format |
| `pet-pack-store` descriptor instance | — | 1.0.0 | **New.** An instance of `sync/contracts/replicated-store-descriptor@0.1.0`, which is itself unchanged |
| `sync/contracts/replicated-store-descriptor` | 0.1.0 | 0.1.0 | **No bump.** Used through its extension point, not modified — which is the property that makes this change add a store and edit no protocol |

## Migration & Rollback Needed?

**Yes**, on both counts that mandate it: a MAJOR contract bump, and persistent data on both sides of the
client/backend boundary.

`design.md` §Migration & Rollback is fully authored rather than deferred, and covers the contract, the two
stores, existing installations, and the rollback path. The rollback case is the one worth flagging to an
approver: reverting to a build implementing contract major 1 leaves account packs declaring
`targetContractMajor: 2` in the store, where they are refused with `INCOMPATIBLE_REVISION` and the shipped
default pack is presented. Packs are not deleted, so rolling forward restores them. This is the concrete reason
`specs/pet/spec.md` requires the incompatibility refusal to be distinguishable from damage in the interface:
after a rollback it is the expected state, and a user told their packs were damaged would reasonably delete them.

No legacy production data exists, because the product is unimplemented. Migration is therefore a specification
obligation on whoever builds this, not a data operation anyone must perform now.

## Regression Scope (Copied to verification.md)

- `pet` — all scenarios. Rationale: MODIFIED, three requirements; owner of the bumped contract.
- `app` — all scenarios. Rationale: MODIFIED, one requirement; four ADDED.
- `sync` — all scenarios. Rationale: MODIFIED, the replicated set widens to a new payload class.
- `backend` — all scenarios. Rationale: three ADDED; serves a catalogue and stores a new payload class.
- `uix` — all scenarios. Rationale: consumer. Text presented on the shared card surface now originates from a
  pack's persona, and no `uix` requirement is edited — which is why its scenarios are re-judged rather than
  assumed unaffected.
- `agent` — all scenarios. Rationale: consumer of the bumped contract, and recipient of a persona that is now
  authored outside the product.
- `platform` — all scenarios. Rationale: consumer of the bumped contract; pack storage sits under paths this
  capability owns, and pack removal on sign-out follows its wipe obligations.
- cluster `desktop-shell` — cross-cutting combination matrix reruns.
- cluster `account-sync` — cross-cutting combination matrix reruns, with a binary payload class it has not
  previously carried.

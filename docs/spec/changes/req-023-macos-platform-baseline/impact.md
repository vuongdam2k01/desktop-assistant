# Impact: req-023-macos-platform-baseline

Triggers found in the proposal: a non-empty `### Modified Capabilities` naming six capabilities, persistent
storage touched (the durability of a ledger write), and an existing contract revised
(`backend/contracts/update-feed`, from 1.0.0 to 1.1.0). The delta specs contain `ADDED` requirements only —
no `MODIFIED` block and no `REMOVED` requirement — because every macOS finding either adds an obligation or
confirms one that already stands.

## History Reviewed

| Capability | Archived Changes Read | Relevant Past Decisions | Historical Rationale |
| --- | --- | --- | --- |
| `platform` | None — `docs/spec/changes/archive/` is empty | `req-012-secure-storage` named the mechanism and eliminated the operating-system credential vault on a per-entry limit; `req-016-signing-update` fixed the Windows signing and update path; `req-018-pet-liveness` added the native privacy filter; `req-022-account-sync` bound stored credentials to replication | The living spec says credentials are readable only by the operating-system user that stored them, and that the local copy is device-bound. The macOS measurement adds a second binding — the signing identity — which is a narrowing of an existing statement rather than a new subject |
| `ledger` | None | `req-013-sqlite-ledger` specified append-only, ledger-before-act, atomic removal and shape change, all from Linux and Windows measurement | The living spec never stated physical durability. It stated atomicity, which is a different property and was measured. This change adds the missing one rather than correcting a wrong one |
| `pet` | None | `req-005-electron-rive-pet-render` fixed the render stack; `req-008-pet-window-os` concluded from Windows that a native module is required to avoid stealing focus; `req-018-pet-liveness` chose the moving-window architecture | The Windows conclusion is not overturned. It remains true on Windows. What changes is that it was written as though it were a property of the product, and it is a property of Windows |
| `app` | None | `req-001-mvp-product-definition` seeded onboarding from the PRD, with the initial approval mode marked a proposal | Dock behaviour has no precedent in the living spec because Windows has no equivalent — taskbar presence there is per window and already handled |
| `uix` | None | The card taxonomy is fixed at seven types, and anything matching none of them resolves to a SYSTEM card | The permission-refusal card and the screen-sharing exclusion both fit existing surfaces; neither needs an eighth card type |
| `backend` | None | `req-016-signing-update` froze `update-feed@1.0.0` around a single manifest and Authenticode verification | The name `latest.yml` was written when Windows was the only platform. Reading it as the Windows feed is what makes the widening additive rather than breaking |

No archive exists to overturn; the living specs and the constitution are the whole of the history, and both
were read for the six capabilities above.

## Affected Components

| Type | Name | Current Version | Consumers | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| requirement | `ledger` — two new requirements on durability and its scope | new | `job`, `undo`, `approval`, `sync`, `app` | compatible | Additions. Nothing existing is relaxed; Principle III is strengthened where it previously rested on an assumption that does not hold on macOS |
| requirement | `platform` — four new requirements: macOS native module, signing and notarisation, identity continuity, zero-permission floor | new | `pet`, `app`, `uix`, `backend` | compatible | The identity-continuity requirement constrains the update path that `req-016-signing-update` specified, without contradicting anything it says |
| requirement | `pet` — two new requirements on focus preservation and focus restoration | new | `app`, `uix` | compatible | Sits beside the Windows native-module requirement rather than replacing it |
| requirement | `app` — two new requirements on Dock presence and permission-free onboarding | new | `uix` | compatible | Dock presence is new subject matter; onboarding gains a constraint, not a step |
| requirement | `uix` — two new requirements on capture exclusion and permission refusal | new | `pet`, `app` | compatible | Both resolve to existing card types |
| requirement | `backend` — one new requirement on per-platform manifests | new | `platform`, `app` | compatible | Realised by the contract revision below |
| contract | `backend/contracts/update-feed` | 1.0.0 → **1.1.0** | `platform`, `app` | compatible, MINOR | Additive. A client written against 1.0.0 reads `latest.yml` and receives the Windows feed unchanged. The version is owned by `req-016-signing-update`, which is planned and not archived, so this change carries the revision and that change needs no edit |
| contract | `platform/contracts/window-integration-module` | new at 1.0.0 | `pet`, `app`, `uix` | compatible | No prior surface existed. The Windows native module was specified as a requirement without a contract; this contract now describes what both implementations owe, and the existing Windows requirement remains its Windows realisation |
| stored-data | The ledger and job stores | existing shape, new durability setting | every capability that reads history | compatible | No schema change, no rewrite, no migration. A store written under either setting is readable under the other |
| cluster | `trust-chain` (`ledger`, `undo`, `approval`) | — | — | — | Cross-cutting check required: an undo replayed after a power loss on macOS, where the question is whether the compensating step sees the record the store reported written |
| cluster | `account-sync` (`sync`, `ledger`, `backend`, `platform`) | — | — | — | Cross-cutting check required: the macOS measurement confirms that a device's credentials cannot travel with the user, so every recovery path must go through replication and none may assume a local copy |

## BREAKING assessment

Nothing here is breaking. Three candidates were considered and each fails the test:

- The contract revision is additive and leaves the 1.0.0 reading intact for released clients.
- The durability setting changes performance, not format; no consumer of the store observes a different shape.
- The zero-permission floor forbids a future direction rather than removing a present behaviour, since no
  feature currently requires a permission.

The one genuinely irreversible item is not a specification change at all: once a build has been distributed
under a signing identity, changing that identity discards the users' credentials and permissions with no
recovery. That is why it is specified as a constraint on the update path before the first distribution rather
than as a migration afterwards.

## Decision: Merge or Split

**Merge into one change.** All six capabilities are touched by a single event — one measurement campaign on
one operating system — and the findings interlock: the signing constraint is simultaneously a credential
requirement, an update requirement and a permission requirement, and splitting it across `platform`, `backend`
and `app` would leave three partial statements of one obligation, each defensible alone and none of them the
actual rule.

Two obligations are handed to other changes rather than absorbed here:

- **`req-016-signing-update` — the Windows half of the release pipeline.** It stays as it is. When it is
  archived, `update-feed@1.1.0` is the version to carry forward, and the ordering between the two changes must
  keep the revision after the original. Recorded as a dependency in `.change.yaml`.
- **M3 screen awareness.** The permission matrix, the onboarding elevation flow and the four system-card
  templates drafted in `spikes/SP-22-macos-permissions/evidence/` are inputs to that work, not to this change.
  This change fixes only the floor those features must respect.

## Migration Plan

None required for stored data or for clients. The single sequencing constraint is that the release pipeline
must be signing with the final distribution identity before the first package reaches any user, because that
step is one-way. It is a precondition rather than a migration, and it is recorded in `evolution.md`.

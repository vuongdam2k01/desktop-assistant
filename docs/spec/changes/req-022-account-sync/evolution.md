# Evolution: sync

Covers the three contracts this change introduces and the two `reserved` variability points `model.md` declares.
All three contracts are `draft` at `0.1.0`; none is frozen, so the policies below govern from the first version
that is.

A note that governs everything here: while a contract is `draft` and no device in the field speaks it, a breaking
edit is a PATCH of the draft rather than a MAJOR. The moment the first build ships to a device the user keeps,
that ends — devices hold the only copy of work that has not yet replicated, and a device unable to speak the
protocol cannot hand that work back. Freezing is therefore not a formality here but the point at which
compatibility starts costing something real.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `replicated-store-descriptor` | Removing a field; narrowing an existing field's admissible values; adding a required field with no default; changing `storeId` identity semantics; reusing a retired `storeId`; changing what a `resolutionRule` value guarantees | Adding an optional field; adding a value to `resolutionRule`, `orderingBasis`, `encryptionClass` or `StoreCapability`; relaxing a constraint | Clarifying wording; correcting a description or an example; tightening prose without changing admissibility |
| `replication-protocol` | Removing or renaming an endpoint; changing the ordering rule; changing what a `Resolution` outcome means; moving a field into or out of `EncryptedPayload`; changing cursor semantics | Adding an endpoint; adding an optional envelope or result field; adding an error code an older caller treats as a generic failure; honouring a new `StoreCapability` | Clarifying semantics; correcting an example or an error description |
| `device-registry` | Removing an endpoint or a `DeviceEntry` field; adding a `DeviceState` an older client would read as permissive; changing what revocation means; making `confirmed` optional | Adding an optional field; adding a `DeviceState` an older client safely treats as non-permissive; adding an endpoint; adding an error code | Clarifying wording; correcting an example |

Two asymmetries are deliberate and are the reason these tables are not the generic ones.

Adding a `resolutionRule` value is MINOR, but only where every existing descriptor keeps its exact behaviour and
the new value's admissibility against `encryptionClass` is stated in the same version. INV-SYNC-04 must hold for
every value that exists, not only for the two that exist today; a rule added without that statement is a rule an
append-only store might one day declare.

Adding a `DeviceState` is MINOR only in one direction. An older client must treat an unknown state as
non-permissive — showing the device as in a state it does not recognise and still offering revocation. A state an
older client would read as `active`-like is MAJOR, because the failure is silent: the user is shown a device as
trusted that the current version considers shut out.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| Device-bound storage (constitution 1.0.0) | Account-owned replication (constitution 2.0.0) | Yes, on first sign-in after update | The device's existing local ledger, rules, configuration and connector authorisation | The device's existing store becomes the seed of the account's replicated set rather than being discarded. No user action beyond signing in; nothing is exported or carried. Only relevant for devices that ran a pre-amendment build |
| `replicated-store-descriptor` `0.x` → `1.0.0` | Freeze | Yes | None in the field while draft | Freezing is the commitment point. The descriptor set registered at freeze is the baseline every later version is compared against |
| Any contract, within one MAJOR | Later MINOR | Yes | All | Both sides operate at the lower MINOR; unknown optional fields are ignored. No migration step and no user-visible event |
| Any contract, across a MAJOR | Next MAJOR | No | All, preserved on both sides | Replication does not proceed. The device reports that an update is required and continues against its local working copy; nothing is erased and nothing partially exchanged. The backend serves the previous MAJOR for at least one release cycle past the release introducing the new one, so a machine switched off for a while can still hand back the work it holds |
| A store's `resolutionRule` changed in a descriptor | Next descriptor version | Manual, requires `/specdocs:impact` | Records already resolved under the old rule | Records resolved under the previous rule are not re-resolved. A store moving from `last-writer-wins-with-preservation` to `append-and-reconcile` is safe in this direction; the reverse direction is refused for an append-only store by INV-SYNC-04 and must be treated as a new store with a new `storeId` for a mutable one |

Partial replication across a MAJOR boundary is refused everywhere above, and the reason is worth stating once
rather than per row: a device that misunderstands a resolution outcome can destroy data without knowing it. A
refused exchange is recoverable — the user updates. A misapplied resolution is not.

## Deprecation

Deprecating an element of any of these contracts follows one procedure.

1. **Mark in place.** The element is annotated as deprecated in the contract at the version that deprecates it,
   naming its replacement and the version in which it is expected to be removed. Deprecation is always MINOR;
   removal is always MAJOR.
2. **Identify remaining consumers.** The consumers are enumerable rather than discovered: each contract's
   front-matter lists them, and the client side is a released build rather than an open ecosystem. Two
   populations must be established — the capabilities that reference the element, found by search across
   `docs/spec/capabilities/` and the active changes, and the device versions still speaking it, which the backend
   knows from the `protocolVersion` of the handshakes it receives.
3. **Notice period.** Removal does not proceed while the backend is still receiving handshakes from devices that
   depend on the element. The floor is the one-release-cycle support window above; the actual period is whichever
   is longer. During the closed beta the population is small and known, so the condition is checkable exactly
   rather than estimated.
4. **Removal.** A MAJOR bump with a Migration section in the contract and updated consumers, preceded by
   `/specdocs:impact`.

The device population is the binding constraint, not the notice period. A user who has not opened the product in
three months holds work that has never replicated; removing something their build depends on is what makes that
work unrecoverable, which is precisely the failure this whole change exists to prevent.

## Extension Procedure

**Adding a replicated store** — the extension this design is built for, and the only one that requires no change
to the protocol.

1. Author a Store Descriptor against `replicated-store-descriptor@0.1.0`. Decide `encryptionClass` first, because
   it constrains everything after it: an append-only store has exactly one admissible `resolutionRule`, and a
   mutable store must name a `supersededTarget` that is itself append-only.
2. Register the descriptor with the replication protocol on both sides. The registered set is the authority; a
   store present on a device but absent from the registry does not replicate, by construction.
3. State the store's membership in `specs/sync/spec.md`'s replicated-set requirement, so the descriptor set and
   the specification can be checked against each other rather than drifting.
4. Decide `eraseOnSignout` explicitly. Absent means erased; a store that survives sign-out needs a recorded
   justification, because account data on a signed-out device is the case requiring defence.
5. Verify: that the store replicates between two devices; that an interrupted transfer resumes from its cursor
   rather than restarting; that a conflict resolves as the descriptor declares; that retention removes its
   records on every device and the backend; and that sign-out erases it. For an append-only store, additionally
   verify that a push attempting to replace a held record fails with `APPEND_ONLY_VIOLATION` and writes nothing.

**Adding a resolution rule.** A change to `replicated-store-descriptor`, MINOR, and it must state the new value's
admissibility against every `encryptionClass` in the same version — not in a follow-up. Then extend the
protocol's `Resolution` outcomes if the new rule produces one that does not already exist, which is MINOR there
too. Verify that existing descriptors are byte-for-byte unaffected and resolve exactly as before.

**Adding a device state.** A change to `device-registry`. Establish first whether an older client reading the
state as unrecognised would behave safely; if yes it is MINOR, if it would read as permissive it is MAJOR. Verify
against a build at the previous version, not only against the current one — the whole question is what the older
client does.

**Adding a backend endpoint or an error code.** MINOR in `replication-protocol`. Every endpoint requires a valid
session, and any path that decrypts must produce an Access Audit Record (INV-SYNC-08); an endpoint that reads
account content without one is not admissible regardless of what it is for. Verify that the audit record is
written and that the endpoint fails when it cannot be.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Encryption key custody granularity — per-account or per-region key scoping in place of service-scope keys | After the closed beta | RISK-062 accepts that a backend compromise exposes user work content; service-scope keys mean one compromise reaches every account. Narrowing key scope narrows the blast radius without changing the recovery property, since the service still holds the keys either way. Reserved rather than built because it costs key-management complexity that the beta population does not yet justify | The first of: a beta population large enough that a single key compromise is not an acceptable loss, **or** a data-residency obligation arising from RISK-067 that requires per-account or per-region key scoping. RISK-067 escalates the infrastructure-region question from a deployment preference to a compliance decision, tracked as `Q-OQ-11` in `req-001-mvp-product-definition` |
| Payload compression for replicated snapshots | After SP-22 sizing | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 measured a 44.5 percent reduction on snapshot payloads and the spike deliberately left it unapplied, because 12–30 MB per device over 90 days did not justify losing direct inspectability of the stored payload. Replication changes the arithmetic: the account total is the union across devices and now includes transcripts, and the volume crosses the network rather than sitting on a disk with tens of gigabytes free | SP-22 measures an account-total or per-exchange transfer volume that justifies the trade. RISK-069 records that this figure does not exist yet. Activation is a MINOR addition to `replication-protocol` as a `StoreCapability`, not a change to how any store resolves or orders |

Both slots satisfy the constitution's Reserved By Design section: each states its phase, its rationale and the
condition that activates it. Neither is a silent future-proofing — the first is a security control deferred on
cost grounds with a named risk behind it, and the second is an optimisation whose deferral a spike already
measured and justified once.

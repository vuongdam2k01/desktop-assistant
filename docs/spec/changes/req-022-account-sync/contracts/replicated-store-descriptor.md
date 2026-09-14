---
contract: replicated-store-descriptor
version: 0.1.0
status: draft
owner: sync
consumers: [sync, backend, ledger, connector, platform, app]
schema_files: [replicated-store-descriptor.schema.json]
---

# Contract: Replicated Store Descriptor

## Purpose

This descriptor is how a body of account data joins replication. The replication protocol holds no knowledge of
any particular store: it enumerates registered descriptors and applies what each one declares — how the store
orders its records, how it resolves a conflict, how long it retains, and whether a device erases it on sign-out.
Adding a store is therefore registering a descriptor, not editing the protocol, which is the `open` variability
point recorded in `model.md`.

Both sides of the client/backend boundary read the same descriptor set, so a device and the backend cannot
disagree about how a store behaves. Every consumer listed above either owns a store that replicates or enforces
what a descriptor declares.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`replicated-store-descriptor.schema.json`](./replicated-store-descriptor.schema.json) | JSON Schema draft-07 | normative |

The schema file is the normative descriptor shape read by both sides of the client/backend boundary. The records
the descriptors govern travel under [`replication-protocol.openapi.yaml`](./replication-protocol.openapi.yaml)
and are stored under [`replication-protocol.sql`](./replication-protocol.sql), each owned by the replication
protocol contract. The descriptor file owns registration metadata; it does not add a transport.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type StoreId = string;            // stable for the life of the store; records reference it
type SemVer = string;             // "MAJOR.MINOR.PATCH"

type ResolutionRule =
  | "append-and-reconcile"                  // every participating record survives; nothing is replaced
  | "last-writer-wins-with-preservation";   // server receive order decides; loser becomes a Superseded Version

type EncryptionClass =
  | "append-only"   // records are never modified or deleted once written
  | "mutable";      // records carry versions and may be edited

type OrderingBasis =
  | "device-sequence-causal";  // per-device monotonic sequence plus causal position across devices
  // wall-clock ordering is not expressible; see INV-SYNC-06

interface ReplicatedStoreDescriptor {
  descriptorVersion: SemVer;     // version of THIS contract the descriptor is written against
  storeId: StoreId;
  version: SemVer;               // version of this descriptor's own declaration
  name: string;                  // shown where the product names what replicates or what sign-out erases
  encryptionClass: EncryptionClass;
  resolutionRule: ResolutionRule;
  orderingBasis: OrderingBasis;
  retention: RetentionRule;
  membership: string;            // what belongs in this store, checkable against specs/sync/spec.md

  supersededTarget?: StoreId;    // required when resolutionRule is last-writer-wins-with-preservation
  eraseOnSignout?: boolean;      // absent means true; false requires a recorded justification
  capabilities?: StoreCapability[];
}

interface RetentionRule {
  minimumDays: number;           // the floor the store guarantees
  userConfigurable: boolean;
  deletionRequiresConfirmation: boolean;
}

type StoreCapability =
  | "partial-transfer";          // store may be transferred in parts during enrolment

type DescriptorValidationError =
  | { code: "DESCRIPTOR_MISSING"; storeId: StoreId }
  | { code: "DESCRIPTOR_MALFORMED"; storeId: StoreId; field: string }
  | { code: "RULE_NOT_ADMISSIBLE"; storeId: StoreId; encryptionClass: EncryptionClass; resolutionRule: ResolutionRule }
  | { code: "SUPERSEDED_TARGET_MISSING"; storeId: StoreId }
  | { code: "SUPERSEDED_TARGET_NOT_APPEND_ONLY"; storeId: StoreId; supersededTarget: StoreId }
  | { code: "STORE_ID_CONFLICT"; storeId: StoreId }
  | { code: "DESCRIPTOR_VERSION_UNSUPPORTED"; storeId: StoreId; descriptorVersion: SemVer };
```

### 2. Wire / Communication Protocol

The descriptor set is exchanged during the handshake defined by `sync/contracts/replication-protocol@0.1.0`; this
contract defines the payload, not the transport. It opens no channel of its own.

### 3. Module Descriptor / Manifest Specification

See companion schema: [replicated-store-descriptor.schema.json](./replicated-store-descriptor.schema.json)

## Semantics

- `storeId` is the identity records carry. It is stable for the life of the store, because INV-SYNC-01 forbids a
  record from changing which store it belongs to. Reusing a retired `storeId` for a different store is a MAJOR
  change, not a new registration.
- `encryptionClass` constrains `resolutionRule` rather than merely describing the store. The `allOf` clause in the companion schema
  is the mechanical expression of INV-SYNC-04: an append-only store cannot declare last-writer-wins, so the
  failure in RISK-065 — replication silently deleting ledger history — is not expressible in a valid descriptor.
  This is deliberately enforced in the schema rather than left to review, because the convenient default for a
  mutable store is the destructive one for an append-only store.
- `resolutionRule` is the store's whole conflict behaviour. `append-and-reconcile` guarantees that every
  participating record survives on every replica. `last-writer-wins-with-preservation` guarantees that exactly
  one version is current and that no displaced version is destroyed — it is not plain last-writer-wins, and the
  `supersededTarget` requirement is what makes the difference real rather than nominal.
- `supersededTarget` must name a store whose `encryptionClass` is `append-only`. A preserved version held
  somewhere it could itself be overwritten preserves nothing (INV-SYNC-10).
- `orderingBasis` admits one value today. It is an enumeration rather than a fixed field so that a future basis
  is a MINOR addition with an explicit migration, and so that the absence of a wall-clock option is visible in
  the contract rather than implied.
- `retention.minimumDays` is a floor, not a target. A store retains at least this long; the effective period may
  be longer when the user configures it and `userConfigurable` is true.
- `eraseOnSignout` absent means true. The default is erasure because account data remaining on a signed-out
  device is the case that requires justification, not the other way round.
- `membership` is prose, deliberately. It exists so the replicated set asserted in `specs/sync/spec.md` can be
  checked against the registered descriptors rather than taken on trust; it is read by people and by review, not
  parsed.
- **Failure is refusal, never a default.** A store presented with no descriptor, a malformed one, or one failing
  any constraint above is refused and the refusal is reported. There is no fallback descriptor and no inferred
  rule. This is the `Fallback on Missing Manifest` position recorded in `model.md`, and it is a visible failure
  at registration time in place of an invisible one at conflict time.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `DESCRIPTOR_MISSING` | A store was presented for replication with no registered descriptor | Both — the presenting side refuses to replicate it; the receiving side refuses to accept its records | None directly. The store does not replicate, and the product reports that this device is not fully current rather than claiming success |
| `DESCRIPTOR_MALFORMED` | A required field is absent, or a value falls outside its schema | Callee — the receiving side rejects the descriptor set | None directly; surfaces as the store not replicating. A malformed descriptor is a defect, not a user condition |
| `RULE_NOT_ADMISSIBLE` | An append-only store declared `last-writer-wins-with-preservation` | Callee | None directly. This condition must be unreachable in a released build; reaching it means a store was registered that could destroy history |
| `SUPERSEDED_TARGET_MISSING` | A store declared last-writer-wins with no store to receive displaced versions | Callee | None directly; the store does not replicate |
| `SUPERSEDED_TARGET_NOT_APPEND_ONLY` | The named `supersededTarget` is itself mutable | Callee | None directly; the store does not replicate |
| `STORE_ID_CONFLICT` | Two descriptors claim the same `storeId`, or a retired id is reused | Callee | None directly; neither store replicates until the conflict is resolved |
| `DESCRIPTOR_VERSION_UNSUPPORTED` | The descriptor is written against a contract MAJOR the other side does not support | Both | The product states that this device's version cannot exchange data with the account and that an update is required — it does not replicate partially |

No error in this matrix is recoverable by the user acting differently. Every one of them is either a defect or a
version mismatch, and each is reported as such rather than presented as something the user has done wrong.

## Compatibility

- **MAJOR** — removing a field, narrowing an existing field's admissible values, adding a required field with no
  default, changing the meaning of `storeId` identity, or reusing a retired `storeId`. Any of these can change
  how an already-replicated store resolves conflicts or retains data, so each requires a Migration section and
  updated consumers.
- **MINOR** — adding an optional field, adding a value to `resolutionRule`, `orderingBasis`, `encryptionClass` or
  `StoreCapability`, or relaxing a constraint. A new `resolutionRule` value is MINOR only where existing
  descriptors keep their exact behaviour; it still requires that the admissibility rules against
  `encryptionClass` be stated, since INV-SYNC-04 must hold for every value that exists.
- **PATCH** — clarifying wording, tightening a description, correcting an example.
- **Legacy support** — a device and the backend exchange `descriptorVersion` during the handshake. Within one
  MAJOR, the older side's understanding governs and unknown optional fields are ignored. Across a MAJOR,
  replication does not proceed: the device reports that an update is required. Partial replication across a
  MAJOR boundary is not offered, because a device that misunderstands a resolution rule can destroy data it does
  not know it is destroying.
- **Version discovery** — `descriptorVersion` on each descriptor; the handshake in
  `sync/contracts/replication-protocol@0.1.0` carries the set.

## Examples

**Valid** — the ledger store, which is append-only and therefore has exactly one admissible rule:

```json
{
  "descriptorVersion": "0.1.0",
  "storeId": "ledger",
  "version": "1.0.0",
  "name": "Action ledger",
  "encryptionClass": "append-only",
  "resolutionRule": "append-and-reconcile",
  "orderingBasis": "device-sequence-causal",
  "retention": { "minimumDays": 90, "userConfigurable": true, "deletionRequiresConfirmation": true },
  "membership": "Intent and result records, before and after snapshots, decision records, superseded versions of mutable records.",
  "capabilities": ["partial-transfer"]
}
```

**Valid** — a mutable store, which must name where displaced versions go:

```json
{
  "descriptorVersion": "0.1.0",
  "storeId": "approval-rules",
  "version": "1.0.0",
  "name": "Approval rules",
  "encryptionClass": "mutable",
  "resolutionRule": "last-writer-wins-with-preservation",
  "orderingBasis": "device-sequence-causal",
  "retention": { "minimumDays": 90, "userConfigurable": false, "deletionRequiresConfirmation": true },
  "membership": "Elicited approval rules and their enabled state.",
  "supersededTarget": "ledger"
}
```

**Rejected** — the transcript store declaring last-writer-wins:

```json
{
  "descriptorVersion": "0.1.0",
  "storeId": "transcripts",
  "version": "1.0.0",
  "name": "Agent transcripts",
  "encryptionClass": "append-only",
  "resolutionRule": "last-writer-wins-with-preservation",
  "orderingBasis": "device-sequence-causal",
  "retention": { "minimumDays": 90, "userConfigurable": true, "deletionRequiresConfirmation": true },
  "membership": "Agent conversation turns.",
  "supersededTarget": "ledger"
}
```

Rejected with `RULE_NOT_ADMISSIBLE`. The store is append-only, so the only admissible rule is
`append-and-reconcile`; the `allOf` clause rejects it before it can replicate. Naming a valid `supersededTarget`
does not rescue it — the objection is not that displaced turns would be lost, but that an append-only store must
never displace anything. This is the exact shape of RISK-065, refused at the schema.

## Migration

Not applicable — initial version.

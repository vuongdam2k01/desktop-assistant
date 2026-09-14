---
contract: replication-protocol
version: 0.1.0
status: draft
owner: sync
consumers: [sync, backend, ledger, connector, platform, app]
schema_files: [replication-protocol.openapi.yaml, replication-protocol.sql]
---

# Contract: Replication Protocol

## Purpose

This is the wire protocol across the client/backend boundary by which a device's local working copy and the
account's stored data are made to agree. It carries every replicated store uniformly: stores differ by their
descriptor, never by their transport, so adding a store adds no endpoint and changes no payload shape.

The protocol serves three obligations that `specs/sync/spec.md` states as observable behaviour — enrolment of a
new device from sign-in alone, ongoing exchange of records in both directions, and the lease that bounds what a
device may do while it cannot be reached. It is the sole surface for all three; no consumer reaches the
account's stored data by any other route.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`replication-protocol.openapi.yaml`](./replication-protocol.openapi.yaml) | OpenAPI 3.1 | normative |
| [`replication-protocol.sql`](./replication-protocol.sql) | SQL DDL | normative |

The OpenAPI document carries the four request-response exchanges and every payload they exchange.
`replication.changes` is deliberately not in it: the stream is an optimisation over polling and never the only
path, so what is frozen is the surface a correct device can rely on alone. The path layer is introduced by that
file — the contract's channel names are what other artifacts cite, and the paths are how they are reached.

`replication-protocol.sql` is the account's partition on the backend. It is worth reading beside the claim it
supports: every column the backend reads in order to route, order or resolve a record sits outside the
ciphertext, and no column exists through which resolution could consult content. It carries the per-device,
per-store checkpoint that makes an interrupted enrolment resumable, and the key-access audit relation that
refuses its own modification.

The device-side copy of the same records is the Local Store, whose schema belongs to
`ledger/contracts/ledger-store@0.1.0`; the device rows themselves belong to the authentication store owned by
`backend/contracts/client-session-api@0.1.0`. Neither is repeated in this change.

## Schema / Surface

### 1. Interface & Data Types

The wire surface is [`replication-protocol.openapi.yaml`](./replication-protocol.openapi.yaml) and the store it
serves from is [`replication-protocol.sql`](./replication-protocol.sql). The declarations below name the same
payloads for a reader.

```typescript
type AccountId = string;
type DeviceId = string;
type StoreId = string;
type RecordId = string;
type Cursor = string;             // opaque; the checkpoint position, meaningful only to the backend

interface RecordEnvelope {
  recordId: RecordId;
  storeId: StoreId;
  originDevice: DeviceId;
  originSequence: number;         // monotonic within originDevice; never reused (INV-SYNC-05)
  causalPosition: CausalPosition; // ordering across devices; independent of any clock
  recordedAt: string;             // ISO-8601, for display only; never used to order (INV-SYNC-06)
  version: number;                // mutable stores only; 0 for append-only
  payload: EncryptedPayload;      // opaque to the protocol and to the backend
}

interface CausalPosition {
  // Per-device high-water marks the originating device had observed when it wrote the record.
  // The backend orders by this and by originSequence; it never inspects payload to order.
  observed: Record<DeviceId, number>;
}

interface EncryptedPayload {
  ciphertext: string;
  keyId: string;
}

interface Handshake {
  protocolVersion: string;
  descriptorVersion: string;
  descriptors: ReplicatedStoreDescriptor[];   // per replicated-store-descriptor@0.1.0
  deviceId: DeviceId;
  cursors: Record<StoreId, Cursor | null>;    // null = this device holds nothing for that store yet
}

interface HandshakeResult {
  accountId: AccountId;
  protocolVersion: string;
  descriptors: ReplicatedStoreDescriptor[];   // the backend's registered set, for comparison
  lease: Lease;
  enrolmentRequired: StoreId[];               // stores for which this device must complete a full transfer
}

interface Lease {
  issuedAt: string;
  expiresAt: string;              // the bound; SP-22 sources the period, per RISK-066
  state: "active" | "expired" | "revoked";
}

interface PullRequest  { storeId: StoreId; cursor: Cursor | null; maxRecords: number; }
interface PullResult   { storeId: StoreId; records: RecordEnvelope[]; cursor: Cursor; complete: boolean; }

interface PushRequest  { storeId: StoreId; records: RecordEnvelope[]; }
interface PushResult   { storeId: StoreId; accepted: RecordId[]; resolutions: Resolution[]; cursor: Cursor; }

interface Resolution {
  recordId: RecordId;
  outcome: "reconciled" | "current" | "superseded";
  supersededBy?: RecordId;        // present when outcome is "superseded"
  supersededVersionRecordId?: RecordId;  // the record appended to the descriptor's supersededTarget
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `replication.handshake` | Device → Backend | Request-Response | `Handshake` | `HandshakeResult` | `SESSION_INVALID`, `DEVICE_REVOKED`, `ACCOUNT_DELETED`, `PROTOCOL_VERSION_UNSUPPORTED`, `DESCRIPTOR_SET_MISMATCH` |
| `replication.pull` | Device → Backend | Request-Response, resumable by cursor | `PullRequest` | `PullResult` | `SESSION_INVALID`, `DEVICE_REVOKED`, `CURSOR_INVALID`, `STORE_UNKNOWN`, `KEY_UNAVAILABLE` |
| `replication.push` | Device → Backend | Request-Response | `PushRequest` | `PushResult` | `SESSION_INVALID`, `DEVICE_REVOKED`, `LEASE_EXPIRED`, `STORE_UNKNOWN`, `RECORD_REJECTED`, `APPEND_ONLY_VIOLATION` |
| `replication.changes` | Backend → Device | Stream | — | `RecordEnvelope` batches with a `Cursor` | Stream loss is not an error: the device falls back to `replication.pull` from its last cursor |
| `replication.lease` | Device → Backend | Request-Response | `{ deviceId }` | `Lease` | `SESSION_INVALID`, `DEVICE_REVOKED` |

Every endpoint requires a valid session, per the `backend` capability's requirement that all endpoints except
authentication and version check are authenticated. `replication.changes` is an optimisation over polling and
never the only path: a device that loses the stream stays correct by pulling from its cursor, which is what keeps
the offline and degraded behaviour in `specs/sync/spec.md` achievable.

### 3. Module Descriptor / Manifest Specification

Not applicable — the descriptor schema is `sync/contracts/replicated-store-descriptor@0.1.0`. This contract
carries descriptors in its handshake but does not define them.

## Semantics

- **The payload is opaque to the protocol and to the backend.** Ordering, conflict resolution and cursor
  advancement read only the envelope. This is what makes the `backend` requirement — that it serves replication
  without interpreting content — mechanically true rather than a promise, and it is why `causalPosition` and
  `originSequence` sit outside `EncryptedPayload`.
- **Ordering is by `causalPosition` then `originSequence`.** `recordedAt` is carried and displayed and never
  consulted for ordering (INV-SYNC-06). Two records with no causal relationship order by a rule that is stable on
  every device, so every replica presents the same sequence — the observable property stated in
  `specs/sync/spec.md`.
- **Resolution is the descriptor's, not the protocol's.** For an `append-and-reconcile` store every pushed record
  returns `reconciled` — a record already held returns `reconciled` too, so re-delivery is idempotent and never
  appends a duplicate. For a `last-writer-wins-with-preservation` store the record the backend receives last
  returns `current`, the displaced one returns `superseded`, and `supersededVersionRecordId` names the record
  appended to the descriptor's `supersededTarget`. A push that would replace a record in an append-only store
  fails with `APPEND_ONLY_VIOLATION` and writes nothing.
- **Cursors make transfer resumable.** A cursor is per device and per store (INV-SYNC-09), so one store's large
  transfer cannot force another to restart, and an interrupted enrolment resumes where it stopped rather than
  beginning again. A device holding `null` for a store is enrolling into it; `enrolmentRequired` in the handshake
  names those stores so the device knows it is not yet complete and does not present partial state as whole.
- **The lease is derived, never asserted.** It is issued by the backend on each successful handshake or exchange
  and cannot be extended by the device (INV-SYNC-07). An expired lease stops the device using replicated
  connector authorisation; it does not stop the device reading or writing its own local working copy, which is
  why `LEASE_EXPIRED` appears on `push` but never on `pull`. A device must be able to catch up precisely when its
  lease has lapsed.
- **Revocation is answered here, not negotiated.** `DEVICE_REVOKED` is terminal on every endpoint: the device
  stops using replicated authorisation at once and begins erasure. The backend enforces revocation whether or not
  the device ever asks, so this response is the device learning something already true rather than the mechanism
  that makes it true.
- **`KEY_UNAVAILABLE` has no plaintext fallback.** If the key needed to serve a record cannot be obtained, the
  request fails. The `backend` requirement forbids any path that serves content without the key, and INV-SYNC-08
  requires that a key use which cannot be audited does not happen.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `SESSION_INVALID` | No session, or one that has expired | Caller — the device refreshes its session and retries | None while refresh succeeds. On repeated failure the user is asked to sign in again |
| `DEVICE_REVOKED` | The device was revoked, signed out elsewhere, or its session was withdrawn | Both — backend refuses; device stops using replicated authorisation and erases | The device states that it no longer has access to the account and that its copy of the account's data is being removed |
| `ACCOUNT_DELETED` | The account was deleted while this device was offline | Both | The device states that the account no longer exists and erases the account's data from itself |
| `PROTOCOL_VERSION_UNSUPPORTED` | The device and backend do not share a protocol MAJOR | Both | The product states that an update is required before it can exchange data with the account. No partial replication is attempted |
| `DESCRIPTOR_SET_MISMATCH` | A store the device declares is unknown to the backend, or two descriptors for one store disagree | Both — the mismatched store is excluded; other stores continue | The product states that this device is not fully current and names what is not replicating, rather than reporting success |
| `CURSOR_INVALID` | A cursor no longer resolves, for example after a server-side compaction | Caller — the device restarts that store's transfer from `null` | The product reports that it is re-fetching a store. No data is lost: a full transfer reconciles against what is already held |
| `STORE_UNKNOWN` | A `storeId` with no registered descriptor | Callee | None directly; that store does not replicate and is named as not current |
| `KEY_UNAVAILABLE` | The decryption key for the account cannot be obtained, or its access could not be audited | Callee | The product reports that the account's data cannot be served at present and continues against the local working copy |
| `LEASE_EXPIRED` | The device pushed after its lease bound passed with no successful exchange | Caller — the device re-handshakes to obtain a lease, then retries | Connector operations are refused with the reason that the device must reconnect to the account. Local work continues |
| `RECORD_REJECTED` | An envelope is malformed, or its `originDevice` is not enrolled to this account | Callee — the record is refused; the rest of the batch proceeds | None directly. A rejected record is a defect or a revoked device's push, not a user condition |
| `APPEND_ONLY_VIOLATION` | A push would replace or remove a record in an append-only store | Callee — nothing is written, and the attempt is itself recorded | None directly. This must be unreachable in a released build; reaching it means a path attempted to destroy history |

## Compatibility

- **MAJOR** — removing or renaming an endpoint, changing the ordering rule, changing what a `Resolution` outcome
  means, moving a field into or out of `EncryptedPayload`, or changing cursor semantics. Each can cause a device
  to misread another device's records, so none may be attempted within a MAJOR.
- **MINOR** — adding an endpoint, adding an optional envelope or result field, adding an error code that older
  callers can treat as a generic failure, adding a `StoreCapability` the protocol honours.
- **PATCH** — clarifying semantics, correcting an example or an error description.
- **Legacy support** — the handshake exchanges `protocolVersion`. Within one MAJOR, both sides operate at the
  lower MINOR and ignore unknown optional fields. Across a MAJOR, replication does not proceed and the device
  reports that an update is required; partial exchange is refused, because a device that misunderstands a
  resolution outcome can destroy data without knowing it. The backend supports the previous MAJOR for at least
  one release cycle beyond the release that introduces the new one, so a device that has been switched off does
  not find itself unable to recover the work it holds.
- **Version discovery** — `replication.handshake`, before any record is exchanged.

## Examples

**Valid** — a device that has been offline pushes two ledger records and one edited approval rule:

```json
{
  "storeId": "ledger",
  "records": [
    {
      "recordId": "rec-9f2a",
      "storeId": "ledger",
      "originDevice": "dev-laptop",
      "originSequence": 4471,
      "causalPosition": { "observed": { "dev-laptop": 4470, "dev-desktop": 8812 } },
      "recordedAt": "2026-09-11T09:14:22Z",
      "version": 0,
      "payload": { "ciphertext": "…", "keyId": "key-acct-7731" }
    }
  ]
}
```

The result reports `reconciled` for the ledger records. The approval rule, pushed to its own store, returns
`superseded` with `supersededBy` naming the version the other device wrote later and
`supersededVersionRecordId` naming the record appended to the ledger — so the user can read what was replaced and
restore it.

**Rejected** — a push that attempts to replace an existing ledger record:

```json
{
  "storeId": "ledger",
  "records": [
    {
      "recordId": "rec-9f2a",
      "storeId": "ledger",
      "originDevice": "dev-laptop",
      "originSequence": 4471,
      "causalPosition": { "observed": { "dev-laptop": 4470 } },
      "recordedAt": "2026-09-11T09:14:22Z",
      "version": 2,
      "payload": { "ciphertext": "…", "keyId": "key-acct-7731" }
    }
  ]
}
```

Rejected with `APPEND_ONLY_VIOLATION`. The `ledger` descriptor declares `encryptionClass: "append-only"`, where
`version` is 0 and a record is never rewritten; a non-zero version on this store is an attempt to replace
history. Nothing is written and the attempt is recorded. Note that the same envelope arriving with `version: 0`
and an already-held `recordId` is not an error at all — it returns `reconciled`, because re-delivery of an
identical record is the ordinary case after an interrupted exchange.

## Migration

Not applicable — initial version.

---
contract: device-registry
version: 0.1.0
status: draft
owner: sync
consumers: [sync, backend, app, connector, platform]
schema_files: [device-registry.openapi.yaml]
---

# Contract: Device Registry

## Purpose

The registry is the account's list of enrolled devices and the surface through which the user revokes one. It
exists because principle VII makes account sign-in the sole gate on the user's entire history, which RISK-064
records: the user's only way to see what that gate has admitted, and to shut a device out, is this list.

It is separate from `sync/contracts/replication-protocol@0.1.0` deliberately. Replication is data exchange; this
is authority over which devices may exchange at all. The `app` capability presents the list and the confirmation
wording; `backend` persists and enforces; `connector` and `platform` consume revocation as the trigger to stop
using replicated authorisation and to erase local material.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`device-registry.openapi.yaml`](./device-registry.openapi.yaml) | OpenAPI 3.1 | normative |

`registry.changed` is deliberately not in the file. Enforcement is at the backend on every request, so the
event is a convenience and freezing it would suggest a device may depend on receiving it.

There is no schema file for what the registry stores: a device entry is a row of the authentication store owned
by `backend/contracts/client-session-api@0.1.0`, and duplicating it here would give one relation two owners.

## Schema / Surface

### 1. Interface & Data Types

The wire surface is [`device-registry.openapi.yaml`](./device-registry.openapi.yaml). The declarations below
name the same payloads for a reader.

```typescript
type AccountId = string;
type DeviceId = string;

interface DeviceEntry {
  deviceId: DeviceId;
  label: string;                  // user-recognisable: machine name and operating system
  enrolledAt: string;             // ISO-8601
  lastReplicatedAt: string | null;// null = enrolled but has never completed an exchange
  state: DeviceState;
  isCurrentDevice: boolean;       // true for exactly one entry per requesting device
}

type DeviceState =
  | "enrolling"      // signed in; full transfer not yet complete
  | "active"         // enrolled and within its lease
  | "lease-expired"  // enrolled; has not replicated within the lease bound
  | "revoked";       // no longer served; retained briefly so the user sees the outcome of their action

interface RegistryView {
  accountId: AccountId;
  devices: DeviceEntry[];
  revisedAt: string;
}

interface RevokeRequest {
  deviceId: DeviceId;
  confirmed: true;                // the caller asserts the user confirmed; see Semantics
}

interface RevokeResult {
  deviceId: DeviceId;
  state: "revoked";
  sessionsWithdrawn: number;
  selfRevocation: boolean;        // true when the revoked device is the requesting one
}

type RegistryError =
  | { code: "SESSION_INVALID" }
  | { code: "DEVICE_REVOKED" }
  | { code: "DEVICE_NOT_FOUND"; deviceId: DeviceId }
  | { code: "DEVICE_NOT_IN_ACCOUNT"; deviceId: DeviceId }
  | { code: "CONFIRMATION_REQUIRED"; deviceId: DeviceId }
  | { code: "ACCOUNT_DELETED" };
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `registry.list` | Device → Backend | Request-Response | — | `RegistryView` | `SESSION_INVALID`, `DEVICE_REVOKED`, `ACCOUNT_DELETED` |
| `registry.revoke` | Device → Backend | Request-Response | `RevokeRequest` | `RevokeResult` | `SESSION_INVALID`, `DEVICE_REVOKED`, `DEVICE_NOT_FOUND`, `DEVICE_NOT_IN_ACCOUNT`, `CONFIRMATION_REQUIRED`, `ACCOUNT_DELETED` |
| `registry.changed` | Backend → Device | Pub-Sub | — | `RegistryView` | Delivery loss is not an error: a device re-reads through `registry.list`. Enforcement never depends on this event arriving |

### 3. Module Descriptor / Manifest Specification

Not applicable — the registry has no extension point. This is deliberate: an extensible revocation path would be
a second way to grant a device access to the account, which is the one thing this contract exists to hold closed.

## Semantics

- **The registry is the authority; the device is not consulted.** Revocation takes effect at the backend on the
  `registry.revoke` response, whether or not the revoked device is reachable. Everything the device does
  afterwards — refusing replicated authorisation, erasing its copy — is a second line, not the mechanism. This is
  what turns RISK-066 from a hope into a bound.
- **`label` is for recognition, not identification.** The user picks a device out of the list by recognising it;
  `deviceId` is what the protocol acts on. A label is never unique and never authenticates anything.
- **`state` distinguishes "cannot currently act" from "no longer permitted".** `lease-expired` is an ordinary,
  self-healing condition — the device has simply not replicated recently, and one successful exchange returns it
  to `active`. `revoked` is terminal and is never re-entered into `active`; a revoked device rejoins only by
  enrolling again through sign-in, which produces a new entry. Presenting these two as the same state would tell
  the user a laptop that has been shut for a fortnight has been thrown out of their account.
- **`confirmed` asserts a decision, it does not make one.** The backend refuses a revocation that does not carry
  it, so no path revokes a device as a side effect of another operation. The wording of the confirmation — that
  the device loses access and erases its copy — is owned by `app`, which the `app` capability states as a
  requirement. `confirmed` is typed as the literal `true` so that omitting it is a type error rather than a
  falsy default.
- **Self-revocation is permitted and is signalled.** `selfRevocation` lets the requesting device recognise that
  its own success response is also its sign-out, so it erases rather than waiting to be told by a later refused
  request.
- **A revoked entry is retained briefly, then removed.** It stays long enough for the user who revoked it to see
  the outcome, and disappears from `registry.list` afterwards, which is the behaviour the `sync` spec states —
  a revoked device is absent from the list on the account's other devices.
- **`registry.changed` is a convenience.** Enforcement is at the backend on every request, so a device that never
  receives the event is still shut out. A device that misses it sees the current registry at its next
  `registry.list`.
- **`DEVICE_NOT_IN_ACCOUNT` is distinct from `DEVICE_NOT_FOUND`** so that an attempt to revoke a device belonging
  to another account is legible as what it is. Neither response discloses whether the device exists elsewhere.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `SESSION_INVALID` | No session, or one that has expired | Caller — refresh the session and retry | None while refresh succeeds; otherwise the user is asked to sign in again |
| `DEVICE_REVOKED` | The requesting device has itself been revoked | Both — backend refuses; device begins erasure | The device states that it no longer has access to the account and that its copy is being removed |
| `DEVICE_NOT_FOUND` | The named device is not in this account's registry, or was already revoked and removed | Caller — refresh the list | The list refreshes and states that the device is no longer enrolled. A second revocation of an already-revoked device is not presented as a failure |
| `DEVICE_NOT_IN_ACCOUNT` | The named device belongs to a different account | Callee | Treated as not found. No information about the other account is disclosed |
| `CONFIRMATION_REQUIRED` | `confirmed` was absent | Caller | None. This is a defect in the calling surface, not a user condition — the user is asked to confirm before the call is made, never after it fails |
| `ACCOUNT_DELETED` | The account was deleted while this device was offline | Both | The device states the account no longer exists and erases the account's data from itself |

## Compatibility

- **MAJOR** — removing an endpoint or a `DeviceEntry` field, adding a `DeviceState` value that an older client
  would misread as permission (`active`-like), changing what revocation means, or making `confirmed` optional.
- **MINOR** — adding an optional field, adding a `DeviceState` value that an older client safely treats as
  "cannot currently act", adding an endpoint, adding an error code an older caller can treat as a generic
  failure.
- **PATCH** — clarifying wording, correcting an example.
- **Legacy support** — an unknown `DeviceState` is treated by a client as non-permissive: it may show the device
  as in an unrecognised state and offer revocation, and it must never treat it as `active`. This is what makes a
  new state MINOR rather than MAJOR, and the direction of the default is not negotiable — a client that guesses
  wrong must guess towards showing the user something to investigate, never towards silently trusting a device.
- **Version discovery** — through `replication.handshake` in `sync/contracts/replication-protocol@0.1.0`, which
  both sides complete before reading the registry.

## Examples

**Valid** — revoking a device the user does not recognise:

```json
{ "deviceId": "dev-8ac1", "confirmed": true }
```

Response:

```json
{ "deviceId": "dev-8ac1", "state": "revoked", "sessionsWithdrawn": 1, "selfRevocation": false }
```

The backend stops serving that device before responding. The user's other devices see the shortened list at their
next `registry.list` or on `registry.changed`; the revoked device learns of it when it next calls any endpoint,
and erases.

**Rejected** — a revocation that carries no confirmation:

```json
{ "deviceId": "dev-8ac1" }
```

Rejected with `CONFIRMATION_REQUIRED`, and nothing is revoked. Revoking a device destroys that device's copy of
the account's data and interrupts any job running on it, so it is never a side effect of another operation. The
correct handling is for the calling surface to obtain the user's confirmation first — with the wording the `app`
capability requires, naming the loss of access and the erasure — not to retry with the field appended.

## Migration

Not applicable — initial version.

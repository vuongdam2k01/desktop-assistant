---
contract: credential-class-descriptor
version: 0.1.0
status: draft
owner: platform
consumers: [platform, connector, agent, sync, backend, app]
schema_files: [credential-class-descriptor.schema.json]
---

# Contract: Credential Class Descriptor

## Purpose

A capability that needs to keep a credential on the device declares a class for it here, and the store in
`platform/contracts/secure-storage@0.1.0` then knows three things it could not otherwise know: which keys belong
to that class, what erases them, and how an entry that cannot be decrypted is replaced. This is what makes the
credential store an extension point rather than a list of special cases — adding the Nth connector registers a
descriptor and writes keys under it, and no component that erases, restores or displays credentials is edited.

Whoever adds a connector, a model provider or any other credential-holding capability builds on this contract.
It is read by the store at registration and by nothing at runtime except through the store.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`credential-class-descriptor.schema.json`](./credential-class-descriptor.schema.json) | JSON Schema draft-07 | normative |

The schema file is the descriptor shape read once, at registration, by the store in
`platform/contracts/secure-storage@0.1.0`. The descriptor is never transmitted across a boundary or stored; the
companion freezes the registration policy that every consumer reads through this contract.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type ClassId = string;                       // stable for the life of the class

type RestorationRoute =
  | "replication"                            // another signed-in device holds the account's copy
  | "account_sign_in";                       // only sign-in can re-establish it

type ErasureTrigger =
  | "connector_disconnect"
  | "sign_out"
  | "device_revocation"
  | "account_deletion"
  | "uninstall";

interface CredentialClassDescriptor {
  class_id: ClassId;
  version: string;                           // semver of this descriptor
  name: string;                              // shown where the product says what will be erased
  key_pattern: string;                       // "connector:<provider>:<identity>:<field>"
  owner: string;                             // capability path accountable for the content
  replicates: boolean;
  restoration_route: RestorationRoute;
  erase_on: ErasureTrigger[];                // always contains the four account-level triggers
  metadata_fields: string[];                 // exhaustive list of non-secret fields held beside the ciphertext
  expected_size?: string;                    // optional, for sizing and for spotting a class the rejected route would have broken
  notes?: string;
}
```

### 2. Wire / Communication Protocol

Not applicable — a descriptor is registered in the same process that holds the store, through
`registerClass` in `platform/contracts/secure-storage@0.1.0`. No descriptor crosses a process boundary, and no
channel exposes the registry: a window process learns a class only as the `classId` on a
`CredentialPresence`.

### 3. Module Descriptor / Manifest Specification

See companion schema: [credential-class-descriptor.schema.json](./credential-class-descriptor.schema.json)

## Semantics

- **`class_id` and `key_pattern` are a pair, and the pattern is the operative half.** The store matches an
  incoming key against registered patterns; the identifier exists so that presence, erasure reports and the risk
  register can name a class. A pattern may not overlap another registered pattern, because INV-PLT-02 requires
  exactly one class per key, and an overlap would make the erasure policy of an entry depend on registration
  order.
- **`replicates` and `restoration_route` are related but not the same question.** A class that does not
  replicate cannot be restored by replication, so `replicates: false` admits only `account_sign_in`. The reverse
  is not forced: the class holding the device's replication material replicates in the sense that the account
  holds it, yet it must declare `account_sign_in`, because replication cannot deliver the material replication
  itself depends on. INV-PLT-06 is that rule, and it is the one a new class is most likely to get wrong.
- **`erase_on` always contains the four account-level triggers.** Sign-out, device revocation, account deletion
  and uninstall are not policy choices a class may decline; a class that could decline them would be a way to
  leave a credential on a device the user has signed out of. `connector_disconnect` is the only optional member,
  and it belongs to classes whose entries are scoped to one connector.
- **`metadata_fields` is exhaustive, not indicative.** A field not listed is refused at write time with
  `METADATA_NOT_DECLARED`. This list is the enforcement of INV-PLT-09: metadata is read on paths that never
  decrypt, so anything reachable there must be something the product would accept a window process holding.
- **A descriptor is registered once, at introduction, and a change to it is a version.** Changing `erase_on` or
  `restoration_route` changes the behaviour of credentials that are already stored on users' devices, which is
  why those two are major-version changes and why `version` exists on a descriptor at all.
- **The product ships with the four classes the measurement found** —
  `spikes/SP-11-secure-storage/REPORT.md` §1 Q5 enumerated connector authorisation, user-supplied authorisation
  client, model-provider credential, and account session with device replication material. Nothing in this
  contract privileges them; they are the first four registrations, verified end to end in that section.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `DESCRIPTOR_INVALID` | A required field is absent, or a field does not satisfy the companion schema | Callee | The product fails to start; a class it cannot interpret would mean credentials with no erasure policy |
| `CLASS_PATTERN_CONFLICT` | The key pattern overlaps a registered class's pattern | Callee | The product fails to start, rather than resolving the overlap by registration order |
| `CLASS_TRIGGERS_INCOMPLETE` | `erase_on` omits one of the four account-level triggers | Callee | The product fails to start; this is the check that prevents a credential surviving sign-out |
| `CLASS_ROUTE_UNREACHABLE` | `replicates` is false while `restoration_route` is `replication` | Callee | The product fails to start; the class describes a restoration that cannot occur |
| `CLASS_ID_REUSED` | A second descriptor claims a registered `class_id` with a different pattern | Callee | The product fails to start; entries already on disk derive their class from their key, and reuse would reclassify them |

Every failure in this matrix is detected at registration, before any credential is read or written, and every
one of them stops the product rather than degrading it. That is deliberate: each describes a class whose
credentials would have an undefined erasure policy, and a product that starts in that state has already accepted
the failure it is trying to avoid.

## Compatibility

- **MAJOR** — removing a field, narrowing `key_pattern`, changing `erase_on` or `restoration_route` for a
  registered class, or adding a value to `RestorationRoute`. A new restoration route is major because every
  surface that tells the user how a connection is being restored decides what to say from this value.
- **MINOR** — adding an optional field, adding an `ErasureTrigger` that classes may opt into, or widening
  `metadata_fields` for a class.
- **PATCH** — wording, descriptions and notes.
- Version discovery is by the contract version in this file; each registered descriptor additionally carries its
  own `version`, and the two answer different questions — the shape of a descriptor, and the generation of one
  class's policy.

## Examples

A valid descriptor — the connector authorisation class, which is the one every new connector writes under:

```json
{
  "class_id": "connector_authorisation",
  "version": "0.1.0",
  "name": "Connector authorisations",
  "key_pattern": "connector:<provider>:<identity>:<field>",
  "owner": "connector",
  "replicates": true,
  "restoration_route": "replication",
  "erase_on": [
    "connector_disconnect",
    "sign_out",
    "device_revocation",
    "account_deletion",
    "uninstall"
  ],
  "metadata_fields": ["workspaceName", "scopeProfile", "accountLabel"],
  "expected_size": "under 1 KB; the measured combined state of one connector was 752 bytes",
  "notes": "Tokens, refresh tokens, expiry, granted scopes and the platform metadata identifying the workspace or account."
}
```

A rejected descriptor, and why:

```json
{
  "class_id": "replication_material",
  "version": "0.1.0",
  "name": "Device replication material",
  "key_pattern": "auth:session:<identity>",
  "owner": "sync",
  "replicates": true,
  "restoration_route": "replication",
  "metadata_fields": ["deviceLabel"]
}
```

This is refused twice over. It omits `erase_on`, so it declares no erasure policy at all — `DESCRIPTOR_INVALID`,
and had it listed only `account_deletion` it would have been `CLASS_TRIGGERS_INCOMPLETE`. More instructive is
`restoration_route: "replication"` on the class that holds the material this device uses to replicate: a device
whose replication material is unreadable cannot reach the account to fetch a replacement, so the route describes
a recovery that consumes what has just been lost. The correct value is `account_sign_in`, which is exactly the
guarantee principle VII makes — sign-in alone is sufficient, and it is sufficient here too.

## Migration

Not applicable at 0.1.0 — this is the first version and has no consumers on an earlier one.

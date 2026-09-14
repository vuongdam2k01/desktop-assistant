---
contract: pet-pack-manifest
version: 1.0.0
status: draft
owner: pet
consumers: [app, sync, backend, agent]
schema_files: [pet-pack-manifest.schema.json, pet-pack-store.sql, pet-pack-store.descriptor.json]
---

# Contract: pet-pack-manifest

## Purpose

A pet pack is a manifest, an animation asset and a persona. This contract owns the manifest — the document that
makes the other two into a pack, declares who the pack is and what it implements, and is the only thing a
library reads in order to list it.

It is the extension point the whole change exists to open. Adding a pet requires a manifest and an asset, and
requires no change to the renderer, the library, the replication protocol, or the settings surface. That shape
is deliberately the one `docs/spec/constitution.md` principle VI establishes for connectors; the principle
governs connectors rather than pets, so the shape is borrowed on its merits rather than inherited.

The division of labour between this contract and `pet/contracts/rive-state-machine@2.0.0` is worth stating
plainly, because both concern a pack. This contract describes the pack: identity, provenance, claims,
persona, and where the asset is. That contract describes the asset inside it: the artboard, the state machine
and the layers the runtime writes. A manifest is authored text and can be wrong; an asset either contains a
layer or does not. Where the two disagree, the asset decides.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`pet-pack-manifest.schema.json`](./pet-pack-manifest.schema.json) | JSON Schema 2020-12 | normative — the manifest document a pack must carry |
| [`pet-pack-store.sql`](./pet-pack-store.sql) | SQLite DDL | normative — the device-resident relations holding the library and the active selection |
| [`pet-pack-store.descriptor.json`](./pet-pack-store.descriptor.json) | Instance of `sync/contracts/replicated-store-descriptor@0.1.0` | normative — how the pack store joins replication |

The third file is the one that repays a second look. The pack store does not extend the replication protocol:
it registers a descriptor against the protocol's own extension point, declaring that it is a mutable store, that
a conflict resolves by last-writer-wins while preserving the superseded version, and that it needs the
`partial-transfer` capability that store already defines. That capability is what allows a pack's manifest to
arrive before its asset, which is the `arriving` state in the store schema and the "still arriving" listing the
user sees. Consequently this change adds a store and changes no protocol.

What none of the three files can express is stated here, because each is a property of the binary asset or of
the text rather than of a document shape. Whether the asset the manifest names exists, and whether its bytes
match the declared digest, is answered by reading it. Whether a declared capability is present in the asset is
answered by loading it. And whether an acknowledgement line states receipt only — naming nothing from the
command, asserting no understanding of it, promising no outcome — is answered by reading the line, which is why
the acceptance plan checks it and the schema only bounds its length.

## Schema / Surface

### 1. Interface & Data Types

The normative shape is [`pet-pack-manifest.schema.json`](./pet-pack-manifest.schema.json). The declarations
below name the same members for a reader and add the runtime types the file does not describe.

```typescript
export type PackProvenance = 'built-in-template' | 'account-pack';
export type PetAnimationCapability = 'work-status' | 'locomotion';
export type PackState = 'installed' | 'arriving' | 'damaged' | 'incompatible';

export interface ResolvedPack {
  packId: string;
  state: PackState;
  // What the manifest claimed.
  declaredCapabilities: PetAnimationCapability[];
  // What the asset actually supplied, decided at load. Where this is narrower than the line above,
  // the shipped default pack was bound for the difference.
  boundFromPack: PetAnimationCapability[];
}

export type ActivationRefusal =
  | 'INCOMPATIBLE_REVISION'
  | 'ARTBOARD_NOT_FOUND'
  | 'STATE_MACHINE_NOT_FOUND'
  | 'INVALID_ASSET_BUFFER'
  | 'BLEND_DURATION_OUT_OF_RANGE'
  | 'ASSET_NOT_PRESENT';

export type ImportRefusal =
  | 'MANIFEST_SCHEMA_UNSUPPORTED'
  | 'ASSET_CONTRACT_UNSATISFIED'
  | 'ASSET_OVER_SIZE_CEILING'
  | 'ASSET_UNREADABLE'
  | 'PERSONA_MISSING';
```

`ActivationRefusal` and `ImportRefusal` are separate types on purpose. They are separate because the remedies
are: an import refusal is answered by supplying a different file, and an activation refusal by updating the
product or repairing a pack that is already in the library. Collapsing them would hand the user one message for
two different problems.

### 2. Wire / Communication Protocol

| Channel / Endpoint | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `pack:list` | Settings surface to application | Request / response | none | Both groups, each entry carrying identity, provenance, declared capabilities, state, and preview reference | none — a library that cannot be read is an empty library plus a reported failure, never a missing surface |
| `pack:import` | Settings surface to application | Request / response | Supplied asset, authored persona | `{ packId }` or `ImportRefusal` naming which condition failed | `MANIFEST_SCHEMA_UNSUPPORTED`, `ASSET_CONTRACT_UNSATISFIED`, `ASSET_OVER_SIZE_CEILING`, `ASSET_UNREADABLE`, `PERSONA_MISSING` — nothing is written until every check passes, so a refusal leaves no partial pack |
| `pack:activate` | Settings surface to application | Request / response | Pack identity | `ResolvedPack` or `ActivationRefusal` | On refusal the previously active pack stays on screen; at startup the shipped default pack is presented instead |
| `pack:delete` | Settings surface to application | Request / response | Pack identity | `{ deleted: true, nowActive: string }` | A built-in template is refused. Deleting the active pack activates a built-in template in the same operation, so `nowActive` is always populated |
| `GET /pet-packs/catalogue` | Client to backend | Request / response | Session | The templates the product currently supplies, each with identity, declared capabilities and targeted contract major | Unreachable catalogue leaves the device's existing templates usable and is reported as a refresh failure, never as an empty catalogue |

The replication of an account pack is not a channel of this contract. It travels as records of the `pet-pack`
store through `sync/contracts/replication-protocol@0.1.0`, under the descriptor listed above — which is the
point of registering a descriptor rather than defining a transfer here.

### 3. Module Descriptor / Manifest Specification

The manifest is the module descriptor, and its normative shape is
[`pet-pack-manifest.schema.json`](./pet-pack-manifest.schema.json). It is not restated here. Three properties
of it are stated here because the file cannot carry them:

- **Discovery** is by enumerating two storage locations — the read-only templates shipped with the product, and
  the account packs under the application data path — and reading the manifest in each. A directory without a
  readable manifest is not a pack. It is absent from the library rather than partly available, which is what
  makes an asset dropped in by hand invisible instead of half-working.
- **The asset path is a single file name with no separators.** This is the one field through which an authored
  document could otherwise name something outside the directory it owns, and constraining the shape is how that
  is closed rather than by checking the resolved path later.
- **A manifest whose major schema revision the device does not implement is refused whole**, never read
  partially, because a partly understood manifest could silently drop a declaration that mattered — a capability
  claim, or a size.

## Semantics

- **Pack identity is stable across edits.** Editing a pack advances `packVersion` and never `packId`. An edit
  that changed the identity would arrive on another device as a second pack rather than as a new version of the
  first, which is also why the conflict rule can preserve a losing edit: the two rows share an identity and
  differ only by version.
- **Provenance is immutable.** Deriving from a template produces a new pack with a new identity and
  `derivedFrom` recorded. `derivedFrom` confers no update relationship: a release that updates the template
  leaves the derived pack untouched.
- **A declaration is a claim; the asset is the authority.** A capability declared but absent from the asset is
  treated as absent, and the shipped default pack supplies it for that capability alone.
- **Substitution is one step and terminates at the shipped default pack.** It never chains through another
  custom pack, because a rendered result that depended on library order would be unpredictable to the user.
- **Persona text is advisory.** It shapes voice. It reaches no position from which the approval gate or tool
  selection reads, and the reason is structural rather than filtering: the gate runs in the application layer
  where no prompt content reaches it, per `docs/spec/constitution.md` principle II.
- **A pack is presented by activation, not by the state of a file.** Replacing an asset on disk under a loaded
  pack changes nothing until an activation occurs.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `MANIFEST_SCHEMA_UNSUPPORTED` | The manifest's major schema revision is not implemented by this build | Application | The pack is absent from the library and the file is left on disk, so the user can see what was rejected |
| `ASSET_CONTRACT_UNSATISFIED` | The supplied asset does not satisfy `pet/contracts/rive-state-machine` | Application, at import | No pack is created; the reason names which part of the contract failed |
| `ASSET_OVER_SIZE_CEILING` | The supplied asset exceeds 5 MB | Application, at import | No pack is created; both the asset's size and the ceiling are stated, so the user knows by how much |
| `ASSET_UNREADABLE` | The supplied file cannot be read as an animation asset at all | Application, at import | No pack is created; reported as unreadable rather than as non-conforming, because the remedies differ |
| `PERSONA_MISSING` | The manifest declares no persona | Application, at import | No pack is created; a pack that cannot speak is not a pet |
| `ASSET_NOT_PRESENT` | The manifest names an asset that is not in the pack | Application, at activation | Activation refused naming the missing asset; the previously active pack stays on screen |
| `DIGEST_MISMATCH` | The asset's bytes do not match the declared digest | Application, at arrival or at load | The pack is marked `damaged` in the library rather than repaired or deleted |
| `TEMPLATE_NOT_DELETABLE` | Deletion attempted on a built-in template | Application | The template is not deleted; it belongs to the product rather than to the account |

## Compatibility

- **MAJOR**: removing a required field; changing the meaning of `packId`, `provenance` or `targetContractMajor`;
  adding a required field, since every existing manifest would then be invalid.
- **MINOR**: adding an optional field; adding a value to `declaredCapabilities` alongside a MINOR revision of
  `pet/contracts/rive-state-machine` that adds the corresponding optional layer. A pack that does not declare
  the new capability degrades by the substitution rule already specified, so a MINOR revision never invalidates
  an existing pack.
- **PATCH**: tightening a description; adjusting a bound that no existing manifest violates.

The reserved distribution channel is a MINOR change to this contract when it arrives, not a MAJOR one. The
fields it needs — `author`, `packVersion`, and the asset digest — are already present, which is why they exist
now rather than being added then.

## Examples

### Valid Example: an account pack implementing both layers

```json
{
  "manifestVersion": "1.0.0",
  "packId": "desk-cat-charcoal",
  "packVersion": "1.2.0",
  "displayName": "Desk cat, charcoal",
  "provenance": "account-pack",
  "targetContractMajor": 2,
  "declaredCapabilities": ["work-status", "locomotion"],
  "asset": {
    "path": "pet.riv",
    "sizeBytes": 742118,
    "digest": "sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
  },
  "persona": {
    "name": "Mun",
    "languages": ["vi", "en"],
    "fallbackLanguage": "vi",
    "talkativeness": "terse",
    "characterDescription": "A cat who has worked in offices a long time and is unimpressed by most of it. Answers briefly, never explains twice, and treats an interruption as something to be justified.",
    "acknowledgementLines": {
      "vi": ["Nhận rồi.", "Để đấy."],
      "en": ["Got it.", "Noted."]
    }
  },
  "author": "vuongdhq",
  "derivedFrom": "desk-cat"
}
```

*Effect*: the pack is listed under the account's own packs, activates with both layers bound from its own
asset, and replicates whole to every signed-in device.

### Valid Example: a pack declaring work status only

```json
{
  "manifestVersion": "1.0.0",
  "packId": "paper-bird",
  "packVersion": "1.0.0",
  "displayName": "Paper bird",
  "provenance": "account-pack",
  "targetContractMajor": 2,
  "declaredCapabilities": ["work-status"],
  "asset": {
    "path": "pet.riv",
    "sizeBytes": 210044,
    "digest": "sha256:fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9"
  },
  "persona": {
    "name": "Giấy",
    "languages": ["vi"],
    "fallbackLanguage": "vi",
    "talkativeness": "moderate",
    "acknowledgementLines": { "vi": ["Đã nhận."] }
  }
}
```

*Effect*: the pack activates, its character is shown, and its movement uses the shipped default pack's
locomotion. The library states this before the user activates it, so the substitution is a disclosed property
rather than a surprise.

### Rejected Example: an asset path that leaves the pack directory

```json
{
  "asset": { "path": "../../pet.riv", "sizeBytes": 100, "digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000" }
}
```

*Rationale*: the asset path is constrained to a single file name with no separators. A manifest is authored
content, and this is the one field through which it could otherwise name a file it does not own. The document
is refused at validation, before any path is resolved.

### Rejected Example: an oversize asset

```json
{
  "asset": { "path": "pet.riv", "sizeBytes": 9437184, "digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }
}
```

*Rationale*: 9 MB exceeds the 5 MB ceiling. The refusal happens at import, where the user is present and can act
on it, rather than at replication, where they are not and where a pack would appear to have been created and
then silently fail to arrive elsewhere.

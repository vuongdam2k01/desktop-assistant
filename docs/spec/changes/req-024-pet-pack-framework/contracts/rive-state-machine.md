---
contract: rive-state-machine
version: 2.0.0
status: draft
owner: pet
consumers: [app, agent, platform]
schema_files: [rive-state-machine.schema.json, rive-state-machine.set-state.schema.json]
---

# Contract: rive-state-machine

## Purpose

Defines the boundary between a pet pack's animation asset and the runtime that drives it: the artboard the
runtime loads, the state machine it runs, the layered inputs it writes, and the channels the application uses to
write them. It is the interface a designer authors against, and from `2.0.0` onward it is authored against by
people outside the product team, which is why this revision exists.

`1.0.0` declared a single numeric input. `req-018-pet-liveness` then specified — and measured at 60 frames per
second with no stutter — a pet whose movement and work status animate on independent layers. The declared
interface was never updated to match, so the living specification required of an asset something the contract
did not describe. Any asset authored against `1.0.0` satisfied the contract and failed the specification. This
revision closes that gap, which is the MAJOR trigger this contract's own versioning policy names.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`rive-state-machine.schema.json`](./rive-state-machine.schema.json) | JSON Schema 2020-12 | normative — the descriptor an animation asset must satisfy |
| [`rive-state-machine.set-state.schema.json`](./rive-state-machine.set-state.schema.json) | JSON Schema 2020-12 | normative — the payload carried on `pet:setState` |

The two files hold the shapes; what they cannot express is stated here, because each is a property of the binary
asset rather than of a document. Whether the artboard, the state machine and the layer inputs the descriptor
names are actually present in the file is answered by reading the file's own headers, and their absence is what
produces the load-time refusals below rather than a schema failure. Whether a transition between two states is
visually continuous is judged by watching it. And an asset that satisfies both files may still be a corrupt
buffer, which is why an unreadable asset falls back to the shipped default pack rather than leaving the pet
absent.

## Schema / Surface

### 1. Interface & Data Types

The normative shapes are the two files above. The declarations below name the same members for a reader and add
what the files do not describe.

```typescript
export enum PetWorkStatus {
  IDLE = 0,
  RECEIVING_ORDER = 1,
  WORKING = 2,
  WAITING_APPROVAL = 3,
  HAS_RESULT = 4
}

export enum PetLocomotion {
  STANDING = 0,
  WALKING = 1,
  DRAGGED = 2,
  FALLING = 3
}

// The capabilities a pack declares in its manifest. Each names one layer of this contract.
export type PetAnimationCapability = 'work-status' | 'locomotion';
```

The two enumerations are independent. Neither constrains the other, and no combination is invalid: a pet may
hold a result while falling, because both facts are true at once and the user is entitled to see both.

### 2. Wire / Communication Protocol

| Channel | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `pet:setState` | Application to renderer | Event | `SetPetStatePayload` — at least one layer, either layer optional | none | A layer carrying a value outside its declared set is dropped for that layer only; the other layer still applies, and the dropped layer holds its current value |
| `pet:activatePack` | Application to renderer | Request / response | Pack identity, asset buffer, and the capability set resolved for it | `{ activated: boolean, reason?: ActivationRefusal }` | `INCOMPATIBLE_REVISION`, `ARTBOARD_NOT_FOUND`, `STATE_MACHINE_NOT_FOUND`, `INVALID_ASSET_BUFFER`, `BLEND_DURATION_OUT_OF_RANGE` |
| `pet:packState` | Renderer to application | Request / response | none | Active pack identity, the capabilities actually bound, and the current value of each layer | none |

`pet:activatePack` replaces the `pet:loadSkin` channel of `1.0.0`. The rename is not cosmetic: the old channel
carried a buffer and an identifier, and the new one additionally carries the resolved capability set, because
the renderer must know which layers to bind from this asset and which to bind from the shipped default. That
information did not exist at `1.0.0`, when an asset was taken whole or not at all.

### 3. Module Descriptor / Manifest Specification

The descriptor an asset must satisfy is [`rive-state-machine.schema.json`](./rive-state-machine.schema.json)
and is not restated here. It is checked against the metadata read from the asset's own artboard headers, so a
satisfied descriptor still says nothing about whether the named artboard exists in the binary — that is answered
at load, by reading it.

Which pack an asset belongs to, who authored it, and what it claims to implement are not this contract's
business. They belong to [`pet/contracts/pet-pack-manifest`](./pet-pack-manifest.md), which describes the pack;
this contract describes only the asset inside it.

## Semantics

- **Artboard `Pet`** — the root artboard containing the character meshes, skeletons and animation hierarchy.
- **State machine `PetStateMachine`** — the single state machine the runtime loads and executes.
- **Input `workStatus`** — the layer reporting what the system is doing. Values 0 to 4, numbered as in `1.0.0`.
- **Input `locomotion`** — the layer reporting how the pet is moving. Values 0 to 3. Optional in an asset: an
  asset omitting it is valid, and a pack containing such an asset borrows the shipped default pack's locomotion.
- **Layer independence** — writing one layer never resets or interrupts the other. This is the property
  `req-018-pet-liveness` measured, and an asset that couples the two satisfies the descriptor while failing the
  specification, which is a case for the acceptance plan rather than for schema validation.
- **Playing an animation by name is forbidden**, because it bypasses the blend curves the asset declares.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `INCOMPATIBLE_REVISION` | The pack's manifest declares a contract major revision this build does not implement | Application, before the buffer is read | Activation refused, stating that the pack needs a different version of the product. Reported distinctly from damage, because the remedy is to update rather than to re-author |
| `ARTBOARD_NOT_FOUND` | The asset lacks the artboard `Pet` | Renderer | Activation refused; the previously active pack stays on screen, or the shipped default pack is presented at startup |
| `STATE_MACHINE_NOT_FOUND` | The asset lacks the state machine `PetStateMachine` | Renderer | As above |
| `INVALID_ASSET_BUFFER` | The buffer is corrupt, truncated, or does not match the digest its manifest declares | Renderer | As above; the pack is marked damaged in the library rather than deleted |
| `BLEND_DURATION_OUT_OF_RANGE` | A declared blend duration falls outside 150 to 250 ms | Renderer | Activation refused, because the character reads either as snapping or as unresponsive |
| `LAYER_NOT_PRESENT` | The manifest declares a layer the asset does not contain | Renderer | Not a refusal. The layer is treated as absent and the shipped default pack's behaviour is bound for it alone, per the model's INV-PACK-06 |
| `INVALID_STATE_VALUE` | A value outside a layer's declared set arrives on `pet:setState` | Renderer | The value is dropped for that layer; the other layer still applies and the dropped layer holds its current value |

## Compatibility

- **MAJOR**: renaming the artboard or the state machine; renaming or removing a layer input; changing which
  number means which state in either enumeration; making an optional layer required.
- **MINOR**: adding a further optional layer, or adding optional triggers, while every existing input keeps its
  name and numbering. A pack that does not declare the new layer degrades by the substitution rule already
  specified, so a MINOR revision never invalidates an existing pack.
- **PATCH**: adjusting blend curves, vertex weights or timings inside an asset; clarifying wording here.

## Examples

### Valid Example: both layers change independently

```json
{ "workStatus": 2, "locomotion": 1 }
```

*Effect*: the pet shows the working animation while continuing to walk. The two blend on their own layers;
neither transition restarts the other.

### Valid Example: movement alone

```json
{ "locomotion": 3 }
```

*Effect*: the pet falls. Whatever work status it held is unchanged, which is the point of carrying the layers
separately — the locomotion engine does not know or restate what the system is doing.

### Rejected Example: a payload naming neither layer

```json
{}
```

*Rationale*: the payload must carry at least one layer. An empty payload is dropped rather than interpreted as a
reset, because resetting is a state change and a state change must be stated.

### Rejected Example: an out-of-range locomotion value

```json
{ "workStatus": 0, "locomotion": 9 }
```

*Rationale*: 9 is not a declared locomotion state. The locomotion value is dropped and the pet holds its current
locomotion; `workStatus` still applies and becomes 0. A partly valid payload is partly applied, because
discarding the whole payload would lose a state change that was correctly stated.

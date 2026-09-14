---
contract: rive-state-machine
version: 1.0.0
status: draft
owner: pet
consumers: [gui, agent]
schema_files: [rive-state-machine.schema.json, rive-state-machine.set-state.schema.json]
---

# Contract: rive-state-machine

## Purpose
Defines the boundary between visual design assets (`.riv`) and runtime application code, establishing required artboard names, state machine identifiers, numeric state inputs, and IPC control channels for the animated pet.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`rive-state-machine.schema.json`](./rive-state-machine.schema.json) | JSON Schema 2020-12 | normative — the descriptor an asset must satisfy |
| [`rive-state-machine.set-state.schema.json`](./rive-state-machine.set-state.schema.json) | JSON Schema 2020-12 | normative — the payload carried on `pet:setState` |

The two files hold the shapes; what they cannot express is stated here instead, because each is a property of
the binary asset rather than of a document. Whether the artboard and state machine the descriptor names are
actually present in a `.riv` file is answered by reading the file's own headers, and their absence is what
produces `ARTBOARD_NOT_FOUND` and `STATE_MACHINE_NOT_FOUND` at load rather than a schema failure. Whether a
transition between two states is visually continuous is judged by watching it. And a skin that satisfies both
files may still be a corrupt buffer, which is why an unreadable asset falls back to the shipped default rather
than leaving the pet absent.

## Schema / Surface

### 1. Interface & Data Types

The normative shapes are [`rive-state-machine.schema.json`](./rive-state-machine.schema.json) and
[`rive-state-machine.set-state.schema.json`](./rive-state-machine.set-state.schema.json). The declarations
below name the same members for a reader and add the runtime types the two files do not describe.

```typescript
export enum PetStateEnum {
  IDLE = 0,
  RECEIVING_ORDER = 1,
  WORKING = 2,
  WAITING_APPROVAL = 3,
  HAS_RESULT = 4
}

export interface PetAssetDescriptor {
  artboardName: 'Pet';
  stateMachineName: 'PetStateMachine';
  inputs: {
    state: {
      type: 'Number';
      name: 'state';
      values: PetStateEnum;
      default: PetStateEnum.IDLE;
    };
  };
  transitionBlendDurationMs: number; // 150 to 250 ms
}

export interface SetPetStatePayload {
  state: PetStateEnum;
}

export interface LoadSkinPayload {
  skinId: string;
  buffer: Uint8Array;
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `pet:setState` | Main -> Renderer | Event / Pub-Sub | `SetPetStatePayload` | `void` | Ignored if state invalid |
| `pet:loadSkin` | Main -> Renderer | Request-Response | `LoadSkinPayload` | `{ success: boolean, error?: string }` | `INVALID_RIV_BUFFER`, `ARTBOARD_NOT_FOUND` |
| `pet:getState` | Renderer -> Main | Request-Response | `void` | `{ currentState: PetStateEnum }` | None |

### 3. Module Descriptor / Manifest Specification
The asset descriptor is [`rive-state-machine.schema.json`](./rive-state-machine.schema.json) and is not
restated here. It is checked against the metadata read from the `.riv` file's own artboard headers, so a
descriptor that is satisfied still says nothing about whether the named artboard exists in the binary — that is
answered at load, by reading it.

## Semantics
- Artboard `Pet`: The root artboard of the `.riv` file containing the character meshes, skeletons, and animation hierarchy.
- State Machine `PetStateMachine`: The single state machine loaded and executed by the canvas runtime.
- Input `state`: Numeric state controller. Assigning integer values 0–4 triggers corresponding transitions using blend curves configured in the asset (150–250ms). Direct animation name playback is forbidden.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `INVALID_RIV_BUFFER` | Binary `.riv` buffer is corrupted or truncated | Callee (Renderer) | Reverts to bundled default pet skin; logs diagnostic warning |
| `ARTBOARD_NOT_FOUND` | `.riv` asset lacks artboard named 'Pet' | Callee (Renderer) | Falls back to default asset; pet remains visible |
| `STATE_MACHINE_NOT_FOUND` | `.riv` asset lacks state machine 'PetStateMachine' | Callee (Renderer) | Falls back to default asset; pet remains visible |
| `INVALID_STATE_VALUE` | State number outside 0–4 passed via IPC | Caller (Main) | Drops invalid event; maintains current state |

## Compatibility
- MAJOR: Renaming required Artboard `Pet`, State Machine `PetStateMachine`, or changing numeric enum mappings.
- MINOR: Adding new optional input triggers (e.g. `look_left`, `blink`) while preserving 0–4 state mapping.
- PATCH: Tweaking internal transition blend times or fixing rendering glitches in `.riv` asset.

## Examples

### Valid Example: IPC State Dispatch
```json
{
  "state": 2
}
```
*Effect*: Pet transitions smoothly from current state to `WORKING` animation within 15.1ms.

### Rejected Example: Out-of-Range State Value
```json
{
  "state": 99
}
```
*Rationale*: State value 99 is not declared in `PetStateEnum` (0-4); rejected with `INVALID_STATE_VALUE`.

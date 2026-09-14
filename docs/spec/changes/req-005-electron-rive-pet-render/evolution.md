# Evolution: pet

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `rive-state-machine@1.0.0` | Changing the required Artboard name (`Pet`), StateMachine name (`PetStateMachine`), or mutating existing state enum integers 0..4 | Adding optional inputs or triggers to the state machine while retaining 0..4 compatibility | Visual adjustments in animation curves, vertex weights, or blend timings |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| Initial draft | `rive-state-machine@1.0.0` | Yes | N/A | First frozen baseline of the designer/developer contract |

## Deprecation

Direct animation playback by string name is deprecated and forbidden in this baseline. If any legacy code relies on `animations: ['idle']`, it must migrate to `stateMachine: 'PetStateMachine'` with numeric input `state: 0`.

## Extension Procedure

To author a new character skin:
1. In Rive Editor (Cadet plan or higher), create an artboard strictly named `Pet`.
2. Create a State Machine strictly named `PetStateMachine`.
3. Add a `Number` input named `state`.
4. Configure state transitions: 0 = Idle, 1 = Receiving Order, 2 = Working, 3 = Waiting Approval, 4 = Has Result. Set transition blend durations between 150ms and 250ms.
5. Export the `.riv` file and place it in `resources/assets/` or `userData/assets/skins/<skin-name>/pet.riv`.
6. Run the SP-3 verification suite to assert >= 30 fps and clean transparency.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| 3D Polygon Rendering Escape Hatch | Phase 3 (Post-MVP) | Upgrade pet character to Spline 3D or Three.js/WebGPU surface | User demand for fully interactive 3D physics pet; transparent window architecture preserved per ADR-002 |
| Screen Roaming Locomotion | Phase 2 | Pet moves across taskbar or edges of multiple monitors | Implementation of desktop obstacle detection in window manager |

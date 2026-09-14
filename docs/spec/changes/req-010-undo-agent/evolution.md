# Evolution: undo

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `undo-pipeline@1.0.0` | Incompatible changes to `UndoPreviewResponse` groupings or removal of IPC channels | Adding optional properties to `PreviewItem` or non-breaking filter arguments | Internal optimizations in property diffing algorithms |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| Initial draft | `undo-pipeline@1.0.0` | Yes | Existing ledger jobs with `undo_of = null` continue to operate as regular forward jobs | No schema breaking migration required |

## Deprecation

When deprecating any IPC channel in `undo-pipeline`, the channel must remain supported for a minimum of 2 minor releases, logging deprecation warnings to the local diagnostic log before removal.

## Extension Procedure

To enable undo capabilities for a new connector:
1. In the connector's manifest (`connector-manifest@1.0.0`), ensure every write tool specifies `is_reversible: boolean`.
2. For tools where `is_reversible: true`, implement a corresponding snapshot getter and a compensating tool or parameter mapping.
3. Ensure the connector adapter provides read queries that return full property payloads to allow property diffing.
4. Run the SP-9 verification test harness against the new connector tools to verify FN = 0 conflict detection.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Interactive 3-Way Merge | Phase 2 (Post-MVP) | Allow user to manually reconcile property conflicts instead of rejecting them outright | User demand for advanced collaborative editing conflict resolution |
| Selective Partial Step Undo | Phase 2 (Post-MVP) | Allow user to select a subset of reversible steps rather than reversing the entire dependent chain | Verification of dependency graph safety under partial selection |

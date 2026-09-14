# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | Four-phase undo pipeline (inversion, probe, preview, execute); 100% reversible/irreversible/conflict classification verified in SP-9. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | SQLite Ledger action records, `undo_of` link in job table, preview schema with 3 item categories. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Clear | Undo button in job card; preview modal displaying reversible, irreversible, and conflict groups; disabled state when reversible count is 0. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | Zero false-negative safety gate (no blind overwrites); false-positive = 0; audited ledger trail for every undo run. |
| Integration & external dependencies (external services, formats, versions) | Clear | Notion REST API, connector manifest `is_reversible` flag, property payload diff checking. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Object deleted/archived externally, third-party edits within the same minute, repeated object mutation within one job. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Rejected blind replay without probe (Option B) due to safety violations; rejected timestamp-only diff due to minute-rounding. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | Inversion Plan, Conflict Probe, Three-Way Preview, Compensating Action, Recursive Undo. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | 10/10 inversion accuracy, FN=0 conflict safety, 3-group preview fidelity, recursive undo execution. |
| Placeholders (TODOs, unquantified adjectives) | Clear | No placeholders; all numbers and behaviors rooted in SP-9 empirical report. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | Stored in SQLite ledger (`desktop-assistant.db`), in-memory probe diffing, ephemeral preview cards. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Connector manifest tool schema includes `is_reversible: boolean` and optional `compensating_tool`. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | Runs as a dedicated Pi agent workflow executing standard connector tool calls. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | If live object state cannot be probed (offline or API 404/500), marked as conflict/unreachable; never blindly overwritten. |

## Sessions

### Session 2026-09-12
- Q: How does the undo pipeline guarantee zero false negatives when external platforms round `last_edited_time` to minute precision? → A: The conflict probe performs a two-tier comparison: first checking `last_edited_time`, and second performing a strict property-level payload diff against `snapshot_after.properties`. If properties differ even within the same minute, it is classified as a Conflict (patched: specs/undo/spec.md, design.md).
- Q: How does undo handle an object modified multiple times within the same job? → A: The conflict probe extracts the `snapshot_after` of the latest sequential record touching that object within the target job as the ground truth baseline. Intermediate snapshots are ignored during probe (patched: specs/undo/spec.md, model.md).
- Q: What occurs when a job contains zero reversible actions (e.g. comment creation only)? → A: The undo trigger is disabled per FR-UD-06, presenting explicit explanatory copy that all operations in the job are irreversible via API (patched: specs/undo/spec.md, design.md).
- Q: How is an undo operation recorded and can an undo itself be undone? → A: An undo executes as a full standard job with `undo_of = <target_job_id>`. It writes its own sequential action records to the ledger. An undo of an undo reads the undo job's ledger records and executes the forward compensation, supporting arbitrary recursive undos (patched: specs/undo/spec.md, model.md).

## Assumptions

- Connector write tools expose readable state or return full `snapshot_after` payloads upon execution to enable ground-truth diffing.
- Network or permission errors during live probing fail closed, classifying affected objects as conflicting/unreachable to prevent blind corruption.

## Open

None — all technical decisions verified by SP-9 empirical evidence.

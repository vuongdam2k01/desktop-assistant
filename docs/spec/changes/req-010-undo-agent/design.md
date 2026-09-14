## Context

`spikes/SP-9-undo-agent/REPORT.md` verified that compensating actions can be reliably synthesized from the SQLite ledger and safely executed against real platforms. However, external state evolves concurrently, and platforms like Notion round timestamps to minute precision, making naive timestamp comparison vulnerable to blind overwrites.

## Goals / Non-Goals

**Goals:**
- Synthesize reverse-order compensating action plans with 100% topological accuracy.
- Achieve False-Negative = 0 in conflict detection through property payload diffing.
- Provide a clear tripartite preview (Reversible, Irreversible, Conflict) before executing state changes.
- Execute undo as a standalone auditable job with `undo_of` linkage, supporting recursive undo.
- Disable undo when a job contains 100% irreversible actions.

**Non-Goals:**
- Automatic 3-way conflict merging or heuristic overwriting of conflicted records (conflicted records are kept read-only).
- Reverting operations outside the managed ledger scope.

## Structure

The undo architecture consists of four primary components:
1. **Inversion Planner**: Reads historical `action_records` from SQLite ledger and builds candidate reverse compensation steps.
2. **Conflict Prober**: Queries live platform state for each modified target and evaluates differences against `snapshot_after.properties`.
3. **Preview Generator**: Partitions steps into Reversible, Irreversible, and Conflict, packaging them for renderer presentation.
4. **Undo Executor**: Submits an approved plan as a new job into `JobRunner` with `undo_of = <target_job_id>`.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `undo:generatePreview` | Renderer -> Main | Request-Response | `{ jobId: string }` | `UndoPreviewResponse` | Queries live platform API via connector | 10s timeout; on error marks unreachable items as Conflict |
| `undo:execute` | Renderer -> Main | Request-Response | `ExecuteUndoRequest` | `ExecuteUndoResponse` | Inserts new job record and starts execution | Validates reversible action non-empty; returns error if invalid |

### Execution Boundaries & Isolation

- **Renderer Process (UI)**: Renders the preview modal, displaying three distinct sections for Reversible, Irreversible, and Conflict items.
- **Node.js Main Process**: Hosts the Inversion Planner, Conflict Prober, and Undo Executor. Probing runs concurrently across unique target objects using connector read adapters.
- **SQLite Ledger**: Single persistent store (`desktop-assistant.db`) managing original actions and appending new compensating records under the undo job ID.

### Trust Boundaries & Input Validation

- External platform query responses during live probing are treated as untrusted data. Schema validation and property presence checks are applied before diffing.
- If live queries return HTTP 404, 403, 5xx, or invalid payloads, the target object is marked as `CONFLICT` or `UNREACHABLE`. The system never assumes unverified state is safe.

## Decisions

### D1 — Four-Phase Pipeline (Inversion, Probe, Preview, Execute)
- **Choice**: Separate plan synthesis, live probing, preview presentation, and execution into 4 distinct phases.
- **Rationale**: Probing before presentation prevents blind overwrites; user preview ensures full human awareness before mutations occur.
- **Alternatives Considered**: Direct blind compensation replay (Option B in proposal) was rejected because it violates Constitution Principle IV and causes severe silent data corruption.

### D2 — Property Payload Diffing Over Timestamp-Only Comparison
- **Choice**: Evaluate live object state by comparing discrete property payload fields against `snapshot_after.properties`, using timestamp comparison only as secondary metadata.
- **Rationale**: Notion API rounds `last_edited_time` to minute precision (`:00.000Z`). Third-party edits occurring in the same minute do not alter timestamps, causing dangerous false negatives (zero detection of external edits).
- **Alternatives Considered**: Timestamp comparison alone was rejected because SP-9 proved it yields unacceptable false-negative risk.

### D3 — Latest Sequential Record as Multi-Touch Baseline
- **Choice**: When an object is modified multiple times in one job, conflict detection uses the `snapshot_after` of the latest sequential record touching that object.
- **Rationale**: Comparing against earlier intermediate snapshots would mistake the job's own subsequent updates for external third-party modifications.
- **Alternatives Considered**: Comparing against the initial `snapshot_before` was rejected because it flag the job's own valid changes as conflicts.

### D4 — Execution via Standard Job Lineage with `undo_of`
- **Choice**: Undo runs as a normal job with `undo_of = target_job_id`, writing its own action records to the ledger.
- **Rationale**: Guarantees complete auditability and enables arbitrary recursive undo of undo without custom branching logic.
- **Alternatives Considered**: Rolling back database records in-place was rejected because ledger is append-only per Constitution Principle III.

### D5 — Disabled State for 100% Irreversible Jobs
- **Choice**: If a job contains zero reversible items (e.g. comment creation only), the undo button is disabled with explanatory copy.
- **Rationale**: Prevents confusion and avoids generating empty execution runs.
- **Alternatives Considered**: Allowing the user to press undo and showing an empty preview was rejected as poor UX.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration
- Connectors declare `is_reversible: boolean` and provide read tools in their manifest (`connector-manifest@1.0.0`).
- The conflict prober uses connector read tools dynamically without platform-specific code in the core engine.

### 2. Multi-Level Fallback Hierarchy
- **Tier 1 (Specific ➔ General)**: Property-level diff failure falls back to entity-level state comparison.
- **Tier 2 (Custom ➔ Built-in Default)**: If platform read tool fails or is unavailable, the object is marked as `UNREACHABLE / CONFLICT`.
- **Tier 3 (Degraded Safe-Mode)**: If network is offline during undo generation, the preview is blocked or presented with all external items flagged as unverified; blind execution is strictly prohibited.

## Complexity Tracking

None — fully adheres to Constitution Principles III, IV, and VI.

## Research

### R1 — Scalability of Live Probing for Large Jobs
- **Decision**: Concurrently probe unique target objects with bounded concurrency (concurrency limit = 5).
- **Rationale**: Most jobs touch fewer than 10 objects; SP-9 measured probe latency under 1.5s total.
- **Source / Verification Status**: Verified in `spikes/SP-9-undo-agent/REPORT.md`.

## Migration & Rollback

Not applicable — applies to new tables and columns in SQLite ledger schema managed by `req-013-sqlite-ledger`.

## Risks / Trade-offs

- [Risk: Platform API rate limits during probing] → Mitigation: Deduplicate probes by unique `target_id`; 1 HTTP request per distinct object touched.
- [Risk: Rapid third-party edits during preview interaction] → Mitigation: Pre-execution assertion verifies property hash immediately before dispatching write tool.

## Open Questions

None — all aspects validated by SP-9.

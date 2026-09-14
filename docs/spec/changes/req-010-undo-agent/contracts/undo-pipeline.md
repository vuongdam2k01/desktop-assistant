---
contract: undo-pipeline
version: 1.0.0
status: draft
owner: undo
consumers: [gui, agent]
schema_files: [undo-pipeline.schema.json, undo-pipeline.execute.schema.json]
---

# Contract: undo-pipeline

## Purpose
Defines the programmatic interface, IPC wire protocols, and preview data schemas for inferring, probing, previewing, and executing undo operations.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`undo-pipeline.schema.json`](./undo-pipeline.schema.json) | JSON Schema 2020-12 | normative |
| [`undo-pipeline.execute.schema.json`](./undo-pipeline.execute.schema.json) | JSON Schema 2020-12 | normative |

`undo-pipeline.schema.json` is the preview: the document the user decides against, and the only thing they see
before an undo runs. Two of its obligations are carried in the shape itself rather than left to whatever renders
it — a preview that disables undo must say why, and an item shown as irreversible or conflicted must carry its
reason — because a disabled control with no stated cause reads as a defect, and an item refused without a reason
gives the user nothing to judge.

`undo-pipeline.execute.schema.json` is deliberately the narrower of the two. It carries the job and the sequence
positions the user ticked, and nothing else: no compensating operation, no arguments, no ordering. Those are
derived again from the ledger when execution begins, so a window cannot request a compensating action the ledger
does not justify, and a preview left open while the world moved cannot replay a stale plan.

What neither file can hold: that the three counts agree with the items beside them; that a confirmed sequence
exists in the source job and was classified reversible; that compensation runs in reverse dependency order; and
that the live state still matches what the job left (INV-UD-01). Each is a relation between the payload and the
ledger or the platform, and each is stated under Semantics and judged under Contract Conformance in
`verification.md`.

## Schema / Surface

### 1. Interface & Data Types

The normative shapes are [`undo-pipeline.schema.json`](./undo-pipeline.schema.json) for the preview and
[`undo-pipeline.execute.schema.json`](./undo-pipeline.execute.schema.json) for the request that starts an undo.
The declarations below name the same members for a reader and add what the files do not carry: the service
surface itself, and the response an execution request returns.

```typescript
export interface UndoPreviewRequest {
  jobId: string;
}

export type ActionCategory = 'reversible' | 'irreversible' | 'conflict';

export interface PreviewItem {
  sequence: number;
  toolName: string;
  category: ActionCategory;
  description: string;
  targetId?: string;
  reason?: string;
  propertyDiff?: {
    field: string;
    expected: unknown;
    actual: unknown;
  }[];
}

export interface UndoPreviewResponse {
  jobId: string;
  canUndo: boolean;
  disabledReason?: string;
  items: PreviewItem[];
  reversibleCount: number;
  irreversibleCount: number;
  conflictCount: number;
}

export interface ExecuteUndoRequest {
  jobId: string;
  confirmedSequences: number[];
}

export interface ExecuteUndoResponse {
  undoJobId: string;
  status: 'started' | 'rejected';
  reason?: string;
}

export interface UndoPipelineService {
  generatePreview(req: UndoPreviewRequest): Promise<UndoPreviewResponse>;
  executeUndo(req: ExecuteUndoRequest): Promise<ExecuteUndoResponse>;
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `undo:generatePreview` | Renderer -> Main | Request-Response | `{ jobId: string }` | [`undo-pipeline.schema.json`](./undo-pipeline.schema.json) | `JOB_NOT_FOUND`, `PROBE_FAILED` |
| `undo:execute` | Renderer -> Main | Request-Response | [`undo-pipeline.execute.schema.json`](./undo-pipeline.execute.schema.json) | `ExecuteUndoResponse` | `CONCURRENT_UNDO_RUNNING`, `ZERO_REVERSIBLE_ACTIONS` |

Neither channel is a way to reach a connector. A window names a job and the positions its user ticked; what is
then executed is derived from the ledger inside the process that owns it, so nothing a window can send widens
what an undo may do.

### 3. Module Descriptor / Manifest Specification
Not applicable — manifest defined in `connector/contracts/connector-manifest@1.0.0`.

## Semantics
- `generatePreview`: Evaluates all action records for `jobId`, runs conflict probe on all modified targets, and partitions actions into 3 groups. If `reversibleCount === 0`, `canUndo` is false and `disabledReason` is set.
- `executeUndo`: Spawns a new job in the database with `undo_of = jobId`, and enqueues execution of the compensating steps for `confirmedSequences`.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `JOB_NOT_FOUND` | Provided `jobId` does not exist in ledger | Caller (Renderer) | Error toast: "Job not found in history" |
| `ZERO_REVERSIBLE_ACTIONS` | User attempted to execute undo on an irreversible job | Both | Dialog warning: "No reversible actions available" |
| `PROBE_FAILED` | Network or platform error during live probe | Both | Reversible items remain intact; unreachable items marked as Conflict |
| `CONCURRENT_UNDO_RUNNING` | An undo job for this target is already executing | Both | Toast: "An undo job is already in progress for this task" |

## Compatibility
- MAJOR: Changing `PreviewItem` categorization enum or signature of `generatePreview` / `executeUndo`.
- MINOR: Adding optional metadata fields to `PreviewItem` (e.g. platform icon or deep link).
- PATCH: Internal bug fixes in diff comparison logic.

## Examples

**Valid** — a three-way preview satisfying [`undo-pipeline.schema.json`](./undo-pipeline.schema.json): one item
that can be put back, one that cannot and says why.

```json
{
  "jobId": "job-8842",
  "canUndo": true,
  "reversibleCount": 1,
  "irreversibleCount": 1,
  "conflictCount": 0,
  "items": [
    {
      "sequence": 1,
      "toolName": "notion_update_page_properties",
      "category": "reversible",
      "description": "Revert status from 'Done' to 'In progress'",
      "targetId": "page-123"
    },
    {
      "sequence": 2,
      "toolName": "notion_create_comment",
      "category": "irreversible",
      "description": "Add comment to page-123",
      "reason": "Notion API does not support deleting or editing comments"
    }
  ]
}
```

**Rejected** — an execution request confirming sequence 2, the comment creation the preview above marked
irreversible.

```json
{
  "jobId": "job-8842",
  "confirmedSequences": [2]
}
```

*Rationale*: sequence 2 is irreversible (`notion_create_comment`), and the execution path refuses it. The schema
accepts this document and is right to: what makes the request wrong is not its shape but the classification the
ledger holds for that position, which no shape of the request itself can express. It is refused by reading the
source job, and the refusal is `ZERO_REVERSIBLE_ACTIONS` when no confirmed position is reversible.

> **Constitution notice**: this change supplies the evidence behind principle IV (Irreversibility Is Declared) and sets four binding conditions on the connector manifest contract.

## Why

Harvested from `spikes/SP-1-notion-compensation/REPORT.md`. The spike measured, per write operation, what Notion lets us snapshot beforehand and whether a static compensating action exists.

## Problem

Undo is promised as replay of compensating actions, but nobody had measured whether a real platform actually permits that per operation. A compensating action that silently fails, or that restores a page while leaving a mutated database schema behind, breaks the trust the ledger is supposed to carry.

- Core write operations (create task, update properties, archive/unarchive) achieve full property integrity on compensation — VERIFIED (`spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan`).
- Comment operations must be flagged `irreversible` unconditionally: Notion exposes no endpoint to delete or edit a comment — VERIFIED (`spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan`).
- Computed and read-only properties (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`) must be stripped from a compensation payload or the API returns HTTP 400 — VERIFIED (`spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan`).

## Cost of inaction

Undo would be built against an assumed platform rather than the measured one. Three of the four conditions fail loudly (HTTP 400) but the fourth does not: assigning a task sends an email notification that undo cannot recall, so a user who undoes a job still leaves a colleague notified.

## Options

### Option A — Encode all four conditions in the connector manifest contract
- **Sketch**: the manifest declares, per write tool, its snapshot method, its compensation formula or `irreversible` flag, its sanitization rule set, and any out-of-band side effect to surface in the undo preview.
- **Appetite**: medium (weeks).
- **Trade-offs**: one mechanism covers every future connector; the manifest schema grows and every connector author must fill it honestly.
- **Rabbit holes**: attempting to model every Notion property type before the first connector ships.

### Option B — Minimum viable slice: hard-code Notion's four conditions
- **Sketch**: the Notion adapter handles sanitization and irreversibility internally; the manifest stays thin.
- **Appetite**: small (days).
- **Trade-offs**: fastest path to a working Notion undo; violates principle VI the moment a second connector needs the same rules.
- **Rabbit holes**: the second connector arrives and the logic is copied rather than shared.

## Recommendation

Option A. SP-19 later proved the manifest-driven route empirically, and these four conditions are exactly the fields it needs.

## What Changes

- **BREAKING** for any prior assumption that reorder is universally supported: reordering requires a `number`-typed order column in the database schema; without one, free reordering is flagged `unsupported/irreversible` — VERIFIED (`spikes/SP-1-notion-compensation/REPORT.md#0-ket-luan`).
- Rate-limit handling is specified concretely: queue at a 2.5 req/s ceiling under Notion's 3 req/s limit, and back off on the `Retry-After` header, since Notion sends no `X-RateLimit-*` headers on a 200 response — VERIFIED (`spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd`).
- Undo conflict detection gains a concrete rule: a page in Trash returns HTTP 200 with `archived=true` and can be unarchived; HTTP 404 means permanently deleted or access lost, and is flagged CONFLICT — VERIFIED (`spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd`).

## Capabilities

REQUIRES spec-impact — modifies the connector manifest contract and the undo snapshot model.

### New Capabilities
- `connector`: Notion write-operation compensation matrix, sanitization rules, rate-limit queue policy.

### Modified Capabilities
- `undo`: conflict classification by HTTP status; out-of-band side effects surfaced in the undo preview.

## Impact

Connector manifest schema, snapshot storage in the ledger, undo preview presentation. The spike hands over a compensation matrix as the reference document for manifest schema design, plus the snapshot sanitization mapping, the order-column detection rule and the backoff policy — VERIFIED (`spikes/SP-1-notion-compensation/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle IV (Irreversibility Is Declared) — this change is its evidentiary basis. Principle VI (Connectors Are Data) — Option A is chosen specifically to keep these rules in the manifest rather than in core. No violation.

## Assumptions

- Notion's 3 req/s limit is treated as a platform constant rather than a per-workspace variable; the spike did not vary workspace tier.

> **Constitution notice**: this change is the evidentiary basis for principle IV (Irreversibility Is Declared) and for the undo half of the trust chain.

## Why

Harvested from `spikes/SP-9-undo-agent/REPORT.md`. The spike verified that a compensating-action sequence can be inferred from the ledger and executed safely against real platform state.

## Problem

Undo runs against a world that has moved on. Someone else may have edited the same page since; the object may be gone; the job may have touched the same object several times. Restoring a stale snapshot blindly destroys work that was never ours to revert.

- Reverse-order inference was correct in 10/10 sample jobs against real Notion — VERIFIED (`spikes/SP-9-undo-agent/REPORT.md#0-ket-luan`).
- Preview classification into reversible, irreversible and conflict was correct in 100% of cases — VERIFIED (`spikes/SP-9-undo-agent/REPORT.md#0-ket-luan`).
- Conflict detection achieved zero false negatives and zero false positives, which is the safety criterion that blocks blind overwrite — VERIFIED (`spikes/SP-9-undo-agent/REPORT.md#0-ket-luan`).

## Cost of inaction

The naive conflict check — compare timestamps — silently fails on this platform, because the API rounds its last-edited time to the minute. A third-party edit inside the same minute would be invisible, and undo would overwrite it.

## Options

### Option A — Four-phase undo with property-level conflict probing
- **Sketch**: infer the reverse plan from the ledger, probe live state per object, present a three-way preview, then execute as a new job with its own ledger.
- **Appetite**: large (months).
- **Trade-offs**: achieves the zero-false-negative safety criterion and makes undo auditable as a job in its own right; four phases is more machinery than a simple replay.
- **Rabbit holes**: attempting automatic conflict resolution instead of showing the user what cannot be restored.

### Option B — Minimum viable slice: replay compensations without probing
- **Sketch**: run the recorded compensating actions in reverse order and report failures as they occur.
- **Appetite**: medium (weeks).
- **Trade-offs**: much simpler; loses the safety criterion entirely, since a conflict is discovered only after the overwrite.
- **Rabbit holes**: none — it fails the requirement it exists to meet.

## Recommendation

Option A. The zero-false-negative result is the product's central trust claim, and it is measurable only with the probe phase in place.

## What Changes

- Conflict matching must compare property payloads, not timestamps, because the platform rounds its last-edited time to the minute — VERIFIED (`spikes/SP-9-undo-agent/REPORT.md#2-tac-dong-len-adr-prd`).
- When an object is touched several times within one job, the conflict baseline is the after-snapshot of the last record touching that object, so the job's own intermediate steps are not mistaken for third-party edits — VERIFIED (`spikes/SP-9-undo-agent/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Undo runs as a new job referencing the original, writing its own ledger; undo of an undo works through the same mechanism — VERIFIED (`spikes/SP-9-undo-agent/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- A reversibility flag in the connector manifest lets the undo agent classify each step without guessing; a job with zero reversible steps disables the undo control — VERIFIED (`spikes/SP-9-undo-agent/REPORT.md#2-tac-dong-len-adr-prd`).

## Capabilities

REQUIRES spec-impact — modifies persistent ledger reads, the manifest contract and job lifecycle.

### New Capabilities
- `undo`: four-phase undo pipeline, conflict classification, preview model, recursive undo.

### Modified Capabilities
- `connector`: manifest declares a reversibility flag per write tool.
- `ledger`: snapshot-after semantics for repeated writes to one object.

## Impact

Ledger query patterns, connector manifest schema, undo preview presentation, and job records that reference another job.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle IV — replay of compensating actions against current state, reconciled and reported, is exactly what this change specifies. Principle III — the undo job writes its own ledger. No violation.

## Assumptions

- Other connectors will have their own timestamp resolutions; the payload-diff check is applied universally rather than per platform.

> **Constitution notice**: this change is the mechanism behind principle III (Ledger Before Act, Append-Only, NON-NEGOTIABLE). Its two-record model is what makes fail-closed and append-only hold simultaneously.

> **Amended 2026-09-12** by `req-022-account-sync`: ledger records replicate to the account, so append-only must hold across replicas and not only within one store. Conflict resolution is append-and-reconcile; last-writer-wins would silently delete history and is forbidden.

## Why

Harvested from `spikes/SP-12-sqlite-ledger/REPORT.md`. The spike built the ledger store and crash-recovery engine and verified them against deliberate process kills on both Linux and Windows.

## Problem

Two requirements appear to contradict each other. The ledger must be append-only — no updates, no deletes — and the ledger write must precede the external call, so that a crash never leaves an action unrecorded. A single record cannot satisfy both, because the outcome is not known when the record must be written.

- Writing an intent record before the call and a result record after resolves the contradiction while keeping the store strictly append-only, enforced by database triggers that block updates and deletes even from external tools — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan`).
- Recovery passed all five deliberate kill points, never losing a job and correctly distinguishing the indeterminate state before and after an external call — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan`).
- Ninety days of retention stays small — roughly 12.4 MB at 1,800 jobs and 30.8 MB at 4,500 — with sub-millisecond detail queries — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan`).

## Cost of inaction

The library generation originally tried broke completely on the current application framework because it bound to internal engine APIs. Without pinning the newer generation, every framework upgrade risks breaking the ledger — the one component that must never be unavailable.

## Options

### Option A — Two-record model with database-enforced immutability and a recovery engine
- **Sketch**: each tool call writes an intent record and later a result record sharing a correlation identifier. Triggers make immutability a property of the store. On startup, recovery reconciles unresolved intents against external state before any window opens.
- **Appetite**: large (months).
- **Trade-offs**: satisfies append-only and fail-closed together, and survives crashes at every measured point; doubles ledger row count and adds a startup reconciliation phase.
- **Rabbit holes**: attempting to reconcile APIs that cannot be read back, instead of handing those to the user.

### Option B — Minimum viable slice: single record written after the call
- **Sketch**: record what happened once the call returns.
- **Appetite**: small (days).
- **Trade-offs**: simplest possible ledger; a crash between call and write loses the action entirely, which is the precise failure principle III forbids.
- **Rabbit holes**: none — it fails the requirement.

## Recommendation

Option A. The two-record model is the only measured way to hold both requirements at once.

## What Changes

- Each tool call produces two ledger records: an intent record with the before-snapshot, parameters and correlation identifier written before the network call; and a result record with the outcome, after-snapshot and compensating action written after it returns — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-12-sqlite-ledger/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- The database library is pinned to the Node-API generation, which ships prebuilt binaries and removes the C++ build-tool requirement from developer and CI machines; the older generation binding to internal engine APIs must never be reintroduced — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-12-sqlite-ledger/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- Packaging must unpack native modules from the archive so the platform loader can load them from disk; universal packaging on macOS requires `x64ArchFiles: "*.node"` to prevent lipo collision — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-12-sqlite-ledger/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- Store configuration is specified: write-ahead logging, normal synchronous mode on Windows/Linux and mandatory fullfsync with full synchronous mode on macOS, foreign keys on, plus a descending timestamp index that takes recent-job queries from roughly 30 ms to under 1 ms — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-12-sqlite-ledger/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- **BREAKING** The job lifecycle gains two states — `recovering`, while the outcome of an interrupted call is
  still being established, and `waiting_user_confirmation`, for an effect that cannot be read back. Every
  surface that enumerates or filters job states must handle both; see `impact.md` — VERIFIED for the
  confirmation state (`spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien`), and recorded in
  `clarifications.md` Q-5 for `recovering`.
- Recovery runs at application start, before the pet window is created, so a duplicate tool call can never occur — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- For tools whose effect cannot be read back — sending mail, for instance — recovery moves the job to a user-confirmation state rather than retrying, so a message is never sent twice — VERIFIED (`spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien`).

## Capabilities

REQUIRES spec-impact — defines persistent storage, its immutability guarantees and a recovery contract.

### New Capabilities
None. All three capabilities below already exist as living specs, seeded by `specdocs:harvest`; this change adds
requirements to them and modifies two. The earlier reading of `ledger` and `platform` as new was corrected during
impact analysis, because a delta against an existing capability is `ADDED`/`MODIFIED`, never a new `## Purpose`.

### Modified Capabilities
- `ledger`: the two-record model, immutability enforced by the store itself, listable unresolved calls, how
  records leave the store, and how the store's shape changes without rewriting history.
- `platform`: what precedes the first window at start, native component packaging, and a store binding that
  needs no compiler on any machine.
- `job`: crash recovery states, including the user-confirmation state for tools whose effect cannot be read back.

## Impact

The complete local schema (jobs, approval requests, action records, indexes, triggers), application startup sequence, packaging configuration, and CI test harness.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle III — the intent record before the call is fail-closed; the triggers are append-only enforced at the engine rather than by convention. Principle IV — the result record carries the compensating action that undo replays. Principle VI — whether a tool's effect can be read back after a crash is declared by the tool in its manifest, so adding a platform does not edit the recovery engine. Principle VII — only the local half of recovery precedes the first window, so a device with no network still starts and stays usable.

One tension is declared rather than glossed. Principle III's wording is that ledger records "SHALL never be edited or deleted", while FR-LG-07 — already carried by the living `ledger` spec — requires retention bounded at 90 days and a deliberate deletion the user can ask for. This change does not dilute the principle: no record is ever edited, and removal is confined to retention expiry and a deletion the user requests, each announced by an appended record before it happens, so the history explains its own gaps. That reading is recorded in `design.md` under Complexity Tracking and requires the decision-maker's explicit acceptance. Making it the principle's own wording would be a constitution amendment, which the Governance section requires to be a dedicated change; this change does not attempt one.

## Assumptions

- Ninety-day retention is the working figure; the measured sizes make a longer window inexpensive if the decision changes.
- The measured sizes are per device. Since `req-022-account-sync` the account's ledger is the union across devices, so server-side retention sizing is a separate, unmeasured question.

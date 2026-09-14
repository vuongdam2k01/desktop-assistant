> **Constitution notice**: this change is the direct evidence for principle VI (Connectors Are Data) and settles an open product question about default approval for irreversible operations.

## Why

Harvested from `spikes/SP-19-connector-framework/REPORT.md`. The spike tested the framework's central claim by adding a second connector and counting the core changes required.

## Problem

The product's reach depends on a claim nobody had tested: that a new platform costs a manifest and an adapter, not an edit to the core. If the claim is false, the architecture caps out at the connectors someone hand-wrote.

- Adding a second connector required exactly zero lines of core change: job manager, evaluator, ledger, wrapping layer and tool generator were all untouched — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#0-ket-luan`).
- Tools generated dynamically from the manifest registered into the harness and executed against a real model, with the approval hook and ledger applying identically to both platforms — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#0-ket-luan`).
- The scope profile in the manifest is an effective control for the verification assessment level when moving from the bring-your-own channel to a mass-market client — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#2-tac-dong-len-adr-prd`).

## Cost of inaction

Two operational details would otherwise surface only in production. One platform provides no token revocation endpoint at all, so disconnecting removes the token locally while the integration remains authorised on the platform's side — a user who believes they revoked access has not. The other is a mid-job token expiry that costs an unexpected refresh round trip.

## Options

### Option A — Freeze the manifest schema and adapter interface as contracts
- **Sketch**: the manifest schema and a minimal adapter interface — execute, fetch snapshot, check status, revoke — become versioned contracts. Standard connector error codes let the job manager fail cleanly regardless of platform.
- **Appetite**: medium (weeks).
- **Trade-offs**: the zero-core-change property becomes a contract rather than a happy accident; freezing the schema before the third connector risks missing a needed field.
- **Rabbit holes**: pre-modelling every platform capability in the schema.

### Option B — Minimum viable slice: keep the manifest internal and informal
- **Sketch**: treat the manifest as an implementation detail that evolves per connector.
- **Appetite**: small (days).
- **Trade-offs**: maximum flexibility while the shape settles; without a contract, the next connector negotiates its own fields and the core starts absorbing differences.
- **Rabbit holes**: divergence discovered only when the fourth connector needs the second's behaviour.

## Recommendation

Option A. The zero-core-change result is the property worth protecting, and it survives only if the boundary is a contract.

## What Changes

- The manifest schema and adapter interface become versioned contracts; the adapter surface is execute, fetch snapshot, check status, revoke — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Document- and database-style connectors must declare sanitization for write tools, excluding the six computed fields identified in `req-003-notion-compensation` — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- An open product question is settled: a tool flagged irreversible in the manifest requires approval by default in smart and on modes, with no user-authored rule needed — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#2-tac-dong-len-adr-prd`).
- Standard connector error codes for revoked, disconnected and expired states let the job manager fail cleanly — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Where a platform offers no revocation endpoint, disconnection removes the local token only; the product must say so plainly and direct the user to revoke on the platform's own settings page — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien`).
- The job manager checks token expiry before starting a job and refreshes proactively when little time remains, avoiding a mid-sequence refresh — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien`).

## Capabilities

REQUIRES spec-impact — freezes two contracts and changes approval defaults.

### New Capabilities
- `connector`: manifest schema contract, adapter interface contract, standard error codes, scope profiles.

### Modified Capabilities
- `approval`: irreversible tools are approval-required by default.
- `job`: proactive token refresh and clean failure on connector error codes.

## Impact

Every current and future connector, the tool generator, the approval default path, and the disconnect flow in settings.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle VI — this change is its proof and the contract that preserves it. Principle IV — the irreversible flag now carries a default consequence rather than being advisory. No violation.

## Assumptions

- Two connectors are enough to validate the boundary; the third is expected to extend the schema rather than break it.

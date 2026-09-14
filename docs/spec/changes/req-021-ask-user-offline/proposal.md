> **Constitution notice**: this change proves that the ask mechanism cannot be used to route around the approval gate, which is a direct test of principle II.

> **Amended 2026-09-12** by `req-022-account-sync`: the offline queue is unchanged and now explicitly load-bearing, because the local store stays the working copy. A queued command belongs to the device that accepted it and is not replicated until it has been sent.

## Why

Harvested from `spikes/SP-21-ask-user-offline/REPORT.md`. The spike verified the mid-run question mechanism and the local command queue that keeps the product usable while the backend is unreachable.

## Problem

Two separate promises meet here. An agent that can ask the user a question mid-run is what makes multi-turn work possible — but a question is also an obvious way to get a human to perform an action the gate just refused. And a user who types a command while the backend is down must not lose it.

- The one-open-question-per-job constraint holds, and every attempt to route around the approval gate through the ask mechanism was blocked — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#0-ket-luan`).
- The local queue preserved every command during a backend outage and resent them in order without duplication, while running jobs continued uninterrupted — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#0-ket-luan`).
- The one-open-question constraint is enforced by the harness runtime, which raises an error back to the agent, not by the interface — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#2-tac-dong-len-adr-prd`).

## Cost of inaction

Without the runtime constraint, an agent can open several questions at once and the user faces a pile of prompts with no ordering. Without the queue, an outage silently discards work the user believed they had handed over — and the outage is exactly when they are least able to tell.

## Options

### Option A — Runtime-enforced ask contract plus a durable local queue
- **Sketch**: the ask tool takes a structured question with up to four options and free text, and the runtime rejects a second open question. Commands issued during an outage persist locally with an idempotency key and drain in order on recovery, with a non-blocking status card while queued.
- **Appetite**: medium (weeks).
- **Trade-offs**: both guarantees become structural; the queue is another persistent store to maintain and reconcile.
- **Rabbit holes**: generalising the queue into an offline mode for operations that genuinely require the network.

### Option B — Minimum viable slice: interface-level constraint, no queue
- **Sketch**: the interface shows one question at a time and rejects input during an outage.
- **Appetite**: small (days).
- **Trade-offs**: much less to build; an agent can still open several questions beneath the interface, and the user loses commands during an outage.
- **Rabbit holes**: none.

## Recommendation

Option A. The runtime enforcement is what the spike specifically distinguishes from interface behaviour, and the queue was verified end to end including duplicate suppression.

## What Changes

- The ask tool contract is specified: a question, up to four options with short labels, and free text permitted by default; the answer returns either an option identifier or text — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- A second open question within one job is rejected by the runtime with a specific error, signalling the agent to combine its questions — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#2-tac-dong-len-adr-prd`).
- The offline command queue is specified with its own table, status lifecycle, unique idempotency key and a drain index ordered by creation time — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- A non-blocking status card reports the queued state and dismisses itself once the queue drains — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- The evaluator lives inside the tool's own execution closure, so no answer to a question can grant permission the gate withheld — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- The app must let the user view, edit or cancel individual queued commands before they are sent, since a later command may contradict an earlier one during a long outage — VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md#4-rui-ro-moi-phat-hien`).

## Capabilities

REQUIRES spec-impact — introduces a persistent queue and a runtime-enforced tool constraint.

### New Capabilities
- `agent`: ask tool contract and the one-open-question runtime gate.
- `job`: the waiting-for-input state and its resumption semantics.

### Modified Capabilities
- `app`: offline queue management surface.
- `uix`: status card lifecycle for queued commands.

## Impact

Local database schema, harness tool registration, composer behaviour during an outage, and job state transitions.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle II — placing the evaluator in the tool closure is what stops the ask mechanism becoming a bypass. Principle V — asking mid-run is the harness capability the principle names, so this change supports rather than strains it. No violation.

## Assumptions

- The queue holds user commands only, not connector operations; a queued command is re-planned on send rather than replayed as a recorded action.
- A queued command stays on the device that accepted it. Replicating unsent commands would let two devices send the same instruction, so the queue is deliberately outside the account-owned set until the command becomes a job.

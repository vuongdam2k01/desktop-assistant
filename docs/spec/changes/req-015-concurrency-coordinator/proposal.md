> **Constitution notice**: this change adds a mandatory stage to the tool execution path that principles II, III and IV all run through. The ordering it specifies is load-bearing for ledger correctness.

## Why

Harvested from `spikes/SP-15-concurrency/REPORT.md`. The spike measured what happens when several jobs touch the same connector account at once.

## Problem

Jobs run in parallel by design. Two of them touching the same object produce a failure that no single-job test can find: one job reads its before-snapshot while another is mid-write, records a stale snapshot, and later restores it — erasing the other job's legitimate work during an undo the user asked for.

- Without an object-level lock, a job reading a snapshot during another job's write records a stale snapshot, and undoing that job wipes the other job's valid changes — VERIFIED (`spikes/SP-15-concurrency/REPORT.md#0-ket-luan`).
- Fair queueing rather than naive first-in-first-out cut an interactive job's wait from 4,251 ms to 252 ms, an 11.7× improvement — VERIFIED (`spikes/SP-15-concurrency/REPORT.md#0-ket-luan`).
- Beyond five concurrent jobs on one account, queue latency exceeds four seconds and the platform rate limit accounts for over 80% of execution time — VERIFIED (`spikes/SP-15-concurrency/REPORT.md#0-ket-luan`).

## Cost of inaction

The lost-update-on-undo failure is silent, destroys user data, and appears only under concurrency — which is the product's normal operating mode. It also cannot be fixed later without reordering the tool execution path that everything else is built on.

## Options

### Option A — A gateway component owning locks and the shared rate queue
- **Sketch**: one component sits between the agents and every connector, holding an exclusive lock per resource identifier and a single shared fair queue. A tool call acquires the lock, snapshots, writes intent, queues the request, executes, snapshots, writes the result, then releases.
- **Appetite**: large (months).
- **Trade-offs**: eliminates both the correctness bug and head-of-line blocking, in one place; introduces a central component every connector call passes through, plus deadlock risk across connectors.
- **Rabbit holes**: building a general distributed lock manager for a single-machine application.

### Option B — Minimum viable slice: serialise all jobs on one connector account
- **Sketch**: allow only one job at a time per account.
- **Appetite**: small (days).
- **Trade-offs**: trivially correct; destroys the parallel-jobs capability the product promises, and an interactive command would queue behind a bulk job.
- **Rabbit holes**: none, but the product loses a headline behaviour.

## Recommendation

Option A. The measured ordering is the part that matters most: the lock must be held from before the snapshot until the result record is committed.

## What Changes

- A gateway component is added to the architecture, owning the object lock manager and the shared rate queue rather than leaving either per worker instance — VERIFIED (`spikes/SP-15-concurrency/REPORT.md#2-tac-dong-len-adr-prd`).
- The safe execution order is specified: acquire every resource the call declared, read the before state, write the intent record, obtain the gate's verdict, dispatch through the shared queue, read the after state, write the result record, release — VERIFIED for the part that was measured, which is that the exclusive span must begin before the before-state is read and end only once the result is durable (`spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, §1 Q2). Where the span meets an approval that waits on a human, it is released and then re-established and re-checked before execution rather than held — the decision recorded as Q-1 in `clarifications.md`, which also records why the gate's verdict is not moved ahead of the intent record.
- Locks are keyed by a normalised resource identifier, are exclusive and reentrant within a job, and time out at 15 s with a specific error the job manager retries with backoff — VERIFIED (`spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- The queue dispatches round-robin across per-job queues behind a token bucket paced at the connector's declared rate — VERIFIED (`spikes/SP-15-concurrency/REPORT.md` §1 Q3). A weight per job class and a floor guaranteeing background jobs a share of dispatches are carried as declared defaults rather than as measured figures: both are recommendations of the same report (`#3-dau-vao-cho-tai-lieu-ky-thuat` item 2, `#4-rui-ro-moi-phat-hien`) and neither was run — the decision recorded as Q-5 in `clarifications.md`.
- Concurrency on one connector account is capped, with one slot reserved for a job the user started; a job over the cap stays in the existing `queued` state rather than gaining a state of its own — VERIFIED for the measured band of three to five (`spikes/SP-15-concurrency/REPORT.md#2-tac-dong-len-adr-prd`, §1 Q4); the default of four and the reserved slot are the choice recorded as Q-4 in `clarifications.md`.
- Cross-connector deadlock is prevented by a canonical lock ordering or by acquiring all locks upfront — VERIFIED (`spikes/SP-15-concurrency/REPORT.md#4-rui-ro-moi-phat-hien`).

## Capabilities

REQUIRES spec-impact — inserts a mandatory stage into the write path and changes ledger snapshot semantics.

### New Capabilities

None. The gateway is added inside the existing `connector` capability rather than as a capability of its own —
it owns no platform of its own and exists to sit in front of the ones `connector` already declares.

### Modified Capabilities
- `connector`: the coordinator every platform call passes through, the object lock manager, and the shared fair
  rate queue.
- `job`: a concurrency cap per connector account, applied as admission control over the existing `queued` state
  rather than as a new state, and retry behaviour for a call refused because a resource is held.
- `ledger`: the before-state a record carries is captured under exclusive access to its target, held until the
  result record is durable or re-established and re-checked before anything executes.

## Impact

Every connector tool call, job scheduling, ledger write ordering, and the architecture diagram. This change and `req-013-sqlite-ledger` jointly own the write path ordering and must stay consistent.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle III — the lock bracket is what makes the recorded snapshot true at the moment of the call; without it the ledger is accurate about the call and wrong about the world. Principle IV — a stale snapshot produces a compensating action that destroys data. No violation.

## Assumptions

- The concurrency cap is per connector account rather than global; a user connected to several platforms may exceed it in aggregate.

> **Constitution notice**: this change places a model in the approval path. It is compatible with principle II only because the model may escalate but never authorise beyond the static tier, and because failure is closed.

## Why

Harvested from `spikes/SP-10-risk-judge/REPORT.md`. The spike measured a second-tier model risk judge sitting behind the static rule tier in smart approval mode.

## Problem

Smart mode has to decide, without asking the user, whether a write operation is safe. Static patterns catch what was anticipated; they cannot catch semantic danger nobody wrote a rule for — renaming a database, writing into a workspace outside the granted scope, deleting a block one-way.

- Strict false-allow on dangerous operations was 0.0% across 60 trials on both models — VERIFIED (`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`).
- The cheap model's median latency was 3,154 ms at $0.000203 per call, keeping a simple job at 20.1 s against the 30 s ceiling — VERIFIED (`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`).
- Fail-closed behaviour was verified by real network cuts and dead ports, not simulated — VERIFIED (`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`).

## Cost of inaction

One measured attack stays open. Text that impersonates internal ledger metadata — phrases asserting an operation is reversible, low-risk or pre-approved — persuaded the cheap model to downgrade its own control. That text can arrive from any page title or description the agent reads, which is to say from anyone.

## Options

### Option A — Two tiers, static first, model second, always fail-closed
- **Sketch**: the static tier blocks quantitative and ownership rules outright, including anything the user did not create; only what survives reaches the model judge, which may auto-approve, auto-deny, or escalate to the user.
- **Appetite**: medium (weeks).
- **Trade-offs**: catches both anticipated and semantic risk with a measured zero false-allow; adds a few seconds and a small cost to each unmatched write.
- **Rabbit holes**: letting the model tier absorb responsibilities the static tier should own, which is exactly how the impersonation attack succeeded.

### Option B — Minimum viable slice: static tier only
- **Sketch**: smart mode uses patterns alone; anything unmatched goes to the user.
- **Appetite**: small (days).
- **Trade-offs**: no model in the approval path at all and no impersonation surface; smart mode degrades toward always-on mode, which the risk register already flags as driving users to disable control entirely.
- **Rabbit holes**: growing the static pattern set indefinitely to compensate.

## Recommendation

Option A, with the static tier hardened first. The two tiers were measured as complementary: ownership and quantitative limits belong to patterns, semantic danger to the judge.

## What Changes

- The static tier must block operations on objects the user did not create, before the model judge is consulted — VERIFIED (`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`).
- The judge call carries a fixed timeout of 10–15 s; on timeout, network loss, HTTP error or parse failure the client must fail closed to a user approval card. Falling back to automatic approval is forbidden — VERIFIED (`spikes/SP-10-risk-judge/REPORT.md#2-tac-dong-len-adr-prd`).
- The judge's system prompt treats titles, notes and descriptions as untrusted environment data — VERIFIED (`spikes/SP-10-risk-judge/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Content containing metadata-impersonating keywords is stripped or flagged before reaching the judge, and may escalate the call to the strong model or straight to the user — VERIFIED (`spikes/SP-10-risk-judge/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-10-risk-judge/REPORT.md#4-rui-ro-moi-phat-hien`).
- The cheap model is the default for this role — VERIFIED (`spikes/SP-10-risk-judge/REPORT.md#2-tac-dong-len-adr-prd`).

## Capabilities

REQUIRES spec-impact — modifies the approval decision path and adds an external dependency in the write path.

### New Capabilities
- `approval`: two-tier smart mode, risk judge contract, fail-closed timeout policy, untrusted-data handling.

### Modified Capabilities
- `agent`: model routing gains the risk judge role.

## Impact

Every write tool call in smart mode, job latency budgets, provider cost, and the prompt-hardening layer shared with the connector read path.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle II — the model tier narrows but never widens what the static tier allows, and failure is closed, so the gate is never model-dependent for safety. `External Content Is Data` — connector-fetched titles and descriptions are treated as data, which this change enforces explicitly. No violation.

## Assumptions

- Both models exhibit a bias toward approving operations that look undoable; the static ownership check is therefore permanent, not a temporary patch.

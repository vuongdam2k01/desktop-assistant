> **Constitution notice**: this change defines the wrapping mechanism that makes principles II and III enforceable on every tool. Weakening it weakens both.

## Why

Harvested from `spikes/SP-6-pi-sdk/REPORT.md`. The spike verified the chosen agent harness SDK against the product's hardest requirement: that no registered tool can reach a connector without passing the approval hook and writing to the ledger.

## Problem

The product builds on a third-party agent framework, so every guarantee the constitution makes about gating and ledger duty depends on how tools are registered into that framework. If the guarantee rests on framework middleware, it rests on someone else's roadmap.

- The two-layer wrap/hook model achieved zero leakage against the hard-gate standard — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#0-ket-luan`).
- Pause and resume restored a job at its stopping point without repeating completed steps — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#0-ket-luan`).
- Parallel agents ran in complete isolation, and a custom OpenAI-compatible endpoint plus image input both worked — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#0-ket-luan`).

## Cost of inaction

Without a named wrapping factory, each connector tool is registered by whoever writes it, and the four-step obligation becomes convention. Convention is exactly what principle III exists to replace.

## Options

### Option A — A single wrapping factory is the only registration path
- **Sketch**: every tool generated from a connector manifest passes through one factory that enforces ledger intent, evaluator hook, execute, ledger result — in that order. Registering a tool any other way is a review failure.
- **Appetite**: medium (weeks).
- **Trade-offs**: makes the guarantee structural and independent of framework middleware capability; one factory becomes a hot path every connector depends on.
- **Rabbit holes**: generalising the factory to support exceptions, which reintroduces the bypass it exists to prevent.

### Option B — Minimum viable slice: rely on framework hooks
- **Sketch**: use the SDK's own middleware to intercept tool calls.
- **Appetite**: small (days).
- **Trade-offs**: less code; the guarantee then depends on an upstream project's design choices, and the framework's default coding tools would need separate exclusion.
- **Rabbit holes**: an upstream release changes middleware semantics and the gate silently narrows.

## Recommendation

Option A. The wrap sits outside the SDK, so replacing the harness later does not break the ledger and approval obligations.

## What Changes

- Package identity is pinned: the harness packages are fixed at the verified versions, and the similarly-named alternative namespace must not be installed, as it requires a different runtime and breaks parallel-agent isolation — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien`).
- Every tool given to any agent passes through one wrapping factory enforcing ledger intent → evaluator hook → execute →
  ledger result — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`). The factory is the only
  registration path: the pet-agent's own five tools go through it as well, declaring the internal origin rather than a
  connector, because a trusted-tool category would be a second path and therefore the bypass the factory exists to prevent
  (`clarifications.md` session 2026-09-12).
- The three ways a wrapped call can stop before it runs are given different consequences: a refusal returns to the agent as a
  tool result carrying the rule that fired, a failed ledger write stops the call and fails the job, and an evaluation failure
  is fail-closed for the whole product (`clarifications.md` session 2026-09-12).
- The approval pause/resume contract is specified: on a tool needing approval, persist the transcript and move the job to
  `waiting_approval`; on approval, execute, append the tool result to the transcript, and continue the agent — VERIFIED
  (`spikes/SP-6-pi-sdk/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`). The persisted transcript is the state and the in-flight
  suspension is only an optimisation over it, so a held call survives a restart and is classified by the recovery pass
  `req-013-sqlite-ledger` already specifies (`clarifications.md` session 2026-09-12).
- Transcripts are held in the product's own store as an account-owned, append-only replicated store rather than in the
  harness's session files, so that retention, replication and erase-on-sign-out have one owner
  (`clarifications.md` session 2026-09-12).
- Provider configuration wording drops the CLI-only interactive login mechanism, which does not exist on the embedded SDK path; the app offers API-key and custom-endpoint configuration instead — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#2-tac-dong-len-adr-prd`).
- The composer must reject images smaller than 14 px in either dimension before sending, since the vision endpoint rejects
  them with HTTP 400 — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien`). One product-wide floor is applied
  rather than a per-provider one (`clarifications.md` §Assumptions).

## Capabilities

REQUIRES spec-impact — defines the tool registration contract and the approval pause/resume state transitions.

### New Capabilities
- None. `agent` already exists as current truth at `docs/spec/capabilities/agent/spec.md`, seeded by the harvest;
  this change deepens it rather than creating it.

### Modified Capabilities
- `agent`: the single registration path, per-session isolation, harness identity pinning, the resume guarantee, and the
  provider configuration surface, which replaces the interactive sign-in the embedded path does not have.
- `approval`: the pause/resume mechanism and the consequence of each verdict become specified contracts rather than
  implementation details.
- `uix`: the composer gains a minimum image dimension, because the vision endpoint refuses smaller images outright.

## Impact

Every tool any agent holds, the job lifecycle states `waiting_approval` and `running`, transcript persistence as an
account-owned replicated store, the composer's image validation, and the dependency lockfile.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle II — the wrap is what places the gate outside the model's reach. Principle III — the factory is what makes ledger-before-act structural. Principle VI — tools are generated from manifests and wrapped without exception. No violation.

## Assumptions

- The framework's default coding tools are never installed and never registered for any agent. The embedded runtime loads
  no tools unless given them — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q1) — so this is an absence to preserve rather
  than a suppression to build.
- The harness runs in the client's main process beside the connectors, the evaluator and the ledger writer; no window holds
  a session (`clarifications.md` §Assumptions).
- Every figure the spike measured was measured under a plain runtime, not inside the shipped application framework.
  Re-measuring it there is a task in this change and an open question in `clarifications.md`, not an assumption.

# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | Proposal states the goal (account-owned data recoverable from sign-in alone), the five modified capabilities and the one new one. Job execution stays pinned to the creating device, which bounds the scope. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | Replicated stores, device registry and lease are settled by Q-1, Q-2, Q-3 and Q-4 below; entity detail belongs to `model.md`. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Clear | Two journeys matter and both are stated: sign-in on a replacement device restores everything, and the user sees and revokes enrolled devices. Presentation is owned by `app`. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Partial | The security posture is settled by principle VII and deliberately accepted in RISK-062. Every numeric characteristic — sync latency, enrolment duration, revocation window, encrypted-store cost — is unmeasured and gated on spike SP-22 per Q-5. |
| Integration & external dependencies (external services, formats, versions) | Clear | Google Sign-In is the only identity dependency, unchanged. The connector broker already exists in `backend`; this change moves where its result is stored, not how it is obtained. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Concurrent offline edits are resolved by Q-1, revocation of an offline device by Q-3, clock skew by Q-2. Offline operation against the local working copy is unchanged and load-bearing. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | End-to-end encryption was evaluated and rejected on 2026-09-12 with the constraint that settled it recorded in the proposal, the constitution and RISK-062. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | "Replication" throughout, never "sync engine" or "backup"; "enrolment" for a device joining an account; "lease" for the bounded right to use replicated connector authorisation. "Last-writer-wins" is forbidden for any append-only store. |
| Completion signals (verifiable acceptance criteria, definition of done) | Partial | Behavioural acceptance is expressible now and is written into the specs. Threshold-bearing acceptance waits on SP-22 and is deferred to `verification.md`. |
| Placeholders (TODOs, unquantified adjectives) | Clear | No placeholder survives into the specs. Where a period must be fixed (lease expiry, revocation window) the spec states that a bounded period exists and SP-22 sources the number, rather than inventing one. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Partial | Storage locations and the state-to-artifact mapping are determinable now and belong in `model.md`. Quantified budgets are unmeasured: RISK-069 records that the 12.4 MB at 1,800 jobs from `spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan` is per device, and the account total across devices and beta population has never been sized. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Each replicated store declares its own conflict-resolution rule rather than the protocol hard-coding one; that declaration is the extension point and is contract-owned. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Partial | The client/backend boundary is the protocol surface and is specified in `contracts/`. Transport characteristics under real conditions are unverified pending SP-22. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | The local store stays the working copy; the offline command queue from `req-021-ask-user-offline` and crash recovery from `req-013-sqlite-ledger` are unchanged and run against the local store first. |

## Sessions

### Session 2026-09-12 — amendment intake
Created alongside the amendment. Two decision-maker directives are already recorded and are not open questions:
account-owned data replacing device-bound storage, and no user-carried secret between machines, which forecloses
end-to-end encryption.

### Session 2026-09-12 — resolution before `specs`
Five questions blocked the behavioural specification. Four were put to the decision-maker and answered; the fifth
was resolved against the risk ledger as an engineering decision. Each answer is recorded with the artifacts it
unblocks.

**Q-5 — Does this change proceed to specification without a replication spike?**
**Answer**: Proceed to `specs` and `model` now; halt before `design.md` until spike SP-22 reports. Behavioural
requirements state observable outcomes rather than measured thresholds, so the Evidence Discipline section
permits them with UNVERIFIED labels. Decisions and thresholds do require measurement, so `design.md` and
`verification.md` wait on SP-22, which must measure conflict resolution, enrolment from sign-in alone, revocation
latency and encrypted-store performance. RISK-070 stays open until it does.
**Unblocks**: `specs`, `model`, `contracts`, `checklist`, `evolution`. **Blocks**: `design`, `verification`, `tasks`.

**Q-5 reversed, same day, by the decision-maker.** After `specs`, `model`, `contracts`, `evolution` and the
checklist were written, the gate on `design.md` was lifted deliberately: planning completes to all ten artifacts
now, and SP-22 becomes a prerequisite of implementation rather than of specification. This is the option
originally recorded as Q-5's third alternative. The evidence discipline is unchanged by the reversal and is
honoured explicitly instead of implicitly — every decision in `design.md` carries its verification status, no
numeric threshold is invented anywhere, and `verification.md` states behavioural acceptance it can source from the
specs while naming SP-22 as the source for every quantity it cannot and recording the rest as open measurement
gaps. RISK-070 stays open and is not weakened by planning having proceeded past it.

**Q-4 — Does the replicated set include agent transcripts in full?**
**Answer**: Yes, in full, as principle VII states, but bounded by the ledger's retention rule — the configurable
period of at least 90 days by default, and the same deliberate-deletion action carrying a warning about what is
lost. No constitution amendment is required, since principle VII already names transcripts as account-owned.
Bounding retention is what keeps RISK-069 sizeable and limits the standing exposure in RISK-062.
**Unblocks**: the `sync` and `ledger` specs, and the storage sizing in `model.md`.

**Q-1 — What resolves a mutable record edited on two devices while both were offline?**
**Answer**: Deterministic last-writer-wins at record granularity, ordered by the server's receive order, with the
superseded version appended to the ledger as a record the user can read and restore. Nothing is discarded
silently, which is what principle III requires of any resolution that can drop a user edit; resolution needs no
user interruption, so a rule or connector never sits unusable waiting for a decision. Applies to approval rules,
provider configuration and connector settings. It does **not** apply to the ledger or to transcripts: those are
append-only and resolve by append-and-reconcile, where last-writer-wins is forbidden.
**Unblocks**: the `sync` spec, the conflict-resolution rule in `model.md`, and the replication contract.

**Q-3 — How long may a revoked or signed-out device keep operating?**
**Answer**: Replicated connector authorisation is usable only under a lease that is refreshed on each successful
sync and hard-expires after a bounded period. On expiry, or on receiving revocation notice, the device stops
using replicated authorisation and erases replicated data and replication material from the device. This converts
the unbounded window in RISK-066 into a stated, verifiable guarantee. The period itself is a threshold and is
therefore not fixed here: SP-22 measures it and `verification.md` sources it.
**Unblocks**: the `sync`, `connector` and `platform` specs, and the revocation contract.

**Q-2 — What is the ordering basis for replicated ledger records across devices?**
**Answer**: A per-device monotonic sequence number combined with causal ordering across devices. Device
wall-clock time is retained for display only and is never the ordering basis, because it is not trustworthy
across machines and undo reads the ledger in order. This is the answer RISK-068 already identifies as likely;
it is recorded here as the engineering decision rather than left open. The causal-ordering mechanism is a design
concern and is deferred to `design.md` behind SP-22; the specs state only the observable property, which is that
replicated records present in a consistent order on every device regardless of clock differences.
**Unblocks**: the `sync` and `ledger` specs. **Closes**: the specification half of RISK-068; the measurement half
stays open.

## Assumptions

Recorded in the `## Assumptions` section of `proposal.md`.

## Open

None blocking `specs`, `model`, `contracts`, `checklist` or `evolution`.

- Q-6: What are the measured characteristics of replication — conflict-resolution behaviour under real concurrent
  edits, enrolment duration from sign-in alone, revocation latency, and encrypted-store cost? — carried by
  RISK-070 — blocking: `design.md` and `verification.md`, by the decision recorded in Q-5 — decided
  by: spike SP-22

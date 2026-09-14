# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | The proposal states the goal — a store in which append-only and fail-closed hold at the same time — and bounds it: the two-record model, engine-enforced immutability, startup recovery, retention sizing and native packaging. Replication of these records to the account is owned by `sync` and was settled in `req-022-account-sync`; this change makes the per-device store that replication carries. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | Settled by Q-1 and Q-2 below: one local store file holding jobs, approval requests and action records, and the snapshot held as complete structured text. Entity detail belongs to `model.md`. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Clear | This change adds no surface of its own. What the user sees after a crash — the rebuilt blocking card queue, the confirmation card for an operation that cannot be read back, the warning before ledger data is deleted — is owned by `uix` and `app` and is already specified there. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Partial | Per-device volume and query latency over a 90-day period are VERIFIED in `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5. Two quantities are not measured and are not invented here: the account total across devices (RISK-069, owned by SP-22) and the duration of the startup pass that precedes the first window, which is recorded under `## Open`. |
| Integration & external dependencies (external services, formats, versions) | Clear | No new external service. Recovery reads platform state back through the connector the intent already names, reached through `connector/contracts/connector-manifest`. The database library generation is pinned and the superseded generation is recorded as DROPPED with the measurement that settled it. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Five kill points across the lifetime of one tool call were measured on both operating systems — `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q4. The two that this change had to decide rather than measure are settled by Q-3 (an effect that cannot be read back) and Q-5 (a device that starts with no network). |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | The single-record alternative is stated and rejected in the proposal. The older library generation is rejected on a compile failure against the current application framework, not on preference — RISK-046. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | "Intent record" and "result record" for the two records of one tool call, joined by a "correlation identifier"; "unresolved intent" for an intent with no result; "recovery" for the startup reconciliation. The store is never called a log. Job states use the vocabulary of the living `job` spec — `done`, not the spike prototype's `completed`. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | The crash suite, the append-only suite, the storage simulation and the migration test are executable and become the acceptance evidence; `verification.md` carries them with their sources. |
| Placeholders (TODOs, unquantified adjectives) | Clear | No placeholder survives into the specs. Where a number is unmeasured it is named as unmeasured with its owner, rather than being written as a threshold. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | Settled by Q-1, Q-2 and Q-4: the file's location and configuration, the snapshot format, the resource budget and how records leave the store at the end of retention. Carried into `model.md`. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Settled by Q-3: whether a tool's effect can be read back is declared per tool rather than known by the recovery engine, which is what keeps principle VI true for the Nth platform. The declaration is contract-owned and its absence is treated as the unsafe case. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | The store is opened in exactly one process and is never reached from the window process directly; the read and append surface crossing that boundary is specified in `contracts/ledger-store.md` and its topology in `design.md`. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | Settled by Q-5: a local pass that classifies unresolved intents runs before the first window, and the pass that reads external state runs afterwards as a precondition of the affected job resuming rather than of the product starting. The fallback hierarchy is in `design.md`. |

## Sessions

### Session 2026-09-12 — decisions delegated to the drafting agent

The decision-maker directed on 2026-09-12 that these five questions be answered by the agent rather than put to
them one at a time, choosing the option that best fits `docs/raw-idea/prd-mvp.md` and `docs/spec/constitution.md`.
Each answer below therefore records the option that was chosen, the alternatives that were rejected, and the
evidence or principle that settled it, so the decision-maker can overturn any one of them by reading this file
alone. Every answer is reflected in exactly one artifact outside this log.

- Q: Does one local store file hold jobs, approval requests and ledger records together, or does the ledger get
  a file of its own? → A: **One file per device**, holding jobs, approval requests and action records, with
  append-only enforcement applied to the action-record table only. Recovery has to read job state and ledger
  records as one consistent picture — deciding that an intent is unresolved means reading the records and the
  job in the same breath — and a second file would make that a cross-file reconciliation with its own failure
  mode. This is also the arrangement the crash injection actually ran against, so keeping it keeps the evidence
  applicable: `spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 reuses the schema
  holding all three tables plus its indexes and triggers. Rejected: a separate ledger file, which buys isolation
  the product does not need and costs the single-snapshot read that recovery does need; and a file per job,
  which makes retention and the recent-jobs query scan the file system.
  (patched: `model.md` Physical Resource & Artifact Topology; `design.md` D1)
- Q: In what form is the before or after snapshot of an object kept? → A: **The complete object state as
  structured text, uncompressed, for the MVP.** The compensating action principle IV requires is then a single
  replay of the recorded state rather than a merge against whatever the object has since become, which is what
  `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 recommends after measuring the alternative: general-purpose
  compression reduced the payload by 44.5 percent, against a 90-day total of 12.36 MB at 1,800 jobs and
  30.83 MB at 4,500 jobs, which is not a saving worth making the store unreadable by direct inspection.
  Compression is therefore recorded as a reserved variability point with the condition that activates it, rather
  than as a discarded idea. Rejected: storing a property-level difference, which cannot rebuild an object whose
  intermediate state changed under it, and which RISK-001 already records as the case where no compensation
  formula exists; and compressing now, which trades debuggability for a saving of a few megabytes per device.
  (patched: `model.md` Physical Resource & Artifact Topology and Variability)
- Q: How does recovery know whether the effect of a tool call can be read back from the platform afterwards? →
  A: **Each tool declares it**, in the manifest that already defines the tool, as either a read-back method
  naming the read operation and what to compare, or the explicit statement that the effect cannot be read back.
  The declaration is copied into the intent record when the record is written, so a later manifest change cannot
  retroactively alter how an old intent is reconciled. A tool whose manifest declares nothing is treated as not
  readable back, which is the fail-closed reading and the one that never sends a message twice. Hard-coding the
  list of readable tools inside the recovery engine was rejected because it makes the Nth platform an edit to
  the recovery engine, which principle VI forbids; inferring readability from the tool's shape was rejected
  because it guesses, and RISK-045 is exactly the case where guessing wrong sends the message again.
  (patched: `contracts/tool-reconciliation.md`; the requirement it makes observable is in `specs/job/spec.md`)
- Q: How can records be removed after 90 days when the store forbids deletion? → A: **By separating mutation
  from expiry.** No record is ever rewritten and no ordinary write path can delete one; that is absolute.
  Removal at the end of the retention period, and the deliberate deletion the user asks for, run as a distinct
  maintenance operation that first appends a record stating what is about to be removed and why, and then
  removes whole records — never editing one — through the atomic procedure verified in
  `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q6, which recreates the table and its guards inside a single
  transaction. The result is that the history contains its own account of every removal, so a gap in the ledger
  is always explained by a record in the ledger. Rejected: never removing anything, which contradicts the
  existing retention requirement and leaves the user unable to delete their own history; and relaxing the guard
  to permit deletion of old rows, which would leave the ordinary write path able to delete and make principle
  III depend on a condition rather than on a prohibition.
  (patched: `specs/ledger/spec.md`, the requirement on how records leave the store)
- Q: Must crash recovery finish before the pet appears, even when the device has no network? → A: **No — it
  runs in two passes.** The pass that reads the store, finds unresolved intents, marks the jobs they belong to
  as not resumable and rebuilds the blocking card queue is local, needs no network, and completes before the
  first window is shown. The pass that reads the platform's current state back runs after the window is shown,
  once per affected job, and is a precondition of that job resuming — not of the product starting. The guarantee
  that no tool call is ever made twice comes from never resuming a job whose intent is unresolved, which both
  passes honour; it does not come from blocking startup on a network the user may not have. Blocking the window
  on external reconciliation was rejected because it makes an offline start hang on a platform the user cannot
  reach, against principle VII's requirement that the product keeps working while the network does not; doing
  everything after the window was rejected because the card queue and the not-resumable marking must be in place
  before the user can act on anything.
  (patched: `specs/platform/spec.md`, the requirement on what precedes the first window)

## Assumptions

- Ninety days remains the working retention figure, as the proposal states. The measured per-device volume makes
  a longer window inexpensive, so the number is a product decision rather than a technical constraint.
- The store belongs to one operating-system user account on one device and is not shared between user accounts on
  the same machine; `spikes/SP-11-secure-storage/REPORT.md` records that the credential encryption profile is
  per user, and RISK-043 is resolved on that basis.
- The recorded time on a record is carried for display and is never the basis on which records order, which is
  the decision already taken in `docs/spec/changes/req-022-account-sync/clarifications.md` Q-2. This change
  inherits it rather than reopening it.
- The measured figures are per device. The account total across devices is unmeasured, which RISK-069 records
  and `req-022-account-sync` owns; nothing in this change states an account-wide budget.

## Open

None blocking any artifact of this change.

- Q-6: How long does the local recovery pass take before the first window on a store holding a full retention
  period of records? — blocking: nothing in planning; it would let `verification.md` state a startup budget as a
  threshold rather than as an observation — decided by: measurement during implementation at M1, since
  `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 measured the detail query at 0.13–0.25 ms but never measured the
  whole pass against a full store.

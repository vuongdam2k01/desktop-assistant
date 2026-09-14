# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | The proposal bounds the change to four things: the gateway that every platform call passes through, the object lock that makes a recorded snapshot true, the shared fair queue that stops one job blocking another, and the concurrency cap. Conflict detection at undo time is deliberately left to `req-010-undo-agent`, which owns it; the field-level recommendation this spike produced is carried there rather than duplicated here (`spikes/SP-15-concurrency/REPORT.md` §1 Q5). |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | Settled by Q-1, Q-2 and Q-3 below: what the coordinated bracket is, what names a resource, and that the cap adds no lifecycle state. Entity detail belongs to `model.md`; nothing this change introduces is persisted, which is itself a modelled fact rather than an omission. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Partial | This change adds no surface of its own, but it adds two things a user can notice: a job that sits in `queued` because the cap is full, and a call refused because the object changed while an approval was waiting. What those are called on screen is owned by `uix` and `app`; that they must be explainable rather than silent is stated as a requirement here, and the wording is a manual check in `verification.md`. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | The queue latencies, the concurrency scaling matrix and the head-of-line comparison are VERIFIED in `spikes/SP-15-concurrency/REPORT.md` §1 Q3 and Q4. Two quantities in the proposal are recommendations of that report rather than measurements of it — the interactive-to-background weight and the minimum share guaranteed to background jobs — and Q-5 records them as unverified rather than promoting them to thresholds. |
| Integration & external dependencies (external services, formats, versions) | Clear | No new external service. The coordinator sits between the wrapping layer and `connector/contracts/connector-adapter@1.0.0`, and reads its per-tool and per-connector declarations from the manifest, which requires the additive manifest bump recorded in `evolution.md` and `impact.md`. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | The failure this change exists to prevent was reproduced and measured with and without the lock — `spikes/SP-15-concurrency/REPORT.md` §1 Q2. The cases the spike did not run are decided rather than measured and are named as such: a lock that cannot be obtained within the wait limit (Q-1), an approval that outlives the state it was granted against (Q-1), and two jobs that need the same two resources in opposite orders (Q-1). |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | The serialise-everything option is stated and rejected in the proposal. The ordering constraint that dominates every alternative — the lock must be held from before the snapshot until the result record is durable — is measured rather than argued, and Q-1 records what had to give way once it met an approval wait that has no time limit. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | "Coordinator" for the component, "resource key" for what a lock is taken on, "lease" for a held lock, "bracket" for the span from acquisition to release, "admission slot" for the concurrency cap's unit. The spike's word `pending` is deliberately not used: the existing `job` lifecycle already has `queued` and Q-3 keeps it. "Gateway" from the spike report survives only as prose; the entity is the coordinator. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | The spike's own harnesses — the dirty-snapshot reproduction, the queue benchmark and the concurrency scaling matrix — become the acceptance evidence, with two new suites for the cases the spike did not run. `verification.md` carries them with their sources. |
| Placeholders (TODOs, unquantified adjectives) | Clear | No placeholder survives into the specs. Where a number is a recommendation rather than a measurement it is written as a declared default with its status, not as a threshold. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | Everything this change creates lives in memory in one process and dies with it, which is a decision rather than an accident: a lock that survived the process would outlive the job that held it. `model.md` records the structures, their bounds and what a restart finds — nothing, deliberately. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Settled by Q-2 and Q-4: a connector declares which of a tool's arguments name the resources it touches and how they are normalised, and declares its own concurrency and pacing policy. Both are manifest fragments under `connector/contracts/coordination-declaration@0.1.0`, so the Nth platform coordinates correctly without the coordinator learning about it, which is principle VI. A missing declaration on a writing tool is refused at registration — the fail-closed direction, since the alternative is a write nobody can lock. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | The coordinator is one instance in the one process that owns the ledger, the gate and the connectors. No window process can reach it, and no worker agent holds a route to a platform that bypasses it; `design.md` records the boundary and `specs/connector/spec.md` states the observable consequence. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | Three degraded paths are specified rather than implied: a resource held by another job, an approval whose basis went stale, and a coordinator that cannot admit work. All three fail closed — no platform call is made — and all three are recorded, so the ledger explains the pause. What an interrupted call means afterwards is unchanged and stays owned by `job/contracts/tool-reconciliation@0.1.0`. |

## Sessions

### Session 2026-09-12 — decisions delegated to the drafting agent

The decision-maker directed that these questions be answered by the agent rather than put to them one at a time,
choosing the option that best fits `docs/raw-idea/prd-mvp.md` and `docs/spec/constitution.md`. Each answer below
records the option chosen, the alternatives rejected, and the evidence or principle that settled it, so any one
of them can be overturned by reading this file alone. Every answer is reflected in exactly one artifact outside
this log.

- Q-1: What exactly does the exclusive bracket cover, given that a call may be held for approval for an
  unbounded time between the snapshot and the execution? → A: **The bracket acquires every resource the call
  declared, all at once and in canonical order, before the before-state is read; it is released when the result
  record is durable; and a verdict of `hold` releases it while the user decides, after which it is re-acquired
  and the recorded before-state re-verified against the target before anything executes.** A target that changed
  during the wait does not execute: the call returns a refusal naming the change, which the agent may re-plan
  around, and the refusal is recorded. This keeps the measured guarantee intact — no call executes unless the
  state its ledger record claims was captured under exclusive access that was either held continuously or
  re-established and re-checked — while refusing to make one user's deliberation block every other job on the
  same object. It also closes a failure the spike did not test but which its evidence implies: an approval that
  waits twenty minutes produces exactly the stale snapshot of
  `spikes/SP-15-concurrency/REPORT.md` §1 Q2 with the user's own wait in place of the racing job. Acquiring all
  declared resources at once, in the canonical order of their keys, is the spike's own deadlock mitigation
  (`spikes/SP-15-concurrency/REPORT.md#4-rui-ro-moi-phat-hien`, RISK-049); acquiring them one at a time as a call
  discovers them is what makes two jobs able to hold one resource each and wait on the other.
  Rejected: **holding the lease across the approval wait**, which is trivially correct and makes every competing
  job fail on the fifteen-second wait limit for a reason the user cannot see or fix, turning one person's pause
  into a product-wide stall; and **moving the gate's verdict before the intent record**, which would let the
  bracket start after the verdict and keep it short, but contradicts the living requirement that a refused call
  still leaves an intent record and a refusal record — VERIFIED in `spikes/SP-6-pi-sdk/REPORT.md` §1 Q2 and
  specified in `approval` — and would erase the history's account of what an agent attempted and was stopped
  from doing.
  (patched: `specs/ledger/spec.md`, the requirement on exclusive capture; `contracts/resource-coordinator.md`;
  `design.md` D1 and D2)
- Q-2: What names a resource, and who computes that name? → A: **`<connector>:<type>:<id>`, computed by the
  coordinator from the argument path the tool declared, normalised by the rule the connector declared, and never
  including the authorisation.** The key is derived from the same argument the adapter will address, so a model
  cannot lock one object and write another; it is not a value the model supplies. The authorisation is excluded
  because two authorisations may reach the same object, and a key that separated them would leave the product
  believing it held exclusive access it did not have — the exact condition
  `spikes/SP-15-concurrency/REPORT.md` §1 Q1 measured as silent last-write-wins. Normalisation is declared per
  connector because identifier forms are a platform's business: the measured platform accepts the same page
  identifier with and without separators, and two spellings of one object must not become two keys.
  Rejected: **letting the tool call carry its own key**, which puts an untrusted, model-produced string in the
  position of deciding what is protected; **keying per authorisation**, for the reason above; and **keying per
  connector only**, which is correct but serialises every call to a platform and gives away the parallelism the
  product promises.
  (patched: `contracts/coordination-declaration.md`; `specs/connector/spec.md`, the requirement on resource
  identity; `model.md` INV-CN-15)
- Q-3: Does a job held back by the concurrency cap need a lifecycle state of its own, as the spike's `pending`
  suggests? → A: **No. The cap is admission control over the existing `queued` state, and an admission slot is
  held only while a job is `running`.** The `job` lifecycle is a fixed, closed set, and adding a synonym for a
  state that already means "created, not yet running" would give the product two words for one condition and
  force every surface that renders job state to learn the difference. Holding the slot only during `running` is
  the same rule the time limit already follows — waiting for a human does not consume the job's execution
  budget — and it means an approval wait cannot pin a slot shut, which matters because Q-1 already releases the
  lease at that moment for the same reason.
  Rejected: **adding `pending`**, which is vocabulary, not behaviour; and **counting jobs in the waiting states
  against the cap**, which would let three unanswered approval requests stop all work on a connector while the
  platform sits idle.
  (patched: `specs/job/spec.md`, the parallel-execution requirement; the proposal's Capabilities section, whose
  wording said "pending state")
- Q-4: What is the concurrency cap, and where is it declared? → A: **Four concurrent jobs per connector account
  by default, of which one slot is reserved for a job the user started, declared per connector in the manifest's
  rate policy and falling back to the default when a connector declares nothing.** The measured band is the
  source: three jobs completed in 1,725 ms with no refusal and the longest queue wait at 1,327 ms; five reached
  3,620 ms with waits to 3,332 ms and still no refusal; eight crossed into refusals at about five percent and a
  7.5-second completion — `spikes/SP-15-concurrency/REPORT.md` §1 Q4. Four sits inside the measured comfortable
  band rather than at its edge, and the reserved slot is what keeps a command typed into the dialog box from
  queueing behind a bulk job that filled every slot. Declaring it per connector follows principle VI: a platform
  with a different tolerance is a manifest edit, not a change to the job manager.
  Rejected: **a single global cap across all connectors**, which is either too strict for a fast platform or too
  loose for a slow one, and which was not what was measured; **deriving the cap from the declared request rate
  alone**, which ignores that a job's cost is several calls and a human's patience is the real limit; and
  **making the cap user-configurable in this change**, which offers the user a number they have no basis to
  choose.
  (patched: `specs/job/spec.md`, the parallel-execution requirement; `contracts/coordination-declaration.md`;
  `evolution.md`, the manifest bump this requires)
- Q-5: Is the queue's fairness specified as a mechanism or as a property, given that the measurement covers
  round-robin but not the weighting the proposal describes? → A: **As a property, with the mechanism named as
  the way it is met and its unmeasured numbers declared as defaults rather than thresholds.** The requirement is
  that a job's wait does not grow with another job's backlog and that no job is starved; the mechanism is
  round-robin across per-job queues behind a token bucket paced at the connector's declared rate, with a weight
  per job class and a floor guaranteeing the background class a share of dispatches. What is VERIFIED is the
  property and the round-robin that produced it: an interactive job's wait fell from 4,251 ms to 252 ms against
  a first-in-first-out queue, 11.7 times faster, while the bulk job it ran against lost about sixteen percent —
  `spikes/SP-15-concurrency/REPORT.md` §1 Q3. What is **not** verified is the interactive-to-background weight
  and the twenty percent floor: both appear in the report as recommendations
  (`spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 2 and
  `#4-rui-ro-moi-phat-hien`, RISK-050), and neither was run. They are therefore carried as declared defaults to
  be measured during implementation, and `verification.md` states them as unverified rather than as numbers the
  product must hit.
  Rejected: **writing the weights into the requirement**, which would make an unmeasured number a specification
  the first measurement could only contradict; and **specifying plain round-robin only**, which is what was
  measured but leaves RISK-050 — a stream of short interactive jobs starving a long bulk job — with no mechanism
  attached at all.
  (patched: `specs/connector/spec.md`, the fair-dispatch requirement; `verification.md` Thresholds)

## Assumptions

- The cap is per connector account, not global, as the proposal already assumes. A user connected to several
  platforms may therefore run more jobs in aggregate than any single cap, which is correct: the limit exists
  because of one platform's pacing, and two platforms do not share a rate budget.
- Locks are device-local. Two devices signed in to the same account can hold what they each believe is exclusive
  access to one object, because nothing in this change crosses the replication boundary. This is the roadmap's
  own scope boundary for R12 — cross-device locking is deferred to the change that owns the account
  (`req-022-account-sync`) — and it is recorded as a reserved variability point in `model.md` rather than left
  unsaid.
- Read operations take no lease. Only a write, and the before-state read that belongs to it, are bracketed. A
  read that waited on every write would serialise the product for no correctness gain: the failure measured in
  `spikes/SP-15-concurrency/REPORT.md` §1 Q2 is a stale *recorded* snapshot, and nothing records a snapshot for a
  read.
- Reentrancy is per job and per key, as the spike specifies. A job that already holds a key and needs it again
  for a nested call obtains it without waiting; this is what stops a job deadlocking against itself, and it is
  bounded by the job, not by the call.
- The measured numbers come from one platform. Both the pacing and the scaling matrix were measured against the
  platform the spike used; another connector's tolerance is declared in its manifest and is unmeasured until
  someone measures it. Nothing here states a cross-platform threshold.

## Open

None blocking any artifact of this change.

- Q-6: What weight and what minimum share actually balance an interactive job's responsiveness against a bulk
  job's progress? — blocking: nothing in planning; the specs state the property and the contract states the
  defaults, so only the numbers move — decided by: measurement during implementation, using the queue benchmark
  named in `verification.md` extended with a starvation case, since
  `spikes/SP-15-concurrency/REPORT.md` §1 Q3 measured round-robin without weights.
- Q-7: Should the coordinator refuse to admit new work when the queue for one authorisation grows beyond a
  depth, rather than letting it grow? — blocking: nothing; the current specification bounds waiting per call
  through the wait limit and bounds jobs through the cap, which together bound depth indirectly — decided by:
  measurement of real queue depth once bulk jobs exist, since no measurement of depth under a realistic bulk
  workload exists.

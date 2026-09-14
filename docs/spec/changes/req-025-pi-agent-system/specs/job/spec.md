## ADDED Requirements

### Requirement: A child job is created through the Job Manager and never commanded

An agent whose role entry permits delegation SHALL obtain additional work only by creating a child job through
the Job Manager, the created record SHALL carry the identifier of the job that created it, and no agent SHALL
step, instruct, interrupt or read the working state of another agent's run.

The mechanism is deliberately the one that already exists: a delegating agent calls the same job-creation path
the pet-agent calls, and receives a job identifier rather than a handle to a running agent. What distinguishes a
child from any other job is one recorded field, the parent it names.

Source: `docs/spec/constitution.md` principle I; the reference architecture's delegation model was read and
deliberately not adopted — it has a parent that spawns, steers and collects from live workers
(`https://omp.sh/docs/subagents`, UNVERIFIED), which is the control loop principle I forbids. Decided in
`clarifications.md` session 2026-09-13 — UNVERIFIED, a constitutional reading rather than a measurement.

#### Scenario: A worker splits work across three targets
- **GIVEN** a job must update tasks in three separate databases and its role permits delegation
- **WHEN** the agent delegates
- **THEN** three child jobs exist, each carrying this job as its parent, and the parent holds three job
  identifiers rather than three agent handles

#### Scenario: A parent attempts to steer a running child
- **WHEN** an agent issues anything other than job creation, status reading or cancellation against a child
- **THEN** no such operation exists for it to issue, and the attempt fails as an unknown tool

#### Scenario: A role that may not delegate
- **GIVEN** a role entry whose delegation permission is absent
- **WHEN** its agent attempts to create a job
- **THEN** the call is refused and the job continues without delegating, because the permission is a property of
  the declared role and not of the request

#### Scenario: A child is indistinguishable from any other job to the machinery that runs it
- **WHEN** a child job is queued, gated, recorded or recovered
- **THEN** it passes through the same queue, the same gate, the same ledger obligation and the same recovery as
  a job the user created

### Requirement: A child's report reaches its parent as data

The result a child job returns to its parent SHALL be treated as external content: it SHALL NOT authorise an
operation, relax an approval decision, alter the rules the parent operates under, or widen the parent's tool
allowlist.

Source: `docs/spec/constitution.md` § External Content Is Data; the isolation of untrusted content inside tool
arguments is VERIFIED for the existing carriers
(`spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi` Q2) — UNVERIFIED for this carrier, which is why
`verification.md` schedules it.

#### Scenario: A child reports that an operation was approved
- **GIVEN** a child job's report states that the user approved a bulk archive
- **WHEN** the parent issues that operation
- **THEN** the gate evaluates it exactly as it would have without the report, and the report grants nothing

#### Scenario: A child's report carries instructions read from a platform
- **GIVEN** a child read a page whose text instructs the reader to disable a rule
- **WHEN** that text reaches the parent inside the child's report
- **THEN** it is carried as quoted data, and no rule, allowlist or approval state changes

### Requirement: Delegation depth and fan-out are bounded

A job created by an agent SHALL NOT itself create further jobs, a job SHALL NOT hold more unfinished children
than the declared fan-out limit, and a creation beyond either bound SHALL be refused with the bound named
rather than queued.

The declared bounds are one level of depth and four unfinished children.

Source: the bounds are UNVERIFIED product choices recorded in `clarifications.md` session 2026-09-13. They rest
on a measured neighbour: eight concurrent jobs against one connector account crossed into platform refusals at
about five percent, while three completed cleanly — `spikes/SP-15-concurrency/REPORT.md` §1 Q4 (VERIFIED). The
reference architecture's defaults are deeper and wider — two levels and thirty-two concurrent workers
(`https://omp.sh/docs/subagents`, UNVERIFIED) — and were not adopted, because depth multiplies against a pacing
budget whose refusal threshold this project has measured.

#### Scenario: A child attempts to delegate
- **WHEN** an agent running a child job attempts to create a job
- **THEN** the creation is refused, the depth bound is named in the refusal, and the child continues its own
  work

#### Scenario: The fifth child
- **GIVEN** a job holds four unfinished children
- **WHEN** its agent creates another
- **THEN** the creation is refused with the fan-out bound named, rather than being queued behind the others

#### Scenario: A finished child releases fan-out
- **GIVEN** a job holds four unfinished children and one reaches a terminal state
- **WHEN** its agent creates another child
- **THEN** the creation succeeds

### Requirement: A parent waits for its children without holding a connector slot

A job with unfinished children and no work of its own SHALL occupy the state `waiting_children`, SHALL release
its connector concurrency slot while in that state, SHALL NOT consume its own time limit while in it, and SHALL
return to `running` when every child has reached a terminal state.

Source: this mirrors the released-slot behaviour already required of `waiting_approval`, `waiting_input` and
`waiting_user_confirmation`, for the same measured reason — a job that holds a slot while waiting starves the
queue (`spikes/SP-15-concurrency/REPORT.md` §1 Q4, VERIFIED for the slot pressure; UNVERIFIED for this state,
which is a product choice recorded in `clarifications.md` session 2026-09-13).

#### Scenario: A parent with three children waits
- **GIVEN** a job created three children and has nothing else to do
- **WHEN** its state is read
- **THEN** it is `waiting_children`, its slot has been released, and a queued job for the same account has
  started

#### Scenario: The last child finishes
- **GIVEN** a job is `waiting_children` and its final child reaches a terminal state
- **WHEN** a slot for its account is free
- **THEN** the parent returns to `running` and reads its children's results from their job records

#### Scenario: A long wait does not exhaust the parent's limit
- **GIVEN** a parent spent 40 minutes in `waiting_children`
- **WHEN** its elapsed time is evaluated against its time limit
- **THEN** the waiting period is excluded, because the parent was not executing

#### Scenario: A parent that still has its own work
- **GIVEN** a job created a child and has further calls of its own to make
- **WHEN** its state is read
- **THEN** it is `running`, because `waiting_children` describes a job with nothing else to do

### Requirement: A child's failure is a result, not the parent's failure

When a child job reaches `failed` or `cancelled`, the parent SHALL receive that terminal state as the child's
result, SHALL remain able to continue, and SHALL decide what to report; the parent SHALL NOT be failed
automatically by a child's failure.

Source: UNVERIFIED — a product choice recorded in `clarifications.md` session 2026-09-13. Its rationale is the
existing requirement that a failed job lists what it completed and offers undo: a parent that died with its
child would lose the account of the two children that succeeded.

#### Scenario: One of three children fails
- **GIVEN** three children, of which one fails and two complete
- **WHEN** the parent resumes
- **THEN** the parent is `running`, holds all three results, and reports two successes and one failure with the
  failure's reason

#### Scenario: Every child fails
- **GIVEN** every child of a job failed
- **WHEN** the parent resumes
- **THEN** the parent decides its own outcome and, if it fails, its completed-operations list includes the
  operations its children completed before failing

#### Scenario: A child is cancelled by the user
- **GIVEN** the user cancelled one child directly
- **WHEN** the parent resumes
- **THEN** the cancellation is the child's result, and the parent is not cancelled

## MODIFIED Requirements

### Requirement: Job lifecycle states are fixed and timestamped

A job SHALL occupy exactly one of the states `created`, `queued`, `running`, `waiting_approval`,
`waiting_input`, `waiting_children`, `suspended`, `recovering`, `waiting_user_confirmation`, `done`, `failed` or
`cancelled`, SHALL move between `running` and the waiting or suspended states, SHALL enter `recovering` only at
a start that found one of its tool calls with no recorded outcome, SHALL enter `waiting_children` only while it
has an unfinished child job and no work of its own, and SHALL record a timestamp for every transition.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-03) — UNVERIFIED for the original states;
`spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-045) — VERIFIED for
`waiting_user_confirmation`; `req-013-sqlite-ledger` for `recovering`; `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q6 — VERIFIED for `suspended` which safely halts execution and releases memory when an inquiry times out;
`req-025-pi-agent-system` for `waiting_children` — UNVERIFIED, a product choice recorded in
`clarifications.md` session 2026-09-13.

#### Scenario: Approval interrupts and resumes a run
- **GIVEN** a job is `running`
- **WHEN** a tool call is blocked for approval and the user later approves it
- **THEN** the job moves to `waiting_approval` and back to `running`, and both transitions carry timestamps

#### Scenario: Terminal states are final
- **GIVEN** a job reached `done`
- **WHEN** any further event for that job arrives
- **THEN** the job stays `done` and the event is recorded against it rather than reopening it

#### Scenario: A job waits for the user to say what happened
- **GIVEN** a job's tool call has no recorded outcome and that tool's effect cannot be read back
- **WHEN** recovery classifies the job
- **THEN** the job is `waiting_user_confirmation`, and it leaves that state only on the user's answer

#### Scenario: Recovery is not a failure
- **GIVEN** a job is `recovering` because the platform has not yet been asked what happened
- **WHEN** the user looks at the job
- **THEN** it is presented as still being determined rather than as failed, and it moves to `running`, `done` or
  `failed` once the outcome is established

#### Scenario: Unanswered inquiry times out to suspended
- **GIVEN** a job is in `waiting_input`
- **WHEN** the 30-minute inquiry timeout expires without a response from the user
- **THEN** the job transitions to `suspended`, in-memory promises and listeners are deallocated, and the job is marked available for manual resumption

#### Scenario: A job with nothing to do but wait for its children
- **GIVEN** a job created two children and has no further calls of its own
- **WHEN** its state is recorded
- **THEN** it is `waiting_children` with a timestamp, and it returns to `running` when both children are
  terminal

#### Scenario: A job written before this state existed
- **GIVEN** a job record replicated from a device running an earlier assembly
- **WHEN** it is read
- **THEN** it carries no parent and never occupies `waiting_children`, and it is presented as a top-level job

### Requirement: Jobs run in parallel without shared context

Several jobs SHALL be able to run at the same time, each job SHALL hold its own context with no context shared
between jobs, at most the configured number of jobs — four by default, of which one slot is reserved for a job
the user started — SHALL be `running` at one time against one connector account, a child job SHALL draw on the
same per-account limit as every other job rather than on a budget of its own, and a job over that limit SHALL
remain `queued` until a slot is free.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-04) — UNVERIFIED; the source marks context
isolation as a proposal made for traceability. `spikes/SP-15-concurrency/REPORT.md` §1 Q4,
`spikes/SP-15-concurrency/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED for the limit's band: three concurrent
jobs on one account completed in 1,725 ms with the longest queue wait at 1,327 ms and no refusal for volume;
five reached 3,620 ms with waits to 3,332 ms; eight crossed into refusals at about five percent and a
7,533 ms completion. The default of four and the reserved slot are the choice recorded as Q-4 in
`clarifications.md`; that the limit uses the existing `queued` state rather than a new one is Q-3. That children
share the same budget is recorded in `req-025-pi-agent-system`, on the same measurement: a private budget per
parent is exactly how eight concurrent calls against one account would arise.

#### Scenario: Second command during a running job
- **GIVEN** a job is running
- **WHEN** the user hands over an unrelated command
- **THEN** a second job is created and both run concurrently

#### Scenario: One job fails without affecting the other
- **GIVEN** two jobs are running
- **WHEN** one fails
- **THEN** the other continues unaffected and its context is unchanged

#### Scenario: More jobs are created than the account allows to run
- **GIVEN** the configured number of jobs are already `running` against one connector account
- **WHEN** a further job that needs that account is created
- **THEN** it stays `queued` and starts when a slot is released, rather than running alongside and sharing the
  account's request budget with the others

#### Scenario: A command from the user arrives while background jobs fill the account
- **GIVEN** every unreserved slot for a connector account is taken by jobs the product started on its own
- **WHEN** the user hands over a command that needs the same account
- **THEN** that job starts in the reserved slot rather than queueing behind the background work

#### Scenario: Two connectors are not one budget
- **GIVEN** the limit for one connector account is reached
- **WHEN** a job is created that uses a different connector account only
- **THEN** it starts, because the limit exists for one platform's pacing and two platforms do not share one

#### Scenario: Waiting does not hold a slot
- **GIVEN** a job holding a slot moves to `waiting_approval`, `waiting_input`, `waiting_children` or
  `waiting_user_confirmation`
- **WHEN** another job is queued for the same connector account
- **THEN** the waiting job's slot is released and the queued job starts, and the waiting job takes a slot again
  when it resumes

#### Scenario: Four children against one account
- **GIVEN** a job created four children that all use the same connector account
- **WHEN** they are scheduled
- **THEN** they occupy the same four-slot limit as any other jobs, so some of them wait in `queued`, and the
  account never sees more concurrent work because the jobs happen to share a parent

#### Scenario: A child holds no context of its parent
- **GIVEN** a parent job read a document into its context before delegating
- **WHEN** the child runs
- **THEN** the child holds only what its creation record gave it, and nothing of the parent's transcript is
  present in the child's context or in the request the child sends to a model provider

### Requirement: Cancellation stops at a tool-call boundary

Cancelling a job SHALL stop it at the boundary between tool calls, SHALL NOT interrupt a call already in
flight, SHALL cancel every unfinished child of that job, and SHALL record the stopping point in the ledger.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-06) — UNVERIFIED. Child cancellation is
recorded in `req-025-pi-agent-system`: a child exists to serve its parent's work, so a parent the user stopped
must not leave work running against the user's accounts.

#### Scenario: Cancel while a write is in flight
- **GIVEN** a job is executing a write call
- **WHEN** the user cancels the job
- **THEN** the in-flight call completes and is recorded, and the job stops before the next call

#### Scenario: Stopping point is recoverable
- **WHEN** a job has been cancelled
- **THEN** the ledger identifies the last completed operation, so an undo can be offered over exactly that set

#### Scenario: Cancelling a parent stops its children
- **GIVEN** a job has two running children
- **WHEN** the user cancels the parent
- **THEN** both children stop at their own next tool-call boundary and are recorded as cancelled, and no child
  continues acting against the user's accounts

#### Scenario: Cancelling a child leaves the parent running
- **GIVEN** a job has two running children
- **WHEN** the user cancels one child
- **THEN** that child stops, the other continues, and the parent receives the cancellation as that child's
  result

### Requirement: A failed job explains itself and offers undo

A job that fails SHALL report a reason in language the user can act on, SHALL list the operations it completed
before failing — including the operations completed by its children — and SHALL offer to undo them.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-07) — UNVERIFIED. That a parent's account
covers its children's completed operations is recorded in `req-025-pi-agent-system`: the user delegated nothing
and asked for one outcome, so an undo offer that stopped at the parent's own calls would leave real changes
unoffered.

#### Scenario: Failure after partial work
- **GIVEN** a job created two tasks and then failed on the third
- **WHEN** the failure is presented
- **THEN** it states the reason, lists the two created tasks, and offers to undo them

#### Scenario: Failure with nothing done
- **GIVEN** a job failed before any write
- **WHEN** the failure is presented
- **THEN** it states the reason and offers no undo, because there is nothing to compensate

#### Scenario: A parent fails after its children wrote
- **GIVEN** two children each created a task and the parent then failed
- **WHEN** the failure is presented
- **THEN** the two tasks the children created are listed among the completed operations and the undo offer
  covers them

#### Scenario: A child failed and the parent completed
- **GIVEN** one child failed after writing one task, and the parent afterwards reached `done`
- **WHEN** the outcome is presented
- **THEN** the parent reports its own success together with the child's failure, and the child's completed
  write is available to undo

### Requirement: No job is lost across a crash

After a crash, every job SHALL be reconstructed from the ledger on the next start and SHALL either resume
safely, move to `recovering` until its outcome is established, move to `waiting_user_confirmation`, or move to
`failed` with the operations it completed; a job SHALL never disappear, a job whose last tool call has no
recorded outcome SHALL NOT resume until that outcome is established, and a parent SHALL NOT be concluded while
any of its children is still unresolved.

Source: `docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` (NFR-RL-01),
`spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q4 — VERIFIED; the process was killed at five points across the life
of one tool call on both operating systems, no job was lost at any of them, and the state before and after the
external call was distinguished correctly every time. The clause about children is recorded in
`req-025-pi-agent-system` — UNVERIFIED, and scheduled for measurement in this change's `verification.md`.

#### Scenario: Crash between the intent record and the call
- **GIVEN** the ledger holds an intent record with no result record
- **WHEN** the application starts again
- **THEN** recovery determines whether the external operation happened before deciding to resume or fail, and
  never repeats the call blindly

#### Scenario: The platform still holds the state the record captured
- **GIVEN** an intent record with no result record, for a tool whose effect can be read back
- **WHEN** the platform is read and its state matches the state the intent record captured before the call
- **THEN** the call is concluded not to have happened, a record of the interruption is appended, and the job
  moves to `failed` with what it completed

#### Scenario: The platform already holds the result the call intended
- **GIVEN** an intent record with no result record, for a tool whose effect can be read back
- **WHEN** the platform is read and already holds what the call intended
- **THEN** the missing result record is appended, marked as established by reconciliation rather than observed
  directly, and the job moves to `done` without the call being made again

#### Scenario: Effect that cannot be read back
- **GIVEN** an unresolved intent record for an operation whose effect cannot be observed afterwards
- **WHEN** recovery runs
- **THEN** the job moves to a state that asks the user to confirm what happened, rather than retrying

#### Scenario: The platform cannot be reached at the time of recovery
- **GIVEN** an unresolved intent record for a tool whose effect can be read back
- **WHEN** the device has no network at the time recovery runs
- **THEN** the job stays `recovering`, no call is repeated, and the rest of the product remains usable

#### Scenario: The user was answered before the platform was asked
- **GIVEN** a job in `waiting_user_confirmation`
- **WHEN** the user states what happened
- **THEN** the answer is recorded as a decision record and the job moves on from it, and no reconciliation
  overwrites the user's statement afterwards

#### Scenario: A crash with children in flight
- **GIVEN** a parent in `waiting_children` and two children that were `running` when the process stopped
- **WHEN** the application starts again
- **THEN** each child is recovered on its own terms, the parent returns to `waiting_children` until both are
  terminal, and the parent is not concluded from the children's absence

#### Scenario: A child was lost but the parent was not
- **GIVEN** a parent record naming a child for which no job record exists
- **WHEN** recovery runs
- **THEN** the parent is not concluded silently: the missing child is recorded as an unresolved outcome and the
  parent moves to the state that asks the user what happened

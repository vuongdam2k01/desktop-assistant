# job Specification

## Purpose
Owns the lifecycle of a unit of work from creation through queueing, running, waiting for approval or input, to completion, failure or cancellation — including parallel execution limits, timeouts, and recovery of jobs that were in flight when the application stopped.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#14-kien-truc-he-thong-amp-technology-stack` — UNVERIFIED (background material, not measured evidence).

## Requirements

### Requirement: Job lifecycle states are fixed and timestamped

A job SHALL occupy exactly one of the states `created`, `queued`, `running`, `waiting_approval`,
`waiting_input`, `suspended`, `recovering`, `waiting_user_confirmation`, `done`, `failed` or `cancelled`, SHALL move between
`running` and the waiting or suspended states, SHALL enter `recovering` only at a start that found
one of its tool calls with no recorded outcome, and SHALL record a timestamp for every transition.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-03) — UNVERIFIED for the original states;
`spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-045) — VERIFIED for
`waiting_user_confirmation`; `req-013-sqlite-ledger` for `recovering`; `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q6 — VERIFIED for `suspended` which safely halts execution and releases memory when an inquiry times out.

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

### Requirement: Jobs run in parallel without shared context

Several jobs SHALL be able to run at the same time, each job SHALL hold its own context with no context shared
between jobs, at most the configured number of jobs — four by default, of which one slot is reserved for a job
the user started — SHALL be `running` at one time against one connector account, and a job over that limit SHALL
remain `queued` until a slot is free.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-04) — UNVERIFIED; the source marks context
isolation as a proposal made for traceability. `spikes/SP-15-concurrency/REPORT.md` §1 Q4,
`spikes/SP-15-concurrency/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED for the limit's band: three concurrent
jobs on one account completed in 1,725 ms with the longest queue wait at 1,327 ms and no refusal for volume;
five reached 3,620 ms with waits to 3,332 ms; eight crossed into refusals at about five percent and a
7,533 ms completion. The default of four and the reserved slot are the choice recorded as Q-4 in
`clarifications.md`; that the limit uses the existing `queued` state rather than a new one is Q-3.

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
- **GIVEN** a job holding a slot moves to `waiting_approval`, `waiting_input` or `waiting_user_confirmation`
- **WHEN** another job is queued for the same connector account
- **THEN** the waiting job's slot is released and the queued job starts, and the waiting job takes a slot again
  when it resumes

### Requirement: Cancellation stops at a tool-call boundary

Cancelling a job SHALL stop it at the boundary between tool calls, SHALL NOT interrupt a call already in
flight, and SHALL record the stopping point in the ledger.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-06) — UNVERIFIED.

#### Scenario: Cancel while a write is in flight
- **GIVEN** a job is executing a write call
- **WHEN** the user cancels the job
- **THEN** the in-flight call completes and is recorded, and the job stops before the next call

#### Scenario: Stopping point is recoverable
- **WHEN** a job has been cancelled
- **THEN** the ledger identifies the last completed operation, so an undo can be offered over exactly that set

### Requirement: A failed job explains itself and offers undo

A job that fails SHALL report a reason in language the user can act on, SHALL list the operations it completed
before failing, and SHALL offer to undo them.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-07) — UNVERIFIED.

#### Scenario: Failure after partial work
- **GIVEN** a job created two tasks and then failed on the third
- **WHEN** the failure is presented
- **THEN** it states the reason, lists the two created tasks, and offers to undo them

#### Scenario: Failure with nothing done
- **GIVEN** a job failed before any write
- **WHEN** the failure is presented
- **THEN** it states the reason and offers no undo, because there is nothing to compensate

### Requirement: Transient failures are retried under a bounded policy

A job SHALL retry a transient failure — rate limiting, network timeout, or a resource held by another job — at
most three times with increasing delay, SHALL record every retry in the ledger, and SHALL classify a failure as
transient or permanent from the connector error code the adapter declared or the coordinator error code the
coordinator declared, rather than by inspecting the platform's message.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-08, priority Should),
`docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` (NFR-RL-02) — UNVERIFIED for the retry count and the delays;
`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q10),
`spikes/SP-19-connector-framework/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` — VERIFIED that a withdrawn
authorisation surfaced as its own declared code and ended the job cleanly rather than being retried;
`spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — VERIFIED that a call which cannot
obtain a held resource within the wait limit is reported under its own code precisely so that it is retried with
backoff rather than failing the job.

#### Scenario: Rate limit clears on the second attempt
- **GIVEN** the platform returns a rate-limit response
- **WHEN** the job retries after the backoff interval and the call succeeds
- **THEN** the job continues and the ledger holds a record for each attempt

#### Scenario: Retries are exhausted
- **WHEN** three retries have failed
- **THEN** the job fails with the underlying reason and the completed-operations list

#### Scenario: A permanent error is not retried
- **GIVEN** the platform returns a permission error
- **WHEN** the failure is classified
- **THEN** the job fails immediately without consuming retries

#### Scenario: The authorisation was withdrawn while the job was running
- **GIVEN** a job is running and the user withdrew the connector's authorisation at the platform
- **WHEN** the next tool call returns the withdrawn-authorisation code
- **THEN** the job fails at that call with its completed-operations list and a route to reconnect, and no retry
  is attempted

#### Scenario: A failure arrives with no declared code
- **WHEN** a call fails in a way that carries no connector error code
- **THEN** it is treated as permanent, because a failure whose nature is unknown is not evidence that repeating
  it is safe

#### Scenario: The resource was held by another job
- **GIVEN** a call was refused because another job held the resource it declared
- **WHEN** the failure is classified
- **THEN** it is transient and retried with increasing delay, and the job fails only once the retries are
  exhausted, naming the job that held the resource

#### Scenario: A held resource is not a platform fault
- **WHEN** a call is refused because a resource was held
- **THEN** the connector is not presented as failing or unhealthy, because nothing about the platform was
  observed

### Requirement: A job ends when it exceeds its time limit

A job SHALL fail when it exceeds its configured time limit, which defaults to 10 minutes, and SHALL report that
failure with the completed-operations list.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-09) — UNVERIFIED; the source marks the
10-minute default as proposed.

#### Scenario: Long job is stopped
- **GIVEN** a job has run for the configured limit
- **WHEN** the limit is reached
- **THEN** the job moves to `failed` and reports what it completed

#### Scenario: Waiting does not consume the limit
- **GIVEN** a job spent 40 minutes in `waiting_approval`
- **WHEN** the elapsed time is evaluated against the limit
- **THEN** the waiting period is excluded, because the user's response time is not the job's execution time

### Requirement: No job is lost across a crash

After a crash, every job SHALL be reconstructed from the ledger on the next start and SHALL either resume
safely, move to `recovering` until its outcome is established, move to `waiting_user_confirmation`, or move to
`failed` with the operations it completed; a job SHALL never disappear, and a job whose last tool call has no
recorded outcome SHALL NOT resume until that outcome is established.

Source: `docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` (NFR-RL-01),
`spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q4 — VERIFIED; the process was killed at five points across the life
of one tool call on both operating systems, no job was lost at any of them, and the state before and after the
external call was distinguished correctly every time.

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

### Requirement: A simple job completes within the expected time

A job that performs a single straightforward operation SHALL complete end to end with a median duration of at
most 30 seconds.

Source: `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` (NFR-PF-05); `spikes/SP-4-agent-loop/REPORT.md` §1 Q4 — VERIFIED;
the measured median duration across 7 simple job runs on real Notion was 16.9 seconds, well within the 30-second
threshold.

#### Scenario: Creating one task
- **WHEN** the user hands over a command that creates a single task and the job runs to completion
- **THEN** the median measured duration across repeated runs is at most 30 seconds

### Requirement: A job establishes its connectors' authorisation before it starts

Before a job's first tool call, the job SHALL establish that every connector it may use holds a currently
accepted authorisation, SHALL renew one whose remaining validity is below the configured margin, and SHALL NOT
start when a connector it requires cannot be renewed without the user.

Source: `spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED that an expiry falling
inside a tool sequence costs an unplanned renewal round trip of roughly 300 ms; the pre-flight check is the
spike's recommendation for the first milestone, and the margin's default value is recorded as unmeasured in this
change's `verification.md`.

#### Scenario: The authorisation would expire mid-sequence
- **GIVEN** a connector's authorisation has less remaining validity than the configured margin
- **WHEN** a job that uses it is about to start
- **THEN** the authorisation is renewed first, and the job's tool calls run against the renewed one

#### Scenario: The authorisation cannot be renewed without the user
- **GIVEN** a connector is expired and the device holds no means to renew it
- **WHEN** a job that requires it is created
- **THEN** the job does not start, the user is told which connector must be reconnected, and no partial work is
  performed

#### Scenario: A long job outlives the margin anyway
- **GIVEN** a job checked its connectors at the start and has run longer than the authorisation's validity
- **WHEN** a later tool call meets an expired authorisation
- **THEN** the authorisation is renewed at that point and the call proceeds, because the pre-flight check is a
  reduction of the risk and not a guarantee

#### Scenario: The connector is one the job never uses
- **GIVEN** a connector is expired and the job uses no tool from it
- **WHEN** the job starts
- **THEN** it runs normally, because only the connectors a job may use are established first

### Requirement: A job suspended on input resumes without repeating completed steps

A job that was transitioned to `suspended` while in `waiting_input` SHALL resume when the user provides an answer, transitioning back to `running` with the answer appended to the agent session transcript, and SHALL NOT re-execute any tool call or reasoning step that was completed prior to the suspension.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q3, Q6 — VERIFIED in both in-flight async suspension and cold checkpoint persistence that resuming a job after input completes remaining steps with zero repetition of earlier reads or actions.

#### Scenario: In-flight suspension and resumption
- **GIVEN** a running job executed step 1 (`read_tasks`) and entered `waiting_input` at step 2 (`ask_user`)
- **WHEN** the user selects an option
- **THEN** the job resumes execution at step 3 (`write_task`), and the count of executions for step 1 remains exactly one

#### Scenario: Resumption after application restart
- **GIVEN** a job was saved to disk in `waiting_input` and the application process terminated
- **WHEN** the application starts again and the user submits an answer to the pending question
- **THEN** an agent instance is initialized from the checkpointed transcript with the answer injected, step 1 is not re-executed, and the remaining steps complete successfully

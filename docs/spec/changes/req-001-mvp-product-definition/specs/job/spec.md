## ADDED Requirements

### Requirement: Job lifecycle states are fixed and timestamped

A job SHALL occupy exactly one of the states `created`, `queued`, `running`, `waiting_approval`,
`waiting_input`, `done`, `failed` or `cancelled`, SHALL move between `running` and the two waiting states in
both directions, and SHALL record a timestamp for every transition.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-03) — UNVERIFIED.

#### Scenario: Approval interrupts and resumes a run
- **GIVEN** a job is `running`
- **WHEN** a tool call is blocked for approval and the user later approves it
- **THEN** the job moves to `waiting_approval` and back to `running`, and both transitions carry timestamps

#### Scenario: Terminal states are final
- **GIVEN** a job reached `done`
- **WHEN** any further event for that job arrives
- **THEN** the job stays `done` and the event is recorded against it rather than reopening it

### Requirement: Jobs run in parallel without shared context

Several jobs SHALL be able to run at the same time, and each job SHALL hold its own context with no context
shared between jobs.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-04) — UNVERIFIED; the source marks context
isolation as a proposal made for traceability.

#### Scenario: Second command during a running job
- **GIVEN** a job is running
- **WHEN** the user hands over an unrelated command
- **THEN** a second job is created and both run concurrently

#### Scenario: One job fails without affecting the other
- **GIVEN** two jobs are running
- **WHEN** one fails
- **THEN** the other continues unaffected and its context is unchanged

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

A job SHALL retry a transient failure — rate limiting or network timeout — at most three times with increasing
delay, and SHALL record every retry in the ledger.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-08, priority Should),
`docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` (NFR-RL-02) — UNVERIFIED.

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

After a crash, every job SHALL be reconstructed from the ledger on the next start and SHALL either resume safely
or move to `failed` with the operations it completed; a job SHALL never disappear.

Source: `docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` (NFR-RL-01) — UNVERIFIED; recovery is measured in
`req-013-sqlite-ledger`.

#### Scenario: Crash between the intent record and the call
- **GIVEN** the ledger holds an intent record with no result record
- **WHEN** the application starts again
- **THEN** recovery determines whether the external operation happened before deciding to resume or fail, and
  never repeats the call blindly

#### Scenario: Effect that cannot be read back
- **GIVEN** an unresolved intent record for an operation whose effect cannot be observed afterwards
- **WHEN** recovery runs
- **THEN** the job moves to a state that asks the user to confirm what happened, rather than retrying

### Requirement: A simple job completes within the expected time

A job that performs a single straightforward operation SHALL complete end to end with a median duration of at
most 30 seconds.

Source: `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` (NFR-PF-05) — UNVERIFIED; the source marks the threshold as
proposed pending spike measurement, and `req-006-agent-loop` supplies the measured figure.

#### Scenario: Creating one task
- **WHEN** the user hands over a command that creates a single task and the job runs to completion
- **THEN** the median measured duration across repeated runs is at most 30 seconds

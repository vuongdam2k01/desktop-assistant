## MODIFIED Requirements

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

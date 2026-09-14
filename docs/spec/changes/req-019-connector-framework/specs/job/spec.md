## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Transient failures are retried under a bounded policy

A job SHALL retry a transient failure — rate limiting or network timeout — at most three times with increasing
delay, SHALL record every retry in the ledger, and SHALL classify a failure as transient or permanent from the
connector error code the adapter declared rather than by inspecting the platform's message.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-08, priority Should),
`docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` (NFR-RL-02) — UNVERIFIED for the retry count and the delays;
`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q10),
`spikes/SP-19-connector-framework/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` — VERIFIED that a withdrawn
authorisation surfaced as its own declared code and ended the job cleanly rather than being retried.

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

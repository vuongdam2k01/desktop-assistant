## MODIFIED Requirements

### Requirement: Job lifecycle states are fixed and timestamped

A job SHALL occupy exactly one of the states `created`, `queued`, `running`, `waiting_approval`,
`waiting_input`, `recovering`, `waiting_user_confirmation`, `done`, `failed` or `cancelled`, SHALL move between
`running` and the three waiting states in both directions, SHALL enter `recovering` only at a start that found
one of its tool calls with no recorded outcome, and SHALL record a timestamp for every transition.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-03) — UNVERIFIED for the original states;
`spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-045) — VERIFIED for
`waiting_user_confirmation`, which is where a job goes when its effect cannot be read back and retrying it might
send a second message. `recovering` is added by
`docs/spec/changes/req-013-sqlite-ledger/clarifications.md` Q-5: a job whose outcome is still being determined
is stopped for a reason the user can be told, and that reason is neither a failure nor a question for the user.

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

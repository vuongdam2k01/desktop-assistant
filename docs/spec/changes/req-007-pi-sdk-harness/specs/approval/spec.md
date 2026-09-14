## ADDED Requirements

### Requirement: A held call suspends the job durably at the call

When the gate returns hold for a call, the product SHALL write the run's completed turns to durable storage and
move the job to `waiting_approval` before the user is shown the request, SHALL NOT execute the call while the job
is in that state, and SHALL make the decision serve the same suspension whether the session is still in memory or
has to be rebuilt; a job whose held call has no recorded outcome SHALL be treated by start-up recovery exactly as
any other unresolved call is.

Source: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 and
`spikes/SP-6-pi-sdk/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 2 — VERIFIED for both the in-memory and the
rebuilt paths. That the durable transcript is the state and the in-memory suspension only an optimisation over it
was decided in `clarifications.md` session 2026-09-12; the recovery behaviour it defers to is specified by
`req-013-sqlite-ledger` in `specs/job` and `specs/platform`.

#### Scenario: The request is shown only after the turns are durable
- **WHEN** the gate holds a call
- **THEN** the completed turns are durable and the job is `waiting_approval` before the approval request appears
  on any surface

#### Scenario: The process stops while a call is held
- **GIVEN** a job was `waiting_approval` when the process stopped
- **WHEN** the product starts again
- **THEN** the held call is one of the unresolved calls the start-up pass classifies, the job is not resumable
  until it is decided, and the call has not been executed

#### Scenario: The decision arrives on another device
- **GIVEN** a job is `waiting_approval` on the device that created it
- **WHEN** the same account decides the request elsewhere
- **THEN** the call executes on the device that holds the suspension, and no second device executes it as well

#### Scenario: Nothing executes while waiting
- **GIVEN** a job is `waiting_approval`
- **WHEN** the agent's remaining plan is inspected
- **THEN** no further tool call has been issued, because the run is suspended at the held call rather than
  continuing past it

### Requirement: A denied call returns to the agent as a refusal, not as a fault

When the gate refuses a call or the user denies it, the wrapper SHALL return a refusal result to the agent naming
the operation and the rule that fired, the job SHALL remain able to continue and report, and the refusal SHALL
be recorded in the ledger; a failure to write the ledger record SHALL instead stop the call and fail the job, and
an evaluation failure SHALL be fail-closed for every write rather than for this call alone.

Source: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q2 — VERIFIED that a refusal leaves the implementation uninvoked and
writes an intent and a blocked record with no result record. The separation of the three failure modes was
decided in `clarifications.md` session 2026-09-12; the fail-closed behaviour of an evaluation failure is defined
by `approval/contracts/gate-evaluation@0.1.0` and the ledger precondition by `docs/spec/constitution.md`
principle III.

#### Scenario: The agent re-plans after a refusal
- **GIVEN** a call was refused by a rule
- **WHEN** the agent receives the refusal result
- **THEN** it may propose a different course and report to the user, and the job does not fail merely because a
  call was refused

#### Scenario: The refusal is recorded without a result
- **WHEN** a call is refused
- **THEN** the ledger holds the record of intent and a record of the refusal, and holds no result record for that
  call

#### Scenario: The ledger cannot be written
- **GIVEN** the ledger store refuses the record of intent
- **WHEN** the agent invokes a wrapped tool
- **THEN** the call does not execute, the job fails with the ledger failure as its stated reason, and no refusal
  result is fabricated in its place

#### Scenario: The gate cannot evaluate
- **GIVEN** the rule catalogue cannot be read or does not validate
- **WHEN** any agent invokes a wrapped tool that writes
- **THEN** every such call is refused across the product until the catalogue is repaired, rather than this one
  call being refused while others proceed

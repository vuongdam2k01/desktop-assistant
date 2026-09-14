## ADDED Requirements

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

## MODIFIED Requirements

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

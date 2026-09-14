## MODIFIED Requirements

### Requirement: Every worker tool is wrapped by the gate and the ledger obligation

Every tool registered for a worker-agent SHALL be wrapped so that the ledger record is written first, the
approval hook evaluates second, execution happens third and the result record is written fourth; the wrapper
SHALL hold the tool's executable implementation privately, so that the implementation is reachable only through
a wrapper that returned an allow verdict and is reachable by no other name, registry entry or message the agent
can produce; and the harness's own default coding tools SHALL NOT be registered for a worker-agent.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-02) — the wrapping mechanism is measured in
`req-007-pi-sdk-harness`. The private retention of the implementation and the closure of the eleven bypass
routes are VERIFIED (`spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi`, Q2).

#### Scenario: Unwrapped tool cannot exist
- **WHEN** the worker-agent's tool registry is enumerated
- **THEN** every entry is a wrapped tool, and no file-system or shell tool supplied by the harness is present

#### Scenario: Ledger write fails before a call
- **GIVEN** the ledger store cannot accept a write
- **WHEN** a worker-agent invokes a wrapped tool
- **THEN** the tool does not execute and the job fails with the ledger failure as its stated reason

#### Scenario: Agent transcript and ledger stay separate
- **WHEN** a worker-agent completes a job
- **THEN** the harness session transcript records the conversation and the ledger separately records each tool
  call, with neither substituting for the other

#### Scenario: A verdict other than allow never reaches the implementation
- **GIVEN** the gate returns refuse or hold-for-approval for a call
- **WHEN** the wrapper returns to the agent
- **THEN** the tool's implementation was never invoked, and the agent has no other route to it

#### Scenario: Agent names a tool that is not registered
- **WHEN** the agent issues a call naming a tool absent from the registry
- **THEN** the call fails as an unknown tool and nothing executes

#### Scenario: One tool attempts to invoke another
- **WHEN** a wrapped tool runs
- **THEN** it can reach only the platform it was generated for, and holds no reference by which it could invoke
  another tool or the agent harness

## ADDED Requirements

### Requirement: An answer to a question carries the refusal that preceded it

When an operation has been refused or held by the gate within a job, the agent SHALL NOT be able to obtain that
operation by asking the user, and the question the user sees SHALL carry the refused operation and the rule that
refused it, so that an answer is given in full knowledge of what was stopped.

Source: `docs/raw-idea/prd-mvp.md#a-5-co-che-ask-dac-ta-tool-ask-user` (A.5.7),
`docs/spec/constitution.md` principle II; the disclosure form was decided in `clarifications.md`
session 2026-09-12, replacing the phrase matching used in
`spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5, case A-14) — UNVERIFIED.

#### Scenario: Agent asks the user to perform the refused work by hand
- **GIVEN** the gate refused a bulk archive in this job
- **WHEN** the agent asks the user to carry it out themselves
- **THEN** the question reaches the user with the refusal and the rule attached, and the agent gains no
  permission from whatever the user answers

#### Scenario: Answering does not lift the refusal
- **GIVEN** the user answered a question in a job where an operation was refused
- **WHEN** the agent reissues that operation
- **THEN** it is evaluated again and refused again

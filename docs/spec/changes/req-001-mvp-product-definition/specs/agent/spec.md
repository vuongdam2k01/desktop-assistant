## ADDED Requirements

### Requirement: Pet-agent hands work over and never touches connectors

The pet-agent SHALL hold only the tools `create_job`, `get_job_status`, `cancel_job`, `notify_user` and
`ask_user`, and SHALL NOT hold or invoke any connector tool.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-01),
`docs/raw-idea/prd-mvp.md#6-cac-quyet-dinh-kien-truc-da-khoa` (QĐ-1) — UNVERIFIED.

#### Scenario: User asks the pet to change a task directly
- **GIVEN** a Notion connector is connected
- **WHEN** the user tells the pet to rename a task
- **THEN** the pet-agent creates a job for a worker-agent and does not call the Notion connector itself

#### Scenario: Pet-agent tool set is fixed
- **WHEN** the pet-agent's registered tools are enumerated
- **THEN** the set contains only the five named tools, regardless of how many connectors are connected

### Requirement: Every worker tool is wrapped by the gate and the ledger obligation

Every tool registered for a worker-agent SHALL be wrapped so that the ledger record is written first, the
approval hook evaluates second, execution happens third and the result record is written fourth; and the
harness's own default coding tools SHALL NOT be registered for a worker-agent.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-02) — UNVERIFIED; the wrapping mechanism is
measured in `req-007-pi-sdk-harness`.

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

### Requirement: A job is not created while key information is missing

When a command lacks information that is required to identify the target of the work, the pet-agent SHALL ask
one combined clarifying question and SHALL NOT create a job until the answer arrives.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-05) — UNVERIFIED.

#### Scenario: Ambiguous target database
- **GIVEN** the workspace holds three task databases and no default is configured
- **WHEN** the user says "add a task for tomorrow"
- **THEN** the pet-agent asks a single question identifying the choice, and no job exists yet

#### Scenario: Several gaps at once
- **GIVEN** both the target database and the deadline are unknown
- **WHEN** the pet-agent asks
- **THEN** it asks one question covering both, rather than two consecutive questions

### Requirement: Worker-agents run a multi-step agentic loop

A worker-agent SHALL run a multi-step loop of gathering context, planning, acting, verifying its own work and
reporting, SHALL be permitted to ask the user mid-run, and SHALL continue until the work is done or it fails.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-10),
`docs/spec/constitution.md` principle V — UNVERIFIED.

#### Scenario: Self-verification after a write
- **WHEN** a worker-agent creates a task
- **THEN** it reads the created object back and reports the verified result rather than reporting success from
  the call return alone

#### Scenario: Acceptance is measured across the whole process
- **WHEN** the agent's behaviour is evaluated
- **THEN** the measurement is the outcome of the entire multi-turn process, not the parse accuracy of the first
  turn

#### Scenario: Reliability is not obtained from input constraints
- **WHEN** a user phrases a command loosely
- **THEN** the agent uses its skills, rules, hooks and the ask mechanism to proceed, and the product does not
  require the user to learn a command grammar

### Requirement: The ask tool takes a single question with structured options

The `ask_user` tool SHALL accept a single `question`, zero to four `options` each carrying `id`, `label` and an
optional `description`, and an `allow_free_text` flag defaulting to true; it SHALL return either an option
identifier or free text; and at most one ask SHALL be open per job at any time.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-07),
`docs/raw-idea/prd-mvp.md#a-5-co-che-ask-dac-ta-tool-ask-user` — UNVERIFIED; the runtime enforcement is measured
in `req-021-ask-user-offline`.

#### Scenario: Second ask while one is open
- **GIVEN** a job has an unanswered ask
- **WHEN** the agent calls `ask_user` again
- **THEN** the call is rejected with an error that instructs the agent to combine its questions

#### Scenario: Answer is recorded and the job resumes
- **WHEN** the user answers an ask
- **THEN** a ledger record of type decision captures the question, the options, the answer and the surface it
  came from, and the job resumes at the point it stopped

### Requirement: Asking cannot obtain what the gate refused

An answer to an ask SHALL NOT grant permission for an operation, and the approval hook SHALL evaluate every tool
call after any ask has been answered.

Source: `docs/raw-idea/prd-mvp.md#a-5-co-che-ask-dac-ta-tool-ask-user` (A.5.7),
`docs/spec/constitution.md` principle II — UNVERIFIED.

#### Scenario: Agent asks for permission it was denied
- **GIVEN** the hook denied a bulk archive operation
- **WHEN** the agent asks the user "shall I archive these anyway?" and the user answers yes
- **THEN** the operation is still evaluated by the hook and still blocked, because an answer is not an approval

### Requirement: Model provider and role routing are configured on the client

The client SHALL provide provider configuration following the agent harness's own provider mechanisms, SHALL
store provider credentials in operating-system secure storage, and SHALL hold the mapping from role —
pet-agent, worker-agent, rule elicitation, undo — to model as application configuration with recommended
defaults that the user can change without a new release.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-11) — UNVERIFIED; the role matrix is measured
in `req-017-provider-matrix`.

#### Scenario: Changing the worker model
- **WHEN** the user selects a different model for the worker role
- **THEN** jobs created afterwards use that model, with no application update required

#### Scenario: Credential is rejected by the provider
- **WHEN** a configured credential is refused by the provider
- **THEN** a SYSTEM card reports the provider failure and points at the provider settings

#### Scenario: No provider is configured
- **GIVEN** no provider has been configured
- **WHEN** the user hands over a command
- **THEN** the product states that a provider must be configured and offers the settings, rather than failing a
  job silently

### Requirement: Only job-relevant content is sent to the model provider

The product SHALL send to the configured model provider only the content required for the job in hand — the
command, its attached images, and the platform data the job reads — and SHALL disclose this in the data policy
shown during onboarding.

Source: `docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-02) — UNVERIFIED.

#### Scenario: Unrelated history is not attached
- **GIVEN** the user has run twenty earlier jobs
- **WHEN** a new unrelated job runs
- **THEN** the earlier jobs' content is not included in the request sent to the provider

#### Scenario: Disclosure at onboarding
- **WHEN** the user completes onboarding
- **THEN** the data policy shown states that job content is sent to the model provider the user configured

### Requirement: Attached screenshots are discarded when the job ends

Images the user attaches SHALL be removed from working memory when the job that used them ends, and any copy
retained in the ledger SHALL follow the ledger retention policy.

Source: `docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-04) — UNVERIFIED.

#### Scenario: Image is released after completion
- **GIVEN** a job was handed a screenshot
- **WHEN** the job reaches a terminal state
- **THEN** the image is no longer held in working memory

#### Scenario: Image referenced by the ledger
- **WHEN** a ledger record references an attached image
- **THEN** that copy is retained under the ledger retention policy and is removed when the policy removes the
  record

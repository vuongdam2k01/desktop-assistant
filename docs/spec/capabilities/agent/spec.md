# agent Specification

## Purpose
Owns the agent runtime: the pet-agent that creates jobs, the worker-agent that performs them through a multi-step agentic loop, the tool wrapping that makes every tool pass the approval gate and the ledger, and the mapping from role to model. The pet-agent creates jobs for other agents and never commands them.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence).

## Requirements

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

The client SHALL let the user configure a provider profile carrying a credential for a named provider or a
custom endpoint that speaks a completion protocol the harness supports, SHALL NOT offer an interactive
provider sign-in, SHALL store provider credentials in operating-system secure storage, and SHALL hold the mapping
from role — pet text, pet image, worker, rule elicitation, undo, risk judge — to model as account-owned
configuration, populated on first configuration with defaults derived from the models the user's profiles offer
and changeable by the user without a new release.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-11) — the clause's interactive sign-in is
CORRECTED here: the embedded path exposes a per-provider credential and a custom endpoint descriptor and has no
interactive sign-in, and the harness's publisher sells no subscription — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q5, `spikes/SP-6-pi-sdk/REPORT.md#2-tac-dong-len-adr-prd` item 2). A custom
endpoint was exercised end to end against a third-party service for a strong model, a cheap model and a vision
model — VERIFIED (same section). The role list is extended here from four to six: the pet's image handling is a
role of its own because two text models refused images outright, and the risk judge is a role because it is a
model call the product makes on its own account — VERIFIED
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q1,
`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`). The mapping is account-owned rather than device configuration
under `docs/spec/constitution.md` principle VII.

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

#### Scenario: A custom endpoint is configured
- **GIVEN** the user supplies an endpoint address, a credential and a model name for a service that speaks the
  supported completion protocol
- **WHEN** a job runs against that profile
- **THEN** it reasons, calls tools and accepts images through that endpoint without any change to the product

#### Scenario: The user looks for an interactive provider sign-in
- **WHEN** the user opens provider settings
- **THEN** the product offers a credential and a custom endpoint, and states that no interactive sign-in exists
  rather than presenting one that cannot work

#### Scenario: Defaults are proposed when the first profile is saved
- **WHEN** the user saves their first profile
- **THEN** all six roles are given assignments drawn from that profile's models, and the user is shown what was
  assigned to each role before it takes effect

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

### Requirement: Tools reach the harness only through the wrapping factory

Every tool held by any agent SHALL be produced by a single wrapping factory that takes a tool implementation and
returns a wrapped tool, the agent harness SHALL be started holding no tool the factory did not return, and a tool
that touches no external platform SHALL declare the internal origin and be evaluated like any other call rather
than being exempted; the product SHALL NOT depend on any call-interception facility the harness itself provides
for this guarantee.

Source: `spikes/SP-6-pi-sdk/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 and `spikes/SP-6-pi-sdk/REPORT.md`
§1 Q2 — VERIFIED; the wrapped tool refused a forbidden call with the implementation never invoked, and it refused
identically when the harness's own interception facility was deliberately left unconfigured, which is what
establishes that the guarantee does not rest on the harness. The harness loads no tools by default —
VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q1). That the single path admits no trusted-tool exception was decided
in `clarifications.md` session 2026-09-12.

#### Scenario: The harness's own interception facility is not configured
- **GIVEN** a session is started without configuring the harness's call-interception facility
- **WHEN** the agent issues a call the gate refuses
- **THEN** the tool implementation is not invoked, and the refusal is identical to the one produced when the
  facility is configured

#### Scenario: The pet-agent's own tools take the same path
- **WHEN** the tools the pet-agent holds are enumerated
- **THEN** each one is a wrapped tool declaring the internal origin, and none of them reached the agent by a
  second registration route

#### Scenario: A tool implementation offered directly to the harness
- **WHEN** a session is constructed from anything other than the factory's output
- **THEN** the construction fails rather than starting a session holding an unwrapped tool

#### Scenario: The harness is started with no tools supplied
- **GIVEN** a session constructed without a tool set
- **WHEN** the agent's available tools are enumerated
- **THEN** the set is empty, and no file-system, shell or editing tool is present to be inherited

### Requirement: Each harness session holds its own state and shares nothing with another

Concurrent harness sessions in one process SHALL each hold their own transcript, their own tool set and their own
suspension state, SHALL NOT read or write any state belonging to another session, and no content from one
session SHALL appear in another's transcript or in the request it sends to a model provider.

Source: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q4 — VERIFIED; three sessions ran concurrently in one process, each
holding a distinct secret, and a cross-check of all three transcripts found no value belonging to another
session. The same section records that a downstream fork of the harness holds this state in a process-wide
singleton, which is why the identity requirement below is part of this guarantee rather than separate from it.

#### Scenario: Three jobs run at once
- **GIVEN** three jobs are running, each with its own session
- **WHEN** each session is asked for information only its own job was given
- **THEN** each answers from its own transcript alone, and none reproduces another's content

#### Scenario: One session is suspended while the others run
- **GIVEN** one session is suspended at a held call
- **WHEN** the other sessions continue
- **THEN** they continue unaffected, and the suspension is not observable in their transcripts

#### Scenario: One session fails
- **GIVEN** two sessions are running
- **WHEN** one fails with a provider error
- **THEN** the other completes normally and its transcript contains no trace of the failure

### Requirement: A resumed run continues at its suspension point without repeating completed work

When a run is resumed after a suspension, the tool calls already completed in that run SHALL NOT be issued again,
the resumed run SHALL continue from the turn that was suspended, and this SHALL hold whether the session was
still in memory or was rebuilt from the stored transcript after the process stopped.

Source: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 — VERIFIED in both modes; with the session still alive, the earlier
read was not re-issued when the held write was approved, and with the session rebuilt from stored turns after a
simulated stop, the earlier read was issued zero times while the approved write was issued once. That the stored
transcript is the state and the live suspension only an optimisation over it was decided in `clarifications.md`
session 2026-09-12.

#### Scenario: Approval arrives while the session is still alive
- **GIVEN** a run completed a read and is suspended at a held write
- **WHEN** the user approves
- **THEN** the write is executed, the read is not re-issued, and the run reports on both

#### Scenario: Approval arrives after the process stopped
- **GIVEN** a run was suspended at a held write and the process stopped afterwards
- **WHEN** the product starts again and the user approves
- **THEN** the session is rebuilt from the stored transcript, the approved write is executed once, the earlier
  read is not re-issued, and the run continues to its report

#### Scenario: The transcript is written before the job reports it is waiting
- **WHEN** a call is held
- **THEN** the turns completed so far are durable before the job is shown as waiting, so a stop at that instant
  loses no completed step

#### Scenario: Resume after cancellation is refused
- **GIVEN** a run was suspended and its job was then cancelled
- **WHEN** a decision for the held call arrives
- **THEN** nothing is executed and no session is rebuilt

### Requirement: The agent harness is pinned to one package identity and one version

The product SHALL depend on the agent harness only at the package identity and versions recorded as verified,
SHALL pin them in its dependency lockfile, and a build that resolves the similarly named alternative distribution
of the harness SHALL fail rather than ship.

Source: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9 and `spikes/SP-6-pi-sdk/REPORT.md#6-phien-ban-chinh-xac-cua-moi-package-cong-cu`
— VERIFIED; the canonical distribution is the one that was measured, and the alternative distribution targets a
different runtime and holds its pause state in a process-wide singleton, which would break the isolation
requirement above. `spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien` records the confusion between the two
namespaces as a risk in its own right.

#### Scenario: A build resolves the alternative distribution
- **WHEN** a dependency change causes the alternative distribution of the harness to be installed
- **THEN** the build fails and names the package it refused

#### Scenario: The harness version moves without a decision
- **WHEN** the installed harness version differs from the pinned one
- **THEN** the build fails rather than shipping an unmeasured runtime

#### Scenario: A harness upgrade is taken deliberately
- **GIVEN** a change raises the pinned harness version
- **WHEN** that change is proposed
- **THEN** the wrapping, suspension and isolation checks are re-run against the new version before the pin is
  accepted, because the pin is what the measured results are attached to

### Requirement: Every model request resolves through the routing table

Every request the product sends to a model provider SHALL be resolved from the pair of the role that needs the
answer and the shape of the input it carries, against a routing table holding exactly one assignment per role,
and no component SHALL send a model request built from any other source of provider, model or credential.

The product recognises exactly six roles — pet text, pet image, worker, rule elicitation, undo, risk judge —
and this catalogue is closed: a seventh role is a change to
`agent/contracts/role-routing@0.1.0`, not a configuration value. Resolution never consults what a model reports
about itself at request time; it reads the assignment the user holds.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q3) — VERIFIED that each of the
five measured roles has a distinct model requirement and that the sixth, pet image, exists because two text
models refused images outright. That image handling is a routing slot rather than a branch inside the pet role
was decided in `clarifications.md` session 2026-09-12.

#### Scenario: A command without an image
- **GIVEN** the pet text role and the pet image role are assigned to different models
- **WHEN** the user hands over a command carrying only text
- **THEN** the request is sent to the model assigned to the pet text role

#### Scenario: The same command with an image attached
- **GIVEN** the same two assignments
- **WHEN** the user hands over a command carrying an image
- **THEN** the request is sent to the model assigned to the pet image role, and the pet text assignment is not
  used for that request

#### Scenario: A role has no assignment
- **GIVEN** the undo role has no assignment
- **WHEN** work arises that needs that role
- **THEN** no request is sent and no job starts; the product states which role is unassigned and offers the
  settings that assign it

#### Scenario: An assignment changes while a job is running
- **GIVEN** a job is mid-run against the worker assignment
- **WHEN** the user changes the worker assignment
- **THEN** the running job finishes against the assignment it started with, and the next request from a new job
  resolves to the new one

### Requirement: A role is assigned only to a model that declares the capabilities its requests need

Each role SHALL declare the capabilities its requests require, an assignment SHALL be refused at the moment it
is made when the chosen model's profile does not declare them, and a request SHALL NOT be sent to a model whose
profile does not declare the capability that request needs.

The declared requirements are: image input for the pet image role, tool calling for the worker role and the undo
role, and text for every role. They are enforced because each is a protocol fact the product can check against
`agent/contracts/provider-profile@0.1.0`; they are not a judgement about how well a model performs a role.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) — VERIFIED: both text models
rejected an image with an explicit protocol error in 100% of attempts, and the vision model accepted the same
image, so capability is observable rather than inferred.

#### Scenario: Assigning a text-only model to the image role
- **WHEN** the user selects, for the pet image role, a model whose profile declares text but not image input
- **THEN** the assignment is refused at that moment, and the reason names the capability the role needs

#### Scenario: A profile is edited so an assigned model loses a capability
- **GIVEN** the pet image role is assigned to a model that declared image input
- **WHEN** the user edits the profile so that model no longer declares image input
- **THEN** the role is reported as no longer satisfiable, and an image-bearing command is refused before a
  request is sent rather than after the provider rejects it

#### Scenario: The user has exactly one model and it cannot read images
- **GIVEN** the user's only profile offers one model declaring text and tool calling
- **WHEN** the routing table is first built
- **THEN** the five text roles are assigned to that model, the pet image role is left unassigned, and the
  product states that images cannot be handled until an image-capable model is configured

#### Scenario: The user has exactly one model and it can read images
- **GIVEN** the user's only profile offers one model declaring text, tool calling and image input
- **WHEN** the routing table is first built
- **THEN** all six roles are assigned to that model

### Requirement: An assignment that departs from a measured result says what it departs from

When the user assigns a role to a model the product holds no measurement for, the product SHALL state, at the
moment of the assignment, that it holds no measurement for that model in that role and SHALL name what was
measured for that role, and SHALL NOT present a model the product has measured as unsuitable for a role among
that role's offered choices within a profile the product ships.

The two roles carrying a measured prohibition are rule elicitation, where a cheap model silently downgraded a
quarter of uncompilable cases, and undo. The product enforces what it can observe and states what it cannot,
rather than claiming to enforce a strength rule it has no means to evaluate.

Source: `spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan` — VERIFIED at 25% silent downgrade for the cheap
model; `spikes/SP-9-undo-agent/REPORT.md#0-ket-luan` and `spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd`
— VERIFIED for the strong model in the undo and elicitation roles. The two-layer treatment was decided in
`clarifications.md` session 2026-09-12.

#### Scenario: A shipped profile offers models for the elicitation role
- **GIVEN** a profile the product ships offers both a model measured as suitable for rule elicitation and one
  measured as unsuitable
- **WHEN** the user opens the choices for the rule elicitation role
- **THEN** the unsuitable model is not offered, and the reason it is absent is available to the user

#### Scenario: A model the product has never measured
- **WHEN** the user assigns the rule elicitation role to a model from a profile they typed in themselves
- **THEN** the product states that it holds no measurement for this model in this role, names what it did
  measure, and accepts the assignment the user confirms

#### Scenario: The statement is not a refusal
- **GIVEN** the user has been shown that statement
- **WHEN** they confirm the assignment
- **THEN** the role is assigned and rule elicitation runs against that model

### Requirement: A model response carrying neither content nor an error is a failure

When a model request completes with no content, no tool call and no reported error, the product SHALL treat it
as a failed request of a stated cause, SHALL NOT present it to the user as an empty answer, and SHALL NOT
record it as a completed turn.

Source: `spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED: an image sent to a model
without image input returned an empty stream with zero tokens and raised no exception, which is the one provider
failure the surrounding error handling cannot see.

#### Scenario: An empty stream returns from a text-only model
- **GIVEN** an image-bearing request reached a model that cannot read images
- **WHEN** the response completes with no content and no error
- **THEN** the request is classified as failed, the user is told the model returned nothing usable, and the job
  does not report success

#### Scenario: A legitimately short answer
- **WHEN** a model answers with a single short sentence
- **THEN** the response is a completed turn, because it carries content

### Requirement: Every provider failure is classified into a stated cause and a remedy

Every failure of a model request SHALL be classified into exactly one declared cause before it reaches the user,
SHALL carry with that classification the one action that repairs it, and SHALL NOT reach the user as
unclassified provider text or end a job with no explanation. How the classification is presented is owned by the
`uix` capability.

The declared causes are: the credential was refused, the model is not available on that profile, the account's
quota or rate limit is exhausted, the endpoint could not be reached, the response was unusable, and the profile
was written by a newer build.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) — VERIFIED against a real service:
a wrong credential, an unknown model name and an exhausted quota were each captured in the response stream
without crashing the runtime and each converted into a system card; `spikes/SP-17-provider-matrix/evidence/system-cards.json`.

#### Scenario: The credential is refused mid-job
- **GIVEN** a job is running
- **WHEN** the provider refuses the configured credential
- **THEN** the job fails with the cause named, and a SYSTEM card states that the credential was refused and
  offers the provider settings

#### Scenario: The assigned model name no longer resolves
- **WHEN** a request names a model the provider does not recognise
- **THEN** the cause is reported as the model being unavailable, and the card offers the routing settings for
  the role that named it

#### Scenario: The provider's quota is exhausted
- **WHEN** the provider reports that the account's quota or rate limit is exhausted
- **THEN** the card states that the limit belongs to the user's own provider account, and it is not presented as
  a fault of the product

#### Scenario: A cause the declared set does not cover
- **WHEN** a request fails in a way that matches none of the declared causes
- **THEN** it is classified as an unusable response carrying the provider's own words, and it still reaches the
  user with a remedy, rather than being passed through unclassified

### Requirement: Every model request records what it consumed

Every model request SHALL record, against the job it served, the role it served, the profile and model it
resolved to, the input and output token counts reported by the provider, and the time the request took; and
when the profile carries unit prices for that model, the record SHALL carry the cost computed from those prices
and the currency they were stated in.

The product SHALL NOT compute a cost from any price it did not receive from the user.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) — VERIFIED that per-role token
counts are obtainable and sum to a monthly figure; `spikes/SP-17-provider-matrix/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`
item 3. That the price is the user's rather than the product's was decided in `clarifications.md` session
2026-09-12.

#### Scenario: A job that used three roles
- **GIVEN** a job used the pet text, worker and risk judge roles
- **WHEN** the job ends
- **THEN** its record carries one usage entry per request, each naming its role, model and token counts

#### Scenario: No price is configured
- **GIVEN** the profile carries no unit prices for the model used
- **WHEN** the usage is recorded
- **THEN** the token counts are recorded and no cost is recorded, and nothing derives a cost from another
  model's prices

#### Scenario: The provider reports no token counts
- **WHEN** a provider returns a response without usage figures
- **THEN** the record states that usage was not reported for that request, rather than recording zero

### Requirement: The routing table follows the account and names what this device cannot serve

The routing table and the unit prices SHALL replicate to every device signed in to the account, provider
credentials SHALL NOT, and a role whose profile has no credential on this device SHALL be reported as
unusable on this device — naming the profile and the roles it holds — rather than being retargeted to another
profile.

Source: `docs/spec/constitution.md` principle VII for the replication of configuration;
`agent/contracts/provider-profile@0.1.0` for the credential's exclusion from replication. That the gap is
reported rather than routed around was decided in `clarifications.md` session 2026-09-12 — UNVERIFIED, this
being a product decision rather than a measurement.

#### Scenario: Signing in on a replacement device
- **GIVEN** the user configured six assignments on their first device
- **WHEN** they sign in on a replacement device
- **THEN** the six assignments are present, and the profiles show their credentials as absent

#### Scenario: A role's profile has no credential here
- **GIVEN** the worker role points at a profile whose credential is absent on this device
- **WHEN** the user hands over a command
- **THEN** the product states that the profile needs its credential on this device and names the roles waiting
  on it, and no request is sent

#### Scenario: Another profile does have a credential
- **GIVEN** one profile has a credential on this device and the profile the worker role points at does not
- **WHEN** the worker role is needed
- **THEN** the role is not retargeted to the profile that happens to be usable, because the user chose the model
  for that role

### Requirement: The ask_user tool adheres to a structured inquiry schema

The `ask_user` tool SHALL accept a structured inquiry object specifying a single consolidated `question` string, an optional `options` array containing zero to four choices each with an `id` string and a `label` string not exceeding 30 characters and an optional `description` string, and an optional `allow_free_text` boolean defaulting to `true`; and upon completion SHALL return an answer object containing either the selected `option_id`, the provided free `text`, or both.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q1 — VERIFIED that TypeBox schema validation permits valid 0–4 options, enforces the 30-character label limit, defaults `allow_free_text` to true, and rejects payloads exceeding 4 options.

#### Scenario: Valid inquiry with quick options
- **GIVEN** an active worker-agent needs clarification on task priority
- **WHEN** the agent calls `ask_user` with a question and three options (High, Normal, Low) with labels under 30 characters
- **THEN** the schema validation passes and the inquiry is dispatched to the user interface

#### Scenario: Inquiry with more than four options is rejected
- **WHEN** an agent calls `ask_user` with five options
- **THEN** schema validation rejects the call immediately with a schema violation error, and no inquiry is dispatched to the user

#### Scenario: Option label exceeding 30 characters is rejected
- **WHEN** an agent calls `ask_user` with an option label of 35 characters
- **THEN** schema validation rejects the call, requiring labels to be 30 characters or fewer

#### Scenario: User free-text contradicts options (Case E9)
- **GIVEN** an inquiry offered options "Tasks" and "Backlog"
- **WHEN** the user provides a free-text response specifying database "db-core-system"
- **THEN** the agent receives the answer payload containing the text, treats the user's free text as the authoritative ground truth, and acts on "db-core-system" without requiring re-prompting

### Requirement: Harness runtime rejects more than one open ask per job

The agent runtime harness SHALL maintain the pending inquiry state per job and SHALL reject any subsequent call to `ask_user` while a previous inquiry for the same job remains unanswered, returning an error with code `MAX_ONE_PENDING_ASK_EXCEEDED` instructing the agent to consolidate its questions into a single prompt.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q2 — VERIFIED that the harness runtime enforces the single-open-ask constraint at the execution layer, returning an explicit error and maintaining the first pending ask without corruption.

#### Scenario: Agent attempts consecutive ask_user calls
- **GIVEN** a job has an open `ask_user` call awaiting user response
- **WHEN** the agent attempts to issue a second `ask_user` call before the first is answered
- **THEN** the harness runtime immediately rejects the second call with error code `MAX_ONE_PENDING_ASK_EXCEEDED`, and the first inquiry remains active and pending in the UI

#### Scenario: Consolidated question when multiple parameters are missing
- **GIVEN** an incoming command lacks both the target name and priority
- **WHEN** the agent identifies multiple missing parameters
- **THEN** the agent emits exactly one consolidated `ask_user` question covering both missing items rather than issuing separate sequential prompts

### Requirement: User inquiries are permanently decoupled from hard gate security approvals

The tool execution wrapper SHALL evaluate hard gate security rules and authorization tokens within its private execution closure independently of the conversation transcript, and an answer supplied through `ask_user` SHALL NOT satisfy, override, or substitute for a cryptographic approval token or policy restriction.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q7 — VERIFIED that when an agent is blocked by a hook from deleting a protected database, asking the user for verbal permission via `ask_user` and receiving an explicit "I approve" text response still results in the hard gate blocking the subsequent delete call (100% block, zero bypass).

#### Scenario: Agent attempts to evade hook via ask_user permission
- **GIVEN** a hard gate hook prohibits the deletion of protected database "db-core-system"
- **WHEN** the agent calls `ask_user` asking the user to authorize an override, receives an affirmative text response, and re-invokes `delete_database`
- **THEN** the tool wrapper evaluates the hook independently, rejects the call with the hard gate violation error, and prevents execution of the underlying delete operation

### Requirement: Answered inquiries append a decision record to the ledger

Upon receiving the user's response to an `ask_user` inquiry, the system SHALL append an immutable `decision` record to the ledger capturing the job identifier, the question text, the options array, the user answer object, the answer source ("bubble" or "app"), and the ISO 8601 creation timestamp before resuming agent execution.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q5 — VERIFIED that all 5 fields are stored and protected against update or deletion by SQLite triggers.

#### Scenario: Decision recorded from pet bubble
- **GIVEN** an active job is waiting on an inquiry
- **WHEN** the user selects an option via the pet speech bubble
- **THEN** a `decision` record is appended to the ledger with `answer_source: "bubble"` and the job resumes execution

#### Scenario: Immutability triggers protect decision records
- **GIVEN** a recorded `decision` entry in the ledger
- **WHEN** an update or delete query is executed against the `decisions` table
- **THEN** the SQLite trigger aborts the query with an `APPEND_ONLY_VIOLATION` error

### Requirement: The worker agent executes multi-step tasks through an iterative agentic loop

The worker agent SHALL execute incoming user instructions through an iterative loop encompassing context gathering, planning, tool execution, state self-verification, and final reporting, and SHALL NOT terminate or report completion before completing all necessary planning and execution phases.

Source: `spikes/SP-4-agent-loop/REPORT.md` §1 Q1 — VERIFIED that multi-step agentic execution achieves 85.0% (17/20) final-state correctness across complex multi-workspace scenarios.

#### Scenario: Execution of a multi-step reordering task
- **GIVEN** a Notion task database with 5 tasks
- **WHEN** the user instructs the agent to rebalance task order based on priority and due dates
- **THEN** the worker agent queries the existing database, plans the relative ordering sequence, executes property updates across the tasks, and reports the resulting order

#### Scenario: Simple single-step task execution
- **GIVEN** a user instructs the agent to mark a task as completed
- **WHEN** the worker agent receives the command
- **THEN** the agent resolves the task ID, calls the update tool, and confirms completion within the median latency expectation

### Requirement: Worker agents verify post-mutation state before reporting completion

After invoking any tool that mutates external state (creation, property update, deletion, or reordering), the worker agent SHALL execute at least one read or query tool call to verify that the external resource state matches the intended outcome, and SHALL NOT emit a final completion message to the user without completing this self-verification.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-10); `spikes/SP-4-agent-loop/REPORT.md` §1 Q2 — VERIFIED: self-verification occurred in 95.0% (19/20) of real-world spike scenarios.

#### Scenario: Self-verification after updating a task status
- **GIVEN** an active worker agent updates a task property to "Done"
- **WHEN** the tool execution finishes
- **THEN** the agent invokes a retrieval query to inspect the task state, verifies that status is "Done", and only then sends the completion confirmation to the user

#### Scenario: Self-verification detects partial mutation
- **GIVEN** an agent creates four sub-tasks from an external document
- **WHEN** the creation tool calls complete
- **THEN** the agent queries the database to count newly created items, confirms all four are present, and summarizes the results

### Requirement: User clarifications are requested exclusively through the ask_user tool

When an agent encounters ambiguity or lacks critical parameters required to proceed, it SHALL invoke the `ask_user` tool, and SHALL NOT emit clarification questions as plain conversational text.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-05); `spikes/SP-4-agent-loop/REPORT.md` §1 Q1, Q3 — VERIFIED: 0 over-asking violations (0%), and prompt negative constraint prevents text-based clarification leakage (Case S-10).

#### Scenario: Ambiguous rebalancing instruction triggers ask_user
- **GIVEN** the user submits an ambiguous prompt to "rebalance tasks between team members"
- **WHEN** the agent identifies multiple viable task reassignments
- **THEN** the agent calls `ask_user` with option chips rather than asking in plain message text

#### Scenario: Unambiguous instructions proceed without questioning
- **GIVEN** the user command explicitly provides task name, target database, and due date
- **WHEN** the agent processes the command
- **THEN** the agent executes the task directly without issuing any clarifying questions

### Requirement: Typed user text takes precedence over conflicting image content

When an incoming command includes both typed user text and an attached image with contradictory instructions or attributes, the worker agent SHALL treat the typed user text as the authoritative ground truth, and SHALL resolve all properties according to the typed text.

Source: `spikes/SP-4-agent-loop/REPORT.md` §1 Q1 (Case S-17), §2 item 3 — VERIFIED that multimodal source conflicts must resolve in favor of user typed text.

#### Scenario: Due date in text contradicts screenshot deadline
- **GIVEN** a user types "Set deadline to Thursday" and attaches a partner screenshot showing "Demo Wednesday"
- **WHEN** the agent parses the multimodal prompt
- **THEN** the agent sets the task due date to Thursday, following the typed user text over the image screenshot

### Requirement: Relative date computations anchor to the local machine timezone

The agent harness SHALL inject a temporal anchor into the system prompt specifying the local machine's current date, day of week, time, and IANA timezone identifier, and the agent SHALL compute all relative dates relative to this anchor.

Source: `spikes/SP-4-agent-loop/REPORT.md` §1 Q1 (Case S-16), §3 item 3 — VERIFIED that timezone and anchor injection eliminates relative date drift.

#### Scenario: Resolving relative date on the same day of week
- **GIVEN** the local temporal anchor indicates Friday afternoon
- **WHEN** an instruction requests a task "before Friday"
- **THEN** the agent calculates the due date as Friday of the following week rather than earlier on the current day

### Requirement: Connector tools return structured content and details arrays

Every connector tool registered in the agent harness SHALL return execution results adhering to a payload containing a `content` array with a serialized text element and a structured `details` object, ensuring compatibility with the Pi Agent SDK.

Source: `spikes/SP-4-agent-loop/REPORT.md` §1 Q5, §3 item 1 — VERIFIED that `@earendil-works/pi-agent-core` requires `{ content: [{ type: "text", text: ... }], details }` to avoid empty context serialization.

#### Scenario: Connector tool executes and returns formatted payload
- **GIVEN** a worker agent executes `notion_query_database`
- **WHEN** the tool completes query execution
- **THEN** the tool returns `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: data }` so that results appear in the LLM conversational transcript

### Requirement: The risk-judge role resolves to the cheap model tier by default

The model routing table SHALL assign the `risk-judge` role to `LLM_MODEL_CHEAP` by default, ensuring that individual risk evaluations complete with a median latency not exceeding 4,000 milliseconds and maintaining a 0.0% strict false-allow rate on dangerous operations, while allowing the user to explicitly select `LLM_MODEL_STRONG` in settings.

Source: `spikes/SP-10-risk-judge/REPORT.md` §1 Q1, Q6 — VERIFIED that `LLM_MODEL_CHEAP` achieves P50 latency of 3,154 ms at $0.000203/call with 0.0% false-allow on dangerous operations, preserving NFR-PF-05.

#### Scenario: Default assignment of cheap model to risk judge
- **GIVEN** default model routing is initialized
- **WHEN** the routing table is inspected for the `risk-judge` role
- **THEN** it resolves to the configured `LLM_MODEL_CHEAP` profile

#### Scenario: User overrides risk judge with strong model
- **GIVEN** the user wants maximum reasoning capability for risk evaluation
- **WHEN** the user selects `LLM_MODEL_STRONG` for the `risk-judge` role in settings
- **THEN** subsequent smart mode write evaluations route to the strong model profile

### Requirement: The rule-elicitation role is pinned strictly to the strong model

The model routing table SHALL assign the `rule-elicitation` role strictly to `LLM_MODEL_STRONG`, and the configuration interface SHALL forbid assigning `LLM_MODEL_CHEAP` to this role to prevent silent downgrades of uncompilable rules.

Source: `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q3, §2 item 2 — VERIFIED: cheap model exhibited 25% silent downgrade on uncompilable rules (Case R-19, R-17), while strong model converged with 0.0% silent downgrade across all cases.

#### Scenario: Default assignment of strong model to elicitation
- **GIVEN** model routing is initialized
- **WHEN** the routing table is inspected for the `rule-elicitation` role
- **THEN** it resolves to the configured `LLM_MODEL_STRONG` profile

#### Scenario: Rejection of cheap model for rule elicitation
- **GIVEN** the user attempts to configure model assignments
- **WHEN** the user attempts to assign `LLM_MODEL_CHEAP` to the `rule-elicitation` role
- **THEN** the configuration interface rejects the assignment, citing the constitutional requirement against silent rule downgrades

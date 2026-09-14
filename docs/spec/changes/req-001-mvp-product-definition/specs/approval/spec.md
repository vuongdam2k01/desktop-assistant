## ADDED Requirements

### Requirement: Approval mode `on` stops every write

In mode `on`, every write operation on every connector SHALL stop and wait for the user's decision, while read
operations SHALL proceed without stopping.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-01a) — UNVERIFIED.

#### Scenario: Read then write in one job
- **GIVEN** the approval mode is `on`
- **WHEN** a job reads a database and then creates a task
- **THEN** the read proceeds and the creation raises an approval request

#### Scenario: Several writes in sequence
- **GIVEN** the approval mode is `on`
- **WHEN** a job needs three writes
- **THEN** each is requested in turn, in the order the agent reaches them

### Requirement: Approval mode `smart` evaluates in two tiers

In mode `smart`, each write operation SHALL first be matched against a static tier — irreversible operations,
deletion or archival, bulk operations above the configured object threshold, permission or sharing changes,
operations on objects the user did not create, and every rule the user has declared — and an operation matching
none of those SHALL then be evaluated by a model-based risk judge whose outcomes are auto-approve, auto-reject,
or escalate to the user when it is uncertain.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-01b) — UNVERIFIED; the two-tier behaviour and
its failure policy are measured in `req-011-risk-judge`.

#### Scenario: Static tier matches first
- **GIVEN** the approval mode is `smart`
- **WHEN** an operation deletes an object
- **THEN** it is stopped by the static tier and the risk judge is not consulted

#### Scenario: Judge is uncertain
- **GIVEN** an operation matches no static pattern
- **WHEN** the risk judge cannot determine the risk
- **THEN** the operation is escalated to the user rather than allowed

#### Scenario: Judge is unavailable
- **WHEN** the risk judge cannot be reached, times out, or returns an unparsable answer
- **THEN** the operation is escalated to the user, because the evaluation fails closed

#### Scenario: Auto-approval is recorded with its reason
- **WHEN** the risk judge approves an operation automatically
- **THEN** the ledger records the automatic decision together with the reason given

### Requirement: Approval mode `off` removes waiting but not recording

In mode `off`, write operations SHALL proceed without waiting for a decision, the ledger SHALL record them in
full, and the hardline blocklist SHALL remain in force.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-01c) — UNVERIFIED.

#### Scenario: Blocklist still applies
- **GIVEN** the approval mode is `off`
- **WHEN** an operation on the blocklist is attempted
- **THEN** it is refused, because the blocklist does not depend on the mode

#### Scenario: Recording is unaffected
- **GIVEN** the approval mode is `off`
- **WHEN** a job performs three writes
- **THEN** the ledger holds the same records it would hold in any other mode

### Requirement: The hardline blocklist cannot be disabled

A defined set of operations SHALL be refused in every mode without exception and SHALL NOT be configurable off;
it SHALL include at minimum bulk deletion or archival at the level of a whole database or a root folder,
operations outside the granted scope, and operations against the product's own approval configuration or
ledger.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-10),
`docs/spec/constitution.md` principle II — UNVERIFIED.

#### Scenario: Agent attempts to modify the rules that constrain it
- **WHEN** an agent attempts to change the approval configuration through a tool call
- **THEN** the call is refused in every mode and the attempt is recorded

#### Scenario: Operation outside the granted scope
- **WHEN** a tool call would act outside the scope the user granted the connector
- **THEN** the call is refused before it reaches the platform

### Requirement: The hook decides, not the prompt

Approval enforcement SHALL execute in the application layer between the agent and the connector, and a tool call
matching a rule SHALL NOT execute even when the model has been persuaded to attempt it.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-03),
`docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-05),
`docs/spec/constitution.md` principle II — UNVERIFIED; the adversarial evidence is in `req-009-rule-ir-hardgate`.

#### Scenario: Injected instruction in fetched content
- **GIVEN** a page the agent reads contains text instructing it to delete a database
- **WHEN** the agent attempts that deletion
- **THEN** the hook refuses it, because content is data and the gate is not reachable from the model's output

#### Scenario: System prompt is bypassed
- **GIVEN** the advisory system prompt has been circumvented
- **WHEN** a tool call matching a declared rule is issued
- **THEN** the call still does not execute

### Requirement: Approval offers four decision levels

An approval request SHALL offer approve-once, approve-this-operation-type-for-this-job, add-to-permanent-
allowlist, and deny; the job-scoped decision SHALL expire when the job ends; the permanent allowlist SHALL be
viewable, editable and deletable in the application window; and every decision SHALL be recorded in the ledger.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-11) — UNVERIFIED.

#### Scenario: Job-scoped approval covers the same rule and tool only
- **GIVEN** the user approved an operation type for the current job
- **WHEN** the agent issues a call of a different type or triggering a different rule
- **THEN** a new approval is requested

#### Scenario: Allowlist entry is removed
- **GIVEN** a permanent allowlist entry exists
- **WHEN** the user deletes it in the application window
- **THEN** subsequent matching operations stop for approval again

### Requirement: Mode `off` is continuously visible

While the approval mode is `off`, the product SHALL display a persistent warning indicator on the pet and a
banner in the application window.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-12) — UNVERIFIED.

#### Scenario: Indicator persists across sessions
- **GIVEN** the mode was left `off`
- **WHEN** the application is started again
- **THEN** the warning indicator and banner are shown again without the user having to look for them

### Requirement: Unattended execution never approves itself

A job running without a person present SHALL treat any operation that falls into the approval path as denied and
SHALL pause safely, SHALL NOT approve automatically, and SHALL leave the operation in a queue the user handles
later.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-13) — UNVERIFIED; recorded now because it
shapes the data model, although the scheduler that triggers unattended runs is out of scope here.

#### Scenario: Scheduled job meets an approval
- **GIVEN** a job started without a person present
- **WHEN** it reaches an operation requiring approval
- **THEN** the operation is denied, the job pauses safely, and the request waits for the user

### Requirement: Rules are elicited in conversation and compiled before they bind

An approval rule SHALL be formed through a multi-turn conversation that clarifies timing, scope and exceptions
from a rough statement of intent, SHALL be compiled into a blocking hook evaluated before each tool call, an
advisory system-prompt fragment, and a structured restatement shown to the user, and SHALL take effect only
after the user confirms that restatement.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-02),
`docs/spec/constitution.md` principle V — UNVERIFIED; measured in `req-004-rule-elicitation`.

#### Scenario: Unconfirmed rule does not bind
- **GIVEN** a rule has been elicited but not confirmed
- **WHEN** an operation it would match is attempted
- **THEN** the operation is evaluated as if the rule did not exist

#### Scenario: User is not required to state everything at once
- **WHEN** the user gives a rough intention
- **THEN** the product asks follow-up questions rather than rejecting the statement as incomplete

### Requirement: A description that cannot be compiled is reported, not downgraded

When a rule description cannot be compiled into a blocking condition, the product SHALL state precisely which
part is unsupported and SHALL NOT silently convert it into an advisory reminder.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-04) — UNVERIFIED.

#### Scenario: Rule depends on a judgement the gate cannot make
- **WHEN** the user asks for a rule that depends on information the hook cannot evaluate
- **THEN** the product names that part as unsupported and the rule is not stored as if it were enforceable

### Requirement: Irreversible operations require approval in `smart` and `on`

In modes `smart` and `on`, an operation flagged irreversible SHALL require approval even when no user rule
mentions it.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-05) — UNVERIFIED; the source marks this as a
logical consequence of the locked decision that still needs confirmation.
[NEEDS CLARIFICATION: open question OQ-2 — the product owner has not yet accepted this default; `req-019-connector-framework` proposes accepting it on measured evidence.]

#### Scenario: Irreversible operation with no matching rule
- **GIVEN** the approval mode is `smart` and no user rule matches
- **WHEN** an operation flagged irreversible is reached
- **THEN** it raises an approval request

### Requirement: Compiled rules are tested and the result is shown

After each rule compilation the product SHALL run a set of sample operations that must be blocked and must be
allowed, and SHALL present the outcome to the user.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-06) — UNVERIFIED.

#### Scenario: Compilation produces a rule that blocks too much
- **WHEN** the sample run shows an operation blocked that should have been allowed
- **THEN** that outcome is shown to the user before the rule is confirmed

### Requirement: An approval request states what will change and why it stopped

An approval request SHALL state the operation, the target object, the expected before-and-after values, and the
rule that triggered it.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-07) — UNVERIFIED.

#### Scenario: Bulk operation request
- **WHEN** an operation affects several objects
- **THEN** the request identifies the objects affected rather than stating only a count

#### Scenario: Expected values cannot be computed
- **WHEN** the resulting value cannot be determined in advance
- **THEN** the request says so explicitly instead of presenting a guess as the expected result

### Requirement: An unanswered approval pauses the job safely

An approval request that is not answered within the configured waiting period, which defaults to 30 minutes,
SHALL pause the job safely, and the user SHALL be able to resume or cancel it from the application window.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-08) — UNVERIFIED.

#### Scenario: Waiting period expires
- **GIVEN** an approval request has been waiting for the configured period
- **WHEN** the period expires
- **THEN** the job is paused safely, nothing is executed, and the request remains visible for later handling

#### Scenario: Resume after expiry
- **WHEN** the user resumes a job paused this way
- **THEN** the blocked operation is evaluated again rather than executed on the strength of the expired request

### Requirement: A mode change binds only jobs created afterwards

A change of approval mode SHALL apply to jobs created after the change, and a running job SHALL keep the mode
that was in force when it was created.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-09) — UNVERIFIED.

#### Scenario: Mode relaxed while a job runs
- **GIVEN** a job was created in mode `on` and is running
- **WHEN** the user switches the mode to `off`
- **THEN** the running job continues to request approval for its writes

#### Scenario: Mode is recorded on the job
- **WHEN** a job is created
- **THEN** the mode in force at that moment is stored with the job and visible in its detail

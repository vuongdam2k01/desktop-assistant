## ADDED Requirements

### Requirement: Every verdict is decided by a closed expression outside any model

The gate SHALL decide each tool call by evaluating a closed expression tree built only from the predicate kinds
the rule representation defines — tool identity, target scope, field change, ownership, accumulated count, time
of day, irreversibility and permission change — combined by conjunction, disjunction and negation; it SHALL NOT
consult a model, execute free-form code, or read any text the model produced, and the same call evaluated
against the same stored state SHALL always return the same verdict.

Source: `spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1),
`docs/spec/constitution.md` principle II — VERIFIED.

#### Scenario: Same call, same verdict
- **GIVEN** a tool call and a rule catalogue that have not changed
- **WHEN** the call is evaluated twice
- **THEN** both evaluations return the same verdict and name the same rule

#### Scenario: Model provider is unreachable
- **GIVEN** no model provider can be reached
- **WHEN** a tool call is evaluated
- **THEN** the gate still returns a verdict, because no part of the decision depends on a model

#### Scenario: Model output asserts the gate is disabled
- **GIVEN** content the agent read claims that approval is switched off for this workspace
- **WHEN** the agent issues a matching tool call
- **THEN** the verdict is unchanged, because the claim is data and no input to the evaluator carries it

### Requirement: Rules address a target by connector-declared type and immutable identifier

A rule SHALL identify what it protects by connector, by an object type that the connector's manifest declares,
by the object's immutable identifier, and by the identifiers of that object's ancestors, and SHALL NOT identify
it by a display name or any other value the object's own content can change.

Source: `spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5, case A-20) — the identifier
anchoring is VERIFIED; the connector-neutral restatement of the object type is UNVERIFIED, decided in
`clarifications.md` session 2026-09-12.

#### Scenario: Protected object is renamed to escape a rule
- **GIVEN** a rule protects a database by its identifier
- **WHEN** the agent renames that database and then attempts the protected operation
- **THEN** the operation is still stopped, because the rule never referred to the name

#### Scenario: The rename itself is evaluated
- **WHEN** the agent attempts to rename an object a rule protects
- **THEN** the rename is itself a tool call against that identifier and is evaluated like any other

#### Scenario: A rule protects an object's descendants
- **GIVEN** a rule names an object and its descendants
- **WHEN** an operation acts on a child object created after the rule was written
- **THEN** the operation is stopped, because the child carries the protected object in its ancestor chain

#### Scenario: A second connector needs no change to the rule format
- **WHEN** a connector whose manifest declares object types unknown to any existing rule is added
- **THEN** rules can be written against those object types without any change to the rule representation

### Requirement: Field names and nested values are normalised before comparison

Before comparing a field against a rule, the gate SHALL normalise the field's name so that differences of
spacing, casing and separators do not distinguish one name from another, and SHALL extract the field's value out
of whatever nesting the connector's payload places it in, so that one rule matches every spelling and every
shape of the same field.

Source: `spikes/SP-8-rule-ir-hardgate/REPORT.md#2-tac-dong-len-adr-prd` (FR-AP-01 / FR-AP-04 amendment),
`spikes/SP-8-rule-ir-hardgate/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED.

#### Scenario: Same field, three spellings
- **GIVEN** a rule constrains the field the user wrote as "Due date"
- **WHEN** a call carries that field spelled as one word, separated by an underscore, or separated by a space
- **THEN** all three are compared against the rule

#### Scenario: Value arrives wrapped in the platform's own structure
- **GIVEN** a rule constrains a field's resulting value to "Done"
- **WHEN** the call carries the value as a nested object rather than as a plain string
- **THEN** the nested value is extracted and compared, and the rule matches

### Requirement: A rule constrains an individual field, so splitting a call does not escape it

A rule SHALL be able to constrain the resulting value of one named field on its own, including by matching it
against a pattern, so that an operation stopped as a compound change is equally stopped when the agent reissues
it as several calls each changing one field.

Source: `spikes/SP-8-rule-ir-hardgate/REPORT.md#4-rui-ro-moi-phat-hien` (risk 1, case A-15) — VERIFIED.

#### Scenario: Compound change is split into single-field calls
- **GIVEN** a compound update changing status and title together was stopped
- **WHEN** the agent reissues it as one call changing status and one call changing title
- **THEN** each call is stopped on its own

#### Scenario: Destructive intent hidden in a free-text field
- **GIVEN** a rule matches a title pattern that marks an object as discarded
- **WHEN** the agent sets a title matching that pattern
- **THEN** the operation is stopped, even though no deletion tool was called

### Requirement: Accumulated counts are read from the account's ledger

A rule that counts — writes so far in a job, objects created within a calendar day — SHALL take its count from
the account's ledger records rather than from state held only for the running session, so that the count
survives a restart of the application and includes work done on any other device signed in to the account.

Source: decided in `clarifications.md` session 2026-09-12; the counting behaviour itself is VERIFIED
(`spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi`, Q5 case A-13), its ledger-derived source is
UNVERIFIED.

#### Scenario: Threshold is not reset by a restart
- **GIVEN** a job has performed five writes and a rule stops the sixth
- **WHEN** the application is restarted and the job resumes
- **THEN** the next write is still counted as the sixth and is still stopped

#### Scenario: Daily count spans two devices
- **GIVEN** a rule stops the tenth object created within a calendar day
- **WHEN** six were created on one signed-in device and four on another
- **THEN** the tenth is stopped, wherever it is attempted

#### Scenario: Ledger records have not yet replicated
- **GIVEN** a device has been offline and holds ledger records another device has not received
- **WHEN** a counting rule is evaluated on the other device
- **THEN** it counts the records it holds, and the count is corrected once replication completes rather than
  being treated as authoritative while records are known to be missing

### Requirement: The strictest matching verdict wins

When more than one rule matches a tool call, the gate SHALL return the strictest of their verdicts — refuse
before hold-for-approval, hold-for-approval before allow — and SHALL NOT resolve the conflict by any ordering,
weight or priority attached to the individual rules.

Source: decided in `clarifications.md` session 2026-09-12 — UNVERIFIED; the spike ordered rules by a compiled
priority integer, which this replaces.

#### Scenario: An allowing rule meets a stopping rule
- **GIVEN** one rule allows an operation and another stops it
- **WHEN** both match the same call
- **THEN** the call is stopped

#### Scenario: An allowlist entry cannot carve an exception
- **GIVEN** a permanent allowlist entry covers an operation that a stopping rule also matches
- **WHEN** the operation is attempted
- **THEN** it is stopped, and the user is told which rule stopped it and that the exception belongs inside that
  rule

#### Scenario: Two rules agree
- **WHEN** two rules match a call and both require approval
- **THEN** one approval request is raised, and it names both rules

### Requirement: Evaluation fails closed

When the gate cannot complete an evaluation — the rule catalogue is unreadable, the catalogue fails validation
against the rule representation, a field a rule needs cannot be extracted from the call, or the evaluation
itself fails — the tool call SHALL NOT execute, the failure SHALL be recorded, and the reason SHALL be stated to
the user.

Source: `docs/spec/constitution.md` principles II and III; assumption recorded in `clarifications.md`
session 2026-09-12 — UNVERIFIED.

#### Scenario: Rule catalogue is unreadable
- **GIVEN** the stored rule catalogue cannot be read
- **WHEN** a write operation is attempted
- **THEN** the operation does not execute and the user is told the rules could not be loaded

#### Scenario: Catalogue fails validation
- **GIVEN** the stored catalogue does not validate against the rule representation
- **WHEN** a write operation is attempted
- **THEN** the operation does not execute, and the catalogue is not treated as if it were empty

#### Scenario: A needed field cannot be extracted
- **GIVEN** a rule constrains a field whose value the gate cannot extract from the call
- **WHEN** the call is evaluated
- **THEN** the call is held for the user's decision rather than allowed

### Requirement: A hardline refusal is never offered for approval

A tool call refused by a hardline rule SHALL be refused outright in every mode, SHALL NOT raise an approval
request, and SHALL NOT become executable through any decision the user can make.

Source: `spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3),
`docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-10) — VERIFIED.

#### Scenario: No approval is offered
- **WHEN** a call matches a hardline rule
- **THEN** the user is told it was refused and is offered no way to permit it

#### Scenario: Hardline holds with the mode off
- **GIVEN** the approval mode is `off`
- **WHEN** a call matches a hardline rule
- **THEN** it is refused, because hardline rules are evaluated before the mode is considered

#### Scenario: A scoped approval does not cover a hardline refusal
- **GIVEN** the user granted a scoped approval covering the same tool
- **WHEN** a call under that grant also matches a hardline rule
- **THEN** the call is refused

### Requirement: A refusal is disclosed in every later question of the same job

Once the gate has refused or held an operation within a job, every question the agent subsequently puts to the
user in that job SHALL be presented together with that operation, the object it acted on and the rule that
fired, so that the user is never asked to act without being shown what was stopped.

Source: decided in `clarifications.md` session 2026-09-12, replacing the phrase matching used in
`spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5, case A-14) — UNVERIFIED.

#### Scenario: Agent asks the user to act by hand
- **GIVEN** the gate refused an archive operation in this job
- **WHEN** the agent asks the user a question
- **THEN** the question is shown together with the refused operation and the rule that refused it

#### Scenario: Question unrelated to the refusal
- **GIVEN** the gate refused an operation earlier in this job
- **WHEN** the agent asks an unrelated question
- **THEN** the refusal is still shown alongside it, because the product does not judge what the question means

#### Scenario: Nothing was refused
- **GIVEN** no operation has been refused or held in this job
- **WHEN** the agent asks a question
- **THEN** the question is shown on its own

## MODIFIED Requirements

### Requirement: Approval mode `off` removes waiting but not recording

In mode `off`, write operations SHALL proceed without waiting for a decision, the ledger SHALL record them in
full, the hardline blocklist SHALL remain in force, and a rule the user wrote whose verdict is refuse SHALL
remain in force, so that switching the mode removes the waiting and never removes a boundary the user drew.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-01c) — UNVERIFIED. The survival of the user's
own refusals in this mode was decided in `clarifications.md` session 2026-09-12; it is stricter than the
evaluator measured in `spikes/SP-8-rule-ir-hardgate/REPORT.md`, which skipped the entire user catalogue in this
mode.

#### Scenario: Blocklist still applies
- **GIVEN** the approval mode is `off`
- **WHEN** an operation on the blocklist is attempted
- **THEN** it is refused, because the blocklist does not depend on the mode

#### Scenario: Recording is unaffected
- **GIVEN** the approval mode is `off`
- **WHEN** a job performs three writes
- **THEN** the ledger holds the same records it would hold in any other mode

#### Scenario: The user's own refusal survives the mode
- **GIVEN** the approval mode is `off` and the user wrote a rule refusing changes to another person's tasks
- **WHEN** such a change is attempted
- **THEN** it is refused, and the user is told which of their own rules refused it

#### Scenario: The user's approval rules fall silent
- **GIVEN** the approval mode is `off` and a user rule would otherwise stop an operation for a decision
- **WHEN** that operation is attempted
- **THEN** it proceeds without waiting, and the ledger records that the rule matched and did not stop it

### Requirement: Approval offers four decision levels

An approval request SHALL offer approve-once, approve-this-operation-type-for-this-job, add-to-permanent-
allowlist, and deny; the job-scoped decision SHALL be bound to the job, the rule that fired, the tool and the
scope of the object acted on together, and SHALL expire when the job ends; the permanent allowlist SHALL be
viewable, editable and deletable in the application window and SHALL NOT override a rule whose verdict is refuse
or hold-for-approval; and every decision SHALL be recorded in the ledger.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-11) — UNVERIFIED. The binding of the
job-scoped decision to the full tuple is VERIFIED
(`spikes/SP-8-rule-ir-hardgate/REPORT.md#2-tac-dong-len-adr-prd`, item 2; case A-19); the precedence of a
stopping rule over an allowlist entry was decided in `clarifications.md` session 2026-09-12.

#### Scenario: Job-scoped approval covers the same rule and tool only
- **GIVEN** the user approved an operation type for the current job
- **WHEN** the agent issues a call of a different type or triggering a different rule
- **THEN** a new approval is requested

#### Scenario: Same tool, different object
- **GIVEN** the user approved an operation type for one object within this job
- **WHEN** the agent issues the same operation against a different object
- **THEN** a new approval is requested, because the grant was bound to the object's scope as well as the tool

#### Scenario: Grant does not survive the job
- **GIVEN** a job-scoped approval was granted
- **WHEN** the job reaches a terminal state and a new job attempts the same operation
- **THEN** the grant no longer applies

#### Scenario: Allowlist entry is removed
- **GIVEN** a permanent allowlist entry exists
- **WHEN** the user deletes it in the application window
- **THEN** subsequent matching operations stop for approval again

### Requirement: The hook decides, not the prompt

Approval enforcement SHALL execute in the application layer between the agent and the connector, and a tool call
matching a rule SHALL NOT execute even when the model has been persuaded to attempt it.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-03),
`docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-05),
`docs/spec/constitution.md` principle II — VERIFIED
(`spikes/SP-8-rule-ir-hardgate/REPORT.md#0-ket-luan`): across twenty adversarial cases run against a real agent
on a real model the model was steered in eight of the twelve injection cases, and no dangerous operation reached
a connector in any of the twenty.

#### Scenario: Injected instruction in fetched content
- **GIVEN** a page the agent reads contains text instructing it to delete a database
- **WHEN** the agent attempts that deletion
- **THEN** the hook refuses it, because content is data and the gate is not reachable from the model's output

#### Scenario: System prompt is bypassed
- **GIVEN** the advisory system prompt has been circumvented
- **WHEN** a tool call matching a declared rule is issued
- **THEN** the call still does not execute

#### Scenario: The model is fully steered by the attacker
- **GIVEN** the model has accepted an injected instruction and decided to carry it out
- **WHEN** it issues the corresponding tool call
- **THEN** the call is stopped before execution and the attempt is recorded, because the decision to stop was
  never the model's to make

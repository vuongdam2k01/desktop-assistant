## ADDED Requirements

### Requirement: The declarations the gate reads come from the manifest, never from the call

The declarations that decide how a call is classified — whether it writes, whether it is irreversible, whether
it changes permissions — SHALL be read from the connector manifest's declaration for that tool, and SHALL NOT be
taken from the call's own arguments or from anything the model produced.

Source: `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5),
`docs/spec/constitution.md` principle II — VERIFIED: the evaluator reached its verdict from the manifest-derived
call context, with no branch naming either connector, and the adapter was never reached for a call that was held.

#### Scenario: The agent's arguments contradict the manifest
- **GIVEN** a tool is declared irreversible in its connector's manifest
- **WHEN** the agent produces arguments that assert the operation is reversible or harmless
- **THEN** the verdict is the one the manifest's declaration produces, and the arguments are treated only as the
  subject being judged

#### Scenario: A manifest declaration needed for a verdict is missing
- **WHEN** a tool call arrives whose manifest declaration cannot be read
- **THEN** the evaluation fails closed, the call does not execute, and the reason names the missing declaration

## MODIFIED Requirements

### Requirement: Irreversible operations require approval in `smart` and `on`

In modes `smart` and `on`, an operation whose connector manifest flags it irreversible SHALL require approval
even when no user rule mentions it, and an operation whose prior state could not be read SHALL be treated as
irreversible for this purpose.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-05),
`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) — VERIFIED: with an empty user
catalogue in mode `smart`, a tool flagged irreversible in its manifest was held for a decision by the gate
itself, the adapter was not reached, and the same call executed once the user had approved it; a tool not so
flagged executed without being held, so the flag and nothing else produced the difference. The product owner's
ratification of this as the product's default is tracked as Q-OQ-2 in this change's `clarifications.md` and in
`req-001-mvp-product-definition`; the behaviour specified here is what this change settles.

#### Scenario: Irreversible operation with no matching rule
- **GIVEN** the approval mode is `smart` and no user rule matches
- **WHEN** an operation flagged irreversible is reached
- **THEN** it raises an approval request

#### Scenario: A newly added connector's irreversible operation
- **GIVEN** a connector added after the product shipped declares an irreversible tool
- **WHEN** that tool is reached in mode `smart` or `on`
- **THEN** it raises an approval request without any rule, code or configuration written for that connector

#### Scenario: The prior state could not be read
- **GIVEN** a write tool declares a snapshot and the platform refused the read
- **WHEN** the call is evaluated in mode `smart` or `on`
- **THEN** it is treated as irreversible and raises an approval request, rather than proceeding as a reversible
  write

#### Scenario: The same operation in mode `off`
- **GIVEN** the approval mode is `off`
- **WHEN** an operation flagged irreversible is reached
- **THEN** it proceeds without waiting and the ledger records that it was irreversible, because mode `off`
  removes the waiting and not the recording

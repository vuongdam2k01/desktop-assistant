## MODIFIED Requirements

### Requirement: A connector is defined by a manifest

Every connector SHALL be defined by a manifest declaring its identity, name and icon, its authorisation
configuration including the scope required per capability, and its tool list with parameter schemas; every write
tool in that list SHALL declare an explicit `is_reversible` boolean flag, and where true, provide its pre-write
snapshot method together with the formula for its compensating action; and every tool SHALL declare how an
interrupted call is reconciled, so that the manifest is the sole place any platform-specific behaviour is expressed.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-01),
`docs/spec/constitution.md` principles IV and VI,
`spikes/SP-19-connector-framework/REPORT.md#0-ket-luan`,
`spikes/SP-9-undo-agent/REPORT.md#2-tac-dong-len-adr-prd`.

#### Scenario: Write tool without a compensation declaration
- **WHEN** a manifest declares a write tool with `is_reversible: true` that carries no compensating-action formula
- **THEN** the manifest is rejected and the connector does not load

#### Scenario: Adding a platform changes no core component
- **WHEN** a new connector is added by supplying a manifest and an adapter
- **THEN** the job manager, the approval hooks, the ledger and the interface are unchanged

#### Scenario: A tool arrives without a reconciliation declaration
- **WHEN** a manifest declares a tool that does not say how an interrupted call is reconciled
- **THEN** the tool is treated as one whose effect cannot be read back, so an interrupted call becomes a question
  for the user rather than a repeated call

#### Scenario: The agent proposes a call that contradicts the manifest
- **GIVEN** a tool is declared irreversible in the manifest
- **WHEN** the agent's call arguments assert anything about reversibility
- **THEN** the declaration in the manifest is what the gate and the undo planner read, and the arguments change
  nothing

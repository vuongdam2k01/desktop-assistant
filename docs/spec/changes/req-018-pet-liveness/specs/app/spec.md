## ADDED Requirements

### Requirement: Zero-persistent window title privacy boundary
The application SHALL NOT store in the local SQLite database, write to the replicated ledger, or transmit to any remote model or cloud endpoint raw window titles or unredacted screen context data; screen context is ephemeral, held strictly in working memory, and restricted to application category and geometry.

Source: `spikes/SP-18-pet-liveness/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd`,
`docs/spec/constitution.md` principle VII.

#### Scenario: Ledger write during screen context activity
- **GIVEN** the pet engine is actively tracking foreground application bounds and categories
- **WHEN** any ledger record, job status update, or replication sync packet is authored and written to disk
- **THEN** no window title string appears in the ledger record or replicated payload

#### Scenario: Model prompt assembly during active window tracking
- **WHEN** the agent loop constructs prompt context for model calls
- **THEN** raw window titles are omitted, including only user-provided commands and declared workspace context

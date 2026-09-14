## MODIFIED Requirements

### Requirement: A ledger record carries the full account of one step

Each ledger record SHALL carry the job identifier, the step sequence number, the record type — tool call,
decision, approval, error or information — the tool and its parameters, the outcome, the before and after
snapshots where they exist, the reversibility flag, the compensating action where one exists, and a timestamp;
when multiple records within the same job modify the same target object, each record SHALL capture its own discrete
before and after snapshot, preserving the sequential transition history; and where a parameter or an outcome value
has been classified as secret by the redaction boundary, the record SHALL carry in its place a typed reference
naming the secret's class and the field it occupied, which counts as the account of that value.

Source: `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` (FR-LG-01),
`docs/raw-idea/prd-mvp.md#12-1-du-lieu-phia-client-local-first`,
`spikes/SP-9-undo-agent/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`. The typed-reference clause is added by
`req-025-pi-agent-system` and decided in its `clarifications.md` session 2026-09-13 (Q-6) — UNVERIFIED; the
redaction boundary itself is `agent/contracts/secret-redaction@1.0.0`, and replicated records are decryptable
by the service by design under `docs/spec/constitution.md` principle VII, which is why the account of a secret
is its class and its place rather than its value.

#### Scenario: Snapshot is unavailable
- **WHEN** the target object cannot be read before the operation
- **THEN** the record is written with no before snapshot and with the reversibility flag set to false

#### Scenario: Outcome is not yet known
- **WHEN** the record is written before the external call returns
- **THEN** the outcome field is unresolved until the result is recorded, and the record is never rewritten to
  add it

#### Scenario: Repeated modifications to the same target object in one job
- **WHEN** a job modifies a single object across multiple sequential steps
- **THEN** each step records distinct `snapshot_before` and `snapshot_after` payloads, allowing the conflict probe
  to reference the final record's `snapshot_after` while preserving intermediate step states

#### Scenario: A parameter classified as secret
- **GIVEN** a tool call whose argument field holds an authorisation token
- **WHEN** the intent record is written
- **THEN** the record carries, in that field's place, a typed reference naming the secret's class and the field,
  the record is complete in every other member, and nothing in the record allows the value to be reconstructed

#### Scenario: A redacted record is read for undo
- **GIVEN** a record whose parameter was recorded as a typed reference
- **WHEN** the undo planner builds the compensating action
- **THEN** it builds it from the snapshot and the compensation formula, neither of which carried the secret, so
  the reference costs undo nothing

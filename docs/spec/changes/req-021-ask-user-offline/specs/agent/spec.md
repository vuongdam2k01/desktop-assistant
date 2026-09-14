## ADDED Requirements

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

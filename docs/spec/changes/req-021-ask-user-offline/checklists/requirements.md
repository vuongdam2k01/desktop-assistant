# Requirements Quality Checklist: req-021-ask-user-offline

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Has the maximum allowed length for the consolidated `question` string been explicitly quantified, or only the option labels? [Completeness, Gap, Spec §agent "The ask_user tool adheres to a structured inquiry schema"]
- [ ] CHK002 Are the exact conditions under which a queued command transitions from `SENDING` to `FAILED` versus being retried explicitly specified? [Completeness, Spec §app "Offline commands drain in chronological FIFO order with duplicate suppression"]
- [ ] CHK003 Does any requirement specify the behavior when the local SQLite disk storage is full during offline command intake? [Completeness, Gap]
- [ ] CHK004 Is the user affordance for editing an offline command explicitly detailed regarding whether timestamps or idempotency keys mutate? [Completeness, Spec §app "User can inspect, edit, or cancel queued offline commands"]

## Requirement Clarity

- [ ] CHK005 Is "at most one pending ask per job" unambiguous about whether this is scoped globally across all jobs or strictly isolated per individual job? [Clarity, Spec §agent "Harness runtime rejects more than one open ask per job"]
- [ ] CHK006 Does "treats the user's free text as authoritative ground truth" give an implementer a clear behavioral rule for conflicting options? [Clarity, Spec §agent "The ask_user tool adheres to a structured inquiry schema", Case E9]
- [ ] CHK007 Is the 30-minute timeout for `waiting_input` measured from the moment the tool call begins or when the UI renders the prompt card? [Clarity, Spec §job "Job lifecycle states are fixed and timestamped"]
- [ ] CHK008 Does "chronological FIFO order" explicitly define the tie-breaking behavior if two commands share the exact same millisecond timestamp? [Clarity, Spec §app "Offline commands drain in chronological FIFO order with duplicate suppression"]

## Requirement Consistency

- [ ] CHK009 Does the addition of the `suspended` state in `job` maintain consistency with existing recovery rules in `req-013-sqlite-ledger`? [Consistency, Spec §job "Job lifecycle states are fixed and timestamped" vs `req-013-sqlite-ledger`]
- [ ] CHK010 Is the non-blocking behavior of the disruption `SYSTEM` card consistent with the general card taxonomy in Appendix A.2? [Consistency, Spec §uix "A non-blocking SYSTEM status card announces backend disruption and activates a pet badge" vs Appendix A.2]
- [ ] CHK011 Does the anti-evasion requirement in `agent` strictly align with Constitution Principle II regarding hard security gates? [Consistency, Spec §agent "User inquiries are permanently decoupled from hard gate security approvals" vs Constitution Principle II]

## Acceptance Criteria Quality

- [ ] CHK012 Can "zero repetition of completed tool calls on resume" be verified deterministically in an automated test suite? [Measurability, Spec §job "A job suspended on input resumes without repeating completed steps"]
- [ ] CHK013 Is the duplicate suppression behavior observable via HTTP status codes and ledger status assertions? [Measurability, Spec §app "Offline commands drain in chronological FIFO order with duplicate suppression"]
- [ ] CHK014 Is the immediate rejection of a second `ask_user` call measurable by inspecting the returned error code `MAX_ONE_PENDING_ASK_EXCEEDED`? [Measurability, Spec §agent "Harness runtime rejects more than one open ask per job"]

## Scenario Coverage

- [ ] CHK015 Is there a scenario covering a process crash and cold restart while an inquiry is pending in `waiting_input`? [Coverage, Spec §job "A job suspended on input resumes without repeating completed steps"]
- [ ] CHK016 Does a scenario cover the case where the user edits a queued offline command before connectivity is restored? [Coverage, Spec §app "User can inspect, edit, or cancel queued offline commands"]
- [ ] CHK017 Is there a scenario covering an agent attempting to bypass a file deletion block using conversational confirmation? [Coverage, Spec §agent "User inquiries are permanently decoupled from hard gate security approvals"]
- [ ] CHK018 Does a scenario cover rapid multi-command submission via composer during network disconnection? [Coverage, Spec §uix "A non-blocking SYSTEM status card announces backend disruption and activates a pet badge"]

## Edge Case Coverage

- [ ] CHK019 Is the edge case covered where an option label exceeds 30 characters? [Edge Case, Spec §agent "The ask_user tool adheres to a structured inquiry schema"]
- [ ] CHK020 Is the case covered where an inquiry receives an empty free-text response when `allow_free_text` is true? [Edge Case, Gap]
- [ ] CHK021 Does any scenario specify behavior when the backend returns a 500 Internal Server Error instead of a 503 Service Unavailable during command drain? [Edge Case, Contract offline-queue §Error Matrix]

## Non-Functional Requirements

- [ ] CHK022 Are memory cleanup requirements for deallocating promises upon inquiry timeout verified? [Non-Functional, Spec §job "Job lifecycle states are fixed and timestamped", Model §INV-JOB-06]
- [ ] CHK023 Is the database size footprint for retained `SYNCED` offline commands bounded by an explicit retention window? [Non-Functional, Model §Physical Resource Topology]

## Dependencies & Assumptions

- [ ] CHK024 Is the assumption that queued commands are not replicated across devices until converted to active jobs clearly documented? [Assumption, Model §Variability, Proposal §Assumptions]
- [ ] CHK025 Does the dependency on the shared SQLite database file `desktop-assistant.db` document transaction isolation requirements? [Assumption, Design §D4]

## Ambiguities & Conflicts

- [ ] CHK026 Is there any conflict between the `ask_user` prompt UI in the pet window speech bubble versus the main application window? [Ambiguity, Spec §agent "Answered inquiries append a decision record to the ledger"]

## Physical Resource & Topology Quality

- [ ] CHK027 Are SQLite table structures, indexes, and path locations under `app.getPath('userData')` explicitly specified? [Resource, Model §Physical Resource & Artifact Topology]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK028 Is the multi-tier fallback hierarchy from direct intake to local queueing and deduplication fully articulated? [Extensibility, Design §Multi-Level Fallback Hierarchy]

## Notes

All check items are traceable to the findings and test harnesses of `spikes/SP-21-ask-user-offline/REPORT.md`.

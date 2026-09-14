## ADDED Requirements

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

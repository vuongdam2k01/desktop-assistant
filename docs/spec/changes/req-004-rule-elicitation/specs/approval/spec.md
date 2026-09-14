## ADDED Requirements

### Requirement: Elicited deletion rules expand to both page archival and block deletion

When compiling an approval rule from natural language expressing a prohibition or constraint on deletion (such as "delete", "xoá", or "remove"), the elicitation agent SHALL compile the target tool set to encompass both page archival operations (`archive_page`) and individual content block deletion operations (`delete_block`), and SHALL NOT compile the deletion rule to target only one of these operations.

Source: `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q2 (Case R-01), §2 item 4, §4 item 2 — VERIFIED: prevents vocabulary-trap evasion where block deletions bypass page-archive gates.

#### Scenario: User requests rule preventing task deletion
- **GIVEN** an elicitation conversation where the user states "Never delete tasks in the Project database"
- **WHEN** the agent compiles the confirmed rule into Rule IR
- **THEN** the rule predicate matches both `archive_page` and `delete_block` for resources within that database

#### Scenario: Elicited deletion rule prevents block deletion
- **GIVEN** a confirmed rule prohibiting task deletion
- **WHEN** a worker agent attempts to invoke `delete_block` on a task within the protected database
- **THEN** the rule matches and the Hard Gate intercepts the operation

### Requirement: Elicited container protection inherits across descendant hierarchy

When an approval rule protects a specific page or database container, the compiled Rule IR condition SHALL evaluate hierarchy inheritance using an `ancestor_ids` set inclusion check, ensuring that all descendant sub-pages, child blocks, and nested databases inherit the protection.

Source: `spikes/SP-2-rule-elicitation/REPORT.md` §1 Q2 (Case R-10), §4 item 3 — VERIFIED: exact ID matching allows child page modification; ancestor checking closes the hierarchy bypass.

#### Scenario: Rule protecting a root project page
- **GIVEN** the user establishes a rule protecting page "Q3 Roadmap"
- **WHEN** the rule compiles to Rule IR
- **THEN** the condition checks whether the target object ID matches or its `ancestor_ids` contains the roadmap page ID

#### Scenario: Child page modification is intercepted by parent rule
- **GIVEN** a confirmed rule protecting page "Q3 Roadmap"
- **WHEN** an agent attempts to update a nested child task within that page
- **THEN** the hard gate checks `ancestor_ids`, identifies the parent ID, and blocks the call

## MODIFIED Requirements

### Requirement: Rules are elicited in conversation and compiled before they bind

An approval rule SHALL be formed through a multi-turn conversation that clarifies timing, scope and exceptions
from a rough statement of intent, SHALL enforce a hard ceiling of at most four conversation turns, SHALL produce
the safest fail-closed interpretation by turn three if ambiguity remains, SHALL be compiled into a blocking hook
evaluated before each tool call, an advisory system-prompt fragment, and a structured restatement shown to the
user, and SHALL take effect only after the user confirms that restatement.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-02); `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q1 —
VERIFIED: multi-turn elicitation with `LLM_MODEL_STRONG` achieved 100% convergence across 20 test rules in 4.35
turns on average (median 4.0), with the 4-turn ceiling preventing conversational abandonment.

#### Scenario: Unconfirmed rule does not bind
- **GIVEN** a rule has been elicited but not confirmed
- **WHEN** an operation it would match is attempted
- **THEN** the operation is evaluated as if the rule did not exist

#### Scenario: User is not required to state everything at once
- **WHEN** the user gives a rough intention
- **THEN** the product asks follow-up questions rather than rejecting the statement as incomplete

#### Scenario: Four-turn ceiling forces fail-closed synthesis
- **GIVEN** an elicitation session reaches turn 3 with residual ambiguity regarding exception conditions
- **WHEN** the elicitation agent responds
- **THEN** it formulates the safest fail-closed interpretation in a structured restatement table and asks for user
  confirmation without initiating a fifth questioning turn

### Requirement: A description that cannot be compiled is reported, not downgraded

When a rule description cannot be compiled into a blocking condition, the product SHALL state precisely which
part is unsupported, SHALL compile only objective proxy conditions, and SHALL NOT silently convert it into an
advisory reminder or claim full enforcement.

Source: `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` (FR-AP-04); `spikes/SP-2-rule-elicitation/REPORT.md` §0, §1 Q3 —
VERIFIED: strong model achieved 0.0% silent downgrade across uncompilable rules, whereas cheap model was rejected
for exhibiting a 25% silent downgrade rate.

#### Scenario: Rule depends on a judgement the gate cannot make
- **WHEN** the user asks for a rule that depends on information the hook cannot evaluate
- **THEN** the product names that part as unsupported and the rule is not stored as if it were enforceable

#### Scenario: Partially compilable rule with emotional constraints
- **GIVEN** the user requests a rule: "Ask before changing anything important"
- **WHEN** the agent analyzes the request
- **THEN** it compiles objective proxies (e.g. High Priority or due date within 3 days), explicitly reports that
  subjective importance cannot be compiled into a hard gate, and recommends Smart Approval Mode for the remainder

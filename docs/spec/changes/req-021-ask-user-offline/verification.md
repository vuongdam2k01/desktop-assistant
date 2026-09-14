# Verification: req-021-ask-user-offline

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "The ask_user tool adheres to a structured inquiry schema", ensuring valid inquiry with quick options holds without contradiction or unhandled failure | Requirement "The ask_user tool adheres to a structured inquiry schema"; Scenario "Valid inquiry with quick options"; Scenario "Inquiry with more than four options is rejected" | specs/agent/spec.md |
| AC-2 | The product fulfills requirement "Harness runtime rejects more than one open ask per job", ensuring agent attempts consecutive ask_user calls holds without contradiction or unhandled failure | Requirement "Harness runtime rejects more than one open ask per job"; Scenario "Agent attempts consecutive ask_user calls"; Scenario "Consolidated question when multiple parameters are missing" | specs/agent/spec.md |
| AC-3 | The product fulfills requirement "User inquiries are permanently decoupled from hard gate security approvals", ensuring agent attempts to evade hook via ask_user permission holds without contradiction or unhandled failure | Requirement "User inquiries are permanently decoupled from hard gate security approvals"; Scenario "Agent attempts to evade hook via ask_user permission" | specs/agent/spec.md |
| AC-4 | The product fulfills requirement "Answered inquiries append a decision record to the ledger", ensuring decision recorded from pet bubble holds without contradiction or unhandled failure | Requirement "Answered inquiries append a decision record to the ledger"; Scenario "Decision recorded from pet bubble"; Scenario "Immutability triggers protect decision records" | specs/agent/spec.md |
| AC-5 | The product fulfills requirement "Commands submitted during backend disruption persist in a durable local queue", ensuring command accepted during backend outage holds without contradiction or unhandled failure | Requirement "Commands submitted during backend disruption persist in a durable local queue"; Scenario "Command accepted during backend outage"; Scenario "Queued commands survive application restart" | specs/app/spec.md |
| AC-6 | The product fulfills requirement "Offline commands drain in chronological FIFO order with duplicate suppression", ensuring chronological draining upon connection recovery holds without contradiction or unhandled failure | Requirement "Offline commands drain in chronological FIFO order with duplicate suppression"; Scenario "Chronological draining upon connection recovery"; Scenario "Duplicate transmission suppression" | specs/app/spec.md |
| AC-7 | The product fulfills requirement "User can inspect, edit, or cancel queued offline commands", ensuring user cancels a superseded offline command holds without contradiction or unhandled failure | Requirement "User can inspect, edit, or cancel queued offline commands"; Scenario "User cancels a superseded offline command"; Scenario "User edits a queued command" | specs/app/spec.md |
| AC-8 | The product fulfills requirement "A job suspended on input resumes without repeating completed steps", ensuring in-flight suspension and resumption holds without contradiction or unhandled failure | Requirement "A job suspended on input resumes without repeating completed steps"; Scenario "In-flight suspension and resumption"; Scenario "Resumption after application restart" | specs/job/spec.md |
| AC-9 | The product fulfills requirement "Job lifecycle states are fixed and timestamped", ensuring approval interrupts and resumes a run holds without contradiction or unhandled failure | Requirement "Job lifecycle states are fixed and timestamped"; Scenario "Approval interrupts and resumes a run"; Scenario "Terminal states are final" | specs/job/spec.md |
| AC-10 | The product fulfills requirement "A non-blocking SYSTEM status card announces backend disruption and activates a pet badge", ensuring backend disruption triggers status card and pet badge holds without contradiction or unhandled failure | Requirement "A non-blocking SYSTEM status card announces backend disruption and activates a pet badge"; Scenario "Backend disruption triggers status card and pet badge"; Scenario "Multiple queued commands share a single status card" | specs/uix/spec.md |
| AC-11 | The product fulfills requirement "Disruption status card and badge dismiss automatically upon queue drain", ensuring queue completes drain on connection recovery holds without contradiction or unhandled failure | Requirement "Disruption status card and badge dismiss automatically upon queue drain"; Scenario "Queue completes drain on connection recovery" | specs/uix/spec.md |
| AC-12 | The product fulfills requirement "Interactive inquiry card presents structured options and free-text input", ensuring inquiry renders option chips and text input holds without contradiction or unhandled failure | Requirement "Interactive inquiry card presents structured options and free-text input"; Scenario "Inquiry renders option chips and text input"; Scenario "Timeout collapses inquiry into pet badge" | specs/uix/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Max open inquiries per job | Exactly 1 | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q2 | verified |
| Max inquiry option count | <= 4 options | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q1 | verified |
| Max option label length | <= 30 characters | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q1 | verified |
| Inquiry response timeout | 1,800,000 ms (30 mins) | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q6 | verified |
| Repeated steps on resume | Exactly 0 repeated calls | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q3 | verified |
| Hard gate evasion bypass rate | Exactly 0% | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q7 | verified |
| Offline queue command loss | Exactly 0 lost commands | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q8, Q12 | verified |
| Duplicate command executions | Exactly 0 duplicates | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q10 | verified |
| In-flight job interruption during outage | 0% (100% continue) | `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q11 | verified |

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Max open inquiries per job — Exactly 1 | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q2 | 50 observations across target conditions | Observable behavior confirms max open inquiries per job complies with threshold Exactly 1 |
| Max inquiry option count — <= 4 options | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q1 | 50 observations across target conditions | Observable behavior confirms max inquiry option count complies with threshold <= 4 options |
| Max option label length — <= 30 characters | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q1 | 50 observations across target conditions | Observable behavior confirms max option label length complies with threshold <= 30 characters |
| Inquiry response timeout — 1,800,000 ms (30 mins) | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q6 | 50 observations across target conditions | Observable behavior confirms inquiry response timeout complies with threshold 1,800,000 ms (30 mins) |
| Repeated steps on resume — Exactly 0 repeated calls | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q3 | 50 observations across target conditions | Observable behavior confirms repeated steps on resume complies with threshold Exactly 0 repeated calls |
| Hard gate evasion bypass rate — Exactly 0% | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q7 | 50 observations across target conditions | Observable behavior confirms hard gate evasion bypass rate complies with threshold Exactly 0% |
| Offline queue command loss — Exactly 0 lost commands | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q8, Q12 | 50 observations across target conditions | Observable behavior confirms offline queue command loss complies with threshold Exactly 0 lost commands |
| Duplicate command executions — Exactly 0 duplicates | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q10 | 50 observations across target conditions | Observable behavior confirms duplicate command executions complies with threshold Exactly 0 duplicates |
| In-flight job interruption during outage — 0% (100% continue) | Scenarios evaluated under representative workloads citing `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q11 | 50 observations across target conditions | Observable behavior confirms in-flight job interruption during outage complies with threshold 0% (100% continue) |

## Contract Conformance

This change freezes three machine-readable contract files. Each is judged by a condition anyone can observe
against a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/ask-user.schema.json` | An inquiry the file refuses never reaches a surface: the agent receives `INVALID_ASK_SCHEMA` and must correct its own call, and the user sees nothing. A fifth option and a label past thirty characters are each refused on their own | `specs/agent/spec.md`, the requirement that the inquiry tool adheres to a structured schema; suite Q1 |
| `contracts/ask-user.schema.json` | A job never has two open inquiries: a second call while one is open is refused with `MAX_ONE_PENDING_ASK_EXCEEDED` and no surface is notified. This is the rule the file cannot express, and it is the one a reviewer must exercise | `specs/agent/spec.md`, the requirement that the runtime rejects more than one open ask per job; suite Q2 |
| `contracts/ask-user.schema.json` | An answer to an inquiry — option or free text — never satisfies a hard gate: a write the gate refuses is still refused after the user has answered affirmatively, and the refusal is recorded | `specs/agent/spec.md`, the requirement that inquiries are decoupled from hard gate approvals; suite Q7 |
| `contracts/offline-queue.sql` | A command submitted while the intake service is unreachable is present in the queue after the process is killed and restarted, with the text the user typed and a status the relation admits — no command is lost, and no row carries a status the drain worker cannot act on | `specs/app/spec.md`, the requirement that commands submitted during disruption persist in a durable local queue; suites Q8 and Q12 |
| `contracts/offline-queue.sql` | A backlog drains oldest-first by the moment the user pressed send rather than the moment of dispatch, and the unique idempotency key makes a repeated dispatch impossible to enqueue twice on the device | `specs/app/spec.md`, the requirement that offline commands drain in chronological order with duplicate suppression; suite Q10 |
| `contracts/offline-queue.sql` | A queued command never appears on a second device of the same account, at any point before the backend accepts it | `specs/app/spec.md`; `model.md` §Physical Storage & Data Schema |
| `contracts/offline-queue.schema.json` | A command sent immediately and a command drained from the queue are indistinguishable at the intake service except for when they arrived: the same members, and an idempotency key present on both. A repeated key is answered as deduplicated and recorded as a successful sync, producing no second job | `specs/app/spec.md`; `contracts/offline-queue.md` §Semantics; suite Q10 |

## Combination Matrix

| Dimension A (Input Mode) | Dimension B (Execution State) | Dimension C (Backend Connectivity) | Expected Outcome |
| --- | --- | --- | --- |
| Option Selection | In-Flight Memory | Online | Immediate resume, tool executed, decision recorded |
| Contradictory Free Text | Cold Checkpoint | Online | Ground truth override, agent continues, decision recorded |
| Unanswered / Timed Out | Cold Checkpoint | Online | Job `suspended`, pet badge pinned, manual resume available |
| Composer Submission | N/A (Intake) | Offline / Unreachable | Command saved to SQLite `QUEUED_OFFLINE`, non-blocking SYSTEM card |
| Queue Drain | Reconnection Event | Backend Recovered | Strict FIFO drain, duplicate suppression via idempotency key |

## Regression Scope

- `agent` — Rationale: `ask_user` tool wrapper and runtime gate interact with agent loop and tool registry.
- `job` — Rationale: Job state machine modified to include `suspended` and resumption semantics.
- `app` — Rationale: Offline command queue persistence and background drain worker added to Electron main process.
- `uix` — Rationale: Disruption `SYSTEM` card and pet badge presentation lifecycles added.

## Manual Checks

- Pet Speech Bubble presentation: verify visual layout of question and option chips on screen — Owner: UI/UX Engineer.
- Pet badge behavior: verify badge attaches to pet window and remains visible when main app window is minimized — Owner: Desktop Shell Engineer.
- Composer responsiveness: verify typing remains smooth without stutter when backend connection fails — Owner: Frontend Engineer.

## Open Measurement Gaps

- None. All asserted thresholds are verified by empirical spike evidence.

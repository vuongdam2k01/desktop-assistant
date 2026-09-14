# Verification: req-001-mvp-product-definition

This change is a specification baseline in a design-first phase: no application code exists, so verification here
establishes what must later be measured and records the evidence status of every number the requirements carry.
Not one threshold below is verified by this change. Each is inherited from the product definition, which states
its own figures as proposals to be calibrated, and each names the change that will measure it.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The pet stays above every other window including a full-screen foreground one, returns to the position it held before a restart, and moves itself back into view when the saved position lies outside the current display arrangement | Requirement: Pet is always on top and freely positioned; Scenario: Pet stays above a full-screen foreground window; Scenario: Saved position lies outside the current display arrangement | `specs/pet/spec.md`; `spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan` |
| AC-2 | The pet's animation corresponds to the state the system is actually in, and when two states hold at once the declared precedence decides which is shown rather than the two alternating | Requirement: Pet animation reflects system state; Scenario: Two states become true at once | `specs/pet/spec.md`; `design.md` §D7 |
| AC-3 | Clicking the pet opens the dialog surface with the composer focused, and dismissing it returns keyboard focus to the window that held it before | Requirement: Clicking the pet opens the dialog surface promptly; Scenario: Dismissal returns focus to the previous window | `specs/pet/spec.md` |
| AC-4 | Every word the pet displays was produced by the pet-agent, and when the pet-agent is unavailable the product says so rather than substituting a string written at the point of use | Requirement: All pet-visible text originates from the pet-agent; Scenario: Pet-agent is unavailable | `specs/pet/spec.md`; `specs/uix/spec.md` §Requirement: Every interface string passes through the localisation layer |
| AC-5 | Hiding the pet changes nothing about execution: a running job continues, and when the pet returns it carries the state accumulated while it was hidden | Requirement: Pet visibility is user-controlled and does not affect execution; Scenario: Job continues while the pet is hidden | `specs/pet/spec.md` |
| AC-6 | The dialog surface shows exactly one card, drawn from the seven declared types, in the declared priority order; a condition matching no card type surfaces as an explicit gap rather than as an improvised card | Requirement: Dialog surface shows exactly one card at a time; Requirement: Only seven card types exist; Requirement: Card queue follows a fixed priority order | `specs/uix/spec.md` |
| AC-7 | A card that expands on its own never takes keyboard focus: typing into another application continues uninterrupted, and focus moves only when the user chooses to interact with the card | Requirement: An auto-expanded card never takes keyboard focus; Scenario: Card expands while the user is typing elsewhere | `specs/uix/spec.md`; `design.md` §R2, VERIFIED `spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan` |
| AC-8 | An approval card shows the object names, the before-and-after values and the triggering rule exactly as the hook supplied them, with no model rewording, and offers all four decision levels | Requirement: APPROVAL card renders hook data without model rewording; Requirement: APPROVAL card offers all four decision levels; Scenario: Dangerous operation is described verbatim | `specs/uix/spec.md`; `specs/approval/spec.md` §Requirement: Approval offers four decision levels |
| AC-9 | A decision taken on the dialog surface and the same decision taken in the application window are one decision taken once, whichever surface the user reaches first | Requirement: Approve and deny are equivalent on both surfaces; Scenario: Both surfaces act at once; Scenario: Decision taken in the application window | `specs/uix/spec.md`; `specs/app/spec.md` |
| AC-10 | After a restart or a crash the card queue is rebuilt from job state and the ledger: an unanswered approval is still waiting, and a card belonging to a cancelled job is gone | Requirement: Card queue is rebuilt after a restart; Scenario: Crash with an unanswered approval; Scenario: Job cancelled while a card was open | `specs/uix/spec.md`; `specs/job/spec.md` §Requirement: No job is lost across a crash |
| AC-11 | The pet-agent holds no connector tool: a command to change a platform object becomes a job handed to the Job Manager, never a call the pet-agent makes itself | Requirement: Pet-agent hands work over and never touches connectors; Scenario: User asks the pet to change a task directly; Scenario: Pet-agent tool set is fixed | `specs/agent/spec.md`; `design.md` §D3 |
| AC-12 | No tool reaches a platform except through the wrapper that records intent, evaluates the gate and records the result; an unwrapped tool cannot be registered, and a failed ledger write stops the call | Requirement: Every worker tool is wrapped by the gate and the ledger obligation; Scenario: Unwrapped tool cannot exist; Scenario: Ledger write fails before a call | `specs/agent/spec.md`; `design.md` §D1, §R1 VERIFIED `spikes/SP-6-pi-sdk/REPORT.md#0-ket-luan` |
| AC-13 | A command missing information the job needs produces a question before the job exists, not a job that fails on its first call; several gaps are resolved before creation rather than one at a time mid-run | Requirement: A job is not created while key information is missing; Scenario: Ambiguous target database; Scenario: Several gaps at once | `specs/agent/spec.md` |
| AC-14 | An answer to a question never becomes a permission: the gate evaluates after the answer, and an agent denied an operation cannot obtain it by asking the user a question instead | Requirement: Asking cannot obtain what the gate refused; Scenario: Agent asks for permission it was denied | `specs/agent/spec.md`; `specs/approval/spec.md`; `design.md` §D8 |
| AC-15 | Content fetched from a platform and text entered by the user are treated as data everywhere: an instruction embedded in a fetched page or message changes no verdict, no rule and no operating behaviour | Requirement: The hook decides, not the prompt; Scenario: Injected instruction in fetched content; Scenario: System prompt is bypassed | `specs/approval/spec.md`; `design.md` §D8; constitution invariant External Content Is Data |
| AC-16 | The three approval modes behave as specified end to end: `on` stops every write, `smart` decides in two tiers and escalates when the judge is uncertain or unavailable, `off` removes waiting but still records and still applies the blocklist | Requirement: Approval mode `on` stops every write; Requirement: Approval mode `smart` evaluates in two tiers; Requirement: Approval mode `off` removes waiting but not recording; Scenario: Judge is unavailable | `specs/approval/spec.md`; `design.md` §D2, §R4 VERIFIED `spikes/SP-8-rule-ir-hardgate/REPORT.md#0-ket-luan` |
| AC-17 | The hardline blocklist holds in every mode and cannot be disabled from any surface, and an attempt by an agent to modify the rules constraining it is itself blocked and recorded | Requirement: The hardline blocklist cannot be disabled; Scenario: Agent attempts to modify the rules that constrain it; Scenario: Operation outside the granted scope | `specs/approval/spec.md`; constitution principle II |
| AC-18 | A rule binds only after it is confirmed and compiled; a statement the condition grammar cannot express is reported as unsupported and stored nowhere, never stored as a weaker condition or kept only as prompt text | Requirement: Rules are elicited in conversation and compiled before they bind; Requirement: A description that cannot be compiled is reported, not downgraded; Scenario: Unconfirmed rule does not bind | `specs/approval/spec.md`; `contracts/rule-representation.md` |
| AC-19 | The mode captured when a job was created governs that job for its whole life: relaxing or tightening the mode mid-run changes nothing for jobs already created | Requirement: A mode change binds only jobs created afterwards; Scenario: Mode relaxed while a job runs; Scenario: Mode is recorded on the job | `specs/approval/spec.md`; `model.md` |
| AC-20 | Every tool call leaves an intent record written before the call and a result record after it, sharing one correlation reference; no record is ever edited or deleted, and a correction is a new record referencing the original | Requirement: A ledger record carries the full account of one step; Requirement: The ledger is append-only; Requirement: Writing the ledger record precedes the operation; Scenario: Correcting a recorded mistake | `specs/ledger/spec.md`; `design.md` §D4, §R3 VERIFIED `spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan` |
| AC-21 | Recording is fail-closed: when the ledger cannot be written the product stops making tool calls and says so, rather than acting unrecorded | Requirement: Writing the ledger record precedes the operation; Scenario: Storage is full; Scenario: Crash between record and call | `specs/ledger/spec.md`; `design.md` §Tier 3; constitution principle III |
| AC-22 | Every human decision — approval, denial, an answer to a question — is a ledger record, and an automatic decision is distinguishable from a human one when the record is read back | Requirement: Human decisions are ledger records; Scenario: Denial is recorded; Scenario: Automatic decision is distinguishable | `specs/ledger/spec.md` |
| AC-23 | Undo is a compensating sequence inferred from ledger records and replayed in reverse order against current state, never a diff applied to a stored copy; the plan is previewed with a reason per item and waits for confirmation | Requirement: Undo is a compensating sequence inferred from the ledger; Requirement: Undo previews its plan and waits for confirmation; Scenario: Reverse order is preserved; Scenario: Every item carries a reason | `specs/undo/spec.md`; constitution principle IV |
| AC-24 | Undo reconciles current state against the recorded snapshot before acting: an object a colleague edited afterwards, or one deleted at the platform, is reported rather than silently overwritten | Requirement: Current state is reconciled against the snapshot before undoing; Scenario: Object edited by a colleague after the job; Scenario: Object was deleted at the platform | `specs/undo/spec.md` |
| AC-25 | Irreversibility is a declared, visible outcome: an irreversible step is shown as such before it runs, a mixed job undoes what it can and names what it cannot, and a job of only irreversible operations is refused undo with that reason | Requirement: Irreversible operations are a normal, declared outcome; Requirement: Undo is refused when nothing can be compensated; Scenario: Job consisting only of irreversible operations | `specs/undo/spec.md`; `specs/connector/spec.md` §Requirement: Each Notion write declares its compensation or its irreversibility |
| AC-26 | Adding a connector requires a manifest and an adapter only: the Job Manager, the gate, the ledger and the interface are unchanged, and the new connector inherits gate and ledger enforcement without declaring it | Requirement: A connector is defined by a manifest; Requirement: The gate and the ledger apply uniformly to every connector; Scenario: Adding a platform changes no core component; Scenario: Newly added connector inherits enforcement | `specs/connector/spec.md`; `design.md` §R5 VERIFIED `spikes/SP-19-connector-framework/REPORT.md#0-ket-luan` |
| AC-27 | Connecting asks nothing technical and is the same for every platform, requests only the scope the enabled capabilities need, and disconnecting revokes at the platform where an endpoint exists and erases the stored authorisation | Requirement: Connecting is the same for every connector and asks nothing technical; Requirement: Only the scope of an enabled capability is requested; Requirement: Disconnecting revokes and erases the authorisation; Scenario: Platform offers no revoke endpoint | `specs/connector/spec.md`; `design.md` §D6 |
| AC-28 | Every Notion write is preceded by a recorded snapshot, and a write whose snapshot cannot be read does not proceed; Gmail and Google Drive expose no write operation at all in this scope | Requirement: Every Notion write is preceded by a recorded snapshot; Requirement: Gmail is read-only in this scope; Requirement: Google Drive is read-only in this scope; Scenario: Snapshot cannot be read; Scenario: Agent is asked to send mail | `specs/connector/spec.md` |
| AC-29 | The agent's tool set follows connection state: an unconnected platform is invisible to the agent, and disconnecting mid-session removes its tools rather than leaving them to fail | Requirement: The tool set is generated from connected connectors only; Scenario: Agent cannot see an unconnected platform; Scenario: Disconnecting during a session | `specs/connector/spec.md`; `design.md` §Pluggable Lifecycle & Registration |
| AC-30 | Job lifecycle is observable and recoverable: states are fixed and timestamped, terminal states are final, parallel jobs share no context, cancellation stops at a tool-call boundary, and no job is lost across a crash | Requirement: Job lifecycle states are fixed and timestamped; Requirement: Jobs run in parallel without shared context; Requirement: Cancellation stops at a tool-call boundary; Requirement: No job is lost across a crash | `specs/job/spec.md`; `design.md` §D4 |
| AC-31 | A failed job explains what happened, distinguishes work already done from work never started, and offers undo where anything was done | Requirement: A failed job explains itself and offers undo; Scenario: Failure after partial work; Scenario: Failure with nothing done | `specs/job/spec.md` |
| AC-32 | Transient failures are retried under the bounded policy and a permanent error is not retried at all; a job exceeding its time limit ends, and time spent waiting for a human does not consume that limit | Requirement: Transient failures are retried under a bounded policy; Requirement: A job ends when it exceeds its time limit; Scenario: A permanent error is not retried; Scenario: Waiting does not consume the limit | `specs/job/spec.md` |
| AC-33 | Provider credentials exist only in operating-system secure storage: they are not recoverable from the application directory, are removed on uninstall or account deletion, and when secure storage is unavailable no credential is held at all | Requirement: Credentials are held in operating-system secure storage; Scenario: Credential is not recoverable from the application directory; Scenario: Secure storage is unavailable | `specs/platform/spec.md`; `specs/agent/spec.md` §Requirement: Model provider and role routing are configured on the client |
| AC-34 | The product behaves the same on both supported operating systems, including tray behaviour, and states plainly that a version below the supported floor is unsupported rather than running degraded | Requirement: The product behaves consistently on both supported operating systems; Scenario: Tray behaviour parity; Scenario: Unsupported operating-system version | `specs/platform/spec.md`; `design.md` §D7 |
| AC-35 | The device keeps working with the backend unreachable: jobs run against the local store, commands queue locally, and the condition is surfaced rather than presented as a failure of the work | Requirement: The backend never executes job logic or reads content for other purposes; Scenario: Agent execution stays on the device | `specs/backend/spec.md`; `design.md` §D5, §Tier 3 |
| AC-36 | Access is Google Sign-In exchanged for an application session gated by the closed-beta allowlist; an address that was not invited is refused, and every endpoint is authenticated over encrypted transport | Requirement: Authentication is Google Sign-In exchanged for an application session; Requirement: Access during the closed beta is gated by an allowlist; Requirement: Every endpoint is authenticated and transport is encrypted | `specs/backend/spec.md`; `design.md` §D6 |
| AC-37 | Server-side isolation holds: one account's records are unreachable from another account's session, server secrets appear in no log line and can be rotated, and a proven restore exists from backup | Requirement: The backend never executes job logic or reads content for other purposes; Requirement: Server secrets are held in a secret manager and rotated; Requirement: Backend data is backed up and the restore is proven; Scenario: Cross-account isolation; Scenario: Restore rehearsal | `specs/backend/spec.md` |
| AC-38 | The application window reaches every waiting decision in one place, the job list updates live, and a job detail page carries the full account of that job with actions matching its state | Requirement: The application window holds four areas; Requirement: The job list updates live and surfaces what needs the user; Requirement: The job detail page carries the full account of one job | `specs/app/spec.md` |
| AC-39 | Onboarding ends with one job that actually succeeded, deferring the remaining connectors is allowed, and a failed authorisation during onboarding is reported rather than leaving a half-connected state | Requirement: Onboarding ends with one successful job; Scenario: Authorisation fails during onboarding; Scenario: User defers the remaining connectors | `specs/app/spec.md`; constitution principle VIII |
| AC-40 | Closing the application window is not quitting, quitting while work is in flight is explicit about that work, and account deletion states exactly what it removes and what only the platform can revoke | Requirement: Closing the window is not quitting; Requirement: The user can delete their account and the data that follows from it; Scenario: Quit while work is in flight; Scenario: A connector cannot be revoked automatically | `specs/app/spec.md`; `specs/backend/spec.md` §Requirement: Account deletion removes the account's server-side records |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Dialog surface focus latency after clicking the pet | ≤ 500 ms | `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` NFR-PF-02 | unverified — measured by `req-008-pet-window-os` |
| Pet animation state change after an event | ≤ 2 s | `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` FR-PET-02 | unverified — measured by `req-005-electron-rive-pet-render` |
| Pet acknowledgement of a handed-over command | ≤ 2 s | `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` NFR-PF-03 | unverified — measured by `req-017-provider-matrix`, whose measured vision latency of 6.61 s median already contradicts a model-generated acknowledgement |
| Pet animation frame rate at 70 % CPU load | ≥ 30 fps | `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` NFR-PF-04 | unverified — measured by `req-005-electron-rive-pet-render` |
| Simple job end to end | median ≤ 30 s | `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` NFR-PF-05 | unverified — measured by `req-006-agent-loop` |
| Continuous pet operation without crash or unbounded memory growth | ≥ 8 h | `docs/raw-idea/prd-mvp.md#11-2-do-tin-cay` NFR-RL-04 | unverified — soak test owed by `req-005-electron-rive-pet-render` |
| Default job time limit | 10 min | `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` FR-AG-09 | unverified — stated as a proposal in the source |
| Default approval waiting period | 30 min | `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` FR-AP-08 | unverified — stated as a proposal in the source |
| Bounded retries for a transient failure | ≤ 3, increasing delay | `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` FR-AG-08 | unverified |
| Ledger retention | ≥ 90 days, configurable | `docs/raw-idea/prd-mvp.md#10-4-module-action-ledger-lg` FR-LG-07 | unverified as a policy; its storage cost is measured by `req-013-sqlite-ledger` |
| Attachments per command | ≤ 3 images, ≤ 10 MB each | `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` FR-PET-04 | unverified — stated as a proposal in the source |
| Compressed result notification length | ≤ 200 characters | `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` FR-PET-05 | unverified |
| ACK card auto-hide | 5 s | `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` FR-INT-10 | unverified |
| RESULT card auto-hide | 30 s, configurable 10–120 s | same | unverified |
| Non-hiding card collapse to badge | 60 s | same | unverified |
| ASK card options | 0–4, label ≤ 30 characters | `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` FR-INT-06 | unverified |
| Open questions per job | exactly 1 | `docs/raw-idea/prd-mvp.md#a-5-co-che-ask-dac-ta-tool-ask-user` | unverified here; runtime enforcement is VERIFIED in `req-021-ask-user-offline` |
| Rule elicitation conversation ceiling | 4 turns | carried by `req-004-rule-elicitation` | not asserted by this change |
| Static-tier bulk threshold | > 5 objects | `docs/raw-idea/prd-mvp.md#10-6-module-phe-duyet-ap` FR-AP-01b | unverified — explicitly marked a proposed threshold in the source |
| Cross-surface decision reflection | ≤ 1 s | `docs/raw-idea/prd-mvp.md#a-9-dong-bo-o-thoai-cua-so-app` | unverified |
| Backend monthly availability during beta | ≥ 99.5 % | `docs/raw-idea/prd-mvp.md#11-5-backend` NFR-BE-01 | unverified |
| Backend load capacity | ≥ 2× expected concurrent beta load | `docs/raw-idea/prd-mvp.md#11-5-backend` NFR-BE-07 | unverified, and unquantifiable until open question OQ-8 fixes the beta size |
| Backend backup retention | 30 days, restore proven | `docs/raw-idea/prd-mvp.md#11-5-backend` NFR-BE-04 | unverified |
| Supported operating systems | Windows 10+, macOS 13+ | `docs/raw-idea/prd-mvp.md#11-4-kha-dung-amp-tuong-thich` NFR-CP-01 | unverified — stated as a proposal in the source |
| Local store footprint at 90-day retention | ≈ 12 MB at 1,800 jobs; ≈ 31 MB at 4,500 | `spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan` | verified — carried into this change's model as a resource budget, owned by `req-013-sqlite-ledger` |

## Measurement Method

Each threshold above is restated here as the measurement that would establish it: the population it would be
measured over, how many observations are needed for the figure to mean anything, and what result counts as
passing. None of these measurements has been performed by this change; the owning change named in the
Thresholds table performs it.

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Dialog surface focus latency after clicking the pet — ≤ 500 ms | Clicks on the pet on both supported operating systems, sampled across an idle device, a device running a job, and a device under the same sustained load used for the frame-rate measurement | 100 clicks per operating system per load condition | The 95th percentile of the interval from click to the composer accepting keystrokes is at or below 500 ms in every condition |
| Pet animation state change after an event — ≤ 2 s | Observed state transitions of the pet triggered by real system events: a job starting, a job finishing, a card becoming blocking, the mode changing | 200 transitions spread over the declared state set, including cases where two states become true at once | The 95th percentile of the interval from the event being recorded to the corresponding animation being visible is at or below 2 s, and the precedence rule decides every simultaneous case |
| Pet acknowledgement of a handed-over command — ≤ 2 s | Commands handed to the pet through the composer, covering text-only commands and commands carrying an image, against each provider and role assignment offered by the product | 100 commands per provider and role assignment | The 95th percentile of the interval from submission to a visible acknowledgement is at or below 2 s; the measurement must state whether the acknowledgement was model-generated, because a model-generated acknowledgement is where this threshold is expected to fail |
| Pet animation frame rate at 70 % CPU load — ≥ 30 fps | Continuous pet animation on both supported operating systems while the device is held at 70 % processor utilisation by unrelated work, on the lowest hardware the product claims to support | 3 runs of 10 minutes per operating system per hardware tier | The rendered frame rate stays at or above 30 fps for at least 99 % of each run, with no sustained drop longer than one second |
| Simple job end to end — median ≤ 30 s | Completed runs of the jobs the product calls simple: create one task, update one property, read and summarise one object; measured excluding time spent waiting for a human decision | 100 completed runs per job shape | The median wall-clock duration per job shape is at or below 30 s, reported alongside the 95th percentile so a long tail is visible rather than hidden by the median |
| Continuous pet operation without crash or unbounded memory growth — ≥ 8 h | An uninterrupted session on each supported operating system with the pet visible, jobs arriving periodically, and cards appearing and being dismissed | 3 sessions of at least 8 hours per operating system | No crash and no unrecovered error in any session, and resident memory measured at regular intervals shows no upward trend beyond the declared working-set allowance once the session has settled |
| Default job time limit — 10 min | Jobs deliberately constructed to exceed the limit, across each connector and each job shape the MVP supports, plus jobs that spend most of their life waiting for a human | 30 jobs per connector, including at least 10 containing a human wait | Every exceeding job ends at the limit with the declared outcome and an explanation, and waiting time is excluded from the elapsed measurement in every case |
| Default approval waiting period — 30 min | Approval requests left unanswered, including those raised while the device sleeps, restarts, or loses network | 50 unanswered requests spanning all three interruption conditions | Every request expires at the declared period with the job paused safely and resumable, and none expires early or silently proceeds |
| Bounded retries for a transient failure — ≤ 3, increasing delay | Tool calls failing with each transient condition the connectors declare — rate limits, timeouts, temporary platform errors — and, as a control, calls failing with permanent errors | 50 failure sequences per transient condition and per connector | No sequence exceeds three attempts, delays increase between attempts, and no permanently failing call is retried at all |
| Ledger retention — ≥ 90 days, configurable | The local store of a device operated at the declared job volumes for a period longer than the configured retention | 2 devices held for at least 120 days at 1,800 and 4,500 jobs per 90 days | Records remain readable for the whole configured period, expiry removes records and their attachments together, and no record is removed before its period elapses or by capacity pressure |
| Attachments per command — ≤ 3 images, ≤ 10 MB each | Commands submitted with image counts from zero to four and image sizes bracketing the limit, in each format the composer accepts | 40 submissions per boundary condition | A submission at the limit is accepted and one beyond it is refused with an explanation naming the limit, and no oversized image is silently downscaled or truncated |
| Compressed result notification length — ≤ 200 characters | Result announcements produced for completed jobs spanning the shortest and longest real outcomes the MVP produces, in both supported languages | 200 announcements per language | Every announcement is at or below 200 characters, the full result stays reachable from the card, and no announcement is cut mid-word in either language |
| ACK card auto-hide — 5 s | Displayed acknowledgement cards under normal use, while Do-Not-Disturb is active, and while the user is interacting with the card | 100 cards per condition | Each card hides itself at the declared interval unless the user is interacting with it, and an interrupted card does not disappear under the user's hand |
| RESULT card auto-hide — 30 s, configurable 10–120 s | Displayed result cards at the default setting and at each end of the configurable range | 100 cards at the default and 50 at each range boundary | Each card hides itself at the configured interval, a value outside the range cannot be configured, and the result remains reachable afterwards |
| Non-hiding card collapse to badge — 60 s | Blocking cards left unanswered, across approval requests and open questions | 100 cards per card type | Each collapses to a badge at the declared interval, remains restorable from the badge with nothing lost, and the underlying job stays paused |
| ASK card options — 0–4, label ≤ 30 characters | Questions generated by worker-agents across every job shape and both supported languages, including questions the agent would prefer to ask with more options | 300 questions per language | No question presents more than four options, no label exceeds 30 characters in either language, and a question needing more than four options is expressed differently rather than truncated |
| Open questions per job — exactly 1 | Jobs driven toward a second question while one is already open, across every job shape and both agents that can ask | 100 attempts to open a second question | The second attempt is refused in every case and the job continues correctly after the first question is answered |
| Rule elicitation conversation ceiling — 4 turns | Not asserted by this change; the corpus is the rule-elicitation conversations owned by `req-004-rule-elicitation` | Determined by that change | Determined by that change; this baseline records the figure only so it is not mistaken for an unowned number |
| Static-tier bulk threshold — > 5 objects | Operations spanning object counts on both sides of the boundary, across every connector that exposes a bulk-capable write | 50 operations per object count from 1 to 10 per connector | Operations above the threshold are routed to the static tier and stopped, those at or below are not, and the boundary behaves identically for every connector |
| Cross-surface decision reflection — ≤ 1 s | Decisions taken on one surface while the other surface displays the same pending decision, including the case where both surfaces act at almost the same moment | 200 decisions, at least 50 of them near-simultaneous | The 95th percentile of the interval until the other surface reflects the decision is at or below 1 s, and every near-simultaneous pair resolves to exactly one recorded decision |
| Backend monthly availability during beta — ≥ 99.5 % | Continuous external probing of the authenticated endpoints from outside the service's own infrastructure over a calendar month | Every month of the closed beta, probed at an interval fine enough to resolve a five-minute outage | Measured monthly availability is at or above 99.5 %, computed from the external probe record rather than from the service's own health reporting |
| Backend load capacity — ≥ 2× expected concurrent beta load | Synthetic concurrent sessions performing the real mix of sign-in, brokering, replication and version-check traffic | Cannot be sized until open question OQ-8 fixes the beta size; the sample is twice that number of concurrent sessions held for at least one hour | Error rate and response times stay within the declared service expectation for the whole run, with no unrecovered degradation after the load is removed |
| Backend backup retention — 30 days, restore proven | Backups taken over a period longer than the retention window, and restores performed into a clean environment | At least 3 full restore rehearsals, including one from the oldest backup still inside the window | Every rehearsal restores a working service with the account records intact, and a backup older than the window is confirmed absent rather than merely unreferenced |
| Supported operating systems — Windows 10+, macOS 13+ | Installation and one full onboarding-to-first-successful-job run on the lowest supported version and the current version of each operating system, plus one version below the floor | 2 runs per supported version, 1 per unsupported version | Every supported version completes onboarding through the official flows, and the unsupported version is refused with a clear statement rather than running degraded |
| Local store footprint at 90-day retention — ≈ 12 MB at 1,800 jobs; ≈ 31 MB at 4,500 | Local stores populated to the declared job volumes with the declared record and snapshot shapes, as measured in `spikes/SP-12-sqlite-ledger/REPORT.md#0-ket-luan` | The two volume points already measured, re-measured whenever the record shape changes | Measured footprint stays within the budget carried into `model.md`; a change to the record or snapshot shape invalidates the figure and requires re-measurement |

## Contract Conformance

This change draws four machine-readable contract files at the product baseline. Each is judged by a condition
anyone can observe against a running product, never by running a validator over the file. Three of the four are
frozen later — the manifest by `req-019-connector-framework`, the rule representation by
`req-009-rule-ir-hardgate`, the provider assignment by `req-017-provider-matrix` — so a condition below that
fails here is a finding against the baseline rather than against the frozen successor.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/connector-manifest.schema.json` | A manifest the file refuses yields no tool at all, and the refusal arrives at load naming the failing declaration rather than at the first call. A write tool carrying neither `compensation` nor `irreversible`, and one carrying both, are each refused, and every other connector in the same release loads unaffected | `specs/connector/spec.md`, the requirement that a manifest is loaded whole or not at all; `model.md` §Fallback on Missing Manifest |
| `contracts/connector-manifest.schema.json` | The gate, the undo planner and the approval tier read `direction`, `irreversible`, `compensation`, `snapshot` and `bulkThresholdParam` from the loaded manifest and from nowhere else: no component holds a list of platform operations of its own, and adding a connector changes none of them | `specs/connector/spec.md`; `specs/approval/spec.md`; `model.md` §Variability |
| `contracts/rule-representation.schema.json` | A rule statement that cannot be expressed in the condition grammar is reported to the user as unsupported and stored nowhere — never stored with a weaker condition, and never kept only as an advisory prompt fragment | `specs/approval/spec.md`, the requirement that an unexpressible rule is refused; `contracts/rule-representation.md` §Semantics |
| `contracts/rule-representation.schema.json` | A rule naming a connector, a tool or a property no installed manifest declares is refused at confirmation with the name shown, although the file itself accepts it: the refusal is a reference into the manifests, so it is judged by the product's behaviour at confirmation and not by the file | `specs/approval/spec.md`; `contracts/rule-representation.md` §Examples |
| `contracts/provider-configuration.schema.json` | No credential value can be shown, exported or replicated: for every provider the configuration holds a reference into the device's secure storage, and a configuration offering a secret inline is refused rather than stored with the secret stripped | `specs/agent/spec.md`, the requirement that credentials live only in operating-system secure storage; `specs/platform/spec.md` |
| `contracts/provider-configuration.schema.json` | Every role resolves before a job is created: a role with no assignment falls back to the recommended default, and where no default applies the product states that configuration is required rather than creating a job that would fail on its first call | `specs/agent/spec.md`, the requirement that provider and role routing are configured on the client |
| `contracts/provider-configuration.schema.json` | Image attachment is unavailable whenever the model assigned to the role that would receive the image declares no image input, and the unavailability is visible before the call rather than after it | `specs/uix/spec.md`, the requirement that the composer accepts text and images with declared limits |
| `contracts/localisation-resources.schema.json` | Every string the interface shows resolves through a bundle: a key present in no bundle appears as the raw key, and a key present in English only appears in English — neither is blank, and neither is a string written at the point of use | `specs/uix/spec.md`, the requirement that every interface string passes through the localisation layer |
| `contracts/localisation-resources.schema.json` | The hard data inside an approval request — object names, before-and-after values, the triggering rule — is rendered from the request and appears in no bundle, in either language | `specs/uix/spec.md`, the requirement that an approval card renders hook data without model rewording |

## Combination Matrix

This change belongs to every cluster at once, because it is the baseline all of them inherit. The combinations
that matter are not product configurations but the intersections where two capabilities state the same
obligation and could drift apart:

| Combination | What must hold across it |
| --- | --- |
| approval mode × operation reversibility | `off` still records and still blocks the blocklist; `smart` and `on` stop irreversible operations; the mode captured at job creation governs, not the current mode |
| decision surface × decision outcome | a decision from the dialog surface and one from the application window are the same decision, taken once |
| ask × approval | an answered question never produces a permission; the gate evaluates after the answer |
| connector × approval × ledger | every connector's operations pass one wrapper, so adding a connector adds no enforcement path |
| job state × card queue | every blocking card corresponds to a waiting job state, and the queue is rebuildable from job state and the ledger |
| local working copy × account-owned copy | the device stays authoritative while running; the relationship is owned by `req-022-account-sync` and is unverified |
| operating system × pet window behaviour | always-on-top, tray and no-focus-steal behave consistently on both supported systems |

## Regression Scope

All eleven capabilities this change touches carry every one of their scenarios into any later verification run,
because this change created their entire requirement set and a later change modifying one of them cannot be
verified against its delta alone.

- `pet` — rationale: created here; 10 requirements
- `uix` — rationale: created here; 16 requirements
- `agent` — rationale: created here; 9 requirements
- `job` — rationale: created here; 8 requirements
- `connector` — rationale: created here; 21 requirements, and consumer of `connector/contracts/connector-manifest@0.1.0`
- `approval` — rationale: created here; 15 requirements, and owner of `approval/contracts/rule-representation@0.1.0`
- `ledger` — rationale: created here; 8 requirements
- `undo` — rationale: created here; 7 requirements
- `app` — rationale: created here; 7 requirements
- `backend` — rationale: created here; 11 requirements
- `platform` — rationale: created here; 3 requirements
- `sync` — rationale: not specified by this change, but its Purpose was written by `req-022-account-sync`, which
  supersedes several statements here; any verification of this baseline must be read together with that change

## Manual Checks

- The requirement carrying open clarification OQ-2 has an approval record that either accepts the default
  approval of irreversible operations in `smart` and `on` or replaces that default before this change is
  approved — owner: product owner.
- A decision-maker-approved pet persona and visual style are recorded before the requirement that all pet text
  is persona-generated is evaluated (open questions OQ-3, OQ-4) — owner: product owner.
- The closed-beta size is fixed in an approved artifact before the backend load threshold is treated as
  quantifiable (open question OQ-8) — owner: product owner.
- An approved infrastructure-region decision records the compliance consequences of storing user work content
  on the service's infrastructure (open question OQ-11) — owner: product owner.
- The three inherited identifier collisions — `ADR-005`, `ADR-009`, `ADR-001`/`ADR-002` — no longer collide in
  the source documents, and the resulting harvested material carries distinct identifiers — owner:
  decision-maker.
- Decision-maker review evidence identifies and resolves every statement in the eleven delta specs that the
  account-owned decision superseded, especially statements about the backend's data holdings — owner:
  decision-maker.
- All 66 checklist items are checked, or every unchecked item carries a recorded, justified accepted gap —
  owner: reviewer.

## Open Measurement Gaps

Every number this baseline carries, except the local store footprint, rests on the product definition rather
than on a measurement. The product definition states its own figures as proposals awaiting calibration, so
this change asserts a quantity wherever it repeats one, and supports none of them. Open question OQ-6 asks the
product owner whether the success-metric thresholds are kept or recalibrated, and until it is answered the
thresholds cannot even be treated as settled targets to measure against.

The performance figures — dialog focus latency, animation transition time, command acknowledgement, frame rate
under load, simple-job duration and the eight-hour soak — are closed by the changes named against them in the
Thresholds table: `req-005-electron-rive-pet-render` for the two animation figures and the soak,
`req-008-pet-window-os` for focus latency, `req-006-agent-loop` for job duration, and `req-017-provider-matrix`
for acknowledgement. The acknowledgement figure is the one gap with contrary evidence rather than absent
evidence: a measured vision latency of 6.61 s median already contradicts a 2 s model-generated
acknowledgement, so that change closes the gap by either redefining what the acknowledgement is or moving the
threshold, not by measuring harder.

The interface timings — the two card auto-hide intervals, the badge collapse, the notification length, the
option count and label length, the attachment limits and the cross-surface reflection interval — have no owning
measurement change at all. They are design choices stated as numbers, and what would close them is a usability
observation over the closed beta rather than an instrument reading; nobody is presently assigned to make it.

The policy figures — the job time limit, the approval waiting period, the retry ceiling and the ledger
retention period — are defaults the product definition proposes. Only the product owner can close them, because
the question is what the product should do rather than what it can do; the ledger retention period is
additionally bounded by the storage cost that `req-013-sqlite-ledger` measures.

The backend figures are blocked rather than merely unmeasured. Load capacity is unquantifiable until open
question OQ-8 fixes the closed beta size, and availability and backup retention can be measured only once the
service runs under real beta traffic, which places them after the beta begins rather than before it.

The static-tier bulk threshold is explicitly marked a proposed threshold in its source. What would close it is
the adversarial gate corpus owned by `req-009-rule-ir-hardgate`, run across the object-count boundary — that
change owns the corpus, and this baseline deliberately claims no result from it.

The single-open-question rule is asserted here without evidence; `req-021-ask-user-offline` verifies the
runtime enforcement, so the gap is in this document's assertion rather than in the product's behaviour.

Finally, the relationship between the local working copy and the account-owned copy carries no measurement of
any kind: all twenty spikes measured a device-bound product, recorded as RISK-070, and `req-022-account-sync`
holds an open question asking whether a spike must run before its design proceeds. Until that is answered, the
combination of local working copy against account-owned copy in the matrix above is asserted and unmeasured.

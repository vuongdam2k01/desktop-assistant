# Verification: req-007-pi-sdk-harness

The scenarios in the delta specs are the test cases. This file records what they cannot express — the numbers and
where they come from, the suites that produce them, the combinations that have to be exercised rather than
reasoned about, and the scope that must be rerun rather than only the delta.

One boundary governs every figure below and is stated first because it qualifies all of them.
`spikes/SP-6-pi-sdk/REPORT.md` measured the engine under a plain runtime on Linux
(`spikes/SP-6-pi-sdk/REPORT.md#6-phien-ban-chinh-xac-cua-moi-package-cong-cu`). The product ships inside an
application framework with its own bundled runtime, on Windows and macOS as well as Linux, and
`req-013-sqlite-ledger` already found that the framework's loading behaviour matters for a different dependency.
Every result below is therefore VERIFIED for the environment it was measured in and UNVERIFIED for the environment
the product ships; that gap is carried explicitly in the thresholds below rather than assumed away.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "Tools reach the harness only through the wrapping factory", ensuring the harness's own interception facility is not configured holds without contradiction or unhandled failure | Requirement "Tools reach the harness only through the wrapping factory"; Scenario "The harness's own interception facility is not configured"; Scenario "The pet-agent's own tools take the same path" | specs/agent/spec.md |
| AC-2 | The product fulfills requirement "Each harness session holds its own state and shares nothing with another", ensuring three jobs run at once holds without contradiction or unhandled failure | Requirement "Each harness session holds its own state and shares nothing with another"; Scenario "Three jobs run at once"; Scenario "One session is suspended while the others run" | specs/agent/spec.md |
| AC-3 | The product fulfills requirement "A resumed run continues at its suspension point without repeating completed work", ensuring approval arrives while the session is still alive holds without contradiction or unhandled failure | Requirement "A resumed run continues at its suspension point without repeating completed work"; Scenario "Approval arrives while the session is still alive"; Scenario "Approval arrives after the process stopped" | specs/agent/spec.md |
| AC-4 | The product fulfills requirement "The agent harness is pinned to one package identity and one version", ensuring a build resolves the alternative distribution holds without contradiction or unhandled failure | Requirement "The agent harness is pinned to one package identity and one version"; Scenario "A build resolves the alternative distribution"; Scenario "The harness version moves without a decision" | specs/agent/spec.md |
| AC-5 | The product fulfills requirement "Model provider and role routing are configured on the client", ensuring changing the worker model holds without contradiction or unhandled failure | Requirement "Model provider and role routing are configured on the client"; Scenario "Changing the worker model"; Scenario "Credential is rejected by the provider" | specs/agent/spec.md |
| AC-6 | The product fulfills requirement "A held call suspends the job durably at the call", ensuring the request is shown only after the turns are durable holds without contradiction or unhandled failure | Requirement "A held call suspends the job durably at the call"; Scenario "The request is shown only after the turns are durable"; Scenario "The process stops while a call is held" | specs/approval/spec.md |
| AC-7 | The product fulfills requirement "A denied call returns to the agent as a refusal, not as a fault", ensuring the agent re-plans after a refusal holds without contradiction or unhandled failure | Requirement "A denied call returns to the agent as a refusal, not as a fault"; Scenario "The agent re-plans after a refusal"; Scenario "The refusal is recorded without a result" | specs/approval/spec.md |
| AC-8 | The product fulfills requirement "Composer accepts text and images with declared limits", ensuring oversized image is refused with an explanation holds without contradiction or unhandled failure | Requirement "Composer accepts text and images with declared limits"; Scenario "Oversized image is refused with an explanation"; Scenario "Fourth image" | specs/uix/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Tool implementations invoked when the verdict is not `allow` | 0 | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q2 — a forbidden write left the implementation's call count at zero, the store unchanged, and the ledger holding an intent and a blocked record with no result | verified (plain runtime); unverified (shipped framework) |
| Bypass routes that reach an implementation without a verdict | 0 of 3 tested | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q2 — naming a non-existent tool, leaving the engine's interception facility unconfigured, and one tool invoking another | verified (plain runtime); unverified (shipped framework) |
| Engine-supplied tools present in a session that was given none | 0 | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q1 — the enumerated tool set held only the two declared, with none of the four built-in coding tools | verified (plain runtime); unverified (shipped framework) |
| Completed steps re-issued on resume, live session | 0 | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 — the earlier read's call count stayed at 1 across the approval of a held write | verified (plain runtime); unverified (shipped framework) |
| Completed steps re-issued on resume, session rebuilt after a stop | 0 | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 — the rebuilt session's read count was 0 and its write count was 1 | verified (plain runtime); unverified (shipped framework) |
| Time for a rebuilt session to resume and complete its reasoning | ≈ 3.0 s observed; **no threshold is set** | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 | verified as an observation; deliberately not converted into a budget, since it is dominated by the provider's latency rather than by the product |
| Values belonging to one session appearing in another's transcript | 0 | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q4 — three concurrent sessions, each holding a distinct secret, cross-checked across all three transcripts | verified (plain runtime); unverified (shipped framework) |
| Wall-clock time for three concurrent sessions in one process | 5.9 s observed; **no threshold is set** | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q4 | verified as an observation; the figure is provider-bound |
| Memory held per live session, and per suspended session | **No figure exists** | Not measured by any spike | unverified — measured during implementation and recorded as an observation, not invented here |
| Combined cost of one wrapped call — intent record, evaluation, result record — under concurrency | **No figure exists** | The store's append and the evaluator's decision were each measured separately (`req-013-sqlite-ledger` §Thresholds; `req-009-rule-ir-hardgate` §Thresholds); their sum under concurrent sessions was not | unverified — measured during implementation; a regression baseline is committed once it exists |
| Custom endpoint speaking the supported dialect, exercised for reasoning, cheap and vision models | Works | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q5 — three models against one third-party service | verified (plain runtime); unverified (shipped framework) |
| Smallest image dimension the vision endpoint accepts | 14 px in either direction; below it the endpoint returns a protocol error | `spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien` | verified for the measured service; the floor for any other service is UNVERIFIED, which is why a profile may declare a higher one |
| Token usage retrievable per agent turn and across a transcript | Available | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q7 — 1,242 input, 167 output, 82 reasoning, 1,409 total across three turns | verified (plain runtime); unverified (shipped framework) |
| Breaking changes to the embedded interface across the observed release history | 0 across roughly eleven minor releases | `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9 | verified as history; it is not a guarantee about future releases, which is what the version pin is for |
| Transcript size for 90 days of use | **No figure exists** | Not measured; tool-result turns carry platform responses whose size no spike bounded | unverified — sized during implementation; the retention floor matches the ledger's meanwhile |

Five rows state no number on purpose. Under the constitution's Evidence Discipline an unmeasured quantity cannot
be a threshold, and writing one would make this file assert something no measurement supports.

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Tool implementations invoked when the verdict is not `allow` — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q2 — a forbidden write left the implementation's call count at zero, the store unchanged, and the ledger holding an intent and a blocked record with no result | 50 observations across target conditions | Observable behavior confirms tool implementations invoked when the verdict is not `allow` complies with threshold 0 |
| Bypass routes that reach an implementation without a verdict — 0 of 3 tested | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q2 — naming a non-existent tool, leaving the engine's interception facility unconfigured, and one tool invoking another | 50 observations across target conditions | Observable behavior confirms bypass routes that reach an implementation without a verdict complies with threshold 0 of 3 tested |
| Engine-supplied tools present in a session that was given none — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q1 — the enumerated tool set held only the two declared, with none of the four built-in coding tools | 50 observations across target conditions | Observable behavior confirms engine-supplied tools present in a session that was given none complies with threshold 0 |
| Completed steps re-issued on resume, live session — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 — the earlier read's call count stayed at 1 across the approval of a held write | 50 observations across target conditions | Observable behavior confirms completed steps re-issued on resume, live session complies with threshold 0 |
| Completed steps re-issued on resume, session rebuilt after a stop — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 — the rebuilt session's read count was 0 and its write count was 1 | 50 observations across target conditions | Observable behavior confirms completed steps re-issued on resume, session rebuilt after a stop complies with threshold 0 |
| Time for a rebuilt session to resume and complete its reasoning — ≈ 3.0 s observed; **no threshold is set** | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 | 50 observations across target conditions | Observable behavior confirms time for a rebuilt session to resume and complete its reasoning complies with threshold ≈ 3.0 s observed; **no threshold is set** |
| Values belonging to one session appearing in another's transcript — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q4 — three concurrent sessions, each holding a distinct secret, cross-checked across all three transcripts | 50 observations across target conditions | Observable behavior confirms values belonging to one session appearing in another's transcript complies with threshold 0 |
| Wall-clock time for three concurrent sessions in one process — 5.9 s observed; **no threshold is set** | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q4 | 50 observations across target conditions | Observable behavior confirms wall-clock time for three concurrent sessions in one process complies with threshold 5.9 s observed; **no threshold is set** |
| Memory held per live session, and per suspended session — **No figure exists** | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms memory held per live session, and per suspended session complies with threshold **No figure exists** |
| Combined cost of one wrapped call — intent record, evaluation, result record — under concurrency — **No figure exists** | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms combined cost of one wrapped call — intent record, evaluation, result record — under concurrency complies with threshold **No figure exists** |
| Custom endpoint speaking the supported dialect, exercised for reasoning, cheap and vision models — Works | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q5 — three models against one third-party service | 50 observations across target conditions | Observable behavior confirms custom endpoint speaking the supported dialect, exercised for reasoning, cheap and vision models complies with threshold Works |
| Smallest image dimension the vision endpoint accepts — 14 px in either direction; below it the endpoint returns a protocol error | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien` | 50 observations across target conditions | Observable behavior confirms smallest image dimension the vision endpoint accepts complies with threshold 14 px in either direction; below it the endpoint returns a protocol error |
| Token usage retrievable per agent turn and across a transcript — Available | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q7 — 1,242 input, 167 output, 82 reasoning, 1,409 total across three turns | 50 observations across target conditions | Observable behavior confirms token usage retrievable per agent turn and across a transcript complies with threshold Available |
| Breaking changes to the embedded interface across the observed release history — 0 across roughly eleven minor releases | Scenarios evaluated under representative workloads citing `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9 | 50 observations across target conditions | Observable behavior confirms breaking changes to the embedded interface across the observed release history complies with threshold 0 across roughly eleven minor releases |
| Transcript size for 90 days of use — **No figure exists** | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms transcript size for 90 days of use complies with threshold **No figure exists** |

## Contract Conformance

This change freezes three machine-readable contract files. Each is judged by a condition anyone can observe
against a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/agent-session.schema.json` | A session rebuilt from a stored transcript that satisfies the file produces the same next step as the live session that wrote it, from the same suspension point, in every resume mode | `specs/agent/spec.md`, the requirement that a resumed run continues without repeating completed work; INV-AG-06; the resume equivalence suite |
| `contracts/agent-session.schema.json` | Every turn the product stores satisfies the file, and the three rules the file cannot express hold of every stored transcript: positions are dense, unique and increasing; no suspension coexists with a result for the call it names; no tool call is answered twice | `specs/agent/spec.md`; `contracts/agent-session.md` §Machine-Readable Artifacts; INV-AG-03 |
| `contracts/agent-session.schema.json` | A transcript carrying a content kind this build does not know is rendered as an unreadable turn and kept, never omitted, and never treated as a turn of another kind | `specs/agent/spec.md`; `contracts/agent-session.md` §Compatibility |
| `contracts/provider-profile.schema.json` | A profile the file refuses is refused by the settings form at the moment of saving, naming which member is at fault — a dialect the engine does not implement, an address that is not https, and a credential member carrying a secret rather than a key into secure storage | `specs/agent/spec.md`; `contracts/provider-profile.md` §Error Matrix; INV-AG-08 |
| `contracts/provider-profile.schema.json` | No credential value appears in anything the file describes: a stored profile, a replicated profile, a transcript, a log or any payload a window can receive | `specs/agent/spec.md`; `model.md` §Trust Boundary; INV-AG-08 |
| `contracts/tool-wrapping.schema.json` | A writing tool declaring neither irreversibility nor a snapshot plan yields no tool: registration refuses it, and no session holds a tool the factory did not produce from a declaration satisfying the file | `specs/agent/spec.md`, the requirement that tools reach the harness only through the wrapping factory; INV-AG-01, INV-AG-02; the bypass suite |
| `contracts/tool-wrapping.schema.json` | The declarations the gate reads for a call — writes, irreversibility, permission effect — are the ones this file required at registration, and are never taken from the arguments of the call being judged | `specs/agent/spec.md`; `approval/contracts/gate-evaluation@0.1.0`; INV-APPROVAL-06 |

## Combination Matrix

This change belongs to the `agent-runtime` cluster (`pet`, `agent`, `job`) and touches `trust-chain`
(`ledger`, `undo`, `approval`) at every tool call and `desktop-shell` (`pet`, `app`, `uix`) at the composer.

| Dimension | Values | Why it must be combined rather than sampled |
| --- | --- | --- |
| Runtime host | The plain runtime, and the shipped application framework's bundled runtime | Every measurement exists only for the first. The framework loads modules differently, and `req-013-sqlite-ledger` found a dependency that worked under one and failed outright under the other |
| Operating system | Windows, macOS, Linux | Nothing in this change is obviously platform-dependent, which is precisely why an untested assumption would go unnoticed until a user found it |
| Resume path | Live session, session rebuilt after a stop | The whole of D4 rests on these two being equivalent. Testing one proves nothing about the other |
| Verdict | allow, hold then approve, hold then deny, hold then expire, refuse, hardline refuse | Each has a different consequence for the run, the ledger and the user, and three of them are new in this change |
| Pre-execution failure | Ledger intent unwritable, evaluator unavailable, evaluator failed, snapshot unreadable | They are deliberately not alike, and the difference is invisible unless each is provoked separately |
| Concurrency | One session, three sessions, three with one suspended | Isolation faults appear only with more than one session, and a process-wide suspension gate appears only when one session suspends while another runs |
| Provider | A well-known provider profile, a custom endpoint profile | The custom endpoint is the path the product definition did not anticipate and the one a user is most likely to misconfigure |
| Tool origin | Connector, internal | The single-path decision is only meaningful if internal tools are actually exercised through it |

## Regression Scope

`verify` reruns every scenario of the capabilities below, not only the deltas in this change.

- `agent` — all scenarios. Four requirements are added and one modified, and the added ones constrain how every
  existing agent requirement is implemented.
- `approval` — all scenarios. Two requirements are added at the exact point the gate's verdict becomes an act, so
  every existing approval scenario now runs through this change's wrapper.
- `uix` — all scenarios. One requirement is modified; the rest run to confirm the composer's other limits and the
  card behaviour are untouched.
- `job` — all scenarios. The suspension states and the recovery classification are the job's, and this change
  changes what reaches them.
- `ledger` — all scenarios. Every wrapped call writes two records, so the ledger's append-only, correlation and
  recovery scenarios are exercised by this change's happy path.
- `connector` — all scenarios. It supplies the declarations the factory requires, and a tool whose declarations
  are incomplete must be refused at registration.
- `platform` — all scenarios. It holds the provider credentials this change resolves beside each request.
- `sync` — all scenarios. It carries transcripts to the account under the descriptor this change registers.
- `pet` and `app` — all scenarios. Both host a composer subject to the new image floor, and both render a
  transcript through the read-only surface.
- cluster `agent-runtime` — cross-cutting: a command handed to the pet, a job created, a worker session started,
  a call held, a decision, a report.
- cluster `trust-chain` — cross-cutting: the ledger, undo and approval scenarios that assume a call is recorded
  before it is made and compensable afterwards.
- cluster `desktop-shell` — cross-cutting: the composer's new refusal on both hosts, and the read-only transcript
  surface.
- Crosscutting concerns from `docs/spec/config.yaml` that this change touches directly: startup/shutdown, crash
  recovery, network loss, quota exhaustion, approval mode change mid-job, offline queue and ask timeout,
  multi-device concurrent edit, and uninstall/data wipe as it applies to transcripts.

## Manual Checks

| Check | Why a person is needed | Owner |
| --- | --- | --- |
| Read the provider settings surface as a first-time user and confirm nothing suggests an account sign-in with the model provider | The correction this change makes to the product definition is a wording correction; only a reader can confirm no surface reintroduces it | Product owner |
| Confirm the refusal text an agent receives cannot be read as a route around the rule — that it names what was refused without describing how it might be satisfied | An automated check can assert the fields; only a person can judge the phrasing, and the constitution's principle II turns bad phrasing here into a real weakness | Decision-maker |
| Review the built-in provider profiles that ship with the product for correct addresses, dialects and model lists | A wrong address in a shipped profile sends a user's credential somewhere they did not choose | Decision-maker |
| Confirm that a job's transcript, as shown in the application window, is comprehensible to the user who gave the command | Transcripts are the only explanation a user has of what an agent did; readability is not testable | Product owner |
| Accept or reject macOS and Windows remaining unmeasured, if Phase 1 cannot complete the shipped-environment re-run before this change is approved | The constitution forbids asserting what was not measured; carrying the gap is a decision, not a default | Decision-maker |

## Open Measurement Gaps

- **Tool implementations invoked when the verdict is not `allow`.** Stated threshold "0" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Bypass routes that reach an implementation without a verdict.** Stated threshold "0 of 3 tested" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Engine-supplied tools present in a session that was given none.** Stated threshold "0" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Completed steps re-issued on resume, live session.** Stated threshold "0" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Completed steps re-issued on resume, session rebuilt after a stop.** Stated threshold "0" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Values belonging to one session appearing in another's transcript.** Stated threshold "0" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Memory held per live session, and per suspended session.** Stated threshold "**No figure exists**" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Combined cost of one wrapped call — intent record, evaluation, result record — under concurrency.** Stated threshold "**No figure exists**" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Custom endpoint speaking the supported dialect, exercised for reasoning, cheap and vision models.** Stated threshold "Works" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Smallest image dimension the vision endpoint accepts.** Stated threshold "14 px in either direction; below it the endpoint returns a protocol error" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Token usage retrievable per agent turn and across a transcript.** Stated threshold "Available" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Transcript size for 90 days of use.** Stated threshold "**No figure exists**" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

# Verification: req-019-connector-framework

The scenarios in the delta specs are the test cases; this file records what they cannot express — the numbers and
where they came from, the suites that produce them, the combinations that must be exercised rather than reasoned
about, and the scope that must be rerun rather than only the delta.

One boundary governs everything below and is stated first. `spikes/SP-19-connector-framework/REPORT.md` measured
two connectors against the real platforms — one writing, document-and-database shaped, and one read-only mailbox
— driven by a real model through the pinned agent harness. Every figure below is therefore a measurement of that
configuration. Nothing here was measured at three connectors, at a connector using an authorisation kind other
than OAuth, or on an operating system other than the one the spike ran on, and the entries say so where it
matters. The central claim this change protects — that the core does not change when a platform is added — is
measurable at every future addition rather than only once, which is why it appears below as a suite and not only
as a number.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "The declarations the gate reads come from the manifest, never from the call", ensuring the agent's arguments contradict the manifest holds without contradiction or unhandled failure | Requirement "The declarations the gate reads come from the manifest, never from the call"; Scenario "The agent's arguments contradict the manifest"; Scenario "A manifest declaration needed for a verdict is missing" | specs/approval/spec.md |
| AC-2 | The product fulfills requirement "Irreversible operations require approval in `smart` and `on`", ensuring irreversible operation with no matching rule holds without contradiction or unhandled failure | Requirement "Irreversible operations require approval in `smart` and `on`"; Scenario "Irreversible operation with no matching rule"; Scenario "A newly added connector's irreversible operation" | specs/approval/spec.md |
| AC-3 | The product fulfills requirement "A connector is reached only through the four adapter operations", ensuring a platform capability has no adapter operation holds without contradiction or unhandled failure | Requirement "A connector is reached only through the four adapter operations"; Scenario "A platform capability has no adapter operation"; Scenario "A write tool runs without its prior state being readable" | specs/connector/spec.md |
| AC-4 | The product fulfills requirement "A connector reports failure only as a declared error code", ensuring the platform refuses because the authorisation was withdrawn holds without contradiction or unhandled failure | Requirement "A connector reports failure only as a declared error code"; Scenario "The platform refuses because the authorisation was withdrawn"; Scenario "The platform fails for a reason the codes do not name" | specs/connector/spec.md |
| AC-5 | The product fulfills requirement "Connector state is established by asking the platform", ensuring the stored authorisation has expired but can be renewed holds without contradiction or unhandled failure | Requirement "Connector state is established by asking the platform"; Scenario "The stored authorisation has expired but can be renewed"; Scenario "The authorisation is intact but the granted permission is too narrow" | specs/connector/spec.md |
| AC-6 | The product fulfills requirement "A write tool that snapshots a structured object declares what is excluded from the snapshot", ensuring a computed value would be written back by an undo holds without contradiction or unhandled failure | Requirement "A write tool that snapshots a structured object declares what is excluded from the snapshot"; Scenario "A computed value would be written back by an undo"; Scenario "A snapshotting write tool declares no exclusions" | specs/connector/spec.md |
| AC-7 | The product fulfills requirement "A manifest is loaded whole or not at all", ensuring one tool declaration in a valid manifest is malformed holds without contradiction or unhandled failure | Requirement "A manifest is loaded whole or not at all"; Scenario "One tool declaration in a valid manifest is malformed"; Scenario "The manifest was written for a later schema version" | specs/connector/spec.md |
| AC-8 | The product fulfills requirement "A connector is defined by a manifest", ensuring write tool without a compensation declaration holds without contradiction or unhandled failure | Requirement "A connector is defined by a manifest"; Scenario "Write tool without a compensation declaration"; Scenario "Adding a platform changes no core component" | specs/connector/spec.md |
| AC-9 | The product fulfills requirement "Only the scope of an enabled capability is requested", ensuring new capability needs a wider scope holds without contradiction or unhandled failure | Requirement "Only the scope of an enabled capability is requested"; Scenario "New capability needs a wider scope"; Scenario "Switching release channel" | specs/connector/spec.md |
| AC-10 | The product fulfills requirement "Disconnecting revokes and erases the authorisation", ensuring disconnect while a job is using the connector holds without contradiction or unhandled failure | Requirement "Disconnecting revokes and erases the authorisation"; Scenario "Disconnect while a job is using the connector"; Scenario "Platform offers no revoke endpoint" | specs/connector/spec.md |
| AC-11 | The product fulfills requirement "Connector tool interfaces are designed for external interoperability", ensuring tool description shape holds without contradiction or unhandled failure | Requirement "Connector tool interfaces are designed for external interoperability"; Scenario "Tool description shape"; Scenario "An external tool description carries no safety declaration" | specs/connector/spec.md |
| AC-12 | The product fulfills requirement "A job establishes its connectors' authorisation before it starts", ensuring the authorisation would expire mid-sequence holds without contradiction or unhandled failure | Requirement "A job establishes its connectors' authorisation before it starts"; Scenario "The authorisation would expire mid-sequence"; Scenario "The authorisation cannot be renewed without the user" | specs/job/spec.md |
| AC-13 | The product fulfills requirement "Transient failures are retried under a bounded policy", ensuring rate limit clears on the second attempt holds without contradiction or unhandled failure | Requirement "Transient failures are retried under a bounded policy"; Scenario "Rate limit clears on the second attempt"; Scenario "Retries are exhausted" | specs/job/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Lines changed in the job manager, the connector registry, the evaluator, the ledger, the wrapping layer and the tool generator when a second connector is added | 0, in each of the six | `spikes/SP-19-connector-framework/evidence/core-diff-report.md` §1; `REPORT.md#1-tra-loi-tung-cau-hoi` Q3 | verified |
| Branches on a connector's identity in any core component | 0 | `spikes/SP-19-connector-framework/evidence/core-diff-report.md` §3 — no conditional naming either platform exists in the core | verified |
| Artifacts required to add a connector | 2 files and 1 registration line: a manifest, an adapter, and one line where the application wires itself together | `spikes/SP-19-connector-framework/evidence/core-diff-report.md` §2 — 57 lines of manifest and 194 lines of adapter for the second connector | verified |
| Tools offered to an agent for a connector that is not connected | 0, and the agent makes no tool call when asked to use that platform | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q6 — 7 tools with one connector connected, 9 with both, and `toolCallsCount = 0` for the disconnected platform | verified |
| Delay before a newly connected connector's tools are available | None; the tool set changes without restarting the application | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q6 | verified |
| Calls reaching the adapter for an irreversible tool held by the gate, with no user rule, in mode `smart` | 0 | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q5 — the verdict was raised from the manifest declaration alone and execution was not attempted; the same call executed after approval | verified |
| Connector states told apart by probing | 4 of 4 — accepted, expired, insufficient permission, withdrawn — each with whether renewal is possible on the device | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q9, `evidence/q9-status-detection.log` | verified |
| Behaviour of a running job when the authorisation is withdrawn mid-flight | The job ends `failed` with its completed-operations list; no hang, no crash, and the cause recorded | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q10 | verified |
| Ledger records carrying the connector they belong to, in a job spanning two platforms | Every record; 10 records across 4 tool calls in the measured job | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q7, `evidence/q7-multi-connector-job.log` | verified |
| Platform-computed values present in a recorded pre-write snapshot | 0 of the 6 a document platform rejects on write | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q4, `evidence/q4-uniform-ledger.log` record 5 | verified |
| Snapshot or compensation records written for a read-only connector's calls | 0; intent and result only | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q4, `evidence/q4-uniform-ledger.log` record 10 | verified |
| Cost of renewing an authorisation that expires inside a tool sequence | About 300 ms of unplanned round trip | `spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien` | verified |
| Remaining validity below which a job renews before it starts | 5 minutes, configurable | `spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien` — the spike's recommendation for the first milestone, not a measurement | **unverified** — recorded as a recommendation; the cost it avoids is verified, the margin itself is not |
| Architectural distance between a tool declaration and an external protocol's tool description | 0 — name and parameter schema match one to one; result shape matches; the product's safety declarations fit the annotation surface | `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q11 | verified |
| Number of connectors or tools the product supports without degrading | **No threshold is stated.** The measured configuration is two connectors and nine tools; nothing larger was exercised | Design §R1 | unverified — deliberately not converted into a threshold |
| Memory or assembly cost of a generated tool set | **No threshold is stated.** Not measured | Model §Physical Resource & Artifact Topology | unverified — deliberately not claimed |
| Time to establish every connector's state before a job starts | **No threshold is stated.** The probe's cost was not measured separately from the platform's own latency | Design §D7 | unverified — a task in this change records it during implementation |

Four entries above state no number on purpose. Under the constitution's Evidence Discipline an unmeasured
quantity cannot be a threshold, and the one number that is a recommendation rather than a measurement — the
renewal margin — is labelled so that a later reader does not cite it as measured.

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Lines changed in the job manager, the connector registry, the evaluator, the ledger, the wrapping layer and the tool generator when a second connector is added — 0, in each of the six | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/evidence/core-diff-report.md` §1; `REPORT.md#1-tra-loi-tung-cau-hoi` Q3 | 50 observations across target conditions | Observable behavior confirms lines changed in the job manager, the connector registry, the evaluator, the ledger, the wrapping layer and the tool generator when a second connector is added complies with threshold 0, in each of the six |
| Branches on a connector's identity in any core component — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/evidence/core-diff-report.md` §3 — no conditional naming either platform exists in the core | 50 observations across target conditions | Observable behavior confirms branches on a connector's identity in any core component complies with threshold 0 |
| Artifacts required to add a connector — 2 files and 1 registration line: a manifest, an adapter, and one line where the application wires itself together | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/evidence/core-diff-report.md` §2 — 57 lines of manifest and 194 lines of adapter for the second connector | 50 observations across target conditions | Observable behavior confirms artifacts required to add a connector complies with threshold 2 files and 1 registration line: a manifest, an adapter, and one line where the application wires itself together |
| Tools offered to an agent for a connector that is not connected — 0, and the agent makes no tool call when asked to use that platform | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q6 — 7 tools with one connector connected, 9 with both, and `toolCallsCount = 0` for the disconnected platform | 50 observations across target conditions | Observable behavior confirms tools offered to an agent for a connector that is not connected complies with threshold 0, and the agent makes no tool call when asked to use that platform |
| Delay before a newly connected connector's tools are available — None; the tool set changes without restarting the application | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q6 | 50 observations across target conditions | Observable behavior confirms delay before a newly connected connector's tools are available complies with threshold None; the tool set changes without restarting the application |
| Calls reaching the adapter for an irreversible tool held by the gate, with no user rule, in mode `smart` — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q5 — the verdict was raised from the manifest declaration alone and execution was not attempted; the same call executed after approval | 50 observations across target conditions | Observable behavior confirms calls reaching the adapter for an irreversible tool held by the gate, with no user rule, in mode `smart` complies with threshold 0 |
| Connector states told apart by probing — 4 of 4 — accepted, expired, insufficient permission, withdrawn — each with whether renewal is possible on the device | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q9, `evidence/q9-status-detection.log` | 50 observations across target conditions | Observable behavior confirms connector states told apart by probing complies with threshold 4 of 4 — accepted, expired, insufficient permission, withdrawn — each with whether renewal is possible on the device |
| Behaviour of a running job when the authorisation is withdrawn mid-flight — The job ends `failed` with its completed-operations list; no hang, no crash, and the cause recorded | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q10 | 50 observations across target conditions | Observable behavior confirms behaviour of a running job when the authorisation is withdrawn mid-flight complies with threshold The job ends `failed` with its completed-operations list; no hang, no crash, and the cause recorded |
| Ledger records carrying the connector they belong to, in a job spanning two platforms — Every record; 10 records across 4 tool calls in the measured job | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q7, `evidence/q7-multi-connector-job.log` | 50 observations across target conditions | Observable behavior confirms ledger records carrying the connector they belong to, in a job spanning two platforms complies with threshold Every record; 10 records across 4 tool calls in the measured job |
| Platform-computed values present in a recorded pre-write snapshot — 0 of the 6 a document platform rejects on write | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q4, `evidence/q4-uniform-ledger.log` record 5 | 50 observations across target conditions | Observable behavior confirms platform-computed values present in a recorded pre-write snapshot complies with threshold 0 of the 6 a document platform rejects on write |
| Snapshot or compensation records written for a read-only connector's calls — 0; intent and result only | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q4, `evidence/q4-uniform-ledger.log` record 10 | 50 observations across target conditions | Observable behavior confirms snapshot or compensation records written for a read-only connector's calls complies with threshold 0; intent and result only |
| Cost of renewing an authorisation that expires inside a tool sequence — About 300 ms of unplanned round trip | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien` | 50 observations across target conditions | Observable behavior confirms cost of renewing an authorisation that expires inside a tool sequence complies with threshold About 300 ms of unplanned round trip |
| Remaining validity below which a job renews before it starts — 5 minutes, configurable | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien` — the spike's recommendation for the first milestone, not a measurement | 50 observations across target conditions | Observable behavior confirms remaining validity below which a job renews before it starts complies with threshold 5 minutes, configurable |
| Architectural distance between a tool declaration and an external protocol's tool description — 0 — name and parameter schema match one to one; result shape matches; the product's safety declarations fit the annotation surface | Scenarios evaluated under representative workloads citing `spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q11 | 50 observations across target conditions | Observable behavior confirms architectural distance between a tool declaration and an external protocol's tool description complies with threshold 0 — name and parameter schema match one to one; result shape matches; the product's safety declarations fit the annotation surface |
| Number of connectors or tools the product supports without degrading — **No threshold is stated.** The measured configuration is two connectors and nine tools; nothing larger was exercised | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms number of connectors or tools the product supports without degrading complies with threshold **No threshold is stated.** The measured configuration is two connectors and nine tools; nothing larger was exercised |
| Memory or assembly cost of a generated tool set — **No threshold is stated.** Not measured | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms memory or assembly cost of a generated tool set complies with threshold **No threshold is stated.** Not measured |
| Time to establish every connector's state before a job starts — **No threshold is stated.** The probe's cost was not measured separately from the platform's own latency | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms time to establish every connector's state before a job starts complies with threshold **No threshold is stated.** The probe's cost was not measured separately from the platform's own latency |

## Contract Conformance

This change freezes two machine-readable contract files. Each is judged by a condition anyone can observe against
a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/connector-manifest.schema.json` | A manifest the file refuses yields no tool at all, and the refusal arrives at load with the failing declaration named — never at the first call. A write tool carrying neither `compensation` nor `irreversible`, and one carrying both, are each refused; every other connector in the same build loads unaffected | `specs/connector/spec.md`, the requirement that a manifest is loaded whole or not at all; INV-CN-07 |
| `contracts/connector-manifest.schema.json` | A `snapshot` that omits `exclude_computed` is refused, and an empty `exclude_computed` is accepted and means the platform computes none of that object's values: no recorded snapshot in any suite contains a value the platform computes | `specs/connector/spec.md`, the requirement that a write tool declares what is excluded from its snapshot |
| `contracts/connector-manifest.schema.json` | The gate, the undo planner and recovery read `irreversible`, `changes_permission`, `bulk_threshold_param`, `compensation`, `snapshot` and `reconciliation` from the loaded manifest and from nowhere else: editing a manifest after a call was recorded changes nothing about how that recorded call is treated | `specs/approval/spec.md`, the requirement that the declarations the gate reads come from the manifest; INV-CN-06 |
| `contracts/connector-manifest.schema.json` | A manifest whose `schema_version` carries a major number above the build's is unavailable with the application version it requires stated, rather than partially read; a `revocation` that is absent, or `supported: false` with no settings address, is refused before the connector is offered | `specs/connector/spec.md`; `contracts/connector-manifest.md` §Compatibility |
| `contracts/connector-adapter.schema.json` | Every adapter failure reaching the wrapping layer is a value carrying a code the file admits, never a thrown exception: for every intent record written there is a result record, including when the platform's authorisation was withdrawn mid-job | `specs/connector/spec.md`, the requirement that a connector reports failure only as a declared error code; the adapter conformance suite |
| `contracts/connector-adapter.schema.json` | No failure carrying one of the seven conditions the file marks never-retryable is retried by the job, and a failure carrying no code at all is recorded as an adapter defect and treated as permanent rather than repeated | `specs/connector/spec.md`; `contracts/connector-adapter.md` §Semantics |
| `contracts/connector-adapter.schema.json` | A status is an observation with an instant, and an unreachable platform produces no status at all: no connector is ever presented as revoked or expired on the strength of a failed request | `specs/connector/spec.md`, the requirement that connector state is established by asking the platform; INV-CN-10 |
| `contracts/connector-adapter.schema.json` | A success carrying a platform failure inside its value satisfies the file and is still a violation: the adapter conformance suite includes that shape and records it as a defect, because no schema can tell it from an ordinary result | `contracts/connector-adapter.md` §Examples; the adapter conformance suite |

## Combination Matrix

`connector` participates in the `integration` cluster (`connector`, `backend`, `sync`). The combinations below
must be exercised rather than reasoned about, because each is a case where two of those capabilities act on the
same authorisation at the same moment.

| Dimension | Values | Why it must be combined rather than sampled |
| --- | --- | --- |
| Connector shape | Writing with snapshots and compensations; read-only with neither | This is the axis the zero-core-change claim was measured on; a core component that branches would do so here first |
| Approval mode | `on`, `smart`, `off` | The irreversible default's whole point is that it holds in two of the three and records in the third |
| Connection state at call time | Connected, expired and renewable, expired and not, permission-short, withdrawn, unavailable on this device | Six answers a job must tell apart; collapsing any two produces a wrong sentence to the user |
| Revocation availability | Endpoint declared and accepting, endpoint declared and refusing, no endpoint declared | The three outcomes disconnection must report differently; the third is a real platform, not a hypothetical |
| Authorisation route | The product's own client through the broker; the user's own client | The renewal path differs, and only one of them is measured in `SP-20`; `req-014-byo-oauth-google` owns the other |
| Release-channel profile | Each profile a manifest declares | Selecting a profile must change the requested scopes and nothing else, including on re-consent |
| Device replication state | Authorisation present on this device; connected for the account but not yet replicated | The second must not be presented as revoked or expired, which is the distinction `req-022-account-sync` requires |
| Cluster interaction | A connector disconnected on one device while a job on another is using it; an authorisation renewed while replication is in flight; a manifest that fails to load on one release but not another | Each is reachable in ordinary use and each spans `connector`, `sync` and `backend` |

## Regression Scope

All scenarios of the capabilities below are rerun, not only the deltas — this change freezes the contract every
platform interaction passes through, and changes what the gate does by default.

- `connector` — the capability this change modifies; every existing requirement is re-evaluated against the frozen
  manifest and adapter contracts.
- `approval` — MODIFIED: the irreversible default now has a consequence and a source. The mode requirements, the
  fail-closed requirement and the hardline requirements must still hold unchanged around it.
- `job` — MODIFIED: retry classification now reads the declared error codes, and a job establishes its connectors
  before starting. The lifecycle, cancellation, timeout and crash-recovery requirements must be unaffected.
- `agent` — consumer of `agent/contracts/tool-wrapping@0.1.0`: every generated tool enters through the factory,
  and the declarations the wrapper requires are now supplied by the frozen manifest.
- `ledger` — consumer: snapshots, compensations and connector error codes are recorded there, and the
  two-record intent/result model must hold identically for both connector shapes.
- `undo` — consumer: the compensation formula and the irreversible flag are read from the manifest, and the
  snapshot it replays against is now stripped of platform-computed values.
- `backend` — cluster partner: the broker and the provider descriptor are the server-side half of every
  brokered platform, and `provider_id` is the join.
- `sync` — cluster partner: a connector's account-level record replicates, and the unavailable-on-this-device
  state depends on it.
- `app` and `uix` — consumers: the connectors area presents every state this change defines, including the two
  different outcomes of disconnecting.

## Manual Checks

- The words shown at disconnection for a platform that publishes no revocation endpoint: whether an ordinary
  user understands that the integration is still listed on the platform, and whether the route offered gets them
  there — owner: decision-maker, with `uix`.
- The words shown for a connector that is unavailable because its manifest failed to load, which is a product
  defect rather than anything the user did — owner: decision-maker, with `uix`.
- Ratification of the irreversible-by-default rule as the product's behaviour, tracked as Q-OQ-2 — owner:
  product owner.
- The default scope profile each connector's manifest names for the mass-market channel, which follows the
  verification tier that channel must clear, tracked as Q-1 — owner: product owner.
- A reading of the frozen manifest schema by whoever will author the third connector, before the contract is
  treated as settled in practice — owner: decision-maker.

## Open Measurement Gaps

- **Remaining validity below which a job renews before it starts.** Stated threshold "5 minutes, configurable" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Number of connectors or tools the product supports without degrading.** Stated threshold "**No threshold is stated.** The measured configuration is two connectors and nine tools; nothing larger was exercised" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Memory or assembly cost of a generated tool set.** Stated threshold "**No threshold is stated.** Not measured" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Time to establish every connector's state before a job starts.** Stated threshold "**No threshold is stated.** The probe's cost was not measured separately from the platform's own latency" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

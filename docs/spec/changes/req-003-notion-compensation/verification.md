# Verification: req-003-notion-compensation

The scenarios in the delta specs are the test cases. This file records what they cannot express: the numbers and
where each came from, the suites that reproduce them, the combinations that have to be exercised rather than
reasoned about, and the scope that must be rerun rather than only the delta.

One boundary governs every figure below. `spikes/SP-1-notion-compensation/REPORT.md` measured one platform,
through its raw HTTP surface, across three real workspaces chosen for their differences — one plain, one carrying
relation, rollup and formula properties, one carrying a numeric order property — using an internal integration
token. Everything about writing, snapshotting, compensating, pacing and failing is therefore measured. Nothing
about the authorisation flow is: the token kind differs from the one the product will ship, which is why one
capability appears below as a measurement that could not be made rather than as a threshold.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "A Notion snapshot excludes the values the platform computes", ensuring object carrying computed values is snapshotted holds without contradiction or unhandled failure | Requirement "A Notion snapshot excludes the values the platform computes"; Scenario "Object carrying computed values is snapshotted"; Scenario "Computed values return by themselves after compensation" | specs/connector/spec.md |
| AC-2 | The product fulfills requirement "Commenting on a Notion object is declared irreversible", ensuring a comment is about to be written holds without contradiction or unhandled failure | Requirement "Commenting on a Notion object is declared irreversible"; Scenario "A comment is about to be written"; Scenario "A comment appears in an undo plan" | specs/connector/spec.md |
| AC-3 | The product fulfills requirement "A Notion choice property is restored by option identity rather than by label", ensuring the option was renamed after the write holds without contradiction or unhandled failure | Requirement "A Notion choice property is restored by option identity rather than by label"; Scenario "The option was renamed after the write"; Scenario "The option no longer exists" | specs/connector/spec.md |
| AC-4 | The product fulfills requirement "A Notion status property cannot be restored to empty", ensuring prior state of the status property was empty holds without contradiction or unhandled failure | Requirement "A Notion status property cannot be restored to empty"; Scenario "Prior state of the status property was empty"; Scenario "Prior state of the status property held an option" | specs/connector/spec.md |
| AC-5 | The product fulfills requirement "A Notion option introduced by a write outlives the compensation of that write", ensuring a write invents a new label holds without contradiction or unhandled failure | Requirement "A Notion option introduced by a write outlives the compensation of that write"; Scenario "A write invents a new label"; Scenario "The same write is attempted on a status property" | specs/connector/spec.md |
| AC-6 | The product fulfills requirement "Compensating a Notion creation states what the compensation leaves behind", ensuring a created task is compensated holds without contradiction or unhandled failure | Requirement "Compensating a Notion creation states what the compensation leaves behind"; Scenario "A created task is compensated"; Scenario "The removed object was already cleared at the platform" | specs/connector/spec.md |
| AC-7 | The product fulfills requirement "A Notion write that notifies a person declares a notification it cannot recall", ensuring assignment is about to happen holds without contradiction or unhandled failure | Requirement "A Notion write that notifies a person declares a notification it cannot recall"; Scenario "Assignment is about to happen"; Scenario "The assignment is undone" | specs/connector/spec.md |
| AC-8 | The product fulfills requirement "The Notion connector tells a recoverably removed object apart from an absent one", ensuring the object is in the platform's trash holds without contradiction or unhandled failure | Requirement "The Notion connector tells a recoverably removed object apart from an absent one"; Scenario "The object is in the platform's trash"; Scenario "The object cannot be returned at all" | specs/connector/spec.md |
| AC-9 | The product fulfills requirement "Notion pacing is held per authorisation rather than per device", ensuring one authorisation is waiting and another is idle holds without contradiction or unhandled failure | Requirement "Notion pacing is held per authorisation rather than per device"; Scenario "One authorisation is waiting and another is idle"; Scenario "Two jobs share one authorisation" | specs/connector/spec.md |
| AC-10 | The product fulfills requirement "An unmeasured Notion capability is declared absent rather than offered", ensuring the agent is asked to create a page outside a database holds without contradiction or unhandled failure | Requirement "An unmeasured Notion capability is declared absent rather than offered"; Scenario "The agent is asked to create a page outside a database"; Scenario "The manifest is loaded" | specs/connector/spec.md |
| AC-11 | The product fulfills requirement "Notion write operations cover creation, property update and reordering", ensuring property value is rejected by the platform holds without contradiction or unhandled failure | Requirement "Notion write operations cover creation, property update and reordering"; Scenario "Property value is rejected by the platform"; Scenario "The database carries a numeric order property" | specs/connector/spec.md |
| AC-12 | The product fulfills requirement "Notion request volume respects the platform's limits", ensuring burst of writes holds without contradiction or unhandled failure | Requirement "Notion request volume respects the platform's limits"; Scenario "Burst of writes"; Scenario "The platform refuses a request for volume" | specs/connector/spec.md |
| AC-13 | The product fulfills requirement "An effect that cannot be recalled is named in the preview even when the step is revertible", ensuring a revertible step carries an unrecallable effect holds without contradiction or unhandled failure | Requirement "An effect that cannot be recalled is named in the preview even when the step is revertible"; Scenario "A revertible step carries an unrecallable effect"; Scenario "A step carries no such effect" | specs/undo/spec.md |
| AC-14 | The product fulfills requirement "A compensating action refused as invalid is narrowed rather than abandoned", ensuring one property of several is refused holds without contradiction or unhandled failure | Requirement "A compensating action refused as invalid is narrowed rather than abandoned"; Scenario "One property of several is refused"; Scenario "Every part is refused" | specs/undo/spec.md |
| AC-15 | The product fulfills requirement "Current state is reconciled against the snapshot before undoing", ensuring object edited by a colleague after the job holds without contradiction or unhandled failure | Requirement "Current state is reconciled against the snapshot before undoing"; Scenario "Object edited by a colleague after the job"; Scenario "Object is in the platform's recoverable removed state" | specs/undo/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Property integrity after compensating a property update | 100% of writeable business properties restored; only the platform's own last-edit attribution differs | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q2; `evidence/data/q1_q2_roundtrip_results.json` | verified |
| Property integrity after compensating a removal | 100%, including the object's child content and its relations | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q2; `evidence/raw_logs/q2_get_children_after_unarchive*.json` | verified |
| Business-level integrity after compensating a creation | The object leaves the database's contents; it remains in the platform's recoverable removed state and its identifier is not reclaimed | `spikes/SP-1-notion-compensation/evidence/compensation-matrix.md` §1, row 1 | verified |
| Computed values present in a recorded projection | 0 of 6 (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`) | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q1, Q6; `evidence/data/q6_complex_schema_results.json` | verified |
| Platform response to a payload carrying any of those six | HTTP 400 `validation_error`, in every case tried | `spikes/SP-1-notion-compensation/evidence/raw_logs/q6_patch_formula*.json`, `q6_patch_rollup*.json`, `q1_patch_created_time*.json`, `q1_patch_created_by*.json` | verified |
| Platform operations that remove or edit a comment | 0 | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q3; `evidence/data/q3_irreversible_results.json` | verified |
| Recorded projection size | 575–1,149 bytes, against returned objects of 1,333–2,185 bytes, over 30 object reads in three workspaces | Derived from `spikes/SP-1-notion-compensation/evidence/raw_logs/*_GET_pages_*.json` | verified — as a measurement of small objects, **not** as a budget; no ceiling is asserted from it |
| Projection size treated as a defect | above 64 KB | Design §R4 | **unverified** — a guard chosen to catch a projection that should never occur, not a measured limit |
| Steady request rate under one authorisation | at most 2.5 per second | `spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd`; `evidence/data/q5_rate_limit_results.json`, field `recommended_queue_rate` | verified as the spike's recommendation beneath a published average of 3 per second; the figure itself is a judgement within the measurement |
| Burst permitted before pacing applies | 20 concurrent requests | `spikes/SP-1-notion-compensation/evidence/data/q5_rate_limit_results.json`, field `burst_policy` | verified that bursts of 15 and 60 completed entirely; **20 is the spike's recommendation**, and the point at which the platform begins refusing is not located |
| Delay stated by the platform when it refuses for volume | 37–49 seconds, always present | Derived from the 207 refusals in `spikes/SP-1-notion-compensation/evidence/raw_logs/q5_*.json`; `REPORT.md#1-tra-loi-tung-cau-hoi` Q5 | verified |
| Refusals under sustained probing | 207 refused against 356 accepted across the q5 probes | Derived from `spikes/SP-1-notion-compensation/evidence/raw_logs/q5_*.json` | verified — the ratio describes the probe, not the product; it exists to show the refusal is reachable and its delay real |
| Remaining-quota information on an accepted response | none of any kind | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5; `evidence/data/q5_rate_limit_results.json`, field `rate_limit_headers_detected` is empty | verified |
| Independence of one authorisation's pacing from another's | A second token called successfully while the first was inside its wait | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5 | verified |
| Platform answers that distinguish permanent removal from withdrawn visibility | 0 — both are one status and one code | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q7; `evidence/data/q7_error_codes_results.json` | verified |
| Platform answer for an object in the recoverable removed state | HTTP 200, returned whole, marked removed | `spikes/SP-1-notion-compensation/evidence/raw_logs/q7_get_archived_page*.json` | verified |
| Property kinds with a projection rule | 13 writeable kinds, 6 computed kinds excluded | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q1, Q6 | verified for the kinds exercised; kinds the spike did not meet, including files and unique identifiers, are outside this version and are **unverified** |
| Delay before a dependent computed value reflects a restored source value | none observed; the recomputed value was present in the next read | `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q6 | verified — observed on single reads, not measured as a latency |
| Conflict detection false negatives, using property comparison | 0 | `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` Q3 | verified in `SP-9`, carried here as the reason design §D6 does not use the platform's last-edited time alone |
| Creating a page in the workspace rather than in a database | **No threshold.** The operation could not be exercised: the platform refuses it to the authorisation kind the spike used | `spikes/SP-1-notion-compensation/REPORT.md#5-chua-tra-loi-duoc-vi-sao` | unverified — recorded as Q-1; the capability is declared absent rather than estimated |
| Time to take a projection before a write | **No threshold.** The read's cost was not separated from the platform's own latency | Design §Structure | unverified — deliberately not claimed; a task records it during implementation |

Four rows above state no number, or state one that is a judgement rather than a measurement. Under the
constitution's Evidence Discipline an unmeasured quantity cannot be a threshold, and a recommendation carried
from a spike is labelled so that a later reader does not cite it as measured.

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Property integrity after compensating a property update — 100% of writeable business properties restored; only the platform's own last-edit attribution differs | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q2; `evidence/data/q1_q2_roundtrip_results.json` | 50 observations across target conditions | Observable behavior confirms property integrity after compensating a property update complies with threshold 100% of writeable business properties restored; only the platform's own last-edit attribution differs |
| Property integrity after compensating a removal — 100%, including the object's child content and its relations | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q2; `evidence/raw_logs/q2_get_children_after_unarchive*.json` | 50 observations across target conditions | Observable behavior confirms property integrity after compensating a removal complies with threshold 100%, including the object's child content and its relations |
| Business-level integrity after compensating a creation — The object leaves the database's contents; it remains in the platform's recoverable removed state and its identifier is not reclaimed | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/evidence/compensation-matrix.md` §1, row 1 | 50 observations across target conditions | Observable behavior confirms business-level integrity after compensating a creation complies with threshold The object leaves the database's contents; it remains in the platform's recoverable removed state and its identifier is not reclaimed |
| Computed values present in a recorded projection — 0 of 6 (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`) | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q1, Q6; `evidence/data/q6_complex_schema_results.json` | 50 observations across target conditions | Observable behavior confirms computed values present in a recorded projection complies with threshold 0 of 6 (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`) |
| Platform response to a payload carrying any of those six — HTTP 400 `validation_error`, in every case tried | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/evidence/raw_logs/q6_patch_formula*.json`, `q6_patch_rollup*.json`, `q1_patch_created_time*.json`, `q1_patch_created_by*.json` | 50 observations across target conditions | Observable behavior confirms platform response to a payload carrying any of those six complies with threshold HTTP 400 `validation_error`, in every case tried |
| Platform operations that remove or edit a comment — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q3; `evidence/data/q3_irreversible_results.json` | 50 observations across target conditions | Observable behavior confirms platform operations that remove or edit a comment complies with threshold 0 |
| Recorded projection size — 575–1,149 bytes, against returned objects of 1,333–2,185 bytes, over 30 object reads in three workspaces | Scenarios evaluated under representative workloads citing Derived from `spikes/SP-1-notion-compensation/evidence/raw_logs/*_GET_pages_*.json` | 50 observations across target conditions | Observable behavior confirms recorded projection size complies with threshold 575–1,149 bytes, against returned objects of 1,333–2,185 bytes, over 30 object reads in three workspaces |
| Projection size treated as a defect — above 64 KB | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms projection size treated as a defect complies with threshold above 64 KB |
| Steady request rate under one authorisation — at most 2.5 per second | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#2-tac-dong-len-adr-prd`; `evidence/data/q5_rate_limit_results.json`, field `recommended_queue_rate` | 50 observations across target conditions | Observable behavior confirms steady request rate under one authorisation complies with threshold at most 2.5 per second |
| Burst permitted before pacing applies — 20 concurrent requests | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/evidence/data/q5_rate_limit_results.json`, field `burst_policy` | 50 observations across target conditions | Observable behavior confirms burst permitted before pacing applies complies with threshold 20 concurrent requests |
| Delay stated by the platform when it refuses for volume — 37–49 seconds, always present | Scenarios evaluated under representative workloads citing Derived from the 207 refusals in `spikes/SP-1-notion-compensation/evidence/raw_logs/q5_*.json`; `REPORT.md#1-tra-loi-tung-cau-hoi` Q5 | 50 observations across target conditions | Observable behavior confirms delay stated by the platform when it refuses for volume complies with threshold 37–49 seconds, always present |
| Refusals under sustained probing — 207 refused against 356 accepted across the q5 probes | Scenarios evaluated under representative workloads citing Derived from `spikes/SP-1-notion-compensation/evidence/raw_logs/q5_*.json` | 50 observations across target conditions | Observable behavior confirms refusals under sustained probing complies with threshold 207 refused against 356 accepted across the q5 probes |
| Remaining-quota information on an accepted response — none of any kind | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5; `evidence/data/q5_rate_limit_results.json`, field `rate_limit_headers_detected` is empty | 50 observations across target conditions | Observable behavior confirms remaining-quota information on an accepted response complies with threshold none of any kind |
| Independence of one authorisation's pacing from another's — A second token called successfully while the first was inside its wait | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5 | 50 observations across target conditions | Observable behavior confirms independence of one authorisation's pacing from another's complies with threshold A second token called successfully while the first was inside its wait |
| Platform answers that distinguish permanent removal from withdrawn visibility — 0 — both are one status and one code | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q7; `evidence/data/q7_error_codes_results.json` | 50 observations across target conditions | Observable behavior confirms platform answers that distinguish permanent removal from withdrawn visibility complies with threshold 0 — both are one status and one code |
| Platform answer for an object in the recoverable removed state — HTTP 200, returned whole, marked removed | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/evidence/raw_logs/q7_get_archived_page*.json` | 50 observations across target conditions | Observable behavior confirms platform answer for an object in the recoverable removed state complies with threshold HTTP 200, returned whole, marked removed |
| Property kinds with a projection rule — 13 writeable kinds, 6 computed kinds excluded | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q1, Q6 | 50 observations across target conditions | Observable behavior confirms property kinds with a projection rule complies with threshold 13 writeable kinds, 6 computed kinds excluded |
| Delay before a dependent computed value reflects a restored source value — none observed; the recomputed value was present in the next read | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q6 | 50 observations across target conditions | Observable behavior confirms delay before a dependent computed value reflects a restored source value complies with threshold none observed; the recomputed value was present in the next read |
| Conflict detection false negatives, using property comparison — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` Q3 | 50 observations across target conditions | Observable behavior confirms conflict detection false negatives, using property comparison complies with threshold 0 |
| Creating a page in the workspace rather than in a database — **No threshold.** The operation could not be exercised: the platform refuses it to the authorisation kind the spike used | Scenarios evaluated under representative workloads citing `spikes/SP-1-notion-compensation/REPORT.md#5-chua-tra-loi-duoc-vi-sao` | 50 observations across target conditions | Observable behavior confirms creating a page in the workspace rather than in a database complies with threshold **No threshold.** The operation could not be exercised: the platform refuses it to the authorisation kind the spike used |
| Time to take a projection before a write — **No threshold.** The read's cost was not separated from the platform's own latency | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms time to take a projection before a write complies with threshold **No threshold.** The read's cost was not separated from the platform's own latency |

## Contract Conformance

This change freezes two machine-readable contract files. Each is judged by a condition anyone can observe against
a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/notion-property-compensation.schema.json` | A rule that keeps a choice as text and restores it as text is refused by the file itself, before any review: a `select` or `status` keeps an option and is restored by identity, and a `multi_select` keeps an option list and is restored by identity | `specs/connector/spec.md`, the requirement that a choice property is restored by option identity rather than by label; INV-NT-04; the rule-set conformance suite |
| `contracts/notion-property-compensation.schema.json` | A property kind the published rule set does not name yields no write path at all — not a default one — and the operation is refused before anything reaches the platform | `specs/connector/spec.md`, the requirement that an unmeasured capability is declared absent rather than offered; INV-NT-01 |
| `contracts/notion-property-compensation.schema.json` | No recorded projection in any suite contains one of the six values the platform computes, and no rule marked not writeable ever produces a payload | `specs/connector/spec.md`, the requirement that a snapshot excludes the values the platform computes; the projection exclusion suite |
| `contracts/notion-property-compensation.schema.json` | A rule whose `empty_behaviour` is `platform_default` produces the outcome `approximated` and never `restored`: compensating an emptied status reports what the platform substituted and why | `specs/connector/spec.md`, the requirement that a status property cannot be restored to empty; the choice-property suite |
| `contracts/notion-property-compensation.schema.json` | A rule whose `residue` is `schema_option` produces a report naming what stayed in the database's settings, and the product attempts no repair of it | `specs/connector/spec.md`, the requirement that an option introduced by a write outlives the compensation of that write; INV-NT-07 |
| `contracts/connector-manifest.schema.json` | A write tool declaring an effect outside the platform's data carries it before the call: the effect is named in the approval request and in the undo preview even where the step itself is revertible, and one recorded as recallable names what withdraws it or the manifest is refused | `specs/connector/spec.md`, the requirement that a write that notifies a person declares a notification it cannot recall; `specs/undo/spec.md` |
| `contracts/connector-manifest.schema.json` | A compensating action for a creation is built from the result of the call and one for an update from the recorded snapshot, and no manifest can leave that source unstated while still loading | `specs/connector/spec.md`, the requirement that compensating a creation states what it leaves behind; the manifest conformance suite |
| `contracts/connector-manifest.schema.json` | A manifest written against `1.0` loads unchanged under this version and means exactly what it meant: no tool acquires an effect declaration or a compensation source it did not carry | `contracts/connector-manifest.md` §Compatibility; §Migration |

## Combination Matrix

`connector` sits in the `integration` cluster and this change is also the first real input to `undo`. The
combinations below are those where two of the measured dimensions interact, and where reasoning from one
dimension at a time gives the wrong answer.

| Dimension | Values | Why it must be combined rather than sampled |
| --- | --- | --- |
| Workspace shape | Plain; carrying relation, rollup and formula; carrying a numeric order property | This is the axis the spike measured on; the exclusion rules and the ordering rules are only visible on two of the three |
| Property kind | The 13 writeable kinds, plus the 6 computed | A projection rule that is wrong for one kind is invisible in a test that uses another |
| Object reachability at compensation time | Present; removed but recoverable; not returned at all | Three different sentences to the user and three different step outcomes; collapsing any two produces a false statement about someone's workspace |
| Third-party interference | None; a value edited; an option renamed; an option deleted; the object removed | Conflict and restoration interact: an object both edited and removed must produce one coherent outcome, not two |
| Compensation source | From the snapshot; from the platform's response | The creation case is the only one using the second, and it is the case with no prior state to fall back on |
| Approval mode at the time of the original write | `on`, `smart`, `off` | The unrecallable-effect statement must appear where a decision is asked for, and the record must carry the same operation in the mode where nothing is asked |
| Authorisation count | One; two at once | The pacing unit is only observable with two, and it is the measurement that decides the queue's key |
| Volume refusal during an undo, not during the original job | Refusal on the first compensating step; refusal partway through several | An undo that stalls must still report which steps were done, which is where a pacing wait meets the undo's own accounting |

## Regression Scope

Every scenario of the capabilities below is rerun, not only the deltas. This change amends the contract every
platform interaction is declared in, and gives `undo` outcomes it did not previously have.

- `connector` — the capability this change modifies; two existing requirements change meaning and ten are added,
  so the whole set is re-evaluated against the amended manifest contract.
- `undo` — MODIFIED: reconciliation now distinguishes a recoverable removal from an absence, and two requirements
  are added. Every existing undo requirement must still hold around them, in particular the refusal to act when
  nothing is compensable.
- `approval` — consumer of the amended contract: the request to approve now states an unrecallable effect, and
  the irreversible default must behave exactly as it did for the comment tool.
- `ledger` — consumer: projections, compensating actions and connector error codes are recorded there, and this
  change must not alter the two-record intent and result model in any way.
- `job` — consumer: the declared codes this connector produces drive retry classification, and a volume wait
  happens inside a running job.
- `agent` — consumer: the ten generated tools reach a session only through the wrapping factory, and their
  descriptions are what a model reads.
- `uix` and `app` — consumers: the outcome vocabulary is presented here, and `restored`, `approximated`,
  `narrowed` and `reopened_then_restored` must be distinguishable to a reader who is not looking carefully.
- `sync` — cluster partner: a recorded projection is user work content that replicates under service-managed
  keys, so the privacy consequence of what this change records belongs to its regression too.

## Manual Checks

- Decision-maker observation records whether an ordinary reader distinguishes `restored` from `approximated`
  in the undo report for a status property the platform will not leave empty — owner: decision-maker, with
  `uix`.
- The approved sentence shown before assignment and after its undo states the unrecallable notification without
  sounding like a refusal — owner: decision-maker, with `uix`.
- When reordering is unsupported because a database has no order property, the displayed wording makes clear
  that this is a property of the user's database rather than a product failure, and a decision record states
  whether naming the missing property is helpful or overly technical — owner: decision-maker, with `uix`.
- A decision record states whether reporting a leftover schema option is useful or unwanted noise; the
  measurement alone does not settle that choice — owner: decision-maker.
- Evidence using a public authorisation establishes whether workspace-level page creation is available before
  the reserved point in `model.md` activates — owner: engineering, tracked as Q-1.
- Before the second connector treats the rule format as settled, its author records review of
  `connector/contracts/notion-property-compensation@0.1.0` §2 — owner: decision-maker.

## Open Measurement Gaps

- **Projection size treated as a defect.** Stated threshold "above 64 KB" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Property kinds with a projection rule.** Stated threshold "13 writeable kinds, 6 computed kinds excluded" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Creating a page in the workspace rather than in a database.** Stated threshold "**No threshold.** The operation could not be exercised: the platform refuses it to the authorisation kind the spike used" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Time to take a projection before a write.** Stated threshold "**No threshold.** The read's cost was not separated from the platform's own latency" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

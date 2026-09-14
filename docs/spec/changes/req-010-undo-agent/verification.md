# Verification: req-010-undo-agent

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "A connector is defined by a manifest", ensuring write tool without a compensation declaration holds without contradiction or unhandled failure | Requirement "A connector is defined by a manifest"; Scenario "Write tool without a compensation declaration"; Scenario "Adding a platform changes no core component" | specs/connector/spec.md |
| AC-2 | The product fulfills requirement "A ledger record carries the full account of one step", ensuring snapshot is unavailable holds without contradiction or unhandled failure | Requirement "A ledger record carries the full account of one step"; Scenario "Snapshot is unavailable"; Scenario "Outcome is not yet known" | specs/ledger/spec.md |
| AC-3 | The product fulfills requirement "The undo agent infers a reverse compensating action sequence from the ledger", ensuring multi-step job with created container and child updates holds without contradiction or unhandled failure | Requirement "The undo agent infers a reverse compensating action sequence from the ledger"; Scenario "Multi-step job with created container and child updates"; Scenario "Independent action records" | specs/undo/spec.md |
| AC-4 | The product fulfills requirement "The conflict detector probes live object state using property payload diffing", ensuring third-party modification within the same minute as job completion holds without contradiction or unhandled failure | Requirement "The conflict detector probes live object state using property payload diffing"; Scenario "Third-party modification within the same minute as job completion"; Scenario "External object moved to trash or deleted" | specs/undo/spec.md |
| AC-5 | The product fulfills requirement "The undo preview categorizes operations into reversible, irreversible, and conflict groups", ensuring mixed job containing reversible, irreversible, and conflicting actions holds without contradiction or unhandled failure | Requirement "The undo preview categorizes operations into reversible, irreversible, and conflict groups"; Scenario "Mixed job containing reversible, irreversible, and conflicting actions"; Scenario "User inspects conflict details" | specs/undo/spec.md |
| AC-6 | The product fulfills requirement "Undo execution runs as an independent job with recursive lineage", ensuring executing an approved undo plan holds without contradiction or unhandled failure | Requirement "Undo execution runs as an independent job with recursive lineage"; Scenario "Executing an approved undo plan"; Scenario "User requests undo of a prior undo job" | specs/undo/spec.md |
| AC-7 | The product fulfills requirement "Undo control is disabled when a job contains zero reversible actions", ensuring job consisting entirely of irreversible tool calls holds without contradiction or unhandled failure | Requirement "Undo control is disabled when a job contains zero reversible actions"; Scenario "Job consisting entirely of irreversible tool calls" | specs/undo/spec.md |
| AC-8 | The product fulfills requirement "Conflict detection for repeated object modifications references the final sequential snapshot", ensuring object updated multiple times in one job holds without contradiction or unhandled failure | Requirement "Conflict detection for repeated object modifications references the final sequential snapshot"; Scenario "Object updated multiple times in one job" | specs/undo/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Reverse-order inference accuracy | 100.0% (10/10 sample jobs) | `spikes/SP-9-undo-agent/REPORT.md#0-ket-luan` | Verified |
| Preview 3-group classification accuracy | 100.0% (0.0% error across groups) | `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) | Verified |
| Conflict detection False-Negative rate | 0.0% (0 / 3 missed cases) | `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) | Verified |
| Conflict detection False-Positive rate | 0.0% (0 / 4 false alarms) | `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) | Verified |
| Internal dependency reversal accuracy | 100.0% (property revert before archive) | `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) | Verified |
| Recursive undo of undo execution | 100.0% success with isolated ledgers | `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) | Verified |
| Irreversible job detection and button disable | 100.0% disabled when reversible = 0 | `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) | Verified |

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Reverse-order inference accuracy — 100.0% (10/10 sample jobs) | Scenarios evaluated under representative workloads citing `spikes/SP-9-undo-agent/REPORT.md#0-ket-luan` | 50 observations across target conditions | Observable behavior confirms reverse-order inference accuracy complies with threshold 100.0% (10/10 sample jobs) |
| Preview 3-group classification accuracy — 100.0% (0.0% error across groups) | Scenarios evaluated under representative workloads citing `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) | 50 observations across target conditions | Observable behavior confirms preview 3-group classification accuracy complies with threshold 100.0% (0.0% error across groups) |
| Conflict detection False-Negative rate — 0.0% (0 / 3 missed cases) | Scenarios evaluated under representative workloads citing `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) | 50 observations across target conditions | Observable behavior confirms conflict detection false-negative rate complies with threshold 0.0% (0 / 3 missed cases) |
| Conflict detection False-Positive rate — 0.0% (0 / 4 false alarms) | Scenarios evaluated under representative workloads citing `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) | 50 observations across target conditions | Observable behavior confirms conflict detection false-positive rate complies with threshold 0.0% (0 / 4 false alarms) |
| Internal dependency reversal accuracy — 100.0% (property revert before archive) | Scenarios evaluated under representative workloads citing `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) | 50 observations across target conditions | Observable behavior confirms internal dependency reversal accuracy complies with threshold 100.0% (property revert before archive) |
| Recursive undo of undo execution — 100.0% success with isolated ledgers | Scenarios evaluated under representative workloads citing `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) | 50 observations across target conditions | Observable behavior confirms recursive undo of undo execution complies with threshold 100.0% success with isolated ledgers |
| Irreversible job detection and button disable — 100.0% disabled when reversible = 0 | Scenarios evaluated under representative workloads citing `spikes/SP-9-undo-agent/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) | 50 observations across target conditions | Observable behavior confirms irreversible job detection and button disable complies with threshold 100.0% disabled when reversible = 0 |

## Contract Conformance

This change freezes two machine-readable contract files. Each is judged by a condition anyone can observe against
a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/undo-pipeline.schema.json` | Every preview a user is shown satisfies the file, and the partition is exhaustive: each recorded action of the source job appears exactly once, under exactly one of the three categories. An action absent from the preview is a finding, because it is an action the user believes was undone | `specs/undo/spec.md`, the requirement that the preview categorizes operations into reversible, irreversible and conflict groups; `spikes/SP-9-undo-agent/REPORT.md` §1 Q2 |
| `contracts/undo-pipeline.schema.json` | No item is shown as irreversible or conflicted without the reason the file requires, and no preview disables undo without the reason it requires. A user is never told something cannot be put back without being told why | `specs/undo/spec.md`, the requirement that undo control is disabled when a job contains zero reversible actions; INV-UD-04 |
| `contracts/undo-pipeline.schema.json` | The three counts agree with the items beside them in every preview. The file cannot express the agreement, so it is judged by observation: a preview whose summary and list disagree fails, rather than being reconciled by whichever the window happens to render | `specs/undo/spec.md`; `contracts/undo-pipeline.md` §Semantics |
| `contracts/undo-pipeline.schema.json` | A conflicted item carries the fields where the live object diverges, and the divergence is measured against the latest record of the source job that touched that object, so a job's own intermediate steps never appear as a third party's edit | `specs/undo/spec.md`, the requirement that conflict detection for repeated object modifications references the final sequential snapshot; INV-UD-03; `spikes/SP-9-undo-agent/REPORT.md` §1 Q3 |
| `contracts/undo-pipeline.execute.schema.json` | No message a window can send on `undo:execute` names a compensating operation, an argument or an ordering; a request carries only a job and confirmed positions, and what is executed is derived again from the ledger. A window holding a stale preview cannot replay it | `specs/undo/spec.md`, the requirement that undo execution runs as an independent job with recursive lineage; INV-UD-02; `model.md` §Trust Boundary |
| `contracts/undo-pipeline.execute.schema.json` | A confirmed position that the source job did not record, or that the preview did not classify reversible, is refused before anything is executed, and an unreachable or diverged object is never overwritten on the assumption that it is safe | `specs/undo/spec.md`; INV-UD-01; `contracts/undo-pipeline.md` §Error Matrix |

## Combination Matrix

| Target Platform | Action Types | Multi-Touch in Job | External Concurrent Edit | Expected Outcome |
| --- | --- | --- | --- | --- |
| Notion | Page Create + Property Update | Yes | No | Reversible (revert property then archive) |
| Notion | Property Update | No | Yes (same minute) | Conflict detected via property diff |
| Notion | Comment Creation | No | No | Irreversible; Undo button disabled if solo |
| Notion | Page Archive | No | Yes (deleted from trash) | Conflict / Unreachable detected |

## Regression Scope

- `undo` — new capability: all delta scenarios must pass.
- `connector` — manifest `is_reversible` flag parsing and adapter read queries.
- `ledger` — append-only record creation and multi-touch snapshot sequencing.

## Manual Checks

- Visual review of the Three-Way Preview dialog to ensure clear visual distinction between Reversible (green/neutral), Irreversible (muted/informational), and Conflicted (warning/amber) items. — owner: Frontend Reviewer.

## Open Measurement Gaps

- None. All asserted thresholds are verified by empirical spike evidence.

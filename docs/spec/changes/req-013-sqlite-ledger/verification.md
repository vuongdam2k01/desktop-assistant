# Verification: req-013-sqlite-ledger

A document-level acceptance plan. The scenarios in the delta specs are the acceptance cases; this file records
what a scenario cannot express — the observable conditions that judge the change as a whole, the numbers and
where they come from, how each number would be measured, the combinations that must be exercised rather than
reasoned about, and the scope that is re-judged rather than only the delta.

One boundary is stated up front because it governs everything below. `spikes/SP-12-sqlite-ledger/REPORT.md`
measured Linux on ext4 and Windows 11 on NTFS. macOS is a supported operating system —
`specs/platform/spec.md` in `req-001-mvp-product-definition` requires macOS 13 or later — and it was not
measured. Every figure below is therefore VERIFIED for two of the three supported environments and UNVERIFIED
for the third, and closing that is work this change carries rather than an assumption it makes.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | A tool call appears in the store as exactly two records joined by one correlation identifier, and a call that was interrupted appears as an intent with no result rather than as nothing at all | `specs/ledger/spec.md` — One tool call is two records joined by a correlation identifier; INV-LG-02 | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q4 |
| AC-2 | After an abrupt stop at any point in a tool call's life, restarting the product loses no job and repeats no call: each interrupted call ends in the state its recorded intent and the platform's own state jointly determine | `specs/job/spec.md` — No job is lost across a crash, all six scenarios | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q4 |
| AC-3 | What recovery may assume about an interrupted call is taken from the intent record written before the call, not from the connector's declaration as it stands at recovery time | `specs/ledger/spec.md` — The intent record fixes what recovery may assume about the call | `job/contracts/tool-reconciliation@0.1.0` |
| AC-4 | A conclusion of `undetermined` or `unreachable` is presented to the user as such and is never promoted to `performed` or `not_performed` without the user saying so | `specs/job/spec.md` — Effect that cannot be read back; The platform cannot be reached at the time of recovery | `job/contracts/tool-reconciliation@0.1.0`, Error Matrix |
| AC-5 | An attempt to modify or delete an action record is refused by the store itself, including from a process that is not the product | `specs/ledger/spec.md` — The ledger is append-only; Records leave the store only whole | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q2 |
| AC-6 | A correction is a new record referencing the original, and the original remains readable afterwards | `specs/ledger/spec.md` — Correcting a recorded mistake | Constitution §III |
| AC-7 | Records leave the store only as a whole declared range, only after the removal is announced, and an interrupted removal leaves the range either wholly present or wholly gone | `specs/ledger/spec.md` — Records leave the store only whole, and only after the store says so | `design.md` §Removal procedure |
| AC-8 | A change to the store's shape leaves every existing record with the content it was written with, and carries no backfilled value for a field the change introduced | `specs/ledger/spec.md` — A change to the store's shape leaves existing records as they were written; INV-LG-08 | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q6 |
| AC-9 | Interrupted work is classified from the local store alone, with no network reachable, and the classification completes before the first window appears | `specs/platform/spec.md` — Interrupted work is classified from the local store before the first window appears | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 |
| AC-10 | The packaged product opens its store on a machine that has never held a compiler toolchain, loading its native component from a file on disk rather than from inside the archive | `specs/platform/spec.md` — Native components are loaded from files on disk; The local store is reached without compiling anything on the machine | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q1a, Q1c, Q1e |
| AC-11 | Every threshold in this file either cites a measurement or is labelled unverified; no quantity is asserted from estimation | Constitution §Evidence Discipline | this file, §Thresholds |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Jobs lost across a crash, at any point in a tool call's life | 0, at all five kill points | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q4 — five deliberate kills on Linux and Windows, all passed | verified (Linux, Windows); unverified (macOS) |
| Tool calls repeated after a crash | 0 | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q4, kill point 4 — the platform already held the intended result and the missing result record was appended instead of the call being made again | verified (Linux, Windows); unverified (macOS) |
| Store integrity after an abrupt termination | Integrity check reports no damage, every time | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q1d | verified (Linux, Windows); unverified (macOS) |
| Modification or deletion of a record, by any process including tools that are not the product | Refused, every time | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q2 — refused from the product's runtime and from a second, unrelated language runtime opening the same file | verified (Linux, Windows); unverified (macOS) |
| Store size after 90 days at 20 jobs per day (1,800 jobs, 5,400 records) | ≤ 15 MB; measured 12.36 MB | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | verified |
| Store size after 90 days at 50 jobs per day (4,500 jobs, 13,500 records) | ≤ 35 MB; measured 30.83 MB | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | verified |
| Average size per record | ≈ 2.4 KB | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | verified |
| One job's detail read, median | ≤ 0.5 ms; measured 0.13–0.25 ms | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | verified |
| One job's detail read, 99th percentile | ≤ 1 ms; measured 0.29–0.77 ms | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | verified |
| Recent-jobs listing, with the descending-time index | < 1 ms, against roughly 30 ms without it | `spikes/SP-12-sqlite-ledger/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 2 | verified |
| Write-ahead companion file after checkpoint | Returns to 0 bytes | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5 | verified |
| Store binding usable without a compiler toolchain on developer, build or user machines | Required | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q1a and Q1c — the pinned generation loaded the same prebuilt component under the plain runtime and the application framework with no rebuild | verified (Windows); unverified (macOS) |
| Packaged application loads its native component and opens its store | Required | `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q1e — the packaged executable created its store and read a record back, exit code 0 | verified (Windows); unverified (macOS) |
| Duration of the local classification pass before the first window | **No threshold is stated.** It is measured during implementation and recorded as an observation | Open question Q-6 in `clarifications.md`; the component query is measured at 0.13–0.25 ms but the whole pass against a full store is not | unverified — deliberately not converted into a threshold |
| Account-wide store size across devices | **No threshold is stated here.** Out of scope | RISK-069; owned by `req-022-account-sync` and its spike | unverified |

Two entries above state no number on purpose. Under the constitution's Evidence Discipline an unmeasured
quantity cannot be a threshold, and inventing one would make this file assert something no measurement supports.

## Measurement Method

Each threshold above is judged by a population, a sample size and a pass criterion. These are measurements, not
procedures: they say what would have to be observed, not what would have to be built or run.

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Jobs lost across a crash | Jobs terminated at each of the five kill points, on each supported operating system and file system, under each of the two process hosts | 5 kill points × 3 operating systems × 2 hosts, repeated until each cell has at least 10 observations | No observation shows a job absent from the store, and each job's recorded state matches the one the kill point implies |
| Tool calls repeated after a crash | The same population as above, restricted to kills falling between the call and the result record | At least 10 observations per operating system | In no observation does the platform hold the intended effect twice; the missing result is appended from the readback rather than the call being made again |
| Store integrity after an abrupt termination | The store file as it stands after each termination in the population above | Every terminated run | The store's own integrity report names no damage, in every case |
| Modification or deletion of a record | Attempts issued against a populated store, from the product's runtime and from at least one unrelated language runtime opening the same file | 2 runtimes × 2 operations, repeated on each operating system | Every attempt is refused by the store, and the record is unchanged afterwards |
| Store size at 20 and 50 jobs per day over 90 days | A store populated to the two usage profiles, with records of the size distribution the spike recorded | 1,800 jobs / 5,400 records and 4,500 jobs / 13,500 records | Size at or below the stated bound, compared against the recorded baseline in `spikes/SP-12-sqlite-ledger/evidence/storage-benchmark.json`; exceeding the baseline is a failure, not a new baseline |
| Average size per record | The same populated stores | All records in both profiles | Mean within 10 % of 2.4 KB |
| One job's detail read, median and 99th percentile | Reads of a single job's records against the larger populated store | At least 1,000 reads per operating system | Median at or below 0.5 ms and 99th percentile at or below 1 ms |
| Recent-jobs listing with the descending-time index | The larger populated store, read with and without the index present | At least 100 listings each | The indexed listing completes under 1 ms and is at least an order of magnitude faster than the unindexed one |
| Write-ahead companion file after checkpoint | The companion file observed after a checkpoint on each operating system | Every checkpoint in the crash population | Size returns to zero |
| Store binding usable without a compiler toolchain | Machines carrying no C++ build tools and no separate build-time language runtime, one per supported operating system | 1 per operating system, repeated after each framework upgrade | Obtaining, preparing and starting the product all succeed, and the same prebuilt component loads under both the plain runtime and the application framework with no rebuild |
| Packaged application loads its native component and opens its store | The packaged artifact for each operating system | 1 per operating system per release candidate | The application starts, loads the component from a file on disk, and reads a record back |
| Reconciliation conclusions | Interrupted calls spanning the eight declaration-and-outcome combinations: readback matching the before state, matching the intended state, matching neither, target gone, read refused, platform unreachable, declaration absent, declaration malformed | 8 combinations, at least 5 observations each | Each combination yields the conclusion `job/contracts/tool-reconciliation@0.1.0` states for it, and no `undetermined` or `unreachable` conclusion is recorded as `performed` or `not_performed` |
| Removal and retention behaviour | Removals covering expiry, deletion at the user's request, interruption part-way through, and an attempt to use removal to rewrite a record | 4 cases per operating system | The announcement precedes the removal and survives it, the range is wholly present or wholly gone, the guard is refusing afterwards, and the rewrite attempt is refused |
| Shape-change behaviour | Stores built at an earlier shape and advanced: an additive step, a restructuring step, an attempt to reinterpret history, and an interrupted step | 4 cases | History unchanged in content, no backfilled values, the reinterpretation refused, and the interrupted store wholly at one shape |
| Configuration file encoding | Every machine-readable configuration file the product ships | All such files | No byte-order mark present — RISK-047 |
| Duration of the local classification pass | Not measurable yet: no populated-store measurement of the whole pass exists. See Open Measurement Gaps | — | — |

## Contract Conformance

This change freezes three machine-readable contracts. Each is judged by conditions observable against a store
built from the files, never by running a validator over them.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/ledger-store.sql` | A modification or a deletion of an action record is refused by the store itself, from the product's own runtime and from an unrelated one opening the same file | `specs/ledger/spec.md`, the requirement that records leave the store only whole; INV-LG-06 |
| `contracts/ledger-store.sql` | An intent carrying no correlation identifier, a decision carrying one, a second intent or second result claiming an identifier already used, a repeated position within a job, and a reused device sequence position are each refused at append time rather than accepted and corrected later | `specs/ledger/spec.md`, the requirement that one tool call is two records joined by a correlation identifier; INV-LG-02, INV-LG-04, INV-LG-09 |
| `contracts/ledger-store.sql` | The unresolved-intent set is derived from the records present: reading it twice with no append in between yields the same set and leaves nothing written | `specs/ledger/spec.md`, the requirement that tool calls whose outcome was never recorded are listable; INV-PLT-01 |
| `contracts/ledger-store.sql` | A store built from an earlier shape and advanced one step holds every record it held before, with the same content, and carries no backfilled value for a field the step added | `specs/ledger/spec.md`, the requirement that a change to the store's shape leaves existing records as they were written; INV-LG-08 |
| `contracts/ledger-record.schema.json` | Every record the product appends satisfies the file; every record it refuses is refused either for a condition the file expresses or for one of the three cross-record rules the contract names, and never for an unstated reason | `ledger/contracts/ledger-record@0.1.0`, Error Matrix |
| `contracts/ledger-record.schema.json` | The record shape the file describes and the columns in `contracts/ledger-store.sql` name the same fields: a record that satisfies the file can be appended, and a column exists for nothing the file does not describe | `specs/ledger/spec.md`; `model.md` §Physical Storage & Data Schema |
| `contracts/tool-reconciliation.schema.json` | A `readback` declaration is accepted only with `read_operation` and a `comparison` containing both `path` and `against`, while `none` is accepted only without `read_operation` or `comparison`; every malformed declaration falls back to `none` and never authorises replay of the interrupted external call | `job/contracts/tool-reconciliation@0.1.0`, Schema / Surface and Error Matrix; `specs/job/spec.md`, the no-repeated-call recovery requirement |

## Combination Matrix

This change belongs to the `trust-chain` cluster (`ledger`, `undo`, `approval`) and participates in
`account-sync` (`sync`, `ledger`, `backend`, `platform`). The combinations that must be exercised rather than
reasoned about:

| Dimension | Values | Why it must be combined rather than sampled |
| --- | --- | --- |
| Operating system and file system | Windows / NTFS, macOS / APFS, Linux / ext4 | The measured differences are exactly in the behaviours the store depends on: how a killed process releases its file handles, which durability call is made, and whether an open file can be replaced. macOS is the unmeasured one |
| Kill point in a tool call's life | Before approval, after approval and before the intent, after the intent and before the call, after the call and before the result, after the result and before the job state | Each leaves a different recorded state, and the third and fourth are the pair the whole two-record model exists to distinguish |
| Process host | The plain runtime, and the application framework | The framework loads native components differently and was the environment in which the superseded binding generation failed outright |
| Packaging | Running from source, and running from the packaged application | The packaged case is the only one in which the native component must be a file outside the archive |
| Reconciliation declaration | `readback`, `none`, absent, malformed | These are the four ways recovery can be told what a tool can say about itself, and the fallback direction matters most where the declaration is missing |
| Connector availability at recovery | Present, removed since the crash | An interrupted call from a connector that is gone must still be recoverable, because the intent carries its own declaration |
| Cluster interaction | A crash during a job that is mid-undo; a crash during an approval; a crash while a record was replicating | `undo` reads records to build a compensating sequence, `approval` writes decision records, and `sync` carries records off the device. Each reads or writes the store at a moment this change changes |

## Regression Scope

All scenarios of the capabilities below are rerun, not only the deltas — this change alters the store every one
of them reads or writes.

- `ledger` — MODIFIED and extended by this change; owner of both record contracts.
- `job` — MODIFIED: two new lifecycle states and a redefined crash requirement.
- `platform` — extended: the start sequence, native packaging and the store binding.
- `undo` — consumer of `ledger/contracts/ledger-record@0.1.0`. Every undo scenario depends on snapshots and
  compensating actions being present and whole; a change in how they are recorded reaches all of them.
- `approval` — consumer of the same contract: every decision is a record, and the gate's behaviour under a
  failed ledger write is the fail-closed path.
- `connector` — supplies the reconciliation declaration this change reads, and the read operation it calls.
- `sync` — carries these records to the account; append-and-reconcile and the ordering fields are assumed by
  this change and owned there.
- `uix` — rebuilds the blocking card queue from job state and the ledger after a restart, and fixes the card
  types a `waiting_user_confirmation` job must be presentable as.
- `app` — renders the job detail from records, including the distinction between an observed and a reconciled
  outcome.

## Manual Checks

- Open the store file with a database tool that is not the product, attempt a modification and a deletion, and
  read the refusal — owner: implementer, once per supported operating system. Automatable, but worth doing by
  hand once, because this is the guarantee the user is being asked to trust.
- Clean-machine interruption and relaunch observation: verifying on a system without build toolchains that an abrupt process termination during an active tool call leaves the store uncorrupted, does not repeat external effects upon relaunch, and accurately presents interrupted work status to the user — owner: implementer.
- Read the recovery messages as a user would: the wording of the confirmation card for an operation that could
  not be read back, and what a job in `recovering` says about itself — owner: decision-maker, since this is the
  moment the product admits it is unsure, and the tone of that admission is a product decision.
- Confirm that a job detail page distinguishes an outcome the product observed from one it inferred — owner:
  decision-maker.

## Open Measurement Gaps

Quantities this specification asserts that no evidence yet supports, and what would close each.

| Gap | What is asserted without evidence | What would close it | Owner |
| --- | --- | --- | --- |
| macOS / APFS behaviour | Every crash, append-only, packaging and binding figure above is carried over to macOS from measurements taken on Linux and Windows only | The same crash, append-only and packaging populations observed on macOS 13 or later with APFS. Until then the figures stay labelled unverified for that environment, and the decision-maker either accepts that or holds the change | implementer; acceptance is the decision-maker's |
| Duration of the local classification pass before the first window | `specs/platform/spec.md` requires the pass to complete before the first window appears, but no bound is stated because none was measured. The component query is measured at 0.13–0.25 ms; the whole pass against a full store is not | Measuring the pass against stores at both usage profiles, on each operating system, and recording the result as an observation. It becomes a threshold only once measured — Q-6 in `clarifications.md` | implementer |
| Account-wide store size across devices | Nothing is asserted here on purpose. A store replicated across several devices may exceed the single-device figures above, and this change states no bound for it | Measurement owned by `req-022-account-sync` and its spike; RISK-069 | `req-022-account-sync` |
| Behaviour of the store under a file system this project has not named | The figures assume ext4, NTFS and APFS. A network or synchronised file system is neither measured nor excluded by a requirement | Either a measurement, or a requirement that names the unsupported case and how the product behaves when it finds itself on one | decision-maker |

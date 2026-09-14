# Verification: req-015-concurrency-coordinator

The scenarios in the delta specs are the test cases; this file records what they cannot express — the numbers
and their sources, the suites that produce them, the combinations that must be exercised, and the scope that is
rerun rather than only the delta.

Two boundaries govern everything below and are stated up front.

**One platform, one workload.** Every figure in this file was measured against the platform used by
`spikes/SP-15-concurrency/`, on one workspace, with a synthetic workload of three to five requests per job. It
is VERIFIED for that platform and UNVERIFIED for any other. Nothing here states a cross-platform threshold, and
the concurrency and pacing values are declared per connector precisely so that a second platform's figures can
differ without this file being wrong.

**Measured property, unmeasured refinements.** The exclusive span and the round-robin dispatch were run and
measured. The dispatch weighting and the floor guaranteeing background jobs a share were recommended by the same
report and never run. They appear below as unverified defaults and not as thresholds, per the constitution's
Evidence Discipline and the decision recorded as Q-5 in `clarifications.md`.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "Every platform call passes through one resource coordinator", ensuring two agents call the same platform at the same time holds without contradiction or unhandled failure | Requirement "Every platform call passes through one resource coordinator"; Scenario "Two agents call the same platform at the same time"; Scenario "A component attempts to reach a platform directly" | specs/connector/spec.md |
| AC-2 | The product fulfills requirement "A resource is named by a normalised key derived from the call's own arguments", ensuring the same object is named in two forms holds without contradiction or unhandled failure | Requirement "A resource is named by a normalised key derived from the call's own arguments"; Scenario "The same object is named in two forms"; Scenario "Two authorisations reach one object" | specs/connector/spec.md |
| AC-3 | The product fulfills requirement "A write tool declares the resources it touches, or its manifest is refused", ensuring a writing tool declares no resource holds without contradiction or unhandled failure | Requirement "A write tool declares the resources it touches, or its manifest is refused"; Scenario "A writing tool declares no resource"; Scenario "The declaration names a parameter that does not exist" | specs/connector/spec.md |
| AC-4 | The product fulfills requirement "Requests under one authorisation are dispatched fairly between jobs", ensuring a short job arrives behind a long one holds without contradiction or unhandled failure | Requirement "Requests under one authorisation are dispatched fairly between jobs"; Scenario "A short job arrives behind a long one"; Scenario "A stream of short jobs arrives while a bulk job runs" | specs/connector/spec.md |
| AC-5 | The product fulfills requirement "A call obtains every resource it declared at once, in a fixed order", ensuring two jobs need the same two resources in opposite orders holds without contradiction or unhandled failure | Requirement "A call obtains every resource it declared at once, in a fixed order"; Scenario "Two jobs need the same two resources in opposite orders"; Scenario "A call discovers a resource it did not declare" | specs/connector/spec.md |
| AC-6 | The product fulfills requirement "A call that cannot obtain its resources within the wait limit is refused rather than made", ensuring the holder finishes inside the limit holds without contradiction or unhandled failure | Requirement "A call that cannot obtain its resources within the wait limit is refused rather than made"; Scenario "The holder finishes inside the limit"; Scenario "The limit elapses" | specs/connector/spec.md |
| AC-7 | The product fulfills requirement "Jobs run in parallel without shared context", ensuring second command during a running job holds without contradiction or unhandled failure | Requirement "Jobs run in parallel without shared context"; Scenario "Second command during a running job"; Scenario "One job fails without affecting the other" | specs/job/spec.md |
| AC-8 | The product fulfills requirement "Transient failures are retried under a bounded policy", ensuring rate limit clears on the second attempt holds without contradiction or unhandled failure | Requirement "Transient failures are retried under a bounded policy"; Scenario "Rate limit clears on the second attempt"; Scenario "Retries are exhausted" | specs/job/spec.md |
| AC-9 | The product fulfills requirement "A recorded before state is captured under exclusive access to its target", ensuring two jobs write to one object holds without contradiction or unhandled failure | Requirement "A recorded before state is captured under exclusive access to its target"; Scenario "Two jobs write to one object"; Scenario "Undoing the second job preserves the first" | specs/ledger/spec.md |
| AC-10 | The product fulfills requirement "A call whose recorded before state no longer matches its target does not execute", ensuring the target is unchanged when the decision arrives holds without contradiction or unhandled failure | Requirement "A call whose recorded before state no longer matches its target does not execute"; Scenario "The target is unchanged when the decision arrives"; Scenario "The target changed while the user was deciding" | specs/ledger/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| A second job's recorded before state, when it writes to an object another job is writing | Equal to what the first job left, every time | `spikes/SP-15-concurrency/REPORT.md` §1 Q2 — measured with and without the exclusive span; `snapshotAccurate` true with it, and `corruptedJobA` true without it | verified (measured platform) |
| Work of a preceding job surviving an undo of the following job on the same object | Preserved, every time | `spikes/SP-15-concurrency/REPORT.md` §1 Q2 with `spikes/SP-15-concurrency/evidence/q2-dirty-snapshot.json` and records 3–6 of `evidence/sp15-ledger.db` | verified (measured platform) |
| Interactive job's queue wait behind a bulk job of 15 requests | ≤ 500 ms; measured 252 ms, against 4,251 ms first-in-first-out | `spikes/SP-15-concurrency/REPORT.md` §1 Q3 with `evidence/q3-fair-queue-benchmark.json` | verified (measured platform) |
| Interactive job's total completion in the same condition | ≤ 1 s; measured 374 ms | `spikes/SP-15-concurrency/REPORT.md` §1 Q3 | verified (measured platform) |
| Second interactive job's queue wait in the same condition | ≤ 1 s; measured 516 ms, against 4,515 ms first-in-first-out | `spikes/SP-15-concurrency/REPORT.md` §1 Q3 | verified (measured platform) |
| Cost of fairness to the bulk job it interleaves with | ≤ 25 percent; measured about 16 percent (4,121 ms to 4,787 ms) | `spikes/SP-15-concurrency/REPORT.md` §1 Q3 | verified (measured platform) |
| Completion of three concurrent jobs on one account | ≤ 2 s; measured 1,725 ms, longest queue wait 1,327 ms, no refusal for volume | `spikes/SP-15-concurrency/REPORT.md` §1 Q4 with `evidence/q4-concurrency-scaling.json` | verified (measured platform) |
| Completion of five concurrent jobs on one account | ≤ 4 s; measured 3,620 ms, longest queue wait 3,332 ms, no refusal for volume | `spikes/SP-15-concurrency/REPORT.md` §1 Q4 | verified (measured platform) |
| Refusals for volume at or below the default limit of four jobs | 0 | `spikes/SP-15-concurrency/REPORT.md` §1 Q4 — zero refusals at one, three and five jobs; about five percent at eight | verified (measured platform) |
| Concurrency at which refusals for volume begin | 8 jobs, about 5 percent; above 15 percent at 10 | `spikes/SP-15-concurrency/REPORT.md` §1 Q4 | verified (measured platform) |
| Cost of one refusal for volume | 40–49 s of cooldown for the whole authorisation | `spikes/SP-15-concurrency/REPORT.md` §1 Q4, and `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5 | verified (measured platform) |
| Wait limit for a held resource | 15,000 ms default | `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — specified by the report alongside the distinct error code it exists to produce; chosen above the 3,332 ms longest measured wait at five jobs with margin, rather than measured as an optimum | verified as specified; the margin is a judgement, not a measurement |
| Deadlock occurrences under opposing acquisition orders across two connectors | 0 | New suite; the risk is VERIFIED as a risk in `spikes/SP-15-concurrency/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-049), and the mitigation is not yet run | unverified — the suite is a task of this change |
| Calls executed after their recorded before state stopped matching the target | 0 | New suite, derived from `clarifications.md` Q-1; the underlying failure mode is the one measured in §1 Q2 | unverified — the suite is a task of this change |
| Dispatch share of the interactive class against the background class | **No threshold.** Default 3 : 1, declared and provisional | `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 2 — a recommendation; the benchmark ran plain round-robin | unverified — deliberately not converted into a threshold |
| Least share of dispatches the background class receives while both classes wait | **No threshold.** Default 0.2, declared and provisional | `spikes/SP-15-concurrency/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-050) — a mitigation proposal, never run | unverified — deliberately not converted into a threshold |
| Memory held by leases, queues and slots at the default limit | **No threshold.** Bounded structurally, not numerically | Nothing measured it; `model.md` states the structural bounds and declines to invent a figure | unverified |
| Queue depth under a realistic bulk command | **No threshold.** Open question Q-7 | The benchmark used a 15-request bulk job, which is a synthetic size rather than an observed one | unverified |

Four entries above state no number on purpose. Under the constitution's Evidence Discipline an unmeasured
quantity cannot be a threshold, and inventing one would make this file assert something no measurement supports.

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| A second job's recorded before state, when it writes to an object another job is writing — Equal to what the first job left, every time | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q2 — measured with and without the exclusive span; `snapshotAccurate` true with it, and `corruptedJobA` true without it | 50 observations across target conditions | Observable behavior confirms a second job's recorded before state, when it writes to an object another job is writing complies with threshold Equal to what the first job left, every time |
| Work of a preceding job surviving an undo of the following job on the same object — Preserved, every time | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q2 with `spikes/SP-15-concurrency/evidence/q2-dirty-snapshot.json` and records 3–6 of `evidence/sp15-ledger.db` | 50 observations across target conditions | Observable behavior confirms work of a preceding job surviving an undo of the following job on the same object complies with threshold Preserved, every time |
| Interactive job's queue wait behind a bulk job of 15 requests — ≤ 500 ms; measured 252 ms, against 4,251 ms first-in-first-out | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q3 with `evidence/q3-fair-queue-benchmark.json` | 50 observations across target conditions | Observable behavior confirms interactive job's queue wait behind a bulk job of 15 requests complies with threshold ≤ 500 ms; measured 252 ms, against 4,251 ms first-in-first-out |
| Interactive job's total completion in the same condition — ≤ 1 s; measured 374 ms | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q3 | 50 observations across target conditions | Observable behavior confirms interactive job's total completion in the same condition complies with threshold ≤ 1 s; measured 374 ms |
| Second interactive job's queue wait in the same condition — ≤ 1 s; measured 516 ms, against 4,515 ms first-in-first-out | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q3 | 50 observations across target conditions | Observable behavior confirms second interactive job's queue wait in the same condition complies with threshold ≤ 1 s; measured 516 ms, against 4,515 ms first-in-first-out |
| Cost of fairness to the bulk job it interleaves with — ≤ 25 percent; measured about 16 percent (4,121 ms to 4,787 ms) | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q3 | 50 observations across target conditions | Observable behavior confirms cost of fairness to the bulk job it interleaves with complies with threshold ≤ 25 percent; measured about 16 percent (4,121 ms to 4,787 ms) |
| Completion of three concurrent jobs on one account — ≤ 2 s; measured 1,725 ms, longest queue wait 1,327 ms, no refusal for volume | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q4 with `evidence/q4-concurrency-scaling.json` | 50 observations across target conditions | Observable behavior confirms completion of three concurrent jobs on one account complies with threshold ≤ 2 s; measured 1,725 ms, longest queue wait 1,327 ms, no refusal for volume |
| Completion of five concurrent jobs on one account — ≤ 4 s; measured 3,620 ms, longest queue wait 3,332 ms, no refusal for volume | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q4 | 50 observations across target conditions | Observable behavior confirms completion of five concurrent jobs on one account complies with threshold ≤ 4 s; measured 3,620 ms, longest queue wait 3,332 ms, no refusal for volume |
| Refusals for volume at or below the default limit of four jobs — 0 | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q4 — zero refusals at one, three and five jobs; about five percent at eight | 50 observations across target conditions | Observable behavior confirms refusals for volume at or below the default limit of four jobs complies with threshold 0 |
| Concurrency at which refusals for volume begin — 8 jobs, about 5 percent; above 15 percent at 10 | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q4 | 50 observations across target conditions | Observable behavior confirms concurrency at which refusals for volume begin complies with threshold 8 jobs, about 5 percent; above 15 percent at 10 |
| Cost of one refusal for volume — 40–49 s of cooldown for the whole authorisation | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md` §1 Q4, and `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q5 | 50 observations across target conditions | Observable behavior confirms cost of one refusal for volume complies with threshold 40–49 s of cooldown for the whole authorisation |
| Wait limit for a held resource — 15,000 ms default | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — specified by the report alongside the distinct error code it exists to produce; chosen above the 3,332 ms longest measured wait at five jobs with margin, rather than measured as an optimum | 50 observations across target conditions | Observable behavior confirms wait limit for a held resource complies with threshold 15,000 ms default |
| Deadlock occurrences under opposing acquisition orders across two connectors — 0 | Scenarios evaluated under representative workloads citing New suite; the risk is VERIFIED as a risk in `spikes/SP-15-concurrency/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-049), and the mitigation is not yet run | 50 observations across target conditions | Observable behavior confirms deadlock occurrences under opposing acquisition orders across two connectors complies with threshold 0 |
| Calls executed after their recorded before state stopped matching the target — 0 | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms calls executed after their recorded before state stopped matching the target complies with threshold 0 |
| Dispatch share of the interactive class against the background class — **No threshold.** Default 3 : 1, declared and provisional | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 2 — a recommendation; the benchmark ran plain round-robin | 50 observations across target conditions | Observable behavior confirms dispatch share of the interactive class against the background class complies with threshold **No threshold.** Default 3 : 1, declared and provisional |
| Least share of dispatches the background class receives while both classes wait — **No threshold.** Default 0.2, declared and provisional | Scenarios evaluated under representative workloads citing `spikes/SP-15-concurrency/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-050) — a mitigation proposal, never run | 50 observations across target conditions | Observable behavior confirms least share of dispatches the background class receives while both classes wait complies with threshold **No threshold.** Default 0.2, declared and provisional |
| Memory held by leases, queues and slots at the default limit — **No threshold.** Bounded structurally, not numerically | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms memory held by leases, queues and slots at the default limit complies with threshold **No threshold.** Bounded structurally, not numerically |
| Queue depth under a realistic bulk command — **No threshold.** Open question Q-7 | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms queue depth under a realistic bulk command complies with threshold **No threshold.** Open question Q-7 |

## Contract Conformance

This change freezes three machine-readable contract files. Each is judged by a condition anyone can observe
against a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/connector-manifest.schema.json` | A manifest whose write tool declares no resources yields no tool at all, and the refusal names the tool at registration; every other connector in the same build keeps loading. A read tool carrying a coordination declaration is refused for the same reason in the other direction | `specs/connector/spec.md`, the requirement that a write tool declares the resources it touches or its manifest is refused; the coordination declaration conformance suite |
| `contracts/connector-manifest.schema.json` | A manifest valid at `1.1.0` and carrying no write tool loads unchanged under this version, and a connector policy figure outside the measured bounds is clamped with the clamp reported to its author rather than costing the product the platform | `contracts/connector-manifest.md` §Compatibility; `contracts/coordination-declaration.md` §Semantics |
| `contracts/coordination-declaration.schema.json` | Every key a call acquires is derived from the declared argument paths of that call, and from nothing else: no key is inferred from a platform, a tool name or a response, and a declared path absent from a call's arguments refuses the call before anything is held or written | `specs/connector/spec.md`, the requirement that a resource is named by a normalised key derived from the call's own arguments; INV-CN-16 |
| `contracts/coordination-declaration.schema.json` | A declaration naming fewer resources than the call changes satisfies the file completely: the coordinator then holds a lease over less than the call touches, and nothing at runtime detects it. The condition is judged by reviewing each connector's declarations against its platform's write semantics, and the key normalisation suite is what makes the omission visible | `contracts/coordination-declaration.md` §Machine-Readable Artifacts; the key normalisation suite |
| `contracts/coordination-declaration.schema.json` | One object addressed in any spelling the declared normalisation accepts yields exactly one key, and two distinct objects never collapse into one — the adversarial identifier set produces no collision | `specs/connector/spec.md`; the key normalisation suite |
| `contracts/resource-coordinator.schema.json` | No mutating operation is reachable from a window process: the file describes the inspect picture and nothing else, and a window can obtain no handle by which a lease it does not hold could be released | `specs/connector/spec.md`, the requirement that every platform call passes through one resource coordinator; the boundary reachability suite |
| `contracts/resource-coordinator.schema.json` | A wait is explainable rather than merely visible: while one job waits, the picture names the keys it is waiting for and the job holding each, and a waiting call holds none of its own — a third job takes a free resource while the second waits | `specs/connector/spec.md`, the requirement that a call obtains every resource it declared at once, in a fixed order; INV-CN-17 |
| `contracts/resource-coordinator.schema.json` | Every coordinator refusal reaching a job carries a code the file admits and never a connector error code, so a contended object is never presented to the user as the platform having failed; the four conditions the file marks never-retryable are not retried | `specs/connector/spec.md`, the requirement that a call that cannot obtain its resources within the wait limit is refused rather than made; INV-CN-20 |

## Combination Matrix

This change belongs to the `integration` cluster (`connector`, `backend`, `sync`) and acts on the `trust-chain`
cluster (`ledger`, `undo`, `approval`) without belonging to it. The combinations that must be exercised rather
than reasoned about:

| Dimension | Values | Why it must be combined rather than sampled |
| --- | --- | --- |
| Number of jobs on one connector account | 1, 3, 5, 8 | The measured curve is not linear in the way that matters: latency degrades gently and refusals appear suddenly, and the limit is chosen from where the second happens |
| Job class mix | All interactive, all background, mixed with the reserved slot contended | The reserved slot only does anything when every other slot is taken, which is the case a uniform load never produces |
| Resource overlap | Disjoint objects, one shared object, two shared objects in opposing orders | Disjoint is the case that must stay fast, one shared is the correctness case, two opposing is the deadlock case |
| Verdict | Allow, refuse, hold and approve, hold and deny, hold and expire | The bracket takes a different path through each, and two of them — hold and approve, hold and deny — are the paths where it is released and re-established |
| State during an approval wait | Unchanged, changed by another job, changed and reverted, target removed | This is where the re-comparison earns its existence, and where a lazy implementation would simply execute |
| Connector count in one job | One connector, two connectors | A single-connector job can never deadlock; the cross-connector case is the entire content of RISK-049 |
| Platform response | Accepted, refused for volume with a stated delay, refused with none, unreachable | The pacing budget pauses for an authorisation rather than for a job, which only shows when several jobs are queued behind one refusal |
| Interruption | Process killed while a lease is held, while a call is queued, while a bracket is suspended | Each must leave the coordinator holding nothing at the next start and the ledger classifying the call exactly as it already does |
| Cluster interaction | An undo job running while an ordinary job writes the same object; an approval on an object another job is compensating | Undo is the reader of the before states this change protects, and the two clusters meet on exactly these objects |

## Regression Scope

All scenarios of the capabilities below are rerun, not only the deltas — this change inserts a stage into the
path every one of them depends on.

- `connector` — MODIFIED and extended by this change; owner of both new contracts and of the pacing requirements
  the dispatcher must keep satisfying.
- `job` — MODIFIED: the concurrency limit and the classification of a coordinator refusal.
- `ledger` — extended: the truth of a recorded before state at capture and at execution.
- `approval` — consumer of the bracket's suspension path. Every held-call scenario now passes through a release
  and a re-establishment, and the fail-closed behaviours must be unchanged by it.
- `agent` — owner of `tool-wrapping@0.1.0`, whose four-step order now runs inside the bracket. Its bypass suite
  must still pass unchanged, because none of its guarantees may be weakened by the insertion.
- `undo` — consumer of the before states this change protects; the whole point of the change is visible only in
  undo's outcomes.
- `app` and `uix` — a job may now be `queued` for a reason worth explaining, and a call may be refused because
  its object changed while the user was deciding.
- `sync` — unchanged by this change and rerun to demonstrate it: nothing the coordinator holds replicates, and
  no replicated record's ordering fields are touched.

## Manual Checks

- Read what the product says while a job waits for an object another job is changing, and while a job is
  `queued` because the account is at its limit — owner: decision-maker. These are the two new ways the product
  can appear to be doing nothing, and the wording is a product decision rather than an implementation one.
- Read the refusal a user sees when their approval is not executed because the object changed. It must say what
  changed and offer the obvious next step — owner: decision-maker. This is the one user-visible cost of the
  design, recorded in `design.md` Complexity Tracking for exactly this reason.
- Exercise a bulk command against a real account with a second command typed in the middle of it, and judge
  whether the second felt immediate — owner: implementer. The benchmark measures milliseconds; a person judges
  whether the product feels blocked.
- Confirm by inspection that no mutating coordinator operation is exposed to a window process — owner:
  implementer, once, at the point the boundary is first wired. Automatable afterwards, and worth doing by hand
  once, because it is the whole security argument for the component.

## Open Measurement Gaps

- **Deadlock occurrences under opposing acquisition orders across two connectors.** Stated threshold "0" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Calls executed after their recorded before state stopped matching the target.** Stated threshold "0" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Dispatch share of the interactive class against the background class.** Stated threshold "**No threshold.** Default 3 : 1, declared and provisional" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Least share of dispatches the background class receives while both classes wait.** Stated threshold "**No threshold.** Default 0.2, declared and provisional" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Memory held by leases, queues and slots at the default limit.** Stated threshold "**No threshold.** Bounded structurally, not numerically" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Queue depth under a realistic bulk command.** Stated threshold "**No threshold.** Open question Q-7" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

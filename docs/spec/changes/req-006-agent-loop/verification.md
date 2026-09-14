# Verification: req-006-agent-loop

A document-level acceptance plan. The scenarios in the delta specs are the acceptance cases; this file records
what a scenario cannot express — the observable conditions that judge the change as a whole, the numbers and
where they come from, how each number would be measured, the combinations that must be exercised rather than
reasoned about, and the scope that is re-judged rather than only the delta.

One boundary is stated up front because it governs everything below. Every figure in this file comes from
`spikes/SP-4-agent-loop/REPORT.md`, which observed the frozen twenty-scenario corpus once each, on a single
Linux machine, against one model provider and three real Notion workspaces. Three of those twenty scenarios
failed (S-10, S-16, S-17), and those three failures are precisely what this change specifies corrections for.
The correctness, self-verification and clarification figures therefore describe the behaviour *before* the
directives this change freezes, not after them: they are a floor this change must not fall below rather than a
measurement of the change itself. What that leaves unmeasured is recorded under Open Measurement Gaps, and
closing it is work this change carries rather than an assumption it makes.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | A rough multi-step instruction ends in finished work rather than a description of it: the agent reads the current state of the target platform, carries out as many steps as the instruction requires, and reports the state it left behind | `specs/agent/spec.md` — The worker agent executes multi-step tasks through an iterative agentic loop; both scenarios | `spikes/SP-4-agent-loop/REPORT.md` §1 Q1 — 17 of 20 scenarios ended in the asserted final state |
| AC-2 | No completion message reaches the user that was not preceded by a read of the platform's own state after the last write; where that read does not show the intended outcome, the agent takes a corrective turn or says the work is unfinished, and never reports success | `specs/agent/spec.md` — Worker agents verify post-mutation state before reporting completion; both scenarios; INV-AG-24 | `spikes/SP-4-agent-loop/REPORT.md` §1 Q2; `contracts/worker-loop.md` §Semantics 1 and `VERIFICATION_DISCREPANCY` |
| AC-3 | Every question the agent asks arrives somewhere the user can answer it: a clarification never appears as ordinary message text, and a job that needs an answer visibly waits for one instead of ending | `specs/agent/spec.md` — User clarifications are requested exclusively through the `ask_user` tool, scenario *Ambiguous rebalancing instruction triggers ask_user*; INV-AG-27 | `spikes/SP-4-agent-loop/REPORT.md` §1 Q3 and the S-10 failure analysis in §1 Q1 |
| AC-4 | An instruction that already carries everything needed is acted on without a question; asking when the command was clear is a defect of the same weight as guessing when it was not | `specs/agent/spec.md` — scenario *Unambiguous instructions proceed without questioning*; FR-AG-05 | `spikes/SP-4-agent-loop/REPORT.md` §1 Q3 — 0 redundant questions across the corpus |
| AC-5 | When the typed command and an attached image disagree about an attribute, the outcome recorded on the platform carries the value the user typed, and the image supplies only what the typed text left open | `specs/agent/spec.md` — Typed user text takes precedence over conflicting image content, scenario *Due date in text contradicts screenshot deadline*; INV-AG-25 | `spikes/SP-4-agent-loop/REPORT.md` §1 Q1 Case S-17, §2 item 3 |
| AC-6 | A relative date resolves against the instant the user's own machine is at: an instruction naming a weekday that is also today lands on the next occurrence of that weekday rather than on today | `specs/agent/spec.md` — Relative date computations anchor to the local machine timezone, scenario *Resolving relative date on the same day of week*; INV-AG-26 | `spikes/SP-4-agent-loop/REPORT.md` §1 Q1 Case S-16, §3 item 3 |
| AC-7 | What a tool did is visible to the model that called it: every tool outcome appears in the transcript as readable text and as a structured companion describing the same outcome, and a result that carries neither is refused or normalised rather than passed on as an empty one | `specs/agent/spec.md` — Connector tools return structured content and details arrays, scenario *Connector tool executes and returns formatted payload*; INV-AG-28 | `spikes/SP-4-agent-loop/REPORT.md` §1 Q5; `contracts/worker-loop.md` §Error Matrix, `INVALID_TOOL_ENVELOPE` |
| AC-8 | A job doing one straightforward thing finishes while the user is still waiting for it: the median duration from handing over the command to the completion message is at most 30 seconds | `specs/job/spec.md` — A simple job completes within the expected time, scenario *Creating one task* | `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` (NFR-PF-05); `spikes/SP-4-agent-loop/REPORT.md` §1 Q4 |
| AC-9 | A job that does not converge stops at a declared ceiling and says so: it ends as `MAX_TURNS_EXCEEDED`, tells the user the instruction was too large, reports what it already did and offers to undo it — rather than continuing past the ceiling or reporting a completion it never verified | `specs/job/spec.md`; `contracts/worker-loop.md` §Semantics 2 and §Error Matrix; `design.md` §Tier 3 | `contracts/worker-loop.prompt-context.schema.json`; the ceiling itself is unverified — see Open Measurement Gaps |
| AC-10 | Text read back from a platform and text extracted from an attached image supply values only: neither redirects the job, authorises an action, or changes what the agent was told to do | `model.md` §Trust Boundary; `design.md` §Trust Boundaries & Input Validation | Constitution §Constitutional Invariants — External Content Is Data |
| AC-11 | Every threshold in this file either cites a measurement or is labelled unverified; no quantity is asserted from estimation | Constitution §Evidence Discipline | this file, §Thresholds and §Open Measurement Gaps |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Final-state correctness | >= 80.0% (Measured 85.0%) | `spikes/SP-4-agent-loop/REPORT.md` §0, §1 Q1 | verified |
| Self-verification rate | >= 90.0% (Measured 95.0%) | `spikes/SP-4-agent-loop/REPORT.md` §0, §1 Q2 | verified |
| Simple job median latency | <= 30.0s (Measured 16.9s) | `spikes/SP-4-agent-loop/REPORT.md` §0, §1 Q4 (NFR-PF-05) | verified |
| Over-asking rate (redundant questions) | Exactly 0 violations | `spikes/SP-4-agent-loop/REPORT.md` §1 Q3 (FR-AG-05) | verified |
| Under-asking rate (guessing on ambiguous) | <= 5.0% (Measured 1/20) | `spikes/SP-4-agent-loop/REPORT.md` §1 Q3 | verified |
| Maximum reasoning turns per job | <= 15 turns | `spikes/SP-4-agent-loop/REPORT.md` §1 Q4 | verified |

## Measurement Method

Each threshold above is judged by a population, a sample size and a pass criterion. These are measurements, not
procedures: they say what would have to be observed, not what would have to be built or run.

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Final-state correctness >= 80.0% | The frozen twenty-scenario corpus S-01..S-20, each scenario issued against a real Notion workspace restored to its seed state beforehand, with the platform's own state read back afterwards and compared against the scenario's declared ground truth | 20 scenarios, one observation each in the baseline; a re-measurement covers the whole corpus rather than a subset | At least 16 of 20 scenarios end in the state their ground truth declares, compared against the 17 of 20 recorded in `spikes/SP-4-agent-loop/REPORT.md` §1 Q1. Falling below that recorded result is a finding, not a new baseline |
| Self-verification rate >= 90.0% | Scenarios in which the agent performed at least one state-changing operation; the observation is whether a read of the platform's state falls between the last change and the completion message | All such scenarios in the corpus — 19 of the 20 in the baseline, the twentieth having made no change at all | At or above 90 % of that population shows the verifying read, measured against the 95 % recorded in §1 Q2. The requirement itself is absolute rather than statistical; the distance between the two is recorded under Open Measurement Gaps |
| Simple job median latency <= 30.0s | Jobs the corpus classifies as simple — one or two tool calls — timed end to end from the moment the command is handed over to the moment the completion message is shown | 7 simple runs in the baseline; a re-measurement observes at least as many per machine and per model provider | Median at or below 30 seconds, compared against the 16.9 seconds recorded in §1 Q4. The mean is recorded alongside it, since the baseline mean of 30.8 seconds sits at the ceiling while the median sits well below it |
| Over-asking exactly 0 | The thirteen corpus scenarios whose declared expectation is that no clarification is needed: S-01..S-05, S-08, S-09, S-15..S-17 and S-18..S-20 | All 13, every time the corpus is observed | Not one of the thirteen produces a clarification request. This is a count and not a rate: a single redundant question is a failure |
| Under-asking <= 5.0% | The whole twenty-scenario corpus, with the seven scenarios the corpus marks as genuinely ambiguous — S-06, S-07, S-10, S-11, S-12, S-13, S-14 — carrying the observation of whether the agent paused for an answer or proceeded on a guess | 20 scenarios, of which 7 can exhibit the defect | At most one guess across the twenty, matching the single case recorded in §1 Q3 (S-10), and a guess is counted whether the question was skipped entirely or asked somewhere the user cannot answer |
| Maximum reasoning turns <= 15 | Turn counts recorded for every job in the corpus, together with jobs deliberately given instructions too large to finish | All 20 corpus jobs, plus at least one deliberately oversized instruction per observation round | No corpus job reaches the ceiling, and a job that does reach it ends as `MAX_TURNS_EXCEEDED` rather than continuing. The ceiling value itself is not established by this measurement — `spikes/SP-4-agent-loop/REPORT.md` §1 Q4 records average turn counts of 4.0, 4.5 and 6.0 and no distribution or maximum. See Open Measurement Gaps |

The corpus is not a flat list, and what each of its five groups is there to expose is part of the measurement.
Group 1 (S-01..S-05) is simple and unambiguous, and every one of the five is expected to end correctly and
within the simple-job median. Group 2 (S-06..S-10) rebalances existing work, where correctness means the
relative order of the untouched items survives as well as the intended change landing; at least four of the
five are expected to hold. Group 3 (S-11..S-14) is ambiguous on purpose, and all four are expected to pause
through the ask tool with no question leaking into ordinary message text. Group 4 (S-15..S-17) carries
attached images, and its decisive case is the one where typed text and image contradict each other, which must
resolve in favour of the typed text. Group 5 (S-18..S-20) spans several connectors, reading from Gmail and
Drive before writing to Notion, and all three are expected to end correctly.

## Contract Conformance

This change freezes two machine-readable contract files. Each is judged by a condition anyone can observe against
a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/worker-loop.schema.json` | Every result a tool hands back satisfies the file, and a tool whose result does not — a plain object, or a `content` array with no entries — yields no reachable tool at all rather than one whose output the model silently cannot read | `specs/agent/spec.md`, the requirement that connector tools return structured content and details arrays; INV-AG-28; `spikes/SP-4-agent-loop/REPORT.md` §1 Q5 |
| `contracts/worker-loop.schema.json` | The text a tool returns and the `details` it returns describe the same outcome: what the model is shown and what the ledger records never disagree about whether a write succeeded | `specs/agent/spec.md`, the requirement that a worker verifies post-mutation state before reporting completion; INV-AG-24 |
| `contracts/worker-loop.prompt-context.schema.json` | No worker turn runs without a context satisfying the file: an anchor missing its zone, its day name or its time is refused at assembly, and the agent is never started with a partial anchor it would complete by guessing | `specs/agent/spec.md`, the requirement that relative date computations anchor to the local machine timezone; INV-AG-26; case S-16 |
| `contracts/worker-loop.prompt-context.schema.json` | The turn ceiling a running job observes is the one the file bounds. A job reaching it ends as `MAX_TURNS_EXCEEDED` with the user told the instruction was too large, rather than continuing past the ceiling or reporting a completion it did not verify | `specs/job/spec.md`; `contracts/worker-loop.md` §Error Matrix; `spikes/SP-4-agent-loop/REPORT.md` §1 Q4 |
| `contracts/worker-loop.prompt-context.schema.json` | The tools named in `registeredTools` are exactly the tools the session can reach — a tool present in the build and absent from the injected context is a finding, not an addition | `specs/agent/spec.md`; `agent/contracts/tool-wrapping` |

## Combination Matrix

| Complexity Tier | Modality | Input Clarity | Target Outcome |
| --- | --- | --- | --- |
| Simple (1 write) | Text Only | Clear | Direct execution, self-verify, latency <= 30s |
| Medium (Reorder / Multi-field) | Text Only | Ambiguous | Pauses via `ask_user`, resumes with user option, self-verify |
| Complex (Multi-doc extraction) | Text + Image | Conflicting | Typed text takes precedence, creates verified pages |

## Regression Scope

- `agent` — Rationale: Core worker reasoning loop, prompt engineering, and tool execution wrapping.
- `job` — Rationale: Job completion latency expectations and turn bounds.

## Manual Checks

- Every generated system prompt contains a complete temporal anchor and no syntax artifacts — owner: AI Prompt
  Engineer.
- Every attached image renders correctly in the transcript viewer — owner: Frontend Engineer.

## Open Measurement Gaps

Quantities this specification asserts that no evidence yet supports, and what would close each.

| Gap | What is asserted without evidence | What would close it | Owner |
| --- | --- | --- | --- |
| Effect of the corrections this change specifies | The correctness, self-verification and clarification figures were observed before the clarification directive, the precedence rule and the temporal anchor existed. The three failures they record — S-10, S-16, S-17 — are exactly what those directives address, so this change assumes the figures can only improve and has no observation showing that they do | The same frozen corpus observed again with the four directives present, and the new final-state correctness, self-verification and under-asking figures recorded beside the current ones. Until then the thresholds describe the uncorrected loop | implementer |
| Spread across repeated observations | 85.0 %, 95.0 % and 16.9 s each rest on one pass over each scenario. The loop is driven by a model whose output varies between identical runs, so none of the three carries a spread, and a single re-observation landing below the floor cannot be distinguished from a regression | Repeating the whole corpus several times under unchanged conditions and recording the distribution of each figure rather than a single value, so a later result can be judged against a range | implementer |
| The turn ceiling of 15 | Recorded as verified against `spikes/SP-4-agent-loop/REPORT.md` §1 Q4, which measures average turn counts of 4.0 for simple, 4.5 for medium and 6.0 for complex jobs and reports no distribution, no maximum and no job that approached a ceiling. The number bounds the loop in `model.md`, `contracts/worker-loop.md` and `contracts/worker-loop.prompt-context.schema.json`, and nothing measured establishes where a legitimate job stops needing turns | Recording the turn distribution across a corpus that includes deliberately large instructions, then setting the ceiling above the observed legitimate maximum. Until then the value is a design choice and its Verification Status overstates its evidence | decision-maker |
| An absolute obligation evidenced as a rate | `specs/agent/spec.md` states that a worker SHALL verify before reporting completion, while the evidence supports 95 % and the threshold asks for 90 %. Nothing measures what the product does in the remaining cases, and a rate cannot establish an absolute obligation | Either an observation that every completion message in the population is preceded by a verifying read, counting exceptions individually rather than as a percentage, or a decision that the obligation is enforced outside the model, at which point the rate measures the model and the enforcement measures the product | decision-maker |
| Operating system, provider and platform coverage | Every figure was taken on one Linux machine against one model provider and against real Notion, Gmail and Drive. Windows and macOS are supported operating systems, the provider matrix is owned elsewhere, and neither was observed. Latency in particular is a property of the provider and the network as much as of the loop | The corpus observed on each supported operating system, and the latency and correctness figures observed against each provider the product will ship with — the provider dimension belonging to `req-017-provider-matrix` rather than to this change | implementer; provider dimension owned by `req-017-provider-matrix` |
| Memory and per-tool-call time budgets | `model.md` bounds an agent loop at 20 MB of resident memory and `design.md` sets a 30-second timeout on a single tool call. Neither number appears in any spike measurement | Measuring resident memory across the corpus at the heaviest scenarios, and recording the distribution of single tool-call durations so the timeout is set above the observed legitimate maximum rather than chosen | implementer |
| Latency for medium and complex jobs | Nothing is asserted here on purpose. NFR-PF-05 bounds simple jobs only; `spikes/SP-4-agent-loop/REPORT.md` §1 Q4 observed medians of 44.2 s for medium and 44.9 s for complex jobs, and this change declares no ceiling for either | A decision on whether a background job needs a stated bound at all, and if it does, a threshold set from the recorded medians rather than from the simple-job figure | decision-maker |
| Representativeness of the corpus | `proposal.md` and `clarifications.md` both assume the twenty scenarios stand for the MVP workload, and the corpus is used as the acceptance gate on that basis. No observation compares it against what users actually ask for | Comparing the corpus against a sample of instructions from first users and recording which shapes of instruction it does not contain; widening it is a separate decision the proposal already flags | decision-maker |

# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | Governs Smart Approval Mode Tier 2: semantic risk evaluation of write operations passing Tier 1 static patterns. Bounded to tool call evaluation; does not learn from user approvals (deferred). |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | Settled by Q-1, Q-2, and Q-3: `RiskEvaluationRequest`, `RiskEvaluationResult`, verdicts (`AUTO_APPROVE`, `AUTO_REJECT`, `ESCALATE_USER`), and risk levels. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Clear | Safe operations auto-approved silently; risky/unclear operations or failed evaluations raise user approval cards per Appendix A.2. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | Empirical measurements from SP-10: 0.0% strict false-allow on dangerous operations, 3,154 ms median latency for cheap model, $0.000203 per call, 100% fail-closed on network disruption. |
| Integration & external dependencies (external services, formats, versions) | Clear | Integrates with model routing (`req-017`) for `risk-judge` role (`LLM_MODEL_CHEAP`), BytePlus Ark OpenAI-compatible endpoint, and `approval` hard gate. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Settled by Q-3 and Q-4: provider network cut (`ECONNREFUSED`), timeout (`AbortError` after 10s), HTTP 4xx/5xx, invalid JSON response, and ledger metadata injection (Case W-25). |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Option A (Two tiers: static first, model second, fail-closed) selected over Option B (static only) per proposal recommendation. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | Standard terms: `Smart Mode`, `Tier 1 Static Gate`, `Tier 2 Risk Judge`, `AUTO_APPROVE`, `AUTO_REJECT`, `ESCALATE_USER`, `Strict False-Allow`. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | The 30-case risk corpus (12 Safe, 10 Dangerous, 8 Ambiguous) from SP-10 serves as acceptance criteria. |
| Placeholders (TODOs, unquantified adjectives) | Clear | All latencies (P50 3,154 ms), cost ($0.000203), timeout (10s), and false-allow floor (0.0%) are quantified. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | Ephemeral in-flight evaluation calls; evaluations recorded in SQLite ledger `approval_evaluations` table. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Risk judge contract published under `approval/contracts/risk-judge@0.1.0`. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | Evaluated in Main Process before tool execution wrapper invokes external connector adapter. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | 100% fail-closed: any judge failure degrades safely to `ESCALATE_USER` (raising an Approval Card for the human). |

## Sessions

### Session 2026-09-12 — decisions delegated to the drafting agent

The decision-maker directed that these questions be answered by the agent rather than put to them one at a time, choosing the option that best fits `docs/raw-idea/prd-mvp.md`, `docs/spec/constitution.md` (specifically Principle II), and the empirical evidence in `spikes/SP-10-risk-judge/REPORT.md`.

- Q-1: Which model tier serves as the default for the Risk Judge role, and what are its latency and cost implications? → A: **`LLM_MODEL_CHEAP` (`deepseek-v4-flash`) is the default model assigned to the Risk Judge role. It achieves a measured median latency of 3,154 ms (P90 of 5,946 ms) and an incremental cost of $0.000203 per call, keeping simple jobs at 20.05s against the 30s NFR-PF-05 ceiling with 0.0% strict false-allow. The user may optionally configure `LLM_MODEL_STRONG` in settings.**
  Rejected: **Defaulting to `LLM_MODEL_STRONG`**, which has a median latency of 6,745 ms (P90 of 14,745 ms) and causes jobs with multiple write actions to breach the 30-second ceiling.
  (patched: `specs/agent/spec.md`, `specs/approval/spec.md`, `model.md`, `design.md`)

- Q-2: How are responsibilities divided between Tier 1 (Static Patterns) and Tier 2 (LLM Risk Judge)? → A: **Tier 1 strictly handles deterministic quantitative and ownership rules: it rejects or escalates any write operation on objects not created by the user (`created_by != user_self`) and bulk operations exceeding 5 items. Only operations that pass Tier 1 reach Tier 2. Tier 2 evaluates semantic danger (e.g. database schema renaming, cross-workspace writes, one-way block deletion) that cannot be anticipated by static regexes.**
  Rejected: **Delegating ownership checks to the LLM judge**, which allowed the Case W-25 metadata injection attack to succeed on the cheap model; and **relying on Tier 1 alone**, which cannot catch unforeseen semantic risks.
  (patched: `specs/approval/spec.md`, `contracts/risk-judge.md`, `design.md`)

- Q-3: What are the permissible verdicts emitted by the Risk Judge, and what is the fallback policy on evaluation failure? → A: **The Risk Judge emits exactly one of three verdicts: `AUTO_APPROVE` (safe to proceed without user prompt), `AUTO_REJECT` (prohibited semantic danger), or `ESCALATE_USER` (raise an Approval Card). The evaluation call carries a fixed timeout of 10 seconds. On network disconnect (`ECONNREFUSED`), timeout, HTTP errors, or malformed JSON, the system MUST fail closed to `ESCALATE_USER`. Auto-approval on evaluation failure is strictly forbidden.**
  Rejected: **Failing open on network loss**, which completely invalidates Principle II of the Constitution; and **aborting the entire job on judge failure**, which creates a poor UX when a simple human confirmation card allows work to continue safely.
  (patched: `specs/approval/spec.md`, `contracts/risk-judge.md`, `model.md`)

- Q-4: How does the system defend against prompt injection and text mimicking internal ledger metadata (Case W-25)? → A: **Defended via a two-layer strategy: (1) Tier 1 static ownership check blocks operations on non-user-owned objects before Tier 2 is ever called; (2) The Risk Judge system prompt defines all page titles, task descriptions, and comments as untrusted external environment data, explicitly directing the model to ignore phrases claiming internal pre-approval, zero-risk, or ledger reversibility.**
  Rejected: **Relying solely on LLM common sense**, which resulted in a 100% deception rate for the cheap model on Case W-25; and **stripping all text descriptions**, which blinds the judge to legitimate task context.
  (patched: `specs/approval/spec.md`, `contracts/risk-judge.md`, `design.md`)

- Q-5: Does the model judge ever possess the authority to widen permissions beyond what Tier 1 allows? → A: **No. Under Constitution Principle II, the model judge operates solely as a narrowing or escalating filter. It can only maintain an allow verdict or escalate to denial/user approval; it can NEVER grant permission to an operation blocked by Tier 1 static rules or security hooks.**
  Rejected: **Allowing the model judge to override static gate refusals**, which violates the constitutional invariant that safety gates must remain deterministic.
  (patched: `specs/approval/spec.md`, `model.md`, `design.md`)

## Assumptions

- The 30-case evaluation corpus from SP-10 (12 Safe, 10 Dangerous, 8 Ambiguous) is representative of desktop assistant tool invocations and serves as the baseline eval suite.
- When an operation is escalated to `ESCALATE_USER`, the existing Appendix A.2 `APPROVAL` card presentation mechanism is utilized.

## Open

None.

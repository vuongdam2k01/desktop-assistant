# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | Bounded by the worker agentic loop: context gathering -> planning -> action execution -> mandatory self-verification -> completion reporting. Excludes pet persona dialogue (handled in pet capability). |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | Settled by Q-3 and Q-5: loop step execution model, tool return format (`content` and `details`), and temporal anchor structure. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Clear | Clarification discipline ensures user inquiries only reach the user via `ask_user` UI, never leaked into conversational text. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | Empirical measurements from SP-4: 85.0% final-state correctness (floor >= 80%), 95.0% self-verification rate, median latency 16.9s for simple jobs (ceiling <= 30s, NFR-PF-05). |
| Integration & external dependencies (external services, formats, versions) | Clear | Integrates with `@earendil-works/pi-agent-core` (0.85.1), BytePlus Ark / DeepSeek V4 and Seed 2.0 Pro vision endpoints, and connector tools. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | Settled by Q-1, Q-2, and Q-4: conversational inquiry leakage (S-10), multimodal source contradiction (S-17), relative date calculation on same-day boundaries (S-16), and zero-tool-call read verification. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Option A (prompt-level enforcement + CI regression suite) selected over Option B (mechanical harness prose-question detector) per proposal recommendation. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | Standard terms: `Agentic Loop`, `Self-Verification`, `Temporal Anchor`, `Multimodal Precedence`, `Clarification Discipline`. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | The frozen 20-scenario suite (S-01 through S-20) from SP-4 serves as the acceptance and regression gate. |
| Placeholders (TODOs, unquantified adjectives) | Clear | All latencies (<= 30s), accuracy rates (>= 80%), and verification rates (>= 90%) are quantified. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | Ephemeral in-memory execution turns within the agent session; transcripts recorded in SQLite. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Standard tool return format `{ content, details }` enforced across all connector tool adapters. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | Worker loop executes in client process; connects directly to LLM endpoints via TLS without local proxy. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | Discrepancies detected during self-verification trigger automated in-loop corrective actions before final reporting. |

## Sessions

### Session 2026-09-12 — decisions delegated to the drafting agent

The decision-maker directed that these questions be answered by the agent rather than put to them one at a time, choosing the option that best fits `docs/raw-idea/prd-mvp.md`, `docs/spec/constitution.md` (specifically Principle V), and the empirical evidence in `spikes/SP-4-agent-loop/REPORT.md`.

- Q-1: How is clarification discipline enforced to prevent "Text-based Clarification Leakage" (Case S-10, where the agent asked the user in plain text without invoking `ask_user`)? → A: **Clarification discipline is enforced in Option A by incorporating an explicit negative constraint in the worker agent system prompt: "When clarification is needed, you MUST invoke the `ask_user` tool; you MUST NEVER ask clarification questions in ordinary conversational response text, as the user has no interface to respond." This requirement is continuously verified against the 20-scenario regression suite in CI.**
  Rejected: **Building an automated heuristic/ML classifier in the harness to intercept text questions (Option B)**, which introduces excessive complexity, latency, and false-positive interception of legitimate final summary reports.
  (patched: `specs/agent/spec.md`, `contracts/worker-loop.md`, `design.md`)

- Q-2: When an instruction contains both typed user text and an attached image with conflicting parameters (Case S-17), which source governs? → A: **The typed user text is the supreme authoritative instruction. When OCR or visual interpretation of an attached image contradicts the user's explicit typed text (e.g. text says "Due Thursday" while image screenshot shows "Wednesday"), the agent MUST resolve all attributes according to the typed user text.**
  Rejected: **Allowing the vision model to prioritize image content**, which caused failure in SP-4 Case S-17 and violates user sovereignty and Constitution Principle V.
  (patched: `specs/agent/spec.md`, `contracts/worker-loop.md`, `model.md`)

- Q-3: What constitutes the self-verification obligation (FR-AG-10) before reporting completion to the user? → A: **After performing any state-mutating tool operation (create, update, archive, reorder), the worker agent MUST execute at least one read/query tool call to inspect the post-execution state on the external platform, verifying that changes match intent before emitting the final completion message.**
  Rejected: **Allowing the agent to report success immediately upon receiving a write tool return**, which misses partial updates or platform validation rejections and degrades correctness.
  (patched: `specs/agent/spec.md`, `design.md`, `verification.md`)

- Q-4: How are relative dates (e.g. "next Friday", "tomorrow") anchored to prevent date computation errors (Case S-16)? → A: **The harness injects an explicit Temporal Anchor block into the system prompt containing the user's local machine current date (YYYY-MM-DD), current day of the week, current time (HH:MM:SS), and IANA timezone identifier (e.g. `Asia/Ho_Chi_Minh`). All relative date arithmetic MUST be computed relative to this anchor.**
  Rejected: **Relying on LLM internal timestamps or UTC defaults**, which caused the Friday-to-Friday same-day miscalculation in SP-4 Case S-16.
  (patched: `specs/agent/spec.md`, `contracts/worker-loop.md`, `design.md`)

- Q-5: What is the mandatory payload format for connector tools returning data to the Pi Agent SDK? → A: **All connector tools MUST return an object conforming to `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: data }`. The `content` text array ensures Pi SDK serializes tool outputs into the LLM prompt context, while `details` preserves structured metadata.**
  Rejected: **Returning raw JavaScript objects**, which Pi SDK serializes into an empty `content: []` array, blinding the agent to execution results and causing infinite loops.
  (patched: `specs/agent/spec.md`, `contracts/worker-loop.md`, `design.md`)

## Assumptions

- The frozen 20-scenario corpus from SP-4 is representative of MVP agent workload and serves as the baseline regression test suite.
- Simple jobs that require 1–2 tool calls have an empirical median latency of 16.9s, well within the NFR-PF-05 requirement of <= 30s.

## Open

None.

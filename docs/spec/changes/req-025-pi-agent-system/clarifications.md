# Clarifications

This change was drafted in one continuous session at the decision-maker's instruction to run the chain without
interruption. The questions that arose were first recorded under `## Open` with a recommended answer each, and
the artifacts were drafted against those recommendations. On 2026-09-13 the decision-maker gave a standing
instruction for the open points: choose whatever serves the product's operation best and finish the remaining
work. The decisions taken under that instruction are recorded in `## Sessions` with their reasons and the
alternatives rejected, so that a later reader can find every place a decision was taken and reverse it as a
delta rather than a redesign. Nothing remains under `## Open`.

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | Seven dimensions named in the request; non-goals recorded in the proposal, including the whole coding-agent surface the reference documents |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | Role, skill, capability pack, context budget and child job are new entities; `model.md` names and bounds them. Q-1 decided: the catalogue opens into a registry |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Partial | The runtime is not a surface; what the user sees of a child job, a loaded skill or an inactive capability belongs to `uix` and is deliberately left there (`design.md` § Open Questions) |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Partial | Concurrency and pacing bounds are inherited VERIFIED from SP-15; context budget, delegation depth, handler budgets and redaction coverage carry provisional declared values marked UNVERIFIED, with spikes SP-23 to SP-26 scheduled |
| Integration & external dependencies (external services, formats, versions) | Clear | No dependency is added. The harness pin is unchanged and `@oh-my-pi/*` remains refused — SP-6 §1 Q9 (VERIFIED) |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | A child job inherits every existing failure path; the new ones — a skill that fails validation, a pack that is inactive, a lifecycle handler that throws or times out, a budget that cannot be met — each have a declared outcome in the delta specs |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | Option C is refused on measured evidence; the reference's approval model is refused on constitutional grounds, both recorded in the proposal |
| Terminology & consistency (standard terms, terms to avoid) | Clear | This change uses *role*, *skill*, *capability pack*, *child job*, *interception point*. It avoids *subagent* (implies a commanded worker, contradicting principle I), *plugin* (implies third-party installation, which is not in scope) and *prewalk* (the reference uses it for a model handoff, not for context pruning) |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | 34 acceptance criteria in `verification.md`, one or more per requirement; the unverified targets each name the spike that would establish them |
| Placeholders (TODOs, unquantified adjectives) | Clear | None remain; the three `[NEEDS CLARIFICATION]` markers the proposal carried were resolved by Q-1 to Q-3 and replaced with the decisions |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | `model.md` declares the registry, catalogue and pack layouts, their ceilings and their stores; the context budget carries provisional declared defaults (Q-4) |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | Three manifests — role entry, skill, capability pack — each with a machine-readable schema file, each loaded whole or not at all, following the `pet-pack-manifest` precedent |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | A child job is a separate harness session in the same main process, inheriting the isolation measured in SP-6 §1 Q4; windows never reach the runtime except through existing channels |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | A capability that cannot be activated is absent rather than degraded; a skill that fails validation is absent and named; a parent whose child fails reports the child's failure rather than inheriting it |

## Sessions

### Session 2026-09-13

Decided under the decision-maker's standing instruction of 2026-09-13 — choose what makes the application work
best and finish the remaining work — after the recommendations below had been drafted and recorded.

- Q-1: Does the closed six-role routing catalogue open into a registry, or does a specialised role reuse one of
  the six existing routing slots? → **A: It opens into a registry; the six existing roles become built-in
  entries of the same shape.** Reason: reusing a slot would put two behaviours behind one routing assignment,
  which is the implicit-default state INV-AG-24 exists to forbid — the user would assign a model to "worker"
  without knowing which worker. Rejected: slot reuse (above); entries as code (the core edit principle VI
  prevents). (patched: `specs/agent/spec.md` registry and routing requirements, `model.md`,
  `contracts/role-registry.md`, `contracts/role-routing.md`, `design.md` D1)
- Q-2: Are browser and desktop automation in MVP scope, or specified-but-inactive until Phase 3? → **A:
  Specified but inactive; activation is the measurement SP-26.** Reason: a capability that is present and
  refuses trains the user to ask for it and leaves an unmeasured surface one configuration mistake from live;
  a capability that is absent until its evidence exists is the rule the project already applies to unmeasured
  platform capability. Rejected: active-and-gated at call time; not specifying them at all, which would let
  them arrive later without a gate policy. (patched: `specs/agent/spec.md` inactive-capability requirement,
  `contracts/capability-pack.md`, `design.md` D7)
- Q-3: May a capability pack ever originate outside this repository? → **A: No — first-party only in this
  revision.** Reason: a pack is trusted content; the only honest way to admit one from elsewhere is a
  provenance and integrity model, which is real work with its own security design and is not what this change
  is for. The slot is reserved in `model.md` § Variability with its activation condition, so the omission is
  recorded rather than silent. Rejected: a marketplace as the reference provides, whose own documentation says
  project scope is not a security boundary (`https://omp.sh/docs/plugins`, UNVERIFIED). (patched:
  `contracts/capability-pack.md`, `model.md` reserved slot, `design.md` D7 and Extensibility)
- Q-4: What is the context token budget per job, and at what fraction does reduction begin? → **A: The ceiling
  is the assigned model's declared window; the reserve is 20% of the ceiling and never below 8 000 tokens;
  reduction begins when the assembled context plus the expected next turn crosses the reserve; summarisation
  retains the most recent turns up to 25% of the ceiling; the fallback ceiling when no window is declared is
  32 000 tokens.** All five are provisional declared defaults and are UNVERIFIED; SP-23 replaces them with
  measured values as a MINOR revision of `context-assembly`. Reason: the product needs values to run at all,
  and a contract that declared nothing would leave an implementer to invent them silently; the values are
  chosen to leave a long job room on the models this project has measured, not derived from a measurement of
  context behaviour. Rejected: a fixed token ceiling (wrong for every model but one); a percentage copied from
  the reference (`https://omp.sh/docs/compaction`, UNVERIFIED), which Evidence Discipline forbids. (patched:
  `contracts/context-assembly.md`, `contracts/context-assembly.schema.json`, `verification.md` § Thresholds)
- Q-5: Are accumulated approval counts read across a parent and its children, or per job? → **A: Across.**
  Reason: per-job counting is escaped by splitting work into children — the same escape the existing
  requirement "a rule constrains an individual field, so splitting a call does not escape it" already closes
  for fields. No `approval` delta is needed: the existing requirement reads counts from the account's ledger
  across every job and every device, so parent and children are counted together by construction. Rejected:
  per-job counting. (patched: `impact.md` § Decision; `verification.md` § Manual Checks)
- Q-6: Does a typed reference to a redacted value satisfy the `ledger` requirement that a record carries the
  full account of one step? → **A: Yes, and the `ledger` requirement says so explicitly.** The reference names
  the secret's class and the field it occupied, so the account is complete in everything except the secret
  itself, and under principle VII replicated data is decryptable by the service by design, which is why the
  account of a secret is its class and its place rather than its value. Rather than leave this as an
  agent-side reading, this change carries a MODIFIED delta for `ledger` adding the clause and two scenarios.
  Rejected: recording the value (it would replicate); recording a hash or truncation (neither is safe to
  replicate, INV-AG-43). (patched: `specs/ledger/spec.md`, `proposal.md` § Modified Capabilities, `impact.md`)
- Q-7: The constitution's *External Content Is Data* section enumerates two sources and this change creates
  four — who amends it, and when? → **A: The dedicated change `req-026-external-content-sources` amends it to
  four sources (constitution 2.0.0 → 2.1.0), authored beside this change so that the amendment precedes the
  activation of either pack by construction.** Reason: § Governance requires a dedicated change for any
  amendment; carrying it silently inside this change was never an option. (patched: `design.md` § Complexity
  Tracking and § Open Questions, `proposal.md` § Constitution check)

## Assumptions

1. **Delegation depth is bounded at one level in this specification** — a top-level job may create children;
   a child may not create grandchildren. The reference permits two levels by default
   (`https://omp.sh/docs/subagents`, UNVERIFIED), but depth multiplies against a connector pacing budget whose
   refusal threshold is measured — `spikes/SP-15-concurrency/REPORT.md` §1 Q4 (VERIFIED) — and one level is the
   depth this product can reason about without a new measurement. Raising it is a MAJOR change to
   `contracts/job-delegation`, because it reopens the principle I argument.
2. **Children share the parent's connector concurrency slot budget** rather than receiving their own, for the
   same measured reason.
3. **Skills carry no executable content.** A skill is instructions plus reference material; anything
   executable is a tool, and a tool exists only through the wrapping factory. This is a deliberate divergence
   from the reference, which permits a skill directory to carry scripts a session may run
   (`https://omp.sh/docs/skills`, UNVERIFIED) — that shape has no meaning in a product whose agents hold no
   shell.
4. **Context assembly never consults a model.** Selection, ordering and reduction are deterministic given the
   same inputs, so that a job's context is reproducible when a failure is investigated.
5. **The lifecycle points are this product's own**, named for what they do here. The reference's event names
   were not adopted, and two of the names in the request (`before_tool`, `on_error`) do not exist upstream in
   that form.
6. **An interception handler's time budget defaults to 250 ms and may declare at most 2000 ms.** Both figures
   are declared ceilings recorded here for the first time and are UNVERIFIED; the reference architecture's
   corresponding figure is thirty seconds (`https://omp.sh/docs/hooks`, UNVERIFIED) and was not adopted,
   because a pre-call handler sits between the agent and every tool call and a budget that long would let one
   slow handler stall a job for the length of a provider timeout. The values live in
   `contracts/runtime-lifecycle.md` and are candidates for the SP-23 corpus rather than for a separate spike.
7. **A call a handler blocks is still recorded.** The wrapper writes the intent record and a result record
   stating the refusal and naming the handler, so a blocked call is as traceable as a gate refusal and principle
   III holds for every call the agent issued. Recorded in `design.md` § Structure and in the delta spec's
   scenario *A pre-call handler blocks deliberately*.
8. **"Isolated context" means a separate harness session** with its own transcript and tool set — the
   isolation SP-6 §1 Q4 already measured — not filesystem worktree isolation, which exists for concurrent code
   edits this product does not perform.
9. **The declared size ceilings** — 256 KiB per skill package, 16 KiB of role instructions, 256 catalogue
   entries, 1 MiB of pack declarations — are budgets chosen so the catalogue can be listed without reading any
   body, and are UNVERIFIED wherever they appear.

## Open

None. Every question raised during drafting is recorded as a decision in `## Sessions` above; each names the
artifacts it patched, so reversing one is a delta to those artifacts and a new session entry here.

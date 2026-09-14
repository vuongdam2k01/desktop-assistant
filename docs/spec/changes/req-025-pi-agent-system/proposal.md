> **Constitution warning** — this change touches principle I (Decentralized Agents), principle II (Hard Gate
> Outside The LLM Loop, NON-NEGOTIABLE) and the *External Content Is Data* invariant. Delegation as requested
> is a control loop and must be re-expressed as job records; the new browser and desktop surfaces add a third
> and a fourth source of untrusted content to an invariant that names two. Both resolutions are carried in
> `design.md`, not deferred.

## Why

The agent runtime can run one worker through one loop against connector tools; it cannot declare who is
working, package what it knows, budget its own context, expose an intervention point, extend its tool surface,
decompose a large job, or act outside the connector set. This change specifies all seven as declared data on
the harness the project has already pinned.

## Problem

Every capability the runtime lacks is currently closed by editing the runtime, which is exactly the failure
mode principle VI exists to prevent. Concretely: `agent/contracts/role-routing@0.1.0` declares a **closed**
six-role catalogue where "a seventh role is a change to the contract, not a configuration value", so a
Researcher or Reviewer identity is a contract revision; there is no format in which a procedure can be written
once and loaded when relevant, so reliability rests on prompt text; nothing bounds a job's context, so a long
job fails late from exhaustion in a way the user reads as the product being unreliable rather than as a budget
limit; the only declared interception point is the approval gate, so redaction, telemetry and context
transformation have nowhere to attach; and a job that spans several targets has no way to split.

Who is affected: the beta user, whose long or multi-target jobs fail late; and the project, whose stated reach
of tens to hundreds of platforms is unreachable while each capability is a core edit. Why now: the runtime's
contracts are being frozen for M1, and every item above either fits inside the frozen contracts or forces them
open. Deciding after the freeze costs a contract revision on every consumer instead of a schema slot.

The request names the Oh My Pi (OMP) documentation portal as its technical frame of reference. That portal is
**a reference model, never a dependency**: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9 (VERIFIED) measured the
`@oh-my-pi/*` distribution as Bun-targeted, raw-TypeScript, and holding its pause state in a process-wide
singleton, which contradicts the per-session isolation VERIFIED in the same report (§1 Q4); the living `agent`
spec already requires a project assembly that resolves it to fail rather than ship. Everything this change
takes from OMP is a pattern re-implemented on `@earendil-works/pi-agent-core@0.85.1`, and every claim
traceable only to omp.sh is vendor documentation, marked UNVERIFIED under *Evidence Discipline*.
Full intake, source handling and three corrections to the request's description of OMP semantics:
`docs/spec/explorations/pi-agent-system-assessment.md`.

## Cost of inaction

The six-role catalogue stays closed, so every specialised identity is a contract revision — first one, then
one per capability, each after the freeze. Long jobs keep failing from context exhaustion with no budget to
point at. Redaction has no boundary to live on, so secret material keeps reaching transcripts and ledger
records by default rather than by decision. And the browser and desktop capabilities keep being discussed
without a declared gate policy or irreversibility declaration, which is the condition under which one of them
eventually ships without either.

## Options

### Option A — Reference-aligned runtime, capabilities declared and gated

- **Sketch**: All seven dimensions are specified together. A role becomes a registry entry carrying
  instructions, a model-tier reference and a tool allowlist; the existing routing table still resolves a tier
  to a concrete model. A skill becomes a declared directory with a manifest, discovered and validated at load
  and loaded into a job only when that job needs it. Context becomes an assembled artifact with a declared
  budget and a declared reduction ladder. Lifecycle points are declared as a contract that observes and
  transforms, while the gate and the ledger obligation stay in the application layer. Delegation is child job
  records created through the Job Manager. Browser and desktop capability are fully specified — tool surface,
  irreversibility, untrusted-content rules, gate policy — and ship **inactive** behind a declared activation
  condition.
- **Appetite**: large.
- **Trade-offs**: one coherent runtime; contract churn paid once, before the freeze; no capability can land
  later without its gate policy already written. Against: the widest change in the project so far, and a
  specification this wide can outrun its evidence.
- **Rabbit holes**: a plugin marketplace; re-specifying the gate; importing OMP's coding-agent surface (LSP,
  DAP, editing, shell, security scanning) because the reference documents it; constructing a memory subsystem
  when what jobs need is context assembly.

### Option B — Minimum viable slice: identity, procedure, context

- **Sketch**: only the three dimensions that make today's jobs succeed — role registry, packaged skills,
  context engine. Hooks, plugins, delegation, browser and desktop deferred whole.
- **Appetite**: medium.
- **Trade-offs**: smallest reachable increment, touches `agent` and `job` only, every piece measurable
  against the existing SP-4 corpus. Against: large jobs still cannot decompose, and the contracts freeze a
  second time when the deferred half arrives.
- **Rabbit holes**: the skill format growing into a plugin format by accident — Option A's extension surface
  without Option A's trust analysis.

### Option C — Adopt the OMP runtime

- **Sketch**: take `@oh-my-pi/*` as the harness and inherit roles, skills, hooks, plugins, subagents, browser
  and computer control as implemented features.
- **Appetite**: rejected, not budgeted.
- **Trade-offs**: refused by measurement, not preference — SP-6 §1 Q9 (VERIFIED). Beyond the runtime facts,
  its approval defaults invert this constitution: the built-in mode is `yolo`, and child agents run tier
  decisions as `yolo` because the parent's approval is treated as their authorisation boundary
  (`https://omp.sh/docs/approvals`, UNVERIFIED).

## Recommendation

**Option A**, with browser and desktop automation specified but inactive. It is the only option that delivers
the seven requested dimensions, and the inactive-capability device is what keeps a specification of that width
honest: contracts, gate policy and irreversibility declarations are written now, while activation waits on
measurement rather than on vendor documentation.

## What Changes

- A role registry: identity, instructions, model-tier reference, tool allowlist, delegation permission and
  skill preload list become declared entries. **BREAKING** for `agent/contracts/role-routing@0.1.0`, whose
  closed six-role catalogue is superseded by a registry of which those six become the built-in entries.
- A skill package format with discovery, validation, precedence and on-demand loading into a job's context.
- A context engine: deliberate assembly from declared sources, a declared token budget, a declared reduction
  ladder when the budget is approached, and deterministic prompt templates.
- A lifecycle contract with named interception points that may observe and transform but never authorise; the
  approval gate and the ledger obligation remain application-layer and fail-closed and are not subscribers.
- An extension surface by which a capability pack contributes tools, roles and skills without a core edit, and
  through which nothing reaches the agent except by the existing wrapping factory.
- Delegation: a role permitted to delegate creates a **child job** through the Job Manager; the child runs in
  its own harness session, and the parent reads results from job records. No agent commands another.
  **BREAKING** for the `job` lifecycle, which gains a parent/child relation and a completion rule, and
  **BREAKING** for `agent/contracts/agent-session@0.1.0`, whose closed four-member `AgentRole` union opens to a
  registry identifier and whose sessions gain lineage.
- Browser and desktop capability packs, specified with declared irreversibility and gate policy, shipped
  inactive behind a named activation condition.
- A redaction boundary every tool argument and every tool result crosses before it reaches a model request, a
  transcript, a ledger record or a replicated store.

## Capabilities

**REQUIRES spec-impact** — modified capabilities, a breaking contract revision, and persistent storage
(registry, skill catalogue and child-job records are account-owned and replicate).

### New Capabilities

None. The change is expressed entirely inside the declared domain set of `docs/spec/config.yaml`; no new
capability directory is introduced.

### Modified Capabilities

- `agent`: the role catalogue becomes a registry; new requirements for skill discovery, validation and
  loading, context assembly and reduction, the lifecycle contract, the extension surface, delegation as job
  creation, the capability-pack tool surface, and the redaction boundary. The requirement pinning the harness
  identity is retained unchanged and gains the explicit statement that the reference architecture is not a
  dependency.
- `job`: parent/child job relation, the rule that a child is created rather than commanded, child completion
  and cancellation propagation, and a depth and fan-out bound.
- `ledger`: one requirement gains a clause — a parameter or outcome value the redaction boundary classifies as
  secret is recorded as a typed reference naming its class and field, and that reference counts as the account
  of the value. Record shape is unchanged; the decision is Q-6 in `clarifications.md`.

## Impact

- **Contracts**: `agent/contracts/role-routing` revised (closed catalogue → registry); new contracts for the
  role registry entry, the skill manifest, and inter-job delegation messaging. Every `open` variability point
  in `model.md` receives exactly one contract.
- **Persistent data**: role registry, skill catalogue state and child-job records are account-owned under
  principle VII and replicate; each must declare a conflict-resolution rule under `sync`.
- **Consuming capabilities, unchanged by design**: `approval` (its existing requirements already bind *every*
  tool call, so a child job's calls and a capability pack's calls are gated by the rules already written),
  `ledger` (same, for ledger-before-act), `connector` (the wrapping factory and manifest-generated tools are
  reused, not replaced), `sync`, `uix`. Where a surface here would force one of their requirements to change,
  it is recorded in `impact.md` rather than changed silently.
- **Dependencies**: none added. The harness pin is unchanged; `@oh-my-pi/*` remains a refused package.
- **Spikes**: activation of the capabilities specified here depends on measurements that do not yet exist —
  context budget and reduction, delegation with gating at depth, redaction over a seeded-secret corpus, and
  browser/desktop capability. Scheduled as SP-23 through SP-26 in `docs/spike-roadmap.md`.

## Refs

None — this project declares no upstream traceability anchor (`docs/spec/config.yaml`).

## Constitution check

| Clause | Touchpoint | Status |
| --- | --- | --- |
| I. Decentralized Agents | Delegation | Contradicted as requested; compliant as designed — a child is a job record created through the Job Manager, never a worker commanded by a parent. |
| II. Hard Gate (NON-NEGOTIABLE) | Lifecycle points, extension surface, delegation, new capability packs | Compliant under a stated constraint: interception points observe and transform, never authorise; child-job calls are gated independently; OMP's parent-approval-as-child-authorisation is explicitly refused. |
| III. Ledger Before Act (NON-NEGOTIABLE) | Every new tool surface | Compliant — browser, desktop and child-job calls write their record before execution like any other call. |
| IV. Irreversibility Is Declared | Browser and desktop actions | Compliant only with per-action declarations; most desktop input is irreversible and says so. |
| V. Capability Over Input Normalization | Skills, roles, context engine | Directly serving — this change is the clause. |
| VI. Connectors Are Data | Registry, skills, capability packs | Extended — the manifest-plus-adapter rule is applied to roles, skills and capabilities. |
| VII. Account-Owned Data | Registry, skill catalogue, child jobs | Compliant — account-owned, replicated, no user-carried artifact. |
| VIII. Official Flows Only | — | Not touched. |
| External Content Is Data | Rendered web pages, screen pixels, accessibility trees | **Invariant must be extended explicitly**; it names two sources today and this change adds two more, in the medium prompt injection travels in. |
| Evidence Discipline | Every omp.sh-derived claim | Complied with by UNVERIFIED marking plus scheduled spikes. |
| Rigor By Risk | Approval gate and ledger write path | Schema `design` mandatory — selected. |

The three questions this proposal raised — whether the six-role catalogue opens into a registry, whether
browser and desktop automation ship active or specified-but-inactive, and whether a capability pack may
originate outside this repository — were decided on 2026-09-13 by the decision-maker's standing instruction to
choose what serves the product best and proceed: the catalogue opens into a registry with the six as built-in
entries; both packs ship inactive until the measurement that activates them; packs are first-party only. The
decisions, their reasons and the alternatives rejected are recorded in `clarifications.md` § Sessions.

The constitution's *External Content Is Data* section, which this change extends from two sources to four, is
amended by the dedicated change `req-026-external-content-sources`, as § Governance requires.

## Assumptions

1. This repository stays specification-only; spec, model, contracts and design are the deliverables.
2. The harness stays pinned to `@earendil-works/pi-agent-core@0.85.1` and `@earendil-works/pi-ai@0.85.1`;
   every OMP pattern is re-implemented on it (SP-6 §1 Q9, VERIFIED).
3. "Model tier" maps onto the existing role-to-model routing table; no second routing mechanism is introduced.
4. Roles, skills and capability-pack state are account-owned configuration and replicate under principle VII.
5. "Isolated context" means a separate harness session with its own transcript and tool set — the isolation
   SP-6 §1 Q4 already measured — not filesystem worktree isolation, which exists for concurrent code edits
   this product does not perform.
6. Every tool this change adds is reached only through the existing wrapping factory; no second registration
   route is created.
7. Coding-agent capabilities documented by the reference (file editing, shell, language servers, debuggers,
   structural codemods, security scanning, repository hosting integration) stay out of scope under ADR-004.

## Context

The runtime this change extends is already fixed in three ways that decide most of what follows. Tools exist
only as the output of one wrapping factory, and the factory keeps the implementation private — VERIFIED with
the engine's own interception facility deliberately left unconfigured
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2). Sessions are per-instance and share nothing, which is what makes a
second concurrent agent safe at all — VERIFIED (§1 Q4). And the harness is pinned to
`@earendil-works/pi-agent-core@0.85.1`, with the similarly named `@oh-my-pi/*` distribution refused because it
targets Bun and holds pause state in a process-wide singleton — VERIFIED (§1 Q9).

That last fact sets this change's method. Oh My Pi is the reference architecture named in the request, and it
is read here as documentation of a design space, not as a component. Every pattern taken from it is
re-implemented against the pinned harness; nothing is imported. Where its documentation is the only source for
a claim, the claim is UNVERIFIED, because vendor documentation is never an architectural conclusion in this
project.

Two constraints from the constitution shape the structure more than any technical fact. Principle I forbids one
agent commanding another, which decides what delegation can be. Principle II puts the gate in the application
layer outside anything a model can reach, which decides what an interception point is permitted to return.

## Goals / Non-Goals

**Goals:**
- Identity, procedure and capability become declared documents; the runtime stops being the place they live.
- A long job has a stated context budget and a stated way of staying inside it.
- Work divides without any agent gaining authority over another agent.
- Every new surface — packs, skills, handlers, children, browser, desktop — reaches the platform through the
  same wrapper, the same gate and the same ledger obligation as a connector tool.
- Secret material stops leaving the wrapper by default.

**Non-Goals:**
- Adopting or vendoring `@oh-my-pi/*`.
- Third-party extension installation, a marketplace, or any pack originating outside this repository.
- Coding-agent capability: editing files, running a shell, language servers, debuggers, security scanning.
- Replacing or relocating the approval gate, the ledger write order, or the wrapping factory.
- A cross-session memory subsystem. Context assembly serves one job; durable knowledge is the account's rules
  and skills, both of which are authored rather than inferred.

## Structure

Seven components, all inside the existing main process. Each names the model entity it realises.

| Component | Realises | Responsibility | Reaches other domains through |
| --- | --- | --- | --- |
| **Role registry** | Role entry, Role registry | Holds entries, materialises the six built-in ones at start, resolves an identifier to an entry, refuses a registry written against a later schema | `agent/contracts/role-registry@1.0.0`; tiers resolve through `agent/contracts/role-routing@1.0.0` |
| **Skill catalogue** | Skill package, Skill catalogue | Discovers packages one directory deep, validates each whole, resolves precedence, advertises identifiers and applicability, reads a body only when it is loaded | `agent/contracts/skill-manifest@1.0.0` |
| **Context composer** | Context source, Assembled context, Context budget, Reduction step, Prompt template | Assembles every request's context deterministically, holds the budget, runs the reduction ladder, records the account of both | `agent/contracts/context-assembly@1.0.0` |
| **Lifecycle bus** | Interception point, Handler registration | Dispatches the six points in registration order, enforces each handler's budget, applies the declared failure posture | `agent/contracts/runtime-lifecycle@1.0.0` |
| **Pack loader** | Capability pack, Activation condition | Enumerates packs, validates each whole, checks activation evidence, contributes declarations to the registry, the catalogue and the tool factory | `agent/contracts/capability-pack@1.0.0` |
| **Delegation gateway** | Delegation grant, Child job link | Turns a delegating agent's request into a job creation, enforces depth and fan-out, reads results back from job records | `agent/contracts/job-delegation@1.0.0`; creates jobs through the job manager |
| **Redaction boundary** | Redaction class, Redacted reference | Sits inside the wrapper; projects arguments and results before they reach a model request, a transcript, a record or a replicated store | `agent/contracts/secret-redaction@1.0.0`; records through `ledger/contracts/ledger-record@0.1.0` |

The existing components keep their roles unchanged: the wrapping factory still produces every tool
(`agent/contracts/tool-wrapping@0.2.0`), the gate still decides every call
(`approval/contracts/gate-evaluation@0.1.0`), the ledger still records before the act
(`ledger/contracts/ledger-record@0.1.0`), the coordinator still paces every platform call
(`connector/contracts/resource-coordinator@0.1.0`), and the job manager still owns every lifecycle transition.

The order inside one tool call, which nothing above may reorder:

```
agent issues call
  → lifecycle point: before a tool call        (may block; may transform arguments; may not allow)
  → redaction boundary                          (projects arguments)
  → ledger: intent record written               (fail-closed: no record, no call)
  → gate: verdict                               (allow / hold / refuse)
  → coordinator: resources obtained
  → adapter executes against the platform       (receives unredacted arguments)
  → redaction boundary                          (projects the result)
  → ledger: result record written
  → lifecycle point: after a tool result        (may transform what the agent sees; may not re-run the call)
  → agent receives the result
```

A block at the first point does not skip the ledger. The wrapper still writes the intent record and a result
record stating the refusal and naming the handler — the same shape `approval` already uses for a gate refusal,
where the intent record stands and the result record carries the refusal. A call a handler stopped is therefore
as traceable as a call the gate refused, and principle III holds for every call the agent issued, not only for
the ones that reached the gate.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel / topic | Direction | Pattern | Payload schema | Return | Side effects | Errors & timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `registry/list` | Window → Main | Request-Response | `{}` | The registry with each entry's origin and whether its tier is assigned | None | `REGISTRY_VERSION_AHEAD` |
| `registry/upsert` | Window → Main | Request-Response | A role entry document | Accepted entry, or the field that failed | Writes a replicated record | `ENTRY_INVALID`, `BUILT_IN_IMMUTABLE`, `TIER_MALFORMED`, `CAPABILITY_UNKNOWN` |
| `registry/remove` | Window → Main | Request-Response | `{ roleId }` | `{ removed: true }` | Writes a replicated record | `BUILT_IN_IMMUTABLE`, `ROLE_IN_USE` |
| `registry/state` | Main → Window | Pub-Sub | — | Entries whose usability changed | None | None |
| `skills/list` | Window → Main | Request-Response | `{}` | Catalogue: identifier, applicability, origin, validity, enabled, shadowed-by | None | None |
| `skills/enable` | Window → Main | Request-Response | `{ skillId, enabled }` | The new state | Writes a replicated record | `SKILL_UNKNOWN` |
| `packs/list` | Window → Main | Request-Response | `{}` | Packs with activation state and the evidence each awaits | None | None |
| `jobs/tree` | Window → Main | Request-Response | `{ jobId }` | The job and its children, each with state and progress | None | `JOB_UNKNOWN` |
| *(delegation)* | — | — | — | — | — | **No channel.** A child is created by the delegation gateway inside the main process and is visible only as a job |
| *(lifecycle)* | — | — | — | — | — | **No channel.** Handlers are in-process registrations; no window may register, list or trigger one |
| *(context)* | — | — | — | — | — | **No channel.** An assembled context is never sent to a window; the job's account of it is, through the existing job surface |

**Channels that deliberately do not exist.** Nothing lets a window start an agent, load a skill into a running
job, register a handler, activate a pack, or read an assembled context. Activation in particular is evidence-
bound rather than user-settable, so there is no toggle to expose. This follows the asymmetry
`agent/contracts/role-routing@0.1.0` already establishes, where a window may express intent and can never
obtain a resolved endpoint.

### Execution Boundaries & Isolation

Everything in this change runs in the Electron main process. A child job is a separate harness session in that
same process — the isolation VERIFIED in `spikes/SP-6-pi-sdk/REPORT.md` §1 Q4, where three concurrent sessions
each held a distinct secret and no transcript reproduced another's content. No new process, worker thread or
sandbox is introduced.

Crash and disconnect behaviour follows the existing rules rather than inventing any: a parent and its children
are jobs, so `job`'s recovery requirement governs them, and a parent is never concluded from a child's absence
(`specs/job/spec.md`). A handler that hangs is bounded by its declared budget; a pack that fails to load
contributes nothing; a skill that fails validation is absent. None of these can leave a job in an undefined
state, because none of them is on the path between the ledger write and the gate.

### Trust Boundaries & Input Validation

Six untrusted inputs and their handling are enumerated in `model.md` § Trust Boundary. The structural controls
are: external content enters a context only as a declared template input carrying its origin (INV-AG-39); no
interception point can return an authorisation (INV-AG-40); the gate and the ledger are wrapper steps rather
than registrations (INV-AG-41); and every value leaving the wrapper crosses the redaction boundary exactly once
(INV-AG-42).

Two validations are enforced at load rather than at use, because that is where the author sees them: a
descriptor written against a later schema version is refused whole, and a package whose named material lies
outside its own directory is refused whole.

## Decisions

### D1 — The role catalogue opens into a registry, and the tier indirection is kept

- **Choice**: a role entry is a document carrying identity, instructions, tier, required capabilities, tool
  allowlist, delegation grant and preloaded skills. The entry names a *tier*; the tier resolves to a model
  through the existing routing table, revised to `agent/contracts/role-routing@1.0.0`.
- **Rationale**: the two things the closed catalogue was protecting are no-substitution and no-implicit-default,
  and both are properties of the *table*, not of the union. Keeping the tier indirection keeps them while
  letting identity multiply. The reference architecture separates the same two layers, for the same stated
  reason (`https://omp.sh/docs/agents-and-roles`, UNVERIFIED).
- **Alternatives considered**: *(a)* Keep six roles and let a specialised identity reuse one — rejected because
  two behaviours behind one assignment is exactly the implicit default INV-AG-24 forbids; the user would assign
  a model to "worker" without knowing which worker. *(b)* Let an entry name a concrete model — rejected: a
  second path from role to model is a path settings do not control, and the measured cost split of
  `spikes/SP-17-provider-matrix/REPORT.md` §1 Q6 depends on there being one path. *(c)* Registry entries as
  code rather than data — rejected as the core edit principle VI exists to prevent.

### D2 — Delegation is job creation, not agent spawning

- **Choice**: a role holding the delegation grant creates a child job through the job manager and reads results
  from job records. There is no handle, no steering, no message bus.
- **Rationale**: principle I. The reference architecture's model has a parent that starts, supervises, steers
  and kills live workers (`https://omp.sh/docs/subagents`, UNVERIFIED); that is a control loop, and adopting it
  would put the constitution's first principle in Complexity Tracking on day one. Expressing the same capability
  as job records costs nothing in reach and buys every property jobs already have: a queue, a gate, a ledger,
  recovery, cancellation and visibility.
- **Alternatives considered**: *(a)* In-process worker handles with a parent-side supervisor — rejected as
  above. *(b)* A message bus between agents — rejected for the same reason and for a second one: a message
  channel is a carrier of untrusted instruction between components that both hold tools. *(c)* No delegation at
  all (Option B in the proposal) — rejected because it leaves the decomposition problem unsolved and freezes the
  contracts twice.

### D3 — Interception points may transform; only the gate may allow

- **Choice**: six declared points. The before-a-tool-call point may block or transform arguments; the
  after-a-tool-result point may transform what the agent sees; the remaining four observe. No point's return
  value can cause execution. The gate and the ledger write are steps of the wrapper and are not registrations.
- **Rationale**: principle II states the gate is unreachable by model output; it is equally important that it be
  unreachable by *product* code taking a shortcut. Making "allow" unrepresentable at every point means no future
  handler can acquire the power by accident. Transformation is still necessary — redaction is one — so the
  points exist, and what is approved and recorded is what actually runs.
- **Alternatives considered**: *(a)* The reference's richer event surface with a pre-call handler that can
  replace a call's input and an approval policy that handlers "supplement"
  (`https://omp.sh/docs/hooks`, UNVERIFIED) — rejected because supplementing is the wrong relation: here the
  gate is not one voice among several. *(b)* Implementing the gate itself as a handler at the pre-call point —
  rejected outright: it would make the gate unregisterable in principle and unregistered in practice one
  refactor later. *(c)* No interception surface at all, with redaction inlined — rejected because telemetry,
  context transformation and future obligations would then each be a core edit.

### D4 — Context is assembled deterministically and reduced by a closed ladder

- **Choice**: seven declared sources in a declared order; assembly consults no model; a budget derived from the
  assigned model's declared window; a four-step ladder — drop superseded reads, drop empty results, replace
  bulky results with a ledger reference, summarise the older transcript — with a protected set that reduction
  may never touch.
- **Rationale**: a job that fails must be reproducible against the context that produced it, which model-driven
  selection makes impossible. The ladder is ordered cheapest-and-most-faithful first: three of its four steps
  lose nothing, because what they remove is either superseded or empty or still readable in the ledger. Only the
  fourth summarises, and only the older part.
- **Alternatives considered**: *(a)* The reference's automatic maintenance chain, including archiving history
  into images for a vision-capable model (`https://omp.sh/docs/compaction`, UNVERIFIED) — rejected: it makes
  context survival depend on the assigned model having vision, and this product's own measurement shows two of
  three tested text models refuse images outright (`spikes/SP-17-provider-matrix/REPORT.md` §1 Q1). *(b)* Let
  the model decide what to drop — rejected: irreproducible, and it puts an untrusted-content-bearing context in
  charge of what survives. *(c)* A fixed token ceiling — rejected: the ceiling belongs to the model the user
  assigned, and the user may reassign it.

### D5 — The reference's prewalk is rejected; plan-then-execute is expressed as delegation

- **Choice**: a job's model does not change mid-run. Where planning deserves a stronger model than execution, a
  planner role creates child jobs whose role names a cheaper tier.
- **Rationale**: the request asked for "prewalk" as a context-pruning pass; in the reference it is a one-time
  model handoff triggered by the first file edit (`https://omp.sh/docs/prewalk`, UNVERIFIED). Neither reading
  survives contact with this product. The pruning need is met by D4. The handoff conflicts with an existing
  requirement — a running job finishes against the assignment it started with — and its trigger, a file edit,
  does not exist in a product with no file tools. Delegation gives the same economics with none of the
  ambiguity: two jobs, two recorded roles, two recorded tiers, two accounts of what was spent.
- **Alternatives considered**: *(a)* Implement the handoff faithfully — rejected as above. *(b)* Allow a
  mid-run tier change under a flag — rejected: the ledger and the usage account both attribute spend to a role,
  and a job whose role changed halfway is a job whose account cannot be read.

### D6 — A skill is content, never code

- **Choice**: a skill package holds instructions and reference material. Anything executable is a tool, and a
  tool exists only through the wrapping factory.
- **Rationale**: the reference permits a skill directory to carry scripts the session may run with the user's
  permissions (`https://omp.sh/docs/skills`, UNVERIFIED), which is coherent for a coding agent with a shell and
  incoherent here. Admitting executable skills would create a second route to capability and put INV-AG-02 —
  the invariant eleven bypass attempts failed against
  (`spikes/SP-8-rule-ir-hardgate/REPORT.md` §1 Q2) — back in play.
- **Alternatives considered**: *(a)* Scripts permitted but gated — rejected: the gate evaluates declared tool
  calls against declared targets, and a script is neither. *(b)* Skills as prompt fragments with no manifest —
  rejected: without applicability text there is nothing to match on, and every skill would have to be loaded
  always, which is the context cost this change exists to reduce.

### D7 — Capability packs are first-party, and an unactivated pack contributes nothing

- **Choice**: packs are enumerated from the product's own directory. A pack whose activation condition is unmet
  contributes no tool, no role and no skill. Browser and desktop ship as packs in that state.
- **Rationale**: a pack is trusted code-adjacent content; the only honest way to ship one from elsewhere is a
  provenance and integrity model, which is real work and is not what this change is for. Meanwhile "absent
  until the evidence exists" is the rule this project already applies to unmeasured platform capability, and it
  keeps the capability's gate policy written while its activation waits.
- **Alternatives considered**: *(a)* A marketplace, as the reference provides
  (`https://omp.sh/docs/plugins`, UNVERIFIED) — rejected: its own documentation states that project scope is not
  a security boundary and a plugin runs with the same permissions as the host, which is a trust decision this
  product has not made. *(b)* Ship browser and desktop active and gate them at call time — rejected: a
  capability that is present and refuses trains the user to ask for it, and it puts an unmeasured surface one
  configuration mistake away from live. *(c)* Do not specify them at all until measured — rejected: their gate
  policy and irreversibility declarations are exactly what must exist *before* someone implements them.

### D8 — The browser capability drives a product-managed browser, not the user's own

- **Choice**: if and when the browser pack activates, it drives a browser instance the product owns, with its
  own profile. Attaching to the user's signed-in browser is out of scope.
- **Rationale**: the reference offers a relay that drives the user's real, logged-in tab through the debugger
  protocol, and describes it as the most capable path and the largest trust decision
  (`https://omp.sh/docs/web`, UNVERIFIED). An attached tab carries the user's whole session: every account they
  are signed into, not the one the job needs. This product's connector model exists precisely so that access is
  scoped, revocable and recorded; a debugger-attached browser is the opposite of all three.
- **Alternatives considered**: *(a)* The relay — rejected as above. *(b)* Reading pages without a browser at
  all — kept as the cheaper path for static content, but insufficient for rendered applications, which is why
  the pack exists.

### D9 — Redaction sits inside the wrapper, not at the reader

- **Choice**: the boundary is a step of the wrapper, applied to arguments before the intent record and to
  results before the result record. Unredacted values exist only in the call made against the platform.
- **Rationale**: redacting at display time leaves the secret in the record and in the replicated store, which is
  where it matters most under principle VII: replicated data is decryptable by the service by design, so the
  cheapest defence is not writing the secret down. Placing the boundary inside the wrapper makes "everything
  that leaves crosses it" structural (INV-AG-42) rather than a review rule.
- **Alternatives considered**: *(a)* Redact in the ledger writer — rejected: the transcript and the model
  request are two other exits. *(b)* Redact in the interface — rejected as above, and it leaves the value in
  every store. *(c)* Rely on tools declaring their secret fields — kept as an optimisation, but not as the
  mechanism: an undeclared field matching a declared pattern is redacted conservatively, because an omission by
  a tool author must not be a disclosure.

### D10 — The reference's approval semantics are refused, explicitly

- **Choice**: none of the following is adopted: a default mode that runs everything without asking; a child
  agent that runs as though the parent's approval covered it; a capability tier that decides on the tool's own
  declaration alone.
- **Rationale**: the reference documents its built-in default as `yolo` and states that subagents "run ordinary
  tier decisions as `yolo` because approval of the parent `task` call is their authorization boundary"
  (`https://omp.sh/docs/approvals`, UNVERIFIED). This product's gate evaluates every call against compiled rules
  outside the model loop, with a measured zero-bypass result over eleven routes
  (`spikes/SP-8-rule-ir-hardgate/REPORT.md` §1 Q2). Recording the refusal explicitly matters because the
  reference is otherwise being followed closely, and a later reader might reasonably assume the whole model came
  with it.
- **Alternatives considered**: *(a)* Adopt parent-approval-as-child-authorisation to avoid children waiting on
  approvals — rejected: a child's writes are writes against the user's real accounts. A child that needs
  approval waits, exactly as its parent would.

### D11 — Vocabulary is this product's, not the reference's

- **Choice**: *role*, *skill*, *capability pack*, *child job*, *interception point*. Not *subagent*, not
  *plugin*, not *prewalk*, and not the event names in the request (`before_tool`, `after_tool`, `on_message`,
  `on_error`, `pre_compact`).
- **Rationale**: two of those event names do not exist in the reference in that form — its surface is
  `tool_call`, `tool_result`, the message family, and the compaction family, with failure surfacing through a
  result's error flag rather than an `on_error` event (`https://omp.sh/docs/hooks`, UNVERIFIED). Naming a point
  after something that exists nowhere would leave a reader unable to check either source. *Subagent* is avoided
  because it names the thing principle I forbids.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading and registration.** Packs are enumerated and validated eagerly at start, because a pack contributes
  role entries and tool declarations that must exist before any agent starts. Skills are discovered eagerly but
  *read* lazily: the catalogue holds identifier, applicability, origin and validity; a body is read when a job
  loads it. Handlers are registered at start by the product and by activated packs, and the registration set is
  fixed for the process lifetime — there is no hot reload, because a handler appearing mid-job would make the
  account of that job's calls inconsistent.
- **Isolation and sandboxing.** In-process, deliberately. A pack is first-party content (D7), so process
  isolation would buy nothing that review does not already buy, and it would cost the per-session isolation
  model that is already VERIFIED. The isolation that matters here is *between jobs*, and that is the harness's
  per-instance session state (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q4), which children inherit by being jobs. If
  Q-3 is answered "third-party packs are permitted", this line is the first thing that must change, and the
  reserved variability slot in `model.md` is where that work attaches.
- **Resource management and eviction.** A skill body is released when the job that loaded it reaches a terminal
  state, like an attached image under the existing requirement. An assembled context is never persisted. A
  deactivated pack's contributions are withdrawn from the registry, the catalogue and the tool factory
  together, and jobs already running keep the tool set they started with — allowlists are frozen per session
  (INV-AG-33), so a withdrawal never changes what a running agent holds.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (specific ➔ general).** A preloaded skill that is missing ──> the agent starts without it, the
  absence is recorded, the job proceeds. A tool named by an allowlist that no connected connector generates
  ──> the agent starts with the tools that exist. A model whose profile declares no context window ──> the
  declared fallback budget, recorded as a fallback rather than as a derived figure.
- **Tier 2 (custom ➔ built-in).** An invalid or later-versioned pack ──> contributes nothing; the product runs
  with its built-in roles, skills and connector tools. An invalid account role entry ──> that role is
  unstartable and named; the six built-in entries are unaffected, because they are materialised by the product
  rather than read from the replicated document. An invalid skill ──> absent from the catalogue with the failing
  field named; every other skill loads.
- **Tier 3 (degraded safe-mode).** A registry or catalogue written against a later schema version ──> refused
  *whole*, the product asks for the update, and no agent starts against a partially understood entry. This is
  deliberately not a degraded mode that keeps working: reading around an unrecognised member means running work
  under an identity or an allowlist the user never assigned. A reduction ladder that cannot reach the budget
  ──> the job fails naming the budget, with its completed-operations list and its undo offer intact, rather
  than sending a request the provider will refuse. A pre-call handler that throws or hangs ──> the call is
  refused, fail-closed, and the refusal names the handler.

## Complexity Tracking

| Violation | Why needed | Simpler alternatives rejected because |
| --- | --- | --- |
| **Constitution § External Content Is Data enumerated two sources; this change creates four.** The design treats rendered pages, screen content and child reports as data by requirement (`specs/agent/spec.md`, `specs/job/spec.md`); the constitution's enumeration is amended by the dedicated change `req-026-external-content-sources` (constitution 2.0.0 → 2.1.0), not by this change | Amending the constitution requires a dedicated change with decision-maker approval and a version bump (§ Governance). This change must not perform that amendment silently, so it is carried beside it | Leaving the enumeration to be read as illustrative was rejected: it is written as a closed list of two, and a reader checking a browser tool against the constitution would find its source absent. The amendment precedes activation of either pack by construction, because it is already made |

No other constitutional deviation is claimed. Principle I is satisfied rather than deviated from (D2), and
principle II is satisfied by construction (D3, INV-AG-40, INV-AG-41).

## Research

### R1 — What context budget, and at what point does reduction begin?

- **Decision**: derive the ceiling from the assigned model's declared context window, hold a reserve, and begin
  reduction when the assembled context plus the expected next turn crosses the reserve. Pin neither the reserve
  fraction nor the retained-tail size in this change.
- **Rationale**: the figure belongs to the model the user assigned, and the user may reassign it; a fixed number
  would be wrong for every model but one. The threshold's *value* is a measurement this project does not have.
- **Alternatives**: a fixed token ceiling (wrong per model); a percentage copied from the reference
  (`https://omp.sh/docs/compaction` documents reserve-based sizing, UNVERIFIED) — copying a number from vendor
  documentation is precisely what Evidence Discipline forbids.
- **Source / verification status**: UNVERIFIED. Proposed spike **SP-23 — context budget and reduction**: run the
  SP-4 job corpus extended with long multi-target jobs, measure context growth per turn, the point at which each
  ladder step becomes necessary, what each step recovers, and the rate at which a run fails after summarisation.

### R2 — Does delegation hold its guarantees at depth?

- **Decision**: one level of depth, four unfinished children, children sharing the parent's per-account
  concurrency budget.
- **Rationale**: the neighbouring measurement is unambiguous — eight concurrent jobs on one account crossed into
  platform refusals at about five percent, three completed cleanly
  (`spikes/SP-15-concurrency/REPORT.md` §1 Q4, VERIFIED). Depth multiplies against that budget.
- **Alternatives**: the reference's defaults of two levels and thirty-two concurrent workers
  (`https://omp.sh/docs/subagents`, UNVERIFIED) — not adopted; they are defaults for a coding agent whose
  parallelism is bounded by a filesystem, not by a platform's rate limiter.
- **Source / verification status**: UNVERIFIED for the bounds themselves. Proposed spike **SP-24 — delegation
  under the gate**: run a parent with four children against one account; measure gate behaviour on children's
  calls, accumulated-count rules spanning parent and children, cancellation propagation, recovery with children
  in flight, and whether a child's report can carry an instruction that changes the parent's behaviour.

### R3 — Does the redaction boundary actually hold?

- **Decision**: classify by declaration plus a conservative pattern default, replace with a typed reference,
  place the boundary inside the wrapper.
- **Rationale**: the exits are four and they are all downstream of the wrapper; placing the boundary anywhere
  else leaves one of them open.
- **Alternatives**: declaration-only (an omission becomes a disclosure); display-time redaction (leaves the
  value in every store).
- **Source / verification status**: UNVERIFIED. Proposed spike **SP-25 — redaction over a seeded corpus**: seed
  tokens, keys and personal identifiers into connector payloads, user commands and attachments; measure what
  reaches a model request, a stored transcript, a ledger record and a replicated envelope, and the false-positive
  rate against ordinary content.

### R4 — What is true of the browser and desktop surfaces on the supported platforms?

- **Decision**: specify both, ship both inactive, and make the activation condition the measurement itself.
- **Rationale**: everything the reference says about screen capture, accessibility trees, background input and
  platform permissions is vendor documentation about a different runtime
  (`https://omp.sh/docs/computer`, `https://omp.sh/docs/web`, UNVERIFIED). This project has measured OS-level
  behaviour before and found the documentation incomplete more than once.
- **Alternatives**: activate on vendor documentation (forbidden by Evidence Discipline); omit the specification
  (leaves a capability to arrive later without a gate policy).
- **Source / verification status**: UNVERIFIED. Proposed spike **SP-26 — browser and desktop capability**:
  on Windows and macOS, measure what a page read and a screen read actually return, whether an instruction
  embedded in a page or a window can alter agent behaviour end to end, which desktop actions can be read back
  (and therefore compensated) and which cannot, and what the OS permission flow costs the user.

Spike identifiers are proposed; `spikes/` currently holds SP-0 through SP-22.

## Migration & Rollback

**Migration 1 — routing table to tiers.** An existing table holds six assignments keyed by the closed role
names. The six built-in role entries name tiers with those same identifiers, so migration is a re-key and not a
re-choice: no role is silently reassigned, which is the property INV-AG-24 protects. An unassigned role stays
unassigned. Nothing is proposed to the user automatically.

**Migration 2 — session records.** A stored transcript written before this change carries one of the four old
`AgentRole` values and no lineage. It is read as the corresponding built-in role identifier with no parent.
Stored transcripts are never rewritten: they are append-only account data, and the reading side does the
translation.

**Migration 3 — job records.** A job record with no child link reads as a top-level job. Nothing backfills, and
`waiting_children` never appears in a job written before this change.

**Rollback.** A device running the previous assembly that meets a replicated registry, skill catalogue or child
job record refuses the store whole and asks for the update — the behaviour `agent/contracts/role-routing@0.1.0`
already defines for a table version ahead of the build, for the same reason. Rolling back the product therefore
degrades to "cannot read the newer account data" rather than to "runs work under an identity it does not
understand". Within this change, disabling a capability pack is the rollback for that capability and takes
effect for jobs created afterwards.

## Risks / Trade-offs

- [A specification this wide outruns its evidence] → four capabilities ship inactive or bounded, and each of the
  four unmeasured areas has a named spike in Research with its activation condition attached.
- [The registry becomes a way to give an agent tools it should not have] → the allowlist is resolved once and
  frozen per session (INV-AG-33), every tool still comes from the factory, and every call is still gated; a
  badly authored role can waste a job, not escalate one.
- [Delegation multiplies platform load] → children share the per-account budget rather than receiving one, and
  the bound is set below the measured refusal threshold of `spikes/SP-15-concurrency/REPORT.md` §1 Q4.
- [A child's report is a new injection carrier into a parent that holds tools] → INV-JOB-09 makes it external
  content wherever it is read, and SP-24 measures the claim end to end.
- [Reduction loses something the run needed] → three of the four steps remove only superseded, empty or
  ledger-recoverable material; the protected set is closed; every reduction is recorded against the job.
- [Redaction breaks a tool by redacting something it needed] → the boundary projects what *leaves* the wrapper;
  the adapter receives the unredacted arguments, so no platform call is affected.
- [First-party-only packs become a bottleneck] → accepted deliberately, with the provenance work scoped as a
  reserved slot rather than half-built now.
- [A reader treats the reference architecture as a dependency] → the harness-pin requirement now says so in
  words (`specs/agent/spec.md`), and the refusal of `@oh-my-pi/*` remains an assembly failure.

## Open Questions

- Whether a child job is shown to the user as a job of its own or as progress inside its parent. This is
  `uix`'s decision and changes nothing here: the records exist either way.
- Whether the skill catalogue eventually needs search, once a catalogue is large enough that applicability text
  alone stops discriminating. Deferred until a catalogue exists to measure.

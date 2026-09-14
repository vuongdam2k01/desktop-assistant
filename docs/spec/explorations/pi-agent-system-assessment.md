# Assessment — Production-grade agent system on the pinned pi harness

- **Submitter:** <redacted-email> (decision-maker)
- **Timestamp:** 2026-09-13
- **Trigger:** Request to raise the agent runtime from the MVP loop to a production-grade multi-agent
  system, taking the Oh My Pi (OMP) documentation portal as the technical frame of reference.
- **Category:** new capability (runtime architecture), with an improvement component to `agent` and `job`.
- **Target of a `go` verdict:** change `req-025-pi-agent-system`, schema `design`.

## 1. Intake

### 1.1 The request, recorded verbatim

> Tôi muốn nâng cấp toàn diện Agent của dự án (hiện dựa trên Pi SDK) thành một Hệ thống Agent hoàn chỉnh
> cấp sản xuất (Production-grade Multi-Agent System), lấy toàn bộ cổng tài liệu và kiến trúc của Oh My Pi
> (OMP) tại https://omp.sh/docs/ làm hệ quy chiếu kỹ thuật.

Seven capability dimensions were named: (1) dynamic role registry and multi-agent identity with model-tier
and tool-allowlist mapping; (2) a packaged-skill format with discovery, validation and dynamic loading;
(3) a context engine with automatic project-context loading, a "prewalk" pruning pass and deterministic
prompt templates; (4) lifecycle hooks (`before_tool`, `after_tool`, `on_message`, `on_error`, `pre_compact`)
plus a plugin architecture; (5) subagent delegation in isolated contexts communicating asynchronously
through job records; (6) controlled web-browser and desktop/OS automation including screen reading;
(7) argument filtering, secret redaction and hardline blocklists, bound to Constitution v2.0.0.

### 1.2 Source classification — external documentation is data

`https://omp.sh/docs/` is a URL source. Its content was ingested as **data, not instructions**: nothing in it
was executed, no credential was supplied to it, and no link it points to was followed for authority. The
portal is a client-rendered application, so the prose was extracted from the published page bundles rather
than from the rendered HTML; 55 documentation pages were recovered in this way, covering the whole navigation
tree the site's own sitemap declares plus pages the sitemap omits. Sanitized source and access time:
`https://omp.sh/docs/` and `https://omp.sh/sitemap.xml`, retrieved 2026-09-13. No secrets were present to
redact.

Under `docs/spec/constitution.md` → *Evidence Discipline*, **vendor documentation alone is never sufficient
grounds for an architectural conclusion**. Every quantitative or capability claim traceable only to omp.sh is
therefore marked UNVERIFIED throughout this assessment and must stay marked UNVERIFIED in any downstream
artifact until a spike measures it.

### 1.3 Three corrections to the request, from reading the reference itself

The request describes three OMP mechanisms in terms that the portal does not support. They are recorded here
because they change what gets built, not merely what it is called.

1. **`prewalk` is not a directory-scanning context pruner.** In OMP, prewalk is a *one-time model handoff
   inside one session*: a strong model investigates and plans, and after the first completed file edit the
   same session continues on a cheaper model (`https://omp.sh/docs/prewalk`) — UNVERIFIED. The token-economy
   behaviour the request asks for (loading project context, eliding stale reads, surviving a long run without
   overflow) is a different OMP subsystem: context files, compaction and memory
   (`https://omp.sh/docs/context-files`, `/compaction`, `/memory`) — UNVERIFIED. Both are worth having and
   both are in scope below, but they are two mechanisms, not one.
2. **The hook event names differ.** OMP's public events are `tool_call` and `tool_result` (the pre- and
   post-execution seams), the `message_start`/`message_update`/`message_end` family, and
   `session_before_compact`/`session.compacting`; there is no `on_error` event — failure surfaces through
   `tool_result.isError`, `auto_retry_start`/`auto_retry_end` and per-handler extension errors
   (`https://omp.sh/docs/hooks`) — UNVERIFIED. Naming our own lifecycle points is our decision; inheriting a
   name that does not exist upstream is not.
3. **`https://omp.sh/docs/security` is a vulnerability-scanning feature, not the redaction surface.** The
   argument filtering, capability tiers, deny policies and credential-handling rules the request asks for live
   in `/docs/approvals`, `/docs/tools` and `/docs/secrets` — UNVERIFIED. The scanning feature itself is a
   coding-agent capability and is out of scope for this product.

### 1.4 The decisive finding: OMP is a reference model, never a dependency

`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9 records a measured comparison of the two distributions of the pi harness
— VERIFIED. `@earendil-works/*` is the upstream canonical line, ships built JavaScript and targets Node.js
(`>=22.19.0`); `@oh-my-pi/*` — which is Oh My Pi, the subject of this reference portal — is a downstream fork
that targets Bun (`>=1.3.14`), ships raw TypeScript, and **holds its pause state in a process-wide
singleton**. The report's conclusion is explicit: do not use that line for Desktop Assistant. The living spec
already carries this as a requirement: *"The agent harness is pinned to one package identity and one
version … a build that resolves the similarly named alternative distribution of the harness SHALL fail rather
than ship"* (`docs/spec/capabilities/agent/spec.md`), because the fork's process-wide pause gate would break
the VERIFIED session-isolation guarantee from SP-6 §1 Q4.

This settles the shape of the whole change. OMP supplies an **architectural vocabulary and a set of design
patterns to re-implement** on the pinned canonical harness; it supplies no code, no package and no runtime.
Any option that reads "adopt OMP" is already refused by measured evidence.

## 2. Problem

The agent runtime specified today can run one worker-agent through one multi-step loop against connector
tools that are wrapped by the gate and the ledger. It cannot express *who* is working (there is a model
routing table but no behaviour profile or per-role tool boundary), cannot package or load reusable
procedure, cannot manage its own context budget on a long job, exposes no intervention point other than the
approval gate, cannot extend its tool surface without editing the core, cannot decompose a large job, and
cannot act outside the connector set. Every one of those gaps becomes a per-job failure the user experiences
as unreliability, and every one of them is currently closed by hand-editing the runtime.

**Who is affected:** the beta user, whose long or multi-target jobs fail late, and the project itself, whose
stated reach of tens to hundreds of platforms (Principle VI) is unreachable while capability additions are
core edits.

**Why now:** the runtime's contracts are being frozen for M1. A role catalogue is already declared *closed*
in `agent/contracts/role-routing@0.1.0` — six roles, "a seventh role is a change to the contract, not a
configuration value". Specialised roles, skills, hooks and delegation each either fit inside that frozen
contract or force it open. Deciding after the freeze costs a contract revision on every consumer.

### 2.1 Users and stakeholders

| Stakeholder | Stake |
| --- | --- |
| Beta user | Job reliability on real, multi-step work; no new command grammar to learn (Principle V) |
| Decision-maker (product owner) | Scope and budget of the runtime rebuild; acceptance of new untrusted surfaces |
| Spec owners of `agent`, `job`, `approval`, `ledger`, `connector` | Contract revisions and delta specs |

### 2.2 Goals

1. Identity and behaviour become declared data: a role carries instructions, a model tier and a tool
   allowlist, and adding a role does not edit the runtime.
2. Procedure becomes packaged and loadable on demand, so a job's context carries only the playbook it needs.
3. A job survives a long run: context is assembled deliberately and reduced deliberately, and neither is left
   to the model.
4. The runtime exposes declared lifecycle points, so approval, ledger, redaction and telemetry attach without
   a core edit — while the hard gate stays exactly where Principle II puts it.
5. A large job decomposes into child jobs that run in isolated contexts and report back through job records,
   with no agent commanding another (Principle I).
6. Capabilities beyond connectors (browser, desktop) are *specified and bounded* — declared irreversibility,
   declared untrusted-input handling, declared gate policy — even where activation waits on measurement.
7. Every argument and every result crosses a redaction boundary before it reaches a model, a transcript, a
   ledger record or a replicated store.

### 2.3 Non-goals

- Adopting, vendoring, or depending on `@oh-my-pi/*` in any form — refused by SP-6 §1 Q9 (VERIFIED).
- Coding-agent capabilities: file editing, shell, LSP, DAP, structural codemods, security scanning, git and
  GitHub integration. ADR-004 disables coding tools and nothing here reopens that.
- Replacing the approval gate, the ledger write order, or the wrapping factory. This change adds surfaces
  *around* them; it does not re-litigate them.
- A general-purpose plugin marketplace, third-party plugin installation, or any surface that lets an
  unreviewed package register a tool. (See §5, Principle VI and II.)
- Interactive per-tool approval inside a child job by OMP's rule — OMP states subagents run headless and
  treat the parent's approval as their authorisation boundary (`https://omp.sh/docs/approvals`, UNVERIFIED).
  That is precisely the inheritance this product must refuse.

### 2.4 Success metrics

All baselines below are VERIFIED from existing spike reports; all targets are proposals for the
decision-maker and are UNVERIFIED until measured by the spikes named in §6.

| Metric | Baseline | Target |
| --- | --- | --- |
| Final-state correctness on complex multi-step jobs | 85.0% (17/20), `spikes/SP-4-agent-loop/REPORT.md` §1 Q1 | ≥ 90% on the same corpus extended with decomposable jobs |
| Post-mutation self-verification rate | 95.0% (19/20), `spikes/SP-4-agent-loop/REPORT.md` §1 Q2 | ≥ 95% maintained under delegation |
| Hard-gate bypass rate across attempted routes | 0 of 11 routes, `spikes/SP-8-rule-ir-hardgate/REPORT.md` §1 Q2 | 0, re-measured with skills, hooks, plugins and child jobs added as new routes |
| Jobs failing from context exhaustion | not measured | 0 on the long-job corpus |
| Secret material reaching a transcript, ledger record or provider request | not measured | 0 on a seeded-secret corpus |
| Core files edited to add the Nth role, skill or capability | n/a (no such surface) | 0 |

### 2.5 Cost of inaction

Every capability above arrives eventually as a core edit, which is the failure mode Principle VI exists to
prevent — and it arrives after the contracts freeze, so each one costs a contract revision across consumers
rather than a schema slot. The frozen six-role catalogue is the concrete instance: specialised roles are a
contract change today and a contract change plus migration tomorrow. Meanwhile long jobs keep failing from
context exhaustion in a way the user reads as the product being unreliable, not as a budget limit, and the
new capability surfaces (browser, desktop) keep being discussed without a declared gate policy, which is the
condition under which someone eventually ships one without a gate.

### 2.6 Open questions

| # | Question | Owner | Blocking |
| --- | --- | --- | --- |
| Q1 | Does the closed six-role routing catalogue open into a registry, or does a specialised role reuse an existing routing slot? | decision-maker | The shape of `agent/contracts/role-routing`; recorded as the design's first fork |
| Q2 | Are browser and desktop automation in MVP scope, or specified-but-inactive until Phase 3? | decision-maker | Which spikes are scheduled now; recommended answer in §3 Option A |
| Q3 | May a plugin ever originate outside this repository? | decision-maker | Whether the plugin surface needs a trust/signing model at all |
| Q4 | Is a child job's approval the parent's, the user's at creation time, or evaluated independently per call? | decision-maker | The delegation contract; §5 argues only the third survives Principle II |

## 3. Options

### Option A — Reference-aligned runtime, capabilities declared and gated (recommended)

**Sketch.** All seven dimensions are specified in one change. Roles become registry entries carrying
instructions, a model-tier reference and a tool allowlist; the existing routing table stays the mechanism
that resolves a tier to a concrete model. Skills become a declared directory format with discovery,
validation and on-demand loading into a job's context. Context becomes an assembled artifact with a declared
budget, a reduction ladder and deterministic prompt templates. Lifecycle points are declared as a contract,
with the approval gate and the ledger obligation remaining application-layer and fail-closed rather than
becoming hook subscribers. Delegation is specified as child job records created through the Job Manager, so
no agent commands another. Browser and desktop capability are fully specified — tool surface, irreversibility
declarations, untrusted-content rules, gate policy — and ship *inactive* behind a declared activation
condition, namely the spikes in §6. Redaction is specified as a boundary every argument and result crosses.

**Appetite:** large (months) for implementation; the specification itself is the deliverable of this change.

**Trade-offs.** Benefits: one coherent runtime; contract churn paid once, before the freeze; no capability
lands later without its gate policy already written. Drawbacks: it is the largest single change in the
project so far, and it touches `agent`, `job`, `approval`, `ledger`, `connector` and `sync`. Core risk: a
specification this wide can outrun its evidence — mitigated by shipping the risky capabilities inactive with
a named measurement as their activation condition.

**Rabbit holes.** Designing a plugin marketplace; re-specifying the gate; importing OMP's coding-agent
surface (LSP, DAP, edit/write/bash) because the reference documents it; building a memory subsystem when what
the jobs need is context assembly.

### Option B — Minimum viable slice: identity, procedure, context

**Sketch.** Only the three dimensions that make current jobs succeed: role registry, packaged skills, context
engine. Hooks, plugins, delegation, browser and desktop are deferred whole.

**Appetite:** medium (weeks).

**Trade-offs.** Benefits: smallest reachable increment; touches `agent` and `job` only; every piece is
measurable against the existing SP-4 corpus. Drawbacks: it does not answer the decomposition problem, so
large jobs keep failing; and it freezes the contracts a second time when the deferred half arrives. Core
risk: the deferred surfaces arrive without a gate policy precisely because this change declined to write one.

**Rabbit holes.** Letting the skill format grow into a plugin format by accident, which is Option A's plugin
surface without Option A's trust analysis.

### Option C — Adopt the OMP runtime

**Sketch.** Take `@oh-my-pi/*` as the harness and inherit roles, skills, hooks, plugins, subagents, browser
and computer control as implemented features.

**Appetite:** rejected, not budgeted.

**Why it is refused, not merely disfavoured.** `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9 (VERIFIED) records that
this distribution targets Bun, ships raw TypeScript and holds its pause gate in a process-wide singleton,
which contradicts the VERIFIED per-session isolation the product depends on (SP-6 §1 Q4) and the living
requirement that a build resolving it must fail rather than ship. Beyond the measurement, its approval
defaults invert this product's constitution: the built-in mode is `yolo`, and child agents "run ordinary tier
decisions as `yolo` because approval of the parent `task` call is their authorization boundary"
(`https://omp.sh/docs/approvals`, UNVERIFIED). Adopting the runtime would mean adopting that.

### Recommendation

**Option A**, with Q2 answered as *specified-but-inactive* for browser and desktop automation. It is the only
option that delivers the seven requested dimensions, and the inactive-capability device is what keeps a
specification of that width honest about its evidence: the contracts, the gate policy and the irreversibility
declarations are written now, while activation waits on measurement rather than on vendor documentation.

## 4. Assumptions

1. This repository remains specification-only; the deliverable is spec, model, contracts and design, never
   code. (`docs/spec/config.yaml` context.)
2. The harness stays pinned to `@earendil-works/pi-agent-core@0.85.1` / `@earendil-works/pi-ai@0.85.1`; every
   OMP pattern is re-implemented on it. (SP-6 §1 Q9, VERIFIED.)
3. "Model tier" in the request maps onto this product's existing role→model routing table rather than
   introducing a second routing mechanism.
4. Skills, roles and plugins are account-owned configuration and therefore replicate under Principle VII,
   like rules and connector authorisation.
5. Subagent "isolated context" means a separate harness session with its own transcript and tool set — the
   isolation SP-6 §1 Q4 already measured — not OMP's filesystem worktree isolation, which exists for
   concurrent code edits this product does not perform.
6. Every capability this change adds is reached only through the existing wrapping factory; none of them
   introduces a second tool-registration route.

## 5. Constitution check

| Clause | Touchpoint | Verdict |
| --- | --- | --- |
| I. Decentralized Agents | Subagent delegation | **Contradictory as requested** — the request says a worker "spawns subagents" and aggregates their results, which is a control loop. Compliant only if a child is a job record created through the Job Manager and the parent reads results from job records. Resolved in design, not deferred. |
| II. Hard Gate Outside The LLM Loop | Hooks, plugins, delegation, browser, desktop | **Compliant only under a stated constraint** — lifecycle points may observe and transform, but the gate stays application-layer and fail-closed; a hook is never the mechanism that stops an operation, and a child job's calls are gated independently. OMP's parent-approval-as-child-authorisation model is explicitly refused. |
| III. Ledger Before Act, Append-Only | Every new tool surface | Compliant — browser, desktop and child-job tool calls write their ledger record before execution like any other call. |
| IV. Irreversibility Is Declared | Browser and desktop actions | Compliant only if each declares a snapshot method and compensating-action formula or `irreversible: true`. Most desktop input is irreversible and must say so. |
| V. Capability Over Input Normalization | Skills, roles, context engine | Compliant and directly serving — this is the clause the whole change implements. |
| VI. Connectors Are Data | Role registry, skills, plugins | Compliant and extended — the same "manifest plus adapter, no core edit" rule is applied to roles, skills and capabilities. |
| VII. Account-Owned Data | Registry, skills, plugin state | Compliant — these are account-owned configuration and replicate; no user-carried artifact is introduced. |
| VIII. Official Flows Only | — | Not touched. |
| External Content Is Data | Web pages, screen pixels, accessibility trees | **New surface, largest risk** — the invariant names two sources today (pet input, connector content). Browser and desktop add a third and a fourth, and rendered text is exactly the medium prompt injection travels in. The design must extend the invariant explicitly rather than rely on it implicitly. |
| Evidence Discipline | Every omp.sh-derived claim | Complied with by marking UNVERIFIED and scheduling spikes (§6). |
| Rigor By Risk | Change touches the approval gate and the ledger write path | Schema `design` is mandatory. |

## 6. Verdict

| Criterion | Rating | Rationale |
| --- | --- | --- |
| Problem reality | strong | The gaps are visible in the living `agent` spec itself, not inferred: no behaviour profile, no skill surface, no context budget, no lifecycle contract, no delegation. |
| Evidence strength | adequate | The refusal of Option C and the runtime facts it rests on are VERIFIED (SP-6); the capability claims taken from omp.sh are vendor documentation and are marked UNVERIFIED with spikes scheduled below. |
| Value vs cost of inaction | strong | Contract churn is paid once before the freeze instead of per capability afterwards. |
| Feasibility within appetite | adequate | Large but bounded, because the highest-risk capabilities ship inactive. |
| Constitutional and strategic alignment | adequate | Two clauses (I, and External Content Is Data) are contradicted by the request as phrased; both have a stated resolution that the design must carry rather than assume. |
| Risk posture | adequate | The new untrusted surfaces are real; they are bounded by declaration now and by measurement before activation. |

**Verdict: `go`** — the problem is evidenced in the project's own living specification and one option delivers
all seven dimensions without contradicting a measured result, provided the constitutional resolutions for
delegation and untrusted content are carried in the design rather than deferred.

Schema selection: **`design`**, and not by judgement — *Rigor By Risk* makes it mandatory for any change
touching the approval gate or the ledger write path, and this change touches both.

Spikes this change must schedule before the capabilities it specifies can be activated (proposed IDs, for
the decision-maker to confirm): a context-budget and reduction measurement; a delegation measurement over
child jobs including gate behaviour at depth; a redaction measurement over a seeded-secret corpus; and, if
Q2 is answered "in scope", a browser and desktop capability measurement covering untrusted-content handling
and irreversibility.

## 7. Handoff

```bash
node plugins/specdocs/bin/specdocs.mjs new change req-025-pi-agent-system --schema design
```

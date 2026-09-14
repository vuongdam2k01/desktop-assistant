# Impact: req-025-pi-agent-system

Triggers found in `proposal.md`: a non-empty `### Modified Capabilities` (`agent`, `job`), two **BREAKING**
markers, a contract revision (`agent/contracts/role-routing`), and persistent data (role registry, skill
catalogue, child-job records).

**Consumer evidence, compiled manually.** `spec-check.mjs consumers <contract>` returns `CONS_NONE — No
contracts found in capabilities/*/contracts/` for every contract queried, because no change has been archived
yet and therefore no contract has been merged into a living capability. The consumer lists below were compiled
from the `consumers:` front-matter of every contract document under `docs/spec/changes/*/contracts/`, and
cross-checked by grep for each contract's name across `docs/spec/`. Contracts queried and found empty by the
script: `role-routing`, `agent-session`, `tool-wrapping`, `worker-loop`, `ask-user`, `gate-evaluation`,
`ledger-record`, `connector-manifest`, `coordination-declaration`, `replicated-store-descriptor`.

## History Reviewed

| Capability | Changes Read | Relevant Past Decisions | Historical Rationale |
| --- | --- | --- | --- |
| `agent` | `req-007-pi-sdk-harness` | Every tool is produced by one wrapping factory, which privately holds the implementation; the engine's own call-interception facility is deliberately unused; a session is constructed from the factory's output or not at all | A guarantee resting on an upstream project's middleware rests on that project's roadmap. The bypass test ran with the facility unconfigured and still refused — `spikes/SP-6-pi-sdk/REPORT.md` §1 Q2 (VERIFIED). Any new tool surface this change adds inherits that rule rather than negotiating it |
| `agent` | `req-007-pi-sdk-harness` | The harness is pinned to `@earendil-works/pi-agent-core@0.85.1`; a project assembly resolving `@oh-my-pi/*` must fail rather than ship | The fork targets Bun, ships raw TypeScript and holds pause state in a process-wide singleton, which breaks the per-session isolation measured in §1 Q4 — `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9 (VERIFIED). This is the decision that makes the present change a re-implementation of a reference architecture rather than an adoption of it |
| `agent` | `req-017-provider-matrix` | The role catalogue is **closed** at six; a table-wide default profile is forbidden (INV-AG-23); an absent role is forbidden because absence is how a role acquires an implicit default (INV-AG-24); resolution never substitutes on failure | Substitution is a silent failure mode with measured consequences: the cheap model silently downgraded 25% of uncompilable rules — `spikes/SP-2-rule-elicitation/REPORT.md` §0 (VERIFIED). The registry introduced here must preserve *no-substitution* and *no-implicit-default* while opening the catalogue, or it reopens a closed failure |
| `agent` | `req-006-agent-loop` | A tool result must travel in `{ content: [...], details }`; the injected prompt context carries a temporal anchor, the tool list and a turn ceiling; a write is followed by a verifying read before completion is reported | A tool returning a plain object serialises to an empty content array and the model plans against output it cannot see — `spikes/SP-4-agent-loop/REPORT.md` §1 Q5 (VERIFIED). The context engine assembles *around* this envelope; it does not replace it |
| `agent` | `req-021-ask-user-offline` | At most one open ask per job, enforced at the execution layer; an answer never satisfies a gate decision | An affirmative answer to "may I override" still produced 100% blocking with zero bypass — `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q7 (VERIFIED). Delegation must not become a second route to the same evasion: a child job cannot answer for a user, and a parent's instruction is not an approval |
| `agent`, `approval` | `req-009-rule-ir-hardgate`, `req-011-risk-judge` | Every verdict is decided by a closed expression outside any model; evaluation fails closed; untrusted environment content in tool arguments is isolated from risk-judge evaluation | Eleven bypass routes were attempted and none succeeded — `spikes/SP-8-rule-ir-hardgate/REPORT.md` §1 Q2 (VERIFIED). Web pages, screen content and child-job output are new carriers of exactly the content that isolation exists for |
| `job` | `req-013-sqlite-ledger`, `req-015-concurrency-coordinator` | Concurrency is bounded per connector account (four, one slot reserved for the user's own job); a waiting job releases its slot; a tool call with no recorded outcome puts the job in `recovering` | Eight concurrent jobs crossed into platform refusals at ~5% — `spikes/SP-15-concurrency/REPORT.md` §1 Q4 (VERIFIED). Delegation multiplies jobs, so a child must consume the same bounded budget rather than a private one |
| `job` | `req-022-account-sync` | A job executes only on the device that created it; every replicated store declares its own conflict-resolution rule | Two devices running the same job would duplicate real-world effects. A child job inherits this: it runs where its parent runs, and its record replicates for visibility, not for execution |
| `pet` | `req-024-pet-pack-framework` | A pack is a manifest plus assets, loaded whole or not at all, with paths confined to the pack directory and declared size ceilings | The precedent this change reuses for the skill package and the capability pack: same manifest-plus-assets shape, same whole-or-nothing load, same path confinement — rather than a second packaging idiom for the same problem |

No archived changes exist (`docs/spec/changes/archive/` is empty); the history above is read from active changes
whose artifacts are `specified`, which is the only history this project has.

## Affected Components

| Type | Name | Current Version | Consumers | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| contract | `agent/contracts/role-routing` | 0.1.0 | agent, pet, uix, app, approval, undo, sync | **BREAKING** | The `Role` union is closed by construction and every consumer reads it as six fixed members; a registry opens it. Its own Compatibility section already declares "adding, removing or renaming a role" as MAJOR |
| contract | `agent/contracts/agent-session` | 0.1.0 | agent, job, approval, sync, ledger, app, uix | **BREAKING** | `AgentRole` is a closed union of four; sessions must carry a registry role identifier, plus lineage for a child job. Same reasoning as above |
| contract | `agent/contracts/tool-wrapping` | 0.1.0 | agent, approval, ledger, connector, job, undo | compatible | The four steps and their order are unchanged. Redaction declarations are optional members, and an undeclared tool receives the conservative default, so no existing registration becomes invalid |
| contract | `agent/contracts/worker-loop` | 0.1.0 | job, connector, app | compatible | The result envelope is untouched; the injected prompt context gains optional members for assembled context and loaded skills |
| contract | `agent/contracts/provider-profile` | 0.1.0 | agent, platform, app, uix, sync | compatible | Unchanged. Tiers resolve through `role-routing`, which is the only consumer relationship that moves |
| contract | `agent/contracts/provider-failure` | 0.1.0 | agent, uix, pet, app, job, approval | compatible | Unchanged. A child job's provider failure is classified by the existing declared causes |
| contract | `agent/contracts/usage-accounting` | 0.1.0 | agent, app, job, ledger, sync | compatible | Unchanged in shape; a child job's requests are recorded against the child, which already carries a job identifier |
| contract | `agent/contracts/ask-user` | 0.1.0 | job, uix, app | compatible | Unchanged. The single-open-ask rule is per job, and a child is a job, so the rule applies to it unmodified |
| contract | `approval/contracts/gate-evaluation` | 0.1.0 | agent, connector, ledger, uix, job | compatible | Not modified, but newly exercised from three new call sites (child job, capability pack, lifecycle-transformed argument). This is the highest-risk "compatible" row in this table and is why gate regression is listed below |
| contract | `ledger/contracts/ledger-record` | 0.1.0 | ledger, job, undo, approval, connector, sync, app, uix, agent | compatible | Record shape unchanged; the redaction boundary changes the *values* recorded for secret-bearing fields, not the schema. The `ledger` requirement "the full account of one step" gains a clause and two scenarios in this change's `specs/ledger/spec.md` stating that a typed reference is the account of a secret value (Q-6, decided) |
| requirement | `ledger` — "A ledger record carries the full account of one step" | — | — | MODIFIED | One clause and two scenarios added; no other ledger requirement changes |
| contract | `job/contracts/tool-reconciliation` | 0.1.0 | job, ledger, connector, undo, app, uix | compatible | Unchanged; a child job reconciles its own calls exactly as a top-level job does |
| contract | `connector/contracts/resource-coordinator` | 0.1.0 | connector, agent, job, ledger, approval, app, uix | compatible | Unchanged, but a parent and its children must share one pacing budget per authorisation; the coordinator already keys on the authorisation rather than the job |
| contract | `sync/contracts/replicated-store-descriptor` | 0.1.0 | sync, and every owning capability | compatible | Three new stores register through it rather than changing it |
| contract | *new* `agent/contracts/role-registry` | — | agent, job, approval, uix, app, sync | new | Role identity, instructions, tier reference, tool allowlist, delegation permission, skill preload |
| contract | *new* `agent/contracts/skill-manifest` | — | agent, job, app, uix, sync | new | Skill package descriptor, discovery, validation, precedence |
| contract | *new* `agent/contracts/job-delegation` | — | agent, job, approval, ledger, uix, app | new | Child-job creation, result envelope, lineage, depth and fan-out bounds |
| contract | *new* `agent/contracts/runtime-lifecycle` | — | agent, approval, ledger, connector, job | new | The interception points, their ordering, their budget, and what they may never do |
| contract | *new* `agent/contracts/context-assembly` | — | agent, job, app, uix | new | Context sources, token budget, reduction ladder, prompt templates |
| contract | *new* `agent/contracts/capability-pack` | — | agent, approval, connector, job, app, uix, sync | new | Packaged tools, roles and skills; activation state for inactive capabilities |
| contract | *new* `agent/contracts/secret-redaction` | — | agent, ledger, approval, connector, sync, uix | new | Redaction classes, the reference form, and where the boundary sits |
| requirement | `agent` — all 33 | — | — | regression | Full set reruns; the catalogue change touches the six routing requirements directly |
| requirement | `job` — all 10 | — | — | regression | Lifecycle gains a parent/child relation, so every state-transition scenario reruns |
| requirement | `approval` — all 32 | — | — | regression | Not modified; rerun because three new call sites reach the gate |
| cluster | `agent-runtime` (pet, agent, job) | — | — | **BREAKING** | Its declared constraint is "shared pi agents SDK harness and job lifecycle states", and this change alters the lifecycle and the session identity. The full combination matrix reruns |
| cluster | `trust-chain` (ledger, undo, approval) | — | — | compatible | Reruns because the ledger-before-act precondition is now exercised from child jobs and capability packs |
| stored-data | role registry | — | replicated (principle VII) | new | No production data exists; created empty with the six built-in entries |
| stored-data | skill catalogue state | — | replicated | new | Enabled/disabled state and precedence resolution; the packages themselves ship with the product |
| stored-data | child-job records | — | replicated for visibility, executed only on the creating device | **BREAKING** | Existing job records gain a parent reference; a record written by an older assembly has none, which reads as a top-level job |

## Decision: Merge or Split

**Merge**, with one condition.

Merge is correct because every modified contract is owned by `agent` and every consumer revision it forces is
a revision of `agent` or `job` specs, both of which are in this change. The consumer counts look large —
`role-routing` names seven consumers, `agent-session` seven — but the break they carry is confined: consumers
read a role identifier; the identifier's *provenance* moves from a closed union to a registry, and the reading
side changes shape without changing meaning. No other capability owner has to make a decision for this change
to be coherent.

The condition: the three capabilities that are exercised in new ways but not modified — `approval`, `ledger`,
`connector` — are recorded here with their owners' questions stated rather than silently assumed compatible.
Two of these questions were genuinely theirs to answer; both were decided on 2026-09-13 and are recorded in
`clarifications.md` § Sessions:

1. **`ledger`** (Q-6): the boundary replaces secret-bearing argument values with references before they reach a
   record. A typed reference naming the secret's class and the field it occupied counts as the account of that
   value. Rather than leave that as an agent-side reading of a ledger requirement, this change carries a
   MODIFIED delta for `ledger` (`specs/ledger/spec.md`) adding the clause and two scenarios; record shape is
   unchanged, so `ledger-record@0.1.0` stays compatible and no split is needed.
2. **`approval`** (Q-5): accumulated counts span a parent and its children. No `approval` delta is needed,
   because the existing requirement already reads counts from the account's ledger — across every job and every
   device signed in to the account — so a parent's and its children's calls are counted together by
   construction; per-job counting would have been the change, and it is refused because splitting work across
   children would escape a counting rule.

## Versioning

| Contract | From | To | Rationale |
| --- | --- | --- | --- |
| `agent/contracts/role-routing` | 0.1.0 | 1.0.0 | MAJOR — the closed six-member `Role` union becomes a registry reference. The contract's own Compatibility section already classifies adding or renaming a role as MAJOR |
| `agent/contracts/agent-session` | 0.1.0 | 1.0.0 | MAJOR — `AgentRole` opens to a registry identifier, and a session gains lineage members that a consumer must understand to render a child correctly |
| `agent/contracts/tool-wrapping` | 0.1.0 | 0.2.0 | MINOR — optional redaction declaration; the four-step order and the factory's exclusivity are untouched |
| `agent/contracts/worker-loop` | 0.1.0 | 0.2.0 | MINOR — optional prompt-context members for assembled context and loaded skills |
| `agent/contracts/role-registry` | — | 1.0.0 | New |
| `agent/contracts/skill-manifest` | — | 1.0.0 | New |
| `agent/contracts/job-delegation` | — | 1.0.0 | New |
| `agent/contracts/runtime-lifecycle` | — | 1.0.0 | New |
| `agent/contracts/context-assembly` | — | 1.0.0 | New |
| `agent/contracts/capability-pack` | — | 1.0.0 | New |
| `agent/contracts/secret-redaction` | — | 1.0.0 | New |

Two MAJOR bumps and three new stored-data sets: `design.md` **must** carry a fully authored
`Migration & Rollback` section.

## Migration & Rollback Needed?

**Yes.** Three migrations and one rollback path, all to be authored in `design.md`:

1. **Routing table → registry.** An existing table holds six assignments keyed by the closed role names. The
   six built-in registry entries carry those same identifiers, so migration is a re-key, not a re-choice: no
   role is silently reassigned, which is the property INV-AG-24 protects. A table whose `tableVersion` is ahead
   is already refused whole, which is the mixed-device behaviour this migration inherits rather than invents.
2. **Session records.** A stored transcript written before this change carries one of the four old
   `AgentRole` values and no lineage. It reads as the corresponding built-in role with no parent. Nothing
   rewrites a stored transcript, because transcripts are append-only account data.
3. **Job records.** A job record without a parent reference reads as a top-level job. Nothing backfills.
4. **Rollback.** A device running the previous assembly meeting a replicated registry, skill catalogue or
   child-job record refuses the store whole and asks for the update, matching the existing `TABLE_VERSION_AHEAD`
   behaviour. It must not read around an unrecognised member, because reading around a role entry means running
   work on a model or a tool allowlist the user never assigned.

## Regression Scope (to be copied into verification.md)

- `agent` — all scenarios of all 33 requirements; the six routing requirements are directly modified.
- `job` — all scenarios of all 10 requirements; lifecycle gains a parent/child relation.
- `approval` — all scenarios; not modified, but newly exercised from child jobs, capability-pack tools and
  lifecycle-transformed arguments. Specifically re-measure: the eleven bypass routes of
  `spikes/SP-8-rule-ir-hardgate/REPORT.md` §1 Q2 extended with the new routes, and the accumulated-count rule
  across a parent and its children.
- `ledger` — ledger-before-act for every new call site, and record content under redaction.
- `connector` — the wrapping factory's exclusivity, and pacing shared between a parent and its children under
  one authorisation.
- cluster `agent-runtime` (pet, agent, job) — full combination matrix; its declared constraint is the shared
  harness and the job lifecycle, both of which move.
- cluster `trust-chain` (ledger, undo, approval) — the shared append-only precondition, exercised from the new
  call sites.

`verification.md` does not exist yet. **Reminder for the drafting of `verification.md`:** its
`## Regression scope` section is this list, each line carrying the reason recorded above.

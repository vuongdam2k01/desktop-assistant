---
contract: skill-manifest
version: 1.0.0
status: draft
owner: agent
consumers: [agent, job, app, uix, sync]
schema_files: [skill-manifest.schema.json, skill-catalogue-store.descriptor.json]
---

# Contract: Skill Manifest

## Purpose

A skill is a playbook: the instructions for a kind of work, together with the reference material those
instructions cite. This contract owns the document that makes a directory into one — what the skill is called,
what work it applies to, where its body is, and which material it names — and it owns the catalogue that reads
those documents and decides which of them a job may load.

It exists because the reliability this product needs was measured to come from declared procedure rather than
from better phrasing. A named ambiguity rule and a written schema-mapping playbook were the two structures that
turned failing scenarios into passing ones, raising ask-at-the-right-moment to 95% across the corpus — VERIFIED
(`spikes/SP-4-agent-loop/REPORT.md` §1 Q5). Constitution principle V says reliability comes from harness
capability and never from constraining how the user phrases a command; a skill is where that capability is
written down, versioned and loaded on demand instead of being compiled into a prompt nobody can revise.

Three properties carry the whole contract, and each is worth stating before the shapes:

- **A skill contains nothing executable and may not reference anything executable** (INV-AG-34). A skill
  describes work; it never performs it.
- **Identifiers never merge** (INV-AG-35). Two packages declaring one identifier resolve to exactly one body by
  declared precedence, and the loser is reported rather than silently discarded.
- **A skill is loaded whole or not at all.** A valid manifest whose named reference material cannot be read
  makes the skill absent, not half-loaded.

What this contract does not cover: how a job decides that its work matches an `appliesTo` text, and where a
loaded body sits in a model request, which belong to `agent/contracts/context-assembly@1.0.0`; which skills a
role preloads, which belongs to `agent/contracts/role-registry@1.0.0`; how a capability pack comes to contribute
a skill directory at all, which belongs to `agent/contracts/capability-pack@1.0.0`; and how a shadowed skill or
an invalid one is shown to the user, which belongs to `uix`.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`skill-manifest.schema.json`](./skill-manifest.schema.json) | JSON Schema 2020-12 | normative — the manifest document a skill package must carry |
| [`skill-catalogue-store.descriptor.json`](./skill-catalogue-store.descriptor.json) | Instance of `sync/contracts/replicated-store-descriptor@0.1.0` | normative — how the catalogue's enabled state joins replication |

The first file is where INV-AG-34 stops being an intention. It admits eight members and no more, so there is no
`command`, no `entryPoint`, no `install` and no `hooks` for a package to declare; and every path it admits must
be relative, must contain no segment beginning with a dot, and must end in one of six text extensions the
product reads to a model rather than runs. A package therefore has no member through which it could name
something executable, which is a stronger guarantee than inspecting a directory afterwards and a cheaper one
than sandboxing something the product was never going to run.

The second file repays the same second look the pet pack store does, and for the opposite reason. It does not
replicate skills. It registers the *enabled state and the precedence resolution* as a mutable store resolving by
last-writer-wins with the superseded version preserved — and nothing else. The packages themselves arrive with
the product or with a capability pack; they are content of the installed assembly, not records of the account,
and the store's `membership` says so explicitly so that no later reader mistakes an empty transfer for a lost
one. The consequence is a reconciliation rather than a conflict: a device enables an identifier it does not
hold as inertly as it holds an identifier nobody has ruled on.

What neither file can express is stated here, because each is a property of the package directory or of the text
rather than of a document shape. Whether the named body and reference material can actually be read is answered
by reading them. Whether the package as a whole is within its size ceiling is answered by measuring it, never by
trusting a declared figure. And whether an `appliesTo` text describes the work it claims to — rather than
describing everything, which is how a catalogue quietly becomes a prompt — is answered by reading it, which is
why the acceptance plan reviews it and the schema only bounds its length.

## Schema / Surface

### 1. Interface & Data Types

The normative shape of the document is [`skill-manifest.schema.json`](./skill-manifest.schema.json). The
declarations below name the same members for a reader and add the runtime types the file does not describe: what
a catalogue entry carries beyond its manifest, and what a load returns.

```typescript
/** Where a package was discovered. Fixes precedence, and nothing else. */
export type SkillOrigin = 'account' | 'pack' | 'product';

export interface SkillSource {
  origin: SkillOrigin;
  /** Populated only when origin is 'pack': which activated pack contributed the directory. */
  packId?: string;
  /** The package directory's own name, which is how a directory that yielded no identifier is still nameable. */
  directory: string;
}

/** Ascending: 1 wins. Derived from origin, never from the order directories were read in. */
export type PrecedenceRank = 1 | 2 | 3;

export interface SkillManifest {
  schemaVersion: string;
  skillId: string;
  name: string;
  version: string;
  /** The applicability text. The whole of what a skill advertises before its body is read. */
  appliesTo: string;
  body: { inline: string } | { path: string };
  references?: string[];
  hidden?: boolean;
}

export type SkillRefusal =
  | 'MANIFEST_ABSENT'
  | 'MANIFEST_MALFORMED'
  | 'MANIFEST_SCHEMA_UNSUPPORTED'
  | 'EXECUTABLE_CONTENT_PRESENT'
  | 'REFERENCE_PATH_ESCAPES'
  | 'PACKAGE_UNREADABLE'
  | 'PACKAGE_OVER_SIZE_CEILING';

export type SkillValidity =
  | { state: 'valid' }
  /** `field` names the manifest member that failed, or null when the fault is the package rather than a member. */
  | { state: 'invalid'; reason: SkillRefusal; field: string | null; detail: string };

/** One row of the catalogue. Everything here is known without reading a body. */
export interface CatalogueEntry {
  /** Null when the directory yielded no identifier at all — there is then no key to report it under but its own. */
  skillId: string | null;
  source: SkillSource;
  precedenceRank: PrecedenceRank;
  /** Present when the manifest parsed far enough to carry them; absent on a malformed document. */
  name?: string;
  version?: string;
  appliesTo?: string;
  hidden: boolean;
  validity: SkillValidity;
  /** The account's decision. An identifier nobody has ruled on reads as enabled. */
  enabled: boolean;
  /** On the losing entry of a contested identifier: the source that won. Null otherwise. */
  shadowedBy: SkillSource | null;
}

/** What a job receives when it loads a skill. Whole, or not at all. */
export interface LoadedSkill {
  skillId: string;
  version: string;
  source: SkillSource;
  body: string;
  /** Each named reference, read in the order the manifest declared it. */
  references: Array<{ path: string; content: string }>;
}

export type LoadOutcome =
  | { ok: true; skill: LoadedSkill }
  | { ok: false; error: SkillRefusal | 'SKILL_UNKNOWN'; skillId: string; detail: string };

export interface SkillCatalogue {
  /** Every entry discovered, valid or not, winning or shadowed. What the settings surface lists. */
  catalogue(): Promise<CatalogueEntry[]>;
  /** Identifier and applicability of every enabled, valid, unshadowed, unhidden skill. What a job starts with. */
  advertise(): Promise<Array<{ skillId: string; appliesTo: string }>>;
  setEnabled(skillId: string, enabled: boolean): Promise<CatalogueEntry>;
  /** In-process only. Never reachable from a window: it yields a body. */
  load(skillId: string): Promise<LoadOutcome>;
}
```

`SkillRefusal` is one type rather than two — unlike `pet/contracts/pet-pack-manifest@1.0.0`, which separates
import refusals from activation refusals. The reason the split does not apply here is that there is no import:
every refusal in this contract arises at discovery or at load, both of which the product performs on content
that is already present, and all of them have the same remedy — repair or replace the package, or update the
product. A user is never standing in front of a file chooser when one of these is returned.

### 2. Wire / Communication Protocol

Two channels, both from the app window to the main process. The asymmetry is the one
`agent/contracts/role-routing@0.1.0` already establishes: a window may express the user's intent and can never
obtain the thing the intent resolves to — there, an endpoint; here, a body.

| Channel / Endpoint | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `skills/list` | Window → Main | Request-Response | `{}` | `CatalogueEntry[]` — identifier, applicability, origin and precedence rank, validity with the failing field, enabled state, shadowed-by | None. A catalogue that cannot be read is an empty catalogue plus a reported failure, never a missing surface. `CATALOGUE_VERSION_AHEAD` is reported as the catalogue's own state rather than as a call failure |
| `skills/enable` | Window → Main | Request-Response | `{ skillId, enabled }` | The updated `CatalogueEntry` | `SKILL_UNKNOWN` — the identifier is in no entry this device discovered. The decision is written as a replicated record before it takes effect |
| *(load)* | — | — | — | — | **No channel.** A skill enters a running job's context from inside the main process, on the job's own match or its role's preload list. A window cannot load one, and cannot read a body that was loaded |
| *(import)* | — | — | — | — | **No channel.** A package arrives with the product or with a capability pack. There is no route by which a window, a model, a connector or a replicated record installs one |
| *(precedence)* | — | — | — | — | **No channel.** Precedence is declared by this contract and derived from origin. Nothing may reorder it at runtime, because a shadowing decision that differed between two devices would make one account hold two playbooks under one name |

The absent first row is the one to dwell on. The reference architecture's equivalent surface lets a session load
a skill and, in the same act, gain whatever its directory can run (`https://omp.sh/docs/skills`, UNVERIFIED).
Here loading is a context operation and only a context operation: it adds text to a request and reaches nothing
else. `agent/contracts/context-assembly@1.0.0` records the load against the job, which is how a run's account
states what it read.

The replication of the enabled state is not a channel of this contract either. It travels as records of the
`skill-catalogue` store through `sync/contracts/replication-protocol@0.1.0`, under the descriptor listed above —
which is the point of registering a descriptor rather than defining a transfer here.

### 3. Module Descriptor / Manifest Specification

The manifest is the module descriptor, and its normative shape is
[`skill-manifest.schema.json`](./skill-manifest.schema.json). It is not restated here. What the file cannot
carry is stated below.

**Directory layout.** One directory per skill, holding the manifest and nothing the manifest does not name. The
body and every reference resolve relative to that directory, and the schema's path pattern is what confines them
to it: no leading separator, no segment beginning with a dot, no backslash and no colon. A path is refused at
validation, before it is resolved against anything, so the refusal does not depend on where the package happens
to sit or on what a filesystem would have done with the string.

**Discovery is one level deep.** Each discovery location is scanned for its immediate subdirectories, exactly as
`pet` discovers packs (`req-024-pet-pack-framework`), and each subdirectory is read as one package. Nothing
recurses: a directory nested inside a package is material the manifest may name, never a second package. A
subdirectory with no readable manifest is not a skill package — it is absent from the catalogue rather than
partly available, which is what makes a file dropped in by hand invisible instead of half-working.

**Discovery is eager; reading a body is lazy.** Every location is scanned at start, because a job must be able
to see what exists before it decides what it needs. Only the manifest is read then: the catalogue holds
identifier, applicability, origin, precedence and validity, and a body is read when a job loads it. This is what
keeps a large catalogue cheap, and it is why `appliesTo` is a required member rather than an optional summary —
it is the entire advertisement.

**Validation, at discovery and again at load.** At discovery a package is admitted only if its manifest parses,
satisfies the schema, declares a `schemaVersion` this build implements, names no path the schema refuses,
carries no executable file in its directory, and measures within the package ceiling. At load, the body and
every named reference are read; if any of them cannot be read, the load fails and the skill is absent rather
than partial. The second check is not redundant: discovery and load are separated in time, and a package that
was complete when it was listed can be incomplete when it is needed.

**Precedence and shadowing.** Origin fixes the rank, and nothing else does:

| Rank | Origin | Discovery location | Why it sits here |
| --- | --- | --- | --- |
| 1 | `account` | The account's skill directory under the application data path | The most specific playbook to this account wins, which is the `custom ➔ built-in` fallback direction `design.md` § Multi-Level Fallback Hierarchy already fixes for every other contributed thing |
| 2 | `pack` | The skill directory of each activated capability pack | A pack specialising a general playbook for the capability it exists to provide should win over the general one. Between two activated packs declaring one identifier, the pack identifier ascending in code-point order breaks the tie |
| 3 | `product` | The product's own skill directory | The built-in playbook is the floor, present on every device and never in anyone's way |

Exactly one entry per identifier is loadable. The loser keeps its catalogue row and carries `shadowedBy` naming
the winning source, so the user can see that a second copy exists and which one is in effect. The ordering is
declared rather than derived from the order directories were read in, which is what makes two devices holding
the same packages resolve identically.

In this revision no route creates an `account`-origin package: package content is not a replicated record (see
the store descriptor's `membership`), and no import channel exists. The rank is declared now so that the
ordering does not have to change when such a route arrives — the same reasoning by which
`pet/contracts/pet-pack-manifest@1.0.0` carries the fields its reserved distribution channel will need.

**Fallback when a manifest is missing, malformed or later-versioned.** All three make the package absent, and
the absence is reported rather than swallowed. A directory with no manifest yields no identifier, so its row is
keyed by the directory name with `skillId: null`. A manifest that parses but fails the schema is listed as
invalid with the member that failed, so the author can see which one. A manifest declaring a `schemaVersion`
whose major revision this build does not implement is refused whole and never read around, for the reason
`model.md` § Fallback on Missing Manifest gives: a half-applied descriptor is a playbook nobody wrote. In every
case the rest of the catalogue is unaffected — one bad package does not cost a job its other skills.

## Semantics

**A skill is content, never code, and this is a deliberate divergence.** The reference architecture permits a
skill directory to carry scripts a session runs with the user's permissions
(`https://omp.sh/docs/skills`, UNVERIFIED). That shape is coherent for a coding agent holding a shell; it has no
meaning here, and admitting it would be actively harmful. This product's agents hold no shell and no file tools,
and every tool they hold is the output of one wrapping factory that keeps its implementation private — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2), with the harness's own interception facility deliberately left
unconfigured so that no second route exists. A runnable skill would be exactly that second route: a capability
reaching the platform without a ledger record before it and a gate verdict in front of it, which is the
condition the eleven attempted bypasses failed to reach — VERIFIED
(`spikes/SP-8-rule-ir-hardgate/REPORT.md` §1 Q2). The manifest closes this off structurally rather than by
inspection: there is no member through which a package could name a command, and the path pattern admits no
extension the product executes. `@oh-my-pi/*` is read throughout as a reference architecture and never as a
dependency — the distribution is refused because it targets Bun and holds pause state in a process-wide
singleton, VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9).

**A skill that describes a capability does not confer it.** A valid playbook may describe exporting a report;
if no export tool is in the agent's allowlist, the agent has no means to perform it and says so. The allowlist
is resolved when the agent starts and is immutable for that session (INV-AG-33), so a loaded body cannot widen
it. Skill text is advisory in the same sense a pet persona is: it reaches no position from which the approval
gate or tool selection reads, and that is structural — the gate runs in the application layer between the agent
and the connector, per `docs/spec/constitution.md` principle II.

**Identifiers never merge.** This is worth separating from precedence, because the tempting alternative is not
"pick the wrong one" but "combine them". A merged playbook is a playbook nobody wrote and nobody can review: it
has no author, no version that means anything, and no behaviour either source predicted. So exactly one body is
loadable per identifier, the other is reported, and the catalogue names both sources (INV-AG-35).

**Loaded whole or not at all.** A skill's body and every reference it names are read together, and a failure to
read any of them makes the skill absent. The alternative — loading the body and dropping a reference it cites —
produces a playbook that instructs an agent to consult material the agent does not have, which is worse than no
playbook at all because it looks like one.

**The advertisement is bounded; the body is not advertised.** A job sees identifiers and applicability texts at
start and nothing else. A body enters a context only on a match or a role's preload list, and the load is
recorded against the job. A skill loaded mid-job is recorded the same way, and the job's context budget is
re-evaluated before the next request.

**`hidden` narrows matching, never loading.** A hidden skill is excluded from the advertisement and remains
loadable by identifier, so a playbook written to be cited by another playbook does not compete for every job
whose work brushes past its applicability text.

**The enabled state is the account's; the packages are the device's.** Disabling a skill removes it from the
advertisement everywhere the account is signed in, and it is one record, not a copy of the playbook. An
identifier enabled on a device that does not hold the package is inert rather than an error: the assembly that
carries it may simply not have arrived yet. An identifier discovered with no record reads as enabled, because a
skill the user has never ruled on is available like every other skill the product ships.

**A body is released when the job that loaded it ends.** Nothing is cached across jobs, for the reason
`model.md` § Lifecycle and eviction gives: the account of a run must state what that run actually loaded, and a
cache would make that statement about an earlier run.

**Size is measured, not declared.** The package ceiling is 256 KiB of body plus reference material, and the
catalogue ceiling is 256 entries. **Both figures are UNVERIFIED**: they are declared budgets from
`clarifications.md` session 2026-09-13, chosen so that a full catalogue can be advertised without reading any
body, and `verification.md` schedules the measurement that would replace them. Neither is a declared field in
the manifest, because a declared size is a figure that can be wrong in the direction that matters.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `MANIFEST_ABSENT` | A subdirectory of a discovery location holds no readable manifest | Application, at discovery | Not a skill package. Listed by its directory name with no identifier, so a mis-dropped folder is visible rather than silently ignored |
| `MANIFEST_MALFORMED` | The manifest does not parse, or fails the schema | Application, at discovery | The identifier is absent from the catalogue and the entry is listed as invalid naming the member that failed; every other skill loads |
| `MANIFEST_SCHEMA_UNSUPPORTED` | The manifest's major `schemaVersion` is not implemented by this build | Application, at discovery | The package is refused whole, never read partially, and the product says an update is needed. The files are left in place so the user can see what was rejected |
| `EXECUTABLE_CONTENT_PRESENT` | The package carries an executable file, or the manifest names a path the schema's text-extension allowlist refuses | Application, at discovery | The package is refused whole, and the reason states that a skill describes work and never performs it |
| `REFERENCE_PATH_ESCAPES` | A declared path is absolute, or contains a segment that would leave the package directory | Application, at validation, before any path is resolved | The package is refused whole and no part of it is loaded; the offending path is quoted back |
| `PACKAGE_UNREADABLE` | The manifest is valid but its body or a named reference cannot be read | Application, at discovery and again at load | The skill is absent rather than half-loaded, naming the path that could not be read. A job that was loading it proceeds without it and records the absence |
| `PACKAGE_OVER_SIZE_CEILING` | Body plus reference material exceeds 256 KiB (UNVERIFIED declared budget) | Application, at discovery | The skill is absent; both the measured size and the ceiling are stated, so the author knows by how much |
| `CATALOGUE_OVER_ENTRY_CEILING` | A discovery location yields more than 256 valid entries (UNVERIFIED declared budget) | Application, at discovery | Entries beyond the ceiling are absent and the overflow is reported as one condition rather than as 200 separate refusals |
| `SKILL_UNKNOWN` | `skills/enable` names an identifier no entry on this device carries | Application, at the channel | The setting is not written, and the catalogue is re-read in case the package arrived or left since the window last listed it |
| `CATALOGUE_VERSION_AHEAD` | The replicated enabled state was written against a later schema version | Application, on replication | The catalogue state is refused whole and the product asks for the update; no skill is silently enabled or disabled meanwhile |

## Compatibility

**MAJOR** — removing a required member; adding a required member, since every existing manifest would then be
invalid; changing the meaning of `skillId`; changing the precedence order or what shadowing does; admitting a
path form the current pattern refuses; adding any member through which a package could name something the
product executes, which is not a compatibility question at all but a change to INV-AG-34 and therefore to the
constitutional argument in `design.md` § D6.

**MINOR** — adding an optional member; adding a text extension to the reference allowlist, provided the product
reads it to a model and never runs it; adding a `SkillRefusal` with a remedy; adding a read-only channel; adding
an origin below `product` in the precedence ladder, which no existing package's resolution can change.

**PATCH** — tightening a description; adjusting a bound that no existing manifest violates; replacing an
UNVERIFIED ceiling with the measured figure, when that figure is not lower than the ceiling it replaces.

**Support window.** The packages do not replicate, so a manifest is only ever read by the assembly that shipped
it — which is why a later `schemaVersion` is a product-update condition rather than a mixed-version problem. The
enabled state does replicate between devices on different builds, so it follows the rule
`agent/contracts/role-routing@0.1.0` sets and for the same reason: a newer build reads an older record
unchanged; an older build meeting a newer version refuses the whole record rather than reading around a member
it does not recognise. Reading around one here would mean advertising a skill the user disabled, or hiding one
they did not.

## Examples

**Valid** — a minimal skill: identity, applicability, and a body written into the manifest. It cites nothing, so
it names nothing:

```json
{
  "schemaVersion": "1.0.0",
  "skillId": "ask-before-reordering",
  "name": "Ask before reordering",
  "version": "1.0.0",
  "appliesTo": "Any request that rearranges a list of tasks without naming the final order: 'rebalance', 'push everything back', 'tidy up the sprint'. Also any request naming two tasks that share a name or a date.",
  "body": {
    "inline": "Before changing the relative order of tasks, state the order you intend and ask for confirmation. Never infer an order from a phrase that does not contain one. When two candidate tasks share a name or a due date, name both and ask which was meant; do not choose the first, and do not act on both."
  }
}
```

*Effect*: the catalogue advertises the identifier and the applicability text to every job. A job whose command
matches loads the body; the other jobs never read it. The playbook is the one whose measured effect was to raise
ask-at-the-right-moment to 95% (`spikes/SP-4-agent-loop/REPORT.md` §1 Q5).

**Valid** — a skill with reference material, held in files beside the manifest, and hidden from automatic
matching because it is meant to be cited by other playbooks rather than matched on:

```json
{
  "schemaVersion": "1.0.0",
  "skillId": "notion-task-schema",
  "name": "Notion task schema and relative ordering",
  "version": "2.1.0",
  "appliesTo": "Reading or writing tasks in a Notion database: which property holds order, which holds the deadline, and how a relative instruction maps onto both.",
  "body": { "path": "body.md" },
  "references": ["reference/property-map.md", "reference/ordering-rules.md", "reference/worked-examples.md"],
  "hidden": true
}
```

*Effect*: the package is loaded whole — body and all three references, in the order declared — or not at all. If
`reference/ordering-rules.md` cannot be read, the skill is absent with `PACKAGE_UNREADABLE` naming that path,
because a playbook that cites rules it cannot show is a playbook that misleads.

**Rejected** — a manifest naming a script as reference material:

```json
{
  "schemaVersion": "1.0.0",
  "skillId": "sync-notion-board",
  "name": "Sync the Notion board",
  "version": "1.0.0",
  "appliesTo": "Bringing a Notion board back into agreement with the tasks recorded elsewhere.",
  "body": { "path": "body.md" },
  "references": ["reference/mapping.md", "scripts/sync-notion.sh"]
}
```

*Rationale*: refused at validation — `scripts/sync-notion.sh` does not end in one of the six text extensions the
reference pattern admits. This is the divergence from the reference architecture stated plainly: a skill
directory there may carry scripts a session runs with the user's permissions
(`https://omp.sh/docs/skills`, UNVERIFIED), and here it may not. Admitting it would create a second route to
capability beside the wrapping factory, and the single-factory guarantee (VERIFIED,
`spikes/SP-6-pi-sdk/REPORT.md` §1 Q2) is what puts every call behind a ledger write and a gate verdict. Whatever
this script does, it is either a tool — declared, wrapped, gated and recorded — or it does not exist. Note that
the refusal takes the package with it: the valid `reference/mapping.md` is not loaded either, because a package
is admitted whole or not at all.

**Rejected** — a reference path that leaves the package directory:

```json
{
  "schemaVersion": "1.0.0",
  "skillId": "house-style",
  "name": "House style",
  "version": "1.0.0",
  "appliesTo": "Writing a summary or a report the user will read, in the product's own voice.",
  "body": { "inline": "Write in short sentences. Name the source of every figure." },
  "references": ["../../shared/tone-of-voice.md"]
}
```

*Rationale*: the first segment is `..`, and the pattern admits no segment beginning with a dot. This is the one
kind of member through which an authored document could otherwise name something it does not own, and it is
closed by the shape of the string rather than by resolving the path and checking where it landed — the same
decision, for the same reason, that `pet/contracts/pet-pack-manifest@1.0.0` makes for its asset path. The
package is refused whole before any path is resolved.

**Rejected** — a manifest declaring members this contract does not admit:

```json
{
  "schemaVersion": "1.0.0",
  "skillId": "weekly-digest",
  "name": "Weekly digest",
  "version": "1.0.0",
  "appliesTo": "Assembling the week's finished tasks into a digest.",
  "body": { "inline": "List every task that reached Done since Monday, grouped by project." },
  "commands": ["digest --since monday"],
  "priority": 0
}
```

*Rationale*: refused on both counts, and the counts differ in kind. `commands` is the shape INV-AG-34 exists to
forbid, and the schema refuses it by admitting no member beyond the eight it declares rather than by
blocklisting names — a blocklist would have to anticipate `entryPoint`, `hooks` and `install` as well.
`priority` is subtler and equally refused: precedence is derived from origin by this contract, and a manifest
that could bid for its own rank would let an authored document decide which of two playbooks under one name is
the one nobody wrote.

## Migration

Not applicable at 1.0.0: no skill package and no catalogue state exists in the field, and this contract is
introduced whole by `req-025-pi-agent-system`.

What a later revision inherits is stated now, because the shapes above were chosen to make it cheap. A manifest
written against a `schemaVersion` whose major revision the reading build does not implement is refused whole,
so a future MAJOR revision never produces a half-understood package — it produces a package the older build says
it cannot read, naming the version. Since packages ship with the assembly that reads them, a MAJOR revision is
carried by a release rather than by a migration: the product updates its own skill directory in the same step,
and a capability pack is rebuilt against the new revision before it is shipped.

The catalogue's enabled state is the part that outlives a build, and its migration is the reconciliation already
specified: a record naming an identifier this device does not hold is inert, and an identifier this device holds
with no record reads as enabled. A revision that adds a member to that record therefore needs no data migration
in either direction — an older build refuses a newer record whole and reports it, and a newer build reading an
older record finds the added member absent and applies its declared default.

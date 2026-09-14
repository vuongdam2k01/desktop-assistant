---
contract: capability-pack
version: 1.0.0
status: draft
owner: agent
consumers: [agent, approval, connector, job, app, uix, sync]
schema_files: [capability-pack.schema.json]
---

# Contract: Capability Pack

## Purpose

A capability pack is how the runtime gains tools, roles and skills without a change to the job manager, the
approval gate, the ledger or the interface. It is the extension point principle VI opens for connectors,
applied to the runtime's own capability: adding browser automation or desktop control must be a manifest plus
first-party code behind it, not an edit to the four surfaces that carry the constitution.

The contract exists to make one thing structurally true. A pack is a **source of declarations**, never a second
registration route. Every tool a pack contributes is produced by the wrapping factory of
`agent/contracts/tool-wrapping@0.2.0` exactly as a connector adapter's tool is, so it records before it acts,
it is evaluated by the gate, it appears in an allowlist or it does not exist, and its implementation is closed
over and reachable by no name (INV-AG-44). That the factory is the only producer, and that the guarantee holds
with the engine's own interception facility deliberately unconfigured, is VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q1, Q2). Nothing in this contract may weaken it, which is why the manifest
declares what a tool *is* and never how it is registered.

The second thing the contract makes true is that an unactivated pack contributes **nothing**: not a tool that
refuses, not a role that cannot run, not a skill describing an impossibility (INV-AG-45). Absence is the
representable state, so no component downstream has to handle "present but unusable", and no user is trained to
ask for a capability that will decline. The first two packs — browser automation and desktop control — ship in
exactly that state, with their tool surface, their irreversibility declarations and their gate policy authored
now and their activation waiting on a measurement.

This is a first-party surface. Packs are enumerated from the product's own pack directory and there is no
installation route from anywhere else. The reference architecture's marketplace model is read and not adopted:
its own documentation states that project scope is not a security boundary and that a plugin runs with the same
permissions as its host (`https://omp.sh/docs/plugins`, UNVERIFIED) — a trust decision this product has not
made. Pack provenance and integrity is therefore a **reserved** variability slot in `model.md`, carrying its
phase, its rationale and its activation condition, rather than an omission. `@oh-my-pi/*` remains a refused
dependency (VERIFIED: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9); every pattern read there is re-implemented against
the pinned harness and nothing is imported.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`capability-pack.schema.json`](./capability-pack.schema.json) | JSON Schema 2020-12 | normative — the manifest document a capability pack must carry |

The file expresses everything about a pack that can be decided by reading one document: identity and version,
the three contribution lists, the declaration block each contributed tool must complete, the activation
condition together with the evidence that would satisfy it, and the shape of every path a pack may name. Three
rules of principle IV are carried in the shape itself rather than in prose, so the refusal lands at load where
a pack author sees it: a write tool must carry either a compensation formula or `irreversible: true` and never
both; a compensation requires the snapshot it is built from; and `irreversible` admits only the value `true`,
because declaring `false` is not a statement of reversibility but the silence the principle forbids.

Four things the file cannot hold, which is why this document exists around it:

- **Whether what the manifest names is there.** A role manifest path and a skill directory path are shapes in
  the file; whether the document and the directory exist inside the pack is answered by reading the pack.
- **Whether a contributed tool name is free.** Uniqueness is across the tool set of one session, which spans
  the product, every connected connector and every other activated pack — a set no single document sees.
- **Whether the activation evidence was actually recorded.** `activation.state` in a manifest is the author's
  claim. The authority is the device's activation relation (`contracts/agent-runtime-store.sql`,
  `model.md` § Physical Storage), which records *which* evidence satisfied the condition.
- **What content a pack's tools will read.** Rendered pages, screenshots and accessibility trees are external
  content by requirement, and that is a property of how the composer carries them, not of a manifest member.

## Schema / Surface

### 1. Interface & Data Types

The normative shape of the manifest is [`capability-pack.schema.json`](./capability-pack.schema.json). The
declarations below name the same members for a reader and add the runtime types a schema file cannot hold: what
a loaded pack resolves to, why a pack was refused, and — the load-bearing one — the fact that the loader's
output is handed to the same factory every other tool goes through.

```typescript
import type { ToolImplementation, WrappedTool, CreateWrappedTool } from "tool-wrapping@0.2.0";
import type { RoleEntry } from "role-registry@1.0.0";
import type { SkillPackage } from "skill-manifest@1.0.0";
import type { InterceptionPoint, HandlerRegistration } from "runtime-lifecycle@1.0.0";
import type { RedactionClass } from "secret-redaction@1.0.0";

/** The pack lifecycle of model.md, as a type. There is no state meaning "active but refusing". */
type PackState = "discovered" | "invalid" | "inactive" | "active";

/** What the loader produces for one pack. Contributions exist only in the active case. */
type ResolvedPack =
  | { packId: string; state: "invalid"; refusal: PackRefusal }
  | { packId: string; state: "inactive"; awaiting: ActivationCondition }
  | { packId: string; state: "active"; satisfiedBy: EvidenceReference; contributed: Contributed };

interface Contributed {
  /** Wrapped, never raw. The loader cannot produce a WrappedTool itself; only the factory can (INV-AG-44). */
  tools: ReadonlyArray<WrappedTool>;
  roles: ReadonlyArray<RoleEntry>;
  skills: ReadonlyArray<SkillPackage>;
  handlers: ReadonlyArray<HandlerRegistration>;
  secretClasses: ReadonlyArray<RedactionClass>;
}

interface ActivationCondition {
  condition: string;                 // what must be established, in words the user can read
  evidence: EvidenceReference;       // the spike that would establish it
}

interface EvidenceReference {
  spike: string;                     // e.g. "SP-26"
  status: "proposed" | "published";
  section?: string;                  // named only once the report exists
  reference?: string;                // the report's path, required once published
}

type PackRefusal =
  | "PACK_SCHEMA_UNSUPPORTED"
  | "PACK_MANIFEST_INVALID"
  | "TOOL_DECLARATION_INCOMPLETE"
  | "TOOL_NAME_COLLISION"
  | "ROLE_ID_COLLISION"
  | "PATH_ESCAPES_PACK"
  | "CONTRIBUTION_NOT_FOUND"
  | "HANDLER_POINT_UNKNOWN"
  | "PACK_OVER_SIZE_CEILING"
  | "PACK_UNREADABLE";

/**
 * The whole of the loader's authority. It reads manifests and hands declarations on; it is given the factory
 * rather than being one, so there is no path from a pack to a tool that does not pass through
 * tool-wrapping@0.2.0. Note what it is not given: the gate, the ledger appender, or the allowlist.
 */
type LoadPacks = (
  packDirectory: string,                       // the product's own directory, and no other
  deps: {
    createWrappedTool: CreateWrappedTool;      // the one producer of WrappedTool
    activationOf: (packId: string) => EvidenceReference | null;   // read from the device's relation
  }
) => Promise<ReadonlyArray<ResolvedPack>>;

/** Withdrawal is the same operation in reverse, and is atomic across all three surfaces. */
type WithdrawPack = (packId: string) => Promise<{ withdrawn: Contributed }>;
```

The correspondence a reviewer should check is between a manifest's tool declaration and
`ToolImplementation.declarations` in `agent/contracts/tool-wrapping@0.2.0`: `direction: "write"` is that
contract's `writes: true`, `irreversible` is its `isIrreversible`, and `changesPermission`, `reconciliation`
and `snapshot` are the same members under the same meanings. The correspondence is member-for-member on
purpose. A pack's tool is not a kind of tool; it is a tool, declared in a second place.

### 2. Wire / Communication Protocol

| Channel / Endpoint | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `packs/list` | Window → Main | Request / response | `{}` | One entry per discovered pack: identity, name, version, state, and for an inactive pack the condition text and the evidence it awaits; for an invalid pack the refusal and the member that failed | None. A pack directory that cannot be read yields an empty list plus a reported failure, never a missing surface — the same posture `pack:list` takes in `pet/contracts/pet-pack-manifest@1.0.0` |

That is the entire channel surface, and the omissions are the specification rather than an oversight:

- **No channel activates a pack.** Activation is evidence-bound rather than user-settable, so there is no
  toggle to expose and no request shape to define. A capability whose measurement has not been run is not a
  preference the user is being denied; it is a fact about what the product knows.
- **No channel installs or uninstalls a pack.** Packs are enumerated from the product's own directory, and an
  installation request would be the first half of a provenance model that does not exist. The reserved slot in
  `model.md` is where that surface attaches if Q-3 is ever answered "third-party packs are permitted".
- **No channel registers a handler, adds a tool, or reads a pack's declarations into a window.** This follows
  the asymmetry `agent/contracts/role-routing@1.0.0` already establishes: a window may express intent and can
  never obtain a resolved capability.

Everything else about a pack reaches the user through surfaces that already exist. Its tools appear in
allowlists through `agent/contracts/role-registry@1.0.0`, its calls appear in the ledger through
`ledger/contracts/ledger-record@0.1.0`, its approvals appear through `approval/contracts/gate-evaluation@0.1.0`,
and the fact that a capability is inactive is told to the user through the existing system-card surface, whose
presentation is `uix`'s to decide.

### 3. Module Descriptor / Manifest Specification

The manifest is the module descriptor and its normative shape is
[`capability-pack.schema.json`](./capability-pack.schema.json), which is not restated here. What follows is
what the file cannot carry.

**Fields, and why each is where it is.** `schemaVersion`, `packId`, `name` and `version` are the identity block
every descriptor in this project carries; `packId` is stable for the life of the pack because the activation
relation and every ledger record naming the pack address it by that identifier. `contributes` holds the three
lists — `tools`, `roles`, `skills` — all required and any of them permitted to be empty, because an empty list
is an author's statement and an absent member is an author's silence. Tools are declared inline, since a tool's
declaration is the whole of what the factory needs and the implementation is first-party code behind it. Roles
and skills are declared by reference, each naming a document or directory inside the pack, because a role entry
and a skill package are documents with contracts of their own and a manifest that copied them would be a second
place for them to be wrong. `activation` carries the condition text, the evidence reference that would satisfy
it and the author's statement of the current state. `secretClasses` is optional and names the redaction classes
this pack's tools introduce, in the vocabulary of `agent/contracts/secret-redaction@1.0.0`. `handlers` is
optional and names the interception points the pack registers at, each with its own time budget, in the closed
set of `agent/contracts/runtime-lifecycle@1.0.0`.

**Discovery** is by enumerating one level of the product's own pack directory and reading the manifest in each
subdirectory — the same one-directory-per-unit shape `pet` uses for pet packs and the skill catalogue uses for
skills. A directory without a readable manifest is not a pack; it is absent rather than partly available. There
is no second location, no user-supplied path, and no import channel, so "first-party only" is a property of the
enumeration rather than a check someone must remember to perform.

**Validation is whole-pack and happens eagerly at start,** because a pack contributes role entries and tool
declarations that must exist before any agent starts. The order is: parse the manifest; refuse it whole if its
major `schemaVersion` is ahead of the build; validate against the schema file; resolve every declared path and
confirm the document or directory exists; check each contributed tool name against the product's, every
connector's and every other pack's; check each contributed role identifier against the built-in entries; check
each handler's point against the closed six. A failure at any step contributes nothing at all and names both
the member and the reason. Nothing is partially applied — a half-applied pack is a tool set nobody reviewed.

**Activation evaluation** is separate from validation and runs after it. The loader reads the device's
activation relation for the pack's identifier. Where a row records the evidence that satisfied the condition,
the pack's declarations are contributed to the registry, the catalogue and the tool factory; where no row
exists, the pack is `inactive` and contributes nothing. The manifest's own `activation.state` is never the
authority — a manifest that declares itself active without a recorded row loads inactive, and the discrepancy
is reported rather than resolved in the manifest's favour.

**Fallback.** A missing manifest makes the directory not a pack. An invalid manifest makes the pack contribute
nothing, and the product runs with its built-in roles, its own skills and its connector tools — Tier 2 of the
fallback hierarchy in `design.md`. A manifest written against a later `schemaVersion` major is refused whole and
the product asks for an update rather than reading around the member it does not recognise, because reading
around an unrecognised member means running work under a declaration nobody reviewed. The declared ceiling for
a pack's declarative content is 1 MiB (`model.md` § Physical Resource & Artifact Topology, **UNVERIFIED** — a
declared ceiling from `clarifications.md` session 2026-09-13, not a measurement).

## Semantics

**A pack is a source of declarations, never a second registration route.** The loader holds the factory; it is
not one. It is given `createWrappedTool` and an activation reader, and it is given neither the gate, nor the
ledger appender, nor any allowlist. So a pack's tool reaches an agent only as a `WrappedTool`, and everything
that follows — the intent record before the act, the verdict, the coordinator, the result record — is the same
sequence a connector tool goes through, in the same order, for the same reasons (INV-AG-44).

**A write contributed by a pack declares its reversibility or it does not exist.** Either a snapshot method
plus the formula for building its compensating action, or `irreversible: true`. A pack declaring neither for
any one of its write tools is refused **whole** at load, naming the tool and the missing declaration: not the
tool dropped and the rest loaded, because a pack whose author omitted a reversibility declaration is a pack
whose other declarations have not been established either. Undo replays the compensating action against current
state and never reverts a diff (principle IV).

**An unactivated pack contributes nothing, and no setting turns it on.** The user cannot activate a capability,
not because the product withholds the switch but because there is nothing a switch would mean: the condition is
evidence about how a platform actually behaves, and a preference cannot make a measurement true. What the user
is owed instead is the reason, and they get it — when work would need an inactive capability, the product states
the condition and names the measurement that would satisfy it, rather than failing the job obscurely.

**Content a pack's tools read is external content and authorises nothing.** A rendered page, a screenshot and
an accessibility tree enter an assembled context only as declared template inputs carrying their origin, never
concatenated into an instruction (INV-AG-39). Such content cannot authorise an operation, relax an approval
decision, alter the rules an agent operates under, or widen a tool allowlist — and the reason is positional
rather than filtering: the gate runs in the application layer, outside everything a model reads or writes
(principle II), and an allowlist is resolved once when a session starts and is immutable thereafter
(INV-AG-33). A screen is the sharper case of the two, because it can carry text from windows belonging to other
applications that the user never chose to show the product.

**Withdrawal is one operation across three surfaces.** Deactivating or removing a pack withdraws its
contributions from the role registry, the skill catalogue and the tool factory together; a pack half-withdrawn
would be a role whose tools no longer exist. Jobs already running keep the tool set they started with, because
a role's allowlist is resolved once at session start and frozen (INV-AG-33), so a withdrawal never changes what
a running agent holds and never needs to. Jobs created afterwards see the narrower set. Disabling a pack is
consequently the rollback for its capability, and it takes effect for jobs created after it.

**Loading is eager, in-process, and not hot-reloadable.** Packs are enumerated and validated at start because
their declarations must exist before any agent starts. They run in the Electron main process with no additional
sandbox: a pack is first-party content, so process isolation would buy nothing review does not already buy, and
the isolation that matters — between jobs — is the harness's per-instance session state, VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q4). Handler registrations are fixed for the process lifetime, because a
handler appearing mid-job would make the account of that job's calls inconsistent.

**A pack's handler can block and transform; it can never allow.** No interception point returns a value that
causes a call to execute (INV-AG-40), and the gate and the ledger write are steps of the wrapper rather than
registrations, so there is nothing for a pack to replace (INV-AG-41). The failure posture is a property of the
point and is not declarable: a pack's handler that throws or exceeds its budget at the before-a-tool-call point
causes the call to be refused, fail-closed, naming the handler; at any other point it is dropped, the failure
recorded, and the run continues.

**Where the browser pack drives, it drives a browser the product owns.** If and when it activates, its profile
is the product's own. Attaching to the user's signed-in browser through the debugger protocol — the path the
reference architecture describes as the most capable and the largest trust decision
(`https://omp.sh/docs/web`, UNVERIFIED) — is out of scope, because an attached tab carries every account the
user is signed into rather than the one the job needs, and the connector model exists precisely so that access
is scoped, revocable and recorded.

**Everything this contract says about what a browser or a desktop surface can actually do is UNVERIFIED.**
The reference architecture's descriptions of page reading, screen capture, accessibility trees and background
input (`https://omp.sh/docs/web`, `https://omp.sh/docs/computer`, UNVERIFIED) are vendor documentation about a
different runtime, and vendor documentation is never an architectural conclusion here. That most desktop input
is irreversible is likewise UNVERIFIED. The activation condition for both packs is the measurement proposed in
`design.md` R4 — spike **SP-26, proposed**: on Windows and macOS, what a page read and a screen read actually
return, whether an instruction embedded in a page or a window can alter agent behaviour end to end, which
desktop actions can be read back and therefore compensated, and what the operating system's permission flow
costs the user. Spike identifiers here are proposed; `spikes/` currently holds SP-0 through SP-22.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `PACK_SCHEMA_UNSUPPORTED` | The manifest's major `schemaVersion` is ahead of this build | Pack loader, at start | The pack contributes nothing; the product states that it needs an update and names the pack, rather than loading part of it |
| `PACK_MANIFEST_INVALID` | The manifest does not satisfy the schema file | Pack loader, at start | The pack contributes nothing; the failing member is named, because the reader who can fix it is the pack's author |
| `TOOL_DECLARATION_INCOMPLETE` | A contributed write tool declares neither a compensation formula nor `irreversible: true`, or declares both | Pack loader, at start | The pack is refused whole, naming the tool and the missing declaration — the case principle IV exists to prevent |
| `TOOL_NAME_COLLISION` | A contributed tool name is already held by the product, a connector or another pack | Pack loader, at start | The pack contributes nothing; nothing is shadowed, because a shadowed tool is a call the user believed went elsewhere |
| `ROLE_ID_COLLISION` | A contributed role identifier is already held by a built-in entry | Pack loader, at start | The pack contributes nothing; the six built-in entries are unaffected, since the product materialises them |
| `PATH_ESCAPES_PACK` | A declared role manifest or skill directory is absolute or leaves the pack directory | Pack loader, at validation | The pack contributes nothing; refused on the shape of the path, before any path is resolved |
| `CONTRIBUTION_NOT_FOUND` | A declared role manifest or skill directory does not exist inside the pack | Pack loader, at validation | The pack contributes nothing, naming what was declared and not found |
| `HANDLER_POINT_UNKNOWN` | A handler names a point outside the closed six, or names the gate or the ledger step | Lifecycle bus, at registration | The registration is refused and the pack contributes nothing; those steps are not points |
| `PACK_OVER_SIZE_CEILING` | The pack's declarative content exceeds the declared 1 MiB ceiling (UNVERIFIED) | Pack loader, at start | The pack contributes nothing; both the size and the ceiling are stated |
| `PACK_UNREADABLE` | The pack directory exists but its manifest cannot be read at all | Pack loader, at start | The pack is reported as unreadable rather than as non-conforming, because the remedies differ |
| `ACTIVATION_EVIDENCE_ABSENT` | The manifest declares `state: "active"` but no activation row records the evidence | Pack loader, after validation | The pack loads **inactive** and contributes nothing; the discrepancy is reported rather than resolved in the manifest's favour |

Two conditions that are deliberately not errors here. A pack whose activation condition is simply unmet is not
a failure at all — it is the ordinary `inactive` state, reported through `packs/list` with the condition and the
evidence it awaits. And a refused call to an active pack's tool is a `refused` result of
`agent/contracts/tool-wrapping@0.2.0`, not a pack error: by then the pack has done its whole job, which was to
declare the tool.

## Compatibility

**MAJOR** — removing a required member; adding a required member, since every existing manifest would then be
invalid; changing the meaning of `packId` or of `activation.state`; permitting a contributed tool to be
registered by any route other than the wrapping factory; permitting a write tool to omit both a compensation
formula and `irreversible: true`; making an unactivated pack contribute anything at all. The last three change
the security argument rather than the interface, and are MAJOR even where they are source-compatible.

**MINOR** — adding an optional member; adding a value to `reconciliation.method` or to
`compensation.argumentsSource` alongside the corresponding revision of the contract that owns that vocabulary;
adding an interception point to `handlers.point` alongside a MAJOR revision of
`agent/contracts/runtime-lifecycle@1.0.0`, since the point set is closed there and a seventh point is a new
place principle II must be re-argued. Adding the **provenance and integrity** section that the reserved
variability slot in `model.md` describes is MINOR in this file's shape — the members would be optional and no
existing first-party pack would become invalid — but it is not a MINOR change to the product, and the change
that makes it carries its own security design.

**PATCH** — tightening a description; adjusting a bound that no existing manifest violates; correcting an
example.

**Support window.** Both ends of this contract are inside one application build and update together, so there
is no mixed-version window to negotiate. The version exists for reviewers: a MAJOR here is an instruction to
re-read the bypass argument in `spikes/SP-6-pi-sdk/REPORT.md` §1 Q1, Q2 before the change ships, because that
measurement is what the single-factory claim rests on.

## Examples

### Valid Example: the browser automation pack, inactive

```json
{
  "schemaVersion": "1.0.0",
  "packId": "browser-automation",
  "name": "Browser automation",
  "version": "1.0.0",
  "description": "Reads and drives rendered web pages in a browser instance the product owns, with its own profile.",
  "contributes": {
    "tools": [
      {
        "name": "browser_open_page",
        "label": "Open a page",
        "description": "Open a URL in the product's browser and wait until it has rendered.",
        "direction": "read",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "url": { "type": "string" } },
          "required": ["url"]
        },
        "reconciliation": { "method": "none" }
      },
      {
        "name": "browser_read_page",
        "label": "Read the open page",
        "description": "Return the rendered text and link structure of the open page.",
        "direction": "read",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "selector": { "type": "string" } },
          "required": []
        },
        "reconciliation": { "method": "none" }
      },
      {
        "name": "browser_submit_form",
        "label": "Submit a form",
        "description": "Submit the named form on the open page.",
        "direction": "write",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "form": { "type": "string" }, "values": { "type": "object" } },
          "required": ["form", "values"]
        },
        "reconciliation": { "method": "none", "ambiguousOutcome": "ask_user" },
        "irreversible": true
      }
    ],
    "roles": [
      { "roleId": "page-reader", "manifest": "roles/page-reader.json" }
    ],
    "skills": [
      { "skillId": "read-a-rendered-page", "directory": "skills/read-a-rendered-page" }
    ]
  },
  "activation": {
    "condition": "A published measurement on Windows and macOS of what a page read actually returns, whether an instruction embedded in a page can alter agent behaviour end to end, and what the browser's profile and permission handling costs the user.",
    "evidence": { "spike": "SP-26", "status": "proposed" },
    "state": "inactive"
  },
  "secretClasses": [
    {
      "className": "browser-session-cookie",
      "recognisedBy": {
        "fields": ["result.cookies", "arguments.headers.cookie"],
        "valuePattern": "session|sid|auth"
      },
      "description": "Session material the product's own browser profile holds. It reaches the platform in the call and reaches no record, transcript or model request."
    }
  ],
  "handlers": [
    {
      "point": "after-tool-result",
      "budgetMs": 50,
      "purpose": "Attach the page's origin to the result so the composer carries the text as a declared template input with its source, never as instruction text."
    }
  ]
}
```

*Effect*: the pack validates, and contributes **nothing**. `packs/list` shows it as inactive with its condition
text and the spike it awaits; no browser tool appears in any tool set; a role allowlist naming `browser_read_page`
starts an agent without it and records the absence. Note that the activation condition names the measurement
itself (SP-26, proposed) and not a release or a date — the capability is waiting on knowledge. Everything the
pack's tools claim about a rendered page is UNVERIFIED for this product (`https://omp.sh/docs/web`, UNVERIFIED).

### Valid Example: the desktop control pack, inactive, with per-tool irreversibility

```json
{
  "schemaVersion": "1.0.0",
  "packId": "desktop-control",
  "name": "Desktop control",
  "version": "1.0.0",
  "description": "Reads the screen and sends input to applications and the operating system.",
  "contributes": {
    "tools": [
      {
        "name": "desktop_capture_screen",
        "label": "Capture the screen",
        "description": "Return an image of a display or a window.",
        "direction": "read",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "window": { "type": "string" } },
          "required": []
        },
        "reconciliation": { "method": "none" }
      },
      {
        "name": "desktop_read_clipboard",
        "label": "Read the clipboard",
        "description": "Return the current contents of a pasteboard.",
        "direction": "read",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "board": { "type": "string" } },
          "required": ["board"]
        },
        "reconciliation": { "method": "none" }
      },
      {
        "name": "desktop_set_clipboard",
        "label": "Replace the clipboard",
        "description": "Replace the contents of a pasteboard.",
        "direction": "write",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "board": { "type": "string" }, "content": { "type": "string" } },
          "required": ["board", "content"]
        },
        "reconciliation": { "method": "readback", "readOperation": "desktop_read_clipboard", "ambiguousOutcome": "ask_user" },
        "snapshot": { "readOperation": "desktop_read_clipboard", "targetParam": "board" },
        "compensation": { "tool": "desktop_set_clipboard", "argumentsSource": "snapshot", "argumentsFrom": "content" }
      },
      {
        "name": "desktop_click",
        "label": "Click a control",
        "description": "Send a click to a control identified in the accessibility tree.",
        "direction": "write",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "element": { "type": "string" } },
          "required": ["element"]
        },
        "reconciliation": { "method": "none", "ambiguousOutcome": "ask_user" },
        "irreversible": true
      },
      {
        "name": "desktop_type_text",
        "label": "Type text",
        "description": "Send keystrokes to the focused application.",
        "direction": "write",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "text": { "type": "string" } },
          "required": ["text"]
        },
        "reconciliation": { "method": "none", "ambiguousOutcome": "ask_user" },
        "irreversible": true
      }
    ],
    "roles": [],
    "skills": []
  },
  "activation": {
    "condition": "A published measurement on Windows and macOS of what a screen read and an accessibility tree actually return, which desktop actions can be read back and therefore compensated, whether text on screen can alter agent behaviour end to end, and what the operating system's permission flow costs the user.",
    "evidence": { "spike": "SP-26", "status": "proposed" },
    "state": "inactive"
  }
}
```

*Effect*: the pack validates and contributes nothing while inactive. What it demonstrates is the declaration
discipline principle IV requires, tool by tool: the clipboard write is reversible and says exactly how — read
the board before the write, restore that content after — while the click and the keystroke declare
`irreversible: true`, because nothing this pack can call un-clicks a control. Both irreversible tools would
require approval in modes `smart` and `on` under the existing rule for irreversible operations. That most
desktop input is in fact irreversible is UNVERIFIED and is part of what SP-26 (proposed) would measure
(`https://omp.sh/docs/computer`, UNVERIFIED). `roles` and `skills` are present and empty: this pack contributes
neither, and says so.

### Rejected Example: a contributed write tool declaring neither compensation nor irreversibility

```json
{
  "schemaVersion": "1.0.0",
  "packId": "desktop-control",
  "name": "Desktop control",
  "version": "1.1.0",
  "contributes": {
    "tools": [
      {
        "name": "desktop_drag_file",
        "label": "Drag a file",
        "description": "Drag a file from one window onto another.",
        "direction": "write",
        "changesPermission": false,
        "parameters": {
          "type": "object",
          "properties": { "from": { "type": "string" }, "onto": { "type": "string" } },
          "required": ["from", "onto"]
        },
        "reconciliation": { "method": "none" }
      }
    ],
    "roles": [],
    "skills": []
  },
  "activation": {
    "condition": "A published measurement of which desktop actions can be read back and therefore compensated.",
    "evidence": { "spike": "SP-26", "status": "proposed" },
    "state": "inactive"
  }
}
```

*Rationale*: `desktop_drag_file` writes and declares neither a snapshot plus compensation formula nor
`irreversible: true`. The whole pack is refused with `TOOL_DECLARATION_INCOMPLETE`, naming the tool and the
missing declaration — not the one tool dropped and the rest loaded. This is exactly the case principle IV
exists to prevent, and the refusal belongs at load where the pack's author sees it rather than at the first
call where a user does. That the refusal is whole-pack matters too: an author who omitted this declaration has
not established the others either.

### Rejected Example: a contributed path that leaves the pack directory

```json
{
  "schemaVersion": "1.0.0",
  "packId": "desktop-control",
  "name": "Desktop control",
  "version": "1.2.0",
  "contributes": {
    "tools": [],
    "roles": [
      { "roleId": "screen-reader", "manifest": "../../product/roles/worker.json" }
    ],
    "skills": [
      { "skillId": "drive-an-application", "directory": "/opt/shared/skills/drive" }
    ]
  },
  "activation": {
    "condition": "A published measurement of what a screen read actually returns on Windows and macOS.",
    "evidence": { "spike": "SP-26", "status": "proposed" },
    "state": "inactive"
  }
}
```

*Rationale*: both paths are refused with `PATH_ESCAPES_PACK`. The first climbs out of the pack directory to
name a product role document — which would let a pack contribute an identity it did not author; the second is
absolute, naming a location outside the product altogether. Every path member in this manifest is constrained
in shape, so the refusal happens at validation before any path is resolved. This is the same closure
`pet/contracts/pet-pack-manifest@1.0.0` applies to a pack's asset path, for the same reason: a manifest is
authored content, and a path is the one field through which authored content can reach something it does not
own.

## Migration

**No predecessor.** This contract is new at 1.0.0. No pack exists, no pack directory is populated, and no
application code has been written against an earlier shape, so there is nothing to convert. What a first
adopter must know is only that a pack is discovered rather than installed, and that a manifest is the whole of
what makes a directory a pack.

**Activation is a forward migration, not a schema one.** When SP-26 (proposed) is published and its result
satisfies a pack's condition, the activation row appears on the device carrying the evidence reference; the
pack's manifest changes only in that its `activation.evidence.status` becomes `published` with the report's
path and section named, and its `activation.state` follows. No contributed declaration changes, because the
declarations were authored to be correct before the measurement — which is the entire reason both packs are
specified now rather than when they are measured. Jobs already running are unaffected: their allowlists were
resolved and frozen when their sessions started (INV-AG-33), so the newly present tools are visible to jobs
created afterwards. Deactivation runs the same path in reverse and is the rollback for the capability.

**Two follow-on changes are named rather than assumed.** First, the constitution's *External Content Is Data*
section enumerates two sources of untrusted content, and a browser or a desktop surface makes four; a change
amending that enumeration is required before either pack activates, and is recorded in `design.md` § Open
Questions. It is postponable only because both packs ship inactive. Second, if Q-3 in `clarifications.md` is
ever answered "third-party packs are permitted", this contract gains the provenance and integrity section that
`model.md` holds as a reserved variability slot, and the change adding it carries its own security design; the
first line of `design.md` § Extensibility that must then change is the one stating that in-process loading is
safe because a pack is first-party content.

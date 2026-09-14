---
contract: role-routing
version: 1.0.0
status: draft
owner: agent
consumers: [agent, pet, uix, app, approval, undo, sync]
schema_files: [role-routing.schema.json]
---

# Contract: Role Routing

## Purpose

Every part of the product that needs a model answer — the pet answering the user, the worker doing the job, the
elicitation conversation compiling a rule, the undo agent reading the ledger, the gate's second-tier judge, and
now any role an account or a capability pack adds — asks this contract which model to use and gets one answer or
a stated reason there is none. It is the only path from a role to a model, and it is what settings edits when
the user changes their mind.

It exists because the role split is what makes the measured cost what it is — $0.167 a month at fifteen jobs
against $2.069 for the same work on one expensive model — VERIFIED
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6), and because two roles carry measured
prohibitions that a single-model configuration would silently violate
(`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`).

What changes at `1.0.0` is the left-hand side of the mapping and nothing else. A role is no longer one of six
names written into this contract; it is an entry in `agent/contracts/role-registry@1.0.0`, and what that entry
names is a **routing tier**. The table assigns models to tiers. Several roles may name one tier, and a role the
product has never heard of may name a tier of its own; neither fact reaches the table, which still holds exactly
one assignment per tier and still refuses to invent one. The separation of an identity layer from a routing
layer is the shape the reference architecture also arrives at (`https://omp.sh/docs/agents-and-roles`,
UNVERIFIED — vendor documentation, and Oh My Pi is a refused dependency, VERIFIED
`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9; it is read here as reference architecture, never resolved into code).

What it does not cover: where a profile points and what credential opens it, which belong to
`agent/contracts/provider-profile@0.1.0`; who the roles are, what they may hold and what they require, which
belong to `agent/contracts/role-registry@1.0.0`; how a failure is presented, which belongs to
`agent/contracts/provider-failure@0.1.0`; and what a request consumed, which belongs to
`agent/contracts/usage-accounting@0.1.0`.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`role-routing.schema.json`](./role-routing.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of the table as it is stored, replicated and validated before saving. It is worth reading
for the member it refuses as much as for the members it requires, and for one guarantee it can no longer make
alone.

**What the file still guarantees structurally.** The table admits no member beyond its version and its
assignments. A table-wide default profile is the substitution rule arriving by the back door, which INV-AG-23
forbids, and the descriptor's `additionalProperties: false` is what makes it unrepresentable rather than merely
discouraged. The six built-in tiers are still *required* keys, because the six built-in role entries that name
them cannot be removed (`specs/agent/spec.md`, registry requirement), so their absence from a table is always an
error and never a fact about this account.

**What the file can no longer guarantee alone, and what replaces it.** At `0.1.0` the record was closed, so
"every role is present" was a property of the shape. A tier set that the account's registry decides cannot be
enumerated by a static schema. The property is therefore carried by a stated reconciliation instead, performed
whenever the table is read and whenever the registry changes: the tiers named by registry entries and the keys
held by the table are compared, a tier named by some entry and absent from the table reads as **unassigned** and
is reported as `TIER_UNASSIGNED`, and a key held by the table that no entry names reads as `TIER_UNKNOWN` and is
never resolved. Neither case is ever closed by choosing a model. That is the whole of INV-AG-24 — absence is how
a slot quietly acquires an implicit default, so absence must be loud — and it is now enforced at the read rather
than at the parse. Everything the settings surface shows and every refusal at request time is driven by that
reconciliation, so there is no path on which an absent tier is silently satisfied.

What the file cannot express at all is everything that makes an assignment usable rather than merely well-formed:
that the profile still exists, that its credential is present on this device, that it still offers the named
model, and that the model declares what the tier's roles require. Each is checked at assignment and again at the
moment of the request, and each has a code of its own below. The file also deliberately carries no capability
list inside an assignment: what a model offers belongs to `agent/contracts/provider-profile@0.1.0` and what a
tier requires belongs to the entries naming it in `agent/contracts/role-registry@1.0.0`, and a third copy here
would be the one that goes stale.

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { ProfileId, ModelCapability, ResolvedEndpoint } from "provider-profile@0.1.0";
import type { RoleId } from "role-registry@1.0.0";

/**
 * The slot a model is assigned to. Open where the 0.1.0 `Role` union was closed: a tier exists because some
 * registry entry names it. This contract owns what a tier NAME may be — lower-case kebab-case, so the name an
 * entry writes and the key this table holds cannot differ by case or spacing — and `role-registry@1.0.0`
 * refuses an entry whose tier fails that pattern. Full pattern in role-routing.schema.json.
 */
type TierName = string;

/** The six tiers the product ships, named by the six built-in entries, which cannot be removed. */
type BuiltInTier =
  | "pet-text"
  | "pet-image"
  | "worker"
  | "rule-elicitation"
  | "undo"
  | "risk-judge";

/** All routing decides from. Deliberately not the request's content. */
interface InputShape {
  carriesImages: boolean;
}

/**
 * What an assignment of this tier must satisfy: the union of the capabilities declared by every role entry
 * naming the tier, carried with the roles that ask so a refusal can name one. The vocabulary is
 * `ModelCapability` and nothing else (INV-AG-32) — a requirement outside it is refused by the registry, because
 * a requirement that cannot be checked against a profile's declaration is not a requirement.
 */
interface TierRequirement {
  tier: TierName;
  required: ModelCapability[];
  requiredBy: RoleId[];
}

type Assignment =
  | { state: "assigned"; profileId: ProfileId; model: string; setAt: string; acknowledgedUnmeasured?: boolean }
  | { state: "unassigned" };

interface RoutingTable {
  tableVersion: string;                            // the version of THIS contract the table is written against
  assignments: Record<TierName, Assignment>;       // one per tier; no other member
}

/** The table reconciled against the registry. This, not the stored table, is what a reader acts on. */
interface TableView {
  table: RoutingTable;
  tiers: TierRow[];                                // one row per tier named by an entry, plus one per unknown key
}

interface TierRow {
  tier: TierName;
  /** `unknown` means the table holds a key no registry entry names; it is inert, not repurposed. */
  state: "assigned" | "unassigned" | "unknown";
  requirement: TierRequirement;
  suitability: SuitabilityVerdict | null;          // null when the product has measured nothing here
  error?: RoutingErrorCode;                        // why this row is not usable right now
}

/** What the product ships about models it has actually measured in a tier. */
interface SuitabilityVerdict {
  tier: TierName;                                  // only ever a built-in tier: those are what was measured
  profileId: ProfileId;                            // a profile the product ships; never a user-written one
  model: string;
  verdict: "suitable" | "unsuitable";
  evidence: string;                                // the spike report section that measured it
  summary: string;                                 // what was measured, in the user's words
}

type Resolution =
  | { ok: true; profileId: ProfileId; model: string; endpoint: ResolvedEndpoint }
  | { ok: false; error: RoutingErrorCode; tier: TierName; detail: string };

interface RoutingRegistry {
  table(): Promise<TableView>;
  assign(tier: TierName, profileId: ProfileId, model: string, acknowledgeUnmeasured?: boolean): Promise<AssignOutcome>;
  clear(tier: TierName): Promise<void>;
  /** What an assignment of this tier must satisfy, aggregated from the registry. Read-only. */
  requirement(tier: TierName): Promise<TierRequirement>;
  /**
   * In-process only. Never reachable from a window: it yields a resolved endpoint.
   * Takes a tier, not a role: the caller turns its role entry into a tier through `role-registry@1.0.0`, so
   * there remains exactly one place where a role becomes a model (INV-AG-31).
   */
  resolve(tier: TierName, shape: InputShape): Promise<Resolution>;
  /** What the composer is allowed to know: whether images may be attached, and why not. */
  imageRouteState(): Promise<{ available: boolean; reason?: RoutingErrorCode }>;
  /** Proposed when the first profile is saved; applied only after the user sees it. */
  proposeDefaults(profileId: ProfileId): Promise<RoutingTable>;
  suitability(tier: TierName, profileId: ProfileId, model: string): Promise<SuitabilityVerdict | null>;
}

type AssignOutcome =
  | { ok: true }
  | { ok: false; error: RoutingErrorCode; detail: string }
  | { ok: false; error: "UNMEASURED_NEEDS_ACKNOWLEDGEMENT"; measured: SuitabilityVerdict[] };

type RoutingErrorCode =
  | "TIER_UNASSIGNED"              // renamed from ROLE_UNASSIGNED at 1.0.0; the subject is the tier
  | "TIER_UNKNOWN"                 // the tier is named by no registry entry, or the table holds a key for one
  | "ROLE_CAPABILITY_UNMET"        // the model does not declare what a role naming this tier requires
  | "MODEL_MEASURED_UNSUITABLE"    // only ever returned for a profile the product ships
  | "UNMEASURED_NEEDS_ACKNOWLEDGEMENT"
  | "PROFILE_UNKNOWN"              // the assignment names a profile that no longer exists
  | "PROFILE_CREDENTIAL_ABSENT"    // usable on another device, not on this one
  | "MODEL_NOT_OFFERED"            // the profile no longer lists the assigned model
  | "TABLE_VERSION_AHEAD";
```

`ROLE_CAPABILITY_UNMET` keeps its name deliberately. The assignment refused is a tier's, but the requirement it
fails is a role's, and the refusal is only useful if it can say which role asks for what. Renaming it to a tier
code would lose exactly the fact the user needs to act on.

### 2. Wire / Communication Protocol

The settings window edits the table; the main process resolves it. The asymmetry is the same one
`provider-profile@0.1.0` establishes and for the same reason: a window may express the user's intent and can
never obtain a resolved endpoint.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `routing/table` | Window → Main | Request-Response | `{}` | `TableView` — one row per tier the registry names, each with its requirement, its suitability verdict and the reason it is unusable | `TABLE_VERSION_AHEAD`; rows carry `TIER_UNASSIGNED` and `TIER_UNKNOWN` |
| `routing/assign` | Window → Main | Request-Response | `{ tier, profileId, model, acknowledgeUnmeasured? }` | `AssignOutcome` | `TIER_UNKNOWN`, `ROLE_CAPABILITY_UNMET`, `MODEL_MEASURED_UNSUITABLE`, `UNMEASURED_NEEDS_ACKNOWLEDGEMENT`, `PROFILE_UNKNOWN`, `MODEL_NOT_OFFERED` |
| `routing/clear` | Window → Main | Request-Response | `{ tier }` | `{ cleared: true }` | `TIER_UNKNOWN` |
| `routing/choices` | Window → Main | Request-Response | `{ tier }` | the models each profile offers that satisfy the tier's requirement, each with its suitability verdict or none | `TIER_UNKNOWN`, `PROFILE_UNKNOWN` |
| `routing/defaults` | Window → Main | Request-Response | `{ profileId }` | the proposed `RoutingTable`, not yet applied | `PROFILE_UNKNOWN` |
| `routing/image-route` | Window → Main | Request-Response | `{}` | `{ available, reason? }` | None; this is the composer's whole view of routing |
| `routing/state` | Main → Window | Pub-Sub | — | `{ tier, state, error? }` for each tier whose usability changed, including one that appeared or disappeared because the registry changed | None; drives the settings badge and the system card |
| *(resolve)* | — | — | — | — | Not exposed. Resolution happens beside the request it serves |

**Channels that deliberately do not exist.** No channel returns a resolved endpoint, a credential or an address.
No channel lets a window learn which profile or model serves a tier from the composer's side of the boundary —
`routing/image-route` answers a yes-or-no question and a reason, and nothing more. No channel assigns a tier
from anywhere but the settings surface, so a model, a connector, a capability pack or a replicated record cannot
reassign a tier. A pack may contribute a role entry that names a *new* tier — which is a row the user must fill
— and it can never fill one.

### 3. Module Descriptor / Manifest Specification

The routing table as it is stored and replicated, which is also what the settings surface validates before
saving, is [`role-routing.schema.json`](./role-routing.schema.json). It is held beside this document rather than
transcribed into it, so that the shape the settings form enforces and the shape this contract describes cannot
drift apart.

**Discovery.** None for the table: one per account, created when the first profile is saved, edited only through
settings. Discovery of the *tiers* is the registry's: the set of tiers is exactly the set of tier names the
account's role entries declare, enumerated from `agent/contracts/role-registry@1.0.0` and never from the table.
The table is compared against that set, never trusted as it.

**Reconciliation against the registry.** Performed when the table is read, when the registry changes and when a
capability pack is activated or disabled:

- a tier named by an entry and absent from the table → the row exists in `TableView` with state `unassigned` and
  `TIER_UNASSIGNED`; work needing it does not start;
- a tier named by an entry and present as `{ state: "unassigned" }` → the same row and the same behaviour, which
  is why an absent key is not treated as a different case;
- a key the table holds that no entry names → the row exists with state `unknown` and `TIER_UNKNOWN`; it is
  never resolved, never repurposed for another tier, and is retained rather than deleted, so that re-enabling
  the pack or restoring the entry that named it restores the user's own assignment instead of asking again.

**Capability requirements.** An assignment must satisfy the union of the capabilities declared by the role
entries naming the tier. The six built-in entries declare, as shipped: image input and text for the pet image
role; text and tool calling for the worker and undo roles; text for the pet text, rule elicitation and risk
judge roles. A later entry declares its own, drawn from the same closed `ModelCapability` vocabulary a provider
profile can express (INV-AG-32). The vocabulary stays closed for one reason: every member of it is a protocol
fact this contract can check against `agent/contracts/provider-profile@0.1.0` before a request is sent, and a
requirement that cannot be checked mechanically is not a requirement but an opinion about model quality. The
product has a place for opinions about model quality — `SuitabilityVerdict` — and it is deliberately not a gate.
VERIFIED that capability is observable rather than inferred: both text models rejected an image with an explicit
protocol error in 100% of attempts while the vision model accepted the same image
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q1).

**Default assignment when defaults are proposed.** Proposals cover the built-in tiers only, because those are
the tiers the product has measured. With one model offered, every built-in tier is proposed that model, except
`pet-image`, which is proposed it only if it declares `images` and is left unassigned otherwise. With several
models offered, the proposal follows what was measured — the fast, inexpensive model for `pet-text` and
`risk-judge`, the strong model for `worker`, `rule-elicitation` and `undo`, the image-capable model for
`pet-image` — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q1, Q3;
`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`; `spikes/SP-9-undo-agent/REPORT.md#0-ket-luan`;
`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`). A tier named by an account-authored or pack-contributed entry
is proposed nothing and stays unassigned: the product holds no measurement for a role it did not write, and
guessing would be the implicit default under another name. A proposal is never applied without the user seeing
it.

**Fallback when there is no table.** Every tier reads as unassigned, the product asks for a provider, and no
request is made. A table whose `tableVersion` is ahead of the build is refused whole. A registry that is itself
refused whole (`REGISTRY_VERSION_AHEAD`, owned by `agent/contracts/role-registry@1.0.0`) leaves no tier
enumerable, so nothing resolves and the product asks for the update; routing does not fall back to the six
built-in names it happens to know, because that would be running work under an identity it cannot read.

## Semantics

**Resolution never substitutes.** A tier whose assignment cannot be used fails with the reason, naming the tier
and the roles waiting on it. It does not borrow another tier's model, another profile's credential, or the first
thing that happens to work. The reason is the measured one: the tiers carry different requirements precisely
because the wrong model in the wrong slot is a silent failure — a quarter of uncompilable rules were downgraded
without complaint by the cheap model (`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`), and a substitution
the user did not make is exactly how that would happen in production. Opening the role catalogue does not weaken
this: it is a property of the table, not of the union that used to key it.

**One tier, many roles, one assignment.** Two role entries naming one tier resolve to one model and remain
distinct in everything else they declare — instructions, allowlist, delegation, skills. The tier is the unit the
user assigns, which is why a role may not name two. The converse restraint matters as much: a role entry may
never name a provider, a model or a credential (INV-AG-31), because a second path from a role to a model is a
path the user's settings do not control, and the measured cost split depends on there being one path
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6).

**An unassigned tier is a state, not a gap.** `unassigned` is representable, reported and has defined behaviour:
no request, no job, a SYSTEM card naming the tier and the roles waiting on it. An absent key reconciles to the
same state rather than to a default. The distinction the product refuses to make is between "the user has not
chosen" and "the product will choose" — only the first exists.

**Capability is a gate, suitability is a statement.** `ROLE_CAPABILITY_UNMET` refuses an assignment, because a
model that does not declare image input demonstrably cannot take an image; the refusal names the capability and
the role that requires it. `MODEL_MEASURED_UNSUITABLE` refuses one too, but only inside a profile the product
ships, where the product knows exactly which model is being named. For everything else there is
`UNMEASURED_NEEDS_ACKNOWLEDGEMENT`: the assignment is offered back with what was measured for that tier, and the
same call with `acknowledgeUnmeasured` set completes it. A tier the product has never measured — every tier
outside the built-in six — always takes this path, which is the honest answer rather than a fabricated verdict.
The product does not pretend to enforce a judgement it has no way to make.

**The input shape, not the content, picks the slot.** `carriesImages` is the whole of it. Routing never reads
what the user wrote, and never asks a model what it can do: the capability facts come from the profile, which
the user wrote, and the failure mode of a wrong claim there is a refusal this contract's consumers already
classify.

**The composer sees one bit and a reason.** `imageRouteState` exists so the attachment control can be correct
before the user tries. It answers from the tier the built-in pet image role names, and from nothing else. It
deliberately does not say which model or profile would have served the request, nor which roles name that tier,
because a window has no use for that and every leak of it is a leak across the boundary
`provider-profile@0.1.0` draws.

**Assignments are the account's, credentials are the device's.** The table replicates; the credential does not.
A tier pointing at a profile with no credential here resolves to `PROFILE_CREDENTIAL_ABSENT`, which names the
profile and the tiers waiting on it. The assignment is untouched, because it is correct — it is this device that
is incomplete. The same asymmetry is why a table may arrive from another device holding a tier this build's
registry does not yet name: that is `TIER_UNKNOWN` for this device and a correct assignment for the account.

**Clearing is allowed; substituting is not.** `clear` returns a tier to unassigned, which is a representable
state with defined behaviour. Removing a profile a tier points at is refused by `provider-profile@0.1.0` with
`PROFILE_IN_USE`, so a table never silently acquires a dangling assignment through the settings surface; a table
that acquires one through replication reads as `PROFILE_UNKNOWN` and names the tiers. Removing the last role
entry that names a tier is refused by `role-registry@1.0.0` with `ROLE_IN_USE` where the entry is in use, and
where it is not, the tier's assignment survives as `TIER_UNKNOWN` rather than being collected.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `TIER_UNASSIGNED` | Work needs a tier that has no assignment, whether the key is present and unassigned or absent from the table | Main; no request, no job | A SYSTEM card naming the tier, the roles waiting on it, and offering the routing settings |
| `TIER_UNKNOWN` | A call names a tier no registry entry names, or the table holds an assignment for one | Main; the assignment is inert and retained | The settings surface lists the row as belonging to no current role, with the pack or entry it came from; no work resolves through it |
| `ROLE_CAPABILITY_UNMET` | The chosen model does not declare a capability a role naming this tier requires | Main, at assignment; also at request if a profile or a registry entry was edited afterwards | The settings form refuses and names the missing capability and the role that requires it; at request time, a SYSTEM card saying the tier is no longer satisfiable |
| `MODEL_MEASURED_UNSUITABLE` | A shipped profile's model was measured as unsuitable for this tier | Main, at assignment | The model is not offered for that tier; the reason and its evidence are available |
| `UNMEASURED_NEEDS_ACKNOWLEDGEMENT` | The product holds no measurement for this model in this tier, which is always the case outside the built-in six | Main, at assignment | A statement of what was measured, then the user's confirmation completes the assignment |
| `PROFILE_UNKNOWN` | The assignment names a profile that no longer exists | Main; the tier reads as unassigned | A SYSTEM card naming the tiers that lost their profile |
| `PROFILE_CREDENTIAL_ABSENT` | The profile has no credential on this device | Main; no request | The SYSTEM card `provider-profile@0.1.0` defines for a missing credential, extended with the tiers waiting on it |
| `MODEL_NOT_OFFERED` | The profile no longer lists the assigned model | Main; no request | A SYSTEM card pointing at the tier's assignment |
| `TABLE_VERSION_AHEAD` | The table replicated from a device running a newer build | Main; the table is refused whole | A SYSTEM card asking for the update; no tier starts work meanwhile |

Two neighbouring codes are named here only to say they are not this contract's: `CAPABILITY_UNKNOWN`, for an
entry declaring a requirement outside the closed vocabulary, and `REGISTRY_VERSION_AHEAD`, for a registry this
build cannot read, both belong to `agent/contracts/role-registry@1.0.0`. A refusal at the registry is what keeps
this contract's checks meaningful, so it is the registry that must report it.

## Compatibility

**This revision is MAJOR: `0.1.0` → `1.0.0`.** Three of its changes are breaking on their own terms. The key of
`assignments` changes from a closed six-member record to an open tier name, so a consumer that destructured the
six roles no longer covers the table. `ROLE_UNASSIGNED` is renamed `TIER_UNASSIGNED`, because the subject of the
sentence changed and a code that names the wrong subject is worse than a rename. And every surface parameter
named `role` is now `tier`, which is not cosmetic: a caller holding a `RoleId` must now resolve it through
`role-registry@1.0.0` first, and that resolution is the single path INV-AG-31 protects. The version reaches
`1.0.0` rather than `0.2.0` because the contract stops being provisional here: the tier indirection is what the
registry is built on, and every other contract in `req-025-pi-agent-system` depends on it holding still.

What did *not* change is the point of the revision. Resolution still never substitutes; there is still no
table-wide default; unassigned is still explicit rather than absent; the composer still sees one bit; the table
still replicates while credentials do not; and a table ahead of the build is still refused whole.

**MAJOR** — changing what a tier means; changing the key of `assignments`; adding a channel that returns a
resolved endpoint or names the resolved model to a window; making resolution substitute on failure; removing the
unassigned state; adding, removing or renaming a built-in tier; opening the `ModelCapability` vocabulary to
values a profile cannot declare.

**MINOR** — adding an optional member to an assignment; adding a `RoutingErrorCode` with a remedy; adding a
suitability verdict; relaxing a capability requirement; adding a read-only channel. Adding a *tier* is not a
change to this contract at all: it is a registry edit, and the table gains a row the user must fill.

**PATCH** — wording, labels, and the evidence citations attached to a verdict.

**Support window.** The table replicates between devices on different builds, so the mixed-version rule is the
same one `provider-profile@0.1.0` uses and for the same reason: a newer build reads an older table unchanged; an
older build meeting a newer `tableVersion` refuses the whole table rather than reading around a member it does
not recognise. Reading around an unrecognised member here would mean running a tier on a model the user assigned
to something else. Note the deliberate difference between the two unrecognised things: an unrecognised
*tableVersion* refuses the table whole, while an unrecognised *tier key* within a readable version is a reported
row. The first means the file's rules may have changed under the reader; the second means the account has a role
this device does not yet hold, which is a normal state of a replicated registry and not a reason to stop.

## Examples

**Valid** — the measured split, on a profile offering three models, with the six built-in tiers assigned:

```json
{
  "tableVersion": "1.0.0",
  "assignments": {
    "pet-text": { "state": "assigned", "profileId": "ark-shared", "model": "cheap-fast", "setAt": "2026-09-13T10:00:00Z" },
    "pet-image": { "state": "assigned", "profileId": "ark-shared", "model": "vision-pro", "setAt": "2026-09-13T10:00:00Z" },
    "worker": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-13T10:00:00Z" },
    "rule-elicitation": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-13T10:00:00Z" },
    "undo": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-13T10:00:00Z" },
    "risk-judge": { "state": "assigned", "profileId": "ark-shared", "model": "cheap-fast", "setAt": "2026-09-13T10:00:00Z" },
    "code-review": { "state": "unassigned" }
  }
}
```

The seventh key is what `1.0.0` adds: a tier named by an account-authored role entry. It is present and visibly
unassigned rather than proposed a model, because the product measured nothing for a role it did not write.

**Rejected** — a table that leaves the image tier out, carries its own model list, adds a table-wide default
profile, and keys one assignment by a name no tier may carry:

```json
{
  "tableVersion": "1.0.0",
  "defaultProfileId": "ark-shared",
  "assignments": {
    "pet-text": { "state": "assigned", "profileId": "ark-shared", "model": "cheap-fast", "setAt": "2026-09-13T10:00:00Z", "capabilities": ["text"] },
    "worker": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-13T10:00:00Z" },
    "rule-elicitation": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-13T10:00:00Z" },
    "undo": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-13T10:00:00Z" },
    "risk-judge": { "state": "assigned", "profileId": "ark-shared", "model": "cheap-fast", "setAt": "2026-09-13T10:00:00Z" },
    "Code Review": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-13T10:00:00Z" }
  }
}
```

Rejected on four counts, each for a reason the tier model did not change.

`pet-image` is absent rather than explicitly unassigned. The tier is named by a built-in entry that cannot be
removed, so its absence is never a fact about this account — it is a table that has lost a row, and absence is
how a slot quietly acquires an implicit default, which is the state INV-AG-24 exists to make impossible. Opening
the catalogue moved the *general* form of this check to the reconciliation against the registry, but the six
built-in keys stay structurally required precisely so that the common case fails at the parse.

An assignment carrying `capabilities` is a second copy of facts two other contracts own: what a model offers
belongs to `provider-profile@0.1.0`, what a tier requires belongs to the role entries in
`role-registry@1.0.0`. The copy would be the one that goes stale when the user edits the profile or the entry,
and it would go stale in the direction that sends an image to a model that can no longer read one.

`defaultProfileId` is the substitution rule arriving through the back door — a table-wide fallback is precisely
what INV-AG-23 forbids, which is why the descriptor accepts no member beyond the two it declares. This is the
member whose refusal the open keying makes *more* important, not less: with tiers arriving from a registry, a
single default would quietly answer for every role the product has never seen.

`"Code Review"` is not a tier name. Tier names are lower-case kebab-case so that the name a registry entry
writes and the key this table holds cannot differ by case or spacing; a table where `code-review` and
`Code Review` are two keys is a table where one role's assignment is invisible to the role that made it.

**Also valid** — one text-only model, which is the configuration the fallback exists for. Five tiers are
assigned and the image tier is visibly unassigned, which is what the composer reads to disable attachment:

```json
{
  "tableVersion": "1.0.0",
  "assignments": {
    "pet-text": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-13T10:00:00Z" },
    "pet-image": { "state": "unassigned" },
    "worker": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-13T10:00:00Z" },
    "rule-elicitation": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-13T10:00:00Z", "acknowledgedUnmeasured": true },
    "undo": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-13T10:00:00Z", "acknowledgedUnmeasured": true },
    "risk-judge": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-13T10:00:00Z" }
  }
}
```

## Migration

**From `0.1.0` to `1.0.0`: a re-key, not a re-choice.** An existing table holds six assignments keyed by the
closed role names. The six built-in role entries name tiers carrying those same identifiers — `pet-text`,
`pet-image`, `worker`, `rule-elicitation`, `undo`, `risk-judge` — so the migration writes the same six
assignments under the same six keys and changes `tableVersion` to `1.0.0`. Nothing else is touched:

- no assignment is moved to a different profile or model, and no tier acquires an assignment it did not have;
- a role that was unassigned becomes a tier that is unassigned, including `acknowledgedUnmeasured` where it was
  recorded, so a decision the user made is neither re-asked nor silently re-made;
- nothing is proposed to the user automatically. The migration produces no suggestion, no default and no
  notification beyond the ordinary settings view, because a migration that proposes is a migration that chooses
  (`design.md` § Migration & Rollback, Migration 1).

**Consumers that must update.** Every consumer in the front-matter reads a tier where it read a role: `pet` and
`uix` for the composer's one bit and the settings surface, `app` for the settings form and the SYSTEM cards,
`approval` for the risk judge, `undo` for the undo agent, `agent` for resolution itself, and `sync` for the
replicated record's shape. The change each makes is the same one: hold a `RoleId`, resolve it to a
`TierName` through `role-registry@1.0.0`, and pass the tier here.

**A tier added later.** When a role entry naming a new tier arrives — authored on this account or contributed by
a capability pack — the table gains a row that reads as unassigned and is reported, and the user assigns it. No
existing assignment is borrowed for it and no default is proposed, which is the same rule the `0.1.0` document
stated for a role added at a future MAJOR, now reached without a release. When the last entry naming a tier goes
away, its assignment is retained and reported as `TIER_UNKNOWN` rather than deleted, so restoring the entry
restores the user's choice; no other tier inherits it.

---
contract: role-routing
version: 0.1.0
status: draft
owner: agent
consumers: [agent, pet, uix, app, approval, undo, sync]
schema_files: [role-routing.schema.json]
---

# Contract: Role Routing

## Purpose

Every part of the product that needs a model answer — the pet answering the user, the worker doing the job, the
elicitation conversation compiling a rule, the undo agent reading the ledger, the gate's second-tier judge —
asks this contract which model to use and gets one answer or a stated reason there is none. It is the only path
from a role to a model, and it is what settings edits when the user changes their mind.

It exists because the role split is what makes the measured cost what it is — $0.167 a month at fifteen jobs
against $2.069 for the same work on one expensive model — VERIFIED
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6), and because two roles carry measured
prohibitions that a single-model configuration would silently violate
(`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`).

What it does not cover: where a profile points and what credential opens it, which belong to
`agent/contracts/provider-profile@0.1.0`; how a failure is presented, which belongs to
`agent/contracts/provider-failure@0.1.0`; and what a request consumed, which belongs to
`agent/contracts/usage-accounting@0.1.0`.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`role-routing.schema.json`](./role-routing.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of the table as it is stored, replicated and validated before saving. It is worth reading
for the two members it refuses as much as for the six it requires. Every role is required to be present, because
absence is how a role quietly acquires an implicit default (INV-AG-24), and an unassigned role must therefore say
so explicitly. And the table admits no member beyond its version and its assignments, because a table-wide
default profile is the substitution rule arriving by the back door, which INV-AG-23 forbids.

What the file cannot express is everything that makes an assignment usable rather than merely well-formed: that
the profile still exists, that its credential is present on this device, that it still offers the named model,
and that the model declares what the role requires. Each is checked at assignment and again at the moment of the
request, and each has a code of its own below. The file also deliberately carries no capability list
inside an assignment: those facts belong to `agent/contracts/provider-profile@0.1.0`, and a second copy here
would be the one that goes stale.

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { ProfileId, ModelCapability, ResolvedEndpoint } from "provider-profile@0.1.0";

/** The closed catalogue. A seventh member is a MAJOR change to this contract and a release. */
type Role =
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

/** What a role's requests need a model to declare. Fixed in the product, not configurable. */
interface CapabilityRequirement {
  role: Role;
  required: ModelCapability[];
}

type Assignment =
  | { state: "assigned"; profileId: ProfileId; model: string; setAt: string; acknowledgedUnmeasured?: boolean }
  | { state: "unassigned" };

interface RoutingTable {
  tableVersion: string;                       // the version of THIS contract the table is written against
  assignments: Record<Role, Assignment>;      // exactly six members, always present
}

/** What the product ships about models it has actually measured in a role. */
interface SuitabilityVerdict {
  role: Role;
  profileId: ProfileId;                       // a profile the product ships; never a user-written one
  model: string;
  verdict: "suitable" | "unsuitable";
  evidence: string;                           // the spike report section that measured it
  summary: string;                            // what was measured, in the user's words
}

type Resolution =
  | { ok: true; profileId: ProfileId; model: string; endpoint: ResolvedEndpoint }
  | { ok: false; error: RoutingErrorCode; role: Role; detail: string };

interface RoutingRegistry {
  table(): Promise<RoutingTable>;
  assign(role: Role, profileId: ProfileId, model: string, acknowledgeUnmeasured?: boolean): Promise<AssignOutcome>;
  clear(role: Role): Promise<void>;
  /** In-process only. Never reachable from a window: it yields a resolved endpoint. */
  resolve(role: Role, shape: InputShape): Promise<Resolution>;
  /** What the composer is allowed to know: whether images may be attached, and why not. */
  imageRouteState(): Promise<{ available: boolean; reason?: RoutingErrorCode }>;
  /** Proposed when the first profile is saved; applied only after the user sees it. */
  proposeDefaults(profileId: ProfileId): Promise<RoutingTable>;
  suitability(role: Role, profileId: ProfileId, model: string): Promise<SuitabilityVerdict | null>;
}

type AssignOutcome =
  | { ok: true }
  | { ok: false; error: RoutingErrorCode; detail: string }
  | { ok: false; error: "UNMEASURED_NEEDS_ACKNOWLEDGEMENT"; measured: SuitabilityVerdict[] };

type RoutingErrorCode =
  | "ROLE_UNASSIGNED"
  | "ROLE_CAPABILITY_UNMET"        // the model does not declare what the role requires
  | "MODEL_MEASURED_UNSUITABLE"    // only ever returned for a profile the product ships
  | "UNMEASURED_NEEDS_ACKNOWLEDGEMENT"
  | "PROFILE_UNKNOWN"              // the assignment names a profile that no longer exists
  | "PROFILE_CREDENTIAL_ABSENT"    // usable on another device, not on this one
  | "MODEL_NOT_OFFERED"            // the profile no longer lists the assigned model
  | "TABLE_VERSION_AHEAD";
```

### 2. Wire / Communication Protocol

The settings window edits the table; the main process resolves it. The asymmetry is the same one
`provider-profile@0.1.0` establishes and for the same reason: a window may express the user's intent and can
never obtain a resolved endpoint.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `routing/table` | Window → Main | Request-Response | `{}` | `RoutingTable`, plus the suitability verdict for each assigned model | `TABLE_VERSION_AHEAD` |
| `routing/assign` | Window → Main | Request-Response | `{ role, profileId, model, acknowledgeUnmeasured? }` | `AssignOutcome` | `ROLE_CAPABILITY_UNMET`, `MODEL_MEASURED_UNSUITABLE`, `UNMEASURED_NEEDS_ACKNOWLEDGEMENT`, `PROFILE_UNKNOWN`, `MODEL_NOT_OFFERED` |
| `routing/clear` | Window → Main | Request-Response | `{ role }` | `{ cleared: true }` | None |
| `routing/choices` | Window → Main | Request-Response | `{ role }` | the models each profile offers that satisfy the role, each with its suitability verdict or none | `PROFILE_UNKNOWN` |
| `routing/defaults` | Window → Main | Request-Response | `{ profileId }` | the proposed `RoutingTable`, not yet applied | `PROFILE_UNKNOWN` |
| `routing/image-route` | Window → Main | Request-Response | `{}` | `{ available, reason? }` | None; this is the composer's whole view of routing |
| `routing/state` | Main → Window | Pub-Sub | — | `{ role, state, error? }` for each role whose usability changed | None; drives the settings badge and the system card |
| *(resolve)* | — | — | — | — | Not exposed. Resolution happens beside the request it serves |

**Channels that deliberately do not exist.** No channel returns a resolved endpoint, a credential or an address.
No channel lets a window learn which profile or model serves a role from the composer's side of the boundary —
`routing/image-route` answers a yes-or-no question and a reason, and nothing more. No channel assigns a role
from anywhere but the settings surface, so a model, a connector or a replicated record cannot reassign a role.

### 3. Module Descriptor / Manifest Specification

The routing table as it is stored and replicated, which is also what the settings surface validates before
saving, is [`role-routing.schema.json`](./role-routing.schema.json). It is held beside this document rather than
transcribed into it, so that the shape the settings form enforces and the shape this contract describes cannot
drift apart.

**Discovery.** None. One table per account, created when the first profile is saved, edited only through
settings. The six roles are enumerated from the product, never from the table.

**Capability requirements as shipped.** `pet-image` requires `text` and `images`; `worker` and `undo` require
`text` and `tools`; `pet-text`, `rule-elicitation` and `risk-judge` require `text`. These are the requirements
that are mechanically checkable against a profile's declared offers, and they are the only ones enforced.

**Default assignment when defaults are proposed.** With one model offered, every role is proposed that model,
except `pet-image`, which is proposed it only if it declares `images` and is left unassigned otherwise. With
several models offered, the proposal follows what was measured — the fast, inexpensive model for `pet-text` and
`risk-judge`, the strong model for `worker`, `rule-elicitation` and `undo`, the image-capable model for
`pet-image` — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q1, Q3;
`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`; `spikes/SP-9-undo-agent/REPORT.md#0-ket-luan`;
`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`). A proposal is never applied without the user seeing it.

**Fallback when there is no table.** Every role reads as unassigned, the product asks for a provider, and no
request is made. A table whose `tableVersion` is ahead of the build is refused whole.

## Semantics

**Resolution never substitutes.** A role whose assignment cannot be used fails with the reason, naming the role.
It does not borrow another role's model, another profile's credential, or the first thing that happens to work.
The reason is the measured one: the roles carry different requirements precisely because the wrong model in the
wrong role is a silent failure — a quarter of uncompilable rules were downgraded without complaint by the cheap
model (`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`), and a substitution the user did not make is exactly
how that would happen in production.

**Capability is a gate, suitability is a statement.** `ROLE_CAPABILITY_UNMET` refuses an assignment, because a
model that does not declare image input demonstrably cannot take an image. `MODEL_MEASURED_UNSUITABLE` refuses
one too, but only inside a profile the product ships, where the product knows exactly which model is being named.
For everything else there is `UNMEASURED_NEEDS_ACKNOWLEDGEMENT`: the assignment is offered back with what was
measured for that role, and the same call with `acknowledgeUnmeasured` set completes it. The product does not
pretend to enforce a judgement it has no way to make.

**The input shape, not the content, picks the slot.** `carriesImages` is the whole of it. Routing never reads
what the user wrote, and never asks a model what it can do: the capability facts come from the profile, which
the user wrote, and the failure mode of a wrong claim there is a refusal this contract's consumers already
classify.

**The composer sees one bit and a reason.** `imageRouteState` exists so the attachment control can be correct
before the user tries. It answers from `pet-image` alone. It deliberately does not say which model or profile
would have served the request, because a window has no use for that and every leak of it is a leak across the
boundary `provider-profile@0.1.0` draws.

**Assignments are the account's, credentials are the device's.** The table replicates; the credential does not.
A role pointing at a profile with no credential here resolves to `PROFILE_CREDENTIAL_ABSENT`, which names the
profile and the roles waiting on it. The assignment is untouched, because it is correct — it is this device that
is incomplete.

**Clearing is allowed; substituting is not.** `clear` returns a role to unassigned, which is a representable
state with defined behaviour. Removing a profile a role points at is refused by `provider-profile@0.1.0` with
`PROFILE_IN_USE`, so a table never silently acquires a dangling assignment through the settings surface; a table
that acquires one through replication reads as `PROFILE_UNKNOWN` and names the roles.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `ROLE_UNASSIGNED` | Work needs a role that has no assignment | Main; no request, no job | A SYSTEM card naming the role and offering the routing settings |
| `ROLE_CAPABILITY_UNMET` | The chosen model does not declare a capability the role requires | Main, at assignment; also at request if a profile was edited afterwards | The settings form refuses and names the missing capability; at request time, a SYSTEM card saying the role is no longer satisfiable |
| `MODEL_MEASURED_UNSUITABLE` | A shipped profile's model was measured as unsuitable for this role | Main, at assignment | The model is not offered for that role; the reason and its evidence are available |
| `UNMEASURED_NEEDS_ACKNOWLEDGEMENT` | The product holds no measurement for this model in this role | Main, at assignment | A statement of what was measured, then the user's confirmation completes the assignment |
| `PROFILE_UNKNOWN` | The assignment names a profile that no longer exists | Main; the role reads as unassigned | A SYSTEM card naming the roles that lost their profile |
| `PROFILE_CREDENTIAL_ABSENT` | The profile has no credential on this device | Main; no request | The SYSTEM card `provider-profile@0.1.0` defines for a missing credential, extended with the roles waiting on it |
| `MODEL_NOT_OFFERED` | The profile no longer lists the assigned model | Main; no request | A SYSTEM card pointing at the role's assignment |
| `TABLE_VERSION_AHEAD` | The table replicated from a device running a newer build | Main; the table is refused whole | A SYSTEM card asking for the update; no role starts work meanwhile |

## Compatibility

**MAJOR** — adding, removing or renaming a role; changing what a role means; adding a channel that returns a
resolved endpoint or names the resolved model to a window; making resolution substitute on failure; removing the
unassigned state.

**MINOR** — adding an optional member to an assignment; adding a `RoutingErrorCode` with a remedy; adding a
suitability verdict; relaxing a capability requirement; adding a read-only channel.

**PATCH** — wording, labels, and the evidence citations attached to a verdict.

**Support window.** The table replicates between devices on different builds, so the mixed-version rule is the
same one `provider-profile@0.1.0` uses and for the same reason: a newer build reads an older table unchanged; an
older build meeting a newer `tableVersion` refuses the whole table rather than reading around a member it does
not recognise. Reading around an unrecognised member here would mean running a role on a model the user
assigned to something else.

## Examples

**Valid** — the measured split, on a profile offering three models:

```json
{
  "tableVersion": "0.1.0",
  "assignments": {
    "pet-text": { "state": "assigned", "profileId": "ark-shared", "model": "cheap-fast", "setAt": "2026-09-12T10:00:00Z" },
    "pet-image": { "state": "assigned", "profileId": "ark-shared", "model": "vision-pro", "setAt": "2026-09-12T10:00:00Z" },
    "worker": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-12T10:00:00Z" },
    "rule-elicitation": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-12T10:00:00Z" },
    "undo": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner", "setAt": "2026-09-12T10:00:00Z" },
    "risk-judge": { "state": "assigned", "profileId": "ark-shared", "model": "cheap-fast", "setAt": "2026-09-12T10:00:00Z" }
  }
}
```

**Rejected** — a table that leaves the image role out, carries its own model list, and adds a table-wide default
profile:

```json
{
  "tableVersion": "0.1.0",
  "defaultProfileId": "ark-shared",
  "assignments": {
    "pet-text": { "state": "assigned", "profileId": "ark-shared", "model": "cheap-fast", "capabilities": ["text"] },
    "worker": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner" },
    "rule-elicitation": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner" },
    "undo": { "state": "assigned", "profileId": "ark-shared", "model": "strong-reasoner" },
    "risk-judge": { "state": "assigned", "profileId": "ark-shared", "model": "cheap-fast" }
  }
}
```

Rejected on three counts. `pet-image` is absent rather than explicitly unassigned, and the difference matters:
absence is how a role quietly acquires an implicit default, which is the state INV-AG-24 exists to make
impossible. An assignment carrying `capabilities` is a second copy of a fact `provider-profile@0.1.0` owns; the
copy would be the one that goes stale when the user edits the profile, and it would go stale in the direction
that sends an image to a model that can no longer read one. And `defaultProfileId` is the substitution rule
arriving through the back door — a table-wide fallback is precisely what INV-AG-23 forbids, which is why the
descriptor accepts no member beyond the two it declares.

**Also valid** — one text-only model, which is the configuration the fallback exists for. Five roles are
assigned and the image role is visibly unassigned, which is what the composer reads to disable attachment:

```json
{
  "tableVersion": "0.1.0",
  "assignments": {
    "pet-text": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-12T10:00:00Z" },
    "pet-image": { "state": "unassigned" },
    "worker": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-12T10:00:00Z" },
    "rule-elicitation": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-12T10:00:00Z", "acknowledgedUnmeasured": true },
    "undo": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-12T10:00:00Z", "acknowledgedUnmeasured": true },
    "risk-judge": { "state": "assigned", "profileId": "local-llm", "model": "single-model", "setAt": "2026-09-12T10:00:00Z" }
  }
}
```

## Migration

Not applicable at `0.1.0`: no routing table exists in the field. When a role is added at a future MAJOR, an
older table is read as having that role unassigned and the user is asked to assign it, rather than the product
choosing a model for a role the user has never seen. When a role is removed, its assignment is dropped and
recorded in the change's own migration note; no other role inherits it.

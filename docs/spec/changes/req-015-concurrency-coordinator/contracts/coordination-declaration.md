---
contract: coordination-declaration
version: 0.1.0
status: draft
owner: connector
consumers: [connector, job, ledger, agent, app, uix]
schema_files: [coordination-declaration.schema.json]
---

# Contract: Coordination Declaration

## Purpose

The coordinator has to know which object a call is about before the call happens, and it must know this without
knowing anything about the platform the object lives on. This contract is how: each writing tool declares which
of its own arguments name the things it may change, and each connector declares how its identifiers are spelled
and what its platform tolerates. The coordinator reads the declaration and does the rest.

It is the `open` variability point of this change's model. Adding the Nth platform must not edit the
coordinator, which principle VI requires; and a coordinator that guessed which argument held the object would
guess wrong on the first platform whose write takes two identifiers, and would then lock nothing while believing
it had locked something — the failure measured in `spikes/SP-15-concurrency/REPORT.md` §1 Q2 with a false sense
of safety on top.

The declaration is authored as part of the connector manifest that
`connector/contracts/connector-manifest@1.2.0` defines, and is read once, at registration. It is never read from
a call, never fetched, and never reloaded while the product runs.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`coordination-declaration.schema.json`](./coordination-declaration.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of both declarations, and its bounds are the measured ones rather than round numbers: a
concurrency above eight, a rate below a tenth of a request per second and a wait limit outside one to sixty
seconds are each outside what was measured, and the file says so instead of a comment hoping someone reads it.

What the file cannot express is the part a reviewer must supply. That a declared `path` exists in that tool's own
parameters, that a declared `type` means the same thing across a connector's tools, and above all that the
declared resources cover everything the call actually changes are judgements about a platform, not properties of a
document. A declaration that names too little satisfies this file completely, and the coordinator then locks
nothing while believing it has locked something — the failure of `spikes/SP-15-concurrency/REPORT.md` §1 Q2 with a
false sense of safety on top.

## Schema / Surface

### 1. Interface & Data Types

```typescript
/** Added to ToolDeclaration in connector-manifest@1.2.0. Required for every tool whose direction is write. */
interface ToolCoordination {
  resources: ResourceDeclaration[];   // at least one for a writing tool
}

interface ResourceDeclaration {
  type: string;                       // the second part of the key; constant, never read from the arguments
  path: string;                       // where the identifier sits in this tool's arguments
  optional?: boolean;                 // true when some calls of this tool legitimately omit it
}

/** Added to ConnectorManifest in connector-manifest@1.2.0. Absent means the product's defaults. */
interface ConnectorCoordination {
  identifier_normalisation?: "none" | "lowercase" | "strip_separators" | "strip_separators_lowercase";
  concurrency?: number;               // jobs that may be `running` at once against one account; default 4
  reserved_interactive?: number;      // how many of those only the interactive class may take; default 1
  rate?: { requests_per_second: number; burst?: number };   // supersedes rate_policy where both are present
  class_weights?: { interactive: number; background: number };  // default 3 : 1 — UNMEASURED
  background_floor?: number;          // least share of dispatches the background class receives; default 0.2 — UNMEASURED
  wait_limit_ms?: number;             // how long a call waits for a held resource; default 15000
}
```

### 2. Wire / Communication Protocol

Not applicable, and for the same reason the manifest itself has none: a declaration is part of a resource
shipped with the application, read once by the process that owns the connectors. It crosses no boundary, is
fetched from nowhere and is discovered in no user directory. A declaration that arrived over a channel would be
a description of what to lock that the product had not reviewed, which is worse than no declaration at all,
because the failure it enables is silent.

### 3. Module Descriptor / Manifest Specification

The normative shape of both members is
[`coordination-declaration.schema.json`](./coordination-declaration.schema.json). They are authored inside the
connector manifest that `connector/contracts/connector-manifest@1.2.0` defines — `tool_coordination` on a tool,
`connector_coordination` on the manifest — and the file is not restated here.

The bounds it carries are the measured ones, and the paragraph below says why each is where it is.

`concurrency` is bounded at eight because that is where the measurement stops being favourable: eight concurrent
jobs on one account produced refusals for volume at about five percent and a 7,533 ms completion, against
1,725 ms at three — `spikes/SP-15-concurrency/REPORT.md` §1 Q4. A connector declaring more than the maximum is
clamped to it and the clamp is reported to its author, rather than the manifest being refused, because a pacing
opinion should not cost the product a platform.

## Semantics

- **A writing tool without `tool_coordination` costs its connector every tool.** Not a warning, not a default:
  the manifest is refused whole, as it already is for a write tool that declares neither a compensation nor its
  irreversibility, and as the living requirement that a manifest is loaded whole or not at all demands. A write
  that cannot be held exclusively is a write whose recorded before state may be false, and a false before state
  is what destroys another job's work when it is later compensated; a connector that loaded its other tools
  would look healthy while the operation the user most needs protected had quietly vanished. This is the
  opposite of the fallback `job/contracts/tool-reconciliation@0.1.0` takes for its own missing declaration, and
  the difference is deliberate: there, the missing information costs a question after a rare crash; here, it
  costs data.
- **`type` is constant and `path` is read.** The type is what the connector calls this kind of thing and is
  fixed in the manifest; the identifier is read from the call's arguments at the declared path — the same value
  the adapter will address. This is what makes it impossible for a call to hold one object and change another
  (INV-CN-15), and it is why there is no field by which a call may state its own key.
- **A `path` that the tool's parameter shape does not contain is a registration failure.** It is caught where a
  connector author sees it rather than at the first call, which is the same treatment
  `connector/contracts/connector-manifest@1.0.0` gives an incompletely declared writing tool.
- **`optional` means some calls legitimately omit it, not that locking is optional.** A call that omits an
  optional resource is coordinated on the resources it does name. A call that omits a non-optional one is
  `RESOURCE_KEY_UNRESOLVABLE` and does not execute.
- **Normalisation may only merge spellings, never separate them.** `strip_separators` exists because the
  measured platform accepts one object's identifier with and without separators, and two spellings of one object
  must not become two keys. A declared rule that could map one object to two keys is refused at registration; a
  rule that maps two objects to one key is permitted but costs unnecessary serialisation, and is therefore a
  performance decision rather than a correctness one.
- **`rate` describes the platform, not the product's appetite.** It paces one authorisation's queue. It does not
  raise the concurrency limit, and it does not license a connector to bypass the queue when it is idle.
- **`class_weights` and `background_floor` are unmeasured defaults, and are declared as such.** The property
  they serve — that a job's wait does not grow with another job's backlog and that no job is starved — is a
  requirement in `specs/connector/spec.md` and does not move. The numbers do:
  `spikes/SP-15-concurrency/REPORT.md` §1 Q3 measured plain round-robin, and the weighting and the floor are
  recommendations of that report (`#3-dau-vao-cho-tai-lieu-ky-thuat` item 2, `#4-rui-ro-moi-phat-hien`,
  RISK-050) that nobody has run. `verification.md` records them as unverified, and open question Q-6 in
  `clarifications.md` owns closing them.
- **Absence is a decision with a default, not an error, at connector level.** A connector that declares no
  `connector_coordination` is coordinated by the product's defaults: four concurrent jobs, one reserved,
  15-second wait limit, and the connector's existing `rate_policy` for pacing. Only the per-tool half is
  mandatory, because only the per-tool half is about correctness.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `COORDINATION_MISSING` | A writing tool declares no `tool_coordination` | Callee, at registration | That connector yields no tool and is presented as unavailable naming the tool; every other connector is unaffected, and the defect is reported to the connector's author |
| `COORDINATION_PATH_UNKNOWN` | A `path` names an argument the tool's parameter shape does not contain | Callee, at registration | As above, naming the offending path |
| `COORDINATION_INVALID` | The declaration does not satisfy `coordination-declaration.schema.json` | Callee, at registration | As above; a malformed declaration is never treated as absent, because absence has a meaning here and a typo does not |
| `NORMALISATION_UNSAFE` | A declared normalisation could map one object to more than one key | Callee, at registration | As above: the manifest is refused whole, because a key that splits is exclusivity the product believes it has and does not; the author is told which rule is unsafe |
| `COORDINATION_POLICY_CLAMPED` | A declared concurrency, rate or wait limit lies outside the accepted range | Callee, at registration | Nothing; the value is clamped and the clamp is reported to the author, because a pacing opinion should not cost a platform. Named as `connector/contracts/connector-manifest@1.2.0` names it, so one code is not two |
| `RESOURCE_KEY_UNRESOLVABLE` | At call time, a non-optional declared path is absent from the arguments | Caller | The call fails without touching the platform; surfaced by `connector/contracts/resource-coordinator@0.1.0` |

## Compatibility

**MAJOR** — making `tool_coordination` optional for a writing tool; permitting a key to be supplied by a call;
adding a normalisation that can split one object across keys; changing what an absent per-tool declaration
means. Each of these changes the correctness argument rather than the shape, which is why they are MAJOR even
where every existing manifest would still validate.

**MINOR** — adding an optional field; adding a normalisation rule that can only merge spellings; adding a job
class, provided its competition with the existing two is defined at the same time.

**PATCH** — wording, and adjusting an unmeasured default once a measurement exists, since the defaults are
declared as provisional here and in `verification.md`.

**Support window.** Declarations are versioned with the connector manifest that carries them, and both ends live
in one application release. A manifest written against `1.1.0` of the manifest contract loads under `1.2.0`
unchanged, except that a manifest declaring write tools is refused until those tools declare their resources —
which is the migration recorded in `evolution.md` and in that contract's own Migration section.

## Examples

**Accepted** — a tool that moves one object into another, declaring both:

```json
{
  "tool_coordination": {
    "resources": [
      { "type": "page", "path": "page_id" },
      { "type": "database", "path": "parent.database_id", "optional": true }
    ]
  },
  "connector_coordination": {
    "identifier_normalisation": "strip_separators_lowercase",
    "concurrency": 4,
    "reserved_interactive": 1,
    "rate": { "requests_per_second": 2.5, "burst": 15 }
  }
}
```

Both resources are obtained together, in canonical key order, before the before state is read — so the pair of
objects a move touches cannot be half-held while another job takes the other half. The normalisation is what
makes one page identifier, written two ways by two agents, one key.

**Rejected** — a connector that asks to name its own keys:

```json
{
  "key_supplied_by_call": true,
  "tool_coordination": {
    "resources": [
      { "type": "page", "path": "lock_key" }
    ]
  }
}
```

Refused by the schema, which admits no such field: every object here sets `additionalProperties: false`, so a
declaration that invents a way to supply a key does not load. The invented field is the visible half of the
defect and the schema catches it. The other half it cannot catch is `lock_key` itself — a parameter that exists
only to carry a key — and the loader refuses that separately with `COORDINATION_PATH_UNKNOWN` when the tool's
own shape does not contain it. Where such a parameter does exist, only review catches it, and it must: a value
the model produces alongside the arguments could name one object while the call changes another, which is
precisely what INV-CN-15 forbids. The correct declaration names the argument the platform call itself addresses,
`page_id`, so that what is held and what is changed cannot be two different things.

## Migration

Not applicable at 0.1.0 — this is the first version. Its effect on an existing contract is:
`connector/contracts/connector-manifest` moves to `1.2.0` to carry these two objects, additively, and that
version is published by this change alongside this one. Every manifest valid under `1.1.0` remains structurally
valid under `1.2.0`; what changes is that a manifest whose write tools declare no resources is refused whole.
`evolution.md` states the steps, and `impact.md` records that of the two connectors specified so far, the one in
`req-003-notion-compensation` writes and must be updated, while the one in `req-014-byo-oauth-google` is
read-only and is unaffected.

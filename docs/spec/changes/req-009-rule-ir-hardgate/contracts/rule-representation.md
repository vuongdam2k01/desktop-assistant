---
contract: rule-representation
version: 1.0.0
status: draft
owner: approval
consumers: [agent, uix, sync]
schema_files: [rule-representation.schema.json, rule-representation.sql]
---

# Contract: Rule Representation

## Purpose

This is the only form in which a rule may be stored, replicated, displayed or evaluated. The elicitation
conversation compiles the user's stated intention directly into this form with nothing in between; the gate reads
this form and nothing else; the application window lists rules by reading this form; replication carries this
form between the user's devices. A rule that is not expressible here is reported to the user as unsupported and
is not stored, because the alternative — storing it in a weaker form — is the silent downgrade the product exists
to avoid.

The representation is deliberately closed. It cannot express arbitrary computation, cannot carry executable text,
and cannot be extended by a connector, a user or an administrator. Widening it is a versioned change to this
contract that re-runs the frozen adversarial corpus.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`rule-representation.schema.json`](./rule-representation.schema.json) | JSON Schema 2020-12 | normative |
| [`rule-representation.sql`](./rule-representation.sql) | SQL DDL | normative |

`rule-representation.schema.json` is the shape of a rule, and its closed leaf set is the expressiveness boundary
this contract exists to hold: a condition naming a leaf the file does not describe is not a rule in a weaker
form, it is not a rule. What the file cannot express is stated here instead, and is enforced when a rule is
compiled and when a catalogue is loaded: that a pattern compiles within its bound, that every connector, tool and
object type the rule names is declared by a loaded manifest, and that ownership and object metadata are read from
the connector's own record rather than from the arguments of the call being judged. Each of those is a relation
between a rule and something outside it, so a rule can satisfy the file and still be refused.

`rule-representation.sql` is the physical shape of the catalogue store: the stored rules, the permanent allowlist
entries beside them, and the two guards that belong in the store rather than in the code that writes to it — that
no stored rule can claim an origin other than the user, and that a rule with no confirmation instant cannot be
written at all. It is a store of its own, separate from the ledger's (INV-APPROVAL-07). Hardline rules and the
smart tier's static patterns appear in neither file, because they are part of the application build; that absence
is the point, and it is what no catalogue edit, corruption or replication can undo.

## Schema / Surface

### 1. Interface & Data Types

The normative shape is [`rule-representation.schema.json`](./rule-representation.schema.json). The declarations
below name the same members for a reader and carry the meaning the file holds only as description.

```typescript
/** The unit that is stored, replicated and evaluated. */
interface Rule {
  /** Version of THIS contract the rule was written against. */
  representationVersion: string;          // e.g. "1.0.0"
  id: string;                             // stable, opaque, unique within the account
  name: string;                           // short label the user sees in the rule list
  /** The restatement the user confirmed, in their own language. Displayed, never parsed. */
  restatement: string;
  origin: "user";                         // stored rules carry no other origin — see Semantics
  verdict: Verdict;
  condition: Condition;
  /** When the user confirmed the restatement. A rule binds from this moment and not before. */
  confirmedAt: string;                    // ISO-8601 instant
}

/** Ordered by strictness: refuse is strictest, allow is weakest. */
type Verdict = "refuse" | "hold" | "allow";

type Condition =
  | { kind: "all"; of: Condition[] }      // conjunction; at least one member
  | { kind: "any"; of: Condition[] }      // disjunction; at least one member
  | { kind: "not"; of: Condition }
  | Leaf;

type Leaf =
  | ToolLeaf | ScopeLeaf | FieldLeaf | OwnershipLeaf
  | CountLeaf | TimeLeaf | IrreversibleLeaf | PermissionLeaf;

/** Which platform and which operation. Both values come from a connector manifest. */
interface ToolLeaf {
  kind: "tool";
  connector?: string | string[];
  tool?: string | string[];
}

/** What the operation acts on. Never a display name — see INV in model.md. */
interface ScopeLeaf {
  kind: "scope";
  /** An object type declared by the connector's manifest, e.g. the value Notion declares for a database. */
  objectType?: string | string[];
  /** The object's immutable identifier, as the manifest defines identity for that type. */
  objectId?: string | { in: string[] };
  /** Matches when the object's ancestor chain contains the given identifier(s). */
  ancestor?: { contains: string } | { containsAny: string[] };
}

/** Which fields the operation changes, and what they end up holding. */
interface FieldLeaf {
  kind: "field";
  /** Matches on the set of fields this call changes. Names are compared after normalisation. */
  changes?: {
    includes?: string;
    includesAny?: string[];
    /** True when, after removing the listed fields, the call still changes something. */
    remainderNotEmpty?: string[];
  };
  /** Matches on the resulting value of one named field. */
  becomes?: {
    field: string;
    equals?: JsonValue;
    oneOf?: JsonValue[];
    noneOf?: JsonValue[];
    /** Pattern applied to the resulting value rendered as text. Matching only; never executed. */
    matches?: string;
  };
  /** Matches when the call removes a field from the object's shape rather than changing its value. */
  removes?: true | string | { in: string[] };
}

/** Who the object belongs to. Read from the connector's record, never from call arguments. */
interface OwnershipLeaf {
  kind: "ownership";
  createdBy?: { in?: Principal[]; notIn?: Principal[] };
  assignedTo?: { includes?: string; excludes?: string; in?: Principal[]; notIn?: Principal[] };
}

/** "currentUser" resolves at evaluation time to the signed-in account; "product" is the assistant itself. */
type Principal = string | "currentUser" | "product";

/** How much of something has already happened. Counted from ledger records, not session memory. */
interface CountLeaf {
  kind: "count";
  metric: "writes" | "creates" | "distinctObjects" | "fieldChanges";
  boundary: "job" | "calendarDay";
  /** Required when metric is "fieldChanges"; names the field being counted. */
  field?: string;
  operator: "gt" | "gte" | "eq";
  value: number;                          // non-negative integer
}

/** When the operation is attempted, in the user's own time zone. */
interface TimeLeaf {
  kind: "time";
  /** Matches when the local time falls OUTSIDE the given window. */
  outside?: [string, string];             // "HH:mm", "HH:mm"
  /** Matches when the local day is one of these. */
  onDays?: Array<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun">;
}

/** Reads the connector manifest's declaration for this tool. */
interface IrreversibleLeaf { kind: "irreversible"; is: boolean; }
interface PermissionLeaf { kind: "permission"; changes: boolean; }

type JsonValue = string | number | boolean | null;

/** What is stored and replicated as a whole. */
interface RuleCatalogue {
  representationVersion: string;
  rules: Rule[];
}
```

### 2. Wire / Communication Protocol

Not applicable to this contract. The rule representation is a stored form, not a channel; the channels that carry
it between the gate, the application window and replication are defined in `contracts/gate-evaluation.md` and in
the `sync` capability's replication contract respectively.

### 3. Module Descriptor / Manifest Specification

This contract defines no manifest. It *depends* on one: every value a `ToolLeaf` or `ScopeLeaf` names, and every
irreversibility and permission declaration an `IrreversibleLeaf` or `PermissionLeaf` reads, comes from the
connector manifest owned by the `connector` capability. The fields this contract requires that manifest to declare
are listed under Manifest Schema in `model.md`. A rule naming a connector, tool or object type that no loaded
manifest declares is a rule whose condition can never be satisfied; it is reported to the user rather than stored
as if it protected something.

## Semantics

**Verdicts and conflict.** The three verdicts are totally ordered by strictness — refuse, then hold, then allow.
When several rules match one call, the gate returns the strictest of their verdicts. There is no priority,
weight or ordering field anywhere in this contract, and none may be added without a MAJOR bump: a number that
decides which of the user's protections wins would put that decision in the hands of whatever compiled the rule.

**Origin.** Stored rules always carry origin `user`. Hardline rules and the static patterns of the smart tier use
the same condition language but ship inside the product's build and never appear in a stored catalogue; a stored
rule claiming any other origin is rejected on load. This is what makes the hardline list unreachable by editing,
corrupting or replicating a catalogue.

**Binding.** A rule takes effect from `confirmedAt` and not before. A rule that has been elicited but not
confirmed is absent from every evaluation.

**Name normalisation.** Every field name — in `changes`, in `becomes.field`, in `CountLeaf.field` — is compared
after normalisation that disregards case, spaces, underscores and hyphens, so that one rule written as the user
said it matches every spelling a connector uses.

**Value extraction.** Before comparison, a field's value is extracted from whatever structure the connector's
payload wraps it in, using the connector manifest's declaration where it gives one. A value that cannot be
extracted does not mean the rule failed to match: the call is held for the user's decision. Failing to extract is
a failure to evaluate, and evaluation fails closed.

**Patterns.** `becomes.matches` is a pattern compared against the resulting value rendered as text. It is matching
only. It is never executed as code, never given the power to call out, and never applied to anything but that one
field's resulting value. Patterns are bounded in length and rejected if they cannot be compiled; a rejected
pattern makes the whole rule unstorable rather than making that leaf vacuous.

**Counts.** A `CountLeaf` asks the ledger how much has already happened within its boundary, and the candidate
call counts as one. `boundary: "job"` means the job the call belongs to; `boundary: "calendarDay"` means the
calendar day in the user's time zone. A count is never taken from session memory, so restarting the application
does not reset it and a second signed-in device does not start from zero.

**Time.** `outside` and `onDays` are evaluated in the time zone recorded for the user, not the machine's. Two
devices in different zones therefore agree about whether a rule about working hours matched.

**Principals.** `currentUser` resolves at evaluation time to the account that is signed in; `product` is the
assistant acting on the user's behalf. Any other value is an identifier as the connector states it. Ownership is
read from the connector's record of the object, never from the call's own arguments.

**Empty catalogue versus unreadable catalogue.** A catalogue holding zero rules is valid and means the user has
written none. A catalogue that cannot be read or does not validate is not an empty catalogue: writes stop until
it is repaired.

## Error Matrix

These are the outcomes of validating a catalogue on load and of compiling a rule for storage. Both are fallible,
and both fail closed.

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `RULE_SCHEMA_INVALID` | A stored rule does not match this contract — unknown leaf kind, missing required member, wrong shape. | Callee (the gate, on load) | Every write operation stops. The user is told the rules could not be loaded and which rule is at fault. The catalogue is not partially loaded. |
| `RULE_VERSION_AHEAD` | The catalogue states a `representationVersion` this build does not know, typically after replication from a device running a newer release. | Callee (the gate, on load) | Every write operation stops. The user is told this device's version is behind and is offered the update. The gate does not guess at the unknown parts. |
| `RULE_ORIGIN_FORBIDDEN` | A stored rule claims an origin other than `user`. | Callee (the gate, on load) | Treated as `RULE_SCHEMA_INVALID`, and additionally recorded as a tampering attempt, because no legitimate path writes such a rule. |
| `RULE_PATTERN_INVALID` | A `becomes.matches` pattern will not compile or exceeds the length bound. | Callee (at compile time) | The rule is not stored. The user is told which part of their intention could not be expressed, per the existing requirement that an uncompilable description is reported and not downgraded. |
| `RULE_REFERENCE_UNKNOWN` | A connector, tool or object type named by the rule is declared by no loaded manifest. | Callee (at compile time) | The rule is not stored. The user is told the platform or operation is not connected, rather than being given a rule that silently protects nothing. |
| `RULE_COUNT_FIELD_MISSING` | `metric` is `fieldChanges` and no `field` is given. | Callee (at compile time and on load) | At compile time the rule is not stored; on load it is `RULE_SCHEMA_INVALID`. |
| `FIELD_VALUE_UNEXTRACTABLE` | A field a rule needs cannot be extracted from the call's payload. | Callee (at evaluation) | The call is held for the user's decision, with the reason stated. It is never allowed through. |

## Compatibility

**MAJOR** — removing a leaf kind, a metric, a boundary or a verdict; changing what an existing member means;
changing the conflict resolution from strictest-wins; adding any form of priority or ordering; making a
previously optional member required. Catalogues written against the previous major version do not load, and the
migration section below must state what happens to them.

**MINOR** — adding a leaf kind, a metric, a boundary, or an optional member. Catalogues written against an older
minor version continue to load unchanged. A build cannot load a catalogue whose version is *ahead* of it, minor
included, because the unknown parts might be the parts that stop something — see `RULE_VERSION_AHEAD`. This is
the asymmetry that keeps a mixed-version account safe.

**PATCH** — wording, examples, clarification that changes no accepted or rejected input.

**Support window.** Every version within the current major is supported for loading. Because the account
replicates to several devices that may update at different times, a newer catalogue reaching an older device
stops writes on that device rather than being downgraded, and the user is told to update. The product carries no
code that reads a newer catalogue by ignoring what it does not recognise.

**Version discovery.** `representationVersion` appears both on the catalogue and on each rule, so that a rule
copied out of one catalogue into another still states what it was written against.

## Examples

A valid rule — "before anything is archived in my HR database, ask me first":

```json
{
  "representationVersion": "0.1.0",
  "id": "rule_7f3a91",
  "name": "Ask before archiving anything in HR",
  "restatement": "Before archiving any page in the HR Portal database, stop and ask me.",
  "origin": "user",
  "verdict": "hold",
  "confirmedAt": "2026-09-12T09:14:22Z",
  "condition": {
    "kind": "all",
    "of": [
      { "kind": "tool", "connector": "notion", "tool": ["archive_page", "delete_block"] },
      { "kind": "scope", "objectType": "page", "ancestor": { "contains": "db-hr-portal-uuid-001" } }
    ]
  }
}
```

A rejected rule — three faults, each on its own sufficient:

```json
{
  "representationVersion": "0.1.0",
  "id": "rule_bad",
  "name": "Protect the customer database",
  "restatement": "Never delete anything in the database called Khách hàng.",
  "origin": "hardline",
  "verdict": "refuse",
  "priority": 1000,
  "condition": {
    "kind": "scope",
    "objectName": "Khách hàng"
  }
}
```

It is rejected because `origin` is `hardline`, which no stored rule may claim (`RULE_ORIGIN_FORBIDDEN`); because
`priority` is not a member of this contract and ordering is not how conflicts are resolved
(`RULE_SCHEMA_INVALID`); and because `objectName` does not exist — a rule may not anchor to a display name, since
renaming the object would step around it, which is a measured evasion
(`spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi`, Q5 case A-20). The user's intention is
expressible: anchored to the database's immutable identifier instead, it stores and holds.

## Migration

**From `0.1.0` (drafted in `req-001-mvp-product-definition`) to `1.0.0`.** The draft was carried into the spec
system with the product baseline and explicitly left to be frozen here, after the representation had been
attacked with the adversarial rule corpus. No catalogue exists in the field and no application code exists yet,
so this is a migration of documents rather than of stored data. What changed, and why:

1. **The verdict set replaced the draft's `effect` plus decision pair.** The draft carried `effect:
   'require_approval' | 'deny'` on the rule and a separate `decision: 'allow' | 'require_approval' | 'deny'` on
   the evaluator's answer. One totally ordered set — refuse, hold, allow — now lives on the rule itself, because
   conflict resolution is strictest-wins and a strictness order is only meaningful over a single set.
2. **Every rule and catalogue carries `representationVersion`.** The draft had no version on the stored form,
   which left an older build free to read a newer catalogue by ignoring what it did not recognise. Ignoring an
   unknown member is fail-open, and in an account replicating to several devices the older device meets the
   newer catalogue routinely.
3. **The condition language became a closed, kind-tagged leaf set.** The draft's flat variants (`connector`,
   `tool`, `direction`, `irreversible`, `objectCountAtLeast`, `targetProperty`, `targetOwnedByUser`, `targetIn`)
   are replaced by eight named leaves — tool, scope, field, ownership, count, time, irreversible, permission —
   each with its own members. The closed set is the safety argument recorded in `model.md`: an evaluator whose
   inputs cannot be enumerated cannot be reasoned about.
4. **Counting became bounded and ledger-derived.** `objectCountAtLeast` became `CountLeaf` with an explicit
   metric and boundary, because "how much has already happened" is only answerable against a stated window and a
   stated source of truth.
5. **The rule's displayed text is the confirmed restatement.** `statement` plus `state:
   draft|confirmed|superseded` became `name`, `restatement`, `origin` and `confirmedAt`; a rule binds from the
   moment the user confirmed it, which a lifecycle enum could express only by convention.
6. **The evaluator interface left this contract.** The draft declared `RuleEvaluator.evaluate(...)` and
   `RuleTestOutcome` here. This contract now defines the stored form only; how a call is judged, and the
   channel that carries the judgement, belong to `contracts/gate-evaluation.md`.

Consumers to update: none in the field. Within this documentation set, `req-004-rule-elicitation` compiles into
this form and `req-011-risk-judge` runs after it; both are sequenced after this change in the roadmap and read
`1.0.0`. A future MAJOR bump must fill this section in again and re-run the frozen adversarial corpus, because a
representation change is a change to what can be expressed and therefore to what can be protected.

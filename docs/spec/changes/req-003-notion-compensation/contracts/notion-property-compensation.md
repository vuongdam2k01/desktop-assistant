---
contract: notion-property-compensation
version: 0.1.0
status: draft
owner: connector
consumers: [connector, undo, uix]
schema_files: [notion-property-compensation.schema.json]
---

# Contract: Notion Property Compensation

## Purpose

`connector/contracts/connector-manifest@1.1.0` says that a write tool has a snapshot and a compensating action.
It does not say what a snapshot of a structured object contains, and it cannot: that is the one thing about a
platform that is genuinely the platform's own. This contract is that missing half for the first connector — one
rule per property kind, saying what is kept from the platform's representation and what payload restores it —
together with the write operations built from those rules, the way the connector recognises a database's order
property, and the mapping from the platform's refusals to the closed set of connector error codes.

Three parties build on it. The Notion adapter implements it, and may hold no compensation knowledge that is not
written here. The undo planner reads the outcome vocabulary it defines, because `restored`, `approximated` and
`narrowed` are different sentences to a user and the distinction is decided by these rules rather than by the
planner. The interface presents those outcomes, and must be able to render each one without inventing wording.

Every rule below was measured against three real workspaces of deliberately different shape — one plain, one
carrying relation, rollup and formula properties, and one carrying a numeric order property — through the raw
HTTP surface rather than a client library (`spikes/SP-1-notion-compensation/REPORT.md`,
`spikes/SP-1-notion-compensation/evidence/compensation-matrix.md`). Where a row is not measured, it says so.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`notion-property-compensation.schema.json`](./notion-property-compensation.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of a published rule set: one entry per property kind, what it keeps, what a restoring
payload sends, what an empty recorded value does, and what compensating it can leave behind. It carries the two
couplings the measurements make non-negotiable — a `select` or `status` keeps an option and is restored by
identity, a `multi_select` keeps an option list and is restored by identity — so a rule that would restore a
choice by its label is refused by the file rather than by a reviewer's attention.

What the file cannot express is the table in §2 itself: that the set of rules is complete for this connector, and
that a property kind absent from it is neither projected nor written (INV-NT-01). Nor does it carry the outcome
vocabulary — `restored`, `approximated`, `narrowed` and the rest are different sentences to a user, and what each
means is held here, in §1 and in *Semantics*.

## Schema / Surface

### 1. Interface & Data Types

```typescript
/** One kind of platform property, and the whole of what the connector knows about compensating it. */
interface ProjectionRule {
  property_kind: string;              // the platform's own name for the kind
  writeable: boolean;                 // false means the platform computes it: never projected, never sent
  keep: KeptShape;                    // what enters the projection
  restore: RestoreShape;              // how a restoring payload is built from what was kept
  empty_behaviour: EmptyBehaviour;    // what the platform does when the kept value is empty
  residue: "none" | "schema_option";  // what compensating a write of this kind can leave behind
}

type KeptShape =
  | { form: "scalar" }                                  // number, checkbox, url, email, phone number
  | { form: "text" }                                    // title, rich text: the plain content, not its styling
  | { form: "option"; keeps: ["id", "name"] }           // select, status: identity addresses the write (INV-NT-04)
  | { form: "option_list"; keeps: ["id", "name"] }      // multi-select
  | { form: "date"; keeps: ["start", "end", "time_zone"] }
  | { form: "identity_list" }                           // people, relation: platform identities only
  | { form: "not_projected"; reason: string };          // computed kinds

type RestoreShape =
  | { sends: "scalar" | "text" | "date" | "identity_list" }
  | { sends: "option_by_id"; fallback: "report_conflict" }      // never falls back to the label
  | { sends: "option_list_by_id"; fallback: "report_conflict" }
  | { sends: "nothing"; reason: string };

type EmptyBehaviour =
  | { on_empty: "cleared" }                             // the property returns to empty
  | { on_empty: "platform_default"; outcome: "approximated" };  // the platform substitutes; say so

/** What one compensating step achieved, in the words the report and the interface use. */
type CompensationOutcome =
  | { outcome: "restored" }
  | { outcome: "approximated"; what: string; why: string }   // accepted, but not the recorded value
  | { outcome: "narrowed"; restored: string[]; refused: RefusedPart[] }
  | { outcome: "reopened_then_restored" }                    // the object was removed and was brought back first
  | { outcome: "conflicted"; differs: string[] }
  | { outcome: "not_restorable"; reason: string; residue?: Residue[] };

interface RefusedPart { property: string; platform_message: string }

interface Residue { kind: "schema_option"; database: string; option_label: string }

/** What the connector learned about a database in order to write to it correctly. Job-scoped, never stored. */
interface DatabaseSchemaObservation {
  database_id: string;
  observed_at: string;                 // ISO-8601
  properties: Record<string, { kind: string; options?: { id: string; name: string }[] }>;
  order_property: string | null;       // null means free reordering is unsupported for this database
}

/** What the platform last said about reaching an object. An observation with a time, never a stored attribute. */
type Recoverability =
  | { state: "present"; observed_at: string }
  | { state: "removed_recoverable"; observed_at: string }     // returned whole, marked removed
  | { state: "not_returned"; observed_at: string; causes: ["removed_permanently", "no_longer_visible"] };
```

### 2. Property projection rules

The rules below are the complete set. A property whose kind is absent from this table is neither projected nor
written (INV-NT-01), which makes an unknown kind a refusal at authoring time rather than a surprise at undo time.

| Property kind | Writeable | Kept in the projection | Restoring payload | Recorded value empty | Residue | Measured |
| --- | --- | --- | --- | --- | --- | --- |
| `title` | yes | the plain text content | the text, as the platform's title shape | cleared | none | round-trip at full integrity (Q1, Q2) |
| `rich_text` | yes | the plain text content | the text, as the platform's rich-text shape | cleared | none | round-trip at full integrity (Q1) |
| `number` | yes | the number | the number | cleared | none | round-trip at full integrity (Q1, Q4) |
| `select` | yes | option identity and label | the option addressed by identity | cleared | `schema_option` — a label the write invented stays in the database's settings | round-trip at full integrity; the residue is measured (Q8) |
| `status` | yes | option identity and label | the option addressed by identity | **platform default** — the outcome is `approximated`, never `restored` | none | measured: an empty status is set to the first option of the to-do group (Q8) |
| `multi_select` | yes | each option's identity and label | the options addressed by identity | cleared | `schema_option`, as for `select` | round-trip at full integrity (Q1) |
| `date` | yes | start, end and time zone | the three as recorded | cleared | none | round-trip at full integrity; dependent formulas recompute by themselves (Q6) |
| `people` | yes | the platform identity of each person | the identities as recorded | cleared | none | data round-trips at full integrity; the notification it causes does not (Q3) |
| `checkbox` | yes | true or false | the value | not applicable — the kind has no empty | none | round-trip at full integrity (Q1) |
| `url`, `email`, `phone_number` | yes | the string | the string | cleared | none | round-trip at full integrity (Q1) |
| `relation` | yes | the platform identity of each related object | the identities as recorded | cleared | none | round-trip at full integrity; dependent rollups recompute by themselves (Q6) |
| `formula` | no | not projected — the platform computes it from other properties | nothing | — | none | writing it is refused with HTTP 400 (Q1, Q6) |
| `rollup` | no | not projected — the platform computes it from a relation | nothing | — | none | writing it is refused with HTTP 400 (Q1, Q6) |
| `created_time`, `created_by` | no | not projected — fixed by the platform at creation | nothing | — | none | writing either is refused with HTTP 400 (Q1) |
| `last_edited_time`, `last_edited_by` | no | not projected — set by the platform at every write | nothing | — | none | the platform overwrites them with the instant and identity of the caller, including the caller performing an undo (Q1, Q2) |
| any other kind | no | not projected | nothing | — | none | **unmeasured**: kinds the spike did not exercise, including files and unique identifiers, are outside this version |

Two consequences are worth stating rather than deriving. Restoring a `relation` or a `date` restores every value
the platform computes from it, so a compensating action never needs to mention a computed property — it is
enough that it does not. And `status` is the one kind whose compensation can succeed while returning something
other than what was recorded, which is why `approximated` exists as an outcome at all.

### 3. Declared write operations

The full tool set of the first connector, of which `connector/contracts/connector-manifest@1.1.0` shows four as
its example. `Compensation` names the tool that reverses the operation and where its arguments come from.

| Tool | Direction | Snapshot | Compensation | Side effects | Notes |
| --- | --- | --- | --- | --- | --- |
| `notion_query_database` | read | — | — | — | Returns matching tasks; an empty result is a result, not a failure |
| `notion_read_page` | read | — | — | — | The read every snapshot is taken with |
| `notion_read_database_schema` | read | — | — | — | Produces the `DatabaseSchemaObservation` that §4 depends on |
| `notion_create_task` | write | none — the object does not exist yet | `notion_archive_page`, from the **result** | — | The compensating action addresses the object the creation returned; the identifier is not reclaimed |
| `notion_update_properties` | write | `notion_read_page`, excluding the six computed kinds | `notion_update_properties`, from the **snapshot** | — | The general property write; the assignment case is a separate tool |
| `notion_assign_person` | write | `notion_read_page`, excluding the six computed kinds | `notion_assign_person`, from the **snapshot** | notification to the person, not recallable | Declared separately precisely so the effect can be declared unconditionally |
| `notion_set_order` | write | `notion_read_page`, excluding the six computed kinds | `notion_set_order`, from the **snapshot** | — | Refused as `UNSUPPORTED` where the database has no order property (§4) |
| `notion_archive_page` | write | `notion_read_page`, excluding the six computed kinds | `notion_restore_page`, from the **snapshot** | — | Removal is recoverable at the platform; the child content returns with the object |
| `notion_restore_page` | write | `notion_read_page`, excluding the six computed kinds | `notion_archive_page`, from the **snapshot** | — | The mirror of the previous row; the two compensate each other |
| `notion_create_comment` | write | none | none — `irreversible: true` | — | The platform publishes no operation that removes or edits a comment (Q3) |

No tool creates a page outside a database. That capability is unverified and is a reserved point in
`model.md`, not an omission.

### 4. Order property detection

A database expresses manual order only if it carries a property for it; the platform has no native position a
write can address, and a write carrying one is refused (Q4). The connector therefore reads the database's schema
and recognises an order property by kind and name:

- an **order** property is of kind `number` and its name matches `/(order|thứ tự|stt|vị trí|rank|pos)/i`;
- a **priority** property is of kind `select` or `status` and its name matches `/(priority|ưu tiên|mức độ|độ ưu tiên|urgency)/i`;
- a **state** property is of kind `status` or `select` and its name matches `/(status|trạng thái|state|tiến độ)/i`.

Recognition never creates and never chooses under doubt. Where no order property is found, `order_property` is
`null`, `notion_set_order` is refused for that database with the declared code `UNSUPPORTED` before anything is
written, and the user is told which property the database would need. Where exactly one is found, reordering is
an ordinary `number` write and is compensated from the snapshot at full integrity. Where more than one property
matches, `order_property` is `null` and the user is asked which one they mean, because a recognition rule that
picks the first match would silently renumber a property that means something else. The recognised names are an
`open` variability point: adding a name, including in a further language, is a change to this contract and to
nothing else.

### 5. Module Descriptor / Manifest Specification

The rules of §2 are data, in the same sense that a manifest is data. A connector build publishes them as a
descriptor so that they can be validated and reviewed rather than read out of code, and the normative shape of
that descriptor is [`notion-property-compensation.schema.json`](./notion-property-compensation.schema.json). It
is not restated here.

The file carries the two couplings that matter most and that a reviewer would otherwise have to notice by eye: a
`select` or `status` keeps an option and is restored by identity, and a `multi_select` keeps an option list and is
restored by identity. What it cannot express is §2 itself — that the set of rules is complete for this connector,
and that a property kind absent from it is neither projected nor written (INV-NT-01) — together with the meaning
each outcome carries to a user.

### 6. Wire / Communication Protocol

Not applicable. These rules are read inside the process that owns the connectors and cross no boundary of their
own. What crosses a boundary is the platform request the rules produce, and that edge is
`connector/contracts/connector-adapter@1.0.0`.

## Semantics

- **A projection is not the platform's object.** The adapter never records what the platform returned; it records
  what these rules kept (INV-NT-02). A rule that keeps less than the platform returns is the normal case, and the
  difference is not a loss — it is the part no write can restore.
- **Identity addresses a write; a label never does.** Both are kept so that the interface can name the option a
  person recognises, but the payload is built from identity, and an option that has disappeared from the schema
  produces `conflicted` rather than a new option created by label (INV-NT-04).
- **An empty value is a value.** Restoring a property to empty is a write, not an omission, for every kind whose
  `empty_behaviour` is `cleared`. The single exception is `status`, where the platform substitutes its own
  default, and the outcome is `approximated` with what was substituted and why.
- **A refusal narrows the attempt; it never widens it.** When the platform refuses a payload as invalid, the
  restoring payload is rebuilt without the refused property and sent again. The narrowed attempt may only ever
  contain entries that came from the recorded projection, so narrowing cannot introduce a value the snapshot did
  not hold. When nothing remains, the outcome is `not_restorable` and the object is left as it was.
- **A removed object is reopened before it is restored, not instead of it.** `removed_recoverable` is an
  observation, so a compensating step that meets it first returns the object to a reachable state and then
  applies the projection, reporting `reopened_then_restored` so that the user learns the object had been removed.
- **A residue is named, not repaired.** Compensating a write that invented a `select` label removes the value
  from the object and leaves the label in the database's settings, because no platform operation removes it. The
  report names it; the product does not attempt to tidy the user's database.
- **Nothing here decides whether a compensation may run.** These rules describe how a restoration is built and
  what it achieves. Whether the step runs at all — conflict, confirmation, order of steps — belongs to `undo`,
  and whether the original call was permitted belongs to `approval`.
- **Everything projected is untrusted content.** Titles, text, labels and people's names are data recorded and
  replayed; no value in a projection is parsed for meaning or reaches a model as an instruction.

## Error Matrix

The platform's conditions, mapped to the closed set of codes in `connector/contracts/connector-adapter@1.0.0`.
The connector invents no code: a platform that fails in a way the set does not name is a `PLATFORM_ERROR`
carrying the platform's own words.

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `INVALID_PARAMS` | The platform refused the payload as invalid — a computed value, a status option that does not exist, or a malformed identifier (HTTP 400) | Both — the adapter reports, the undo narrows | The restorable properties are restored; each refused property is named with the platform's reason |
| `NOT_FOUND` | The platform will not return the object (HTTP 404), which covers both permanent removal and withdrawn visibility and does not distinguish them | Caller decides; the adapter states both causes | The step is reported as not applicable, naming both possibilities rather than asserting deletion |
| `CONFLICT` | The recorded option no longer exists in the database's schema, or current state differs from what this job left | Caller — the undo asks the user | The item is presented as a conflict with what differs, and nothing is overwritten |
| `UNSUPPORTED` | Free reordering in a database with no order property, or a property kind with no rule | Callee, before any write | The operation is refused before anything changes, naming what the database would need |
| `RATE_LIMITED` | The platform refused for volume (HTTP 429), carrying the delay it requires | Callee — the gateway waits that delay and a small jitter, then retries; where a refusal carries no delay, it backs off by doubling from one second to a ceiling of sixty | The job continues after the wait; nothing is reported unless the wait exhausts the job's budget |
| `CONNECTOR_EXPIRED` | The authorisation is no longer accepted (HTTP 401) | Caller — the job ends with a route to reconnect | The connector is shown as needing reconnection, distinctly from a permission shortfall |
| `PERMISSION_DENIED` | The authorisation is accepted but does not cover this call (HTTP 403) | Caller | The connector is shown as needing wider permission, and re-consent is offered |
| `SNAPSHOT_UNREADABLE` | The prior state of a write target could not be read | Callee, before the write | The write is treated as having no restorable prior state and is not attempted as though one existed |
| `PLATFORM_ERROR` | Any other failure of the platform's own | Caller — retried only if the platform said it may be | The platform's own message is shown, unrewritten |

An object returned whole and marked removed is not an error and appears nowhere above: it is the observation
`removed_recoverable`, and the step proceeds by reopening the object first.

## Compatibility

- **MAJOR** — removing a rule; changing what a rule keeps or sends; changing an `empty_behaviour`; removing an
  outcome from the vocabulary. Each changes what a recorded snapshot means, and snapshots recorded before the
  change are still in the ledger waiting to be replayed.
- **MINOR** — adding a rule for a property kind that had none; adding a recognised order-property name; adding an
  outcome that consumers may ignore; adding an optional field to the descriptor.
- **PATCH** — wording, the measured notes, and the rationale columns.
- **Support window.** The rules are read by the build that contains them, and a projection recorded by an earlier
  build is replayed by a later one. A later build meeting a projection whose kind it no longer has a rule for
  reports `not_restorable` naming the kind, rather than guessing a payload — which is why removing a rule is
  MAJOR rather than a tidy-up.

## Examples

**Accepted** — a rule set extract covering the three kinds whose behaviour differs most: one plain, one computed,
one whose empty value the platform will not accept.

```json
{
  "connector": "notion",
  "rules": [
    {
      "property_kind": "date",
      "writeable": true,
      "keep": "date",
      "restore": "date",
      "empty_behaviour": "cleared",
      "residue": "none",
      "measured": true
    },
    {
      "property_kind": "status",
      "writeable": true,
      "keep": "option",
      "restore": "option_by_id",
      "empty_behaviour": "platform_default",
      "residue": "none",
      "measured": true
    },
    {
      "property_kind": "rollup",
      "writeable": false,
      "keep": "not_projected",
      "restore": "nothing",
      "empty_behaviour": "not_applicable",
      "residue": "none",
      "measured": true
    }
  ],
  "order_detection": {
    "kind": "number",
    "name_patterns": ["order", "thứ tự", "stt", "vị trí", "rank", "pos"]
  }
}
```

**Rejected** — a rule that would restore a choice by its label:

```json
{
  "connector": "notion",
  "rules": [
    {
      "property_kind": "select",
      "writeable": true,
      "keep": "text",
      "restore": "text",
      "empty_behaviour": "cleared",
      "residue": "none",
      "measured": false
    }
  ],
  "order_detection": {
    "kind": "number",
    "name_patterns": ["order"]
  }
}
```

It is refused because a `select` kept as text is a choice addressed by its label: a person renaming that option
at the platform would cause the restoration to create a second option rather than restore the first, and the
product would report the object as restored. The rule is rejected at review, not at runtime — which is the
reason these rules are published as data rather than left in code.

## Migration

Not applicable. This is the first publication, no earlier version exists, and no projection has been recorded
against one.

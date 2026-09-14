# Evolution: connector

This change touches two contracts and creates two `open` variability points, so it owes an account of how each
moves afterwards. The account matters more than usual here for one reason: a projection recorded today is
replayed by whatever build performs the undo, which may be a later one. Every rule below exists to keep that
replay honest — a build must never guess what an older projection meant, and must never silently restore
something differently than the build that recorded it would have.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `connector/contracts/connector-manifest` | Removing a field or a tool; changing a field's meaning; changing a tool's `direction`; changing a tool from a compensation to `irreversible`; making an optional field required; removing an authorisation kind or an enumerated value | Adding an optional field; adding a tool; adding a scope profile; adding an authorisation kind; adding an enumerated value; relaxing a cross-field rule so that every previously valid manifest stays valid; widening a parameter schema | Descriptions, labels, icons, guidance text, and rate-policy figures — so a connector adjusting its pace is a PATCH to its own manifest, not to this contract |
| `connector/contracts/notion-property-compensation` | Removing a rule; changing what a rule keeps or sends; changing an `empty_behaviour`; removing an outcome from the vocabulary | Adding a rule for a kind that had none; adding a recognised order-property name; adding an outcome consumers may ignore; adding an optional descriptor field | Wording, the measured notes, and rationale columns |

Two of these deserve their reason stated rather than inferred. Changing what a rule keeps is MAJOR even when the
new form is strictly better, because projections recorded under the old form are in the ledger and a build
reading them must either understand the old form or refuse them — and refusing them silently is the failure this
policy exists to prevent. And adding an enumerated value is MINOR only because a build that does not know the
value refuses the manifest rather than ignoring the field; that property comes from `additionalProperties: false`
and is voided the day manifests arrive from outside the build.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `connector-manifest@1.0.0` | `connector-manifest@1.1.0` | Not required | None — no manifest, no code and no record exists against `1.0.0` | Every `1.0.0` manifest remains valid unchanged. A manifest using `side_effects` or `arguments_source` declares `schema_version: "1.1"`, because a build that predates the fields refuses unknown ones rather than ignoring them |
| — | `notion-property-compensation@0.1.0` | Not applicable | None | First publication |
| `notion-property-compensation@0.x` | `@1.0.0`, when the second connector exists | Manual review | Projections recorded under `0.x` | Freezing is deferred deliberately: the format should be read by an author who did not write it before it is frozen, which is the manual check recorded in `verification.md` |
| A projection recorded by an earlier build | Replayed by a later build | Automatic, with a refusal path | Projections in the ledger, indefinitely | A later build that has no rule for a recorded kind reports `not_restorable` naming the kind. It never guesses a payload, and it never treats the absent rule as an empty value |

## Deprecation

A projection rule is deprecated before it is removed, and removal is MAJOR. The procedure is the same in every
case and exists because the ledger outlives the build:

1. Mark the rule deprecated in `notion-property-compensation`, stating what replaces it and from which version.
   A deprecated rule still projects and still restores; nothing changes for a running product.
2. Stop declaring tools that write that property kind, so no new projection is recorded under the rule.
3. Keep the rule for as long as projections recorded under it can still be undone. The ledger's retention, owned
   by `req-013-sqlite-ledger`, is what bounds that period; the rule may not be removed on a shorter one.
4. Remove the rule in a MAJOR version, and from that version onward a projection carrying that kind reports
   `not_restorable` naming the kind and the version that dropped it.

Identifying remaining consumers is mechanical rather than social: the ledger is queryable, so the question "does
any undoable record still carry this kind?" has an answer, and step 3 waits on that answer rather than on a
notice period.

A tool is deprecated the same way and for the same reason. Removing a declared tool while records of its calls
remain undoable would leave a compensating action naming a tool the build no longer has.

## Extension Procedure

**Adding a property kind.** Measure it first: write the property, read it back, compensate it, and try restoring
it from empty, against a real workspace. Then add one row to `notion-property-compensation` §2 and one entry to
the descriptor in §5, stating what is kept, what is sent, what the platform does with an empty value, and what
residue the write can leave. Add the kind to the round-trip and choice-property suites in `verification.md`.
Nothing else changes: no manifest edit, no adapter change, no core change. A kind added without a measurement is
marked `measured: false` and no tool may write it — an unmeasured rule is a claim about someone's data.

**Adding a tool to this connector.** Declare it in the manifest with its direction, its capability, its
parameter shape, its reconciliation, and either its snapshot and compensation or `irreversible: true`. If it
emits something outside the object it changes, declare that in `side_effects` with the sentence the user will
read; if the effect depends on which argument is supplied, declare the operation as its own tool instead — the
reason is in design §D3. Add it to §3 of the rule-set contract. Verify with the manifest conformance suite: the
tool count must change by exactly one and no other declaration may move.

**Adding a recognised order-property name.** Append to the pattern list in §4 of the rule-set contract and add a
case to the ordering suite. Recognition remains a recognition: it never creates the property, and where more
than one candidate matches, the user is asked.

**Adding an unrecallable effect to an existing tool.** Declare it, and read the reserved point in `model.md`
first: the moment a shipped tool's `side_effects` changes, the declaration a recorded call is presented with may
differ from the one it was performed under, and that is the trigger for carrying the declaration into the intent
record instead of resolving it at presentation time.

**Adding a second connector.** Nothing in this change is a template for it. The manifest contract and the adapter
surface are, and they are `req-019-connector-framework`'s. What this change offers the second connector is an
example of the cost: one manifest, one adapter, one rule set, and zero core changes — and if the second connector
cannot be expressed that way, that fact is the finding, not an inconvenience to work around.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Creating a page in the workspace rather than in a database | Not before a public authorisation client exists; M2 at the earliest | The platform refuses the operation to the authorisation kind the spike used, so neither the operation nor its compensating action has been measured. Declaring it would place an unmeasured write behind principle IV's guarantee | Re-measurement under a public integration — recorded as Q-1 in `clarifications.md` — followed by a projection rule, a tool declaration and a case in the round-trip suite |
| Carrying the unrecallable-effect declaration into the intent record | The first release that alters a shipped tool's `side_effects` | While every manifest ships inside the build that reads it, resolving the declaration at presentation time is exact. Once the declaration can differ between the build that recorded a call and the build that presents it, the record must carry it, as it already carries reversibility and reconciliation | A manifest change that alters `side_effects` for a tool with recorded calls; the change is then a MINOR addition of an optional field to `ledger/contracts/ledger-record@0.1.0` |
| Property kinds the spike did not meet, including files and unique identifiers | When a user's database requires one | Inventing rules for kinds nobody exercised would put unmeasured claims into the one table a user's trust in undo rests on | A real database carrying the kind, measured under the extension procedure above |
| User-configurable order-property names | After the first users | Whether the recognised set is too narrow is a question about real databases, not about design. The detection, the ambiguity rule and the unsupported outcome are unchanged either way | Evidence from first users that real databases name the property something the recognised set misses |
| Offering to add an order property to a database that lacks one | Its own change, unscheduled | It turns an unsupported operation into a supported one at the cost of changing the schema of a user's workspace as a consequence of a movement command; it is a new write with its own snapshot, compensation and approval story | A decision-maker ruling that the product may alter a database's schema, which is a wider question than reordering |

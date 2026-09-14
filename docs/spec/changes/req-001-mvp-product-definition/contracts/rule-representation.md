---
contract: rule-representation
version: 0.1.0
status: draft
owner: approval
consumers: [agent, connector, app, uix, ledger]
schema_files: [rule-representation.schema.json]
---

# Contract: Approval Rule Representation

## Purpose

A user's rule arrives as a sentence and has to become something a hook can evaluate deterministically, before
every tool call, outside the model's reach. This contract is that intermediate representation together with the
evaluator's verdict shape. The elicitation conversation produces it; the hook consumes it; the interface renders
it back to the user for confirmation; and the ledger records which rule produced a decision.

It is drafted here at the product baseline and frozen by `req-009-rule-ir-hardgate`, which attacked it with an
adversarial corpus against a real agent.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`rule-representation.schema.json`](./rule-representation.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of one rule, and its closedness is the point: a condition node admits exactly one of the
listed variants, so a statement needing anything else cannot be stored at all. What the file cannot express is
stated here instead, and every item is a reference into the installed manifests rather than a property of the
rule: that a named connector is installed, that a named tool is declared, that a compared property is one a
connector actually carries. A rule can therefore satisfy the file completely and still be refused at
confirmation — which is exactly what happens to the rejected example below.

The frozen successor of this file is `rule-representation.schema.json` in `req-009-rule-ir-hardgate`. Where the
two differ, the frozen one governs implementation and this one records what the product baseline required.

## Schema / Surface

### 1. Interface & Data Types

```typescript
// The representation. Closed by construction: an evaluator that cannot be
// enumerated cannot be reasoned about, and a rule that needs a model to
// evaluate it would put the gate back inside the LLM loop.
type Rule = {
  id: string;
  statement: string;            // the user's own words, kept for display
  state: 'draft' | 'confirmed' | 'superseded';
  condition: Condition;
  effect: 'require_approval' | 'deny';
  createdAt: string;
  testOutcome?: RuleTestOutcome;
};

type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { connector: string }                                   // connector id
  | { tool: string }                                        // tool name
  | { direction: 'read' | 'write' }
  | { irreversible: true }
  | { objectCountAtLeast: number }
  | { targetProperty: { name: string; op: CompareOp; value: ScalarValue } }
  | { targetOwnedByUser: boolean }
  | { targetIn: { collection: string; ids?: string[] } };

type CompareOp = 'eq' | 'neq' | 'contains' | 'lt' | 'lte' | 'gt' | 'gte';
type ScalarValue = string | number | boolean;

// What the gate answers, for every single tool call.
type Verdict =
  | { decision: 'allow' }
  | { decision: 'require_approval'; ruleId: string | 'static_tier' | 'irreversible_default' }
  | { decision: 'deny'; ruleId: string | 'blocklist'; reason: string };

interface RuleEvaluator {
  evaluate(call: ToolCallDescriptor, rules: Rule[], mode: ApprovalMode): Verdict;  // pure, total, no I/O
}

type RuleTestOutcome = {
  mustBlock: { case: string; passed: boolean }[];
  mustAllow: { case: string; passed: boolean }[];
};
```

## Semantics

The evaluator is pure and total: the same call, the same confirmed rules and the same mode always produce the
same verdict, and it performs no input or output of its own. That is what makes the gate testable and what keeps
it outside the model loop — an evaluator that had to fetch something could be made to wait, and a gate that can
be made to wait can be made to fail open.

Only rules in the `confirmed` state are passed to the evaluator. A `draft` rule is the product's reading of what
the user meant and has no force.

Evaluation order is fixed and is not a matter of rule precedence: the hardline blocklist first, then the static
tier and the confirmed rules, then — in `smart` mode only, and only for a call that matched nothing — the model
risk judge. `deny` outranks `require_approval`, which outranks `allow`; a call matching several rules takes the
strongest verdict among them, and the verdict names the rule that produced it so the approval request can state
why it stopped.

`targetProperty` compares against the property values the call would set or the target already holds;
`objectCountAtLeast` reads the parameter the manifest nominated as its bulk parameter, so the evaluator needs no
connector-specific knowledge. `targetOwnedByUser` is false whenever ownership cannot be determined, because an
unknown owner is not the user.

A rule statement that cannot be expressed in this representation is reported to the user as unsupported. It is
never stored as a `Rule` with a weaker condition and never downgraded into the advisory prompt fragment alone,
because a rule the user believes is enforced but is not is worse than a rule they know they do not have.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `uncompilable_statement` | The elicited intent cannot be expressed in the representation | Callee | The product names the unsupported part; no rule is stored |
| `unknown_connector` | A condition names a connector that is not installed | Callee | The rule is refused at confirmation with the name shown |
| `unknown_tool` | A condition names a tool no installed manifest declares | Callee | The rule is refused at confirmation with the name shown |
| `evaluator_exception` | The evaluator failed while deciding a call | Caller | The call is stopped and escalated to the user; the failure is recorded — the gate never fails open |
| `judge_unavailable` | The model risk judge timed out, errored, or returned an unparsable answer | Caller | The call is escalated to the user |
| `rule_test_failed` | The post-compilation sample run blocked something that must be allowed, or vice versa | Callee | The outcome is shown before the user confirms the rule |

## Compatibility

MAJOR: removing a `Condition` variant, changing the meaning of an existing one, or changing the evaluation
order. Any of these can turn a rule that blocked an operation yesterday into one that permits it today, which
is a silent loss of protection.

MINOR: adding a `Condition` variant, adding a `CompareOp`, or adding an optional field. Rules stored under an
earlier version continue to evaluate identically.

PATCH: display text and the shape of the structured restatement shown to the user.

Support window: stored rules carry the representation version they were compiled under. A rule compiled under an
older major version is re-elicited with the user rather than migrated silently, because the migration would be
the product guessing at intent it did not witness.

## Examples

Valid — "ask me before anything touches a task I did not create":

```json
{
  "id": "rule-004",
  "statement": "Hỏi tôi trước khi đụng vào task không phải tôi tạo",
  "state": "confirmed",
  "effect": "require_approval",
  "condition": {
    "all": [
      { "direction": "write" },
      { "targetOwnedByUser": false }
    ]
  }
}
```

Rejected — "be careful with anything that looks important":

```json
{
  "id": "rule-005",
  "statement": "Cẩn thận với những gì quan trọng",
  "state": "draft",
  "effect": "require_approval",
  "condition": { "targetProperty": { "name": "importance", "op": "eq", "value": "important" } }
}
```

The schema accepts it: the shape is a well-formed `targetProperty` comparison, and nothing in the file can know
which properties a connector carries. It is refused at confirmation instead, because "important" is not a
property the connector declares and the condition would therefore silently never match. The product reports
which part it cannot enforce rather than storing a rule that looks like protection and is not.

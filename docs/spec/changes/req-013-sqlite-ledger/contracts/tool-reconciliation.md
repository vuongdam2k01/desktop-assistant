---
contract: tool-reconciliation
version: 0.1.0
status: draft
owner: job
consumers: [job, ledger, connector, undo, app, uix]
schema_files: [tool-reconciliation.schema.json]
---

# Contract: Tool Reconciliation

## Purpose

When the product stops between making a tool call and recording what the call did, something has to decide what
actually happened out there. This contract is how that decision is made without the recovery engine knowing
anything about any particular platform: each tool declares whether its effect can be read back and, if so, what
to read and what to compare. Recovery reads the declaration and follows it.

It is the one `open` variability point of this change's model. Adding the Nth platform must not edit recovery,
which principle VI requires; and guessing wrong about a tool that sends a message is how a message gets sent
twice, which is RISK-045. The declaration is written by connector authors as part of the tool declaration that
`connector/contracts/connector-manifest@0.1.0` already defines, and is copied into each intent record at write
time (INV-LG-05), so a manifest edited later cannot change how an already-interrupted call is treated.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`tool-reconciliation.schema.json`](./tool-reconciliation.schema.json) | JSON Schema draft-07 | normative |

The schema file is the normative shape of the reconciliation fragment carried inside a connector manifest. The
declaration is copied into each intent record at write time, so recovery applies the policy recorded before the
call rather than a connector manifest that may have changed since.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type ReconciliationDeclaration =
  | { method: "none"; reason?: string }
  | {
      method: "readback";
      read_operation: string;        // a read tool the same connector declares
      comparison: Comparison;
      ambiguous_outcome?: "ask_user" | "treat_as_unperformed";  // absent means "ask_user"
      reason?: string;
    };

interface Comparison {
  path: string;                      // where in the read result the decisive value sits
  against: ("before" | "intended")[];// which recorded values it is set against; both, in this order
  equality?: "exact" | "normalised"; // absent means "exact"
}

// What recovery does with a declaration. Implemented by the recovery engine, not by connectors.
interface Reconciler {
  reconcile(input: ReconcileInput): Promise<ReconcileOutcome>;
}

interface ReconcileInput {
  intent: LedgerRecord;              // type "intent"; carries its own declaration (INV-LG-05)
  declaration: ReconciliationDeclaration;
}

type ReconcileOutcome =
  | { conclusion: "performed"; observedState: unknown }     // append the missing result, establishedBy "reconciled"
  | { conclusion: "not_performed"; observedState: unknown } // append an error record; the job fails safely
  | { conclusion: "undetermined"; reason: UndeterminedReason; observedState?: unknown }
  | { conclusion: "unreachable"; retryAfter?: number };     // nothing is concluded and nothing is repeated

type UndeterminedReason =
  | "not_readable"        // the declaration is "none", absent, or malformed
  | "state_matches_neither" // the object matches neither the before snapshot nor what the call intended
  | "target_gone"         // the object no longer exists, so neither comparison can be made
  | "read_refused";       // the platform refused the read: revoked authorisation, or a permission change
```

### 2. Wire / Communication Protocol

Not applicable as a channel of its own. Recovery invokes the declared read operation through the connector's own
tool surface, so the protocol is the connector's, specified by `connector/contracts/connector-manifest@0.1.0`.
The read is subject to the same approval gate and ledger obligation as any other tool call — it is a read, so
the gate permits it, and it is recorded as an information record naming the call it was reconciling.

### 3. Module Descriptor / Manifest Specification

The declaration is a fragment of a tool declaration, not a manifest in its own right. Its schema:

See companion schema: [tool-reconciliation.schema.json](./tool-reconciliation.schema.json)

`read_operation` and `comparison` are required when `method` is `readback` and must be absent when it is `none`.
A declaration failing either rule is treated as absent, which means `none` — the fallback stated below.

## Semantics

- **`method: "none"` is a first-class answer, not a gap.** Sending a message, posting to a channel, triggering a
  notification: these leave no state to read back, and saying so is what routes the job to the user instead of
  to a retry. `reason` is shown in the confirmation card, so the user is asked something they can answer.
- **A missing, malformed or unresolvable declaration is read as `none`.** Not as `readback`, and not as a load
  failure for the connector. The cost of this fallback is one question to the user in a rare case; the cost of
  the opposite default is a second message. `spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien` records
  this as RISK-045's mitigation.
- **`against` is ordered and both comparisons matter.** Matching `before` concludes `not_performed`; matching
  `intended` concludes `performed`; matching neither is `state_matches_neither` and is undetermined, because a
  third party may have edited the object in between. `ambiguous_outcome: "treat_as_unperformed"` may be declared
  only by a tool whose repetition is harmless, and even then the repetition is a new call with its own new
  intent record — never a silent continuation of the old one.
- **`normalised` equality exists because platforms are not literal.** The same property can come back as a plain
  value or as a nested object from the same platform, which RISK-037 measured; a tool that knows this declares
  `normalised` and the comparison compares meaning rather than shape.
- **`unreachable` concludes nothing.** No network, a timeout, or a platform outage is not evidence: the job
  stays `recovering` and the reconciliation is attempted again later. A conclusion is never derived from a
  failure to look.
- **`read_refused` is undetermined, not `not_performed`.** A revoked authorisation says nothing about whether
  the earlier call landed, and the user is the one who can find out.
- **The observed state is recorded.** Whatever conclusion is reached, the record appended carries what was
  observed, so a later reader can see what recovery based its conclusion on rather than only the conclusion.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `DECLARATION_INVALID` | The declaration does not satisfy the companion schema | Callee, at manifest load | The tool loads and is treated as `method: "none"`; the defect is reported to the connector author, not to the user |
| `READ_OPERATION_UNKNOWN` | `read_operation` names a tool the connector does not declare | Callee, at manifest load | As above — treated as `none` rather than refusing the connector |
| `RECONCILE_UNREACHABLE` | The platform could not be reached for the read | Caller | The job stays `recovering` and says so; nothing is repeated |
| `RECONCILE_REFUSED` | The platform refused the read | Caller | The job moves to `waiting_user_confirmation` with the refusal as its stated reason |
| `RECONCILE_AMBIGUOUS` | The object matches neither the recorded state nor the intended one | Caller | The job moves to `waiting_user_confirmation`, showing both what was recorded and what is there now |
| `TARGET_GONE` | The object the call named no longer exists | Caller | As above; a deleted target is a question, since the call may have been what deleted it |

## Compatibility

- **MAJOR** — adding a value to `method`, changing what a conclusion means, or making `readback` the fallback
  for a missing declaration. That last one is the change this contract exists to forbid, and it would be major
  in the strongest sense: every existing tool's crash behaviour would change without any tool being edited.
- **MINOR** — adding an optional field, or an `UndeterminedReason` a caller can treat as it treats the others.
- **PATCH** — wording.
- Declarations are versioned with the connector manifest that carries them. Recovery reads the copy inside the
  intent record, so a record written under an earlier version keeps being interpreted under it.

## Examples

A valid declaration, for a tool that changes a page's status:

```json
{
  "method": "readback",
  "read_operation": "get_page",
  "comparison": { "path": "properties.Status", "against": ["before", "intended"], "equality": "normalised" }
}
```

A rejected declaration, and why:

```json
{
  "method": "none",
  "read_operation": "get_message",
  "comparison": { "path": "id", "against": ["intended"] }
}
```

It declares that the effect cannot be read back and then supplies a read to do it with. The two halves would
contradict each other at exactly the moment they matter: recovery would have to choose between what the tool
said and what it provided, for a tool — sending a message — where the wrong choice sends it twice. The
declaration is therefore treated as absent, and the tool falls back to `none`, which is what its `method` asked
for. If the effect genuinely is readable, the correct declaration names `readback` and keeps both fields.

## Migration

Not applicable at 0.1.0 — this is the first version and has no consumers on an earlier one.

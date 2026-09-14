---
contract: connector-manifest
version: 1.1.0
status: frozen
owner: connector
consumers: [agent, approval, job, ledger, undo, backend, app, uix]
schema_files: [connector-manifest.schema.json]
---

# Contract: Connector Manifest

## Purpose

This contract is what makes a connector data rather than code. A connector author supplies a manifest and an
adapter; the product generates the agent's tool set from the manifest, derives the approval classification of each
operation from it, reads the compensating-action declaration from it when planning an undo, and decides from it
what an interrupted call meant. No component may learn about a platform any other way, which is what keeps the
job manager, the hooks, the ledger and the interface unchanged as platforms are added.

It was drafted at `0.1.0` in `req-001-mvp-product-definition` and frozen at `1.0.0` in
`req-019-connector-framework`, where the claim it encodes was measured rather than asserted: a second connector of
deliberately opposite shape was expressed entirely within this schema at zero lines of change in the core.

This version, `1.1.0`, is the first amendment made by a connector rather than by the framework, and both of its
additions come from measuring one real platform's write operations end to end
(`spikes/SP-1-notion-compensation/REPORT.md`). Neither adds a mechanism: one records a fact about an operation
that the frozen shape could state only by lying — that an operation fully restorable in the platform's data still
emits something outside it that nothing withdraws — and the other records where a compensating action's arguments
come from when the object being compensated did not exist before the call. Both are optional fields with a default
that leaves every `1.0.0` manifest meaning exactly what it meant.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`connector-manifest.schema.json`](./connector-manifest.schema.json) | JSON Schema 2020-12 | normative |

The file is the manifest's shape at `1.1.0`, and it is what a connector author's manifest is checked against at
load. Both additions of this version are in it: `side_effects` on a write tool, and `arguments_source` inside a
`compensation`. What it cannot express is stated in this document instead and is enforced in the same
whole-manifest pass: that a tool's `capability` is one the manifest declares, that a scope profile grants nothing
for a capability no tool requires, that `snapshot.read_operation` and `compensation.tool` name tools this manifest
declares, that a creation is compensated from its result rather than from a snapshot it cannot have, and that two
manifests never share an `id`. Each is a relation between members rather than a property of one, so a manifest can
satisfy the file and still yield no tool.

## Schema / Surface

### 1. Interface & Data Types

The manifest is data; what reads it is typed as follows. The normative shape is
[`connector-manifest.schema.json`](./connector-manifest.schema.json); the declarations below name the same
members for a reader and add the meaning the file carries only as description.

```typescript
import type { ReconciliationDeclaration } from "job/contracts/tool-reconciliation@0.1.0";

interface ConnectorManifest {
  schema_version: "1.0" | "1.1";         // major.minor of THIS contract, not of the connector
  id: string;                            // stable for the life of the product (INV-CN-04)
  name: string;
  version: string;                       // semver of this manifest's own content
  icon?: string;
  description?: string;
  auth: AuthConfiguration;
  capabilities: Record<string, CapabilityDeclaration>;
  scope_profiles: Record<string, Record<string, string[]>>;  // profile -> capability -> scopes
  rate_policy?: { requests_per_second?: number; burst?: number };
  content_sanitization?: { strip_instructions: boolean; max_inline_content_bytes?: number };
  tools: ToolDeclaration[];
}

interface AuthConfiguration {
  kind: "oauth2" | "bearer_token" | "api_key";
  provider_id?: string;                  // the server-side half, backend/contracts/authorisation-provider-descriptor@0.1.0
  endpoints: { authorize_url?: string; token_url?: string; api_base_url?: string };
  proof_key?: boolean;
  revocation: Revocation;                // never absent: the absence of an endpoint is declared, not discovered
  byo_client?: { supported: boolean; guidance_steps?: string[]; refresh_lifetime_caveat?: string };
}

type Revocation =
  | { supported: true; endpoint: string; settings_url?: string }
  | { supported: false; settings_url: string; note?: string };

interface CapabilityDeclaration { name: string; description: string }

interface ToolDeclaration {
  name: string;                          // the public tool name, carrying the connector id (INV-CN-05)
  label: string;
  description: string;                   // shown to the model; text only, no capability of its own
  direction: "read" | "write";
  capability: string;                    // a key of capabilities
  parameters: ParameterSchema;
  reconciliation: ReconciliationDeclaration;
  snapshot?: SnapshotDeclaration;        // write only
  compensation?: Compensation;           // write only; exclusive with irreversible (INV-CN-07)
  irreversible?: boolean;                // write only; exclusive with compensation
  side_effects?: SideEffectDeclaration[];// write only; added at 1.1.0
  changes_permission?: boolean;
  bulk_threshold_param?: string;
}

interface SnapshotDeclaration {
  read_operation: string;                // a read tool this manifest declares
  target_param: string;                  // where the object being changed is named in the arguments
  exclude_computed: string[];            // values the platform computes; [] states there are none
}

interface Compensation {
  tool: string;                          // a tool this manifest declares
  arguments_source?: "snapshot" | "result";  // added at 1.1.0; absent means "snapshot", as at 1.0.0
  arguments_from: string;                // where in that source its arguments are built from
}

/**
 * Something the platform emits outside the object the tool changed, which the compensating action does not
 * reach. Added at 1.1.0. Declaring one does not reclassify the tool: the operation stays reversible in the
 * platform's data, and the effect is stated separately wherever the operation is presented.
 */
interface SideEffectDeclaration {
  effect: string;                        // what is emitted, e.g. "notification"
  recipient: string;                     // who receives it, in terms the user recognises
  recallable: boolean;                   // false is the case this field exists for
  withdrawn_by?: string;                 // required when recallable is true: a tool this manifest declares
  user_text: string;                     // the sentence shown in the approval request and the undo preview
}

type ParameterSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};
```

### 2. Wire / Communication Protocol

Not applicable, and deliberately so. A manifest is a build resource read once at start-up by the process that
owns the connectors; it crosses no boundary, is fetched from no network, and is discovered in no user directory.
A manifest that arrived over a channel would be a tool description the product had not reviewed, which is the
question held open as the reserved point in `req-019-connector-framework`'s model rather than answered here. What
does cross a boundary is the authorisation this manifest configures, and that surface is
`backend/contracts/authorisation-broker-api@0.1.0`.

### 3. Module Descriptor / Manifest Specification

The normative descriptor is [`connector-manifest.schema.json`](./connector-manifest.schema.json), which carries
this version's two additions. It is not restated here: a manifest that satisfies that file and the whole-manifest
rules under *Semantics* is a manifest this build loads, and a second copy of the shape in prose would be the thing
that drifts from it.

What the file expresses on its own: every required member, the identifier and version patterns, the closed sets
of authorisation kinds and tool directions, the exclusivity of `compensation` and `irreversible` on a write tool,
`exclude_computed` being required inside a `snapshot`, the two values `compensation.arguments_source` may take,
and a `side_effects` entry recorded as recallable having to name what withdraws it. What it cannot express, and
what *Semantics* and the table of refusals below hold instead: that a tool's `capability` is one the manifest
declares, that a scope profile grants nothing for a capability no tool requires, that `snapshot.read_operation`
and `compensation.tool` name tools this manifest declares, that a creation's compensation is built from the result
rather than from a snapshot it cannot have, and that no two manifests share an `id`. Each is a relation between
members rather than a property of one, so a manifest can satisfy the file and still be refused at load.

## Semantics

**Validation is whole-manifest.** Every rule below is checked at load, and a manifest that breaks any of them
yields no tool at all. A partially loaded connector would offer operations whose reversibility nobody declared,
which principle IV forbids, and the author is the person who should meet the failure.

- `id` identifies the connector for the lifetime of the product. Changing it creates a different connector rather
  than a new version of this one, because ledger records, approval rules and stored authorisations all refer to
  it. `version` describes this manifest's own content; `schema_version` describes which version of this contract
  it was written against, and a manifest whose version exceeds the build's is refused naming the application
  version it needs. The minor number is part of that comparison because unknown fields are refused rather than
  ignored — see Compatibility.
- **A write tool carries exactly one of `compensation` or `irreversible: true`.** Neither is refused; both are
  refused. A read tool carrying `snapshot`, `compensation`, `irreversible` or `side_effects` is refused as a
  contradiction rather than silently reclassified.
- **A compensation says where its arguments come from.** `arguments_source: "snapshot"`, which is also what its
  absence means, requires a `snapshot`: the compensating action is built from recorded prior state.
  `arguments_source: "result"` requires no snapshot, because the object being compensated did not exist before
  the call and what identifies it is in the platform's own response — the case of a creation, whose compensating
  action addresses the object the creation returned — VERIFIED
  (`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q2). A compensation naming neither a
  snapshot nor the result is refused; this is the rule `1.0.0` expressed as "a compensation requires a snapshot",
  narrowed to the case where the snapshot is what the arguments are built from.
- **`exclude_computed` is required inside a `snapshot` and may be empty.** An empty array is the author stating
  that the platform computes none of this object's values; an absent field is the author having not considered the
  question, and the two are not the same. The excluded values are stripped from the snapshot before it is
  recorded and are therefore absent from any compensating action built from it — VERIFIED for the six computed
  values a document platform rejects on write
  (`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q4;
  `spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q1 and Q6, which is where the six were
  identified).
- **`side_effects` states what a compensating action does not reach.** It is a property of the operation, not of
  a particular call: a tool that emits a notification emits it whenever it is called, which is why the
  declaration carries no condition. Where an effect depends on which argument is supplied, the operation is
  declared as its own tool instead — a conditional language in a descriptor would put a decision the gate must
  make back inside data the gate would have to interpret. Declaring a side effect does not change the tool's
  classification: the operation remains reversible where its data is restorable, and `user_text` is shown
  alongside that classification in the approval request and in the undo preview. `recallable: true` is accepted
  only with the tool that performs the withdrawal named in `withdrawn_by`, because an effect described as
  recallable with no way to recall it is worse than an undeclared one — VERIFIED that the case this field exists
  for is real (`spikes/SP-1-notion-compensation/REPORT.md#1-tra-loi-tung-cau-hoi` Q3: assignment sends a
  notification no operation withdraws).
- **`reconciliation` is required on every tool, read or write.** Its shape is
  `job/contracts/tool-reconciliation@0.1.0`, embedded here verbatim and not redefined. A tool whose declaration is
  absent or unresolvable is treated as `method: "none"`, which routes an interrupted call to the user rather than
  to a repeat; that fallback is stated in the owning contract and is not weakened here.
- **`revocation` is never absent.** `supported: true` requires the endpoint that performs it; `supported: false`
  requires the address of the page where the user can withdraw the integration themselves, because disconnecting
  such a platform removes the product's copy and leaves the platform's own record standing — VERIFIED
  (`spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien`). A product that discovered this at
  disconnect time would have to either lie or improvise, and both are worse than a required field.
- **`capabilities` and `scope_profiles` carry the minimum-scope rule structurally.** A tool belongs to exactly one
  capability; a profile maps capabilities to the scopes requested for them; a profile naming a capability no tool
  requires is refused, so unused scope cannot be asked of a user by accident. Selecting a different profile
  changes what is requested and nothing else — VERIFIED (Q8 of `SP-19`). A platform that grants no per-capability
  scope declares the capability with an empty scope list: the mapping still records which capabilities the
  authorisation covers, and the empty list is the honest statement that the platform makes no finer distinction.
- **`provider_id` is the join to the server-side half of the same platform.** Where a confidential client secret
  is needed, the exchange happens through `backend/contracts/authorisation-broker-api@0.1.0` against the
  descriptor of that identifier. A manifest whose `kind` is `oauth2` with no `provider_id` and no bring-your-own
  support is refused, because nothing would be able to complete its authorisation.
- **`content_sanitization` is required of any connector that returns document, message or file content.** Fetched
  content is untrusted data under the constitution's External Content Is Data section; this field declares how it
  is neutralised before it reaches an agent's context.
- **The declarations are read from here and nowhere else.** The gate reads `irreversible`, `side_effects`,
  `changes_permission` and `bulk_threshold_param`; the undo planner reads `compensation`, `snapshot` and
  `side_effects`; recovery reads `reconciliation`. None of them is ever read from a call's arguments, and
  `reversibility` and `reconciliation` are copied into the record of intent when a call is made, so a manifest
  edited later cannot change how a recorded call is judged or reconciled (INV-CN-06). `side_effects` is resolved
  at presentation time from the manifest of the build that presents it; the model of
  `req-003-notion-compensation` records, as a reserved point, the condition under which it must travel in the
  record instead.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `MANIFEST_SCHEMA_INVALID` | The manifest does not satisfy `connector-manifest.schema.json` | Callee, at load | The connector is presented as unavailable with the failing declaration named; every other connector is unaffected |
| `MANIFEST_VERSION_AHEAD` | `schema_version` exceeds the build's, in either number | Callee, at load | The connector is unavailable, stating the application version it requires |
| `REVERSIBILITY_UNDECLARED` | A write tool carries neither `compensation` nor `irreversible`, or carries both | Callee, at load | The whole connector fails to load; the author sees which tool and why |
| `SNAPSHOT_EXCLUSIONS_UNDECLARED` | A `snapshot` omits `exclude_computed` | Callee, at load | As above |
| `COMPENSATION_WITHOUT_SNAPSHOT` | A `compensation` whose `arguments_source` is `snapshot`, or absent, is declared with no `snapshot` to build it from | Callee, at load | As above |
| `COMPENSATION_SOURCE_UNKNOWN` | `arguments_source` is present and is neither `snapshot` nor `result` | Callee, at load | As above |
| `SIDE_EFFECT_ON_READ_TOOL` | A read tool declares `side_effects` | Callee, at load | As above; a read that emits something is a write whose direction is misdeclared |
| `SIDE_EFFECT_WITHDRAWAL_UNDECLARED` | `recallable: true` with no `withdrawn_by` | Callee, at load | As above; the product would otherwise promise a withdrawal it cannot perform |
| `TOOL_REFERENCE_UNKNOWN` | `snapshot.read_operation`, `compensation.tool`, `side_effects[].withdrawn_by` or `reconciliation.read_operation` names a tool this manifest does not declare | Callee, at load | As above, except for `reconciliation.read_operation`, which degrades to `method: "none"` under its own contract |
| `CAPABILITY_UNKNOWN` | A tool names a capability the manifest does not declare | Callee, at load | As above |
| `SCOPE_PROFILE_UNUSED_CAPABILITY` | A profile grants scope for a capability no tool requires | Callee, at load | As above; the point is that unused scope is never requested from a user |
| `REVOCATION_UNDECLARED` | `revocation` is absent, or `supported: false` with no settings address | Callee, at load | As above |
| `PROVIDER_UNRESOLVABLE` | `provider_id` names no descriptor the backend offers, and the connector has no bring-your-own route | Both — the device reports what the backend answered | The connector is listed but Connect states the platform is not currently offered |
| `CONNECTOR_ID_DUPLICATE` | Two manifests declare the same `id` | Callee, at load | Neither registers; a duplicated identity is an error rather than a merge (INV-CN-12) |
| `ADAPTER_MISSING` | No adapter is registered under this manifest's `id` | Callee, at load | The connector is unavailable; a pair is what registers, so half a pair registers nothing |

## Compatibility

**MAJOR** — removing a field or a tool; changing a field's meaning; changing a tool's `direction`; changing a tool
from carrying `compensation` to carrying `irreversible`; making an optional field required; removing an
authorisation kind or an enumerated value. Each of these changes what the product may already have promised the
user about reversibility or reach, which is why they are MAJOR even where they are mechanically compatible.

**MINOR** — adding an optional field; adding a tool; adding a scope profile; adding an authorisation kind; adding
an enumerated value a build that does not know it can safely refuse; relaxing a cross-field rule so that
manifests valid before remain valid; widening a parameter schema so that it accepts everything it accepted
before. This version is MINOR on three counts: `side_effects` is a new optional field, `arguments_source` is a new
optional field whose absence means what `1.0.0` meant, and `COMPENSATION_WITHOUT_SNAPSHOT` now refuses a strict
subset of what it refused before.

**PATCH** — descriptions, labels, icons, guidance text and rate-policy figures. A connector changing its pacing
figure is therefore a PATCH to its own manifest, not to this contract.

**Support window.** A build loads a manifest whose `schema_version` it recognises and does not exceed its own.
The minor number matters because every object in this schema sets `additionalProperties: false`: a build that
does not know `side_effects` does not ignore it, it refuses the manifest. That is the correct behaviour while
every manifest ships inside the build that reads it — the mixed-version window is empty by construction, and a
silent ignore would be a declaration the product did not honour. The day the reserved third-party point in
`req-019-connector-framework`'s model is activated, manifests will arrive from outside the build and both this
paragraph and `additionalProperties: false` must be reopened together, rather than one of them being
reinterpreted.

## Examples

**Accepted** — an extract of the first connector's manifest, at four tools of the ten it declares. It exercises
both additions: a creation whose compensating action is built from the platform's response, and a write that
emits a notification nothing withdraws. The full tool set, with the snapshot and compensation of each, is
tabulated in `connector/contracts/notion-property-compensation@0.1.0` §1.

```json
{
  "schema_version": "1.1",
  "id": "notion",
  "name": "Notion",
  "version": "1.0.0",
  "icon": "assets/notion.svg",
  "description": "Read and write tasks in a Notion workspace's databases.",
  "auth": {
    "kind": "oauth2",
    "provider_id": "notion",
    "proof_key": true,
    "endpoints": {
      "authorize_url": "https://api.notion.com/v1/oauth/authorize",
      "token_url": "https://api.notion.com/v1/oauth/token",
      "api_base_url": "https://api.notion.com/v1"
    },
    "revocation": {
      "supported": false,
      "settings_url": "https://www.notion.so/my-integrations",
      "note": "The platform publishes no revocation endpoint; disconnecting removes the product's copy and the user withdraws the integration at the platform."
    }
  },
  "capabilities": {
    "tasks_read": { "name": "Read tasks", "description": "Query databases and read tasks and their properties." },
    "tasks_write": { "name": "Manage tasks", "description": "Create tasks, change their properties, and remove them." },
    "comments_write": { "name": "Comment", "description": "Add comments to tasks." }
  },
  "scope_profiles": {
    "default": { "tasks_read": [], "tasks_write": [], "comments_write": [] }
  },
  "rate_policy": { "requests_per_second": 2.5, "burst": 20 },
  "content_sanitization": { "strip_instructions": true, "max_inline_content_bytes": 65536 },
  "tools": [
    {
      "name": "notion_read_page",
      "label": "Read a task",
      "description": "Read one task with all of its properties.",
      "direction": "read",
      "capability": "tasks_read",
      "parameters": {
        "type": "object",
        "properties": { "page_id": { "type": "string" } },
        "required": ["page_id"]
      },
      "reconciliation": { "method": "none", "reason": "A read changes nothing, so there is nothing to reconcile." }
    },
    {
      "name": "notion_create_task",
      "label": "Create a task",
      "description": "Create a task in a database with the given properties.",
      "direction": "write",
      "capability": "tasks_write",
      "parameters": {
        "type": "object",
        "properties": {
          "database_id": { "type": "string" },
          "properties": { "type": "object" }
        },
        "required": ["database_id", "properties"]
      },
      "reconciliation": {
        "method": "readback",
        "read_operation": "notion_query_database",
        "ambiguous_outcome": "ask_user"
      },
      "compensation": {
        "tool": "notion_archive_page",
        "arguments_source": "result",
        "arguments_from": "id"
      }
    },
    {
      "name": "notion_assign_person",
      "label": "Assign a person",
      "description": "Set the people property of a task.",
      "direction": "write",
      "capability": "tasks_write",
      "parameters": {
        "type": "object",
        "properties": {
          "page_id": { "type": "string" },
          "property": { "type": "string" },
          "people": { "type": "array" }
        },
        "required": ["page_id", "property", "people"]
      },
      "reconciliation": {
        "method": "readback",
        "read_operation": "notion_read_page",
        "ambiguous_outcome": "ask_user"
      },
      "snapshot": {
        "read_operation": "notion_read_page",
        "target_param": "page_id",
        "exclude_computed": ["formula", "rollup", "created_time", "created_by", "last_edited_time", "last_edited_by"]
      },
      "compensation": {
        "tool": "notion_assign_person",
        "arguments_source": "snapshot",
        "arguments_from": "properties"
      },
      "side_effects": [
        {
          "effect": "notification",
          "recipient": "the person assigned",
          "recallable": false,
          "user_text": "Notion emails and notifies the person as soon as they are assigned. Undoing the assignment removes them from the task but does not withdraw that notification."
        }
      ]
    },
    {
      "name": "notion_create_comment",
      "label": "Add a comment",
      "description": "Add a comment to a task.",
      "direction": "write",
      "capability": "comments_write",
      "parameters": {
        "type": "object",
        "properties": {
          "page_id": { "type": "string" },
          "text": { "type": "string" }
        },
        "required": ["page_id", "text"]
      },
      "reconciliation": {
        "method": "readback",
        "read_operation": "notion_read_page",
        "ambiguous_outcome": "ask_user"
      },
      "irreversible": true
    }
  ]
}
```

**Rejected** — a write that promises a withdrawal it cannot perform:

```json
{
  "schema_version": "1.1",
  "id": "example",
  "name": "Example",
  "version": "1.0.0",
  "auth": {
    "kind": "oauth2",
    "provider_id": "example",
    "endpoints": { "authorize_url": "https://example.test/authorize", "token_url": "https://example.test/token" },
    "revocation": { "supported": false, "settings_url": "https://example.test/settings/integrations" }
  },
  "capabilities": { "docs_write": { "name": "Manage documents", "description": "Create and share documents." } },
  "scope_profiles": { "default": { "docs_write": ["docs.write"] } },
  "tools": [
    {
      "name": "example_share_document",
      "label": "Share a document",
      "description": "Share a document with a colleague.",
      "direction": "write",
      "capability": "docs_write",
      "parameters": { "type": "object", "properties": { "document_id": { "type": "string" } }, "required": ["document_id"] },
      "reconciliation": { "method": "none" },
      "snapshot": { "read_operation": "example_read_document", "target_param": "document_id", "exclude_computed": [] },
      "compensation": { "tool": "example_unshare_document", "arguments_from": "properties" },
      "side_effects": [
        { "effect": "notification", "recipient": "the colleague", "recallable": true, "user_text": "They are notified." }
      ]
    }
  ]
}
```

The manifest is refused three times over, and the whole connector with it: `SIDE_EFFECT_WITHDRAWAL_UNDECLARED`,
because an effect declared recallable names no tool that recalls it; and `TOOL_REFERENCE_UNKNOWN` twice, because
neither the read operation its snapshot names nor the tool its compensation names is declared here. The refusal
belongs at load, where the connector's author is looking, rather than at the first call, where a user is.

## Migration

**From `1.0.0` to `1.1.0`.** Additive in both directions that matter: every `1.0.0` manifest is a valid `1.1.0`
manifest with no edit, and every consumer that ignores the two new fields behaves exactly as it did.

1. **`tools[].side_effects` is new and optional.** A tool that declares none is not asserting that it has none —
   it is saying nothing, which is what `1.0.0` could say. The honesty obligation is on the connector author and
   is checked by review rather than by the loader, because no descriptor can detect an unstated fact about a
   platform. What the loader does check is coherence: not on a read tool, and never recallable without the tool
   that recalls it.
2. **`compensation.arguments_source` is new and optional, defaulting to `snapshot`.** Manifests written against
   `1.0.0` carry compensations built from snapshots, which is what the absent field means, so none of them
   changes meaning. `COMPENSATION_WITHOUT_SNAPSHOT` now refuses a strict subset of what it refused before: a
   compensation sourced from the result no longer needs a snapshot.
3. **`schema_version` accepts `"1.1"`.** A manifest using either new field must declare `"1.1"`, because a build
   that predates them refuses unknown fields rather than ignoring them. A manifest using neither may stay at
   `"1.0"`.

**Consumers to update.** `approval` reads `side_effects` to state in the request what an approval will emit;
`undo` reads it to state in the preview what a compensation will not withdraw, and reads `arguments_source` to
know where a compensating action's arguments come from. `ledger`, `job`, `agent`, `backend`, `app` and `uix` are
unaffected: nothing they read changed shape or meaning. `req-014-byo-oauth-google`, which authors the next
manifest, may stay at `"1.0"` unless it needs either field.

**From `0.1.0` to `1.0.0`.** Performed by `req-019-connector-framework`, against no running product and no stored
data: naming was made snake_case throughout, `reconciliation` became required on every tool, `revocation`
replaced an optional endpoint field, `exclude_computed` became required inside a snapshot, and `capabilities` was
hoisted out of the authorisation block. That migration is recorded in full in that change and is not restated
here.

---
contract: connector-manifest
version: 1.0.0
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

It was drafted at `0.1.0` in `req-001-mvp-product-definition` and is frozen here, at `1.0.0`, because the claim
it encodes has now been measured rather than asserted: a second connector of deliberately opposite shape — read
only, no writes, no snapshots, a different authorisation provider — was expressed entirely within this schema and
cost zero lines of change in the job manager, the connector registry, the evaluator, the ledger, the wrapping
layer and the tool generator — VERIFIED
(`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q1, Q3;
`spikes/SP-19-connector-framework/evidence/core-diff-report.md`).

Freezing before a third platform exists is a deliberate trade, argued in `design.md` D1: the property worth
protecting is the boundary, and a boundary that is renegotiated per connector is not one. The cost is paid in
`evolution.md`, which defines additive extension as a MINOR bump and states what the third connector is expected
to need.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`connector-manifest.schema.json`](./connector-manifest.schema.json) | JSON Schema 2020-12 | normative |

The file is the manifest's shape, and it is what a connector author's manifest is checked against at load. What
it cannot express is stated in this document instead and is enforced in the same whole-manifest pass: that a
tool's `capability` is one the manifest declares, that a scope profile grants nothing for a capability no tool
requires, that `snapshot.read_operation` and `compensation.tool` name tools this manifest declares, that two
manifests never share an `id`, and that an adapter is registered under that `id`. Each is a relation between
members rather than a property of one, so a manifest can satisfy the file and still yield no tool.

## Schema / Surface

### 1. Interface & Data Types

The manifest is data; what reads it is typed as follows. The normative shape is
[`connector-manifest.schema.json`](./connector-manifest.schema.json); the declarations below name the same
members for a reader and add the meaning the file carries only as description.

```typescript
import type { ReconciliationDeclaration } from "job/contracts/tool-reconciliation@0.1.0";

interface ConnectorManifest {
  schema_version: "1.0";                 // major.minor of THIS contract, not of the connector
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
  arguments_from: string;                // where in the recorded snapshot its arguments are built from
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
question held open as the reserved point in `model.md` rather than answered here. What does cross a boundary is
the authorisation this manifest configures, and that surface is
`backend/contracts/authorisation-broker-api@0.1.0`.

### 3. Module Descriptor / Manifest Specification

The normative descriptor is [`connector-manifest.schema.json`](./connector-manifest.schema.json). It is not
restated here: a manifest that satisfies that file and the whole-manifest rules under *Semantics* is a manifest
this build loads, and a second copy of the shape in prose would be the thing that drifts from it.

What the file expresses on its own: every required member, the identifier and version patterns, the closed sets
of authorisation kinds and tool directions, the exclusivity of `compensation` and `irreversible` on a write tool,
and `exclude_computed` being required inside a `snapshot`. What it cannot express, and what *Semantics* and the
table of refusals below hold instead: that a tool's `capability` is one the manifest declares, that a scope profile
grants nothing for a capability no tool requires, that `snapshot.read_operation` and `compensation.tool` name
tools this manifest declares, that no two manifests share an `id`, and that an adapter is registered under it.
Each of those is a relation between members rather than a property of one, so a manifest can satisfy the file and
still be refused at load.

## Semantics

**Validation is whole-manifest.** Every rule below is checked at load, and a manifest that breaks any of them
yields no tool at all. A partially loaded connector would offer operations whose reversibility nobody declared,
which principle IV forbids, and the author is the person who should meet the failure.

- `id` identifies the connector for the lifetime of the product. Changing it creates a different connector rather
  than a new version of this one, because ledger records, approval rules and stored authorisations all refer to
  it. `version` describes this manifest's own content; `schema_version` describes which version of this contract
  it was written against, and a manifest whose major number exceeds the build's is refused naming the application
  version it needs.
- **A write tool carries exactly one of `compensation` or `irreversible: true`.** Neither is refused; both are
  refused. A `compensation` requires a `snapshot`, because a compensating action is built from recorded prior
  state. A read tool carrying `snapshot`, `compensation` or `irreversible` is refused as a contradiction rather
  than silently reclassified.
- **`exclude_computed` is required inside a `snapshot` and may be empty.** An empty array is the author stating
  that the platform computes none of this object's values; an absent field is the author having not considered the
  question, and the two are not the same. The excluded values are stripped from the snapshot before it is
  recorded and are therefore absent from any compensating action built from it — VERIFIED for the six computed
  values a document platform rejects on write
  (`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q4, with `req-003-notion-compensation`).
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
  changes what is requested and nothing else — VERIFIED (Q8). The profile in force is recorded with each
  authorisation it produced, so a later change of profile is a re-consent rather than a silent widening.
- **`provider_id` is the join to the server-side half of the same platform.** Where a confidential client secret
  is needed, the exchange happens through `backend/contracts/authorisation-broker-api@0.1.0` against the
  descriptor of that identifier. A manifest whose `kind` is `oauth2` with no `provider_id` and no bring-your-own
  support is refused, because nothing would be able to complete its authorisation.
- **`content_sanitization` is required of any connector that returns document, message or file content.** Fetched
  content is untrusted data under the constitution's External Content Is Data section; this field declares how it
  is neutralised before it reaches an agent's context.
- **The declarations are read from here and nowhere else.** The gate reads `irreversible`, `changes_permission`
  and `bulk_threshold_param`; the undo planner reads `compensation` and `snapshot`; recovery reads
  `reconciliation`. None of them is ever read from a call's arguments, and each is copied into the record of
  intent when a call is made, so a manifest edited later cannot change how a recorded call is treated
  (INV-CN-06).

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `MANIFEST_SCHEMA_INVALID` | The manifest does not satisfy `connector-manifest.schema.json` | Callee, at load | The connector is presented as unavailable with the failing declaration named; every other connector is unaffected |
| `MANIFEST_VERSION_AHEAD` | `schema_version`'s major number exceeds the build's | Callee, at load | The connector is unavailable, stating the application version it requires |
| `REVERSIBILITY_UNDECLARED` | A write tool carries neither `compensation` nor `irreversible`, or carries both | Callee, at load | The whole connector fails to load; the author sees which tool and why |
| `SNAPSHOT_EXCLUSIONS_UNDECLARED` | A `snapshot` omits `exclude_computed` | Callee, at load | As above |
| `COMPENSATION_WITHOUT_SNAPSHOT` | A `compensation` is declared with no `snapshot` to build it from | Callee, at load | As above |
| `TOOL_REFERENCE_UNKNOWN` | `snapshot.read_operation`, `compensation.tool` or `reconciliation.read_operation` names a tool this manifest does not declare | Callee, at load | As above, except for `reconciliation.read_operation`, which degrades to `method: "none"` under its own contract |
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
an enumerated value a build that does not know it can safely refuse; widening a parameter schema so that it
accepts everything it accepted before.

**PATCH** — descriptions, labels, icons, guidance text and rate-policy figures.

**Support window.** A build loads a manifest whose `schema_version` shares its major number. Because every
manifest in this scope ships inside the build that reads it, the mixed-version window is empty by construction;
the version exists for reviewers and for the day the reserved point in `model.md` is activated, at which moment
it becomes a runtime negotiation and this paragraph must be rewritten rather than reinterpreted.

## Examples

**Accepted** — a read-only connector with two release-channel profiles, which is the second connector the spike
added:

```json
{
  "schema_version": "1.0",
  "id": "gmail",
  "name": "Gmail",
  "version": "1.0.0",
  "icon": "assets/gmail.svg",
  "description": "Read-only access to messages and their metadata.",
  "auth": {
    "kind": "oauth2",
    "provider_id": "google",
    "proof_key": true,
    "endpoints": {
      "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
      "token_url": "https://oauth2.googleapis.com/token",
      "api_base_url": "https://gmail.googleapis.com/gmail/v1"
    },
    "revocation": {
      "supported": true,
      "endpoint": "https://oauth2.googleapis.com/revoke"
    },
    "byo_client": {
      "supported": true,
      "refresh_lifetime_caveat": "While the user's own client is unverified, its refresh authorisation expires after seven days."
    }
  },
  "capabilities": {
    "email_read": {
      "name": "Read messages",
      "description": "List, search and read messages and their metadata."
    }
  },
  "scope_profiles": {
    "byo": { "email_read": ["https://www.googleapis.com/auth/gmail.readonly"] },
    "mass_market": { "email_read": ["https://www.googleapis.com/auth/gmail.metadata"] }
  },
  "content_sanitization": { "strip_instructions": true, "max_inline_content_bytes": 65536 },
  "tools": [
    {
      "name": "gmail_search_messages",
      "label": "Search messages",
      "description": "Search messages by query and return matching summaries.",
      "direction": "read",
      "capability": "email_read",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string" },
          "max_results": { "type": "number" }
        },
        "required": ["query"]
      },
      "reconciliation": { "method": "none", "reason": "A search changes nothing, so there is nothing to reconcile." }
    }
  ]
}
```

**Rejected** — a write tool whose reversibility nobody declared:

```json
{
  "schema_version": "1.0",
  "id": "example",
  "name": "Example",
  "version": "1.0.0",
  "auth": {
    "kind": "oauth2",
    "provider_id": "example",
    "endpoints": { "authorize_url": "https://example.test/authorize", "token_url": "https://example.test/token" },
    "revocation": { "supported": false, "settings_url": "https://example.test/settings/integrations" }
  },
  "capabilities": { "docs_write": { "name": "Manage documents", "description": "Create and delete documents." } },
  "scope_profiles": { "default": { "docs_write": ["docs.write"] } },
  "tools": [
    {
      "name": "example_delete_document",
      "label": "Delete document",
      "description": "Delete a document.",
      "direction": "write",
      "capability": "docs_write",
      "parameters": { "type": "object", "properties": { "document_id": { "type": "string" } }, "required": ["document_id"] },
      "reconciliation": { "method": "none" }
    }
  ]
}
```

The whole manifest is refused with `REVERSIBILITY_UNDECLARED`, not merely that tool. A partially loaded connector
would expose an operation whose reversibility is undeclared, which is precisely what principle IV forbids, and the
refusal belongs at load where the connector's author is looking rather than at the first call where a user is.

## Migration

**From `0.1.0` (drafted in `req-001-mvp-product-definition`) to `1.0.0`.** No application code, no manifest and no
stored data exists against the earlier draft, so this is a migration of documents rather than of a running
product. What changed, and why:

1. **Field naming is snake_case throughout.** The draft mixed conventions, and a tool declaration embeds the
   reconciliation fragment owned by `job/contracts/tool-reconciliation@0.1.0` verbatim; a descriptor cannot carry
   two naming conventions and remain checkable by one schema.
2. **`reconciliation` became required on every tool.** The draft did not carry it at all, which left the recovery
   engine to infer what an interrupted call meant — the failure mode `req-013-sqlite-ledger` recorded as RISK-045.
3. **`revocation` replaced the optional `revokeEndpoint`.** The absence of an endpoint is now a declaration with
   the user-facing consequence attached, on the evidence that one of the two measured platforms has none.
4. **`exclude_computed` became required inside a `snapshot`.** The draft carried sanitization only at connector
   level, which cannot express which values a particular write target's platform computes.
5. **`capabilities` was hoisted out of the authorisation block.** Capabilities are what tools belong to and what
   users enable; scopes are one consequence of them, and nesting the former inside the latter made a tool's
   capability reference read as an authorisation detail.

Consumers to update: `req-007-pi-sdk-harness` reads the declarations block through
`agent/contracts/tool-wrapping@0.1.0` and needs no change, since it names the declarations rather than their
encoding. `req-003-notion-compensation` and `req-014-byo-oauth-google` author manifests against this version
directly, having none written against the draft.

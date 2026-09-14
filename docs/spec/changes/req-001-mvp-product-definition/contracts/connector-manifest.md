---
contract: connector-manifest
version: 0.1.0
status: draft
owner: connector
consumers: [agent, approval, ledger, undo, app, uix]
schema_files: [connector-manifest.schema.json]
---

# Contract: Connector Manifest

## Purpose

This contract is what makes a connector data rather than code. A connector author supplies a manifest and an
adapter; the product generates the agent's tool set from the manifest, derives the approval classification of
each operation from it, and reads the compensating-action declaration from it when planning an undo. No
component may learn about a platform any other way, which is what keeps the job manager, the hooks, the ledger
and the interface unchanged as platforms are added.

It is drafted here at the product baseline and frozen by `req-019-connector-framework`, which measured the
"adding a connector changes no core component" claim by adding a second connector.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`connector-manifest.schema.json`](./connector-manifest.schema.json) | JSON Schema 2020-12 | normative |

The file is the manifest's shape at this baseline, and it is what a connector author's manifest is checked
against at load. What it cannot express is stated in this document instead and is enforced in the same
whole-manifest pass: that a tool's `capability` is one a scope profile declares, that `snapshot.method` and
`compensation.tool` name tools this manifest declares, that no two manifests share an `id`, and that an adapter
is registered under that `id`. Each is a relation between members rather than a property of one, so a manifest
can satisfy the file and still yield no tool.

The frozen successor of this file is `connector-manifest.schema.json` in `req-019-connector-framework`, whose
shape was measured against a second connector. Where the two differ, the frozen one governs implementation and
this one records what the product baseline required.

## Schema / Surface

### 1. Interface & Data Types

```typescript
// The adapter surface a connector implements. The manifest declares what exists;
// the adapter performs it. Four operations, no more.
interface ConnectorAdapter {
  execute(tool: string, params: ToolParams, auth: AuthRef): Promise<ToolResult>;
  fetchSnapshot(tool: string, params: ToolParams, auth: AuthRef): Promise<Snapshot | NoSnapshot>;
  checkStatus(auth: AuthRef): Promise<ConnectionStatus>;
  revoke(auth: AuthRef): Promise<void>;
}

type ToolResult =
  | { ok: true; value: unknown; after?: Snapshot }
  | { ok: false; error: ConnectorError };

type ConnectorError = {
  code: ConnectorErrorCode;      // see Error Matrix
  message: string;               // for the ledger, not for the agent to reinterpret
  retryable: boolean;
  retryAfterMs?: number;
};

type ConnectionStatus = 'connected' | 'token_expired' | 'permission_error' | 'revoked';

type NoSnapshot = { snapshot: null; reason: 'unreadable' | 'not_applicable' };
```

### 3. Module Descriptor / Manifest Specification

The normative descriptor is [`connector-manifest.schema.json`](./connector-manifest.schema.json); it is not
restated here. The fields it declares are named, with their meaning, under Semantics below, and the rules it
cannot express — the relations between a tool, a capability, a scope profile and a registered adapter — are
listed under Machine-Readable Artifacts above.

## Semantics

`id` identifies the connector for the lifetime of the product; changing it creates a different connector rather
than a new version of this one. `version` describes the manifest's own shape and is what a compatibility check
reads.

Every entry in `tools` becomes exactly one tool offered to a worker-agent, and only when the connector holds an
authorised account. A tool whose `direction` is `write` must carry either a `compensation` object or
`irreversible: true`, and never both: the undo planner reads that field to classify the operation, and the
approval evaluation reads it to decide whether the operation is stopped by default. `snapshot` declares how the
prior state is read before a write; a write tool with a `compensation` object must declare a `snapshot`, because
a compensating action is built from the recorded prior state.

`capability` names the functional capability a tool belongs to, and the selected entry in `scopeProfiles` maps
that capability to the authorisation scopes requested. A capability that is not enabled contributes no scope,
which is how the minimum-scope rule is enforced structurally rather than by review. Selecting a different
profile changes the scopes requested without editing anything else in the manifest.

`bulkThresholdParam` names the parameter whose length determines whether an operation counts as bulk for the
static approval tier, so that the tier does not need connector-specific knowledge to count objects.

`sanitization` declares how content fetched by this connector is neutralised before entering an agent's
context. It exists because fetched content is untrusted data under the constitution's External Content Is Data
section; a connector that returns document or message bodies must declare it.

Failure is signalled by returning a `ConnectorError` rather than throwing, so that the wrapper records a result
record for every intent record it wrote. `retryable` and `retryAfterMs` drive the bounded retry policy; they are
advice to the job, not a promise the operation will eventually succeed.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `auth_expired` | The stored authorisation is no longer accepted | Caller | The job fails stating the connector must be reconnected; the connector shows as expired with a one-action reconnect |
| `auth_revoked` | The authorisation was withdrawn at the platform | Caller | The job fails stating the authorisation was withdrawn; the connector shows as revoked |
| `permission_denied` | The granted scope does not cover the operation | Caller | The job fails naming the missing capability; the connector offers re-consent |
| `rate_limited` | The platform refused the request for pacing reasons | Callee then Caller | The connector paces and retries within the bounded policy; the user sees nothing unless the retries are exhausted |
| `not_found` | The target object does not exist | Caller | The agent reports the object was not found and does not create a substitute |
| `invalid_params` | The parameters do not match the platform's expectations | Caller | The job fails naming the offending parameter |
| `conflict` | The object changed since the snapshot was taken | Caller | For an undo, the item is classified as a conflict and asked about separately |
| `unsupported` | The operation is not supported for this object's configuration | Caller | The operation is reported as unsupported with the reason, rather than attempted differently |
| `platform_error` | The platform failed for its own reasons | Both | Bounded retry, then a clean failure carrying the platform's reason |
| `snapshot_unreadable` | The prior state could not be read before a write | Callee | The operation is treated as irreversible and, in `smart` and `on`, raises an approval request |

## Compatibility

MAJOR: removing a tool, changing a tool's `direction`, removing a scope profile, or changing a tool from
carrying `compensation` to carrying `irreversible`. Each of those changes what the product may already have
promised the user about reversibility or reach.

MINOR: adding a tool, adding a scope profile, adding an optional field, or widening a parameter schema in a way
that accepts everything it accepted before.

PATCH: description text, icon, guidance steps, and rate-policy figures.

Support window: the product loads a manifest whose `manifestVersion` matches its own major version. A manifest
from a newer major version is refused with a message naming the required application version rather than loaded
partially.

## Examples

Valid — a write tool that declares how it is compensated:

```json
{
  "manifestVersion": "1",
  "id": "notion",
  "name": "Notion",
  "version": "1.0.0",
  "auth": { "authorizeEndpoint": "…", "tokenEndpoint": "…", "exchange": "confidential" },
  "scopeProfiles": [{ "profile": "default", "capabilities": { "tasks.read": [], "tasks.write": [] } }],
  "tools": [
    {
      "name": "update_task_properties",
      "direction": "write",
      "capability": "tasks.write",
      "params": { "taskId": "string", "properties": "object" },
      "snapshot": { "method": "read_task", "targetFrom": "taskId" },
      "compensation": { "tool": "update_task_properties", "paramsFrom": "snapshot.properties" }
    }
  ]
}
```

Rejected — a write tool declaring neither compensation nor irreversibility:

```json
{
  "manifestVersion": "1",
  "id": "example",
  "name": "Example",
  "version": "1.0.0",
  "auth": { "authorizeEndpoint": "…", "tokenEndpoint": "…", "exchange": "pkce" },
  "scopeProfiles": [{ "profile": "default", "capabilities": { "docs.write": [] } }],
  "tools": [
    { "name": "delete_doc", "direction": "write", "capability": "docs.write", "params": { "docId": "string" } }
  ]
}
```

The whole manifest is refused, not just that tool: a partially loaded connector would expose operations whose
reversibility is undeclared, which is precisely what the constitution's fourth principle forbids.

---
contract: connector-adapter
version: 1.0.0
status: frozen
owner: connector
consumers: [agent, approval, job, ledger, undo, app, uix]
schema_files: [connector-adapter.schema.json]
---

# Contract: Connector Adapter

## Purpose

The manifest says what a platform offers; this contract says how the product reaches it. It is deliberately the
smallest surface that can carry the product's obligations: execute a declared tool, read the prior state of
something about to be written, establish what the platform currently thinks of the stored authorisation, and
withdraw that authorisation. Four operations, and a fifth is how a platform's peculiarities start leaking into the
core.

Two audiences build on it. A connector author implements it, and needs to know exactly what may be returned and
what may not be thrown. The wrapping layer, the job manager and the ledger consume it, and need failures to arrive
in a fixed vocabulary so that what is retried, what ends a job cleanly and what reaches the user is decided once
rather than per platform.

Both halves were measured: the second connector was written against this surface and cost zero lines of change in
every core component, and a call made after its authorisation had been withdrawn produced the declared code, was
recorded by the wrapping layer, and ended the job without hanging or crashing — VERIFIED
(`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q3, Q4, Q10).

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`connector-adapter.schema.json`](./connector-adapter.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of what an adapter returns: the result of `execute` at its root, and the results of
`fetchSnapshot`, `checkStatus` and `revoke` as the members of its `$defs`. It carries the closed error
vocabulary and the rule that the seven conditions repeating cannot change are never marked retryable. Two rules
it cannot express are held by this document and are the ones an adapter is reviewed against: that a platform
failure is returned rather than thrown, so that a result record exists for every intent record already written,
and that a success never carries a failure inside its `value`. The operations themselves are an in-process
interface and have no wire form to publish; `$defs` is where a reader finds each one's return shape.

## Schema / Surface

### 1. Interface & Data Types

The normative shape of every outcome below is
[`connector-adapter.schema.json`](./connector-adapter.schema.json); the declarations here name the same members
for a reader, together with the four operations, which are an in-process interface the file does not describe.

```typescript
import type { ToolDeclaration } from "connector/contracts/connector-manifest@1.0.0";

/**
 * The whole of what a connector implements. Held privately by the wrapped tools generated from its manifest;
 * no component outside that wrapper holds a reference to it (INV-CN-08).
 */
interface ConnectorAdapter {
  execute(call: ToolCall, auth: AuthRef): Promise<ToolResult>;
  fetchSnapshot(call: ToolCall, auth: AuthRef): Promise<SnapshotResult>;
  checkStatus(auth: AuthRef): Promise<ConnectionStatus>;
  revoke(auth: AuthRef): Promise<RevokeOutcome>;
}

interface ToolCall {
  tool: string;                       // a tool name the connector's manifest declares
  declaration: ToolDeclaration;       // that tool's declaration, as loaded; never rebuilt from the arguments
  arguments: Record<string, unknown>; // validated against the declared parameter shape before arrival
  signal: AbortSignal;                // cancellation reaches the platform call itself where the platform allows it
}

/** A handle to the authorisation, never its value. Resolved against the credential store at the moment of use. */
interface AuthRef {
  connectorId: string;
  profile: string;                    // the scope profile this authorisation was granted under
}

type ToolResult =
  | { ok: true; value: unknown; after?: unknown }
  | { ok: false; error: ConnectorError };

type SnapshotResult =
  | { ok: true; snapshot: unknown }                       // already stripped of the declared computed values
  | { ok: true; snapshot: null; reason: "not_applicable" }
  | { ok: false; error: ConnectorError };                 // includes SNAPSHOT_UNREADABLE

interface ConnectorError {
  code: ConnectorErrorCode;
  message: string;                    // the platform's own words, for the ledger and the user — never reinterpreted
  retryable: boolean;
  retryAfterMs?: number;
}

type ConnectorErrorCode =
  | "CONNECTOR_REVOKED"        // the authorisation was withdrawn at the platform
  | "CONNECTOR_EXPIRED"        // the authorisation is no longer current
  | "CONNECTOR_DISCONNECTED"   // no authorisation is held for this connector on this account
  | "PERMISSION_DENIED"        // the authorisation is accepted; the granted scope does not cover this call
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INVALID_PARAMS"
  | "CONFLICT"                 // the object changed since the snapshot was taken
  | "UNSUPPORTED"              // the platform does not support this operation for this object
  | "SNAPSHOT_UNREADABLE"      // the prior state of a write target could not be read
  | "UNREACHABLE"              // the platform could not be reached at all; nothing is concluded from it
  | "PLATFORM_ERROR";          // the platform failed for its own reasons

interface ConnectionStatus {
  state: "connected" | "expired" | "permission_short" | "revoked";
  establishedAt: string;       // ISO-8601; a state is an observation with a time (INV-CN-10)
  canRenewHere: boolean;       // whether the device can renew without sending the user to the platform
  detail?: string;             // the platform's own words, where it gave any
}

type RevokeOutcome =
  | { withdrawn: true }                                    // the platform's revoke endpoint accepted
  | { withdrawn: false; reason: "unsupported" }            // the manifest declares no endpoint
  | { withdrawn: false; reason: "refused"; error: ConnectorError };
```

**What may not happen.** An adapter does not throw for a platform failure: it returns a `ConnectorError`, so that
the wrapping layer writes a result record for every intent record it wrote. It does not decide whether a call is
permitted, does not read a rule, does not write to the ledger, and does not ask the user anything. It does not
retry on its own beyond what one platform request needs, because the retry budget belongs to the job. And it never
returns a success carrying a failure inside it, because that is the shape the job manager cannot classify.

### 2. Wire / Communication Protocol

The adapter is the only component that crosses the boundary between the product and a platform. It runs in the
process that owns the ledger, the gate and the connectors; it is reachable from no window, and the renderer has no
channel to it. What crosses outward is HTTPS to the platform, and the authorisation it carries is resolved from
the credential store per call.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| Platform tool call | Device → Platform | Request-Response | The platform's own request, formed from `ToolCall.arguments` under the declared parameter shape | The platform's own response, returned as `ToolResult.value` | Every failure mapped to a `ConnectorErrorCode` at this edge; nothing platform-shaped travels inward |
| Platform read for a snapshot | Device → Platform | Request-Response | The read declared by `snapshot.read_operation`, addressed by `snapshot.target_param` | `SnapshotResult`, with the declared computed values already stripped | `SNAPSHOT_UNREADABLE` on refusal; the write is then treated as irreversible rather than attempted blind |
| Platform status probe | Device → Platform | Request-Response | A request the platform answers cheaply, carrying the stored authorisation | `ConnectionStatus` with the instant it was established | `UNREACHABLE` concludes nothing and never becomes `revoked` |
| Platform revocation | Device → Platform | Request-Response | The endpoint declared in the manifest's `revocation` | `RevokeOutcome` | `unsupported` where the manifest declares no endpoint; the local authorisation is erased either way |
| Authorisation exchange and renewal | Device → Backend → Platform | Request-Response | `backend/contracts/authorisation-broker-api@0.1.0` | Tokens, held only in the credential store | The broker's own codes; a renewal that needs the user surfaces as `canRenewHere: false` |

### 3. Module Descriptor / Manifest Specification

The descriptor for an adapter is its connector's manifest: what the adapter must implement is exactly what
`connector/contracts/connector-manifest@1.0.0` declares, and an adapter registers only as one half of that pair
(INV-CN-12). There is no separate adapter descriptor, and deliberately so — a second descriptor would be a second
place a platform's behaviour could be expressed, which is the thing this capability exists to prevent.
[`connector-adapter.schema.json`](./connector-adapter.schema.json) is not a descriptor of an adapter: it is the
shape of what an adapter returns, and nothing registers by satisfying it.

## Semantics

- **The four operations are exhaustive.** A platform capability that does not fit becomes a declared tool reached
  through `execute`, never a fifth method. This is what makes the adapter surface a boundary rather than a
  convention (INV-CN-03).
- **`checkStatus` asks the platform.** It does not inspect a stored expiry and conclude from it. An expiry says
  what the product believes; only the platform says whether the authorisation is currently accepted, and the four
  states were told apart against real endpoints — VERIFIED (Q9). `canRenewHere` is what decides whether the user
  sees a renewal that costs them nothing or a reconnection that sends them to the platform.
- **`UNREACHABLE` concludes nothing.** No network, a timeout or an outage is not evidence about an authorisation.
  The last established state is presented with the fact that it could not be confirmed, and it never becomes
  `revoked` or `expired` on the strength of a failed request (INV-CN-10).
- **`retryable` is advice, not a promise.** It tells the job's bounded retry policy that repeating the call could
  succeed; the budget and the delays are the job's. `CONNECTOR_REVOKED`, `CONNECTOR_EXPIRED`,
  `CONNECTOR_DISCONNECTED`, `PERMISSION_DENIED`, `INVALID_PARAMS`, `NOT_FOUND` and `UNSUPPORTED` are never
  retryable: repeating them cannot change the answer, and pretending otherwise turns one clean failure into four.
- **A failure carrying no declared code is a defect, not a transient.** The wrapping layer records it as an
  adapter defect and the job treats it as permanent, because a failure whose nature is unknown is not evidence
  that repeating it is safe.
- **`fetchSnapshot` returns state already stripped.** The values a tool's `exclude_computed` names are removed
  before the snapshot leaves the adapter, so nothing downstream has to know which of a platform's values are
  computed — VERIFIED (Q4). `not_applicable` is for a write with no prior state to speak of, such as a creation;
  it is not the same as `SNAPSHOT_UNREADABLE`, which is a refusal and makes the write irreversible for this call.
- **`revoke` always erases locally.** Whether the platform withdrew the authorisation, has no endpoint to withdraw
  it, or refused, the product's copy is erased; the difference between those three is what the user is told, and
  it is carried here so that the interface never has to guess — VERIFIED
  (`spikes/SP-19-connector-framework/REPORT.md#4-rui-ro-moi-phat-hien`).
- **Cancellation reaches the platform where the platform allows it.** A call already sent is not abandoned
  mid-flight; the signal is honoured at the boundaries the platform's own protocol provides, and an interrupted
  call is settled afterwards by `job/contracts/tool-reconciliation@0.1.0`, not by guessing here.
- **An adapter holds no authorisation value.** It receives a reference and resolves it through
  `platform/contracts/secure-storage@0.1.0` at the moment of the call, so a credential is never a member of an
  adapter, a manifest or a generated tool (INV-CN-09).

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `CONNECTOR_REVOKED` | The platform reports the authorisation withdrawn | Caller: the job ends at that call | The job fails stating the authorisation was withdrawn, lists what it completed, and offers to reconnect |
| `CONNECTOR_EXPIRED` | The authorisation is no longer current and was not renewed | Both: the adapter attempts renewal where it can; otherwise the job ends | The connector shows as expired with a one-action reconnect; a job that required it says so |
| `CONNECTOR_DISCONNECTED` | No authorisation is held for this connector on this account | Caller | The job fails naming the connector to connect; the agent never held the tool in the first place unless it was disconnected mid-job |
| `PERMISSION_DENIED` | The granted scope does not cover the call | Caller | The job fails naming the capability that is missing; re-consent is offered rather than reconnection |
| `RATE_LIMITED` | The platform refused for pacing reasons | Callee then Caller: paced by the connector, retried within the job's bounded policy | Nothing, unless the retries are exhausted |
| `NOT_FOUND` | The target object does not exist | Caller | The agent reports the object was not found and does not substitute another |
| `INVALID_PARAMS` | The platform rejected the arguments | Caller | The job fails naming the offending parameter |
| `CONFLICT` | The object changed since the snapshot was taken | Caller | For an undo, the item is classified as a conflict and asked about separately |
| `UNSUPPORTED` | The platform does not support this operation for this object's configuration | Caller | Reported as unsupported with the platform's reason, rather than attempted a different way |
| `SNAPSHOT_UNREADABLE` | The prior state of a write target could not be read | Both: the adapter reports it; the gate treats the call as irreversible | In `smart` and `on`, an approval request; the user sees that the previous state could not be captured |
| `UNREACHABLE` | The platform could not be reached | Caller: retried under the job's policy; recovery concludes nothing from it | The job reports a connection problem, and no connector is marked revoked or expired because of it |
| `PLATFORM_ERROR` | The platform failed for its own reasons | Both: bounded retry, then a clean failure | The job fails carrying the platform's own message |
| *(no code)* | An adapter returned a failure carrying no declared code | Caller: treated as permanent and recorded as an adapter defect | An ordinary failure card; the defect is reported to the connector's author rather than to the user |

## Compatibility

**MAJOR** — adding, removing or renaming an operation; changing what an operation returns on success; removing an
error code or changing what one means; making a failure a thrown exception rather than a returned value; changing
`checkStatus` from an observation with a time into a stored truth. Each of these changes what the core may
conclude, which is why they are MAJOR even where they are source-compatible.

**MINOR** — adding an optional member to a returned type; adding an error code whose handling the existing rules
already cover, such as a new never-retryable platform condition; adding an optional member to `ToolCall`.

**PATCH** — wording, examples and the text of `message` fields.

**Support window.** Both ends of this contract live in one application release and update together, so there is no
mixed-version window. It is versioned for reviewers: a MAJOR here is an instruction to re-run the two conformance
suites named in `verification.md` before the change ships, because those suites — not this prose — are what the
zero-core-change claim rests on.

## Examples

**Accepted** — a failure a job can act on without knowing the platform:

```json
{
  "ok": false,
  "error": {
    "code": "CONNECTOR_REVOKED",
    "message": "invalid_grant: Token has been expired or revoked.",
    "retryable": false
  }
}
```

The wrapping layer records it against the intent it already wrote, the job ends failed with its
completed-operations list, and the connector is presented as revoked with a reconnect action — none of which
required either the job manager or the ledger to know which platform produced it.

**Rejected** — a failure dressed as a success:

```json
{
  "ok": true,
  "value": { "status": 401, "error": "invalid_grant", "detail": "Token has been expired or revoked." }
}
```

Refused as a contract violation. [`connector-adapter.schema.json`](./connector-adapter.schema.json) accepts it —
a success may legitimately carry any value the platform returned, so no schema can tell this one from an ordinary
result — and it is refused by reading, which is why the rule is stated here rather than left to the file. The call
is recorded as having succeeded, the job continues against a withdrawn authorisation, and every later failure is
attributed to the wrong cause: exactly the class of defect the fixed error vocabulary exists to make impossible.

## Migration

Not applicable as a version bump: `1.0.0` is this contract's first published version. The adapter surface existed
before it only as four signatures sketched inside the `connector-manifest@0.1.0` draft in
`req-001-mvp-product-definition`; that sketch is superseded here, and the manifest contract now references this one
rather than describing it. Two renamings came with the move and are recorded so a reader of the draft is not
confused: the error codes are the measured SCREAMING_SNAKE names rather than the draft's lowercase ones, matching
what the spike's core components actually branched on, and `auth_expired` and `auth_revoked` became
`CONNECTOR_EXPIRED` and `CONNECTOR_REVOKED` so that the three states that end a job cleanly read as one family.

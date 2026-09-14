---
contract: public-service-endpoints
version: 0.1.0
status: draft
owner: backend
consumers: [app, platform]
schema_files: [public-service-endpoints.openapi.yaml]
---

# Contract: Public Service Endpoints

## Purpose

Two things must be answerable before a device has a session: whether the service is serving, and whether this
client is still a version the service accepts. Both are consequently unauthenticated, which makes them the
service's only surface reachable without a session and the one an unauthenticated flood arrives at first. This
contract governs that surface: what the two endpoints answer, what they must not disclose, and the rate-limit
classes that apply to them and to everything else.

`app` consumes the version check to decide whether to prompt for an update and to explain a refused sign-in.
`platform` consumes it as the entry point to the update lifecycle. The manifest's *content* — what an update
contains, how it is signed and verified — is owned by `platform` under `req-016-signing-update`, and is not
specified here. This contract owns only the endpoint, its availability semantics and the reference it returns.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`public-service-endpoints.openapi.yaml`](./public-service-endpoints.openapi.yaml) | OpenAPI 3.1 | normative |

Both endpoints are declared there with no security requirement, which is the unauthenticated surface stated in
a form a reader cannot miss. The rate-limit classes are not in the file: thresholds are service configuration,
and the class an endpoint belongs to is stated here.

## Schema / Surface

### 1. Interface & Data Types

The wire surface is [`public-service-endpoints.openapi.yaml`](./public-service-endpoints.openapi.yaml). The
declarations below name the same payloads for a reader.

```typescript
interface HealthResult {
  status: "healthy" | "degraded" | "unhealthy";
  storeReachable: boolean;
  uptimeSeconds: number;
}

interface VersionResult {
  currentVersion: string;          // semver of the current released client
  minimumSupportedVersion: string; // below this, the service refuses the client
  mandatory: boolean;              // true = the current version must be taken before continuing
  manifestUri?: string;            // absent = no update is published for this client
  releaseNotesUri?: string;
}

type PublicError =
  | { code: "RATE_LIMITED"; retryAfterSeconds: number }
  | { code: "SERVICE_UNAVAILABLE" };

type RateLimitClass =
  | "authentication"   // session.signIn, session.refresh
  | "brokering"        // every broker.* call
  | "public";          // health, version
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `service.health` | Operator or device → Backend | Request-Response | — | `HealthResult` | `RATE_LIMITED`, `SERVICE_UNAVAILABLE`. Exercises store reachability rather than reporting process liveness |
| `service.version` | Device → Backend | Request-Response | — | `VersionResult` | `RATE_LIMITED`, `SERVICE_UNAVAILABLE`. Answered without a session so a client too old to sign in can learn why |

Both are unauthenticated and both are in the `public` rate-limit class. Rate limiting is evaluated before any
session verification on every endpoint of every class, by INV-BE-09.

### 3. Module Descriptor / Manifest Specification

Not applicable. The rate-limit classes are a `closed` variability point: thresholds are service configuration,
but the three classes are fixed so that a newly added endpoint must be placed in one of them rather than escape
limiting by being new.

## Semantics

- **Health exercises the store.** A process that is running while its store is unreachable reports `unhealthy`,
  not `healthy`. An instance that answers but has lost a non-essential dependency reports `degraded`. This is the
  distinction that makes the endpoint worth having: liveness that cannot fail tells an operator nothing.
- **Health discloses nothing about accounts.** No count, no address, no identifier. It answers without a session
  precisely because it must be callable by an operator or a load balancer, which is also why it must be
  worthless to anyone else who calls it.
- **The version check answers before sign-in, deliberately.** A client below `minimumSupportedVersion` will be
  refused when it tries to sign in; without an unauthenticated version check it could not distinguish that from
  an outage or a rejected identity.
- **`mandatory` is a statement about the service, not a request to the user.** It means the service will stop
  accepting this client, so the product must present the update as required rather than optional. How the update
  is then presented, staged and applied — and what happens to a running job while it is — is owned by
  `platform`.
- **An absent `manifestUri` means no update is published**, not that the check failed. A failed check is
  `SERVICE_UNAVAILABLE`, and the application continues to run and reports that it could not check for updates.
- **Unauthenticated does not mean uncounted.** The `public` class is rate-limited like the others. It is the
  cheapest endpoint to serve and therefore the most attractive to flood; the load measurement bears that out,
  with the public version check sustaining an order of magnitude more throughput than the authenticated paths —
  VERIFIED, `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q9).
- **`RATE_LIMITED` is never presented as a failure of what the caller asked for.** It states that the service is
  busy and when the caller may retry, and it is distinguishable from an authentication failure — the spec
  requires exactly that distinction.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `RATE_LIMITED` | Calls from this source exceeded the class threshold | Caller — wait `retryAfterSeconds`, then retry | For the version check, nothing: the application continues and retries later. For health, the operator sees the refusal and the retry window |
| `SERVICE_UNAVAILABLE` | The instance or its store is unreachable | Caller — retry later | The application continues to run and reports that it could not check for updates. Running jobs are unaffected |

## Compatibility

- **MAJOR** — removing an endpoint, removing a `VersionResult` field, requiring a session for either endpoint,
  adding a `HealthResult` status value an older reader would treat as healthy, or changing what `mandatory`
  obliges.
- **MINOR** — adding an optional field, adding a `HealthResult` status an older reader safely treats as not
  healthy, adding a rate-limit class, adding an error code a caller can treat as a generic failure.
- **PATCH** — clarifying wording, correcting an example.
- **Legacy support** — an unrecognised `status` is treated as not healthy, and an unrecognised field is ignored.
  The direction of both defaults is fixed: a reader that guesses must guess towards reporting a problem, never
  towards reporting health.
- **Version discovery** — this contract is the version-discovery mechanism for the others. It is unauthenticated
  and additive-only for that reason: every other contract's compatibility story depends on this one answering.

## Examples

**Valid** — a client checking whether it is current:

```json
{
  "currentVersion": "0.4.2",
  "minimumSupportedVersion": "0.4.0",
  "mandatory": false,
  "manifestUri": "https://updates.example.invalid/0.4.2/manifest.json",
  "releaseNotesUri": "https://example.invalid/notes/0.4.2"
}
```

A client on 0.4.1 offers the update without insisting. A client on 0.3.9 is below the minimum and presents it as
required, because sign-in will be refused.

**Rejected** — a health response that reports the process rather than the service:

```json
{ "status": "healthy", "storeReachable": false, "uptimeSeconds": 41203 }
```

This is a contradiction, not a valid state: `storeReachable: false` means the instance cannot serve any
authenticated request, so `status` must be `unhealthy`. Accepting it would keep a dead instance in rotation
behind a load balancer that trusts the endpoint, which is the one job this endpoint has.

## Migration

Not applicable — initial version.

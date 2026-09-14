---
contract: authorisation-broker-api
version: 0.1.0
status: draft
owner: backend
consumers: [connector, app, platform]
schema_files: [authorisation-broker-api.openapi.yaml]
---

# Contract: Authorisation Broker API

## Purpose

The broker exists so that a confidential client secret can be used without ever being on the user's machine, and
so that the same three calls serve every platform. Its shape is the reason adding a provider costs a descriptor
and nothing else: this contract does not change when a provider is added — VERIFIED at zero lines of change to
the interface description when a second provider was declared,
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3).

`connector` is the primary consumer: it starts a connect, completes it, and refreshes a token that the platform
will only refresh for a confidential client. `app` consumes the outcomes to present connector state. `platform`
consumes the result at the hand-off point, storing the returned tokens in the operating system's secure storage
under `platform/contracts/secure-storage`.

What this contract deliberately does not do is hold anything. The provider tokens exist in the response and
nowhere else on the server, which is the requirement in `specs/backend/spec.md` and the invariant INV-BE-03.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`authorisation-broker-api.openapi.yaml`](./authorisation-broker-api.openapi.yaml) | OpenAPI 3.1 | normative |

The file is itself the evidence for the claim this contract makes: a provider appears in it only as a path
parameter, so adding one adds nothing to it. There is no schema file for what the broker stores, because it
stores nothing: the service's only durable store is the one owned by
`backend/contracts/client-session-api@0.1.0`, and none of its relations holds a provider credential.

## Schema / Surface

### 1. Interface & Data Types

The wire surface is [`authorisation-broker-api.openapi.yaml`](./authorisation-broker-api.openapi.yaml). The
declarations below name the same payloads for a reader.

```typescript
type ProviderId = string;
type BindingValue = string;      // opaque, single-use, carries no credential (INV-BE-08)

interface AuthorizeUrlRequest {
  providerId: ProviderId;
  redirectUri: string;           // a loopback address the device is listening on
  scopes?: string[];             // absent = the descriptor's defaultScopes
}

interface AuthorizeUrlResult {
  providerId: ProviderId;
  authorizeUrl: string;          // the URL to open in the user's browser
  binding: BindingValue;
  expiresInSeconds: number;      // how long the exchange may be completed
}

interface ExchangeRequest {
  providerId: ProviderId;
  code: string;                  // authorisation code as returned to the loopback address
  redirectUri: string;           // must equal the one the binding was issued for
  binding: BindingValue;
}

interface ProviderTokens {
  providerId: ProviderId;
  accessToken: string;
  tokenType: string;
  expiresInSeconds?: number;     // absent = the provider states no expiry
  refreshToken?: string;         // absent = the provider issues none
  scope?: string;
  providerExtras?: Record<string, unknown>; // provider-specific payload, opaque to the broker
}

interface ProviderRefreshRequest {
  providerId: ProviderId;
  refreshToken: string;          // held by the device; the server keeps no copy
}

type BrokerError =
  | { code: "PROVIDER_UNSUPPORTED"; providerId: ProviderId }
  | { code: "BINDING_UNKNOWN" }
  | { code: "BINDING_CONSUMED" }
  | { code: "BINDING_EXPIRED" }
  | { code: "REDIRECT_MISMATCH" }
  | { code: "PROVIDER_REJECTED"; providerId: ProviderId; providerReason: string }
  | { code: "PROVIDER_UNREACHABLE"; providerId: ProviderId }
  | { code: "TOKEN_MISSING" }
  | { code: "TOKEN_EXPIRED" }
  | { code: "TOKEN_INVALID" }
  | { code: "RATE_LIMITED"; retryAfterSeconds: number }
  | { code: "SERVICE_UNAVAILABLE" };
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `broker.authorizeUrl` | Device → Backend | Request-Response | `AuthorizeUrlRequest` | `AuthorizeUrlResult` | `PROVIDER_UNSUPPORTED`, `TOKEN_MISSING`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`. Requires a session; the binding is issued against it |
| `broker.exchange` | Device → Backend | Request-Response | `ExchangeRequest` | `ProviderTokens` | `PROVIDER_UNSUPPORTED`, `BINDING_UNKNOWN`, `BINDING_CONSUMED`, `BINDING_EXPIRED`, `REDIRECT_MISMATCH`, `PROVIDER_REJECTED`, `PROVIDER_UNREACHABLE`, plus the session and rate errors. The binding is consumed whether or not the provider accepts the code |
| `broker.refreshProviderToken` | Device → Backend | Request-Response | `ProviderRefreshRequest` | `ProviderTokens` | `PROVIDER_UNSUPPORTED`, `PROVIDER_REJECTED`, `PROVIDER_UNREACHABLE`, plus the session and rate errors. No binding: the device already holds the authorisation |
| Provider redirect to the device's loopback address | Provider → Device (via the user's browser) | Request-Response | `code` and `binding`, or a refusal | — | Not a backend channel. The device discards a redirect carrying a binding it did not issue, per `specs/connector/spec.md` |

The proof-key exchange, where a provider requires it, is handled entirely server-side: the challenge is derived
and held with the Authorisation Request, and the verifier is supplied by the broker at the token call. It is
deliberately absent from these payloads. A device-held verifier would have to travel back on `broker.exchange`,
which adds a secret to the device for no gain — the confidential client secret that makes the exchange
trustworthy is already server-side.

### 3. Module Descriptor / Manifest Specification

Not applicable here. Providers are declared through
`backend/contracts/authorisation-provider-descriptor@0.1.0`, and the entire point of that separation is that
this wire contract is unchanged by a new provider.

## Semantics

- **The binding is the thread through an untrusted round trip.** It is issued against the session that started
  the connect, it names the provider and the redirect address, it is single-use, and it expires. A code arriving
  with a binding issued to another session, already used, or past its expiry never reaches the provider. It
  carries nothing of value itself, by INV-BE-08, because it travels through the browser and the operating
  system's URL handling.
- **`redirectUri` is bound, not merely passed through.** An exchange whose `redirectUri` differs from the one the
  binding was issued for is refused with `REDIRECT_MISMATCH`, before the provider is contacted.
- **The binding is consumed on attempt, not on success.** A failed exchange does not leave a reusable binding
  behind; recovery is to start Connect again, which is one action for the user and closes replay as a class.
- **`ProviderTokens` is a pass-through.** The broker reads only what the exchange requires and forwards the rest
  in `providerExtras` without interpretation — a workspace identifier, a bot identifier, an account label.
  Interpreting it would put platform knowledge in the broker, which INV-BE-04 forbids.
- **Nothing in `ProviderTokens` is retained.** There is no server-side record of the exchange to delete
  afterwards; the response is the only copy the server ever produced. This is what makes the retention claim in
  `specs/backend/spec.md` checkable by dumping the store rather than by reading code.
- **`broker.refreshProviderToken` carries the refresh token per call.** The device holds it, the server holds
  only the client secret by name. This is the whole reason the endpoint exists: the platform will refresh only
  for a confidential client, and the device is not one.
- **`PROVIDER_REJECTED` carries the provider's own reason.** The product must be able to tell the user what the
  platform said — consent withdrawn, code already used, scope not granted — rather than reporting a generic
  failure. The reason is treated as untrusted text: it is displayed and never interpreted as an instruction,
  per the constitution's External Content Is Data section.
- **`PROVIDER_UNREACHABLE` and `SERVICE_UNAVAILABLE` are distinct.** The first means our service is working and
  the platform is not; the second means ours is not. They lead the user to different actions, and merging them
  would make an outage on either side indistinguishable from the other.
- **An authorisation obtained here is account-owned.** Where it then lives — the device's secure storage, and the
  account's replicated data encrypted at rest — is specified by `req-012-secure-storage` and
  `req-022-account-sync`. The broker's obligation ends with the response.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `PROVIDER_UNSUPPORTED` | No descriptor declares this provider, or it is withheld | Caller — stop; retrying cannot succeed | The platform is not offered in the catalogue, so a user should not reach this. If reached, the connector shows as unavailable |
| `BINDING_UNKNOWN` | The binding was never issued, or belongs to another session | Caller — start Connect again | The connector returns to disconnected with an invitation to try again |
| `BINDING_CONSUMED` | The binding was already used, successfully or not | Caller — start Connect again | As above. Replay is not distinguished from an honest double submission, because the recovery is the same |
| `BINDING_EXPIRED` | The user left the browser open past the exchange window | Caller — start Connect again | The connector states the attempt timed out and offers Connect again |
| `REDIRECT_MISMATCH` | The exchange named a different redirect address from the one bound | Caller — a defect in the calling surface | The connector returns to disconnected. No code is sent to the provider |
| `PROVIDER_REJECTED` | The platform refused the code or the refresh token | Both — backend reports; device presents the reason | The connector shows the platform's reason and offers reconnect, per the connector-state requirement |
| `PROVIDER_UNREACHABLE` | The platform could not be reached from the service | Caller — retry later | The connector states the platform could not be reached and offers retry. Distinct from our own outage |
| `TOKEN_MISSING`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | Session problems on an authenticated call | Caller — renew or sign in, per `backend/contracts/client-session-api@0.1.0` | None while renewal succeeds; otherwise the user is asked to sign in |
| `RATE_LIMITED` | Broker calls from this source exceeded the configured rate | Caller — wait `retryAfterSeconds` | The user is told the service is busy and when to retry |
| `SERVICE_UNAVAILABLE` | Our backend or its store is unreachable | Caller — retry later | Connect fails stating the service is unavailable; running jobs and existing connectors are unaffected |

## Compatibility

- **MAJOR** — removing an endpoint or a field of `ProviderTokens`, changing what the binding covers, making the
  binding reusable, moving the proof-key verifier onto the device, or changing a `providerId` already in use.
- **MINOR** — adding an optional request or response field, adding an endpoint, adding an error code an older
  caller can treat as a generic failure of the same class. **Adding a provider is neither**: it changes no part
  of this contract, which is the property the descriptor exists to preserve.
- **PATCH** — clarifying wording, correcting an example.
- **Legacy support** — an unrecognised error code is treated as a non-retryable failure and the connector returns
  to disconnected; it is never treated as success. Unrecognised fields in `ProviderTokens` are carried through to
  storage unread, since `providerExtras` is already opaque to the device's own logic.
- **Version discovery** — through `backend/contracts/public-service-endpoints@0.1.0`, which reports the minimum
  client version without requiring a session.

## Examples

**Valid** — completing a connect after the user authorised in the browser:

```json
{
  "providerId": "notion",
  "code": "c0d3-from-loopback",
  "redirectUri": "http://127.0.0.1:8765/callback",
  "binding": "bnd-7d41a9"
}
```

Response:

```json
{
  "providerId": "notion",
  "accessToken": "secret_provider_token",
  "tokenType": "Bearer",
  "scope": "",
  "providerExtras": { "workspace_name": "Personal", "workspace_id": "ws-22b0" }
}
```

The tokens reach the device and are stored in the operating system's secure store. Dumping the backend's store
immediately afterwards shows no trace of them.

**Rejected** — an exchange replaying a binding that was already used:

```json
{
  "providerId": "notion",
  "code": "c0d3-from-loopback",
  "redirectUri": "http://127.0.0.1:8765/callback",
  "binding": "bnd-7d41a9"
}
```

Rejected with `BINDING_CONSUMED`, and the provider is never contacted. The correct handling is to start Connect
again, not to reissue the binding: a binding that could be revived would make an authorisation code captured
from the browser's history or the operating system's URL handling worth replaying, which is the case the
single-use rule exists to close.

## Migration

Not applicable — initial version.

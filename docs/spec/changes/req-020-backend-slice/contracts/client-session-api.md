---
contract: client-session-api
version: 0.1.0
status: draft
owner: backend
consumers: [app, sync, connector, platform]
schema_files: [client-session-api.openapi.yaml, client-session-api.sql]
---

# Contract: Client Session API

## Purpose

This is how a device becomes a device of an account and stays one: sign-in, renewal, sign-out, and deletion of
the account. Every other authenticated surface the backend offers — the broker, the device registry, replication
— depends on a session issued here, so this contract is the root of the client/backend boundary rather than one
endpoint group among several.

`app` consumes it for the sign-in and account-deletion surfaces. `sync` consumes it because enrolment is a
consequence of sign-in and revocation withdraws sessions. `connector` and `platform` consume it indirectly:
their calls carry the access token this contract issues. The device registry itself is owned elsewhere, by
`sync/contracts/device-registry@0.1.0` — this contract issues the session; that one governs which devices may
hold one.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`client-session-api.openapi.yaml`](./client-session-api.openapi.yaml) | OpenAPI 3.1 | normative |
| [`client-session-api.sql`](./client-session-api.sql) | SQL DDL | normative |

The OpenAPI document carries the four endpoints, their payloads and the transport class each failure arrives
in; the error code, not the status, says which failure it is. Its paths are the ones
`spikes/SP-20-backend-slice` exercised, and its field names are this contract's payload types — the spike's
harness rendered the same fields in snake_case, which is a difference in the harness rather than in the
contract.

`client-session-api.sql` is the whole of the authentication and brokering store: the four relations, and
nothing else. It is the artifact a reviewer reads to establish what the service keeps, because a relation that
does not exist cannot be forgotten about. The broker adds no relation to it, which is INV-BE-03 made visible by
an absence.

## Schema / Surface

### 1. Interface & Data Types

The wire surface is [`client-session-api.openapi.yaml`](./client-session-api.openapi.yaml) and the store it
reads and writes is [`client-session-api.sql`](./client-session-api.sql). The declarations below name the same
payloads for a reader.

```typescript
type AccountId = string;
type DeviceId = string;          // supplied by the device; scopes an enrolment within one account

interface SignInRequest {
  idToken: string;               // identity token from the identity provider, verified server-side
  deviceId: DeviceId;
  deviceName?: string;           // display text only; never an identifier
}

interface SessionTokens {
  accessToken: string;           // short-lived; presented on every authenticated call
  refreshToken: string;          // long-lived; presented only to renew
  tokenType: "Bearer";
  expiresInSeconds: number;      // lifetime of accessToken
  account: { id: AccountId; email: string };
}

interface RefreshRequest { refreshToken: string; }

interface SignOutRequest { refreshToken: string; }

interface SignOutResult {
  sessionRevoked: true;
  otherSessionsRetained: number; // this account's sessions on other devices, untouched
}

interface DeleteAccountResult {
  accountDeleted: true;
  devicesRemoved: number;
  sessionsRevoked: number;
  providerWithdrawals: ProviderWithdrawal[];
}

interface ProviderWithdrawal {
  providerId: string;
  outcome: "withdrawn" | "failed" | "no-revocation-endpoint";
}

type SessionError =
  | { code: "IDENTITY_INVALID" }
  | { code: "EMAIL_NOT_IN_ALLOWLIST" }
  | { code: "TOKEN_MISSING" }
  | { code: "TOKEN_EXPIRED" }
  | { code: "TOKEN_INVALID" }
  | { code: "SESSION_REVOKED" }
  | { code: "DEVICE_REVOKED" }
  | { code: "ACCOUNT_DELETED" }
  | { code: "RATE_LIMITED"; retryAfterSeconds: number }
  | { code: "SERVICE_UNAVAILABLE" };
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `session.signIn` | Device → Backend | Request-Response | `SignInRequest` | `SessionTokens` | `IDENTITY_INVALID`, `EMAIL_NOT_IN_ALLOWLIST`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`. Unauthenticated by necessity; rate-limited at the edge before verification (INV-BE-09) |
| `session.refresh` | Device → Backend | Request-Response | `RefreshRequest` | `SessionTokens` | `TOKEN_EXPIRED`, `TOKEN_INVALID`, `SESSION_REVOKED`, `DEVICE_REVOKED`, `ACCOUNT_DELETED`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE` |
| `session.signOut` | Device → Backend | Request-Response | `SignOutRequest` | `SignOutResult` | `TOKEN_MISSING`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `SERVICE_UNAVAILABLE`. Requires a valid access token as well as the refresh token being revoked |
| `account.delete` | Device → Backend | Request-Response | — | `DeleteAccountResult` | `TOKEN_MISSING`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `SESSION_REVOKED`, `SERVICE_UNAVAILABLE`. Provider withdrawals are attempted before destruction and are reported per provider |

All four are request-response over encrypted transport. There is no server-initiated channel in this contract:
revocation reaches a device as a refusal on its next call, which is what makes enforcement independent of the
device being reachable.

### 3. Module Descriptor / Manifest Specification

Not applicable — this contract has no extension point. The identity provider is a `closed` variability point in
`model.md`, deliberately: principle VII makes account identity the sole gate on the user's entire history, so a
pluggable way to become an account would be a pluggable way to reach all of it.

## Semantics

- **Sign-in is verification then admission, in that order and never merged.** The identity token is verified
  against the identity provider; only then is the address checked against the invitation allowlist.
  `IDENTITY_INVALID` and `EMAIL_NOT_IN_ALLOWLIST` are distinct because they call for different actions from the
  user — sign in again, versus ask for an invitation — and conflating them would leave an invited user retrying
  a sign-in that was never going to work.
- **`deviceName` is display text and `deviceId` is the identifier.** The same rule holds on the presentation
  side in `sync/contracts/device-registry@0.1.0`. A label is never unique and never authenticates anything.
- **Signing in twice from one device produces one enrolment.** The account-and-device pair is unique in the
  store, so repeated sign-in is idempotent in enrolment terms while issuing a fresh session.
- **`TOKEN_EXPIRED` and `TOKEN_INVALID` are distinguished for the access token and merged for the refresh
  token.** A device that learns its access token has expired renews silently; a device that learns its refresh
  token has expired asks the user to sign in. But a refresh token that fails for any other reason — wrong
  signature, unknown session, already revoked — yields one indistinguishable response, because the difference is
  useful only to someone probing for a valid one.
- **`SESSION_REVOKED` and `DEVICE_REVOKED` are distinct outcomes with different consequences.** A revoked session
  means sign in again on this device. A revoked device means this device is no longer part of the account and
  must erase its copy, which is the behaviour `sync/contracts/device-registry@0.1.0` specifies.
- **The refresh token is stored only as an irreversible hash**, so the backend can verify a presented token and
  cannot produce one. Nothing in `SessionTokens` can be reconstructed from the store.
- **Sign-out revokes exactly one session.** `otherSessionsRetained` is returned so the device can tell the user
  plainly that their other machines remain signed in — a claim the product should not have to infer.
- **Account deletion withdraws before it destroys.** Provider revocation endpoints are called first, the outcome
  per provider is reported, and destruction proceeds regardless — a provider that refuses or offers no endpoint
  must not leave an account undeletable. `providerWithdrawals` is what the product reads to tell the user, by
  name, which platforms they must withdraw themselves. The full obligation is the account-deletion requirement
  in `docs/spec/capabilities/backend/spec.md`, added by `req-012-secure-storage`.
- **Deletion is not reversible and is not a status.** After it, every token for the account yields
  `ACCOUNT_DELETED`, including on devices that were offline at the time.
- **`SERVICE_UNAVAILABLE` is an expected outcome, not an exception.** It is the failure a device meets during a
  backend outage, and the spec bounds its consequences: running jobs, model calls and ledger writes continue on
  the device, and only new sign-in, new brokered authorisation, the version check and replication stop.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `IDENTITY_INVALID` | The identity token failed verification, or has expired | Caller — obtain a fresh identity token and retry once | The user is asked to sign in again. Nothing is said about whether an account exists for that address |
| `EMAIL_NOT_IN_ALLOWLIST` | Verified identity, but no invitation admits it | Caller — stop; retrying cannot succeed | The user is told access is limited to invited participants |
| `TOKEN_MISSING` | An authenticated call carried no access token | Caller — a defect in the calling surface | None. The device signs in or renews before calling |
| `TOKEN_EXPIRED` | The access or refresh token passed its expiry | Caller — renew on access-token expiry; sign in again on refresh-token expiry | None while renewal succeeds; otherwise the user is asked to sign in |
| `TOKEN_INVALID` | Signature does not verify, or the token is unrecognised | Caller — sign in again | The user is asked to sign in. The reason does not say which part of the token was wrong |
| `SESSION_REVOKED` | The session was revoked by sign-out on this device | Caller — sign in again | The user is asked to sign in |
| `DEVICE_REVOKED` | The device was revoked from the account, possibly while offline | Both — backend refuses; device erases its copy | The device states it no longer has access to the account and removes the account's data from itself |
| `ACCOUNT_DELETED` | The account was deleted, possibly while this device was offline | Both — backend refuses; device erases its copy | The device states the account no longer exists and erases the account's data |
| `RATE_LIMITED` | Calls from this source exceeded the configured rate | Caller — wait `retryAfterSeconds`, then retry | The user is told the service is busy and when it will accept another attempt. Never presented as a sign-in failure |
| `SERVICE_UNAVAILABLE` | The backend or its store is unreachable | Caller — retry later; continue working offline | The user is told the service is unavailable. Running work is unaffected |

## Compatibility

- **MAJOR** — removing an endpoint or a field of `SessionTokens`, changing what a token authorises, shortening a
  token lifetime in a way an older client cannot anticipate, or making `deviceId` optional.
- **MINOR** — adding an optional request or response field, adding an endpoint, adding an error code that an
  older caller can treat as a generic failure of the same class.
- **PATCH** — clarifying wording, correcting an example.
- **Legacy support** — an unrecognised error code is treated by a device as a non-retryable failure of the class
  the transport indicates, never as success. A device that receives a `SessionTokens` carrying fields it does not
  recognise uses the ones it does; the token values themselves are opaque to it, which is what allows their
  internal shape to change without a version bump.
- **Version discovery** — the version check in `backend/contracts/public-service-endpoints@0.1.0` reports the
  minimum client version the service accepts, and it answers without a session so that a client too old to sign
  in can still learn why.

## Examples

**Valid** — signing in on a second machine:

```json
{ "idToken": "eyJhbGciOi...", "deviceId": "dev-9f22", "deviceName": "Work laptop" }
```

Response:

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "ses-41c8.T0pS3cr3t...",
  "tokenType": "Bearer",
  "expiresInSeconds": 900,
  "account": { "id": "acc-3b71", "email": "beta.tester@example.com" }
}
```

The first machine's session is untouched, and both devices now appear in the account's registry.

**Rejected** — a verified identity that holds no invitation:

```json
{ "idToken": "eyJhbGciOi...", "deviceId": "dev-1004" }
```

Rejected with `EMAIL_NOT_IN_ALLOWLIST`, and no account, enrolment or session is created. The identity is
genuine, which is why this is a distinct outcome from `IDENTITY_INVALID`: the correct handling is to tell the
user that access is limited to invited participants, not to send them back through sign-in. Partial state is the
failure mode worth naming here — an account row created before the allowlist is consulted would admit, on the
next attempt, exactly the user this check exists to refuse.

## Migration

Not applicable — initial version.

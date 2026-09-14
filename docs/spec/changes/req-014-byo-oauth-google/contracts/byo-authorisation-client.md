---
contract: byo-authorisation-client
version: 0.1.0
status: draft
owner: connector
consumers: [connector, app, uix, platform, sync]
schema_files: [byo-authorisation-client.schema.json]
---

# Contract: Bring-Your-Own Authorisation Client

## Purpose

This contract is the whole of what the product knows about connecting a platform with an authorisation client the
user created themselves: what a supplied client must contain to be usable, how the device obtains an
authorisation with it, what the provider's answer is allowed to mean, and what each way of failing is called.

Whoever adds the second platform offering this route builds on it. They add an acceptance descriptor for their
provider and nothing else: the loopback flow, the binding rule, the granted-scope comparison, the renewal
observation and the error vocabulary are the same for every provider, and a connector that needed a different one
would be a change to this contract with its own measurement rather than a special case inside an adapter.

It is read by the connector runtime that performs the flow, by `app`, which renders its outcomes and its
refusals, and by `platform`, which holds what it produces. It is not read by `backend`: a user's own client never
travels to the product's servers, which is what makes this the one connect route that works while the backend
does not.

Everything below was measured against one provider on Windows
(`spikes/SP-13-byo-oauth-google/REPORT.md#0-ket-luan`). Where a rule rests on the provider's documentation rather
than on that measurement, it says so in place.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`byo-authorisation-client.schema.json`](./byo-authorisation-client.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of one provider's acceptance descriptor — the only part of this route that differs between
providers, and therefore the only part published as data. Everything else in this contract is the same for every
provider: the loopback flow, the binding rule, the granted-scope comparison, the renewal observation and the
error vocabulary, all of which live in this document and in no file.

What the file cannot express is whether the client kinds a rule admits can actually complete a loopback redirect
at that provider. A rule admitting a web client satisfies the file and would fail on the provider's page at every
connect, after the user has left the application; that is the example under *Examples* that the file accepts and
a reviewer must refuse, and it is the reason acceptance is reviewed by reading rather than only validated.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type ProviderId = string;                     // matches auth.provider_id in connector-manifest@1.1.0
type ConnectorId = string;

/** What the user hands over, after parsing and before acceptance. */
interface SuppliedClient {
  provider_id: ProviderId;
  client_kind: ClientKind;                    // as declared by the provider's own file
  client_id: string;
  client_secret?: string;                     // present for this provider's desktop clients; not confidential
  declared_redirect_uris: string[];           // what the provider's file says the client registers
  supplied_at: string;                        // ISO 8601, set by the device that read the file
}

/** The kinds a provider can issue. Only kinds an acceptance rule admits can complete the loopback route. */
type ClientKind = "installed" | "web" | "service_account" | "unknown";

/** One provider's rule for accepting a supplied client. Published as a descriptor; see section 3. */
interface ClientAcceptanceRule {
  provider_id: ProviderId;
  accepted_client_kinds: ClientKind[];
  required_fields: string[];
  loopback_host_forms: string[];              // the host forms the provider accepts for a loopback redirect
  requires_proof_key: boolean;
  refusals: ClientRefusal[];
}

interface ClientRefusal {
  code: ClientRefusalCode;
  remedy_step_id: string;                     // a step of byo-setup-guide@0.1.0 for this connector
}

type ClientRefusalCode =
  | "CLIENT_FILE_UNREADABLE"
  | "CLIENT_FIELD_MISSING"
  | "CLIENT_KIND_UNSUPPORTED"
  | "CLIENT_PROVIDER_MISMATCH";

/** The short-lived fact that this device is waiting for one particular redirect. Never persisted. */
interface LoopbackSession {
  connector_id: ConnectorId;
  port: number;                               // acquired when Connect starts, not configured
  redirect_uri: string;                       // built from the acquired port and an accepted host form
  binding_value: string;                      // issued per session; a redirect without it is discarded
  proof_key: ProofKey;
  requested_scopes: string[];
  expires_at: string;                         // ISO 8601; the moment the device stops listening
}

interface ProofKey {
  method: "S256";
  verifier: string;                           // held in memory only, for the duration of the session
  challenge: string;
}

type AuthorisationOutcome =
  | { result: "granted"; grant: AuthorisationGrant; comparison: GrantComparison }
  | { result: "refused"; code: AuthorisationErrorCode; provider_message?: string }
  | { result: "abandoned"; reason: "deadline_passed" | "user_closed_page" };

interface AuthorisationGrant {
  connector_id: ConnectorId;
  client_id: string;                          // the client the grant was issued under (INV-GG-05)
  granted_scopes: string[];                   // what the provider said, never what was asked
  access_expires_at: string;
  renewable: boolean;
  profile_requested: string;                  // the scope profile of connector-manifest@1.1.0 in force
  account_label?: string;                     // the account the provider says it was issued for
  granted_at: string;
}

interface GrantComparison {
  satisfied: boolean;
  unavailable_capabilities: string[];         // capabilities of the manifest whose scope was withheld
}

type RenewalOutcome =
  | { result: "renewed"; access_expires_at: string }
  | { result: "refused"; code: "RENEWAL_REFUSED"; provider_code?: string; provider_message?: string; observed_at: string }
  | { result: "indeterminate"; reason: "provider_unreachable"; observed_at: string };

type AuthorisationErrorCode =
  | "ACCOUNT_NOT_ADMITTED"
  | "CONSENT_DENIED"
  | "SCOPE_WITHHELD"
  | "REDIRECT_REJECTED"
  | "LOOPBACK_UNAVAILABLE"
  | "BINDING_MISMATCH"
  | "EXCHANGE_FAILED"
  | "PROVIDER_UNREACHABLE";

/** The operations this contract publishes. Implemented by the connector runtime, called by app. */
interface ByoAuthorisation {
  supplyClient(connectorId: ConnectorId, fileContents: string): Promise<SuppliedClient | ClientRefusal>;
  connect(connectorId: ConnectorId): Promise<AuthorisationOutcome>;
  reconnect(connectorId: ConnectorId): Promise<AuthorisationOutcome>;   // reuses the stored client
  renew(connectorId: ConnectorId): Promise<RenewalOutcome>;
  forget(connectorId: ConnectorId): Promise<void>;                      // client and grant together
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `connector:byo:supply-client` | Window process → connector runtime | Request-Response | `{ connector_id, file_contents }` — the file the user chose, read by the window and never retained by it | `SuppliedClient` without the secret, or `ClientRefusal` | `CLIENT_FILE_UNREADABLE`, `CLIENT_FIELD_MISSING`, `CLIENT_KIND_UNSUPPORTED`, `CLIENT_PROVIDER_MISMATCH` — all refusals carry the guide step that remedies them; nothing is stored on any of them |
| `connector:byo:connect` / `:reconnect` | Window process → connector runtime | Request-Response, long-running | `{ connector_id }` | `AuthorisationOutcome` | Every `AuthorisationErrorCode`; the window renders the outcome and never forms one |
| `connector:byo:state` | Connector runtime → window process | Pub-Sub | — | `{ connector_id, state, observed_at, reason? }` | The states of the model's lifecycle; a state is always accompanied by the instant it was observed (INV-GG-07) |
| Provider authorisation page | Connector runtime → system browser → provider | Redirect-based, user-mediated | Authorisation request carrying the user's `client_id`, the session's `redirect_uri`, `binding_value`, proof-key challenge and the profile's scopes | The provider's page, and then a redirect to the loopback address | `ACCOUNT_NOT_ADMITTED` and `CONSENT_DENIED` arrive as the provider's refusal on the redirect; `REDIRECT_REJECTED` arrives on the provider's own page before any redirect |
| Loopback listener | Provider's browser redirect → device | Request-Response, once | `?code=…&state=…` or `?error=…` on `http://<accepted host form>:<acquired port>/` | A page telling the user the application has what it needs | `BINDING_MISMATCH` — the request is discarded, nothing is exchanged, and the session keeps waiting until its deadline (INV-GG-04) |
| Provider token endpoint — exchange | Device → provider | Request-Response | The code, the proof-key verifier, the user's client identity, and the same `redirect_uri` | `AuthorisationGrant`, with `granted_scopes` as the provider stated them | `EXCHANGE_FAILED`, `PROVIDER_UNREACHABLE`; on either, nothing is stored and the connector returns to its previous state |
| Provider token endpoint — renewal | Device → provider | Request-Response | The stored renewal credential and the user's client identity | `RenewalOutcome` | `RENEWAL_REFUSED` moves the connector to expired with the provider's own words; an unreachable provider produces `indeterminate` and moves nothing (INV-GG-07) |
| Provider revocation endpoint | Device → provider | Request-Response | The stored credential, as declared in the manifest's `revocation` | Acknowledgement | A failed revocation does not stop the local erasure; it is reported, because the user asked for the connector to be gone |

The device is one party in every provider exchange above. No exchange on this route passes through
`backend/contracts/authorisation-broker-api@0.1.0`, and a runtime that attempted it would be sending the user's
own client credentials to the product's servers, which INV-GG-01 forbids.

### 3. Module Descriptor / Manifest Specification

One acceptance descriptor per provider offering this route, shipped beside that connector's manifest.

One acceptance descriptor per provider offering this route, shipped beside that connector's manifest. The
normative shape is [`byo-authorisation-client.schema.json`](./byo-authorisation-client.schema.json), and it is
not restated here.

The file expresses what a descriptor must contain to be usable at all: the provider it accepts clients for, at
least one admitted client kind, the fields a supplied file must carry, the loopback host forms the provider
accepts, whether the exchange must carry a proof of possession, and a remedy step for every refusal code. What it
cannot express is whether the kinds a rule admits can in fact complete a loopback redirect at that provider —
the rule below under *Examples* satisfies the file and is still wrong — which is why a rule is reviewed by
reading and why it is published as data.

## Semantics

**Acceptance happens before the browser opens.** A supplied client is parsed, checked against the rule for its
provider, and either stored whole or refused with a code and the guide step that remedies it. Nothing partial is
ever stored (INV-GG-02). The reason this is a rule rather than a convenience is that every failure deferred past
this point happens on the provider's page, after the user has left the application, where the product can neither
explain it nor correct it — the measured shape of that failure is the provider refusing an unregistered redirect
address outright (`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q2).

**The port is acquired, not configured.** The device takes a free loopback port when Connect starts and builds
the redirect address from it. A client of an accepted kind registers no port, and the provider accepts any —
measured across three unrelated ports, both loopback host forms, and the address with no port at all, while an
address outside what the client registers was refused (Q2, `evidence/q2_dynamic_ports.log`). This is why
`loopback_host_forms` is a declaration and a port list is not: the port is the part that must never be pinned,
because a pinned port is the one thing another process on the user's machine can take away.

**The binding value is what makes a redirect this device's own.** Any process on the machine can reach the
listener. A request whose binding value is not the one this session issued is discarded, no exchange is
attempted, and the session keeps waiting; it is not an error shown to the user, because the user did nothing.

**Granted scope is read, never inferred.** The provider's consent screen presents each requested scope
individually, so a user may grant some and withhold others — VERIFIED (Q5, `evidence/ui_scope_consent.svg`). The
grant therefore records what the provider said it granted, and the comparison against the profile decides whether
the connector is connected or short of permission. A capability whose scope was withheld yields no tool.

**A renewal refusal is an observation, not a verdict about the user.** It carries the instant and the provider's
own code and message. An unreachable provider yields `indeterminate` and changes nothing, because a network
failure is not evidence that an authorisation ended. The product's expectation of when an authorisation will stop
working — seven days while the user's client is unverified at this provider, VERIFIED as standard behaviour in
`spikes/SP-13-byo-oauth-google/REPORT.md#4-rui-ro-moi-phat-hien` — is used to warn and to explain, never to
expire an authorisation the provider still accepts (INV-GG-08).

**The client and its grant are one thing.** Replacing the client discards the grant; erasing the connector erases
both; and `forget` is defined over the pair because there is no state in which one is useful without the other
(INV-GG-05).

**What is stored, and where.** The supplied client and the grant are written through
`platform/contracts/secure-storage@0.1.0` under the connector's keys, and replicate with the account under
`sync/contracts/replicated-store-descriptor@0.1.0`. The file the user chose is not copied, not moved and not
retained. The session — port, binding value, proof key — is memory on one device and is never written down
(INV-GG-03).

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `CLIENT_FILE_UNREADABLE` | The supplied file cannot be parsed as the provider's client file | Callee, before the browser opens | The step says the file could not be read and names the guide step that downloads a correct one; nothing is stored |
| `CLIENT_FIELD_MISSING` | A field the rule requires is absent | Callee, before the browser opens | The missing field is named together with the console step that produces it |
| `CLIENT_KIND_UNSUPPORTED` | The client is of a kind that cannot complete the loopback route | Callee, before the browser opens | The user is told the route needs a client of the accepted kind and is returned to the step that creates one |
| `CLIENT_PROVIDER_MISMATCH` | The file belongs to a different provider than the connector | Callee, before the browser opens | The connector states which provider's client it expects |
| `LOOPBACK_UNAVAILABLE` | No loopback port could be acquired | Callee, before the browser opens | Connect fails stating the authorisation cannot be completed on this device; no browser is opened and no partial state remains |
| `REDIRECT_REJECTED` | The provider refused the redirect address the device supplied | Both — the device reports what the provider said | The connector states that the provider refused the address and names the guide step that creates a client accepting it; this is the failure acceptance exists to prevent, so meeting it is a defect in the acceptance rule |
| `BINDING_MISMATCH` | A request arrived on the listener without this session's binding value | Callee | Nothing. The request is discarded, the session keeps waiting, and no state changes |
| `ACCOUNT_NOT_ADMITTED` | The provider refused because the signing-in account is not admitted by the user's own client | Both | The connector explains that the client admits only the accounts listed on it and names the guide step where accounts are listed |
| `CONSENT_DENIED` | The user refused consent, or granted nothing | Callee | The connector returns to its previous state with the provider's reason; nothing is stored |
| `SCOPE_WITHHELD` | The consent granted less than the profile requested | Callee | The connector is shown as short of permission, naming the unavailable capabilities, with re-consent offered; the tools of those capabilities are absent |
| `EXCHANGE_FAILED` | The provider refused the exchange of the code | Both | Connect fails with the provider's own words; nothing is stored and the stored client is untouched |
| `PROVIDER_UNREACHABLE` | The provider could not be reached during an exchange or a renewal | Both | Connect fails, or a renewal is indeterminate; in neither case is the connector moved to expired |
| `RENEWAL_REFUSED` | The provider declined to renew | Callee | The connector shows as expired with a reconnect action, in the words the guide declared, and the stored client is kept |

## Compatibility

**MAJOR** — removing an acceptance field or an error code; changing what an error code means; changing the
redirect strategy away from a loopback address on an acquired port; making the exchange pass through a server;
narrowing `accepted_client_kinds` for an existing provider. Each of these changes either what the user was
promised at setup or what an already-stored client can still do.

**MINOR** — adding a provider's acceptance descriptor; adding an accepted client kind; adding a loopback host
form; adding an error code a build that does not know it can safely present as a general failure; adding an
optional field to any of the types above.

**PATCH** — wording of refusals and of user-visible messages; the remedy step an existing refusal points at.

**Support window.** Every acceptance descriptor ships inside the build that reads it, so there is no mixed-version
window to support. A stored client outlives builds, which is why removing an accepted kind is MAJOR: a client
accepted last month must either keep working or be refused with an explanation, never fail in the browser.

## Examples

**Accepted** — the acceptance rule for the measured provider:

```json
{
  "provider_id": "google",
  "accepted_client_kinds": ["installed"],
  "required_fields": ["client_id", "client_secret", "redirect_uris"],
  "loopback_host_forms": ["localhost", "127.0.0.1"],
  "requires_proof_key": true,
  "refusals": [
    { "code": "CLIENT_FILE_UNREADABLE", "remedy_step_id": "download-credentials" },
    { "code": "CLIENT_FIELD_MISSING", "remedy_step_id": "download-credentials" },
    { "code": "CLIENT_KIND_UNSUPPORTED", "remedy_step_id": "create-desktop-client" },
    { "code": "CLIENT_PROVIDER_MISMATCH", "remedy_step_id": "create-project" }
  ]
}
```

**Rejected** — a rule that admits a web client for the loopback route and asks for no proof of possession:

```json
{
  "provider_id": "google",
  "accepted_client_kinds": ["web"],
  "required_fields": ["client_id"],
  "loopback_host_forms": ["localhost"],
  "requires_proof_key": false,
  "refusals": [
    { "code": "CLIENT_KIND_UNSUPPORTED", "remedy_step_id": "create-desktop-client" }
  ]
}
```

It satisfies the schema and is still wrong, which is why it is here rather than in a validation table. A client of
the web kind registers its redirect addresses exhaustively, so every connect would fail on the provider's page
with a rejected redirect — measured as the one refusal the provider returns for an address a client does not
register (`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q2) — and the failure would land after
the user had left the application. Dropping the proof of possession compounds it: the redirect arrives on a port
any process on the machine could have been listening on, and the binding value alone does not prove the exchange
is made by the party that began it. A rule is reviewed by reading, which is the reason it is data.

## Migration

Not applicable — first version. `connector/contracts/connector-manifest@1.1.0` is read unchanged: the route's
availability and its lifetime caveat are the `auth.byo_client` fields it already carries, and the scope profile
for this channel is one of the profiles it already expresses.

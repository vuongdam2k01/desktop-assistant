---
contract: authorisation-provider-descriptor
version: 0.1.0
status: draft
owner: backend
consumers: [backend, connector, app]
schema_files: [authorisation-provider-descriptor.schema.json]
---

# Contract: Authorisation Provider Descriptor

## Purpose

This descriptor is the whole of what must be written to make the Nth platform brokerable. It exists because
principle VI requires that adding a platform be a declaration rather than a code change, and because that claim
is otherwise untestable: with the descriptor as the single place provider behaviour may be expressed, "adding a
provider changed nothing else" is a diff anyone can run. Declaring a second provider alongside the first cost 19
lines in the descriptor registry and zero lines in the broker, the routes and the client-facing interface —
VERIFIED, `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3).

`backend` reads it. `connector` is its author in practice: the scopes a platform needs come from the connector's
manifest, and the descriptor is where the server-side half of that platform is declared. `app` consumes only the
display name and the offered set, so the catalogue lists what is actually brokerable rather than a list
maintained separately.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`authorisation-provider-descriptor.schema.json`](./authorisation-provider-descriptor.schema.json) | JSON Schema draft-07 | normative |

The schema file is the normative descriptor shape. The descriptor is configuration the service reads at
start-up, not a wire surface: no client sends it, no client receives it, and the HTTP surfaces that act on it
are frozen in [`authorisation-broker-api.openapi.yaml`](./authorisation-broker-api.openapi.yaml) under their own
contract.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type ProviderId = string;        // lowercase, stable for the life of the provider; appears in endpoint paths
type SecretName = string;        // a name resolved in the secret manager — never a value (INV-BE-05)

interface ProviderDescriptor {
  providerId: ProviderId;
  version: string;               // semver of this descriptor
  name: string;                  // display name, e.g. "Notion"
  authorizeEndpoint: string;     // absolute https URL
  tokenEndpoint: string;         // absolute https URL
  clientIdRef: SecretName;
  clientSecretRef: SecretName;
  tokenAuthMethod: TokenAuthMethod;
  usesProofKey: boolean;
  defaultScopes: string[];       // may be empty for providers that scope at their own consent screen
  extraAuthorizeParams?: Record<string, string>;
  revokeEndpoint?: string;       // absent = the provider offers no revocation endpoint
  status?: "offered" | "withheld"; // absent = "offered"
}

type TokenAuthMethod =
  | "credentials-in-body"        // client id and secret in the token request body
  | "credentials-in-header";     // client id and secret in the token request authorization header

type DescriptorError =
  | { code: "DESCRIPTOR_INVALID"; providerId: ProviderId; field: string }
  | { code: "DESCRIPTOR_DUPLICATE"; providerId: ProviderId }
  | { code: "SECRET_UNRESOLVED"; providerId: ProviderId; secretName: SecretName }
  | { code: "ENDPOINT_NOT_HTTPS"; providerId: ProviderId; field: string };
```

### 2. Wire / Communication Protocol

Not applicable as a channel of its own. The descriptor is deployment-time configuration read by the broker at
startup; it never crosses a process boundary at request time. What it configures crosses one, and that surface
is `backend/contracts/authorisation-broker-api@0.1.0`.

### 3. Module Descriptor / Manifest Specification

See companion schema: [authorisation-provider-descriptor.schema.json](./authorisation-provider-descriptor.schema.json)

## Semantics

- **`providerId` is part of the client-facing surface.** It appears in the broker's endpoint paths, so renaming
  one is a breaking change for every device that holds an authorisation obtained under the old name, not a
  cosmetic edit.
- **`clientIdRef` and `clientSecretRef` are names, never values.** INV-BE-05 keeps credential values out of every
  entity that can be dumped, backed up or logged. A descriptor carrying a literal secret is rejected as
  malformed rather than accepted with a warning: accepting it would put the secret into whatever artifact the
  descriptor set is stored in, which is precisely what the secret scan exists to catch.
- **`additionalProperties` is false deliberately.** An unrecognised field in a descriptor is far more likely to
  be a misspelt required field — silently leaving the provider on a default — than a deliberate extension. The
  cost of rejecting is a startup error; the cost of ignoring is a provider that behaves subtly wrong for every
  user.
- **`tokenAuthMethod` and `usesProofKey` are the two axes real providers actually differ on**, and both values of
  each were exercised against live providers in the spike. They are declared rather than detected: detection
  would mean the broker attempting one method, failing, and retrying, which turns a configuration error into an
  intermittent runtime failure and sends a live authorisation code to a failed exchange.
- **`extraAuthorizeParams` is where provider idiosyncrasy is absorbed** — consent forcing, offline access,
  response type, ownership hints. It is a flat map of literal values appended to the authorisation URL. It is
  deliberately not a template or an expression: anything requiring computation is broker behaviour, and broker
  behaviour that varies by provider is what INV-BE-04 forbids.
- **`defaultScopes` may be empty.** Some platforms scope at their own consent screen rather than by request
  parameter, so an empty list is a real configuration and not a missing one. When the caller names scopes, those
  are used; `defaultScopes` applies only when it names none.
- **An absent `revokeEndpoint` is information, not an omission.** The account-deletion requirement in
  `docs/spec/capabilities/backend/spec.md` obliges the product to tell the user, by name, which platform they
  must withdraw an authorisation in themselves; this field is how the product knows which platform that is.
  RISK-058 records that at least one platform in scope offers none.
- **`status: "withheld"` configures a provider without offering it.** It exists so that a platform can be
  configured and its secrets resolved ahead of being listed in the catalogue. A withheld provider is refused at
  the broker exactly as an unconfigured one is; withholding is not a soft state in which authorisation quietly
  still works.
- **The registry is read at startup and is the authority.** A descriptor added while the service runs is not
  brokerable until the registry is read again. This makes the brokerable set a deployment decision, which is
  what allows the resolvability of every named secret to be checked once, at startup, rather than at a user's
  first exchange.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `DESCRIPTOR_INVALID` | A required field is absent, a field fails its pattern, or an unrecognised field is present | Callee — refuse to serve that provider and report the field at startup | The platform does not appear in the catalogue. No user reaches an exchange that would fail |
| `DESCRIPTOR_DUPLICATE` | Two descriptors claim the same `providerId` | Callee — refuse to start rather than choose one | None; the deployment does not proceed. Choosing silently could route authorisations to the wrong platform |
| `SECRET_UNRESOLVED` | `clientIdRef` or `clientSecretRef` names nothing the secret manager resolves | Callee — refuse to serve that provider and name the missing secret | The platform does not appear in the catalogue, matching the spec scenario for a secret absent at startup |
| `ENDPOINT_NOT_HTTPS` | An endpoint is not an encrypted absolute URL | Callee — refuse to serve that provider | The platform does not appear in the catalogue. An authorisation code must never be sent over an unencrypted channel |

## Compatibility

- **MAJOR** — removing a field, renaming a `providerId`, adding a required field, adding a `tokenAuthMethod`
  value an older broker would not recognise, or changing what `usesProofKey` means.
- **MINOR** — adding an optional field, adding a `status` value an older broker safely treats as not offered,
  adding an error code a caller can treat as a generic startup failure.
- **PATCH** — clarifying wording, correcting an example, tightening a pattern that no valid descriptor
  previously violated.
- **Legacy support** — a descriptor declaring a `version` with a MAJOR number above the broker's own is refused
  rather than partially read, and the refusal names the version. An unrecognised `status` value is treated as
  withheld, never as offered: a broker that guesses must guess towards not brokering.
- **Version discovery** — the broker compares each descriptor's `version` against its own supported range at
  startup, which is the same moment the secrets are resolved, so a version mismatch and a missing secret are the
  same class of failure and are reported together.

## Examples

**Valid** — a provider whose credentials go in the request header and which requires no proof-key exchange:

```json
{
  "providerId": "notion",
  "version": "0.1.0",
  "name": "Notion",
  "authorizeEndpoint": "https://api.notion.com/v1/oauth/authorize",
  "tokenEndpoint": "https://api.notion.com/v1/oauth/token",
  "clientIdRef": "notion.client_id",
  "clientSecretRef": "notion.client_secret",
  "tokenAuthMethod": "credentials-in-header",
  "usesProofKey": false,
  "defaultScopes": [],
  "extraAuthorizeParams": { "owner": "user", "response_type": "code" }
}
```

Adding this alongside an existing provider that uses `credentials-in-body`, requires the proof-key exchange and
names its scopes is the whole change: the broker, the endpoint paths and the interface description are
untouched.

**Rejected** — a descriptor carrying a literal secret:

```json
{
  "providerId": "notion",
  "version": "0.1.0",
  "name": "Notion",
  "authorizeEndpoint": "https://api.notion.com/v1/oauth/authorize",
  "tokenEndpoint": "https://api.notion.com/v1/oauth/token",
  "clientIdRef": "notion.client_id",
  "clientSecret": "secret_AbC123...",
  "tokenAuthMethod": "credentials-in-header",
  "usesProofKey": false,
  "defaultScopes": []
}
```

Rejected with `DESCRIPTOR_INVALID` on two counts: `clientSecretRef` is absent, and `clientSecret` is an
unrecognised field. The correct handling is to place the value in the secret manager and name it, not to relax
`additionalProperties`. A descriptor set is exactly the kind of artifact that ends up in a repository, a
configuration dump or a deployment log, which is why the shape refuses to hold the value at all.

## Migration

Not applicable — initial version.

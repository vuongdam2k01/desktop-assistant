---
contract: provider-profile
version: 0.1.0
status: draft
owner: agent
consumers: [agent, platform, app, uix, sync]
schema_files: [provider-profile.schema.json]
---

# Contract: Provider Profile

## Purpose

The product does not sell model capacity and does not run a gateway; the user brings their own provider and pays
for it directly. A provider profile is what the user creates to say where model requests go, which credential
opens that door, and which models are on the other side of it. It is the one descriptor a user writes by hand,
and it is what the role-to-model mapping refers to.

This contract exists in this change for a specific reason. The product definition described provider
configuration in terms of an interactive sign-in belonging to the engine's command-line tool, and the embedded
path has no such thing — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q5). What the embedded path does have is a
credential per provider and a descriptor for any service speaking the widely implemented completion dialect, both
exercised end to end against a third-party service for a strong model, a cheap model and a vision model. This
contract is that reality written down, so that no later artifact reintroduces a sign-in that cannot exist.

What it does not cover: which role uses which model, what a job costs, and how provider failures are presented in
aggregate. Those belong to `req-017-provider-matrix`, which consumes this contract.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`provider-profile.schema.json`](./provider-profile.schema.json) | JSON Schema draft-07 | normative |

The file is the shape of a profile, and it is what the settings surface validates against before it saves — so
`DIALECT_UNSUPPORTED`, `ADDRESS_INVALID` and a credential field carrying a secret rather than a key are all
refusals the file itself makes, at the moment the person who can fix them is looking at the form.

What it cannot express is the part that makes a profile usable rather than merely well-formed, and that is stated
here instead: that the credential the key names is actually present in this device's secure storage, that the
service at the address answers, and that the models it lists exist there. Those are answered by a probe, which
reports what it observed rather than editing the declaration the user wrote.

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { CredentialRef } from "secure-storage@0.1.0";

type ProfileId = string;

/** A completion dialect the embedded engine implements. A profile naming anything else is refused when saved. */
type ProtocolDialect = "openai-completions" | "anthropic-messages" | "google-generative";

interface ModelOffer {
  name: string;                       // the model identifier the service expects
  label: string;                      // what the user sees
  capabilities: ModelCapability[];
  minimumImagePixels?: number;        // a floor higher than the product's 14 px, where a service demands one
}

type ModelCapability = "text" | "images" | "reasoning" | "tools";

interface EndpointDescriptor {
  address: string;                    // absolute https address of the service
  dialect: ProtocolDialect;
  headers?: Record<string, string>;   // values that are credentials are stored by reference, never inline
}

interface ProviderProfile {
  profileVersion: string;             // the version of THIS contract the profile is written against
  id: ProfileId;
  displayName: string;
  endpoint: EndpointDescriptor;
  credential: CredentialRef;          // a key in operating-system secure storage (INV-AG-08)
  models: ModelOffer[];
  builtIn: boolean;                   // true for the shipped starting points; they are ordinary profiles
}

/** How the rest of the product uses a profile. Resolution happens at the moment of the request. */
interface ProviderRegistry {
  list(): Promise<ProviderProfile[]>;                       // credentials are never included
  upsert(profile: ProviderProfile): Promise<ProfileId>;
  remove(id: ProfileId): Promise<void>;
  resolve(id: ProfileId, model: string): Promise<ResolvedEndpoint>;   // in-process only
  probe(id: ProfileId, model: string): Promise<ProbeOutcome>;         // a cheap request, to tell the user it works
}

/** Held for the length of one request and never logged, stored or placed in a transcript. */
interface ResolvedEndpoint {
  address: string;
  dialect: ProtocolDialect;
  headers: Record<string, string>;
  secret: string;
  model: string;
  capabilities: ModelCapability[];
}

type ProbeOutcome =
  | { ok: true; latencyMs: number; capabilitiesObserved: ModelCapability[] }
  | { ok: false; error: ProfileErrorCode; detail: string };

type ProfileErrorCode =
  | "DIALECT_UNSUPPORTED"
  | "ADDRESS_INVALID"          // not absolute, or not https
  | "CREDENTIAL_MISSING"
  | "CREDENTIAL_REJECTED"
  | "MODEL_NOT_OFFERED"
  | "MODEL_LACKS_CAPABILITY"
  | "ENDPOINT_UNREACHABLE"
  | "PROFILE_IN_USE"           // removal refused while a role still routes to it
  | "PROFILE_VERSION_AHEAD";   // written by a newer build than this one
```

### 2. Wire / Communication Protocol

Profiles are edited in a window and used in the main process. The asymmetry below is the point: a window may
write a profile and ask for it to be probed, and it can never obtain a credential or an address already resolved.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `provider/list` | Window → Main | Request-Response | `{}` | `ProviderProfile[]`, credentials replaced by a present/absent flag | None |
| `provider/upsert` | Window → Main | Request-Response | `{ profile, secret? }` | `{ id }` | `DIALECT_UNSUPPORTED`, `ADDRESS_INVALID`, `PROFILE_VERSION_AHEAD` |
| `provider/remove` | Window → Main | Request-Response | `{ id }` | `{ removed: true }` | `PROFILE_IN_USE` |
| `provider/probe` | Window → Main | Request-Response | `{ id, model }` | `ProbeOutcome` | `CREDENTIAL_MISSING`, `CREDENTIAL_REJECTED`, `MODEL_NOT_OFFERED`, `ENDPOINT_UNREACHABLE` |
| `provider/state` | Main → Window | Pub-Sub | — | `{ id, credentialPresent: boolean, lastError?: ProfileErrorCode }` | None; drives the settings badge and the SYSTEM card |
| *(resolve)* | — | — | — | — | Not exposed. Resolution happens beside the request it serves |

**Channels that deliberately do not exist.** No channel returns a credential or a `ResolvedEndpoint`; no channel
sends a model request on a window's behalf; no channel reads a credential written by another profile.

### 3. Module Descriptor / Manifest Specification

A profile is the descriptor, and its schema is
[`provider-profile.schema.json`](./provider-profile.schema.json) — the normative shape, held beside this document
rather than transcribed into it so that the settings form and this contract cannot drift apart.

**Discovery.** Profiles are user-created and stored with the product's configuration. They replicate with the
account; their credentials do not, because credentials live in operating-system secure storage under
`platform/contracts/secure-storage@0.1.0` and the constitution's principle VII promise is about the user's data,
not about their provider's secrets. A second device therefore shows the profile with its credential absent and
asks for it once.

**Shipped starting points.** A set of well-known providers ships with the product with the address, dialect and
model list pre-filled and `builtIn` true. They are ordinary profiles: the user may edit, duplicate or delete
them, and nothing in the product treats them as more trustworthy than one the user typed.

**Fallback when there is no profile.** No profile configured is the first-run condition, not a failure to
recover from: the product says a provider must be configured, offers the settings, and creates no job. A profile
whose credential is absent behaves the same way for the roles routed to it, naming the profile. A profile naming
an unsupported dialect is refused when it is saved, so the failure reaches the person who can fix it at the
moment they can fix it.

## Semantics

**A credential is referenced, never carried.** The profile holds a key into secure storage. `resolve` fetches the
secret beside the request that uses it, and the resolved value is held for that request only: never logged, never
written to a transcript, never returned across a channel (INV-AG-08). `platform/contracts/secure-storage@0.1.0`
governs the key's namespacing and what happens when it cannot be decrypted.

**The address is used for one thing.** It is the destination of model requests and nothing else: it never
resolves a tool, never fetches code, and never receives connector data that is not part of the job's own request.
A mistyped address therefore exposes the credential the user configured for that profile and nothing beyond it,
which is the smallest blast radius available for a field the user must be free to type.

**Capabilities are declared and then checked.** A command carrying images that routes to a model whose offer does
not declare `images` is refused before the job starts, with the mapping named. This is cheaper and clearer than
discovering it as a provider rejection mid-run, and it is the reason `ModelOffer` carries capabilities at all.

**The image floor composes.** The product refuses images below 14 pixels at the composer. A profile may declare a
higher floor for a specific model; the effective floor is the larger of the two, and it is applied where the
image is attached rather than where the request is sent, so the user is told by the composer rather than by a
failed job.

**Probing is honest.** `probe` sends a real, minimal request. It reports what it observed rather than what the
profile claims, and a profile whose declared capabilities exceed what the probe observed is shown as such instead
of being silently corrected — the declaration is the user's, and the product does not edit it behind them.

**Removal is refused while a role points at it.** Deleting a profile that a role still routes to would make the
next job fail for a reason the user would have to reconstruct. `PROFILE_IN_USE` names the roles instead.

## Error Matrix

| Code | Cause | Handled by | What the user sees |
| --- | --- | --- | --- |
| `DIALECT_UNSUPPORTED` | The profile names a completion dialect the engine does not implement | Main, at save | The settings form refuses the save and lists the dialects that work |
| `ADDRESS_INVALID` | The address is not absolute, or is not https | Main, at save | The settings form refuses the save and says why |
| `CREDENTIAL_MISSING` | No credential is stored for this profile on this device | Main, at use or probe | A SYSTEM card naming the profile and asking for its credential once |
| `CREDENTIAL_REJECTED` | The provider refused the credential | Session; the run fails | An ERROR card carrying the provider's reason, and a link to provider settings |
| `MODEL_NOT_OFFERED` | The role mapping names a model this profile does not list | Job manager; no job starts | A SYSTEM card pointing at the role-to-model mapping |
| `MODEL_LACKS_CAPABILITY` | Images were attached to a command routed to a text-only model | Job manager; no job starts | A SYSTEM card stating the chosen model cannot read images |
| `ENDPOINT_UNREACHABLE` | The address did not answer | Session; the job's retry policy decides | The job's ordinary retry or failure presentation |
| `PROFILE_IN_USE` | A removal was attempted while a role still routes to the profile | Main; removal refused | The settings surface names the roles that must be repointed first |
| `PROFILE_VERSION_AHEAD` | The profile replicated from a device running a newer build | Main; the profile is not used | A SYSTEM card asking for the update, and the roles using it do not start jobs |

## Compatibility

**MAJOR** — removing a dialect; changing what a dialect means; moving a credential into the profile record;
adding any channel that returns a resolved endpoint or a secret; making `models` optional; changing the
credential key's shape.

**MINOR** — adding a dialect; adding a `ModelCapability`; adding an optional member such as a per-model floor;
adding a shipped starting point; adding a read-only channel.

**PATCH** — wording, labels and examples.

**Support window.** Profiles replicate between devices that update at different times, so this contract has a
real mixed-version window and resolves it in one direction only: a newer build reads an older profile unchanged,
and an older build meeting a newer `profileVersion` refuses to use that profile and says so rather than reading
around the parts it does not recognise. Reading around an unrecognised member is how a build would silently send
a request somewhere the user did not intend.

## Examples

**Valid** — a custom endpoint, of the kind the spike exercised end to end:

```json
{
  "profileVersion": "0.1.0",
  "id": "ark-shared",
  "displayName": "Team endpoint",
  "endpoint": { "address": "https://ark.example.com/api/v3", "dialect": "openai-completions" },
  "credential": "provider:ark-shared:default:api-key",
  "models": [
    { "name": "strong-reasoner", "label": "Strong", "capabilities": ["text", "reasoning", "tools"] },
    { "name": "cheap-fast", "label": "Fast", "capabilities": ["text", "tools"] },
    { "name": "vision-pro", "label": "Vision", "capabilities": ["text", "images", "tools"], "minimumImagePixels": 14 }
  ],
  "builtIn": false
}
```

**Rejected** — a profile carrying its secret and reaching a plain address:

```json
{
  "profileVersion": "0.1.0",
  "id": "ark-shared",
  "displayName": "Team endpoint",
  "endpoint": { "address": "http://ark.example.com/api/v3", "dialect": "openai-completions" },
  "credential": "sk-live-9f2c0a44",
  "models": [{ "name": "strong-reasoner", "label": "Strong", "capabilities": ["text"] }],
  "builtIn": false
}
```

Rejected on both counts. The address is not https, so `ADDRESS_INVALID` refuses it at save. The credential field
carries a secret rather than a key into secure storage, which the pattern refuses — and that refusal matters more
than it looks, because a profile replicates to the account, so a secret written here would be a secret the user
never chose to replicate.

## Migration

Not applicable at `0.1.0`: no profile exists in the field. When a dialect is removed at a future MAJOR, profiles
naming it are presented to the user for re-pointing rather than deleted, because a profile carries the user's own
address and model list — material the product cannot regenerate — and because deleting it would also orphan a
credential in secure storage that nothing would then clean up.

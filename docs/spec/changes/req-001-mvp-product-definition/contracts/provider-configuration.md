---
contract: provider-configuration
version: 0.1.0
status: draft
owner: agent
consumers: [app, uix, pet, undo, approval, platform]
schema_files: [provider-configuration.schema.json]
---

# Contract: Model Provider Configuration and Role Assignment

## Purpose

The user brings their own model provider and pays their own bill, so the product cannot assume what a model can
do. This contract is how a provider is described, how a credential is referenced without being copied, and how
each role — the pet, the worker, rule elicitation, undo, the risk judge — is bound to a model. The application
window builds the configuration interface on it, the composer reads it to decide whether images may be attached,
and every agent reads it to learn which model it runs under.

It is drafted here at the product baseline; `req-017-provider-matrix` measures the default assignment and the
cost that follows from it.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`provider-configuration.schema.json`](./provider-configuration.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of the stored configuration, and the member it does not have is as load-bearing as the
ones it does: nowhere in it can a credential value appear, which is what lets the document be displayed,
exported for inspection and replicated to the account. What the file cannot express is stated here instead.
That every role resolves is a relation between the assignments and the providers rather than a property of
either. That a credential reference still resolves to something in the device's secure storage is a fact about
the device, not about the document. And a configuration that satisfies the file may still name a model the
provider no longer offers, which is why validation asks the provider rather than reading the file again.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type ProviderConfig = {
  id: string;
  kind: 'subscription' | 'api_key' | 'custom';
  displayName: string;
  credentialRef: SecureStoreRef;        // never the secret itself
  baseUrl?: string;                     // custom providers only
  models: ModelDescriptor[];
};

type SecureStoreRef = { namespace: string; key: string };

type ModelDescriptor = {
  id: string;
  inputs: ('text' | 'image')[];         // declared capability, read before a call is attempted
  contextTokens?: number;
  costPerMillionInput?: number;         // for display only; never a gate
  costPerMillionOutput?: number;
};

type Role = 'pet' | 'worker' | 'rule_elicitation' | 'undo' | 'risk_judge';

type RoleAssignment = {
  role: Role;
  providerId: string;
  modelId: string;
  source: 'default' | 'user';
};

interface ProviderRegistry {
  resolve(role: Role): { provider: ProviderConfig; model: ModelDescriptor };
  supports(role: Role, input: 'text' | 'image'): boolean;
  validate(providerId: string): Promise<ProviderValidation>;
}

type ProviderValidation =
  | { ok: true; models: ModelDescriptor[] }
  | { ok: false; error: ProviderErrorCode; message: string };
```

## Semantics

`credentialRef` is a reference into the operating system's secure storage, never the secret. Nothing in this
contract carries a credential value, which is what lets the configuration be displayed, exported for inspection
and replicated to the account without carrying the secret with it.

`inputs` is the declared capability the product checks before it attempts a call. The composer disables image
attachment when the model assigned to the role that would receive the image declares no image input, because
sending an image to a model that cannot accept it is a failure the user cannot see.

Every role must resolve. A role with no assignment falls back to the recommended default for the configured
provider; if no default applies, the product states that configuration is required and does not create a job
that would fail on its first call.

`source` distinguishes a recommended default from the user's own choice, so that a later release may change the
recommendation without overwriting a deliberate decision.

Cost figures are display only. They are never a gate: the product does not refuse work because a call looks
expensive, because the account and the bill are the user's own.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `credential_invalid` | The provider refused the credential | Caller | A SYSTEM card reports it and points at provider settings; jobs are not created silently against it |
| `credential_missing` | The reference resolves to nothing in secure storage | Caller | The product asks the user to re-enter the credential; no plain-text fallback is offered |
| `model_unknown` | The assigned model identifier is not offered by the provider | Caller | The role falls back to the provider's recommended default and the user is told |
| `quota_exhausted` | The provider refused for quota reasons | Caller | A SYSTEM card reports the provider's own limit; the job fails cleanly rather than retrying indefinitely |
| `capability_mismatch` | The call carries an input the model does not declare | Caller | The attachment is disabled with an explanation before the call, not after |
| `provider_unreachable` | The provider endpoint could not be reached | Caller | Bounded retry, then a clean job failure naming the provider |
| `secure_store_unavailable` | The operating system's secure storage cannot be reached | Callee | The product reports that credentials cannot be stored and refuses to hold them elsewhere |

## Compatibility

MAJOR: removing a role, changing what a role means, or changing `credentialRef` into anything that could carry a
secret value.

MINOR: adding a role, adding a provider kind, adding an optional descriptor field.

PATCH: display names, recommended defaults, and cost figures, which drift with provider pricing and are expected
to.

Support window: a stored configuration from an earlier minor version resolves unchanged. A role added in a later
version resolves to its recommended default until the user chooses otherwise.

## Examples

Valid — a configuration assigning a cheap model to the pet and a strong one to the worker:

```json
{
  "providers": [
    {
      "id": "primary",
      "kind": "api_key",
      "displayName": "Primary provider",
      "credentialRef": { "namespace": "provider", "key": "primary" },
      "models": [
        { "id": "small-text", "inputs": ["text"] },
        { "id": "large-multimodal", "inputs": ["text", "image"] }
      ]
    }
  ],
  "assignments": [
    { "role": "pet", "providerId": "primary", "modelId": "small-text", "source": "default" },
    { "role": "worker", "providerId": "primary", "modelId": "large-multimodal", "source": "user" }
  ]
}
```

Rejected — a configuration carrying the secret inline:

```json
{
  "providers": [
    {
      "id": "primary",
      "kind": "api_key",
      "displayName": "Primary provider",
      "apiKey": "sk-live-…",
      "models": [{ "id": "small-text", "inputs": ["text"] }]
    }
  ]
}
```

Refused: a credential exists in exactly one place, the secure store, and every other entity holds a reference.
Accepting an inline secret here would put it into configuration that is displayed, exported and replicated.

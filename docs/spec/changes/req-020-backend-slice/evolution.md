# Evolution: backend

Four contracts enter the project with this change, and one of them exists specifically so that the other three
do not change when a platform is added. That asymmetry runs through everything below: adding a provider is a
routine, versionless act; changing what a session authorises or what the broker holds is not.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `backend/contracts/authorisation-provider-descriptor` | A field is removed; a required field is added; a `providerId` already in use is renamed; a `tokenAuthMethod` value is added that an older broker would not recognise; the meaning of `usesProofKey` changes | An optional field is added; a `status` value is added that an older broker safely treats as not offered; an error code is added that a caller can treat as a generic startup failure | Wording is clarified; an example is corrected; a pattern is tightened that no valid descriptor previously violated |
| `backend/contracts/client-session-api` | An endpoint or a `SessionTokens` field is removed; what a token authorises changes; a token lifetime is shortened in a way an older client cannot anticipate; `deviceId` becomes optional | An optional request or response field is added; an endpoint is added; an error code is added that an older caller can treat as a generic failure of the same class | Wording is clarified; an example is corrected |
| `backend/contracts/authorisation-broker-api` | An endpoint or a `ProviderTokens` field is removed; what the binding covers changes; the binding becomes reusable; the proof-key verifier moves onto the device | An optional field is added; an endpoint is added; an error code is added in an existing class. **Adding a provider is neither** — it changes no part of this contract | Wording is clarified; an example is corrected |
| `backend/contracts/public-service-endpoints` | An endpoint is removed; a `VersionResult` field is removed; either endpoint starts requiring a session; a `HealthResult` status is added that an older reader would treat as healthy; what `mandatory` obliges changes | An optional field is added; a `HealthResult` status is added that an older reader safely treats as not healthy; a rate-limit class is added; an error code is added | Wording is clarified; an example is corrected |

Two rules cut across all four. First, an unrecognised enumeration value or error code is always resolved in the
non-permissive direction — not offered, not healthy, not authorised, non-retryable failure. This is what makes a
new value MINOR rather than MAJOR, and the direction is not negotiable: a reader that guesses must guess towards
showing the user something to investigate. Second, `public-service-endpoints` is the version-discovery mechanism
for the other three, so it is additive-only in practice; a MAJOR bump there would break the ability of an old
client to learn why it is being refused, which is the one thing that endpoint exists to prevent.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| No server | 0.1.0, all four contracts | Yes — initial schema migration applied before the service starts | None. The spike's data is a development artifact and is not carried forward | The four record types are created together. A duplicate descriptor refuses startup; an incomplete one withholds that provider and reports which field or secret is missing |
| Service version N | Service version N+1, same contract MAJOR | Yes — forward-only, additive schema migration | Retained in place | Additive within a MAJOR means the previous service version runs against the new schema for the length of one release. That window is what makes rollback a redeploy rather than a restore |
| Service version N+1 | Service version N (rollback) | Yes — redeploy the previous version against the unchanged schema | Retained; sessions survive because they are store state, not instance state | A rollback requiring a reverted migration is not a one-step operation and is handled by restoring from backup, under the retention and proven-restore obligations in the living backend spec |
| Descriptor version X | Descriptor version X+1, same MAJOR | Yes — deployed as configuration with the release | Authorisations already held by devices are unaffected | Rolls back with the deployment. Withdrawing a provider does not invalidate authorisations devices already hold; those work until the platform expires them |
| Descriptor MAJOR N | Descriptor MAJOR N+1 | No — the broker refuses a descriptor whose MAJOR exceeds its own, naming the version | That provider is withheld until the service is upgraded | Refused wholesale rather than partially read. A half-understood descriptor could send a live authorisation code to the wrong endpoint |

## Deprecation

Deprecation here has two distinct subjects, and conflating them would cost a user their connection.

**Deprecating a contract element** — an endpoint, a field, an error code. The element is marked deprecated in the
contract at the MINOR release that introduces its replacement, both are served for at least one full release
cycle, and removal is the MAJOR bump. Consumers are identified from the `consumers` front-matter of the contract
and from the `Relations` table of `model.md`; there is no runtime consumer registry and none is needed, because
every consumer in this project is a capability in this repository.

**Withdrawing a provider** is not deprecation of a contract and does not version anything. The descriptor is set
to `withheld`, which removes the platform from the catalogue while leaving authorisations that devices already
hold to expire naturally at the platform. Removing the descriptor outright is the harder step and should follow
the withheld period, because after removal `broker.refreshProviderToken` yields `PROVIDER_UNSUPPORTED` and a
device holding a live authorisation loses the ability to refresh it — which the user experiences as a connector
that stops working for no reason they can see. The notice period for removal is therefore governed by the
longest refresh interval the platform allows, not by our release cadence.

**Retiring a client version** is announced through `minimumSupportedVersion` before it is enforced: the version
check reports the new minimum while the service still accepts clients below it, so a client can present a
required update rather than discovering the refusal at sign-in.

## Extension Procedure

**Adding an authorisation provider.** This is the procedure the whole design exists to keep short.

1. Write a descriptor conforming to `backend/contracts/authorisation-provider-descriptor@0.1.0`: identifier,
   display name, the two endpoints, the two secret names, the token-call authentication method, whether the
   proof-key exchange is required, default scopes, and any provider-specific authorisation parameters.
2. Place the client identifier and client secret in the secret manager under the names the descriptor uses.
   Never in the descriptor — the schema refuses a literal secret, by design.
3. Register the descriptor and deploy. The registry is read at startup, so the provider becomes brokerable at
   that point and not before.
4. Verify by diff that the change is confined to the descriptor registry: zero lines in the broker, the routes
   and all four contracts. This is the measured property from
   `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3), and re-running the diff is what keeps it
   true rather than historical.
5. Verify by exercise: obtain an authorisation URL, complete a connect, exchange, and refresh. Confirm the store
   dump shows no provider token afterwards.
6. If the platform offers no revocation endpoint, leave `revokeEndpoint` absent and confirm that account
   deletion names the platform to the user, per the living backend spec.

The connector side of the same platform — its manifest, tools, snapshot methods and compensation formulas — is
a separate act governed by `connector/contracts/connector-manifest`. This procedure adds only the server's
ability to broker authorisation for it.

**Adding an endpoint.** Place it in one of the three rate-limit classes; there is no fourth class and no
unclassed endpoint. Decide whether it requires a session — the default is yes, and the two exceptions are named
in the specs. Add it to its contract as a MINOR bump with its error codes and their handling side.

**Adding a server-side record type.** This is not an extension but an amendment: the store's shape is fixed by a
requirement, and widening it requires changing that requirement in a change of its own. The friction is
deliberate, and it is the entire mechanism by which the shape stays inspectable.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Store topology: connection pooling and read/write separation | Pooling before the release load test; separation after it | 200 concurrent writers on a development machine pushed median sign-in latency to about 1.5 s — VERIFIED, `spikes/SP-20-backend-slice/REPORT.md#4-rui-ro-moi-phat-hien`, RISK-060. The contended path is the store write in sign-in, which pooling addresses and replicas do not | Pooling: before the release load test, unconditionally. Read/write separation: on the first measurement, taken on production-equivalent infrastructure, where a single primary does not sustain twice the beta population |
| Encryption key custody granularity | After the closed beta | Owned by `req-022-account-sync` and listed here only because the backend implements custody. Its rationale — narrowing the blast radius recorded in RISK-062 — and its activation condition belong to that change and are not restated | As stated in `req-022-account-sync`: a beta population large enough that a single key compromise is not an acceptable loss, or a data-residency obligation requiring per-account or per-region scoping |

No other reserved slots exist in this capability. In particular, a second identity provider is not reserved: it
is a `closed` variability point, because principle VII makes account identity the sole gate on the user's whole
history, and widening that gate is a decision the decision-maker must make rather than a slot to be filled.

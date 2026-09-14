---
contract: provider-failure
version: 0.1.0
status: draft
owner: agent
consumers: [agent, uix, pet, app, job, approval]
schema_files: [provider-failure.schema.json]
---

# Contract: Provider Failure

## Purpose

The user configured the provider and the user pays for it, so every way it can fail is something only the user
can fix. This contract is the mapping from what the product observed — a status code, a transport error, a
response that arrived carrying nothing — to a cause the user can act on and the single place that repairs it.
It is what turns a failed request into a card rather than a job that simply stopped.

It exists because the mapping was measured rather than imagined: a wrong credential, an unknown model name and
an exhausted quota were each sent to a real service, each was caught in the response stream without crashing the
runtime, and each was converted into a card of this shape — VERIFIED
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q5,
`spikes/SP-17-provider-matrix/evidence/error-responses.json`,
`spikes/SP-17-provider-matrix/evidence/system-cards.json`). The fourth case was found by accident and is the
reason the taxonomy has a member nobody would have written down: a response that completes with no content and
no error at all — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien`).

What it does not cover: the presentation rules of the card itself, which belong to the `uix` capability; and
connector failures, which have their own card and their own settings destination.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`provider-failure.schema.json`](./provider-failure.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of a failure notice as it crosses the process boundary and as a card renders it. It is
the normative surface: a notice that does not satisfy it is not a notice this contract describes, and the
remedy vocabulary, the cause vocabulary and the deduplication key are fixed there rather than in prose.

What the file cannot express is the mapping this contract exists for — which observation becomes which cause.
That ordering is stated under *Module Descriptor / Manifest Specification* below, and it is the part a reader
must check by reading rather than by validating. The file also carries no request content by construction:
it declares no member for a prompt, a completion or a credential, so a notice cannot become a leak.

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { ProfileId } from "provider-profile@0.1.0";
import type { Role } from "role-routing@0.1.0";

/** The closed taxonomy. Every failed model request maps to exactly one member. */
type FailureCause =
  | "CREDENTIAL_REFUSED"
  | "MODEL_UNAVAILABLE"
  | "QUOTA_EXHAUSTED"
  | "ENDPOINT_UNREACHABLE"
  | "RESPONSE_UNUSABLE"
  | "CONFIGURATION_AHEAD";

/** Where a cause is repaired. One destination per cause; never two. */
type Remedy =
  | { kind: "profile-credential"; profileId: ProfileId }
  | { kind: "role-assignment"; role: Role }
  | { kind: "provider-account"; profileId: ProfileId }
  | { kind: "network" }
  | { kind: "product-update" };

/** What the product observed. The only input to classification. */
interface FailureObservation {
  transport: "answered" | "unreachable" | "timed-out";
  httpStatus?: number;
  providerCode?: string;          // the provider's own error code, treated as text
  providerMessage?: string;       // the provider's own words, treated as text
  completedEmpty?: boolean;       // completed with no content, no tool call and no error
  profileId: ProfileId;
  role: Role;
  model: string;
}

interface FailureNotice {
  cause: FailureCause;
  profileId: ProfileId;
  roles: Role[];                  // every role currently affected by this cause on this profile
  remedy: Remedy;
  providerDetail?: string;        // the provider's words, carried for the user to read, never interpreted
  observedAt: string;
  dedupeKey: string;              // `${profileId}:${cause}` — the identity of the condition, not of the request
}

interface FailureClassifier {
  /** Total: every observation yields a notice. */
  classify(observation: FailureObservation): FailureNotice;
}

interface FailureRegistry {
  /** Raising the same dedupeKey again updates the standing notice rather than adding one. */
  raise(notice: FailureNotice): Promise<void>;
  /** Called when the condition is repaired — a credential accepted, an assignment changed, a request succeeding. */
  withdraw(dedupeKey: string): Promise<void>;
  standing(): Promise<FailureNotice[]>;
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `provider-failure/standing` | Window → Main | Request-Response | `{}` | `FailureNotice[]` | None |
| `provider-failure/raised` | Main → Window | Pub-Sub | — | `FailureNotice` | None; the dialog surface raises or updates one SYSTEM card per `dedupeKey` |
| `provider-failure/withdrawn` | Main → Window | Pub-Sub | — | `{ dedupeKey }` | None; the card is withdrawn without the user dismissing it |
| `provider-failure/remedy` | Window → Main | Request-Response | `{ dedupeKey }` | `{ opened: Remedy }` | None; the main process decides the destination, so a window cannot navigate to one of its own choosing |

**Channels that deliberately do not exist.** No channel accepts a notice from a window, so a compromised window
cannot fabricate a provider failure and send the user to a settings page to re-enter a credential. No channel
carries the failing request's content.

### 3. Module Descriptor / Manifest Specification

The notice as it crosses the boundary and as a card renders it is
[`provider-failure.schema.json`](./provider-failure.schema.json).

**Classification rules.** They are read in order and the first match wins, so the mapping is deterministic:

| Observation | Cause |
| --- | --- |
| `transport` is `unreachable` or `timed-out` | `ENDPOINT_UNREACHABLE` |
| Profile or table version ahead of this build | `CONFIGURATION_AHEAD` |
| HTTP 401 or 403 | `CREDENTIAL_REFUSED` |
| HTTP 404, or a provider code naming an unsupported or unknown model | `MODEL_UNAVAILABLE` |
| HTTP 429, or a provider code or message naming quota, credit or rate limit | `QUOTA_EXHAUSTED` |
| Completed empty, or content the product cannot use | `RESPONSE_UNUSABLE` |
| Anything else | `RESPONSE_UNUSABLE` |

The status codes come from the measured responses: 401 with `AuthenticationError`, 404 with `UnsupportedModel`,
429 with a quota message — VERIFIED (`spikes/SP-17-provider-matrix/evidence/error-responses.json`). The
provider's own code and message are matched only as a secondary signal and only against the product's own
vocabulary; a provider that says nothing recognisable still lands on a cause through its status or through the
catch-all.

**Fallback when nothing matches.** `RESPONSE_UNUSABLE` is the total mapping's floor. It carries the provider's
words as `providerDetail` so the user has something to act on, and its remedy is the role's assignment, because
a model returning what the product cannot use is a model the user may want to change.

## Semantics

**One notice per condition, not per request.** The `dedupeKey` is the profile and the cause, so twenty jobs
meeting the same refused credential produce one standing notice and one card. The roles list accumulates: a
second role meeting the same condition updates the notice rather than raising a new one. This is the same rule
the `uix` capability already applies to a connector that has stopped working, and for the same reason — a
condition the user has not yet had a chance to fix must not generate a queue.

**A job's failure and a configuration's failure are different things.** A failed request fails its job, which
the job's own ERROR card reports. The notice is about the configuration, and it outlives the job: it stands
until the condition is repaired, which may be long after every affected job has ended.

**The provider's words are data.** `providerDetail` is shown to the user because a provider often knows
something the product does not. It is displayed as text and nothing else: it never selects the remedy, never
becomes a link, never reaches a model, and is bounded in length so a hostile or enormous message cannot become
the card. The cause — which does select the remedy — is derived only from what the product observed.

**Withdrawal is automatic and is driven by success.** A notice is withdrawn when the condition is repaired: a
credential the provider accepts, an assignment changed away from the failing model, or simply a later request on
that profile succeeding. The user is never asked to dismiss a card that has stopped being true.

**Quota is the user's, and the card says so.** `QUOTA_EXHAUSTED` names the user's own provider account as the
remedy. It is the one cause the product cannot repair from inside itself, and presenting it as a product fault
would be both wrong and, for a bring-your-own product, misleading about who controls the bill.

**An empty response is a failure here, not an answer upstream.** `RESPONSE_UNUSABLE` covers the measured silent
drop. Classifying it at this layer is what makes the defect visible at all: upstream, it looks like a turn that
completed.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `CREDENTIAL_REFUSED` | The provider refused the configured credential | Callee classifies; the run fails | SYSTEM card naming the profile, with a control opening that profile's credential |
| `MODEL_UNAVAILABLE` | The provider does not recognise the assigned model | Callee classifies; no retry | SYSTEM card naming the role whose assignment named the model, with a control opening that assignment |
| `QUOTA_EXHAUSTED` | The user's provider account is out of quota, credit or rate | Callee classifies; the job's retry policy may still apply | SYSTEM card stating the limit belongs to the user's provider account |
| `ENDPOINT_UNREACHABLE` | The address did not answer, or the request timed out | Callee classifies; the job's retry policy decides | The job's ordinary retry presentation first; a SYSTEM card once retries are exhausted |
| `RESPONSE_UNUSABLE` | The response completed empty, or carried content the product cannot use | Callee classifies; the run fails | SYSTEM card stating the model returned nothing usable, carrying the provider's words if any |
| `CONFIGURATION_AHEAD` | A profile or routing table was written by a newer build | Main; nothing runs on that configuration | SYSTEM card asking for the product update |

## Compatibility

**MAJOR** — removing a cause; changing which remedy a cause points at; changing the `dedupeKey` shape; allowing
a window to raise a notice; interpreting `providerDetail` as anything but text.

**MINOR** — adding a cause with its remedy and its place in the ordered classification rules; adding an optional
member to a notice; adding a read-only channel.

**PATCH** — wording of the user-facing text, and the secondary provider vocabulary matched by classification.

**Support window.** Notices are not persisted and do not replicate, so there is no mixed-version window to
manage: a notice lives in one running product on one device. A cause added by a newer build never reaches an
older one.

## Examples

**Valid** — the measured refused-credential case:

```json
{
  "cause": "CREDENTIAL_REFUSED",
  "profileId": "ark-shared",
  "roles": ["worker", "risk-judge"],
  "remedy": { "kind": "profile-credential", "profileId": "ark-shared" },
  "providerDetail": "401 AuthenticationError: The API key format is incorrect.",
  "observedAt": "2026-09-12T10:04:11Z",
  "dedupeKey": "ark-shared:CREDENTIAL_REFUSED"
}
```

**Rejected** — a notice whose cause was taken from the provider's own words and whose detail is unbounded:

```json
{
  "cause": "AuthenticationError",
  "profileId": "ark-shared",
  "roles": [],
  "remedy": { "kind": "profile-credential" },
  "observedAt": "2026-09-12T10:04:11Z",
  "dedupeKey": "req-8831"
}
```

Rejected on four counts, and each matters. `cause` is the provider's string rather than a member of the closed
taxonomy, which would let a provider — or anything that can make a provider respond — choose what the product
tells the user. `roles` is empty, so the card could not say what has stopped working. The remedy names no
profile, so the control would open nothing. And `dedupeKey` is the request's identity rather than the
condition's, which is precisely how twenty failed jobs become twenty cards for one wrong credential.

## Migration

Not applicable at `0.1.0`. Nothing of this contract is stored, so a version change takes effect at the next
launch and has no legacy data behind it. When a cause is added at a future MINOR, it takes its place in the
ordered rules above the catch-all; failures that previously landed on `RESPONSE_UNUSABLE` and now land on the
new cause change only in how they are explained, never in whether they were caught.

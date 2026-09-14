## Context

`req-007-pi-sdk-harness` established what a provider profile is and where a credential lives. What it left open,
deliberately, is which of the user's models answers which question — it says so in as many words, deferring the
role matrix here. Everything below sits between that contract and the five parts of the product that need a
model answer.

Three constraints shape it, and all three are measured rather than assumed.

The first is that models are not interchangeable. Two of the three models exercised refused images outright with
a protocol error, and one of those refusals arrived as an empty stream with no exception at all. A cheap model
silently downgraded a quarter of uncompilable rules in an earlier spike, and the strong model failed the
two-second response commitment on plain text by a factor of two.

The second is that the product does not know the user's models. The matrix that produced the measured monthly
cost of $0.167 is a matrix over three specific models at one provider; the user may bring one local model, or
three from a vendor nobody has tested. Anything the design enforces has to be checkable against what a profile
declares, not against a reputation.

The third is that the response commitment cannot be met by any model. The fastest text model answered at a
median of 1,958 ms against a two-second ceiling, and the vision model answered an image at 6,655 ms with a
ninetieth percentile of 19,693 ms. No routing decision fixes that; only removing the model from the critical
path does.

## Goals / Non-Goals

**Goals:**
- Resolve every model request from an explicit, user-visible assignment, and fail with a named reason rather
  than substituting.
- Make the two-second response commitment independent of provider latency.
- Convert every provider failure, including the one that arrives silently, into a condition the user can repair.
- Show the user what their own provider actually charged them for, without the product inventing prices.

**Non-Goals:**
- Selling, brokering or proxying model capacity. The backend stays out of the model path (principle VII).
- Judging how well an arbitrary model performs a role. The product states what it measured and enforces only
  what it can observe.
- Prompt design for any role. Each role's prompt belongs to the change that owns that role.
- A cross-job spending dashboard. This change records per-request usage and displays it per job; aggregation
  across jobs is a separate question about the job list.

## Structure

| Component | Responsibility | Model entities | Boundary |
| --- | --- | --- | --- |
| Routing registry | Holds the routing table, proposes defaults, validates assignments against declared capabilities, resolves a role and input shape to a profile and model | Role, Assignment, Routing table, Resolution | Main process. Implements `agent/contracts/role-routing@0.1.0` |
| Suitability record | The shipped, read-only statement of what was measured for which model in which role | Measured suitability | Main process; data compiled into the build (see the reserved slot in `model.md`) |
| Request dispatcher | Takes a role, an input shape and a payload; resolves; obtains a resolved endpoint from the profile registry; makes the request; writes the usage record; classifies a failure | Resolution, Usage record, Failure cause | Main process, beside the harness of `req-007-pi-sdk-harness` |
| Failure classifier and registry | Maps an observation to exactly one cause and remedy; keeps one standing notice per profile and cause; withdraws on repair | Failure cause, Remedy | Main process. Implements `agent/contracts/provider-failure@0.1.0` |
| Usage accounting | Writes one record per request, holds the price book, derives job totals at read time | Usage record, Unit price, Price book, Cost basis | Main process. Implements `agent/contracts/usage-accounting@0.1.0`. Stores with the job record of `req-013-sqlite-ledger` |
| Acknowledgement presenter | Presents a persona line on send and enters the pet's working state, with no network involvement | Acknowledgement line set | Renderer. Reads the persona specification's line set for the language in force |
| Composer capability gate | Enables or disables image attachment from one question asked of routing | Capability requirement | Renderer, asking `routing/image-route`; the authoritative check is repeated in the main process |

External domains are reached only through contracts: `agent/contracts/provider-profile@0.1.0` for endpoints,
credentials and declared capabilities; `platform/contracts/secure-storage@0.1.0` transitively through it;
`ledger`'s job and ledger records from `req-013-sqlite-ledger` for where usage records live; the gate contracts
of `req-009-rule-ir-hardgate` for the risk-judge role's place in the approval path.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `routing/table`, `routing/choices`, `routing/defaults` | Window → Main | Request-Response | as `role-routing@0.1.0` | `RoutingTable`, choices, proposal | None | `TABLE_VERSION_AHEAD`; no timeout, local |
| `routing/assign`, `routing/clear` | Window → Main | Request-Response | `{ role, profileId, model, acknowledgeUnmeasured? }` | `AssignOutcome` | Writes the routing table; replicates | Capability and suitability errors returned, not thrown |
| `routing/image-route` | Window → Main | Request-Response | `{}` | `{ available, reason? }` | None | None; the composer's only view of routing |
| `routing/state` | Main → Window | Pub-Sub | — | per-role usability change | None | None |
| `provider-failure/raised`, `/withdrawn` | Main → Window | Pub-Sub | — | `FailureNotice`, `{ dedupeKey }` | Raises, updates or withdraws one SYSTEM card | None |
| `provider-failure/remedy` | Window → Main | Request-Response | `{ dedupeKey }` | `{ opened }` | Navigates settings | The main process chooses the destination |
| `usage/for-job`, `/prices`, `/set-price`, `/clear-price` | Window → Main | Request-Response | as `usage-accounting@0.1.0` | `JobUsage`, `UnitPrice[]` | Price writes replicate | Validation errors returned |
| Model request | Main → provider | Stream | provider dialect | streamed content or an error event | Writes a usage record; may raise a notice | Classified by cause; timeout is the job's, per `req-013-sqlite-ledger` retry policy |

### Execution Boundaries & Isolation

The main process owns the routing table, the price book, every credential, every resolved endpoint and every
model request. A renderer owns what the user sees and nothing else. The division is not stylistic: a window that
could resolve a role could also choose a different one, and the composer's gate is an affordance, not the
enforcement — the enforcement is the check the dispatcher repeats immediately before it sends.

The acknowledgement is the one behaviour that lives entirely in the renderer, and deliberately so. It reads a
line set that shipped with the product, renders it, and asks nothing of the main process. That is what makes it
immune to a slow network, a failed provider, and a busy main process all at once.

If the main process restarts, the routing table and price book are read from the store, standing notices are
gone — they are not persisted — and are re-raised by the next request that meets the same condition. That is the
intended behaviour: a notice asserts a condition is true now, and the product should re-observe rather than
remember.

### Trust Boundaries & Input Validation

Untrusted inputs, and what stops each from mattering: model output never selects a route, because resolution
happens before the request exists; provider error text is length-bounded, displayed as text, and never selects a
remedy; a profile's declared capabilities are the user's claim and are used only as a gate whose failure mode is
already classified; user-entered prices are validated as decimals with a currency code and affect only what a
job page displays; a replicated routing table from a newer build is refused whole rather than partially read.

The one input worth naming separately is the composer's own state. A window could believe images are attachable
when they are not — a stale reply, or a compromised renderer. The dispatcher re-checks, so the outcome is a
refusal with a named reason instead of a request that returns nothing.

## Decisions

### D1 — Image handling is a routing slot, not a branch inside the pet role
- **Choice**: six roles, with `pet-image` distinct from `pet-text`; routing resolves from the pair of role and
  input shape.
- **Rationale**: the composer has to decide whether the attachment control works at all, before any command
  exists. A slot is a thing it can ask about and a thing the user can see unassigned; a branch is invisible until
  a request fails.
- **Alternatives considered**: a single pet role that swaps models when an image appears — rejected because it
  changes the model mid-conversation without the user having configured that, and leaves the composer nothing to
  inspect. Asking the model at request time what it supports — rejected because the spike measured that a
  non-vision model answers an image request with an empty stream and no error, so asking it is exactly as
  informative as not asking.

### D2 — Resolution fails rather than substitutes
- **Choice**: a role whose assignment cannot be used produces a named error; no fallback to another profile,
  model or role.
- **Rationale**: substitution would silently run rule elicitation on whatever model happened to be usable, which
  is the measured 25% silent-downgrade failure reproduced as a design feature.
- **Alternatives considered**: falling back to any model satisfying the role's capability requirement — rejected
  because capability satisfaction is not suitability, and the user chose per role for a reason. Falling back only
  for roles with no measured prohibition — rejected as a rule the user cannot predict: they would learn that some
  roles move and some do not, with no visible line between them.

### D3 — Capability is enforced; suitability is stated
- **Choice**: two layers. Declared capabilities gate an assignment and a request; measured suitability removes a
  model from a shipped profile's choices for a role and otherwise produces a statement the user acknowledges.
- **Rationale**: the constitution's evidence discipline cuts both ways — the product may not claim to enforce a
  judgement it cannot make about a model it has never seen, and it may not hide a measurement it does have.
- **Alternatives considered**: a curated allowlist of approved models per role — rejected because it either
  breaks bring-your-own or becomes a list nobody maintains, and it would forbid local models outright. Saying
  nothing and letting the user assign freely — rejected because the product then withholds the one thing it knows
  that the user does not.

### D4 — The acknowledgement is a local persona line, not the model's first token
- **Choice**: on send, the renderer presents a line from the persona specification's acknowledgement set within
  200 ms and enters the pet's working state; the model answer follows asynchronously.
- **Rationale**: no measured configuration meets the commitment otherwise — 1,958 ms median for the fastest text
  model leaves nothing for an image, which measured 6,655 ms median and 19,693 ms at the ninetieth percentile.
- **Alternatives considered**: streaming the model's first token as the acknowledgement — rejected on the
  measured time to first token, which is the very figure that fails. A generic product string such as "Working…"
  — rejected because it violates the pet's single-voice rule for no benefit; a persona line costs the same
  milliseconds. Raising the commitment from two seconds — rejected because the commitment is what makes the pet
  feel present, and the measurement shows the commitment is keepable, just not by a model.

### D5 — The capability gate is applied twice, in two different places, for two different reasons
- **Choice**: the composer disables attachment from `routing/image-route`; the dispatcher re-checks immediately
  before sending.
- **Rationale**: the composer's check is how the user learns; the dispatcher's check is how the product is
  correct. They fail differently — one is a disabled control with an explanation, the other a refused request —
  and collapsing them would lose one of those.
- **Alternatives considered**: checking only at dispatch — rejected because the user would attach three images
  and be told afterwards. Checking only in the composer — rejected because a renderer is not where correctness
  lives, and a stale answer would produce the empty-response defect this change exists to close.

### D6 — An empty completion is a failure class, not an empty answer
- **Choice**: a response completing with no content, no tool call and no error is classified as
  `RESPONSE_UNUSABLE`.
- **Rationale**: it is the observed shape of the silent vision drop, and it is the only provider failure the
  surrounding error handling cannot see. Nothing in this product legitimately produces it.
- **Alternatives considered**: treating it as a valid empty answer — rejected as the defect itself. Retrying —
  rejected because the cause is structural and a retry produces the same emptiness at twice the cost.

### D7 — Causes come from what the product observed, not from what the provider called it
- **Choice**: classification reads transport, status code and emptiness first; the provider's own code and
  message are a secondary signal matched against the product's vocabulary, and the text is carried for the user
  to read but never selects the remedy.
- **Rationale**: the remedy sends the user somewhere and asks them to change something, sometimes a credential.
  A path from attacker-influenceable text to that navigation is not one this product should have.
- **Alternatives considered**: mapping the provider's error codes directly — rejected both for trust and because
  every provider names things differently, so the mapping would be per-provider and perpetually incomplete.

### D8 — Prices are the user's; the product ships none
- **Choice**: costs are computed only from unit prices the user entered, per million tokens, with currency; no
  price means token counts and a stated absence.
- **Rationale**: a shipped price table is a claim about a third party's commercial terms that goes stale
  invisibly, and a wrong cost on a job page is worse than no cost because the user cannot see that it is wrong.
- **Alternatives considered**: shipping a table for known providers — rejected on staleness and because it would
  be wrong for every custom endpoint. Fetching prices from the backend — rejected because it puts the backend in
  the model path in spirit if not in packets, and it makes an offline product depend on a price feed.

### D9 — Usage records are write-once and totals are derived
- **Choice**: one immutable record per request; `forJob` computes totals at read time; mixed currencies yield
  per-role figures and no total.
- **Rationale**: a running total is a second truth that has to be corrected when a late record arrives, and the
  correction is invisible. Deriving is cheap at these volumes — roughly four requests per job.
- **Alternatives considered**: a running total on the job record — rejected for the correction problem.
  Converting currencies to produce one total — rejected because the product would be inventing an exchange rate.

### D10 — The routing table replicates; the gap a missing credential leaves is reported
- **Choice**: table and price book are account-owned and replicate; credentials do not; a role pointing at a
  profile with no credential here reports `PROFILE_CREDENTIAL_ABSENT` naming the roles.
- **Rationale**: principle VII exists so a new device is ready to use, and six re-made assignments are exactly
  the setup burden it forbids. Retargeting would violate D2 at the worst possible moment — the user's first hour
  on a new machine.
- **Alternatives considered**: keeping the table device-local — rejected against principle VII. Replicating
  credentials with it — rejected because `provider-profile@0.1.0` deliberately excludes them, the provider's
  secret not being the user's data.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading and registration**: roles are compiled into the product and enumerated from it; models arrive from
  profiles the user writes, loaded from the configuration store at startup and re-read when settings change.
  Nothing is hot-loaded and no code arrives from configuration — a profile is data describing an address, and a
  routing table is data naming a profile.
- **Isolation and sandboxing**: every provider interaction happens in the main process through the harness of
  `req-007-pi-sdk-harness`; resolved endpoints exist for the duration of one request and cross no boundary.
- **Resource management and eviction**: the routing table and price book are small and long-lived; usage records
  are evicted with their job; attached images are released when the job ends, as `req-007-pi-sdk-harness`
  requires. Standing failure notices are in-memory and vanish on restart by design.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (specific ➔ general)**: `pet-image` unassigned ──> the product does not fall back to `pet-text` for an
  image; it disables attachment and says why. The general slot is not a substitute, because it cannot do the
  specific thing.
- **Tier 2 (custom ➔ built-in default)**: a user-written profile that stops working ──> no automatic move to a
  shipped profile. The product reports the condition and offers the assignment. The one automatic behaviour in
  this tier is at first configuration, where defaults are *proposed* from the user's own profile and shown
  before they take effect.
- **Tier 3 (degraded safe mode)**: no usable assignment for any role ──> the product runs, the window opens, the
  job history and ledger are readable, and no job can be created; the pet says a provider must be configured and
  does not acknowledge commands it cannot start. Failure is toward doing nothing visibly, never toward doing
  something unconfigured.

## Complexity Tracking

None. No constitutional principle is violated by this change.

Two principles are load-bearing and are satisfied rather than bent. Principle VII: provider calls remain
client-direct, the backend is not in the model path, and the routing table and price book replicate as
account-owned configuration while credentials do not. Principle V: the acknowledgement is an interface
affordance and carries no requirement that the user phrase anything for a cheap model's benefit — the content
rule in `specs/pet` is what keeps it that way.

## Research

### R1 — Which models can hold which roles, and which role must have vision
- **Decision**: `pet-image` requires declared image input; the other five require text, with tool calling for
  `worker` and `undo`.
- **Rationale**: both text models refused an image with HTTP 400 and an explicit parameter error in 100% of
  attempts, and the vision model extracted all three tasks and their metadata from a screenshot.
- **Alternatives**: routing images to a text model and relying on the provider's rejection — refuted by the
  measurement that one such rejection arrives as an empty stream with no error.
- **Source / verification status**: VERIFIED —
  `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1),
  `spikes/SP-17-provider-matrix/evidence/vision-rejection-test.json`.

### R2 — Whether any model meets the two-second response commitment
- **Decision**: none does across input shapes; the acknowledgement leaves the model path entirely.
- **Rationale**: cheap text answered at 1,958 ms median but 3,110 ms at the ninetieth percentile; strong text at
  4,076 ms; vision text at 3,098 ms; vision with an image at 6,655 ms median and 19,693 ms at the ninetieth
  percentile.
- **Alternatives**: pinning `pet-text` to a fast model and accepting the commitment for text only — rejected
  because the ninetieth percentile already breaches it and an image breaches it threefold.
- **Source / verification status**: VERIFIED —
  `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2),
  `spikes/SP-17-provider-matrix/evidence/ack-latency-bench.json`.

### R3 — What a safe default is when the user configures exactly one model
- **Decision**: all roles to that model; `pet-image` only if it declares image input, otherwise unassigned with
  attachment disabled and an explanation.
- **Rationale**: this is the configuration the fallback exists for, and a visibly unassigned role is what the
  composer reads.
- **Alternatives**: refusing to operate without an image-capable model — rejected as hostile to local and
  text-only providers, which are a legitimate bring-your-own choice.
- **Source / verification status**: VERIFIED as the spike's recommended fallback logic —
  `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3).

### R4 — What the embedded provider layer actually supports
- **Decision**: profiles carry a credential and an endpoint descriptor; there is no interactive sign-in and no
  subscription to buy.
- **Rationale**: the engine supports several dialects, static credentials, dynamic credential callbacks and
  custom headers; its command-line sign-in has no counterpart on the embedded path.
- **Alternatives**: building a sign-in flow — rejected because there is nothing to sign in to.
- **Source / verification status**: VERIFIED —
  `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4), `spikes/SP-6-pi-sdk/REPORT.md` §1 Q5.
  This change consumes the resulting contract and adds nothing to it.

### R5 — Whether configuration errors are catchable and presentable
- **Decision**: yes, and they map to a closed taxonomy of six causes with one remedy each.
- **Rationale**: a wrong credential produced 401 with an authentication code, an unknown model produced 404 with
  an unsupported-model code, and an exhausted quota produced 429; each surfaced as an error event with a stop
  reason rather than an unhandled rejection, and each converted to a card.
- **Alternatives**: mapping provider codes directly — rejected in D7.
- **Source / verification status**: VERIFIED —
  `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5),
  `spikes/SP-17-provider-matrix/evidence/error-responses.json`,
  `spikes/SP-17-provider-matrix/evidence/system-cards.json`.

### R6 — What the role split costs a user in a month
- **Decision**: the split is retained as the default shape; the figure is recorded as a verification threshold,
  not as a product claim.
- **Rationale**: 418,255 tokens a month at fifteen jobs cost $0.167 under the split against $0.181 on one strong
  model and $2.069 on an expensive pair — the split's value is as much about which model holds which role as
  about the total.
- **Alternatives**: quoting a monthly figure to the user in the product — rejected because it belongs to the
  provider the user chose and the prices they pay.
- **Source / verification status**: VERIFIED —
  `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6),
  `spikes/SP-17-provider-matrix/evidence/monthly-cost-matrix.json`. The figures are one provider's prices at one
  moment; the structure is the durable output.

## Migration & Rollback

This change introduces persistent data and touches no existing record.

**Forward.** On first run after the change, no routing table exists; every role reads as unassigned. When the
user saves their first profile, defaults are proposed from its models and applied only after the user sees them.
A user who already configured a profile under `req-007-pi-sdk-harness` meets the same proposal on first launch,
because their profile exists and their table does not. The price book starts empty, and a job priced before any
price is entered keeps its costless records permanently, as D8 and the cost basis rule intend.

**Rollback.** Returning to a build without this change leaves the routing table and price book unread in the
configuration store; the previous build has no concept of them and does not delete them. Usage records sit with
job records and are ignored. Re-applying the change finds both intact. The one asymmetry is deliberate: a newer
table meeting an older build is refused whole (`TABLE_VERSION_AHEAD`) rather than partially read, so a
mixed-version account degrades to "this device needs an update" instead of silently running a role on the wrong
model.

**Legacy data.** None exists. The four living requirements this change modifies —
provider and role configuration in `agent`, the persona text rule in `pet`, the composer in `uix`, the job
detail page in `app` — are specification changes whose stored counterparts are created here for the first time.

## Risks / Trade-offs

- [The acknowledgement becomes a lie] The pet says something within 200 ms and the job never starts, or starts
  and fails immediately → the content rule makes the line a receipt and nothing more, and the acknowledgement is
  withheld entirely when no role is usable, so it is only ever shown when work can begin.
- [The unmeasured-model statement becomes noise the user clicks through] Six roles, each asking for
  acknowledgement, on first setup → the statement is per role and per model and is recorded once
  (`acknowledgedUnmeasured`), and it is not shown at all for the defaults proposed from a shipped profile, which
  is the path most users take.
- [Enforcing declared capabilities punishes an honest user with a lazy profile] A model that can read images but
  whose profile does not say so is refused → the profile is the user's own to edit, `probe` in
  `provider-profile@0.1.0` reports what it observed, and the alternative — trusting the request to fail
  informatively — is exactly the empty-stream defect.
- [Standing notices vanish on restart and the user loses the badge] → a notice asserts a present condition; the
  next request re-observes it. Persisting it would risk showing a condition that was repaired on another device.
- [Six roles is a surface the user has to understand] → defaults are proposed for all six from the first profile
  and the user may never open the matrix; the surface exists for the user who wants it and for the product to
  have somewhere honest to point when a role fails.
- [The measured defaults name specific third-party models that will be retired] → the suitability record is data
  in the build today and is the reserved slot in `model.md` for remote update; the failure mode meanwhile is
  `MODEL_UNAVAILABLE` with the role's assignment as the remedy, which is a repair the user can make in one step.

## Open Questions

- Whether a `PROGRESS` card should follow the acknowledgement for image commands, given a measured median of
  6.61 s and a ninetieth percentile of 19.65 s, or whether the pet's working animation is the whole of the
  feedback. Postponable: it adds a card to an existing type and changes no requirement here.
  Tracked as Q-1 in `clarifications.md`.
- Whether the shipped defaults and suitability verdicts become remotely updatable data, which is the reserved
  slot in `model.md`. Postponable: the reserved slot is documented with its activation condition, and nothing
  before that condition depends on the answer. Tracked as Q-2 in `clarifications.md`.
- Whether usage should also be summarised across jobs, and where. Postponable: the per-request records this
  change writes are sufficient to compute any later aggregate, so the decision costs nothing to defer.

> **Amended 2026-09-12** by `req-022-account-sync` (constitution 2.0.0): data is account-owned and replicates to every signed-in device, encrypted at rest under service-managed keys. The passages below were corrected where they asserted device-bound storage.

## Why

Harvested from `spikes/SP-17-provider-matrix/REPORT.md`. The spike measured the role-to-model assignment matrix, its monthly cost, and how provider failures surface to the user.

## Problem

The user brings their own provider and pays their own bill, so the product cannot assume a model's capabilities. A model without vision, a wrong key, an unknown model name or an exhausted quota must all become something the user can act on rather than a job that hangs.

- At the expected usage intensity, the optimal role split costs about $0.167 per month — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#0-ket-luan`).
- Every configuration error — bad key, unknown model, exhausted quota — was caught and converted into a user-facing system card — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#0-ket-luan`).
- Both text models rejected images outright with HTTP 400, so image handling must route to a vision-capable model — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#0-ket-luan`).
- Vision latency is high: median time to first token 6.61 s, ninetieth percentile 19.65 s — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien`).

## Cost of inaction

Two silent failures stay open. Sending an image to a non-vision model through the harness returns an empty stream with no exception — the user sees nothing happen and no error. And the two-second acknowledgement commitment cannot survive a six-second vision latency, so the pet appears frozen precisely when the user has just handed it something.

## Options

### Option A — Role matrix with capability routing and immediate acknowledgement
- **Sketch**: each role has a recommended default model. The composer checks for image capability before sending, disabling attachment when unavailable. The pet acknowledges from the interface within milliseconds while the model call proceeds behind it.
- **Appetite**: medium (weeks).
- **Trade-offs**: keeps the acknowledgement commitment regardless of model latency and turns silent failures into visible states; the acknowledgement is a persona line rather than a real understanding of the request.
- **Rabbit holes**: making the acknowledgement appear to confirm comprehension it does not have.

### Option B — Minimum viable slice: one model for every role
- **Sketch**: the user configures a single model used everywhere.
- **Appetite**: small (days).
- **Trade-offs**: simplest configuration; forbidden by the elicitation finding that the cheap model silently downgrades rules, and either overpays for trivial roles or under-serves critical ones.
- **Rabbit holes**: none.

## Recommendation

Option A. The role split is what makes the measured cost that low, and two prior spikes already constrain which models may hold which roles.

## What Changes

- A default role matrix is specified: cheap model for pet text, a vision-capable model for pet image handling, strong model for the worker, strong model for rule elicitation as required by `req-004-rule-elicitation`, strong model for undo, cheap model for the risk judge as measured in `req-011-risk-judge` — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd`).
- The pet acknowledges immediately from the interface on send, with the model response following asynchronously, so the acknowledgement commitment holds under slow networks and heavy images — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd`).
- The composer inspects the active model's declared input capabilities and disables image attachment with an explanatory tooltip when vision is unavailable, rather than failing downstream — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien`).
- Provider configuration wording drops the command-line-only interactive login mechanism, matching the finding in `req-007-pi-sdk-harness` — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd`).
- A provider error mapping converts failures into system cards, and token usage with estimated cost is shown in job detail — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- A response that completes with no content and no error is classified as a failure rather than as an empty
  answer, because that is the shape the silent vision drop takes — VERIFIED
  (`spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien`).
- Added 2026-09-12 by `clarifications.md`: the acknowledgement line set is admitted as a persona asset on the
  condition that an acknowledgement states receipt only, so the rule that meaning-bearing pet text is
  model-generated survives intact.
- Added 2026-09-12 by `clarifications.md`: a role's capability requirements are enforced at assignment, while
  measured suitability is advisory for any model the product has not measured — the product does not claim to
  enforce a strength rule it cannot evaluate.
- Added 2026-09-12 by `clarifications.md`: estimated cost is computed only from unit prices the user supplied;
  with no price configured, job detail shows usage and says so rather than showing a figure from a shipped
  price table.

## Capabilities

REQUIRES spec-impact — the routing table is persistent account-owned configuration, three contracts are
defined, and requirements in four living capabilities are modified.

### New Capabilities
- None. Every capability this change touches already exists; the routing layer is added to `agent` rather than
  given a capability of its own, because it has no surface a consumer could use without the agent runtime.

### Modified Capabilities
- `agent`: the closed role catalogue and the routing table, capability-based resolution, provider failure
  classification, and the usage record written for every model request.
- `pet`: the immediate acknowledgement, and the narrowing of the rule that all pet-visible text is
  model-generated.
- `uix`: composer capability gating, the provider failure system card, and the content rule for an
  acknowledgement.
- `app`: token usage and cost, or the stated absence of a cost, on the job detail page. Added on
  2026-09-12 by `clarifications.md` session, which placed the display where the job detail page already lives.

## Impact

Provider configuration storage, composer behaviour, pet response timing, job detail presentation, and the shared
model routing configuration touched by `req-004-rule-elicitation` and `req-011-risk-judge`. The routing table and
the price book are account-owned configuration and replicate under `req-022-account-sync`; provider credentials
do not replicate, so a second device can hold a complete routing table whose profiles have no credential yet —
decided 2026-09-12 in `clarifications.md`.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle VII as redefined at 2.0.0 — provider calls still go client-direct and the backend is not in the model path. Provider configuration and the role matrix are account-owned, so a new device inherits the user's model choices without reconfiguration; the provider credential replicates encrypted like any other credential. Principle V — the acknowledgement is an interface affordance and must not become a demand that the user phrase requests so a cheap model can parse them. No violation.

## Assumptions

- Measured costs come from one provider's pricing at spike time and will drift; the routing structure, not the figure, is the durable output.

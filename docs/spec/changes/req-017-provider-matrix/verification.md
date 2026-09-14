# Verification: req-017-provider-matrix

The scenarios in the delta specs are the test cases. This file records what they cannot express — the numbers
and where they came from, the suites that produce them, the combinations that have to be exercised rather than
reasoned about, and the scope that is rerun rather than only the delta.

Two boundaries govern every figure below and are stated first, because they qualify all of them.

The first is the provider. Every latency, cost and error figure was measured against one third-party service and
three specific models (`spikes/SP-17-provider-matrix/REPORT.md#6-phien-ban-chinh-xac-cua-moi-package-cong-cu`).
The product's entire premise is that the user brings a different one. A figure below is therefore VERIFIED for
the measured configuration and says nothing about the user's — which is exactly why the design enforces declared
capabilities and states, rather than enforces, measured suitability.

The second is the environment. The spike ran under a plain runtime on Linux; the product ships inside an
application framework with its own bundled runtime, on Windows and macOS. This is the same boundary
`req-007-pi-sdk-harness` records, and it is closed by the same task: re-running the measurements inside the
packaged product.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "Every model request resolves through the routing table", ensuring a command without an image holds without contradiction or unhandled failure | Requirement "Every model request resolves through the routing table"; Scenario "A command without an image"; Scenario "The same command with an image attached" | specs/agent/spec.md |
| AC-2 | The product fulfills requirement "A role is assigned only to a model that declares the capabilities its requests need", ensuring assigning a text-only model to the image role holds without contradiction or unhandled failure | Requirement "A role is assigned only to a model that declares the capabilities its requests need"; Scenario "Assigning a text-only model to the image role"; Scenario "A profile is edited so an assigned model loses a capability" | specs/agent/spec.md |
| AC-3 | The product fulfills requirement "An assignment that departs from a measured result says what it departs from", ensuring a shipped profile offers models for the elicitation role holds without contradiction or unhandled failure | Requirement "An assignment that departs from a measured result says what it departs from"; Scenario "A shipped profile offers models for the elicitation role"; Scenario "A model the product has never measured" | specs/agent/spec.md |
| AC-4 | The product fulfills requirement "A model response carrying neither content nor an error is a failure", ensuring an empty stream returns from a text-only model holds without contradiction or unhandled failure | Requirement "A model response carrying neither content nor an error is a failure"; Scenario "An empty stream returns from a text-only model"; Scenario "A legitimately short answer" | specs/agent/spec.md |
| AC-5 | The product fulfills requirement "Every provider failure is classified into a stated cause and a remedy", ensuring the credential is refused mid-job holds without contradiction or unhandled failure | Requirement "Every provider failure is classified into a stated cause and a remedy"; Scenario "The credential is refused mid-job"; Scenario "The assigned model name no longer resolves" | specs/agent/spec.md |
| AC-6 | The product fulfills requirement "Every model request records what it consumed", ensuring a job that used three roles holds without contradiction or unhandled failure | Requirement "Every model request records what it consumed"; Scenario "A job that used three roles"; Scenario "No price is configured" | specs/agent/spec.md |
| AC-7 | The product fulfills requirement "The routing table follows the account and names what this device cannot serve", ensuring signing in on a replacement device holds without contradiction or unhandled failure | Requirement "The routing table follows the account and names what this device cannot serve"; Scenario "Signing in on a replacement device"; Scenario "A role's profile has no credential here" | specs/agent/spec.md |
| AC-8 | The product fulfills requirement "Model provider and role routing are configured on the client", ensuring changing the worker model holds without contradiction or unhandled failure | Requirement "Model provider and role routing are configured on the client"; Scenario "Changing the worker model"; Scenario "Credential is rejected by the provider" | specs/agent/spec.md |
| AC-9 | The product fulfills requirement "The job detail page carries the full account of one job", ensuring actions match the state holds without contradiction or unhandled failure | Requirement "The job detail page carries the full account of one job"; Scenario "Actions match the state"; Scenario "Undo of an undo job" | specs/app/spec.md |
| AC-10 | The product fulfills requirement "The pet acknowledges a handed-over command before any model answers", ensuring a text command on a slow network holds without contradiction or unhandled failure | Requirement "The pet acknowledges a handed-over command before any model answers"; Scenario "A text command on a slow network"; Scenario "A command carrying an image" | specs/pet/spec.md |
| AC-11 | The product fulfills requirement "All pet-visible text originates from the pet-agent", ensuring result announcement is generated holds without contradiction or unhandled failure | Requirement "All pet-visible text originates from the pet-agent"; Scenario "Result announcement is generated"; Scenario "Pet-agent is unavailable" | specs/pet/spec.md |
| AC-12 | The product fulfills requirement "A provider failure reaches the user as a system card", ensuring a credential is refused while a job runs holds without contradiction or unhandled failure | Requirement "A provider failure reaches the user as a system card"; Scenario "A credential is refused while a job runs"; Scenario "The same cause recurs on the same profile" | specs/uix/spec.md |
| AC-13 | The product fulfills requirement "An acknowledgement card may exist before its job does", ensuring the card appears before the job holds without contradiction or unhandled failure | Requirement "An acknowledgement card may exist before its job does"; Scenario "The card appears before the job"; Scenario "The job is created a moment later" | specs/uix/spec.md |
| AC-14 | The product fulfills requirement "Composer accepts text and images with declared limits", ensuring oversized image is refused with an explanation holds without contradiction or unhandled failure | Requirement "Composer accepts text and images with declared limits"; Scenario "Oversized image is refused with an explanation"; Scenario "Fourth image" | specs/uix/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Acknowledgement presented after the send action | ≤ 200 ms | Product budget covering line selection, queue placement and render. The spike's own reckoning for the local line is ≤ 50 ms (`spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd` item 3), and it involves no network | unverified — the 50 ms component is reasoned from the absence of a network call; the 200 ms product budget is measured during implementation in the packaged product |
| Model requests made before the acknowledgement is presented | 0 | Design D4; the acknowledgement path reads only the persona line set | verified by construction once implemented; the scenario in `specs/pet` is the check |
| Time to first token, cheap text model, text input | 1,916 ms median; 3,104 ms ninetieth percentile | `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q2; `evidence/ack-latency-bench.json`, 10 iterations | verified (measured provider, plain runtime) |
| Total response time, cheap text model, text input | 1,958 ms median; 3,110 ms ninetieth percentile | same | verified (measured provider, plain runtime) — the ninetieth percentile already exceeds the two-second commitment, which is the measurement that forces D4 |
| Total response time, strong model, text input | 4,076 ms median; 8,352 ms ninetieth percentile | same | verified (measured provider, plain runtime) |
| Time to first token, vision model, image input | 6,613 ms median; 19,651 ms ninetieth percentile | same | verified (measured provider, plain runtime) |
| Total response time, vision model, image input | 6,655 ms median; 19,693 ms ninetieth percentile | same | verified (measured provider, plain runtime) |
| Image requests rejected by a text-only model | 100% (HTTP 400, explicit parameter error) | `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q1; `evidence/vision-rejection-test.json` | verified (measured provider) — the basis for the `pet-image` capability requirement |
| Image requests to a text-only model that raise no exception and return no content | Observed; the empty-stream shape is the reason `RESPONSE_UNUSABLE` exists | `spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien` | verified (measured provider) |
| Configuration failures converted into a system card rather than an unhandled failure | 3 of 3 exercised — refused credential, unknown model, exhausted quota | `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q5; `evidence/error-responses.json`, `evidence/system-cards.json` | verified (measured provider, plain runtime) |
| Failed requests reaching the user unclassified | 0 | Design D7 and the total mapping INV-AG-27; the taxonomy's catch-all is `RESPONSE_UNUSABLE` | verified by construction; the eval suite below exercises unmatched failures explicitly |
| Monthly token consumption at fifteen jobs | 418,255 tokens | `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6; `evidence/monthly-cost-matrix.json` | verified as a composition of measured per-role figures from SP-2, SP-4, SP-9, SP-10 and SP-17 |
| Monthly cost at fifteen jobs, role-split assignment | $0.167 | same | verified for the measured provider's prices at spike time — a regression signal for the routing structure, never a figure the product shows |
| Monthly cost at fifteen jobs, one strong model for every role | $0.181 | same | verified (same qualification) — recorded because the split's value is the role placement, not the saving |
| Cost of one risk-judge call | $0.000203 | `spikes/SP-10-risk-judge/REPORT.md#0-ket-luan` | verified — the figure that sets the six-decimal precision floor in `usage-accounting@0.1.0` |
| Silent rule downgrades by the cheap model in the elicitation role | 25% of uncompilable cases | `spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan` | verified — the basis for the `unsuitable` verdict for that model in that role |
| Model requests per job | ≈ 4 (pet acknowledgement, worker, risk judge at ~1.5 write calls, amortised undo) | `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6 | verified as the composition used for the cost model; it sizes the usage-record volume |
| Time to resolve a role and obtain a resolved endpoint | **No figure exists** | Not measured by any spike | unverified — measured during implementation and recorded as an observation. It is local work against a small record and is not expected to be material against provider latency, but "not expected" is not a measurement |
| Memory held while an attached image awaits the capability decision | **No figure exists** | Not measured; bounded above by the composer's existing limit of three images at 10 MB | unverified — measured during implementation |
| Latency or cost for any provider the user brings | **No figure exists and none can** | The product does not measure the user's provider | unverified by definition — this is why `specs/agent` states what was measured rather than asserting what will happen |

Three rows state no number deliberately. Under the constitution's Evidence Discipline an unmeasured quantity
cannot be a threshold; the last of them cannot become one at all, and saying so is part of what this change
specifies.

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Acknowledgement presented after the send action — ≤ 200 ms | Scenarios evaluated under representative workloads citing Product budget covering line selection, queue placement and render. The spike's own reckoning for the local line is ≤ 50 ms (`spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd` item 3), and it involves no network | 50 observations across target conditions | Observable behavior confirms acknowledgement presented after the send action complies with threshold ≤ 200 ms |
| Model requests made before the acknowledgement is presented — 0 | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms model requests made before the acknowledgement is presented complies with threshold 0 |
| Time to first token, cheap text model, text input — 1,916 ms median; 3,104 ms ninetieth percentile | Scenarios evaluated under representative workloads citing `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q2; `evidence/ack-latency-bench.json`, 10 iterations | 50 observations across target conditions | Observable behavior confirms time to first token, cheap text model, text input complies with threshold 1,916 ms median; 3,104 ms ninetieth percentile |
| Total response time, cheap text model, text input — 1,958 ms median; 3,110 ms ninetieth percentile | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms total response time, cheap text model, text input complies with threshold 1,958 ms median; 3,110 ms ninetieth percentile |
| Total response time, strong model, text input — 4,076 ms median; 8,352 ms ninetieth percentile | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms total response time, strong model, text input complies with threshold 4,076 ms median; 8,352 ms ninetieth percentile |
| Time to first token, vision model, image input — 6,613 ms median; 19,651 ms ninetieth percentile | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms time to first token, vision model, image input complies with threshold 6,613 ms median; 19,651 ms ninetieth percentile |
| Total response time, vision model, image input — 6,655 ms median; 19,693 ms ninetieth percentile | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms total response time, vision model, image input complies with threshold 6,655 ms median; 19,693 ms ninetieth percentile |
| Image requests rejected by a text-only model — 100% (HTTP 400, explicit parameter error) | Scenarios evaluated under representative workloads citing `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q1; `evidence/vision-rejection-test.json` | 50 observations across target conditions | Observable behavior confirms image requests rejected by a text-only model complies with threshold 100% (HTTP 400, explicit parameter error) |
| Image requests to a text-only model that raise no exception and return no content — Observed; the empty-stream shape is the reason `RESPONSE_UNUSABLE` exists | Scenarios evaluated under representative workloads citing `spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien` | 50 observations across target conditions | Observable behavior confirms image requests to a text-only model that raise no exception and return no content complies with threshold Observed; the empty-stream shape is the reason `RESPONSE_UNUSABLE` exists |
| Configuration failures converted into a system card rather than an unhandled failure — 3 of 3 exercised — refused credential, unknown model, exhausted quota | Scenarios evaluated under representative workloads citing `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q5; `evidence/error-responses.json`, `evidence/system-cards.json` | 50 observations across target conditions | Observable behavior confirms configuration failures converted into a system card rather than an unhandled failure complies with threshold 3 of 3 exercised — refused credential, unknown model, exhausted quota |
| Failed requests reaching the user unclassified — 0 | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms failed requests reaching the user unclassified complies with threshold 0 |
| Monthly token consumption at fifteen jobs — 418,255 tokens | Scenarios evaluated under representative workloads citing `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6; `evidence/monthly-cost-matrix.json` | 50 observations across target conditions | Observable behavior confirms monthly token consumption at fifteen jobs complies with threshold 418,255 tokens |
| Monthly cost at fifteen jobs, role-split assignment — $0.167 | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms monthly cost at fifteen jobs, role-split assignment complies with threshold $0.167 |
| Monthly cost at fifteen jobs, one strong model for every role — $0.181 | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms monthly cost at fifteen jobs, one strong model for every role complies with threshold $0.181 |
| Cost of one risk-judge call — $0.000203 | Scenarios evaluated under representative workloads citing `spikes/SP-10-risk-judge/REPORT.md#0-ket-luan` | 50 observations across target conditions | Observable behavior confirms cost of one risk-judge call complies with threshold $0.000203 |
| Silent rule downgrades by the cheap model in the elicitation role — 25% of uncompilable cases | Scenarios evaluated under representative workloads citing `spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan` | 50 observations across target conditions | Observable behavior confirms silent rule downgrades by the cheap model in the elicitation role complies with threshold 25% of uncompilable cases |
| Model requests per job — ≈ 4 (pet acknowledgement, worker, risk judge at ~1.5 write calls, amortised undo) | Scenarios evaluated under representative workloads citing `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6 | 50 observations across target conditions | Observable behavior confirms model requests per job complies with threshold ≈ 4 (pet acknowledgement, worker, risk judge at ~1.5 write calls, amortised undo) |
| Time to resolve a role and obtain a resolved endpoint — **No figure exists** | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms time to resolve a role and obtain a resolved endpoint complies with threshold **No figure exists** |
| Memory held while an attached image awaits the capability decision — **No figure exists** | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms memory held while an attached image awaits the capability decision complies with threshold **No figure exists** |
| Latency or cost for any provider the user brings — **No figure exists and none can** | Observations against the running application and external platform connectors | 50 observations across target conditions | Observable behavior confirms latency or cost for any provider the user brings complies with threshold **No figure exists and none can** |

## Contract Conformance

This change freezes four machine-readable contract files. Each is judged by a condition anyone can observe
against a product built from the file, never by running a validator over it.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/role-routing.schema.json` | A table that omits a role, or carries any member beyond its version and its six assignments, is refused whole rather than read around — and no running configuration ever has a role that is neither assigned nor explicitly unassigned | `specs/agent/spec.md`, the requirement that every model request resolves through the routing table; INV-AG-23, INV-AG-24 |
| `contracts/role-routing.schema.json` | Resolution never substitutes: a role whose assignment cannot be used fails naming the role, and borrows no other role's model, no other profile's credential, and no table-wide default — because the file describes no member such a default could live in | `specs/agent/spec.md`; INV-AG-23 |
| `contracts/role-routing.schema.json` | A table written by a newer build is refused whole on an older one, with the roles named and no request made, rather than partially applied | `specs/agent/spec.md`, the requirement that the routing table follows the account and names what this device cannot serve; `contracts/role-routing.md` §Compatibility |
| `contracts/provider-failure.schema.json` | Every failed model request yields exactly one notice the file admits: a cause from the closed enumeration, at least one affected role, and a remedy carrying the profile or role its control opens. A response whose provider text names an error is classified from what was observed, never from that text | `specs/agent/spec.md`, the requirement that every provider failure is classified into a stated cause and a remedy; `specs/uix/spec.md` |
| `contracts/provider-failure.schema.json` | Twenty jobs meeting one condition on one profile produce one standing notice and one card, because the deduplication key the file requires is the identity of the condition and not of a request | `specs/uix/spec.md`, the requirement that a provider failure reaches the user as a system card; `contracts/provider-failure.md` §Semantics |
| `contracts/usage-accounting.schema.json` | Every recorded cost carries the basis it was computed under, and correcting a price afterwards leaves every existing record showing the price that was in force when it was written | `specs/agent/spec.md`, the requirement that every model request records what it consumed; INV-AG-25 |
| `contracts/usage-accounting.schema.json` | A request whose provider reported no usage is recorded as not reported and carries no token counts, and is never recorded as zero; the job total is marked incomplete rather than understated | `specs/agent/spec.md`; `contracts/usage-accounting.md` §Semantics |
| `contracts/usage-accounting.schema.json` | A cost the file admits is exact to at least six decimal places, so the measured per-call figure of the cheapest role is recorded as itself rather than as zero | `specs/agent/spec.md`; the cost-arithmetic corpus; `spikes/SP-10-risk-judge/REPORT.md#0-ket-luan` |
| `contracts/usage-accounting.unit-price.schema.json` | A price the file refuses is refused by the price form at the moment of saving, with the accepted form stated — including a missing output price, which is never inferred from the input price | `specs/agent/spec.md`; `contracts/usage-accounting.md` §Error Matrix |

## Combination Matrix

This change belongs to two clusters — `agent-runtime` (pet, agent, job) and `desktop-shell` (pet, app, uix) —
and touches a third through the risk-judge role (`trust-chain`).

| Dimension | Values |
| --- | --- |
| Role | pet text · pet image · worker · rule elicitation · undo · risk judge |
| Input shape | text · text with images |
| Profile shape | one model, no image capability · one model with image capability · several models · several profiles |
| Device state | credential present · credential absent on this device · table version ahead |
| Failure cause | credential refused · model unavailable · quota exhausted · endpoint unreachable · response unusable · configuration ahead |
| Price state | priced · unpriced · mixed currency across a job |

Required combinations, rather than the full product of the above:

1. Each role × each failure cause — that every role's failure reaches the user with its own remedy, and that a
   failure in the risk-judge role still fails closed as `req-011-risk-judge` requires rather than being softened
   into a routing error.
2. Image input × each profile shape — including the single text-only model, which is the fallback case, and the
   profile edited to remove image capability while an image is attached.
3. Credential absent on this device × each role — that the roles are named and nothing is retargeted.
4. Table version ahead × any role — that the table is refused whole and no role runs.
5. Price state × a job using three roles — that per-role figures survive an unpriced model and a mixed-currency
   job.
6. Acknowledgement × each of: no provider configured, provider failing immediately, vision latency at the
   ninetieth percentile — the three cases where a receipt could become a false promise.

## Regression Scope

Every scenario of the capabilities below is rerun, not only the deltas.

- `agent` — MODIFIED provider and role configuration, and seven added requirements. The whole capability reruns
  because this change alters what every session is constructed with.
- `pet` — MODIFIED persona text rule and an added acknowledgement requirement; the pet's state and timing
  requirements are adjacent to both.
- `uix` — MODIFIED composer and two added card requirements; the queue, dismissal and Do-Not-Disturb
  requirements govern how the new cards behave.
- `app` — MODIFIED job detail page.
- `job` — consumer: jobs carry the usage records and the failures this change classifies; the retry and
  time-limit requirements interact with `ENDPOINT_UNREACHABLE`.
- `approval` — consumer through the risk-judge role: the fail-closed requirement must survive a routing failure
  as well as a provider failure.
- `sync` — consumer: the routing table and price book are new replicated stores and must satisfy the conflict
  and ordering requirements already specified there.

## Manual Checks

- A person unfamiliar with the product configures one provider and reaches a completed job without opening the
  role matrix, and can afterwards say which model did what — owner: product owner. This is the check that the
  six-role surface has not been pushed into everyone's first hour.
- The acknowledgement lines, in both supported languages, are read against the content rule: no line names
  anything from a command or promises an outcome — owner: product owner, together with the persona decision
  Q-OQ-3 in `req-001-mvp-product-definition`.
- The six system cards are read for whether each one tells a non-technical user what to do next, in the words of
  the product rather than the words of the provider — owner: product owner.
- The unmeasured-model statement is read for whether it informs rather than discourages: a user bringing a local
  model must not come away believing the product disapproves of their choice — owner: product owner.
- Prices entered from two real provider pricing pages produce costs that match those providers' own dashboards
  within rounding — owner: whoever holds the provider accounts. This is the only check that the per-million-token
  unit is the one users actually see.

## Open Measurement Gaps

- **Acknowledgement presented after the send action.** Stated threshold "≤ 200 ms" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Time to resolve a role and obtain a resolved endpoint.** Stated threshold "**No figure exists**" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Memory held while an attached image awaits the capability decision.** Stated threshold "**No figure exists**" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.
- **Latency or cost for any provider the user brings.** Stated threshold "**No figure exists and none can**" is unverified in this change. Closing it requires empirical observation during integration and staging trials — Owner: Lead Engineer / QA.

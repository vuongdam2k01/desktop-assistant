## ADDED Requirements

### Requirement: Every model request resolves through the routing table

Every request the product sends to a model provider SHALL be resolved from the pair of the role that needs the
answer and the shape of the input it carries, against a routing table holding exactly one assignment per role,
and no component SHALL send a model request built from any other source of provider, model or credential.

The product recognises exactly six roles — pet text, pet image, worker, rule elicitation, undo, risk judge —
and this catalogue is closed: a seventh role is a change to
`agent/contracts/role-routing@0.1.0`, not a configuration value. Resolution never consults what a model reports
about itself at request time; it reads the assignment the user holds.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q3) — VERIFIED that each of the
five measured roles has a distinct model requirement and that the sixth, pet image, exists because two text
models refused images outright. That image handling is a routing slot rather than a branch inside the pet role
was decided in `clarifications.md` session 2026-09-12.

#### Scenario: A command without an image
- **GIVEN** the pet text role and the pet image role are assigned to different models
- **WHEN** the user hands over a command carrying only text
- **THEN** the request is sent to the model assigned to the pet text role

#### Scenario: The same command with an image attached
- **GIVEN** the same two assignments
- **WHEN** the user hands over a command carrying an image
- **THEN** the request is sent to the model assigned to the pet image role, and the pet text assignment is not
  used for that request

#### Scenario: A role has no assignment
- **GIVEN** the undo role has no assignment
- **WHEN** work arises that needs that role
- **THEN** no request is sent and no job starts; the product states which role is unassigned and offers the
  settings that assign it

#### Scenario: An assignment changes while a job is running
- **GIVEN** a job is mid-run against the worker assignment
- **WHEN** the user changes the worker assignment
- **THEN** the running job finishes against the assignment it started with, and the next request from a new job
  resolves to the new one

### Requirement: A role is assigned only to a model that declares the capabilities its requests need

Each role SHALL declare the capabilities its requests require, an assignment SHALL be refused at the moment it
is made when the chosen model's profile does not declare them, and a request SHALL NOT be sent to a model whose
profile does not declare the capability that request needs.

The declared requirements are: image input for the pet image role, tool calling for the worker role and the undo
role, and text for every role. They are enforced because each is a protocol fact the product can check against
`agent/contracts/provider-profile@0.1.0`; they are not a judgement about how well a model performs a role.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) — VERIFIED: both text models
rejected an image with an explicit protocol error in 100% of attempts, and the vision model accepted the same
image, so capability is observable rather than inferred.

#### Scenario: Assigning a text-only model to the image role
- **WHEN** the user selects, for the pet image role, a model whose profile declares text but not image input
- **THEN** the assignment is refused at that moment, and the reason names the capability the role needs

#### Scenario: A profile is edited so an assigned model loses a capability
- **GIVEN** the pet image role is assigned to a model that declared image input
- **WHEN** the user edits the profile so that model no longer declares image input
- **THEN** the role is reported as no longer satisfiable, and an image-bearing command is refused before a
  request is sent rather than after the provider rejects it

#### Scenario: The user has exactly one model and it cannot read images
- **GIVEN** the user's only profile offers one model declaring text and tool calling
- **WHEN** the routing table is first built
- **THEN** the five text roles are assigned to that model, the pet image role is left unassigned, and the
  product states that images cannot be handled until an image-capable model is configured

#### Scenario: The user has exactly one model and it can read images
- **GIVEN** the user's only profile offers one model declaring text, tool calling and image input
- **WHEN** the routing table is first built
- **THEN** all six roles are assigned to that model

### Requirement: An assignment that departs from a measured result says what it departs from

When the user assigns a role to a model the product holds no measurement for, the product SHALL state, at the
moment of the assignment, that it holds no measurement for that model in that role and SHALL name what was
measured for that role, and SHALL NOT present a model the product has measured as unsuitable for a role among
that role's offered choices within a profile the product ships.

The two roles carrying a measured prohibition are rule elicitation, where a cheap model silently downgraded a
quarter of uncompilable cases, and undo. The product enforces what it can observe and states what it cannot,
rather than claiming to enforce a strength rule it has no means to evaluate.

Source: `spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan` — VERIFIED at 25% silent downgrade for the cheap
model; `spikes/SP-9-undo-agent/REPORT.md#0-ket-luan` and `spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd`
— VERIFIED for the strong model in the undo and elicitation roles. The two-layer treatment was decided in
`clarifications.md` session 2026-09-12.

#### Scenario: A shipped profile offers models for the elicitation role
- **GIVEN** a profile the product ships offers both a model measured as suitable for rule elicitation and one
  measured as unsuitable
- **WHEN** the user opens the choices for the rule elicitation role
- **THEN** the unsuitable model is not offered, and the reason it is absent is available to the user

#### Scenario: A model the product has never measured
- **WHEN** the user assigns the rule elicitation role to a model from a profile they typed in themselves
- **THEN** the product states that it holds no measurement for this model in this role, names what it did
  measure, and accepts the assignment the user confirms

#### Scenario: The statement is not a refusal
- **GIVEN** the user has been shown that statement
- **WHEN** they confirm the assignment
- **THEN** the role is assigned and rule elicitation runs against that model

### Requirement: A model response carrying neither content nor an error is a failure

When a model request completes with no content, no tool call and no reported error, the product SHALL treat it
as a failed request of a stated cause, SHALL NOT present it to the user as an empty answer, and SHALL NOT
record it as a completed turn.

Source: `spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED: an image sent to a model
without image input returned an empty stream with zero tokens and raised no exception, which is the one provider
failure the surrounding error handling cannot see.

#### Scenario: An empty stream returns from a text-only model
- **GIVEN** an image-bearing request reached a model that cannot read images
- **WHEN** the response completes with no content and no error
- **THEN** the request is classified as failed, the user is told the model returned nothing usable, and the job
  does not report success

#### Scenario: A legitimately short answer
- **WHEN** a model answers with a single short sentence
- **THEN** the response is a completed turn, because it carries content

### Requirement: Every provider failure is classified into a stated cause and a remedy

Every failure of a model request SHALL be classified into exactly one declared cause before it reaches the user,
SHALL carry with that classification the one action that repairs it, and SHALL NOT reach the user as
unclassified provider text or end a job with no explanation. How the classification is presented is owned by the
`uix` capability.

The declared causes are: the credential was refused, the model is not available on that profile, the account's
quota or rate limit is exhausted, the endpoint could not be reached, the response was unusable, and the profile
was written by a newer build.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) — VERIFIED against a real service:
a wrong credential, an unknown model name and an exhausted quota were each captured in the response stream
without crashing the runtime and each converted into a system card; `spikes/SP-17-provider-matrix/evidence/system-cards.json`.

#### Scenario: The credential is refused mid-job
- **GIVEN** a job is running
- **WHEN** the provider refuses the configured credential
- **THEN** the job fails with the cause named, and a SYSTEM card states that the credential was refused and
  offers the provider settings

#### Scenario: The assigned model name no longer resolves
- **WHEN** a request names a model the provider does not recognise
- **THEN** the cause is reported as the model being unavailable, and the card offers the routing settings for
  the role that named it

#### Scenario: The provider's quota is exhausted
- **WHEN** the provider reports that the account's quota or rate limit is exhausted
- **THEN** the card states that the limit belongs to the user's own provider account, and it is not presented as
  a fault of the product

#### Scenario: A cause the declared set does not cover
- **WHEN** a request fails in a way that matches none of the declared causes
- **THEN** it is classified as an unusable response carrying the provider's own words, and it still reaches the
  user with a remedy, rather than being passed through unclassified

### Requirement: Every model request records what it consumed

Every model request SHALL record, against the job it served, the role it served, the profile and model it
resolved to, the input and output token counts reported by the provider, and the time the request took; and
when the profile carries unit prices for that model, the record SHALL carry the cost computed from those prices
and the currency they were stated in.

The product SHALL NOT compute a cost from any price it did not receive from the user.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) — VERIFIED that per-role token
counts are obtainable and sum to a monthly figure; `spikes/SP-17-provider-matrix/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`
item 3. That the price is the user's rather than the product's was decided in `clarifications.md` session
2026-09-12.

#### Scenario: A job that used three roles
- **GIVEN** a job used the pet text, worker and risk judge roles
- **WHEN** the job ends
- **THEN** its record carries one usage entry per request, each naming its role, model and token counts

#### Scenario: No price is configured
- **GIVEN** the profile carries no unit prices for the model used
- **WHEN** the usage is recorded
- **THEN** the token counts are recorded and no cost is recorded, and nothing derives a cost from another
  model's prices

#### Scenario: The provider reports no token counts
- **WHEN** a provider returns a response without usage figures
- **THEN** the record states that usage was not reported for that request, rather than recording zero

### Requirement: The routing table follows the account and names what this device cannot serve

The routing table and the unit prices SHALL replicate to every device signed in to the account, provider
credentials SHALL NOT, and a role whose profile has no credential on this device SHALL be reported as
unusable on this device — naming the profile and the roles it holds — rather than being retargeted to another
profile.

Source: `docs/spec/constitution.md` principle VII for the replication of configuration;
`agent/contracts/provider-profile@0.1.0` for the credential's exclusion from replication. That the gap is
reported rather than routed around was decided in `clarifications.md` session 2026-09-12 — UNVERIFIED, this
being a product decision rather than a measurement.

#### Scenario: Signing in on a replacement device
- **GIVEN** the user configured six assignments on their first device
- **WHEN** they sign in on a replacement device
- **THEN** the six assignments are present, and the profiles show their credentials as absent

#### Scenario: A role's profile has no credential here
- **GIVEN** the worker role points at a profile whose credential is absent on this device
- **WHEN** the user hands over a command
- **THEN** the product states that the profile needs its credential on this device and names the roles waiting
  on it, and no request is sent

#### Scenario: Another profile does have a credential
- **GIVEN** one profile has a credential on this device and the profile the worker role points at does not
- **WHEN** the worker role is needed
- **THEN** the role is not retargeted to the profile that happens to be usable, because the user chose the model
  for that role

## MODIFIED Requirements

### Requirement: Model provider and role routing are configured on the client

The client SHALL let the user configure a provider profile carrying a credential for a named provider or a
custom endpoint that speaks a completion protocol the harness supports, SHALL NOT offer an interactive
provider sign-in, SHALL store provider credentials in operating-system secure storage, and SHALL hold the mapping
from role — pet text, pet image, worker, rule elicitation, undo, risk judge — to model as account-owned
configuration, populated on first configuration with defaults derived from the models the user's profiles offer
and changeable by the user without a new release.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-11) — the clause's interactive sign-in is
CORRECTED here: the embedded path exposes a per-provider credential and a custom endpoint descriptor and has no
interactive sign-in, and the harness's publisher sells no subscription — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q5, `spikes/SP-6-pi-sdk/REPORT.md#2-tac-dong-len-adr-prd` item 2). A custom
endpoint was exercised end to end against a third-party service for a strong model, a cheap model and a vision
model — VERIFIED (same section). The role list is extended here from four to six: the pet's image handling is a
role of its own because two text models refused images outright, and the risk judge is a role because it is a
model call the product makes on its own account — VERIFIED
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q1,
`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`). The mapping is account-owned rather than device configuration
under `docs/spec/constitution.md` principle VII.

#### Scenario: Changing the worker model
- **WHEN** the user selects a different model for the worker role
- **THEN** jobs created afterwards use that model, with no application update required

#### Scenario: Credential is rejected by the provider
- **WHEN** a configured credential is refused by the provider
- **THEN** a SYSTEM card reports the provider failure and points at the provider settings

#### Scenario: No provider is configured
- **GIVEN** no provider has been configured
- **WHEN** the user hands over a command
- **THEN** the product states that a provider must be configured and offers the settings, rather than failing a
  job silently

#### Scenario: A custom endpoint is configured
- **GIVEN** the user supplies an endpoint address, a credential and a model name for a service that speaks the
  supported completion protocol
- **WHEN** a job runs against that profile
- **THEN** it reasons, calls tools and accepts images through that endpoint without any change to the product

#### Scenario: The user looks for an interactive provider sign-in
- **WHEN** the user opens provider settings
- **THEN** the product offers a credential and a custom endpoint, and states that no interactive sign-in exists
  rather than presenting one that cannot work

#### Scenario: Defaults are proposed when the first profile is saved
- **WHEN** the user saves their first profile
- **THEN** all six roles are given assignments drawn from that profile's models, and the user is shown what was
  assigned to each role before it takes effect

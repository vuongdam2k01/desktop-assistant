## ADDED Requirements

### Requirement: The pet acknowledges a handed-over command before any model answers

When the user sends a command, the pet SHALL present an acknowledgement within 200 milliseconds, drawn from the
acknowledgement line set of its persona specification and requiring no network request, and SHALL enter its
working state while the model request that answers the command is outstanding.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) — VERIFIED that no measured model
holds the two-second commitment for every input shape: the fastest text model answered at a median of 1,958 ms
with a ninetieth percentile of 3,110 ms, and the vision model answered an image at a median of 6,655 ms with a
ninetieth percentile of 19,693 ms;
`spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd` item 3 recommends the local acknowledgement,
which involves no network and was measured at 50 ms in the spike's own reckoning. The 200 millisecond ceiling in
this requirement is the product-level budget covering queue placement and rendering as well as the line itself,
and is UNVERIFIED until measured in the packaged product.

#### Scenario: A text command on a slow network
- **GIVEN** the network is slow enough that the model's first token takes eight seconds
- **WHEN** the user sends a text command
- **THEN** the acknowledgement is presented within 200 milliseconds and the pet is in its working state while
  the answer is outstanding

#### Scenario: A command carrying an image
- **GIVEN** the pet image role is assigned and the model's median answer takes over six seconds
- **WHEN** the user sends a command with an image attached
- **THEN** the acknowledgement is presented within 200 milliseconds, and the pet stays in its working state
  until the answer arrives rather than appearing idle

#### Scenario: No provider is configured at all
- **GIVEN** no role has a usable assignment
- **WHEN** the user sends a command
- **THEN** the acknowledgement is not presented, and the product states that a provider must be configured,
  because an acknowledgement for work that cannot start would be a promise the product cannot keep

#### Scenario: The request fails immediately
- **GIVEN** an acknowledgement has been presented
- **WHEN** the provider refuses the credential one second later
- **THEN** the failure reaches the user as a SYSTEM card, and the acknowledgement is not retracted or rewritten
  into an error

## MODIFIED Requirements

### Requirement: All pet-visible text originates from the pet-agent

Every message the pet presents SHALL be produced by the pet-agent under its persona specification, and the
product SHALL NOT emit hardcoded notification strings through the pet surface. The single exception is the
acknowledgement line set: lines authored and localised as part of the persona specification, which the product
may present without a model, and which SHALL state receipt only — naming nothing from the command, asserting no
understanding of it, and promising no outcome.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-10) — UNVERIFIED. The exception is
added because the two-second commitment cannot survive a measured median of 6,655 ms for an image command —
VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q2) — and its scope was fixed in
`clarifications.md` session 2026-09-12: the requirement exists so the pet has one voice and so system
notifications cannot bypass the persona, and a receipt line that carries no meaning about the request does
neither.

#### Scenario: Result announcement is generated
- **WHEN** a job completes and the pet announces the result
- **THEN** the announcement text was produced by the pet-agent for this job rather than selected from a fixed
  string table

#### Scenario: Pet-agent is unavailable
- **GIVEN** the configured model provider cannot be reached
- **WHEN** an event would normally make the pet speak
- **THEN** the event is surfaced as a SYSTEM card reporting the provider failure, and no fabricated persona text
  is shown

#### Scenario: An acknowledgement line claims to have understood
- **WHEN** an acknowledgement line is reviewed that names an entity from the command or states what the product
  will do about it
- **THEN** it does not belong to the acknowledgement line set, because only the model that has read the command
  may say anything about it

#### Scenario: The line set is missing for the active language
- **GIVEN** the persona specification carries no acknowledgement lines for the language in force
- **WHEN** the user sends a command
- **THEN** the product presents the acknowledgement in its fallback language rather than presenting a string
  composed outside the persona specification

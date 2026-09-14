## ADDED Requirements

### Requirement: An account pack replicates whole, and a built-in template does not replicate

Replication SHALL carry an account pack in full — its manifest, its persona and its animation asset together —
and SHALL NOT carry built-in templates, which reach a device through the product's own distribution instead.

Source: `docs/spec/constitution.md` principle VII, and the decision-maker directive 2026-09-13 recorded in
`proposal.md` — UNVERIFIED. A template is supplied by the product rather than owned by the account, so
replicating it would send the same bytes to every account that already receives them with the product.

#### Scenario: A pack created on one device appears on another
- **GIVEN** the user creates an account pack on one device
- **WHEN** they sign in on a second device
- **THEN** the pack is present in the account's library there, ready to activate, without the user transferring
  a file

#### Scenario: A pack arrives without its asset
- **WHEN** an account pack's manifest and persona replicate but its animation asset has not yet arrived
- **THEN** the pack is listed as still arriving and cannot be activated, rather than being activated and
  presenting no character

#### Scenario: Built-in templates are not counted as account data
- **WHEN** the replicated set is enumerated
- **THEN** built-in templates are absent from it, and the account's own packs are present

### Requirement: A replicated pack is bounded in size

An account pack SHALL be refused at creation when its animation asset exceeds 5 megabytes, so that replication
of a pack remains a record-sized transfer.

Source: `clarifications.md` session 2026-09-13 — UNVERIFIED. The figure is roughly ten times the under-500
kilobyte budget `req-005-electron-rive-pet-render` sets for the shipped asset, chosen so a detailed character
fits while the replication envelope needs no separate blob transfer channel.

#### Scenario: An oversize asset never reaches replication
- **WHEN** the user supplies an animation asset larger than the ceiling
- **THEN** no pack is created, and nothing of it is offered for replication

#### Scenario: A pack at the ceiling replicates
- **GIVEN** an account pack whose asset is at the ceiling
- **WHEN** the user signs in on another device
- **THEN** the pack arrives complete and is activatable

## MODIFIED Requirements

### Requirement: The replicated set is exactly the account-owned stores

Replication SHALL carry jobs, ledger records and their snapshots, approval rules, provider and application
configuration, connector authorisation, agent transcripts, and the account's own pet packs; and SHALL NOT carry
data outside that set.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED. Modified by `req-024-pet-pack-framework`: the
account's own pet packs join the set, which widens what replication carries from records alone to records and a
bounded binary asset. The pet's on-screen placement stays device-local and is unaffected, because where a pet
sits on a screen is a property of that screen rather than of the account.

#### Scenario: A device-local concern is not replicated
- **WHEN** the replicated set is enumerated
- **THEN** device-local concerns such as window position, the pet's on-screen placement and the local cache of
  update artifacts are absent from it

#### Scenario: Transcripts follow the ledger's retention
- **GIVEN** the ledger retention period has elapsed for a job's records
- **WHEN** retention is applied
- **THEN** that job's transcript is removed with its ledger records on every device and on the backend, rather
  than persisting after the records it belongs to

#### Scenario: The choice of active pack follows the account
- **GIVEN** the user activates a pack on one device
- **WHEN** they sign in on another device
- **THEN** the same pack is active there, because which pet the user has is part of the account's configuration
  rather than a property of a machine

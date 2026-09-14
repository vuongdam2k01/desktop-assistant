## ADDED Requirements

### Requirement: The backend serves the catalogue of built-in pet templates

The backend SHALL serve the catalogue of built-in pet templates the product supplies, and SHALL serve it to any
client holding a session without the catalogue being part of that account's replicated data.

Source: decision-maker directive 2026-09-13, recorded in `proposal.md` — UNVERIFIED. Templates are served
rather than replicated because they belong to the product and are identical for every account, so replicating
them would carry the same bytes into every account's store.

#### Scenario: A client requests the catalogue
- **WHEN** a client holding a session requests the catalogue
- **THEN** it receives the templates the product currently supplies, each with its identity, its declared
  capabilities and the contract revision it targets

#### Scenario: A client too old for a template
- **GIVEN** a template targets a contract revision the requesting client does not implement
- **WHEN** the client requests the catalogue
- **THEN** the template is still described, and the client is able to determine that it cannot be activated on
  this version rather than discovering it at activation

#### Scenario: The catalogue is unavailable
- **WHEN** the catalogue cannot be served
- **THEN** the client continues to run using the templates it already holds, and reports that the catalogue
  could not be refreshed

### Requirement: The backend stores an account's pet packs as bounded encrypted payloads

The backend SHALL store an account's pet packs as part of that account's replicated data, encrypted at rest
under service-managed keys like every other replicated store, and SHALL refuse a pack payload exceeding the
declared per-pack ceiling.

Source: `docs/spec/constitution.md` principle VII; ceiling from `clarifications.md` session 2026-09-13 —
UNVERIFIED. No spike has measured a replication store holding binary payloads, which is why the ceiling exists
rather than a measured throughput figure.

#### Scenario: A pack is stored and served back
- **GIVEN** a device replicates an account pack
- **WHEN** another device signed in to the same account requests the account's data
- **THEN** the pack is served to it complete, and is readable only through the replication path

#### Scenario: A payload over the ceiling
- **WHEN** a client offers a pack payload exceeding the ceiling
- **THEN** the backend refuses it and states the ceiling, rather than storing it

#### Scenario: A pack is not readable from the database alone
- **WHEN** the database's stored contents are read without the encryption keys
- **THEN** no pack manifest, persona text or animation asset is readable from them

### Requirement: Deleting the account destroys its pet packs

Deleting an account SHALL destroy the pet packs stored for it, and SHALL leave the catalogue of built-in
templates unaffected.

Source: `docs/spec/constitution.md` principle VII — UNVERIFIED. Stated separately because a pack is the first
replicated store holding a binary payload, and the deletion obligation must be shown to reach it.

#### Scenario: Account deletion removes stored packs
- **WHEN** an account is deleted
- **THEN** the pet packs stored for it are destroyed with the rest of its replicated data

#### Scenario: Templates survive an account deletion
- **WHEN** an account is deleted
- **THEN** the catalogue of built-in templates is unchanged, because it is the product's data rather than the
  account's

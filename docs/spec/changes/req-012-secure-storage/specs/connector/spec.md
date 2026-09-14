## ADDED Requirements

### Requirement: A connector's authorisation is persisted only through the device's credential store

A connector SHALL persist its authorisation — access token, refresh token, expiry, granted scopes, the platform
metadata that identifies the workspace or account it was issued for, and any authorisation client the user
supplied themselves — only through the device's secure credential store, and SHALL NOT write any part of it to a
configuration file, the ledger, a log, an exported diagnostic bundle or an agent's context.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-08, FR-CF-11),
`docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-01),
`spikes/SP-11-secure-storage/REPORT.md` §1 Q5 — VERIFIED for the storage route, which held each of the four
credential groups the product has, including a user-supplied authorisation client of about four hundred bytes,
under its own key.

#### Scenario: A platform is connected
- **WHEN** a connector's authorisation completes
- **THEN** the tokens, their expiry and the granted scopes are written through the credential store, and no part
  of them is present in any configuration file the user or a tool can read

#### Scenario: The user supplies their own authorisation client
- **GIVEN** the user completed the bring-your-own authorisation route for a connector
- **WHEN** the client credentials they supplied are kept for later use
- **THEN** they are written through the credential store under that connector's keys, and the file the user
  provided them in is not retained afterwards

#### Scenario: A token is refreshed during a job
- **WHEN** a connector refreshes its access token mid-job
- **THEN** the refreshed value replaces the stored one through the credential store, and the ledger record for
  the job's calls shows the refresh happened without carrying the token

#### Scenario: Authorisation is abandoned part-way
- **GIVEN** the user closed the platform's authorisation page without completing it
- **WHEN** the connector returns to the disconnected state
- **THEN** no partial credential is written, so nothing is left under that connector's keys

#### Scenario: A diagnostic bundle is exported
- **WHEN** the user exports a diagnostic bundle to report a problem with a connector
- **THEN** it states which connectors are connected and when their authorisation was last updated, and contains
  no token, refresh token or client secret

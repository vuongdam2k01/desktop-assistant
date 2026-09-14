## ADDED Requirements

### Requirement: Deleting the account withdraws its connector authorisations at the providers

Deleting an account SHALL call the revocation endpoint of every provider the account holds an authorisation for
before the account's records are destroyed, SHALL record for each provider whether the withdrawal succeeded, and
where a provider offers no revocation endpoint SHALL tell the user which platform they must withdraw the
authorisation in themselves.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12),
`spikes/SP-11-secure-storage/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 4 — VERIFIED as the required
sequence, which pairs the device-side erasure with server-side withdrawal; RISK-058 records the platform that
offers no revocation endpoint, so the second half of this requirement is not hypothetical.

#### Scenario: Every connected provider is withdrawn from
- **WHEN** an account holding authorisations for several platforms is deleted
- **THEN** each platform's revocation endpoint is called before the account's records are destroyed

#### Scenario: A provider offers no revocation endpoint
- **WHEN** the account holds an authorisation for a platform that offers no revocation endpoint
- **THEN** the deletion proceeds and the user is told, by name, which platform they must withdraw the
  authorisation in themselves

#### Scenario: A revocation call fails
- **WHEN** a provider's revocation endpoint refuses or cannot be reached
- **THEN** the deletion still proceeds, the failure is recorded against that provider, and the user is told which
  authorisations could not be withdrawn on their behalf

#### Scenario: Every device is offline when the account is deleted
- **GIVEN** no device signed in to the account is reachable
- **WHEN** the account is deleted
- **THEN** the withdrawals are performed from the server without waiting for any device, and each device erases
  its own copy when it next starts

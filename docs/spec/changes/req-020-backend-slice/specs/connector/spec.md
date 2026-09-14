## ADDED Requirements

### Requirement: The authorisation code returns to the device on a loopback address it opened

The device SHALL receive the provider's redirect on a loopback address it is listening on, SHALL complete the
exchange through the broker without further user action, and SHALL show the connector as connected.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) — VERIFIED: the browser redirected to
a loopback address, the device sent the code to the broker on its own, and the interface moved to connected
without the user returning to it manually.

#### Scenario: Provider redirects back after the user authorises
- **GIVEN** the device is listening on the loopback address it supplied with the authorisation request
- **WHEN** the provider redirects to that address carrying an authorisation code
- **THEN** the device exchanges it through the broker and shows the connector as connected, with no further user
  action

#### Scenario: Provider redirects back with a refusal
- **WHEN** the redirect carries a refusal instead of an authorisation code
- **THEN** the connector returns to disconnected with the provider's reason presented, and no exchange is
  attempted

#### Scenario: Redirect arrives for a request this device did not start
- **WHEN** a redirect arrives on the loopback address carrying a binding value the device did not issue
- **THEN** it is discarded, no exchange is attempted, and the connector's state is unchanged

#### Scenario: The loopback address cannot be opened
- **WHEN** the device cannot listen on a loopback address
- **THEN** Connect fails before the browser is opened, stating that the authorisation cannot be completed on this
  device, and no partial authorisation is left behind

#### Scenario: The user never returns from the browser
- **GIVEN** the browser is open at the provider's page and the device is listening
- **WHEN** no redirect arrives within the waiting period
- **THEN** the device stops listening, the connector returns to disconnected, and Connect can be started again

### Requirement: A connector using the product's authorisation client holds no client secret on the device

A connector that authorises through the product's own authorisation client SHALL obtain its tokens through the
backend's broker, and the client secret for that provider SHALL NOT be present in the installed application, its
configuration or its logs.

Source: `spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3, Q7) — VERIFIED: the exchange is
performed server-side with a secret loaded from outside the source tree, and a scan of source and generated logs
found no leak. The bring-your-own route specified by `req-014-byo-oauth-google` is the deliberate exception: the
user's own credentials are supplied by the user and are held in the device's secure storage under
`req-012-secure-storage`.

#### Scenario: Installed application is inspected for provider credentials
- **WHEN** the installed application and its configuration are searched for provider client secrets
- **THEN** none is found, because the exchange that needs one happens on the server

#### Scenario: The device cannot reach the broker
- **WHEN** the device attempts to connect a platform that uses the product's authorisation client while the
  broker is unreachable
- **THEN** Connect fails stating the service is unavailable, and the device does not fall back to any
  device-side exchange

## MODIFIED Requirements

### Requirement: Connecting is the same for every connector and asks nothing technical

Connecting any connector SHALL follow one flow — choose the application from the catalogue, activate Connect,
authorise in the platform's own page in the browser, return to a connected state — SHALL route the code exchange
through the backend's broker so the provider's client secret stays on the server, and SHALL NOT ask the user to
paste a token, enter a client identifier or configure a redirect address.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-02),
`spikes/SP-20-backend-slice/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) — VERIFIED: the standard connect flow cost the
user three actions, one in the application and two on the provider's own page, with no technical step among
them.

#### Scenario: User connects a second platform
- **WHEN** the user connects a platform they have never connected before
- **THEN** the steps presented are identical to the first connector's, apart from the platform's own
  authorisation page

#### Scenario: User abandons the authorisation page
- **GIVEN** the browser is open at the platform's authorisation page
- **WHEN** the user closes it without authorising
- **THEN** the connector returns to the disconnected state with an explanation and no partial credential is kept

#### Scenario: Connect asks for nothing the user has to look up
- **WHEN** the user completes Connect for a platform using the product's authorisation client
- **THEN** every action is a choice or a confirmation, and at no point is the user asked for a token, a client
  identifier or a redirect address

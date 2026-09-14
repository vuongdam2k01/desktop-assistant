## ADDED Requirements

### Requirement: The bring-your-own setup runs as ordered steps inside the application

The connectors area SHALL present the bring-your-own setup as an ordered sequence of steps declared by the
connector — each with what to do, the provider page it concerns opened in the system browser, and a confirmation
the user gives before the next step appears — SHALL remember the step the user reached so the sequence can be
resumed after the window is closed, and SHALL NOT send the user to a document outside the application to work any
step out.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-11),
`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7),
`spikes/SP-13-byo-oauth-google/evidence/byo-setup-guide-draft.md` — VERIFIED as the content of the sequence: six
steps in the provider's console, then supplying the credential file and passing the browser consent. That a
resumable in-application sequence carries a non-technical user through it is UNVERIFIED and is listed for a
manual check in `verification.md`.

#### Scenario: The user works through the sequence
- **WHEN** the user starts the bring-your-own setup
- **THEN** one step is presented at a time, in order, and the next appears only after the current one is
  confirmed

#### Scenario: The user closes the window mid-setup
- **GIVEN** the user has confirmed four of the steps
- **WHEN** the application window is closed and reopened
- **THEN** the setup resumes at the fifth step rather than at the first

#### Scenario: A step's provider page is opened
- **WHEN** the user activates the link a step carries
- **THEN** the page opens in the system browser and the step stays visible in the application, so the user can
  return to it without losing their place

#### Scenario: The credential file step is reached with an invalid file
- **WHEN** the user supplies a file the connector refuses
- **THEN** the reason is shown on that step with the earlier step that produces a correct file named, and the
  sequence does not advance

### Requirement: The setup states what it will cost the user before the first step

Before the first step of the bring-your-own setup, the application SHALL state how many steps there are, that the
provider will show a warning screen for an unverified client and that passing it is expected, and that the
connection will need to be re-established periodically for as long as the user's client stays unverified.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5, Q7),
`spikes/SP-13-byo-oauth-google/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED: the provider's warning screen is
reached through a deliberately discouraging path — a prominent return-to-safety control, with the way forward
behind a secondary link — and the seven-day lifetime is standard for an unverified client rather than a fault the
product can remove.

#### Scenario: The route is offered
- **WHEN** the bring-your-own route is offered for a connector
- **THEN** the step count, the warning screen and the periodic reconnection are stated before the user commits to
  the first step

#### Scenario: The user declines after reading what it costs
- **WHEN** the user leaves without starting the sequence
- **THEN** nothing is stored and the connector stays exactly as it was

## MODIFIED Requirements

### Requirement: The application window holds four areas

The application window SHALL provide a connectors area listing every available platform with its connection
state, its connect, reconnect and disconnect actions, and — where the platform declares one — the route in which
the user supplies their own authorisation client; a jobs area with the list and the detail view; an approval area
with the mode, the rules and the waiting queue; and a settings area covering the pet, notifications, launch at
login, and the account with its sync state and enrolled devices.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-01),
`docs/spec/changes/req-022-account-sync/proposal.md`,
`spikes/SP-13-byo-oauth-google/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` — UNVERIFIED for the areas themselves;
the bring-your-own route belongs in the connectors area because it is a way of connecting a platform, and it is
offered only for platforms whose data declares it.

#### Scenario: Every waiting decision is reachable in one place
- **WHEN** any approval or question is waiting
- **THEN** it is present in the approval area regardless of which surface raised it

#### Scenario: A platform that is not yet connected
- **WHEN** the connectors area is opened
- **THEN** platforms that are available but not connected are listed with a connect action, not hidden

#### Scenario: Reaching the account's devices
- **WHEN** the user opens the settings area
- **THEN** the account's sync state and its enrolled devices are reachable there

#### Scenario: A platform offering the bring-your-own route
- **WHEN** the connectors area shows a platform whose data declares the bring-your-own route
- **THEN** that route is offered beside the standard connect action, and for a platform that declares no such
  route it is absent

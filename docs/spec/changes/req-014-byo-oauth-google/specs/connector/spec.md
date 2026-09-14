## ADDED Requirements

### Requirement: The Google connector authorises with an authorisation client the user created

The Google connector SHALL, on the bring-your-own route, perform the whole authorisation with the authorisation
client the user created in the provider's console — opening the provider's page in the system browser under that
client's identity and exchanging the returned code against it on the device — and SHALL NOT route that exchange
through the backend's broker or present the product's own authorisation client anywhere in the flow.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1),
`spikes/SP-13-byo-oauth-google/evidence/q1_loopback_run.log` — VERIFIED: the device opened the system browser
against a user-created client, received the code on its own listener, exchanged it at the provider's token
endpoint without a server in the path, and then read real data from both Gmail and Drive with the resulting
token. `docs/spec/constitution.md` principle VIII — the route is an official in-app flow, not a developer
shortcut.

#### Scenario: The user completes the bring-your-own route
- **GIVEN** the user has supplied an authorisation client for Google
- **WHEN** the user activates Connect
- **THEN** the system browser opens at the provider's page under that client, and on the user's consent the
  connector reaches connected without the user returning to the application to finish anything

#### Scenario: The broker is never asked about a user-supplied client
- **WHEN** the bring-your-own route completes an exchange
- **THEN** no request carrying the user's client identifier or client secret leaves the device for the product's
  backend

#### Scenario: The backend is unreachable during a bring-your-own connect
- **GIVEN** the product's backend cannot be reached
- **WHEN** the user connects Google through their own authorisation client
- **THEN** Connect completes, because nothing in this route depends on the backend

### Requirement: The device chooses its loopback port at the moment it connects

The bring-your-own route SHALL listen for the provider's redirect on a loopback port acquired when Connect starts
rather than on a port fixed in advance, and SHALL NOT require the user to register that port, or any port, with
the authorisation client they created.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2),
`spikes/SP-13-byo-oauth-google/evidence/q2_dynamic_ports.log` — VERIFIED: a client declaring only
`http://localhost` accepted authorisation requests on three unrelated ports, on both loopback host forms and with
no port at all, while an address the client had not registered was refused. The behaviour is the desktop-client
rule of RFC 8252 §7.3, confirmed by measurement rather than assumed from it.

#### Scenario: The chosen port is already taken
- **GIVEN** another process holds the port the device would have used
- **WHEN** Connect starts
- **THEN** a different free port is acquired and the flow proceeds, without asking the user to change anything

#### Scenario: No loopback port can be acquired
- **WHEN** the device cannot listen on any loopback port
- **THEN** Connect fails before the browser is opened, stating that the authorisation cannot be completed on this
  device, and no partial authorisation is left behind

#### Scenario: Setup never mentions a port
- **WHEN** the user is guided through creating their authorisation client
- **THEN** no step asks them to enter a redirect address or a port number

### Requirement: A supplied authorisation client is checked before the browser is opened

The connector SHALL accept the authorisation client the user supplies only after confirming that it carries the
identifiers the flow needs and that it is of the desktop kind the loopback route requires, and SHALL report what
is wrong with a client it refuses, naming the step of the guide that produces a correct one.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2, Q7),
`spikes/SP-13-byo-oauth-google/evidence/byo-setup-guide-draft.md#6-xu-ly-cac-su-co-thuong-gap` — VERIFIED for the
distinction that matters: the desktop-kind client accepted an unregistered loopback port, and an address outside
what a client registers was refused by the provider with a mismatch error, which is the failure a client of the
wrong kind produces after the user has already left for the browser.

#### Scenario: A client of the wrong kind is supplied
- **WHEN** the user supplies an authorisation client that is not of the desktop kind
- **THEN** it is refused before the browser opens, stating that the loopback route needs a desktop client and
  which step of the guide creates one

#### Scenario: A file that is not an authorisation client at all
- **WHEN** the user supplies a file that does not carry an authorisation client
- **THEN** it is refused naming what was missing, the connector stays disconnected, and nothing is stored

#### Scenario: A valid client replaces one already stored
- **GIVEN** an authorisation client is already stored for Google
- **WHEN** the user supplies a different valid one
- **THEN** the stored tokens obtained under the previous client are discarded with it, because they were issued
  to a client that is no longer in use

### Requirement: A consent that grants less than was asked for does not present as connected

When the provider returns an authorisation whose granted scopes are narrower than the selected profile requested,
the connector SHALL record what was granted, SHALL present itself as needing wider permission naming the
capabilities that are unavailable, and SHALL NOT present as connected or offer the tools whose scope was
withheld.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5),
`spikes/SP-13-byo-oauth-google/evidence/ui_scope_consent.svg` — VERIFIED: the provider's consent screen presents
each requested scope as an individually selectable box, so a consent that grants one and withholds the other is
an ordinary outcome of the screen the user is shown rather than an exceptional one.

#### Scenario: The user grants mail and withholds files
- **GIVEN** the profile requested reading mail and reading files
- **WHEN** the user ticks only the mail permission and continues
- **THEN** the connector reports that file reading is unavailable until permission is granted, offers re-consent,
  and the file-reading tools are absent from the tool set

#### Scenario: The user withholds everything
- **WHEN** the user continues having ticked nothing
- **THEN** the connector returns to disconnected with the reason, and no authorisation is stored

#### Scenario: Re-consent widens an existing authorisation
- **GIVEN** the connector is short of one capability's scope
- **WHEN** the user completes re-consent granting it
- **THEN** the connector reaches connected and the previously absent tools appear in the next job's tool set

### Requirement: An account the user's own client does not admit is reported as the client's restriction

When the provider refuses the authorisation because the signing-in account is not admitted by the user's own
authorisation client, the connector SHALL report that the client admits only the accounts listed on it and point
at the step of the guide where accounts are listed, and SHALL NOT present the refusal as a fault of the product
or of the account.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5),
`spikes/SP-13-byo-oauth-google/evidence/byo-setup-guide-draft.md#6-xu-ly-cac-su-co-thuong-gap` — VERIFIED: an
account outside the client's list is refused by the provider with an access-denied error at the account-chooser
step, before any consent is shown.

#### Scenario: The user signs in with an account the client does not list
- **WHEN** the provider refuses with an access-denied outcome at the account chooser
- **THEN** the connector explains that this account is not listed on the user's own authorisation client and
  names the guide step that lists accounts

#### Scenario: The user authorises a different account from the one they use in the product
- **WHEN** the authorisation completes for an account other than the one previously connected
- **THEN** the connector records the account the authorisation was issued for and states it, so a mailbox the
  user did not expect is visible as such rather than silently in use

### Requirement: A refused renewal under the user's own client is an expired connector, not a lost one

When the provider refuses to renew an authorisation obtained through the user's own client, the connector SHALL
move to the expired state carrying the instant of the refusal and the provider's own reason, SHALL keep the
stored authorisation client, and SHALL NOT erase the connector, discard the user's client credentials, or present
the failure as a revocation performed by the user.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3),
`spikes/SP-13-byo-oauth-google/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED that renewal succeeds while the
authorisation is inside the provider's window for an unverified client, and that the seven-day window is the
provider's standard behaviour for such a client rather than a defect. The precise refusal the provider returns at
the end of that window is UNVERIFIED and is scheduled for measurement in `verification.md`.

#### Scenario: Renewal is refused mid-job
- **GIVEN** a job is calling a Google tool
- **WHEN** renewal of the authorisation is refused
- **THEN** the job fails stating that the Google connector must be reconnected, and the connector is shown as
  expired with a reconnect action

#### Scenario: The provider cannot be reached during renewal
- **WHEN** the renewal request does not reach the provider
- **THEN** the connector is not moved to expired, because nothing was established about the authorisation

#### Scenario: Expiry is expected rather than surprising
- **WHEN** the connector becomes expired under an unverified client
- **THEN** the reason shown is the one the user was warned of at setup, stated in the same words

### Requirement: Reconnecting under the user's own client never asks for the credential file again

Reconnecting a connector authorised through the user's own client SHALL reuse the stored authorisation client and
run only the browser consent, and SHALL NOT ask the user to supply the credential file, repeat any step performed
in the provider's console, or re-enter anything they entered at first setup.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` — VERIFIED as the specified
shape of the one-click reconnect; the stored client is what the flow needs and it is already held.
`docs/spec/constitution.md` principle VII — the user carries nothing between reconnections, as they carry nothing
between machines.

#### Scenario: Reconnect after the seven-day window
- **GIVEN** the connector is expired because renewal was refused
- **WHEN** the user activates reconnect
- **THEN** the browser opens at the provider's consent page under the stored client, and on consent the connector
  returns to connected

#### Scenario: The stored authorisation client is gone
- **GIVEN** the stored authorisation client cannot be read
- **WHEN** the user activates reconnect
- **THEN** the guide is offered from the step that supplies the credential file, rather than a consent that
  cannot succeed being attempted

#### Scenario: Reconnect is abandoned
- **WHEN** the user closes the provider's page without consenting
- **THEN** the connector stays expired with its reconnect action, and the stored authorisation client is
  untouched

### Requirement: The authorisation client the user supplied belongs to the account, not to the device

An authorisation client supplied by the user SHALL be held as part of that connector's account-owned
authorisation, so that signing in on another device makes the Google connector usable there without repeating any
step performed in the provider's console, and disconnecting the connector SHALL erase the supplied client with
the tokens obtained under it.

Source: `docs/spec/constitution.md` principle VII; `docs/spec/changes/req-012-secure-storage/specs/connector/spec.md`;
`spikes/SP-11-secure-storage/REPORT.md` §1 Q5 — VERIFIED for the storage route, which held a user-supplied
authorisation client of about four hundred bytes under its own key. That the second device needs no console work
follows from the client being data the account holds — UNVERIFIED, and listed for measurement in
`verification.md`.

#### Scenario: The user signs in on a second device
- **GIVEN** Google was connected through the user's own client on one device
- **WHEN** the user signs in to the account on another device and replication completes
- **THEN** Google is usable there with no return to the provider's console

#### Scenario: The connector is disconnected
- **WHEN** the user disconnects Google
- **THEN** the supplied authorisation client is erased along with the tokens, on every device the account reaches

#### Scenario: A device has not yet replicated the client
- **WHEN** the connectors area is opened on a device that does not hold the account's Google authorisation yet
- **THEN** Google is shown as unavailable on this device, and the bring-your-own guide is not offered as though
  the client had to be created again

### Requirement: A Drive file is read by the route its type declares

The Drive connector SHALL read a file through the route declared for its type — exporting a document or
spreadsheet to the text form declared for it, and downloading a stored file directly — and SHALL report the type
as unsupported when no route is declared for it rather than returning empty content.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6),
`spikes/SP-13-byo-oauth-google/evidence/q6_drive_export_read.log` — VERIFIED: a spreadsheet exported to delimited
text returned its real columns, the same spreadsheet exported to a document format returned a document, and
stored files of several types downloaded directly, all under an authorisation carrying only the read scope.

#### Scenario: A spreadsheet is read
- **WHEN** a job reads a spreadsheet
- **THEN** it receives the delimited text form declared for spreadsheets, not an opaque document

#### Scenario: A stored file is read
- **WHEN** a job reads a file the platform stores rather than computes
- **THEN** it is downloaded directly rather than exported

#### Scenario: A type with no declared route
- **WHEN** a job reads a file of a type no route is declared for
- **THEN** the connector reports the type as unsupported and names it, and no partial content is returned

### Requirement: A file that exceeds the ceiling of its route is refused with the ceiling named

Reading a Drive file SHALL be refused when it exceeds the ceiling declared for its route, and the refusal SHALL
state the ceiling and which route it belongs to, so that the user learns the file is too large rather than that
the connector failed.

Source: `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) — VERIFIED that a stored file of
30,749,685 bytes downloaded successfully, so the ceiling this product applies to a direct download is a product
decision rather than a platform limit. The platform's own export ceiling and the error it returns above it are
UNVERIFIED, taken from provider documentation and listed for measurement in `verification.md`.

#### Scenario: A stored file above the product's ceiling
- **WHEN** a job reads a stored file larger than the declared download ceiling
- **THEN** the read is refused stating the ceiling, and nothing is loaded into the job

#### Scenario: An export the platform refuses for size
- **WHEN** the platform refuses an export because the exported form would exceed its own ceiling
- **THEN** the connector reports that the document is too large to export and states the platform's ceiling,
  rather than reporting a generic platform failure

#### Scenario: A file whose size the platform does not state
- **WHEN** a file's size is not known before the read begins
- **THEN** the read stops at the ceiling and is reported as exceeding it, rather than being allowed to continue
  because the size was unknown

### Requirement: A Google capability that was never exercised is declared absent rather than offered

The Google connector SHALL declare only the capabilities that were exercised against the provider through a real
authorisation, and a capability that was not SHALL be absent from the manifest so that no tool for it is
generated, rather than being offered on the strength of the provider's documentation.

Source: `docs/spec/constitution.md` Evidence Discipline;
`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1, Q6) — VERIFIED for listing and reading
messages, and for listing, exporting and downloading files. `spikes/SP-13-byo-oauth-google/REPORT.md#5-chua-tra-loi-duoc-vi-sao`
records what the spike could not exercise.

#### Scenario: An unexercised capability is requested
- **WHEN** the user asks for something the connector declares no tool for
- **THEN** the agent reports that the capability is not available, because no such tool exists in the manifest

#### Scenario: Scope is not requested for an absent capability
- **WHEN** the bring-your-own consent is presented
- **THEN** it asks only for the scopes of the declared capabilities, so the user is not asked to grant more than
  the product can use

## MODIFIED Requirements

### Requirement: Bring-your-own authorisation client is a first-class connect route

The product SHALL offer, per connector, a route in which the user supplies their own authorisation client
credentials, SHALL guide that setup step by step inside the application, SHALL warn before the first step about
the refresh-token lifetime that applies while the user's own client is unverified and about the provider warning
screen the user will have to pass, and SHALL declare the route's availability and its guidance as connector data
rather than as a screen written for one platform.

Source: `docs/raw-idea/prd-mvp.md#10-10-module-connector-framework-cf` (FR-CF-11),
`docs/raw-idea/prd-mvp.md#13-6-chien-luoc-phat-hanh-khi-hoan-track-casa-quyet-dinh-oq-15`,
`spikes/SP-13-byo-oauth-google/REPORT.md#0-ket-luan` — VERIFIED: the route completes end to end on a supported
operating system, and the setup it asks of the user is six steps in the provider's console followed by two in the
application, with four actions on the provider's pages including one warning screen
(`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q5, Q7).

#### Scenario: Guided setup inside the application
- **WHEN** the user chooses the bring-your-own route for a Google connector
- **THEN** the application presents each step in order and accepts the credential file, without sending the user
  to documentation to work it out

#### Scenario: Refresh token expires under an unverified client
- **GIVEN** the user's own client is in a testing state where refresh tokens expire after seven days
- **WHEN** the token expires
- **THEN** the connector shows as expired with a one-action reconnect, and the user was warned of this at setup

#### Scenario: The user is told what the route costs before starting it
- **WHEN** the bring-your-own route is offered
- **THEN** the number of steps, the warning screen the provider shows for an unverified client, and the
  reconnection the user will have to perform periodically are stated before the first step

#### Scenario: A connector that does not offer the route
- **WHEN** a connector whose data does not declare the bring-your-own route is opened
- **THEN** the route is not offered for it, and the standard connect flow is the only one presented

### Requirement: Google Drive is read-only in this scope

The Google Drive connector SHALL support finding files, reading metadata and reading content through the route
declared for each file type, and SHALL NOT create, modify, delete or share files.

Source: `docs/raw-idea/prd-mvp.md#10-11-module-connector-gmail-gm-amp-google-drive-dr` (FR-DR-01, FR-DR-02),
`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) — VERIFIED for reading: more than forty
files were listed, a spreadsheet was exported to two forms and stored files were downloaded, all under an
authorisation carrying only the read scope, which is also why no write tool can be generated for this connector.

#### Scenario: Unsupported format
- **WHEN** a file's format cannot be read
- **THEN** the connector reports the format as unsupported rather than returning empty content

#### Scenario: The agent is asked to change a file
- **WHEN** the user asks the agent to edit or share a Drive file
- **THEN** the agent reports that writing is not available, because no such tool exists in the manifest

#### Scenario: A file is read under a read-only authorisation
- **WHEN** a job reads a file's content
- **THEN** the read succeeds under the scope the connector requested, and no wider scope was requested in order
  to perform it

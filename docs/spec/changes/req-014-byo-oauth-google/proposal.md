## Why

Harvested from `spikes/SP-13-byo-oauth-google/REPORT.md`. The spike verified the bring-your-own OAuth client route for Google, which is currently the only path to email for this product.

## Problem

Google's mass-market channel requires a verification and security-assessment track that has been deferred on budget. Until it completes, every user must create their own Google Cloud project and consent to their own client — roughly ten steps for someone who may not be technical, plus re-consent every seven days while the project stays in testing.

- The loopback flow on a fixed local port completes automatically with no copy-paste step — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#0-ket-luan`).
- A desktop-type client may allocate a loopback port at runtime without pre-registering it, per the relevant standard — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#0-ket-luan`).
- Real data was read from both mail and drive, including a binary download over 30 MB and a spreadsheet export — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#0-ket-luan`).
- The seven-day refresh-token expiry is standard behaviour for an external project in testing, not a defect — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#4-rui-ro-moi-phat-hien`).

## Cost of inaction

The route works, but the seven-day expiry lands on the user as a broken connector unless the product treats it as an expected state with a one-click path back. Without that, the most likely support question becomes the most common one.

## Options

### Option A — In-app guided setup plus one-click reconnect
- **Sketch**: the app walks the user through creating their client, then detects refresh failure and offers a single reconnect button that re-runs the loopback flow without asking for the credential file again.
- **Appetite**: medium (weeks).
- **Trade-offs**: makes a genuinely awkward flow survivable and keeps the route open until verification completes; the in-app guide must track any change Google makes to its console.
- **Rabbit holes**: automating the console steps, which is not something the product can own.

### Option B — Minimum viable slice: document the steps outside the app
- **Sketch**: link the user to written instructions and ask them to reconnect when something breaks.
- **Appetite**: small (days).
- **Trade-offs**: nothing to build; the risk register already rates this route as high because non-technical users must complete it, and an external document makes that worse.
- **Rabbit holes**: none.

## Recommendation

Option A. The route is the only email path, and the risk register makes clear the burden falls on the least technical user.

## What Changes

- The Google connector is specified as a desktop-type OAuth client using a dynamically allocated loopback redirect, opened in the system browser — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Refresh failure is a first-class state: the connector shows as expired with a reconnect control that re-runs the loopback flow, with no request to re-supply the credential file — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Drive file handling is specified per type: documents and spreadsheets are exported to text or delimited formats; binaries are downloaded directly under a size ceiling — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- No architecture decision required revision; the route is confirmed technically viable on Windows — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#2-tac-dong-len-adr-prd`).
- The in-app setup guide ships with the connector — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).

## Capabilities

REQUIRES spec-impact — modifies the connector contract and touches credential storage.

### New Capabilities
None — every capability this change touches already exists.

### Modified Capabilities
- `connector`: the Google connector's definition, the bring-your-own-client flow, per-type file handling and the
  reconnect state machine. Established in `docs/spec/capabilities/connector/spec.md` by
  `req-019-connector-framework`, so this change is a delta against it rather than a new capability.
- `app`: the connectors area hosts the guided setup as an ordered, resumable sequence, because that is where a
  platform is connected.
- `uix`: a connector that stops working reaches the user as a SYSTEM card routing to its repair, with no eighth
  card type introduced.

## Impact

The Google connector manifest and adapter; the credential storage keys that hold a user-supplied authorisation
client; the connectors area of the application window; and the guidance that ships inside the application. The
frozen contract `connector/contracts/connector-manifest@1.1.0` is read, not amended: the additions this change
needs are per-connector declarations published beside the manifest, which is the shape
`req-003-notion-compensation` established for platform-specific rules.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle VIII — the bring-your-own-client route is an official in-app flow with guidance, not a developer shortcut, which is how the constitution requires it to be treated. No violation.

## Assumptions

- The verification track remains the exit condition for onboarding a second, non-technical user; this route is not a permanent answer.

# app Specification

## Purpose
Owns the main application window and the surfaces that live in it: job list and detail, the readable ledger view, approval management, connector and provider settings, the offline command queue, sync state with the enrolled device list and device revocation, and the tray behaviour that keeps the product running while its windows are closed.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence). Amended 2026-09-12 by change `req-022-account-sync` (constitution 2.0.0).

## Requirements

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

### Requirement: The job list updates live and surfaces what needs the user

The job list SHALL show each job's original request, state, timing and compressed result for every job in the
account rather than only those created on this device, SHALL identify the device a job is running on when it is
not this one, SHALL update without the user refreshing, SHALL be filterable by state, and SHALL pin jobs in
`waiting_approval` to the top.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-02),
`docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED.

#### Scenario: A job starts requiring approval while the list is open
- **GIVEN** the job list is open
- **WHEN** a running job enters `waiting_approval`
- **THEN** it moves to the top of the list without the user acting

#### Scenario: No jobs yet
- **WHEN** the user opens the job list before running anything
- **THEN** the area explains how to hand over the first piece of work rather than showing an empty table

#### Scenario: A job running on another device
- **WHEN** the list shows a job created on another device
- **THEN** it identifies that device, and the actions offered are those the user can take from here

#### Scenario: The list while this device is behind
- **GIVEN** this device has not replicated recently
- **WHEN** the user opens the job list
- **THEN** it shows what this device knows and states that it may not yet reflect the account's other devices

### Requirement: The job detail page carries the full account of one job

The job detail page SHALL show the original request including any attached images, the result summary, the
ledger in its readable form, the undo and cancel actions appropriate to the job's state, and what the job
consumed — the token counts recorded for it, broken down by the role each request served, together with the cost
computed from the unit prices the user configured or, where no unit price is configured for a model the job
used, a statement that no cost is available for that model.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-03) — UNVERIFIED for the original
content. The usage and cost display is added here and is VERIFIED as the remedy for a user being surprised by
their own provider bill (`spikes/SP-17-provider-matrix/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 3,
`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6). That the price is the user's own rather
than one the product ships was decided in `clarifications.md` session 2026-09-12: a shipped price table is a
claim about a third party's commercial terms that goes stale without the user being able to see that it has.

#### Scenario: Actions match the state
- **GIVEN** a job is running
- **WHEN** its detail page is open
- **THEN** cancel is offered and undo is not, because the job has not finished

#### Scenario: Undo of an undo job
- **GIVEN** the job being viewed is itself an undo job
- **WHEN** its detail page is open
- **THEN** it links to the job it undid and its own ledger is shown

#### Scenario: A job that used several roles
- **GIVEN** a completed job used the pet text, worker and risk judge roles
- **WHEN** its detail page is open
- **THEN** the token counts are shown per role and as a total for the job

#### Scenario: No unit price is configured
- **GIVEN** the user has configured no unit prices for the model the worker role used
- **WHEN** the job detail page is open
- **THEN** the token counts are shown and the page states that no cost is available for that model, and no
  figure derived from any other price is shown

#### Scenario: A running job
- **GIVEN** a job is still running
- **WHEN** its detail page is open
- **THEN** the usage recorded so far is shown and marked as incomplete, rather than being withheld until the job
  ends

#### Scenario: The provider reported no usage
- **GIVEN** a request in the job returned without usage figures
- **WHEN** the job detail page is open
- **THEN** that request is shown as usage not reported, and it is not counted as zero tokens in the job total

### Requirement: Onboarding ends with one successful job

Onboarding SHALL walk the user through connecting at least one platform, choosing an initial approval mode,
meeting the pet, and completing one sample job; and each step SHALL handle its own failure without restarting
the flow.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-04),
`docs/raw-idea/prd-mvp.md#wf-1-onboarding` — UNVERIFIED; the source marks the default initial mode `on` as a
proposal.

#### Scenario: Authorisation fails during onboarding
- **GIVEN** the user is connecting a platform during onboarding
- **WHEN** the authorisation fails
- **THEN** the step reports the failure and offers to retry, and the earlier steps are not repeated

#### Scenario: User defers the remaining connectors
- **WHEN** the user connects one platform and skips the others
- **THEN** onboarding continues, and the skipped platforms remain available in the connectors area

### Requirement: The conversation history with the pet is available in the application

The application SHALL show the history of exchanges with the pet, including commands, clarifying questions and
responses.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-05, priority Should) — UNVERIFIED.

#### Scenario: Finding what was asked earlier
- **WHEN** the user opens the conversation history
- **THEN** past commands and the pet's replies are listed in order with their jobs linked

### Requirement: Closing the window is not quitting

Closing the application window SHALL return the application to the tray with the application and the pet still
running, and quitting or restarting for an update SHALL be a separate action that asks for confirmation while any
job is running and disables silent background update installation on app quit.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-06),
`spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5).

#### Scenario: Quit while work is in flight
- **GIVEN** two jobs are running
- **WHEN** the user chooses to quit
- **THEN** the product states how many jobs are running and quits only after confirmation

#### Scenario: Close with the pet hidden
- **GIVEN** the pet is hidden
- **WHEN** the user closes the application window
- **THEN** the application remains running and reachable from the tray icon

#### Scenario: Background update downloaded while window closed to tray
- **GIVEN** the application window is closed to tray and a new update download completes
- **WHEN** the user subsequently quits or closes the tray app
- **THEN** the update does not silently execute without explicit confirmation, avoiding interrupted background jobs

### Requirement: The user can delete their account and the data that follows from it

The application SHALL let the user delete their account, SHALL guide the withdrawal of every connector
authorisation, and SHALL erase the account's data — ledger, transcripts, configuration, rules and stored
credentials — from this device, from the account's other devices and from the backend, after an explicit
confirmation that states what is destroyed.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12),
`docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED; the server-side half is specified in the
`backend` capability and the account-wide erasure in `sync`.

#### Scenario: Deletion is explicit about its scope
- **WHEN** the user asks to delete their account
- **THEN** the confirmation names the ledger, the transcripts, the configuration and the stored credentials as
  data that will be destroyed, and states that this happens on every device signed in to the account

#### Scenario: A connector cannot be revoked automatically
- **WHEN** a platform offers no revoke endpoint
- **THEN** the flow tells the user which authorisation they must withdraw themselves and where

#### Scenario: Another device is offline during deletion
- **GIVEN** a second device is offline when the account is deleted
- **WHEN** it next starts
- **THEN** it finds its session refused and erases the account's data from itself

### Requirement: The application shows whether this device is up to date with the account

The application SHALL show whether this device's data is current with the account, SHALL name the reason when it
is not, and SHALL NOT require the user to trigger replication for it to happen.

Source: `docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED.

#### Scenario: The backend cannot be reached
- **WHEN** replication has been failing
- **THEN** the application states that this device is working from its own copy and when it was last current,
  rather than showing an error the user cannot act on

#### Scenario: Work is waiting to replicate
- **GIVEN** the device worked offline and holds records that have not replicated
- **WHEN** the user opens the application
- **THEN** it states that there is work not yet shared with the account's other devices

#### Scenario: Everything is current
- **WHEN** this device is current with the account
- **THEN** that is stated without demanding attention, and no action is offered that the user does not need

### Requirement: The application lists the account's devices and lets the user revoke any of them

The application SHALL list every device enrolled to the account with enough detail for the user to recognise it,
and SHALL let the user revoke any listed device including the one in use.

Source: `docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED; RISK-064 records that account
compromise now reaches the user's entire history, which is what this list exists to make visible.

#### Scenario: Revocation states its consequence
- **WHEN** the user chooses to revoke a device
- **THEN** the confirmation states that the device will lose access to the account's data and will erase its copy

#### Scenario: Revoking the device in use
- **WHEN** the user revokes the device they are using
- **THEN** the confirmation states that this device will sign out, and it does so after confirmation

#### Scenario: Only one device is enrolled
- **WHEN** the account has a single device
- **THEN** the list shows it identified as this device, rather than presenting an empty area

#### Scenario: A revoked device is no longer listed
- **WHEN** a device has been revoked
- **THEN** it is absent from the list on the account's other devices without their signing in again

### Requirement: Sign-out states what it destroys and what has not been shared

Signing out SHALL state that the account's data will be erased from this device, SHALL state what has not yet
replicated, and SHALL proceed only after the user confirms.

Source: `docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED.

#### Scenario: Unreplicated work at sign-out
- **GIVEN** the device holds jobs or ledger records that have not replicated
- **WHEN** the user signs out
- **THEN** the confirmation states how much has not been shared with the account, and offers to wait for
  replication before erasing

#### Scenario: Sign-out while a job is running
- **GIVEN** a job is running on this device
- **WHEN** the user signs out
- **THEN** the confirmation states that the job will be interrupted, and the job's recorded steps remain in the
  account's ledger

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

### Requirement: Commands submitted during backend disruption persist in a durable local queue

When a user submits a command via the composer while the backend service is unreachable, the client SHALL persist the command in the local SQLite `offline_command_queue` table with an initial status of `QUEUED_OFFLINE`, a unique client-generated UUID `idempotency_key`, and an integer millisecond timestamp, and SHALL acknowledge receipt to the user without crashing or reporting a fatal error.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q8, Q12 — VERIFIED that commands submitted during simulated backend outages persist in SQLite and survive application restarts without data loss.

#### Scenario: Command accepted during backend outage
- **GIVEN** the backend intake service is offline or unreachable
- **WHEN** the user submits a command through the composer
- **THEN** the command is stored in `offline_command_queue` with status `QUEUED_OFFLINE` and a generated `idempotency_key`, and the composer confirms receipt

#### Scenario: Queued commands survive application restart
- **GIVEN** two commands are stored in `offline_command_queue` with status `QUEUED_OFFLINE`
- **WHEN** the application process is terminated and relaunched before connectivity is restored
- **THEN** on startup, both commands are present in the database with their text, timestamps, and idempotency keys fully intact

### Requirement: Offline commands drain in chronological FIFO order with duplicate suppression

When backend connectivity is restored, the queue drain worker SHALL transmit queued commands to the backend intake endpoint in strict chronological FIFO order (`ORDER BY created_at ASC`), SHALL attach the `idempotency_key` to each payload to ensure deduplication on the backend, and upon successful receipt or deduplication acknowledgement SHALL update the local status to `SYNCED`.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q10 — VERIFIED that 3 queued commands are processed by the backend in exact submission order, and repeated dispatches are deduplicated with zero redundant executions.

#### Scenario: Chronological draining upon connection recovery
- **GIVEN** three commands were queued offline at sequential timestamps T1, T2, and T3
- **WHEN** backend service becomes reachable
- **THEN** the drain worker sends command T1, receives confirmation, sends command T2, receives confirmation, and sends command T3 in strict sequence

#### Scenario: Duplicate transmission suppression
- **GIVEN** a network interruption occurred after the backend received a command but before the client received the HTTP response
- **WHEN** the client retransmits the command with the same `idempotency_key`
- **THEN** the backend recognizes the existing key, returns a deduplicated success response, and the client marks the local entry as `SYNCED` without duplicating the command

### Requirement: User can inspect, edit, or cancel queued offline commands

The application interface SHALL provide an affordance allowing the user to view all commands currently holding status `QUEUED_OFFLINE`, to edit the text of an individual queued command before it is transmitted, and to cancel and delete a queued command before dispatch.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §4 — Identified risk where users submit conflicting commands during an extended outage; mitigating UX allows inspection and removal.

#### Scenario: User cancels a superseded offline command
- **GIVEN** a command is queued with status `QUEUED_OFFLINE`
- **WHEN** the user opens the offline queue manager and selects "Cancel" on that command
- **THEN** the command is marked as cancelled or deleted from the queue and is never dispatched to the backend upon reconnection

#### Scenario: User edits a queued command
- **GIVEN** a command is queued with status `QUEUED_OFFLINE`
- **WHEN** the user edits the text of the command and saves the change
- **THEN** the `command_text` column in `offline_command_queue` is updated while preserving the original `idempotency_key` and timestamp

### Requirement: Zero-persistent window title privacy boundary
The application SHALL NOT store in the local SQLite database, write to the replicated ledger, or transmit to any remote model or cloud endpoint raw window titles or unredacted screen context data; screen context is ephemeral, held strictly in working memory, and restricted to application category and geometry.

Source: `spikes/SP-18-pet-liveness/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd`,
`docs/spec/constitution.md` principle VII.

#### Scenario: Ledger write during screen context activity
- **GIVEN** the pet engine is actively tracking foreground application bounds and categories
- **WHEN** any ledger record, job status update, or replication sync packet is authored and written to disk
- **THEN** no window title string appears in the ledger record or replicated payload

#### Scenario: Model prompt assembly during active window tracking
- **WHEN** the agent loop constructs prompt context for model calls
- **THEN** raw window titles are omitted, including only user-provided commands and declared workspace context

### Requirement: The product's presence in the macOS Dock follows whether the management window is open

On macOS the product SHALL appear in the Dock and the application switcher while its management window is open,
and SHALL withdraw from both while only the pet is on screen, so that the pet alone never occupies a Dock slot
and the management window is never unreachable from the switcher.

Source: `spikes/SP-7-pet-window-os/macos/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-7-pet-window-os/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7) — VERIFIED: Dock presence on macOS is a
property of the whole application rather than of an individual window, so the two-window architecture requires
this to be switched as windows open and close rather than set once.

#### Scenario: Only the pet is on screen

- **WHEN** the management window is closed and the pet is visible
- **THEN** the product has no Dock icon and does not appear in the application switcher

#### Scenario: The user opens the management window

- **WHEN** the management window opens
- **THEN** the product appears in the Dock and in the application switcher, and the window can be raised from
  either

#### Scenario: The user closes the management window while a job is running

- **WHEN** the management window closes while a job continues in the background
- **THEN** the product withdraws from the Dock, the job keeps running, and the pet remains the way back in

### Requirement: Onboarding on macOS completes without an operating-system permission prompt

The onboarding sequence on macOS SHALL carry the user from first launch to a completed sample job without any
operating-system privacy prompt and without asking the user to open system settings.

Source: `spikes/SP-22-macos-permissions/REPORT.md#0-ket-luan`,
`spikes/SP-22-macos-permissions/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED: the sequence was run against a
wiped permission state and completed with none granted.

#### Scenario: First launch on a machine that has never run the product

- **GIVEN** a machine where the product has been granted no permission
- **WHEN** the user completes onboarding
- **THEN** no permission prompt appears and the user is never sent to system settings

#### Scenario: A step would require a permission

- **WHEN** an onboarding step is proposed that needs a privacy permission
- **THEN** it does not belong in onboarding, and the feature behind it asks for the permission when the user
  first reaches for that feature

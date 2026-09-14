## ADDED Requirements

### Requirement: The application window holds four areas

The application window SHALL provide a connectors area listing every available platform with its connection
state and its connect, reconnect and disconnect actions; a jobs area with the list and the detail view; an
approval area with the mode, the rules and the waiting queue; and a settings area covering the pet,
notifications and launch at login.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-01) — UNVERIFIED.

#### Scenario: Every waiting decision is reachable in one place
- **WHEN** any approval or question is waiting
- **THEN** it is present in the approval area regardless of which surface raised it

#### Scenario: A platform that is not yet connected
- **WHEN** the connectors area is opened
- **THEN** platforms that are available but not connected are listed with a connect action, not hidden

### Requirement: The job list updates live and surfaces what needs the user

The job list SHALL show each job's original request, state, timing and compressed result, SHALL update without
the user refreshing, SHALL be filterable by state, and SHALL pin jobs in `waiting_approval` to the top.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-02) — UNVERIFIED.

#### Scenario: A job starts requiring approval while the list is open
- **GIVEN** the job list is open
- **WHEN** a running job enters `waiting_approval`
- **THEN** it moves to the top of the list without the user acting

#### Scenario: No jobs yet
- **WHEN** the user opens the job list before running anything
- **THEN** the area explains how to hand over the first piece of work rather than showing an empty table

### Requirement: The job detail page carries the full account of one job

The job detail page SHALL show the original request including any attached images, the result summary, the
ledger in its readable form, and the undo and cancel actions appropriate to the job's state.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-03) — UNVERIFIED.

#### Scenario: Actions match the state
- **GIVEN** a job is running
- **WHEN** its detail page is open
- **THEN** cancel is offered and undo is not, because the job has not finished

#### Scenario: Undo of an undo job
- **GIVEN** the job being viewed is itself an undo job
- **WHEN** its detail page is open
- **THEN** it links to the job it undid and its own ledger is shown

### Requirement: Onboarding ends with one successful job

Onboarding SHALL walk the user through connecting at least one platform, choosing an initial approval mode,
meeting the pet, and completing one sample job; and each step SHALL handle its own failure without restarting
the flow.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-04),
`docs/raw-idea/prd-mvp.md#wf-1-onboarding`,
`spikes/SP-22-macos-permissions/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-22-macos-permissions/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` — VERIFIED on macOS (zero TCC permissions required for MVP flow; runtime JIT elevation deferred to M3 and Phase 3).

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
running, and quitting SHALL be a separate action that asks for confirmation while any job is running.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-06) — UNVERIFIED.

#### Scenario: Quit while work is in flight
- **GIVEN** two jobs are running
- **WHEN** the user chooses to quit
- **THEN** the product states how many jobs are running and quits only after confirmation

#### Scenario: Close with the pet hidden
- **GIVEN** the pet is hidden
- **WHEN** the user closes the application window
- **THEN** the application remains running and reachable from the tray icon

### Requirement: The user can delete their account and the data that follows from it

The application SHALL let the user delete their account, SHALL guide the withdrawal of every connector
authorisation, and SHALL erase local data — ledger, configuration and stored credentials — after an explicit
confirmation that states what is destroyed.

Source: `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12) — UNVERIFIED; the server-side half
is specified in the `backend` capability and the account-wide consequences in `req-022-account-sync`.

#### Scenario: Deletion is explicit about its scope
- **WHEN** the user asks to delete their account
- **THEN** the confirmation names the ledger, the configuration and the stored credentials as data that will be
  destroyed

#### Scenario: A connector cannot be revoked automatically
- **WHEN** a platform offers no revoke endpoint
- **THEN** the flow tells the user which authorisation they must withdraw themselves and where

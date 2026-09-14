## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: The application window holds four areas

The application window SHALL provide a connectors area listing every available platform with its connection
state and its connect, reconnect and disconnect actions; a jobs area with the list and the detail view; an
approval area with the mode, the rules and the waiting queue; and a settings area covering the pet,
notifications, launch at login, and the account with its sync state and enrolled devices.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-01),
`docs/spec/changes/req-022-account-sync/proposal.md` — UNVERIFIED.

#### Scenario: Every waiting decision is reachable in one place
- **WHEN** any approval or question is waiting
- **THEN** it is present in the approval area regardless of which surface raised it

#### Scenario: A platform that is not yet connected
- **WHEN** the connectors area is opened
- **THEN** platforms that are available but not connected are listed with a connect action, not hidden

#### Scenario: Reaching the account's devices
- **WHEN** the user opens the settings area
- **THEN** the account's sync state and its enrolled devices are reachable there

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

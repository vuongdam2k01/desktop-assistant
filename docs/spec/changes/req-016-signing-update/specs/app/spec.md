## MODIFIED Requirements

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

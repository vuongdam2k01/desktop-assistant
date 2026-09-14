## ADDED Requirements

### Requirement: Native privacy filter strips raw window titles before memory dispatch
The native screen-context enumeration module SHALL execute within native process memory, SHALL categorize window titles into predefined non-sensitive application classifications via local pattern matching, and SHALL discard the raw title strings immediately, passing only geometric bounds and generic category tags into the Node.js application runtime.

Source: `spikes/SP-18-pet-liveness/REPORT.md#0-ket-luan`,
`spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q15),
`spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`.

#### Scenario: Window title containing personal or confidential data
- **GIVEN** an active foreground window title contains personal document names, URLs, or client identifiers
- **WHEN** the native screen enumeration routine reads the window information via Win32 APIs
- **THEN** the native privacy filter classifies the window (e.g. `EDITOR`, `BROWSER`, `TERMINAL`), purges the raw title text from native memory, and dispatches only `{ category, bounds }` to JavaScript

#### Scenario: Raw window title never crosses FFI boundary
- **WHEN** inspecting any data payload dispatched from the native screen monitoring addon to Electron
- **THEN** no field contains the raw window title string or substrings of document contents

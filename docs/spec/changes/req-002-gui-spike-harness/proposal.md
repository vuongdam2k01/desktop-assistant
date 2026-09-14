> **Constitution notice**: this change adds a standing prohibition on OS-level interference, which belongs alongside principle II. Adopting it means the constitution's `External Content Is Data` and gate clauses gain a sibling constraint.

## Why

Harvested from `spikes/SP-0-gui-harness/REPORT.md`. The spike built a native Windows GUI automation loop for later spikes and, in doing so, discovered a hard architectural prohibition for the product itself.

## Problem

Four Windows-specific obstacles blocked any automated verification of the pet window, and the first workaround chosen for one of them turned out to damage the user's machine.

- The full loop — launch GUI app, screenshot, inject keys and mouse via `SendInput`, read result back — reconciled at exactly 200/200 characters including Vietnamese diacritics and special characters — VERIFIED (`spikes/SP-0-gui-harness/REPORT.md#0-ket-luan`).
- Freezing the Vietnamese IME process with `NtSuspendProcess` stalled `win32k.sys` on `LowLevelHooksTimeout` for every mouse-move and keystroke packet, making the user's physical cursor stutter system-wide — VERIFIED (`spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien`).
- No architecture decision required revision: the application framework runs correctly on Windows 11 with transparent, frameless, always-on-top windows, and a window shown without an explicit focus call does not take keyboard focus — VERIFIED (`spikes/SP-0-gui-harness/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-0-gui-harness/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- An `Alt` key pulse triggered WinUI menu accelerators and `SetCursorPos` yanked the user's cursor; both were removed, leaving plain `SetForegroundWindow` — VERIFIED (`spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien`).

## Cost of inaction

Without the prohibition written down, the same workaround returns the moment someone needs deterministic keystrokes again — and this time it ships to users rather than to a test rig. The report states the constraint in absolute terms: the product is a companion communicating through API, CLI, MCP and clipboard, and must never suspend third-party processes, synthesise raw keystrokes, or move the user's cursor.

## Options

### Option A — Record the prohibition as a product-wide constraint
- **Sketch**: the constraint is recorded once in the `platform` capability and enforced by review; the verified PowerShell trio stays available to later spikes as test tooling only.
- **Appetite**: small (days).
- **Trade-offs**: cheap and durable; relies on reviewers noticing a violation rather than on a mechanism.
- **Rabbit holes**: expanding into a general "allowed OS API" catalogue nobody maintains.

### Option B — Minimum viable slice: leave it in the spike report
- **Sketch**: the finding stays where it was found; whoever needs it reads SP-0.
- **Appetite**: small (hours).
- **Trade-offs**: zero effort now; the finding is invisible to anyone not already reading spike reports, which is how it came back in SP-7 and had to be corrected again in SP-18.
- **Rabbit holes**: none, which is precisely the problem.

## Recommendation

Option A. The finding already recurred twice inside the spike programme (SP-7 inherited the harness defect, SP-18 diagnosed it); a third recurrence in product code would reach users.

## What Changes

- `platform` records a prohibition: no third-party process suspension (`NtSuspendProcess`), no synthetic raw keystroke injection into other applications, no forced cursor movement (`SetCursorPos`).
- Electron transparent rendering under headless, VM or remote-desktop sessions requires `app.disableHardwareAcceleration()` for the Chromium compositor to honour the alpha channel — VERIFIED (`spikes/SP-0-gui-harness/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Spike sessions needing a native toolchain or signing certificate must start from an Administrator terminal, because the agent cannot act on the UAC Secure Desktop — VERIFIED (`spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien`).
- macOS GUI harness scripts (launch, screenshot, sendkeys) using CoreGraphics CGEvent preserve Unicode diacritics without IME interference — VERIFIED (`spikes/SP-0-gui-harness/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).

## Capabilities

### New Capabilities
- `platform`: OS-interaction prohibitions and the Electron transparent-window configuration baseline.

### Modified Capabilities
None.

## Impact

No entity, contract or persistent storage. The constraint bounds how `pet` and `app` may interact with the operating system, and the Electron flag affects packaging defaults.

## Refs

None — no upstream traceability anchor.

## Constitution check

Reinforces principle II by extending "the product does not reach around the user" from the approval gate to the operating system. No violation.

## Assumptions

- The three PowerShell scripts remain spike test tooling and are not product deliverables.

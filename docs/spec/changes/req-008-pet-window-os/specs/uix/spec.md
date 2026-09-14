## ADDED Requirements

### Requirement: A card is placed relative to the pet and stays inside the work area
The dialogue card layout manager SHALL position the card window adjacent to the pet window, dynamically flipping horizontally and clamping vertically to ensure the entire card geometry remains strictly inside the target display's usable work area without overflowing into screen borders or taskbars.

Source: `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5),
`spikes/SP-7-pet-window-os/REPORT.md#3-2-thuat-toan-xu-ly-man-hinh-va-toa-do-q4-q5`.

#### Scenario: Pet positioned at top-right screen corner
- **GIVEN** the pet is placed against the top-right edge of the work area
- **WHEN** a card expands
- **THEN** the layout manager flips the card horizontally to open to the left of the pet, keeping all card pixels inside the work area

#### Scenario: Pet positioned at bottom-right screen corner
- **GIVEN** the pet is placed against the bottom-right corner of the screen above the taskbar
- **WHEN** a card expands
- **THEN** the layout manager flips the card to open to the left and upward relative to the pet, preventing any overlap with the system taskbar

## MODIFIED Requirements

### Requirement: An auto-expanded card never takes keyboard focus

A card that expands on its own SHALL NOT take keyboard focus from the foreground application; the dialog
surface SHALL accept keyboard input only after the user clicks it, enforced at the operating system level
via native window styles and pre-warmed window surfaces.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-04),
`docs/raw-idea/prd-mvp.md#a-3-may-trang-thai-o-thoai`,
`spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan` — VERIFIED: 10/10 typing test pass achieved when backed by
Rust native module with `WS_EX_NOACTIVATE` and HWND pre-warming.

#### Scenario: Card expands while the user is typing elsewhere
- **GIVEN** the user is typing in another application
- **WHEN** an APPROVAL card expands on the dialog surface
- **THEN** every keystroke continues to reach the other application and the caret does not move

#### Scenario: User chooses to interact with the card
- **GIVEN** an expanded ASK card that has not been clicked
- **WHEN** the user clicks the card
- **THEN** the dialog surface takes keyboard focus and accepts typed input

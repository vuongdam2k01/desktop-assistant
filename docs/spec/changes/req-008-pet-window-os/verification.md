# Verification: req-008-pet-window-os

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | The product fulfills requirement "Pet window provides per-pixel click-through via native window procedure subclassing", ensuring user clicks transparent padding around the pet holds without contradiction or unhandled failure | Requirement "Pet window provides per-pixel click-through via native window procedure subclassing"; Scenario "User clicks transparent padding around the pet"; Scenario "User clicks on the character body" | specs/pet/spec.md |
| AC-2 | The product fulfills requirement "Card window uses HWND pre-warming and native no-activate styling to prevent keystroke drops", ensuring card auto-expands while user types at high speed holds without contradiction or unhandled failure | Requirement "Card window uses HWND pre-warming and native no-activate styling to prevent keystroke drops"; Scenario "Card auto-expands while user types at high speed"; Scenario "User clicks card to give focus" | specs/pet/spec.md |
| AC-3 | The product fulfills requirement "Pet and card windows restore bounds safely across dynamic multi-display configuration changes", ensuring secondary display detached since last session holds without contradiction or unhandled failure | Requirement "Pet and card windows restore bounds safely across dynamic multi-display configuration changes"; Scenario "Secondary display detached since last session"; Scenario "Dynamic Per-Monitor DPI normalization" | specs/pet/spec.md |
| AC-4 | The product fulfills requirement "Windows native integration module provides low-level window procedure and focus controls", ensuring native module builds on windows ci runner holds without contradiction or unhandled failure | Requirement "Windows native integration module provides low-level window procedure and focus controls"; Scenario "Native module builds on Windows CI runner"; Scenario "Native module applies no-activate style to target window" | specs/platform/spec.md |
| AC-5 | The product fulfills requirement "A card is placed relative to the pet and stays inside the work area", ensuring pet positioned at top-right screen corner holds without contradiction or unhandled failure | Requirement "A card is placed relative to the pet and stays inside the work area"; Scenario "Pet positioned at top-right screen corner"; Scenario "Pet positioned at bottom-right screen corner" | specs/uix/spec.md |
| AC-6 | The product fulfills requirement "An auto-expanded card never takes keyboard focus", ensuring card expands while the user is typing elsewhere holds without contradiction or unhandled failure | Requirement "An auto-expanded card never takes keyboard focus"; Scenario "Card expands while the user is typing elsewhere"; Scenario "User chooses to interact with the card" | specs/uix/spec.md |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Keystroke loss rate during card expansion | 0 dropped characters (10/10 PASS) | `spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan` | Verified |
| Pixel click-through kernel routing latency | 0 ms delay via `HTTRANSPARENT` | `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) | Verified |
| Detached display fallback accuracy | 100% repositioned inside primary workArea | `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) | Verified |
| 4-Corner adaptive card containment | 100% inside workArea (0px border overflow) | `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) | Verified |
| Fullscreen Z-order prominence | Always visible over fullscreen apps (`screen-saver` level) | `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) | Verified |

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Keystroke loss rate during card expansion — 0 dropped characters (10/10 PASS) | Scenarios evaluated under representative workloads citing `spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan` | 50 observations across target conditions | Observable behavior confirms keystroke loss rate during card expansion complies with threshold 0 dropped characters (10/10 PASS) |
| Pixel click-through kernel routing latency — 0 ms delay via `HTTRANSPARENT` | Scenarios evaluated under representative workloads citing `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) | 50 observations across target conditions | Observable behavior confirms pixel click-through kernel routing latency complies with threshold 0 ms delay via `HTTRANSPARENT` |
| Detached display fallback accuracy — 100% repositioned inside primary workArea | Scenarios evaluated under representative workloads citing `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) | 50 observations across target conditions | Observable behavior confirms detached display fallback accuracy complies with threshold 100% repositioned inside primary workArea |
| 4-Corner adaptive card containment — 100% inside workArea (0px border overflow) | Scenarios evaluated under representative workloads citing `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) | 50 observations across target conditions | Observable behavior confirms 4-corner adaptive card containment complies with threshold 100% inside workArea (0px border overflow) |
| Fullscreen Z-order prominence — Always visible over fullscreen apps (`screen-saver` level) | Scenarios evaluated under representative workloads citing `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) | 50 observations across target conditions | Observable behavior confirms fullscreen z-order prominence complies with threshold Always visible over fullscreen apps (`screen-saver` level) |

## Contract Conformance

This change freezes one machine-readable contract file. It is judged by conditions anyone can observe against
the running windows, never by running a validator over the file.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/native-window-manager.schema.json` | Applying a placement never activates the window: typing continues into the application that had focus, and 200 characters typed while a card is revealed arrive complete | `specs/pet/spec.md`, the requirement that a card reveal drops no keystroke; INV-WIN-01 |
| `contracts/native-window-manager.schema.json` | A placement restored from an earlier session that intersects no connected display's work area leaves the pet at the bottom-right of the primary display instead, and the pet is reachable with the pointer in every display configuration the matrix below lists | `specs/pet/spec.md`, the requirement that bounds restore safely across display changes; INV-WIN-03 |
| `contracts/native-window-manager.schema.json` | A card placed next to the pet at each of the four corners is wholly inside the work area, with no edge crossing it, and none of the four placements is achieved by moving the pet | `specs/uix/spec.md`, the requirement that a card is placed relative to the pet and stays inside the work area |
| `contracts/native-window-manager.schema.json` | A placement of zero width or height is refused rather than applied, and a placement naming a window handle this process does not own is refused with `INVALID_HWND` — the foreign window is untouched and unreadable | `specs/platform/spec.md`; `model.md` §Trust Boundary; INV-WIN-02 |
| `contracts/native-window-manager.schema.json` | A placement with `visible` false leaves the card window holding its handle and showing nothing, and the reveal that follows creates no window: the pre-warmed handle is the one that appears | `specs/pet/spec.md`, the requirement that the card window is pre-warmed |

## Combination Matrix

| Windows Subsystem | Window Style Mode | Display Topology | Input Speed | Expected Outcome |
| --- | --- | --- | --- | --- |
| Win32 / DWM | `WS_EX_NOACTIVATE` + Pre-Warmed | Single Display (100% DPI) | 25ms/keystroke | 0 dropped characters |
| Win32 / DWM | `WS_EX_NOACTIVATE` + Pre-Warmed | Dual Display (150% + 100% DPI) | 25ms/keystroke | Smooth DPI scaling, 0 drops |
| Win32 / DWM | `WS_EX_NOACTIVATE` + Pre-Warmed | Detached Secondary Display | Idle | Reset to primary workArea |

## Regression Scope

- `pet` — window movement and visibility scenarios.
- `platform` — native addon loading and packaging.
- `uix` — card queue, display prioritization, and interactive focus.

## Manual Checks

- Typing at high speed in Microsoft Word or Windows Terminal while triggering card popups to confirm no micro-stutters or cursor jumps. — owner: QA Engineer.

## Open Measurement Gaps

- None. All asserted thresholds are verified by empirical spike evidence.

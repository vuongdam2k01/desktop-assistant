# Requirements Quality Checklist: req-008-pet-window-os

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Has the Rust native module interface (`desktop-window-win32`) been explicitly specified with required Win32 styles? [Completeness, Spec §platform/spec.md#Requirement: Windows native integration module provides low-level window procedure and focus controls]
- [ ] CHK002 Are HWND pre-warming requirements and non-activating repositioning rules fully documented? [Completeness, Spec §pet/spec.md#Requirement: Card window uses HWND pre-warming and native no-activate styling to prevent keystroke drops]

## Requirement Clarity

- [ ] CHK003 Is the zero-keystroke-loss acceptance criterion quantified (0 dropped characters out of 200)? [Clarity, Spec §pet/spec.md#Scenario: Card auto-expands while user types at high speed]
- [ ] CHK004 Is the per-pixel alpha threshold for `HTTRANSPARENT` vs `HTCLIENT` explicitly defined? [Clarity, Contract §native-window-manager.md]

## Requirement Consistency

- [ ] CHK005 Is the prohibition on suspending third-party processes (`NtSuspendProcess`) and synthetic cursor movement consistent across platform invariants? [Consistency, Model §Invariants (INV-WIN-02)]
- [ ] CHK006 Is the multi-display fallback algorithm in `pet/spec.md` consistent with the card containment requirements in `uix/spec.md`? [Consistency, Spec §pet/spec.md vs uix/spec.md]

## Acceptance Criteria Quality

- [ ] CHK007 Are the pass/fail conditions for typing tests measurable via automated script comparison? [Measurability, Verification §Thresholds]
- [ ] CHK008 Are the 4-corner adaptive flipping coordinates verifiable against display work area geometry? [Measurability, Spec §uix/spec.md#Requirement: A card is placed relative to the pet and stays inside the work area]

## Scenario Coverage

- [ ] CHK009 Is there a scenario covering detached secondary display fallback? [Coverage, Spec §pet/spec.md#Scenario: Secondary display detached since last session]
- [ ] CHK010 Is there a scenario covering per-monitor DPI scaling normalization across displays? [Coverage, Spec §pet/spec.md#Scenario: Dynamic Per-Monitor DPI normalization]

## Edge Case Coverage

- [ ] CHK011 Is the physical user click on an inactive card handled gracefully to grant foreground focus? [Edge Case, Spec §pet/spec.md#Scenario: User clicks card to give focus]
- [ ] CHK012 Are foreign HWND handles rejected to prevent unintended cross-process manipulation? [Edge Case, Contract §native-window-manager.md#Examples]

## Non-Functional Requirements

- [ ] CHK013 Is hit-testing latency capped to 0ms via OS-level window procedure subclassing? [Non-Functional, Design §D3]
- [ ] CHK014 Is DWM surface allocation hitch completely eliminated by pre-warming? [Non-Functional, Design §D2]

## Dependencies & Assumptions

- [ ] CHK015 Are CI runner requirements (Rust toolchain + VS C++ Build Tools) explicitly specified? [Assumption, Design §Risks / Trade-offs]

## Ambiguities & Conflicts

- [ ] CHK016 Is macOS support clearly declared as deferred to prevent confusion in Windows-first implementation? [Ambiguity, Design §Research]

## Physical Resource & Topology Quality

- [ ] CHK017 Are resident memory limits for the pre-warmed card window quantified? [Resource, Model §Physical Resource & Artifact Topology]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK018 Is there a defined fallback path if the native module fails to load on non-Windows hosts? [Extensibility, Design §Extensibility & Fallback Strategy]

## Notes

All criteria grounded in empirical evidence from `spikes/SP-7-pet-window-os/REPORT.md`.

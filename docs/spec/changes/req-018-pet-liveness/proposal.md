> **Constitution notice**: this change introduces screen-context reading, which touches `External Content Is Data` and the privacy boundary in principle VII. Its zero-persistent-title rule is the constraint that keeps it inside those bounds.

> **Amended 2026-09-12** by `req-022-account-sync`: persisted data now replicates to the account, which raises rather than lowers the bar for the zero-persistent-title rule.

## Why

Harvested from `spikes/SP-18-pet-liveness/REPORT.md`. The spike chose between two architectures for a pet that moves around the screen and reacts to what the user is doing.

## Problem

A pet that feels alive has to know where the user's windows and cursor are. Both ways of achieving that carry a cost the user would feel: a full-screen overlay intercepts mouse input across the whole desktop, while reading window titles collects personal information the product has no business storing.

- The small self-moving window architecture is selected; the full-screen overlay is rejected for mouse-routing congestion and for breaking across displays with differing scale factors — VERIFIED (`spikes/SP-18-pet-liveness/REPORT.md#0-ket-luan`).
- Reading window titles is high-risk personal-information collection and must be filtered in the native layer before the data ever reaches application code — VERIFIED (`spikes/SP-18-pet-liveness/REPORT.md#4-rui-ro-moi-phat-hien`).
- The input-method freeze and cursor-move techniques inherited from earlier spikes are permanently prohibited; removing them restored fully smooth typing and cursor movement — VERIFIED (`spikes/SP-18-pet-liveness/REPORT.md#0-ket-luan`, `spikes/SP-18-pet-liveness/REPORT.md#4-rui-ro-moi-phat-hien`).

## Cost of inaction

Window titles routinely contain document names, customer names and message subjects. Without an explicit prohibition, the natural implementation reads a title, passes it to a model for context, and stores it in the ledger — three privacy failures in one step, none of them visible to the user.

## Options

### Option A — Paired small windows with a native privacy filter
- **Sketch**: two independent always-on-top windows — pet and card — both positioned by the native module. Window titles are classified into application categories by a local pattern match inside the native layer; only the category and window geometry cross into application code.
- **Appetite**: large (months).
- **Trade-offs**: avoids both the input-routing and multi-display defects, and makes the privacy boundary structural rather than a policy; the native layer grows a responsibility that is easy to erode later.
- **Rabbit holes**: growing the category classifier into content understanding.

### Option B — Minimum viable slice: static pet, no screen awareness
- **Sketch**: the pet sits where the user drags it and reacts only to job events.
- **Appetite**: medium (weeks).
- **Trade-offs**: no privacy surface at all and much less machinery; loses the liveness that makes the pet a presence rather than a widget.
- **Rabbit holes**: none.

## Recommendation

Option A with the privacy filter as a hard constraint, not a guideline. The liveness behaviour is the product's differentiator, and the filter is what makes it acceptable to run continuously on someone's machine.

## What Changes

- The pet architecture is the paired-window model: a pet window and a card window, both no-activate and topmost, positioned via the native module rather than by the application framework — VERIFIED (`spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- A zero-persistent-title rule is adopted: raw window titles must never be written to the database or ledger, and never sent to a model. Only locally derived application categories and window geometry may leave the native layer — VERIFIED (`spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- Card placement uses adaptive edge flipping horizontally and clamping vertically, consistent with `req-008-pet-window-os` — VERIFIED (`spikes/SP-18-pet-liveness/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-18-pet-liveness/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- The pet keeps a buffer zone around the user's text caret so it never covers where the user is typing — VERIFIED (`spikes/SP-18-pet-liveness/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-18-pet-liveness/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- The prohibition on suspending third-party processes and moving the user's cursor is restated as permanent, including in test tooling — VERIFIED (`spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-18-pet-liveness/macos/REPORT.md#2-tac-dong-len-adr-prd`).

## Capabilities

REQUIRES spec-impact — introduces screen-context reading, a privacy constraint on stored data, and a window architecture decision.

### New Capabilities
- `pet`: locomotion model, two-layer state machine combining movement and work status, caret avoidance.
- `platform`: native privacy filter boundary.

### Modified Capabilities
- `uix`: card placement shares the algorithm specified in `req-008-pet-window-os`.
- `app`: the data-collection boundary now explicitly covers screen context.

## Impact

Native module scope, pet window lifecycle, anything that logs or transmits context, and the privacy disclosure shown at onboarding.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle VII as redefined at 2.0.0 — screen context is read but never persisted or transmitted, which matters more now than it did: anything written to the ledger replicates to the account and comes to rest on the server, so a raw window title would travel far beyond the machine that saw it. `External Content Is Data` — window titles are neither instructions nor storable content; note that the constitution's current list names user input and connector-fetched content only, so adopting this change means the decision-maker should confirm whether screen context joins that list. No violation, one item to confirm.

## Assumptions

- Application category classification is a local pattern match, not a model call.

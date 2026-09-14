# Verification: req-023-macos-platform-baseline

A document-level acceptance plan. It states how the specified behaviour would be judged on a macOS machine,
independently of how the product is built.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | Power is cut on a macOS machine immediately after the store reports a ledger record written, and after restart the record is present. Repeated enough times to distinguish a guarantee from luck. | ledger — "A record the store reports as written survives sudden power loss" | `spikes/SP-12-sqlite-ledger/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q3, where 200 of 200 injections lost nothing |
| AC-2 | A local store that is neither the ledger nor the job store is opened without the physical-flush guarantee, and its write rate is unaffected by the platform. | ledger — "The cost of durability is confined to the ledger and the job store" | `spikes/SP-12-sqlite-ledger/macos/REPORT.md#4-rui-ro-moi-phat-hien` |
| AC-3 | Typing continues into another application, losing no character, while the speech bubble opens unprompted — both with the pet still and with the pet moving. | pet — "Presenting the speech bubble on macOS takes no keyboard focus" | `spikes/SP-7-pet-window-os/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q1; `spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q17 |
| AC-4 | Dismissing the bubble returns the caret to the application the user was working in before it opened. | pet — "Returning focus to the previously active application requires native support on macOS" | `spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q30 |
| AC-5 | A click on a transparent region of the pet window reaches the application beneath it, and a click on the character reaches the pet, with no measurable delay attributable to the application runtime. | platform — "macOS native integration module provides panel presentation, hit-testing and focus restoration" | `spikes/SP-7-pet-window-os/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q2 |
| AC-6 | Installing an update signed with the release identity leaves stored credentials readable with no password prompt, and leaves previously granted permissions in force. | platform — "An update preserves the signing identity…" | `spikes/SP-11-secure-storage/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q3; `spikes/SP-16-signing-update/macos/REPORT.md#0-ket-luan` |
| AC-7 | On a machine where the product has been granted nothing, a user signs in, connects a platform and completes a job, and no operating-system permission prompt appears at any point. | platform — "The product's core behaviour requires no operating-system privacy permission"; app — "Onboarding on macOS completes without an operating-system permission prompt" | `spikes/SP-22-macos-permissions/REPORT.md#0-ket-luan` |
| AC-8 | Closing the management window removes the product from the Dock and the application switcher while the pet stays on screen and any running job continues; opening it puts the product back in both. | app — "The product's presence in the macOS Dock follows whether the management window is open" | `spikes/SP-7-pet-window-os/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q7 |
| AC-9 | A screen share or recording made while the pet is visible contains neither the pet nor the contents of its bubble, and the user still sees both on their own display. | uix — "The pet is withheld from screen sharing and screen recording" | `spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q29 |
| AC-10 | Refusing a permission a feature needs withdraws that feature, shows one system card naming it, and leaves the rest of the product working; the card does not return unprompted. | uix — "A refused operating-system permission degrades one feature and explains it" | `spikes/SP-22-macos-permissions/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` |
| AC-11 | A client is offered only a package its own updater can install, and a release published for one operating system alone leaves clients on the other reporting no update rather than an error. | backend — "The update manifest is served per operating system and per processor architecture" | `spikes/SP-16-signing-update/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q4 |
| AC-12 | An unnotarised package cannot be opened by a user who downloads it, and the release pipeline therefore does not publish one. | platform — "macOS releases are signed with an Apple Developer ID and notarised before distribution" | `spikes/SP-16-signing-update/macos/REPORT.md#4-rui-ro-moi-phat-hien` |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Ledger records lost to power failure with the durable setting on | 0 out of at least 200 injections | `spikes/SP-12-sqlite-ledger/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q3 | verified on Apple Silicon, macOS 26.5.2, APFS with FileVault on |
| Sustained ledger commit rate with the durable setting on | at least 200 commits per second | measured 241 per second, `spikes/SP-12-sqlite-ledger/macos/REPORT.md#0-ket-luan` | verified; the floor is set below the measurement so a slower machine does not fail the criterion by a rounding margin |
| Median ledger commit latency with the durable setting on | at most 10 ms | measured 4.033 ms, same source | verified |
| Characters lost while the bubble opens during typing | 0, over at least 10 consecutive runs | `spikes/SP-7-pet-window-os/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q1 — 10 of 10 | verified |
| Characters lost while the bubble opens with the pet moving | 0, over at least 10 consecutive runs | `spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` Q17 — 10 of 10 | verified |
| Privacy permissions required by the core behaviour | 0 | `spikes/SP-22-macos-permissions/REPORT.md#0-ket-luan` | verified against a wiped permission state |
| Pet frame rate under roughly 70% system CPU load | at least 30 frames per second | measured 60.0, `spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan` | verified at the refresh rate of the attached display; not verified at 120 Hz |
| Pet state transition latency | under 2 seconds | measured 1.3 ms to 15.8 ms, same source | verified |

## Regression Scope

Every existing scenario of `ledger`, `platform`, `pet`, `app`, `uix` and `backend` is in scope, because this
change conditions existing behaviour on the operating system rather than adding an isolated feature. Two areas
deserve particular attention. The `ledger` scenarios that assume a write rate must be re-read against the
durable rate. The `platform` credential scenarios must be re-read against the case where an update has changed
the signing identity, which those scenarios were written without.

The cross-cutting cluster to re-check is the pair of trust obligations: Principle III, because durability is
what makes "ledger before act" true here, and Principle VII, because the macOS measurement confirms that a
device's credentials cannot travel with the user and that recovery therefore rests wholly on replication.

## Out of Scope

Not judged by this plan, and deliberately unverified: behaviour at 120 Hz, across two displays at different
scale factors, on battery, around the notch, over Sidecar or AirPlay, and on Intel Macs. The Mac mini could
not present any of these. Each is recorded in the corresponding spike report and in `docs/spike-inputs.md` §5
so that a later machine can close them without rediscovering that they are open.
